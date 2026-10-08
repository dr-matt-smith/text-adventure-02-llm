import { Fixture } from "./Fixture.ts";

// Gate - the gate to the cow field. It starts open; CLOSE GATE shuts it.

export class Gate extends Fixture {
  private closed = false;

  constructor() {
    super("gate", "The gate to the cow field. It is swinging wide open.");
  }

  public isClosed(): boolean {
    return this.closed;
  }

  public override getDescription(): string {
    return this.closed ? "The gate to the cow field, shut and latched." : super.getDescription();
  }

  public override close(): string {
    if (this.closed) {
      return "The gate is already shut.";
    }
    this.closed = true;
    return "You swing the gate shut and drop the latch.";
  }
}
