import Phaser from "phaser";
import { FONT, INPUT_COLOUR } from "./theme.ts";

// InputLine - where the player types, with a blinking cursor
//
// It IS-A Phaser Text, that also listens to the keyboard. When ENTER is pressed it calls the
// function it was given (onSubmit) with what was typed - a CALLBACK, like a listener in Java.
// The UP arrow brings back earlier commands.
//
// It listens to the BROWSER's keydown events, not Phaser's keyboard. Phaser's keyboard is built
// for game controls ("is the left arrow held down?") and checks keys once a frame - so when
// someone types quickly, two keys can land in the same frame and one of them comes out twice.

const MAX_LENGTH = 120;            // long enough for a sentence, for the LLM to read
const VISIBLE_LENGTH = 40;         // the characters that fit on the line: longer text scrolls
const PROMPT = "> ";

export class InputLine extends Phaser.GameObjects.Text {
  private readonly onSubmit: (text: string) => void;
  private readonly history: string[] = [];
  private historyIndex = 0;
  private typed = "";
  private cursorOn = true;
  private enabled = true;

  // an arrow function stored in a field, so the SAME function can be added and later removed
  private readonly keyListener = (event: KeyboardEvent): void => {
    this.handleKey(event);
  };

  constructor(scene: Phaser.Scene, x: number, y: number, onSubmit: (text: string) => void) {
    super(scene, x, y, "", { fontFamily: FONT, fontSize: "20px", color: INPUT_COLOUR });
    this.onSubmit = onSubmit;
    scene.add.existing(this);

    // Listen to the whole browser window - and stop listening when the scene ends, or a
    // finished game would still be reacting to the keyboard.
    globalThis.addEventListener("keydown", this.keyListener);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      globalThis.removeEventListener("keydown", this.keyListener);
    });

    scene.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        this.cursorOn = !this.cursorOn;
        this.refresh();
      },
    });
    this.refresh();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.refresh();
  }

  private handleKey(event: KeyboardEvent): void {
    if (!this.enabled) {
      return;
    }
    // stop the browser doing its own thing too (SPACE would scroll the page)
    if (event.key === " " || event.key.startsWith("Arrow") || event.key === "Backspace") {
      event.preventDefault();
    }

    if (event.key === "Enter") {
      this.submit();
    } else if (event.key === "Backspace") {
      this.typed = this.typed.slice(0, -1);
    } else if (event.key === "ArrowUp") {
      this.recall(-1);
    } else if (event.key === "ArrowDown") {
      this.recall(1);
    } else if (event.key.length === 1 && this.typed.length < MAX_LENGTH) {
      this.typed = this.typed + event.key;   // a letter, digit, space or punctuation
    }
    this.cursorOn = true;
    this.refresh();
  }

  private submit(): void {
    const text = this.typed.trim();
    this.typed = "";
    if (text === "") {
      return;
    }
    this.history.push(text);
    this.historyIndex = this.history.length;
    this.onSubmit(text);
  }

  // step back (-1) or forward (+1) through the commands typed before
  private recall(step: number): void {
    this.historyIndex = Phaser.Math.Clamp(this.historyIndex + step, 0, this.history.length);
    this.typed = this.history[this.historyIndex] ?? "";
  }

  private refresh(): void {
    const cursor = this.enabled && this.cursorOn ? "_" : "";
    this.setText(PROMPT + this.typed.slice(-VISIBLE_LENGTH) + cursor);
  }
}
