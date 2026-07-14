// items.js – Sammelobjekte: Diskokugel, Joint, Multiplikatoren

import { CANVAS_H, LANE_COUNT, laneCenterX } from './road.js';

const ITEM_SIZE = 80;

// x2-Multiplikatoren stapeln multiplikativ (2 → 4 → 8 …), gedeckelt.
const X2_MAX_MULT = 8;

const SPAWN_WEIGHTS = [
  { type: 'x2',       weight: 40 },
  { type: 'joint',    weight: 30 },
  { type: 'star',     weight: 20 },
  { type: 'lipstick', weight: 20 },
  { type: 'micro',    weight: 20 },
  { type: 'beer',     weight: 25 },
];

export const EFFECT_DURATION = {
  star:       5000,
  jointSmoke: 3000,  // Phase 1: Rutger raucht
  jointBlur:  6000,  // Phase 2: Sicht verschwimmt
  x2:         12000, // Punkte-Verdopplung
  lipstick:   7000,  // rote Fahrbahn + unverwundbar + fast Vollgas
  micro:      6000,  // Schockwelle: alle Autos aus dem Bild + Musiknoten
  beerDrunk:  6000,  // Bier Phase 1: betrunken (Schlingern + träge Lenkung)
  beerSick:   2500,  // Bier Phase 2: übel (nur Optik, kurz nach dem Effekt)
  mega:      10000,  // 1-Mio-Meilenstein: 3. Person + Schockwelle bläst alle Autos weg
};

// ── Sprite-Loader ──────────────────────────────────────────────────────────
function loadSprite(src) {
  const img = new Image();
  img.src = src;
  return img;
}

const SPRITES = {
  joint:    loadSprite('assets/sprites/joint.png'),
  star:     loadSprite('assets/sprites/diskokugel.png'),
  lipstick: loadSprite('assets/sprites/lipstick.jpeg'),
  x2:       loadSprite('assets/sprites/x2.jpeg'),
  micro:    loadSprite('assets/sprites/microphone.jpeg'),
  beer:     loadSprite('assets/sprites/beer.jpeg'),
};

// Fit-Modus pro Sprite: 'stretch' (ganzes Bild auf 80x80) oder
// 'contain' (auf Motiv zuschneiden + seitenverhältnis-erhaltend einpassen).
const SPRITE_FIT = {
  lipstick: 'contain', // schmales Motiv in breitem Rahmen → sonst gequetscht
  x2:       'contain', // breites Logo → sonst gequetscht
  micro:    'contain', // schmales Mikrofon in breitem Rahmen → sonst gequetscht
  beer:     'contain', // schmale Flasche in breitem Rahmen → sonst gequetscht
};

function removeWhiteBg(img, fit = 'stretch') {
  // BG-Removal auf gedeckelter Arbeitsauflösung: erst klein skalieren (längere
  // Kante ≤ WORK_MAX), dann Flood-Fill + BBox-Scan. Ausgabe bleibt ITEM_SIZE (80).
  const srcW = img.naturalWidth  || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW) return img;
  const WORK_MAX = 256;
  const scaleWork = Math.min(1, WORK_MAX / Math.max(srcW, srcH));
  const oc = document.createElement('canvas');
  oc.width  = Math.max(1, Math.round(srcW * scaleWork));
  oc.height = Math.max(1, Math.round(srcH * scaleWork));
  const octx = oc.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(img, 0, 0, oc.width, oc.height);
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

  // Zielcanvas
  const sc = document.createElement('canvas');
  sc.width  = ITEM_SIZE;
  sc.height = ITEM_SIZE;
  const sctx = sc.getContext('2d');
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';

  if (fit === 'contain') {
    // Bounding-Box der sichtbaren (nicht-transparenten) Pixel bestimmen
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (px[(y * w + x) * 4 + 3] !== 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX >= minX && maxY >= minY) {
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      // Seitenverhältnis-erhaltend in ITEM_SIZE einpassen, zentriert
      const scale = Math.min(ITEM_SIZE / bw, ITEM_SIZE / bh);
      const dw = bw * scale;
      const dh = bh * scale;
      const dx = (ITEM_SIZE - dw) / 2;
      const dy = (ITEM_SIZE - dh) / 2;
      sctx.drawImage(oc, minX, minY, bw, bh, dx, dy, dw, dh);
      return sc;
    }
    // Fallback: nichts gefunden → wie stretch
  }

  // Smooth downscale des ganzen Bildes auf Zielgröße
  sctx.drawImage(oc, 0, 0, ITEM_SIZE, ITEM_SIZE);
  return sc;
}

// Gecachte verarbeitete Sprites
const _processed = {};
function getSprite(key) {
  if (!_processed[key] && SPRITES[key]?.complete && SPRITES[key].naturalWidth > 0) {
    _processed[key] = removeWhiteBg(SPRITES[key], SPRITE_FIT[key] || 'stretch');
  }
  return _processed[key] || null;
}

// Zuletzt gespawnter Typ – dessen Gewicht wird stark gedämpft, damit gleiche
// Items nur sehr selten direkt hintereinander kommen (mehr Mix, aber weiterhin
// zufällig – nicht komplett ausgeschlossen).
let _lastType = null;
const REPEAT_WEIGHT_FACTOR = 0.12; // ~1/8 der normalen Chance für Wiederholung

// Freigestelltes Sprite als Data-URL fürs HUD-Badge (gecacht). type == sprite-key
// ('star','joint','lipstick','x2','micro','beer'). null solange noch nicht geladen.
const _spriteURLs = {};
export function spriteDataURL(type) {
  if (_spriteURLs[type]) return _spriteURLs[type];
  const spr = getSprite(type);
  if (!spr || typeof spr.toDataURL !== 'function') return null;
  _spriteURLs[type] = spr.toDataURL();
  return _spriteURLs[type];
}

function pickType() {
  const weighted = SPAWN_WEIGHTS.map(w => ({
    type:   w.type,
    weight: w.type === _lastType ? w.weight * REPEAT_WEIGHT_FACTOR : w.weight,
  }));
  const total = weighted.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  let picked = 'x2';
  for (const w of weighted) {
    r -= w.weight;
    if (r <= 0) { picked = w.type; break; }
  }
  _lastType = picked;
  return picked;
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

  update(dt, speedScale = 1) {
    if (this.collected) { this.animT += dt; return; }
    this.y    += this.speed * speedScale * (dt / 1000);
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
    // Diskokugel + Lippenstift drehen sich; x2 wippt sanft (bleibt lesbar)
    if (this.type === 'star' || this.type === 'lipstick') ctx.rotate(this.rotT * 0.5);
    else if (this.type === 'x2' || this.type === 'micro' || this.type === 'beer') ctx.rotate(Math.sin(this.rotT * 1.5) * 0.18);
    this._draw(ctx);
    ctx.restore();
  }

  _draw(ctx) {
    const s   = this.w;
    const s2  = s / 2;
    const sprKey = this.type === 'star' ? 'star'
                 : this.type === 'joint' ? 'joint'
                 : this.type === 'lipstick' ? 'lipstick'
                 : this.type === 'x2' ? 'x2'
                 : this.type === 'micro' ? 'micro'
                 : this.type === 'beer' ? 'beer'
                 : null;
    const spr = getSprite(sprKey);

    if (spr) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(spr, -s2, -s2, s, s);
      return;
    }

    // Fallback Canvas-Kreise (solange Sprite lädt)
    const colors = { star: '#c0c0c0', joint: '#00c853', x2: '#ffb000', lipstick: '#e11d3a', micro: '#a855f7', beer: '#c9a66b' };
    const labels = { star: '🪩',       joint: '🌿',      x2: '×2',      lipstick: '💄',      micro: '🎤',      beer: '🍺' };
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
  _next() { return 5000 + Math.random() * 4000; }

  update(dt, speed, trafficCars = []) {
    this.timer += dt;
    if (this.timer < this.interval) return null;

    const lane = this._pickFreeLane(trafficCars);
    if (lane === -1) {
      // Alle Spuren oben durch Verkehr belegt – kurz warten, dann neu versuchen
      this.timer = this.interval - 250;
      return null;
    }
    this.timer    = 0;
    this.interval = this._next();
    return new Item(lane, speed);
  }

  // Spur wählen, die im oberen Spawn-Bereich frei von Gegenverkehr ist,
  // damit Items nicht in Autos spawnen.
  _pickFreeLane(trafficCars) {
    const blocked = new Set();
    for (const car of trafficCars) {
      // Auto überlappt die Spawn-Zone nahe dem oberen Rand?
      if (car.y < 260 && car.y + car.h > -120) blocked.add(car.lane);
    }
    const free = [];
    for (let l = 0; l < LANE_COUNT; l++) {
      if (!blocked.has(l)) free.push(l);
    }
    if (free.length === 0) return -1;
    return free[Math.floor(Math.random() * free.length)];
  }
}

// ── Effekt-Manager ─────────────────────────────────────────────────────────
export class EffectManager {
  constructor() {
    this.starTime    = 0;
    this.spinTime    = 0;   // Auto dreht sich (direkt nach Diskokugel)
    this.jointSmoke  = 0;   // Phase 1: Smoken-Sprite
    this.jointBlur   = 0;   // Phase 2: Blur-Effekt
    this.lipTime     = 0;   // Lippenstift: rote Fahrbahn + unverwundbar + Vollgas
    this.microTime   = 0;   // Mikrofon: Schockwelle wirft alle Autos aus dem Bild
    this.beerDrunk   = 0;   // Bier Phase 1: betrunken (Handicap)
    this.beerSick    = 0;   // Bier Phase 2: übel (Optik)
    this.megaTime    = 0;   // 1-Mio-Meilenstein: Mega-Schockwelle + 3. Person
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
        // Stapelbar: jedes eingesammelte x2 verdoppelt erneut (bis X2_MAX_MULT)
        this.multiplier = Math.min(this.multiplier * 2, X2_MAX_MULT);
        this.multTime   = EFFECT_DURATION.x2;
        break;
      case 'lipstick':
        this.lipTime = EFFECT_DURATION.lipstick;
        break;
      case 'micro':
        this.microTime = EFFECT_DURATION.micro;
        break;
      case 'beer':
        this.beerDrunk = EFFECT_DURATION.beerDrunk;
        this.beerSick  = 0; // startet wenn betrunken endet
        break;
      case 'mega':
        this.megaTime = EFFECT_DURATION.mega;
        break;
    }
  }

  get isInvincible()   { return this.starTime > 0 || this.lipTime > 0 || this.microTime > 0 || this.megaTime > 0; }
  get isMega()         { return this.megaTime > 0; }
  get isStar()         { return this.starTime > 0; }
  get isLipstick()     { return this.lipTime > 0; }
  get isMicro()        { return this.microTime > 0; }
  get isDrunk()        { return this.beerDrunk > 0; }
  get isSick()         { return this.beerSick > 0; }
  get isSmoking()      { return this.jointSmoke > 0; }
  get isBlurred()      { return this.jointBlur > 0; }
  get isSpinning()     { return this.spinTime > 0; }
  get totalMultiplier(){ return this.multiplier * (this.isBlurred || this.isSmoking ? 2 : 1); }

  // Rest-Anteil 0–1 pro Effekt (1 = gerade eingesammelt, 0 = gleich vorbei).
  // Für den Timer-Kreis im HUD. Zweiphasige Effekte (Joint/Bier) laufen über
  // ihre Gesamtdauer weiter, damit der Kreis nicht zwischendurch springt.
  get megaFrac()  { return Math.max(0, Math.min(1, this.megaTime  / EFFECT_DURATION.mega)); }
  get starFrac()  { return Math.max(0, Math.min(1, this.starTime  / EFFECT_DURATION.star)); }
  get lipFrac()   { return Math.max(0, Math.min(1, this.lipTime   / EFFECT_DURATION.lipstick)); }
  get microFrac() { return Math.max(0, Math.min(1, this.microTime / EFFECT_DURATION.micro)); }
  get multFrac()  { return Math.max(0, Math.min(1, this.multTime  / EFFECT_DURATION.x2)); }
  get beerFrac()  {
    const total = EFFECT_DURATION.beerDrunk + EFFECT_DURATION.beerSick;
    const rem   = this.beerDrunk > 0 ? this.beerDrunk + EFFECT_DURATION.beerSick : this.beerSick;
    return Math.max(0, Math.min(1, rem / total));
  }
  get jointFrac() {
    const total = EFFECT_DURATION.jointSmoke + EFFECT_DURATION.jointBlur;
    const rem   = this.jointSmoke > 0 ? this.jointSmoke + EFFECT_DURATION.jointBlur : this.jointBlur;
    return Math.max(0, Math.min(1, rem / total));
  }

  /** Gibt 0–1 zurück: wie stark der Verkehr ausgeblendet wird (während Blur) */
  get trafficOpacity() {
    if (!this.isBlurred) return 1;
    return 0.25 + 0.2 * Math.sin(Date.now() / 300); // flackert zwischen 0.05–0.45
  }

  update(dt, canvas) {
    if (this.starTime > 0) this.starTime = Math.max(0, this.starTime - dt);
    if (this.spinTime > 0) this.spinTime = Math.max(0, this.spinTime - dt);
    if (this.lipTime  > 0) this.lipTime  = Math.max(0, this.lipTime  - dt);
    if (this.microTime > 0) this.microTime = Math.max(0, this.microTime - dt);

    // Bier Phase 1 (betrunken) → Phase 2 (übel)
    if (this.beerDrunk > 0) {
      this.beerDrunk -= dt;
      if (this.beerDrunk <= 0) {
        this.beerDrunk = 0;
        this.beerSick  = EFFECT_DURATION.beerSick; // Phase 2 starten
      }
    }
    if (this.beerSick > 0) this.beerSick = Math.max(0, this.beerSick - dt);
    if (this.megaTime > 0) this.megaTime = Math.max(0, this.megaTime - dt);

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
    this.lipTime    = 0;
    this.microTime  = 0;
    this.beerDrunk  = 0;
    this.beerSick   = 0;
    this.megaTime   = 0;
    this.multiplier = 1;
    this.multTime   = 0;
    canvas.style.filter    = '';
    canvas.style.transform = '';
  }
}
