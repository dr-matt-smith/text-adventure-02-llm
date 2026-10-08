import { Location } from "./Location.ts";
import type { Item } from "./items/Item.ts";
import type { Player } from "./Player.ts";

// DarkLocation - a Location you cannot see in without a light
//
// It IS-A Location, and overrides just two methods. describe() and findItem() are inherited
// unchanged - but because they call getDescription() and getVisibleItems(), they now behave
// differently in the dark. That is POLYMORPHISM: the subclass's version is the one that runs.

export class DarkLocation extends Location {
  private readonly darkDescription: string;

  constructor(name: string, mapCol: number, mapRow: number, descriptions: string[], darkDescription: string) {
    super(name, mapCol, mapRow, descriptions);
    this.darkDescription = darkDescription;
  }

  protected override getDescription(player: Player): string {
    if (player.hasLight()) {
      return super.getDescription(player);
    }
    return this.darkDescription;
  }

  protected override getVisibleItems(player: Player): Item[] {
    if (player.hasLight()) {
      return super.getVisibleItems(player);
    }
    return [];                     // whatever is here, you cannot see it
  }
}
