import type { Player } from "../Player.ts";
import { Item } from "./Item.ts";

// OxygenTank - an Item that refills the player's oxygen the FIRST time it is picked up.
// After that it is just an empty tank.

export class OxygenTank extends Item {
  private full = true;

  constructor() {
    super("oxygen tank", "A spare oxygen tank, dropped by some earlier traveller.");
  }

  public override getDescription(): string {
    return this.full ? super.getDescription() : "An empty oxygen tank.";
  }

  // super.onTake(player) is "You pick up the oxygen tank." - this adds to it
  public override onTake(player: Player): string {
    const message = super.onTake(player);
    if (!this.full) {
      return message;
    }
    this.full = false;
    player.refillTime();
    return message + " You plug it into your suit - your oxygen is full again!";
  }
}
