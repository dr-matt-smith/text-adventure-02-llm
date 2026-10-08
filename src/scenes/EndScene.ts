import Phaser from "phaser";
import type { Story } from "../adventure/stories/Story.ts";
import { FONT, INPUT_COLOUR, TEXT_COLOUR } from "../ui/theme.ts";
import type { GameData } from "./GameScene.ts";
import { END_SCENE, GAME_SCENE, START_SCENE } from "./keys.ts";

// EndScene - won, or ran out of time. The words come from the Story you were playing.

export interface EndData {
  story: Story;
  won: boolean;
  moves: number;
}

export class EndScene extends Phaser.Scene {
  private result!: EndData;

  constructor() {
    super(END_SCENE);
  }

  init(data: EndData): void {
    this.result = data;
  }

  create(): void {
    const centreX = this.scale.width / 2;
    const style = { fontFamily: FONT, fontSize: "22px", color: TEXT_COLOUR, align: "center" };
    const story = this.result.story;

    const title = this.result.won ? story.wonTitle : story.lostTitle;
    const colour = this.result.won ? TEXT_COLOUR : "#ff5533";
    const message = this.result.won ? story.wonMessage(this.result.moves) : story.lostMessage(this.result.moves);

    this.add.text(centreX, 200, title, { ...style, fontSize: "56px", fontStyle: "bold", color: colour }).setOrigin(0.5);
    this.add.text(centreX, 320, message, style).setOrigin(0.5);
    this.add.text(centreX, 470, "ENTER to play again, ESC for the title screen", { ...style, fontSize: "18px", color: INPUT_COLOUR })
      .setOrigin(0.5);

    this.input.keyboard!.once("keydown-ENTER", () => {
      const data: GameData = { story };
      this.scene.start(GAME_SCENE, data);
    });
    this.input.keyboard!.once("keydown-ESC", () => {
      this.scene.start(START_SCENE);
    });
  }
}
