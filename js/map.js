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

function circleRectCollide(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx, dy = cy - ny;
  return (dx * dx + dy * dy) < r * r;
}

function resolveWallCollision(unit, obstacles) {
  // Two passes: being wedged between two obstacles (or an obstacle and the
  // world boundary, e.g. a drifting floater pinned against the map edge) can
  // need more than one push to fully resolve in a single frame -- one pass
  // was leaving the unit oscillating in place ("stuck") in that situation.
  for (let pass = 0; pass < 2; pass++) {
    for (const w of obstacles) {
      if (circleRectCollide(unit.x, unit.y, unit.radius, w)) {
        const nx = clamp(unit.x, w.x, w.x + w.w);
        const ny = clamp(unit.y, w.y, w.y + w.h);
        let dx = unit.x - nx, dy = unit.y - ny;
        let dist = Math.hypot(dx, dy);
        if (dist < 1e-6) { dx = 1; dy = 0; dist = 1; }
        const push = unit.radius - dist;
        if (push > 0) {
          unit.x += (dx / dist) * push;
          unit.y += (dy / dist) * push;
        }
      }
    }
    unit.x = clamp(unit.x, unit.radius, WORLD_W - unit.radius);
    unit.y = clamp(unit.y, unit.radius, WORLD_H - unit.radius);
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function rectEdges(r) {
  const x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
  return [
    { x1: x0, y1: y0, x2: x1, y2: y0 },
    { x1: x1, y1: y0, x2: x1, y2: y1 },
    { x1: x1, y1: y1, x2: x0, y2: y1 },
    { x1: x0, y1: y1, x2: x0, y2: y0 }
  ];
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
    floaters.push({ x, y, w, h, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
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
