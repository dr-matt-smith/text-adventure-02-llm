import strandedFile from "../../data/stranded.story" with { type: "text" };
import { RepairCommand } from "../commands/RepairCommand.ts";
import { readStory } from "../StoryFile.ts";
import type { Story } from "./Story.ts";

// Stranded - crash-landed on a strange planet. Find a power cell and a wrench, then REPAIR the ship.
//
//                  [Ship]        [Market]
//                    |              |
//     [Forest] -- [Outside] ----- [Town] -- [Tavern]
//                    |              |
//                  [Cave]       [Scrapyard]
//
// The places, the items and the words are in src/data/stranded.story (open it in the Story
// Builder). This file adds what is code: the REPAIR command.

export const STRANDED: Story = readStory(strandedFile, "stranded.story", {
  commands: [new RepairCommand()],

  // Nothing to check: in Stranded you win with the REPAIR command (see RepairCommand)
  checkForWin: () => null,
});
