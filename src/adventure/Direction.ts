// Direction - north, south, east and west
//
// The Unity version used a C# enum. TypeScript enums cannot have fields or methods, so - like
// Direction in matt-mac-man - this is a class with a PRIVATE constructor and one `static readonly`
// object per direction: a Java-style enum.

export class Direction {
  public static readonly NORTH = new Direction("north", "n", 0, -1);
  public static readonly SOUTH = new Direction("south", "s", 0, 1);
  public static readonly EAST = new Direction("east", "e", 1, 0);
  public static readonly WEST = new Direction("west", "w", -1, 0);

  public static readonly ALL: Direction[] = [Direction.NORTH, Direction.SOUTH, Direction.EAST, Direction.WEST];

  public readonly name: string;
  public readonly letter: string;
  public readonly dx: number;      // which way it goes on the map: -1, 0 or 1 across...
  public readonly dy: number;      // ...and down

  private constructor(name: string, letter: string, dx: number, dy: number) {
    this.name = name;
    this.letter = letter;
    this.dx = dx;
    this.dy = dy;
  }

  public opposite(): Direction {
    switch (this) {
      case Direction.NORTH:
        return Direction.SOUTH;
      case Direction.SOUTH:
        return Direction.NORTH;
      case Direction.EAST:
        return Direction.WEST;
      default:
        return Direction.EAST;
    }
  }

  // "north" or "n" -> Direction.NORTH. Anything else -> null.
  public static fromWord(word: string): Direction | null {
    for (const direction of Direction.ALL) {
      if (word === direction.name || word === direction.letter) {
        return direction;
      }
    }
    return null;
  }

  public toString(): string {
    return this.name;
  }
}
