// Sunspoke Depot. Coordinates are in metres, with Y up and box Y at its base.
// The server and renderer share these solids, ramps, spawn points and paths.
const bounds = { minX: -32, maxX: 32, minZ: -26, maxZ: 26 };
const boxes = [];
const ramps = [];
const decor = [];
const signs = [];
const p = {
  concrete: '#a7b9b3', stone: '#cfceba', cream: '#f7e8c1', bone: '#e5dbb5',
  ink: '#263d48', slate: '#405965', steel: '#647a80', pale: '#a9b9ac',
  teal: '#268d8b', sea: '#45ada4', mint: '#83d4b7', deep: '#1b6267',
  gold: '#f4b449', sun: '#ffda74', ochre: '#bd7737', orange: '#ee8450',
  rust: '#a44e3c', coral: '#dd7050', salmon: '#f69b6c', glow: '#a9f6c6',
};
function solid(x, y, z, w, h, d, color) {
  const box = { x, y, z, w, h, d, color };
  boxes.push(box);
  return box;
}
function detail(x, y, z, w, h, d, color, angle = 0) {
  decor.push({ x, y, z, w, h, d, color, ...(angle ? { angle } : {}) });
}
function label(x, y, z, yaw, text, width, height, fg = p.cream, bg = p.ink) {
  signs.push({ x, y, z, yaw, text, width, height, fg, bg });
}
function ramp(x, z, w, h, d, dir, color) {
  ramps.push({ x, y: 0, z, w, h, d, dir, color });
}

// A cast-stone perimeter with freight-yard numbers, crane stops and paint.
// Its inside face is also the simulation's hard arena boundary.
for (const side of [-1, 1]) {
  solid(0, 0, side * 26.4, 64.8, 2.45, 0.8, p.stone);
  solid(side * 32.4, 0, 0, 0.8, 2.45, 52, p.stone);
  detail(0, 2.40, side * 26.4, 64.8, 0.18, 0.85, p.slate);
  detail(side * 32.4, 2.40, 0, 0.85, 0.18, 52, p.slate);
  detail(0, 0.24, side * 25.99, 64, 0.25, 0.03, p.ochre);
  detail(side * 31.99, 0.24, 0, 0.03, 0.25, 52, p.ochre);
  for (let pos = -24; pos <= 24; pos += 8) {
    detail(pos, 0, side * 26.08, 0.24, 2.42, 0.20, p.steel);
  }
  for (let pos = -20; pos <= 20; pos += 8) {
    detail(side * 32.08, 0, pos, 0.20, 2.42, 0.24, p.steel);
  }
}
label(-9, 1.43, -25.96, 0, 'NORTH GATE   /   01', 4.5, 0.72);
label(31.96, 1.43, 3, -Math.PI / 2, 'DOCK   /   02', 4.1, 0.72);
label(-31.96, 1.43, -4, Math.PI / 2, 'INTAKE   /   04', 4.1, 0.72);
label(5, 1.43, 25.96, Math.PI, 'SOUTH GATE   /   03', 4.4, 0.72);

// The turbine hall. Wall details are painted or recessed equipment panels.
const turbine = solid(-18, 0, -5, 10, 3.6, 16, p.teal);
ramp(-19, 7.5, 4.4, 3.6, 9, '-z', p.sea);
ramp(-16, -17.5, 4.4, 3.6, 9, '+z', p.sea);
detail(-18, 3.42, -5, 10.09, 0.18, 16.09, p.deep);
detail(-18, 3.60, -5, 10.02, 0.045, 16.02, p.cream);
detail(-18, 0.08, -5, 10.06, 0.32, 16.06, p.deep);
for (const side of [-1, 1]) {
  const x = -18 + side * 5.018;
  detail(x, 2.61, -5, 0.035, 0.45, 15.8, p.mint);
  for (const z of [-11.5, -7.5, -3.5, 0.5]) {
    detail(x, 0.40, z, 0.08, 2.14, 0.18, p.deep);
  }
}
detail(-12.965, 0.44, -9.3, 0.035, 1.78, 3.85, p.ink);
for (let i = 0; i < 5; i++) {
  detail(-12.932, 0.53 + 0.34 * i, -9.3, 0.033, 0.15, 3.55, p.steel);
}
label(-12.925, 1.68, -2.50, Math.PI / 2, 'TURBINE   /   A', 5.4, 0.95);
label(-18, 2.39, 3.052, 0, 'INTAKE', 3.85, 0.74, p.ink, p.mint);

// Dispatch. The wide yellow shutter faces the centre of the playing field.
const dispatch = solid(15, 0, 4, 10, 3.2, 14, p.gold);
ramp(13.6, -7.5, 4.4, 3.2, 9, '+z', p.gold);
ramp(16.6, 15.5, 4.4, 3.2, 9, '-z', p.gold);
detail(15, 3.03, 4, 10.09, 0.17, 14.09, p.ochre);
detail(15, 3.2, 4, 10.02, 0.045, 14.02, p.bone);
detail(15, 0.1, 4, 10.06, 0.30, 14.06, p.ochre);
detail(9.977, 0.39, 4.1, 0.035, 2.20, 5.4, p.ink);
for (let i = 0; i < 7; i++) {
  detail(9.947, 0.49 + 0.29 * i, 4.1, 0.028, 0.20, 5.08, p.steel);
}
for (const z of [-2.78, 10.78]) {
  for (const x of [10.12, 19.88]) {
    detail(x, 0.08, z, 0.33, 2.95, 0.52, p.ochre);
    detail(x, 1.03, z, 0.35, 0.25, 0.54, p.cream);
  }
}
label(9.934, 2.76, 4.1, -Math.PI / 2, 'SUNSPOKE DISPATCH', 5.7, 0.49);
label(15.6, 2.02, 11.052, 0, '02   /   DISPATCH', 5.25, 0.85);
label(20.052, 1.99, 3.0, Math.PI / 2, 'B-02', 3.45, 1.15, p.ink, p.cream);

// Roof AHUs provide cover. Fan grilles are shallow markings on their lids.
function airUnit(x, y, z, w, d) {
  solid(x, y, z, w, 1.17, d, p.slate);
  detail(x, y + 1.16, z, w + 0.04, 0.10, d + 0.04, p.pale);
  detail(x, y + 1.26, z, w * .76, 0.02, d * .8, p.ink);
  for (let i = -2; i <= 2; i++) {
    detail(x, y + 1.278, z + i * d * 0.132, w * .70, 0.022, 0.11, p.steel);
  }
  detail(x, y + 0.32, z + d / 2 + .02, w * 0.68, 0.44, 0.025, p.deep);
}
airUnit(-21, 3.6, -7.6, 2.30, 3.85);
airUnit(17.4, 3.2, 3.2, 2.22, 3.28);

// A relay mast gives the central floor a landmark and breaks long sightlines.
solid(0, 0, 0, 4.4, 2.05, 3.8, p.deep);
detail(0, 0.15, 0, 4.45, 0.26, 3.85, p.ink);
detail(0, 1.79, 0, 4.45, 0.22, 3.85, p.mint);
solid(0, 2.05, 0, 2.10, 1.45, 1.80, p.sea);
solid(0, 3.5, 0, 1.1, 2.78, 1.1, p.slate);
solid(0, 6.28, 0, 2.5, 0.45, 1.65, p.gold);
solid(0, 6.73, 0, 1.04, 0.95, 1.04, p.glow);
detail(-.49, 3.55, .53, .15, 2.67, .11, p.gold);
detail(.49, 3.55, .53, .15, 2.67, .11, p.gold);
label(0, 1.08, 1.93, 0, 'RLY  /  07', 2.90, 0.75);
label(0, 1.08, -1.93, Math.PI, 'RLY  /  07', 2.90, 0.75);

// Ribbed freight containers are simple cuboids with a painted frame.
function freight(x, y, z, w, h, d, color, frame, id) {
  solid(x, y, z, w, h, d, color);
  for (const face of [-1, 1]) {
    const faceZ = z + face * (d / 2 + .02);
    for (const edge of [-1, 1]) {
      detail(x + edge * (w / 2 - .13), y + .05, faceZ,
        .22, h - .10, .052, frame);
    }
    detail(x, y + h - .22, faceZ, w, .16, .052, frame);
    detail(x, y + .09, faceZ, w, .14, .052, frame);
    const count = Math.max(2, Math.floor(w / .92));
    for (let i = 1; i < count; i++) {
      detail(x - w / 2 + i * w / count, y + .31, faceZ,
        .085, h - .67, .045, frame);
    }
  }
  if (id) label(x + .36, y + h * .58, z + d / 2 + .071, 0,
    id, Math.min(3.6, w * .71), .51, p.cream, frame);
}
freight(-4.55, 0, -16.9, 8.4, 2.62, 3.65, p.coral, p.rust, 'RWK   /   15');
freight(-5.57, 2.62, -16.9, 5.5, 2.20, 3.53, p.salmon, p.rust, 'C-15');
freight(-8.55, 0, 12.95, 6.5, 2.40, 3.60, p.coral, p.rust, 'FREIGHT   06');
freight(8.55, 0, -18.15, 4.25, 2.45, 5, p.teal, p.deep, '04');
freight(25.0, 0, -11.25, 3.55, 2.40, 5.7, p.coral, p.rust, 'C-07');
function caseBox(x, z, w, h, d) {
  solid(x, 0, z, w, h, d, p.slate);
  detail(x, h - .13, z, w + .04, .13, d + .04, p.steel);
  for (const edge of [-1, 1]) {
    detail(x + edge * (w * .32), .02, z, .19, h + .023, d + .055, p.gold);
  }
  detail(x, h * .37, z + d / 2 + .02, w * .30, .23, .03, p.ink);
}
caseBox(6.05, 17.7, 5.3, 1.52, 3.10);
caseBox(-26.95, 12.75, 3.10, 1.40, 4);
caseBox(-7.88, -3.1, 2.75, 1.32, 3.95);
caseBox(4.15, 6.8, 3.5, 1.13, 1.85);
caseBox(25.9, 12.25, 3.65, 1.41, 2.65);

// Depressed wheel tracks and lane stencils painted directly on the deck.
// Their tops sit centimetres above the shared floor and need no collider.
for (const x of [-28.4, 27.35]) {
  detail(x - .78, .008, -.35, .10, .012, 44.9, p.steel);
  detail(x + .78, .008, -.35, .10, .012, 44.9, p.steel);
  for (let z = -21; z <= 20; z += 4.0) {
    detail(x, .006, z, 2.12, .009, .16, p.pale);
  }
}
for (let x = -23; x <= 23; x += 4.5) {
  detail(x, .01, 22.90, 2.22, .012, .16, p.cream);
}
for (const x of [-11.55, 8.25]) {
  for (let z = -10; z <= 10; z += 4) {
    detail(x, .01, z, .14, .012, 1.80, p.cream);
  }
}
for (const lineZ of [-12.85, 10.12]) {
  detail(-.35, .01, lineZ, 16.25, .012, .14, p.gold);
}
for (const [x, z] of [[-19, 12.6], [-16, -22.6], [13.6, -12.6], [16.6, 20.6]]) {
  detail(x, .012, z, 4.52, .016, .75, p.ink);
  for (let i = -2; i <= 2; i++) {
    detail(x + i * .78, .029, z, .32, .011, .72, p.sun, .38);
  }
}

// Beyond the playable yard: an original block-tiled turbine wheel, a
// suspended freight crane, pump stacks and a coastal industrial skyline.
// Every non-paint scenery solid is entirely outside the play volume.
const wheelX = -23.9, wheelZ = -34.8, wheelY = 12;
detail(wheelX, 0, wheelZ, 6.5, 5.8, 5.2, p.steel);
detail(wheelX, 5.8, wheelZ, 2.35, 6, 2.0, p.ochre);
for (let row = -7; row <= 7; row++) {
  let color = null, start = -7;
  for (let col = -7; col <= 8; col++) {
    const radius = Math.hypot(col, row);
    const vane = Math.cos(4 * (Math.atan2(row, col) + .105 * radius));
    let next = null;
    if (col < 8 && radius <= 7.36) {
      if (radius > 5.98) next = p.ochre;
      else if (radius > 5.0) next = p.sun;
      else if (radius <= 1.9) next = p.cream;
      else if (vane > -.05) next = p.gold;
    }
    if (next !== color) {
      if (color) detail(wheelX + (start + col - 1) * .45, wheelY + row * .90,
        wheelZ, (col - start) * .90, .90, .93, color);
      color = next;
      start = col;
    }
  }
}
for (const x of [14, 33.5]) {
  detail(x, 0, -32, 1.25, 15, 1.4, p.ochre);
  detail(x, 0, -36.4, 1.25, 15, 1.4, p.gold);
  detail(x, 13.70, -34.2, 1.55, 1.55, 5.9, p.gold);
  detail(x, .1, -32, 2.4, 1.65, 2.4, p.ink);
}
detail(23.75, 14.7, -32, 24.5, 1.05, 1.60, p.gold);
detail(23.75, 15.75, -32, 24.8, .22, 1.84, p.sun);
detail(21.5, 13.83, -32, 3.25, .85, 2.30, p.ink);
for (const x of [20.7, 22.3]) detail(x, 9.15, -32, .095, 4.70, .12, p.slate);
detail(21.5, 7.18, -32, 5.85, 1.98, 2.75, p.coral);
for (let x = 19.35; x < 24; x += .88) detail(x, 7.28, -30.59, .11, 1.78, .08, p.rust);
detail(32.0, 12.1, -31.6, 3.45, 2.56, 2.85, p.cream);
detail(31.8, 13.16, -30.15, 2.70, 1.08, .10, p.deep);

for (const [x, z, w, h, d, color] of [
  [-39,-20,8,6,9,p.teal], [-41,1,11,7.5,11,p.steel], [-41,18,9,5.2,6,p.pale],
  [-50,-28,12,11,9,p.pale], [-5,-39,18,6.4,9,p.teal], [4,-50,12,13,8,p.pale],
  [16,-60,16,10.4,11,p.steel], [41,-18,12,5.6,10,p.teal], [44,4,10,7.0,14,p.slate],
  [40,24,8,4.5,7,p.coral], [1,40,21,4.2,9,p.steel], [-22,43,9,7.2,8,p.teal],
]) {
  detail(x, -.33, z, w, h, d, color);
  detail(x, h - .33, z, w + .47, .28, d + .47, p.pale);
  detail(x, h - 1.89, z + d / 2 + .025, w * .76, .74, .06, p.deep);
}
for (const [x, z, h] of [[-38,-14,13.9],[-41,-14,16.3],[-44,-14,12.2],[6,-39,11.7],[44,11,12.8]]) {
  detail(x, 0, z, 1.5, h, 1.5, p.rust);
  detail(x, h * .58, z, 1.55, h * .12, 1.55, p.cream);
  detail(x, h * .82, z, 1.55, h * .09, 1.55, p.cream);
  detail(x, h - .18, z, 1.85, .35, 1.85, p.slate);
}
label(-5, 4.5, -34.43, 0, 'SUNSPOKE DEPOT', 10.6, 1.14);

// Spawn facing the relay rather than a boundary wall.
const spawns = [
  [-28.3, 0, -19.5], [-10.7, 0, -22], [3.6, 0, -19.7], [24.0, 0, -20.8],
  [27.5, 0, 4.1], [23.2, 0, 20.7], [-.8, 0, 21.1], [-16.8, 0, 19.2],
  [-28.4, 0, 5.2], [-16.4, 3.6, -5.3], [13.1, 3.2, 6.8],
].map(([x, y, z]) => ({ x, y, z, yaw: Math.atan2(x, z) }));

// Build a sparse navigation graph from the same collision definitions.
// For ordinary walk segments, reject expanded obstacles for the whole
// segment. Dedicated ascent edges stay on the centre line of each ramp.
const nodes = [], edges = [];
const clearance = .68;
function obstructed(x, y, z) {
  if (x < bounds.minX + clearance || x > bounds.maxX - clearance ||
      z < bounds.minZ + clearance || z > bounds.maxZ - clearance) return true;
  for (const b of boxes) {
    if (b.y + b.h <= y + .025 || b.y >= y + 1.9) continue;
    if (Math.abs(x - b.x) < b.w / 2 + clearance &&
        Math.abs(z - b.z) < b.d / 2 + clearance) return true;
  }
  if (y === 0) {
    for (const r of ramps) {
      if (Math.abs(x - r.x) < r.w / 2 + clearance &&
          Math.abs(z - r.z) < r.d / 2 + clearance) return true;
    }
  }
  return false;
}
function onRoof(x, z, roof) {
  return Math.abs(x - roof.x) < roof.w / 2 - clearance &&
         Math.abs(z - roof.z) < roof.d / 2 - clearance;
}
function addNode(x, y, z) {
  const existing = nodes.findIndex(n => n.y === y && Math.hypot(n.x - x, n.z - z) < .03);
  if (existing !== -1) return existing;
  nodes.push({ x, y, z });
  return nodes.length - 1;
}
for (let z = -23; z <= 24; z += 4.5) {
  for (let x = -29.25; x <= 30; x += 4.5) {
    if (!obstructed(x, 0, z)) addNode(x, 0, z);
  }
}
for (const s of spawns) addNode(s.x, s.y, s.z);
for (const roof of [turbine, dispatch]) {
  for (let z = roof.z - roof.d / 2 + 1.25; z < roof.z + roof.d / 2 - .70; z += 2.7) {
    for (let x = roof.x - roof.w / 2 + 1.25; x < roof.x + roof.w / 2 - .70; x += 2.45) {
      if (!obstructed(x, roof.h, z)) addNode(x, roof.h, z);
    }
  }
}
for (const r of ramps) {
  const step = r.dir === '+z' ? 1 : -1;
  const approach = addNode(r.x, 0, r.z - step * (r.d / 2 + .9));
  const middle = addNode(r.x, r.h / 2, r.z);
  const crest = addNode(r.x, r.h, r.z + step * (r.d / 2 + .90));
  edges.push([approach, middle], [middle, crest]);
}
function clearSegment(a, b) {
  if (a.y !== b.y) return false;
  if (a.y > 0) {
    const roof = a.y === turbine.h ? turbine : a.y === dispatch.h ? dispatch : null;
    if (!roof || !onRoof(a.x, a.z, roof) || !onRoof(b.x, b.z, roof)) return false;
  }
  const pieces = Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / .35);
  for (let i = 0; i <= pieces; i++) {
    const t = i / pieces;
    if (obstructed(a.x + (b.x - a.x) * t, a.y, a.z + (b.z - a.z) * t)) return false;
  }
  return true;
}
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    if (a.y !== b.y || Math.hypot(a.x - b.x, a.z - b.z) > 6.95) continue;
    if (clearSegment(a, b)) edges.push([i, j]);
  }
}

export const ARENA = {
  name: 'Sunspoke Depot', bounds, floorColor: p.concrete,
  boxes, ramps, spawns, nodes, edges, decor, signs,
};
