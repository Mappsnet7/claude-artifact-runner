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
