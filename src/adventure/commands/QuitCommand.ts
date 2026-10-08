import type { Adventure } from "../Adventure.ts";
import { Command } from "./Command.ts";

// QuitCommand - give up

export class QuitCommand extends Command {
  constructor() {
    super(["quit"], "QUIT - give up");
  }

  public override execute(adventure: Adventure): string {
    adventure.quit();
    return "You give up, and sit down for a rest...";
  }
}
