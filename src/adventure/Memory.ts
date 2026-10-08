import type { Location } from "./Location.ts";
import type { Player } from "./Player.ts";

// Memory - what the player has seen in each place they have been
//
// After every command, the Adventure tells the Memory to look at where the player is now. It keeps
// what the player would see there - the description, the items, the exits - replacing whatever it
// had before. So it always holds each place as the player LAST saw it: if they took the lantern, the
// memory of that room no longer has it; if the cow wandered off after they left, it still does.
//
// It only remembers what the player was shown: a dark room, seen without a light, is remembered as
// dark. The LLM uses the memory to answer questions like "where was the cow?" (see Translator).

export class Memory {
  // a Map keeps its keys in the order they were added: the order the places were first seen
  private readonly seen = new Map<Location, string>();

  // Remember the player's location as they see it now.
  public remember(player: Player): void {
    const location = player.getLocation();
    this.seen.set(location, location.describe(player));
  }

  // What the player last saw at `location`, or null if they have never been there.
  public recall(location: Location): string | null {
    return this.seen.get(location) ?? null;
  }

  // every place the player has seen, in the order they first saw them
  public getPlaces(): Location[] {
    return [...this.seen.keys()];
  }
}
