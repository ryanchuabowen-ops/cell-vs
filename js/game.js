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
// PvE kits cycle back much faster than pvbot's -- keeps the grind interesting
// and gives a solo hero more to actually rely on between waves.
const PVE_PICKUP_RESPAWN_DELAY = 12;
const HEALTH_PICKUP_FRACTION = 0.45;
const PICKUP_SPOTS = [
  { id: 'h1', type: 'health', x: 500, y: 300 },
  { id: 'h2', type: 'health', x: 500, y: 1000 },
  { id: 'h3', type: 'health', x: 1500, y: 300 },
  { id: 'h4', type: 'health', x: 1500, y: 1000 },
  { id: 'r1', type: 'recharge', x: 720, y: 650 },
  { id: 'r2', type: 'recharge', x: 1280, y: 650 }
];

// PvE is a solo wave-survival grind with no flag sanctuaries to heal at, so it
// gets a much denser spread of health/recharge kits than PvBot's 6.
const PVE_PICKUP_SPOTS = [
  { id: 'h1', type: 'health', x: 350, y: 250 },
  { id: 'h2', type: 'health', x: 350, y: 1050 },
  { id: 'h3', type: 'health', x: 750, y: 180 },
  { id: 'h4', type: 'health', x: 750, y: 1120 },
  { id: 'h5', type: 'health', x: 1150, y: 250 },
  { id: 'h6', type: 'health', x: 1150, y: 1050 },
  { id: 'h7', type: 'health', x: 1550, y: 400 },
  { id: 'h8', type: 'health', x: 1550, y: 900 },
  { id: 'r1', type: 'recharge', x: 550, y: 650 },
  { id: 'r2', type: 'recharge', x: 950, y: 450 },
  { id: 'r3', type: 'recharge', x: 950, y: 850 },
  { id: 'r4', type: 'recharge', x: 1350, y: 650 },
  { id: 'r5', type: 'recharge', x: 1700, y: 300 },
  { id: 'r6', type: 'recharge', x: 1700, y: 1000 }
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
  // Tallied across the whole match (survives respawns, unlike unit.kills/deaths
  // which reset on each new life) so the end screen can show real totals.
  let playerStats = { kills: 0, deaths: 0, assists: 0, damageDealt: 0, damageTaken: 0, weaponKills: {}, flagCaptures: 0 };
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
      localSpawnChoice: null,
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
      if (unit.id === localUnitId && w.localSpawnChoice) {
        // BF4-style deploy choice -- spawn exactly where the player picked,
        // as long as their team still holds that flag.
        const picked = owned.find(f => f.id === w.localSpawnChoice);
        if (picked) s = { x: picked.x, y: picked.y };
      } else if (owned.length && Math.random() < 0.6) {
        const pick = owned[Math.floor(Math.random() * owned.length)];
        s = { x: pick.x, y: pick.y };
      }
    }
    unit.x = clamp(s.x + (Math.random() - 0.5) * 140, 40, WORLD_W - 40);
    unit.y = clamp(s.y + (Math.random() - 0.5) * 140, 40, WORLD_H - 40);
  }

  function respawnUnit(u, w) {
    u.alive = true;
    const def = getCharacter(u.charId);
    if (u._hazardHpBonusActive) {
      u.maxHp -= def.hazardHpBonus;
      u._hazardHpBonusActive = false;
    }
    u.hp = u.maxHp;
    u.radius = u.baseRadius;
    u.speed = u.baseSpeed;
    u.devourUntil = 0;
    u.damageContributors = {};
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
          p.readyAt = world.time + (p.respawnDelay || PICKUP_RESPAWN_DELAY);
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
        const isLocalKiller = !!(killerUnit && killerUnit.id === localUnitId);
        const isLocalVictim = !!(victimUnit && victimUnit.id === localUnitId);
        if (isLocalKiller) {
          playerStats.kills++;
          const w = ev.weaponShape || 'dot';
          playerStats.weaponKills[w] = (playerStats.weaponKills[w] || 0) + 1;
        }
        if (isLocalVictim) playerStats.deaths++;
        killFeed.unshift({
          type: 'kill',
          killerName: killerUnit ? killerUnit.name : 'Something',
          victimName: victimUnit ? victimUnit.name : 'something',
          killerCharId: killerUnit ? killerUnit.charId : null,
          victimCharId: victimUnit ? victimUnit.charId : null,
          weaponShape: ev.weaponShape || 'dot',
          isLocalKiller: isLocalKiller,
          isLocalVictim: isLocalVictim
        });
      } else if (ev.t === 'flagcap') {
        killFeed.unshift({ type: 'text', text: (ev.team === 'immune' ? 'Immune' : 'Pathogen') + ' team captured ' + ev.flagName + '!' });
        // Captures/recaptures aren't attributed to one player (anyone
        // standing in the zone contributes), so this counts it as a team
        // accomplishment on the capturing side's own end-screen stats.
        const localU = world.units.find(u => u.id === localUnitId);
        if (localU && ev.team === localU.team) playerStats.flagCaptures = (playerStats.flagCaptures || 0) + 1;
      } else if (ev.t === 'flagtick') {
        scores[ev.team] = (scores[ev.team] || 0) + 1;
      } else if (ev.t === 'hit') {
        if (ev.attackerId === localUnitId) {
          world.fx.push({ type: 'hitmarker', x: ev.x, y: ev.y, start: world.time, life: 0.25 });
          playerStats.damageDealt += ev.amount || 0;
        }
        if (ev.victimId === localUnitId) {
          world.fx.push({ type: 'damageflash', start: world.time, life: 0.3 });
          playerStats.damageTaken += ev.amount || 0;
        }
      } else if (ev.t === 'assist') {
        if (ev.unitId === localUnitId) {
          playerStats.assists++;
          const victimUnit = world.units.find(u => u.id === ev.victim);
          killFeed.unshift({
            type: 'assist',
            victimName: victimUnit ? victimUnit.name : 'something',
            victimCharId: victimUnit ? victimUnit.charId : null
          });
          if (killFeed.length > 6) killFeed.pop();
        }
      } else if (ev.t === 'bonus_kill') {
        // A 75%+ damage contributor who wasn't the finishing blow still
        // counts as a real kill (matching the scoreboard, which already
        // reads kills straight off the unit) -- this just gets it into the
        // end-screen stats and kill feed too, same as a normal kill.
        if (ev.unitId === localUnitId) {
          playerStats.kills++;
          const w = ev.weaponShape || 'dot';
          playerStats.weaponKills[w] = (playerStats.weaponKills[w] || 0) + 1;
          const victimUnit = world.units.find(u => u.id === ev.victim);
          const localU = world.units.find(u => u.id === localUnitId);
          killFeed.unshift({
            type: 'kill',
            killerName: localU ? localU.name : 'You',
            victimName: victimUnit ? victimUnit.name : 'something',
            killerCharId: localU ? localU.charId : null,
            victimCharId: victimUnit ? victimUnit.charId : null,
            weaponShape: w,
            isLocalKiller: true,
            isLocalVictim: false
          });
          if (killFeed.length > 6) killFeed.pop();
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
      if (window.UI) window.UI.showMatchEnd(mode, matchResult, scores, playerStats);
    }
  }

  function resetState() {
    scores = { immune: 0, pathogen: 0 };
    killFeed = [];
    matchOver = false;
    matchResult = null;
    playerStats = { kills: 0, deaths: 0, assists: 0, damageDealt: 0, damageTaken: 0, weaponKills: {}, flagCaptures: 0 };
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
    world.pickups = PVE_PICKUP_SPOTS.map(p => ({ ...p, readyAt: 0, respawnDelay: PVE_PICKUP_RESPAWN_DELAY }));
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
  function respawnAs(charId, loadout) {
    const old = getLocalUnit();
    if (!old || old.alive) return;
    if (mode === 'pve' && world.heroLives <= 0) return;
    const idx = world.units.indexOf(old);
    if (idx === -1) return;
    const fresh = createUnit(charId, old.team, 'local', loadout);
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
    // Removed only after processEvents so a clone's kill (as killer or victim)
    // can still be looked up by name for the kill feed/banner this frame.
    world.units = world.units.filter(u => !(u.summonedBy && (!u.alive || world.time >= u.expiresAt)));
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
    // This dim layer renders unclipped by the vision polygon, so -- because a
    // wall's own footprint is geometrically never actually "inside" that
    // polygon as seen from outside it -- this is what a wall visually reads
    // as almost all the time. It needs the real per-theme silhouette, not a
    // flat rect, or every wall looks like a plain block no matter the theme.
    ctx.fillStyle = theme.wallFill;
    ctx.globalAlpha = 0.5;
    for (const w of WALLS) {
      if (theme.wallDecor === 'alveoli') {
        // Alveoli walls are a packed cluster of circles, not a single closed
        // silhouette -- wallSilhouettePath has no shape for that, so draw the
        // same cluster used in the detailed layer instead of falling back to
        // a plain rect here.
        const cols = Math.max(2, Math.round(w.w / 48));
        const rows = Math.max(2, Math.round(w.h / 48));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const jitterX = ((r * 53 + c * 97) % 13) - 6;
            const jitterY = ((r * 71 + c * 31) % 13) - 6;
            const sx = w.x + (c + 0.5) * (w.w / cols) + jitterX;
            const sy = w.y + (r + 0.5) * (w.h / rows) + jitterY;
            const rad = Math.min(w.w / cols, w.h / rows) * 0.62;
            ctx.beginPath(); ctx.arc(sx, sy, rad, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else {
        wallSilhouettePath(w, theme); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Floaters are obstacles too, so they have the exact same "own footprint
    // never actually inside the vision polygon" problem as walls -- without
    // this dim pass they'd fall back to nothing (or whatever drew under them)
    // instead of their themed shape.
    ctx.fillStyle = theme.floaterFill;
    ctx.globalAlpha = 0.5;
    for (const f of world.floaters) {
      const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
      const rx = f.w / 2, ry = f.h / 2;
      if (theme.wallDecor === 'vessel') {
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      } else if (theme.wallDecor === 'villi') {
        traceNetBlob(cx, cy, (rx + ry) / 2, f.seed, world.time); ctx.fill();
      } else if (theme.wallDecor === 'alveoli') {
        const offs = [[0, 0], [0.55, -0.4], [-0.5, -0.35], [0.3, 0.5], [-0.4, 0.45]];
        for (const [ox, oy] of offs) {
          ctx.beginPath(); ctx.arc(cx + ox * rx, cy + oy * ry, Math.min(rx, ry) * 0.55, 0, Math.PI * 2); ctx.fill();
        }
      } else if (theme.wallDecor === 'nodes') {
        hexPath(ctx, cx, cy, rx, ry); ctx.fill();
      } else {
        roundRectPath(ctx, f.x, f.y, f.w, f.h, 12); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Every wall still collides as the plain w.x/y/w/h rect -- these just trace
  // a per-theme silhouette (inscribed in or clipped to that same rect) so the
  // visual actually reads as vessel/gut/lung/node tissue instead of a block.
  function scallopRectPath(c, x, y, w, h, amp, freq) {
    c.beginPath();
    c.moveTo(x, y + Math.sin(0) * amp);
    for (let xx = 0; xx <= w; xx += 10) c.lineTo(x + xx, y + Math.sin(xx * freq) * amp);
    for (let yy = 0; yy <= h; yy += 10) c.lineTo(x + w + Math.sin(yy * freq + 2) * amp, y + yy);
    for (let xx = w; xx >= 0; xx -= 10) c.lineTo(x + xx, y + h + Math.sin(xx * freq + 4) * amp);
    for (let yy = h; yy >= 0; yy -= 10) c.lineTo(x + Math.sin(yy * freq + 6) * amp, y + yy);
    c.closePath();
  }

  function wallSilhouettePath(w, theme) {
    const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
    if (theme.wallDecor === 'vessel') {
      roundRectPath(ctx, w.x, w.y, w.w, w.h, Math.min(w.w, w.h) / 2);
    } else if (theme.wallDecor === 'nodes') {
      ctx.beginPath();
      ctx.ellipse(cx, cy, w.w / 2, w.h / 2, 0, 0, Math.PI * 2);
    } else if (theme.wallDecor === 'villi') {
      scallopRectPath(ctx, w.x, w.y, w.w, w.h, 6, 0.5);
    } else {
      ctx.beginPath();
      ctx.rect(w.x, w.y, w.w, w.h);
    }
  }

  function drawThemedWall(w, theme) {
    ctx.save();
    wallSilhouettePath(w, theme);
    ctx.fillStyle = theme.wallFill;
    ctx.globalAlpha = theme.wallDecor === 'alveoli' ? 0.5 : 1;
    ctx.fill();
    ctx.globalAlpha = theme.wallDecor === 'alveoli' ? 0.4 : 1;
    ctx.strokeStyle = theme.wallStroke;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.clip();

    if (theme.wallDecor === 'vessel') {
      // Pulsing flow lines down the lumen of the vessel.
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
      // Packed, overlapping alveolar sacs -- the cluster itself is the wall's
      // body, not a texture painted on top of a flat rectangle.
      const cols = Math.max(2, Math.round(w.w / 48));
      const rows = Math.max(2, Math.round(w.h / 48));
      ctx.fillStyle = theme.wallFill;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const jitterX = ((r * 53 + c * 97) % 13) - 6;
          const jitterY = ((r * 71 + c * 31) % 13) - 6;
          const sx = w.x + (c + 0.5) * (w.w / cols) + jitterX;
          const sy = w.y + (r + 0.5) * (w.h / rows) + jitterY;
          const rad = Math.min(w.w / cols, w.h / rows) * 0.62;
          ctx.beginPath(); ctx.arc(sx, sy, rad, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = theme.wallStroke;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
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

  function hexPath(c, cx, cy, rx, ry) {
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
  }

  function drawFloaters() {
    const theme = world.theme;
    for (const f of world.floaters) {
      const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
      const rx = f.w / 2, ry = f.h / 2;
      ctx.save();
      ctx.fillStyle = theme.floaterFill;
      ctx.strokeStyle = theme.floaterStroke;
      ctx.lineWidth = 2;

      if (theme.wallDecor === 'vessel') {
        // A red/white blood cell disc, with a lighter biconcave dimple.
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.save();
        ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2); ctx.clip();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = theme.floaterStroke;
        ctx.fillRect(f.x, f.y, f.w, f.h);
        ctx.restore();
      } else if (theme.wallDecor === 'villi') {
        // Loose, organic gut-flora blob that flexes over time.
        traceNetBlob(cx, cy, (rx + ry) / 2, f.seed, world.time);
        ctx.fill(); ctx.stroke();
      } else if (theme.wallDecor === 'alveoli') {
        // A small cluster of bubble-like sacs.
        const offs = [[0, 0], [0.55, -0.4], [-0.5, -0.35], [0.3, 0.5], [-0.4, 0.45]];
        for (const [ox, oy] of offs) {
          ctx.beginPath();
          ctx.arc(cx + ox * rx, cy + oy * ry, Math.min(rx, ry) * 0.55, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else if (theme.wallDecor === 'nodes') {
        // A small hexagonal lymphocyte.
        hexPath(ctx, cx, cy, rx, ry);
        ctx.fill();
        ctx.stroke();
      } else {
        roundRectPath(ctx, f.x, f.y, f.w, f.h, 12);
        ctx.fill();
        ctx.stroke();
      }
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
      } else if (f.type === 'reach_arm') {
        // A pseudopod stretching from the Macrophage out to whatever it's
        // about to devour -- grows out, wobbles, and quickly fades.
        const dx = f.x2 - f.x1, dy = f.y2 - f.y1;
        const dist = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx);
        const grow = Math.min(1, t * 3.2);
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t * 1.3);
        ctx.strokeStyle = f.color;
        ctx.fillStyle = f.color;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(f.x1, f.y1);
        const segs = 10;
        let tipX = f.x1, tipY = f.y1;
        for (let i = 1; i <= segs; i++) {
          const p = (i / segs) * grow;
          const px = f.x1 + Math.cos(ang) * dist * p;
          const py = f.y1 + Math.sin(ang) * dist * p;
          const wob = Math.sin(p * Math.PI * 3 + world.time * 10) * 4 * (1 - p * 0.5);
          const px2 = px - Math.sin(ang) * wob, py2 = py + Math.cos(ang) * wob;
          ctx.lineTo(px2, py2);
          tipX = px2; tipY = py2;
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(tipX, tipY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
      ctx.translate(w.x + w.w / 2, w.y + w.h / 2);
      ctx.rotate(w.angle || 0);
      ctx.globalAlpha = Math.min(1, Math.max(0.25, remain / 2));
      ctx.fillStyle = 'rgba(180,220,255,0.45)';
      ctx.strokeStyle = 'rgba(225,242,255,0.9)';
      ctx.lineWidth = 2;
      roundRectPath(ctx, -w.w / 2, -w.h / 2, w.w, w.h, 5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function traceNetBlob(cx, cy, r, seed, t) {
    const segs = 28;
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const rad = flexRadiusAt(r, a, seed, t);
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // A NET trap isn't a rigid disc -- it's a loose mesh caught in fluid, so its
  // outline continuously stretches/bends into ellipses and irregular bulges
  // even while nothing is touching it.
  function drawNetMesh(cx, cy, r, color, seed) {
    seed = seed || 0;
    const t = world.time;
    const m = r * 1.5; // covers the blob's max bulge (sine amplitudes sum to ~1.43x)
    ctx.save();
    traceNetBlob(cx, cy, r, seed, t);
    ctx.clip();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = color;
    ctx.fillRect(cx - m, cy - m, m * 2, m * 2);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    const spacing = 11;
    for (let d = -m * 2; d <= m * 2; d += spacing) {
      ctx.beginPath();
      ctx.moveTo(cx - m + d, cy - m);
      ctx.lineTo(cx - m + d - m * 2, cy + m);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - m + d, cy - m);
      ctx.lineTo(cx - m + d + m * 2, cy + m);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.9;
    traceNetBlob(cx, cy, r, seed, t);
    ctx.stroke();
    ctx.restore();
  }

  function drawHazards() {
    const local = getLocalUnit();
    for (const hz of world.hazards) {
      if (hz.type === 'net') {
        drawNetMesh(hz.x, hz.y, hz.radius, '#9fffb0', hz.id * 0.91);
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
      } else if (hz.type === 'cloud') {
        // A thick, billowing toxic cloud -- layered organic blobs so it
        // reads as genuinely opaque gas, not a thin outline.
        ctx.save();
        const seed = hz.id * 0.77;
        const fadeIn = Math.min(1, hz.age / 0.5);
        const fadeOut = Math.min(1, (hz.life - hz.age) / 0.6);
        const fade = Math.min(fadeIn, fadeOut);
        const layers = [
          { r: hz.radius, dx: 0, dy: 0, a: 0.5 },
          { r: hz.radius * 0.75, dx: Math.sin(world.time * 0.6 + seed) * hz.radius * 0.25, dy: Math.cos(world.time * 0.5 + seed) * hz.radius * 0.2, a: 0.45 },
          { r: hz.radius * 0.65, dx: Math.cos(world.time * 0.4 + seed * 1.3) * hz.radius * 0.25, dy: Math.sin(world.time * 0.7 + seed * 1.3) * hz.radius * 0.2, a: 0.4 }
        ];
        ctx.fillStyle = '#b6ff6e';
        for (const L of layers) {
          ctx.globalAlpha = L.a * fade;
          traceNetBlob(hz.x + L.dx, hz.y + L.dy, L.r, seed + L.r, world.time * 0.6);
          ctx.fill();
        }
        ctx.globalAlpha = 0.9 * fade;
        ctx.strokeStyle = 'rgba(180,255,100,0.5)';
        ctx.lineWidth = 2;
        traceNetBlob(hz.x, hz.y, hz.radius, seed, world.time * 0.6);
        ctx.stroke();
        ctx.restore();
      } else if (hz.type === 'mine') {
        // Invisible to the enemy -- only the owner's own team can see where
        // their mines are planted.
        if (local && hz.team !== local.team) continue;
        const pulse = 0.5 + Math.sin(world.time * 3 + hz.id) * 0.3;
        ctx.save();
        ctx.translate(hz.x, hz.y);
        ctx.globalAlpha = 0.55 + pulse * 0.25;
        ctx.fillStyle = '#ff8fe0';
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
          ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13);
          ctx.stroke();
        }
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
      case 'igg3missile': {
        const flicker = 0.7 + Math.sin(world.time * 40 + p.id) * 0.3;
        ctx.save();
        ctx.globalAlpha = 0.85;
        const grad = ctx.createLinearGradient(-r * 3.4, 0, -r * 0.5, 0);
        grad.addColorStop(0, 'rgba(255,110,10,0)');
        grad.addColorStop(0.55, 'rgba(255,150,30,0.85)');
        grad.addColorStop(1, 'rgba(255,235,150,0.95)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.55);
        ctx.lineTo(-r * (2.3 + flicker), 0);
        ctx.lineTo(-r * 0.5, r * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = 'rgba(255,230,160,0.9)';
        ctx.beginPath();
        ctx.arc(-r * 0.5, 0, r * 0.3 * flicker, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.3, 0);
        ctx.moveTo(r * 0.3, 0); ctx.lineTo(r * 1.3, r * 1.0);
        ctx.moveTo(r * 0.3, 0); ctx.lineTo(r * 1.3, -r * 1.0);
        ctx.stroke();
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(-r * 0.5, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'rod': {
        const len = r * 3.2, half = len / 2, hw = r * 0.7;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.instaKill ? 16 : 6;
        ctx.beginPath();
        ctx.arc(half, 0, hw, -Math.PI / 2, Math.PI / 2);
        ctx.arc(-half, 0, hw, Math.PI / 2, -Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-half * 0.55, 0); ctx.lineTo(half * 0.55, 0); ctx.stroke();
        break;
      }
      case 'genome': {
        // A small double-helix strand with a glowing injector tip.
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        const amp = r * 0.5, span = r * 1.4;
        ctx.beginPath();
        for (let i = -span; i <= span; i += 2) {
          const y = Math.sin(i * 0.9) * amp;
          if (i === -span) ctx.moveTo(i, y); else ctx.lineTo(i, y);
        }
        ctx.stroke();
        ctx.beginPath();
        for (let i = -span; i <= span; i += 2) {
          const y = Math.sin(i * 0.9 + Math.PI) * amp;
          if (i === -span) ctx.moveTo(i, y); else ctx.lineTo(i, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 0.55;
        for (let i = -span; i <= span; i += span) {
          const y1 = Math.sin(i * 0.9) * amp, y2 = Math.sin(i * 0.9 + Math.PI) * amp;
          ctx.beginPath(); ctx.moveTo(i, y1); ctx.lineTo(i, y2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(span, 0, r * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
      case 'capsid': {
        // A small faceted viral particle -- distinct from Coronavirus's larger spike ball.
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      }
      case 'spore': {
        const len = r * 1.6, hw = r * 1.1;
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.9;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.ellipse(0, 0, len, hw, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, len * 0.6, hw * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'spike': {
        const core = r * 0.55;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(0, 0, core, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        const spikeCount = 8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        for (let i = 0; i < spikeCount; i++) {
          const a = (Math.PI * 2 * i) / spikeCount + 0.3;
          const x1 = Math.cos(a) * core, y1 = Math.sin(a) * core;
          const x2 = Math.cos(a) * r * 1.5, y2 = Math.sin(a) * r * 1.5;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.beginPath(); ctx.arc(x2, y2, r * 0.22, 0, Math.PI * 2); ctx.fill();
        }
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

      if (u.maxShield > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(u.x - 20, u.y - u.radius - 23, 40, 4);
        ctx.fillStyle = '#7cffcb';
        ctx.fillRect(u.x - 20, u.y - u.radius - 23, 40 * (u.shield / u.maxShield), 4);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(u.x - 20, u.y - u.radius - 16, 40, 6);
      const teamColor = (u.team === 'immune' || u.team === 'allies') ? '#4fd1ff' : '#ff6b6b';
      ctx.fillStyle = teamColor;
      ctx.fillRect(u.x - 20, u.y - u.radius - 16, 40 * (u.hp / u.maxHp), 6);
      if (u.shield > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(124,255,203,0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

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

      // The pilot's own camera still respects walls (even though the missile
      // itself can physically punch through them) -- a tight visibility bubble
      // so you can actually see what's nearby, not just a radar blip.
      const poly = computeVisibilityPolygon(missile.x, missile.y, 430, world.obstacles);
      ctx.save();
      ctx.beginPath();
      poly.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.clip();
      drawMapDetail();
      drawFloaters();
      drawTempWalls();
      drawUnits();
      ctx.restore();

      ctx.save();
      ctx.translate(missile.x, missile.y);
      ctx.rotate(missile.angle);
      ctx.shadowColor = missile.color;
      ctx.shadowBlur = 20;
      drawProjectileShape(missile);
      ctx.restore();

      ctx.restore();

      const grad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.16,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.62
      );
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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

  function setSpawnChoice(flagId) {
    if (world) world.localSpawnChoice = flagId;
  }

  // BF4-style deploy list: home base plus whichever capturable flags your
  // own team currently holds.
  function getSpawnOptions() {
    const u = getLocalUnit();
    if (!world || !u) return [];
    const options = [{ id: null, name: 'Home Base' }];
    if (mode === 'pvbot' && world.flags) {
      for (const f of world.flags) {
        if (f.capturable && f.owner === u.team) options.push({ id: f.id, name: f.name });
      }
    }
    return options;
  }

  return {
    init, setupPvBot, setupPvEOffline, respawnAs,
    getLocalUnit, stopLoop,
    getMode: () => mode,
    setSpawnChoice, getSpawnOptions
  };
})();
