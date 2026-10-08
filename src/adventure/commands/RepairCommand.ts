import type { Adventure } from "../Adventure.ts";
import { Command } from "./Command.ts";

// RepairCommand - fix the ship and win, if you are in it with the right things (Stranded only)

const NEEDED = ["wrench", "power cell"];

export class RepairCommand extends Command {
  constructor() {
    super(["repair", "fix"], "REPAIR - try to fix your ship");
  }

  public override execute(adventure: Adventure): string {
    const player = adventure.getPlayer();
    if (player.getLocation() !== adventure.getWorld().getLocation("Ship")) {
      return "There is nothing to repair here. Your ship is what needs fixing.";
    }

    const missing = NEEDED.filter((name) => player.findItem(name) === null);
    if (missing.length > 0) {
      return `You can't repair the ship yet. You still need: ${missing.join(", ")}.`;
    }

    adventure.win();
    return "You slot the power cell into place and tighten the panel with the wrench. " +
      "The engine coughs, then roars into life!\n\nYou blast off into the stars. YOU ESCAPED!";
  }
}
