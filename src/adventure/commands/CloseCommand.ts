import type { Adventure } from "../Adventure.ts";
import { Command } from "./Command.ts";

// CloseCommand - close something, like a gate. The command doesn't know what can be closed: it
// asks the item, and only a Gate says yes.

export class CloseCommand extends Command {
  constructor() {
    super(["close", "shut"], "CLOSE <thing> - close something, like a gate");
  }

  public override execute(adventure: Adventure, _verb: string, noun: string): string {
    if (noun === "") {
      return "Close what?";
    }
    const player = adventure.getPlayer();
    const item = player.getLocation().findItem(noun, player) ?? player.findItem(noun);
    if (item === null) {
      return `You can't see a ${noun} here.`;
    }
    return item.close(player);
  }
}
