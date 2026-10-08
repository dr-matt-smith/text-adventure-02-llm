import type { Player } from "../Player.ts";

// Item - something the player can pick up and carry (the Unity version's PickUp class)
//
// Most items are just an Item. A few kinds of item behave differently, so they are SUBCLASSES that
// OVERRIDE a method: a Lantern gives light, an OxygenTank refills your air when you take it, a
// Gate can be closed, a Trough can be fixed.

export class Item {
  private readonly name: string;
  private readonly description: string;

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }

  public getName(): string {
    return this.name;
  }

  public getDescription(): string {
    return this.description;
  }

  // Does `noun` mean this item? "power cell" answers to "power cell" and to just "cell".
  public matches(noun: string): boolean {
    const words = this.name.split(" ");
    return noun === this.name || noun === words[words.length - 1];
  }

  // Can you see by it? (Only a Lantern can.)
  public givesLight(): boolean {
    return false;
  }

  // Can it be picked up at all? (A Fixture can't.)
  public canBeTaken(): boolean {
    return true;
  }

  // Called when the player picks this item up. Returns what to tell the player.
  public onTake(_player: Player): string {
    return `You pick up the ${this.name}.`;
  }

  // Called when the player puts this item down. Returns what to tell the player.
  public onDrop(_player: Player): string {
    return `You drop the ${this.name}.`;
  }

  // CLOSE <item>. Most things can't be closed - a Gate overrides this.
  public close(_player: Player): string {
    return `You can't close the ${this.name}.`;
  }

  // FIX <item>. Most things aren't broken - a Trough overrides this.
  public fix(_player: Player): string {
    return `There is nothing wrong with the ${this.name}.`;
  }

  public toString(): string {
    return this.name;
  }
}
