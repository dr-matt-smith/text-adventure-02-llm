import Phaser from "phaser";
import type { Player } from "../adventure/Player.ts";
import { LOW_TIME, MAX_TIME } from "../adventure/Player.ts";
import { DIM_COLOUR, FONT, TEXT_COLOUR, TEXT_COLOUR_NUMBER, WARNING_COLOUR_NUMBER } from "./theme.ts";

// StatusPanel - where you are, your time left (oxygen, daylight...), your moves and what you are carrying
//
// It does not extend anything: it HAS a few Text objects and a Graphics, and keeps them up to date
// (COMPOSITION). The scene just calls show(player) after every command.

const BAR_WIDTH = 200;
const BAR_HEIGHT = 14;

export class StatusPanel {
  private readonly locationText: Phaser.GameObjects.Text;
  private readonly movesText: Phaser.GameObjects.Text;
  private readonly inventoryText: Phaser.GameObjects.Text;
  private readonly timeBar: Phaser.GameObjects.Graphics;
  private readonly barX: number;
  private readonly barY: number;

  // meterName - what the story calls its clock: "OXYGEN", "DAYLIGHT"
  constructor(scene: Phaser.Scene, x: number, y: number, meterName: string) {
    const heading = { fontFamily: FONT, fontSize: "14px", color: DIM_COLOUR };
    const value = { fontFamily: FONT, fontSize: "17px", color: TEXT_COLOUR, wordWrap: { width: BAR_WIDTH } };

    scene.add.text(x, y, "LOCATION", heading);
    this.locationText = scene.add.text(x, y + 18, "", value);

    scene.add.text(x, y + 60, meterName, heading);
    this.barX = x;
    this.barY = y + 80;
    this.timeBar = scene.add.graphics();

    this.movesText = scene.add.text(x, y + 104, "", { ...value, fontSize: "14px" });

    scene.add.text(x, y + 140, "CARRYING", heading);
    this.inventoryText = scene.add.text(x, y + 158, "", value);
  }

  public show(player: Player): void {
    this.locationText.setText(player.getLocation().getName());
    this.movesText.setText(`Moves: ${player.getMoves()}`);

    const items = player.getInventory();
    this.inventoryText.setText(items.length === 0 ? "(nothing)" : items.map((item) => "- " + item).join("\n"));

    // the bar: an outline, filled in proportion to the time left - red when it is low
    const timeLeft = player.getTimeLeft();
    const colour = timeLeft <= LOW_TIME ? WARNING_COLOUR_NUMBER : TEXT_COLOUR_NUMBER;
    this.timeBar.clear();
    this.timeBar.lineStyle(2, TEXT_COLOUR_NUMBER);
    this.timeBar.strokeRect(this.barX, this.barY, BAR_WIDTH, BAR_HEIGHT);
    this.timeBar.fillStyle(colour);
    this.timeBar.fillRect(this.barX + 2, this.barY + 2, (BAR_WIDTH - 4) * timeLeft / MAX_TIME, BAR_HEIGHT - 4);
  }
}
