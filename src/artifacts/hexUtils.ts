export function normalizeAdditionalMiddleRows(additionalRows: number): number {
  if (!Number.isFinite(additionalRows)) {
    return 0;
  }
  const normalized = Math.max(0, Math.floor(additionalRows));
  return normalized;
}

export function calculateRowExtension(q: number, additionalMiddleRows: number): number {
  const normalizedRows = normalizeAdditionalMiddleRows(additionalMiddleRows);
  if (normalizedRows === 0) {
    return 0;
  }

  const distanceFromCenter = Math.abs(q);
  if (distanceFromCenter > normalizedRows) {
    return 0;
  }

  return normalizedRows - distanceFromCenter;
}

export function getRowBounds(radius: number, q: number, additionalMiddleRows: number): { start: number; end: number } {
  const baseR1 = Math.max(-radius, -q - radius);
  const baseR2 = Math.min(radius, -q + radius);
  const extension = calculateRowExtension(q, additionalMiddleRows);

  return {
    start: baseR1 - extension,
    end: baseR2 + extension,
  };
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
