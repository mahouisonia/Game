import { Engine } from "@babylonjs/core";
import Game from "./game.js";

document.addEventListener("DOMContentLoaded", () => {
  const playBtn = document.getElementById("playBtn");
  const menuQuitBtn = document.getElementById("menuQuitBtn");
  const menu = document.getElementById("menu");
  const canvas = document.getElementById("renderCanvas");
  const quitBtn = document.getElementById("quitBtn");
  const fpsCounter = document.getElementById("fps");

  let game = null;

  playBtn.addEventListener("click", async () => {
    menu.style.display = "none";
    canvas.style.display = "block";
    quitBtn.style.display = "block";
    fpsCounter.style.display = "block";

    const engine = new Engine(canvas, false, {
      adaptToDeviceRatio: true,
    });

    window.addEventListener("resize", () => engine.resize());

    game = new Game(canvas, engine);
    await game.start();
  });

  quitBtn.addEventListener("click", () => {
    location.reload(); // quitter depuis le jeu
  });

  menuQuitBtn.addEventListener("click", () => {
    location.reload(); // quitter depuis le menu
  });
});
