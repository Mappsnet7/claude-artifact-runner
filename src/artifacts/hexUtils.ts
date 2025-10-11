export function normalizeAdditionalMiddleRows(additionalRows: number): number {
  if (!Number.isFinite(additionalRows)) {
    return 0;
  }
  const normalized = Math.max(0, Math.floor(additionalRows));
  return normalized;
}

function clampMagnitudeTowardsCenter(q: number, additionalMiddleRows: number): number {
  if (q === 0) {
    return 0;
  }

  const normalizedRows = normalizeAdditionalMiddleRows(additionalMiddleRows);
  if (normalizedRows === 0) {
    return q;
  }

  const magnitude = Math.abs(q);
  const reducedMagnitude = Math.max(0, magnitude - normalizedRows);
  return q < 0 ? -reducedMagnitude : reducedMagnitude;
}

export function getRowBounds(radius: number, q: number, additionalMiddleRows: number): { start: number; end: number } {
  const clampedQ = clampMagnitudeTowardsCenter(q, additionalMiddleRows);
  const start = Math.max(-radius, -clampedQ - radius);
  const end = Math.min(radius, -clampedQ + radius);

  return { start, end };
}

export function countHexes(radius: number, additionalMiddleRows: number): number {
  const normalizedRows = normalizeAdditionalMiddleRows(additionalMiddleRows);
  let total = 0;

  for (let q = -radius; q <= radius; q++) {
    const { start, end } = getRowBounds(radius, q, normalizedRows);
    total += end - start + 1;
  }

  return total;
}
