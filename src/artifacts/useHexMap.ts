import { useState, useCallback, useMemo } from 'react'
import type { HexData, TerrainType, UnitType } from './types'
import { generateHexCoords, hexKey } from './hexUtils'
import { exportMapToJSON, importMapFromJSON } from '../lib/jsonUtils'

export interface UseHexMapReturn {
  hexMap: HexData[];
  setHexMap: React.Dispatch<React.SetStateAction<HexData[]>>;
  mapRadius: number;
  hexCount: number;
  maxPlayerUnits: number;
  setMaxPlayerUnits: React.Dispatch<React.SetStateAction<number>>;
  deletedHexes: HexData[];
  setDeletedHexes: React.Dispatch<React.SetStateAction<HexData[]>>;
  showSizeInput: boolean;
  setShowSizeInput: React.Dispatch<React.SetStateAction<boolean>>;
  initializeMap: (onViewReset?: () => void) => void;
  resizeMap: (newRadius: number) => void;
  increaseRadius: () => void;
  decreaseRadius: () => void;
  restoreDeletedHexes: () => void;
  exportToJSON: () => void;
  importFromJSON: (file: File, onViewReset?: () => void) => void;
  applyTerrain: (terrain: TerrainType) => void;
  setTerrainTypes: React.Dispatch<React.SetStateAction<TerrainType[]>>;
  terrainTypes: TerrainType[];
  unitTypes: UnitType[];
}

const DEFAULT_TERRAIN_TYPES: TerrainType[] = [
  { id: 'field',     name: 'Поле',         color: '#4CAF50',    height:  0    },
  { id: 'hills',     name: 'Холмы',        color: '#F9A825',    height:  0.5  },
  { id: 'forest',    name: 'Лес',          color: '#33691E',    height:  0.2  },
  { id: 'swamp',     name: 'Болота',       color: '#1B5E20',    height: -0.2  },
  { id: 'buildings', name: 'Здания',       color: '#424242',    height:  0.3  },
  { id: 'void',      name: 'Пустота',      color: '#808080',    height:  0    },
  { id: 'water',     name: 'Водоём',       color: '#2196F3',    height: -0.3  },
  { id: 'empty',     name: 'Пустая клетка', color: 'transparent', height: 0, isEmpty: true },
]

const DEFAULT_UNIT_TYPES: UnitType[] = [
  { id: 'infantry',   name: 'Пехотинец',       icon: '👤',    color: '#795548' },
  { id: 'sailor',     name: 'Матрос',           icon: '⚓',    color: '#0D47A1' },
  { id: 'guerrilla',  name: 'Партизан',         icon: '🔫',    color: '#006064' },
  { id: 'cavalry',    name: 'Кавалерист',       icon: '🐎',    color: '#FF9800' },
  { id: 'cossack',    name: 'Казак',            icon: '🏇',    color: '#BF360C' },
  { id: 'machinegun', name: 'Пулемётчик',       icon: '🔫',    color: '#8D6E63' },
  { id: 'tachankagun',name: 'Тачанка',          icon: '🔫+🐎', color: '#FFA000' },
  { id: 'sniper',     name: 'Снайпер',          icon: '⌖',    color: '#263238' },
  { id: 'cannon',     name: 'Пушка',            icon: '💣',    color: '#5D4037' },
  { id: 'howitzer',   name: 'Гаубица',          icon: '💥',    color: '#3E2723' },
  { id: 'armoredcar', name: 'Бронеавтомобиль',  icon: '🚙',    color: '#616161' },
  { id: 'tank',       name: 'Танк',             icon: '🔘',    color: '#212121' },
]

export function useHexMap(): UseHexMapReturn {
  const [hexMap, setHexMap] = useState<HexData[]>([])
  const [mapRadius, setMapRadius] = useState(5)
  const hexCount = useMemo(() => hexMap.filter(h => h.terrainType !== 'empty').length, [hexMap])
  const [maxPlayerUnits, setMaxPlayerUnits] = useState(8)
  const [deletedHexes, setDeletedHexes] = useState<HexData[]>([])
  const [showSizeInput, setShowSizeInput] = useState(true)
  const [terrainTypes, setTerrainTypes] = useState<TerrainType[]>(DEFAULT_TERRAIN_TYPES)
  const unitTypes = DEFAULT_UNIT_TYPES

  const fieldTerrain = () => terrainTypes.find(t => t.id === 'field') || terrainTypes[0]

  const resizeMap = useCallback(
    (newRadius: number) => {
      const safeRadius = Math.min(newRadius, 15)
      if (safeRadius !== newRadius) setMapRadius(safeRadius)
      const r = safeRadius

      const currentHexes: Record<string, HexData> = {}
      hexMap.forEach(hex => { currentHexes[hexKey(hex.q, hex.r, hex.s)] = hex })

      const ft = terrainTypes.find(t => t.id === 'field') || terrainTypes[0]
      setTimeout(() => {
        const newMap: HexData[] = generateHexCoords(r).map(({ q, r: rv, s }) => {
          const existing = currentHexes[hexKey(q, rv, s)]
          return existing ?? { q, r: rv, s, terrainType: ft.id, color: ft.color, height: ft.height }
        })
        setHexMap(newMap)
        setMapRadius(r)
      }, 0)
    },
    [hexMap, terrainTypes]
  )

  const initializeMap = useCallback(
    (onViewReset?: () => void) => {
      if (hexMap.length > 0) {
        resizeMap(mapRadius)
        return
      }
      const safeRadius = Math.min(mapRadius, 15)
      if (safeRadius !== mapRadius) setMapRadius(safeRadius)

      const ft = fieldTerrain()
      const newMap: HexData[] = generateHexCoords(safeRadius).map(({ q, r, s }) => ({
        q, r, s,
        terrainType: ft.id,
        color: ft.color,
        height: ft.height,
      }))

      setHexMap(newMap)
      setShowSizeInput(false)
      onViewReset?.()
    },
    [hexMap.length, mapRadius, resizeMap]
  )

  const increaseRadius = useCallback(() => {
    if (mapRadius >= 15) return
    resizeMap(mapRadius + 1)
  }, [mapRadius, resizeMap])

  const decreaseRadius = useCallback(() => {
    if (mapRadius <= 1) return
    resizeMap(mapRadius - 1)
  }, [mapRadius, resizeMap])

  const restoreDeletedHexes = useCallback(() => {
    if (deletedHexes.length === 0) {
      alert('Нет удаленных гексов для восстановления.')
      return
    }
    let updatedMap = [...hexMap]
    let restoredCount = 0
    deletedHexes.forEach(deleted => {
      const idx = updatedMap.findIndex(h => h.q === deleted.q && h.r === deleted.r)
      if (idx !== -1) {
        updatedMap[idx] = deleted
        restoredCount++
      }
    })
    setHexMap(updatedMap)
    setDeletedHexes([])
    alert(`Восстановлено ${restoredCount} гексов.`)
  }, [hexMap, deletedHexes])

  const exportToJSON = useCallback(() => {
    exportMapToJSON(hexMap, mapRadius, maxPlayerUnits)
  }, [hexMap, mapRadius, maxPlayerUnits])

  const importFromJSON = useCallback(
    (file: File, onViewReset?: () => void) => {
      importMapFromJSON(file, (data) => {
        // Resolve color/height from terrainTypes and icon/color from unitTypes
        const resolvedMap: HexData[] = data.hexMap.map(hex => {
          const terrain = terrainTypes.find(t => t.id === hex.terrainType) ?? terrainTypes.find(t => t.id === 'field') ?? terrainTypes[0]
          const resolved: HexData = { ...hex, color: terrain.color, height: terrain.height }
          if (hex.unit?.type) {
            const unitDef = unitTypes.find(u => u.id === hex.unit!.type)
            resolved.unit = unitDef
              ? { type: unitDef.id, icon: unitDef.icon, color: unitDef.color }
              : hex.unit
          }
          return resolved
        })
        setHexMap(resolvedMap)
        setMapRadius(data.mapRadius)
        if (data.maxPlayerUnits !== undefined) setMaxPlayerUnits(data.maxPlayerUnits)
        setShowSizeInput(false)
        onViewReset?.()
      })
    },
    [terrainTypes, unitTypes]
  )

  const applyTerrain = useCallback(
    (_terrain: TerrainType) => {
      // placeholder — actual brush logic lives in index.tsx per-hex click
    },
    []
  )

  return {
    hexMap, setHexMap,
    mapRadius,
    hexCount,
    maxPlayerUnits, setMaxPlayerUnits,
    deletedHexes, setDeletedHexes,
    showSizeInput, setShowSizeInput,
    initializeMap,
    resizeMap,
    increaseRadius,
    decreaseRadius,
    restoreDeletedHexes,
    exportToJSON,
    importFromJSON,
    applyTerrain,
    terrainTypes, setTerrainTypes,
    unitTypes,
  }
}
