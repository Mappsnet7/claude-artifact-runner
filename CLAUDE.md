# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A pre-configured React/TypeScript/Vite environment for running Claude AI Artifacts as standalone web applications. Drop React components into `src/artifacts/` and they become routed pages automatically.

## Commands

```bash
npm run dev          # Start dev server at http://localhost:5173
npm run build        # TypeScript compile + Vite production build to dist/
npm run lint         # ESLint (zero warnings allowed)
npm run start        # Serve production build with Express on port 3000
npm run build-and-serve  # Build then serve
```

## Architecture

**Routing:** `vite-plugin-pages` auto-routes files in `src/artifacts/` — no manual route registration needed.
- `src/artifacts/index.tsx` → `/`
- `src/artifacts/Foo.tsx` → `/foo`

**Entry point:** `src/main.tsx` sets up React Router with the auto-generated routes, wrapped in `src/components/layout.tsx`.

**Production server:** `server.js` is an Express server that serves `dist/` with gzip compression, CORS headers, and SPA fallback routing (all unknown paths → `index.html`).

**UI components:** 40+ Shadcn UI components are pre-installed in `src/components/ui/`. Add new ones via `npx shadcn@latest add <component>`.

**Available libraries (no install needed):** React 18, TypeScript, Tailwind CSS, Three.js + OrbitControls, Recharts, Lucide React, React Hook Form, Zod, simplex-noise, seedrandom.

## Current Artifacts: Hexagonal Map Editor

The active project is a 3D hex map editor with procedural terrain generation:

| File | Role |
|------|------|
| `src/artifacts/index.tsx` | Main editor — Three.js 3D viewport, undo/redo, save/load |
| `src/artifacts/HexMapEditor.tsx` | 2D hex editing interface |
| `src/artifacts/TerrainGeneratorPanel.tsx` | UI panel with terrain presets and density sliders |
| `src/artifacts/terrainGenerator.ts` | Simplex-noise terrain generation (procedural, random, island, biomes modes) |
| `src/artifacts/hexUtils.ts` | Hex grid math — axial coordinates, pixel conversion, flat-top vertex calculation |
| `src/lib/jsonUtils.ts` | Map save/load serialization |

Hex grid uses **flat-top orientation** with axial coordinates. The map supports a configurable radius plus additional "middle rows" that expand the central band of the grid.
