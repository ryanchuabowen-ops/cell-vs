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
function drawBlob(ctx, u, def) {
  const r = u.radius;
  const bumps = 10;
  ctx.fillStyle = def.color;
  ctx.strokeStyle = def.dark;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= bumps; i++) {
    const t = (i / bumps) * Math.PI * 2;
    const wob = 1 + 0.16 * Math.sin(t * 3 + u.id) + 0.08 * Math.sin(t * 5 - u.id * 2);
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
function drawMultilobe(ctx, u, def) {
  const r = u.radius;
  drawCellBase(ctx, r, def.color, def.dark);

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = 0; i < 6; i++) {
    const a = i * 1.15 + u.id;
    const d = r * 0.6;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = def.dark;
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.22, Math.sin(a) * r * 0.22, r * 0.26, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Plasma / B-cell: large eccentric nucleus and small antibody "Y" receptors.
function drawEccentric(ctx, u, def) {
  const r = u.radius;
  drawCellBase(ctx, r, def.color, def.dark);

  ctx.globalAlpha = 0.8;
  ctx.fillStyle = def.dark;
  ctx.beginPath();
  ctx.arc(-r * 0.25, 0, r * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = def.dark;
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + u.id;
    const nx = Math.cos(a), ny = Math.sin(a);
    const bx = nx * r, by = ny * r;
    const ex = bx + nx * r * 0.3, ey = by + ny * r * 0.3;
    const tx = -ny, ty = nx;
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(ex, ey);
    ctx.moveTo(ex, ey); ctx.lineTo(ex + nx * r * 0.18 + tx * r * 0.12, ey + ny * r * 0.18 + ty * r * 0.12);
    ctx.moveTo(ex, ey); ctx.lineTo(ex + nx * r * 0.18 - tx * r * 0.12, ey + ny * r * 0.18 - ty * r * 0.12);
    ctx.stroke();
  }
}

// Bacterium: rod/capsule shape with trailing flagella.
function drawRod(ctx, u, def) {
  const r = u.radius;
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
      ctx.lineTo(-half - s * 5, i * cap * 0.5 + Math.sin(s + u.id) * 4);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Spiky sphere, used for Coronavirus and the Virophage skin.
function drawSpiky(ctx, u, def, spikeCount, spikeLen) {
  const r = u.radius;
  ctx.strokeStyle = def.dark;
  ctx.fillStyle = def.dark;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < spikeCount; i++) {
    const a = (i / spikeCount) * Math.PI * 2;
    const bx = Math.cos(a) * r, by = Math.sin(a) * r;
    const ex = Math.cos(a) * (r + spikeLen), ey = Math.sin(a) * (r + spikeLen);
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex, ey, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
  drawCellBase(ctx, r, def.color, def.dark);
}

// Strep A: a short chain of cocci, true to its "chain of spheres" name.
function drawChain(ctx, u, def) {
  const r = u.radius * 0.62;
  const count = 3;
  ctx.fillStyle = def.color;
  ctx.strokeStyle = def.dark;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < count; i++) {
    const cx = (i - (count - 1) / 2) * r * 1.6;
    ctx.beginPath();
    ctx.arc(cx, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// Bacteriophage: the classic "lunar lander" silhouette -- capsid head, tail
// sheath, and splayed leg fibers facing forward.
function drawPhageLander(ctx, u, def) {
  const r = u.radius;
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
    ctx.lineTo(r * 0.95, i * r * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.3, i * r * 0.1);
    ctx.lineTo(r * 0.65, i * r * 0.55);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(r * 0.65, 0);
  ctx.lineTo(r * 0.95, 0);
  ctx.stroke();
}

function drawCharacterShape(ctx, u, def) {
  switch (def.shape) {
    case 'blob': drawBlob(ctx, u, def); break;
    case 'multilobe': drawMultilobe(ctx, u, def); break;
    case 'eccentric': drawEccentric(ctx, u, def); break;
    case 'rod': drawRod(ctx, u, def); break;
    case 'spiky': drawSpiky(ctx, u, def, 12, u.radius * 0.55); break;
    case 'chain': drawChain(ctx, u, def); break;
    case 'phage': drawPhageLander(ctx, u, def); break;
    case 'virophage': drawSpiky(ctx, u, def, 7, u.radius * 0.4); break;
    default: drawCellBase(ctx, u.radius, def.color, def.dark);
  }
}
