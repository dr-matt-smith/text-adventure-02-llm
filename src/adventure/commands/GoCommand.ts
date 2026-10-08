import type { Adventure } from "../Adventure.ts";
import { Direction } from "../Direction.ts";
import { Command } from "./Command.ts";

// GoCommand - walk to the next location. "go north", "north" and "n" all work: if the verb is
// itself a direction, use it; otherwise the direction is the noun.

export class GoCommand extends Command {
  constructor() {
    const words = ["go"];
    for (const direction of Direction.ALL) {
      words.push(direction.name, direction.letter);
    }
    super(words, "NORTH, SOUTH, EAST, WEST (or N, S, E, W) - walk that way");
  }

  public override execute(adventure: Adventure, verb: string, noun: string): string {
    const direction = Direction.fromWord(verb) ?? Direction.fromWord(noun);
    if (direction === null) {
      return "Go where? Try NORTH, SOUTH, EAST or WEST.";
    }

    const player = adventure.getPlayer();
    const next = player.getLocation().getExit(direction);
    if (next === null) {
      return `Sorry - there is no exit to the ${direction}.`;
    }

    player.moveTo(next);
    return `You walk ${direction}.\n\n` + next.describe(player);
  }
}
