import {
    MeshBuilder,
    PhysicsAggregate,
    PhysicsMotionType,
    PhysicsShapeType,
    SceneLoader,
    Vector3
} from "@babylonjs/core";

import robotModelUrl from "../assets/models/boyAnimSucces.glb";

const RUNNING_SPEED = 8;
const PLAYER_HEIGHT = 1.7;

class Player {
    scene;
    transform;
    gameObject;
    capsuleAggregate;

    animationsGroup;
    idleAnim;
    runAnim;
    standToSitAnim;

    bWalking = false;
    _circleObserver = null;
    isJogging = false;

    x = 0.0;
    y = 0.0;
    z = 0.0;

    speedX = 0.0;
    speedY = 0.0;
    speedZ = 0.0;

    constructor(x, y, z, scene) {
        this.scene = scene;
        this.x = x || 0.0;
        this.y = y || 0.0;
        this.z = z || 0.0;

        this.transform = MeshBuilder.CreateCapsule("player", { height: PLAYER_HEIGHT, radius: 0.4 }, this.scene);
        this.transform.visibility = 0.0;
        this.transform.position = new Vector3(this.x, this.y, this.z);
    }

    async init() {
        const result = await SceneLoader.ImportMeshAsync("", "", robotModelUrl, this.scene);
        this.gameObject = result.meshes[0];
        this.gameObject.scaling = new Vector3(1.5, 1.5, 1.5);
        this.gameObject.position = new Vector3(0, -PLAYER_HEIGHT / 2, 0);
        this.gameObject.rotate(Vector3.UpReadOnly, Math.PI);
        this.gameObject.bakeCurrentTransformIntoVertices();
        this.gameObject.checkCollisions = true;

        this.capsuleAggregate = new PhysicsAggregate(
            this.transform,
            PhysicsShapeType.CAPSULE,
            { mass: 1, restitution: 0 },
            this.scene
        );

        this.capsuleAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
        this.capsuleAggregate.body.setMassProperties({
            inertia: new Vector3(0, 0, 0),
        });

        this.gameObject.parent = this.transform;
        this.animationsGroup = result.animationGroups;
        this.animationsGroup[0].stop();

        this.idleAnim = this.scene.getAnimationGroupByName('idle');
        this.runAnim = this.scene.getAnimationGroupByName('runBoy');

        this.idleAnim.start(true, 1.0, this.idleAnim.from, this.idleAnim.to, false);
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

            if (this._circleObserver) {
                this.scene.onBeforeRenderObservable.remove(this._circleObserver);
            }

            let angle = 0;
            const radius = 4; // Plus grand pour le garçon
            const center = new Vector3(0, 10.85, 0); // Parfaitement centré
            

            this._circleObserver = this.scene.onBeforeRenderObservable.add(() => {
                const dt = this.scene.getEngine().getDeltaTime() / 1000;
                angle += dt * 1.5;

                const x = center.x + Math.cos(angle) * radius;
                const z = center.z + Math.sin(angle) * radius;

                this.transform.position.x = x;
                this.transform.position.z = z;

                const dx = -Math.sin(angle);
                const dz = Math.cos(angle);

                const velocity = new Vector3(dx, 0, dz).scale(RUNNING_SPEED);
                const currentVelocity = this.capsuleAggregate.body.getLinearVelocity();
                this.capsuleAggregate.body.setLinearVelocity(new Vector3(velocity.x, currentVelocity.y, velocity.z));

                const direction = new Vector3(dx, 0, dz);
                const target = this.gameObject.position.add(direction);
                this.gameObject.lookAt(target);
            });

            this.isJogging = true;
        }
    }

    stopJogCircle() {
        if (this._circleObserver) {
            this.scene.onBeforeRenderObservable.remove(this._circleObserver);
            this._circleObserver = null;
        }

        if (this.isJogging) {
            this.isJogging = false;

            this.capsuleAggregate.body.setLinearVelocity(Vector3.Zero());
            this.capsuleAggregate.body.setAngularVelocity(Vector3.Zero());

            if (this.runAnim) this.runAnim.stop();
            if (this.idleAnim) this.idleAnim.start(true, 1.0, this.idleAnim.from, this.idleAnim.to, false);

            this.bWalking = false;
        }
    }

    update(inputMap, actions, delta) {
        if (this.isJogging) {
            if (inputMap["KeyW"] || inputMap["KeyA"] || inputMap["KeyS"] || inputMap["KeyD"] || inputMap["KeyE"]) {
                this.stopJogCircle();
                return;
            }
        }

        if (inputMap["KeyJ"] && !this.isJogging) {
            this.jogInCircle();
            return;
        }

        if (inputMap["KeyA"]) {
            this.speedX = -RUNNING_SPEED;
        } else if (inputMap["KeyD"]) {
            this.speedX = RUNNING_SPEED;
        } else {
            this.speedX += (-10.0 * this.speedX * delta);
        }

        if (inputMap["KeyW"]) {
            this.speedZ = RUNNING_SPEED;
        } else if (inputMap["KeyS"]) {
            this.speedZ = -RUNNING_SPEED;
        } else {
            this.speedZ += (-10.0 * this.speedZ * delta);
        }

        let currentVelocity = this.capsuleAggregate.body.getLinearVelocity();
        currentVelocity = new Vector3(this.speedX, currentVelocity.y, this.speedZ);
        this.capsuleAggregate.body.setLinearVelocity(currentVelocity);

        let directionXZ = new Vector3(this.speedX, 0, this.speedZ);

        if (directionXZ.length() > 2.5) {
            this.gameObject.lookAt(directionXZ.normalize());

            if (!this.bWalking) {
                this.runAnim.start(true, 1.0, this.runAnim.from, this.runAnim.to, false);
                this.bWalking = true;
            }
        } else {
            if (this.bWalking) {
                this.runAnim.stop();
                this.idleAnim.start(true, 1.0, this.idleAnim.from, this.idleAnim.to, false);
                this.bWalking = false;
            }
        }
    }
}

export default Player;
