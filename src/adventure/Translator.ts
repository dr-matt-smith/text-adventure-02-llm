import type { Adventure } from "./Adventure.ts";
import { Direction } from "./Direction.ts";
import type { Location } from "./Location.ts";

// Translator - lets the player type in their own words, using an LLM (see README_LLM_design.md)
//
// It sends the LLM what the player typed, and gets back exactly ONE of:
//   - a COMMAND, for where the player is now:           "pick up the lamp"  ->  take lantern
//   - an ANSWER, from what the player has already seen: "where was the cow?" ->  "In the Meadow."
// Then the game waits for the player again. It never does two commands, so a player can never be
// moved more than one place at a time.
//
// The LLM is told the commands (from each Command's own help text, so a new command is included
// without changing this class), where the player is, what they carry, what they remember of each
// place they've been (the Memory), and the way back to each of them - worked out here, because an
// LLM is bad at finding its way round a map, and code is good at it.
//
// Its reply must fit a JSON Schema: room for one command only, whose verb must be one of the game's
// own command words. Then the code checks the command again before the game sees it - the LLM only
// suggests, the game still decides.
//
// The Translator doesn't know HOW to reach an LLM: it is given a function that does (an AskLlm).
// The game gives it one that talks to LM Studio (see src/llm/), and the tests give it a fake one -
// so the tests need no LLM, just as they need no browser. This is DEPENDENCY INJECTION.

// What the Translator asks an LLM: instructions, the question, and the shape the answer must have.
export interface LlmRequest {
  system: string;
  user: string;
  schema: Record<string, unknown>;   // a JSON Schema for the reply
}

// Any function that sends an LlmRequest to an LLM and returns its reply as text.
export type AskLlm = (request: LlmRequest) => Promise<string>;

// What the LLM decided: one command for the game, or an answer for the player.
export type Translation =
  | { kind: "command"; command: string }
  | { kind: "answer"; answer: string };

// The shape the LLM's reply must have:
//     {"kind": "command", "verb": "take", "noun": "lantern", "answer": ""}
//     {"kind": "answer",  "verb": "",     "noun": "",        "answer": "You saw the cow in the Meadow."}
// "kind" comes first, so the LLM decides whether to act or to answer before anything else. The verb
// must be one of `verbs` - the words the game's commands answer to - or "" for an answer.
function replySchema(verbs: string[]): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["command", "answer"] },
      verb: { type: "string", enum: [...verbs, ""] },
      noun: { type: "string" },
      answer: { type: "string" },
    },
    required: ["kind", "verb", "noun", "answer"],
  };
}

export class Translator {
  private readonly ask: AskLlm;

  constructor(ask: AskLlm) {
    this.ask = ask;
  }

  // Does `text` need the LLM? Not if it is already a plain command: a verb the game knows, with no
  // noun ("look"), a direction ("go north") or something the player can see or carry ("take cell").
  // "go back to the ship" starts with a real verb, but "back ship" is none of those - so it does.
  public static needsTranslating(adventure: Adventure, text: string): boolean {
    const { command, noun } = adventure.parse(text);
    if (command === null) {
      return true;
    }
    if (noun === "" || Direction.fromWord(noun) !== null) {
      return false;
    }
    const player = adventure.getPlayer();
    return player.findItem(noun) === null && player.getLocation().findItem(noun, player) === null;
  }

  // Ask the LLM what the player meant. Returns null if its reply can't be used - then the player's
  // own text should go to the game as it is.
  public async translate(adventure: Adventure, text: string): Promise<Translation | null> {
    const verbs = adventure.getCommands().flatMap((command) => command.getWords());
    const reply = await this.ask({
      system: this.instructions(adventure),
      user: this.question(adventure, text),
      schema: replySchema(verbs),
    });
    const translation = Translator.readReply(reply);
    if (translation?.kind === "command" && !Translator.isSingleCommand(adventure, translation.command)) {
      return null;
    }
    return translation;
  }

  // Is `command` one command the game knows - and if it moves the player, just ONE step?
  //     "north", "n", "go north", "take lantern"  yes
  //     "dance", "north east", "go back to the ship"  no
  public static isSingleCommand(adventure: Adventure, command: string): boolean {
    const { verb, noun } = adventure.parse(command);
    if (!adventure.understands(command)) {
      return false;
    }
    if (Direction.fromWord(verb) !== null) {
      return noun === "";                              // "north" - not "north east"
    }
    if (verb === "go") {
      return Direction.fromWord(noun) !== null;        // "go north" - not "go back to the ship"
    }
    return true;
  }

  // What the LLM is told every time: its job, and the commands it can use.
  public instructions(adventure: Adventure): string {
    const commands = adventure.getCommands().map((command) => "  " + command.getHelp());
    return [
      "You help the player of a text adventure. Each time they type something, you do ONE of these:",
      "1. Turn it into ONE command for the game, to do now, where the player is.",
      "2. Or, if they ask a question, answer it in a sentence or two, from what they remember.",
      "",
      "The game only understands these commands:",
      ...commands,
      "",
      "Rules:",
      "- Reply as JSON. A command:  {\"kind\": \"command\", \"verb\": \"take\", \"noun\": \"lantern\", \"answer\": \"\"}",
      "  (noun is \"\" for a command without one, like north or inventory)",
      "  An answer:  {\"kind\": \"answer\", \"verb\": \"\", \"noun\": \"\", \"answer\": \"You saw the cow in the Meadow.\"}",
      "- Only ONE command. If they ask for several things, choose the one to do first.",
      "- A command can move the player ONE place only. If they want to go somewhere further away, answer",
      "  with the way to get there (from \"The way to places you've been\") - don't move them.",
      "- Use item names exactly as the game shows them. Only take or examine items listed after",
      "  \"You can see:\" where the player is now, or that they are carrying.",
      "- Answer only from what the player remembers. If they haven't seen it, say you don't know.",
      "- Only use QUIT if the player clearly wants to stop playing.",
      "",
      "Examples:",
      "  \"pick up the lamp\" (a lantern is here) -> command: take lantern",
      "  \"what have I got?\" -> command: inventory",
      "  \"grab the lamp and go north\" -> command: take lantern",
      "  \"where was the cow?\" -> answer: You saw the cow in the Meadow.",
      "  \"how do I get back to the ship?\" -> answer: Go east, then north.",
      "  \"go back to the ship\" (two places away) -> answer: The ship is east, then north - type each step.",
      "  \"what did the field look like?\" -> answer: the Field's description, from what they remember",
    ].join("\n");
  }

  // What the LLM is asked: where the player is, what they carry, what they remember, the way to
  // each place, and what they typed.
  public question(adventure: Adventure, text: string): string {
    const player = adventure.getPlayer();
    const here = player.getLocation();
    const carrying = player.getInventory().join(", ") || "nothing";
    const memory = adventure.getMemory();
    const remembered = memory.getPlaces()
      .filter((place) => place !== here)
      .map((place) => memory.recall(place)!);

    return [
      "Where the player is now:",
      here.describe(player),
      "",
      `Carrying: ${carrying}`,
      "",
      "What the player remembers of the other places they have been (as they last saw them):",
      ...(remembered.length === 0 ? ["(nowhere else yet)"] : remembered.flatMap((seen) => [seen, ""])),
      "",
      "The way to places you've been, from here:",
      ...this.routes(adventure),
      "",
      `The player typed: ${text}`,
    ].join("\n");
  }

  // One line for each place the player has been, with the directions from here:
  //     Ship: east, north
  // It searches outwards from the player, one step at a time, through places they have been (a
  // BREADTH-FIRST SEARCH) - so the first way it finds to each place is the shortest.
  public routes(adventure: Adventure): string[] {
    const here = adventure.getPlayer().getLocation();
    const memory = adventure.getMemory();
    const routes = new Map<Location, string[]>([[here, []]]);
    const toVisit = [here];
    while (toVisit.length > 0) {
      const location = toVisit.shift()!;
      for (const direction of location.getExitDirections()) {
        const there = location.getExit(direction);
        if (there !== null && memory.recall(there) !== null && !routes.has(there)) {
          routes.set(there, [...routes.get(location)!, direction.name]);
          toVisit.push(there);
        }
      }
    }
    return [...routes].map(([location, route]) =>
      `  ${location.getName()}: ${route.length === 0 ? "(you are here)" : route.join(", ")}`
    );
  }

  // Reads the LLM's reply:
  //     {"kind": "command", "verb": "take", "noun": "power cell", ...}  ->  command "take power cell"
  //     {"kind": "answer", ..., "answer": "In the Meadow."}               ->  answer "In the Meadow."
  // LLMs don't always do as they are told, so this copes with extra text around the JSON - and
  // returns null for a reply it can't read.
  public static readReply(reply: string): Translation | null {
    const withoutThinking = reply.replace(/<think>[\s\S]*?<\/think>/g, "");
    const json = withoutThinking.match(/\{[\s\S]*\}/);
    if (json === null) {
      return null;
    }
    try {
      const parsed = JSON.parse(json[0]) as { kind?: unknown; verb?: unknown; noun?: unknown; answer?: unknown };
      if (parsed.kind === "command" && typeof parsed.verb === "string" && parsed.verb.trim() !== "") {
        const noun = typeof parsed.noun === "string" ? parsed.noun : "";
        return { kind: "command", command: (parsed.verb + " " + noun).trim() };
      }
      if (parsed.kind === "answer" && typeof parsed.answer === "string" && parsed.answer.trim() !== "") {
        return { kind: "answer", answer: parsed.answer.trim() };
      }
      return null;
    } catch {
      return null;
    }
  }
}
