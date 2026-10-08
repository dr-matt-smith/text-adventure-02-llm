import Phaser from "phaser";
import { STORIES } from "../adventure/stories/stories.ts";
import { DIM_COLOUR, FONT, INPUT_COLOUR, TEXT_COLOUR } from "../ui/theme.ts";
import type { GameData } from "./GameScene.ts";
import { GAME_SCENE, START_SCENE } from "./keys.ts";

// StartScene - the title screen, where you choose which adventure to play
//
// UP / DOWN (or a number key, or the mouse) picks a story, ENTER starts it. The list comes from
// stories.ts, so a new story shows up here without this scene changing.

const FIRST_STORY_Y = 190;
const STORY_SPACING = 135;

export class StartScene extends Phaser.Scene {
  private choice = 0;              // kept between visits, so ESC from the end screen remembers it
  private titles: Phaser.GameObjects.Text[] = [];
  private blurbs: Phaser.GameObjects.Text[] = [];

  constructor() {
    super(START_SCENE);
  }

  create(): void {
    this.drawStars();

    const centreX = this.scale.width / 2;
    const style = { fontFamily: FONT, fontSize: "20px", color: TEXT_COLOUR, align: "center" };

    this.add.text(centreX, 70, "CHOOSE YOUR ADVENTURE", { ...style, fontSize: "44px", fontStyle: "bold" }).setOrigin(0.5);
    this.add.text(centreX, 115, "OCTAD text adventures", { ...style, color: DIM_COLOUR }).setOrigin(0.5);

    // one title and blurb per story - click a title to play it
    this.titles = [];
    this.blurbs = [];
    STORIES.forEach((story, index) => {
      const y = FIRST_STORY_Y + index * STORY_SPACING;
      const title = this.add.text(centreX, y, `${index + 1}. ${story.title}`, { ...style, fontSize: "30px", fontStyle: "bold" })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      title.on("pointerover", () => this.select(index));
      title.on("pointerdown", () => this.begin());

      this.titles.push(title);
      this.blurbs.push(this.add.text(centreX, y + 55, story.blurb, { ...style, fontSize: "16px" }).setOrigin(0.5));
    });
    this.select(this.choice);

    this.add.text(centreX, 480, "Type commands like  LOOK,  NORTH,  TAKE LANTERN,  HELP", {
      ...style,
      fontSize: "16px",
      color: DIM_COLOUR,
    }).setOrigin(0.5);

    const prompt = this.add.text(centreX, 535, "UP / DOWN to choose, ENTER to begin", { ...style, fontSize: "24px", color: INPUT_COLOUR })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

    const keyboard = this.input.keyboard!;
    keyboard.on("keydown-UP", () => this.select(this.choice - 1));
    keyboard.on("keydown-DOWN", () => this.select(this.choice + 1));
    keyboard.on("keydown", (event: KeyboardEvent) => {
      const number = Number(event.key);          // "1" -> 1, "a" -> NaN
      if (number >= 1 && number <= STORIES.length) {
        this.select(number - 1);
      }
    });
    keyboard.once("keydown-ENTER", () => this.begin());
  }

  // highlight one story (wrapping round from the bottom to the top, and back)
  private select(index: number): void {
    this.choice = (index + STORIES.length) % STORIES.length;
    this.titles.forEach((title, i) => {
      const chosen = i === this.choice;
      title.setColor(chosen ? INPUT_COLOUR : DIM_COLOUR);
      this.blurbs[i].setColor(chosen ? TEXT_COLOUR : DIM_COLOUR);
    });
  }

  private begin(): void {
    const data: GameData = { story: STORIES[this.choice] };
    this.scene.start(GAME_SCENE, data);
  }

  // a sky full of random dots
  private drawStars(): void {
    const graphics = this.add.graphics();
    for (let i = 0; i < 120; i++) {
      graphics.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.2, 0.8));
      graphics.fillCircle(Phaser.Math.Between(0, this.scale.width), Phaser.Math.Between(0, this.scale.height), 1);
    }
  }
}
