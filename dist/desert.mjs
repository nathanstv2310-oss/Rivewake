// Saffron Canyon. All dimensions are metres. Box coordinates are centred in
// X/Z, with Y at the base. Both the client and server use the solid geometry.
const bounds = { minX: -68, maxX: 68, minZ: -54, maxZ: 54 };
const boxes = [], ramps = [], decor = [], signs = [];
const c = {
  sand: '#e6c492', blush: '#e2a079', ochre: '#cf8e5e', clay: '#b97653',
  ember: '#aa6049', rust: '#905044', sun: '#efb77b', chalk: '#f2dcad',
  salt: '#fff0c5', magenta: '#a75e5b', blue: '#348e93', azure: '#4cb4b1',
  teal: '#246670', tank: '#234f5b', green: '#748b5a', leaf: '#9da969',
  wood: '#805648', iron: '#514a50', copper: '#ce8845', gold: '#edb651',
};
function solid(x, y, z, w, h, d, color) {
  boxes.push({ x, y, z, w, h, d, color });
}
function paint(x, y, z, w, h, d, color, angle = 0) {
  decor.push({ x, y, z, w, h, d, color, ...(angle ? { angle } : {}) });
}
function sign(x, y, z, yaw, text, width, height, fg = c.salt, bg = c.teal) {
  signs.push({ x, y, z, yaw, text, width, height, fg, bg });
}
function ramp(x, z, w, h, d, dir, color) {
  ramps.push({ x, y: 0, z, w, h, d, dir, color });
}

// The natural rock has broad, clean collision shapes. Narrow bedding lines
// lie against the cliff faces. All stepped ledges themselves are solid.
function seam(x, y, z, w, d, h, color) {
  paint(x, y, z + d / 2 + .012, w * .97, h, .028, color);
  paint(x, y, z - d / 2 - .012, w * .97, h, .028, color);
  paint(x + w / 2 + .012, y, z, .028, h, d * .96, color);
  paint(x - w / 2 - .012, y, z, .028, h, d * .96, color);
}
function butte(x, z, w, d, h, drift, base = c.ochre) {
  const h1 = h * .53, h2 = h * .31;
  solid(x, 0, z, w, h1, d, base);
  seam(x, h1 * .48, z, w, d, Math.min(.21, h * .062), c.clay);
  const bx = x + drift * w * .055, bz = z + d * .045;
  solid(bx, h1, bz, w * .84, h2, d * .84, c.blush);
  solid(bx - drift * w * .035, h1 + h2, bz - d * .03,
    w * .67, h - h1 - h2, d * .69, c.sun);
}

// Tall square sandstone mouths mark the four map edges. Outer eroded bands
// and horizon mesas are fully outside the playable rectangle.
for (const side of [-1, 1]) {
  solid(0, 0, side * 54.65, 138.6, 2.75, 1.30, c.clay);
  solid(side * 68.65, 0, 0, 1.30, 2.75, 108, c.clay);
  paint(0, 1.35, side * 53.99, 136, .23, .035, c.ochre);
  paint(side * 67.99, 1.35, 0, .035, .23, 108, c.ochre);
}
// Principal landmark. Windglass Arch is hollow at ground level, with a
// shaded opening 7.5 m wide between its feet and shoulders high overhead.
solid(-9.3, 0, -1.1, 10.6, 4.8, 10.3, c.ochre);
solid(-9.7, 4.8, -.6, 8.8, 3.35, 8.5, c.blush);
solid(-8.6, 8.15, -.7, 11.0, 2.5, 7.55, c.clay);
solid(9.55, 0, -.3, 12.1, 5.2, 10.9, c.clay);
solid(9.9, 5.2, -.6, 9.45, 3.5, 9.05, c.blush);
solid(9.15, 8.7, -.3, 12.2, 1.95, 8.5, c.ochre);
solid(.4, 10.65, -.6, 28.7, 2.75, 7.15, c.sun);
solid(1.05, 13.4, -1, 24.5, 1.25, 6.05, c.blush);
solid(9.85, 14.65, -1.35, 4.52, 2.72, 4.4, c.sun);
solid(-10, 14.65, -1.0, 2.2, 1.25, 2.7, c.sun);
seam(-9.3, 2.13, -1.1, 10.6, 10.3, .34, c.ember);
seam(9.55, 2.42, -.3, 12.1, 10.9, .38, c.ember);
seam(-9.7, 6.45, -.6, 8.8, 8.5, .27, c.chalk);
seam(9.9, 6.55, -.6, 9.45, 9.05, .27, c.chalk);
paint(-1.5, 11.23, 2.989, 18.9, .30, .035, c.blush);
paint(3.0, 12.40, 2.989, 14.5, .19, .035, c.chalk);
// Three blue thumbprints are the local navigation mark for the arch.
for (const [x, h] of [[-9.92,.53],[-9.38,.85],[-8.84,.69]]) {
  paint(x, 1.25, 4.066, .33, h, .03, c.teal);
}

// The Salt Siphon. A long east-facing mural imitates a surveyor's water
// gauge. The cistern on the roof sits clear of both ramp landings.
solid(-33, 0, -10, 15.2, 4.25, 20, c.blue);
ramp(-32.2, 6.5, 5.2, 4.25, 13, '-z', c.chalk);
ramp(-31.1, -26.5, 5.2, 4.25, 13, '+z', c.chalk);
seam(-33, 3.64, -10, 15.2, 20, .41, c.azure);
paint(-33, 4.25, -10, 15.18, .032, 19.98, c.chalk);
paint(-25.375, .42, -5.6, .035, 2.76, 4.3, c.tank);
for (let i = 0; i < 5; i++) {
  paint(-25.35, .61 + .47 * i, -5.13, .03, .10,
    i % 2 ? 1.55 : 2.25, c.azure);
}
sign(-25.34, 2.22, -13.6, Math.PI / 2, '01   SALT SIPHON', 6.8, 1.10);
sign(-36.7, 2.08, .035, 0, 'FLOW  /  A', 4.2, .86, c.tank, c.chalk);
solid(-37.45, 4.25, -10.9, 3.55, 1.94, 6.15, c.teal);
seam(-37.45, 4.58, -10.9, 3.55, 6.15, .21, c.copper);
paint(-37.45, 6.19, -10.9, 3.54, .035, 6.14, c.azure);
for (const z of [-12.58, -9.18]) {
  paint(-37.45, 4.26, z, 3.59, 1.97, .24, c.tank);
}

// Prism House. Both ramps cross the roof on an east/west axis. The rooftop
// windcatcher shades the platform and gives it cover on the west approach.
solid(32, 0, 10.5, 17, 4.0, 16, c.ember);
ramp(17, 12.25, 13, 4.0, 5.25, '+x', c.sun);
ramp(47, 9.0, 13, 4.0, 5.25, '-x', c.sun);
seam(32, 2.86, 10.5, 17, 16, .24, c.chalk);
seam(32, 3.80, 10.5, 17, 16, .19, c.gold);
paint(32, 4, 10.5, 16.98, .034, 15.98, c.chalk);
solid(30.1, 4.0, 6.2, 3.95, 2.2, 3.6, c.ochre);
solid(30.1, 6.2, 6.2, 2.90, 1.34, 2.85, c.gold);
paint(30.1, 6.40, 7.645, 2.16, .73, .032, c.iron);
for (const x of [29.5, 30.1, 30.7]) paint(x, 6.39, 7.666, .16, .76, .025, c.sun);
// Paint the shutter and zigzag frame onto the southern wall.
paint(32.4, .04, 18.524, 6.2, 2.64, .035, c.wood);
for (let i = 0; i < 5; i++) paint(30.0 + 1.2 * i, .11, 18.546,
  1.09, 2.45, .028, c.copper);
sign(32.4, 3.28, 18.556, 0, '02   PRISM HOUSE', 6.7, .72, c.tank, c.chalk);
sign(32.8, 2.02, 2.458, Math.PI, 'GLASS ROAD', 5.55, .74);

// Two further traversable heights. These cliffs are single solid platforms
// with flush strata so all four ascent lanes meet a clean, level surface.
solid(10.5, 0, -35, 14, 3.6, 12, c.ochre);
seam(10.5, 1.25, -35, 14, 12, .39, c.clay);
seam(10.5, 2.79, -35, 14, 12, .29, c.sun);
ramp(-2.6, -35.1, 12.2, 3.6, 5.10, '+x', c.blush);
ramp(12.6, -22.9, 5.10, 3.6, 12.2, '-z', c.blush);
solid(14.4, 3.6, -38.25, 3.15, 1.74, 2.65, c.clay);
sign(10.5, 1.98, -28.96, 0, 'NORTH   /   LEDGE', 5.4, .73);
solid(-20.5, 0, 33.5, 15, 3.35, 11, c.blush);
seam(-20.5, 2.77, 33.5, 15, 11, .30, c.chalk);
ramp(-19.5, 21.8, 5.25, 3.35, 12.4, '+z', c.chalk);
ramp(-24.4, 45.2, 5.25, 3.35, 12.4, '-z', c.chalk);
solid(-16.1, 3.35, 35.8, 2.75, 1.36, 3.5, c.ochre);
paint(-16.1, 4.71, 35.8, 2.72, .032, 3.48, c.sun);
sign(-12.95, 1.90, 33.5, Math.PI / 2, 'SOUTH   /   POST', 5.2, .76);

// The blue shade canopy has a playable underpass. Every post and the
// underside of the awning have real collision; its textile pattern is flat.
for (const x of [26, 36.3]) for (const z of [-22.6, -15.8]) {
  solid(x, 0, z, .48, 3.75, .48, c.wood);
}
solid(31.15, 3.75, -19.2, 11.26, .34, 7.7, c.teal);
for (let i = 0; i < 5; i++) {
  paint(26.91 + i * 2.12, 4.09, -19.2, .88, .024, 7.7, c.azure);
  paint(26.91 + i * 2.12, 3.748, -15.337, .88, .345, .034, c.azure);
}
sign(31.15, 3.9, -15.299, 0, 'SHADE   /   04', 3.9, .62, c.tank, c.chalk);
solid(34.9, 0, -19.9, 2.9, 1.07, 2.4, c.clay);
paint(34.9, 1.07, -19.9, 2.89, .029, 2.39, c.ochre);

// Split the long sand lanes with asymmetrical cover, leaving a route along
// either shoulder of each bluff. Small rocks can be vaulted for new angles.
for (const spec of [
  [-47,-36.0,13.2,9.4,6.7,-1], [-5.3,-21.5,7.1,5.9,3.85,1],
  [37.7,-38.1,10.7,8.1,6.35,1], [49.9,-7.8,7.9,9.5,4.7,-1],
  [49.1,33.7,12.4,8.3,6.25,-1], [7.8,33.9,8.4,5.4,3.8,1],
  [-46.6,26.8,9.1,7.3,5.5,-1], [-53.4,-9.3,6.9,11.4,5.3,1],
  [-6.1,17.8,6.0,4.3,2.6,1], [-49.2,8.7,4.1,3.6,2.05,-1],
  [54.1,-35.0,4.8,3.9,2.2,1], [30.1,35.6,4.2,3.7,2.35,-1],
]) butte(...spec);
function crate(x, z, w, h, d) {
  solid(x, 0, z, w, h, d, c.teal);
  for (const side of [-1, 1]) {
    paint(x + side * w * .34, .02, z, .19, h + .009, d + .033, c.copper);
  }
  paint(x, h - .18, z + d / 2 + .014, w * .95, .13, .036, c.azure);
}
for (const spec of [
  [-24,-39.8,4.8,1.55,3.05],[-22.3,9.1,3.25,1.10,3.05],
  [9.55,-12,4.0,1.42,2.7],[20.0,29.6,4.45,1.50,2.9],
  [54.2,16.0,3.4,1.15,2.9],[-53,42.3,4.2,1.42,3.3],
]) crate(...spec);

// Dry irrigation channels are dark *flush* ceramic inlays in the sand.
// Sun-bleached waterline ripples mimic chisel marks on either side.
for (const [x,z,w,d] of [
  [-36,-37.32,2.0,8],[-22.40,-41.32,29.2,1.55],
  [-7.75,-44.5,1.25,7.9],[1.45,-48.45,19.6,1.25],
  [-35,14.75,1.20,10.8],[-42.85,20.1,16.70,1.20],
  [36.3,26.25,1.22,11],[32.55,31.71,8.73,1.21],
]) {
  paint(x, .006, z, w, .012, d, c.clay);
  paint(x, .019, z, Math.max(.26, w - .37), .011,
    Math.max(.26, d - .37), c.ochre);
}
for (const r of ramps) {
  const xRun = r.dir.endsWith('x'), sign = r.dir[0] === '+' ? -1 : 1;
  const x = r.x + (xRun ? sign * (r.w / 2 + .52) : 0);
  const z = r.z + (xRun ? 0 : sign * (r.d / 2 + .52));
  paint(x, .012, z, xRun ? .62 : r.w, .02, xRun ? r.d : .62, c.clay);
  for (let i = -2; i <= 2; i++) {
    paint(x + (xRun ? 0 : i * .86), .032, z + (xRun ? i * .86 : 0),
      xRun ? .54 : .32, .013, xRun ? .32 : .54, c.salt);
  }
}

// Sparse saguaros along the field have collidable stems and branches.
// Smaller sprouts outside the boundary can use the scenery batch alone.
function saguaro(x, z, h, add, mirror = 1) {
  const t = h * .16;
  add(x, 0, z, t, h, t * .92, c.green);
  add(x + mirror * t * .72, h * .39, z, t * 1.00, t * .67, t * .67, c.green);
  add(x + mirror * t * 1.04, h * .39, z, t * .62, h * .37, t * .68, c.green);
  add(x - mirror * t * .68, h * .59, z, t, t * .61, t * .61, c.leaf);
  add(x - mirror * t * 1.01, h * .59, z, t * .60, h * .27, t * .63, c.leaf);
  paint(x + t * .20, h * .11, z + t * .47, t * .16, h * .81, .025, c.leaf);
}
saguaro(-49.6, -29.4, 3.9, solid, -1);
saguaro(46.8, 27.9, 4.35, solid);
saguaro(40.2, -31.2, 3.65, solid);
saguaro(-49.0, 21.0, 3.45, solid, -1);

// Out-of-bounds canyon silhouettes: spaced and uneven so the low sun can
// break through the notches. Front, side and rear spans never enter play.
function distantMesa(x, z, w, d, h, drift, hue) {
  paint(x, -.25, z, w, h * .58 + .25, d, hue);
  paint(x + drift * w * .035, h * .58, z, w * .86, h * .27, d * .88, c.blush);
  paint(x - drift * w * .014, h * .85, z + d * .025,
    w * .76, h * .15, d * .70, c.sun);
}
for (const [x,w,h] of [[-60,17,13],[-44,24.9,9],[-24.1,16.8,16],
  [-8.5,10.7,6.4],[9.2,18.6,8.8],[24,12.4,15.6],[44.4,21.7,9.4],[62.1,16.5,13.7]]) {
  distantMesa(x, -62.5, w, 14.5, h, x < 0 ? -1 : 1, c.ember);
}
for (const [x,w,h] of [[-59,20.0,10.4],[-40.1,19.4,7],[-21.1,18.2,12.7],
  [2.3,26.6,6.9],[22.7,16.1,11.1],[42.1,21.4,14],[64,18,8.7]]) {
  distantMesa(x, 63.8, w, 17.5, h, x < 0 ? 1 : -1, c.clay);
}
for (const side of [-1, 1]) {
  for (const [z,d,h] of [[-44.9,20.1,13.8],[-24.8,19.3,8.3],
    [-7.0,17.5,13.2],[12.2,19.6,7.3],[30.2,16.6,12],[47.2,17.0,10.6]]) {
    distantMesa(side * 78.0, z, 17.2, d, h + (side < 0 ? 2 : 0),
      side, side < 0 ? c.ochre : c.ember);
  }
}
for (const [x,z,w,d,h] of [
  [-69,-83,24,21,17],[-39,-86,23,21,28],[0,-86,25,18,13],
  [42,-82,25,24,23],[87,-56,20,20,22],[96,6,17,19,26],
  [73,76,26,22,21],[-33,87,18,20,19],[-94,43,22,20,24],[-98,-18,20,20,24],
]) distantMesa(x, z, w, d, h, x < 0 ? -1 : 1, c.magenta);
// The pale aqueduct follows the north lip, passing a square glass water
// tower. Its blue waterline draws the eye across the warm cliff silhouette.
for (const x of [-53,-42,-31,-20,-9]) {
  paint(x, 3.1, -65, 2.21, 13.2, 3.1, c.chalk);
  paint(x, 14.3, -65, 4.5, 2, 3.1, c.chalk);
}
paint(-30.9, 16.3, -65, 47.65, 1.55, 3.35, c.chalk);
paint(-30.9, 17.85, -65, 47.90, .44, 3.65, c.blue);
paint(-30.9, 18.29, -65, 47.96, .19, 3.70, c.salt);
paint(-51.5, 6.4, -65, 3.35, 12.5, 3.35, c.ochre);
paint(-51.5, 18.9, -65, 6.2, 5.30, 5.72, c.blue);
paint(-51.5, 21.8, -65, 6.24, .39, 5.76, c.azure);
paint(-51.5, 24.2, -65, 6.58, .63, 6.09, c.chalk);
for (const [x,z,h] of [[-58,-55,4.1],[-32,-54.9,3.15],[43.2,-55.35,4.2],
  [-69.5,3.7,4.6],[70.0,-29.2,3.25],[29,55.2,3.8],[68.8,44.9,3.55]]) {
  saguaro(x, z, h, paint, x < 0 ? 1 : -1);
}

export const DESERT = {
  name: 'Saffron Canyon', bounds, floorColor: c.sand, boxes, ramps, decor, signs,
  preview: { eye: [32.4, 10.3, 32.5], target: [-5.0, 6.6, -9.4] },
};
