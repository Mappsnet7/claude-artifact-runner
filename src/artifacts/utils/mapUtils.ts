import { Cell, MapSize } from '../types';

/**
 * Updates cells on the map based on brush size and selected tool/height
 * @param mapData Current map data
 * @param row Target row
 * @param col Target column
 * @param mapSize Map dimensions
 * @param selectedTool Currently selected tool
 * @param selectedHeight Currently selected height
 * @param brushSize Size of the brush
 * @returns Updated map data
 */
export const updateCells = (
  mapData: Cell[][],
  row: number,
  col: number,
  mapSize: MapSize,
  selectedTool: string,
  selectedHeight: number,
  brushSize: number
): Cell[][] => {
  const newMapData: Cell[][] = JSON.parse(JSON.stringify(mapData)); // Deep copy
  
  // Determine brush radius (brushSize is the diameter)
  const radius = Math.floor(brushSize / 2);
  
  // Iterate through brush area
  for (let r = -radius; r <= radius; r++) {
    for (let c = -radius; c <= radius; c++) {
      // Check if cell is within map boundaries
      const targetRow = row + r;
      const targetCol = col + c;
      
      // Skip cells outside map boundaries
      if (targetRow < 0 || targetRow >= mapSize.height || targetCol < 0 || targetCol >= mapSize.width) {
        continue;
      }
      
      // If using a circular brush, check if cell is within the circle
      if (brushSize > 1) {
        const distance = Math.sqrt(r * r + c * c);
        if (distance > radius) continue;
      }
      
      if (selectedTool === 'height') {
        // Height change tool selected
        newMapData[targetRow][targetCol].height = selectedHeight;
      } else {
        // Specific terrain type selected
        newMapData[targetRow][targetCol].type = selectedTool;
      }
    }
  }
  
  return newMapData;
};

/**
 * Fills the entire map with selected terrain type or height
 * @param mapData Current map data
 * @param mapSize Map dimensions
 * @param selectedTool Currently selected tool
 * @param selectedHeight Currently selected height
 * @returns Updated map data
 */
export const fillMap = (
  mapData: Cell[][],
  mapSize: MapSize,
  selectedTool: string,
  selectedHeight: number
): Cell[][] => {
  // Create a copy of the map data
  const newMapData: Cell[][] = JSON.parse(JSON.stringify(mapData));
  
  // Fill the entire map
  for (let row = 0; row < mapSize.height; row++) {
    for (let col = 0; col < mapSize.width; col++) {
      if (selectedTool === 'height') {
        newMapData[row][col].height = selectedHeight;
      } else {
        newMapData[row][col].type = selectedTool;
      }
    }
  }
  
  return newMapData;
};

/**
 * Creates a new empty map with default values
 * @param mapSize Map dimensions
 * @returns New map data
 */
export const createEmptyMap = (mapSize: MapSize): Cell[][] => {
  return Array(mapSize.height).fill(0).map(() => 
    Array(mapSize.width).fill(0).map(() => ({
      type: 'field',
      height: 1
    }))
  );
};

/**
 * Calculates the appropriate cell size based on map dimensions
 * @param mapSize Map dimensions
 * @returns Appropriate cell size
 */
export const calculateCellSize = (mapSize: MapSize): number => {
  const cellSizeW = Math.floor(600 / mapSize.width);
  const cellSizeH = Math.floor(400 / mapSize.height);
  return Math.max(4, Math.min(cellSizeW, cellSizeH, 12));
};