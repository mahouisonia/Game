// src/SoundManager.js
import { Sound } from "@babylonjs/core/Audio/sound";

class SoundManager {
    static backgroundMusic = null;

    static async init(scene, musicUrl) {
        this.backgroundMusic = new Sound(
            "backgroundMusic",
            musicUrl,
            scene,
            () => {
                this.backgroundMusic.loop = true;
                this.backgroundMusic.setVolume(0.6);
                this.backgroundMusic.play();
            },
            { autoplay: false }
        );
    }

    static toggleMusic() {
        if (!this.backgroundMusic) return;

        if (this.backgroundMusic.isPlaying) {
            this.backgroundMusic.pause();
        } else {
            this.backgroundMusic.play();
        }
    }

    static stopMusic() {
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
        }
    }

    static onMusicEnded(callback) {
        if (this.backgroundMusic) {
            this.backgroundMusic.onEndedObservable.addOnce(() => {
                callback();
            });
        }
    }

    static stopMusicRandomly(durationMs = 6000) {
        const startSafeZone = 5000; // 10 secondes
        const endSafeZone = durationMs;
        const availableTime = endSafeZone - startSafeZone;

        const randomStopTime = startSafeZone + Math.random() * availableTime;

        console.log(`🎵 La musique s'arrêtera à ${Math.floor(randomStopTime / 1000)} secondes.`);

        setTimeout(() => {
            if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
                this.backgroundMusic.stop();
            }
        }, randomStopTime);
    }
}

export default SoundManager;
