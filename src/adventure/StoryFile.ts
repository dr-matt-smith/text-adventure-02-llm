import type { Adventure } from "./Adventure.ts";
import type { Command } from "./commands/Command.ts";
import { Direction } from "./Direction.ts";
import type { Story } from "./stories/Story.ts";
import { type ItemData, World, type WorldData } from "./World.ts";
import adventureSchema from "../data/adventure.schema.json" with { type: "json" };

// StoryFile - reads an adventure written in the Story Builder (a .story file in src/data/)
//
// A .story file is JSON: a list of nodes, each with a name and some Markdown text. One node is one
// location. Its TEXT is what the player reads:
//
//     # Farmhouse                              <- the location's name
//
//     You are in the farmhouse kitchen...      <- first visit
//
//     The kitchen smells of toast...           <- later visits: one of these, at random
//
//     [South](Farmyard)                        <- the exits: a direction, and the node it leads to
//
// Everything else the game needs is in the node's "data" (see src/data/adventure.schema.json):
// where it goes on the mini map, the items lying there, and what you see in the dark. The story's
// own "data" holds the words on screen: title, intro, end messages...
//
// This turns all of that into the WorldData the World class builds itself from, so the World,
// Location and the items don't know or care where their data came from.

// ---- The shape of a .story file (only the parts the game reads) ----

interface StoryNode {
  name: string;
  text: string;
  data?: { adventure?: NodeData };
}

interface NodeData {
  mapCol?: number;
  mapRow?: number;
  dark?: string;
  items?: ItemData[];
}

interface StoryData {
  start?: string;
  title?: string;
  blurb?: string;
  intro?: string;
  meterName?: string;
  runOutMessage?: string;
  wonTitle?: string;
  lostTitle?: string;
  wonMessage?: string;
  lostMessage?: string;
}

interface StoryFileData {
  nodes: StoryNode[];
  data?: { adventure?: StoryData };
}

// The parts of a Story that are code, not words: they stay in Farm.ts and Stranded.ts
export interface StoryCode {
  commands: Command[];
  checkForWin(adventure: Adventure): string | null;
}

// a link: [text](target) - the target may be written <like this> when it has spaces in it
const LINK = /\[([^\]]+)\]\(<?([^)>]+)>?\)/g;

// ---- Reading the file ----

// A whole Story: the world from the nodes, the words from the story's data, and the code given.
// `fileText` is the .story file exactly as written (Farm.ts and Stranded.ts import it as text).
// `fileName` is only used in error messages, so a mistake in the story says where it is.
export function readStory(fileText: string, fileName: string, code: StoryCode): Story {
  let story: StoryFileData;
  try {
    story = JSON.parse(fileText);
  } catch (e) {
    throw new Error(`${fileName} is not valid JSON: ${(e as Error).message}`);
  }
  const words: StoryData = story.data?.adventure ?? {};
  const text = (key: keyof StoryData): string => {
    const value = words[key];
    if (typeof value !== "string" || value === "") {
      throw new Error(`${fileName}: the story has no "${key}" (in its adventure data)`);
    }
    return value;
  };

  // The world is built here once, only to check it: a mistake in it (an item with no name, say) then stops the
  // game loading with the story's name, rather than when a game starts. Each game builds its own.
  const world = readWorld(story, fileName);
  try {
    new World(world);
  } catch (e) {
    throw new Error(`${fileName}: ${(e as Error).message}`);
  }

  const wonMessage = text("wonMessage");
  const lostMessage = text("lostMessage");
  return {
    title: text("title"),
    blurb: text("blurb"),
    intro: text("intro"),
    world,
    meterName: text("meterName"),
    runOutMessage: text("runOutMessage"),
    wonTitle: text("wonTitle"),
    lostTitle: text("lostTitle"),
    wonMessage: (moves) => wonMessage.replaceAll("{moves}", String(moves)),
    lostMessage: (moves) => lostMessage.replaceAll("{moves}", String(moves)),
    commands: code.commands,
    checkForWin: code.checkForWin,
  };
}

// The mini map's columns and rows: the choices the Story Builder offers for mapCol and mapRow. They are only
// written down in the schema, so making the map bigger (see src/ui/MiniMap.ts) means adding choices there.
const MAP_COLUMNS = mapChoices("mapCol");
const MAP_ROWS = mapChoices("mapRow");

function mapChoices(key: string): number[] {
  const fields: { key: string; options?: unknown[] }[] = adventureSchema.node;
  const options = fields.find((field) => field.key === key)?.options;
  if (!options || !options.every(Number.isInteger)) {
    throw new Error(`adventure.schema.json: the "${key}" field needs a list of whole number "options"`);
  }
  return options as number[];
}

// A location's column or row must be one the mini map has, or it would be drawn off the map, or between its
// neighbours where its exits can't reach it.
function checkMapPosition(value: unknown, choices: number[], what: string, where: string): void {
  if (!choices.includes(value as number)) {
    throw new Error(`${where}: its ${what} must be one of ${choices.join(", ")}, not ${JSON.stringify(value)}`);
  }
}

// The locations, the exits between them, and where the player starts.
export function readWorld(story: StoryFileData, fileName: string): WorldData {
  if (!Array.isArray(story.nodes) || story.nodes.length === 0) {
    throw new Error(`${fileName}: the story has no nodes`);
  }
  const names = new Set(story.nodes.map((node) => node.name));

  const start = story.data?.adventure?.start;
  if (start === undefined || !names.has(start)) {
    throw new Error(`${fileName}: the start location "${start ?? ""}" is not a node in the story`);
  }

  const world: WorldData = { start, locations: [], connections: [] };
  const exits = new Map<string, string>();    // "Farmhouse south" -> "Farmyard", to check both ends agree

  for (const node of story.nodes) {
    const where = `${fileName}, node "${node.name}"`;
    const page = readText(node, where);
    const data: NodeData = node.data?.adventure ?? {};

    if (data.mapCol === undefined || data.mapRow === undefined) {
      throw new Error(`${where}: it needs a mini map column and row (mapCol and mapRow)`);
    }
    checkMapPosition(data.mapCol, MAP_COLUMNS, "mini map column (mapCol)", where);
    checkMapPosition(data.mapRow, MAP_ROWS, "mini map row (mapRow)", where);

    world.locations.push({
      id: node.name,
      name: page.name ?? node.name,
      mapCol: data.mapCol!,
      mapRow: data.mapRow!,
      descriptions: page.descriptions,
      darkDescription: data.dark,
      items: data.items,
    });

    for (const exit of page.exits) {
      if (!names.has(exit.to)) {
        throw new Error(`${where}: the ${exit.direction} exit leads to "${exit.to}", which is not a node`);
      }
      exits.set(`${node.name} ${exit.direction.name}`, exit.to);
      world.connections.push({ from: node.name, direction: exit.direction.name, to: exit.to });
    }
  }

  // An exit always works both ways (Location.connect), so if the Farmhouse's south exit leads to
  // the Farmyard, the Farmyard's north exit - if it has one - must lead back to the Farmhouse.
  for (const { from, direction, to } of world.connections) {
    const back = Direction.fromWord(direction)!.opposite();
    const otherWay = exits.get(`${to} ${back.name}`);
    if (otherWay !== undefined && otherWay !== from) {
      throw new Error(
        `${fileName}: "${from}" goes ${direction} to "${to}", but "${to}" goes ${back.name} to "${otherWay}", not back to "${from}"`,
      );
    }
  }
  return world;
}

// ---- Reading a node's text ----

interface Exit {
  direction: Direction;
  to: string;
}

interface Page {
  name: string | null;
  descriptions: string[];
  exits: Exit[];
}

// Splits a node's text into its name (the # heading), its descriptions (the other paragraphs) and its
// exits (the paragraph that is only links).
function readText(node: StoryNode, where: string): Page {
  const text = (node.text ?? "").replace(/<!--[\s\S]*?-->/g, "");    // comments: Marp's directives
  if (/^\s*---\s*$/m.test(text)) {
    throw new Error(`${where}: a location is one slide, so its text can't contain ---`);
  }

  const page: Page = { name: null, descriptions: [], exits: [] };
  const paragraphs = text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter((paragraph) => paragraph !== "");

  for (let paragraph of paragraphs) {
    // a heading can sit straight above its text, with no blank line between them
    const heading = /^#{1,6}\s+(.*)(\n|$)/.exec(paragraph);
    if (heading) {
      page.name ??= plainText(heading[1]);
      paragraph = paragraph.slice(heading[0].length).trim();
    }

    if (paragraph === "") {
      continue;
    } else if (isLinksOnly(paragraph)) {
      page.exits.push(...readExits(paragraph, where));
    } else {
      page.descriptions.push(plainText(paragraph.replace(/\s*\n\s*/g, " ")));
    }
  }

  if (page.descriptions.length === 0) {
    throw new Error(`${where}: it has no description (a paragraph of text)`);
  }
  return page;
}

// "[South](Farmyard) · [West](Barn)": links, with nothing but separators between them
function isLinksOnly(paragraph: string): boolean {
  return paragraph.match(LINK) !== null && paragraph.replace(LINK, "").replace(/[\s·•|,\-–—]/g, "") === "";
}

function readExits(paragraph: string, where: string): Exit[] {
  return [...paragraph.matchAll(LINK)].map(([, label, target]) => {
    const direction = Direction.fromWord(label.trim().toLowerCase());
    if (direction === null) {
      throw new Error(`${where}: the exit [${label}](${target}) needs a direction (north, south, east or west) as its text`);
    }
    return { direction, to: target.trim() };
  });
}

// The terminal shows plain text: a link shows as its words, and **bold**, _italic_ and `code`
// lose their markers.
function plainText(markdown: string): string {
  return markdown
    .replace(LINK, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\b_(.+?)_\b/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
}
