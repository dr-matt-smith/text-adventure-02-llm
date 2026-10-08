import Phaser from "phaser";
import { FONT, TEXT_COLOUR } from "./theme.ts";

// Terminal - the scrolling text the game prints, like a console window
//
// It EXTENDS Phaser's Container: a game object that holds other game objects, and moves them all
// together. Every print() adds one Text object to the container. The newest is at the bottom;
// older ones are pushed up, and destroyed once they have scrolled off the top.

const GAP = 10;                    // pixels between one message and the next

export class Terminal extends Phaser.GameObjects.Container {
  private readonly areaWidth: number;
  private readonly areaHeight: number;
  private readonly entries: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    super(scene, x, y);
    this.areaWidth = width;
    this.areaHeight = height;
    scene.add.existing(this);
  }

  public print(message: string, colour = TEXT_COLOUR): void {
    const text = this.scene.add.text(0, 0, message, {
      fontFamily: FONT,
      fontSize: "17px",
      color: colour,
      lineSpacing: 3,
      wordWrap: { width: this.areaWidth, useAdvancedWrap: true },
    });
    this.add(text);                // into the container: its x and y are now relative to ours
    this.entries.push(text);
    this.layout();
  }

  // Stack the messages upwards from the bottom, newest first. Any that end up wholly above the
  // top are gone for good.
  private layout(): void {
    let bottom = this.areaHeight;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const text = this.entries[i];
      text.setY(bottom - text.height);
      bottom = text.y - GAP;
    }

    while (this.entries.length > 1 && this.entries[0].y + this.entries[0].height < 0) {
      const oldest = this.entries.shift()!;
      oldest.destroy();
    }
    // a message cut off by the top edge is hidden, rather than drawn over the edge
    for (const text of this.entries) {
      text.setVisible(text.y >= 0);
    }
  }
}
