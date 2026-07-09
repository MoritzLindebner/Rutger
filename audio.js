// audio.js – Howler.js wrapper für Hit The Road Jack

const SOUND_DEFS = {
  // WAV zuerst, MP3 als Fallback wenn User später konvertiert
  bgMusic:  { src: ['assets/audio/hit-the-road-jack.wav', 'assets/audio/hit-the-road-jack.mp3'], loop: true,  volume: 0.7 },
  crash:    { src: ['assets/audio/crash.mp3'],             loop: false, volume: 1.0 },
  collect:  { src: ['assets/audio/collect.mp3'],           loop: false, volume: 0.8 },
  joint:    { src: ['assets/audio/joint.mp3'],             loop: false, volume: 0.8 },
  star:     { src: ['assets/audio/star.mp3'],              loop: false, volume: 0.8 },
};

const sounds = {};

function initAudio() {
  for (const [key, def] of Object.entries(SOUND_DEFS)) {
    try {
      sounds[key] = new Howl({
        src: def.src,
        loop: def.loop,
        volume: def.volume,
        onloaderror: () => {
          console.warn(`[Audio] Datei nicht gefunden: ${def.src[0]}`);
          sounds[key] = null;
        },
      });
    } catch (e) {
      sounds[key] = null;
    }
  }
}

export const Audio = {
  init: initAudio,

  play(name) {
    sounds[name]?.play();
  },

  stop(name) {
    sounds[name]?.stop();
  },

  startMusic() {
    if (sounds.bgMusic && !sounds.bgMusic.playing()) {
      sounds.bgMusic.play();
    }
  },

  stopMusic() {
    sounds.bgMusic?.stop();
  },

  pauseMusic() {
    sounds.bgMusic?.pause();
  },

  resumeMusic() {
    if (sounds.bgMusic && !sounds.bgMusic.playing()) {
      sounds.bgMusic.play();
    }
  },

  stopAll() {
    for (const s of Object.values(sounds)) {
      s?.stop();
    }
  },
};

initAudio();
