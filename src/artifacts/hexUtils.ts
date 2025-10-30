export function normalizeAdditionalMiddleRows(additionalRows: number): number {
  if (!Number.isFinite(additionalRows)) {
    return 0;
  }
  return Math.max(0, Math.floor(additionalRows));
}

function getStandardRowBounds(radius: number, q: number): { start: number; end: number } {
  const start = Math.max(-radius, -q - radius);
  const end = Math.min(radius, -q + radius);
  return { start, end };
}

function splitAdditionalRows(additionalMiddleRows: number): { leftExtra: number; rightExtra: number } {
  const normalized = normalizeAdditionalMiddleRows(additionalMiddleRows);
  const leftExtra = Math.floor(normalized / 2);
  const rightExtra = normalized - leftExtra;
  return { leftExtra, rightExtra };
}

export function getQRange(
  radius: number,
  additionalMiddleRows: number
): { minQ: number; maxQ: number } {
  const { leftExtra, rightExtra } = splitAdditionalRows(additionalMiddleRows);
  return {
    minQ: -radius - leftExtra,
    maxQ: radius + rightExtra
  };
}

export function getRowBounds(
  radius: number,
  q: number,
  additionalMiddleRows: number
): { start: number; end: number } {
  const normalizedRows = normalizeAdditionalMiddleRows(additionalMiddleRows);
  if (normalizedRows === 0) {
    return getStandardRowBounds(radius, q);
  }

  const { leftExtra, rightExtra } = splitAdditionalRows(normalizedRows);

  if (q <= -leftExtra - 1) {
    const originalQ = q + leftExtra;
    return getStandardRowBounds(radius, originalQ);
  }

  if (q >= rightExtra + 1) {
    const originalQ = q - rightExtra;
    return getStandardRowBounds(radius, originalQ);
  }

  return { start: -radius, end: radius };
}

export function countHexes(radius: number, additionalMiddleRows: number): number {
  const { minQ, maxQ } = getQRange(radius, additionalMiddleRows);
  let total = 0;

  for (let q = minQ; q <= maxQ; q++) {
    const { start, end } = getRowBounds(radius, q, additionalMiddleRows);
    total += end - start + 1;
  }

  return total;
}

export function getLogicalPositionKey(q: number, r: number, additionalMiddleRows: number): string {
  const normalizedRows = normalizeAdditionalMiddleRows(additionalMiddleRows);
  const { leftExtra, rightExtra } = splitAdditionalRows(normalizedRows);

  if (q < -leftExtra || q > rightExtra) {
    const shift = q < -leftExtra ? leftExtra : rightExtra;
    const originalQ = q < -leftExtra ? q + shift : q - shift;
    return `core:${originalQ}:${r}`;
  }

  // Центральная полоса (включая добавленные колонки)
  return `center:${q}:${r}`;
}

export const DEFAULT_HEX_SIZE = 20;
export const POINTY_TO_FLAT_ROTATION = -Math.PI / 6;

const COS_ROTATION = Math.cos(POINTY_TO_FLAT_ROTATION);
const SIN_ROTATION = Math.sin(POINTY_TO_FLAT_ROTATION);

export function rotatePoint(
  x: number,
  y: number,
  cosAngle: number = COS_ROTATION,
  sinAngle: number = SIN_ROTATION
): { x: number; y: number } {
  return {
    x: x * cosAngle - y * sinAngle,
    y: x * sinAngle + y * cosAngle
  };
}

export function axialToPointyPixel(
  q: number,
  r: number,
  size: number = DEFAULT_HEX_SIZE
): { x: number; y: number } {
  return {
    x: size * Math.sqrt(3) * (q + r / 2),
    y: size * (3 / 2) * r
  };
}

export function axialToFlatPixel(
  q: number,
  r: number,
  size: number = DEFAULT_HEX_SIZE
): { x: number; y: number } {
  const { x, y } = axialToPointyPixel(q, r, size);
  return rotatePoint(x, y);
}

export function getFlatTopHexVertices(
  q: number,
  r: number,
  size: number = DEFAULT_HEX_SIZE
): Array<{ x: number; y: number }> {
  const centerPointy = axialToPointyPixel(q, r, size);
  const vertices: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 6 + i * (Math.PI / 3);
    const offsetX = size * Math.cos(angle);
    const offsetY = size * Math.sin(angle);
    const vertexPointy = {
      x: centerPointy.x + offsetX,
      y: centerPointy.y + offsetY
    };
    vertices.push(rotatePoint(vertexPointy.x, vertexPointy.y));
  }

  return vertices;
}

export function axialToFlat3D(
  q: number,
  r: number,
  scale: number = 1
): { x: number; z: number } {
  const { x, y } = axialToFlatPixel(q, r, scale);
  return { x, z: y };
}
