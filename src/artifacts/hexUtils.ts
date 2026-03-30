import type { Point } from './types'

export const HEX_SIZE = 40

export function getHexPosition(q: number, r: number): Point {
  return {
    x: HEX_SIZE * 1.5 * q,
    y: HEX_SIZE * Math.sqrt(3) * (r + q / 2),
  }
}

export function generateHexCoords(
  radius: number,
  extraMiddleRows = 0
): { q: number; r: number; s: number }[] {
  const coords: { q: number; r: number; s: number }[] = []
  for (let q = -radius; q <= radius; q++) {
    const rMin = -radius - Math.min(0, q)
    const rMax = radius - Math.max(0, q)
    for (let r = rMin; r <= rMax; r++) {
      const s = -q - r
      coords.push({ q, r, s })
    }
  }
  if (extraMiddleRows > 0) {
    for (let extra = 1; extra <= extraMiddleRows; extra++) {
      for (let q = -radius; q <= radius; q++) {
        const r = radius + extra - Math.max(0, q)
        const s = -q - r
        if (!coords.find(c => c.q === q && c.r === r)) {
          coords.push({ q, r, s })
        }
        const r2 = -radius - extra - Math.min(0, q)
        const s2 = -q - r2
        if (!coords.find(c => c.q === q && c.r === r2)) {
          coords.push({ q, r: r2, s: s2 })
        }
      }
    }
  }
  return coords
}

export function hexKey(q: number, r: number, s: number): string {
  return `${q},${r},${s}`
}

export function calculateSvgDimensions(
  radius: number,
  extraMiddleRows = 0
): { width: number; height: number; offsetX: number; offsetY: number } {
  const cols = 2 * radius + 1
  const rows = 2 * radius + 1 + extraMiddleRows
  const width = cols * HEX_SIZE * 1.5 + HEX_SIZE
  const height = rows * HEX_SIZE * Math.sqrt(3) + HEX_SIZE
  const offsetX = width / 2
  const offsetY = height / 2
  return { width, height, offsetX, offsetY }
}
