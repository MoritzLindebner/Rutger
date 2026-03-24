// road.js – Scrollende Nacht-Straße

export const CANVAS_W   = 480;
export const CANVAS_H   = 800;
export const LANE_COUNT = 3;
export const LANE_WIDTH = 120;
export const ROAD_LEFT  = (CANVAS_W - LANE_WIDTH * LANE_COUNT) / 2; // 60px
export const ROAD_RIGHT = ROAD_LEFT + LANE_WIDTH * LANE_COUNT;      // 420px

/** Mittelpunkt-X einer Spur (0/1/2) */
export function laneCenterX(lane) {
  return ROAD_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2;
}

// ── Gebäude-Definition ─────────────────────────────────────────────────────
// Backsteinbraun-Töne: warm-dunkel, leicht variiert
const BUILDING_COLORS = [
  '#1e1510', '#221812', '#1a1208', '#241a0e',
  '#1c1615', '#201a18', '#181210', '#221610',
];

function makeBuildings() {
  const buildings = [];
  for (let i = 0; i < 24; i++) {
    const h = 120 + Math.floor(Math.random() * 220); // 120–340px
    buildings.push({
      h,
      color:    BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)],
      roofColor: '#110d08',
      seed:     Math.floor(Math.random() * 1000),
    });
  }
  return buildings;
}

// ── Road Klasse ────────────────────────────────────────────────────────────
export class Road {
  constructor() {
    this.scrollY      = 0;
    this.dashOffset   = 0;
    this.lampOffset   = 0;
    this.LAMP_SPACING = 220; // px zwischen Laternen

    this.leftBuildings  = makeBuildings();
    this.rightBuildings = makeBuildings();

    // Hydranten
    this.hydrants = [
      { side: 'left',  baseY: 200 },
      { side: 'right', baseY: 450 },
      { side: 'left',  baseY: 700 },
      { side: 'right', baseY: 900 },
    ];

    // Gullideckel
    this.gullies = [
      { side: 'left',  baseY: 350 },
      { side: 'right', baseY: 150 },
      { side: 'left',  baseY: 620 },
      { side: 'right', baseY: 820 },
    ];
  }

  update(dt, speed) {
    const pxPerMs    = speed / 1000;
    this.scrollY    += pxPerMs * dt;           // kein Wrap – Gebäude brauchen die volle Reichweite
    this.dashOffset  = (this.dashOffset + pxPerMs * dt) % 40;
    this.lampOffset  = (this.lampOffset + pxPerMs * dt) % this.LAMP_SPACING;
  }

  render(ctx) {
    // ── Himmel / Hintergrund ─────────────────────────────────────────────
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H * 0.6);
    sky.addColorStop(0,   '#06050f');
    sky.addColorStop(0.5, '#0d0818');
    sky.addColorStop(1,   '#120a20');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // ── Bürgersteige (lila-grau) ──────────────────────────────────────────
    ctx.fillStyle = '#221d2e';
    ctx.fillRect(0,          0, ROAD_LEFT,             CANVAS_H);
    ctx.fillRect(ROAD_RIGHT, 0, CANVAS_W - ROAD_RIGHT, CANVAS_H);

    // ── Gebäude + Details ─────────────────────────────────────────────────
    this._renderBuildings(ctx);
    this._renderSidewalkDetails(ctx);

    // ── Bürgersteig-Kante ─────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255, 200, 80, 0.35)';
    ctx.lineWidth   = 2;
    ctx.shadowColor = 'rgba(255, 180, 40, 0.4)';
    ctx.shadowBlur  = 3;
    ctx.beginPath(); ctx.moveTo(ROAD_LEFT,  0); ctx.lineTo(ROAD_LEFT,  CANVAS_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ROAD_RIGHT, 0); ctx.lineTo(ROAD_RIGHT, CANVAS_H); ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Asphalt ───────────────────────────────────────────────────────────
    const asphalt = ctx.createLinearGradient(ROAD_LEFT, 0, ROAD_RIGHT, 0);
    asphalt.addColorStop(0,    '#1a1620');
    asphalt.addColorStop(0.15, '#1e1a28');
    asphalt.addColorStop(0.5,  '#221e2c');
    asphalt.addColorStop(0.85, '#1e1a28');
    asphalt.addColorStop(1,    '#1a1620');
    ctx.fillStyle = asphalt;
    ctx.fillRect(ROAD_LEFT, 0, LANE_WIDTH * LANE_COUNT, CANVAS_H);

    // Mittlerer Glanzstreifen
    const sheen = ctx.createLinearGradient(ROAD_LEFT, 0, ROAD_RIGHT, 0);
    sheen.addColorStop(0,    'rgba(255,255,255,0)');
    sheen.addColorStop(0.48, 'rgba(255,255,255,0.02)');
    sheen.addColorStop(0.5,  'rgba(255,255,255,0.05)');
    sheen.addColorStop(0.52, 'rgba(255,255,255,0.02)');
    sheen.addColorStop(1,    'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(ROAD_LEFT, 0, LANE_WIDTH * LANE_COUNT, CANVAS_H);

    // ── Lichtkegel auf Asphalt ────────────────────────────────────────────
    this._renderLampPools(ctx);

    // ── Spurmarkierungen ─────────────────────────────────────────────────
    this._renderLaneMarkings(ctx);

    // ── Straßenlaternen ───────────────────────────────────────────────────
    this._renderLamps(ctx);
  }

  _renderBuildings(ctx) {
    // Gebäude nur 42px breit → 18px sichtbarer Gehsteig bis zur Straße
    this._drawBuildingStrip(ctx, 0,                this.leftBuildings);
    this._drawBuildingStrip(ctx, CANVAS_W - 42,    this.rightBuildings);
  }

  _drawBuildingStrip(ctx, stripX, buildings) {
    const stripW = 42;
    const totalH = buildings.reduce((s, b) => s + b.h + 4, 0);
    const offset = this.scrollY * 0.15 % totalH;

    let y  = -offset;
    let bi = 0;
    while (y < CANVAS_H) {
      const idx = bi % buildings.length;
      const b   = buildings[idx];

      // Gebäudetorso
      ctx.fillStyle = b.color;
      ctx.fillRect(stripX, y, stripW, b.h);

      // Dachkante
      ctx.fillStyle = b.roofColor;
      ctx.fillRect(stripX, y, stripW, 5);

      // Horizontale Geschosslinien (alle 18px)
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      for (let fy = y + 18; fy < y + b.h - 4; fy += 18) {
        ctx.fillRect(stripX, fy, stripW, 1);
      }

      // Fenster (Seed = immer gleicher Index → konsistentes Muster)
      this._renderWindows(ctx, stripX, y + 8, stripW, b.h - 10, idx);

      // Sichtbarer Spalt zwischen Gebäuden (Himmelfarbe)
      ctx.fillStyle = '#080508';
      ctx.fillRect(stripX, y + b.h, stripW, 4);

      y  += b.h + 4;
      bi += 1;
    }
  }

  _renderWindows(ctx, bx, by, bw, bh, seed0) {
    // 2 Fensterspalten, 10×8px, mit Glow
    const winW    = 10;
    const winH    = 8;
    const floorH  = 18;
    const colGap  = 8;
    const totalW  = winW * 2 + colGap;          // 28px
    const marginX = Math.floor((bw - totalW) / 2); // zentriert in Streifen

    const cols = [marginX, marginX + winW + colGap];
    const rows = Math.max(1, Math.floor((bh - 4) / floorH));

    for (let r = 0; r < rows; r++) {
      const wy = by + 4 + r * floorH;
      if (wy + winH > by + bh) break;

      for (let ci = 0; ci < cols.length; ci++) {
        const seed  = (seed0 * 7 + r * 19 + ci * 37) % 100;
        const wx    = bx + cols[ci];

        let bright, dim;
        if      (seed < 25) { bright = 'rgba(255,170,60,0.9)';  dim = 'rgba(255,120,20,0.5)'; }
        else if (seed < 45) { bright = 'rgba(220,130,40,0.7)';  dim = 'rgba(180,90,20,0.4)';  }
        else if (seed < 55) { bright = 'rgba(100,60,20,0.5)';   dim = null; }
        else continue; // Fenster dunkel/aus

        // Äußerer Glow (große blasse Fläche)
        if (dim) {
          ctx.fillStyle = dim;
          ctx.fillRect(wx - 2, wy - 2, winW + 4, winH + 4);
        }
        // Eigentliches Fenster
        ctx.fillStyle = bright;
        ctx.fillRect(wx, wy, winW, winH);
      }
    }
  }

  _renderSidewalkDetails(ctx) {
    const totalH = CANVAS_H * 1.8;

    // Hydranten
    for (const h of this.hydrants) {
      const rawY = (h.baseY + this.scrollY * 0.18) % totalH;
      const y    = rawY < 0 ? rawY + totalH : rawY;
      if (y > CANVAS_H + 20) continue;

      // Im sichtbaren Gehsteigstreifen (x=42–60 links, x=420–438 rechts)
      const x = h.side === 'left' ? ROAD_LEFT - 18 : ROAD_RIGHT + 8;
      this._drawHydrant(ctx, x, y);
    }

    // Gullideckel
    for (const g of this.gullies) {
      const rawY = (g.baseY + this.scrollY * 0.18) % totalH;
      const y    = rawY < 0 ? rawY + totalH : rawY;
      if (y > CANVAS_H + 20) continue;

      const cx = g.side === 'left' ? ROAD_LEFT - 10 : ROAD_RIGHT + 10;
      this._drawGully(ctx, cx, y);
    }
  }

  _drawHydrant(ctx, x, y) {
    // Kappe
    ctx.fillStyle = '#bb1f00';
    ctx.fillRect(x + 2, y,     5, 3);
    // Körper
    ctx.fillStyle = '#dd2200';
    ctx.fillRect(x + 1, y + 3, 7, 8);
    // Stutzen links/rechts
    ctx.fillStyle = '#aa1a00';
    ctx.fillRect(x - 1, y + 5, 2, 3);
    ctx.fillRect(x + 8, y + 5, 2, 3);
    // Basis
    ctx.fillStyle = '#aa1a00';
    ctx.fillRect(x,     y + 11, 9, 2);
    // Highlight
    ctx.fillStyle = 'rgba(255,100,60,0.4)';
    ctx.fillRect(x + 2, y + 3, 2, 6);
  }

  _drawGully(ctx, cx, cy) {
    ctx.fillStyle = '#2a2630';
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#403a4a';
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
    ctx.stroke();
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

  _renderLampPools(ctx) {
    const offset = this.lampOffset % this.LAMP_SPACING;
    const count  = Math.ceil(CANVAS_H / this.LAMP_SPACING) + 2;
    for (let i = -1; i < count; i++) {
      const poolY = i * this.LAMP_SPACING - offset + 60;
      if (poolY < -150 || poolY > CANVAS_H + 150) continue;

      for (const side of ['left', 'right']) {
        // Pool auf Bürgersteig
        const swX = side === 'left' ? ROAD_LEFT / 2 : ROAD_RIGHT + (CANVAS_W - ROAD_RIGHT) / 2;
        const swGrd = ctx.createRadialGradient(swX, poolY, 0, swX, poolY, 50);
        swGrd.addColorStop(0,   'rgba(255,200,80,0.25)');
        swGrd.addColorStop(0.6, 'rgba(255,160,40,0.08)');
        swGrd.addColorStop(1,   'rgba(255,160,40,0)');
        ctx.fillStyle = swGrd;
        ctx.beginPath();
        ctx.arc(swX, poolY, 50, 0, Math.PI * 2);
        ctx.fill();

        // Pool auf Asphalt (breit + flach)
        const rdX = side === 'left' ? ROAD_LEFT + 60 : ROAD_RIGHT - 60;
        const grd = ctx.createRadialGradient(rdX, poolY, 0, rdX, poolY, 100);
        grd.addColorStop(0,   'rgba(255,200,80,0.22)');
        grd.addColorStop(0.5, 'rgba(255,160,40,0.08)');
        grd.addColorStop(1,   'rgba(255,160,40,0)');
        ctx.fillStyle = grd;
        ctx.save();
        ctx.scale(1, 0.35);
        ctx.beginPath();
        ctx.arc(rdX, poolY / 0.35, 100, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  _renderLamps(ctx) {
    const offset = this.lampOffset % this.LAMP_SPACING;
    const count  = Math.ceil(CANVAS_H / this.LAMP_SPACING) + 2;
    for (let i = -1; i < count; i++) {
      const y = i * this.LAMP_SPACING - offset;

      for (const side of ['left', 'right']) {
        // Pfosten steht auf dem Gehsteig, direkt an der Straßenkante
        const lx     = side === 'left' ? ROAD_LEFT - 4 : ROAD_RIGHT + 4;
        const armDir = side === 'left' ? 1 : -1;

        // Pfahl (dunkel, leicht bläulich)
        ctx.fillStyle = '#1e1a2e';
        ctx.fillRect(lx - 2, y - 70, 4, 90);

        // Arm
        ctx.fillStyle = '#1e1a2e';
        ctx.fillRect(lx, y - 72, armDir * 22, 4);

        // Großer warmer Lichtkegel
        const lampX = lx + armDir * 22;
        const grd   = ctx.createRadialGradient(lampX, y - 70, 0, lampX, y - 70, 120);
        grd.addColorStop(0,    'rgba(255, 200, 80, 0.5)');
        grd.addColorStop(0.25, 'rgba(255, 170, 50, 0.2)');
        grd.addColorStop(0.6,  'rgba(255, 140, 20, 0.06)');
        grd.addColorStop(1,    'rgba(255, 140, 20, 0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(lampX, y - 70, 120, 0, Math.PI * 2);
        ctx.fill();

        // Lampengehäuse
        ctx.fillStyle = '#ffe080';
        ctx.shadowColor = 'rgba(255, 220, 100, 0.9)';
        ctx.shadowBlur  = 6;
        ctx.fillRect(lampX - 4, y - 76, 8, 7);
        ctx.shadowBlur = 0;
      }
    }
  }
}
