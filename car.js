// car.js – Spielerauto (Cabrio) + Gegenverkehr

import { CANVAS_H, LANE_COUNT, LANE_WIDTH, ROAD_LEFT, laneCenterX } from './road.js';

export const PLAYER_Y    = 580;   // Y-Position des Spielerautos
const CAR_W              = 200;
const CAR_H              = 200;
const HITBOX_W           = 100;   // schmaler als Sprite für faireres Gefühl
const LANE_CHANGE_SPEED  = 8;     // Lerp-Faktor pro Frame (höher = schneller)

// ── Spielerauto ────────────────────────────────────────────────────────────
export class PlayerCar {
  constructor() {
    this.lane    = 1;
    this.x       = laneCenterX(1) - CAR_W / 2;
    this.targetX = this.x;
    this.w       = CAR_W;
    this.h       = CAR_H;
    this.sprite  = null;
    this.invincible     = false;
    this.invincibleTime = 0;
    this.highEffect     = false;
    this.wobble         = 0;
    this._loadSprite();
  }

  _loadSprite() {
    this.sprite       = this._loadAndProcess('assets/sprites/cabrio.png');
    this.spriteSmoken = this._loadAndProcess('assets/sprites/cabrio-smoken.png');
  }

  _loadAndProcess(src) {
    const holder = { img: null };
    const image  = new Image();
    image.onload = () => { holder.img = _removeBgHQ(image, CAR_W, CAR_H); };
    image.onerror = () => console.warn(`[Car] Sprite nicht gefunden: ${src}`);
    image.src = src;
    return holder;
  }

  get hitboxX() { return this.x + (CAR_W - HITBOX_W) / 2; }
  get hitboxY() { return PLAYER_Y; }

  changeLane(dir) {
    const next = this.lane + dir;
    if (next < 0 || next >= LANE_COUNT) return;
    this.lane    = next;
    this.targetX = laneCenterX(next) - CAR_W / 2;
  }

  update(dt) {
    // Smooth lane change (lerp)
    this.x += (this.targetX - this.x) * Math.min(1, LANE_CHANGE_SPEED * dt / 1000 * 10);

    // Timers
    if (this.invincibleTime > 0) {
      this.invincibleTime -= dt;
      if (this.invincibleTime <= 0) this.invincible = false;
    }

    if (this.highEffect) {
      this.wobble += dt / 200;
    }
  }

  activateInvincible(ms = 5000) {
    this.invincible     = true;
    this.invincibleTime = ms;
  }

  activateHigh() {
    this.highEffect = true;
    this.wobble     = 0;
  }

  deactivateHigh() {
    this.highEffect = false;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./items.js').EffectManager} effects
   */
  render(ctx, effects) {
    const y   = PLAYER_Y;
    const cx  = this.x + CAR_W / 2;
    const cy  = y + CAR_H / 2;

    // Welches Sprite?
    const useSmoking = effects?.isSmoking && this.spriteSmoken?.img;
    const spriteObj  = useSmoking ? this.spriteSmoken : this.sprite;
    const spr        = spriteObj?.img || null;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Spin-Animation (Diskokugel) – Glow + Rotation in einem ctx.save Block
    if (effects?.isSpinning) {
      const progress = 1 - effects.spinTime / 3000;
      const angle    = progress * Math.PI * 8; // 4 volle Drehungen
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.translate(-cx, -cy);
    }

    // Regenbogen-Glow als shadowBlur (dreht mit, kein Rechteck sichtbar)
    if (effects?.isInvincible) {
      const t   = Date.now() / 150;
      const hue = (t * 60) % 360;
      ctx.shadowColor = `hsla(${hue}, 100%, 70%, 0.9)`;
      ctx.shadowBlur  = 20;
    }

    if (spr) {
      ctx.drawImage(spr, this.x, y, CAR_W, CAR_H);
    } else {
      ctx.fillStyle = '#cc2244';
      ctx.fillRect(this.x, y, CAR_W, CAR_H);
    }

    ctx.restore();
  }
}

// ── Gegenverkehr (Sprite-basiert) ─────────────────────────────────────────
const TRAFFIC_TYPES = [
  { src: 'assets/sprites/traffic-blue.png',      w: 200, h: 310, hitW: 105 },
  { src: 'assets/sprites/traffic-red.png',       w: 200, h: 310, hitW: 105 },
  { src: 'assets/sprites/traffic-orange.png',    w: 200, h: 310, hitW: 105 },
  { src: 'assets/sprites/traffic-taxi.png',      w: 200, h: 310, hitW: 105 },
  { src: 'assets/sprites/traffic-firetruck.png', w: 210, h: 330, hitW: 110 },
  { src: 'assets/sprites/traffic-pickup.png',    w: 205, h: 320, hitW: 105 },
];

// Shared sprite cache – geladen einmal, geteilt zwischen allen Instanzen
const _spriteCache = {};

function _removeBgHQ(img, targetW, targetH) {
  // BG-Removal auf voller Auflösung für beste Qualität
  const oc   = document.createElement('canvas');
  oc.width   = img.width;
  oc.height  = img.height;
  const octx = oc.getContext('2d');
  octx.drawImage(img, 0, 0);
  const id = octx.getImageData(0, 0, oc.width, oc.height);
  const d  = id.data;
  const w  = oc.width, h = oc.height;
  const visited = new Uint8Array(w * h);
  const queue   = [];
  const isWhite = i => d[i] > 220 && d[i+1] > 220 && d[i+2] > 220;
  for (let x = 0; x < w; x++) { queue.push(x, 0); queue.push(x, h-1); }
  for (let y = 0; y < h; y++) { queue.push(0, y); queue.push(w-1, y); }
  let qi = 0;
  while (qi < queue.length) {
    const px = queue[qi++], py = queue[qi++];
    if (px < 0 || py < 0 || px >= w || py >= h) continue;
    const idx = py * w + px;
    if (visited[idx]) continue;
    visited[idx] = 1;
    const di = idx * 4;
    if (!isWhite(di)) continue;
    d[di + 3] = 0;
    queue.push(px+1, py, px-1, py, px, py+1, px, py-1);
  }
  octx.putImageData(id, 0, 0);
  // Smooth downscale auf Zielgröße
  const sc   = document.createElement('canvas');
  sc.width   = targetW;
  sc.height  = targetH;
  const sctx = sc.getContext('2d');
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(oc, 0, 0, targetW, targetH);
  return sc;
}

function _removeBgAndScale(img, targetW, targetH) {
  // 1) Erst auf kleine Arbeitsgröße skalieren (spart Flood-Fill-Arbeit)
  const sc   = document.createElement('canvas');
  sc.width   = targetW;
  sc.height  = targetH;
  const sctx = sc.getContext('2d');
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(img, 0, 0, targetW, targetH);

  // 2) Flood-Fill auf der kleinen Version
  const id = sctx.getImageData(0, 0, targetW, targetH);
  const d  = id.data;
  const w  = targetW, h = targetH;
  const visited = new Uint8Array(w * h);
  const queue   = [];
  const isWhite = i => d[i] > 220 && d[i+1] > 220 && d[i+2] > 220;
  for (let x = 0; x < w; x++) { queue.push(x, 0); queue.push(x, h-1); }
  for (let y = 0; y < h; y++) { queue.push(0, y); queue.push(w-1, y); }
  let qi = 0;
  while (qi < queue.length) {
    const px = queue[qi++], py = queue[qi++];
    if (px < 0 || py < 0 || px >= w || py >= h) continue;
    const idx = py * w + px;
    if (visited[idx]) continue;
    visited[idx] = 1;
    const di = idx * 4;
    if (!isWhite(di)) continue;
    d[di + 3] = 0;
    queue.push(px+1, py, px-1, py, px, py+1, px, py-1);
  }
  sctx.putImageData(id, 0, 0);
  return sc;
}

function _getSprite(src, targetW, targetH) {
  const key = src;
  if (!_spriteCache[key]) {
    const holder = { img: null };
    const image  = new Image();
    image.onload = () => { holder.img = _removeBgAndScale(image, targetW, targetH); };
    image.src = src;
    _spriteCache[key] = holder;
  }
  return _spriteCache[src];
}

export class TrafficCar {
  constructor(lane, speed, typeIdx) {
    const type = TRAFFIC_TYPES[typeIdx];
    this.lane   = lane;
    this.w      = type.w;
    this.h      = type.h;
    this.hitW   = type.hitW;
    this.x      = laneCenterX(lane) - this.w / 2;
    this.y      = -this.h - 20;
    this.speed  = speed + (Math.random() - 0.5) * 40;
    this.sprite = _getSprite(type.src, type.w, type.h);
  }

  update(dt) {
    this.y += this.speed * (dt / 1000);
  }

  isOffScreen() {
    return this.y > CANVAS_H + 20;
  }

  collidesWith(player) {
    const px = player.hitboxX;
    const py = player.hitboxY;
    const tx = this.x + (this.w - this.hitW) / 2;
    return (
      px < tx + this.hitW &&
      px + HITBOX_W > tx &&
      py < this.y + this.h &&
      py + player.h > this.y
    );
  }

  render(ctx) {
    ctx.imageSmoothingEnabled = false;
    const spr = this.sprite?.img;
    if (spr) {
      ctx.drawImage(spr, this.x, this.y, this.w, this.h);
    } else {
      ctx.fillStyle = '#444';
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
  }
}

// ── Spawn-System ───────────────────────────────────────────────────────────
export class TrafficSpawner {
  constructor() {
    this.interval    = 2200;
    this.minInterval = 800;
    this.timer       = 0;
    this.lastLane    = -1;
    this.elapsed     = 0;
  }

  update(dt, speed) {
    this.timer   += dt;
    this.elapsed += dt;

    const reduction = Math.floor(this.elapsed / 10_000) * 80;
    this.interval = Math.max(this.minInterval, 2200 - reduction);

    if (this.timer >= this.interval) {
      this.timer = 0;
      return this._spawn(speed);
    }
    return null;
  }

  _spawn(speed) {
    let lane;
    do {
      lane = Math.floor(Math.random() * LANE_COUNT);
    } while (lane === this.lastLane);
    this.lastLane = lane;

    // Zufälliger Fahrzeugtyp, alle gleiche Wahrscheinlichkeit
    const typeIdx = Math.floor(Math.random() * TRAFFIC_TYPES.length);
    return new TrafficCar(lane, speed, typeIdx);
  }
}
