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
    shield: def.shield ? def.shield.max : 0,
    maxShield: def.shield ? def.shield.max : 0,
    lastShieldHitTime: -999,
    _hazardHpBonusActive: false,
    alive: true,
    controllerType: controllerType || 'bot', // 'local' | 'remote' | 'bot'
    input: { mx: 0, my: 0, aim: 0, primary: false, secondary: false, wall: false },
    cd: { primary: 0, secondary: 0, wall: 0 },
    slowFactor: 0,
    slowUntil: 0,
    slowAmount: 0,
    devourUntil: 0,
    trailChannel: null,
    pilotingId: null,
    invulnerable: false,
    invulnerableUntil: 0,
    invisibleUntil: 0,
    summonedBy: null,
    expiresAt: 0,
    volley: null,
    chargeUntil: 0,
    chargeAngle: 0,
    chargeSpeed: 0,
    chargeHitRange: 0,
    lyseCharges: 0,
    lastAbilityShape: 'dot',
    damageContributors: {},
    kills: 0, deaths: 0, assists: 0,
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
    piercing: !!opts.piercing,
    targetId: opts.targetId || null,
    color: opts.color || '#ffffff',
    shape: opts.shape || 'dot',
    slow: opts.slow || 0,
    slowDuration: opts.slowDuration || 0,
    hitTolerance: opts.hitTolerance || 0,
    splatRadius: opts.splatRadius || 0,
    splatLife: opts.splatLife || 1,
    splatTickDamage: opts.splatTickDamage || 0,
    splatTickInterval: opts.splatTickInterval || 0.3
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
    slow: def.slow || 0.4,
    blastRadius: def.blastRadius || 0,
    damage: def.damage || 0
  };
}

function clearEvents(world) {
  world.events = [];
  world._evCursor = 0;
}

const INVIS_DETECT_RANGE = 70;

function creditUnitFor(source, world) {
  // Clone summons credit their kills/damage back to whoever spawned them.
  return source && source.summonedBy ? (world.units.find(u => u.id === source.summonedBy) || source) : source;
}

// Checks whether target has a death-save ability (currently just the
// bacterium's Dormant Endospore) equipped and off cooldown, and if so,
// activates it in place of dying: survives at 1 HP, goes invulnerable, and
// either hands the local player a piloted escape capsule or -- for bots,
// which have no camera to pilot with -- just teleports it clear instantly.
function findDeathSaveSlot(unit) {
  if (unit.abilities.primary && unit.abilities.primary.type === 'endospore_escape') return 'primary';
  if (unit.abilities.secondary && unit.abilities.secondary.type === 'endospore_escape') return 'secondary';
  return null;
}

function triggerDeathSave(target, world) {
  const slot = findDeathSaveSlot(target);
  if (!slot || target.cd[slot] > 0 || target.pilotingId) return false;
  const ab = target.abilities[slot];
  target.cd[slot] = ab.cooldown;
  target.lastAbilityShape = ab.shape || defaultShapeForType(ab.type);
  target.hp = 1;

  if (target.controllerType === 'local') {
    target.invulnerable = true;
    const spore = createProjectile(target, target.x, target.y, target.angle,
      { speed: ab.speed, life: ab.duration, radius: 10, color: getCharacter(target.charId).color, shape: ab.shape, piercing: true });
    spore.isSpore = true;
    spore.ownerId = target.id;
    world.projectiles.push(spore);
    target.pilotingId = spore.id;
  } else {
    // Bots can't drive the piloting camera, so just vanish and reappear a
    // safe distance away, invulnerable for the same window as the spore.
    const angle = Math.random() * Math.PI * 2;
    const dist = 260 + Math.random() * 160;
    target.x = clamp(target.x + Math.cos(angle) * dist, target.radius, WORLD_W - target.radius);
    target.y = clamp(target.y + Math.sin(angle) * dist, target.radius, WORLD_H - target.radius);
    target.hp = Math.max(1, target.maxHp * 0.4);
    target.invulnerableUntil = world.time + ab.duration;
  }
  return true;
}

function damageUnit(target, amount, source, world, instaKill) {
  if (!target.alive || target.invulnerable || target.invisibleUntil > world.time || target.invulnerableUntil > world.time) return;

  // A rechargeable shield (e.g. the bacteriophage's) soaks up normal damage
  // before HP -- but can't stop an instant-kill effect, which bypasses it.
  if (!instaKill && target.shield > 0 && amount > 0) {
    target.lastShieldHitTime = world.time;
    const absorbed = Math.min(target.shield, amount);
    target.shield -= absorbed;
    amount -= absorbed;
  }

  const preHp = target.hp;
  const dealt = instaKill ? preHp : amount;
  world.events.push({ t: 'hit', attackerId: source ? source.id : null, victimId: target.id, x: target.x, y: target.y, amount: dealt, weaponShape: (source && source.lastAbilityShape) || 'dot' });

  // A killing blow can be shrugged off entirely by a death-save ability
  // (e.g. the bacterium's Dormant Endospore) instead of actually landing.
  if (preHp - dealt <= 0 && triggerDeathSave(target, world)) return;

  target.hp -= instaKill ? preHp + 1 : amount;

  const creditTo = creditUnitFor(source, world);
  if (creditTo && creditTo.id !== target.id && dealt > 0) {
    target.damageContributors[creditTo.id] = (target.damageContributors[creditTo.id] || 0) + dealt;
  }

  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    target.deaths++;
    target.respawnAt = world.time + world.respawnDelay;
    if (creditTo && creditTo.id !== target.id) creditTo.kills++;

    // Any other contributor who dealt at least 75% of the victim's max HP
    // gets credited with a kill too, not just an assist.
    const threshold = target.maxHp * 0.75;
    for (const idStr in target.damageContributors) {
      const cid = Number(idStr);
      if (creditTo && cid === creditTo.id) continue;
      const contributor = world.units.find(u => u.id === cid);
      if (!contributor) continue;
      const contributed = target.damageContributors[idStr];
      if (contributed >= threshold) contributor.kills++;
      else {
        contributor.assists++;
        world.events.push({ t: 'assist', unitId: contributor.id, victim: target.id });
      }
    }
    target.damageContributors = {};

    world.events.push({ t: 'kill', killer: creditTo ? creditTo.id : null, victim: target.id, weaponShape: (source && source.lastAbilityShape) || 'dot' });
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
  let best = null, bestD = Infinity, human = null, humanD = Infinity;
  for (const u of world.units) {
    if (!u.alive || u.team === unit.team || u.id === unit.id) continue;
    const d = Math.hypot(u.x - unit.x, u.y - unit.y);
    const touchDist = unit.radius + u.radius + (buffer || 0);
    if (d >= touchDist) continue;
    if (d < bestD) { bestD = d; best = u; }
    if (u.controllerType === 'local' && d < humanD) { humanD = d; human = u; }
  }
  // If the human player is in range at all, a contact-bite always goes to
  // them over a closer bot -- otherwise a bite can land on whichever AI
  // teammate happens to be standing slightly nearer, which reads as "nothing
  // is happening" when a player wades into a crowd expecting an instant kill.
  return human || best;
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

function defaultShapeForType(type) {
  switch (type) {
    case 'melee_bite': case 'melee_instakill': return 'claw';
    case 'net_trap': return 'net';
    case 'trail_hazard': return 'trail';
    case 'mine_trap': return 'mine';
    case 'pulse_aoe': return 'burst';
    case 'poison_cloud': return 'cloud';
    case 'self_buff_devour': return 'devour';
    case 'nuke_projectile': case 'aoe_projectile': return 'nuke';
    case 'clone_strike': case 'summon_clone': return 'clone';
    case 'invisibility': return 'invis';
    case 'guided_missile': return 'igg3missile';
    case 'parallel_projectile': return 'capsid';
    case 'endospore_escape': return 'spore';
    default: return 'dot';
  }
}

function useAbility(unit, slot, world) {
  const def = getCharacter(unit.charId);
  const ab = unit.abilities[slot];
  // Dormant Endospore is purely passive -- it only fires itself from
  // triggerDeathSave() the instant a hit would be lethal, never from input.
  if (ab.type === 'endospore_escape') return;
  // Lyse manages its own cooldown -- it only goes on cooldown once all of
  // its charges are spent, not after every individual dash.
  if (ab.type !== 'charge_lyse') unit.cd[slot] = ab.cooldown;
  unit.lastAbilityShape = ab.shape || defaultShapeForType(ab.type);

  switch (ab.type) {
    case 'self_buff_devour': {
      unit.devourUntil = world.time + ab.duration;
      unit.radius = unit.baseRadius * ab.sizeMult;
      unit.speed = unit.baseSpeed * ab.speedMult;
      break;
    }
    case 'melee_bite': {
      const target = findAttachedEnemy(unit, world, ab.range);
      if (target) {
        world.fx.push({ type: 'reach_arm', x1: unit.x, y1: unit.y, x2: target.x, y2: target.y, color: def.color, start: world.time, life: 0.3 });
        // Once the arm actually reaches something, it's engulfed whole -- an instant kill, not a damage tick.
        damageUnit(target, 0, unit, world, true);
      }
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
    case 'mine_trap': {
      const burst = ab.burstCount || 1;
      for (let i = 0; i < burst; i++) {
        const existing = world.hazards.filter(h => h.ownerId === unit.id && h.type === 'mine');
        if (existing.length >= ab.maxActive) {
          // At the total cap -- scrap the oldest to make room instead of
          // refusing the new one, so the field is always the freshest mines.
          let oldest = existing[0];
          for (const h of existing) if (h.age > oldest.age) oldest = h;
          oldest.dead = true;
        }
        // A multi-mine burst scatters outward in a ring instead of stacking
        // on one spot, so one activation covers a wide area at once.
        const a = burst > 1 ? (i / burst) * Math.PI * 2 + (Math.random() - 0.5) * 0.3 : Math.random() * Math.PI * 2;
        const dist = burst > 1 ? 35 + Math.random() * 20 : 0;
        const hz = createHazard(unit, 'mine', unit.x + Math.cos(a) * dist, unit.y + Math.sin(a) * dist,
          { radius: ab.triggerRadius, blastRadius: ab.blastRadius, damage: ab.damage, hazardLife: ab.mineLife });
        // Mines drift slowly instead of sitting fixed, so they can wander into
        // new choke points over their lifetime.
        const driftAngle = Math.random() * Math.PI * 2;
        const driftSpeed = 16 + Math.random() * 14;
        hz.vx = Math.cos(driftAngle) * driftSpeed;
        hz.vy = Math.sin(driftAngle) * driftSpeed;
        world.hazards.push(hz);
      }
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
        { speed: ab.speed, damage: ab.damage, life: ab.life, radius: ab.radius, color: def.color, shape: ab.shape, slow: ab.slow, slowDuration: ab.slowDuration, hitTolerance: ab.hitTolerance,
          splatRadius: ab.splatRadius, splatLife: ab.splatLife, splatTickDamage: ab.splatTickDamage, splatTickInterval: ab.splatTickInterval }));
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
        { speed: ab.speed, damage: 0, life: ab.life, radius: ab.radius, aoe: ab.aoe, instaKill: true, homing: true, targetId: target ? target.id : null, color: def.color, shape: ab.shape }));
      break;
    }
    case 'parallel_projectile': {
      const a = unit.angle;
      const perp = a + Math.PI / 2;
      const spacing = ab.spacing || 14;
      const mid = (ab.count - 1) / 2;
      for (let i = 0; i < ab.count; i++) {
        const offset = (i - mid) * spacing;
        const ox = unit.x + Math.cos(a) * (unit.radius + 4) + Math.cos(perp) * offset;
        const oy = unit.y + Math.sin(a) * (unit.radius + 4) + Math.sin(perp) * offset;
        world.projectiles.push(createProjectile(unit, ox, oy, a,
          { speed: ab.speed, damage: ab.damage, life: ab.life, radius: ab.radius, color: def.color, shape: ab.shape }));
      }
      break;
    }
    case 'charge_lyse': {
      // Mid-dash already -- ignore the retrigger (a held/spammed button
      // shouldn't restart or burn an extra charge while one is in flight).
      if (unit.chargeUntil > world.time) break;
      // First press of a fresh activation stocks up the full charge count;
      // each press after that (including this one) spends one.
      if (unit.lyseCharges <= 0) unit.lyseCharges = ab.chargeCount;
      unit.lyseCharges--;
      unit.chargeUntil = world.time + ab.duration;
      unit.chargeAngle = unit.angle;
      unit.chargeSpeed = ab.chargeSpeed;
      unit.chargeHitRange = ab.range;
      // Only go on cooldown once every charge is used.
      if (unit.lyseCharges <= 0) unit.cd[slot] = ab.cooldown;
      break;
    }
    case 'summon_clone': {
      const existing = world.units.filter(u => u.summonedBy === unit.id && u.alive);
      const slotsOpen = ab.maxClones - existing.length;
      // One activation releases a full set of clones at once (up to whatever
      // room is left under the cap), not one clone per press.
      for (let i = 0; i < slotsOpen; i++) {
        const clone = createUnit(unit.charId, unit.team, 'bot');
        clone.summonedBy = unit.id;
        clone.expiresAt = world.time + ab.duration;
        clone.x = unit.x + (Math.random() - 0.5) * 40;
        clone.y = unit.y + (Math.random() - 0.5) * 40;
        clone.angle = unit.angle;
        world.units.push(clone);
        world.fx.push({ type: 'summon_arrow', targetId: clone.id, start: world.time, life: 3 });
      }
      break;
    }
    case 'invisibility': {
      unit.invisibleUntil = world.time + ab.duration;
      break;
    }
    case 'artillery_volley': {
      unit.volley = { ability: ab, remaining: ab.volleyCount, timer: 0 };
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
    case 'poison_cloud': {
      world.hazards.push(createHazard(unit, 'cloud', unit.x, unit.y, ab));
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
          { speed: ab.speed, damage: 0, life: ab.life, radius: ab.radius, instaKill: true, piloted: true, piercing: ab.piercing, aoe: ab.aoe, color: def.color, shape: ab.shape });
        world.projectiles.push(missile);
        unit.pilotingId = missile.id;
        unit.invulnerable = true;
      } else {
        const target = findNearestEnemy(unit, world);
        world.projectiles.push(createProjectile(unit, unit.x, unit.y, unit.angle,
          { speed: ab.speed, damage: 0, life: ab.life, radius: ab.radius, instaKill: true, homing: true, piercing: ab.piercing, aoe: ab.aoe, targetId: target ? target.id : null, color: def.color, shape: ab.shape }));
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

function updateVolley(unit, world, dt) {
  const v = unit.volley;
  v.timer -= dt;
  if (v.timer > 0) return;
  v.timer = v.ability.volleyInterval;
  fireVolleyShot(unit, v.ability, world);
  v.remaining--;
  if (v.remaining <= 0) unit.volley = null;
}

function fireVolleyShot(unit, ab, world) {
  const def = getCharacter(unit.charId);
  const a = unit.angle + (Math.random() - 0.5) * (ab.spread || 0);
  world.projectiles.push(createProjectile(unit, unit.x + Math.cos(a) * (unit.radius + 4), unit.y + Math.sin(a) * (unit.radius + 4), a,
    { speed: ab.speed, damage: ab.damage, life: ab.life, radius: ab.radius, aoe: ab.aoe, color: def.color, shape: ab.shape }));
}

function updateUnit(unit, world, dt) {
  if (!unit.alive) return;

  const def = getCharacter(unit.charId);
  if (def.regen && unit.hp < unit.maxHp) {
    unit.hp = Math.min(unit.maxHp, unit.hp + unit.maxHp * def.regen * dt);
  }
  if (def.shield && unit.shield < unit.maxShield && world.time - unit.lastShieldHitTime > def.shield.regenDelay) {
    unit.shield = Math.min(unit.maxShield, unit.shield + def.shield.regenRate * dt);
  }

  // Strep A: running a live SpeB trail or having a mine out in the field is
  // the whole point of the kit, so it grants a temporary HP cushion while
  // either is active -- an incentive to drop them somewhere dangerous
  // instead of camping safely at the edge of a fight.
  if (def.hazardHpBonus) {
    const hasActiveHazard = world.hazards.some(h => h.ownerId === unit.id && (h.type === 'trail' || h.type === 'mine'));
    if (hasActiveHazard && !unit._hazardHpBonusActive) {
      unit.maxHp += def.hazardHpBonus;
      unit.hp += def.hazardHpBonus;
      unit._hazardHpBonusActive = true;
    } else if (!hasActiveHazard && unit._hazardHpBonusActive) {
      unit.maxHp -= def.hazardHpBonus;
      unit.hp = Math.min(unit.hp, unit.maxHp);
      unit._hazardHpBonusActive = false;
    }
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
  const debuffSlow = unit.slowUntil > world.time ? unit.slowAmount : 0;
  let speed = unit.speed * (1 - Math.max(unit.slowFactor || 0, debuffSlow));
  unit.slowFactor = 0;

  if (unit.chargeUntil > world.time) {
    // Tank-charge: commit to the direction locked in at activation, plowing
    // through and instantly lysing anything touched along the way.
    unit.x += Math.cos(unit.chargeAngle) * unit.chargeSpeed * dt;
    unit.y += Math.sin(unit.chargeAngle) * unit.chargeSpeed * dt;
    unit.angle = unit.chargeAngle;
    for (const u of world.units) {
      if (!u.alive || u.team === unit.team || u.id === unit.id) continue;
      const d = Math.hypot(u.x - unit.x, u.y - unit.y);
      if (d < unit.radius + u.radius + unit.chargeHitRange) damageUnit(u, 0, unit, world, true);
    }
  } else {
    const len = Math.hypot(inp.mx, inp.my);
    if (len > 0.001) {
      unit.x += (inp.mx / len) * speed * dt;
      unit.y += (inp.my / len) * speed * dt;
    }
    unit.angle = inp.aim;
  }

  resolveWallCollision(unit, world.obstacles);

  if (unit.cd.primary > 0) unit.cd.primary = Math.max(0, unit.cd.primary - dt);
  if (unit.cd.secondary > 0) unit.cd.secondary = Math.max(0, unit.cd.secondary - dt);
  if (unit.cd.wall > 0) unit.cd.wall = Math.max(0, unit.cd.wall - dt);

  if (unit.trailChannel) updateTrailChannel(unit, world, dt);
  if (unit.volley) updateVolley(unit, world, dt);

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
  const w = 90, h = 18;
  // The wall stands perpendicular to the direction you're facing (like a
  // shield planted in front of you), tilted to match your exact heading.
  const wallAngle = unit.angle + Math.PI / 2;
  const margin = Math.hypot(w, h) / 2 + 6;
  const px = clamp(unit.x + Math.cos(unit.angle) * dist, margin, WORLD_W - margin);
  const py = clamp(unit.y + Math.sin(unit.angle) * dist, margin, WORLD_H - margin);
  world.tempWalls.push({
    id: nextEntityId++, x: px - w / 2, y: py - h / 2, w, h, angle: wallAngle,
    ownerId: unit.id, expiresAt: world.time + WALL_KIT_LIFE
  });
}

// Splash radius isn't a perfect circle -- it bulges and pinches with angle so
// each blast reads as an organic, irregular shape rather than a uniform disc.
function irregularRadiusAt(baseRadius, angle, seed) {
  const wob = Math.sin(angle * 3 + seed) * 0.25 + Math.sin(angle * 5 - seed * 1.7) * 0.15;
  return baseRadius * (1 + wob);
}

// Like irregularRadiusAt, but the wobble itself drifts over time -- used for
// things that should visibly stretch/bend/flex while just sitting idle (e.g.
// a NET trap), rather than holding one fixed irregular shape.
function flexRadiusAt(baseRadius, angle, seed, t) {
  const w1 = Math.sin(angle * 2 + seed + t * 0.6) * 0.22;
  const w2 = Math.sin(angle * 3 - seed * 1.3 + t * 0.9) * 0.13;
  const w3 = Math.sin(angle * 5 + seed * 2.1 - t * 0.45) * 0.08;
  return baseRadius * (1 + w1 + w2 + w3);
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
  if (p.isSpore) {
    const owner = world.units.find(u => u.id === p.ownerId);
    if (owner) {
      const turnRate = 3.4;
      p.angle = lerpAngle(p.angle, owner.input.aim, Math.min(1, turnRate * dt));
      p.vx = Math.cos(p.angle) * p.speed;
      p.vy = Math.sin(p.angle) * p.speed;
    }
    p.x = clamp(p.x + p.vx * dt, 20, WORLD_W - 20);
    p.y = clamp(p.y + p.vy * dt, 20, WORLD_H - 20);
    p.age += dt;
    if (p.age > p.life) {
      p.dead = true;
      if (owner) {
        owner.x = clamp(p.x, owner.radius, WORLD_W - owner.radius);
        owner.y = clamp(p.y, owner.radius, WORLD_H - owner.radius);
        owner.hp = Math.max(owner.hp, owner.maxHp * 0.4);
      }
    }
    return;
  }
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

  if (!p.piercing) {
    for (const w of world.obstacles) {
      if (circleRectCollide(p.x, p.y, p.radius, w)) {
        if (p.aoe > 0) applyAoeDamage(p, world, world.units.find(x => x.id === p.ownerId));
        p.dead = true;
        return;
      }
    }
    // SpeB trails act like a physical obstruction to projectiles -- they
    // detonate against it instead of flying straight through.
    for (const hz of world.hazards) {
      if (hz.type === 'trail' && hz.points.length > 1 && distToPolyline(p.x, p.y, hz.points) < 16 + p.radius) {
        if (p.aoe > 0) applyAoeDamage(p, world, world.units.find(x => x.id === p.ownerId));
        p.dead = true;
        return;
      }
    }
  }

  for (const u of world.units) {
    if (!u.alive || u.team === p.team) continue;
    const d = Math.hypot(u.x - p.x, u.y - p.y);
    if (d < u.radius + p.radius + p.hitTolerance) {
      const owner = world.units.find(x => x.id === p.ownerId);
      if (p.aoe > 0) applyAoeDamage(p, world, owner);
      else damageUnit(u, p.damage, owner, world, p.instaKill);
      if (p.slow > 0 && u.alive) {
        u.slowUntil = world.time + p.slowDuration;
        u.slowAmount = p.slow;
      }
      if (p.splatRadius > 0 && owner) {
        // Edema Toxin bursts into a brief poison splash on impact, on top of
        // the direct hit -- a short-lived 'cloud' hazard centered on where it landed.
        world.hazards.push(createHazard(owner, 'cloud', p.x, p.y,
          { radius: p.splatRadius, hazardLife: p.splatLife, tickDamage: p.splatTickDamage, tickInterval: p.splatTickInterval }));
      }
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

  if (hz.type === 'mine') {
    if (hz.vx || hz.vy) {
      hz.x += hz.vx * dt; hz.y += hz.vy * dt;
      if (hz.x < 20) { hz.x = 20; hz.vx = Math.abs(hz.vx); }
      if (hz.x > WORLD_W - 20) { hz.x = WORLD_W - 20; hz.vx = -Math.abs(hz.vx); }
      if (hz.y < 20) { hz.y = 20; hz.vy = Math.abs(hz.vy); }
      if (hz.y > WORLD_H - 20) { hz.y = WORLD_H - 20; hz.vy = -Math.abs(hz.vy); }
    }
    for (const u of world.units) {
      if (!u.alive || u.team === hz.team) continue;
      if (Math.hypot(u.x - hz.x, u.y - hz.y) < hz.radius + u.radius) {
        const owner = world.units.find(x => x.id === hz.ownerId);
        world.fx.push({ type: 'splash', x: hz.x, y: hz.y, radius: hz.blastRadius, color: '#ff8fe0', seed: hz.id * 0.73, start: world.time, life: 0.4 });
        for (const v of world.units) {
          if (!v.alive || v.team === hz.team) continue;
          if (Math.hypot(v.x - hz.x, v.y - hz.y) < hz.blastRadius) damageUnit(v, hz.damage, owner, world, false);
        }
        hz.dead = true;
        return;
      }
    }
    return;
  }

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
    } else if (hz.type === 'cloud') {
      inside = Math.hypot(u.x - hz.x, u.y - hz.y) < hz.radius + u.radius;
    }
    if (inside) {
      // The poison cloud damages but doesn't slow -- it relies on blocking
      // vision and being a no-go zone, not on rooting anyone in place.
      if (hz.type !== 'cloud') u.slowFactor = Math.max(u.slowFactor || 0, hz.slow);
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
