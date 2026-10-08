import type { Adventure } from "../Adventure.ts";
import type { Command } from "../commands/Command.ts";
import type { WorldData } from "../World.ts";

// Story - everything that makes one adventure different from another
//
// The engine (Adventure, Player, World, the commands...) is the same for every game. A Story
// plugs in the parts that change: the world, the words on screen, any extra commands, and how
// you win. It is an INTERFACE - like a Java interface, it says what a story must have, and each
// story (Stranded, Farm) is an object that has all of it.
//
// To add another adventure: write a .story file in src/data/ with the Story Builder (using the
// adventure schema, src/data/adventure.schema.json), a Story next to this file that reads it with
// readStory (see Farm.ts), and add it to the list in stories.ts.

export interface Story {
  title: string;               // big, on the start screen: "STRANDED"
  blurb: string;               // under the title on the start screen
  intro: string;               // the first thing printed when the game starts
  world: WorldData;            // the locations, exits and items

  meterName: string;           // what the clock is called: "OXYGEN", "DAYLIGHT"
  runOutMessage: string;       // printed when the clock reaches 0

  wonTitle: string;            // the end screen
  lostTitle: string;
  wonMessage(moves: number): string;
  lostMessage(moves: number): string;

  commands: Command[];         // the commands only this story has (LOOK, GO, TAKE... are in every story)

  // Called after every command. Returns the winning message once the goal is reached, or null.
  checkForWin(adventure: Adventure): string | null;
}
