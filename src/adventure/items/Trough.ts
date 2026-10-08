import type { Player } from "../Player.ts";
import { Fixture } from "./Fixture.ts";

// Trough - the cows' water trough. It leaks until you FIX it - and for that you need a wrench.

export class Trough extends Fixture {
  private fixed = false;

  constructor() {
    super("water trough", "The water trough. A pipe joint underneath is leaking, and the trough is nearly empty.");
  }

  public isFixed(): boolean {
    return this.fixed;
  }

  public override getDescription(): string {
    return this.fixed ? "The water trough, full of clean water." : super.getDescription();
  }

  public override fix(player: Player): string {
    if (this.fixed) {
      return "The trough is working fine now.";
    }
    if (player.findItem("wrench") === null) {
      return "A pipe joint under the trough is loose. You'll need a wrench to tighten it.";
    }
    this.fixed = true;
    return "You tighten the leaking pipe joint with the wrench. The trough fills up with clean water.";
  }
}
