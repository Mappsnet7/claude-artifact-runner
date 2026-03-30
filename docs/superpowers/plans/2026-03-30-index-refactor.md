# index.tsx Refactor — Split Monolith into Modules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `src/artifacts/index.tsx` (1780 lines) into focused modules so each file is readable in full and edits stay local.

**Architecture:** Extract pure hex math into `hexUtils.ts`, shared types into `types.ts`, Three.js logic into `use3DPreview.ts`, and map state/operations into `useHexMap.ts`. `index.tsx` keeps only UI state, SVG rendering, and mouse handlers.

**Tech Stack:** React 18, TypeScript, Three.js, Vite. Verification via `npx tsc --noEmit` after every task.

---

## Task 1: Create `types.ts`

**Files:**
- Create: `src/artifacts/types.ts`

- [ ] **Step 1: Create the file**

```ts
// src/artifacts/types.ts

export type Point = { x: number; y: number };

export type UnitData = { type: string; icon: string; color: string };

export type HexData = {
  q: number;
  r: number;
  s: number;
  terrainType: string;
  color: string;
  height: number;
  unit?: UnitData;
};

export type TerrainType = {
  id: string;
  name: string;
  color: string;
  height: number;
  pattern?: any;
  isEmpty?: boolean;
};

export type UnitType = { id: string; name: string; icon: string; color: string };

export type EditMode = 'terrain' | 'units' | 'manage';

export type ViewTransform = { scale: number; x: number; y: number };
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no output (zero errors)

- [ ] **Step 3: Commit**

```bash
git add src/artifacts/types.ts
git commit -m "refactor: add shared types.ts"
```

---

## Task 2: Create `hexUtils.ts`

**Files:**
- Create: `src/artifacts/hexUtils.ts`

- [ ] **Step 1: Create the file**

```ts
// src/artifacts/hexUtils.ts
import type { Point, HexData } from './types';

const HEX_SIZE = 20;

export function getHexPosition(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_SIZE * (1.5 * q),
    y: HEX_SIZE * Math.sqrt(3) * (r + q / 2),
  };
}

export function generateHexCoords(radius: number): { q: number; r: number; s: number }[] {
  const coords: { q: number; r: number; s: number }[] = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      coords.push({ q, r, s: -q - r });
    }
  }
  return coords;
}

export function hexKey(q: number, r: number, s: number): string {
  return `${q},${r},${s}`;
}

export function calculateSvgDimensions(hexes: HexData[]): {
  width: number;
  height: number;
  viewBox: string;
} {
  let maxX = 0, maxY = 0, minX = 0, minY = 0;
  hexes.forEach(hex => {
    const { x, y } = getHexPosition(hex.q, hex.r);
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const px = x + HEX_SIZE * Math.cos(angle);
      const py = y + HEX_SIZE * Math.sin(angle);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
    }
  });
  const padding = 40;
  return {
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
    viewBox: `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`,
  };
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/artifacts/hexUtils.ts
git commit -m "refactor: add hexUtils.ts with pure hex math"
```

---

## Task 3: Update `terrainGenerator.ts`

Remove the local `HexData` and `TerrainType` type declarations and import them from `types.ts` instead.

**Files:**
- Modify: `src/artifacts/terrainGenerator.ts`

- [ ] **Step 1: Replace local type declarations with imports**

At the top of `src/artifacts/terrainGenerator.ts`, replace:

```ts
import { createNoise2D } from 'simplex-noise';
import seedrandom from 'seedrandom';

// Определяем типы для хекса и типы ландшафта
export type HexData = {
  q: number;
  r: number;
  s: number;
  terrainType: string;
  color: string;
  height: number;
  unit?: { type: string; icon: string; color: string };
};

export type TerrainType = {
  id: string;
  name: string;
  color: string;
  height: number;
  pattern?: any;
  isEmpty?: boolean;
};
```

with:

```ts
import { createNoise2D } from 'simplex-noise';
import seedrandom from 'seedrandom';
import type { HexData, TerrainType } from './types';
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/artifacts/terrainGenerator.ts
git commit -m "refactor: terrainGenerator imports types from types.ts"
```

---

## Task 4: Create `useHexMap.ts`

Extract all map state and operations from `index.tsx`. This hook owns `hexMap`, `mapRadius`, `hexCount`, `maxPlayerUnits`, `deletedHexes`, `showSizeInput`, and all map operations.

Note: `initializeMap` and `importFromJSON` currently reset `viewTransform` (which is UI state). They accept an `onViewReset` callback so `index.tsx` can hook in.

**Files:**
- Create: `src/artifacts/useHexMap.ts`

- [ ] **Step 1: Create the file**

```ts
// src/artifacts/useHexMap.ts
import { useState, useCallback } from 'react';
import type { HexData, TerrainType, UnitType } from './types';
import { generateHexCoords, hexKey } from './hexUtils';

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
  importFromJSON: (
    event: React.ChangeEvent<HTMLInputElement>,
    onViewReset?: () => void
  ) => void;
  handleGeneratedTerrain: (newHexMap: HexData[], newHexCount: number) => void;
}

export function useHexMap(
  terrainTypes: TerrainType[],
  unitTypes: UnitType[]
): UseHexMapReturn {
  const [hexMap, setHexMap] = useState<HexData[]>([]);
  const [mapRadius, setMapRadius] = useState(5);
  const [hexCount, setHexCount] = useState(0);
  const [maxPlayerUnits, setMaxPlayerUnits] = useState(8);
  const [deletedHexes, setDeletedHexes] = useState<HexData[]>([]);
  const [showSizeInput, setShowSizeInput] = useState(true);

  const fieldTerrain = () => terrainTypes.find(t => t.id === 'field') || terrainTypes[0];

  const resizeMap = useCallback(
    (newRadius: number) => {
      const safeRadius = Math.min(newRadius, 15);
      if (safeRadius !== newRadius) setMapRadius(safeRadius);
      const r = safeRadius;

      const currentHexes: Record<string, HexData> = {};
      hexMap.forEach(hex => { currentHexes[hexKey(hex.q, hex.r, hex.s)] = hex; });

      const ft = fieldTerrain();
      setTimeout(() => {
        const newMap: HexData[] = generateHexCoords(r).map(({ q, r: rv, s }) => {
          const existing = currentHexes[hexKey(q, rv, s)];
          return existing ?? { q, r: rv, s, terrainType: ft.id, color: ft.color, height: ft.height };
        });
        setHexMap(newMap);
        setHexCount(newMap.filter(h => h.terrainType !== 'empty').length);
        setMapRadius(r);
      }, 0);
    },
    [hexMap, terrainTypes]
  );

  const initializeMap = useCallback(
    (onViewReset?: () => void) => {
      if (hexMap.length > 0) {
        resizeMap(mapRadius);
        return;
      }
      const safeRadius = Math.min(mapRadius, 15);
      if (safeRadius !== mapRadius) setMapRadius(safeRadius);

      const ft = fieldTerrain();
      const newMap: HexData[] = generateHexCoords(safeRadius).map(({ q, r, s }) => ({
        q, r, s,
        terrainType: ft.id,
        color: ft.color,
        height: ft.height,
      }));

      setHexMap(newMap);
      setHexCount(newMap.length);
      setShowSizeInput(false);
      onViewReset?.();
    },
    [hexMap.length, mapRadius, resizeMap]
  );

  const increaseRadius = useCallback(() => {
    if (mapRadius >= 15) return;
    resizeMap(mapRadius + 1);
  }, [mapRadius, resizeMap]);

  const decreaseRadius = useCallback(() => {
    if (mapRadius <= 1) return;
    resizeMap(mapRadius - 1);
  }, [mapRadius, resizeMap]);

  const restoreDeletedHexes = useCallback(() => {
    if (deletedHexes.length === 0) {
      alert('Нет удаленных гексов для восстановления.');
      return;
    }
    let updatedMap = [...hexMap];
    let restoredCount = 0;
    deletedHexes.forEach(deleted => {
      const idx = updatedMap.findIndex(
        h => h.q === deleted.q && h.r === deleted.r && h.s === deleted.s
      );
      if (idx !== -1 && updatedMap[idx].terrainType === 'empty') {
        updatedMap[idx] = { ...deleted };
        restoredCount++;
      }
    });
    if (restoredCount === 0) {
      alert('Не удалось восстановить гексы. Возможно, они уже были изменены или выходят за границы текущей карты.');
      return;
    }
    setHexMap(updatedMap);
    setHexCount(prev => prev + restoredCount);
    setDeletedHexes([]);
    alert(`Восстановлено ${restoredCount} гексов.`);
  }, [hexMap, deletedHexes]);

  const exportToJSON = useCallback(() => {
    const cleanedMap = hexMap.map(hex => {
      const base = { position: { q: hex.q, r: hex.r, s: hex.s }, terrainType: hex.terrainType };
      return hex.unit ? { ...base, unit: { type: hex.unit.type } } : base;
    });

    const allCoords = generateHexCoords(mapRadius);
    const emptyCoords = allCoords
      .filter(c => !hexMap.some(h => h.q === c.q && h.r === c.r && h.s === c.s))
      .map(c => ({ position: c, terrainType: 'empty' }));

    const jsonData = JSON.stringify(
      { hexes: [...cleanedMap, ...emptyCoords], mapRadius, maxPlayerUnits },
      null,
      2
    );
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonData);
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', 'hex_map.json');
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [hexMap, mapRadius, maxPlayerUnits]);

  const importFromJSON = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, onViewReset?: () => void) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const jsonData = JSON.parse(e.target?.result as string);
          if (!jsonData.hexes || !Array.isArray(jsonData.hexes) || typeof jsonData.mapRadius !== 'number') {
            throw new Error('Неверный формат файла: отсутствует hexes или mapRadius');
          }
          const radius: number = jsonData.mapRadius;
          const importedMaxPlayerUnits: number =
            typeof jsonData.maxPlayerUnits === 'number' ? jsonData.maxPlayerUnits : 8;

          const ft = terrainTypes.find(t => t.id === 'field') || terrainTypes[0];
          const fullMap: HexData[] = generateHexCoords(radius).map(({ q, r, s }) => ({
            q, r, s,
            terrainType: ft.id,
            color: ft.color,
            height: ft.height,
          }));

          const hexIndex: Record<string, number> = {};
          fullMap.forEach((hex, i) => { hexIndex[hexKey(hex.q, hex.r, hex.s)] = i; });

          jsonData.hexes.forEach((hex: { position: { q: number; r: number; s: number }; terrainType: string; unit?: { type: string } }) => {
            if (hex.terrainType === 'empty') return;
            const k = hexKey(hex.position.q, hex.position.r, hex.position.s);
            const idx = hexIndex[k];
            if (idx === undefined) return;
            const ti = terrainTypes.find(t => t.id === hex.terrainType) || terrainTypes[0];
            fullMap[idx] = { ...fullMap[idx], terrainType: ti.id, color: ti.color, height: ti.height };
            if (hex.unit?.type) {
              const ui = unitTypes.find(u => u.id === hex.unit?.type) || unitTypes[0];
              fullMap[idx].unit = { type: ui.id, icon: ui.icon, color: ui.color };
            }
          });

          const visibleHexCount = fullMap.filter(h => h.terrainType !== 'empty').length;
          setMapRadius(radius);
          setHexMap(fullMap);
          setHexCount(visibleHexCount);
          setShowSizeInput(false);
          setMaxPlayerUnits(importedMaxPlayerUnits);
          onViewReset?.();
        } catch (error) {
          alert('Ошибка при загрузке файла: ' + (error as Error).message);
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    },
    [terrainTypes, unitTypes]
  );

  const handleGeneratedTerrain = useCallback(
    (newHexMap: HexData[], newHexCount: number) => {
      setHexMap(newHexMap);
      setHexCount(newHexCount);
      setShowSizeInput(false);
    },
    []
  );

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
    handleGeneratedTerrain,
  };
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/artifacts/useHexMap.ts
git commit -m "refactor: add useHexMap hook"
```

---

## Task 5: Create `use3DPreview.ts`

Extract the entire Three.js `useEffect` from `index.tsx` into a custom hook.

**Files:**
- Create: `src/artifacts/use3DPreview.ts`

- [ ] **Step 1: Create the file**

```ts
// src/artifacts/use3DPreview.ts
import { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { HexData, TerrainType } from './types';

export function use3DPreview(
  hexMap: HexData[],
  showUnits: boolean,
  mapRadius: number,
  terrainTypes: TerrainType[]
): {
  show3DPreview: boolean;
  setShow3DPreview: React.Dispatch<React.SetStateAction<boolean>>;
  containerRef: React.RefObject<HTMLDivElement>;
} {
  const [show3DPreview, setShow3DPreview] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const UNIT_SCALE = 2.0;

  useEffect(() => {
    if (!show3DPreview || !containerRef.current) return;

    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    const width = container.clientWidth;
    const height = 400;
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(5, 12, 15);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.15;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;
    controls.minDistance = 5;
    controls.maxDistance = 50;

    // Lighting
    const sunLight = new THREE.DirectionalLight(0xffffcc, 1);
    sunLight.position.set(5, 10, 7);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.bias = -0.001;
    const d = 20;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);
    const fillLight = new THREE.DirectionalLight(0xaaccff, 0.5);
    fillLight.position.set(-5, 8, -5);
    scene.add(fillLight);
    scene.add(new THREE.AmbientLight(0x555555));
    scene.add(new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5));

    // Textures
    const textures: Record<string, THREE.Texture> = {};
    const createTextureCanvas = (terrainType: string): HTMLCanvasElement => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) return canvas;
      const terrain = terrainTypes.find(t => t.id === terrainType);
      if (!terrain) return canvas;
      ctx.fillStyle = terrain.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      switch (terrainType) {
        case 'field':
          ctx.strokeStyle = '#3da142'; ctx.lineWidth = 1; ctx.beginPath();
          for (let i = 0; i < 10; i++) { const x = Math.random() * 128; const y = Math.random() * 128; ctx.moveTo(x, y); ctx.lineTo(x + 5, y - 10); }
          ctx.stroke(); break;
        case 'hills':
          ctx.strokeStyle = '#e59a14'; ctx.lineWidth = 3; ctx.beginPath();
          ctx.moveTo(0, 100); ctx.quadraticCurveTo(30, 50, 60, 100); ctx.quadraticCurveTo(90, 50, 128, 100); ctx.stroke(); break;
        case 'forest':
          ctx.fillStyle = '#2c5518';
          for (let i = 0; i < 5; i++) { const x = 20 + i * 20; ctx.fillRect(x - 2, 80, 4, 20); ctx.beginPath(); ctx.moveTo(x - 15, 80); ctx.lineTo(x, 50); ctx.lineTo(x + 15, 80); ctx.fill(); }
          break;
        case 'swamp':
          ctx.fillStyle = '#6c9e71';
          for (let i = 0; i < 20; i++) { ctx.beginPath(); ctx.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 5, 0, Math.PI * 2); ctx.fill(); }
          break;
        case 'buildings':
          ctx.fillStyle = '#555555';
          for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) ctx.fillRect(10 + i * 40, 10 + j * 40, 30, 30);
          break;
        case 'water':
          ctx.strokeStyle = '#1976D2'; ctx.lineWidth = 2;
          for (let i = 0; i < 5; i++) { const y = 20 + i * 20; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(30, y - 10, 60, y + 10, 128, y - 5); ctx.stroke(); }
          break;
      }
      return canvas;
    };
    terrainTypes.forEach(t => {
      if (t.id !== 'empty') textures[t.id] = new THREE.CanvasTexture(createTextureCanvas(t.id));
    });

    // Grid and ground plane
    const gridHelper = new THREE.GridHelper(mapRadius * 4, mapRadius * 2);
    gridHelper.position.y = -0.05;
    (gridHelper.material as THREE.Material).opacity = 0.2;
    (gridHelper.material as THREE.Material).transparent = true;
    scene.add(gridHelper);

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(mapRadius * 6, mapRadius * 6),
      new THREE.MeshStandardMaterial({ color: 0x336699, metalness: 0.1, roughness: 0.8, side: THREE.DoubleSide })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.1;
    plane.receiveShadow = true;
    scene.add(plane);

    scene.fog = new THREE.FogExp2(0x87ceeb, 0.01);

    // Add hexes in batches to avoid blocking the UI
    const maxHexes = 500;
    const hexesToRender = hexMap.length > maxHexes ? hexMap.slice(0, maxHexes) : hexMap;
    let batchIndex = 0;
    const addNextBatch = () => {
      const end = Math.min(batchIndex + 50, hexesToRender.length);
      for (let i = batchIndex; i < end; i++) {
        const hex = hexesToRender[i];
        if (hex.terrainType === 'empty') continue;

        const hexShape = new THREE.Shape();
        for (let j = 0; j < 6; j++) {
          const angle = (Math.PI / 3) * j;
          const x = Math.cos(angle), y = Math.sin(angle);
          j === 0 ? hexShape.moveTo(x, y) : hexShape.lineTo(x, y);
        }
        hexShape.closePath();

        const depth = hex.terrainType === 'void' ? 0 : (hex.height > 0 ? hex.height : 0.1);
        const geo = new THREE.ExtrudeGeometry(hexShape, { depth, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);

        const texture = textures[hex.terrainType];
        const mat = texture
          ? new THREE.MeshLambertMaterial({ map: texture, color: 0xffffff })
          : new THREE.MeshLambertMaterial({ color: hex.color });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.x = 1.5 * hex.q;
        mesh.position.z = Math.sqrt(3) * (hex.r + hex.q / 2);
        mesh.position.y = 0;
        scene.add(mesh);

        if (hex.unit && showUnits) {
          const terrainHeight = hex.height > 0 ? hex.height : 0.1;
          const unitMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3 * UNIT_SCALE, 0.3 * UNIT_SCALE, 0.4, 16),
            new THREE.MeshLambertMaterial({ color: hex.unit.color, emissive: new THREE.Color(hex.unit.color).multiplyScalar(0.2) })
          );
          unitMesh.castShadow = true;
          unitMesh.position.set(mesh.position.x, terrainHeight + 0.2, mesh.position.z);

          const platformMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35 * UNIT_SCALE, 0.35 * UNIT_SCALE, 0.05, 16),
            new THREE.MeshLambertMaterial({ color: 0x333333, emissive: 0x111111 })
          );
          platformMesh.castShadow = true;
          platformMesh.position.set(mesh.position.x, terrainHeight, mesh.position.z);

          scene.add(platformMesh);
          scene.add(unitMesh);
        }
      }
      batchIndex = end;
      if (batchIndex < hexesToRender.length) {
        setTimeout(() => requestAnimationFrame(addNextBatch), 0);
      }
    };
    requestAnimationFrame(addNextBatch);

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      camera.aspect = w / 400;
      camera.updateProjectionMatrix();
      renderer.setSize(w, 400);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (containerRef.current) {
        while (containerRef.current.firstChild) containerRef.current.removeChild(containerRef.current.firstChild);
      }
    };
  }, [show3DPreview, hexMap, mapRadius, showUnits, terrainTypes]);

  return { show3DPreview, setShow3DPreview, containerRef };
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/artifacts/use3DPreview.ts
git commit -m "refactor: add use3DPreview hook"
```

---

## Task 6: Rewrite `index.tsx`

Replace the monolith with a lean component that imports from the new modules. This is the largest task — work through it section by section.

**Files:**
- Modify: `src/artifacts/index.tsx` (replace entirely)

- [ ] **Step 1: Write the new `index.tsx`**

```tsx
// src/artifacts/index.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TerrainGeneratorPanel from './TerrainGeneratorPanel';
import {
  FaSave, FaUndo, FaTimes, FaUpload, FaCube,
  FaRuler, FaEdit, FaFile, FaEye
} from 'react-icons/fa';
import { RiMapFill, RiEarthLine } from 'react-icons/ri';
import type { HexData, TerrainType, UnitType, EditMode, ViewTransform } from './types';
import { getHexPosition, calculateSvgDimensions } from './hexUtils';
import { useHexMap } from './useHexMap';
import { use3DPreview } from './use3DPreview';

// ─── Static data ───────────────────────────────────────────────────────────────

const terrainTypes: TerrainType[] = [
  {
    id: 'field', name: 'Поле', color: '#4CAF50', height: 0,
    pattern: (
      <pattern id="fieldPattern" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="#4CAF50" />
        <path d="M0,10 L20,10 M10,0 L10,20" stroke="#3da142" strokeWidth="0.5" />
        <circle cx="10" cy="10" r="1" fill="#8bc34a" />
      </pattern>
    ),
  },
  {
    id: 'hills', name: 'Холмы', color: '#F9A825', height: 0.5,
    pattern: (
      <pattern id="hillsPattern" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="#F9A825" />
        <path d="M0,15 Q5,5 10,15 Q15,5 20,15" stroke="#e59a14" strokeWidth="1.5" fill="none" />
      </pattern>
    ),
  },
  {
    id: 'forest', name: 'Лес', color: '#33691E', height: 0.2,
    pattern: (
      <pattern id="forestPattern" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="#33691E" />
        <path d="M5,15 L8,5 L11,15 Z" fill="#2c5518" />
        <path d="M12,13 L15,5 L18,13 Z" fill="#2c5518" />
      </pattern>
    ),
  },
  {
    id: 'swamp', name: 'Болота', color: '#1B5E20', height: -0.2,
    pattern: (
      <pattern id="swampPattern" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="#1B5E20" />
        <circle cx="5" cy="5" r="1.5" fill="#6c9e71" />
        <circle cx="15" cy="5" r="1" fill="#6c9e71" />
        <circle cx="10" cy="10" r="2" fill="#6c9e71" />
        <circle cx="5" cy="15" r="1" fill="#6c9e71" />
        <circle cx="15" cy="15" r="1.5" fill="#6c9e71" />
      </pattern>
    ),
  },
  {
    id: 'buildings', name: 'Здания', color: '#424242', height: 0.3,
    pattern: (
      <pattern id="buildingsPattern" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="#424242" />
        <rect x="2" y="2" width="7" height="7" fill="#555555" />
        <rect x="11" y="2" width="7" height="7" fill="#555555" />
        <rect x="2" y="11" width="7" height="7" fill="#555555" />
        <rect x="11" y="11" width="7" height="7" fill="#555555" />
      </pattern>
    ),
  },
  { id: 'void', name: 'Пустота', color: '#808080', height: 0, pattern: null },
  {
    id: 'water', name: 'Водоём', color: '#2196F3', height: -0.3,
    pattern: (
      <pattern id="waterPattern" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="#2196F3" />
        <path d="M0,5 Q5,3 10,5 Q15,7 20,5" stroke="#1976D2" strokeWidth="1" fill="none" />
        <path d="M0,10 Q5,8 10,10 Q15,12 20,10" stroke="#1976D2" strokeWidth="1" fill="none" />
        <path d="M0,15 Q5,13 10,15 Q15,17 20,15" stroke="#1976D2" strokeWidth="1" fill="none" />
      </pattern>
    ),
  },
  { id: 'empty', name: 'Пустая клетка', color: 'transparent', height: 0, isEmpty: true, pattern: null },
];

const unitTypes: UnitType[] = [
  { id: 'infantry', name: 'Пехотинец', icon: '👤', color: '#795548' },
  { id: 'sailor', name: 'Матрос', icon: '⚓', color: '#0D47A1' },
  { id: 'guerrilla', name: 'Партизан', icon: '🔫', color: '#006064' },
  { id: 'cavalry', name: 'Кавалерист', icon: '🐎', color: '#FF9800' },
  { id: 'cossack', name: 'Казак', icon: '🏇', color: '#BF360C' },
  { id: 'machinegun', name: 'Пулемётчик', icon: '🔫', color: '#8D6E63' },
  { id: 'tachankagun', name: 'Тачанка', icon: '🔫+🐎', color: '#FFA000' },
  { id: 'sniper', name: 'Снайпер', icon: '⌖', color: '#263238' },
  { id: 'cannon', name: 'Пушка', icon: '💣', color: '#5D4037' },
  { id: 'howitzer', name: 'Гаубица', icon: '💥', color: '#3E2723' },
  { id: 'armoredcar', name: 'Бронеавтомобиль', icon: '🚙', color: '#616161' },
  { id: 'tank', name: 'Танк', icon: '🔘', color: '#212121' },
];

// ─── Component ─────────────────────────────────────────────────────────────────

const HexMapEditor = () => {
  // UI state
  const [editMode, setEditMode] = useState<EditMode>('terrain');
  const [manageAction, setManageAction] = useState<'add' | 'delete'>('add');
  const [selectedTerrain, setSelectedTerrain] = useState<TerrainType>(terrainTypes[0]);
  const [selectedUnit, setSelectedUnit] = useState<UnitType | null>(null);
  const [showUnits, setShowUnits] = useState(true);
  const [showTerrainGenerator, setShowTerrainGenerator] = useState(false);

  // Pan/zoom state
  const [viewTransform, setViewTransform] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [visibleHexes, setVisibleHexes] = useState<HexData[]>([]);

  const UNIT_SCALE = 2.0;

  const svgContainer = useRef<HTMLDivElement>(null);
  const svgElement = useRef<SVGSVGElement>(null);

  const resetView = () => setViewTransform({ scale: 1, x: 0, y: 0 });

  // Hooks
  const {
    hexMap, setHexMap,
    mapRadius, hexCount,
    maxPlayerUnits, setMaxPlayerUnits,
    deletedHexes, setDeletedHexes,
    showSizeInput, setShowSizeInput,
    initializeMap, resizeMap,
    increaseRadius, decreaseRadius,
    restoreDeletedHexes,
    exportToJSON, importFromJSON,
    handleGeneratedTerrain,
  } = useHexMap(terrainTypes, unitTypes);

  const { show3DPreview, setShow3DPreview, containerRef: threeContainer } =
    use3DPreview(hexMap, showUnits, mapRadius, terrainTypes);

  // ── Viewport culling ──────────────────────────────────────────────────────
  useEffect(() => {
    if (hexMap.length < 1000) { setVisibleHexes(hexMap); return; }
    const update = () => {
      if (!svgElement.current || !svgContainer.current) return;
      const svgRect = svgContainer.current.getBoundingClientRect();
      const vb = svgElement.current.viewBox.baseVal;
      const left = vb.x - viewTransform.x / viewTransform.scale;
      const top = vb.y - viewTransform.y / viewTransform.scale;
      const w = svgRect.width / viewTransform.scale;
      const h = svgRect.height / viewTransform.scale;
      const buf = 100;
      setVisibleHexes(hexMap.filter(hex => {
        const { x, y } = getHexPosition(hex.q, hex.r);
        const sz = 20;
        return x + sz >= left - buf && x - sz <= left + w + buf &&
               y + sz >= top - buf && y - sz <= top + h + buf;
      }));
    };
    update();
    const t = setTimeout(update, 100);
    return () => clearTimeout(t);
  }, [hexMap, viewTransform]);

  // ── Global mouse/wheel events ─────────────────────────────────────────────
  useEffect(() => {
    const onMouseUp = () => { setIsDragging(false); setIsDrawing(false); };
    const onContextMenu = (e: MouseEvent) => {
      if (svgContainer.current?.contains(e.target as Node)) e.preventDefault();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const rect = svgElement.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setViewTransform(prev => {
        const next = Math.min(Math.max(prev.scale * factor, 0.2), 3);
        const ratio = next / prev.scale;
        return { scale: next, x: mx - (mx - prev.x) * ratio, y: my - (my - prev.y) * ratio };
      });
    };
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('contextmenu', onContextMenu);
    svgContainer.current?.addEventListener('wheel', onWheel, { passive: false });
    const container = svgContainer.current;
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('contextmenu', onContextMenu);
      container?.removeEventListener('wheel', onWheel);
    };
  }, []);

  // ── Hex click handler ─────────────────────────────────────────────────────
  const handleHexClick = (hex: HexData) => {
    if (editMode === 'terrain') {
      setHexMap(prev => prev.map(h =>
        h.q === hex.q && h.r === hex.r && h.s === hex.s
          ? { ...h, terrainType: selectedTerrain.id, color: selectedTerrain.color, height: selectedTerrain.height }
          : h
      ));
    } else if (editMode === 'units') {
      if (hex.terrainType === 'empty') return;
      setHexMap(prev => prev.map(h => {
        if (h.q !== hex.q || h.r !== hex.r || h.s !== hex.s) return h;
        if (selectedUnit) return { ...h, unit: { type: selectedUnit.id, icon: selectedUnit.icon, color: selectedUnit.color } };
        const { unit: _u, ...rest } = h;
        return rest;
      }));
    } else if (editMode === 'manage') {
      if (manageAction === 'add' && hex.terrainType === 'empty') {
        setHexMap(prev => prev.map(h =>
          h.q === hex.q && h.r === hex.r && h.s === hex.s
            ? { ...h, terrainType: selectedTerrain.id, color: selectedTerrain.color, height: selectedTerrain.height }
            : h
        ));
      } else if (manageAction === 'delete' && hex.terrainType !== 'empty') {
        const emptyT = terrainTypes.find(t => t.id === 'empty')!;
        setDeletedHexes(prev => [...prev, { ...hex }]);
        setHexMap(prev => prev.map(h =>
          h.q === hex.q && h.r === hex.r && h.s === hex.s
            ? { ...h, terrainType: emptyT.id, color: emptyT.color, height: emptyT.height, unit: undefined }
            : h
        ));
      }
    }
  };

  // ── Unit click handler ────────────────────────────────────────────────────
  const handleUnitClick = (hex: HexData, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editMode === 'units' && selectedUnit === null) {
      setHexMap(prev => prev.map(h => {
        if (h.q !== hex.q || h.r !== hex.r || h.s !== hex.s) return h;
        const { unit: _u, ...rest } = h;
        return rest;
      }));
    }
  };

  // ── Pan handlers ──────────────────────────────────────────────────────────
  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  }, []);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setViewTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, viewTransform]);

  const handleSvgMouseUp = useCallback(() => setIsDragging(false), []);

  const handleMouseDown = (hex: HexData, e: React.MouseEvent) => {
    if (e.button === 0) { setIsDrawing(true); handleHexClick(hex); e.stopPropagation(); }
  };
  const handleMouseUp = () => setIsDrawing(false);
  const handleMouseEnter = (hex: HexData) => { if (isDrawing) handleHexClick(hex); };

  // ── SVG rendering ─────────────────────────────────────────────────────────
  const svgDimensions = hexMap.length > 0
    ? calculateSvgDimensions(hexMap)
    : { width: 100, height: 100, viewBox: '0 0 100 100' };

  const renderHexSVG = (hex: HexData) => {
    const { x, y } = getHexPosition(hex.q, hex.r);
    const size = 20;
    const points = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i;
      return `${x + size * Math.cos(a)},${y + size * Math.sin(a)}`;
    }).join(' ');

    const terrainInfo = terrainTypes.find(t => t.id === hex.terrainType);
    const fillValue = terrainInfo?.pattern ? `url(#${hex.terrainType}Pattern)` : hex.color;
    const cursorStyle = editMode === 'manage' && manageAction === 'delete' ? 'not-allowed' : 'pointer';

    return (
      <polygon
        key={`hex-${hex.q},${hex.r},${hex.s}`}
        points={points}
        fill={fillValue}
        stroke="#333"
        strokeWidth="1"
        style={{ cursor: cursorStyle }}
        onMouseDown={e => {
          if (editMode === 'manage' && manageAction === 'delete') { handleHexClick(hex); e.stopPropagation(); }
          else handleMouseDown(hex, e);
        }}
        onMouseEnter={() => handleMouseEnter(hex)}
      />
    );
  };

  const renderUnitSVG = (hex: HexData) => {
    if (!hex.unit || !showUnits) return null;
    const { x, y } = getHexPosition(hex.q, hex.r);
    const size = 20;
    return (
      <g key={`unit-${hex.q},${hex.r},${hex.s}`}>
        <circle
          cx={x} cy={y} r={size * UNIT_SCALE / 2}
          fill={hex.unit.color} stroke="#000" strokeWidth="1"
          style={{ cursor: editMode === 'units' && selectedUnit === null ? 'not-allowed' : 'pointer', userSelect: 'none', pointerEvents: 'all' }}
          onClick={e => handleUnitClick(hex, e)}
        />
        <text
          x={x} y={y} textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize={size * UNIT_SCALE / 2} fontWeight="bold"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {hex.unit.icon}
        </text>
      </g>
    );
  };

  const renderPotentialHexes = () => {
    if (editMode !== 'manage' || manageAction !== 'add') return null;
    return hexMap.filter(h => h.terrainType === 'empty').map(hex => {
      const { x, y } = getHexPosition(hex.q, hex.r);
      const size = 20;
      const points = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i;
        return `${x + size * Math.cos(a)},${y + size * Math.sin(a)}`;
      }).join(' ');
      return (
        <g key={`potential-${hex.q},${hex.r},${hex.s}`}>
          <defs>
            <pattern
              id={`potentialHexPattern-${hex.q}-${hex.r}-${hex.s}`}
              patternUnits="userSpaceOnUse" width="10" height="10"
            >
              <rect width="10" height="10" fill="white" fillOpacity="0.1" />
              <path d="M0,0 L10,10 M-5,5 L5,-5 M5,15 L15,5" stroke="#aaa" strokeWidth="1" />
            </pattern>
          </defs>
          <polygon
            points={points}
            fill={`url(#potentialHexPattern-${hex.q}-${hex.r}-${hex.s})`}
            stroke="#aaa" strokeWidth="1" strokeDasharray="4,2"
            style={{ cursor: 'crosshair' }}
            onClick={() => handleHexClick(hex)}
          />
        </g>
      );
    });
  };

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4 bg-gray-800 rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-4 text-white flex items-center">
        <RiMapFill className="mr-2 text-yellow-400" />
        Редактор Гексагональных Карт
      </h1>

      {showSizeInput ? (
        <div className="mb-6 p-6 bg-white rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-xl font-semibold mb-4">
            {hexMap.length > 0 ? 'Изменение размера карты' : 'Определите размер карты'}
          </h2>
          <div className="flex flex-col space-y-4">
            <div className="flex items-center">
              <label className="w-32 text-gray-700">Радиус карты:</label>
              <input type="number" value={mapRadius}
                onChange={e => { const v = parseInt(e.target.value) || 1; resizeMap(v); }}
                className="border rounded px-3 py-2 w-24 text-center" min="1" max="20" />
            </div>
            <div className="flex items-center">
              <label className="w-32 text-gray-700">Макс. шашек игрока:</label>
              <input type="number" value={maxPlayerUnits}
                onChange={e => setMaxPlayerUnits(parseInt(e.target.value) || 0)}
                className="border rounded px-3 py-2 w-24 text-center" min="0" />
            </div>
            <div className="text-sm text-gray-600 ml-32">
              Примерное количество гексов: {3 * mapRadius * (mapRadius + 1) + 1}
            </div>
            <div className="flex gap-2">
              <button onClick={() => initializeMap(resetView)}
                className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                {hexMap.length > 0 ? 'Изменить размер' : 'Создать пустую карту'}
              </button>
              <button onClick={() => setShowTerrainGenerator(true)}
                className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                Сгенерировать ландшафт
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <div className="mb-4 p-4 bg-white rounded-lg shadow-md">
            <div className="flex flex-col space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Режим редактирования</h2>
                <div className="flex items-center space-x-2">
                  <label className="text-gray-700 mr-4">
                    <input type="checkbox" checked={showUnits} onChange={() => setShowUnits(v => !v)} className="mr-1" />
                    Показать юниты
                  </label>
                  <label className="text-gray-700 mr-2">Макс. шашек игрока:</label>
                  <input type="number" value={maxPlayerUnits}
                    onChange={e => setMaxPlayerUnits(parseInt(e.target.value) || 0)}
                    className="border rounded px-2 py-1 w-16 text-center mr-4" min="0" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEditMode('terrain')}
                  className={`px-3 py-2 rounded-md ${editMode === 'terrain' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  Редактор местности
                </button>
                <button onClick={() => setEditMode('units')}
                  className={`px-3 py-2 rounded-md ${editMode === 'units' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  Расстановка шашек
                </button>
                <button onClick={() => setEditMode('manage')}
                  className={`px-3 py-2 rounded-md ${editMode === 'manage' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  Управление гексами
                </button>
              </div>

              {editMode === 'terrain' ? (
                <div className="flex flex-wrap gap-2">
                  {terrainTypes.filter(t => t.id !== 'empty').map(terrain => (
                    <button key={terrain.id} onClick={() => setSelectedTerrain(terrain)}
                      className={`px-3 py-2 rounded-md text-white shadow ${selectedTerrain.id === terrain.id ? 'ring-2 ring-black' : ''}`}
                      style={{ backgroundColor: terrain.color }}>
                      {terrain.name}
                    </button>
                  ))}
                </div>
              ) : editMode === 'units' ? (
                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button onClick={() => setSelectedUnit(null)}
                      className={`px-3 py-2 rounded-md bg-red-500 text-white shadow ${selectedUnit === null ? 'ring-2 ring-black' : ''}`}>
                      Удалить юнит
                    </button>
                    {unitTypes.map(unit => (
                      <button key={unit.id} onClick={() => setSelectedUnit(unit)}
                        className={`px-3 py-2 rounded-md text-white shadow ${selectedUnit?.id === unit.id ? 'ring-2 ring-black' : ''}`}
                        style={{ backgroundColor: unit.color }}>
                        {unit.icon} {unit.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600">Выберите тип юнита и кликните по гексу для его размещения. Выберите &quot;Удалить юнит&quot; для удаления юнита с гекса.</p>
                </div>
              ) : editMode === 'manage' ? (
                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button onClick={() => setManageAction('add')}
                      className={`px-3 py-2 rounded-md bg-green-500 text-white shadow ${manageAction === 'add' ? 'ring-2 ring-black' : ''}`}>
                      Добавить гексы
                    </button>
                    <button onClick={() => setManageAction('delete')}
                      className={`px-3 py-2 rounded-md bg-red-500 text-white shadow ${manageAction === 'delete' ? 'ring-2 ring-black' : ''}`}>
                      Удалить гексы
                    </button>
                  </div>
                  {manageAction === 'add' && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Кликните по полупрозрачным контурам, чтобы добавить гексы с выбранным типом местности:</p>
                      <div className="flex flex-wrap gap-2">
                        {terrainTypes.filter(t => t.id !== 'empty').map(terrain => (
                          <button key={terrain.id} onClick={() => setSelectedTerrain(terrain)}
                            className={`px-3 py-2 rounded-md text-white shadow ${selectedTerrain.id === terrain.id ? 'ring-2 ring-black' : ''}`}
                            style={{ backgroundColor: terrain.color }}>
                            {terrain.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {manageAction === 'delete' && (
                    <p className="text-sm text-gray-600">Кликните по существующему гексу, чтобы удалить его с карты.</p>
                  )}
                </div>
              ) : null}

              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  <button onClick={increaseRadius} className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded">+ Радиус</button>
                  <button onClick={decreaseRadius} className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded" disabled={mapRadius <= 1}>- Радиус</button>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm text-gray-600">Радиус карты: {mapRadius}</span>
                  <span className="text-sm text-gray-600">Макс. шашек игрока: {maxPlayerUnits}</span>
                  <span className="text-sm text-gray-600">Количество гексов: {hexCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 p-4 bg-white rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold">Редактор карты</h2>
                <div className="flex gap-2">
                  <button onClick={resetView} className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm">Сбросить вид</button>
                  <span className="text-sm text-gray-500">Масштаб: {Math.round(viewTransform.scale * 100)}%</span>
                </div>
              </div>
              <div
                ref={svgContainer}
                className="relative overflow-hidden"
                style={{ height: '70vh', cursor: isDragging ? 'grabbing' : editMode === 'manage' ? (manageAction === 'add' ? 'crosshair' : 'not-allowed') : 'grab' }}
                onMouseDown={handleSvgMouseDown}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={handleSvgMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <svg
                  ref={svgElement}
                  width="100%" height="100%"
                  className="border"
                  viewBox={svgDimensions.viewBox}
                  style={{ transform: `scale(${viewTransform.scale}) translate(${viewTransform.x}px, ${viewTransform.y}px)`, transformOrigin: '0 0' }}
                >
                  <defs>
                    {terrainTypes.filter(t => t.pattern).map(t => (
                      <React.Fragment key={t.id}>{t.pattern}</React.Fragment>
                    ))}
                  </defs>
                  {editMode === 'manage' && manageAction === 'add' && renderPotentialHexes()}
                  <g>{visibleHexes.map(renderHexSVG)}</g>
                  <g style={{ pointerEvents: 'all' }}>{visibleHexes.map(renderUnitSVG)}</g>
                </svg>
                <div className="absolute bottom-2 right-2 bg-white bg-opacity-75 p-2 rounded text-xs">
                  <p>Колесико мыши: масштаб</p>
                  <p>Правая кнопка мыши: перемещение</p>
                  <p>Левая кнопка мыши: {editMode === 'manage' ? (manageAction === 'add' ? 'добавление гексов' : 'удаление гексов') : 'рисование'}</p>
                </div>
              </div>
            </div>

            {show3DPreview && (
              <div className="lg:w-1/2 p-4 bg-white rounded-lg shadow-md">
                <h2 className="text-lg font-semibold mb-2">3D Предпросмотр</h2>
                <div ref={threeContainer} style={{ height: '400px', width: '100%' }} />
                <div className="mt-2 text-sm text-gray-600">
                  <p>Управление: вращение — левая кнопка мыши, перемещение — правая кнопка мыши, масштаб — колесико</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-gray-700 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-600 p-3 rounded-lg shadow-inner">
                <h3 className="text-white text-sm mb-2 font-semibold flex items-center">
                  <FaFile className="mr-2" /> Работа с файлами
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <label className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center cursor-pointer transition-all duration-200 transform hover:scale-105">
                    <FaUpload className="mr-2" /> Загрузить карту
                    <input type="file" accept=".json" className="hidden" onChange={e => importFromJSON(e, resetView)} />
                  </label>
                  <button onClick={exportToJSON}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 transform hover:scale-105">
                    <FaSave className="mr-2" /> Экспорт в JSON
                  </button>
                </div>
              </div>

              <div className="bg-gray-600 p-3 rounded-lg shadow-inner">
                <h3 className="text-white text-sm mb-2 font-semibold flex items-center">
                  <FaEye className="mr-2" /> Просмотр и генерация
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShow3DPreview(v => !v)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 transform hover:scale-105">
                    <FaCube className="mr-2" /> {show3DPreview ? 'Скрыть 3D' : 'Показать 3D'}
                  </button>
                  <button onClick={() => setShowTerrainGenerator(v => !v)}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 transform hover:scale-105">
                    <RiEarthLine className="mr-2" /> Генератор ландшафта
                  </button>
                </div>
              </div>

              <div className="bg-gray-700 p-3 rounded-lg shadow-inner">
                <h3 className="text-white text-sm mb-2 font-semibold flex items-center">
                  <FaEdit className="mr-2" /> Изменение карты
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setShowSizeInput(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 transform hover:scale-105">
                    <FaRuler className="mr-2" /> Изменить размер
                  </button>
                  <button onClick={restoreDeletedHexes}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 transform hover:scale-105">
                    <FaUndo className="mr-2" /> Восстановить гексы
                  </button>
                  <button onClick={() => { setHexMap([]); setShowSizeInput(true); }}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center col-span-2 transform hover:scale-105">
                    <FaTimes className="mr-2" /> Начать заново
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTerrainGenerator && (
        <TerrainGeneratorPanel
          terrainTypes={terrainTypes}
          onGenerateTerrain={handleGeneratedTerrain}
          radius={mapRadius}
        />
      )}
    </div>
  );
};

export default HexMapEditor;
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no output. Fix any TS errors before proceeding.

- [ ] **Step 3: Check app in browser**

With the Vite dev server running at http://localhost:5173, verify:
- Map creation screen appears
- Creating a map works (click "Создать пустую карту")
- Painting terrain works (click hexes)
- Placing units works
- +Радиус / -Радиус buttons work
- Export to JSON works
- Load JSON works
- 3D preview opens

- [ ] **Step 4: Commit**

```bash
git add src/artifacts/index.tsx
git commit -m "refactor: rewrite index.tsx using modular hooks"
```

---

## Task 7: Cleanup

Remove the empty `HexMapEditor.tsx` file.

**Files:**
- Delete: `src/artifacts/HexMapEditor.tsx`

- [ ] **Step 1: Delete the empty file**

```bash
git rm src/artifacts/HexMapEditor.tsx
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no output

- [ ] **Step 3: Final browser smoke test**

Repeat the browser checks from Task 6 Step 3.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor: delete empty HexMapEditor.tsx"
```

---

## Summary

After all tasks, `src/artifacts/` contains:

| File | Responsibility |
|------|---------------|
| `types.ts` | All shared TypeScript types |
| `hexUtils.ts` | Pure hex math — position, vertices, coord generation |
| `useHexMap.ts` | Map state + all map operations |
| `use3DPreview.ts` | Three.js 3D preview lifecycle |
| `index.tsx` | UI state, SVG rendering, mouse handlers |
| `TerrainGeneratorPanel.tsx` | Terrain gen UI (unchanged) |
| `terrainGenerator.ts` | Terrain gen logic (unchanged except type imports) |
