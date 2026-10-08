/// <reference lib="deno.ns" />

// Unit tests for the Translator and the Memory. They need no LLM: each test gives the Translator a
// FAKE one - a function that returns a reply we chose, and remembers what it was asked.

import { assertEquals, assertStringIncludes } from "@std/assert";
import { Adventure } from "../src/adventure/Adventure.ts";
import { STRANDED } from "../src/adventure/stories/Stranded.ts";
import { type LlmRequest, Translator } from "../src/adventure/Translator.ts";

// What the LLM replies: one command, or an answer.
function command(verb: string, noun = ""): string {
  return JSON.stringify({ kind: "command", verb, noun, answer: "" });
}
function answer(text: string): string {
  return JSON.stringify({ kind: "answer", verb: "", noun: "", answer: text });
}

// A fake LLM that always gives `reply`, and keeps every request it is sent in `asked`.
function fakeLlm(reply: string) {
  const asked: LlmRequest[] = [];
  const ask = (request: LlmRequest) => {
    asked.push(request);
    return Promise.resolve(reply);
  };
  return { ask, asked };
}

// a game of Stranded, with the player taken through `commands` first
function strandedAfter(...commands: string[]): Adventure {
  const adventure = new Adventure(STRANDED);
  for (const command of commands) {
    adventure.process(command);
  }
  return adventure;
}

// ---- Which text needs the LLM ----

Deno.test("the game knows its own commands, and not other words", () => {
  const adventure = new Adventure(STRANDED);
  assertEquals(adventure.understands("take lantern"), true);
  assertEquals(adventure.understands("  N "), true);
  assertEquals(adventure.understands("grab the lamp"), false);
});

Deno.test("plain commands don't need the LLM, anything else does", () => {
  const adventure = strandedAfter("south", "east", "east");   // to the tavern, where the lantern is
  for (const text of ["look", "i", "go west", "w", "examine lantern", "take lantern", "TAKE the Lantern", "help"]) {
    assertEquals(Translator.needsTranslating(adventure, text), false, text);
  }
  for (const text of ["grab the lamp", "go back to the ship", "take a nap", "look around please"]) {
    assertEquals(Translator.needsTranslating(adventure, text), true, text);
  }
});

// ---- What the LLM is told ----

Deno.test("the LLM is told the commands, where the player is, what they carry, and what they typed", async () => {
  const llm = fakeLlm(answer("Hello!"));
  await new Translator(llm.ask).translate(new Adventure(STRANDED), "hello");

  const request = llm.asked[0];
  assertStringIncludes(request.system, "TAKE <item>");
  assertStringIncludes(request.system, "REPAIR");          // Stranded's own command
  assertStringIncludes(request.user, "== SHIP ==");
  assertStringIncludes(request.user, "Carrying: nothing");
  assertStringIncludes(request.user, "(nowhere else yet)");
  assertStringIncludes(request.user, "The player typed: hello");
});

Deno.test("the LLM is told what the player remembers of the places they've been, and the way back", async () => {
  const llm = fakeLlm(answer("In the forest."));
  await new Translator(llm.ask).translate(strandedAfter("south", "west", "east"), "where was the tank?");

  const user = llm.asked[0].user;
  assertStringIncludes(user, "== OUTSIDE THE SHIP ==");     // where the player is now
  assertStringIncludes(user, "== FOREST ==");               // remembered...
  assertStringIncludes(user, "You can see: oxygen tank.");  // ...with what was there
  assertStringIncludes(user, "Forest: west");               // the way back
  assertStringIncludes(user, "Ship: north");
});

Deno.test("the LLM can only choose the game's own command words", async () => {
  const llm = fakeLlm(answer("Hello!"));
  await new Translator(llm.ask).translate(new Adventure(STRANDED), "hello");

  const schema = llm.asked[0].schema as { properties: { verb: { enum: string[] } } };
  const verbs = schema.properties.verb.enum;
  for (const word of ["take", "get", "n", "north", "repair", "inventory", ""]) {
    assertEquals(verbs.includes(word), true, word);
  }
  assertEquals(verbs.includes("dance"), false);
});

// ---- What the LLM replies ----

Deno.test("a command comes back as one command, and nothing is done yet", async () => {
  const adventure = new Adventure(STRANDED);
  const translation = await new Translator(fakeLlm(command("south")).ask).translate(adventure, "get out");
  assertEquals(translation, { kind: "command", command: "south" });
  assertEquals(adventure.getPlayer().getLocation().getName(), "Ship");    // the game hasn't been told
});

Deno.test("a command with a noun is put back together", async () => {
  const translation = await new Translator(fakeLlm(command("take", "power cell")).ask)
    .translate(new Adventure(STRANDED), "grab the battery");
  assertEquals(translation, { kind: "command", command: "take power cell" });
});

Deno.test("an answer comes back as an answer", async () => {
  const translation = await new Translator(fakeLlm(answer("  In the forest. ")).ask)
    .translate(new Adventure(STRANDED), "where was the tank?");
  assertEquals(translation, { kind: "answer", answer: "In the forest." });
});

Deno.test("a command the game doesn't know is refused", async () => {
  const translation = await new Translator(fakeLlm(command("dance")).ask).translate(new Adventure(STRANDED), "boogie");
  assertEquals(translation, null);
});

Deno.test("a command that would move more than one place is refused", async () => {
  for (const reply of [command("go", "back to ship"), command("north", "east"), command("go")]) {
    const translation = await new Translator(fakeLlm(reply).ask).translate(new Adventure(STRANDED), "go home");
    assertEquals(translation, null, reply);
  }
});

Deno.test("only single commands are allowed", () => {
  const adventure = new Adventure(STRANDED);
  for (const text of ["north", "n", "go north", "go n", "take lantern", "look", "inventory"]) {
    assertEquals(Translator.isSingleCommand(adventure, text), true, text);
  }
  for (const text of ["dance", "north east", "go back to the ship", "go", "n s"]) {
    assertEquals(Translator.isSingleCommand(adventure, text), false, text);
  }
});

Deno.test("the reply is read even with extra text around it", () => {
  assertEquals(Translator.readReply("Sure!\n```json\n" + command("north") + "\n```"), {
    kind: "command",
    command: "north",
  });
  assertEquals(Translator.readReply('<think>hmm {"x": 1}</think>' + answer("Hi")), { kind: "answer", answer: "Hi" });
});

Deno.test("a reply that can't be used gives null", () => {
  assertEquals(Translator.readReply(""), null);
  assertEquals(Translator.readReply("I don't understand."), null);
  assertEquals(Translator.readReply("{not json}"), null);
  assertEquals(Translator.readReply(command("")), null);         // a command with no verb
  assertEquals(Translator.readReply(answer("")), null);          // an empty answer
  assertEquals(Translator.readReply('{"kind": "dance"}'), null);
});

// ---- The way back ----

Deno.test("the way back to each place is the shortest, through places the player has been", () => {
  const adventure = strandedAfter("south", "east", "east");   // ship -> outside -> town -> tavern
  const translator = new Translator(fakeLlm(answer("")).ask);
  assertEquals(translator.routes(adventure), [
    "  Tavern: (you are here)",
    "  Town: west",
    "  Outside the ship: west, west",
    "  Ship: west, west, north",
  ]);
});

// ---- The Memory ----

Deno.test("the memory holds every place seen, as the player last saw it", () => {
  const adventure = strandedAfter("south", "east", "east", "take lantern", "west");
  const memory = adventure.getMemory();
  const tavern = adventure.getWorld().getLocation("Tavern");

  assertEquals(memory.getPlaces().map((place) => place.getName()), ["Ship", "Outside the ship", "Town", "Tavern"]);
  assertStringIncludes(memory.recall(tavern)!, "== TAVERN ==");
  assertEquals(memory.recall(tavern)!.includes("lantern"), false);   // taken before leaving
  assertEquals(memory.recall(adventure.getWorld().getLocation("Forest")), null);   // never been
});

Deno.test("a dark place is remembered as dark", () => {
  const adventure = strandedAfter("south", "south", "north");   // into the cave without a light, and out
  const cave = adventure.getWorld().getLocation("Cave");
  assertStringIncludes(adventure.process("look"), "OUTSIDE");
  assertEquals(adventure.getMemory().recall(cave)!.includes("power cell"), false);
});
