const WIN_SCORE = 60;
const MATCH_DURATION = 360;
const FLAG_RADIUS = 95;
const CAPTURE_RATE = 1 / 6;
const FLAG_TICK_INTERVAL = 8;

const MAP_THEMES = [
  {
    id: 'vessel', name: 'Blood Vessel',
    floor: '#200810', floorBase: '#140608',
    wallFill: '#5c1620', wallStroke: '#9c3240', wallDecor: 'vessel',
    floaterFill: 'rgba(205,55,65,0.55)', floaterStroke: 'rgba(255,130,140,0.85)',
    accent: 'rgba(255,90,100,0.07)'
  },
  {
    id: 'gut', name: 'Intestinal Lining',
    floor: '#231708', floorBase: '#150e05',
    wallFill: '#5a4420', wallStroke: '#9a7a38', wallDecor: 'villi',
    floaterFill: 'rgba(214,174,92,0.55)', floaterStroke: 'rgba(245,215,145,0.85)',
    accent: 'rgba(230,180,90,0.07)'
  },
  {
    id: 'lungs', name: 'Alveolar Lung Tissue',
    floor: '#0b1d20', floorBase: '#071114',
    wallFill: '#1f4a4e', wallStroke: '#45868c', wallDecor: 'alveoli',
    floaterFill: 'rgba(140,210,220,0.5)', floaterStroke: 'rgba(195,245,248,0.85)',
    accent: 'rgba(130,220,230,0.07)'
  },
  {
    id: 'lymph', name: 'Lymph Node',
    floor: '#111a2a', floorBase: '#0a0f1a',
    wallFill: '#223258', wallStroke: '#4860a0', wallDecor: 'nodes',
    floaterFill: 'rgba(150,180,255,0.5)', floaterStroke: 'rgba(205,220,255,0.85)',
    accent: 'rgba(140,170,255,0.07)'
  }
];

const PVE_TIERS = 8;
const PVE_TIER_DURATION = 42;
const PVE_MAX_ENEMIES = 26;

const PICKUP_RADIUS = 34;
const PICKUP_RESPAWN_DELAY = 25;
const HEALTH_PICKUP_FRACTION = 0.45;
const PICKUP_SPOTS = [
  { id: 'h1', type: 'health', x: 500, y: 300 },
  { id: 'h2', type: 'health', x: 500, y: 1000 },
  { id: 'h3', type: 'health', x: 1500, y: 300 },
  { id: 'h4', type: 'health', x: 1500, y: 1000 },
  { id: 'r1', type: 'recharge', x: 720, y: 650 },
  { id: 'r2', type: 'recharge', x: 1280, y: 650 }
];

const Game = (() => {
  let canvas, ctx;
  let world = null;
  let localUnitId = null;
  let mode = null; // 'pvbot' | 'pve'
  let running = false;
  let lastTime = 0;
  const camera = { x: WORLD_W / 2, y: WORLD_H / 2 };
  const mouseScreen = { x: 0, y: 0 };
  const keys = {};
  const localInputState = { primary: false, secondary: false };
  let scores = { immune: 0, pathogen: 0 };
  let killFeed = [];
  let matchOver = false;
  let matchResult = null;
  let listenersBound = false;

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    if (listenersBound) return;
    listenersBound = true;
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      mouseScreen.x = e.clientX - r.left;
      mouseScreen.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', e => {
      e.preventDefault();
      if (e.button === 0) localInputState.secondary = true;
      if (e.button === 2) localInputState.primary = true;
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) localInputState.secondary = false;
      if (e.button === 2) localInputState.primary = false;
    });
    canvas.addEventListener('dragstart', e => e.preventDefault());
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => { keys[e.code] = true; });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('blur', () => {
      for (const k in keys) keys[k] = false;
      localInputState.primary = false;
      localInputState.secondary = false;
    });
  }

  function resize() {
    if (!canvas) return;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }

  function createFlags() {
    return [
      { id: 'north', name: 'the North Flag', x: 1000, y: 420, owner: 'neutral', ctrl: 0, capturable: true, contested: false, tickTimer: FLAG_TICK_INTERVAL },
      { id: 'center', name: 'the Center Flag', x: 1000, y: 650, owner: 'neutral', ctrl: 0, capturable: true, contested: false, tickTimer: FLAG_TICK_INTERVAL },
      { id: 'south', name: 'the South Flag', x: 1000, y: 880, owner: 'neutral', ctrl: 0, capturable: true, contested: false, tickTimer: FLAG_TICK_INTERVAL },
      { id: 'immuneHome', name: 'the Immune Base', x: SPAWN_IMMUNE.x, y: SPAWN_IMMUNE.y, owner: 'immune', ctrl: 1, capturable: false },
      { id: 'pathogenHome', name: 'the Pathogen Base', x: SPAWN_PATHOGEN.x, y: SPAWN_PATHOGEN.y, owner: 'pathogen', ctrl: -1, capturable: false }
    ];
  }

  function createWorld() {
    const floaters = createFloaters();
    const theme = MAP_THEMES[Math.floor(Math.random() * MAP_THEMES.length)];
    return {
      time: 0,
      theme,
      units: [],
      projectiles: [],
      hazards: [],
      floaters,
      tempWalls: [],
      obstacles: WALLS.concat(floaters),
      flags: [],
      fx: [],
      pickups: PICKUP_SPOTS.map(p => ({ ...p, readyAt: 0 })),
      matchTime: MATCH_DURATION,
      events: [],
      _evCursor: 0,
      respawnDelay: 4,
      immuneSpawn: SPAWN_IMMUNE,
      pathogenSpawn: SPAWN_PATHOGEN,
      pveAllySpawn: PVE_ALLY_SPAWN,
      pveEnemySpawn: PVE_ENEMY_SPAWN,
      wave: 1,
      waveTimer: PVE_TIER_DURATION,
      spawnTimer: 1,
      heroLives: 5
    };
  }

  function getSpawnForTeam(w, team) {
    if (team === 'immune') return w.immuneSpawn;
    if (team === 'pathogen') return w.pathogenSpawn;
    if (team === 'allies') return w.pveAllySpawn;
    return w.pveEnemySpawn;
  }

  function placeAtSpawn(unit, w) {
    let s = getSpawnForTeam(w, unit.team);
    if (mode === 'pvbot' && w.flags && w.flags.length) {
      const owned = w.flags.filter(f => f.capturable && f.owner === unit.team);
      if (owned.length && Math.random() < 0.6) {
        const pick = owned[Math.floor(Math.random() * owned.length)];
        s = { x: pick.x, y: pick.y };
      }
    }
    unit.x = clamp(s.x + (Math.random() - 0.5) * 140, 40, WORLD_W - 40);
    unit.y = clamp(s.y + (Math.random() - 0.5) * 140, 40, WORLD_H - 40);
  }

  function respawnUnit(u, w) {
    u.alive = true;
    u.hp = u.maxHp;
    u.radius = u.baseRadius;
    u.speed = u.baseSpeed;
    u.devourUntil = 0;
    placeAtSpawn(u, w);
  }

  function fillBotTeam(w, team, count, pool) {
    const p = pool || ((team === 'immune' || team === 'allies') ? IMMUNE_IDS : PATHOGEN_IDS);
    for (let i = 0; i < count; i++) {
      const charId = p[Math.floor(Math.random() * p.length)];
      const bot = createUnit(charId, team, 'bot');
      placeAtSpawn(bot, w);
      w.units.push(bot);
    }
  }

  function getLocalUnit() {
    return world ? world.units.find(u => u.id === localUnitId) : null;
  }

  function screenToWorld(sx, sy) {
    return { x: camera.x + (sx - canvas.width / 2), y: camera.y + (sy - canvas.height / 2) };
  }

  function getPilotedMissile(u) {
    return u.pilotingId ? world.projectiles.find(p => p.id === u.pilotingId) : null;
  }

  function computeLocalInput() {
    const u = getLocalUnit();
    if (!u) return;

    if (u.pilotingId) {
      const missile = getPilotedMissile(u);
      if (missile) {
        const wm = screenToWorld(mouseScreen.x, mouseScreen.y);
        u.input.aim = Math.atan2(wm.y - missile.y, wm.x - missile.x);
      } else {
        u.pilotingId = null;
        u.invulnerable = false;
      }
      u.input.mx = 0; u.input.my = 0;
      u.input.primary = false; u.input.secondary = false; u.input.wall = false;
      return;
    }

    let mx = 0, my = 0;
    if (keys['KeyW'] || keys['ArrowUp']) my -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) my += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
    const wm = screenToWorld(mouseScreen.x, mouseScreen.y);
    const aim = Math.atan2(wm.y - u.y, wm.x - u.x);
    u.input.mx = mx; u.input.my = my; u.input.aim = aim;
    u.input.primary = localInputState.primary;
    u.input.secondary = localInputState.secondary;
    u.input.wall = !!keys['KeyE'];
  }

  function updateFlags(dt) {
    for (const f of world.flags) {
      if (!f.capturable) continue;
      let immuneCount = 0, pathogenCount = 0;
      for (const u of world.units) {
        if (!u.alive) continue;
        if (Math.hypot(u.x - f.x, u.y - f.y) < FLAG_RADIUS) {
          if (u.team === 'immune') immuneCount++;
          else if (u.team === 'pathogen') pathogenCount++;
        }
      }
      f.contested = immuneCount > 0 && pathogenCount > 0;
      if (immuneCount > 0 && pathogenCount === 0) f.ctrl = Math.min(1, f.ctrl + CAPTURE_RATE * dt);
      else if (pathogenCount > 0 && immuneCount === 0) f.ctrl = Math.max(-1, f.ctrl - CAPTURE_RATE * dt);

      const prevOwner = f.owner;
      if (f.ctrl >= 1) f.owner = 'immune';
      else if (f.ctrl <= -1) f.owner = 'pathogen';
      if (f.owner !== prevOwner) world.events.push({ t: 'flagcap', team: f.owner, flagName: f.name });

      f.tickTimer -= dt;
      if (f.owner !== 'neutral' && f.tickTimer <= 0) {
        f.tickTimer = FLAG_TICK_INTERVAL;
        world.events.push({ t: 'flagtick', team: f.owner });
      }
    }
  }

  const SANCTUARY_RADIUS = 160;
  const SANCTUARY_HEAL_RATE = 0.08;
  const SANCTUARY_RECHARGE_BONUS = 1.5;

  function isInOwnSanctuary(unit) {
    const home = getSpawnForTeam(world, unit.team);
    if (Math.hypot(unit.x - home.x, unit.y - home.y) < SANCTUARY_RADIUS) return true;
    if (mode === 'pvbot' && world.flags) {
      for (const f of world.flags) {
        if (f.owner !== unit.team) continue;
        const r = f.capturable ? FLAG_RADIUS : SANCTUARY_RADIUS;
        if (Math.hypot(unit.x - f.x, unit.y - f.y) < r) return true;
      }
    }
    return false;
  }

  function updateSanctuaryAuras(dt) {
    for (const u of world.units) {
      if (!u.alive || !isInOwnSanctuary(u)) continue;
      if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * SANCTUARY_HEAL_RATE * dt);
      const extra = dt * SANCTUARY_RECHARGE_BONUS;
      if (u.cd.primary > 0) u.cd.primary = Math.max(0, u.cd.primary - extra);
      if (u.cd.secondary > 0) u.cd.secondary = Math.max(0, u.cd.secondary - extra);
      if (u.cd.wall > 0) u.cd.wall = Math.max(0, u.cd.wall - extra);
    }
  }

  function updatePickups() {
    for (const p of world.pickups) {
      if (p.readyAt > world.time) continue;
      for (const u of world.units) {
        if (!u.alive) continue;
        if (Math.hypot(u.x - p.x, u.y - p.y) < PICKUP_RADIUS + u.radius) {
          if (p.type === 'health') {
            if (u.hp >= u.maxHp) continue;
            u.hp = Math.min(u.maxHp, u.hp + u.maxHp * HEALTH_PICKUP_FRACTION);
          } else {
            if (u.cd.primary <= 0 && u.cd.secondary <= 0) continue;
            u.cd.primary = 0;
            u.cd.secondary = 0;
          }
          p.readyAt = world.time + PICKUP_RESPAWN_DELAY;
          break;
        }
      }
    }
  }

  function stepSimulation(dt) {
    updateFloaters(world, dt);
    world.tempWalls = world.tempWalls.filter(w => w.expiresAt > world.time);
    world.obstacles = WALLS.concat(world.floaters, world.tempWalls);
    world.fx = world.fx.filter(f => world.time - f.start < f.life);
    if (mode === 'pvbot') updateFlags(dt);
    updatePickups();
    updateSanctuaryAuras(dt);

    for (const u of world.units) {
      if (u.controllerType === 'bot' && u.alive) updateBotAI(u, world, dt);
    }
    for (const hz of world.hazards) updateHazard(hz, world, dt);
    for (const u of world.units) updateUnit(u, world, dt);
    for (const p of world.projectiles) updateProjectile(p, world, dt);
    world.projectiles = world.projectiles.filter(p => !p.dead);
    world.hazards = world.hazards.filter(h => !h.dead);
    for (const u of world.units) {
      if (u.pilotingId && !world.projectiles.find(p => p.id === u.pilotingId)) {
        u.pilotingId = null;
        u.invulnerable = false;
      }
    }
    // Summoned clones are temporary reinforcements, not permanent team slots --
    // they vanish on death or once their timer runs out, never respawn.
    world.units = world.units.filter(u => !(u.summonedBy && (!u.alive || world.time >= u.expiresAt)));
    for (const u of world.units) {
      if (!u.alive && world.time >= u.respawnAt && u.team !== 'enemies' && !u.summonedBy) {
        if (u.id === localUnitId && mode === 'pve') {
          if (world.heroLives > 0) { world.heroLives--; respawnUnit(u, world); }
        } else {
          respawnUnit(u, world);
        }
      }
    }
  }

  function updatePveWaves(dt) {
    if (matchOver) return;

    world.waveTimer -= dt;
    if (world.waveTimer <= 0 && world.wave < PVE_TIERS) {
      world.wave++;
      world.waveTimer = PVE_TIER_DURATION;
    } else if (world.waveTimer <= 0 && world.wave >= PVE_TIERS) {
      matchOver = true; matchResult = 'victory';
      return;
    }

    world.spawnTimer -= dt;
    const enemyCount = world.units.filter(u => u.team === 'enemies' && u.alive).length;
    if (world.spawnTimer <= 0 && enemyCount < PVE_MAX_ENEMIES) {
      const interval = Math.max(0.55, 2.4 - world.wave * 0.2);
      world.spawnTimer = interval;
      const burstSize = 1 + Math.floor(world.wave / 3);
      const pool = world.pveEnemyPool;
      for (let i = 0; i < burstSize && enemyCount + i < PVE_MAX_ENEMIES; i++) {
        const charId = pool[Math.floor(Math.random() * pool.length)];
        const u = createUnit(charId, 'enemies', 'bot');
        placeAtSpawn(u, world);
        world.units.push(u);
      }
    }

    const hero = world.units.find(u => u.id === localUnitId);
    if (hero && !hero.alive && world.heroLives <= 0) {
      matchOver = true; matchResult = 'defeat';
    }
  }

  function processEvents() {
    const start = world._evCursor || 0;
    for (let i = start; i < world.events.length; i++) {
      const ev = world.events[i];
      if (ev.t === 'kill') {
        const killerUnit = world.units.find(u => u.id === ev.killer);
        const victimUnit = world.units.find(u => u.id === ev.victim);
        if (mode === 'pvbot' && killerUnit) scores[killerUnit.team] = (scores[killerUnit.team] || 0) + 1;
        killFeed.unshift({ text: (killerUnit ? killerUnit.name : 'Something') + ' defeated ' + (victimUnit ? victimUnit.name : 'something') });
      } else if (ev.t === 'flagcap') {
        killFeed.unshift({ text: (ev.team === 'immune' ? 'Immune' : 'Pathogen') + ' team captured ' + ev.flagName + '!' });
      } else if (ev.t === 'flagtick') {
        scores[ev.team] = (scores[ev.team] || 0) + 1;
      } else if (ev.t === 'hit') {
        if (ev.attackerId === localUnitId) {
          world.fx.push({ type: 'hitmarker', x: ev.x, y: ev.y, start: world.time, life: 0.25 });
        }
        if (ev.victimId === localUnitId) {
          world.fx.push({ type: 'damageflash', start: world.time, life: 0.3 });
        }
      }
      if (killFeed.length > 6) killFeed.pop();
    }
    world._evCursor = world.events.length;
    if (mode === 'pvbot' && !matchOver) {
      if (scores.immune >= WIN_SCORE) { matchOver = true; matchResult = 'immune'; }
      else if (scores.pathogen >= WIN_SCORE) { matchOver = true; matchResult = 'pathogen'; }
      else if (world.matchTime <= 0) {
        matchOver = true;
        matchResult = scores.immune === scores.pathogen ? 'draw' : (scores.immune > scores.pathogen ? 'immune' : 'pathogen');
      }
    }
  }

  function checkMatchEnd() {
    if (matchOver && running) {
      running = false;
      if (window.UI) window.UI.showMatchEnd(mode, matchResult, scores);
    }
  }

  function resetState() {
    scores = { immune: 0, pathogen: 0 };
    killFeed = [];
    matchOver = false;
    matchResult = null;
  }

  // ---------- Mode setup ----------
  function setupPvBot(charId, loadout) {
    resetState();
    world = createWorld();
    world.flags = createFlags();
    mode = 'pvbot';
    const side = getCharacter(charId).side;
    const local = createUnit(charId, side, 'local', loadout);
    placeAtSpawn(local, world);
    world.units.push(local);
    localUnitId = local.id;
    fillBotTeam(world, 'immune', side === 'immune' ? 9 : 10);
    fillBotTeam(world, 'pathogen', side === 'pathogen' ? 9 : 10);
    startLoop();
  }

  function setupPvEOffline(charId, loadout) {
    resetState();
    world = createWorld();
    mode = 'pve';
    const chosenSide = getCharacter(charId).side;
    const reversed = chosenSide === 'pathogen';
    world.pveHeroPool = chosenSide === 'phage' ? PHAGE_IDS : (reversed ? PATHOGEN_IDS : IMMUNE_IDS);
    world.pveEnemyPool = reversed ? IMMUNE_IDS : PATHOGEN_IDS;
    const allyPool = reversed ? PATHOGEN_IDS : IMMUNE_IDS;
    const hero = createUnit(charId, 'allies', 'local', loadout);
    placeAtSpawn(hero, world);
    world.units.push(hero);
    localUnitId = hero.id;
    fillBotTeam(world, 'allies', 19, allyPool);
    startLoop();
  }

  // Lets the local player respawn as a different character on their own team/side.
  function respawnAs(charId) {
    const old = getLocalUnit();
    if (!old || old.alive) return;
    if (mode === 'pve' && world.heroLives <= 0) return;
    const idx = world.units.indexOf(old);
    if (idx === -1) return;
    const fresh = createUnit(charId, old.team, 'local');
    placeAtSpawn(fresh, world);
    world.units[idx] = fresh;
    localUnitId = fresh.id;
    if (mode === 'pve') world.heroLives--;
  }

  // ---------- Main loop ----------
  function startLoop() {
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function stopLoop() { running = false; }

  function loop(ts) {
    if (!running) return;
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    computeLocalInput();
    world.time += dt;
    if (mode === 'pvbot') world.matchTime -= dt;
    stepSimulation(dt);
    if (mode === 'pve') updatePveWaves(dt);
    processEvents();
    checkMatchEnd();
    clearEvents(world);

    const u = getLocalUnit();
    if (u && u.pilotingId) {
      const missile = getPilotedMissile(u);
      if (missile) { camera.x = missile.x; camera.y = missile.y; }
    } else if (u) {
      camera.x = u.x; camera.y = u.y;
    }

    render();
    if (running) requestAnimationFrame(loop);
  }

  // ---------- Rendering ----------
  function drawMapBase() {
    const theme = world.theme;
    ctx.fillStyle = theme.floorBase;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.strokeStyle = '#1a2230';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
    ctx.fillStyle = theme.wallFill;
    ctx.globalAlpha = 0.5;
    for (const w of WALLS) ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.globalAlpha = 1;
  }

  function drawThemedWall(w, theme) {
    ctx.fillStyle = theme.wallFill;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = theme.wallStroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x, w.y, w.w, w.h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(w.x, w.y, w.w, w.h);
    ctx.clip();

    if (theme.wallDecor === 'vessel') {
      ctx.strokeStyle = theme.floaterStroke;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const yy = w.y + (i + 0.5) * (w.h / 4);
        ctx.beginPath();
        ctx.moveTo(w.x, yy);
        for (let xx = w.x; xx <= w.x + w.w; xx += 14) ctx.lineTo(xx, yy + Math.sin(xx * 0.07 + i) * 5);
        ctx.stroke();
      }
    } else if (theme.wallDecor === 'villi') {
      ctx.fillStyle = theme.floaterFill;
      ctx.globalAlpha = 0.6;
      for (let xx = w.x + 8; xx < w.x + w.w; xx += 16) {
        ctx.beginPath(); ctx.ellipse(xx, w.y + 6, 5, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(xx, w.y + w.h - 6, 5, 10, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (theme.wallDecor === 'alveoli') {
      ctx.fillStyle = theme.floaterFill;
      ctx.globalAlpha = 0.4;
      const n = Math.floor((w.w * w.h) / 900);
      for (let i = 0; i < n; i++) {
        const rx = w.x + ((i * 53) % w.w);
        const ry = w.y + ((i * 97) % w.h);
        ctx.beginPath(); ctx.arc(rx, ry, 9, 0, Math.PI * 2); ctx.fill();
      }
    } else if (theme.wallDecor === 'nodes') {
      const pts = [];
      const n = Math.floor((w.w * w.h) / 1400);
      for (let i = 0; i < n; i++) pts.push({ x: w.x + ((i * 71) % w.w), y: w.y + ((i * 113) % w.h) });
      ctx.strokeStyle = theme.floaterStroke;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < 40) {
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
          }
        }
      }
      ctx.fillStyle = theme.floaterFill;
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawMapDetail() {
    const theme = world.theme;
    ctx.fillStyle = theme.floor;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= WORLD_W; gx += 50) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, WORLD_H); ctx.stroke();
    }
    for (let gy = 0; gy <= WORLD_H; gy += 50) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(WORLD_W, gy); ctx.stroke();
    }
    ctx.fillStyle = theme.accent;
    ctx.beginPath(); ctx.arc(SPAWN_IMMUNE.x, SPAWN_IMMUNE.y, 150, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(SPAWN_PATHOGEN.x, SPAWN_PATHOGEN.y, 150, 0, Math.PI * 2); ctx.fill();

    for (const w of WALLS) drawThemedWall(w, theme);
  }

  function roundRectPath(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawFloaters() {
    const theme = world.theme;
    for (const f of world.floaters) {
      ctx.save();
      ctx.fillStyle = theme.floaterFill;
      ctx.strokeStyle = theme.floaterStroke;
      ctx.lineWidth = 2;
      roundRectPath(ctx, f.x, f.y, f.w, f.h, 12);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFlags() {
    if (!world.flags || !world.flags.length) return;
    for (const f of world.flags) {
      const color = f.owner === 'immune' ? '#4fd1ff' : f.owner === 'pathogen' ? '#ff6b6b' : '#8fa0bd';
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      if (f.capturable) ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.capturable ? FLAG_RADIUS : 70, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      ctx.translate(f.x, f.y);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#06080c';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-3, -30, 6, 42);
      ctx.strokeRect(-3, -30, 6, 42);
      ctx.beginPath();
      ctx.moveTo(3, -30);
      ctx.lineTo(30, -21);
      ctx.lineTo(3, -12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (f.capturable) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(f.x - 26, f.y + 42, 52, 7);
        ctx.fillStyle = color;
        const pct = (f.ctrl + 1) / 2;
        ctx.fillRect(f.x - 26, f.y + 42, 52 * pct, 7);
        if (f.contested) {
          ctx.fillStyle = '#ffd166';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('CONTESTED', f.x, f.y + 65);
        }
        ctx.restore();
      }
    }
  }

  function drawFx() {
    for (const f of world.fx) {
      const t = (world.time - f.start) / f.life;
      if (f.type === 'burst') {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t);
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius * Math.min(1, t * 1.6), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (f.type === 'hitmarker') {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        const s = 9 + t * 7;
        ctx.beginPath();
        ctx.moveTo(f.x - s, f.y - s); ctx.lineTo(f.x + s, f.y + s);
        ctx.moveTo(f.x + s, f.y - s); ctx.lineTo(f.x - s, f.y + s);
        ctx.stroke();
        ctx.restore();
      } else if (f.type === 'splash') {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t) * 0.75;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        const steps = 22;
        const growth = Math.min(1, t * 2.4);
        for (let i = 0; i <= steps; i++) {
          const ang = (i / steps) * Math.PI * 2;
          const rad = irregularRadiusAt(f.radius, ang, f.seed) * growth;
          const px = f.x + Math.cos(ang) * rad, py = f.y + Math.sin(ang) * rad;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (f.type === 'summon_arrow') {
        const su = world.units.find(x => x.id === f.targetId);
        if (su && su.alive) {
          const bob = Math.sin(world.time * 6) * 4;
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - t);
          ctx.fillStyle = '#ffd166';
          ctx.translate(su.x, su.y - su.radius - 34 + bob);
          ctx.beginPath();
          ctx.moveTo(0, 10); ctx.lineTo(-8, -6); ctx.lineTo(-3, -6); ctx.lineTo(-3, -14);
          ctx.lineTo(3, -14); ctx.lineTo(3, -6); ctx.lineTo(8, -6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  function drawDamageFlash() {
    const f = world.fx.find(x => x.type === 'damageflash');
    if (!f) return;
    const t = (world.time - f.start) / f.life;
    if (t >= 1) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t) * 0.5;
    const grad = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.height * 0.25,
      canvas.width / 2, canvas.height / 2, canvas.height * 0.72
    );
    grad.addColorStop(0, 'rgba(255,0,0,0)');
    grad.addColorStop(1, 'rgba(255,0,0,0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function drawPickups() {
    if (!world.pickups) return;
    for (const p of world.pickups) {
      const available = p.readyAt <= world.time;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = available ? 1 : 0.22;
      const color = p.type === 'health' ? '#5dffa0' : '#ffd166';
      ctx.fillStyle = 'rgba(8,12,18,0.65)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (p.type === 'health') {
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(3, -10); ctx.lineTo(-6, 2); ctx.lineTo(0, 2); ctx.lineTo(-3, 10); ctx.lineTo(6, -2); ctx.lineTo(0, -2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawTempWalls() {
    for (const w of world.tempWalls) {
      const remain = w.expiresAt - world.time;
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0.25, remain / 2));
      ctx.fillStyle = 'rgba(180,220,255,0.45)';
      ctx.strokeStyle = 'rgba(225,242,255,0.9)';
      ctx.lineWidth = 2;
      roundRectPath(ctx, w.x, w.y, w.w, w.h, 5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawNetMesh(cx, cy, r, color) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = color;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    const spacing = 11;
    for (let d = -r * 2; d <= r * 2; d += spacing) {
      ctx.beginPath();
      ctx.moveTo(cx - r + d, cy - r);
      ctx.lineTo(cx - r + d - r * 2, cy + r);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r + d, cy - r);
      ctx.lineTo(cx - r + d + r * 2, cy + r);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawHazards() {
    for (const hz of world.hazards) {
      if (hz.type === 'net') {
        drawNetMesh(hz.x, hz.y, hz.radius, '#9fffb0');
      } else if (hz.type === 'trail' && hz.points.length > 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,143,224,0.75)';
        ctx.lineWidth = 16;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(hz.points[0].x, hz.points[0].y);
        for (let i = 1; i < hz.points.length; i++) ctx.lineTo(hz.points[i].x, hz.points[i].y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawProjectileShape(p) {
    const r = p.radius;
    switch (p.shape) {
      case 'antibody': {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-r * 1.4, 0); ctx.lineTo(0, 0);
        ctx.moveTo(0, 0); ctx.lineTo(r * 1.1, r * 0.9);
        ctx.moveTo(0, 0); ctx.lineTo(r * 1.1, -r * 0.9);
        ctx.stroke();
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(-r * 1.4, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'dart': {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-r * 1.6, 0); ctx.lineTo(r * 1.1, 0); ctx.stroke();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(r * 1.7, 0); ctx.lineTo(r * 0.6, r * 0.5); ctx.lineTo(r * 0.6, -r * 0.5);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'rocket': {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(r * 1.6, 0); ctx.lineTo(-r * 0.8, r * 0.7); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(-r * 0.8, -r * 0.7);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, r * 0.6); ctx.lineTo(-r * 1.3, r * 0.9);
        ctx.moveTo(-r * 0.4, -r * 0.6); ctx.lineTo(-r * 1.3, -r * 0.9);
        ctx.stroke();
        break;
      }
      case 'missile': {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(r * 1.8, 0); ctx.lineTo(-r, r * 0.8); ctx.lineTo(-r, -r * 0.8);
        ctx.closePath(); ctx.fill();
        break;
      }
      default: {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.instaKill ? 14 : 6;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawProjectiles() {
    for (const p of world.projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      drawProjectileShape(p);
      ctx.restore();
    }
  }

  function drawUnits() {
    const local = getLocalUnit();
    for (const u of world.units) {
      if (!u.alive) continue;
      if (u.invisibleUntil > world.time && local && u.team !== local.team) {
        if (Math.hypot(u.x - local.x, u.y - local.y) > INVIS_DETECT_RANGE) continue;
      }
      const def = getCharacter(u.charId);
      const devouring = u.devourUntil > world.time;

      ctx.save();
      ctx.translate(u.x, u.y);
      ctx.rotate(u.angle);
      const idlePhase = world.time * 2.2 + u.id * 1.7;
      ctx.scale(1 + Math.sin(idlePhase) * 0.035, 1 + Math.cos(idlePhase * 0.8) * 0.035);
      if (u.invisibleUntil > world.time) ctx.globalAlpha = 0.45;
      drawCharacterShape(ctx, u, def);
      if (devouring) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(0, 0, u.radius * 1.1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (u.summonedBy) {
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(0, 0, u.radius * 1.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(u.x - 20, u.y - u.radius - 16, 40, 6);
      const teamColor = (u.team === 'immune' || u.team === 'allies') ? '#4fd1ff' : '#ff6b6b';
      ctx.fillStyle = teamColor;
      ctx.fillRect(u.x - 20, u.y - u.radius - 16, 40 * (u.hp / u.maxHp), 6);

      const isLocal = u.id === localUnitId;
      const isFriendly = local && u.team === local.team;
      const labelColor = isLocal ? '#ffe066' : (isFriendly ? '#7cffcb' : '#ff6b6b');
      const labelPrefix = isLocal ? 'YOU' : (isFriendly ? 'ALLY' : 'ENEMY');
      ctx.fillStyle = labelColor;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labelPrefix, u.x, u.y - u.radius - 28);
      ctx.fillStyle = '#e7edf5';
      ctx.font = '10px sans-serif';
      ctx.fillText(def.name, u.x, u.y - u.radius - 18);
    }
  }

  function getScoreboard(n) {
    return world.units.slice().sort((a, b) => b.kills - a.kills).slice(0, n);
  }

  function drawRadarArrows(missile) {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const ringR = Math.min(canvas.width, canvas.height) * 0.36;
    for (const e of world.units) {
      if (!e.alive || e.team === missile.team) continue;
      const dx = e.x - missile.x, dy = e.y - missile.y;
      const dist = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const ax = cx + Math.cos(ang) * ringR;
      const ay = cy + Math.sin(ang) * ringR;
      const size = clamp(2400 / (dist + 70), 6, 24);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(255,90,90,0.92)';
      ctx.beginPath();
      ctx.moveTo(size, 0); ctx.lineTo(-size * 0.55, size * 0.6); ctx.lineTo(-size * 0.55, -size * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
    ctx.stroke();
  }

  function renderMissileCam(u) {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const missile = getPilotedMissile(u);
    if (missile) {
      ctx.save();
      ctx.translate(canvas.width / 2 - camera.x, canvas.height / 2 - camera.y);
      ctx.translate(missile.x, missile.y);
      ctx.rotate(missile.angle);
      ctx.fillStyle = missile.color;
      ctx.shadowColor = missile.color;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-9, 8); ctx.lineTo(-4, 0); ctx.lineTo(-9, -8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      drawRadarArrows(missile);
    }
    ctx.restore();
    if (window.UI) window.UI.updateHud(world, u, mode, scores, killFeed, getScoreboard(6), localUnitId);
  }

  function render() {
    if (!canvas) return;
    const localU = getLocalUnit();
    if (localU && localU.pilotingId) {
      renderMissileCam(localU);
      return;
    }

    ctx.save();
    ctx.fillStyle = '#03050a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2 - camera.x, canvas.height / 2 - camera.y);

    drawMapBase();

    const u = getLocalUnit();
    if (u && u.alive) {
      const poly = computeVisibilityPolygon(u.x, u.y, 950, world.obstacles);
      ctx.save();
      ctx.beginPath();
      poly.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.clip();
      drawMapDetail();
      drawFlags();
      drawFloaters();
      drawTempWalls();
      drawPickups();
      drawHazards();
      drawFx();
      drawProjectiles();
      drawUnits();
      ctx.restore();
    } else {
      drawMapDetail();
      drawFlags();
      drawFloaters();
      drawTempWalls();
      drawPickups();
      drawHazards();
      drawFx();
      drawProjectiles();
      drawUnits();
    }

    ctx.restore();
    drawDamageFlash();
    if (window.UI) window.UI.updateHud(world, getLocalUnit(), mode, scores, killFeed, getScoreboard(6), localUnitId);
  }

  return {
    init, setupPvBot, setupPvEOffline, respawnAs,
    getLocalUnit, stopLoop,
    getMode: () => mode
  };
})();
