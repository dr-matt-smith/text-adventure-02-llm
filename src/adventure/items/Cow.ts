import { Item } from "./Item.ts";

// Cow - Bessie. You can't exactly carry a cow, so TAKE and DROP say something different:
// taking her means leading her by the halter, and she follows you wherever you go.

export class Cow extends Item {
  constructor() {
    super("cow", "Bessie, your best milker. She gazes at you and chews.");
  }

  public override onTake(): string {
    return "You take Bessie by her halter. She plods along behind you.";
  }

  public override onDrop(): string {
    return "You let go of Bessie's halter. She starts munching the grass.";
  }
}
