# Story Builder — Mermaid.js vs beautiful-mermaid

Written 30 September 2026, after namespaces in a class diagram were found to be silently dropped.
Read this before deciding how the story editor should render ```` ```mermaid ```` blocks.

Background: [`README_PROTOTYPE.md`](README_PROTOTYPE.md) covers the move to Marp Core v5, where Mermaid support
started coming from Marp's Mermaid plugin (`https://esm.sh/@marp-team/marp-core@5.0.2/plugins/mermaid`).

**Short version:** beautiful-mermaid is quicker and looks good on slides, but it only understands part of the
Mermaid language. Mermaid.js understands all of it and matches GitHub and mermaid.live, but it's heavier and
harder to fit into this editor.

## What happened: namespaces disappear

The Marp Mermaid plugin doesn't use Mermaid.js, the renderer behind GitHub and mermaid.live. It uses
[beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid), a separate renderer that only supports part of
the syntax. Its README lists class diagram support for classes, attributes, methods and relationships, but not
`namespace`.

The syntax is still accepted, so there is no error: the namespace boxes and labels are simply dropped.

### How it was checked

The class diagram in "Node 3" of `stories/examples.story` was rendered through the same Marp 5.0.2 and Mermaid
plugin the editor loads, in three versions:

1. The original, with dotted names like `namespace Company.Engineering.Backend { … }`.
2. Simple names like `namespace Backend { … }`.
3. No namespaces at all.

All three came out as the same 361.6 × 356.3 SVG: three class boxes (Developer, Designer, TechLead) and the
"leads" arrows. None had a namespace group or label. So the dotted names aren't the cause; namespaces of any kind
are dropped.

## beautiful-mermaid (what the editor uses now)

### Advantages

- **Easy to fit in.** It draws diagrams in the same pass as the rest of the slide (Marp's `render()` stays
  synchronous), so play, the preview and the PDF export all work without extra steps. This is why the Marp v5
  upgrade needed so few changes.
- **Matches the slide theme.** Its colours come from Marp's theme values (the `--marp-mermaid-*` and
  `--marp-shiki-*` settings on the SVG). Diagrams pick up the slide's light or dark colours with no setup.
- **Looks clean by default** and is built for speed.
- **Draws its labels as plain SVG text**, which is what the PDF export (html2canvas) can handle.
- **Smaller to load** than Mermaid.js.

### Disadvantages

- **Only 6 diagram types:** flowchart, state, sequence, class, ER and XY chart. There's no Gantt, pie, git graph,
  mindmap, timeline, user journey, C4, quadrant, Sankey, architecture or block diagram.
- **Only part of the syntax within those types.** Namespaces are one example.
- **Fails silently.** Anything it doesn't support is dropped with no error. You only notice when the diagram
  looks wrong.
- **Diagrams won't match** what the same code shows on GitHub, mermaid.live or in docs.
- **Licence to watch if the editor ever bundles it** instead of loading it from the web. It depends on elkjs,
  which is under EPL-2.0 rather than MIT (see the vendoring notes in `README_PROTOTYPE.md`).
- **Newer and less proven**, with a smaller community.

## Mermaid.js (the standard renderer)

### Advantages

- **All diagram types and the full syntax**, including namespaces, notes, styling, `classDef` and click handlers.
- **Works like the diagrams people already know:** code copied from GitHub, the Mermaid docs or mermaid.live looks
  the same here.
- **Mature and widely used**, with good documentation and fast fixes.
- **Shows syntax errors** instead of silently dropping unsupported parts.
- **MIT licence.**

### Disadvantages

- **Harder to fit into this editor.** It draws diagrams after the slide has appeared, but the editor currently
  builds each slide in one go. Play, the preview and the PDF export would each need an extra step to fill diagrams
  in afterwards, and a diagram may briefly appear late.
- **Needs a setting change for the PDF export.** By default it draws labels as HTML inside the SVG
  (`foreignObject`), which html2canvas can't draw. Switching those labels to plain SVG text
  (`htmlLabels: false`) fixes that, but some diagram types look slightly different in that mode.
- **Doesn't follow the slide theme on its own.** It uses its own themes, so matching Marp's light and dark colours
  would need extra setup.
- **Much bigger to load**, which makes the first play or first PDF export slower.
- **Default look is plainer**, and styling it takes more work.
- **Not yet checked:** whether dotted namespace names like `Company.Engineering.Backend` nest into
  sub-namespaces. Test this as part of any switch.

## Test deck: `stories/design_patterns.story`

A 15-slide introduction to design patterns, written on 30 September 2026 to see how far beautiful-mermaid goes. It
has 8 class diagrams, a flowchart and a sequence diagram. Each diagram was rendered through Marp 5.0.2 and the
Mermaid plugin, inspected in the SVG, and checked on screen in play mode.

### What works

- **Class diagrams:** classes with attributes and methods, `+ - #` visibility, `<<interface>>` and
  `<<abstract>>`, inheritance (`<|--`), realisation (`<|..` and `..|>`), association (`-->`), dependency
  (`..>`), aggregation (`o--`, `--o`), composition (`*--`), relationship labels and `"1"` / `"*"`
  multiplicities. Members are shown UML-style as `name: Type`.
- **Static attributes:** `-int total$` is drawn underlined with the `$` removed.
- **Flowcharts:** `TD` / `LR` trees with real edges, and `classDef` with `:::name` (fill, stroke and stroke width
  all apply).
- **Sequence diagrams:** `participant X as Y` aliases, `->>` / `-->>` messages, activation with `+` / `-`, and
  `Note over A,B`.
- The look is clean, and colours follow the slide theme.

### What doesn't, and the workaround used

| Problem | Workaround in the deck |
|---|---|
| **Namespaces** are dropped silently (see above). | None: not used. |
| **Aggregation and composition diamonds are invisible.** The markers use `refX="0"`, so the diamond is drawn inside the owning class's box, which covers it. | Fixed in the editor: `showDiagramDiamonds()` in `js/story.js` sets `refX="12"` on those two markers after every render (play, preview and PDF). Remove it once beautiful-mermaid is fixed. |
| **Generics with tildes** (`List~Shape~`) show the tildes. | Write the brackets directly: `List<Shape>`. |
| **A space inside generics** (`Map~String, String~` or `Map<String, String>`) splits the member into garbage. | No space: `Map<String,String>`. |
| **`$` / `*` on methods** give the right underline or italic, but the character stays in the text wherever it's put (`getInstance(): $ Configuration`). | Left off methods. Static-ness is shown on attributes only, and abstract-ness by `<<abstract>>` on the class. |
| **`direction LR` in class diagrams** is ignored: the layout is always top to bottom. | Keep inheritance chains short. Write edges so they all point "down" (`Coffee --o CoffeeDecorator` rather than `CoffeeDecorator o-- Coffee`, `Adapter ..\|> Interface` rather than `Interface <\|.. Adapter`), otherwise loops pull the interface below its implementers or add levels. |
| **A chain of long vertical relationships** makes tall, narrow diagrams that shrink to tiny text on a 16:9 slide. | Independent pairs wrap into a grid, so the UML cheat sheet uses six separate pairs instead of one chain. |
| **Flowchart subgraphs holding loose nodes** stack into one very tall column (182 × 1134 for three families). | A tree with real edges instead. |
| **Chained invisible links** (`A ~~~ B ~~~ C`) silently drop every node after the first. | Not used. |
| **`<br/>` in labels** is removed, and the lines run together. | Short single-line labels. |

### Overall

For the diagrams this deck needed, beautiful-mermaid can do the job, but only with care. Every class diagram
ended up readable and correct. Getting there needed the marker fix in the editor, and diagram syntax adjusted
around the renderer (no tildes, no spaces in generics, no method classifiers, edge directions chosen for layout).
None of the failures produced an error; each one had to be spotted by looking at the output. Text inside diagrams
stays small, noticeably smaller than the code beside it: the renderer's base text size is small, and class
diagrams can only grow downwards, so they are scaled to 71–100% to fit the slide.

## Options

1. **Change diagrams so beautiful-mermaid can draw them.** For example, use a `flowchart` with
   `subgraph Backend … end` blocks for the groups. You get grouping boxes but lose the class-box look with its
   method list. Quickest fix; no code changes.
2. **Render ```` ```mermaid ```` blocks with Mermaid.js instead of the Marp plugin.** Everything matches GitHub
   and mermaid.live. It's a real change to `js/story.js`: diagrams drawn after each slide appears (in play, the
   preview and the PDF export), `htmlLabels: false` for the PDF, and theme colours mapped from Marp's.
3. **Keep beautiful-mermaid and accept the limit.** Add the unsupported features to the known-limits list in
   `docs/spec.md` so authors aren't caught out.
4. **Middle path:** beautiful-mermaid by default, Mermaid.js only for diagram types or features it doesn't support.
   The best of both, but the most complicated to build and maintain.

## Recommendation

- **If authors write their own diagrams from Mermaid docs or examples:** switch to Mermaid.js (option 2). The
  silent dropping is the real problem, because authors can't tell what went wrong.
- **If diagrams are mostly simple flowcharts and class diagrams:** beautiful-mermaid is fine (option 3), with the
  limits documented in `docs/spec.md`.
- Only build the middle path (option 4) if both matter.

No decision has been made yet; the editor still uses beautiful-mermaid.
