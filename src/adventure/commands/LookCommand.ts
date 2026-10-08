import type { Adventure } from "../Adventure.ts";
import { Command } from "./Command.ts";

// LookCommand - describe where you are

export class LookCommand extends Command {
  constructor() {
    super(["look", "l"], "LOOK - describe where you are");
  }

  public override execute(adventure: Adventure): string {
    const player = adventure.getPlayer();
    return player.getLocation().describe(player);
  }
}
