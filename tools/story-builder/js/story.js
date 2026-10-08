import celbridge from '/assets/celbridge-client/celbridge.js';
import { ContentLoadedReason } from '/assets/celbridge-client/api/document-api.js';
import { t } from '/assets/celbridge-client/localization.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRID = 20;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;
const CLICK_DRAG_THRESHOLD = 4; // px of pointer travel that turns a click into a drag
const SAVE_DEBOUNCE_MS = 1200;
// The name a new story's first node is given. Links name nodes, so this is part of the story format and is
// not localized. Play itself starts from the first node in the default sequence.
const START_NODE = 'Start';
// The story's optional previous / next buttons in play mode. The first of each list is the default.
const NAV_STYLES = ['arrows', 'arrows-name'];
const NAV_POSITIONS = ['top-right', 'bottom-right', 'top-left', 'bottom-left'];
// The optional arrows drawn on the canvas from each node to the next in the default sequence.
const SEQUENCE_LINE_STYLES = ['dashed', 'solid'];
const SEQUENCE_DEFAULT_COLOR = '#ffcc00';
const SEQUENCE_DEFAULT_ALPHA = 0.75;
// How far a sequence arrow sits to one side of the centre line, so a link between the same two nodes
// still shows beside it.
const SEQUENCE_ARROW_OFFSET = 5;
// Spacing used to spread out nodes that arrive without a position.
const FALLBACK_SPACING_X = 240;
// How far a new node steps when the spot it would take is already occupied, and how close counts as taken.
const CASCADE_STEP = 40;
const OCCUPIED_X = 80;
const OCCUPIED_Y = 40;
// The panel is a share of the document rather than a fixed width, so it keeps its proportions as the
// document is resized. Matches --inspector-min/default/max in the stylesheet.
const INSPECTOR_MIN_FRACTION = 0.2;
const INSPECTOR_DEFAULT_FRACTION = 0.3;
// The panel may take most of the document, in either view, so a node's text and preview can have the room.
const INSPECTOR_MAX_FRACTION = 0.9;
// Below this the document cannot spare a column for the panel and stacks it under the canvas. The host holds
// the width an editor makes that call at; the fallback is its value, for a page opened outside the host.
const STACK_THRESHOLD = parseFloat(getComputedStyle(document.documentElement)
    .getPropertyValue('--cel-rail-stack-threshold')) || 400;
// How long the view takes to travel when centring on a node.
const CENTRE_TWEEN_MS = 300;
// A passage is a Marp slide, so play mode renders it with marp-core. Prototype arrangement: the bundle is
// imported from a CDN on first play rather than vendored, so the editor still opens, edits and saves with
// no network — only playing needs it. The version is pinned: v5 is a release candidate, and an unpinned URL
// would move with npm's `latest` tag. Since v5 the core is lightweight, and syntax highlighting (Shiki), Mermaid
// diagrams and KaTeX maths are plugins of their own, loaded beside it.
const MARP_URL = 'https://esm.sh/@marp-team/marp-core@5.0.2';
// The editor's own nomnoml plugin draws ```nomnoml blocks as UML diagrams. It comes last, so a diagram that fails
// to parse falls back to Shiki's code block.
const MARP_PLUGIN_URLS = [
    ...['shiki', 'mermaid', 'katex'].map((name) => `${MARP_URL}/plugins/${name}`),
    new URL('./nomnoml-plugin.js', import.meta.url).href,
];
// Marp's browser helper does auto-scaling (the `<!-- fit -->` directive, and code blocks shrunk to fit) and
// carries the WebKit SVG polyfill. WebKit lays out a slide's contents at the SVG's scale but paints some of
// them (images, positioned elements) unscaled, so without the polyfill a slide narrower than 1280px shows a
// cropped corner.
const MARP_BROWSER_URL = `${MARP_URL}/browser`;
// A diagram is drawn at its natural size, which is often a small corner of the slide, so it is stretched across
// the slide's width by default, keeping its proportions. The theme caps a Mermaid diagram's height; no theme knows
// nomnoml, so its cap is set here, at the default theme's Mermaid value.
const SLIDE_DEFAULT_CSS = 'svg[data-marp-mermaid] { width: 100%; }\n'
    + 'svg[data-nomnoml] { display: block; width: 100%; height: auto; max-height: 563px; }\n';
// beautiful-mermaid (behind Marp's Mermaid plugin) anchors the aggregation and composition diamonds at the wrong
// end (refX="0" with orient="auto-start-reverse"), so each diamond is drawn inside the owning class's box and the
// box covers it. Anchoring them at their far point (refX="12", the marker's width) puts them just outside the box,
// as the inheritance triangle already is. Remove once the renderer is fixed.
const HIDDEN_DIAMOND_MARKER = /<marker\b[^>]*\bid="cls-(?:aggregation|composition)"[^>]*>/g;
// PDF export rasterises each slide and pages the images, with libraries fetched on first export the same way.
// WebKit won't let a canvas that has drawn Marp's SVG slide be read back, so the slide is rendered as plain
// HTML and html2canvas paints it.
const HTML2CANVAS_URL = 'https://esm.sh/html2canvas@1';
const JSPDF_URL = 'https://esm.sh/jspdf@2';
// Pixels rendered per slide pixel: sharp enough to read when zoomed, small enough to keep the file light.
const PDF_RENDER_SCALE = 1.5;
const PDF_JPEG_QUALITY = 0.9;
// A slide is laid out in CSS pixels; a PDF page is measured in points.
const PX_TO_PT = 0.75;
// How long the node preview waits after the last keystroke before rendering again.
const PREVIEW_DEBOUNCE_MS = 250;
// In split mode the node's text and its preview share the field. The divider sets the text's share, within
// bounds that keep both usable.
const TEXT_SHARE_DEFAULT = 0.5;
const TEXT_SHARE_MIN = 0.15;
const TEXT_SHARE_MAX = 0.85;
// Beside the story's or node's text, the custom data takes this share of the panel; a divider moves it.
const DATA_SHARE_DEFAULT = 0.42;
const DATA_SHARE_MIN = 0.2;
const DATA_SHARE_MAX = 0.8;
// Clearance a node keeps from the edge of the canvas, both for the pan clamp and for deciding whether the
// selected node is still comfortably in view.
const VIEW_MARGIN = 80;
// The fields of the file the editor reads and writes itself. Anything else, on the story or on a node, is kept
// as it was and written back after them.
const STORY_FIELDS = ['name', 'description', 'schemas', 'data', 'navigation', 'sequenceArrows', 'nodes'];
const NODE_FIELDS = ['name', 'x', 'y', 'text', 'data'];
// The kinds of custom data field a schema can declare, and the names schema files go by.
const FIELD_TYPES = ['text', 'multiline', 'number', 'boolean', 'choice', 'node', 'list'];
const SCHEMA_SUFFIX = '.schema.json';

// ---------------------------------------------------------------------------
// State
//
// The .story file is the whole document: a JSON object holding the nodes, each
// with its name, canvas position and Markdown text. A node is identified by its
// name — the same name links point at — so a rename is a field change plus the
// link rewrite, with no ids to keep in step. The order of the nodes is the
// story's default sequence, so reordering it is a reorder of the array.
// ---------------------------------------------------------------------------

let resourceKey = '';   // full key e.g. project:foo.story
let storyName = '';
let storyDescription = '';
let nodes = [];         // [{ name, x, y, text }], in default sequence order
let navigation = defaultNavigation(); // { show, style, position, showNumber }
let sequenceArrows = defaultSequenceArrows(); // { show, style, color, alpha }
// Custom data: the schema files the story uses, and the story's own data keyed by each schema's namespace. A
// node carries its data the same way, on node.data, and its unknown fields on node.extras.
let schemaKeys = [];
let storyData = {};
let storyExtras = {};   // the story's fields the editor doesn't know, written back as they were
let schemas = null;     // Map of schema key -> { schema } or { error }, once read; null until then
let selectedName = null;
let viewMode = 'graph'; // 'graph' or 'sequence': the two views share the area left of the panel
// How the node's text is shown: 'source', 'preview', or both, 'split-columns' (side by side) or 'split-rows' (the
// text above the preview).
let textMode = 'source';
let previewTimer = null;
let textShare = TEXT_SHARE_DEFAULT; // the text's share of the field in split mode; the preview has the rest
let dataShare = DATA_SHARE_DEFAULT; // the custom data's share of the panel, beside the text; one for story and node
// The canvas measures nothing while the list is showing, so its last real size is kept for placing new nodes.
let canvasSize = { width: 0, height: 0 };
let playingName = null; // the node on screen while playing
let inspectorFraction = INSPECTOR_DEFAULT_FRACTION;
// Each view keeps its own split, so widening the panel beside the list doesn't squeeze the graph afterwards.
const viewFractions = { graph: INSPECTOR_DEFAULT_FRACTION, sequence: INSPECTOR_DEFAULT_FRACTION };
let zoom = 1;
let panX = 0;
let panY = 0;
let isDraggingNode = false;
let dragName = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panDownX = 0;
let panDownY = 0;
let panMoved = false;
let isPlaying = false;
let saveTimer = null;
let panTween = null;    // requestAnimationFrame handle while the view is travelling to a node
let marp = null;        // the Marp renderer, once the bundle has loaded
let createMarp = null;  // builds a Marp renderer with the plugins, for the plain-HTML one PDF export uses
let marpBrowser = null; // Marp's browser helper running on the page, once its module has loaded
let isExportingPdf = false;
let isSettingsOpen = false; // the panel is showing the story's settings in place of the story or node
let notice = null;      // { key, args }, so the notice on screen follows a language change

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const canvasEl = document.getElementById('canvas');
const connCanvas = document.getElementById('connection-canvas');
const ctx2d = connCanvas.getContext('2d');
const inspectorEl = document.getElementById('inspector');
const splitterEl = document.getElementById('splitter');
const inspectorNameEl = document.getElementById('inspector-name');
const inspectorTextEl = document.getElementById('inspector-text');
const storyNameEl = document.getElementById('story-name');
const storyDescriptionEl = document.getElementById('story-description');
const storyNavShowEl = document.getElementById('story-nav-show');
const storyNavOptionsEl = document.getElementById('story-nav-options');
const navStyleRadios = [...document.querySelectorAll('input[name="nav-style"]')];
const navPositionRadios = [...document.querySelectorAll('input[name="nav-position"]')];
const storyNavNumberEl = document.getElementById('story-nav-number');
const storySeqShowEl = document.getElementById('story-seq-show');
const storySeqOptionsEl = document.getElementById('story-seq-options');
const seqStyleRadios = [...document.querySelectorAll('input[name="seq-style"]')];
const storySeqColorEl = document.getElementById('story-seq-color');
const storySeqAlphaEl = document.getElementById('story-seq-alpha');
const storySeqAlphaValueEl = document.getElementById('story-seq-alpha-value');
// The header and section belonging to each panel, shown as a pair.
const panelElements = [...document.querySelectorAll('[data-panel]')];
const editorViewEl = document.getElementById('editor-view');
const playViewEl = document.getElementById('play-view');
const playTextEl = document.getElementById('play-text');
const playNavEl = document.getElementById('play-nav');
const btnSequence = document.getElementById('btn-sequence');
const btnGraph = document.getElementById('btn-graph');
const viewButtons = [btnSequence, btnGraph];
const textEditorEl = document.getElementById('text-editor');
const inspectorPreviewEl = document.getElementById('inspector-preview');
const inspectorSlideEl = document.getElementById('inspector-slide');
const previewNavEl = document.getElementById('preview-nav');
const textSplitterEl = document.getElementById('text-splitter');
const dataSplitterEls = [...document.querySelectorAll('.data-splitter')];
const textModeButtons = [...document.querySelectorAll('.text-mode-button')];
const nodeNameSlotEl = document.getElementById('node-name-slot');
const sequencePanelEl = document.getElementById('sequence-panel');
const sequenceListEl = document.getElementById('sequence-list');
const btnPlay = document.getElementById('btn-play');
const btnAdd = document.getElementById('btn-add-node');
const btnDelete = document.getElementById('btn-delete-node');
const btnExport = document.getElementById('btn-export');
const btnPdf = document.getElementById('btn-pdf');
const btnSettings = document.getElementById('btn-settings');
const settingsCloseEl = document.getElementById('settings-close');
const canvasContainer = document.getElementById('canvas-container');
const noticeEl = document.getElementById('notice');
const noticeTextEl = document.getElementById('notice-text');
const noticeDismissEl = document.getElementById('notice-dismiss');
const slideStyleEl = document.getElementById('slide-style');
const storyDataEl = document.getElementById('story-data');
const nodeDataEl = document.getElementById('node-data');
const schemaListEl = document.getElementById('schema-list');
const schemaAddEl = document.getElementById('schema-add');

// One canvas element per node, keyed by name. A renamed node is torn down and
// rebuilt, so the key always matches the node the element is showing.
const nodeElements = new Map();

// ---------------------------------------------------------------------------
// Persistence
//
// The document content is the graph, so a save is a single write of the .story
// file and there is nothing derived to keep in step with it.
// ---------------------------------------------------------------------------

function scheduleSave() {
    // Mark the document dirty as soon as the in-memory graph diverges from the
    // last save. Without this the host believes the document is clean and never
    // fires onRequestSave on close, so pending debounced edits are lost.
    celbridge.document.notifyChanged();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, SAVE_DEBOUNCE_MS);
}

async function save() {
    saveTimer = null;
    try {
        await celbridge.document.save(serialize());
    } catch (e) {
        console.error('[Story] Save failed:', e);
    }
}

// Flush any pending debounce immediately, e.g. when the host requests a save on
// panel or file close. Returning the promise lets callers await completion.
function flushPendingSave() {
    if (saveTimer === null) {
        return Promise.resolve();
    }
    clearTimeout(saveTimer);
    return save();
}

// Pretty-printed so the file diffs a line at a time in version control. Empty custom data is left out, so a
// story that uses none is written exactly as before; unknown fields follow the known ones.
function serialize() {
    const payload = {
        name: storyName.trim(),
        description: storyDescription.trim(),
    };
    if (schemaKeys.length > 0) payload.schemas = [...schemaKeys];
    if (Object.keys(storyData).length > 0) payload.data = storyData;
    payload.navigation = { ...navigation };
    payload.sequenceArrows = { ...sequenceArrows };
    payload.nodes = nodes.map(({ name, x, y, text, data, extras }) => {
        const node = { name, x, y, text };
        if (data && Object.keys(data).length > 0) node.data = data;
        return appendUnknown(node, extras);
    });

    return JSON.stringify(appendUnknown(payload, storyExtras), null, 2) + '\n';
}

function defaultStartNode() {
    return { name: START_NODE, x: 0, y: 0, text: t('Story_Default_StartText'), data: {}, extras: {} };
}

function defaultNavigation() {
    return { show: false, style: NAV_STYLES[0], position: NAV_POSITIONS[0], showNumber: false };
}

function defaultSequenceArrows() {
    return { show: false, style: SEQUENCE_LINE_STYLES[0], color: SEQUENCE_DEFAULT_COLOR, alpha: SEQUENCE_DEFAULT_ALPHA };
}

// Each setting that is missing or out of range takes its default. The colour is kept in the #rrggbb form
// the colour picker reads and writes.
function parseSequenceArrows(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const defaults = defaultSequenceArrows();
    return {
        show: source.show === true,
        style: SEQUENCE_LINE_STYLES.includes(source.style) ? source.style : defaults.style,
        color: typeof source.color === 'string' && /^#[0-9a-f]{6}$/i.test(source.color)
            ? source.color.toLowerCase() : defaults.color,
        alpha: Number.isFinite(source.alpha) ? Math.min(1, Math.max(0, source.alpha)) : defaults.alpha,
    };
}

// Each setting that is missing or not one of the known values takes its default.
function parseNavigation(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const defaults = defaultNavigation();
    return {
        show: source.show === true,
        style: NAV_STYLES.includes(source.style) ? source.style : defaults.style,
        position: NAV_POSITIONS.includes(source.position) ? source.position : defaults.position,
        // The slide number goes with the buttons unless the story says otherwise.
        showNumber: typeof source.showNumber === 'boolean' ? source.showNumber : source.show === true,
    };
}

// Reads the document content into a node list. Parsing is forgiving so a hand-edited file still opens: each
// node keeps the fields it has and defaults the rest. Content that cannot be read at all yields a new story
// plus the parser's reason, which the editor warns about before an edit replaces the file.
function parse(content) {
    const newStory = () => ({
        name: '', description: '', navigation: defaultNavigation(), sequenceArrows: defaultSequenceArrows(),
        schemas: [], data: {}, extras: {}, nodes: [defaultStartNode()],
    });

    if (!content || content.trim() === '') {
        return { ...newStory(), error: null };
    }

    let raw;
    try {
        raw = JSON.parse(content);
    } catch (e) {
        return { ...newStory(), error: e.message };
    }

    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.nodes)) {
        return { ...newStory(), error: 'Expected a JSON object with a "nodes" array.' };
    }

    const parsed = [];
    raw.nodes.forEach((entry, index) => {
        if (!entry || typeof entry !== 'object') {
            return;
        }

        const name = typeof entry.name === 'string' ? entry.name.trim() : '';
        const hasData = isPlainObject(entry.data);
        parsed.push({
            name: uniqueName(name || t('Story_NewNode_Name'), parsed),
            // A node with no position is placed in a row rather than stacked at the origin.
            x: snapToGrid(Number.isFinite(entry.x) ? entry.x : index * FALLBACK_SPACING_X),
            y: snapToGrid(Number.isFinite(entry.y) ? entry.y : 0),
            text: typeof entry.text === 'string' ? entry.text : '',
            data: hasData ? entry.data : {},
            // A "data" that isn't an object can't be edited, so it is kept with the unknown fields instead.
            extras: unknownFields(entry, hasData ? NODE_FIELDS : NODE_FIELDS.filter(f => f !== 'data')),
        });
    });

    if (parsed.length === 0) {
        parsed.push(defaultStartNode());
    }

    // As for a node's data, a "schemas" or "data" the editor can't use is kept as an unknown field.
    const hasSchemas = Array.isArray(raw.schemas) && raw.schemas.every(key => typeof key === 'string');
    const hasData = isPlainObject(raw.data);
    const known = STORY_FIELDS.filter(f => (f !== 'schemas' || hasSchemas) && (f !== 'data' || hasData));

    return {
        name: typeof raw.name === 'string' ? raw.name : '',
        description: typeof raw.description === 'string' ? raw.description : '',
        navigation: parseNavigation(raw.navigation),
        sequenceArrows: parseSequenceArrows(raw.sequenceArrows),
        schemas: hasSchemas ? [...new Set(raw.schemas)] : [],
        data: hasData ? raw.data : {},
        extras: unknownFields(raw, known),
        nodes: parsed,
        error: null,
    };
}

function load(content) {
    const result = parse(content);
    storyName = result.name;
    storyDescription = result.description;
    navigation = result.navigation;
    sequenceArrows = result.sequenceArrows;
    nodes = result.nodes;
    storyData = result.data;
    storyExtras = result.extras;
    // The schemas already read still apply while the same files are listed; they are read again below anyway,
    // since this load may be because one of them changed.
    if (result.schemas.join('\n') !== schemaKeys.join('\n')) {
        schemas = null;
    }
    schemaKeys = result.schemas;

    updateStoryBadge();
    storyDescriptionEl.value = storyDescription;
    applyNavigationControls();
    applySequenceArrowControls();
    renderSchemaSettings();
    selectNode(null);
    loadSchemas();

    if (result.error !== null) {
        showNotice('Story_Error_ParseFailed', result.error);
    } else if (notice?.key === 'Story_Error_ParseFailed') {
        // A file that has since been fixed no longer needs the warning.
        hideNotice();
    }
}

// The file changed on disk while it was open: another tool, an agent, or source control wrote it. The disk
// wins, as it does in the host's own editors, so a pending save of the old content is dropped rather than
// written over the new. The author's place is kept where it still applies: the selection, the view and its
// pan and zoom, the text mode, and the node being played.
let reloadQueue = Promise.resolve();

function reloadFromDisk() {
    // Changes arriving in quick succession are read one after another, so the last one read is the last written.
    reloadQueue = reloadQueue.then(async () => {
        console.info('[Story] The file changed on disk; reloading it.');
        let content;
        try {
            content = (await celbridge.document.load())?.content ?? '';
        } catch (e) {
            console.error('[Story] Failed to reload the changed file:', e);
            return;
        }

        clearTimeout(saveTimer);
        saveTimer = null;
        // A name being typed belongs to the content being replaced, so it is abandoned with it.
        nodeNameEdit.finish({ commit: false });
        storyNameEdit.finish({ commit: false });
        finishListRename({ commit: false });

        // Nothing to do when the disk already holds what the editor shows.
        if (content !== serialize()) {
            const previousSelection = selectedName;
            load(content);
            if (getNode(previousSelection)) {
                selectNode(previousSelection);
            }

            if (isPlaying) {
                if (getNode(playingName)) {
                    navigateTo(playingName);
                } else {
                    stopPlay();
                }
            }
        }

        celbridge.document.notifyContentLoaded(ContentLoadedReason.ExternalReload);
    });
}

// ---------------------------------------------------------------------------
// Node helpers
// ---------------------------------------------------------------------------

function getNode(name) {
    return nodes.find(n => n.name === name);
}

function getOutgoingLinks(node) {
    const targets = [];
    const re = /\[([^\]]+)\]\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(node?.text ?? '')) !== null) {
        targets.push(m[2]);
    }
    return targets; // array of node names
}

function snapToGrid(v) {
    return Math.round(v / GRID) * GRID;
}

// Nodes are added at the centre of the view, which is often where a node already sits. A taken spot cascades
// down and right until a free one is found, so the new node lands clear of the others.
function freePosition(x, y) {
    const taken = (px, py) => nodes.some(n =>
        Math.abs(n.x - px) < OCCUPIED_X && Math.abs(n.y - py) < OCCUPIED_Y);

    // Bounded so a dense canvas can't spin here; the last step is used as-is.
    for (let step = 0; step < 100 && taken(x, y); step++) {
        x += CASCADE_STEP;
        y += CASCADE_STEP;
    }

    return { x, y };
}

function uniqueName(base, among = nodes) {
    let name = base;
    let i = 2;
    while (among.some(n => n.name === name)) {
        name = `${base} ${i++}`;
    }
    return name;
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

function worldToScreen(wx, wy) {
    return { x: wx * zoom + panX, y: wy * zoom + panY };
}

function screenToWorld(sx, sy) {
    return { x: (sx - panX) / zoom, y: (sy - panY) / zoom };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderNodes() {
    const outgoingNames = selectedName ? getOutgoingLinks(getNode(selectedName)) : [];

    // Remove elements whose node has been deleted or renamed
    for (const [name, el] of nodeElements) {
        if (!getNode(name)) {
            el.remove();
            nodeElements.delete(name);
        }
    }

    for (const node of nodes) {
        let el = nodeElements.get(node.name);
        if (!el) {
            el = document.createElement('div');
            el.className = 'story-node';
            el.dataset.name = node.name;
            el.textContent = node.name;
            el.dataset.startLabel = t('Story_Node_StartBadge');
            attachNodeEvents(el);
            canvasEl.appendChild(el);
            nodeElements.set(node.name, el);
        }

        const { x, y } = worldToScreen(node.x, node.y);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.fontSize = `${13 * zoom}px`;
        el.style.padding = `${10 * zoom}px ${16 * zoom}px`;

        el.classList.toggle('selected', node.name === selectedName);
        el.classList.toggle('connected-out',
            outgoingNames.includes(node.name) && node.name !== selectedName);
        // The first node in the default sequence is where the story starts.
        el.classList.toggle('sequence-start', node === nodes[0]);
    }
}

function renderConnections() {
    const rect = canvasContainer.getBoundingClientRect();
    connCanvas.width = rect.width;
    connCanvas.height = rect.height;
    if (rect.width > 0 && rect.height > 0) {
        canvasSize = { width: rect.width, height: rect.height };
    }

    // A canvas cannot inherit a colour, so the connection tone is read from the stylesheet and repainted
    // when the host switches theme.
    const color = getComputedStyle(document.documentElement)
        .getPropertyValue('--story-connection-color').trim() || '#888';

    ctx2d.clearRect(0, 0, connCanvas.width, connCanvas.height);
    ctx2d.strokeStyle = color;
    ctx2d.lineWidth = 1.5;
    ctx2d.fillStyle = color;

    for (const node of nodes) {
        for (const targetName of getOutgoingLinks(node)) {
            const target = getNode(targetName);
            if (!target) continue;

            const from = worldToScreen(node.x, node.y);
            const to = worldToScreen(target.x, target.y);

            ctx2d.beginPath();
            ctx2d.moveTo(from.x, from.y);
            ctx2d.lineTo(to.x, to.y);
            ctx2d.stroke();

            // Arrow at midpoint
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            const angle = Math.atan2(to.y - from.y, to.x - from.x);
            const as = 7;
            ctx2d.beginPath();
            ctx2d.moveTo(mx + Math.cos(angle) * as, my + Math.sin(angle) * as);
            ctx2d.lineTo(mx + Math.cos(angle + 2.4) * as, my + Math.sin(angle + 2.4) * as);
            ctx2d.lineTo(mx + Math.cos(angle - 2.4) * as, my + Math.sin(angle - 2.4) * as);
            ctx2d.closePath();
            ctx2d.fill();
        }
    }

    drawSequenceArrows();
}

// The default sequence, when the story asks for it: an arrow from each node to the next, in the story's own
// colour and line style.
function drawSequenceArrows() {
    if (!sequenceArrows.show) return;

    ctx2d.save();
    ctx2d.strokeStyle = sequenceArrows.color;
    ctx2d.fillStyle = sequenceArrows.color;
    ctx2d.globalAlpha = sequenceArrows.alpha;
    ctx2d.lineWidth = 2;

    for (let i = 0; i + 1 < nodes.length; i++) {
        const from = worldToScreen(nodes[i].x, nodes[i].y);
        const to = worldToScreen(nodes[i + 1].x, nodes[i + 1].y);
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const ox = -Math.sin(angle) * SEQUENCE_ARROW_OFFSET;
        const oy = Math.cos(angle) * SEQUENCE_ARROW_OFFSET;

        ctx2d.setLineDash(sequenceArrows.style === 'dashed' ? [8, 6] : []);
        ctx2d.beginPath();
        ctx2d.moveTo(from.x + ox, from.y + oy);
        ctx2d.lineTo(to.x + ox, to.y + oy);
        ctx2d.stroke();

        // Arrow at midpoint, a little larger than a link's so the two read apart.
        const mx = (from.x + to.x) / 2 + ox;
        const my = (from.y + to.y) / 2 + oy;
        const as = 9;
        ctx2d.setLineDash([]);
        ctx2d.beginPath();
        ctx2d.moveTo(mx + Math.cos(angle) * as, my + Math.sin(angle) * as);
        ctx2d.lineTo(mx + Math.cos(angle + 2.4) * as, my + Math.sin(angle + 2.4) * as);
        ctx2d.lineTo(mx + Math.cos(angle - 2.4) * as, my + Math.sin(angle - 2.4) * as);
        ctx2d.closePath();
        ctx2d.fill();
    }

    ctx2d.restore();
}

function render() {
    renderNodes();
    renderConnections();
}

function cancelPanTween() {
    if (panTween !== null) {
        cancelAnimationFrame(panTween);
        panTween = null;
    }
}

// Eases the view to a pan position. Any gesture that moves the view cancels the travel, so the user never
// has to fight it.
function panTo(x, y, { animate = true } = {}) {
    cancelPanTween();

    const startX = panX;
    const startY = panY;

    // What the clamp allows is the real destination, so it is resolved by moving there and reading back.
    panX = x;
    panY = y;
    clampPan();

    const targetX = panX;
    const targetY = panY;

    if (!animate || (targetX === startX && targetY === startY)) {
        render();
        return;
    }

    const startTime = performance.now();
    const step = (now) => {
        const progress = Math.min(1, (now - startTime) / CENTRE_TWEEN_MS);
        // Ease out: away quickly, settling gently on the node.
        const eased = 1 - Math.pow(1 - progress, 3);

        panX = startX + (targetX - startX) * eased;
        panY = startY + (targetY - startY) * eased;
        render();

        panTween = progress < 1 ? requestAnimationFrame(step) : null;
    };

    panTween = requestAnimationFrame(step);
}

// Puts a node in the middle of the canvas, so a graph wider than the view can be walked node by node.
function centreOn(node, options) {
    const rect = canvasContainer.getBoundingClientRect();

    panTo(rect.width / 2 - node.x * zoom, rect.height / 2 - node.y * zoom, options);
}

// Keeps a value within a range, falling back to the middle of a range too small to hold it.
function clampToRange(value, min, max) {
    if (max < min) {
        return (min + max) / 2;
    }

    return Math.min(Math.max(value, min), max);
}

// Called after the canvas changes shape: the panel was resized, or moved from beside the canvas to below it.
// A selected node that is still in view is left where it is, since the user may have panned away from it
// deliberately; one the new shape has pushed out (or up against an edge) is brought back by the smallest
// travel that clears the margin, rather than by recentring the view on it.
function ensureSelectedVisible() {
    const node = getNode(selectedName);
    if (!node) {
        return;
    }

    const rect = canvasContainer.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
        return;
    }

    const box = nodeElements.get(node.name)?.getBoundingClientRect();
    const halfWidth = (box?.width ?? 0) / 2;
    const halfHeight = (box?.height ?? 0) / 2;

    const { x, y } = worldToScreen(node.x, node.y);
    const wantedX = clampToRange(x, VIEW_MARGIN + halfWidth, rect.width - VIEW_MARGIN - halfWidth);
    const wantedY = clampToRange(y, VIEW_MARGIN + halfHeight, rect.height - VIEW_MARGIN - halfHeight);

    if (wantedX === x && wantedY === y) {
        return;
    }

    panTo(panX + (wantedX - x), panY + (wantedY - y));
}

// ---------------------------------------------------------------------------
// Notice
//
// Problems the author needs to act on are shown in a banner over the canvas
// rather than a modal alert, so they can keep working while they fix them.
// ---------------------------------------------------------------------------

function showNotice(key, ...args) {
    notice = { key, args };
    noticeTextEl.textContent = t(key, ...args);
    noticeEl.classList.remove('hidden');
}

function hideNotice() {
    notice = null;
    noticeEl.classList.add('hidden');
}

noticeDismissEl.addEventListener('click', hideNotice);

// ---------------------------------------------------------------------------
// Selection & Inspector
// ---------------------------------------------------------------------------

// The panel is always on screen: it shows the story's settings while they are open, otherwise the selected
// node, or the story itself when nothing is selected.
function showPanel() {
    const panel = isSettingsOpen ? 'settings' : selectedName ? 'node' : 'story';
    for (const el of panelElements) {
        el.classList.toggle('hidden', el.dataset.panel !== panel);
    }
}

// The settings take the panel over from the story or node, and hand it back when they close.
function setSettingsOpen(open) {
    if (open) {
        // A name being edited belongs to the panel the settings replace, so it is applied first.
        nodeNameEdit.finish();
        finishListRename();
        storyNameEdit.finish();
    }
    isSettingsOpen = open;
    btnSettings.classList.toggle('selected', open);
    btnSettings.setAttribute('aria-pressed', String(open));
    showPanel();
    // The project's schema files may have changed since the settings were last open.
    if (open) {
        refreshSchemaChoices();
    }
}

btnSettings.addEventListener('click', () => setSettingsOpen(!isSettingsOpen));
settingsCloseEl.addEventListener('click', () => setSettingsOpen(false));

function selectNode(name) {
    // An edit to the name in progress belongs to the node it started on, so it is applied before moving on.
    // A rename changes the selected node's key, so the name asked for is carried across with it.
    if (nodeNameEdit.active || listRename) {
        const wasSelected = name === selectedName;
        nodeNameEdit.finish();
        finishListRename();
        if (wasSelected) name = selectedName;
    }
    // The story's name is edited in the story panel, which a selection replaces.
    storyNameEdit.finish();

    const node = name ? getNode(name) : null;
    const changed = (node ? name : null) !== selectedName;
    selectedName = node ? name : null;
    updateToolbarState();

    if (node) {
        inspectorNameEl.value = node.name;
        inspectorTextEl.value = node.text;
    }

    // Choosing a node, or the story by clicking away from one, is a move back to editing, so it closes the
    // settings.
    setSettingsOpen(false);
    updateNodeBadge();
    renderDataPanels();
    render();
    renderSequence();

    // Clicking the node already selected (e.g. to drag it) leaves its preview alone.
    if (node && changed) {
        renderPreview();
    }
}

// ---------------------------------------------------------------------------
// Node text: source, split and preview
//
// The same three views of the text the Markdown editor offers. The preview is
// the node rendered as the slide play mode shows, so the author sees the result
// without leaving the editor.
// ---------------------------------------------------------------------------

// The selected node's name, in the header box drawn the way the node looks on the canvas, START label and all.
// A name being typed is left alone.
function updateNodeBadge() {
    const node = getNode(selectedName);
    if (!nodeNameEdit.active) {
        inspectorNameEl.value = node ? node.name : '';
        fitNameBox(inspectorNameEl);
    }
    inspectorNameEl.title = t('Story_Inspector_Rename');
    nodeNameSlotEl.dataset.startLabel = t('Story_Node_StartBadge');
    nodeNameSlotEl.classList.toggle('sequence-start', !!node && node === nodes[0]);
    // The preview's previous / next depend on the same things: the node, its place, and its neighbours' names.
    updatePreviewNav();
}

const SPLIT_DIRECTIONS = { 'split-columns': 'columns', 'split-rows': 'rows' };

function setTextMode(mode) {
    textMode = mode;
    // Both splits share the split layout; which way the field divides is a separate attribute.
    const split = SPLIT_DIRECTIONS[mode];
    textEditorEl.dataset.mode = split ? 'split' : mode;
    if (split) {
        textEditorEl.dataset.split = split;
    } else {
        delete textEditorEl.dataset.split;
    }
    applyTextShare();
    // Preview gives the whole panel to the slide, so the fields above the text step aside for it too.
    inspectorEl.dataset.textMode = mode;
    for (const button of textModeButtons) {
        const on = button.dataset.mode === mode;
        button.classList.toggle('selected', on);
        button.setAttribute('aria-pressed', String(on));
    }
    renderPreview();
}

for (const button of textModeButtons) {
    button.addEventListener('click', () => setTextMode(button.dataset.mode));
}

function showPreviewMessage(text) {
    const message = document.createElement('p');
    message.textContent = text;
    inspectorSlideEl.replaceChildren(message);
}

async function renderPreview() {
    clearTimeout(previewTimer);
    previewTimer = null;
    if (textMode === 'source' || !getNode(selectedName)) return;

    if (!await loadMarp()) {
        showPreviewMessage(t('Story_Error_RendererFailed'));
        return;
    }

    // The renderer may have taken a while to arrive; show whatever is selected now.
    const node = getNode(selectedName);
    if (textMode === 'source' || !node) return;

    try {
        showSlide(node, inspectorSlideEl);
    } catch (e) {
        console.error('[Story] Failed to render the preview:', e);
        showPreviewMessage(t('Story_Preview_RenderFailed'));
    }
}

function schedulePreview() {
    if (textMode === 'source') return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, PREVIEW_DEBOUNCE_MS);
}

// A link in the preview selects the node it points at, rather than navigating the WebView away.
inspectorPreviewEl.addEventListener('click', (e) => {
    const link = e.target.closest?.('a');
    if (!link) return;

    e.preventDefault();
    const name = linkTarget(link);
    if (getNode(name)) {
        selectNode(name);
    }
});

// ---------------------------------------------------------------------------
// Default sequence
//
// A view in place of the graph listing the nodes in order. Each row has a drag
// handle; dropping a row reorders the nodes array, which is the sequence.
// Clicking a row selects its node; double-clicking it, or clicking the row
// already selected, edits the node's name in the row.
// ---------------------------------------------------------------------------

function createSequenceItem() {
    const item = document.createElement('li');
    item.className = 'sequence-item';

    const handle = document.createElement('span');
    handle.className = 'sequence-handle';
    handle.innerHTML = '<i class="bi bi-grip-vertical"></i>';

    const number = document.createElement('span');
    number.className = 'sequence-number';

    const label = document.createElement('span');
    label.className = 'sequence-name';

    item.append(handle, number, label);
    return item;
}

// Rows are kept and brought up to date rather than rebuilt, so a row stays the same element across a rename
// or a change of selection: a click that ends an edit in one row still lands on the row it was aimed at.
function renderSequence() {
    if (viewMode !== 'sequence') return;

    const existing = new Map([...sequenceListEl.children].map(item => [item.dataset.name, item]));
    const items = nodes.map((node, index) => {
        const item = existing.get(node.name) ?? createSequenceItem();
        item.dataset.name = node.name;
        item.classList.toggle('selected', node.name === selectedName);

        const handle = item.querySelector('.sequence-handle');
        handle.title = t('Story_Sequence_DragHandle');
        handle.setAttribute('aria-label', handle.title);
        item.querySelector('.sequence-number').textContent = String(index + 1);
        // A row whose name is being typed keeps its box; its label is brought up to date when the edit ends.
        const label = item.querySelector('.sequence-name');
        if (label) label.textContent = node.name;
        return item;
    });

    // Only a change of rows or of their order needs the list rearranged.
    const current = [...sequenceListEl.children];
    if (current.length !== items.length || items.some((item, index) => item !== current[index])) {
        sequenceListEl.replaceChildren(...items);
    }
}

// Renaming in the list. The row's name becomes a text box with its text selected, ready to be typed over.
// Enter or leaving the box applies the name; Escape keeps the old one.
let listRename = null; // { item, label, input, oldName } while a row's name is being edited

function startListRename(item) {
    if (listRename) return;
    const node = getNode(item.dataset.name);
    if (!node) return;

    const label = item.querySelector('.sequence-name');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sequence-name-input';
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.value = node.name;
    input.setAttribute('aria-label', t('Story_Inspector_Rename'));

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finishListRename();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finishListRename({ commit: false });
        }
    });
    input.addEventListener('blur', () => finishListRename());

    listRename = { item, label, input, oldName: node.name };
    label.replaceWith(input);
    input.focus();
    input.select();
}

// Safe to call when no rename is in progress. A name that is refused (empty, or taken) leaves the node as it
// was.
function finishListRename({ commit = true } = {}) {
    if (!listRename) return;

    const { item, label, input, oldName } = listRename;
    listRename = null;
    const newName = input.value.trim();
    input.replaceWith(label);

    if (commit && canRenameNode(oldName, newName)) {
        // The row is re-keyed first, so the list keeps it rather than making a new one.
        item.dataset.name = newName;
        renameNode(oldName, newName);
        updateNodeBadge();
    }
}

// The list and the graph are shown one at a time, so the two buttons act as a pair: pressing one shows its
// view and releases the other.
function setViewMode(mode) {
    viewFractions[viewMode] = inspectorFraction;
    viewMode = mode;
    editorViewEl.dataset.view = mode;
    inspectorFraction = Math.min(viewFractions[mode], INSPECTOR_MAX_FRACTION);
    applyInspectorSize();
    for (const button of viewButtons) {
        const on = button.dataset.view === mode;
        button.classList.toggle('selected', on);
        button.setAttribute('aria-pressed', String(on));
    }

    sequencePanelEl.classList.toggle('hidden', mode !== 'sequence');
    canvasContainer.classList.toggle('hidden', mode !== 'graph');

    if (mode === 'graph') {
        // The canvas measured nothing while hidden, so it is redrawn at its real size, and a node selected
        // from the list is brought into view.
        render();
        ensureSelectedVisible();
    } else {
        cancelPanTween();
        renderSequence();
    }
}

for (const button of viewButtons) {
    button.addEventListener('click', () => setViewMode(button.dataset.view));
}

// A press that ends an edit (by taking the focus from the box) shouldn't start another on the same row.
let pressEndedListRename = false;
sequenceListEl.addEventListener('pointerdown', (e) => {
    pressEndedListRename = listRename !== null && !e.target.closest('.sequence-name-input');
});

sequenceListEl.addEventListener('click', (e) => {
    const endedRename = pressEndedListRename;
    pressEndedListRename = false;
    if (e.target.closest('.sequence-handle') || e.target.closest('.sequence-name-input')) return;

    const item = e.target.closest('.sequence-item');
    const node = item ? getNode(item.dataset.name) : null;
    if (!node) return;

    // A second click on the row already selected edits its name, as in a file list.
    if (node.name === selectedName) {
        if (!endedRename) startListRename(item);
        return;
    }
    selectNode(node.name);
});

sequenceListEl.addEventListener('dblclick', (e) => {
    if (e.target.closest('.sequence-handle') || e.target.closest('.sequence-name-input')) return;

    const item = e.target.closest('.sequence-item');
    if (item) startListRename(item);
});

// The row is moved in the DOM while it is dragged and the nodes array is reordered once, on drop. Listening
// on the window keeps the drag alive while the row itself is being moved about under the pointer.
sequenceListEl.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.sequence-handle');
    if (!handle || e.button !== 0) return;

    e.preventDefault();
    const item = handle.closest('.sequence-item');
    item.classList.add('dragging');

    function renumber() {
        [...sequenceListEl.children].forEach((el, index) => {
            el.querySelector('.sequence-number').textContent = String(index + 1);
        });
    }

    function onMove(event) {
        const others = [...sequenceListEl.children].filter(el => el !== item);
        const before = others.find(el => {
            const rect = el.getBoundingClientRect();
            return event.clientY < rect.top + rect.height / 2;
        });

        if (before) {
            if (item.nextElementSibling !== before) sequenceListEl.insertBefore(item, before);
        } else if (sequenceListEl.lastElementChild !== item) {
            sequenceListEl.appendChild(item);
        }
        renumber();
    }

    function onUp() {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        item.classList.remove('dragging');

        const order = [...sequenceListEl.children].map(el => getNode(el.dataset.name)).filter(Boolean);
        const changed = order.length === nodes.length && order.some((node, index) => node !== nodes[index]);
        if (changed) {
            nodes = order;
            render();
            updateNodeBadge();
            scheduleSave();
        }
        renderSequence();
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
});

// ---------------------------------------------------------------------------
// Node events
// ---------------------------------------------------------------------------

function attachNodeEvents(el) {
    el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (e.button !== 0) return;

        cancelPanTween();

        const name = el.dataset.name;
        selectNode(name);

        isDraggingNode = true;
        dragName = name;
        const node = getNode(name);
        const screenPos = worldToScreen(node.x, node.y);
        dragOffsetX = e.clientX - screenPos.x;
        dragOffsetY = e.clientY - screenPos.y;
        el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
        if (!isDraggingNode || dragName !== el.dataset.name) return;
        const node = getNode(dragName);
        if (!node) return;

        const world = screenToWorld(e.clientX - dragOffsetX, e.clientY - dragOffsetY);
        node.x = world.x;
        node.y = world.y;
        render();
    });

    el.addEventListener('dblclick', () => {
        const node = getNode(el.dataset.name);
        if (node) {
            centreOn(node);
        }
    });

    el.addEventListener('pointerup', () => {
        if (!isDraggingNode || dragName !== el.dataset.name) return;
        isDraggingNode = false;
        dragName = null;

        const node = getNode(el.dataset.name);
        if (node) {
            node.x = snapToGrid(node.x);
            node.y = snapToGrid(node.y);
            render();
            scheduleSave();
        }
    });
}

// ---------------------------------------------------------------------------
// Canvas pan & zoom
// ---------------------------------------------------------------------------

canvasContainer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    // Pan only on empty-space clicks. Nodes stopPropagation in their own
    // pointerdown, so the only targets that reach here are the container, the
    // (pointer-events:none) connection canvas, or the #canvas layer that sits
    // inset:0 over the whole container and is the actual hit-target for empty
    // space.
    if (e.target !== canvasContainer && e.target !== connCanvas && e.target !== canvasEl) return;
    // Don't clear the selection yet: a drag should pan without disturbing the
    // current selection, and only a click (no significant travel) should
    // deselect. The decision is deferred to pointerup once we know which it was.
    cancelPanTween();
    isPanning = true;
    panMoved = false;
    panDownX = e.clientX;
    panDownY = e.clientY;
    panStartX = e.clientX - panX;
    panStartY = e.clientY - panY;
    canvasContainer.setPointerCapture(e.pointerId);
});

canvasContainer.addEventListener('pointermove', (e) => {
    if (!isPanning) return;
    if (!panMoved &&
        (Math.abs(e.clientX - panDownX) > CLICK_DRAG_THRESHOLD ||
         Math.abs(e.clientY - panDownY) > CLICK_DRAG_THRESHOLD)) {
        panMoved = true;
    }
    panX = e.clientX - panStartX;
    panY = e.clientY - panStartY;
    clampPan();
    render();
});

canvasContainer.addEventListener('pointerup', () => {
    if (!isPanning) return;
    isPanning = false;
    // A click on empty canvas clears the selection; a drag pans and leaves it.
    if (!panMoved) selectNode(null);
});

canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    cancelPanTween();

    const rect = canvasContainer.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const oldZoom = zoom;
    zoom *= e.deltaY < 0 ? 1.1 : 0.9;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));

    panX = cx - (cx - panX) * (zoom / oldZoom);
    panY = cy - (cy - panY) * (zoom / oldZoom);
    clampPan();
    render();
}, { passive: false });

function clampPan() {
    if (nodes.length === 0) return;
    const rect = canvasContainer.getBoundingClientRect();
    const margin = VIEW_MARGIN;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
        minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
        minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    }

    const left  = worldToScreen(minX, 0).x;
    const right = worldToScreen(maxX, 0).x;
    const top   = worldToScreen(0, minY).y;
    const bot   = worldToScreen(0, maxY).y;

    if (right < margin) panX += margin - right;
    if (left > rect.width - margin) panX -= left - (rect.width - margin);
    if (bot < margin) panY += margin - bot;
    if (top > rect.height - margin) panY -= top - (rect.height - margin);
}

// ---------------------------------------------------------------------------
// Splitter
// ---------------------------------------------------------------------------

// The panel sits after the splitter in both arrangements, so a drag towards it shrinks it. Its size is held
// as a fraction of the document and written back as a percentage, so the split keeps its proportions when
// the document is resized, and carries over when the arrangement changes.
let fractionAtDragStart = INSPECTOR_DEFAULT_FRACTION;
let documentSizeAtDragStart = 0;

function isStacked() {
    return editorViewEl.dataset.layout === 'stacked';
}

function applyInspectorSize() {
    const size = `${inspectorFraction * 100}%`;

    // Only the axis in force is set, so the other is left to the stylesheet.
    inspectorEl.style.width = isStacked() ? '' : size;
    inspectorEl.style.height = isStacked() ? size : '';
    renderConnections();
}

// Beside the canvas while the document is wide enough for a column, below it when it is not.
function updateLayout() {
    const width = editorViewEl.getBoundingClientRect().width;
    if (width <= 0) {
        return;
    }

    const layout = width < STACK_THRESHOLD ? 'stacked' : 'inline';
    if (editorViewEl.dataset.layout !== layout) {
        editorViewEl.dataset.layout = layout;
        applyInspectorSize();
        applyTextShare();
        ensureSelectedVisible();
    }
}

// The shared splitter gesture reports horizontal travel only, and this band turns with the arrangement, so
// the drag is handled here. It keeps the shared band's `dragging` class and its double-click reset.
function attachPaneSplitter(element, { onDragStart, onDrag, onDragEnd, onReset }) {
    let startX = 0;
    let startY = 0;

    function onPointerMove(event) {
        onDrag(event.clientX - startX, event.clientY - startY);
    }

    function endDrag(event) {
        element.classList.remove('dragging');
        onDragEnd();
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', endDrag);
        window.removeEventListener('pointercancel', endDrag);
        try {
            element.releasePointerCapture(event.pointerId);
        } catch {
            // Pointer capture may already be released.
        }
    }

    element.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;

        startX = event.clientX;
        startY = event.clientY;
        onDragStart();
        element.classList.add('dragging');
        try {
            element.setPointerCapture(event.pointerId);
        } catch {
            // Some environments lack pointer capture. The window listeners still track the drag.
        }
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', endDrag);
        window.addEventListener('pointercancel', endDrag);
    });

    element.addEventListener('dblclick', onReset);
}

attachPaneSplitter(splitterEl, {
    onDragStart() {
        fractionAtDragStart = inspectorFraction;
        const rect = editorViewEl.getBoundingClientRect();
        documentSizeAtDragStart = isStacked() ? rect.height : rect.width;
    },
    onDrag(deltaX, deltaY) {
        if (documentSizeAtDragStart <= 0) return;

        const delta = isStacked() ? deltaY : deltaX;
        const fraction = fractionAtDragStart - delta / documentSizeAtDragStart;
        inspectorFraction = Math.max(INSPECTOR_MIN_FRACTION, Math.min(INSPECTOR_MAX_FRACTION, fraction));
        applyInspectorSize();
    },
    // Once, at the end of the gesture: a check on every frame would have the graph swimming under the
    // pointer while the panel is being sized.
    onDragEnd() {
        ensureSelectedVisible();
    },
    onReset() {
        inspectorFraction = INSPECTOR_DEFAULT_FRACTION;
        applyInspectorSize();
        ensureSelectedVisible();
    },
});

// ---------------------------------------------------------------------------
// Inspector events
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Text / preview splitter
//
// In the split modes the text sits beside the preview or above it, as the
// author chose, each taking its share of the field. The text scrolls within its
// share and the slide is fitted into the rest. The two splits share one
// proportion, so switching between them keeps the divider where it was.
// ---------------------------------------------------------------------------

let textShareAtDragStart = TEXT_SHARE_DEFAULT;
let textFieldSizeAtDragStart = 0;

function isTextSplitSideBySide() {
    return textMode === 'split-columns';
}

// Written as flex weights, so the two divide whatever the field has once the divider has taken its own.
function applyTextShare() {
    textEditorEl.style.setProperty('--text-grow', String(textShare * 100));
    textEditorEl.style.setProperty('--preview-grow', String((1 - textShare) * 100));
    textSplitterEl.setAttribute('aria-orientation', isTextSplitSideBySide() ? 'vertical' : 'horizontal');
    textSplitterEl.setAttribute('aria-valuenow', String(Math.round(textShare * 100)));
}

attachPaneSplitter(textSplitterEl, {
    onDragStart() {
        textShareAtDragStart = textShare;
        const rect = textEditorEl.getBoundingClientRect();
        textFieldSizeAtDragStart = isTextSplitSideBySide() ? rect.width : rect.height;
    },
    onDrag(deltaX, deltaY) {
        if (textFieldSizeAtDragStart <= 0) return;

        const delta = isTextSplitSideBySide() ? deltaX : deltaY;
        const share = textShareAtDragStart + delta / textFieldSizeAtDragStart;
        textShare = Math.max(TEXT_SHARE_MIN, Math.min(TEXT_SHARE_MAX, share));
        applyTextShare();
    },
    onDragEnd() {},
    onReset() {
        textShare = TEXT_SHARE_DEFAULT;
        applyTextShare();
    },
});

applyTextShare();

// ---------------------------------------------------------------------------
// Text / custom data splitter
//
// When the panel is wide enough for the custom data to sit beside the story's
// description or the node's text, a divider between them sets the data's share
// of the panel. The story and node panels share one proportion, so moving
// between them keeps the divider where it was.
// ---------------------------------------------------------------------------

let dataShareAtDragStart = DATA_SHARE_DEFAULT;
let dataSectionWidthAtDragStart = 0;

function applyDataShare() {
    inspectorEl.style.setProperty('--data-share', `${dataShare * 100}%`);
    for (const splitter of dataSplitterEls) {
        splitter.setAttribute('aria-valuenow', String(Math.round((1 - dataShare) * 100)));
    }
}

for (const splitter of dataSplitterEls) {
    attachPaneSplitter(splitter, {
        onDragStart() {
            dataShareAtDragStart = dataShare;
            dataSectionWidthAtDragStart = splitter.parentElement.getBoundingClientRect().width;
        },
        // The data is to the right of the divider, so a drag to the right shrinks it.
        onDrag(deltaX) {
            if (dataSectionWidthAtDragStart <= 0) return;

            const share = dataShareAtDragStart - deltaX / dataSectionWidthAtDragStart;
            dataShare = Math.max(DATA_SHARE_MIN, Math.min(DATA_SHARE_MAX, share));
            applyDataShare();
        },
        onDragEnd() {},
        onReset() {
            dataShare = DATA_SHARE_DEFAULT;
            applyDataShare();
        },
    });
}

applyDataShare();

// ---------------------------------------------------------------------------
// Editor state
//
// How the editor is laid out, as opposed to the story itself: where its three
// dividers sit. The host asks for it when the document closes, keeps it with
// the project, and hands it back when the document opens again. It is the
// editor's own JSON, and anything in it the editor no longer understands (or a
// value out of bounds) is ignored or brought back within bounds.
// ---------------------------------------------------------------------------

function saveEditorState() {
    return JSON.stringify({ inspectorFraction, textShare, dataShare });
}

// A saved proportion, within the bounds its divider keeps, or null when there is none to use.
function restoredShare(value, min, max) {
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : null;
}

function restoreEditorState(json) {
    let state;
    try {
        state = JSON.parse(json);
    } catch {
        return;
    }

    const inspector = restoredShare(state?.inspectorFraction, INSPECTOR_MIN_FRACTION, INSPECTOR_MAX_FRACTION);
    if (inspector !== null) {
        inspectorFraction = inspector;
        applyInspectorSize();
        ensureSelectedVisible();
    }

    const text = restoredShare(state?.textShare, TEXT_SHARE_MIN, TEXT_SHARE_MAX);
    if (text !== null) {
        textShare = text;
        applyTextShare();
    }

    const data = restoredShare(state?.dataShare, DATA_SHARE_MIN, DATA_SHARE_MAX);
    if (data !== null) {
        dataShare = data;
        applyDataShare();
    }
}

// ---------------------------------------------------------------------------
// Renaming
//
// The node's name and the story's each sit in their panel's header as a text
// box drawn like a node, so a click puts the caret straight in. Enter or
// leaving the box applies the name; Escape puts back the one it had. The name
// an edit started from is remembered, so a node renamed while the selection
// moves is still the node the edit began on.
// ---------------------------------------------------------------------------

// A node on the canvas is as wide as its name, so the box is sized to what it holds, or to its placeholder
// while empty.
function fitNameBox(input) {
    input.size = Math.max(6, (input.value || input.placeholder).length + 1);
}

// Wires up a name box. `read` gives the name editing starts from, or null when there is nothing to rename;
// `apply` receives that starting name and the one typed.
function inlineNameEditor({ input, read, apply }) {
    let original = null; // the name editing started from, or null when not editing

    function start() {
        if (original !== null) return;
        original = read();
    }

    // Applies the edited name, or with `commit: false` puts back the one it started from, and ends the edit.
    // Safe to call when no edit is in progress.
    function finish({ commit = true } = {}) {
        if (original === null) return;

        const from = original;
        original = null;
        if (commit) {
            apply(from, input.value.trim());
        } else {
            input.value = from;
            fitNameBox(input);
        }

        // The edit is over, so the box lets go of the keyboard; the blur that follows finds nothing to do.
        if (document.activeElement === input) {
            input.blur();
        }
    }

    input.addEventListener('focus', start);
    input.addEventListener('input', () => fitNameBox(input));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finish();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finish({ commit: false });
        }
    });
    input.addEventListener('blur', () => finish());

    return {
        finish,
        get active() { return original !== null; },
    };
}

// A name that is refused (empty, or taken) leaves the node as it was, and the box shows its name again.
const nodeNameEdit = inlineNameEditor({
    input: inspectorNameEl,
    read: () => getNode(selectedName)?.name ?? null,
    apply: (oldName, newName) => {
        renameNode(oldName, newName);
        updateNodeBadge();
    },
});

// The story's name is optional, so an emptied box is applied: the story goes back to being untitled.
const storyNameEdit = inlineNameEditor({
    input: storyNameEl,
    read: () => storyName.trim(),
    apply: (oldName, newName) => {
        if (newName !== oldName) {
            storyName = newName;
            scheduleSave();
        }
        updateStoryBadge();
    },
});

// Shows the story's name; while it has none, the box shows its placeholder, lighter, as a prompt.
function updateStoryBadge() {
    if (!storyNameEdit.active) {
        storyNameEl.value = storyName.trim();
        fitNameBox(storyNameEl);
    }
    storyNameEl.title = t('Story_Story_Rename');
}

// A name that is empty or already taken is not applied, and the node keeps the name it had.
function canRenameNode(oldName, newName) {
    return !!getNode(oldName) && !!newName && newName !== oldName && !nodes.some(n => n.name === newName);
}

function renameNode(oldName, newName) {
    if (!canRenameNode(oldName, newName)) return;
    const node = getNode(oldName);

    // Rewrite outgoing links in all nodes that reference the old name
    for (const n of nodes) {
        n.text = n.text.replace(
            new RegExp(`\\[([^\\]]+)\\]\\(${escapeRegex(oldName)}\\)`, 'g'),
            `[$1](${newName})`
        );
    }

    node.name = newName;
    renameNodeFields(oldName, newName);
    if (selectedName === oldName) {
        selectedName = newName;
    }
    render();
    renderSequence();
    renderDataPanels();
    scheduleSave();
}

inspectorTextEl.addEventListener('input', () => {
    const node = getNode(selectedName);
    if (!node) return;
    node.text = inspectorTextEl.value;
    renderConnections();
    schedulePreview();
    scheduleSave();
});

storyDescriptionEl.addEventListener('input', () => {
    storyDescription = storyDescriptionEl.value;
    scheduleSave();
});

// The style and location choices only matter once the buttons are switched on, so they are shown only then.
function applyNavigationControls() {
    storyNavShowEl.checked = navigation.show;
    storyNavOptionsEl.classList.toggle('hidden', !navigation.show);
    for (const radio of navStyleRadios) radio.checked = radio.value === navigation.style;
    for (const radio of navPositionRadios) radio.checked = radio.value === navigation.position;
    storyNavNumberEl.checked = navigation.showNumber;
}

function applySequenceArrowControls() {
    storySeqShowEl.checked = sequenceArrows.show;
    storySeqOptionsEl.classList.toggle('hidden', !sequenceArrows.show);
    for (const radio of seqStyleRadios) radio.checked = radio.value === sequenceArrows.style;
    storySeqColorEl.value = sequenceArrows.color;
    storySeqAlphaEl.value = String(Math.round(sequenceArrows.alpha * 100));
    storySeqAlphaValueEl.textContent = `${storySeqAlphaEl.value}%`;
}

storyNavNumberEl.addEventListener('change', () => {
    navigation.showNumber = storyNavNumberEl.checked;
    scheduleSave();
});

storySeqShowEl.addEventListener('change', () => {
    sequenceArrows.show = storySeqShowEl.checked;
    applySequenceArrowControls();
    renderConnections();
    scheduleSave();
});

for (const radio of seqStyleRadios) {
    radio.addEventListener('change', () => {
        if (!radio.checked) return;
        sequenceArrows.style = radio.value;
        renderConnections();
        scheduleSave();
    });
}

// The colour and alpha repaint as they are dragged, so the author sees the result while choosing it.
storySeqColorEl.addEventListener('input', () => {
    sequenceArrows.color = storySeqColorEl.value.toLowerCase();
    renderConnections();
    scheduleSave();
});

storySeqAlphaEl.addEventListener('input', () => {
    sequenceArrows.alpha = Number(storySeqAlphaEl.value) / 100;
    storySeqAlphaValueEl.textContent = `${storySeqAlphaEl.value}%`;
    renderConnections();
    scheduleSave();
});

storyNavShowEl.addEventListener('change', () => {
    navigation.show = storyNavShowEl.checked;
    // Switching the buttons on brings the slide number with them; it can still be turned off on its own.
    if (navigation.show) {
        navigation.showNumber = true;
    }
    applyNavigationControls();
    scheduleSave();
});

for (const [radios, field] of [[navStyleRadios, 'style'], [navPositionRadios, 'position']]) {
    for (const radio of radios) {
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            navigation[field] = radio.value;
            scheduleSave();
        });
    }
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Custom data
//
// A story and each of its nodes can carry extra fields for another program to
// read, described by shared schema files the story lists. Each schema has a
// section in the story and node panels with an input per field. Anything the
// editor can't show as a field (a value of the wrong kind, data no schema
// describes, a schema that can't be read) is shown as it is and kept: custom
// data is never dropped by the editor.
// ---------------------------------------------------------------------------

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

// The fields of a parsed object the editor has no use for, in the order the file had them.
function unknownFields(raw, known) {
    return Object.fromEntries(Object.entries(raw).filter(([key]) => !known.includes(key)));
}

// Unknown fields are written after the known ones. A field the editor writes itself wins over a kept value of the
// same name that it couldn't read (a "data" that isn't an object, say), so that value lasts until it is replaced.
function appendUnknown(target, extras) {
    for (const [key, value] of Object.entries(extras ?? {})) {
        if (!(key in target)) target[key] = value;
    }
    return target;
}

// A field left empty is not written to the file.
function isEmptyValue(value) {
    return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

// Why a schema can't be used, or null when it can. The reason is shown to the author as it is.
function schemaProblem(schema) {
    if (!isPlainObject(schema)) return 'expected a JSON object';
    if (typeof schema.namespace !== 'string' || schema.namespace === '') return 'it has no "namespace"';
    for (const scope of ['story', 'node']) {
        if (schema[scope] === undefined) continue;
        if (!Array.isArray(schema[scope])) return `"${scope}" is not a list of fields`;
        const problem = fieldsProblem(schema[scope], scope);
        if (problem) return problem;
    }
    return null;
}

function fieldsProblem(fields, where) {
    for (const field of fields) {
        if (!isPlainObject(field) || typeof field.key !== 'string' || field.key === '') {
            return `a field in "${where}" has no "key"`;
        }
        if (!FIELD_TYPES.includes(field.type)) {
            return `field "${field.key}" has an unknown type "${field.type}"`;
        }
        // A choice's options are all text, or all numbers (a grid position, say), and are written as they are.
        if (field.type === 'choice' && !(Array.isArray(field.options)
            && (field.options.every(o => typeof o === 'string') || field.options.every(o => Number.isFinite(o))))) {
            return `field "${field.key}" needs a list of "options", all text or all numbers`;
        }
        if (field.type === 'list' && field.fields !== undefined) {
            if (!Array.isArray(field.fields)) return `"fields" of "${field.key}" is not a list of fields`;
            const problem = fieldsProblem(field.fields, field.key);
            if (problem) return problem;
        }
    }
    return null;
}

async function readSchema(key) {
    try {
        const result = parseToolResult(await cel.file.read(key));
        const schema = JSON.parse(result.content);
        const problem = schemaProblem(schema);
        return problem ? { error: problem } : { schema };
    } catch (e) {
        return { error: e?.message ?? String(e) };
    }
}

// Reads every schema the story lists, then shows their fields. A read still under way when the list changes again
// is dropped, so the panels always follow the latest list.
let schemaLoadCount = 0;

async function loadSchemas() {
    const run = ++schemaLoadCount;
    const keys = [...schemaKeys];
    const results = await Promise.all(keys.map(readSchema));
    if (run !== schemaLoadCount) return;

    schemas = new Map(keys.map((key, i) => [key, results[i]]));
    renderSchemaSettings();
    renderDataPanels();
}

// A rename rewrites the links that pointed at the old name, and every node field that held it, so references in
// custom data survive it too. Only fields a readable schema describes are known to hold node names.
function renameNodeFields(oldName, newName) {
    for (const entry of schemas?.values() ?? []) {
        if (!entry.schema) continue;
        const { namespace, story = [], node = [] } = entry.schema;
        renameInValues(story, storyData[namespace], oldName, newName);
        for (const n of nodes) {
            renameInValues(node, n.data[namespace], oldName, newName);
        }
    }
}

function renameInValues(fields, values, oldName, newName) {
    if (!isPlainObject(values)) return;
    for (const field of fields) {
        const value = values[field.key];
        if (field.type === 'node' && value === oldName) {
            values[field.key] = newName;
        } else if (field.type === 'list' && Array.isArray(field.fields) && Array.isArray(value)) {
            for (const row of value) renameInValues(field.fields, row, oldName, newName);
        }
    }
}

// Whether a value can be edited as the field says. A missing value always can.
function fieldAccepts(field, value) {
    if (value === undefined) return true;
    switch (field.type) {
        case 'text':
        case 'multiline':
        case 'node':
            return typeof value === 'string';
        case 'number':
            return Number.isFinite(value);
        case 'boolean':
            return typeof value === 'boolean';
        case 'choice':
            return field.options.includes(value);
        case 'list':
            return Array.isArray(value)
                && value.every(row => (Array.isArray(field.fields) ? isPlainObject(row) : typeof row === 'string'));
        default:
            return false;
    }
}

// ---- Panels ----

let fieldIdCount = 0;
const collapsedSections = new Set(); // "scope:id" of each section the author has folded away

function renderDataPanels() {
    renderDataSections(storyDataEl, 'story', storyData);
    renderDataSections(nodeDataEl, 'node', getNode(selectedName)?.data ?? null);
}

// One section per schema the story lists, in its order, holding that schema's fields for the story or for a node.
// Data no listed schema describes follows, shown as it is. Nothing shows until the schemas have been read, so the
// panel doesn't flash their data up as undescribed first.
function renderDataSections(container, scope, root) {
    const sections = [];
    if (root && schemas) {
        const described = new Set();
        for (const key of schemaKeys) {
            const entry = schemas.get(key);
            if (!entry) continue;
            if (entry.error) {
                sections.push(createDataSection(scope, key, projectPath(key), [
                    createDataMessage(t('Story_Data_SchemaFailed', projectPath(key), entry.error)),
                ]));
                continue;
            }

            const { namespace, title } = entry.schema;
            const fields = entry.schema[scope] ?? [];
            described.add(namespace);
            if (fields.length === 0 && root[namespace] === undefined) continue;
            sections.push(createDataSection(scope, namespace, title || namespace,
                createSchemaFields(fields, root, namespace)));
        }

        for (const [namespace, value] of Object.entries(root)) {
            if (described.has(namespace)) continue;
            sections.push(createDataSection(scope, namespace, namespace, [
                createDataMessage(t('Story_Data_NoSchema', namespace)),
                createJsonBlock(value),
            ]));
        }
    }

    container.replaceChildren(...sections);
    container.classList.toggle('hidden', sections.length === 0);
}

function createDataSection(scope, id, title, children) {
    const sectionKey = `${scope}:${id}`;
    const section = document.createElement('details');
    section.className = 'data-section';
    section.open = !collapsedSections.has(sectionKey);
    section.addEventListener('toggle', () => {
        if (section.open) {
            collapsedSections.delete(sectionKey);
        } else {
            collapsedSections.add(sectionKey);
        }
    });

    const summary = document.createElement('summary');
    summary.textContent = title;
    const body = document.createElement('div');
    body.className = 'data-section-body';
    body.append(...children);
    section.append(summary, body);
    return section;
}

// The inputs for one schema's fields, writing into root[namespace]. The namespace's object is made when its first
// value is set and removed with its last, so a story without values doesn't carry empty objects.
function createSchemaFields(fields, root, namespace) {
    const values = root[namespace];
    if (values !== undefined && !isPlainObject(values)) {
        return [createDataMessage(t('Story_Data_NotObject')), createJsonBlock(values)];
    }

    const elements = fields.map(field => createFieldEditor(
        field,
        () => root[namespace]?.[field.key],
        (value) => {
            if (isEmptyValue(value)) {
                if (!root[namespace]) return;
                delete root[namespace][field.key];
                if (Object.keys(root[namespace]).length === 0) delete root[namespace];
            } else {
                root[namespace] ??= {};
                root[namespace][field.key] = value;
            }
            scheduleSave();
        },
    ));

    const known = new Set(fields.map(field => field.key));
    const others = Object.entries(values ?? {}).filter(([key]) => !known.has(key));
    if (others.length > 0) {
        elements.push(createDataMessage(t('Story_Data_Other'), { warning: false }),
            createJsonBlock(Object.fromEntries(others)));
    }
    return elements;
}

// One field: its label and the input its type calls for. `get` reads the value and `set` writes one, with
// undefined clearing it. A value the input can't show is shown as it is instead, with a button to clear it.
function createFieldEditor(field, get, set) {
    const wrapper = document.createElement('div');
    wrapper.className = 'data-field';
    if (field.help) wrapper.title = field.help;

    const id = `data-field-${++fieldIdCount}`;
    const labelText = field.label || field.key;
    const value = get();

    const label = document.createElement('label');
    label.className = 'field-label';
    label.htmlFor = id;
    label.textContent = labelText;

    if (!fieldAccepts(field, value)) {
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.textContent = t('Story_Data_Clear');
        clear.addEventListener('click', () => {
            set(undefined);
            renderDataPanels();
        });
        wrapper.classList.add('data-field-wide');
        wrapper.append(label, createDataMessage(t('Story_Data_Mismatch', field.type), { action: clear }),
            createJsonBlock(value));
        return wrapper;
    }

    if (field.type === 'boolean') {
        // Written only when it differs from the field's default, which is off unless the schema says otherwise.
        const fallback = field.default === true;
        const box = document.createElement('label');
        box.className = 'checkbox-field';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.checked = value ?? fallback;
        input.addEventListener('change', () => set(input.checked === fallback ? undefined : input.checked));
        const text = document.createElement('span');
        text.textContent = labelText;
        box.append(input, text);
        wrapper.classList.add('data-field-wide');
        wrapper.append(box);
        return wrapper;
    }

    if (field.type === 'list') {
        const heading = document.createElement('span');
        heading.className = 'field-label';
        heading.textContent = labelText;
        wrapper.classList.add('data-field-wide');
        wrapper.append(heading, createListEditor(field, value ?? [], set));
        return wrapper;
    }

    wrapper.append(label, createValueInput(field, value, set, id));
    return wrapper;
}

function createValueInput(field, value, set, id) {
    if (field.type === 'choice' || field.type === 'node') {
        const select = createSelect(field, value);
        select.id = id;
        // The select holds every option as text, so a choice writes the option itself: a number stays a number.
        select.addEventListener('change', () => {
            const chosen = field.type === 'choice'
                ? field.options.find(option => String(option) === select.value)
                : select.value;
            set(chosen === '' ? undefined : chosen);
        });
        return select;
    }

    let input;
    if (field.type === 'multiline') {
        input = document.createElement('textarea');
        input.rows = 3;
    } else {
        input = document.createElement('input');
        input.type = field.type === 'number' ? 'number' : 'text';
        input.autocomplete = 'off';
    }
    input.id = id;
    input.value = value === undefined ? '' : String(value);
    if (field.default !== undefined) input.placeholder = String(field.default);

    input.addEventListener('input', () => {
        if (input.value === '') {
            set(undefined);
        } else if (field.type !== 'number') {
            set(input.value);
        } else if (Number.isFinite(input.valueAsNumber)) {
            // A number still being typed ("-", "1e") isn't one yet, so it waits for the next keystroke.
            set(input.valueAsNumber);
        }
    });
    return input;
}

// A choice offers its options; a node field offers the story's nodes, in the default sequence. A node field that
// names a node no longer in the story keeps the name, marked as missing, rather than losing it.
function createSelect(field, value) {
    const select = document.createElement('select');
    const choices = field.type === 'node' ? nodes.map(n => n.name) : field.options;
    const add = (optionValue, text) => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = text;
        select.append(option);
    };

    if (!choices.includes('')) add('', t('Story_Data_None'));
    for (const choice of choices) add(choice, choice === '' ? t('Story_Data_None') : choice);
    if (value !== undefined && !choices.includes(value)) add(value, t('Story_Data_MissingNode', value));
    select.value = value ?? '';
    return select;
}

// A list's rows, each with its own fields (or a single text box, for a list of text) and buttons to move it up or
// down or remove it, and a button to add a row. Rows are edited in place; adding, moving and removing write a new
// list and draw the panel again.
function createListEditor(field, rows, set) {
    const records = Array.isArray(field.fields);
    const write = (next) => set(next.length > 0 ? next : undefined);

    const list = document.createElement('ol');
    list.className = 'data-rows';
    rows.forEach((row, index) => {
        const content = document.createElement('div');
        content.className = 'data-row-fields';
        if (records) {
            for (const subField of field.fields) {
                content.append(createFieldEditor(subField, () => rows[index][subField.key], (value) => {
                    if (isEmptyValue(value)) {
                        delete rows[index][subField.key];
                    } else {
                        rows[index][subField.key] = value;
                    }
                    write(rows);
                }));
            }
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.autocomplete = 'off';
            input.value = row;
            input.addEventListener('input', () => {
                rows[index] = input.value;
                write(rows);
            });
            content.append(input);
        }

        const item = document.createElement('li');
        item.className = 'data-row';
        item.append(content, createRowButtons(rows, index, write));
        list.append(item);
    });

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'data-add';
    const icon = document.createElement('i');
    icon.className = 'bi bi-plus-lg';
    const text = document.createElement('span');
    text.textContent = t('Story_Data_AddRow');
    addButton.append(icon, text);
    addButton.addEventListener('click', () => {
        write([...rows, records ? {} : '']);
        renderDataPanels();
    });

    const editor = document.createElement('div');
    editor.className = 'data-list';
    editor.append(list, addButton);
    return editor;
}

function createRowButtons(rows, index, write) {
    const buttons = document.createElement('div');
    buttons.className = 'data-row-buttons';
    const addButton = (iconClass, key, disabled, change) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cel-icon-button';
        button.title = t(key);
        button.setAttribute('aria-label', t(key));
        button.disabled = disabled;
        const icon = document.createElement('i');
        icon.className = `bi ${iconClass}`;
        button.append(icon);
        button.addEventListener('click', () => {
            const next = [...rows];
            change(next);
            write(next);
            renderDataPanels();
        });
        buttons.append(button);
    };

    addButton('bi-arrow-up', 'Story_Data_MoveUp', index === 0,
        next => next.splice(index - 1, 0, ...next.splice(index, 1)));
    addButton('bi-arrow-down', 'Story_Data_MoveDown', index === rows.length - 1,
        next => next.splice(index + 1, 0, ...next.splice(index, 1)));
    addButton('bi-x-lg', 'Story_Data_RemoveRow', false, next => next.splice(index, 1));
    return buttons;
}

function createDataMessage(text, { warning = true, action = null } = {}) {
    const message = document.createElement('div');
    message.className = 'data-message';
    message.classList.toggle('warning', warning);
    if (warning) {
        const icon = document.createElement('i');
        icon.className = 'bi bi-exclamation-triangle-fill';
        message.append(icon);
    }
    const span = document.createElement('span');
    span.textContent = text;
    message.append(span);
    if (action) message.append(action);
    return message;
}

function createJsonBlock(value) {
    const block = document.createElement('pre');
    block.className = 'data-json';
    block.textContent = JSON.stringify(value, null, 2);
    return block;
}

// ---- Settings: the story's schema files ----

function renderSchemaSettings() {
    const items = schemaKeys.map((key) => {
        const error = schemas?.get(key)?.error;
        const item = document.createElement('li');
        item.className = 'schema-item';

        const icon = document.createElement('i');
        icon.className = error ? 'bi bi-exclamation-triangle-fill schema-error' : 'bi bi-braces';
        if (error) icon.title = t('Story_Data_SchemaFailed', projectPath(key), error);

        const name = document.createElement('span');
        name.className = 'schema-name';
        name.textContent = projectPath(key);
        name.title = key;

        // Removing a schema stops its fields being shown; the data it described stays in the file.
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'cel-icon-button';
        remove.title = t('Story_Schemas_Remove');
        remove.setAttribute('aria-label', t('Story_Schemas_Remove'));
        const removeIcon = document.createElement('i');
        removeIcon.className = 'bi bi-x-lg';
        remove.append(removeIcon);
        remove.addEventListener('click', () => setSchemaKeys(schemaKeys.filter(k => k !== key)));

        item.append(icon, name, remove);
        return item;
    });

    if (items.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'schema-empty';
        empty.textContent = t('Story_Schemas_None');
        items.push(empty);
    }
    schemaListEl.replaceChildren(...items);
}

function setSchemaKeys(keys) {
    schemaKeys = keys;
    renderSchemaSettings();
    refreshSchemaChoices();
    scheduleSave();
    loadSchemas();
}

// The drop-down offers every schema file in the project the story doesn't already use.
async function refreshSchemaChoices() {
    let tree = { children: [] };
    try {
        tree = parseToolResult(await cel.file.getTree('', 64, `*${SCHEMA_SUFFIX}`, ''));
    } catch (e) {
        console.error('[Story] Failed to list the schema files:', e);
    }

    const keys = [];
    const walk = (node, path) => {
        for (const child of node.children ?? []) {
            const childPath = joinPath(path, child.name);
            if (child.type === 'folder') {
                walk(child, childPath);
            } else if (child.name.endsWith(SCHEMA_SUFFIX)) {
                keys.push(`project:${childPath}`);
            }
        }
    };
    walk(tree, '');
    const available = keys.filter(key => !schemaKeys.includes(key)).sort();

    const options = [['', t(available.length > 0 ? 'Story_Schemas_Choose' : 'Story_Schemas_NoneFound')],
        ...available.map(key => [key, projectPath(key)])];
    schemaAddEl.replaceChildren(...options.map(([value, text]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        return option;
    }));
    schemaAddEl.value = '';
    schemaAddEl.disabled = available.length === 0;
}

schemaAddEl.addEventListener('change', () => {
    const key = schemaAddEl.value;
    if (key && !schemaKeys.includes(key)) {
        setSchemaKeys([...schemaKeys, key]);
    }
});

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

btnAdd.addEventListener('click', () => {
    // From the list view the canvas is hidden, so the node goes at the centre of the graph as last seen.
    const center = screenToWorld(
        (canvasContainer.clientWidth || canvasSize.width) / 2,
        (canvasContainer.clientHeight || canvasSize.height) / 2
    );
    const { x, y } = freePosition(snapToGrid(center.x), snapToGrid(center.y));
    const node = { name: uniqueName(t('Story_NewNode_Name')), x, y, text: '', data: {}, extras: {} };
    nodes.push(node);
    render();
    selectNode(node.name);
    scheduleSave();
});

btnDelete.addEventListener('click', () => {
    if (!selectedName) return;

    nodes = nodes.filter(n => n.name !== selectedName);
    selectNode(null);
    render();
    scheduleSave();
});

// ---------------------------------------------------------------------------
// Play mode
// ---------------------------------------------------------------------------

btnPlay.addEventListener('click', async () => {
    if (isPlaying) {
        stopPlay();
        return;
    }

    const startNode = selectedName ? getNode(selectedName) : nodes[0];
    if (!startNode) {
        showNotice('Story_Error_NoNodes');
        return;
    }

    if (!await loadMarp()) {
        showNotice('Story_Error_RendererFailed');
        return;
    }

    hideNotice();
    startPlay(startNode);
});

function updatePlayButton() {
    btnPlay.innerHTML = isPlaying
        ? '<i class="bi bi-stop-fill"></i>'
        : '<i class="bi bi-play-fill"></i>';
    // Green to start, red to stop.
    btnPlay.classList.toggle('playing', isPlaying);

    const label = t(isPlaying ? 'Story_Toolbar_Stop' : 'Story_Toolbar_Play');
    btnPlay.title = label;
    btnPlay.setAttribute('aria-label', label);
}

// Nothing on the toolbar edits the story while it is being played: the canvas those actions work on is not
// even on screen. Stop is the way back.
function updateToolbarState() {
    btnSequence.disabled = isPlaying;
    btnGraph.disabled = isPlaying;
    btnAdd.disabled = isPlaying;
    btnExport.disabled = isPlaying;
    btnPdf.disabled = isPlaying || isExportingPdf;
    btnSettings.disabled = isPlaying;
    btnDelete.disabled = isPlaying || !selectedName;

    updatePlayButton();
}

function startPlay(node) {
    isPlaying = true;
    updateToolbarState();
    editorViewEl.classList.add('hidden');
    playViewEl.classList.remove('hidden');
    navigateTo(node.name);
}

function stopPlay() {
    isPlaying = false;
    playingName = null;
    updateToolbarState();
    playViewEl.classList.add('hidden');
    editorViewEl.classList.remove('hidden');
    // Play and the preview share the slide stylesheet, so the preview is rendered again to take it back.
    renderPreview();
}

// Loads the renderer on demand. Returns false when the bundle could not be fetched, which for a CDN import
// usually means there is no network.
async function loadMarp() {
    if (marp) {
        return true;
    }

    try {
        const [core, ...plugins] = await Promise.all([MARP_URL, ...MARP_PLUGIN_URLS].map((url) => import(url)));
        // Line breaks are honoured, so choices written one per line read as a list rather than running
        // together in a paragraph.
        //
        // The script Marp would inject for its browser helper is turned off: it would not run from innerHTML.
        // The helper is started from its own module below instead.
        createMarp = (options = {}) => withSlideDefaults(plugins.reduce(
            (renderer, plugin) => renderer.use(plugin.default()),
            new core.Marp({ script: false, markdown: { breaks: true }, ...options })));
        marp = createMarp();
        await startBrowserHelper();
        return true;
    } catch (e) {
        console.error('[Story] Failed to load the slide renderer:', e);
        return false;
    }
}

// Adds the story's own defaults to every slide's stylesheet, the way Marp's plugins add theirs: ahead of the
// theme, and scoped to the slide like the rest of it. A theme's rules and a node's <style scoped> still win.
function withSlideDefaults(renderer) {
    const packOptions = renderer.themeSetPackOptions;
    renderer.themeSetPackOptions = function (...args) {
        const options = packOptions.apply(this, args);
        options.before = (options.before ?? '') + SLIDE_DEFAULT_CSS;
        return options;
    };

    const render = renderer.render;
    renderer.render = function (...args) {
        const result = render.apply(this, args);
        return { ...result, html: showDiagramDiamonds(result.html) };
    };
    return renderer;
}

function showDiagramDiamonds(html) {
    return html.replace(HIDDEN_DIAMOND_MARKER, (tag) => tag.replace(/\brefX="0"/, 'refX="12"'));
}

// Starts Marp's browser helper on the page, which keeps each slide in play and in the preview painted at its
// scale. Without it slides still show, just unfitted and cropped when scaled down in WebKit, so a failure to
// load it is logged rather than stopping play.
async function startBrowserHelper() {
    try {
        const helper = await import(MARP_BROWSER_URL);
        marpBrowser = helper.browser(document);
    } catch (e) {
        console.warn('[Story] Failed to load the Marp browser helper; slides will not fit or scale:', e);
    }
}

// Node names may contain spaces, which CommonMark won't accept in a bare link target, so such a link would
// render as plain text even though the canvas draws it. Wrapping the target in <...> is the CommonMark form
// that allows them.
function bracketLinkTargets(text) {
    return text.replace(/\[([^\]]+)\]\(([^)<>]*\s[^)<>]*)\)/g, '[$1](<$2>)');
}

// The WebView is served from the package folder, so a relative image path in a slide would resolve against
// the editor's own files. The host serves project files under /project/<key>, so relative paths are resolved
// against the folder holding the .story file instead, the way a Markdown file's images would be.
function storyFolderUrl() {
    const key = resourceKey.startsWith('project:') ? resourceKey.slice('project:'.length) : resourceKey;
    const folder = key.includes('/') ? key.slice(0, key.lastIndexOf('/') + 1) : '';
    const encoded = folder.split('/').map(encodeURIComponent).join('/');
    return new URL('/project/' + encoded, location.origin);
}

function isRelativeUrl(url) {
    // Absolute URLs (https:, data:, ...), protocol-relative and root-relative paths are left alone.
    return url !== '' && !/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('/') && !url.startsWith('#');
}

function resolveSlideImages(root) {
    const base = storyFolderUrl();
    const resolve = (url) => isRelativeUrl(url) ? new URL(url, base).href : url;

    for (const img of root.querySelectorAll('img[src]')) {
        img.setAttribute('src', resolve(img.getAttribute('src')));
    }

    // Marp draws ![bg](...) images as CSS backgrounds on inline styles rather than <img> elements.
    for (const el of root.querySelectorAll('[style*="url("]')) {
        const style = el.getAttribute('style');
        el.setAttribute('style', style.replace(/url\((["']?)([^"')]*)\1\)/g,
            (match, quote, url) => `url(${quote}${resolve(url)}${quote})`));
    }
}

// Renders a node as a slide into the play view, or into the node preview. Only one of the two is on screen
// at a time, so they share the stylesheet Marp emits.
function showSlide(node, container = playTextEl) {
    const { html, css } = marp.render(bracketLinkTargets(node.text));

    slideStyleEl.textContent = css;
    container.innerHTML = html;
    resolveSlideImages(container);
    // WebKit has no customised built-in elements, so the helper swaps the new slide's fitting elements for
    // its own once they are in the page.
    marpBrowser?.update();
}

// The renderer percent-encodes a link's target (a space becomes %20), so it is decoded back to the node name.
function linkTarget(link) {
    const href = link.getAttribute('href') ?? '';
    try {
        return decodeURIComponent(href);
    } catch {
        // A malformed escape is left as written; it will report as not found.
        return href;
    }
}

// Delegated rather than bound per link, so a slide re-rendered underneath cannot leave a link unbound — and
// a link that keeps its default action navigates the WebView away from the editor.
playTextEl.addEventListener('click', (e) => {
    const link = e.target.closest?.('a');
    if (!link) {
        return;
    }

    e.preventDefault();
    navigateTo(linkTarget(link));
});

// Previous and next follow the default sequence, so the first node has no previous and the last no next.
// The play view and the node preview each carry a set of the buttons; this fills either for a node, and
// returns whether they are showing.
function fillSlideNav(navEl, node) {
    const index = node ? nodes.indexOf(node) : -1;
    const show = navigation.show && index !== -1;

    navEl.classList.toggle('hidden', !show);
    if (!show) return false;

    navEl.dataset.position = navigation.position;
    const countEl = navEl.querySelector('.slide-nav-count');
    countEl.classList.toggle('hidden', !navigation.showNumber);
    countEl.textContent = `${index + 1}/${nodes.length}`;
    setNavButton(navEl.querySelector('.slide-nav-prev'), nodes[index - 1], 'Story_Play_Previous');
    setNavButton(navEl.querySelector('.slide-nav-next'), nodes[index + 1], 'Story_Play_Next');
    return true;
}

function updatePlayNav() {
    if (fillSlideNav(playNavEl, getNode(playingName))) {
        playViewEl.dataset.navPosition = navigation.position;
    } else {
        delete playViewEl.dataset.navPosition;
    }
}

function updatePreviewNav() {
    fillSlideNav(previewNavEl, getNode(selectedName));
}

function setNavButton(button, target, key) {
    button.classList.toggle('hidden', !target);
    if (!target) return;

    button.dataset.target = target.name;
    const nameEl = button.querySelector('.play-nav-name');
    const withName = navigation.style === 'arrows-name';
    nameEl.textContent = withName ? target.name : '';
    nameEl.classList.toggle('hidden', !withName);

    const label = t(key, target.name);
    button.title = label;
    button.setAttribute('aria-label', label);
}

// Playing, the buttons move through the story; in the preview, they select the neighbouring node.
function attachSlideNav(navEl, go) {
    navEl.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button?.dataset.target) go(button.dataset.target);
    });
}

attachSlideNav(playNavEl, (name) => navigateTo(name));
attachSlideNav(previewNavEl, (name) => selectNode(name));

function navigateTo(nodeName) {
    const node = getNode(nodeName);
    playingName = node ? node.name : null;
    updatePlayNav();
    if (!node) {
        const message = document.createElement('p');
        const emphasis = document.createElement('em');
        emphasis.textContent = t('Story_Play_NodeNotFound', nodeName);
        message.appendChild(emphasis);
        playTextEl.replaceChildren(message);
        playTextEl.classList.add('visible');
        return;
    }

    playTextEl.classList.remove('visible');
    setTimeout(() => {
        try {
            showSlide(node);
        } catch (e) {
            console.error('[Story] Failed to render the slide:', e);
        }

        playTextEl.classList.add('visible');
        playViewEl.scrollTo({ top: 0, behavior: 'smooth' });
    }, 350);
}

// ---------------------------------------------------------------------------
// PDF export
//
// One page per node, in the default sequence, written wherever the author
// chooses in the save dialog. The dialog offers the story's own folder and
// name first (my_story.story -> my_story.pdf), then the last place saved to.
// ---------------------------------------------------------------------------

let pdfLibraries = null;

async function loadPdfLibraries() {
    if (pdfLibraries) return pdfLibraries;

    try {
        const [canvasModule, pdfModule] = await Promise.all([import(HTML2CANVAS_URL), import(JSPDF_URL)]);
        pdfLibraries = { html2canvas: canvasModule.default, jsPDF: pdfModule.jsPDF };
        return pdfLibraries;
    } catch (e) {
        console.error('[Story] Failed to load the PDF libraries:', e);
        return null;
    }
}

function siblingKey(extension) {
    const base = resourceKey.endsWith('.story') ? resourceKey.slice(0, -'.story'.length) : resourceKey;
    return base + extension;
}

// ---------------------------------------------------------------------------
// PDF save dialog
//
// The host lends a package no save dialog, so the editor draws one over itself:
// a folder in the project, the PDFs already in it, and a name, with a warning
// when the name is already taken. The file tools reach only the project, so
// that is where the PDF can go.
// ---------------------------------------------------------------------------

const pdfDialogEl = document.getElementById('pdf-dialog');
const pdfDialogFormEl = document.getElementById('pdf-dialog-form');
const pdfFolderListEl = document.getElementById('pdf-folder-list');
const pdfFileListEl = document.getElementById('pdf-file-list');
const pdfFileNameEl = document.getElementById('pdf-file-name');
const pdfDialogPathEl = document.getElementById('pdf-dialog-path');
const pdfDialogWarningEl = document.getElementById('pdf-dialog-warning');
const pdfDialogWarningTextEl = document.getElementById('pdf-dialog-warning-text');
const pdfDialogSaveEl = document.getElementById('pdf-dialog-save');
const pdfDialogCancelEl = document.getElementById('pdf-dialog-cancel');

// Characters no file name can hold on the platforms the host runs on.
const INVALID_FILE_NAME = /[\\/:*?"<>|]/;

let pdfDialogFolder = '';    // the folder being saved into, relative to the project root ('' is the root)
let pdfDialogEntries = [];   // what that folder holds, as { name, type }
let pdfDialogListing = 0;    // numbers each folder listing, so a slow one can't land over a newer one
let pdfDialogResolve = null; // settles the open dialog's promise
let lastPdfKey = null;       // where the author last saved, offered again next time

// The tools hand structured results to a package as JSON text.
function parseToolResult(value) {
    return typeof value === 'string' ? JSON.parse(value) : value;
}

function projectPath(key) {
    return key.startsWith('project:') ? key.slice('project:'.length) : key;
}

function joinPath(folder, name) {
    return folder ? `${folder}/${name}` : name;
}

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

// The name typed, with .pdf added when it was left off.
function pdfFileName() {
    const name = pdfFileNameEl.value.trim();
    return name && !/\.pdf$/i.test(name) ? `${name}.pdf` : name;
}

// What is already in the folder under that name. The comparison ignores case, since on macOS and Windows
// a name that differs only in case is the same file.
function pdfNameClash() {
    const name = pdfFileName().toLowerCase();
    return pdfDialogEntries.find(entry => entry.name.toLowerCase() === name) ?? null;
}

// Checks the name against the folder: whether it can be used, and whether saving would replace a file.
function updatePdfDialogState() {
    const name = pdfFileName();
    const clash = pdfNameClash();
    let warning = null;
    let blocked = !name || /^\.pdf$/i.test(name);

    if (name && INVALID_FILE_NAME.test(name)) {
        warning = { text: t('Story_PdfDialog_InvalidName'), error: true };
    } else if (clash?.type === 'folder') {
        warning = { text: t('Story_PdfDialog_FolderClash', clash.name), error: true };
    } else if (clash) {
        warning = { text: t('Story_PdfDialog_Overwrite', clash.name), error: false };
    }
    blocked ||= !!warning?.error;

    pdfDialogWarningEl.classList.toggle('hidden', !warning);
    pdfDialogWarningEl.classList.toggle('error', !!warning?.error);
    pdfDialogWarningTextEl.textContent = warning?.text ?? '';

    pdfDialogSaveEl.disabled = blocked;
    pdfDialogSaveEl.textContent = t(clash && !blocked ? 'Story_PdfDialog_Replace' : 'Story_PdfDialog_Save');
    pdfDialogPathEl.textContent = blocked ? '' : `project:${joinPath(pdfDialogFolder, clash?.name ?? name)}`;

    for (const item of pdfFileListEl.children) {
        item.classList.toggle('selected', !!clash && item.dataset.name === clash.name);
    }
}

// Every folder in the project, indented by depth, with the project root at the top.
async function renderPdfFolderList() {
    let tree = { children: [] };
    try {
        tree = parseToolResult(await cel.file.getTree('', 64, '', 'folder'));
    } catch (e) {
        console.error('[Story] Failed to list the project folders:', e);
    }

    const items = [];
    const walk = (node, path, depth) => {
        const item = document.createElement('li');
        item.setAttribute('role', 'option');
        item.tabIndex = -1;
        item.dataset.path = path;
        item.style.setProperty('--depth', depth);
        const icon = document.createElement('i');
        icon.className = depth === 0 ? 'bi bi-box' : 'bi bi-folder';
        const label = document.createElement('span');
        label.textContent = depth === 0 ? t('Story_PdfDialog_ProjectRoot') : node.name;
        item.append(icon, label);
        items.push(item);
        const folders = (node.children ?? []).filter(child => child.type === 'folder').sort(byName);
        for (const child of folders) walk(child, joinPath(path, child.name), depth + 1);
    };
    walk(tree, '', 0);
    pdfFolderListEl.replaceChildren(...items);
}

// Makes a folder the one being saved into, and lists the PDFs already there.
async function openPdfFolder(path) {
    pdfDialogFolder = path;
    for (const item of pdfFolderListEl.children) {
        const selected = item.dataset.path === path;
        item.classList.toggle('selected', selected);
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
        if (selected) item.scrollIntoView({ block: 'nearest' });
    }

    const listing = ++pdfDialogListing;
    pdfDialogEntries = [];
    pdfFileListEl.replaceChildren();
    updatePdfDialogState();

    let entries = [];
    try {
        entries = parseToolResult(await cel.file.listContents(path, ''));
    } catch (e) {
        console.error('[Story] Failed to list the folder:', e);
    }
    if (listing !== pdfDialogListing) return;

    pdfDialogEntries = entries;
    const pdfs = entries.filter(entry => entry.type === 'file' && /\.pdf$/i.test(entry.name)).sort(byName);
    const items = pdfs.map(entry => {
        const item = document.createElement('li');
        item.dataset.name = entry.name;
        const icon = document.createElement('i');
        icon.className = 'bi bi-file-earmark-pdf';
        const label = document.createElement('span');
        label.textContent = entry.name;
        item.append(icon, label);
        return item;
    });
    if (items.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'empty';
        empty.textContent = t('Story_PdfDialog_NoPdfs');
        items.push(empty);
    }
    pdfFileListEl.replaceChildren(...items);
    updatePdfDialogState();
}

function closePdfDialog(key) {
    const resolve = pdfDialogResolve;
    pdfDialogResolve = null;
    if (pdfDialogEl.open) pdfDialogEl.close();
    resolve?.(key);
}

// Asks where to save the PDF. Resolves to the chosen resource key, or null when the author cancels.
async function choosePdfKey() {
    const suggested = projectPath(lastPdfKey ?? siblingKey('.pdf'));
    const slash = suggested.lastIndexOf('/');
    const folder = slash < 0 ? '' : suggested.slice(0, slash);
    pdfFileNameEl.value = suggested.slice(slash + 1);

    const chosen = new Promise(resolve => { pdfDialogResolve = resolve; });
    pdfDialogEl.showModal();
    // The name is selected without its extension, ready to be typed over.
    pdfFileNameEl.focus();
    pdfFileNameEl.setSelectionRange(0, pdfFileNameEl.value.replace(/\.pdf$/i, '').length);

    await renderPdfFolderList();
    // A folder that has gone since the last save falls back to the project root.
    const known = [...pdfFolderListEl.children].some(item => item.dataset.path === folder);
    await openPdfFolder(known ? folder : '');
    return chosen;
}

pdfFolderListEl.addEventListener('click', (e) => {
    const item = e.target.closest('li[data-path]');
    if (item) openPdfFolder(item.dataset.path);
});

// Up and down step through the folders, as they do in a list.
pdfFolderListEl.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...pdfFolderListEl.children];
    const index = items.findIndex(item => item.dataset.path === pdfDialogFolder);
    const next = items[Math.max(0, Math.min(items.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (next) {
        openPdfFolder(next.dataset.path);
        next.focus();
    }
});

// Clicking a PDF takes its name, to replace it; double-clicking saves over it straight away.
pdfFileListEl.addEventListener('click', (e) => {
    const item = e.target.closest('li[data-name]');
    if (!item) return;
    pdfFileNameEl.value = item.dataset.name;
    updatePdfDialogState();
});

pdfFileListEl.addEventListener('dblclick', (e) => {
    if (e.target.closest('li[data-name]') && !pdfDialogSaveEl.disabled) pdfDialogFormEl.requestSubmit();
});

pdfFileNameEl.addEventListener('input', updatePdfDialogState);

pdfDialogFormEl.addEventListener('submit', (e) => {
    e.preventDefault();
    if (pdfDialogSaveEl.disabled) return;
    // Replacing a file keeps the name it already has, so the key matches the one the project knows.
    const name = pdfNameClash()?.name ?? pdfFileName();
    lastPdfKey = `project:${joinPath(pdfDialogFolder, name)}`;
    closePdfDialog(lastPdfKey);
});

pdfDialogCancelEl.addEventListener('click', () => closePdfDialog(null));

// Escape closes the dialog on its own; that is a cancel too.
pdfDialogEl.addEventListener('close', () => {
    if (pdfDialogResolve) closePdfDialog(null);
});

// Images are painted only once they have arrived, so the slide waits for them.
function imagesLoaded(root) {
    return Promise.all([...root.querySelectorAll('img')].map(img => img.complete ? null
        : new Promise(resolve => { img.onload = img.onerror = resolve; })));
}

function setPdfBusy(busy) {
    isExportingPdf = busy;
    btnPdf.classList.toggle('busy', busy);
    updateToolbarState();
}

btnPdf.addEventListener('click', async () => {
    if (isExportingPdf || nodes.length === 0) return;

    // Where it goes is asked first, so the author doesn't wait on the slides for a dialog they may cancel.
    const pdfKey = await choosePdfKey();
    if (!pdfKey) return;

    setPdfBusy(true);
    // The slides are laid out off screen: they have to be in the page to be measured and painted.
    const stage = document.createElement('div');
    stage.className = 'pdf-stage';
    const stageStyle = document.createElement('style');

    try {
        if (!await loadMarp()) {
            showNotice('Story_Error_RendererFailed');
            return;
        }
        const libraries = await loadPdfLibraries();
        if (!libraries) {
            showNotice('Story_Error_PdfLibrariesFailed');
            return;
        }

        document.head.appendChild(stageStyle);
        document.body.appendChild(stage);
        await document.fonts.ready;

        // Plain HTML rather than Marp's SVG wrapper, so html2canvas can paint it. Its stylesheet is scoped to
        // that form, so it lives beside the preview's without either touching the other.
        const pageMarp = createMarp({ inlineSVG: false });
        let pdf = null;

        for (const node of nodes) {
            const { html, css } = pageMarp.render(bracketLinkTargets(node.text));
            stageStyle.textContent = css;
            // The browser helper fits an element by drawing it in a shadow root, which html2canvas can't
            // paint, so the page's elements are kept plain and fitted text is shown at its natural size.
            stage.innerHTML = html.replace(/ is="marp-[a-z0-9]+"/g, '');
            resolveSlideImages(stage);
            await imagesLoaded(stage);

            // A node holding several slides is shown by its first, as in play.
            const slide = stage.querySelector('section');
            const width = slide.offsetWidth * PX_TO_PT;
            const height = slide.offsetHeight * PX_TO_PT;
            const canvas = await libraries.html2canvas(slide, {
                scale: PDF_RENDER_SCALE, useCORS: true, logging: false, backgroundColor: '#ffffff',
            });
            const image = canvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY);

            const orientation = width >= height ? 'landscape' : 'portrait';
            if (pdf) {
                pdf.addPage([width, height], orientation);
            } else {
                pdf = new libraries.jsPDF({ unit: 'pt', format: [width, height], orientation });
            }
            pdf.addImage(image, 'JPEG', 0, 0, width, height);
        }

        const base64 = pdf.output('datauristring').split(',')[1];
        await cel.file.writeBinary(pdfKey, base64);
        await cel.app.log(`Exported story PDF to ${pdfKey}`);
        // Best effort: the file is written whether or not the notification is shown.
        celbridge.dialog.showNotification('info', t('Story_Pdf_Saved', pdfKey)).catch(() => {});
    } catch (e) {
        console.error('[Story] PDF export failed:', e);
        showNotice('Story_Error_PdfFailed', e?.message ?? String(e));
    } finally {
        stage.remove();
        stageStyle.remove();
        setPdfBusy(false);
    }
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

btnExport.addEventListener('click', async () => {
    // The spreadsheet sits beside the story file and is named after it.
    const base = resourceKey.endsWith('.story')
        ? resourceKey.slice(0, -'.story'.length)
        : resourceKey;
    const xlsxKey = base + '.xlsx';

    try {
        // Overwrite the workbook in place. When it already exists we keep the
        // resource and rewrite its contents, so an open spreadsheet tab just
        // reloads rather than being closed (by delete) and reopened as a brand
        // new resource. get_info throws when the file is missing, which is how
        // we detect the first export and create the workbook from scratch.
        let exists = true;
        try {
            await cel.file.getInfo(xlsxKey);
        } catch {
            exists = false;
        }

        if (!exists) {
            await cel.explorer.createFile(xlsxKey);
            // A new workbook is created with a single default 'Sheet1'. Rename
            // it rather than adding a second sheet, so 'Localization' is the
            // first and only worksheet.
            await cel.spreadsheet.renameSheet(xlsxKey, 'Sheet1', 'Localization');
        } else {
            // Clear stale content and formatting so nodes removed since the last
            // export don't linger, and the following append starts at row 1.
            await cel.spreadsheet.clear(xlsxKey, JSON.stringify([
                { sheet: 'Localization', range: 'A:C' },
            ]));
        }

        const header = ['Node', 'Text', 'es'];
        const rows = [header, ...nodes.map(n => [n.name, n.text, ''])];
        await cel.spreadsheet.appendRows(xlsxKey, 'Localization', JSON.stringify(rows));

        await cel.spreadsheet.formatRanges(xlsxKey, JSON.stringify([
            { sheet: 'Localization', range: 'A1:C1',
              format: { textFormat: { bold: true, foregroundColor: '#ffffff' },
                        backgroundColor: '#2d5986' } },
            { sheet: 'Localization', range: 'A:A', format: { columnWidth: 20 } },
            { sheet: 'Localization', range: 'B:B', format: { columnWidth: 60 } },
            { sheet: 'Localization', range: 'C:C', format: { columnWidth: 60 } },
        ]));

        await cel.app.log(`Exported story localization to ${xlsxKey}`);
    } catch (e) {
        console.error('[Story] Export failed:', e);
    }
});

// ---------------------------------------------------------------------------
// Resize observer
// ---------------------------------------------------------------------------

new ResizeObserver(() => renderConnections()).observe(canvasContainer);
new ResizeObserver(() => updateLayout()).observe(editorViewEl);

// ---------------------------------------------------------------------------
// Localization
//
// Static markup is re-localized by the client when strings load. Text set
// from script is refreshed here.
// ---------------------------------------------------------------------------

// The host pushes a snapshot whenever application state changes, the theme among it. The DOM restyles
// itself from the tokens; the connections are repainted here because they live on a canvas.
celbridge.appState.onChanged(() => renderConnections());

celbridge.localization.onLanguageChanged(async (locale) => {
    try {
        await celbridge.localization.loadStrings(locale);
        updatePlayButton();
        if (notice) showNotice(notice.key, ...notice.args);
        for (const el of nodeElements.values()) el.dataset.startLabel = t('Story_Node_StartBadge');
        updateNodeBadge();
        updateStoryBadge();
        renderSequence();
        renderSchemaSettings();
        renderDataPanels();
        if (isSettingsOpen) refreshSchemaChoices();
        if (isPlaying) updatePlayNav();
        if (pdfDialogEl.open) updatePdfDialogState();
    } catch (e) {
        console.warn('[Story] Failed to reload localization:', e);
    }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

// The story's key decides where the exports are written and the folder a slide's relative images resolve
// against, so it is always held in its full project: form.
function setResourceKey(key) {
    const ROOT_PREFIX = 'project:';
    resourceKey = key.startsWith(ROOT_PREFIX) ? key : ROOT_PREFIX + key;
}

// A rename or move keeps the document open in this editor, which would otherwise go on using the key it
// opened with. The exports read the key when they run, so only the slides on screen need drawing again, to
// pick up images from the new folder.
function onRenamed(metadata) {
    if (!metadata?.resourceKey) return;

    setResourceKey(metadata.resourceKey);
    renderPreview();
    if (isPlaying && getNode(playingName)) {
        navigateTo(playingName);
    }
}

async function init() {
    try {
        const result = await celbridge.initialize();
        setResourceKey(result.metadata?.resourceKey ?? '');

        updateToolbarState();
        updateLayout();
        setTextMode(textMode);
        load(result.content);

        // Flush any pending debounce when the host requests a save (panel or
        // file close). The handler is fire-and-forget per DocumentAPI; we do
        // the best-effort flush and rely on the short debounce window to keep
        // worst-case loss small.
        celbridge.document.onRequestSave(() => flushPendingSave());

        // The host sends neither until the content is reported loaded, below.
        celbridge.document.onExternalChange(() => reloadFromDisk());
        celbridge.document.onRenamed(onRenamed);
        celbridge.document.onRequestState(() => saveEditorState());
        celbridge.document.onRestoreState((state) => restoreEditorState(state));

        // Open on the first node in the default sequence, which is where the story starts
        const focal = nodes[0];
        if (focal) {
            centreOn(focal, { animate: false });
        } else {
            render();
        }

        // Signal that the editor has finished loading its content. The host's
        // readiness contract (and the webview devtools surface) wait on this
        // before dispatching against the document.
        celbridge.document.notifyContentLoaded(ContentLoadedReason.Initial);
    } catch (e) {
        console.error('[Story] Init failed:', e);
    }
}

init();
