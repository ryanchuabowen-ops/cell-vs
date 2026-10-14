// Biologically-flavored silhouettes for each character, drawn in local space:
// the canvas is already translated to the unit's position and rotated so
// "forward" (the aim direction) is +x.

function drawCellBase(ctx, r, color, dark) {
  ctx.fillStyle = color;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// Macrophage: amoeba-like blob with pseudopods and a kidney-shaped nucleus.
function drawBlob(ctx, u, def, time) {
  const r = u.radius;
  const bumps = 10;
  const tt = (time || 0);
  ctx.fillStyle = def.color;
  ctx.strokeStyle = def.dark;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= bumps; i++) {
    const t = (i / bumps) * Math.PI * 2;
    // The two wobble terms drift out of phase with each other over time, so
    // the pseudopods look like they're actually writhing/oozing instead of
    // sitting frozen in one fixed wobbly outline.
    const wob = 1 + 0.16 * Math.sin(t * 3 + u.id + tt * 1.1) + 0.08 * Math.sin(t * 5 - u.id * 2 - tt * 1.6);
    const px = Math.cos(t) * r * wob, py = Math.sin(t) * r * wob;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.translate(-r * 0.15, r * 0.08);
  ctx.rotate(0.4);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = def.dark;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.42, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Neutrophil: round cell with a classic multi-lobed nucleus and granules.
function drawMultilobe(ctx, u, def, time) {
  const r = u.radius;
  const tt = (time || 0);
  drawCellBase(ctx, r, def.color, def.dark);

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = 0; i < 6; i++) {
    // Granules swirl around in a loose orbit instead of sitting pinned in place.
    const a = i * 1.15 + u.id + Math.sin(tt * 1.7 + i) * 0.34;
    const d = r * 0.6 + Math.sin(tt * 2.3 + i * 1.3) * r * 0.14;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }

  // The multi-lobed nucleus is expelled along with the granules when
  // Degranulation fires -- it stays visibly gone for as long as the ability
  // is recharging, as a readable "this is on cooldown" tell on the body itself.
  const degranulating = u.abilities && u.abilities.secondary && u.abilities.secondary.name === 'Degranulation' && u.cd && u.cd.secondary > 0;
  if (!degranulating) {
    ctx.fillStyle = def.dark;
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      const pulse = 1 + Math.sin(tt * 2.1 + i * 2) * 0.16;
      const wx = Math.cos(tt * 1.4 + i) * r * 0.04, wy = Math.sin(tt * 1.6 + i * 1.5) * r * 0.04;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.22 + wx, Math.sin(a) * r * 0.22 + wy, r * 0.26 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// Plasma / B-cell: large eccentric nucleus and small antibody "Y" receptors.
function drawEccentric(ctx, u, def, time) {
  const r = u.radius;
  const tt = (time || 0);
  drawCellBase(ctx, r, def.color, def.dark);

  ctx.globalAlpha = 0.8;
  ctx.fillStyle = def.dark;
  ctx.beginPath();
  const nucleusPulse = 1 + Math.sin(tt * 1.8 + u.id) * 0.1;
  const nx0 = -r * 0.25 + Math.cos(tt * 1.2 + u.id) * r * 0.06;
  const ny0 = Math.sin(tt * 1.4 + u.id) * r * 0.06;
  ctx.arc(nx0, ny0, r * 0.52 * nucleusPulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = def.dark;
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    // Each antibody receptor sways independently around its base angle and
    // breathes in and out, like it's actively feeling around for antigen
    // instead of standing rigidly fixed.
    const a = (i / 5) * Math.PI * 2 + u.id + Math.sin(tt * 1.7 + i * 1.7) * 0.25;
    const reach = 1 + Math.sin(tt * 2.2 + i * 2.1) * 0.22;
    const nx = Math.cos(a), ny = Math.sin(a);
    const bx = nx * r, by = ny * r;
    const ex = bx + nx * r * 0.3 * reach, ey = by + ny * r * 0.3 * reach;
    const tx = -ny, ty = nx;
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(ex, ey);
    ctx.moveTo(ex, ey); ctx.lineTo(ex + nx * r * 0.18 + tx * r * 0.12, ey + ny * r * 0.18 + ty * r * 0.12);
    ctx.moveTo(ex, ey); ctx.lineTo(ex + nx * r * 0.18 - tx * r * 0.12, ey + ny * r * 0.18 - ty * r * 0.12);
    ctx.stroke();
  }
}

// Bacterium: rod/capsule shape with trailing flagella.
function drawRod(ctx, u, def, time) {
  const r = u.radius;
  const tt = (time || 0) * 6.5;
  const len = r * 2.1, half = len / 2, cap = r * 0.62;
  ctx.fillStyle = def.color;
  ctx.strokeStyle = def.dark;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-half + cap, -cap);
  ctx.lineTo(half - cap, -cap);
  ctx.arc(half - cap, 0, cap, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-half + cap, cap);
  ctx.arc(-half + cap, 0, cap, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = def.dark;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-half + cap * 0.4, i * cap * 0.5);
    for (let s = 1; s <= 4; s++) {
      ctx.lineTo(-half - s * 5, i * cap * 0.5 + Math.sin(s + u.id + tt) * 6.5);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Spiky sphere, used for Coronavirus and the Virophage skin.
function drawSpiky(ctx, u, def, spikeCount, spikeLen, time) {
  const r = u.radius;
  const tt = (time || 0);
  ctx.strokeStyle = def.dark;
  ctx.fillStyle = def.dark;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < spikeCount; i++) {
    // Each spike flutters in length AND sways side to side independently,
    // out of phase with its neighbors, so the whole crown reads as a living,
    // twitching thing instead of a fixed pinwheel.
    const a = (i / spikeCount) * Math.PI * 2 + Math.sin(tt * 2.2 + i * 1.6 + u.id) * 0.1;
    const len = spikeLen * (1 + Math.sin(tt * 3 + i * 1.9 + u.id) * 0.32);
    const bx = Math.cos(a) * r, by = Math.sin(a) * r;
    const ex = Math.cos(a) * (r + len), ey = Math.sin(a) * (r + len);
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex, ey, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
  drawCellBase(ctx, r, def.color, def.dark);
}

// T-Cell: a lymphocyte's textbook look -- a large, centered nucleus filling
// most of the body with just a thin rim of cytoplasm around it. Deliberately
// round and calm with no radiating spikes, so it never reads as a
// Coronavirus at a glance despite both being roughly circular.
function drawTCell(ctx, u, def, time) {
  const r = u.radius;
  const tt = (time || 0);
  const pulse = 1 + Math.sin(tt * 2.1 + u.id) * 0.13;
  const nx = Math.cos(tt * 1.3 + u.id) * r * 0.08;
  const ny = Math.sin(tt * 1.5 + u.id * 1.4) * r * 0.08;
  drawCellBase(ctx, r, def.color, def.dark);
  ctx.fillStyle = def.dark;
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.arc(nx, ny, r * 0.72 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = def.color;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(nx, ny, r * 0.72 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Strep A: a short chain of cocci, true to its "chain of spheres" name.
function drawChain(ctx, u, def, time) {
  const r = u.radius * 0.62;
  const count = 3;
  const tt = (time || 0);
  ctx.fillStyle = def.color;
  ctx.strokeStyle = def.dark;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < count; i++) {
    // Each bead jostles against its neighbors in both axes instead of
    // sitting rigidly locked in a straight row.
    const cx = (i - (count - 1) / 2) * r * 1.6 + Math.sin(tt * 1.7 + i * 2.6 + u.id) * r * 0.14;
    const cy = Math.sin(tt * 2.4 + i * 1.8 + u.id) * r * 0.28;
    const jr = r * (1 + Math.sin(tt * 2.2 + i * 2.3 + u.id) * 0.1);
    ctx.beginPath();
    ctx.arc(cx, cy, jr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// Ebola: a linear filamentous thread -- the real virus's signature shape --
// that slinks with a gentle traveling wiggle instead of sitting frozen.
function drawEbola(ctx, u, def, time) {
  const r = u.radius;
  const len = r * 2.7;
  const segments = 16;
  const amp = r * 0.22;
  const phase = (time || 0) * 3.2 + u.id * 2.3;
  const tracePath = () => {
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const p = i / segments;
      const x = -len / 2 + p * len;
      // Wave travels along the body (p * freq + phase) and tapers toward
      // both ends (sin(p*PI)) so it reads as a slinking thread, not a loop.
      const y = Math.sin(p * Math.PI * 2.4 + phase) * amp * Math.sin(p * Math.PI);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = def.dark;
  ctx.lineWidth = r * 0.5;
  tracePath();
  ctx.stroke();
  ctx.strokeStyle = def.color;
  ctx.lineWidth = r * 0.32;
  tracePath();
  ctx.stroke();
}

// Bacteriophage: the classic "lunar lander" silhouette -- capsid head, tail
// sheath, and splayed leg fibers facing forward.
function drawPhageLander(ctx, u, def, time) {
  const r = u.radius;
  const tt = (time || 0);
  const legTwitch = Math.sin(tt * 3.8 + u.id) * 0.1;
  ctx.fillStyle = def.color;
  ctx.strokeStyle = def.dark;
  ctx.lineWidth = 2.5;

  ctx.save();
  ctx.translate(-r * 0.35, 0);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = Math.cos(a) * r * 0.62, py = Math.sin(a) * r * 0.62;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillRect(-r * 0.1, -r * 0.12, r * 0.75, r * 0.24);
  ctx.strokeRect(-r * 0.1, -r * 0.12, r * 0.75, r * 0.24);

  ctx.strokeStyle = def.dark;
  ctx.lineWidth = 1.6;
  for (let i = -1; i <= 1; i += 2) {
    ctx.beginPath();
    ctx.moveTo(r * 0.55, i * r * 0.08);
    ctx.lineTo(r * 0.95, i * (r * 0.5 + r * legTwitch));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.3, i * r * 0.1);
    ctx.lineTo(r * 0.65, i * (r * 0.55 + r * legTwitch));
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(r * 0.65, 0);
  ctx.lineTo(r * 0.95, 0);
  ctx.stroke();
}

function drawCharacterShape(ctx, u, def, time) {
  switch (def.shape) {
    case 'blob': drawBlob(ctx, u, def, time); break;
    case 'multilobe': drawMultilobe(ctx, u, def, time); break;
    case 'eccentric': drawEccentric(ctx, u, def, time); break;
    case 'rod': drawRod(ctx, u, def, time); break;
    case 'spiky': drawSpiky(ctx, u, def, 12, u.radius * 0.55, time); break;
    case 'chain': drawChain(ctx, u, def, time); break;
    case 'phage': drawPhageLander(ctx, u, def, time); break;
    case 'virophage': drawSpiky(ctx, u, def, 7, u.radius * 0.4, time); break;
    case 'tcell': drawTCell(ctx, u, def, time); break;
    case 'ebola': drawEbola(ctx, u, def, time); break;
    default: drawCellBase(ctx, u.radius, def.color, def.dark);
  }
}
