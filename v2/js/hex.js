/*
 * Near Peer — hex grid maths. Axial coordinates (q, r), pointy-top hexes,
 * keys are "q,r" strings.
 */
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

const key = (q, r) => `${q},${r}`;
const parse = (k) => {
  const [q, r] = k.split(',').map(Number);
  return { q, r };
};

function inBoard(k, radius) {
  const { q, r } = parse(k);
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= radius;
}

function all(radius) {
  const out = [];
  for (let r = -radius; r <= radius; r++) {
    for (let q = -radius; q <= radius; q++) {
      if (Math.abs(q + r) <= radius) out.push(key(q, r));
    }
  }
  return out;
}

function neighbors(k, radius) {
  const { q, r } = parse(k);
  return DIRS.map(([dq, dr]) => key(q + dq, r + dr)).filter((n) => inBoard(n, radius));
}

function distance(a, b) {
  const A = parse(a);
  const B = parse(b);
  return (Math.abs(A.q - B.q) + Math.abs(A.r - B.r) + Math.abs(A.q + A.r - B.q - B.r)) / 2;
}

function toPixel(k, size) {
  const { q, r } = parse(k);
  return { x: size * Math.sqrt(3) * (q + r / 2), y: size * 1.5 * r };
}

function corners(x, y, size) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    out.push({ x: x + size * Math.cos(a), y: y + size * Math.sin(a) });
  }
  return out;
}

export { key, parse, inBoard, all, neighbors, distance, toPixel, corners };
