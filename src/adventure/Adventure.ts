import { CommandParser, type ParsedInput } from "./CommandParser.ts";
import type { Command } from "./commands/Command.ts";
import { DropCommand } from "./commands/DropCommand.ts";
import { ExamineCommand } from "./commands/ExamineCommand.ts";
import { GoCommand } from "./commands/GoCommand.ts";
import { HelpCommand } from "./commands/HelpCommand.ts";
import { InventoryCommand } from "./commands/InventoryCommand.ts";
import { LookCommand } from "./commands/LookCommand.ts";
import { QuitCommand } from "./commands/QuitCommand.ts";
import { TakeCommand } from "./commands/TakeCommand.ts";
import { Memory } from "./Memory.ts";
import { LOW_TIME, Player } from "./Player.ts";
import type { Story } from "./stories/Story.ts";
import { World } from "./World.ts";

// Adventure - the whole game, as plain TypeScript: text in, text out
//
// Nothing in the adventure/ folder knows about Phaser. The Phaser scenes show the text and read
// the keyboard; this decides what happens. Keeping the two apart means the game can be tested
// without a browser (see tests/), and the screen could be swapped for something else entirely.
// This is the same idea as MODEL and VIEW in MVC.
//
// The same Adventure runs every story: the Story it is given supplies the world, the words and
// the extra commands, and says when you have won.

export enum GameState {
  Playing,
  Won,
  Lost,
  Quit,
}

export class Adventure {
  private readonly story: Story;
  private readonly world: World;
  private readonly player: Player;
  private readonly parser: CommandParser;
  private readonly memory = new Memory();
  private state = GameState.Playing;

  constructor(story: Story) {
    this.story = story;
    this.world = new World(story.world);
    this.player = new Player(this.world.getStart());

    // Every command the game understands. Different classes, but each one IS-A Command.
    this.parser = new CommandParser([
      new LookCommand(),
      new GoCommand(),
      new TakeCommand(),
      new DropCommand(),
      new ExamineCommand(),
      new InventoryCommand(),
      ...story.commands,           // the commands only this story has, e.g. REPAIR
      new HelpCommand(),
      new QuitCommand(),
    ]);
    this.memory.remember(this.player);
  }

  public getIntro(): string {
    return this.story.intro + "\n\nType HELP to see what you can do.\n\n" +
      this.player.getLocation().describe(this.player);
  }

  // `text` split into its verb, its noun, and the command that answers to the verb
  public parse(text: string): ParsedInput {
    return this.parser.parse(text);
  }

  // Is the first word of `text` a command the game knows? ("take lamp" yes, "grab lamp" no)
  public understands(text: string): boolean {
    return this.parse(text).command !== null;
  }

  // Do whatever the player typed, and return the reply.
  public process(text: string): string {
    if (this.isOver()) {
      return "The game is over.";
    }

    const input = this.parser.parse(text);
    if (input.verb === "") {
      return "Say something! (Type HELP if you are stuck.)";
    }
    if (input.command === null) {
      return `I don't know how to "${input.verb}". Type HELP to see what you can do.`;
    }

    // Polymorphism: we don't know - or care - WHICH kind of Command this is
    let reply = input.command.execute(this, input.verb, input.noun);
    this.memory.remember(this.player);   // what the player can see now, wherever they are

    if (this.state === GameState.Playing) {
      const winMessage = this.story.checkForWin(this);
      if (winMessage !== null) {
        this.win();
        reply += "\n\n" + winMessage;
      }
    }

    if (this.state === GameState.Playing) {
      const timeLeft = this.player.getTimeLeft();
      if (timeLeft === 0) {
        this.state = GameState.Lost;
        reply += "\n\n" + this.story.runOutMessage;
      } else if (timeLeft <= LOW_TIME) {
        reply += `\n\nWARNING: ${this.story.meterName.toLowerCase()} at ${timeLeft}%!`;
      }
    }
    return reply;
  }

  public getStory(): Story {
    return this.story;
  }

  public getPlayer(): Player {
    return this.player;
  }

  public getWorld(): World {
    return this.world;
  }

  public getMemory(): Memory {
    return this.memory;
  }

  public getCommands(): Command[] {
    return this.parser.getCommands();
  }

  public getState(): GameState {
    return this.state;
  }

  public isOver(): boolean {
    return this.state !== GameState.Playing;
  }

  public win(): void {
    this.state = GameState.Won;
  }

  public quit(): void {
    this.state = GameState.Quit;
  }
}
