import type { Command } from "./commands/Command.ts";

// CommandParser - turns what the player typed into a command and a noun
//
//     "  TAKE   the Power  Cell "  ->  verb "take", noun "power cell", command: the TakeCommand
//
// It does the three TODOs left in the Unity version's parser: lower case, trim the ends, and
// squash several spaces into one. It also ignores little words like "the" and "a".

export interface ParsedInput {
  verb: string;
  noun: string;
  command: Command | null;         // null if no command answers to the verb
}

const IGNORED_WORDS = ["the", "a", "an", "to", "at"];

export class CommandParser {
  private readonly commands: Command[];
  private readonly commandsByWord = new Map<string, Command>();

  constructor(commands: Command[]) {
    this.commands = commands;
    for (const command of commands) {
      for (const word of command.getWords()) {
        this.commandsByWord.set(word, command);
      }
    }
  }

  public getCommands(): Command[] {
    return this.commands;
  }

  public parse(text: string): ParsedInput {
    const words = CommandParser.normalise(text)
      .split(" ")
      .filter((word) => word !== "" && !IGNORED_WORDS.includes(word));

    const verb = words[0] ?? "";
    const noun = words.slice(1).join(" ");
    const command = this.commandsByWord.get(verb) ?? null;
    return { verb, noun, command };
  }

  // a STATIC method: it belongs to the class, not to any one parser, like Java's static methods
  public static normalise(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, " ");
  }
}
