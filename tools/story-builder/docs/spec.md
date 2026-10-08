# Story Builder — Specification

## Overview

Story Builder is a Celbridge package for writing branching, choose-your-own-adventure stories, in the spirit of Twine. The author lays out story passages as nodes on a canvas, writes each passage in Markdown, and connects passages with ordinary Markdown links. The story can be played inside the editor and exported to a spreadsheet for translation.

## Goals

- **Visual structure.** The shape of the story is visible at a glance: passages are boxes, and choices are arrows between them.
- **Links are the connections.** A link in a passage's text is the only way to connect passages. There is no separate wiring UI to keep in sync with the text.
- **Instant playtesting.** The author can play the story from any passage without leaving the editor.
- **Localization-ready.** One click produces a spreadsheet translators can fill in.
- **Part of the application.** The editor's chrome uses the host's shared stylesheet and design tokens, and follows the light and dark theme, so it reads as a Celbridge editor rather than a web page embedded in one.
- **One file, no machinery.** A story is a single `.story` file that the editor reads and writes whole. Nothing is derived, duplicated or kept in step.
- **Diffable.** The file is pretty-printed, so a change to one passage shows up as a change to a few lines.

## Known prototype limits

- `<!-- fit -->` scales text in play and the preview, but not in an exported PDF: the browser helper draws fitted text in a shadow root, which the PDF rasteriser can't paint, so the PDF shows it at its natural size.
- Directives that belong to a whole deck (`theme:`, `paginate:`) have no home yet, since each passage is rendered on its own. A story-level preamble field, beside the name and description, is the natural place for them.
- A passage containing `---` would be several slides; only its first is shown.

## Non-goals

- Variables, conditions, scripting or state tracking. (Custom data, below, is fixed data the author sets for another program to read; the editor never acts on it.)
- Media (images, audio) in passages.
- Importing translations back into the story, or playing in a language other than the source.
- Publishing a standalone playable build.
- Drafting a story by hand outside the editor. The file is readable, but it's the editor's data, not a prose format. (Generating a Markdown version of a story is a plausible later addition.)

## Package

- A Celbridge package named `story-builder` that contributes one document editor for the `.story` extension, with a book icon and an "Empty Story" template for New File. The template is a single Start node with a line of placeholder text.
- The editor is a WebView page that uses the Celbridge JS client for the document lifecycle, spreadsheet tools and logging.
- Play mode renders a passage as a **Marp slide**, using `@marp-team/marp-core` 5.0.2 (a v5 release candidate) with its Shiki, Mermaid and KaTeX plugins and its browser helper. The prototype imports it from a CDN on first play, so the editor still opens, edits and saves with no network; a package that shipped would vendor the bundle the way the QR editor vendors its encoder.
- The page links the host's shared stylesheet and builds its chrome from the shared components: the toolbar is the icon rail, the divider is the splitter, and the properties panel is the same section surface the host's settings panels use, with its header and fields. The editor styles only what is its own — the canvas, the nodes and connections on it, and the reading view.
- All user-facing strings are localized, including the editor, file type and template names in the manifest. The node name `Start` is part of the story format, so it is not localized.

## Story model

- A story has a **name** and a **description** of its own. Both are optional, and neither has to match the file name.
- A story is a set of **nodes**. Each node has a name, a position on the canvas, and Markdown text. A node is one slide: its text is Marp-flavoured Markdown, so Marp's directives (themes, background images, per-slide classes) are available to it.
- **Names are unique** and identify the node: they are what links point at, and what the editor keys a node by. Renaming a node rewrites the links that pointed at it (see the properties panel), so nothing else has to track identity.
- A **link** is standard Markdown link syntax whose target is a node name: `[Open the door](Hallway)`. Every link in a node's text is an outgoing connection to the node with that name. A link to a name that doesn't exist is allowed; it just isn't drawn.
- The story begins at the node named **Start**.
- A story and each of its nodes can carry **custom data**: extra fields for another program to read, described by shared schema files. See Custom data.

## Storage

The `.story` file *is* the story. There is no sidecar and nothing derived from the file.

- The file is a JSON object with the story's `name` and `description`, then its optional `schemas` and `data` (see Custom data), its `navigation` and `sequenceArrows` settings, and a `nodes` array. Each node is `{ name, x, y, text }`, where `text` is the passage's Markdown, plus an optional `data`. Pretty-printed, one field per line.
- **Unknown fields are kept.** A field the editor doesn't recognise, on the story or on a node, is read and written back unchanged, after the known fields. Saving never loses something another tool or a hand edit put in the file.
- JSON is used because the editor runs in a WebView, where JSON parsing is built in. The cost is that passage text carries `\n` escapes rather than real line breaks.
- **Reading is forgiving**, so a hand-edited file still opens:
  - A missing or non-string `name` or `description` is empty.
  - A node keeps the fields it has and defaults the rest: a missing name becomes "Node", a missing position puts the node in a row with the others, missing text is empty. A repeated name gets a number added to keep it unique.
  - An empty file, or one whose `nodes` array is empty, opens as a new story: a single Start node with placeholder text.
  - Content that can't be parsed at all also opens as a new story, and the editor shows a notice saying the file couldn't be read and that editing will replace it. This warns the author before their first edit overwrites a file they may want to recover.
- Edits save automatically shortly after the author stops typing or dragging. The document is marked dirty as soon as it changes, and a pending save runs immediately when the host asks for one (e.g. on close).

## Editor view

A toolbar across the top, the canvas filling the rest, and an inspector on the right when a node is selected.

### Toolbar

The actions that change the story come first; playing follows in a section of its own, separated from them, because it is a different mode rather than another edit. It stays beside the other buttons rather than at the far end of the toolbar, where it is easy to miss.

- **Add Node**: creates a node named "Node" (localized, and numbered "Node 2", "Node 3", … to stay unique) at the center of the view, and selects it. When that spot is already taken, the node cascades down and right until it lands clear of the others, so a new node is never hidden behind an existing one.
- **Delete Node**: deletes the selected node and its text. Disabled when nothing is selected. Links to the deleted node are left in other nodes' text.
- **Export**: see Localization export.
- **Play / Stop**: in its own section after the editing actions, coloured — green to start, red to stop — so the control reads as itself before its tooltip is read. See Play mode.
- **Download PDF**: at the far end of the toolbar, since it writes a file rather than editing the story. Its icon is a page with a red PDF badge and a red download arrow; while an export runs, an hourglass takes its place and the button is disabled.
  - It first opens a **save dialog**, drawn by the editor, because the host offers packages no save dialog of its own. It has a list of the project's folders on the left and the PDFs already in the chosen folder on the right. Below them are a file name box, the resource key the file will be written to, and Save / Cancel. Rendering starts only once the author has chosen, so cancelling costs nothing.
  - It suggests the story's own folder and name (`my_story.story` → `my_story.pdf`) the first time, and after that wherever the author last saved during the session.
  - `.pdf` is added when the name leaves it off. A name holding `\ / : * ? " < > |` can't be saved, and neither can one that matches a folder.
  - When the name matches a file already in the folder (ignoring case), a warning says it will be replaced and the button reads **Replace**. The existing file's own spelling is kept. Clicking a PDF in the right-hand list takes its name, and double-clicking it replaces it straight away.
  - The PDF can only be saved inside the project, since the file tools reach nothing outside it. Once it's written, a notification names where it went.
- **Settings**: last on the toolbar, after a separator, with a sliders icon. It opens the story's settings in the properties panel, and shows as pressed while they are open. Clicking it again closes them.

While the story is playing, the editing actions are disabled: the canvas they act on isn't on screen, and Stop is the way back.

### Canvas

- A background grid. Nodes snap to the grid when created and when released after a drag.
- Each node is a box showing its name, sized to fit the name. A node is outlined in one of three colours: its resting colour, the selection colour, and the colour marking a node that the selected one links to.
- **The canvas has a look of its own.** It is a blue-tinted field with a grid drawn on it, holding nodes that carry colour — deliberately a step away from the host's neutral panel surfaces, so the graph reads as the thing being worked on rather than as more chrome. It keeps its own small palette (canvas, grid, node fill, the three node colours, connections) with a value per theme, so it sits correctly in light and dark. Everything around it — the toolbar, the inspector, the text on the nodes — comes from the host's tokens.
- Click a node to select it, and drag to move it. Click empty space to deselect. Drag empty space to pan (this doesn't change the selection).
- Double-click a node to centre the view on it, so a graph wider than the view can be walked node by node. The view eases there over a short travel rather than jumping, so it stays clear where the graph went. Panning, zooming or dragging a node cancels the travel, so a gesture always wins over it.
- The mouse wheel zooms around the cursor, within limits so nodes never become unreadably small or huge. Panning is limited so that some nodes always remain on screen.
- On open, the view is centered on the Start node.

### Connections

- Each link is drawn as a line between the centers of the two nodes, with an arrowhead at the midpoint showing its direction. When two nodes link to each other, the line shows arrows both ways.
- When a node is selected, it is highlighted and so are the nodes it links to.
- Connections can't be selected or edited directly. They update live as the author edits text.

### Properties panel

Presented as a settings section: a panel carved out of the page and inset from its edge, under a heading naming what it is showing — "Story" or "Node". The heading carries no description line; what the two fields are is plain from their labels, and the space is better spent on the fields.

- **Always on screen.** The panel can't be collapsed or closed; it shows whichever of three things is in context.
- **Beside the canvas, or below it.** While the document is wide enough to spare a column, the panel sits to the right of the canvas. Below that width it moves under the canvas and spans the full width, and the splitter turns with it. The editor measures the document and switches arrangements on its own, at the width the host holds for this decision.
- **Resizable by proportion.** The splitter sets the panel's share of the document — of its width beside the canvas, of its height below it — between a fifth and a half, defaulting to just under a third. Because the size is a share rather than a fixed one, the split holds its proportions when the document is resized, and carries over when the arrangement changes. Double-clicking the splitter restores the default.
- **Scrolls when short.** The prose field gives up height as the panel shrinks, down to a floor; past that the panel scrolls rather than squeezing the field into a sliver.
- **Keeps the selection in view.** When the canvas changes shape — the arrangement flips, or a splitter drag ends — a selected node that the new shape has pushed out of view, or left against an edge, is brought back by the smallest travel that clears the margin, using the same eased pan as centring. A node still comfortably in view is left alone, since the author may have panned away from it deliberately, and the check runs once at the end of a drag rather than on every frame. With nothing selected, nothing moves.
- **With a node selected**, it shows that node:
  - A **Name** field. A rename is applied when the field is committed. It is rejected (and the field reverts) if the name is empty or already taken. Renaming a node rewrites every link that pointed to its old name, and every custom `node` field that held it, so the connections survive.
  - A multi-line **text** area for the node's Markdown, in the monospace face. It has no placeholder text, which would distract from an empty passage.
  - Four **text view** buttons at the left of the node's header, in this order:
    - **Rendered preview** shows the slide alone.
    - **Side by side** (a two-column icon) shows the Markdown on the left and the preview on the right.
    - **Markdown above preview** (the same icon turned on its side) shows the Markdown above the preview.
    - **Source** shows the Markdown alone, and is where the panel starts.

    The author picks the split direction, whichever way the panel sits beside or below the canvas. Both splits start at 50:50, with a divider between the two that can be dragged (from 15% to 85%) and double-clicked to go back to 50:50. The two splits share that proportion, so switching between them keeps the divider where it was. The slide is fitted into its share and letterboxed.
  - Below the text area, one collapsible section per schema the story uses, holding that schema's node fields (see Custom data).
- **With nothing selected**, it shows the story itself: its **Name** and a **Description**, saved with surrounding whitespace trimmed, then one section per schema holding its story fields. This is also what a story opens on, since nothing is selected then.
- **With the settings open** (from the toolbar's Settings button), it shows the story's settings under a "Settings" heading, with a close button at the header's left. There are three groups, set well apart: the default sequence's nav buttons in play mode (show them, show the slide number, arrows or arrows and node name, which corner), the default sequence's connections on the graph (show them, dashed or solid, colour, alpha), and the story's **Data schemas** (see Custom data). Changes apply and save as they are made. Closing the settings, pressing the toolbar button again, or selecting a node or clicking empty canvas returns the panel to the node or the story. The editor doesn't remember whether the settings were open, so a story always opens on the story panel.

### Theme

- The editor follows the host's light and dark theme with no reload. Connections are painted on a canvas, so the editor repaints them when the theme changes; everything else restyles itself from the tokens.

## Custom data

A story can carry extra fields for programs other than the editor. The first use is the text adventure in `src/`, which reads its locations, exits and items from a story (see `spec12.md`), but nothing about custom data is specific to it.

### Schemas

- A **schema** is a JSON file, shared by every story that uses it, conventionally named `*.schema.json`. It has a `namespace` (the key its data is stored under), a `title` (shown on its sections in the panel), and two lists of field definitions: `story` fields and `node` fields.
- A field has a `key`, a `label`, a `type`, and optionally `help` (a tooltip) and `default`. The types are `text`, `multiline`, `number`, `boolean`, `choice` (one of its `options`), `node` (a node name) and `list` (an array of strings, or of objects when the field gives its own `fields`).

### In the file

- `schemas` lists the resource keys of the schema files the story uses.
- `data`, on the story and on any node, is an object keyed by namespace, one object per schema: `"data": { "adventure": { "start": "Farmhouse" } }`. Several schemas can share a story without clashing.
- A field left empty is not written. A story with no schemas and no data is exactly as before.

### In the editor

- **Settings → Data schemas** lists the story's schema files, with add (a drop-down of the project's `*.schema.json` files) and remove. Removing a schema leaves its data in the file.
- The story panel and the node panel show one collapsible section per schema, with an input per field: a one-line box, a text area, a number box, a checkbox, or a drop-down (of the options, or of the story's nodes). A list shows its rows, each with its own fields, and buttons to add, remove and reorder rows.
- Changes save as they are made, like the rest of the story.
- **Reading is forgiving** here too, and nothing is ever dropped:
  - A value that doesn't fit its field (text in a `number`, say) is kept, and the field shows a warning in place of its input.
  - Data under a namespace with no schema, or whose schema file is missing or can't be parsed, is kept and shown read-only as JSON, with a notice saying why.
  - Keys the schema doesn't mention are kept.
- `.story` files aren't scanned for `"project:..."` references, so moving a schema file doesn't update the stories that list it; the editor reports the missing schema instead.

## Play mode

- **Play** replaces the editor with a reading view. It starts from the selected node, or from Start when nothing is selected.
- If nothing is selected and there is no Start node, the editor stays open and a notice banner appears over the top of the canvas. It says a Start node is needed, or that the author can select a node to play from. It doesn't block editing. It stays until the author dismisses it or starts playing.
- The reading view shows the current node rendered as a slide: Marp lays it out at slide proportions and the view scales it to fit, letterboxed and centred, however short or narrow the document is. The slide brings its own typography and colours, so the editor styles only the room around it.
- A node whose text won't render is reported rather than shown blank, and the story stays playable.
- Clicking a link moves to the target node. Link clicks are caught on the view rather than bound to each anchor, so a link can never fall through to its default action, which would navigate away from the editor. The text fades out and the new text fades in, and the view scrolls back to the top. A link to a missing node shows a "not found" message instead of failing.
- While playing, the Play button becomes **Stop**, which returns to the editor as it was.

## Localization export

- **Export** writes a spreadsheet with the same name as the story, next to it (`my_story.story` → `my_story.xlsx`).
- One worksheet, "Localization". The columns are **Node** (the unique name), **Text** (the source Markdown), and one empty column per target language. For now the only target language is `es`.
- Only node text is exported; custom data is not.
- Basic styling: a bold, colored header row and column widths suited to the content.
- Re-exporting updates the existing workbook in place rather than deleting and recreating it, so an open spreadsheet tab reloads. Rows for nodes that have since been deleted are removed.
- The result of the export (success or failure) is reported.
