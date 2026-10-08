import farmFile from "../../data/farm.story" with { type: "text" };
import type { Adventure } from "../Adventure.ts";
import { CloseCommand } from "../commands/CloseCommand.ts";
import { FixCommand } from "../commands/FixCommand.ts";
import { Cow } from "../items/Cow.ts";
import { Gate } from "../items/Gate.ts";
import { Trough } from "../items/Trough.ts";
import { readStory } from "../StoryFile.ts";
import type { Story } from "./Story.ts";

// Down on the Farm - Bessie the cow has got out. Bring her back to the field, CLOSE the gate,
// and FIX the leaking water trough (you'll need the wrench from the barn - and a light in there).
//
//                [Farmhouse]   [Orchard]
//                    |             |
//       [Barn] -- [Farmyard] --- [Lane] -- [Meadow]
//                    |             |
//                 [Field]        [Pond]
//
// The places, the items and the words are in src/data/farm.story (open it in the Story Builder).
// This file adds what is code: the extra commands, and how you win.

// Have all three jobs been done? They can be done in any order, so this is checked after every
// command. The Story knows about Cow, Gate and Trough; the engine never needs to.
function allJobsDone(adventure: Adventure): boolean {
  const items = adventure.getWorld().getLocation("Field").getItems();
  const cowHome = items.some((item) => item instanceof Cow);
  const gateClosed = items.some((item) => item instanceof Gate && item.isClosed());
  const troughFixed = items.some((item) => item instanceof Trough && item.isFixed());
  return cowHome && gateClosed && troughFixed;
}

export const FARM: Story = readStory(farmFile, "farm.story", {
  commands: [new CloseCommand(), new FixCommand()],

  checkForWin: (adventure) => {
    if (!allJobsDone(adventure)) {
      return null;
    }
    return "Bessie takes a long drink from the trough, then settles down in the long grass. " +
      "The cow is home, the gate is shut and the water is flowing.\n\nALL JOBS DONE!";
  },
});
