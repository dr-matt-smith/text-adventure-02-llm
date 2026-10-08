import type { Adventure } from "../Adventure.ts";
import { Command } from "./Command.ts";

// HelpCommand - lists every command. It asks each Command for its own help text, so a new
// command shows up here without HelpCommand changing.

export class HelpCommand extends Command {
  constructor() {
    super(["help", "?"], "HELP - show this list");
  }

  public override execute(adventure: Adventure): string {
    const lines = adventure.getCommands().map((command) => "  " + command.getHelp());
    return "You can type:\n" + lines.join("\n");
  }
}
