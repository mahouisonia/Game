// src/BotPlayer.js
import {
    MeshBuilder,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
    SceneLoader,
    Vector3
} from "@babylonjs/core";

import girlUrl from "../assets/models/girl1.glb";

const RUNNING_SPEED = 8;
const PLAYER_HEIGHT = 1.7;

class BotPlayer {
    scene;
    transform;
    gameObject;
    capsuleAggregate;

    animationsGroup;
    idleAnim;
    runAnim;
    walkAnim;

    isJogging = false;
    angle = 0;

    center = new Vector3(-0.02, 10.85, 0);
    radius = 3;

    x = 0.0;
    y = 0.0;
    z = 0.0;

    constructor(x, y, z, scene) {
        this.scene = scene;
        this.x = x || 0.0;
        this.y = y || 0.0;
        this.z = z || 0.0;

        this.transform = MeshBuilder.CreateCapsule("botplayer", { height: PLAYER_HEIGHT, radius: 0.4 }, this.scene);
        this.transform.visibility = 0.0;
        this.transform.position = new Vector3(this.x, this.y, this.z);
    }

    async init() {
        const result = await SceneLoader.ImportMeshAsync("", "", girlUrl, this.scene);
        this.gameObject = result.meshes[0];

        this.gameObject.scaling = new Vector3(2.2, 2.2, 2.2);
        this.gameObject.position = new Vector3(0, -PLAYER_HEIGHT / 2, 0);
        this.gameObject.rotate(Vector3.UpReadOnly, Math.PI);
        this.gameObject.bakeCurrentTransformIntoVertices();
        this.gameObject.checkCollisions = true;

        this.capsuleAggregate = new PhysicsAggregate(
            this.transform,
            PhysicsShapeType.CAPSULE,
            { mass: 0 },
            this.scene
        );

        this.capsuleAggregate.body.setMotionType(PhysicsMotionType.KINEMATIC);

        this.gameObject.parent = this.transform;
        this.animationsGroup = result.animationGroups;
        this.animationsGroup.forEach(anim => anim.stop());

        this.idleAnim = this.scene.getAnimationGroupByName('Idle');
        this.runAnim = this.scene.getAnimationGroupByName('Running');
        this.walkAnim = this.scene.getAnimationGroupByName('Walking');

        if (this.idleAnim) {
            this.idleAnim.start(true, 1.0, this.idleAnim.from, this.idleAnim.to, false);
        }
    }

    stopAllAnimations() {
        if (this.animationsGroup) {
            this.animationsGroup.forEach(anim => anim.stop());
        }
    }

    jogInCircle() {
        if (this.runAnim) {
            this.stopAllAnimations();
            this.runAnim.start(true, 1.0, this.runAnim.from, this.runAnim.to, false);
        }
        this.isJogging = true;
        this.angle = 0;
    }

    stopJogCircle() {
        if (this.isJogging) {
            this.isJogging = false;
            if (this.runAnim) this.runAnim.stop();
            if (this.idleAnim) this.idleAnim.start(true, 1.0, this.idleAnim.from, this.idleAnim.to, false);
        }
    }

    update(inputMap, actions, delta) {
        if (inputMap["KeyR"] && !this.isJogging) {
            this.jogInCircle();
        }

        if (inputMap["KeyK"] && this.isJogging) {
            this.stopJogCircle();
        }

        if (this.isJogging) {
            this.angle += delta * 1.5;

            const x = this.center.x + Math.cos(this.angle) * this.radius;
            const z = this.center.z + Math.sin(this.angle) * this.radius;

            const previousPosition = this.transform.position.clone();
            this.transform.position.x = x;
            this.transform.position.z = z;

            // 🔥 Correction uniquement ici : ajuster la hauteur Y pendant le jogging
            this.transform.position.y = this.center.y + PLAYER_HEIGHT / 2;

            const movementDirection = this.transform.position.subtract(previousPosition);

            if (movementDirection.length() > 0.001) {
                this.gameObject.lookAt(this.gameObject.position.add(movementDirection.normalize()));
            }
        }
    }

    goToNearestBedAndCelebrate(beds) {
        if (!beds || beds.length === 0) return;

        this.stopJogCircle();

        this.transform.rotationQuaternion = null;
        this.transform.rotation = Vector3.Zero();
        this.gameObject.rotationQuaternion = null;
        this.gameObject.rotation = Vector3.Zero();

        this.capsuleAggregate.body.setMotionType(PhysicsMotionType.KINEMATIC);

        let closestBed = beds[0];
        let minDist = Vector3.Distance(this.transform.position, beds[0].detectBox.position);

        for (let i = 1; i < beds.length; i++) {
            const dist = Vector3.Distance(this.transform.position, beds[i].detectBox.position);
            if (dist < minDist) {
                minDist = dist;
                closestBed = beds[i];
            }
        }

        let isWalking = false;
        let currentSpeed = 0;
        const maxSpeed = 2;
        const acceleration = 2;

        const observer = this.scene.onBeforeRenderObservable.add(() => {
            const dt = this.scene.getEngine().getDeltaTime() / 1000;
            const direction = closestBed.detectBox.position.subtract(this.transform.position);
            const distance = direction.length();

            if (distance > 0.5) {
                direction.normalize();

                currentSpeed += acceleration * dt;
                if (currentSpeed > maxSpeed) currentSpeed = maxSpeed;

                this.transform.position.addInPlace(direction.scale(currentSpeed * dt));
                this.gameObject.lookAt(this.gameObject.position.add(direction));

                if (!isWalking && this.walkAnim) {
                    this.stopAllAnimations();
                    this.walkAnim.start(true, 1.0, this.walkAnim.from, this.walkAnim.to, false);
                    isWalking = true;
                }
            } else {
                this.scene.onBeforeRenderObservable.remove(observer);

                if (this.walkAnim) this.walkAnim.stop();
                if (this.idleAnim) this.idleAnim.start(true, 1.0, this.idleAnim.from, this.idleAnim.to, false);

                // 🔥 Quand elle arrive au lit, ajuster correctement hauteur Y
                this.transform.position.y = 10.85 + 0.9;
                this.gameObject.position = new Vector3(0, -PLAYER_HEIGHT / 2, 0);

                const victoryAnim = this.scene.getAnimationGroupByName("Victory");
                if (victoryAnim) {
                    victoryAnim.start(false, 1.0, victoryAnim.from, victoryAnim.to, false);
                }
            }
        });
    }
}

export default BotPlayer;
