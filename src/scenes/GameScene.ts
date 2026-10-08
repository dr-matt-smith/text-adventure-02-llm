import Phaser from "phaser";
import { Adventure, GameState } from "../adventure/Adventure.ts";
import type { Story } from "../adventure/stories/Story.ts";
import { type Translation, Translator } from "../adventure/Translator.ts";
import { askLmStudio, LLM_ENABLED } from "../llm/LmStudio.ts";
import { InputLine } from "../ui/InputLine.ts";
import { MiniMap } from "../ui/MiniMap.ts";
import { StatusPanel } from "../ui/StatusPanel.ts";
import { Terminal } from "../ui/Terminal.ts";
import { ANSWER_COLOUR, DIM_COLOUR, DIM_COLOUR_NUMBER, INPUT_COLOUR } from "../ui/theme.ts";
import type { EndData } from "./EndScene.ts";
import { END_SCENE, GAME_SCENE, START_SCENE } from "./keys.ts";

// GameScene - the screen you play on. It is the go-between for the player and the Adventure:
//
//     keyboard -> InputLine -> adventure.process(text) -> Terminal, StatusPanel, MiniMap
//
// When the player types something that isn't a plain command ("grab the lamp"), the Translator
// asks the LLM, which gives back ONE command for the game, or an answer for the player.
//
// The scene has no game rules in it at all. Those are all in the adventure/ folder.

const END_DELAY = 3000;            // milliseconds to read the last message before the end screen

// what this scene is given when it starts: which story to play
export interface GameData {
  story: Story;
}

export class GameScene extends Phaser.Scene {
  private story!: Story;
  private adventure!: Adventure;
  private terminal!: Terminal;
  private inputLine!: InputLine;
  private statusPanel!: StatusPanel;
  private miniMap!: MiniMap;
  private readonly translator = LLM_ENABLED ? new Translator(askLmStudio) : null;

  constructor() {
    super(GAME_SCENE);
  }

  init(data: GameData): void {
    this.story = data.story;
  }

  create(): void {
    this.adventure = new Adventure(this.story);   // a brand new game, every time this scene starts

    this.drawFrame();
    this.terminal = new Terminal(this, 24, 20, 500, 520);
    this.inputLine = new InputLine(this, 24, 558, (text) => {
      this.handleCommand(text);
    });
    this.statusPanel = new StatusPanel(this, 568, 24, this.story.meterName);
    this.miniMap = new MiniMap(this, 560, 440, this.adventure.getWorld());

    this.terminal.print(this.adventure.getIntro());
    this.showStatus();
  }

  private handleCommand(text: string): void {
    this.terminal.print("> " + text, INPUT_COLOUR);
    if (this.translator === null || !Translator.needsTranslating(this.adventure, text)) {
      this.terminal.print(this.adventure.process(text));
      this.afterCommand();
    } else {
      void this.translateAndDo(this.translator, text);   // "void": we don't wait for it here
    }
  }

  // Ask the LLM what the player meant, then do that ONE command - or show its answer.
  // `async`: it can wait (await) for the LLM without freezing the game.
  private async translateAndDo(translator: Translator, text: string): Promise<void> {
    this.inputLine.setEnabled(false);
    this.terminal.print("(thinking...)", DIM_COLOUR);

    let translation: Translation | null = null;
    try {
      translation = await translator.translate(this.adventure, text);
    } catch (error) {
      console.error(error);
      this.terminal.print("(Can't reach the LLM - is LM Studio's server running, with CORS on?)", DIM_COLOUR);
    }
    if (!this.sys.isActive()) {
      return;                      // the scene ended while we were waiting
    }

    if (translation?.kind === "command") {
      this.terminal.print("= " + translation.command, INPUT_COLOUR);
      this.terminal.print(this.adventure.process(translation.command));
    } else if (translation?.kind === "answer") {
      this.terminal.print("(LLM) " + translation.answer, ANSWER_COLOUR);   // the game is unchanged
    } else {
      this.terminal.print(this.adventure.process(text));   // the game's own "I don't know how to..."
    }
    this.inputLine.setEnabled(true);
    this.afterCommand();
  }

  private afterCommand(): void {
    this.showStatus();

    if (this.adventure.isOver()) {
      this.inputLine.setEnabled(false);
      this.time.delayedCall(END_DELAY, () => {
        this.endGame();
      });
    }
  }

  private showStatus(): void {
    const player = this.adventure.getPlayer();
    this.statusPanel.show(player);
    this.miniMap.show(this.adventure.getWorld(), player);
  }

  private endGame(): void {
    if (this.adventure.getState() === GameState.Quit) {
      this.scene.start(START_SCENE);
      return;
    }
    const data: EndData = {
      story: this.story,
      won: this.adventure.getState() === GameState.Won,
      moves: this.adventure.getPlayer().getMoves(),
    };
    this.scene.start(END_SCENE, data);
  }

  // borders around the terminal, the input line and the side panel
  private drawFrame(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(2, DIM_COLOUR_NUMBER);
    graphics.strokeRect(10, 10, 530, 535);   // terminal
    graphics.strokeRect(10, 550, 530, 40);   // input line
    graphics.strokeRect(550, 10, 240, 580);  // side panel
    graphics.lineBetween(550, 425, 790, 425);
  }
}
