// src/Game.js
import {
    DirectionalLight, Color3, FollowCamera, HavokPlugin, HemisphericLight,
    KeyboardEventTypes, MeshBuilder, PhysicsAggregate, PhysicsMotionType,
    PhysicsShapeType, Scene, ShadowGenerator, StandardMaterial, Texture, Vector3
} from "@babylonjs/core";

import SoundManager from "./SoundManager";
import { Inspector } from "@babylonjs/inspector";
import HavokPhysics from "@babylonjs/havok";

import cielUrl from "../assets/textures/ciel.png";
import son from "../assets/audio/cowboy_song.mp3";
import Player from "./player";
import BotPlayer from "./BotPlayer";

class Game {
    #canvas;
    #engine;
    #havokInstance;
    #gameScene;
    #gameCamera;
    #shadowGenerator;
    #bInspector = false;

    inputMap = {};
    actions = {};

    #player;
    #botplayer;
    #beds = [];
    #canCapture = false;

    #round = 0;
    #maxRounds = 3;
    #scoreBoy = 0;
    #scoreGirl = 0;
    #endGameDiv;
    #victoryDiv;

    constructor(canvas, engine) {
        this.#canvas = canvas;
        this.#engine = engine;
        this.#createEndGameUI();
        this.#createVictoryUI(); // 🆕
    }
    
    async start() {
        await this.#initGame();
        this.#gameLoop();

        // Afficher "Continuer" pour démarrer le 1er round
        this.#endGameDiv.style.display = 'block';
        document.getElementById('scoreText').innerHTML = `Prêt à commencer !<br>Clique sur Go pour lancer la musique 🎵`;
    }

    #createScene() {
        const scene = new Scene(this.#engine);
        scene.collisionsEnabled = true;

        this.#initializePhysics(scene);
        this.#createCamera(scene);
        this.#createLights(scene);
        this.#createGround(scene);
        this.#addBeds(scene);
        this.#createCorridor(scene);

        scene.clearColor = new Color3(0.05, 0.05, 0.05);

        const skybox = MeshBuilder.CreateBox("skyBox", { size: 1000 }, scene);
        const skyboxMaterial = new StandardMaterial("skyBoxMaterial", scene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.reflectionTexture = new Texture(cielUrl, scene);
        skyboxMaterial.reflectionTexture.coordinatesMode = Texture.FIXED_EQUIRECTANGULAR_MODE;
        skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
        skyboxMaterial.specularColor = new Color3(0, 0, 0);
        skybox.material = skyboxMaterial;

        skybox.rotation.y = Math.PI;

        return scene;
    }

    #initializePhysics(scene) {
        const hk = new HavokPlugin(true, this.#havokInstance);
        scene.enablePhysics(new Vector3(0, -9.81, 0), hk);
    }

   #createCamera(scene) {
    this.#gameCamera = new FollowCamera("camera1", new Vector3(0, 10.85, -10), scene);
    this.#gameCamera.heightOffset = 12; // 🔥 plus haut
    this.#gameCamera.radius = 18;        // 🔥 plus éloigné
    this.#gameCamera.cameraAcceleration = 0.1; // 🔥 plus réactif
    this.#gameCamera.maxCameraSpeed = 5;       // 🔥 plus fluide
    this.#gameCamera.rotationOffset = 180;
}


    #createLights(scene) {
        const sunlight = new DirectionalLight("sunlight", new Vector3(-1, -2, -1), scene);
        sunlight.intensity = 0.6;
        sunlight.diffuse = new Color3(1, 0.95, 0.85);
        sunlight.specular = new Color3(0.9, 0.9, 0.9);
        sunlight.shadowEnabled = true;

        this.#shadowGenerator = new ShadowGenerator(1024, sunlight);
        this.#shadowGenerator.useBlurExponentialShadowMap = true;
        this.#shadowGenerator.blurKernel = 32;
        this.#shadowGenerator.setDarkness(0.2);

        const ambientLight = new HemisphericLight("ambientLight", new Vector3(0, 1, 0), scene);
        ambientLight.intensity = 0.6;
        ambientLight.diffuse = new Color3(0.7, 0.8, 1);
        ambientLight.specular = new Color3(0.5, 0.5, 0.5);
    }

    #createGround(scene) {
        const ground = MeshBuilder.CreateGround("ground", { width: 640, height: 640 }, scene);
        ground.checkCollisions = true;
        const matGround = new StandardMaterial("boue", scene);
        matGround.diffuseTexture = new Texture(cielUrl, scene);
        ground.material = matGround;
        ground.receiveShadows = true;
        new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }

    #addBeds(scene) {
        const radius = 6;
        const angleStep = (2 * Math.PI) / 5;

        for (let i = 0; i < 5; i++) {
            const angle = i * angleStep;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const mark = MeshBuilder.CreateDisc("mark" + i, { radius: 1.1 }, scene);
            mark.position = new Vector3(x, 10.01, z);
            mark.rotation.x = Math.PI / 2;

            const matZone = new StandardMaterial("zoneMaterial" + i, scene);
            matZone.diffuseColor = new Color3(0.8, 0, 0);
            mark.material = matZone;

            mark.isPickable = false;
            mark.checkCollisions = false;

            const detectBox = MeshBuilder.CreateBox("detectZone" + i, { width: 2.2, height: 1.2, depth: 2.2 }, scene);
            detectBox.position = new Vector3(x, 10.6, z);
            detectBox.isVisible = false;
            detectBox.checkCollisions = false;
            detectBox.metadata = {
                isPlayerInside: false,
                occupiedBy: null,
                occupiedAt: null,
                label: null
            };

            this.#beds.push({ mark, detectBox });
        }
    }

    #createCorridor(scene) {
        const margin = 2;
        const size = 2 * (6 + margin);

        const corridor = MeshBuilder.CreateBox("corridor", {
            width: size,
            height: 10,
            depth: size,
        }, scene);

        corridor.position = new Vector3(0, 5, 0);
        const corridorMaterial = new StandardMaterial("corridorMaterial", scene);
        corridorMaterial.alpha = 0;
        corridor.material = corridorMaterial;
        corridor.checkCollisions = true;
        new PhysicsAggregate(corridor, PhysicsShapeType.BOX, { mass: 0 }, scene);

        const walls = [
            { name: "leftWall", pos: new Vector3(-(size / 2) - 0.5, 7.5, 0), width: 1, height: 15, depth: size },
            { name: "rightWall", pos: new Vector3((size / 2) + 0.5, 7.5, 0), width: 1, height: 15, depth: size },
            { name: "frontWall", pos: new Vector3(0, 7.5, (size / 2) + 0.5), width: size, height: 15, depth: 1 },
            { name: "backWall", pos: new Vector3(0, 7.5, -(size / 2) - 0.5), width: size, height: 15, depth: 1 },
        ];

        for (const wall of walls) {
            const box = MeshBuilder.CreateBox(wall.name, { width: wall.width, height: wall.height, depth: wall.depth }, scene);
            box.position = wall.pos;
            box.material = corridorMaterial;
            box.checkCollisions = true;
            new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0 }, scene);
        }
    }

    async #getInitializedHavok() {
        return await HavokPhysics();
    }

    async #initGame() {
        this.#havokInstance = await this.#getInitializedHavok();
        this.#gameScene = this.#createScene();

        this.#player = new Player(-2, 10.85, 0, this.#gameScene);
        await this.#player.init();

        this.#botplayer = new BotPlayer(2, 10.85, 0, this.#gameScene);
        await this.#botplayer.init();

        this.#gameCamera.lockedTarget = this.#player.transform;
        this.#shadowGenerator.addShadowCaster(this.#player.gameObject, true);
        this.#initInput();
    }

    #initInput() {
        this.#gameScene.onKeyboardObservable.add((kbInfo) => {
            switch (kbInfo.type) {
                case KeyboardEventTypes.KEYDOWN:
                    this.inputMap[kbInfo.event.code] = true;
                    break;
                case KeyboardEventTypes.KEYUP:
                    this.inputMap[kbInfo.event.code] = false;
                    this.actions[kbInfo.event.code] = true;
                    break;
            }
        });
    }

    #toggleInspector() {
        this.#bInspector = !this.#bInspector;
        if (this.#bInspector) {
            this.#gameScene.debugLayer.show();
        } else {
            this.#gameScene.debugLayer.hide();
        }
    }

    #captureBedIfPossible(playerName, playerMesh) {
        if (!this.#canCapture) return;
    
        for (let bed of this.#beds) {
            const horizontalDist = Vector3.Distance(
                new Vector3(playerMesh.position.x, 0, playerMesh.position.z),
                new Vector3(bed.detectBox.position.x, 0, bed.detectBox.position.z)
            );
    
            const verticalDist = Math.abs(playerMesh.position.y - bed.detectBox.position.y);
    
            if (horizontalDist < 1.5 && verticalDist < 2.0) {
                // 🔥 NE CAPTURER QUE SI PERSONNE N'A CAPTURÉ ENCORE
                if (bed.detectBox.metadata.occupiedBy === null) {
                    if (playerName === "boy") {
                        bed.mark.material.diffuseColor = new Color3(0.2, 0.4, 1);
                        bed.detectBox.metadata.occupiedBy = "boy";
                    } else if (playerName === "girl") {
                        bed.mark.material.diffuseColor = new Color3(1, 0.4, 0.7);
                        bed.detectBox.metadata.occupiedBy = "girl";
                    }
                }
                break;
            }
        }
    }
    #checkVictory() {
        if (this.#scoreBoy >= 3 || this.#scoreGirl >= 3) {
            if (this.#scoreBoy !== this.#scoreGirl) {
                const winner = this.#scoreBoy > this.#scoreGirl ? "Boy" : "Girl";
    
                // Afficher panneau victoire
                document.getElementById('congratsText').textContent = '🎉 Félicitations!';
                document.getElementById('winnerText').textContent = `${winner} Partie gagnée par !`;
    
                this.#victoryDiv.style.display = 'block';
                setTimeout(() => {
                    this.#victoryDiv.style.opacity = '1';
                    this.#victoryDiv.style.transform = 'translate(-50%, -50%) scale(1)';
                }, 50);
    
                return true; // Gagnant trouvé
            }
        }
        return false; // Pas encore de gagnant
    }
    
    
    
    #gameLoop() {
        const divFps = document.getElementById("fps");
        this.#engine.runRenderLoop(() => {
            this.#updateGame();
            if (this.inputMap["KeyI"]) {
                this.#toggleInspector();
                this.inputMap["KeyI"] = false;
            }
            divFps.innerHTML = `${this.#engine.getFps().toFixed()} fps`;
            this.#gameScene.render();
        });
    }

    #updateGame() {
        const delta = this.#engine.getDeltaTime() / 1000.0;
        this.#player.update(this.inputMap, this.actions, delta);
        this.#botplayer.update(this.inputMap, this.actions, delta);

        this.#captureBedIfPossible("boy", this.#player.transform);
        this.#captureBedIfPossible("girl", this.#botplayer.transform);

        this.actions = {};
    }

    #createEndGameUI() {
        this.#endGameDiv = document.createElement('div');
        this.#endGameDiv.style = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.95);
            background: linear-gradient(135deg, #1e1e1e, #292929);
            padding: 40px;
            border-radius: 20px;
            color: #f0f0f0;
            text-align: center;
            display: none;
            z-index: 20;
            font-family: 'Segoe UI', sans-serif;
            box-shadow: 0 8px 16px rgba(0,0,0,0.6);
            transition: all 0.4s ease;
            max-width: 500px;
        `;
    
        // Texte du score ou "Prêt à commencer"
        const scoreText = document.createElement('p');
        scoreText.id = 'scoreText';
        scoreText.style = `
            margin-bottom: 25px;
            font-size: 22px;
            line-height: 1.4;
        `;
        this.#endGameDiv.appendChild(scoreText);
    
        // 🔥 NOUVEAU : Ajout du texte Commandes + Objectif
        const controlsAndObjectiveText = document.createElement('p');
        controlsAndObjectiveText.innerHTML = `
            <strong>Commandes :</strong><br>
            - Tourner : J<br>
            - Avancer : W<br>
            - Reculer : S<br>
            - Aller à gauche : A<br>
            - Aller à droite : D<br><br>
            <strong>Objectif :</strong><br>
            - Tourner pendant la musique 🎵.<br>
            - Quand la musique s'arrête, capture une zone rouge !<br>
            - 1 zone = 1 point.<br>
            - Le premier à 3 points gagne 🏆.
        `;
        controlsAndObjectiveText.style = `
            margin-bottom: 25px;
            font-size: 17px;
            color: #dddddd;
            line-height: 1.6;
        `;
        this.#endGameDiv.appendChild(controlsAndObjectiveText);
    
        // Bouton Next Round
        const continueButton = document.createElement('button');
        continueButton.textContent = 'Go';
        continueButton.onclick = () => this.#continueGame();
        continueButton.style = `
            padding: 12px 30px;
            font-size: 18px;
            background: #4caf50;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.3s ease;
        `;
        continueButton.onmouseover = () => continueButton.style.background = '#45a049';
        continueButton.onmouseout = () => continueButton.style.background = '#4caf50';
        this.#endGameDiv.appendChild(continueButton);
    
        // Ajouter le panneau à la page
        document.body.appendChild(this.#endGameDiv);
    }
    
    #createVictoryUI() {
        this.#victoryDiv = document.createElement('div');
        this.#victoryDiv.style = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.8);
            background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
            padding: 50px;
            border-radius: 20px;
            color: #ffffff;
            text-align: center;
            display: none;
            z-index: 30;
            font-family: 'Segoe UI', sans-serif;
            box-shadow: 0 12px 24px rgba(0,0,0,0.7);
            transition: all 0.5s ease;
            opacity: 0;
        `;
    
        const congratsText = document.createElement('h1');
        congratsText.id = 'congratsText';
        congratsText.style = `
            font-size: 36px;
            margin-bottom: 20px;
        `;
        this.#victoryDiv.appendChild(congratsText);
    
        const winnerText = document.createElement('p');
        winnerText.id = 'winnerText';
        winnerText.style = `
            font-size: 24px;
            margin-bottom: 30px;
        `;
        this.#victoryDiv.appendChild(winnerText);
    
        const playAgainButton = document.createElement('button');
        playAgainButton.textContent = 'Rejouer';
        playAgainButton.onclick = () => location.reload();
        playAgainButton.style = `
            padding: 14px 32px;
            font-size: 18px;
            background: #4caf50;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.3s ease;
        `;
        playAgainButton.onmouseover = () => playAgainButton.style.background = '#45a049';
        playAgainButton.onmouseout = () => playAgainButton.style.background = '#4caf50';
        this.#victoryDiv.appendChild(playAgainButton);
    
        document.body.appendChild(this.#victoryDiv);
    }
    
    

    async #continueGame() {
        this.#endGameDiv.style.display = 'none';
        this.#round++;
    
        if (this.#checkVictory()) {
            return; // Si quelqu'un a gagné, on arrête ici
        }
    
        await this.#startNewRound(); // Sinon, on lance le round suivant
    }
    
    #showScorePanel() {
        this.#scoreBoy = 0;
        this.#scoreGirl = 0;
    
        for (let bed of this.#beds) {
            if (bed.detectBox.metadata.occupiedBy === "boy") this.#scoreBoy++;
            if (bed.detectBox.metadata.occupiedBy === "girl") this.#scoreGirl++;
        }
    
        const scoreText = document.getElementById('scoreText');
        scoreText.innerHTML = `Round ${this.#round}<br>Boy : ${this.#scoreBoy} zones<br>Girl : ${this.#scoreGirl} zones`;
    
        this.#endGameDiv.style.display = 'block';
    }
    
    async #startNewRound() {
        if (this.#round > 1) {
            this.#player.transform.position = new Vector3(-2, 10.85, 0);
            this.#botplayer.transform.position = new Vector3(2, 10.85, 0);
        }
    
        await SoundManager.init(this.#gameScene, son);
        SoundManager.stopMusicRandomly(30000);
    
        this.#canCapture = false;
    
        // 🔥 NE FAIRE TOURNER QUE LA FILLE
        this.#botplayer.jogInCircle();
    
        SoundManager.onMusicEnded(() => {
            console.log("🎵 Musique terminée !");
            this.#canCapture = true;
    
            this.#botplayer.stopJogCircle();
            this.#botplayer.goToNearestBedAndCelebrate(this.#beds);
    
            setTimeout(() => {
                this.#showScorePanel();
            }, 4000);
        });
    
        this.actions = {};
    }
    
}

export default Game;
