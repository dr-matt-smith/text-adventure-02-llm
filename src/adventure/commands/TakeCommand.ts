import type { Adventure } from "../Adventure.ts";
import { Command } from "./Command.ts";

// TakeCommand - pick up an item from where you are

export class TakeCommand extends Command {
  constructor() {
    super(["take", "get", "pickup"], "TAKE <item> - pick something up");
  }

  public override execute(adventure: Adventure, _verb: string, noun: string): string {
    if (noun === "") {
      return "Take what?";
    }
    const player = adventure.getPlayer();
    const location = player.getLocation();
    const item = location.findItem(noun, player);
    if (item === null) {
      return `You can't see a ${noun} here.`;
    }
    if (!item.canBeTaken()) {
      return `You can't carry the ${item.getName()} - it won't budge.`;
    }

    location.removeItem(item);
    player.addItem(item);
    return item.onTake(player);    // most items just say "You pick up the ..." - some do more
  }
}
