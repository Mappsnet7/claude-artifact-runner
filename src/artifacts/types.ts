// Basic type definitions for the map editor

// Map dimensions
export interface MapSize {
    width: number;
    height: number;
  }
  
  // Single map cell data
  export interface Cell {
    type: string;
    height: number;
  }
  
  // Terrain type definition
  export interface TerrainType {
    id: string;
    name: string;
    color: string;
    baseHeight: number;
    texture: string;
  }
  
  // Parameters for procedural generation
  export interface GenerationParams {
    terrainScale: number;    // Scale of the landscape - smaller value = larger details
    mountainsLevel: number;  // Mountain level - higher value = more steep mountains
    waterLevel: number;      // Water level - higher value = more water/lakes
    randomSeed: number;      // Seed for reproducibility
  }
  
  // Position for tooltips
  export interface TooltipPosition {
    x: number;
    y: number;
  }
  
  // Noise map generation parameters
  export interface NoiseParams {
    width: number;
    height: number;
    scale: number;
    octaves: number;
    persistence: number;
    lacunarity: number;
    seed: number;
  }
  
  // Direction for river flow
  export interface Direction {
    dx: number;
    dy: number;
  }