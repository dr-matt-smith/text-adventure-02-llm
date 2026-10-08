# version 12

## custom data fields, and the adventure game reading .story files directly

Goal: `src/data/farm.json` and `src/data/stranded.json` are deleted. The text adventure reads
`farm.story` and `stranded.story` directly, and the Story Builder is where an adventure is written.

To get there, a story (and each of its nodes) can carry extra **custom data**, described by a
**shared schema file**. The adventure is the first use, but nothing in the editor is specific to it.

Steps, in order (each one is usable on its own):

1. the editor keeps fields it doesn't know about
2. custom data and schema files
3. the adventure schema, and the game's story loader
4. convert both stories, delete the JSON files


## 1. keep unknown fields

At the moment saving rebuilds the file from the fields the editor knows
(`nodes.map(({ name, x, y, text }) => ...)`), so anything else in the file is lost on the next edit.

- reading keeps every field it doesn't recognise, on the story and on each node
- saving writes the known fields first, in their usual order, then the unknown ones, unchanged
- a hand-added field therefore survives any edit


## 2. custom data and schemas

### in the .story file

```json
{
  "name": "Down on the Farm",
  "description": "...",
  "schemas": ["project:src/data/adventure.schema.json"],
  "data": {
    "adventure": { "start": "Farmhouse", "title": "DOWN ON THE FARM", "meterName": "DAYLIGHT" }
  },
  "navigation": { ... },
  "sequenceArrows": { ... },
  "nodes": [
    {
      "name": "Barn",
      "x": 0,
      "y": 120,
      "text": "# Barn\n\n...",
      "data": {
        "adventure": {
          "mapCol": 0,
          "mapRow": 1,
          "dark": "You step into the barn. It is pitch black in here - you can't see a thing without a light.",
          "items": [{ "name": "wrench", "description": "A big adjustable wrench. Just the thing for a leaking pipe." }]
        }
      }
    }
  ]
}
```

- `schemas` - the schema files this story uses (resource keys)
- `data` - on the story and on any node: one object per schema, keyed by the schema's `namespace`,
  so several uses can share a story without clashing
- both are optional; a story without them is exactly as before

### schema file

A JSON file, shared by every story that lists it. It says which fields exist, at story level and
at node level, and how to edit them:

```json
{
  "namespace": "adventure",
  "title": "Text adventure",
  "story": [
    { "key": "start", "label": "Start location", "type": "node" }
  ],
  "node": [
    { "key": "dark", "label": "Description when dark", "type": "multiline" },
    { "key": "items", "label": "Items", "type": "list",
      "fields": [
        { "key": "type", "label": "Type", "type": "choice", "options": ["", "lantern", "oxygen tank", "cow", "gate", "trough"] },
        { "key": "name", "label": "Name", "type": "text" },
        { "key": "description", "label": "Description", "type": "multiline" }
      ] }
  ]
}
```

Field types:

| type | value | edited with |
|---|---|---|
| `text` | string | one-line box |
| `multiline` | string | text area |
| `number` | number | number box |
| `boolean` | true / false | checkbox |
| `choice` | one of `options` - all strings, or all numbers (written as numbers) | drop-down |
| `node` | a node name | drop-down of the story's nodes |
| `list` | array - of strings, or of objects when `fields` is given | rows, each with its fields, plus add / remove / move up / move down |

Every field may also have `help` (a tooltip) and `default`.

### in the editor

- **Settings** gets a third group, **Data schemas**: the schema files the story uses, with add
  (a drop-down of the project's `*.schema.json` files) and remove. Removing a schema does not
  delete its data from the file.
- **Story panel** (nothing selected): under Name and Description, one section per schema, titled
  with the schema's `title`, holding its story fields.
- **Node panel**: the same, with the node fields, below the text area. The sections can be
  collapsed, so the text keeps most of the room.
- a field left empty is not written to the file
- **renaming a node** also updates every `node` field that pointed at the old name (as links are
  rewritten now)
- **forgiving, as for the rest of the file:**
  - a value that doesn't fit its field (e.g. text in a `number`) is kept, and the field shows a
    warning instead of an input
  - data for a namespace with no schema, or whose schema file is missing or broken, is kept and
    shown read-only as JSON, with a notice saying why
  - keys in the data that the schema doesn't mention are kept
- the localization export is unchanged: it exports node text only


## 3. the adventure

### the schema: `src/data/adventure.schema.json`

Story fields (`data.adventure` on the story):

| key | type | replaces in `Story.ts` |
|---|---|---|
| `start` | node | `farm.json` `start` |
| `title` | text | `title` |
| `blurb` | multiline | `blurb` |
| `intro` | multiline | `intro` |
| `meterName` | text | `meterName` |
| `runOutMessage` | multiline | `runOutMessage` |
| `wonTitle` | text | `wonTitle` |
| `lostTitle` | text | `lostTitle` |
| `wonMessage` | multiline | `wonMessage(moves)` - `{moves}` is replaced by the number of moves |
| `lostMessage` | multiline | `lostMessage(moves)` - as above |

Node fields (`data.adventure` on a node):

| key | type | meaning |
|---|---|---|
| `mapCol`, `mapRow` | number | where the location is drawn on the mini map |
| `dark` | multiline | set = a DarkLocation, and this is what you see without a light |
| `items` | list of { type, name, description } | a `type` makes a special item (Lantern, Cow...); otherwise `name` and `description` make a plain Item |

The story's commands and `checkForWin()` are code, so they stay in `Farm.ts` and `Stranded.ts` -
which shrink to: which `.story` file, which extra commands, and how you win.

### location text comes from the slide

A node's text is read like this:

1. split it into paragraphs at blank lines
2. a `#` heading is the location's name (if there is none, the node name is used)
3. a paragraph made only of links is the **exits** line: `[South](Farmyard) · [West](Barn)`.
   Each link's text must be a direction (`North`, `n`, ...), and its target is the node it leads to
4. HTML comments (Marp directives such as `<!-- fit -->`) are removed
5. every other paragraph is a description: the first is shown on the first visit, then a random
   one after that (as `descriptions[]` does now). Lines in a paragraph are joined with spaces
6. links in a description are shown as their text (`a muddy [lane](Lane)` -> `a muddy lane`) and do
   not make exits; `**bold**` and `_italic_` markers are removed, since the terminal is plain text

Errors stop the game loading with a message naming the node: an exit whose text isn't a direction,
an exit to a node that doesn't exist, no `start` (or a `start` that isn't a node), a node with no
description, a `---` in a node's text, an item with neither a known `type` nor a name and description.

### in the game code

- a new `src/adventure/StoryFile.ts` turns a story file into the same `WorldData` the `World` uses
  now, so `World`, `Location`, `DarkLocation` and the items don't change. Location ids become node
  names (`getLocation("field")` -> `getLocation("Field")`)
- `readStory()` in the same file makes the whole `Story`: its title, blurb, messages... from the
  story file's `data.adventure`, plus the commands and `checkForWin()` that `Farm.ts` / `Stranded.ts`
  pass it
- **how the game gets the file:** Deno recognises a JSON module by its `.json` ending, so rather than
  rely on it importing a `.story`, `copy-stories.ts` copies `src/data/*.story` to
  `generated/*.story.json` (not kept in git) and the game imports those. `build.ts` runs it first, and
  so do `deno task test` and `deno task check`
- `tests/Adventure.test.ts` keeps passing unchanged (it checks display names, which come from the
  headings)


## 4. convert the stories

- `farm.story`: move each `<!-- adventure -->` block into the node's `data.adventure`, add `mapCol` /
  `mapRow` and the story fields from `Farm.ts`. The slide text needs no other change
- `stranded.story`: new, made from `stranded.json` and `Stranded.ts`, laid out on the canvas to
  match the mini map
- delete `farm.json` and `stranded.json`, and update the README


## later (not in version 12)

- the clock (`MAX_TIME`, `TIME_PER_MOVE` in `Player.ts`) as story fields, so each story can set its own
- exporting custom `text` / `multiline` fields for translation
- `.story` files aren't scanned for `"project:..."` references, so moving a schema file doesn't
  update the stories that list it - for now, move it by hand
