# Story Builder — Marp v5 prototype notes

Written 30 September 2026, when the story editor was moved from Marp Core v4 to the **v5 release candidate**.
Review this when Marp Core v5 goes stable (npm's `latest` tag moves from 4.x to 5.x).

Background: [marp-team discussion #625](https://github.com/orgs/marp-team/discussions/625) announced the v5 RC,
and the [v4 → v5 migration guide](https://github.com/marp-team/marp-core/blob/main/docs/migration-v5.md) lists the
breaking changes.

## Summary

| | Before | Now |
|---|---|---|
| Marp Core | `https://esm.sh/@marp-team/marp-core` (unpinned, resolved to 4.4.0) | `https://esm.sh/@marp-team/marp-core@5.0.2` (pinned RC) |
| Syntax highlighting | highlight.js, built into core | Shiki plugin (`/plugins/shiki`) |
| Maths | KaTeX/MathJax, built into core | KaTeX plugin (`/plugins/katex`) |
| Mermaid diagrams | not available | Mermaid plugin (`/plugins/mermaid`) |
| `<!-- fit -->` auto-scaling | not working (helper couldn't be loaded as a module) | working in play and preview, via `/browser` |
| WebKit SVG polyfill | separate `@marp-team/marpit-svg-polyfill` import | included in the browser helper |
| Mermaid diagram size | natural size (often a small corner of the slide) | full slide width by default |
| nomnoml UML diagrams | not available | the editor's own plugin, `js/nomnoml-plugin.js` (see section 6) |

Everything is still loaded from esm.sh on first play or first PDF export. Nothing is vendored yet.

Most code changes are in `js/story.js`. The nomnoml plugin is in its own file, `js/nomnoml-plugin.js`.
`docs/spec.md` was updated to match (the known-limits list and the Package section).

## What changed in `js/story.js`

### 1. Pinned version and plugins

```js
const MARP_URL = 'https://esm.sh/@marp-team/marp-core@5.0.2';
const MARP_PLUGIN_URLS = ['shiki', 'mermaid', 'katex'].map((name) => `${MARP_URL}/plugins/${name}`);
```

Since v5, `@marp-team/marp-core` is a lightweight core. Without the Shiki plugin, code blocks lose their
syntax highlighting, which matters because the stories are code-heavy. `@marp-team/marp-core/full` would bring
everything back, but it's about 11 MB and needs MathJax as well. So only the three plugins we want are loaded.

The version is pinned so that `latest` moving from 4.x to 5.x can't change the editor without warning.

### 2. One renderer factory, `createMarp(options)`

`loadMarp()` imports the core and the three plugins in parallel, then builds renderers through `createMarp()`:

```js
createMarp = (options = {}) => withSlideDefaults(plugins.reduce(
    (renderer, plugin) => renderer.use(plugin.default()),
    new core.Marp({ script: false, markdown: { breaks: true }, ...options })));
marp = createMarp();
```

- Play and the node preview use `createMarp()`, which renders inline SVG.
- PDF export uses `createMarp({ inlineSVG: false })`, which renders plain HTML so html2canvas can paint it.

Both therefore get the same plugins and defaults. The earlier `marpCore` module variable was replaced by
`createMarp`.

`render()` is still synchronous in v5 with these plugins, so `showSlide()` and the PDF loop didn't need to
change.

### 3. Browser helper (`<!-- fit -->` and the WebKit polyfill)

v4 had no `exports` map, so esm.sh couldn't serve `@marp-team/marp-core/browser` as a module. v5 has one.

```js
const MARP_BROWSER_URL = `${MARP_URL}/browser`;
```

- `startBrowserHelper()` replaces `startSvgPolyfill()`. It imports the helper and runs
  `marpBrowser = helper.browser(document)` once. This starts the SVG polyfill loop for the whole page and
  defines Marp's custom elements.
- `showSlide()` calls `marpBrowser?.update()` after each render. WebKit doesn't support customised built-in
  elements (`<h1 is="marp-h1">`), so the helper has to swap the new slide's fitting elements for its own
  (`<marp-h1>` and so on) each time a slide is put into the page. Without this, fitting only works on the
  first slide shown.
- `script: false` stays on the Marp constructor. The script Marp would inject wouldn't run from `innerHTML`.
- If the helper fails to load, a warning is logged and slides still show, just unfitted and cropped when
  scaled down in WebKit.

**Visible side effect:** the built-in themes also mark code blocks as
`<pre is="marp-pre" data-auto-scaling="downscale-only">`. With the helper running, long code lines now shrink
to fit the slide width instead of running off the edge. Some existing `<style scoped>` font-size tweaks in
stories may no longer be needed.

### 4. PDF export keeps fitted text plain

The helper fits text by drawing it in a shadow root, and html2canvas can't paint shadow DOM. So the PDF stage
removes Marp's `is="marp-…"` attributes before the slide goes into the page:

```js
stage.innerHTML = html.replace(/ is="marp-[a-z0-9]+"/g, '');
```

In an exported PDF, `<!-- fit -->` text and auto-scaled code blocks appear at their natural size, as they did
before the upgrade. This is recorded as a known limit in `docs/spec.md`.

### 5. Mermaid diagrams fill the slide width by default

Mermaid SVGs come out at their natural pixel size. They have a `viewBox`, so they scale cleanly. A default rule
is added to every slide's stylesheet:

```js
const SLIDE_DEFAULT_CSS = 'svg[data-marp-mermaid] { width: 100%; }\n';

function withSlideDefaults(renderer) {
    const packOptions = renderer.themeSetPackOptions;
    renderer.themeSetPackOptions = function (...args) {
        const options = packOptions.apply(this, args);
        options.before = (options.before ?? '') + SLIDE_DEFAULT_CSS;
        return options;
    };
    return renderer;
}
```

This is the same hook the Mermaid plugin uses to add its own CSS. Marp scopes the rule to the slide
(`div.marpit > … > section svg[data-marp-mermaid]`), so:

- the theme's height cap still applies (563px in `default`, `calc(580px - 1em)` in `gaia`), so tall diagrams
  shrink to fit instead of overflowing;
- a theme that sets its own width comes after the rule and wins;
- a node's `<style scoped>` has higher specificity and wins. For example:

```markdown
<style scoped>
svg[data-marp-mermaid] { width: 60%; margin: 0 auto; }
</style>
```

**Caveat:** `themeSetPackOptions` isn't documented public API. It's what Marp's own plugins use, but check it
still exists after any version bump.

### 6. nomnoml UML diagrams (`js/nomnoml-plugin.js`)

```` ```nomnoml ```` code blocks are drawn as UML diagrams by [nomnoml](https://nomnoml.com) 1.7.0, imported
from `https://esm.sh/nomnoml@1.7.0`. nomnoml and its only dependency, `graphre`, are both MIT, and together
they're about 70 KB.

- **Same shape as Marp's plugins.** The module's default export returns a markdown-it plugin, so it's simply the
  last entry in `MARP_PLUGIN_URLS`, loaded with `new URL('./nomnoml-plugin.js', import.meta.url)`. Play,
  preview and PDF export all get it through `createMarp()`.
- **Synchronous rendering.** `renderSvg(source)` returns an SVG string straight away, so it works inside
  Marp's `render()`. The plugin wraps the fence renderer and tags the output `<svg data-nomnoml …>`.
- **Errors fall back to code.** When a diagram doesn't parse, it's shown as an ordinary code block, and the
  parse message (without the stack trace) is logged. The plugin is loaded after Shiki, so every other code
  block is still highlighted.
- **Sizing.** `SLIDE_DEFAULT_CSS` stretches the diagram to the full slide width, with `max-height: 563px`,
  because no theme caps nomnoml the way themes cap Mermaid. A node's `<style scoped>` can override this.
- **Styling.** nomnoml uses its own colours and fonts, not the Marp theme's. Change them with directives in
  the diagram text, for example `#fill: #fdf6e3`, `#stroke: #333` or `#font: Helvetica`.
- **Coloured packages.** A custom style such as `#.tesco: visual=package fill=pink`, used as `[<tesco> tesco | …]`,
  gives a package its own colour. nomnoml draws the package's tab at the left, just as wide as the name, but
  centres a custom style's title by default, so the name would float outside the tab. The plugin's
  `alignPackageTitles()` adds `title=left` to any custom style with `visual=package` before nomnoml sees it
  (`title=bold` becomes `title=bold,left`). A style that already sets `title=left`, `title=center` or `align=`
  is left as written.

Example:

````markdown
```nomnoml
[<abstract>Subject|+on(event, handler);+emit(event, payload)]
[Player]-:>[Subject]
[Subject]->*[<interface>Observer]
[ScreenFlash]-:>[Observer]
[AudioObserver]-:>[Observer]
```
````

**When v5 goes stable:** the plugin only relies on markdown-it's `renderer.rules.fence` and the plugin shape
that `Marp.use()` accepts, so it should carry over unchanged. Pin any newer nomnoml version on purpose,
rather than letting it float.

## How it was checked

- `node --check js/story.js` passes.
- The loading code was run in Deno against esm.sh (5.0.2 plus the three plugins).
  - All 13 nodes of `stories/week07-observer.story` rendered in both inline-SVG and plain-HTML modes.
  - The output was confirmed to contain Shiki highlighting, line highlighting (```` ```ts {2} ````), KaTeX
    output, Mermaid SVGs and `is="marp-h1" data-auto-scaling` for `<!-- fit -->`.
- The nomnoml plugin was run through the same pipeline in both render modes. A valid diagram produced an
  `<svg data-nomnoml>` with a `viewBox`, the default CSS was present, a broken diagram fell back to a code
  block, and a `ts` block was still Shiki-highlighted.
- The emitted CSS was inspected to confirm the order and specificity of the Mermaid default relative to the
  theme and to `<style scoped>`.
- In Celbridge: a Mermaid `graph LR` diagram rendered in the split preview (before the width default was
  added).

**Not yet confirmed in Celbridge:** `<!-- fit -->` headings, code-block downscaling in the WebKit split
preview, the width default on Mermaid diagrams, PDF export with Mermaid (html2canvas may not resolve the CSS
variables Mermaid uses for colours inside the SVG), and KaTeX fonts (loaded from jsDelivr, so they need a
network connection).

## Checklist for when v5 goes stable

1. **Check the version.** Look at the dist-tags for `@marp-team/marp-core` (`latest` should be 5.x) and pin
   `MARP_URL` to that version. Don't switch back to an unpinned URL.
2. **Read the release notes and migration guide** for anything that changed between the 5.0.2 RC and the
   stable release, especially:
   - plugin entry points (`/plugins/shiki`, `/plugins/mermaid`, `/plugins/katex`) and their default exports;
   - the `/browser` export and its `browser(target)` / `.update()` API;
   - whether `render()` is still synchronous with Shiki enabled;
   - whether `themeSetPackOptions` still exists and still accepts `before`. If a public way to add CSS has
     appeared, move `withSlideDefaults()` to it.
3. **Check that the theme styles haven't changed:** the `--marp-shiki-*` variables and the Mermaid
   `max-height` rules in the built-in themes.
4. **Test in Celbridge** on both macOS (WebKit) and Windows (WebView2/Chromium). Chromium supports customised
   built-in elements, so fitting there doesn't depend on `update()`. Test:
   - play and preview of the Observer story (code highlighting in light and dark, wide code blocks);
   - a node with `# <!-- fit --> A long heading`;
   - a Mermaid `graph LR` and a tall `graph TD`, with and without a `<style scoped>` override;
   - a KaTeX expression such as `$e^{i\pi}+1=0$`;
   - PDF export of all of the above.
5. **Consider vendoring** instead of loading from esm.sh, the way the QR editor vendors its encoder. This would
   make play and PDF export work offline, and would need the Shiki grammars and KaTeX fonts to be bundled too.
   Run the `update-third-party-licenses` skill after vendoring. Licences as checked on 30 September 2026:
   - MIT: Marp Core, Shiki, KaTeX and beautiful-mermaid 1.1.3 (© 2026 Craft Docs).
   - BSD-2-Clause: `entities` 7.0.1, a beautiful-mermaid dependency.
   - **EPL-2.0: `elkjs` 0.11.1**, the graph layout engine beautiful-mermaid depends on. Later elkjs releases
     are `EPL-2.0 OR GPL-3.0-or-later`. EPL-2.0 is weak copyleft, not MIT. Shipping the unmodified bundle
     inside an MIT app is generally fine, but it needs the EPL notice and a pointer to the elkjs source, and
     any changes to elkjs itself would have to be released under the EPL. Celbridge's
     `THIRD-PARTY-LICENSES.txt` has no EPL entry yet. If that's unwanted, leave the Mermaid plugin on the CDN
     (nothing is redistributed then) or drop it.
6. **Consider** whether fitting in PDF export is worth pursuing (for example rasterising from the inline-SVG
   render in Chromium, where the canvas isn't tainted), or whether natural-size text in PDFs is acceptable.
