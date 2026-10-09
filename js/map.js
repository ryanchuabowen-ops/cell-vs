const WORLD_W = 2000;
const WORLD_H = 1300;

const WALLS = [
  { x: 900, y: 0, w: 200, h: 220 },
  { x: 900, y: 1080, w: 200, h: 220 },
  { x: 550, y: 550, w: 120, h: 200 },
  { x: 1330, y: 550, w: 120, h: 200 },
  { x: 300, y: 200, w: 160, h: 40 },
  { x: 1540, y: 200, w: 160, h: 40 },
  { x: 300, y: 1060, w: 160, h: 40 },
  { x: 1540, y: 1060, w: 160, h: 40 }
];

const SPAWN_IMMUNE = { x: 150, y: 650 };
const SPAWN_PATHOGEN = { x: 1850, y: 650 };
const PVE_ALLY_SPAWN = { x: 150, y: 650 };
const PVE_ENEMY_SPAWN = { x: 1850, y: 650 };

const FLOATER_COUNT = 7;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Rects may carry an optional `angle` (radians) to support the Wall Kit's
// tilted barriers. Axis-aligned rects (angle 0/undefined) take the same math
// with cos=1/sin=0, so this one path covers both cases.
function rectCorners(r) {
  const angle = r.angle || 0;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const hw = r.w / 2, hh = r.h / 2;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const local = [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }];
  return local.map(p => ({ x: cx + p.x * cos - p.y * sin, y: cy + p.x * sin + p.y * cos }));
}

function rectEdges(r) {
  const c = rectCorners(r);
  return [
    { x1: c[0].x, y1: c[0].y, x2: c[1].x, y2: c[1].y },
    { x1: c[1].x, y1: c[1].y, x2: c[2].x, y2: c[2].y },
    { x1: c[2].x, y1: c[2].y, x2: c[3].x, y2: c[3].y },
    { x1: c[3].x, y1: c[3].y, x2: c[0].x, y2: c[0].y }
  ];
}

// Circle-vs-(possibly rotated)-rect: returns the world-space push vector to
// separate them, or null if not overlapping.
function rectPush(px, py, r, rect) {
  const angle = rect.angle || 0;
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const dx = px - cx, dy = py - cy;
  const cos = Math.cos(-angle), sin = Math.sin(-angle);
  const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
  const hw = rect.w / 2, hh = rect.h / 2;
  const nxL = clamp(lx, -hw, hw), nyL = clamp(ly, -hh, hh);
  let pdx = lx - nxL, pdy = ly - nyL;
  const dist = Math.hypot(pdx, pdy);
  if (dist >= r) return null;
  const ux = dist < 1e-6 ? 1 : pdx / dist, uy = dist < 1e-6 ? 0 : pdy / dist;
  const push = r - dist;
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const wx = ux * push, wy = uy * push;
  return { x: wx * cosA - wy * sinA, y: wx * sinA + wy * cosA };
}

function circleRectCollide(cx, cy, r, rect) {
  return !!rectPush(cx, cy, r, rect);
}

function resolveWallCollision(unit, obstacles) {
  // Two passes: being wedged between two obstacles (or an obstacle and the
  // world boundary, e.g. a drifting floater pinned against the map edge) can
  // need more than one push to fully resolve in a single frame -- one pass
  // was leaving the unit oscillating in place ("stuck") in that situation.
  for (let pass = 0; pass < 2; pass++) {
    for (const w of obstacles) {
      const push = rectPush(unit.x, unit.y, unit.radius, w);
      if (push) { unit.x += push.x; unit.y += push.y; }
    }
    unit.x = clamp(unit.x, unit.radius, WORLD_W - unit.radius);
    unit.y = clamp(unit.y, unit.radius, WORLD_H - unit.radius);
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Robust ray/segment intersection via 2D cross products. Returns {x,y,dist} or null.
function raySegmentIntersect(ox, oy, dx, dy, ax, ay, bx, by) {
  const s_dx = bx - ax, s_dy = by - ay;
  const denom = dx * s_dy - dy * s_dx;
  if (Math.abs(denom) < 1e-10) return null;
  const qpx = ax - ox, qpy = ay - oy;
  const t1 = (qpx * s_dy - qpy * s_dx) / denom;
  const t2 = (qpx * dy - qpy * dx) / denom;
  if (t1 < 0 || t2 < 0 || t2 > 1) return null;
  return { x: ox + dx * t1, y: oy + dy * t1, dist: t1 };
}

// 2D shadow-casting visibility polygon from (px,py) against a list of {x,y,w,h} obstacles.
function computeVisibilityPolygon(px, py, maxDist, obstacles) {
  const segments = [];
  for (const w of obstacles) segments.push(...rectEdges(w));
  segments.push(...rectEdges({ x: -2, y: -2, w: WORLD_W + 4, h: WORLD_H + 4 }));

  const pointSet = [];
  for (const s of segments) {
    pointSet.push({ x: s.x1, y: s.y1 });
    pointSet.push({ x: s.x2, y: s.y2 });
  }

  const angles = [];
  for (const p of pointSet) {
    const a = Math.atan2(p.y - py, p.x - px);
    angles.push(a - 0.00006, a, a + 0.00006);
  }

  const hits = [];
  for (const a of angles) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let nearest = { x: px + dx * maxDist, y: py + dy * maxDist, dist: maxDist };
    for (const s of segments) {
      const hit = raySegmentIntersect(px, py, dx, dy, s.x1, s.y1, s.x2, s.y2);
      if (hit && hit.dist < nearest.dist) nearest = hit;
    }
    hits.push({ a, x: nearest.x, y: nearest.y });
  }

  hits.sort((a, b) => a.a - b.a);
  return hits;
}

// "Floaty bits" -- slow drifting obstacles that bounce around the arena, blocking
// both movement and line of sight, so the map never sits still.
function nearSpawn(x, y) {
  return Math.hypot(x - SPAWN_IMMUNE.x, y - SPAWN_IMMUNE.y) < 260 ||
         Math.hypot(x - SPAWN_PATHOGEN.x, y - SPAWN_PATHOGEN.y) < 260;
}

function createFloaters() {
  const floaters = [];
  for (let i = 0; i < FLOATER_COUNT; i++) {
    const w = 55 + Math.random() * 55;
    const h = 55 + Math.random() * 55;
    let x, y, tries = 0;
    do {
      x = 280 + Math.random() * (WORLD_W - 560);
      y = 120 + Math.random() * (WORLD_H - 240);
      tries++;
    } while (tries < 30 && nearSpawn(x, y));
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 40;
    floaters.push({ x, y, w, h, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, seed: Math.random() * 1000 });
  }
  return floaters;
}

function updateFloaters(world, dt) {
  for (const f of world.floaters) {
    f.x += f.vx * dt;
    f.y += f.vy * dt;

    if (f.x < 0) { f.x = 0; f.vx = Math.abs(f.vx); }
    if (f.x + f.w > WORLD_W) { f.x = WORLD_W - f.w; f.vx = -Math.abs(f.vx); }
    if (f.y < 0) { f.y = 0; f.vy = Math.abs(f.vy); }
    if (f.y + f.h > WORLD_H) { f.y = WORLD_H - f.h; f.vy = -Math.abs(f.vy); }

    for (const w of WALLS) {
      if (rectsOverlap(f, w)) {
        const overlapX = Math.min(f.x + f.w, w.x + w.w) - Math.max(f.x, w.x);
        const overlapY = Math.min(f.y + f.h, w.y + w.h) - Math.max(f.y, w.y);
        if (overlapX < overlapY) f.vx = -f.vx; else f.vy = -f.vy;
        f.x += f.vx * dt; f.y += f.vy * dt;
      }
    }
  }
}
