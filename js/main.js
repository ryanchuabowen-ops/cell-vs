(function () {
  const screens = {};
  let pendingAction = null;
  let selectedCharId = null;
  let selectedPrimaryIdx = 0;
  let selectedSecondaryIdx = 0;
  let gameInited = false;
  let respawnPickerShownFor = null;

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

  function renderSwatch(canvas, def, charId) {
    canvas.width = 44; canvas.height = 44;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 44, 44);
    ctx.save();
    ctx.translate(22, 22);
    const fakeUnit = { id: charIdSeed(charId), radius: 16, skin: null, devourUntil: 0 };
    drawCharacterShape(ctx, fakeUnit, def);
    ctx.restore();
  }

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

    if (compact) {
      const abilities = document.createElement('div');
      abilities.className = 'char-ability-line';
      abilities.innerHTML = '<b>RMB</b> ' + def.primary.name + '<br><b>LMB</b> ' + def.secondary.name;
      card.appendChild(abilities);
    } else {
      const blurb = document.createElement('div');
      blurb.className = 'char-blurb';
      blurb.textContent = def.blurb;
      card.appendChild(blurb);

      const p = document.createElement('div');
      p.className = 'char-ability';
      p.innerHTML = '<b>RMB ' + def.primary.name + ':</b> ' + def.primary.desc;
      card.appendChild(p);

      const s = document.createElement('div');
      s.className = 'char-ability';
      s.innerHTML = '<b>LMB ' + def.secondary.name + ':</b> ' + def.secondary.desc;
      card.appendChild(s);
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

  function openCharSelect(action) {
    pendingAction = action;
    selectedCharId = null;
    selectedCardEl = null;
    const grid = $('charselect-grid');
    const title = $('charselect-title');
    const btn = $('charselect-confirm');
    const oldPicker = $('ability-picker');
    if (oldPicker) oldPicker.remove();
    // Detach the (possibly grid-owned) confirm button back to its static spot
    // before wiping the grid -- otherwise innerHTML='' below deletes it.
    grid.insertAdjacentElement('afterend', btn);
    btn.classList.add('hidden');
    btn.classList.remove('confirm-floating');
    btn.style.position = ''; btn.style.top = ''; btn.style.left = ''; btn.style.width = '';

    if (action === 'pvbot') {
      title.textContent = 'Choose your character';
      buildGroupedGrid(grid, [immuneGroup(), pathogenGroup()], (card, charId) => selectCard(card, charId), true);
    } else if (action === 'pve') {
      title.textContent = 'Choose your character';
      buildGroupedGrid(grid, [
        immuneGroup('defend 20 allies vs pathogens'),
        pathogenGroup('lead 20 allies vs immune cells'),
        phageGroup()
      ], (card, charId) => selectCard(card, charId), true);
    }

    showScreen('screen-charselect');
  }

  function buildOptionRow(label, options, selectedIdx, onPick) {
    const row = document.createElement('div');
    row.className = 'ability-pick-row';
    const lab = document.createElement('div');
    lab.className = 'ability-pick-label';
    lab.textContent = label;
    row.appendChild(lab);
    options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ability-pick-btn' + (i === selectedIdx ? ' active' : '');
      b.textContent = opt.name;
      b.title = opt.desc;
      b.addEventListener('click', () => onPick(i));
      row.appendChild(b);
    });
    return row;
  }

  function buildAbilityPicker(def) {
    const wrap = document.createElement('div');
    wrap.id = 'ability-picker';
    wrap.className = 'ability-picker';
    if (def.primaryOptions) {
      wrap.appendChild(buildOptionRow('RMB Primary', def.primaryOptions, selectedPrimaryIdx, i => {
        selectedPrimaryIdx = i;
        positionFloaters();
      }));
    }
    if (def.secondaryOptions) {
      wrap.appendChild(buildOptionRow('LMB Secondary', def.secondaryOptions, selectedSecondaryIdx, i => {
        selectedSecondaryIdx = i;
        positionFloaters();
      }));
    }
    return wrap;
  }

  let selectedCardEl = null;

  function positionFloaters() {
    const root = $('charselect-grid');
    const card = selectedCardEl;
    if (!card) return;
    const rootRect = root.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    let top = cardRect.bottom - rootRect.top + 8;
    const left = cardRect.left - rootRect.left;
    const width = cardRect.width;

    const def = CHARACTERS[selectedCharId];
    const oldPicker = $('ability-picker');
    if (oldPicker) oldPicker.remove();
    let picker = null;
    if (def.primaryOptions || def.secondaryOptions) {
      picker = buildAbilityPicker(def);
      picker.style.position = 'absolute';
      picker.style.top = top + 'px';
      picker.style.left = left + 'px';
      picker.style.width = width + 'px';
      root.appendChild(picker);
      top += picker.offsetHeight + 8;
    }

    const btn = $('charselect-confirm');
    btn.classList.remove('hidden');
    btn.classList.add('confirm-floating');
    btn.style.position = 'absolute';
    btn.style.top = top + 'px';
    btn.style.left = left + 'px';
    btn.style.width = width + 'px';
    root.appendChild(btn);
  }

  function selectCard(card, charId) {
    document.querySelectorAll('#charselect-grid .char-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedCharId = charId;
    selectedCardEl = card;
    selectedPrimaryIdx = 0;
    selectedSecondaryIdx = 0;
    positionFloaters();
  }

  function onConfirmCharSelect() {
    if (!selectedCharId) { alert('Pick a character first.'); return; }
    const loadout = { primaryIdx: selectedPrimaryIdx, secondaryIdx: selectedSecondaryIdx };
    if (pendingAction === 'pvbot') {
      showScreen('screen-game');
      Game.setupPvBot(selectedCharId, loadout);
    } else if (pendingAction === 'pve') {
      showScreen('screen-game');
      Game.setupPvEOffline(selectedCharId, loadout);
    }
  }

  function formatTime(s) {
    s = Math.max(0, Math.ceil(s));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
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

    const feed = $('hud-killfeed');
    feed.innerHTML = killFeed.slice(0, 5).map(k => '<div>' + k.text + '</div>').join('');

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

    let pool;
    if (mode === 'pvbot') pool = localUnit.team === 'immune' ? IMMUNE_IDS : PATHOGEN_IDS;
    else pool = world.pveHeroPool || IMMUNE_IDS;

    const grid = $('respawn-grid');
    grid.innerHTML = '';
    for (const id of pool) {
      const card = makeCharCard(CHARACTERS[id], { compact: true, charId: id });
      card.addEventListener('click', () => Game.respawnAs(id));
      grid.appendChild(card);
    }
  }

  function showMatchEnd(mode, result, scores) {
    const title = $('matchend-title');
    const sub = $('matchend-sub');
    if (mode === 'pvbot') {
      if (result === 'draw') {
        title.textContent = 'Draw!';
      } else {
        title.textContent = (result === 'immune' ? 'Immune System Wins!' : 'Pathogens Win!');
      }
      sub.textContent = 'Final score — Immune ' + scores.immune + ' : ' + scores.pathogen + ' Pathogen';
    } else {
      title.textContent = result === 'victory' ? 'Infection Cleared!' : 'The Host Has Fallen...';
      sub.textContent = result === 'victory' ? 'All 8 waves survived.' : 'Your hero ran out of lives.';
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
  }

  function init() {
    document.querySelectorAll('.screen').forEach(s => { screens[s.id] = s; });
    bindNav();
    buildCharacterShowcase();
  }

  window.UI = { showScreen, updateHud, showMatchEnd };
  document.addEventListener('DOMContentLoaded', init);
})();
