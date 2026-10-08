// main.ts - what the game IS: its size, its settings, and its scenes.
//
// There are no pictures or sounds to load: everything on screen is text, or drawn with Graphics.

import Phaser from "phaser";
import { EndScene } from "./scenes/EndScene.ts";
import { GameScene } from "./scenes/GameScene.ts";
import { StartScene } from "./scenes/StartScene.ts";

const config: Phaser.Types.Core.GameConfig = {
  title: "OCTAD Text Adventures",
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#050a06",

  scale: {
    width: 800,
    height: 600,
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },

  // start -> game -> end -> game -> ...
  scene: [StartScene, GameScene, EndScene],
};

new Phaser.Game(config);
