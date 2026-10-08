import { Item } from "./Item.ts";

// Fixture - an Item that is fixed in place: you can see it and examine it, but not carry it away.
// Gate and Trough are Fixtures - so they are Items too (a subclass of a subclass).

export class Fixture extends Item {
  public override canBeTaken(): boolean {
    return false;
  }
}
