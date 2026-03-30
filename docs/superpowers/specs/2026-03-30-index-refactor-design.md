# Design: index.tsx Refactor — Split Monolith into Modules

**Date:** 2026-03-30
**Status:** Approved

## Problem

`src/artifacts/index.tsx` is ~1780 lines and contains everything: hex math, Three.js 3D preview, SVG rendering, map state management, file I/O, and all UI. Every edit requires reading hundreds of lines of unrelated context. Dead code and duplicated types accumulated over time.

## Goal

Split into focused modules so each file is readable in full and edits stay local. No new features — pure structural improvement.

---

## File Structure (after)

```
src/artifacts/
├── types.ts              # all shared types (new)
├── hexUtils.ts           # pure hex math functions (new)
├── use3DPreview.ts       # Three.js hook (new)
├── useHexMap.ts          # map state hook (new)
├── index.tsx             # UI + SVG render (~600 lines, was ~1780)
├── TerrainGeneratorPanel.tsx  # unchanged
├── terrainGenerator.ts        # unchanged, imports types from types.ts
└── HexMapEditor.tsx      # DELETE (empty file)
```

---

## Module Responsibilities

### `types.ts`
Single source of truth for all shared types. Eliminates the inline hex type repeated ~8 times in `index.tsx` and the duplicate declarations between `index.tsx` and `terrainGenerator.ts`.

```ts
export type Point = { x: number; y: number }
export type HexData = { q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: UnitData }
export type UnitData = { type: string; icon: string; color: string }
export type TerrainType = { id: string; name: string; color: string; height: number; pattern?: any; isEmpty?: boolean }
export type UnitType = { id: string; name: string; icon: string; color: string }
export type EditMode = 'terrain' | 'units' | 'manage'
export type ViewTransform = { scale: number; x: number; y: number }
```

### `hexUtils.ts`
Pure functions — no React, no state, no side effects. The loop `for q in -r..r` currently appears 4 times in `index.tsx` (initializeMap, resizeMap, exportToJSON, importFromJSON); it becomes one call to `generateHexCoords`. The inline `` `${q},${r},${s}` `` key pattern becomes `hexKey`.

```ts
export function getHexPosition(q: number, r: number): { x: number; y: number }
export function getHexVertices(q: number, r: number): Point[]
export function generateHexCoords(radius: number): { q: number; r: number; s: number }[]
export function hexKey(q: number, r: number, s: number): string
export function calculateSvgDimensions(hexes: HexData[]): { width: number; height: number; viewBox: string }
```

### `use3DPreview.ts`
Isolates the Three.js `useEffect` (~300 lines). Currently this effect sits in the middle of `index.tsx` making it hard to skip past when reading map logic.

```ts
export function use3DPreview(hexMap: HexData[], showUnits: boolean): {
  show3DPreview: boolean
  setShow3DPreview: (v: boolean) => void
  containerRef: React.RefObject<HTMLDivElement>
}
```

### `useHexMap.ts`
All map state and operations. `index.tsx` no longer owns the data layer.

```ts
export function useHexMap(): {
  hexMap: HexData[]
  setHexMap: (map: HexData[]) => void
  mapRadius: number
  hexCount: number
  maxPlayerUnits: number
  setMaxPlayerUnits: (n: number) => void
  visibleHexes: HexData[]
  deletedHexes: HexData[]
  showSizeInput: boolean
  setShowSizeInput: (v: boolean) => void
  initializeMap: () => void
  resizeMap: (newRadius: number) => void
  increaseRadius: () => void
  decreaseRadius: () => void
  restoreDeletedHexes: () => void
  exportToJSON: () => void
  importFromJSON: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleGeneratedTerrain: (hexMap: HexData[], hexCount: number) => void
}
```

### `index.tsx` (after)
Owns only UI state and rendering:
- `editMode`, `selectedTerrain`, `selectedUnit`, `manageAction`, `showUnits`, `showTerrainGenerator`
- `viewTransform`, `isDragging`, `dragStart` (pan/zoom)
- Mouse event handlers (`handleMouseDown`, `handleMouseEnter`, `handleSvgMouseMove`, etc.) — these stay here because they're tightly coupled to `editMode` and `selectedTerrain`
- `renderHexSVG`, `renderUnitSVG`, `renderPotentialHexes`
- All JSX

---

## Cleanup (done alongside refactor)

| Item | Action |
|------|--------|
| `getHexVertices` defined but never called | Remove |
| `Point` type used but not declared (river cleanup leftover) | Restore in `types.ts` |
| 3× "Эта функция не используется и была удалена" comments | Remove |
| `orientation = 'flat'` constant | Remove — flat is implicit in `hexUtils.ts` |
| Inline hex type `{q,r,s,terrainType,...}` ×8 | Replace with `HexData` |
| `HexData` / `TerrainType` duplicated between `index.tsx` and `terrainGenerator.ts` | Consolidate in `types.ts`, import in both |
| `HexMapEditor.tsx` (0 bytes) | Delete |

---

## What Does NOT Change

- All runtime behavior — this is a pure structural refactor
- `TerrainGeneratorPanel.tsx` (already well-isolated)
- `terrainGenerator.ts` — only change: replace its local `HexData`/`TerrainType` declarations with imports from `types.ts`
- The JSON save/load format
- `src/lib/jsonUtils.ts` (untouched)

---

## Approximate Line Counts (after)

| File | Est. lines |
|------|-----------|
| `types.ts` | ~30 |
| `hexUtils.ts` | ~60 |
| `use3DPreview.ts` | ~320 |
| `useHexMap.ts` | ~280 |
| `index.tsx` | ~600 |
| `terrainGenerator.ts` | ~468 (unchanged) |
| `TerrainGeneratorPanel.tsx` | ~431 (unchanged) |
