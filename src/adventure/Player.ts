import type { Item } from "./items/Item.ts";
import type { Location } from "./Location.ts";

// Player - where you are, what you are carrying, and how much time you have left
//
// The Unity version's Player had an oxygenLevel that was never used. Here it is the clock: every
// step you take uses some up, and when it runs out, the game is over. Each Story gives the clock
// its own name - in Stranded it is your oxygen, on the farm it is the daylight.

export const MAX_TIME = 100;
export const LOW_TIME = 25;        // at or below this, the player is warned
const TIME_PER_MOVE = 5;

export class Player {
  private location: Location;
  private readonly inventory: Item[] = [];
  private timeLeft = MAX_TIME;
  private moves = 0;

  constructor(start: Location) {
    this.location = start;
    start.arrive();
  }

  public getLocation(): Location {
    return this.location;
  }

  public moveTo(location: Location): void {
    this.location = location;
    location.arrive();
    this.moves = this.moves + 1;
    this.timeLeft = Math.max(0, this.timeLeft - TIME_PER_MOVE);
  }

  public getMoves(): number {
    return this.moves;
  }

  public getTimeLeft(): number {
    return this.timeLeft;
  }

  public refillTime(): void {
    this.timeLeft = MAX_TIME;
  }

  // Polymorphism again: the player does not check for a Lantern - it asks every item.
  public hasLight(): boolean {
    return this.inventory.some((item) => item.givesLight());
  }

  public addItem(item: Item): void {
    this.inventory.push(item);
  }

  public removeItem(item: Item): void {
    const index = this.inventory.indexOf(item);
    if (index !== -1) {
      this.inventory.splice(index, 1);
    }
  }

  // the carried item called `noun`, or null
  public findItem(noun: string): Item | null {
    return this.inventory.find((item) => item.matches(noun)) ?? null;
  }

  // `readonly Item[]`: callers can look at the list, but the compiler stops them changing it.
  // Only the player adds and removes items.
  public getInventory(): readonly Item[] {
    return this.inventory;
  }
}
