import type { Adventure } from "../Adventure.ts";

// Command - one thing the player can type, like "take" or "look"
//
// This is the COMMAND PATTERN. Instead of one enormous switch statement (as in the Unity
// version's MyGameManager), every command is its own small class with an execute() method. To add
// a new command you write a new subclass and add one line to the list in Adventure - nothing else
// has to change.
//
// A command can answer to several words: TakeCommand answers to "take", "get" and "pickup".

export abstract class Command {
  private readonly words: string[];
  private readonly help: string;

  constructor(words: string[], help: string) {
    this.words = words;
    this.help = help;
  }

  public getWords(): string[] {
    return this.words;
  }

  public getHelp(): string {
    return this.help;
  }

  // Do the command and return what to tell the player.
  //   verb - the word the player typed for it ("get")
  //   noun - everything after it ("power cell"), or "" if there was nothing
  public abstract execute(adventure: Adventure, verb: string, noun: string): string;
}
