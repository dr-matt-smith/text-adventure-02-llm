import { DarkLocation } from "./DarkLocation.ts";
import { Direction } from "./Direction.ts";
import { Cow } from "./items/Cow.ts";
import { Gate } from "./items/Gate.ts";
import { Item } from "./items/Item.ts";
import { Lantern } from "./items/Lantern.ts";
import { OxygenTank } from "./items/OxygenTank.ts";
import { Trough } from "./items/Trough.ts";
import { Location } from "./Location.ts";

// World - builds every location, joins them up, and puts the items in them
// (the Unity version's Map class - renamed, because JavaScript already has a Map)
//
// The world itself is written in the Story Builder, in a .story file in src/data/. StoryFile reads
// that into the WorldData below, and each Story hands its own one to this class, which builds it.
// The same code builds the planet in Stranded and the farm.

// The shape of a world. A location with a darkDescription becomes a DarkLocation.
// An item with a "type" is a special item (a subclass); any other item is a plain Item.
export interface ItemData {
  type?: string;
  name?: string;
  description?: string;
}

interface LocationData {
  id: string;
  name: string;
  mapCol: number;
  mapRow: number;
  descriptions: string[];
  darkDescription?: string;
  items?: ItemData[];
}

interface ConnectionData {
  from: string;
  direction: string;
  to: string;
}

export interface WorldData {
  start: string;
  locations: LocationData[];
  connections: ConnectionData[];
}

export class World {
  private readonly start: Location;
  private readonly locations: Location[] = [];
  private readonly locationsById = new Map<string, Location>();

  constructor(data: WorldData) {
    for (const locationData of data.locations) {
      const location = this.createLocation(locationData);
      this.locations.push(location);
      this.locationsById.set(locationData.id, location);

      for (const itemData of locationData.items ?? []) {
        location.addItem(this.createItem(itemData, locationData.id));
      }
    }

    // connect() joins both ways, so each path only needs to be listed once
    for (const connection of data.connections) {
      const direction = Direction.fromWord(connection.direction);
      if (direction === null) {
        throw new Error(`world data: unknown direction "${connection.direction}"`);
      }
      this.getLocation(connection.from).connect(direction, this.getLocation(connection.to));
    }

    this.start = this.getLocation(data.start);
  }

  private createLocation(data: LocationData): Location {
    if (data.darkDescription !== undefined) {
      return new DarkLocation(data.name, data.mapCol, data.mapRow, data.descriptions, data.darkDescription);
    }
    return new Location(data.name, data.mapCol, data.mapRow, data.descriptions);
  }

  // `where` is the id of the location it lies in, so a mistake in the data says where it is
  private createItem(data: ItemData, where: string): Item {
    switch (data.type) {
      case "lantern":
        return new Lantern();
      case "oxygen tank":
        return new OxygenTank();
      case "cow":
        return new Cow();
      case "gate":
        return new Gate();
      case "trough":
        return new Trough();
      case undefined:
        if (data.name === undefined || data.description === undefined) {
          throw new Error(`world data, location "${where}": an item needs a name and a description (or a type)`);
        }
        return new Item(data.name, data.description);
      default:
        throw new Error(`world data, location "${where}": unknown item type "${data.type}"`);
    }
  }

  // the location with this id - its node's name in the .story file, e.g. "Ship"
  public getLocation(id: string): Location {
    const location = this.locationsById.get(id);
    if (location === undefined) {
      throw new Error(`world data: unknown location "${id}"`);
    }
    return location;
  }

  // where the player starts
  public getStart(): Location {
    return this.start;
  }

  public getLocations(): readonly Location[] {
    return this.locations;
  }
}
