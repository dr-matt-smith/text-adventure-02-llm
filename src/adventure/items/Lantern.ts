import { Item } from "./Item.ts";

// Lantern - an Item that gives light, so you can see in a DarkLocation

export class Lantern extends Item {
  constructor() {
    super("lantern", "An old oil lantern. It still burns brightly.");
  }

  public override givesLight(): boolean {
    return true;
  }
}
