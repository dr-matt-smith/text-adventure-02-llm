import type { Adventure } from "../Adventure.ts";
import { Command } from "./Command.ts";

// ExamineCommand - look closely at an item, whether you are carrying it or it is lying here

export class ExamineCommand extends Command {
  constructor() {
    super(["examine", "x", "inspect"], "EXAMINE <item> - look closely at something");
  }

  public override execute(adventure: Adventure, _verb: string, noun: string): string {
    if (noun === "") {
      return "Examine what?";
    }
    const player = adventure.getPlayer();
    const item = player.findItem(noun) ?? player.getLocation().findItem(noun, player);
    if (item === null) {
      return `You can't see a ${noun} here.`;
    }
    return item.getDescription();
  }
}
