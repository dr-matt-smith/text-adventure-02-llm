import type { Adventure } from "../Adventure.ts";
import { Command } from "./Command.ts";

// DropCommand - put down an item you are carrying

export class DropCommand extends Command {
  constructor() {
    super(["drop"], "DROP <item> - put something down");
  }

  public override execute(adventure: Adventure, _verb: string, noun: string): string {
    if (noun === "") {
      return "Drop what?";
    }
    const player = adventure.getPlayer();
    const item = player.findItem(noun);
    if (item === null) {
      return `You are not carrying a ${noun}.`;
    }

    player.removeItem(item);
    player.getLocation().addItem(item);
    return item.onDrop(player);    // most items just say "You drop the ..." - some say more
  }
}
