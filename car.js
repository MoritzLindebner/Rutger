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
    image.onload = () => { holder.img = this._removeBg(image); };
    image.onerror = () => console.warn(`[Car] Sprite nicht gefunden: ${src}`);
    image.src = src;
    return holder;
  }

  _removeBg(img) {
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
    return oc;
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

  _renderPlaceholder(ctx, y) {
    const wobX = this.highEffect ? Math.sin(this.wobble) * 4 : 0;

    // Karosserie (Cabrio – offen oben)
    ctx.fillStyle = '#cc2244';
    ctx.fillRect(this.x + wobX, y + 20, CAR_W, CAR_H - 20);

    // Windschutzscheibe
    ctx.fillStyle = '#aaddff55';
    ctx.fillRect(this.x + wobX + 8, y + 22, CAR_W - 16, 20);

    // Motorhaube
    ctx.fillStyle = '#aa1133';
    ctx.fillRect(this.x + wobX + 4, y, CAR_W - 8, 22);

    // Räder
    ctx.fillStyle = '#111';
    ctx.fillRect(this.x + wobX - 5, y + 25,  10, 18);
    ctx.fillRect(this.x + wobX + CAR_W - 5, y + 25, 10, 18);
    ctx.fillRect(this.x + wobX - 5, y + CAR_H - 28, 10, 18);
    ctx.fillRect(this.x + wobX + CAR_W - 5, y + CAR_H - 28, 10, 18);

    // Susi (Fahrerin, links)
    ctx.fillStyle = '#ff69b4';
    ctx.fillRect(this.x + wobX + 8,  y + 28, 22, 26);
    ctx.fillStyle = '#ffe0a0';
    ctx.fillRect(this.x + wobX + 12, y + 20, 14, 14);

    // Rutger (Beifahrer, rechts)
    ctx.fillStyle = '#4a9eff';
    ctx.fillRect(this.x + wobX + CAR_W - 30, y + 28, 22, 26);
    ctx.fillStyle = '#ffe0a0';
    ctx.fillRect(this.x + wobX + CAR_W - 26, y + 20, 14, 14);

    // Grillz (kleine goldene Zähne bei Rutger)
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(this.x + wobX + CAR_W - 22, y + 31, 6, 2);
  }
}

// ── Gegenverkehr ───────────────────────────────────────────────────────────
const TRAFFIC_COLORS = ['#cc3333', '#dddddd', '#3366cc', '#ccaa00', '#229922', '#884499'];

export class TrafficCar {
  constructor(lane, speed) {
    this.lane  = lane;
    this.w     = 60;
    this.h     = 100;
    this.x     = laneCenterX(lane) - this.w / 2;
    this.y     = -this.h - 20;
    this.speed = speed + (Math.random() - 0.5) * 40; // ±20px/s Variation
    this.color = TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];
    this.colorDark = this._darken(this.color);
  }

  _darken(hex) {
    // Einfaches Abdunkeln für Dach/Details
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r*0.6)},${Math.floor(g*0.6)},${Math.floor(b*0.6)})`;
  }

  update(dt) {
    this.y += this.speed * (dt / 1000);
  }

  isOffScreen() {
    return this.y > CANVAS_H + 20;
  }

  /** AABB-Kollision mit Spieler-Hitbox */
  collidesWith(player) {
    const px = player.hitboxX;
    const py = player.hitboxY;
    return (
      px < this.x + this.w &&
      px + HITBOX_W > this.x &&
      py < this.y + this.h &&
      py + player.h > this.y
    );
  }

  render(ctx) {
    const x = this.x;
    const y = this.y;

    // Karosserie
    ctx.fillStyle = this.color;
    ctx.fillRect(x, y + 15, this.w, this.h - 15);

    // Dach
    ctx.fillStyle = this.colorDark;
    ctx.fillRect(x + 6, y, this.w - 12, 22);

    // Heckscheibe (unten, weil Gegenverkehr)
    ctx.fillStyle = '#aaddff44';
    ctx.fillRect(x + 8, y + 17, this.w - 16, 14);

    // Rücklichter
    ctx.fillStyle = '#ff3300';
    ctx.fillRect(x + 3,           y + this.h - 12, 10, 7);
    ctx.fillRect(x + this.w - 13, y + this.h - 12, 10, 7);

    // Räder
    ctx.fillStyle = '#111';
    ctx.fillRect(x - 5, y + 18, 9, 16);
    ctx.fillRect(x + this.w - 4, y + 18, 9, 16);
    ctx.fillRect(x - 5, y + this.h - 28, 9, 16);
    ctx.fillRect(x + this.w - 4, y + this.h - 28, 9, 16);
  }
}

// ── Spawn-System ───────────────────────────────────────────────────────────
export class TrafficSpawner {
  constructor() {
    this.interval    = 1500;  // ms zwischen Spawns
    this.minInterval = 500;
    this.timer       = 0;
    this.lastLane    = -1;
    this.elapsed     = 0;    // Gesamtspielzeit für Eskalation
  }

  update(dt, speed) {
    this.timer   += dt;
    this.elapsed += dt;

    // Alle 10s: Interval sinkt um 80ms
    const reduction = Math.floor(this.elapsed / 10_000) * 80;
    this.interval = Math.max(this.minInterval, 1500 - reduction);

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
    return new TrafficCar(lane, speed);
  }
}
