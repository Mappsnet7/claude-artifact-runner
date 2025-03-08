import { TerrainType } from './types';
import { createTexture } from './utils/textureUtils';

// Terrain type definitions
export const terrainTypes: TerrainType[] = [
  { id: 'field', name: 'Поле', color: '#4CAF50', baseHeight: 0.3, texture: createTexture('field') },
  { id: 'swamp', name: 'Болото', color: '#1B5E20', baseHeight: 0.15, texture: createTexture('swamp') },
  { id: 'highland', name: 'Возвышенность', color: '#F9A825', baseHeight: 0.6, texture: createTexture('highland') },
  { id: 'water', name: 'Вода', color: '#1976D2', baseHeight: 0.05, texture: createTexture('water') },
  { id: 'forest', name: 'Лес', color: '#33691E', baseHeight: 0.4, texture: createTexture('forest') },
  { id: 'asphalt', name: 'Асфальт', color: '#424242', baseHeight: 0.2, texture: createTexture('asphalt') }
];

// Height levels from 0 to 10
export const heightLevels: number[] = Array.from({ length: 11 }, (_, i) => i);

// Default map size
export const DEFAULT_MAP_SIZE = { width: 32, height: 32 };

// Default generation parameters
export const DEFAULT_GENERATION_PARAMS = {
  terrainScale: 6,
  mountainsLevel: 5,
  waterLevel: 3,
  randomSeed: Math.floor(Math.random() * 10000)
};

// Default cell size
export const DEFAULT_CELL_SIZE = 8;

// Default brush size
export const DEFAULT_BRUSH_SIZE = 1;