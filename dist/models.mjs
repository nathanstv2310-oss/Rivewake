import * as THREE from './vendor/three.module.js';

// Original hard-surface meshes. Bake the coloured panels of each moving part
// into one geometry so a row of armoured fighters stays inexpensive to draw.
const finish = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.78,
  metalness: 0.12
});
const carbon = 0x25323c;
const recess = 0x152029;
const alloy = 0x526472;
const edge = 0x81949e;
const ivory = 0xe9e4cf;
const amber = 0xffbd46;
const teal = 0x36bcb3;
const coral = 0xf07a5e;
const signal = 0x9bf8df;
const boxTemplate = new THREE.BoxGeometry(1, 1, 1);
const octagon = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
const paintCache = new Map();
const vertex = new THREE.Vector3();
const transform = new THREE.Object3D();
const axisY = new THREE.Vector3(0, 1, 0);

function paint(hex) {
  if (!paintCache.has(hex)) paintCache.set(hex, new THREE.Color(hex));
  return paintCache.get(hex);
}

class Part {
  xyz = [];
  rgb = [];

  point(x, y, z, tint) {
    this.xyz.push(x, y, z);
    this.rgb.push(tint.r, tint.g, tint.b);
  }

  stamp(geometry, color) {
    const tint = paint(color);
    const positions = geometry.attributes.position;
    const indices = geometry.index;
    transform.updateMatrix();
    for (let i = 0; i < indices.count; i++) {
      vertex.fromBufferAttribute(positions, indices.getX(i)).applyMatrix4(transform.matrix);
      this.point(vertex.x, vertex.y, vertex.z, tint);
    }
  }

  box(x, y, z, w, h, d, color, rx = 0, ry = 0, rz = 0) {
    transform.position.set(x, y, z);
    transform.scale.set(w, h, d);
    transform.rotation.set(rx, ry, rz);
    this.stamp(boxTemplate, color);
  }

  tube(x, y, z, radius, length, color, axis = 'z') {
    transform.position.set(x, y, z);
    transform.scale.set(radius, length, radius);
    transform.rotation.set(axis === 'z' ? Math.PI / 2 : 0, 0, axis === 'x' ? Math.PI / 2 : 0);
    this.stamp(octagon, color);
  }

  bar(start, end, width, depth, color) {
    vertex.set(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
    const length = vertex.length();
    transform.position.set((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2);
    transform.scale.set(width, length, depth);
    transform.quaternion.setFromUnitVectors(axisY, vertex.multiplyScalar(1 / length));
    this.stamp(boxTemplate, color);
  }

  // A side profile in [z, y] coordinates extruded across X.
  profile(x, width, outline, color) {
    let area = 0;
    for (let i = 0; i < outline.length; i++) {
      const [z0, y0] = outline[i];
      const [z1, y1] = outline[(i + 1) % outline.length];
      area += z0 * y1 - z1 * y0;
    }
    const loop = area < 0 ? [...outline].reverse() : outline;
    const left = x - width / 2;
    const right = x + width / 2;
    const tint = paint(color);
    const put = (side, i) => this.point(side, loop[i][1], loop[i][0], tint);
    const triangles = THREE.ShapeUtils.triangulateShape(loop.map(([z, y]) => new THREE.Vector2(z, y)), []);
    for (const [a, b, c] of triangles) {
      put(left, a); put(left, b); put(left, c);
      put(right, a); put(right, c); put(right, b);
    }
    for (let i = 0; i < loop.length; i++) {
      const j = (i + 1) % loop.length;
      put(left, i); put(right, i); put(right, j);
      put(left, i); put(right, j); put(left, j);
    }
  }

  panel(x, y, z, w, h, d, color, chamfer = 0.018) {
    const c = Math.min(chamfer, h / 3, d / 3);
    const a = z - d / 2, b = z + d / 2;
    const low = y - h / 2, high = y + h / 2;
    this.profile(x, w, [
      [a + c, low], [b - c, low], [b, low + c], [b, high - c],
      [b - c, high], [a + c, high], [a, high - c], [a, low + c]
    ], color);
  }

  bake() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.xyz, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.rgb, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

const muzzlePoints = [
  [0, 0.033, -0.624], [0, 0.043, -0.648],
  [0, 0.047, -0.864], [0, 0.033, -0.235]
];
const sightHeights = [0.124, 0.120, 0.168, 0.091];
const gunCache = new Map();

function buttstock(part, back, cheek, color) {
  part.box(0, 0.002, back / 2 + 0.035, 0.055, 0.041, back - 0.07, alloy);
  part.profile(0, 0.077, [
    [0.076, 0.017], [0.111, 0.050], [back - 0.027, 0.050],
    [back, 0.022], [back, -0.092], [back - 0.047, -0.082], [0.129, -0.013]
  ], carbon);
  part.panel(0, 0.052, (back + 0.12) / 2, 0.082, 0.030, back - 0.12, cheek, 0.012);
  part.panel(0, -0.017, back, 0.085, 0.147, 0.027, recess, 0.010);
  for (const side of [-1, 1]) {
    part.profile(side * 0.039, 0.003, [
      [back - 0.103, 0.021], [back - 0.028, 0.021],
      [back - 0.036, -0.005], [back - 0.077, -0.005]
    ], color);
  }
}

function grip(part, z, length = 0.131) {
  part.profile(0, 0.055, [
    [z - 0.035, -0.030], [z + 0.026, -0.035], [z + 0.060, -length],
    [z + 0.009, -length - 0.017], [z - 0.004, -length + 0.006]
  ], recess);
  part.box(0, -0.080, z - 0.049, 0.030, 0.011, 0.080, alloy);
  part.box(0, -0.057, z - 0.084, 0.030, 0.055, 0.012, alloy, 0.14);
  part.box(0, -0.054, z - 0.040, 0.014, 0.030, 0.009, edge, -0.27);
}

function sights(part, rearZ, frontZ, y) {
  // The open notch keeps the target visible when the client aligns this axis.
  part.panel(0, y - 0.045, rearZ, 0.062, 0.030, 0.042, carbon, 0.005);
  for (const side of [-1, 1]) {
    part.box(side * 0.024, y - 0.012, rearZ, 0.013, 0.041, 0.021, carbon);
    part.box(side * 0.024, y, rearZ + 0.012, 0.010, 0.011, 0.003, signal);
  }
  part.box(0, y - 0.029, frontZ, 0.013, 0.043, 0.016, carbon);
  part.box(0, y - 0.004, frontZ, 0.011, 0.010, 0.016, amber);
}

function rifle(part) {
  buttstock(part, 0.287, carbon, teal);
  grip(part, -0.001);
  part.panel(0, 0.008, -0.070, 0.091, 0.110, 0.309, carbon);
  part.profile(0, 0.100, [
    [-0.201, -0.014], [-0.140, -0.046], [0.053, -0.040],
    [0.072, -0.017], [0.038, 0.040], [-0.185, 0.032]
  ], teal);
  part.panel(0, 0.055, -0.087, 0.096, 0.049, 0.326, alloy, 0.012);
  part.box(0, 0.084, -0.064, 0.045, 0.013, 0.200, recess);
  part.profile(0, 0.061, [
    [-0.171, -0.037], [-0.094, -0.037], [-0.123, -0.183],
    [-0.161, -0.211], [-0.207, -0.196], [-0.178, -0.120]
  ], carbon);
  part.panel(0, -0.183, -0.166, 0.071, 0.026, 0.086, amber, 0.005);
  part.tube(0, 0.033, -0.378, 0.031, 0.377, alloy);
  part.panel(0, 0.028, -0.333, 0.099, 0.092, 0.266, teal);
  part.panel(0, 0.069, -0.339, 0.061, 0.024, 0.239, carbon, 0.008);
  part.tube(0, 0.033, -0.485, 0.037, 0.044, carbon);
  part.tube(0, 0.033, -0.583, 0.043, 0.080, carbon);
  part.tube(0, 0.033, -0.613, 0.044, 0.016, edge);
  part.tube(0, 0.033, -0.623, 0.025, 0.003, recess);
  sights(part, 0.029, -0.434, sightHeights[0]);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      part.box(side * 0.0504, 0.034, -0.263 - i * 0.047, 0.003, 0.034, 0.015, carbon, -0.35);
    }
    part.panel(side * 0.051, 0.012, -0.076, 0.004, 0.026, 0.079, ivory, 0.007);
    part.box(side * 0.054, 0.013, -0.067, 0.003, 0.019, 0.025, alloy, -0.32);
  }
  part.box(0.055, 0.048, -0.103, 0.018, 0.020, 0.075, recess);
  part.box(-0.064, 0.042, -0.130, 0.035, 0.019, 0.036, edge);
}

function shotgun(part) {
  buttstock(part, 0.266, coral, ivory);
  grip(part, 0.008);
  part.panel(0, 0.009, -0.075, 0.115, 0.125, 0.307, carbon, 0.025);
  part.panel(0, 0.030, -0.112, 0.121, 0.069, 0.246, coral);
  part.tube(0, 0.043, -0.403, 0.043, 0.452, alloy);
  part.tube(0, -0.032, -0.398, 0.032, 0.415, carbon);
  part.panel(0, -0.036, -0.345, 0.122, 0.091, 0.215, carbon);
  for (let i = 0; i < 5; i++) {
    part.panel(0, -0.033, -0.267 - i * 0.038, 0.131, 0.088, 0.016, alloy, 0.006);
  }
  part.panel(0, 0.015, -0.488, 0.105, 0.141, 0.038, coral, 0.012);
  part.tube(0, 0.043, -0.614, 0.050, 0.065, carbon);
  part.tube(0, 0.043, -0.645, 0.034, 0.004, recess);
  part.tube(0, -0.032, -0.594, 0.036, 0.032, amber);
  part.panel(0, 0.074, -0.116, 0.056, 0.024, 0.210, alloy, 0.008);
  sights(part, 0.003, -0.597, sightHeights[1]);
  // Side saddle with three ammunition sleeves and brass cartridge ends.
  part.box(-0.063, 0.007, -0.068, 0.011, 0.074, 0.135, recess);
  for (let i = 0; i < 3; i++) {
    part.tube(-0.074, 0.016, -0.020 - i * 0.046, 0.015, 0.071, coral, 'y');
    part.tube(-0.074, -0.012, -0.020 - i * 0.046, 0.016, 0.016, amber, 'y');
  }
  part.panel(0.062, 0.024, -0.125, 0.006, 0.035, 0.100, recess, 0.010);
  part.box(0.067, 0.022, -0.115, 0.005, 0.022, 0.048, edge);
}

function marksman(part) {
  buttstock(part, 0.309, ivory, amber);
  grip(part, 0.018);
  part.profile(0, 0.085, [
    [-0.410, 0.024], [-0.286, -0.027], [-0.144, -0.055],
    [0.057, -0.037], [0.084, 0.003], [0.040, 0.048], [-0.392, 0.059]
  ], ivory);
  part.panel(0, 0.048, -0.127, 0.090, 0.064, 0.385, alloy, 0.013);
  part.panel(0, -0.066, -0.118, 0.072, 0.075, 0.094, carbon, 0.012);
  part.box(0, -0.097, -0.118, 0.076, 0.017, 0.098, amber);
  part.tube(0, 0.047, -0.543, 0.025, 0.485, edge);
  for (let i = 0; i < 3; i++) {
    part.tube(0, 0.047, -0.344 - i * 0.064, 0.033, 0.023, carbon);
  }
  part.panel(0, 0.047, -0.809, 0.084, 0.083, 0.106, carbon, 0.015);
  part.tube(0, 0.047, -0.861, 0.025, 0.005, recess);
  for (const side of [-1, 1]) {
    part.box(side * 0.043, 0.051, -0.817, 0.003, 0.031, 0.014, edge);
    part.box(side * 0.043, 0.051, -0.789, 0.003, 0.031, 0.014, edge);
    part.box(side * 0.044, 0.004, -0.249, 0.004, 0.032, 0.057, amber, -0.24);
  }
  // The octagonal scope and its lens seals give the long rifle a clear read.
  for (const z of [-0.185, -0.030]) {
    part.panel(0, 0.099, z, 0.062, 0.055, 0.046, carbon, 0.008);
    part.tube(0, 0.161, z, 0.047, 0.025, alloy);
  }
  part.tube(0, 0.161, -0.109, 0.040, 0.340, carbon);
  part.tube(0, 0.161, -0.272, 0.063, 0.100, carbon);
  part.tube(0, 0.161, -0.313, 0.067, 0.018, amber);
  part.tube(0, 0.161, -0.323, 0.048, 0.003, teal);
  part.tube(0, 0.161, 0.056, 0.053, 0.047, recess);
  part.tube(0, 0.161, 0.081, 0.038, 0.004, 0x407c87);
  part.tube(0, 0.211, -0.108, 0.026, 0.031, alloy, 'y');
  part.tube(0.061, 0.049, -0.011, 0.011, 0.052, edge, 'x');
  part.box(0.084, 0.024, -0.011, 0.019, 0.054, 0.018, edge, 0, 0, -0.23);
  part.panel(0.087, 0, -0.011, 0.032, 0.029, 0.032, carbon, 0.008);
}

function pistol(part) {
  grip(part, 0.014, 0.154);
  part.profile(0, 0.070, [
    [-0.179, 0.017], [-0.162, -0.046], [-0.018, -0.043],
    [0.023, -0.152], [0.070, -0.138], [0.048, 0.016]
  ], teal);
  part.panel(0, 0.036, -0.085, 0.079, 0.064, 0.284, alloy, 0.009);
  part.panel(0, 0.039, -0.192, 0.086, 0.074, 0.066, carbon, 0.013);
  part.tube(0, 0.033, -0.221, 0.022, 0.025, edge);
  part.tube(0, 0.033, -0.234, 0.014, 0.003, recess);
  part.panel(0, -0.144, 0.039, 0.065, 0.033, 0.074, carbon, 0.006);
  part.box(0, 0.070, -0.075, 0.017, 0.012, 0.174, ivory);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      part.box(side * 0.040, 0.040, 0.031 - i * 0.016, 0.003, 0.043, 0.006, carbon, -0.30);
    }
  }
  sights(part, 0.036, -0.196, sightHeights[3]);
}

function gloves(part, weapon) {
  const point = weapon === 3 ? -0.034 : [-0.327, -0.345, -0.275][weapon];
  // Right hand reaches the pistol grip. The support hand wraps the pump,
  // handguard, or right hand on the compact sidearm.
  part.bar([0.045, -0.095, 0.055], [0.193, -0.277, 0.331], 0.104, 0.104, alloy);
  part.bar([0.064, -0.117, 0.090], [0.163, -0.233, 0.274], 0.118, 0.112, carbon);
  part.bar([0.067, -0.120, 0.093], [0.085, -0.141, 0.122], 0.122, 0.116, teal);
  part.panel(0.026, -0.102, 0.028, 0.081, 0.103, 0.097, carbon, 0.019);
  for (let i = 0; i < 3; i++) {
    part.panel(-0.021, -0.083 - i * 0.023, 0.018 + 0.007 * i, 0.045, 0.019, 0.058, alloy, 0.005);
  }
  part.panel(0.044, -0.061, -0.026, 0.028, 0.025, 0.081, alloy, 0.007);
  const wrist = [-0.065, -0.112, point + 0.056];
  const elbow = [-0.155, weapon === 3 ? -0.258 : -0.283, 0.240];
  part.bar(wrist, elbow, 0.108, 0.100, carbon);
  const cuff = wrist.map((v, i) => v + (elbow[i] - v) * 0.19);
  part.bar(wrist, cuff, 0.113, 0.105, teal);
  part.panel(-0.022, -0.074, point, 0.089, 0.079, 0.095, carbon, 0.017);
  for (let i = 0; i < 3; i++) {
    part.panel(0.037, -0.051, point - 0.025 + i * 0.026, 0.030, 0.059, 0.022, alloy, 0.006);
  }
}

const buildGunParts = [rifle, shotgun, marksman, pistol];
const gunNames = ['Assault rifle', 'Shotgun', 'Sniper rifle', 'Pistol'];
function gunIndex(value) {
  return Number.isInteger(value) && value >= 0 && value < 4 ? value : 0;
}
function gunGeometry(weapon, firstPerson) {
  const key = weapon + (firstPerson ? 4 : 0);
  if (!gunCache.has(key)) {
    const part = new Part();
    buildGunParts[weapon](part);
    if (firstPerson) gloves(part, weapon);
    gunCache.set(key, part.bake());
  }
  return gunCache.get(key);
}

export function makeGun(weaponIndex = 0, firstPerson = false) {
  const weapon = gunIndex(weaponIndex);
  const gun = new THREE.Group();
  gun.name = gunNames[weapon];
  const mesh = new THREE.Mesh(gunGeometry(weapon, firstPerson), finish);
  mesh.castShadow = !firstPerson;
  mesh.receiveShadow = !firstPerson;
  gun.add(mesh);
  gun.userData.muzzle = new THREE.Vector3(...muzzlePoints[weapon]);
  gun.userData.sightHeight = sightHeights[weapon];
  return gun;
}

const suitColors = [
  0xffb539, 0x20c4b0, 0xff765e, 0x9990ff,
  0x45aff2, 0xb0d95e, 0xf884ac, 0x79dce8
];
const fighterCache = new Map();
const darkCloth = 0x36444f;

// Tapered, eight-corner armour plates, described by rings from bottom to top.
// Ring dimensions are [height, width, depth, chamfer, zOffset].
function armour(part, rings, colors, capColor) {
  const loops = rings.map(([y, w, d, c, z = 0]) => {
    const l = -w / 2, r = w / 2, near = z - d / 2, far = z + d / 2;
    return [
      [l + c, y, near], [l, y, near + c], [l, y, far - c], [l + c, y, far],
      [r - c, y, far], [r, y, far - c], [r, y, near + c], [r - c, y, near]
    ];
  });
  const emit = (v, tint) => part.point(v[0], v[1], v[2], tint);
  const cap = paint(capColor);
  for (let j = 1; j < 7; j++) {
    const base = loops[0], top = loops[loops.length - 1];
    emit(base[0], cap); emit(base[j + 1], cap); emit(base[j], cap);
    emit(top[0], cap); emit(top[j], cap); emit(top[j + 1], cap);
  }
  for (let i = 0; i < loops.length - 1; i++) {
    const tint = paint(colors[i]);
    for (let j = 0; j < 8; j++) {
      const k = (j + 1) % 8;
      const a = loops[i][j], b = loops[i][k], c = loops[i + 1][k], d = loops[i + 1][j];
      emit(a, tint); emit(b, tint); emit(c, tint);
      emit(a, tint); emit(c, tint); emit(d, tint);
    }
  }
}

function torsoGeometry(color) {
  const part = new Part();
  part.panel(0, 0.025, 0.002, 0.359, 0.157, 0.235, darkCloth, 0.030);
  part.panel(0, 0.088, 0, 0.386, 0.065, 0.248, recess, 0.013);
  part.box(0, 0.090, -0.132, 0.076, 0.051, 0.028, edge);
  armour(part, [
    [0.116, 0.325, 0.225, 0.046], [0.237, 0.384, 0.251, 0.039],
    [0.405, 0.488, 0.284, 0.050], [0.474, 0.467, 0.282, 0.048],
    [0.533, 0.357, 0.235, 0.048]
  ], [carbon, color, color, ivory], carbon);
  part.panel(0, 0.552, -0.002, 0.238, 0.107, 0.202, carbon, 0.025);
  // Front bib, separate webbing, and a stamped three-stroke depot badge.
  part.panel(0, 0.352, -0.137, 0.320, 0.154, 0.046, carbon, 0.015);
  part.box(-0.043, 0.366, -0.163, 0.146, 0.043, 0.012, color);
  for (let i = 0; i < 3; i++) {
    part.box(0.061 + i * 0.023, 0.371, -0.164, 0.014, 0.046, 0.011, ivory, 0, 0, -0.29);
  }
  for (const side of [-1, 1]) {
    part.panel(side * 0.116, 0.208, -0.135, 0.087, 0.139, 0.068, alloy, 0.012);
    part.box(side * 0.116, 0.244, -0.172, 0.090, 0.024, 0.011, edge);
    part.panel(side * 0.185, 0.068, 0.025, 0.080, 0.102, 0.093, carbon, 0.015);
    part.box(side * 0.221, 0.094, 0.021, 0.012, 0.028, 0.075, color);
    part.panel(side * 0.170, 0.436, -0.119, 0.050, 0.114, 0.041, darkCloth, 0.012);
  }
  // A low-profile field pack makes the silhouette readable from behind.
  part.panel(0, 0.325, 0.162, 0.345, 0.362, 0.122, carbon, 0.032);
  part.panel(0, 0.337, 0.226, 0.261, 0.255, 0.041, color, 0.024);
  part.box(0.052, 0.345, 0.249, 0.042, 0.205, 0.010, ivory);
  part.box(-0.062, 0.260, 0.248, 0.072, 0.030, 0.010, recess);
  part.box(-0.062, 0.260, 0.254, 0.048, 0.010, 0.004, signal);
  return part.bake();
}

function headGeometry(color) {
  const part = new Part();
  part.panel(0, 0.008, 0.007, 0.184, 0.083, 0.166, recess, 0.012);
  armour(part, [
    [0.038, 0.229, 0.192, 0.036], [0.082, 0.302, 0.258, 0.049],
    [0.135, 0.324, 0.278, 0.048, -0.005], [0.242, 0.352, 0.310, 0.049, -0.007],
    [0.265, 0.364, 0.325, 0.051, -0.012], [0.346, 0.339, 0.297, 0.053],
    [0.410, 0.269, 0.228, 0.047, 0.012]
  ], [carbon, color, recess, ivory, color, color], color);
  part.panel(0, 0.241, -0.164, 0.258, 0.034, 0.039, carbon, 0.012);
  part.box(0, 0.192, -0.159, 0.225, 0.019, 0.009, 0x70dedd);
  part.box(-0.053, 0.197, -0.165, 0.103, 0.007, 0.006, 0xd3ffed);
  part.box(0, 0.412, 0.018, 0.043, 0.006, 0.174, ivory);
  part.box(0.043, 0.412, 0.018, 0.013, 0.006, 0.174, ivory);
  for (const side of [-1, 1]) {
    part.tube(side * 0.169, 0.174, 0.016, 0.056, 0.031, carbon, 'x');
    part.tube(side * 0.189, 0.174, 0.016, 0.037, 0.010, alloy, 'x');
    part.box(side * 0.193, 0.174, 0.016, 0.004, 0.013, 0.043, color);
  }
  part.panel(0, 0.173, 0.146, 0.201, 0.092, 0.025, carbon, 0.010);
  part.box(0, 0.190, 0.162, 0.127, 0.014, 0.007, amber);
  return part.bake();
}

function thighGeometry(side, color) {
  const part = new Part();
  part.panel(0, -0.142, 0.002, 0.159, 0.294, 0.175, darkCloth, 0.023);
  part.panel(side * 0.009, -0.174, -0.067, 0.151, 0.199, 0.062, color, 0.020);
  part.panel(side * 0.080, -0.119, 0.002, 0.040, 0.133, 0.109, alloy, 0.014);
  part.box(side * 0.085, -0.182, 0.002, 0.032, 0.027, 0.113, recess);
  return part.bake();
}

function bootGeometry(color) {
  const part = new Part();
  part.panel(0, -0.147, 0.008, 0.133, 0.270, 0.145, darkCloth, 0.018);
  part.panel(0, -0.137, -0.056, 0.135, 0.181, 0.051, alloy, 0.014);
  part.panel(0, 0.002, -0.051, 0.154, 0.109, 0.097, carbon, 0.024);
  part.box(0, 0.016, -0.101, 0.089, 0.026, 0.007, color);
  part.panel(0, -0.275, -0.001, 0.155, 0.093, 0.161, carbon, 0.019);
  part.panel(0, -0.343, -0.038, 0.164, 0.111, 0.242, carbon, 0.022);
  part.panel(0, -0.389, -0.043, 0.171, 0.043, 0.253, recess, 0.008);
  part.box(0, -0.341, -0.153, 0.116, 0.018, 0.016, edge);
  return part.bake();
}

const mountZ = [-0.312, -0.306, -0.337, -0.506];
function armsGeometry(color, weapon) {
  const part = new Part();
  for (const side of [-1, 1]) {
    const support = side === -1;
    const gunZ = mountZ[weapon];
    const shoulder = [side * 0.235, 0.005, -0.001];
    const elbow = support ? [-0.264, -0.178, -0.207] : [0.268, -0.207, -0.091];
    const hand = support
      ? [0.083, -0.117, gunZ - [0.252, 0.321, 0.229, 0.025][weapon]]
      : [0.129, -0.143, gunZ + 0.036];
    part.bar(shoulder, elbow, 0.137, 0.139, darkCloth);
    part.panel(side * 0.247, -0.020, -0.002, 0.160, 0.144, 0.196, color, 0.028);
    part.box(side * 0.328, -0.012, -0.005, 0.006, 0.026, 0.100, ivory);
    part.bar(elbow, hand, 0.121, 0.129, alloy);
    const cuff = elbow.map((v, i) => v + (hand[i] - v) * 0.77);
    part.bar(cuff, hand, 0.127, 0.134, carbon);
    part.panel(hand[0], hand[1], hand[2] - 0.016, 0.109, 0.099, 0.102, recess, 0.018);
  }
  return part.bake();
}

function fighterGeometry(paletteIndex) {
  if (!fighterCache.has(paletteIndex)) {
    const color = suitColors[paletteIndex];
    fighterCache.set(paletteIndex, {
      torso: torsoGeometry(color), head: headGeometry(color),
      thighs: [thighGeometry(-1, color), thighGeometry(1, color)],
      boot: bootGeometry(color), arms: new Map(), color
    });
  }
  return fighterCache.get(paletteIndex);
}

function suitArms(parts, weapon) {
  if (!parts.arms.has(weapon)) parts.arms.set(weapon, armsGeometry(parts.color, weapon));
  return parts.arms.get(weapon);
}

function armourMesh(geometry) {
  const mesh = new THREE.Mesh(geometry, finish);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function makeFighter(paletteIndex = 0) {
  const palette = Number.isFinite(paletteIndex) ? Math.abs(Math.trunc(paletteIndex)) % suitColors.length : 0;
  const parts = fighterGeometry(palette);
  const fighter = new THREE.Group();
  fighter.name = 'Depot operator';
  const hips = new THREE.Group();
  hips.position.y = 0.764;
  fighter.add(hips);

  const torso = armourMesh(parts.torso);
  hips.add(torso);
  const head = armourMesh(parts.head);
  head.position.set(0, 0.646, -0.009);
  torso.add(head);

  const legs = [];
  for (let i = 0; i < 2; i++) {
    const upper = armourMesh(parts.thighs[i]);
    upper.position.set(i === 0 ? -0.112 : 0.112, 0, 0);
    hips.add(upper);
    const lower = armourMesh(parts.boot);
    lower.position.set(0, -0.352, 0.011);
    upper.add(lower);
    legs.push({upper, lower});
  }

  const aim = new THREE.Group();
  aim.position.set(0, 0.518, -0.022);
  const arms = armourMesh(suitArms(parts, 0));
  const gun = makeGun(0);
  gun.position.set(0.110, -0.038, mountZ[0]);
  aim.add(arms, gun);
  torso.add(aim);
  fighter.userData.gun = gun;
  fighter.userData.rig = {parts, hips, torso, head, legs, aim, arms, gun, weapon: 0};
  return fighter;
}

export function poseFighter(fighter, {stride = 0, moving = 0, pitch = 0, weapon = 0, recoil = 0, crouch = 0} = {}) {
  const rig = fighter.userData.rig;
  const index = gunIndex(weapon);
  if (index !== rig.weapon) {
    rig.weapon = index;
    rig.gun.name = gunNames[index];
    rig.gun.children[0].geometry = gunGeometry(index, false);
    rig.gun.position.z = mountZ[index];
    rig.gun.userData.muzzle.fromArray(muzzlePoints[index]);
    rig.gun.userData.sightHeight = sightHeights[index];
    rig.arms.geometry = suitArms(rig.parts, index);
  }
  const pace = THREE.MathUtils.clamp(moving, 0, 1);
  const low = THREE.MathUtils.clamp(crouch, 0, 1);
  const kick = THREE.MathUtils.clamp(recoil, 0, 1);
  const swing = Math.sin(stride) * pace;
  rig.hips.position.y = 0.764 - low * 0.174 + Math.abs(swing) * 0.013;
  rig.torso.rotation.y = swing * 0.052;
  rig.torso.rotation.z = swing * 0.022;
  for (let i = 0; i < 2; i++) {
    const step = i === 0 ? swing : -swing;
    rig.legs[i].upper.rotation.x = step * 0.59 + low * 0.64;
    rig.legs[i].lower.rotation.x = -Math.max(0, -step) * 0.72 - low * 1.26;
  }
  rig.aim.rotation.x = THREE.MathUtils.clamp(pitch, -1.45, 1.45) + kick * 0.095;
  rig.aim.position.z = -0.022 + kick * 0.050;
  rig.head.rotation.x = THREE.MathUtils.clamp(pitch * 0.74, -0.92, 0.92);
}
