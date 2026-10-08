import Phaser from "phaser";
import type { Location } from "../adventure/Location.ts";
import type { Player } from "../adventure/Player.ts";
import type { World } from "../adventure/World.ts";
import { DIM_COLOUR_NUMBER, FONT, TEXT_COLOUR, TEXT_COLOUR_NUMBER } from "./theme.ts";

// MiniMap - a map of the places you have been, drawn as boxes joined by lines
//
// Places you have not visited yet are not drawn, so the map fills in as you explore. An exit to
// somewhere new is drawn as a short line leading off into the unknown.
//
// The box it is drawn in (see GameScene) has room for 4 columns and 3 rows of cells. The columns and rows a
// location may use are the mapCol and mapRow choices in src/data/adventure.schema.json - make the box bigger
// before adding more there.

const CELL_WIDTH = 56;
const CELL_HEIGHT = 40;
const BOX_WIDTH = 52;
const BOX_HEIGHT = 24;

export class MiniMap extends Phaser.GameObjects.Container {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labels = new Map<Location, Phaser.GameObjects.Text>();

  constructor(scene: Phaser.Scene, x: number, y: number, world: World) {
    super(scene, x, y);
    this.graphics = scene.add.graphics();
    this.add(this.graphics);       // added first, so the labels are drawn on top of it

    // one small label per location, made once and hidden until the location is visited
    for (const location of world.getLocations()) {
      const label = scene.add.text(this.centreX(location), this.centreY(location), location.getName().split(" ")[0], {
        fontFamily: FONT,
        fontSize: "9px",
        color: TEXT_COLOUR,
      }).setOrigin(0.5).setVisible(false);
      this.add(label);
      this.labels.set(location, label);
    }
    scene.add.existing(this);
  }

  public show(world: World, player: Player): void {
    const g = this.graphics;
    g.clear();

    for (const location of world.getLocations()) {
      if (!location.hasBeenVisited()) {
        continue;
      }
      const x = this.centreX(location);
      const y = this.centreY(location);

      // a line out of every exit: all the way to the next box if we have been there, else a stub
      g.lineStyle(2, DIM_COLOUR_NUMBER);
      for (const direction of location.getExitDirections()) {
        const reach = location.getExit(direction)!.hasBeenVisited() ? 0.5 : 0.35;
        g.lineBetween(x, y, x + direction.dx * CELL_WIDTH * reach, y + direction.dy * CELL_HEIGHT * reach);
      }

      // the box: filled in where the player is now
      const here = location === player.getLocation();
      g.fillStyle(here ? DIM_COLOUR_NUMBER : 0x000000);
      g.fillRect(x - BOX_WIDTH / 2, y - BOX_HEIGHT / 2, BOX_WIDTH, BOX_HEIGHT);
      g.lineStyle(2, TEXT_COLOUR_NUMBER);
      g.strokeRect(x - BOX_WIDTH / 2, y - BOX_HEIGHT / 2, BOX_WIDTH, BOX_HEIGHT);

      this.labels.get(location)!.setVisible(true);
    }
  }

  private centreX(location: Location): number {
    return location.mapCol * CELL_WIDTH + CELL_WIDTH / 2;
  }

  private centreY(location: Location): number {
    return location.mapRow * CELL_HEIGHT + CELL_HEIGHT / 2;
  }
}
