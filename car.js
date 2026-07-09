// car.js – Spielerauto (Cabrio) + Gegenverkehr

import { CANVAS_W, CANVAS_H, LANE_COUNT, LANE_WIDTH, ROAD_LEFT, laneCenterX } from './road.js';

export const PLAYER_Y    = CANVAS_H - 220;   // Y-Position des Spielerautos (unten am Bildrand)
const CAR_W              = 200;
const CAR_H              = 200;
const HITBOX_W           = 100;   // schmaler als Sprite für faireres Gefühl
const HITBOX_INSET_TOP    = 16;   // Front (nach vorne): kleiner = Hitbox reicht weiter nach vorn
const HITBOX_INSET_BOTTOM = 26;   // Heck
const TRAFFIC_HITBOX_FRAC = 0.55; // Anteil der Sprite-Höhe, der beim Gegenverkehr kollidiert
const LANE_CHANGE_SPEED  = 8;     // Lerp-Faktor pro Frame (höher = schneller)

// Shared Cache für verarbeitete Spieler-Sprites (gekeyt per src), damit ein
// erneutes initGame() (Retry) die schwere BG-Entfernung nicht wiederholt.
const _playerSpriteCache = {};

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
    this.particles      = [];   // Partikel: Herzen (Lippenstift) / Noten (Mikrofon)
    this.particleTimer  = 0;
    this.drunkOffset    = 0;    // seitlicher Schlinger-Versatz (Bier)
    this.drunkPhase     = 0;
    this._loadSprite();
  }

  _loadSprite() {
    this.sprite          = this._loadAndProcess('assets/sprites/cabrio.png');
    this.spriteSmoken    = this._loadAndProcess('assets/sprites/cabrio-smoken.png');
    this.spriteSurprised = this._loadAndProcess('assets/sprites/cabrio-surprised.jpeg');
    this.spriteDisco     = this._loadAndProcess('assets/sprites/cabrio-disco.jpeg');
    this.spriteRap       = this._loadAndProcess('assets/sprites/cabrio-rap.jpeg');
    this.spriteDrink     = this._loadAndProcess('assets/sprites/cabrio-drink.jpeg');
    this.spriteSick      = this._loadAndProcess('assets/sprites/cabrio-sick.jpeg');
    this.spriteMega      = this._loadAndProcess('assets/sprites/cabrio-million.jpeg');
  }

  _loadAndProcess(src) {
    // Über Instanzen cachen: initGame() läuft beim Boot UND bei jedem Retry –
    // ohne Cache würden die 5 Spieler-Sprites jedes Mal neu verarbeitet.
    if (_playerSpriteCache[src]) return _playerSpriteCache[src];
    const holder = { img: null };
    const image  = new Image();
    image.onload = () => { holder.img = _removeBgHQ(image, CAR_W, CAR_H); };
    image.onerror = () => console.warn(`[Car] Sprite nicht gefunden: ${src}`);
    image.src = src;
    _playerSpriteCache[src] = holder;
    return holder;
  }

  get hitboxX() { return this.x + this.drunkOffset + (CAR_W - HITBOX_W) / 2; }
  get hitboxY() { return PLAYER_Y; }

  changeLane(dir) {
    const next = this.lane + dir;
    if (next < 0 || next >= LANE_COUNT) return;
    this.lane    = next;
    this.targetX = laneCenterX(next) - CAR_W / 2;
  }

  update(dt, effects) {
    // Smooth lane change (lerp) – während Betrunken (Bier) träger/übersteuert
    const laneMul = effects?.isDrunk ? 0.5 : 1;
    this.x += (this.targetX - this.x) * Math.min(1, LANE_CHANGE_SPEED * laneMul * dt / 1000 * 10);

    // Betrunken: Auto schlingert seitlich (Offset wirkt auf Hitbox + Render)
    if (effects?.isDrunk) this.drunkPhase += dt / 1000 * 2.2;
    const swayTarget = effects?.isDrunk
      ? (Math.sin(this.drunkPhase) + 0.5 * Math.sin(this.drunkPhase * 1.7)) * 22
      : 0;
    this.drunkOffset += (swayTarget - this.drunkOffset) * Math.min(1, dt / 1000 * 5);

    // Timers
    if (this.invincibleTime > 0) {
      this.invincibleTime -= dt;
      if (this.invincibleTime <= 0) this.invincible = false;
    }

    if (this.highEffect) {
      this.wobble += dt / 200;
    }

    // Partikel emittieren: Herzen (Lippenstift) oder Musiknoten (Mikrofon)
    const emit = effects?.isLipstick ? 'heart' : (effects?.isMicro || effects?.isMega) ? 'note' : null;
    if (emit) {
      this.particleTimer += dt;
      const rate = emit === 'heart' ? 90 : 120;
      while (this.particleTimer >= rate) {
        this.particleTimer -= rate;
        this._spawnParticle(emit);
      }
    }

    // Vorhandene Partikel bewegen + verblassen (auch nach Effektende)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.y   += p.vy * (dt / 1000);
      p.x   += p.vx * (dt / 1000);
      p.rot += p.vr * (dt / 1000);
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  _spawnParticle(kind) {
    const cx      = this.x + CAR_W / 2;
    const maxLife = 900 + Math.random() * 400;
    if (kind === 'note') {
      const COLORS = ['#a855f7', '#22d3ee', '#f472b6', '#facc15', '#4ade80'];
      const GLYPHS = ['♪', '♫', '♬', '♩'];
      const spread = CAR_W * 0.95;
      this.particles.push({
        kind:  'note',
        x:     cx + (Math.random() - 0.5) * spread,
        y:     PLAYER_Y + CAR_H * 0.3 + (Math.random() - 0.5) * CAR_H * 0.5,
        vy:    -50 - Math.random() * 60,           // aufsteigen
        vx:    (Math.random() - 0.5) * 90,         // seitlich wegschwirren
        vr:    (Math.random() - 0.5) * 3,
        rot:   (Math.random() - 0.5) * 0.8,
        size:  20 + Math.random() * 16,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        maxLife,
        life:  maxLife,
      });
      return;
    }
    // heart (Lippenstift)
    const COLORS = ['#ff2d5e', '#ff5c8a', '#e11d3a'];
    const spread = CAR_W * 0.55;
    this.particles.push({
      kind:    'heart',
      x:       cx + (Math.random() - 0.5) * spread,
      y:       PLAYER_Y + CAR_H * 0.45 + Math.random() * 30,
      vy:      -60 - Math.random() * 50,          // aufsteigen
      vx:      (Math.random() - 0.5) * 30,        // leichter Drift
      vr:      (Math.random() - 0.5) * 2,
      rot:     (Math.random() - 0.5) * 0.6,
      size:    10 + Math.random() * 10,
      color:   COLORS[Math.floor(Math.random() * COLORS.length)],
      maxLife,
      life:    maxLife,
    });
  }

  _renderParticles(ctx) {
    if (this.particles.length === 0) return;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.kind === 'note') {
        ctx.fillStyle    = p.color;
        ctx.shadowColor  = p.color;
        ctx.shadowBlur   = 8;
        ctx.font         = `bold ${p.size}px "Segoe UI Symbol", serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.glyph, 0, 0);
      } else {
        ctx.fillStyle = p.color;
        const s = p.size / 16;
        ctx.scale(s, s);
        // Herz-Pfad (Breite ~16, um 0 zentriert)
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.bezierCurveTo(0, 1, -8, -1, -8, 5);
        ctx.bezierCurveTo(-8, 10, -1, 13, 0, 16);
        ctx.bezierCurveTo(1, 13, 8, 10, 8, 5);
        ctx.bezierCurveTo(8, -1, 0, 1, 0, 5);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
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
    const dx  = this.x + this.drunkOffset;   // Schlinger-Versatz (Bier)
    const cx  = dx + CAR_W / 2;
    const cy  = y + CAR_H / 2;

    // Welches Sprite? Mega (3 Personen) > Mikro (rappt) > Lippenstift > Diskokugel > Bier > Joint > normal
    let spriteObj = this.sprite;
    if (effects?.isMega && this.spriteMega?.img) {
      spriteObj = this.spriteMega;
    } else if (effects?.isMicro && this.spriteRap?.img) {
      spriteObj = this.spriteRap;
    } else if (effects?.isLipstick && this.spriteSurprised?.img) {
      spriteObj = this.spriteSurprised;
    } else if (effects?.isStar && this.spriteDisco?.img) {
      spriteObj = this.spriteDisco;
    } else if (effects?.isDrunk && this.spriteDrink?.img) {
      spriteObj = this.spriteDrink;
    } else if (effects?.isSick && this.spriteSick?.img) {
      spriteObj = this.spriteSick;
    } else if (effects?.isSmoking && this.spriteSmoken?.img) {
      spriteObj = this.spriteSmoken;
    }
    const spr = spriteObj?.img || null;

    // Partikel (Herzen/Noten) hinter/um das Auto
    this._renderParticles(ctx);

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

    // Glow als shadowBlur (dreht mit, kein Rechteck sichtbar)
    if (effects?.isMega) {
      // Goldener Feier-Glow (1-Mio-Meilenstein)
      const t    = Date.now();
      const hue  = 45 + Math.sin(t / 150) * 10;
      const blur = 24 + Math.sin(t / 80) * 12;
      ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.95)`;
      ctx.shadowBlur  = blur;
    } else if (effects?.isMicro) {
      // Mikrofon-Glow: pulsierendes Violett ↔ Cyan (Bühnen-Vibe)
      const t    = Date.now();
      const hue  = 280 + Math.sin(t / 200) * 40;
      const blur = 20  + Math.sin(t / 90) * 10;
      ctx.shadowColor = `hsla(${hue}, 100%, 65%, 0.9)`;
      ctx.shadowBlur  = blur;
    } else if (effects?.isLipstick) {
      // Eigener Lippenstift-Glow: pulsierendes Rot ↔ Pink
      const t    = Date.now();
      const hue  = 340 + Math.sin(t / 300) * 12;
      const blur = 16  + Math.sin(t / 120) * 8;
      ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.9)`;
      ctx.shadowBlur  = blur;
    } else if (effects?.isInvincible) {
      // Regenbogen (nur Diskokugel)
      const t   = Date.now() / 150;
      const hue = (t * 60) % 360;
      ctx.shadowColor = `hsla(${hue}, 100%, 70%, 0.9)`;
      ctx.shadowBlur  = 20;
    }

    if (spr) {
      ctx.drawImage(spr, dx, y, CAR_W, CAR_H);
    } else {
      ctx.fillStyle = '#cc2244';
      ctx.fillRect(dx, y, CAR_W, CAR_H);
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
  // Auf zentriertes Quadrat zuschneiden (kürzere Kante), damit breite Sprites
  // nicht verzerren. Für quadratische Sprites ein No-op.
  const side = Math.min(img.width, img.height);
  const sx   = (img.width  - side) / 2;
  const sy   = (img.height - side) / 2;

  // BG-Removal auf gedeckelter Arbeitsauflösung: erst klein zeichnen, dann
  // Flood-Fill (billig). 400px Arbeitsgröße bei 200px Output = Qualitätsreserve.
  const WORK_MAX = 400;
  const work = Math.min(side, WORK_MAX);
  const oc   = document.createElement('canvas');
  oc.width   = work;
  oc.height  = work;
  const octx = oc.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(img, sx, sy, side, side, 0, 0, work, work);
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
    image.onerror = () => console.warn(`[Traffic] Sprite nicht gefunden: ${src}`);
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
    // Schockwelle (Mikrofon): Auto wird radial weggeschleudert
    this.blasted = false;
    this.blastVx = 0;
    this.blastVy = 0;
    this.spin    = 0;
    this.angle   = 0;
  }

  /** Vom Spieler weg aus dem Bild schleudern (Mikrofon-Schockwelle). */
  blast(px, py) {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    let dx = cx - px;
    let dy = cy - py;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const power  = 1900 + Math.random() * 700;
    this.blastVx = dx * power;
    this.blastVy = dy * power - 250;              // zusätzlicher Kick nach oben
    this.spin    = (Math.random() - 0.5) * 14;    // rad/s Eigendrehung
    this.blasted = true;
  }

  update(dt, speedScale = 1) {
    if (this.blasted) {
      this.x     += this.blastVx * (dt / 1000);
      this.y     += this.blastVy * (dt / 1000);
      this.angle += this.spin    * (dt / 1000);
      return;
    }
    // speedScale koppelt vorhandene Autos an das aktuelle Welt-Tempo
    // (z.B. Lippenstift-Boost), damit sie nicht relativ zurückfallen.
    this.y += this.speed * speedScale * (dt / 1000);
  }

  isOffScreen() {
    return this.y > CANVAS_H + 40 ||
           this.y < -this.h - 500 ||
           this.x < -this.w - 500 ||
           this.x > CANVAS_W + 500;
  }

  collidesWith(player) {
    const px = player.hitboxX;
    const py = player.hitboxY + HITBOX_INSET_TOP;   // vorne/hinten verkleinert
    const ph = player.h - HITBOX_INSET_TOP - HITBOX_INSET_BOTTOM;
    const tx = this.x + (this.w - this.hitW) / 2;
    const th = this.h * TRAFFIC_HITBOX_FRAC;      // kürzer als das Sprite
    const ty = this.y + (this.h - th) / 2;        // vertikal zentriert
    return (
      px < tx + this.hitW &&
      px + HITBOX_W > tx &&
      py < ty + th &&
      py + ph > ty
    );
  }

  render(ctx) {
    ctx.imageSmoothingEnabled = false;
    const spr = this.sprite?.img;
    ctx.save();
    if (this.blasted && this.angle) {
      const cx = this.x + this.w / 2;
      const cy = this.y + this.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(this.angle);
      ctx.translate(-cx, -cy);
    }
    if (spr) {
      ctx.drawImage(spr, this.x, this.y, this.w, this.h);
    } else {
      ctx.fillStyle = '#444';
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
    ctx.restore();
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
