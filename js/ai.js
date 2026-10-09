const DETECT_RANGE = 520;
const PLAYER_AGGRO_RADIUS = 650;
const PLAYER_INFLUENCE_RADIUS = 480;

function getHomeSpawn(unit, world) {
  if (unit.team === 'immune') return world.immuneSpawn;
  if (unit.team === 'pathogen') return world.pathogenSpawn;
  if (unit.team === 'allies') return world.pveAllySpawn;
  return world.pveEnemySpawn;
}

function getAdvanceTarget(unit, world) {
  if (unit.team === 'immune') return world.pathogenSpawn;
  if (unit.team === 'pathogen') return world.immuneSpawn;
  if (unit.team === 'allies') return world.pveEnemySpawn;
  return world.pveAllySpawn;
}

function findHumanEnemy(unit, world) {
  let best = null, bestD = Infinity;
  for (const u of world.units) {
    if (!u.alive || u.controllerType !== 'local' || u.team === unit.team) continue;
    const d = Math.hypot(u.x - unit.x, u.y - unit.y);
    if (u.invisibleUntil > world.time && d > INVIS_DETECT_RANGE) continue;
    if (d < bestD) { bestD = d; best = u; }
  }
  return best ? { unit: best, dist: bestD } : null;
}

function anyPlayerNear(world, x, y, radius) {
  for (const u of world.units) {
    if (u.controllerType === 'local' && u.alive && Math.hypot(u.x - x, u.y - y) < radius) return true;
  }
  return false;
}

// Bots have no real pathfinding -- they steer straight at their target. Without
// this, a wall standing between a bot and its target leaves it stuck pushing
// against the wall face forever. This does a short lookahead check and, if the
// direct line is blocked, tries deflected angles (preferring one consistent
// side per bot) until it finds a clear direction to slide around the obstacle.
function pathClear(unit, world, dx, dy, dist) {
  const tx = unit.x + dx * dist, ty = unit.y + dy * dist;
  for (const w of world.obstacles) {
    if (circleRectCollide(tx, ty, unit.radius, w)) return false;
  }
  return true;
}

function steer(unit, world, dirX, dirY) {
  const lookahead = unit.radius + 55;
  if (pathClear(unit, world, dirX, dirY, lookahead)) {
    unit._avoidUntil = 0;
    return { mx: dirX, my: dirY };
  }
  // Once a deflection is picked, commit to it for a short window instead of
  // re-scanning every single frame. Re-deriving fresh each frame was letting
  // a bot flip-flop between "go shallow-right" and "go steep-around" right at
  // a corner, making near-zero net progress and reading as permanently stuck.
  if (unit._avoidUntil > world.time && unit._avoidDir) return unit._avoidDir;
  const baseAngle = Math.atan2(dirY, dirX);
  const sign = unit._avoidSign || (unit._avoidSign = Math.random() < 0.5 ? 1 : -1);
  for (const delta of [0.35, 0.7, 1.05, 1.4, 1.9, 2.4]) {
    for (const s of [sign, -sign]) {
      const a = baseAngle + delta * s;
      const tx = Math.cos(a), ty = Math.sin(a);
      if (pathClear(unit, world, tx, ty, lookahead)) {
        const dir = { mx: tx, my: ty };
        unit._avoidDir = dir;
        unit._avoidUntil = world.time + 0.6;
        return dir;
      }
    }
  }
  return { mx: dirX, my: dirY };
}

function updateBotAI(unit, world, dt) {
  const inp = unit.input;
  inp.primary = false;
  inp.secondary = false;

  // Low-HP bots fall back toward home instead of trading to the death.
  if ((unit.hp / unit.maxHp) < 0.28 && unit.devourUntil <= world.time) {
    const home = getHomeSpawn(unit, world);
    const dx = home.x - unit.x, dy = home.y - unit.y;
    const dist = Math.hypot(dx, dy);
    inp.aim = Math.atan2(dy, dx);
    if (dist > 40) {
      const s = steer(unit, world, dx / dist, dy / dist);
      inp.mx = s.mx; inp.my = s.my;
    } else { inp.mx = 0; inp.my = 0; }
    const cornered = findNearestEnemy(unit, world, 140);
    if (cornered && unit.cd.secondary <= 0) inp.secondary = true;
    return;
  }

  let enemy = findNearestEnemy(unit, world, DETECT_RANGE);
  const human = findHumanEnemy(unit, world);
  if (human && human.dist < PLAYER_AGGRO_RADIUS) {
    const curDist = enemy ? Math.hypot(enemy.x - unit.x, enemy.y - unit.y) : Infinity;
    if (!enemy || human.dist < curDist * 1.6) enemy = human.unit;
  }

  let moveTarget = null;
  let combat = false;

  if (enemy) {
    moveTarget = enemy;
    combat = true;
  } else if (world.flags && world.flags.length) {
    let bestFlag = null, bestD = Infinity;
    for (const f of world.flags) {
      if (!f.capturable || f.owner === unit.team) continue;
      const d = Math.hypot(f.x - unit.x, f.y - unit.y);
      if (d < bestD) { bestD = d; bestFlag = f; }
    }
    moveTarget = bestFlag || getAdvanceTarget(unit, world);
  } else {
    moveTarget = getAdvanceTarget(unit, world);
  }

  const dx = moveTarget.x - unit.x, dy = moveTarget.y - unit.y;
  const dist = Math.hypot(dx, dy);
  inp.aim = Math.atan2(dy, dx);

  if (!combat) {
    if (dist > 30) {
      const s = steer(unit, world, dx / dist, dy / dist);
      inp.mx = s.mx; inp.my = s.my;
    } else { inp.mx = 0; inp.my = 0; }
    return;
  }

  // Bot-vs-bot fights with no human anywhere near them simmer instead of resolving on
  // their own -- the player's presence is what actually drives the match forward.
  // Summoned clones always fight all-out, regardless of how far the human player is.
  const involvesPlayer = enemy.controllerType === 'local' || unit.controllerType === 'local' || !!unit.summonedBy || !!enemy.summonedBy;
  let dampen = false;
  if (!involvesPlayer) {
    const midx = (unit.x + enemy.x) / 2, midy = (unit.y + enemy.y) / 2;
    dampen = !anyPlayerNear(world, midx, midy, PLAYER_INFLUENCE_RADIUS);
  }

  const isMeleeFocused = unit.abilities.secondary.type === 'melee_bite' || unit.abilities.primary.type === 'melee_instakill';
  const engageRange = isMeleeFocused ? 46 : 300;

  let mx = 0, my = 0;
  if (dist > engageRange) {
    mx = dx; my = dy;
  } else if (dist < engageRange * 0.45) {
    mx = -dx; my = -dy;
  } else {
    unit._strafe = unit._strafe || (Math.random() < 0.5 ? 1 : -1);
    if (Math.random() < 0.008) unit._strafe *= -1;
    mx = -dy * unit._strafe + dx * 0.15;
    my = dx * unit._strafe + dy * 0.15;
  }
  const len = Math.hypot(mx, my);
  if (len > 0.01) {
    const s = steer(unit, world, mx / len, my / len);
    inp.mx = s.mx; inp.my = s.my;
  } else { inp.mx = 0; inp.my = 0; }

  if (dampen && Math.random() > 0.22) return;

  if (unit.cd.secondary <= 0 && dist < engageRange + 40) inp.secondary = true;
  if (unit.cd.primary <= 0 && dist < engageRange * 1.3 && Math.random() < (involvesPlayer ? 0.75 : 0.5)) inp.primary = true;
}
