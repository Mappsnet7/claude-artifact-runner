import type { HexData } from '../artifacts/types'

export interface ImportedMapData {
  hexMap: HexData[]
  mapRadius: number
  maxPlayerUnits?: number
}

export function exportMapToJSON(hexMap: HexData[], mapRadius: number, maxPlayerUnits?: number): void {
  const cleanedMap = hexMap.map(hex => {
    const basicHex: {
      position: { q: number; r: number; s: number }
      terrainType: string
      unit?: { type: string }
    } = {
      position: { q: hex.q, r: hex.r, s: hex.s },
      terrainType: hex.terrainType,
    }
    if (hex.unit) {
      basicHex.unit = { type: hex.unit.type }
    }
    return basicHex
  })

  const jsonData = JSON.stringify({ hexes: cleanedMap, mapRadius, maxPlayerUnits }, null, 2)
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonData)
  const a = document.createElement('a')
  a.setAttribute('href', dataStr)
  a.setAttribute('download', 'hex_map.json')
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function importMapFromJSON(
  file: File,
  onSuccess: (data: ImportedMapData) => void
): void {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const jsonData = JSON.parse(e.target?.result as string)

      if (
        !jsonData.hexes ||
        !Array.isArray(jsonData.hexes) ||
        typeof jsonData.mapRadius !== 'number'
      ) {
        throw new Error('Неверный формат файла: отсутствует hexes или mapRadius')
      }

      const radius: number = jsonData.mapRadius
      const hexMap: HexData[] = []

      // Build full grid
      for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius)
        const r2 = Math.min(radius, -q + radius)
        for (let r = r1; r <= r2; r++) {
          const s = -q - r
          hexMap.push({ q, r, s, terrainType: 'field', color: '#4CAF50', height: 0 })
        }
      }

      const hexIndex: Record<string, number> = {}
      hexMap.forEach((hex, idx) => {
        hexIndex[`${hex.q},${hex.r},${hex.s}`] = idx
      })

      for (const hexEntry of jsonData.hexes as Array<{
        position: { q: number; r: number; s: number }
        terrainType: string
        unit?: { type: string }
      }>) {
        if (hexEntry.terrainType === 'empty') continue
        const key = `${hexEntry.position.q},${hexEntry.position.r},${hexEntry.position.s}`
        const idx = hexIndex[key]
        if (idx !== undefined) {
          hexMap[idx] = {
            ...hexMap[idx],
            terrainType: hexEntry.terrainType,
          }
          if (hexEntry.unit?.type) {
            // icon and color resolved by consumer (useHexMap) which has access to unitTypes
            hexMap[idx].unit = { type: hexEntry.unit.type, icon: '', color: '' }
          }
        }
      }

      onSuccess({
        hexMap,
        mapRadius: radius,
        maxPlayerUnits:
          typeof jsonData.maxPlayerUnits === 'number' ? jsonData.maxPlayerUnits : undefined,
      })
    } catch (error) {
      alert('Ошибка при загрузке файла: ' + (error as Error).message)
    }
  }
  reader.readAsText(file)
}
