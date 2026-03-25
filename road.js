// road.js – Scrollende Nacht-Straße

export const CANVAS_W   = 600;
export const CANVAS_H   = 800;
export const LANE_COUNT = 4;
export const LANE_WIDTH = 120;
export const ROAD_LEFT  = (CANVAS_W - LANE_WIDTH * LANE_COUNT) / 2; // 60px
export const ROAD_RIGHT = ROAD_LEFT + LANE_WIDTH * LANE_COUNT;      // 420px

const SIDEWALK_W = 30;

/** Mittelpunkt-X einer Spur (0/1/2) */
export function laneCenterX(lane) {
  return ROAD_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2;
}

// ── Gebäude-Definitionen ───────────────────────────────────────────────────
const CHARCOAL = [
  '#252530', '#2a2a38', '#1e1e2a', '#222228',
  '#2d2d3a', '#303038', '#28283a', '#1c1c25',
];

const WIN_COLORS = ['#ffd060', '#ffb840', '#ffc040', '#ff9830'];

function makeBuildingRows(stripW) {
  const rows = [];
  for (let i = 0; i < 32; i++) {
    const rowH  = 55 + Math.floor(Math.random() * 105); // 55–160px
    const slots = [];
    let x = 0;
    while (x < stripW) {
      const maxW = Math.min(stripW, 48);
      const w = Math.min(Math.floor(stripW * 0.4) + Math.floor(Math.random() * Math.floor(stripW * 0.6)), stripW - x); // proportional zur Strip-Breite
      const h = Math.max(38, rowH + Math.floor(Math.random() * 28) - 10);  // ±10px silhouette
      slots.push({ x, w, h,
        color:   CHARCOAL[Math.floor(Math.random() * CHARCOAL.length)],
        winSeed: Math.floor(Math.random() * 9999),
      });
      x += w;
    }
    rows.push({ h: rowH, slots });
  }
  return rows;
}

// ── Road Klasse ────────────────────────────────────────────────────────────
export class Road {
  constructor() {
    this.scrollY      = 0;
    this.dashOffset   = 0;
    this.LAMP_SPACING = 400;

    const buildingStripW = ROAD_LEFT - SIDEWALK_W;
    this.leftRows  = makeBuildingRows(buildingStripW);
    this.rightRows = makeBuildingRows(buildingStripW);

    // Gebäude auf Offscreen-Canvas vorrendern
    this._leftBuildingCanvas  = this._prerenderBuildingStrip(this.leftRows, buildingStripW);
    this._rightBuildingCanvas = this._prerenderBuildingStrip(this.rightRows, buildingStripW);

    // Sidewalk props (fire hydrants, trash cans, manhole covers)
    this.sidewalkProps = this._generateSidewalkProps();
  }

  update(dt, speed) {
    const pxPerMs    = speed / 1000;
    this.scrollY    += pxPerMs * dt;
    this.dashOffset  = (this.dashOffset + pxPerMs * dt) % 40;
  }

  render(ctx) {
    // Gradienten einmalig erstellen und cachen
    if (!this._gradients) {
      const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H * 0.6);
      sky.addColorStop(0,   '#06050f');
      sky.addColorStop(0.5, '#0d0818');
      sky.addColorStop(1,   '#120a20');

      const asphalt = ctx.createLinearGradient(ROAD_LEFT, 0, ROAD_RIGHT, 0);
      asphalt.addColorStop(0,    '#1a1620');
      asphalt.addColorStop(0.15, '#1e1a28');
      asphalt.addColorStop(0.5,  '#221e2c');
      asphalt.addColorStop(0.85, '#1e1a28');
      asphalt.addColorStop(1,    '#1a1620');

      const sheen = ctx.createLinearGradient(ROAD_LEFT, 0, ROAD_RIGHT, 0);
      sheen.addColorStop(0,    'rgba(255,255,255,0)');
      sheen.addColorStop(0.48, 'rgba(255,255,255,0.02)');
      sheen.addColorStop(0.5,  'rgba(255,255,255,0.05)');
      sheen.addColorStop(0.52, 'rgba(255,255,255,0.02)');
      sheen.addColorStop(1,    'rgba(255,255,255,0)');

      this._gradients = { sky, asphalt, sheen };
    }

    // ── Himmel / Hintergrund ─────────────────────────────────────────────
    ctx.fillStyle = this._gradients.sky;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // ── Seitenstreifen Hintergrund (hinter Gebäuden) ──────────────────────
    ctx.fillStyle = '#221d2e';
    ctx.fillRect(0,          0, ROAD_LEFT - SIDEWALK_W,             CANVAS_H);
    ctx.fillRect(ROAD_RIGHT + SIDEWALK_W, 0, CANVAS_W - ROAD_RIGHT - SIDEWALK_W, CANVAS_H);

    // ── Gebäude ───────────────────────────────────────────────────────────
    this._renderBuildings(ctx);

    // ── Bürgersteige ────────────────────────────────────────────────────
    this._renderSidewalks(ctx);

    // ── Bürgersteig-Kante (Bordstein zur Straße) ─────────────────────────
    ctx.strokeStyle = 'rgba(255, 200, 80, 0.35)';
    ctx.lineWidth   = 2;
    ctx.shadowColor = 'rgba(255, 180, 40, 0.4)';
    ctx.shadowBlur  = 3;
    ctx.beginPath(); ctx.moveTo(ROAD_LEFT,  0); ctx.lineTo(ROAD_LEFT,  CANVAS_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ROAD_RIGHT, 0); ctx.lineTo(ROAD_RIGHT, CANVAS_H); ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Asphalt ───────────────────────────────────────────────────────────
    ctx.fillStyle = this._gradients.asphalt;
    ctx.fillRect(ROAD_LEFT, 0, LANE_WIDTH * LANE_COUNT, CANVAS_H);

    // Mittlerer Glanzstreifen
    ctx.fillStyle = this._gradients.sheen;
    ctx.fillRect(ROAD_LEFT, 0, LANE_WIDTH * LANE_COUNT, CANVAS_H);

    // ── Lichtkegel auf Asphalt ────────────────────────────────────────────
    this._renderLampPools(ctx);

    // ── Spurmarkierungen ─────────────────────────────────────────────────
    this._renderLaneMarkings(ctx);

    // ── Straßenlaternen ───────────────────────────────────────────────────
    this._renderLamps(ctx);
  }

  _prerenderBuildingStrip(rows, stripW) {
    const totalH = rows.reduce((s, r) => s + r.h, 0);
    const oc   = document.createElement('canvas');
    oc.width   = stripW;
    oc.height  = totalH;
    const octx = oc.getContext('2d');
    octx.imageSmoothingEnabled = false;

    let y = 0;
    for (const row of rows) {
      for (const slot of row.slots) {
        const bw     = slot.w - 1;
        const bottom = Math.floor(y + row.h);
        const top    = bottom - slot.h;

        octx.fillStyle = slot.color;
        octx.fillRect(slot.x, top, bw, slot.h);

        octx.fillStyle = 'rgba(0,0,0,0.5)';
        octx.fillRect(slot.x, top, bw, 3);

        // Fenster
        const winW = 4, winH = 5, gapX = 9, gapY = 11;
        let s = slot.winSeed;
        for (let wy = top + 10; wy + winH <= top + slot.h - 5; wy += gapY) {
          for (let wx = slot.x + 3; wx + winW <= slot.x + bw - 3; wx += gapX) {
            s = ((s * 1103515245) + 12345) >>> 0;
            if ((s & 0xff) < 140) {
              octx.fillStyle = WIN_COLORS[s % WIN_COLORS.length];
              octx.fillRect(wx, wy, winW, winH);
            }
          }
        }
      }
      y += row.h;
    }
    oc._totalH = totalH;
    return oc;
  }

  _renderBuildings(ctx) {
    ctx.imageSmoothingEnabled = false;
    this._drawBuildingStrip(ctx, 0,                       this._leftBuildingCanvas);
    this._drawBuildingStrip(ctx, ROAD_RIGHT + SIDEWALK_W, this._rightBuildingCanvas);
  }

  _drawBuildingStrip(ctx, stripX, oc) {
    const totalH = oc._totalH;
    const offset = (this.scrollY * 0.4) % totalH;
    const y1 = Math.floor(offset - totalH);
    const y2 = y1 + totalH;

    ctx.drawImage(oc, stripX, y1);
    ctx.drawImage(oc, stripX, y2);
    if (y2 + totalH < CANVAS_H) {
      ctx.drawImage(oc, stripX, y2 + totalH);
    }
  }

  _generateSidewalkProps() {
    const props = [];
    const TYPES = ['hydrant', 'trashcan', 'manhole'];
    let s = 42; // seed
    for (let i = 0; i < 60; i++) {
      s = ((s * 1103515245) + 12345) >>> 0;
      const spacing = 120 + (s % 100); // 120-220px apart
      s = ((s * 1103515245) + 12345) >>> 0;
      const side = (s & 1) === 0 ? 'left' : 'right';
      s = ((s * 1103515245) + 12345) >>> 0;
      const type = TYPES[s % 3];
      const yBase = i * spacing;
      props.push({ type, side, yBase });
    }
    return props;
  }

  _renderSidewalks(ctx) {
    ctx.imageSmoothingEnabled = false;
    const leftX  = ROAD_LEFT - SIDEWALK_W;
    const rightX = ROAD_RIGHT;

    // ── Concrete base ──────────────────────────────────────────────────
    ctx.fillStyle = '#2a2535';
    ctx.fillRect(leftX,  0, SIDEWALK_W, CANVAS_H);
    ctx.fillRect(rightX, 0, SIDEWALK_W, CANVAS_H);

    // ── Pixel-grid texture (scrolling tile pattern) ────────────────────
    const tileSize = 8;
    const offset = Math.floor(this.scrollY) % tileSize;

    ctx.fillStyle = '#302b3c';
    for (let y = -tileSize + offset; y < CANVAS_H; y += tileSize) {
      const py = Math.floor(y);
      // Horizontal groove lines
      ctx.fillRect(leftX,  py, SIDEWALK_W, 1);
      ctx.fillRect(rightX, py, SIDEWALK_W, 1);
    }
    // Vertical center crack
    ctx.fillStyle = '#221e2c';
    ctx.fillRect(leftX + 14,  0, 1, CANVAS_H);
    ctx.fillRect(rightX + 15, 0, 1, CANVAS_H);

    // ── Curb edge (building side) ──────────────────────────────────────
    ctx.fillStyle = '#363040';
    ctx.fillRect(leftX,             0, 1, CANVAS_H);
    ctx.fillRect(rightX + SIDEWALK_W - 1, 0, 1, CANVAS_H);

    // ── Street props ───────────────────────────────────────────────────
    this._renderSidewalkProps(ctx, leftX, rightX);
  }

  _renderSidewalkProps(ctx, leftX, rightX) {
    const totalLen = this.sidewalkProps.length > 0
      ? this.sidewalkProps[this.sidewalkProps.length - 1].yBase + 200
      : 1;
    const offset = this.scrollY % totalLen;

    for (const prop of this.sidewalkProps) {
      const y = Math.floor(((prop.yBase + offset) % totalLen) - 20);
      if (y < -20 || y > CANVAS_H + 20) continue;

      const sx = prop.side === 'left' ? leftX : rightX;

      if (prop.type === 'hydrant') {
        // Fire hydrant: red body + yellow cap, 4x8px
        const hx = Math.floor(sx + 6);
        const hy = Math.floor(y);
        ctx.fillStyle = '#8b1a1a';
        ctx.fillRect(hx, hy, 4, 8);
        ctx.fillStyle = '#cc3030';
        ctx.fillRect(hx, hy + 1, 4, 5);
        ctx.fillStyle = '#d4a020';
        ctx.fillRect(hx, hy, 4, 2);
        // Side nozzles
        ctx.fillStyle = '#8b1a1a';
        ctx.fillRect(hx - 1, hy + 3, 1, 2);
        ctx.fillRect(hx + 4, hy + 3, 1, 2);
      } else if (prop.type === 'trashcan') {
        // Trash can: dark gray body + lighter lid, 6x7px
        const tx = Math.floor(sx + 5);
        const ty = Math.floor(y);
        ctx.fillStyle = '#2a2a30';
        ctx.fillRect(tx, ty + 1, 6, 6);
        ctx.fillStyle = '#3a3a42';
        ctx.fillRect(tx, ty, 6, 2);
        // Handle
        ctx.fillStyle = '#3a3a42';
        ctx.fillRect(tx + 2, ty - 1, 2, 1);
      } else if (prop.type === 'manhole') {
        // Manhole cover: flat oval on ground, 10x3px
        const mx = Math.floor(sx + 3);
        const my = Math.floor(y);
        ctx.fillStyle = '#14111c';
        ctx.fillRect(mx, my, 10, 3);
        ctx.fillStyle = '#1e1a28';
        ctx.fillRect(mx + 1, my + 1, 8, 1);
        // Grid pattern on manhole
        ctx.fillStyle = '#14111c';
        ctx.fillRect(mx + 3, my, 1, 3);
        ctx.fillRect(mx + 6, my, 1, 3);
      }
    }
  }

  _renderLaneMarkings(ctx) {
    ctx.setLineDash([22, 18]);
    ctx.lineDashOffset = -this.dashOffset;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth   = 2;

    for (let i = 1; i < LANE_COUNT; i++) {
      const x = ROAD_LEFT + i * LANE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Seitenmarkierungen (durchgezogen)
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.moveTo(ROAD_LEFT, 0);  ctx.lineTo(ROAD_LEFT, CANVAS_H);  ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ROAD_RIGHT, 0); ctx.lineTo(ROAD_RIGHT, CANVAS_H); ctx.stroke();
  }

  _ensureLampCache() {
    if (this._lampGlow) return;

    // Sidewalk-Pool (100x100)
    const sw = document.createElement('canvas');
    sw.width = sw.height = 100;
    const swCtx = sw.getContext('2d');
    const swGrd = swCtx.createRadialGradient(50, 50, 0, 50, 50, 50);
    swGrd.addColorStop(0,   'rgba(255,200,80,0.25)');
    swGrd.addColorStop(0.6, 'rgba(255,160,40,0.08)');
    swGrd.addColorStop(1,   'rgba(255,160,40,0)');
    swCtx.fillStyle = swGrd;
    swCtx.beginPath(); swCtx.arc(50, 50, 50, 0, Math.PI * 2); swCtx.fill();

    // Road-Pool (200x70) – flach gestaucht
    const rd = document.createElement('canvas');
    rd.width = 200; rd.height = 70;
    const rdCtx = rd.getContext('2d');
    const rdGrd = rdCtx.createRadialGradient(100, 35, 0, 100, 35, 100);
    rdGrd.addColorStop(0,   'rgba(255,200,80,0.22)');
    rdGrd.addColorStop(0.5, 'rgba(255,160,40,0.08)');
    rdGrd.addColorStop(1,   'rgba(255,160,40,0)');
    rdCtx.fillStyle = rdGrd;
    rdCtx.beginPath(); rdCtx.ellipse(100, 35, 100, 35, 0, 0, Math.PI * 2); rdCtx.fill();

    // Lamp-Glow (240x240)
    const gl = document.createElement('canvas');
    gl.width = gl.height = 240;
    const glCtx = gl.getContext('2d');
    const glGrd = glCtx.createRadialGradient(120, 120, 0, 120, 120, 120);
    glGrd.addColorStop(0,    'rgba(255, 200, 80, 0.5)');
    glGrd.addColorStop(0.25, 'rgba(255, 170, 50, 0.2)');
    glGrd.addColorStop(0.6,  'rgba(255, 140, 20, 0.06)');
    glGrd.addColorStop(1,    'rgba(255, 140, 20, 0)');
    glCtx.fillStyle = glGrd;
    glCtx.beginPath(); glCtx.arc(120, 120, 120, 0, Math.PI * 2); glCtx.fill();

    this._lampSwPool = sw;
    this._lampRdPool = rd;
    this._lampGlow   = gl;
  }

  _renderLampPools(ctx) {
    this._ensureLampCache();
    const offset = this.scrollY % this.LAMP_SPACING;
    const count  = Math.ceil(CANVAS_H / this.LAMP_SPACING) + 2;
    for (let i = -1; i < count; i++) {
      const poolY = i * this.LAMP_SPACING + offset + 60;
      if (poolY < -150 || poolY > CANVAS_H + 150) continue;

      for (const side of ['left', 'right']) {
        const swX = side === 'left' ? ROAD_LEFT - Math.floor(SIDEWALK_W / 2) : ROAD_RIGHT + Math.floor(SIDEWALK_W / 2);
        ctx.drawImage(this._lampSwPool, swX - 50, poolY - 50);

        const rdX = side === 'left' ? ROAD_LEFT + 60 : ROAD_RIGHT - 60;
        ctx.drawImage(this._lampRdPool, rdX - 100, poolY - 35);
      }
    }
  }

  _renderLamps(ctx) {
    this._ensureLampCache();
    const offset = this.scrollY % this.LAMP_SPACING;
    const count  = Math.ceil(CANVAS_H / this.LAMP_SPACING) + 2;
    for (let i = -1; i < count; i++) {
      const y = i * this.LAMP_SPACING + offset;

      for (const side of ['left', 'right']) {
        const lx     = side === 'left' ? ROAD_LEFT - Math.floor(SIDEWALK_W / 2) : ROAD_RIGHT + Math.floor(SIDEWALK_W / 2);
        const armDir = side === 'left' ? 1 : -1;

        // Laternenfuß
        ctx.fillStyle = '#2a2638';
        ctx.fillRect(lx - 6, y + 16, 12, 5);
        ctx.fillStyle = '#1e1a2e';
        ctx.fillRect(lx - 4, y + 13, 8, 4);

        // Pfahl
        ctx.fillStyle = '#1e1a2e';
        ctx.fillRect(lx - 3, y - 70, 6, 85);

        // Arm
        ctx.fillStyle = '#1e1a2e';
        ctx.fillRect(lx, y - 72, armDir * 24, 5);

        // Lichtkegel (aus Cache)
        const lampX = lx + armDir * 22;
        ctx.drawImage(this._lampGlow, lampX - 120, y - 70 - 120);

        // Lampengehäuse
        ctx.fillStyle = '#ffe080';
        ctx.shadowColor = 'rgba(255, 220, 100, 0.9)';
        ctx.shadowBlur  = 8;
        ctx.fillRect(lampX - 5, y - 77, 10, 8);
        ctx.shadowBlur = 0;
      }
    }
  }
}
