// items.js – Sammelobjekte: Diskokugel, Joint, Multiplikatoren

import { CANVAS_H, LANE_COUNT, laneCenterX } from './road.js';

const ITEM_SIZE = 64;

const SPAWN_WEIGHTS = [
  { type: 'x2',    weight: 40 },
  { type: 'joint', weight: 30 },
  { type: 'star',  weight: 20 },
  { type: 'x3',    weight: 10 },
];

export const EFFECT_DURATION = {
  star:       5000,
  jointSmoke: 3000,  // Phase 1: Rutger raucht
  jointBlur:  6000,  // Phase 2: Sicht verschwimmt
  x2:         8000,
  x3:         6000,
};

// ── Sprite-Loader ──────────────────────────────────────────────────────────
function loadSprite(src) {
  const img = new Image();
  img.src = src;
  return img;
}

const SPRITES = {
  joint:  loadSprite('assets/sprites/joint.png'),
  star:   loadSprite('assets/sprites/diskokugel.png'),
};

function removeWhiteBg(img) {
  const oc = document.createElement('canvas');
  oc.width  = img.naturalWidth  || img.width;
  oc.height = img.naturalHeight || img.height;
  if (!oc.width) return img; // noch nicht geladen
  const octx = oc.getContext('2d');
  octx.drawImage(img, 0, 0);
  const d = octx.getImageData(0, 0, oc.width, oc.height);
  const px = d.data;
  const w = oc.width, h = oc.height;
  const visited = new Uint8Array(w * h);
  const queue = [];
  const isWhite = i => px[i] > 220 && px[i+1] > 220 && px[i+2] > 220;
  for (let x = 0; x < w; x++) { queue.push(x, 0); queue.push(x, h-1); }
  for (let y = 0; y < h; y++) { queue.push(0, y); queue.push(w-1, y); }
  let qi = 0;
  while (qi < queue.length) {
    const qx = queue[qi++], qy = queue[qi++];
    if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
    const idx = qy * w + qx;
    if (visited[idx]) continue;
    visited[idx] = 1;
    if (!isWhite(idx * 4)) continue;
    px[idx * 4 + 3] = 0;
    queue.push(qx+1, qy, qx-1, qy, qx, qy+1, qx, qy-1);
  }
  octx.putImageData(d, 0, 0);
  return oc;
}

// Gecachte verarbeitete Sprites
const _processed = {};
function getSprite(key) {
  if (!_processed[key] && SPRITES[key]?.complete && SPRITES[key].naturalWidth > 0) {
    _processed[key] = removeWhiteBg(SPRITES[key]);
  }
  return _processed[key] || null;
}

function pickType() {
  const total = SPAWN_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const w of SPAWN_WEIGHTS) {
    r -= w.weight;
    if (r <= 0) return w.type;
  }
  return 'x2';
}

// ── Item ───────────────────────────────────────────────────────────────────
export class Item {
  constructor(lane, speed) {
    this.type      = pickType();
    this.lane      = lane;
    this.x         = laneCenterX(lane) - ITEM_SIZE / 2;
    this.y         = -ITEM_SIZE - 20;
    this.w         = ITEM_SIZE;
    this.h         = ITEM_SIZE;
    this.speed     = speed;
    this.collected = false;
    this.animT     = 0;
    this.bobT      = 0;
    this.rotT      = 0; // für Diskokugel-Rotation
  }

  update(dt) {
    if (this.collected) { this.animT += dt; return; }
    this.y    += this.speed * (dt / 1000);
    this.bobT += dt / 600;
    this.rotT += dt / 1000;
  }

  isOffScreen()  { return this.y > CANVAS_H + 20; }

  collidesWith(player) {
    const px = player.hitboxX;
    const py = player.hitboxY;
    return px < this.x + this.w && px + 50 > this.x &&
           py < this.y + this.h && py + player.h > this.y;
  }

  collect() { this.collected = true; this.animT = 0; }

  render(ctx) {
    const bob = this.collected ? 0 : Math.sin(this.bobT) * 4;

    if (this.collected) {
      const t = Math.min(this.animT / 400, 1);
      if (t >= 1) return;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
      ctx.scale(1 + t * 0.6, 1 + t * 0.6);
      this._draw(ctx);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2 + bob);
    // Diskokugel dreht sich langsam
    if (this.type === 'star') ctx.rotate(this.rotT * 0.5);
    this._draw(ctx);
    ctx.restore();
  }

  _draw(ctx) {
    const s   = this.w;
    const s2  = s / 2;
    const spr = getSprite(this.type === 'star' ? 'star' : this.type === 'joint' ? 'joint' : null);

    if (spr) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(spr, -s2, -s2, s, s);
      return;
    }

    // Fallback Canvas-Kreise (solange Sprite lädt)
    const colors = { star: '#c0c0c0', joint: '#00c853', x2: '#ff00cc', x3: '#ff6600' };
    const labels = { star: '🪩',       joint: '🌿',      x2: '×2',     x3: '×3' };
    ctx.fillStyle   = colors[this.type] || '#fff';
    ctx.shadowColor = colors[this.type] || '#fff';
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.arc(0, 0, s2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur   = 0;
    ctx.fillStyle    = '#fff';
    ctx.font         = `bold ${s * 0.45}px Courier New`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[this.type] || '?', 0, 0);
  }
}

// ── Item-Spawner ───────────────────────────────────────────────────────────
export class ItemSpawner {
  constructor() {
    this.timer    = 0;
    this.interval = this._next();
  }
  _next() { return 4000 + Math.random() * 3000; }
  update(dt, speed) {
    this.timer += dt;
    if (this.timer >= this.interval) {
      this.timer    = 0;
      this.interval = this._next();
      return new Item(Math.floor(Math.random() * LANE_COUNT), speed);
    }
    return null;
  }
}

// ── Effekt-Manager ─────────────────────────────────────────────────────────
export class EffectManager {
  constructor() {
    this.starTime    = 0;
    this.spinTime    = 0;   // Auto dreht sich (direkt nach Diskokugel)
    this.jointSmoke  = 0;   // Phase 1: Smoken-Sprite
    this.jointBlur   = 0;   // Phase 2: Blur-Effekt
    this.multiplier  = 1;
    this.multTime    = 0;
    this._blurVal    = 0;
    this._wobble     = 0;
  }

  activate(type) {
    switch (type) {
      case 'star':
        this.starTime = EFFECT_DURATION.star;
        this.spinTime = 3000; // 3s Drehung
        break;
      case 'joint':
        this.jointSmoke = EFFECT_DURATION.jointSmoke;
        this.jointBlur  = 0; // startet wenn smoke endet
        break;
      case 'x2':
        this.multiplier = Math.max(this.multiplier, 2);
        this.multTime   = EFFECT_DURATION.x2;
        break;
      case 'x3':
        this.multiplier = Math.max(this.multiplier, 3);
        this.multTime   = EFFECT_DURATION.x3;
        break;
    }
  }

  get isInvincible()   { return this.starTime > 0; }
  get isSmoking()      { return this.jointSmoke > 0; }
  get isBlurred()      { return this.jointBlur > 0; }
  get isSpinning()     { return this.spinTime > 0; }
  get totalMultiplier(){ return this.multiplier * (this.isBlurred || this.isSmoking ? 2 : 1); }

  /** Gibt 0–1 zurück: wie stark der Verkehr ausgeblendet wird (während Blur) */
  get trafficOpacity() {
    if (!this.isBlurred) return 1;
    return 0.25 + 0.2 * Math.sin(Date.now() / 300); // flackert zwischen 0.05–0.45
  }

  update(dt, canvas) {
    if (this.starTime > 0) this.starTime = Math.max(0, this.starTime - dt);
    if (this.spinTime > 0) this.spinTime = Math.max(0, this.spinTime - dt);

    // Joint Phase 1 → Phase 2
    if (this.jointSmoke > 0) {
      this.jointSmoke -= dt;
      if (this.jointSmoke <= 0) {
        this.jointSmoke = 0;
        this.jointBlur  = EFFECT_DURATION.jointBlur; // Phase 2 starten
      }
    }

    // Joint Phase 2: Blur
    if (this.jointBlur > 0) {
      this.jointBlur -= dt;
      this._wobble   += dt / 400;
      const blurPx    = 4 + Math.sin(this._wobble) * 2;
      const wobblePx  = Math.sin(this._wobble * 1.3) * 3;
      canvas.style.filter    = `blur(${blurPx.toFixed(1)}px) saturate(1.4)`;
      canvas.style.transform = `translateX(${wobblePx.toFixed(1)}px)`;
      if (this.jointBlur <= 0) {
        canvas.style.filter    = '';
        canvas.style.transform = '';
      }
    }

    if (this.multTime > 0) {
      this.multTime -= dt;
      if (this.multTime <= 0) this.multiplier = 1;
    }
  }

  reset(canvas) {
    this.starTime   = 0;
    this.spinTime   = 0;
    this.jointSmoke = 0;
    this.jointBlur  = 0;
    this.multiplier = 1;
    this.multTime   = 0;
    canvas.style.filter    = '';
    canvas.style.transform = '';
  }
}
