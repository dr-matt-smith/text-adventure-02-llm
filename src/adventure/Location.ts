import { Direction } from "./Direction.ts";
import type { Item } from "./items/Item.ts";
import type { Player } from "./Player.ts";

// Location - one place in the world: its descriptions, its exits and the items lying in it
//
// As in the Unity version, the first visit shows the first description, and later visits pick one
// at random. Exits are kept in a Map (like Java's HashMap) from Direction to Location, instead of
// four separate exitNorth / exitSouth / ... fields.

export class Location {
  private readonly name: string;
  private readonly descriptions: string[];
  private readonly exits = new Map<Direction, Location>();
  private readonly items: Item[] = [];
  private visits = 0;

  // where this location is drawn on the mini map (columns and rows, not pixels)
  public readonly mapCol: number;
  public readonly mapRow: number;

  constructor(name: string, mapCol: number, mapRow: number, descriptions: string[]) {
    this.name = name;
    this.mapCol = mapCol;
    this.mapRow = mapRow;
    this.descriptions = descriptions;
  }

  public getName(): string {
    return this.name;
  }

  // Joins two locations BOTH ways: if the town is east of here, then here is west of the town.
  // (`other.exits` is private, but this is the same class, so - just like Java - it is allowed.)
  public connect(direction: Direction, other: Location): void {
    this.exits.set(direction, other);
    other.exits.set(direction.opposite(), this);
  }

  public getExit(direction: Direction): Location | null {
    return this.exits.get(direction) ?? null;
  }

  public getExitDirections(): Direction[] {
    return Direction.ALL.filter((direction) => this.exits.has(direction));
  }

  public addItem(item: Item): void {
    this.items.push(item);
  }

  // everything here, whether the player can see it or not
  public getItems(): readonly Item[] {
    return this.items;
  }

  public removeItem(item: Item): void {
    const index = this.items.indexOf(item);
    if (index !== -1) {
      this.items.splice(index, 1);
    }
  }

  // the item called `noun`, if the player can see one here
  public findItem(noun: string, player: Player): Item | null {
    return this.getVisibleItems(player).find((item) => item.matches(noun)) ?? null;
  }

  public arrive(): void {
    this.visits = this.visits + 1;
  }

  public hasBeenVisited(): boolean {
    return this.visits > 0;
  }

  // Everything the player sees: name, description, items and exits. It calls two methods a
  // subclass can override (getDescription and getVisibleItems) - see DarkLocation.
  public describe(player: Player): string {
    const lines = [`== ${this.name.toUpperCase()} ==`, this.getDescription(player)];

    const items = this.getVisibleItems(player);
    if (items.length > 0) {
      lines.push(`You can see: ${items.join(", ")}.`);
    }

    lines.push(`Exits: ${this.getExitDirections().join(", ")}.`);
    return lines.join("\n");
  }

  protected getDescription(_player: Player): string {
    if (this.visits <= 1) {
      return this.descriptions[0];
    }
    const randomIndex = Math.floor(Math.random() * this.descriptions.length);
    return this.descriptions[randomIndex];
  }

  protected getVisibleItems(_player: Player): Item[] {
    return this.items;
  }
}
