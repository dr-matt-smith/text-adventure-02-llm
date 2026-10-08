/// <reference lib="deno.ns" />

// Unit tests for the adventure - like JUnit tests in Java. Run them with:  deno task test
//
// They need no browser and no Phaser, because the adventure/ folder doesn't use Phaser at all.

import { assert, assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { Adventure, GameState } from "../src/adventure/Adventure.ts";
import { CommandParser } from "../src/adventure/CommandParser.ts";
import { Direction } from "../src/adventure/Direction.ts";
import { FARM } from "../src/adventure/stories/Farm.ts";
import { STRANDED } from "../src/adventure/stories/Stranded.ts";
import { readStory } from "../src/adventure/StoryFile.ts";
import strandedFile from "../src/data/stranded.story" with { type: "text" };

// type each command in turn, and return the last reply
function play(adventure: Adventure, ...commands: string[]): string {
  let reply = "";
  for (const command of commands) {
    reply = adventure.process(command);
  }
  return reply;
}

Deno.test("normalise lower-cases, trims and squashes spaces", () => {
  assertEquals(CommandParser.normalise("  TAKE   Power  Cell "), "take power cell");
});

Deno.test("direction opposites", () => {
  assertEquals(Direction.NORTH.opposite(), Direction.SOUTH);
  assertEquals(Direction.EAST.opposite(), Direction.WEST);
  assertEquals(Direction.fromWord("w"), Direction.WEST);
  assertEquals(Direction.fromWord("up"), null);
});

Deno.test("the game starts in the ship", () => {
  const adventure = new Adventure(STRANDED);
  assertEquals(adventure.getPlayer().getLocation().getName(), "Ship");
});

Deno.test("n, north and go north all move the same way", () => {
  for (const command of ["s", "south", "go south"]) {
    const adventure = new Adventure(STRANDED);
    play(adventure, command);
    assertEquals(adventure.getPlayer().getLocation().getName(), "Outside the ship");
  }
});

Deno.test("you can't walk through walls", () => {
  const adventure = new Adventure(STRANDED);
  assertStringIncludes(play(adventure, "north"), "no exit");
  assertEquals(adventure.getPlayer().getMoves(), 0);
});

Deno.test("an unknown word is reported", () => {
  assertStringIncludes(new Adventure(STRANDED).process("dance"), "don't know");
});

Deno.test("the cave is dark until you carry the lantern", () => {
  const adventure = new Adventure(STRANDED);
  assertStringIncludes(play(adventure, "s", "s"), "pitch black");
  assertStringIncludes(play(adventure, "take cell"), "can't see");

  play(adventure, "n", "e", "e", "take lantern", "w", "w", "s");
  assertStringIncludes(play(adventure, "take the power cell"), "pick up the power cell");
});

Deno.test("the oxygen tank refills your oxygen once", () => {
  const adventure = new Adventure(STRANDED);
  play(adventure, "s", "w");
  assert(adventure.getPlayer().getTimeLeft() < 100);
  play(adventure, "take tank");
  assertEquals(adventure.getPlayer().getTimeLeft(), 100);
  play(adventure, "drop tank", "take tank");
  assertStringIncludes(play(adventure, "examine tank"), "empty");
});

Deno.test("you can't repair the ship without the parts", () => {
  const adventure = new Adventure(STRANDED);
  assertStringIncludes(play(adventure, "repair"), "still need: wrench, power cell");
  assertEquals(adventure.getState(), GameState.Playing);
});

Deno.test("the whole game can be won", () => {
  const adventure = new Adventure(STRANDED);
  play(
    adventure,
    "s", "e", "e", "take lantern",       // tavern
    "w", "s", "take wrench",             // scrapyard
    "n", "w", "s", "take cell",          // cave
    "n", "n",                            // back to the ship
  );
  assertStringIncludes(play(adventure, "repair"), "YOU ESCAPED");
  assertEquals(adventure.getState(), GameState.Won);
});

Deno.test("running out of oxygen loses the game", () => {
  const adventure = new Adventure(STRANDED);
  for (let i = 0; i < 20 && !adventure.isOver(); i++) {
    play(adventure, i % 2 === 0 ? "s" : "n");
  }
  assertEquals(adventure.getState(), GameState.Lost);
});

// ---- Down on the Farm ----

Deno.test("the farm starts in the farmhouse", () => {
  const adventure = new Adventure(FARM);
  assertEquals(adventure.getPlayer().getLocation().getName(), "Farmhouse");
});

Deno.test("the barn is dark until you carry the lantern", () => {
  const adventure = new Adventure(FARM);
  assertStringIncludes(play(adventure, "s", "w"), "pitch black");
  assertStringIncludes(play(adventure, "take wrench"), "can't see");

  play(adventure, "e", "n", "take lantern", "s", "w");
  assertStringIncludes(play(adventure, "take wrench"), "pick up the wrench");
});

Deno.test("the gate and the trough can't be carried", () => {
  const adventure = new Adventure(FARM);
  play(adventure, "s", "s");
  assertStringIncludes(play(adventure, "take gate"), "won't budge");
  assertStringIncludes(play(adventure, "take trough"), "won't budge");
});

Deno.test("the trough needs a wrench to fix it", () => {
  const adventure = new Adventure(FARM);
  play(adventure, "s", "s");
  assertStringIncludes(play(adventure, "fix trough"), "need a wrench");
  assertStringIncludes(play(adventure, "examine trough"), "leaking");
});

Deno.test("the farm isn't done until all three jobs are", () => {
  const adventure = new Adventure(FARM);
  play(
    adventure,
    "take lantern", "s", "w", "take wrench",   // barn
    "e", "s", "fix trough", "close gate",      // field - but no cow yet
  );
  assertEquals(adventure.getState(), GameState.Playing);
  assertStringIncludes(play(adventure, "examine gate"), "shut");
});

Deno.test("the whole farm game can be won", () => {
  const adventure = new Adventure(FARM);
  play(
    adventure,
    "take lantern", "s", "w", "take wrench",   // barn
    "e", "e", "e", "take cow",                 // meadow
    "w", "w", "s", "drop cow",                 // field
    "close gate",
  );
  assertEquals(adventure.getState(), GameState.Playing);
  assertStringIncludes(play(adventure, "fix trough"), "ALL JOBS DONE");
  assertEquals(adventure.getState(), GameState.Won);
});

Deno.test("running out of daylight loses the farm game", () => {
  const adventure = new Adventure(FARM);
  let reply = "";
  for (let i = 0; i < 20 && !adventure.isOver(); i++) {
    reply = play(adventure, i % 2 === 0 ? "s" : "n");
  }
  assertEquals(adventure.getState(), GameState.Lost);
  assertStringIncludes(reply, "sun sinks");
});

// ---- Reading a story file ----

// stranded.story, with one change made to its Ship node's adventure data
function strandedWithShip(change: Record<string, unknown>): string {
  const story = JSON.parse(strandedFile);
  const ship = story.nodes.find((node: { name: string }) => node.name === "Ship");
  Object.assign(ship.data.adventure, change);
  return JSON.stringify(story);
}

function read(text: string) {
  return readStory(text, "test.story", { commands: [], checkForWin: () => null });
}

Deno.test("a location must be on the mini map", () => {
  read(strandedWithShip({ mapCol: 3, mapRow: 2 }));     // the far corner is fine
  assertThrows(() => read(strandedWithShip({ mapCol: 4 })), Error, "mini map column (mapCol) must be one of 0, 1, 2, 3");
  assertThrows(() => read(strandedWithShip({ mapRow: -1 })), Error, "mini map row (mapRow) must be one of 0, 1, 2");
  assertThrows(() => read(strandedWithShip({ mapCol: 1.5 })), Error, "not 1.5");
  assertThrows(() => read(strandedWithShip({ mapRow: "1" })), Error, "mini map row");
});

Deno.test("a mistake in an item names the story and the node it is in", () => {
  assertThrows(
    () => read(strandedWithShip({ items: [{}] })), Error,
    'test.story: world data, location "Ship": an item needs a name and a description (or a type)',
  );
  assertThrows(() => read(strandedWithShip({ items: [{ type: "dragon" }] })), Error, 'location "Ship": unknown item type "dragon"');
});
