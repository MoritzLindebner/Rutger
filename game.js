// game.js – Hit The Road Jack – Endless Runner

import { Audio }          from './audio.js';
import { Road, CANVAS_W, CANVAS_H } from './road.js';
import { PlayerCar, TrafficCar, TrafficSpawner, PLAYER_Y } from './car.js';
import { Item, ItemSpawner, EffectManager } from './items.js';
import { UI } from './ui.js';

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

  // Klick auf Menu-Screens auch auf Canvas weiterleiten (Fallback)
  canvas.addEventListener('click', e => {
    if (state === STATE.MENU) startGame();
  });
}

function tryChangeLane(dir) {
  const now = Date.now();
  if (now - lastLaneInput < 150) return; // 150ms Cooldown
  lastLaneInput = now;
  playerCar.changeLane(dir);
}

// ── UI-Buttons ──────────────────────────────────────────────────────────────
function setupUI() {
  UI.init();
  // Menu wird erst nach Preload gezeigt (siehe preloadAssets)

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-retry').addEventListener('click', () => {
    state = STATE.MENU;
    UI.showMenu();
  });
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
  // Straße scrollt auch im Menü (Hintergrundeffekt + warm-up)
  if (road && state === STATE.MENU) {
    road.update(dt, BASE_SPEED * 0.4);
    return;
  }

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

  // Highscore speichern
  if (finalScore > 0) {
    localStorage.setItem('htrj_highscore', String(Math.floor(highScore)));
  }

  UI.showGameOver(score, highScore, isNewRecord);
}

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  if (road && (state === STATE.PLAYING || state === STATE.GAME_OVER || state === STATE.MENU)) {
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
  const scaleX = window.innerWidth  / CANVAS_W;
  const scaleY = window.innerHeight / CANVAS_H;
  const scale  = Math.min(scaleX, scaleY);
  container.style.transform = `scale(${scale})`;
}

// ── Preloader ─────────────────────────────────────────────────────────────────
const PRELOAD_ASSETS = [
  'assets/sprites/cabrio.png',
  'assets/sprites/cabrio-smoken.png',
  'assets/sprites/joint.png',
  'assets/sprites/diskokugel.png',
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
window.addEventListener('DOMContentLoaded', () => {
  scaleGame();
  window.addEventListener('resize', scaleGame);
  setupInput();
  setupUI();

  preloadAssets(() => {
    initGame(); // alles vorinitialisieren während Menü angezeigt wird
    document.getElementById('loading-screen').classList.add('hidden');
    UI.showMenu();
  });
  requestAnimationFrame(gameLoop);
});
