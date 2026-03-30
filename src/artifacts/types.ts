export type Point = { x: number; y: number }

export type UnitData = { type: string; icon: string; color: string }

export type HexData = {
  q: number
  r: number
  s: number
  terrainType: string
  color: string
  height: number
  unit?: UnitData
}

export type TerrainType = {
  id: string
  name: string
  color: string
  height: number
  pattern?: any
  isEmpty?: boolean
}

export type UnitType = {
  id: string
  name: string
  icon: string
  color: string
}

export type EditMode = 'terrain' | 'units' | 'manage'

export type ViewTransform = { scale: number; x: number; y: number }
