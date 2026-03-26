// game.js – Hit The Road Jack – Endless Runner

import { Audio }          from './audio.js';
import { Road, CANVAS_W, CANVAS_H } from './road.js';
import { PlayerCar, TrafficCar, TrafficSpawner, PLAYER_Y } from './car.js';
import { Item, ItemSpawner, EffectManager } from './items.js';
import { UI } from './ui.js';
import { initFirebase, getUsername, setUsername, submitScore } from './firebase.js';

// ── Konstanten ─────────────────────────────────────────────────────────────
const BASE_SPEED      = 300;   // px/s beim Start
const MAX_SPEED       = 900;   // px/s Maximum
const SPEED_ACCEL     = 8;     // px/s² Beschleunigung
const BASE_SCORE_RATE = 60;    // Punkte/s bei Basis-Geschwindigkeit

// ── States ─────────────────────────────────────────────────────────────────
const STATE = { MENU: 'MENU', PLAYING: 'PLAYING', GAME_OVER: 'GAME_OVER' };

// ── Canvas ─────────────────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');
canvas.width  = CANVAS_W;
canvas.height = CANVAS_H;

// ── Game State ──────────────────────────────────────────────────────────────
let state       = STATE.MENU;
let road        = null;
let playerCar   = null;
let trafficCars = [];
let items       = [];
let spawner     = null;
let itemSpawner = null;
let effects     = null;
let speed       = BASE_SPEED;
let score       = 0;
let highScore   = parseInt(localStorage.getItem('htrj_highscore') || '0', 10);

// ── Input ───────────────────────────────────────────────────────────────────
let touchStartX = null;
let lastLaneInput = 0; // Cooldown um doppel-inputs zu verhindern

function setupInput() {
  // Tastatur
  window.addEventListener('keydown', e => {
    if (state !== STATE.PLAYING) return;
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') tryChangeLane(-1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') tryChangeLane(1);
  });

  // Touch – Swipe
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;

    if (state === STATE.PLAYING && Math.abs(dx) > 40) {
      tryChangeLane(dx > 0 ? 1 : -1);
    }
  }, { passive: false });
}

function tryChangeLane(dir) {
  const now = Date.now();
  if (now - lastLaneInput < 150) return; // 150ms Cooldown
  lastLaneInput = now;
  playerCar.changeLane(dir);
}

// ── UI-Buttons ──────────────────────────────────────────────────────────────
let pendingScore = 0;

function setupUI() {
  UI.init();

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-retry').addEventListener('click', () => {
    state = STATE.MENU;
    UI.showMenu();
  });
  document.getElementById('btn-leaderboard').addEventListener('click', () => {
    UI.showLeaderboard();
  });
  document.getElementById('btn-lb-close').addEventListener('click', () => {
    UI.hideLeaderboard();
  });

  // Username-Prompt: OK-Button + Enter
  document.getElementById('btn-username-ok').addEventListener('click', handleUsernameSubmit);
  document.getElementById('username-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleUsernameSubmit();
  });
}

async function handleUsernameSubmit() {
  const input = document.getElementById('username-input');
  const name = input.value.trim();
  if (!name) return;

  await setUsername(name);
  UI.hideUsernamePrompt();

  // Jetzt den ausstehenden Score submitten
  if (pendingScore > 0) {
    submitScore(pendingScore);
  }

  UI.showGameOver(score, highScore, pendingScore >= Math.floor(highScore) && pendingScore > 0);
}

// ── Spiel vorinitialisieren (während Menü läuft) ─────────────────────────────
function initGame() {
  road        = new Road();
  playerCar   = new PlayerCar();
  trafficCars = [];
  items       = [];
  spawner     = new TrafficSpawner();
  itemSpawner = new ItemSpawner();
  effects     = new EffectManager();
  speed       = BASE_SPEED;
  score       = 0;
}

// ── Spiel starten (nur State wechseln, alles ist schon bereit) ───────────────
function startGame() {
  // Reset falls es ein Retry ist
  initGame();
  effects.reset(canvas);

  // Musik starten (bereits geladen weil Howler bei init vorlädt)
  Audio.startMusic();

  state = STATE.PLAYING;
  UI.showHUD();
  UI.updateScore(0, highScore);
  UI.updateEffects(effects);
}

// ── Update ───────────────────────────────────────────────────────────────────
function update(dt) {
  // Im Menü kein Road-Update – Sprite-Hintergrund
  if (state === STATE.MENU) return;

  if (state !== STATE.PLAYING) return;

  // Geschwindigkeit erhöhen
  speed = Math.min(MAX_SPEED, speed + SPEED_ACCEL * (dt / 1000));

  // Straße scrollen
  road.update(dt, speed);

  // Spielerauto
  playerCar.update(dt);

  // Effekte
  effects.update(dt, canvas);

  // Score
  score += BASE_SCORE_RATE * effects.totalMultiplier * (speed / BASE_SPEED) * (dt / 1000);
  if (score > highScore) highScore = score;
  UI.updateScore(score, highScore);
  UI.updateEffects(effects);

  // Gegenverkehr spawnen
  const newCar = spawner.update(dt, speed);
  if (newCar) trafficCars.push(newCar);

  // Gegenverkehr updaten + Kollision
  for (let i = trafficCars.length - 1; i >= 0; i--) {
    const car = trafficCars[i];
    car.update(dt);

    if (!effects.isInvincible && car.collidesWith(playerCar)) {
      triggerGameOver();
      return;
    }

    if (car.isOffScreen()) trafficCars.splice(i, 1);
  }

  // Items spawnen
  const newItem = itemSpawner.update(dt, speed);
  if (newItem) items.push(newItem);

  // Items updaten + Pickup
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    item.update(dt);

    if (!item.collected && item.collidesWith(playerCar)) {
      item.collect();
      effects.activate(item.type);
      if (item.type === 'joint') score += 3000;
      Audio.play(item.type === 'star' ? 'star' : item.type === 'joint' ? 'joint' : 'collect');
    }

    // Entfernen wenn Animation fertig oder außerhalb
    if (item.isOffScreen() || (item.collected && item.animT > 500)) {
      items.splice(i, 1);
    }
  }
}

function triggerGameOver() {
  state = STATE.GAME_OVER;
  Audio.stopMusic();
  Audio.play('crash');
  effects.reset(canvas);

  const finalScore = Math.floor(score);
  const isNewRecord = finalScore >= Math.floor(highScore) && finalScore > 0;

  // Highscore lokal speichern
  if (finalScore > 0) {
    localStorage.setItem('htrj_highscore', String(Math.floor(highScore)));
  }

  // Wenn noch kein Username: Prompt zeigen, Score merken
  if (!getUsername()) {
    pendingScore = finalScore;
    UI.showUsernamePrompt();
    return;
  }

  // Username vorhanden: Score direkt submitten
  submitScore(finalScore);
  UI.showGameOver(score, highScore, isNewRecord);
}

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  if (road && (state === STATE.PLAYING || state === STATE.GAME_OVER)) {
    road.render(ctx);

    // Items (hinter Autos)
    for (const item of items) item.render(ctx);

    // Gegenverkehr (während Blur: ausgeblendet)
    ctx.save();
    ctx.globalAlpha = effects ? effects.trafficOpacity : 1;
    for (const car of trafficCars) car.render(ctx);
    ctx.restore();

    // Spielerauto
    playerCar.render(ctx, effects);

    // Geschwindigkeitsanzeige (klein, unten)
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font      = '10px Courier New';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.floor(speed)} km/h`, CANVAS_W - 12, CANVAS_H - 12);
  }
}

// ── Game Loop ────────────────────────────────────────────────────────────────
let lastTimestamp = 0;

function gameLoop(timestamp) {
  const dt = Math.min(timestamp - lastTimestamp, 100);
  lastTimestamp = timestamp;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

// ── Responsive Scaling ───────────────────────────────────────────────────────
function scaleGame() {
  const container = document.getElementById('game-container');
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const scaleX = vw / CANVAS_W;
  const scaleY = vh / CANVAS_H;
  const scale  = Math.min(scaleX, scaleY);
  const scaledH = CANVAS_H * scale;
  const offsetY = Math.max(0, (vh - scaledH) / 2);
  container.style.transform = `translate(0, ${offsetY}px) scale(${scale})`;
}

// ── Preloader ─────────────────────────────────────────────────────────────────
const PRELOAD_ASSETS = [
  'assets/sprites/menu-bg.png',
  'assets/sprites/cabrio.png',
  'assets/sprites/cabrio-smoken.png',
  'assets/sprites/joint.png',
  'assets/sprites/diskokugel.png',
  'assets/sprites/traffic-blue.png',
  'assets/sprites/traffic-red.png',
  'assets/sprites/traffic-orange.png',
  'assets/sprites/traffic-taxi.png',
  'assets/sprites/traffic-firetruck.png',
  'assets/sprites/traffic-pickup.png',
];

function preloadAssets(onDone) {
  const bar     = document.getElementById('loading-bar');
  const label   = document.getElementById('loading-label');
  const total   = PRELOAD_ASSETS.length;
  let   loaded  = 0;

  function onProgress() {
    loaded++;
    const pct = Math.round((loaded / total) * 100);
    bar.style.width   = `${pct}%`;
    label.textContent = `${pct}%`;
    if (loaded >= total) {
      setTimeout(onDone, 200); // kurze Pause damit 100% sichtbar ist
    }
  }

  for (const src of PRELOAD_ASSETS) {
    const img = new Image();
    img.onload  = onProgress;
    img.onerror = onProgress; // trotzdem weitermachen wenn eine Datei fehlt
    img.src     = src;
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────────
function bootGame() {
  const container = document.getElementById('game-container');
  container.classList.remove('hidden');

  scaleGame();
  window.addEventListener('resize', scaleGame);
  setupInput();
  setupUI();

  // Firebase sofort starten (Auth läuft im Hintergrund)
  initFirebase();

  preloadAssets(() => {
    initGame();
    document.getElementById('loading-screen').classList.add('hidden');
    UI.showMenu();
  });
  requestAnimationFrame(gameLoop);
}

window.addEventListener('DOMContentLoaded', () => {
  const consentScreen = document.getElementById('consent-screen');

  // Consent schon akzeptiert?
  if (localStorage.getItem('htrj_consent') === '1') {
    consentScreen.classList.add('hidden');
    bootGame();
    return;
  }

  // Auf OK warten
  document.getElementById('btn-consent').addEventListener('click', () => {
    localStorage.setItem('htrj_consent', '1');
    consentScreen.classList.add('hidden');
    bootGame();
  });
});
