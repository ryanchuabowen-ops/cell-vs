(function () {
  const screens = {};
  let pendingAction = null;
  let gameInited = false;
  let respawnPickerShownFor = null;

  // Remembers each character's last-chosen ability loadout so re-picking the
  // same character (including on respawn) starts from where you left off.
  const lastLoadout = {};
  function getDefaultLoadout(charId) {
    const saved = lastLoadout[charId];
    return { primaryIdx: saved ? saved.primaryIdx : 0, secondaryIdx: saved ? saved.secondaryIdx : 0 };
  }
  function saveLoadout(charId, loadout) {
    lastLoadout[charId] = { primaryIdx: loadout.primaryIdx, secondaryIdx: loadout.secondaryIdx };
  }

  function $(id) { return document.getElementById(id); }

  function showScreen(id) {
    for (const key in screens) screens[key].classList.add('hidden');
    if (screens[id]) screens[id].classList.remove('hidden');
    if (id === 'screen-game' && !gameInited) {
      Game.init($('gamecanvas'));
      gameInited = true;
    }
  }

  function charIdSeed(charId) {
    let h = 0;
    for (let i = 0; i < charId.length; i++) h = (h * 31 + charId.charCodeAt(i)) % 1000;
    return h;
  }

  function renderSwatch(canvas, def, charId, size) {
    size = size || 44;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    const fakeUnit = { id: charIdSeed(charId), radius: size * 0.36, skin: null, devourUntil: 0 };
    drawCharacterShape(ctx, fakeUnit, def);
    ctx.restore();
  }

  function renderWeaponIcon(canvas, shape, color) {
    canvas.width = 22; canvas.height = 22;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 22, 22);
    ctx.save();
    ctx.translate(11, 11);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    switch (shape) {
      case 'antibody':
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(0, 0); ctx.moveTo(0, 0); ctx.lineTo(5, 4); ctx.moveTo(0, 0); ctx.lineTo(5, -4); ctx.stroke();
        break;
      case 'dart':
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(3, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(2, 2.5); ctx.lineTo(2, -2.5); ctx.closePath(); ctx.fill();
        break;
      case 'rocket':
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, 3); ctx.lineTo(-2, 0); ctx.lineTo(-4, -3); ctx.closePath(); ctx.fill();
        break;
      case 'missile':
      case 'igg3missile':
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, 4); ctx.lineTo(-5, -4); ctx.closePath(); ctx.fill();
        break;
      case 'net':
        ctx.beginPath();
        ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(-6, 6); ctx.lineTo(6, -6);
        ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.moveTo(-7, 0); ctx.lineTo(7, 0);
        ctx.stroke();
        break;
      case 'mine':
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4); ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7); ctx.stroke();
        }
        break;
      case 'trail':
        ctx.beginPath(); ctx.moveTo(-6, 5); ctx.lineTo(0, -3); ctx.lineTo(6, 5); ctx.stroke();
        break;
      case 'burst':
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7); ctx.stroke(); }
        break;
      case 'devour':
        ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        break;
      case 'nuke':
        ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke();
        break;
      case 'clone':
        ctx.beginPath(); ctx.arc(-3, 0, 4.5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(3, 0, 4.5, 0, Math.PI * 2); ctx.stroke();
        break;
      case 'invis':
        ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        break;
      case 'claw':
        ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(3, 6); ctx.moveTo(-1, -6); ctx.lineTo(7, 6); ctx.stroke();
        break;
      case 'spore':
        ctx.beginPath(); ctx.ellipse(0, 0, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.5, 0, 0, Math.PI * 2); ctx.stroke();
        break;
      case 'rod':
        ctx.beginPath();
        ctx.arc(5, 0, 3, -Math.PI / 2, Math.PI / 2);
        ctx.arc(-5, 0, 3, Math.PI / 2, -Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        break;
      case 'spike':
        ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 7; i++) {
          const a = i / 7 * Math.PI * 2 + 0.2;
          const x1 = Math.cos(a) * 3.5, y1 = Math.sin(a) * 3.5;
          const x2 = Math.cos(a) * 8, y2 = Math.sin(a) * 8;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.beginPath(); ctx.arc(x2, y2, 1.4, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case 'genome':
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let i = -7; i <= 7; i += 1) { const y = Math.sin(i * 0.9) * 3; if (i === -7) ctx.moveTo(i, y); else ctx.lineTo(i, y); }
        ctx.stroke();
        ctx.beginPath();
        for (let i = -7; i <= 7; i += 1) { const y = Math.sin(i * 0.9 + Math.PI) * 3; if (i === -7) ctx.moveTo(i, y); else ctx.lineTo(i, y); }
        ctx.stroke();
        break;
      case 'capsid':
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const x = Math.cos(a) * 6, y = Math.sin(a) * 6; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.closePath();
        ctx.fill();
        break;
      case 'cloud':
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(-3, 1, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3, 0, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -3, 3.5, 0, Math.PI * 2); ctx.fill();
        break;
      default:
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  const SHAPE_LABELS = {
    antibody: 'Antibody', dart: 'Toxin Dart', rocket: 'Rocket', missile: 'Guided Missile',
    igg3missile: 'IgG3 Missile', net: 'NET Trap', mine: 'Toxin Mine', trail: 'SpeB Trail',
    burst: 'Respiratory Burst', devour: 'Devour', nuke: 'Lethal Toxin', clone: 'Viral Clone',
    invis: 'Stealth Strike', claw: 'Melee', dot: 'Contact', spike: 'Spike Burst', rod: 'Lethal Toxin',
    spore: 'Dormant Endospore', genome: 'Genome Injection', capsid: 'Capsid Burst', cloud: 'Respiratory Burst'
  };

  function makeCharCard(def, opts) {
    opts = opts || {};
    const compact = !!opts.compact;
    const charId = opts.charId || def.id;
    const card = document.createElement('div');
    card.className = 'char-card' + (compact ? ' compact' : '');
    card.style.setProperty('--card-color', def.color);

    const canvas = document.createElement('canvas');
    canvas.className = 'char-swatch-canvas';
    card.appendChild(canvas);

    const nameDiv = document.createElement('div');
    nameDiv.className = 'char-name';
    nameDiv.textContent = opts.label || def.name;
    card.appendChild(nameDiv);

    const sideDiv = document.createElement('div');
    sideDiv.className = 'char-side';
    sideDiv.textContent = def.side;
    card.appendChild(sideDiv);

    if (!compact) {
      const blurb = document.createElement('div');
      blurb.className = 'char-blurb';
      blurb.textContent = def.blurb;
      card.appendChild(blurb);

      // Dual-option characters get picked from at char-select -- show every
      // option here, not just whichever sits first in the list, so this page
      // actually reflects the full kit.
      function renderSlot(label, options) {
        options.forEach((opt, i) => {
          const row = document.createElement('div');
          row.className = 'char-ability';
          const tag = options.length > 1 ? label + ' · Option ' + String.fromCharCode(65 + i) : label;
          row.innerHTML = '<b>' + tag + ' ' + opt.name + ':</b> ' + opt.desc;
          card.appendChild(row);
        });
      }
      renderSlot('RMB', def.primaryOptions || [def.primary]);
      renderSlot('LMB', def.secondaryOptions || [def.secondary]);
    }

    renderSwatch(canvas, def, charId);
    return card;
  }

  function buildGroupedGrid(container, groups, onSelect, compact) {
    container.innerHTML = '';
    for (const group of groups) {
      const section = document.createElement('div');
      section.className = 'char-group';
      const h = document.createElement('h3');
      h.className = 'char-group-title ' + group.cls;
      h.textContent = group.title;
      section.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'char-grid small' + (compact ? ' compact' : '');
      for (const entry of group.entries) {
        const card = makeCharCard(entry.def, { label: entry.label, compact, charId: entry.charId });
        if (onSelect) card.addEventListener('click', () => onSelect(card, entry.charId));
        grid.appendChild(card);
      }
      section.appendChild(grid);
      container.appendChild(section);
    }
  }

  function phageGroup() {
    return { title: 'Phage Hero (fights alongside the immune side)', cls: 'phage-title', entries: PHAGE_IDS.map(id => ({ def: CHARACTERS[id], charId: id })) };
  }
  function immuneGroup(subtitle) {
    return { title: 'Immune Cells' + (subtitle ? ' (' + subtitle + ')' : ''), cls: 'immune-title', entries: IMMUNE_IDS.map(id => ({ def: CHARACTERS[id], charId: id })) };
  }
  function pathogenGroup(subtitle) {
    return { title: 'Pathogens' + (subtitle ? ' (' + subtitle + ')' : ''), cls: 'pathogen-title', entries: PATHOGEN_IDS.map(id => ({ def: CHARACTERS[id], charId: id })) };
  }

  function buildCharacterShowcase() {
    buildGroupedGrid($('char-grid-display'), [immuneGroup(), pathogenGroup(), phageGroup()], null, false);
  }

  // A self-contained picker: a grid of cards + a detail panel (ability
  // description, or an option picker for dual-ability characters) + a
  // confirm button, all in normal document flow so nothing overlaps or
  // requires absolute positioning.
  function makeCharPicker(gridSel, detailSel, confirmSel) {
    let curCharId = null;
    let curLoadout = { primaryIdx: 0, secondaryIdx: 0 };

    function buildOptionRow(label, options, key) {
      const row = document.createElement('div');
      row.className = 'ability-pick-row';
      const lab = document.createElement('div');
      lab.className = 'ability-pick-label';
      lab.textContent = label;
      row.appendChild(lab);
      options.forEach((opt, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ability-pick-btn' + (i === curLoadout[key] ? ' active' : '');
        b.textContent = opt.name;
        b.title = opt.desc;
        b.addEventListener('click', () => { curLoadout[key] = i; rerenderDetail(); });
        row.appendChild(b);
      });
      return row;
    }

    function rerenderDetail() {
      const detail = document.querySelector(detailSel);
      const def = CHARACTERS[curCharId];
      detail.innerHTML = '';
      detail.classList.remove('hidden');

      const nameEl = document.createElement('div');
      nameEl.className = 'char-detail-name';
      nameEl.textContent = def.name;
      detail.appendChild(nameEl);

      if (def.primaryOptions) detail.appendChild(buildOptionRow('RMB Primary', def.primaryOptions, 'primaryIdx'));
      else {
        const p = document.createElement('div');
        p.className = 'char-ability';
        p.innerHTML = '<b>RMB ' + def.primary.name + ':</b> ' + def.primary.desc;
        detail.appendChild(p);
      }
      if (def.secondaryOptions) detail.appendChild(buildOptionRow('LMB Secondary', def.secondaryOptions, 'secondaryIdx'));
      else {
        const s = document.createElement('div');
        s.className = 'char-ability';
        s.innerHTML = '<b>LMB ' + def.secondary.name + ':</b> ' + def.secondary.desc;
        detail.appendChild(s);
      }
    }

    function select(card, charId) {
      document.querySelectorAll(gridSel + ' .char-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      curCharId = charId;
      curLoadout = getDefaultLoadout(charId);
      rerenderDetail();
      document.querySelector(confirmSel).classList.remove('hidden');
    }

    function reset() {
      curCharId = null;
      const detail = document.querySelector(detailSel);
      detail.classList.add('hidden');
      detail.innerHTML = '';
      document.querySelector(confirmSel).classList.add('hidden');
    }

    function getSelection() { return { charId: curCharId, loadout: curLoadout }; }

    return { select, reset, getSelection };
  }

  const charSelectPicker = makeCharPicker('#charselect-grid', '#charselect-detail', '#charselect-confirm');
  const respawnPicker = makeCharPicker('#respawn-grid', '#respawn-detail', '#respawn-confirm');

  function openCharSelect(action) {
    pendingAction = action;
    const grid = $('charselect-grid');
    const title = $('charselect-title');
    charSelectPicker.reset();

    if (action === 'pvbot') {
      title.textContent = 'Choose your character';
      buildGroupedGrid(grid, [immuneGroup(), pathogenGroup()], (card, charId) => charSelectPicker.select(card, charId), true);
    } else if (action === 'pve') {
      // PvE is a dedicated hero-defense mode built around the two phage
      // heroes' kits -- immune/pathogen characters stay pvbot-only.
      title.textContent = 'Choose your hero';
      buildGroupedGrid(grid, [phageGroup()], (card, charId) => charSelectPicker.select(card, charId), true);
    }

    showScreen('screen-charselect');
  }

  function onConfirmCharSelect() {
    const sel = charSelectPicker.getSelection();
    if (!sel.charId) { alert('Pick a character first.'); return; }
    saveLoadout(sel.charId, sel.loadout);
    if (pendingAction === 'pvbot') {
      showScreen('screen-game');
      Game.setupPvBot(sel.charId, sel.loadout);
    } else if (pendingAction === 'pve') {
      showScreen('screen-game');
      Game.setupPvEOffline(sel.charId, sel.loadout);
    }
  }

  function onConfirmRespawn() {
    const sel = respawnPicker.getSelection();
    if (!sel.charId) return;
    saveLoadout(sel.charId, sel.loadout);
    Game.respawnAs(sel.charId, sel.loadout);
  }

  function formatTime(s) {
    s = Math.max(0, Math.ceil(s));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  let killBannerTimer = null;
  function showKillBanner(victimName) {
    const el = $('kill-banner');
    el.textContent = victimName.toUpperCase() + ' ELIMINATED';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    if (killBannerTimer) clearTimeout(killBannerTimer);
    killBannerTimer = setTimeout(() => el.classList.remove('show'), 1100);
  }

  let lastSeenKillEntry = null;
  function renderKillFeed(killFeed) {
    const feed = $('hud-killfeed');
    feed.innerHTML = '';
    killFeed.slice(0, 5).forEach(k => {
      const row = document.createElement('div');
      if (k.type === 'kill') {
        row.className = 'kf-row' + (k.isLocalKiller ? ' kf-mine' : (k.isLocalVictim ? ' kf-against' : ''));
        const kIcon = document.createElement('canvas'); kIcon.className = 'kf-char-icon';
        const kName = document.createElement('span'); kName.textContent = k.killerName;
        const wIcon = document.createElement('canvas'); wIcon.className = 'kf-weapon-icon';
        const vName = document.createElement('span'); vName.textContent = k.victimName;
        const vIcon = document.createElement('canvas'); vIcon.className = 'kf-char-icon';
        row.append(kIcon, kName, wIcon, vName, vIcon);
        feed.appendChild(row);
        if (k.killerCharId) renderSwatch(kIcon, CHARACTERS[k.killerCharId], k.killerCharId, 36);
        if (k.victimCharId) renderSwatch(vIcon, CHARACTERS[k.victimCharId], k.victimCharId, 36);
        renderWeaponIcon(wIcon, k.weaponShape, k.isLocalKiller ? '#ffe066' : (k.isLocalVictim ? '#ff6b6b' : '#cfd8e3'));
      } else if (k.type === 'assist') {
        row.className = 'kf-row kf-assist';
        const badge = document.createElement('span'); badge.className = 'kf-assist-badge'; badge.textContent = 'ASSIST';
        const vIcon = document.createElement('canvas'); vIcon.className = 'kf-char-icon';
        const vName = document.createElement('span'); vName.textContent = k.victimName;
        row.append(badge, vIcon, vName);
        feed.appendChild(row);
        if (k.victimCharId) renderSwatch(vIcon, CHARACTERS[k.victimCharId], k.victimCharId, 36);
      } else {
        row.className = 'kf-row kf-text';
        row.textContent = k.text;
        feed.appendChild(row);
      }
    });

    if (killFeed.length && killFeed[0] !== lastSeenKillEntry) {
      lastSeenKillEntry = killFeed[0];
      const k = killFeed[0];
      if (k.type === 'kill' && k.isLocalKiller) showKillBanner(k.victimName);
    }
  }

  function updateHud(world, localUnit, mode, scores, killFeed, scoreboard, localUnitId) {
    $('hud-location').textContent = world.theme ? world.theme.name : '';

    if (mode === 'pvbot') {
      $('hud-score').textContent = 'Immune ' + (scores.immune || 0) + ' — ' + (scores.pathogen || 0) + ' Pathogen';
      $('hud-wave').textContent = 'Time left: ' + formatTime(world.matchTime);
      const flagsEl = $('hud-flags');
      flagsEl.innerHTML = '';
      for (const f of (world.flags || [])) {
        if (!f.capturable) continue;
        const dot = document.createElement('span');
        dot.className = 'flag-dot';
        dot.style.background = f.owner === 'immune' ? '#4fd1ff' : f.owner === 'pathogen' ? '#ff6b6b' : '#8fa0bd';
        dot.title = f.name;
        flagsEl.appendChild(dot);
      }
    } else {
      $('hud-score').textContent = '';
      $('hud-wave').textContent = 'Wave ' + (world.wave || 0) + ' / 8 — Hero lives: ' + Math.max(0, world.heroLives);
      $('hud-flags').innerHTML = '';
    }

    updateRespawnPicker(world, localUnit, mode);
    renderKillFeed(killFeed);

    const board = $('hud-scoreboard');
    const local = localUnit;
    board.innerHTML = '<div class="scoreboard-title">Top Kills</div>' + scoreboard.map(u => {
      const def = CHARACTERS[u.charId];
      const friendly = local && u.team === local.team;
      const cls = u.id === localUnitId ? 'you' : (friendly ? 'ally' : 'enemy');
      return '<div class="scoreboard-row ' + cls + '"><span class="sb-swatch" style="background:' + def.color + '"></span>' + def.name + '<b>' + u.kills + '</b></div>';
    }).join('');

    if (!localUnit) return;
    const primaryAb = localUnit.abilities.primary, secondaryAb = localUnit.abilities.secondary;
    $('hud-hp-fill').style.width = Math.max(0, (localUnit.hp / localUnit.maxHp) * 100) + '%';
    $('hud-hp-text').textContent = Math.ceil(Math.max(0, localUnit.hp)) + ' / ' + localUnit.maxHp + (localUnit.alive ? '' : ' — respawning...');

    const shieldBar = $('hud-shield-bar');
    if (localUnit.maxShield > 0) {
      shieldBar.classList.remove('hidden');
      $('hud-shield-fill').style.width = Math.max(0, (localUnit.shield / localUnit.maxShield) * 100) + '%';
    } else {
      shieldBar.classList.add('hidden');
    }

    const pOverlay = $('ability-primary').querySelector('.cd-overlay');
    const sOverlay = $('ability-secondary').querySelector('.cd-overlay');
    const wOverlay = $('ability-wall').querySelector('.cd-overlay');
    pOverlay.style.height = Math.max(0, Math.min(100, (localUnit.cd.primary / primaryAb.cooldown) * 100)) + '%';
    sOverlay.style.height = Math.max(0, Math.min(100, (localUnit.cd.secondary / secondaryAb.cooldown) * 100)) + '%';
    wOverlay.style.height = Math.max(0, Math.min(100, (localUnit.cd.wall / WALL_KIT_COOLDOWN) * 100)) + '%';
    $('ability-primary-name').textContent = primaryAb.name;
    $('ability-secondary-name').textContent = secondaryAb.name;
  }

  function updateRespawnPicker(world, localUnit, mode) {
    const el = $('respawn-picker');
    if (!el) return;
    if (!localUnit || localUnit.alive) {
      el.classList.add('hidden');
      respawnPickerShownFor = null;
      return;
    }
    el.classList.remove('hidden');
    if (respawnPickerShownFor === localUnit.id) return;
    respawnPickerShownFor = localUnit.id;

    const grid = $('respawn-grid');
    respawnPicker.reset();
    let diedAsCard = null;
    let firstId;

    // Both modes respawn from a flat, team-locked pool: pvbot locks to your
    // side, PvE locks to the phage heroes the mode is built around.
    grid.className = 'char-grid small compact';
    const pool = mode === 'pvbot' ? (localUnit.team === 'immune' ? IMMUNE_IDS : PATHOGEN_IDS) : PHAGE_IDS;
    grid.innerHTML = '';
    for (const id of pool) {
      const card = makeCharCard(CHARACTERS[id], { compact: true, charId: id });
      card.addEventListener('click', () => respawnPicker.select(card, id));
      grid.appendChild(card);
      if (id === localUnit.charId) diedAsCard = card;
    }
    firstId = pool[0];
    // Default back to the character (and loadout) you just died as -- one
    // click to redeploy, but the full picker is still right there to change it.
    respawnPicker.select(diedAsCard || grid.querySelector('.char-card'), diedAsCard ? localUnit.charId : firstId);
  }

  function showMatchEnd(mode, result, scores, stats) {
    const title = $('matchend-title');
    const sub = $('matchend-sub');
    const scorebar = $('matchend-scorebar');
    if (mode === 'pvbot') {
      if (result === 'draw') {
        title.textContent = 'Draw!';
      } else {
        title.textContent = (result === 'immune' ? 'Immune System Wins!' : 'Pathogens Win!');
      }
      sub.textContent = 'Final score — Immune ' + scores.immune + ' : ' + scores.pathogen + ' Pathogen';
      const total = Math.max(1, scores.immune + scores.pathogen);
      $('matchend-scorebar-immune').style.width = (scores.immune / total * 100) + '%';
      $('matchend-scorebar-pathogen').style.width = (scores.pathogen / total * 100) + '%';
      scorebar.classList.remove('hidden');
    } else {
      title.textContent = result === 'victory' ? 'Infection Cleared!' : 'The Host Has Fallen...';
      sub.textContent = result === 'victory' ? 'All 8 waves survived.' : 'Your hero ran out of lives.';
      scorebar.classList.add('hidden');
    }

    stats = stats || { kills: 0, deaths: 0, assists: 0, damageDealt: 0, damageTaken: 0, weaponKills: {} };
    $('me-kills').textContent = stats.kills;
    $('me-deaths').textContent = stats.deaths;
    $('me-assists').textContent = stats.assists;
    $('me-kd').textContent = (stats.deaths > 0 ? stats.kills / stats.deaths : stats.kills).toFixed(2);
    $('me-dmg-dealt').textContent = Math.round(stats.damageDealt);
    $('me-dmg-taken').textContent = Math.round(stats.damageTaken);

    const weaponsWrap = $('matchend-weapons');
    weaponsWrap.innerHTML = '';
    const entries = Object.entries(stats.weaponKills || {}).sort((a, b) => b[1] - a[1]);
    if (entries.length) {
      const heading = document.createElement('div');
      heading.className = 'matchend-weapons-title';
      heading.textContent = 'Weapon Breakdown';
      weaponsWrap.appendChild(heading);
      const maxKills = entries[0][1];
      for (const [shape, count] of entries) {
        const row = document.createElement('div');
        row.className = 'weapon-row';
        const icon = document.createElement('canvas');
        icon.className = 'weapon-row-icon';
        renderWeaponIcon(icon, shape, '#e7edf5');
        row.appendChild(icon);
        const label = document.createElement('span');
        label.className = 'weapon-row-label';
        label.textContent = SHAPE_LABELS[shape] || 'Unknown';
        row.appendChild(label);
        const barWrap = document.createElement('div');
        barWrap.className = 'weapon-row-barwrap';
        const bar = document.createElement('div');
        bar.className = 'weapon-row-bar';
        bar.style.width = (count / maxKills * 100) + '%';
        barWrap.appendChild(bar);
        row.appendChild(barWrap);
        const countEl = document.createElement('span');
        countEl.className = 'weapon-row-count';
        countEl.textContent = count;
        row.appendChild(countEl);
        weaponsWrap.appendChild(row);
      }
    } else {
      const empty = document.createElement('div');
      empty.className = 'matchend-weapons-empty';
      empty.textContent = 'No kills this match.';
      weaponsWrap.appendChild(empty);
    }

    showScreen('screen-matchend');
  }

  function bindNav() {
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.closest('#screen-game')) Game.stopLoop && Game.stopLoop();
        showScreen(btn.getAttribute('data-nav'));
      });
    });
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => openCharSelect(btn.getAttribute('data-action')));
    });
    $('charselect-confirm').addEventListener('click', onConfirmCharSelect);
    $('respawn-confirm').addEventListener('click', onConfirmRespawn);
  }

  function init() {
    document.querySelectorAll('.screen').forEach(s => { screens[s.id] = s; });
    bindNav();
    buildCharacterShowcase();
  }

  window.UI = { showScreen, updateHud, showMatchEnd };
  document.addEventListener('DOMContentLoaded', init);
})();
