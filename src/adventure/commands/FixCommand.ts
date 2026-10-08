import type { Adventure } from "../Adventure.ts";
import { Command } from "./Command.ts";

// FixCommand - mend something that's broken. Like CloseCommand, it asks the item what happens:
// only a Trough is broken, and it decides for itself whether you have the right tool.

export class FixCommand extends Command {
  constructor() {
    super(["fix", "repair", "mend"], "FIX <thing> - mend something that's broken");
  }

  public override execute(adventure: Adventure, _verb: string, noun: string): string {
    if (noun === "") {
      return "Fix what?";
    }
    const player = adventure.getPlayer();
    const item = player.getLocation().findItem(noun, player) ?? player.findItem(noun);
    if (item === null) {
      return `You can't see a ${noun} here.`;
    }
    return item.fix(player);
  }
}
