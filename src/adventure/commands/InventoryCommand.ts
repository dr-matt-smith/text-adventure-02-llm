import type { Adventure } from "../Adventure.ts";
import { Command } from "./Command.ts";

// InventoryCommand - list what you are carrying

export class InventoryCommand extends Command {
  constructor() {
    super(["inventory", "inv", "i"], "INVENTORY (or I) - list what you are carrying");
  }

  public override execute(adventure: Adventure): string {
    const items = adventure.getPlayer().getInventory();
    if (items.length === 0) {
      return "You are not carrying anything.";
    }
    return `You are carrying: ${items.join(", ")}.`;
  }
}
