let nextEntityId = 1;

function createUnit(charId, team, controllerType, loadout) {
  const def = getCharacter(charId);
  const pIdx = loadout && loadout.primaryIdx != null ? loadout.primaryIdx : (def.primaryOptions ? (Math.random() < 0.5 ? 0 : 1) : 0);
  const sIdx = loadout && loadout.secondaryIdx != null ? loadout.secondaryIdx : (def.secondaryOptions ? (Math.random() < 0.5 ? 0 : 1) : 0);
  return {
    id: nextEntityId++,
    kind: 'unit',
    charId, side: def.side, team,
    abilities: {
      primary: def.primaryOptions ? def.primaryOptions[pIdx] : def.primary,
      secondary: def.secondaryOptions ? def.secondaryOptions[sIdx] : def.secondary
    },
    x: 0, y: 0, angle: 0,
    radius: def.radius, baseRadius: def.radius,
    speed: def.speed, baseSpeed: def.speed,
    hp: def.maxHp, maxHp: def.maxHp,
    alive: true,
    controllerType: controllerType || 'bot', // 'local' | 'remote' | 'bot'
    input: { mx: 0, my: 0, aim: 0, primary: false, secondary: false, wall: false },
    cd: { primary: 0, secondary: 0, wall: 0 },
    slowFactor: 0,
    devourUntil: 0,
    trailChannel: null,
    pilotingId: null,
    invulnerable: false,
    invisibleUntil: 0,
    summonedBy: null,
    expiresAt: 0,
    kills: 0, deaths: 0,
    name: def.name,
    respawnAt: 0
  };
}

function createProjectile(owner, x, y, angle, opts) {
  opts = opts || {};
  const speed = opts.speed || 400;
  return {
    id: nextEntityId++, kind: 'projectile',
    ownerId: owner.id, side: owner.side, team: owner.team,
    x, y, angle,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    speed,
    damage: opts.damage || 10,
    life: opts.life || 1.2, age: 0,
    radius: opts.radius || 5,
    instaKill: !!opts.instaKill,
    aoe: opts.aoe || 0,
    homing: !!opts.homing,
    piloted: !!opts.piloted,
    targetId: opts.targetId || null,
    color: opts.color || '#ffffff',
    shape: opts.shape || 'dot'
  };
}

function createHazard(owner, type, x, y, def) {
  return {
    id: nextEntityId++, kind: 'hazard', type,
    ownerId: owner.id, side: owner.side, team: owner.team,
    x, y, radius: def.radius || 40,
    points: type === 'trail' ? [{ x, y }] : null,
    maxLength: def.maxLength || 0,
    curLength: 0,
    hp: def.killCap || 3,
    life: def.hazardLife || 6, age: 0,
    tickDamage: def.tickDamage || 6,
    tickInterval: def.tickInterval || 0.4,
    tickTimer: 0,
    slow: def.slow || 0.4
  };
}

function clearEvents(world) {
  world.events = [];
  world._evCursor = 0;
}

const INVIS_DETECT_RANGE = 70;

function damageUnit(target, amount, source, world, instaKill) {
  if (!target.alive || target.invulnerable) return;
  target.hp -= instaKill ? target.hp + 1 : amount;
  world.events.push({ t: 'hit', attackerId: source ? source.id : null, victimId: target.id, x: target.x, y: target.y });
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    target.deaths++;
    target.respawnAt = world.time + world.respawnDelay;
    // Clone summons credit their kills back to whoever spawned them.
    const creditTo = source && source.summonedBy ? (world.units.find(u => u.id === source.summonedBy) || source) : source;
    if (creditTo && creditTo.id !== target.id) creditTo.kills++;
    world.events.push({ t: 'kill', killer: creditTo ? creditTo.id : null, victim: target.id });
  }
}

function findNearestEnemy(unit, world, maxRange) {
  let best = null, bestD = maxRange || Infinity;
  for (const u of world.units) {
    if (!u.alive || u.team === unit.team || u.id === unit.id) continue;
    const d = Math.hypot(u.x - unit.x, u.y - unit.y);
    if (u.invisibleUntil > world.time && d > INVIS_DETECT_RANGE) continue;
    if (d < bestD) { bestD = d; best = u; }
  }
  return best;
}
function findNearestEnemyInRange(unit, world, range) {
  return findNearestEnemy(unit, world, range + unit.radius);
}
// "Attach" abilities (Phagocytose, Lyse) require actual body contact: the gap
// between the two cells' edges must be within `buffer`, not just a flat radius.
function findAttachedEnemy(unit, world, buffer) {
  let best = null, bestD = Infinity;
  for (const u of world.units) {
    if (!u.alive || u.team === unit.team || u.id === unit.id) continue;
    const d = Math.hypot(u.x - unit.x, u.y - unit.y);
    const touchDist = unit.radius + u.radius + (buffer || 0);
    if (d < touchDist && d < bestD) { bestD = d; best = u; }
  }
  return best;
}
function findNearestEnemyBySide(p, world) {
  let best = null, bestD = Infinity;
  for (const u of world.units) {
    if (!u.alive || u.team === p.team) continue;
    const d = Math.hypot(u.x - p.x, u.y - p.y);
    if (u.invisibleUntil > world.time && d > INVIS_DETECT_RANGE) continue;
    if (d < bestD) { bestD = d; best = u; }
  }
  return best;
}

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + diff * t;
}

function useAbility(unit, slot, world) {
  const def = getCharacter(unit.charId);
  const ab = unit.abilities[slot];
  unit.cd[slot] = ab.cooldown;

  switch (ab.type) {
    case 'self_buff_devour': {
      unit.devourUntil = world.time + ab.duration;
      unit.radius = unit.baseRadius * ab.sizeMult;
      unit.speed = unit.baseSpeed * ab.speedMult;
      break;
    }
    case 'melee_bite': {
      const target = findAttachedEnemy(unit, world, ab.range);
      if (target) damageUnit(target, ab.damage, unit, world, false);
      break;
    }
    case 'melee_instakill': {
      const target = findAttachedEnemy(unit, world, ab.range);
      if (target) damageUnit(target, 0, unit, world, true);
      break;
    }
    case 'net_trap': {
      const existing = world.hazards.filter(h => h.ownerId === unit.id && h.type === 'net');
      if (existing.length >= ab.maxActive) break;
      const hx = clamp(unit.x + Math.cos(unit.angle) * ab.range, 20, WORLD_W - 20);
      const hy = clamp(unit.y + Math.sin(unit.angle) * ab.range, 20, WORLD_H - 20);
      world.hazards.push(createHazard(unit, 'net', hx, hy, ab));
      break;
    }
    case 'trail_hazard': {
      const existing = world.hazards.filter(h => h.ownerId === unit.id && h.type === 'trail');
      if (existing.length >= ab.maxActive) break;
      const hz = createHazard(unit, 'trail', unit.x, unit.y, ab);
      world.hazards.push(hz);
      unit.trailChannel = { hazardId: hz.id, until: world.time + ab.duration };
      break;
    }
    case 'projectile': {
      const a = unit.angle;
      world.projectiles.push(createProjectile(unit, unit.x + Math.cos(a) * (unit.radius + 4), unit.y + Math.sin(a) * (unit.radius + 4), a,
        { speed: ab.speed, damage: ab.damage, life: ab.life, radius: ab.radius, color: def.color, shape: ab.shape }));
      break;
    }
    case 'radial_projectile': {
      for (let i = 0; i < ab.count; i++) {
        const a = (Math.PI * 2 * i) / ab.count;
        world.projectiles.push(createProjectile(unit, unit.x + Math.cos(a) * (unit.radius + 4), unit.y + Math.sin(a) * (unit.radius + 4), a,
          { speed: ab.speed, damage: ab.damage, life: ab.life, radius: ab.radius, color: def.color, shape: ab.shape }));
      }
      break;
    }
    case 'shotgun_projectile': {
      for (let i = 0; i < ab.count; i++) {
        const t = ab.count === 1 ? 0 : (i / (ab.count - 1)) - 0.5;
        const a = unit.angle + t * ab.spread;
        world.projectiles.push(createProjectile(unit, unit.x + Math.cos(a) * (unit.radius + 4), unit.y + Math.sin(a) * (unit.radius + 4), a,
          { speed: ab.speed, damage: ab.damage, life: ab.life, radius: ab.radius, color: def.color, shape: ab.shape }));
      }
      break;
    }
    case 'nuke_projectile': {
      const a = unit.angle;
      world.projectiles.push(createProjectile(unit, unit.x + Math.cos(a) * (unit.radius + 4), unit.y + Math.sin(a) * (unit.radius + 4), a,
        { speed: ab.speed, damage: 0, life: ab.life, radius: ab.radius, aoe: ab.aoe, instaKill: true, color: def.color, shape: ab.shape }));
      break;
    }
    case 'aoe_projectile': {
      const a = unit.angle;
      world.projectiles.push(createProjectile(unit, unit.x + Math.cos(a) * (unit.radius + 4), unit.y + Math.sin(a) * (unit.radius + 4), a,
        { speed: ab.speed, damage: ab.damage, life: ab.life, radius: ab.radius, aoe: ab.aoe, color: def.color, shape: ab.shape }));
      break;
    }
    case 'clone_strike': {
      const target = findNearestEnemy(unit, world);
      world.projectiles.push(createProjectile(unit, unit.x, unit.y, unit.angle,
        { speed: ab.speed, damage: 0, life: ab.life, radius: ab.radius, instaKill: true, homing: true, targetId: target ? target.id : null, color: def.color, shape: ab.shape }));
      break;
    }
    case 'summon_clone': {
      const existing = world.units.filter(u => u.summonedBy === unit.id && u.alive);
      if (existing.length >= ab.maxClones) break;
      const clone = createUnit(unit.charId, unit.team, 'bot');
      clone.summonedBy = unit.id;
      clone.expiresAt = world.time + ab.duration;
      clone.x = unit.x + (Math.random() - 0.5) * 40;
      clone.y = unit.y + (Math.random() - 0.5) * 40;
      clone.angle = unit.angle;
      world.units.push(clone);
      world.fx.push({ type: 'summon_arrow', targetId: clone.id, start: world.time, life: 3 });
      break;
    }
    case 'invisibility': {
      unit.invisibleUntil = world.time + ab.duration;
      break;
    }
    case 'pulse_aoe': {
      world.fx.push({ type: 'burst', x: unit.x, y: unit.y, radius: ab.radius, color: def.color, start: world.time, life: 0.4 });
      for (const u of world.units) {
        if (!u.alive || u.team === unit.team || u.id === unit.id) continue;
        const d = Math.hypot(u.x - unit.x, u.y - unit.y);
        if (d < ab.radius + unit.radius) damageUnit(u, ab.damage, unit, world, false);
      }
      break;
    }
    case 'homing_shot': {
      const target = findNearestEnemy(unit, world);
      world.projectiles.push(createProjectile(unit, unit.x, unit.y, unit.angle,
        { speed: ab.speed, damage: ab.damage, life: ab.life, radius: ab.radius, homing: true, targetId: target ? target.id : null, color: def.color, shape: ab.shape }));
      break;
    }
    case 'guided_missile': {
      if (unit.controllerType === 'local') {
        const missile = createProjectile(unit, unit.x, unit.y, unit.angle,
          { speed: ab.speed, damage: 0, life: ab.life, radius: ab.radius, instaKill: true, piloted: true, color: def.color, shape: ab.shape });
        world.projectiles.push(missile);
        unit.pilotingId = missile.id;
        unit.invulnerable = true;
      } else {
        const target = findNearestEnemy(unit, world);
        world.projectiles.push(createProjectile(unit, unit.x, unit.y, unit.angle,
          { speed: ab.speed, damage: 0, life: ab.life, radius: ab.radius, instaKill: true, homing: true, targetId: target ? target.id : null, color: def.color, shape: ab.shape }));
      }
      break;
    }
  }
}

function updateTrailChannel(unit, world, dt) {
  const hz = world.hazards.find(h => h.id === unit.trailChannel.hazardId);
  if (!hz || world.time > unit.trailChannel.until) {
    unit.trailChannel = null;
    return;
  }
  const last = hz.points[hz.points.length - 1];
  const d = Math.hypot(unit.x - last.x, unit.y - last.y);
  if (d > 6) {
    hz.points.push({ x: unit.x, y: unit.y });
    hz.curLength += d;
    if (hz.curLength >= hz.maxLength) unit.trailChannel = null;
  }
}

function updateUnit(unit, world, dt) {
  if (!unit.alive) return;

  const def = getCharacter(unit.charId);
  if (def.regen && unit.hp < unit.maxHp) {
    unit.hp = Math.min(unit.maxHp, unit.hp + unit.maxHp * def.regen * dt);
  }

  if (unit.devourUntil && unit.devourUntil <= world.time) {
    unit.devourUntil = 0;
    unit.radius = unit.baseRadius;
    unit.speed = unit.baseSpeed;
  }

  if (unit.devourUntil > world.time) {
    for (const u of world.units) {
      if (!u.alive || u.team === unit.team || u.id === unit.id) continue;
      const d = Math.hypot(u.x - unit.x, u.y - unit.y);
      if (d < unit.radius) damageUnit(u, 0, unit, world, true);
    }
  }

  const inp = unit.input;
  let speed = unit.speed * (1 - (unit.slowFactor || 0));
  unit.slowFactor = 0;

  const len = Math.hypot(inp.mx, inp.my);
  if (len > 0.001) {
    unit.x += (inp.mx / len) * speed * dt;
    unit.y += (inp.my / len) * speed * dt;
  }
  unit.angle = inp.aim;

  resolveWallCollision(unit, world.obstacles);

  if (unit.cd.primary > 0) unit.cd.primary = Math.max(0, unit.cd.primary - dt);
  if (unit.cd.secondary > 0) unit.cd.secondary = Math.max(0, unit.cd.secondary - dt);
  if (unit.cd.wall > 0) unit.cd.wall = Math.max(0, unit.cd.wall - dt);

  if (unit.trailChannel) updateTrailChannel(unit, world, dt);

  if (unit.cd.primary <= 0) {
    if (unit.abilities.primary.auto ? autoAbilityReady(unit, world, unit.abilities.primary) : inp.primary) useAbility(unit, 'primary', world);
  }
  if (unit.cd.secondary <= 0) {
    if (unit.abilities.secondary.auto ? autoAbilityReady(unit, world, unit.abilities.secondary) : inp.secondary) useAbility(unit, 'secondary', world);
  }
  if (inp.wall && unit.cd.wall <= 0) useWallKit(unit, world);
}

// Auto-triggered abilities (e.g. Macrophage's bite) fire by themselves once
// their condition is met, without waiting for a button press.
function autoAbilityReady(unit, world, ab) {
  if (ab.type === 'melee_bite' || ab.type === 'melee_instakill') {
    return !!findAttachedEnemy(unit, world, ab.range);
  }
  return false;
}

const WALL_KIT_COOLDOWN = 11;
const WALL_KIT_LIFE = 11;
const WALL_KIT_MAX_PER_OWNER = 2;

function useWallKit(unit, world) {
  const existing = world.tempWalls.filter(w => w.ownerId === unit.id);
  if (existing.length >= WALL_KIT_MAX_PER_OWNER) return;
  unit.cd.wall = WALL_KIT_COOLDOWN;
  const dist = 55;
  const horizontal = Math.abs(Math.cos(unit.angle)) > Math.abs(Math.sin(unit.angle));
  const w = horizontal ? 18 : 90;
  const h = horizontal ? 90 : 18;
  const px = clamp(unit.x + Math.cos(unit.angle) * dist, w / 2 + 6, WORLD_W - w / 2 - 6);
  const py = clamp(unit.y + Math.sin(unit.angle) * dist, h / 2 + 6, WORLD_H - h / 2 - 6);
  world.tempWalls.push({
    id: nextEntityId++, x: px - w / 2, y: py - h / 2, w, h,
    ownerId: unit.id, expiresAt: world.time + WALL_KIT_LIFE
  });
}

// Splash radius isn't a perfect circle -- it bulges and pinches with angle so
// each blast reads as an organic, irregular shape rather than a uniform disc.
function irregularRadiusAt(baseRadius, angle, seed) {
  const wob = Math.sin(angle * 3 + seed) * 0.25 + Math.sin(angle * 5 - seed * 1.7) * 0.15;
  return baseRadius * (1 + wob);
}

function applyAoeDamage(p, world, owner) {
  const seed = p.id * 0.73;
  world.fx.push({ type: 'splash', x: p.x, y: p.y, radius: p.aoe, color: p.color, seed, start: world.time, life: 0.45 });
  for (const u of world.units) {
    if (!u.alive || u.team === p.team) continue;
    const dx = u.x - p.x, dy = u.y - p.y;
    const d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    if (d < irregularRadiusAt(p.aoe, ang, seed)) damageUnit(u, p.damage, owner, world, p.instaKill);
  }
}

function updateProjectile(p, world, dt) {
  if (p.piloted) {
    const owner = world.units.find(u => u.id === p.ownerId);
    if (owner) {
      const turnRate = 3.2;
      p.angle = lerpAngle(p.angle, owner.input.aim, Math.min(1, turnRate * dt));
      p.vx = Math.cos(p.angle) * p.speed;
      p.vy = Math.sin(p.angle) * p.speed;
    }
  } else if (p.homing) {
    let target = p.targetId ? world.units.find(u => u.id === p.targetId && u.alive) : null;
    if (!target) {
      target = findNearestEnemyBySide(p, world);
      p.targetId = target ? target.id : null;
    }
    if (target) {
      const desired = Math.atan2(target.y - p.y, target.x - p.x);
      p.angle = lerpAngle(p.angle, desired, 0.18);
      p.vx = Math.cos(p.angle) * p.speed;
      p.vy = Math.sin(p.angle) * p.speed;
    }
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.age += dt;

  if (p.age > p.life) { p.dead = true; return; }
  if (p.x < -10 || p.x > WORLD_W + 10 || p.y < -10 || p.y > WORLD_H + 10) { p.dead = true; return; }

  for (const w of world.obstacles) {
    if (circleRectCollide(p.x, p.y, p.radius, w)) {
      if (p.aoe > 0) applyAoeDamage(p, world, world.units.find(x => x.id === p.ownerId));
      p.dead = true;
      return;
    }
  }

  for (const u of world.units) {
    if (!u.alive || u.team === p.team) continue;
    const d = Math.hypot(u.x - p.x, u.y - p.y);
    if (d < u.radius + p.radius) {
      const owner = world.units.find(x => x.id === p.ownerId);
      if (p.aoe > 0) applyAoeDamage(p, world, owner);
      else damageUnit(u, p.damage, owner, world, p.instaKill);
      p.dead = true;
      return;
    }
  }
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}
function distToPolyline(x, y, points) {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    best = Math.min(best, distToSegment(x, y, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y));
  }
  return best;
}

function updateHazard(hz, world, dt) {
  hz.age += dt;
  if (hz.age > hz.life) { hz.dead = true; return; }
  hz.tickTimer -= dt;
  const shouldTick = hz.tickTimer <= 0;
  if (shouldTick) hz.tickTimer = hz.tickInterval;

  for (const u of world.units) {
    if (!u.alive || u.team === hz.team) continue;
    let inside = false;
    if (hz.type === 'net') {
      inside = Math.hypot(u.x - hz.x, u.y - hz.y) < hz.radius + u.radius;
    } else if (hz.type === 'trail' && hz.points.length > 1) {
      inside = distToPolyline(u.x, u.y, hz.points) < 16 + u.radius;
    }
    if (inside) {
      u.slowFactor = Math.max(u.slowFactor || 0, hz.slow);
      if (shouldTick) {
        const owner = world.units.find(x => x.id === hz.ownerId);
        const wasAlive = u.alive;
        damageUnit(u, hz.tickDamage, owner, world, false);
        if (wasAlive && !u.alive) {
          hz.hp -= 1;
          if (hz.hp <= 0) hz.dead = true;
        }
      }
    }
  }
}
