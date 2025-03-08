import { Cell, MapSize, GenerationParams, Direction, NoiseParams } from '../types';

/**
 * Generates a noise map using a simple implementation of Perlin noise
 * @param params Noise generation parameters
 * @returns A 2D array containing noise values between 0 and 1
 */
export const generateNoise = (params: NoiseParams): number[][] => {
  const { width, height, scale, octaves, persistence, lacunarity, seed } = params;
  
  // Simple pseudo-random function with seed
  const random = (x: number, y: number, s: number): number => {
    const value = Math.sin(x * 12.9898 + y * 78.233 + s * 43.7498) * 43758.5453;
    return value - Math.floor(value);
  };
  
  // Interpolation function
  const lerp = (a: number, b: number, t: number): number => a + t * (b - a);
  
  // Smoothing function
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  
  // Create noise map
  const noiseMap: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
  
  // For each octave
  for (let octave = 0; octave < octaves; octave++) {
    // Calculate frequency and amplitude for current octave
    const frequency = Math.pow(lacunarity, octave);
    const amplitude = Math.pow(persistence, octave);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Scale coordinates
        const sX = x / scale * frequency;
        const sY = y / scale * frequency;
        
        // Determine grid cell
        const cellX = Math.floor(sX);
        const cellY = Math.floor(sY);
        
        // Calculate offset within cell
        const fracX = sX - cellX;
        const fracY = sY - cellY;
        
        // Offset coordinates for interpolation
        const smoothX = smooth(fracX);
        const smoothY = smooth(fracY);
        
        // Get noise values at cell corners
        const c00 = random(cellX, cellY, seed + octave);
        const c10 = random(cellX + 1, cellY, seed + octave);
        const c01 = random(cellX, cellY + 1, seed + octave);
        const c11 = random(cellX + 1, cellY + 1, seed + octave);
        
        // Interpolate values
        const top = lerp(c00, c10, smoothX);
        const bottom = lerp(c01, c11, smoothX);
        const value = lerp(top, bottom, smoothY);
        
        // Add noise to map
        noiseMap[y][x] += value * amplitude;
      }
    }
  }
  
  // Normalize noise values to range [0, 1]
  let min = Infinity;
  let max = -Infinity;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      min = Math.min(min, noiseMap[y][x]);
      max = Math.max(max, noiseMap[y][x]);
    }
  }
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      noiseMap[y][x] = (noiseMap[y][x] - min) / (max - min);
    }
  }
  
  return noiseMap;
};

/**
 * Generates random terrain data based on the provided parameters
 * @param mapSize The size of the map to generate
 * @param params Generation parameters
 * @returns A 2D array of Cell objects
 */
export const generateRandomTerrain = (mapSize: MapSize, params: GenerationParams): Cell[][] => {
  // Create initial empty map data
  const mapData: Cell[][] = Array(mapSize.height).fill(0).map(() => 
    Array(mapSize.width).fill(0).map(() => ({
      type: 'field',
      height: 1
    }))
  );
  
  // Use seed from generation parameters or generate a new one if 0
  const seed = params.randomSeed || Math.floor(Math.random() * 10000);
  
  // Constants for algorithm tuning
  const heightScale = Math.max(mapSize.width, mapSize.height) / params.terrainScale;
  const heightOctaves = 4;
  const heightPersistence = 0.5;
  const heightLacunarity = 2;
  
  const moistureScale = heightScale * 1.5;
  const moistureOctaves = 3;
  const moisturePersistence = 0.5;
  const moistureLacunarity = 2;
  
  const biomeScale = heightScale * 1.2;
  const biomeOctaves = 3;
  const biomePersistence = 0.6;
  const biomeLacunarity = 2;
  
  // Generate height noise
  const heightMap = generateNoise({
    width: mapSize.width, 
    height: mapSize.height, 
    scale: heightScale,
    octaves: heightOctaves,
    persistence: heightPersistence,
    lacunarity: heightLacunarity,
    seed
  });
  
  // Generate biome noise
  const biomesMap = generateNoise({
    width: mapSize.width,
    height: mapSize.height,
    scale: biomeScale,
    octaves: biomeOctaves,
    persistence: biomePersistence,
    lacunarity: biomeLacunarity,
    seed: seed + 1000
  });
  
  // Generate moisture noise
  const moistureMap = generateNoise({
    width: mapSize.width,
    height: mapSize.height,
    scale: moistureScale,
    octaves: moistureOctaves,
    persistence: moisturePersistence,
    lacunarity: moistureLacunarity,
    seed: seed + 2000
  });
  
  // Water threshold - affects amount of water (higher = more water)
  const waterThreshold = 0.4 - (params.waterLevel * 0.05);
  
  // Height multiplier - affects mountain height (higher = higher mountains)
  const heightMultiplier = 0.8 + (params.mountainsLevel * 0.1);
  
  // Determine terrain types based on height and moisture
  for (let y = 0; y < mapSize.height; y++) {
    for (let x = 0; x < mapSize.width; x++) {
      const elevation = heightMap[y][x] * heightMultiplier;
      const moisture = moistureMap[y][x];
      
      // Determine landscape type based on height and moisture
      let terrainType: string;
      let terrainHeight: number;
      
      // Distribute biomes by height and moisture
      if (elevation < 0.3) {
        // Low terrain
        if (moisture < waterThreshold) {
          terrainType = 'field'; // Dry lowlands - fields
          terrainHeight = Math.max(1, Math.round(elevation * 5));
        } else {
          terrainType = 'water'; // Wet lowlands - water
          terrainHeight = 1;
        }
      } else if (elevation < 0.5) {
        // Medium-low terrain
        if (moisture < waterThreshold) {
          terrainType = 'field'; // Dry medium - fields
          terrainHeight = Math.max(1, Math.round(elevation * 6));
        } else if (moisture < 0.7) {
          terrainType = 'swamp'; // Medium-wet - swamps
          terrainHeight = Math.max(1, Math.round(elevation * 4));
        } else {
          terrainType = 'water'; // Very wet - water
          terrainHeight = 1;
        }
      } else if (elevation < 0.7) {
        // Medium-high terrain
        if (moisture < waterThreshold) {
          terrainType = 'field'; // Dry high - fields
          terrainHeight = Math.max(3, Math.round(elevation * 7));
        } else if (moisture < 0.8) {
          terrainType = 'forest'; // Wet high - forests
          terrainHeight = Math.max(2, Math.round(elevation * 8));
        } else {
          terrainType = 'swamp'; // Very wet high - swamps
          terrainHeight = Math.max(2, Math.round(elevation * 5));
        }
      } else {
        // High terrain
        if (moisture < 0.5) {
          terrainType = 'highland'; // Dry mountains
          terrainHeight = Math.max(5, Math.round(elevation * 10));
        } else {
          terrainType = 'forest'; // Wet mountains - forest
          terrainHeight = Math.max(4, Math.round(elevation * 8));
        }
      }
      
      // Add some asphalt as roads/paths (rarely)
      if (biomesMap[y][x] > 0.48 && biomesMap[y][x] < 0.52 && Math.random() < 0.7) {
        terrainType = 'asphalt';
        terrainHeight = Math.max(1, Math.min(terrainHeight - 1, 3));
      }
      
      // Apply type and height
      mapData[y][x].type = terrainType;
      mapData[y][x].height = terrainHeight;
    }
  }
  
  // Create rivers
  const numRivers = Math.max(1, Math.floor(params.waterLevel));
  
  for (let r = 0; r < numRivers; r++) {
    // Start river at a high point
    let highestElevation = 0;
    let startX = 0;
    let startY = 0;
    
    // Choose a high point to start the river
    for (let i = 0; i < 100; i++) {
      const x = Math.floor(Math.random() * mapSize.width);
      const y = Math.floor(Math.random() * mapSize.height);
      
      if (heightMap[y][x] > highestElevation) {
        highestElevation = heightMap[y][x];
        startX = x;
        startY = y;
      }
    }
    
    // Current river position
    let x = startX;
    let y = startY;
    
    // Create river path
    const riverLength = Math.floor(Math.random() * mapSize.width * 0.5) + 5;
    
    for (let i = 0; i < riverLength; i++) {
      // Water at current position
      mapData[y][x].type = 'water';
      mapData[y][x].height = 1;
      
      // Possible directions
      const directions: Direction[] = [
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: -1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: 1 },
        { dx: 1, dy: 1 },
      ];
      
      // Choose next direction with lowest elevation
      let minElevation = Infinity;
      let nextX = x;
      let nextY = y;
      
      for (const dir of directions) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        
        if (nx >= 0 && nx < mapSize.width && ny >= 0 && ny < mapSize.height) {
          if (heightMap[ny][nx] < minElevation) {
            minElevation = heightMap[ny][nx];
            nextX = nx;
            nextY = ny;
          }
        }
      }
      
      // If we can't find a lower point, stop
      if (nextX === x && nextY === y) break;
      
      // Move to next point
      x = nextX;
      y = nextY;
      
      // Add shores (swamps) around the river
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const sx = x + dx;
          const sy = y + dy;
          
          if (sx >= 0 && sx < mapSize.width && sy >= 0 && sy < mapSize.height) {
            if (mapData[sy][sx].type !== 'water' && Math.random() < 0.4) {
              mapData[sy][sx].type = 'swamp';
              mapData[sy][sx].height = Math.max(1, mapData[sy][sx].height - 1);
            }
          }
        }
      }
    }
    
    // Create a lake at the end of the river sometimes
    if (Math.random() < 0.5) {
      const lakeSize = Math.floor(Math.random() * 3) + 2;
      
      for (let dy = -lakeSize; dy <= lakeSize; dy++) {
        for (let dx = -lakeSize; dx <= lakeSize; dx++) {
          const lx = x + dx;
          const ly = y + dy;
          
          if (lx >= 0 && lx < mapSize.width && ly >= 0 && ly < mapSize.height) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= lakeSize) {
              mapData[ly][lx].type = 'water';
              mapData[ly][lx].height = 1;
              
              // Add swamp around the lake
              if (distance > lakeSize - 1 && Math.random() < 0.7) {
                for (let sy = -1; sy <= 1; sy++) {
                  for (let sx = -1; sx <= 1; sx++) {
                    const bx = lx + sx;
                    const by = ly + sy;
                    
                    if (bx >= 0 && bx < mapSize.width && by >= 0 && by < mapSize.height) {
                      if (mapData[by][bx].type !== 'water') {
                        mapData[by][bx].type = 'swamp';
                        mapData[by][bx].height = Math.max(1, mapData[by][bx].height - 1);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  
  // Smooth height transitions
  const smoothedHeights: Cell[][] = JSON.parse(JSON.stringify(mapData));
  
  for (let y = 1; y < mapSize.height - 1; y++) {
    for (let x = 1; x < mapSize.width - 1; x++) {
      // Skip water and roads (don't smooth them)
      if (mapData[y][x].type === 'water' || mapData[y][x].type === 'asphalt') {
        continue;
      }
      
      // Calculate average height of neighbors
      let sum = 0;
      let count = 0;
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < mapSize.width && ny >= 0 && ny < mapSize.height) {
            if (mapData[ny][nx].type !== 'water' && mapData[ny][nx].type !== 'asphalt') {
              sum += mapData[ny][nx].height;
              count++;
            }
          }
        }
      }
      
      if (count > 0) {
        const avgHeight = Math.round(sum / count);
        
        // Smooth height based on neighbors
        smoothedHeights[y][x].height = Math.floor((mapData[y][x].height + avgHeight) / 2);
      }
    }
  }
  
  return smoothedHeights;
};