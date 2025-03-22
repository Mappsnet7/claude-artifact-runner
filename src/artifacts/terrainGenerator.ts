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

// Интерфейсы для параметров генераторов
export interface GeneratorParams {
  seed?: string;
  waterLevel?: number;
  mountainsLevel?: number;
  forestDensity?: number;
  swampDensity?: number;
  buildingsDensity?: number;
  hillsDensity?: number;
}

export interface NoiseParams {
  scale?: number;
  octaves?: number;
  persistence?: number;
  lacunarity?: number;
  seed?: string;
}

// Класс генератора ландшафта
export class TerrainGenerator {
  private terrainTypes: TerrainType[];
  private rng: () => number;

  constructor(terrainTypes: TerrainType[], seed: string = 'default') {
    this.terrainTypes = terrainTypes;
    this.rng = seedrandom(seed);
  }

  // Основной метод генерации ландшафта
  generateTerrain(radius: number, params: GeneratorParams = {}): HexData[] {
    // Выбираем метод генерации на основе параметров
    const generatorMethod = params.seed ? this.generateProceduralTerrain : this.generateRandomTerrain;
    
    // Генерируем карту выбранным методом
    return generatorMethod.call(this, radius, params);
  }

  // Метод 1: Полностью случайная генерация
  private generateRandomTerrain(radius: number, params: GeneratorParams): HexData[] {
    const newMap: HexData[] = [];
    
    // Настраиваем вероятности для разных типов местности
    const fieldProb = 0.3; // 30% карты - поля
    const hillsProb = params.hillsDensity || 0.15; // 15% - холмы
    const forestProb = params.forestDensity || 0.2; // 20% - лес
    const swampProb = params.swampDensity || 0.1; // 10% - болота
    const buildingsProb = params.buildingsDensity || 0.05; // 5% - здания
    const waterProb = params.waterLevel || 0.15; // 15% - вода
    const mountainsProb = params.mountainsLevel || 0.05; // 5% - горы
    
    // Создаем карту с радиусом radius
    for (let q = -radius; q <= radius; q++) {
      const r1 = Math.max(-radius, -q - radius);
      const r2 = Math.min(radius, -q + radius);
      
      for (let r = r1; r <= r2; r++) {
        const s = -q - r; // q + r + s = 0
        
        // Выбираем случайный тип местности на основе вероятностей
        const random = this.rng();
        let terrainType: string;
        
        if (random < fieldProb) {
          terrainType = 'field';
        } else if (random < fieldProb + hillsProb) {
          terrainType = 'hills';
        } else if (random < fieldProb + hillsProb + forestProb) {
          terrainType = 'forest';
        } else if (random < fieldProb + hillsProb + forestProb + swampProb) {
          terrainType = 'swamp';
        } else if (random < fieldProb + hillsProb + forestProb + swampProb + buildingsProb) {
          terrainType = 'buildings';
        } else if (random < fieldProb + hillsProb + forestProb + swampProb + buildingsProb + waterProb) {
          terrainType = 'water';
        } else {
          terrainType = 'mountains';
        }
        
        // Получаем информацию о выбранном типе местности
        const terrain = this.terrainTypes.find(t => t.id === terrainType) || this.terrainTypes[0];
        
        // Создаем гекс
        newMap.push({
          q,
          r,
          s,
          terrainType: terrain.id,
          color: terrain.color,
          height: terrain.height
        });
      }
    }
    
    return newMap;
  }

  // Метод 2: Процедурная генерация с использованием шума Симплекса
  private generateProceduralTerrain(radius: number, params: GeneratorParams): HexData[] {
    const newMap: HexData[] = [];
    const seed = params.seed || 'default';
    
    // Создаем генератор шума с заданным сидом
    const rng = seedrandom(seed);
    const noise2D = createNoise2D(rng);
    
    // Параметры шума
    const noiseScale = 0.1; // Масштаб шума (меньшие значения - более плавный ландшафт)
    const waterLevel = params.waterLevel || 0.3;
    const mountainsLevel = params.mountainsLevel || 0.7;
    const forestThreshold = params.forestDensity || 0.45;
    const hillsThreshold = params.hillsDensity || 0.55;
    
    // Функция для получения шума в диапазоне [0, 1]
    const getNoise = (x: number, y: number): number => {
      return (noise2D(x * noiseScale, y * noiseScale) + 1) / 2;
    };
    
    // Создаем еще один шумовой слой для второго параметра (влажность)
    const getMoistureNoise = (x: number, y: number): number => {
      return (noise2D((x + 100) * noiseScale * 1.5, (y + 100) * noiseScale * 1.5) + 1) / 2;
    };
    
    // Создаем карту с радиусом radius
    for (let q = -radius; q <= radius; q++) {
      const r1 = Math.max(-radius, -q - radius);
      const r2 = Math.min(radius, -q + radius);
      
      for (let r = r1; r <= r2; r++) {
        const s = -q - r; // q + r + s = 0
        
        // Используем шум для определения высоты и влажности
        const x = q * 1.5;
        const y = q * 0.5 + r;
        const elevation = getNoise(x, y);
        const moisture = getMoistureNoise(x, y);
        
        let terrainType: string;
        
        // Определяем тип местности на основе высоты (elevation) и влажности (moisture)
        if (elevation < waterLevel) {
          // Вода на низких высотах
          terrainType = 'water';
        } else if (elevation > mountainsLevel) {
          // Горы на высоких высотах
          terrainType = 'mountains';
        } else if (elevation > hillsThreshold) {
          // Холмы на средне-высоких высотах
          terrainType = 'hills';
        } else if (moisture > 0.65) {
          // Болота в влажных местах
          terrainType = 'swamp';
        } else if (moisture > 0.45) {
          // Леса в умеренно влажных местах
          terrainType = 'forest';
        } else if (this.rng() < (params.buildingsDensity || 0.03)) {
          // Редкое появление зданий
          terrainType = 'buildings';
        } else {
          // Поля везде, где ничего другого не определено
          terrainType = 'field';
        }
        
        // Получаем информацию о выбранном типе местности
        const terrain = this.terrainTypes.find(t => t.id === terrainType) || this.terrainTypes[0];
        
        // Создаем гекс
        newMap.push({
          q,
          r,
          s,
          terrainType: terrain.id,
          color: terrain.color,
          height: terrain.height
        });
      }
    }
    
    // Проводим пост-обработку карты для более органичных переходов
    return this.postProcessTerrain(newMap, radius);
  }

  // Метод 3: Островная генерация с использованием расстояния от центра
  generateIslandTerrain(radius: number, params: GeneratorParams = {}): HexData[] {
    const newMap: HexData[] = [];
    const seed = params.seed || 'default';
    
    // Создаем генератор шума с заданным сидом
    const rng = seedrandom(seed);
    const noise2D = createNoise2D(rng);
    
    // Параметры шума и острова
    const noiseScale = 0.15;
    const centerInfluence = 0.5; // Сильнее влияние расстояния от центра
    
    for (let q = -radius; q <= radius; q++) {
      const r1 = Math.max(-radius, -q - radius);
      const r2 = Math.min(radius, -q + radius);
      
      for (let r = r1; r <= r2; r++) {
        const s = -q - r; // q + r + s = 0
        
        // Получаем шум и расстояние от центра
        const x = q * 1.5;
        const y = q * 0.5 + r;
        const noise = (noise2D(x * noiseScale, y * noiseScale) + 1) / 2;
        
        // Рассчитываем расстояние от центра (нормализованное к [0, 1])
        const distFromCenter = Math.sqrt(q*q + r*r + s*s) / (radius * 1.5);
        
        // Сочетаем шум и расстояние от центра для получения значения высоты
        let elevation = noise - distFromCenter * centerInfluence;
        
        // Добавляем случайное отклонение к высоте
        elevation += (this.rng() - 0.5) * 0.1;
        
        // Определяем тип местности на основе высоты
        let terrainType: string;
        
        if (elevation < 0.25) {
          terrainType = 'water'; // Вода по краям острова
        } else if (elevation < 0.35) {
          terrainType = 'swamp'; // Болота на берегах
        } else if (elevation < 0.5) {
          terrainType = 'field'; // Поля
        } else if (elevation < 0.7) {
          terrainType = this.rng() < 0.7 ? 'forest' : 'field'; // Смесь лесов и полей
        } else if (elevation < 0.85) {
          terrainType = 'hills'; // Холмы
        } else {
          terrainType = 'mountains'; // Горы в центре
        }
        
        // В случайных местах добавляем здания
        if (terrainType === 'field' && this.rng() < 0.05) {
          terrainType = 'buildings';
        }
        
        // Получаем информацию о выбранном типе местности
        const terrain = this.terrainTypes.find(t => t.id === terrainType) || this.terrainTypes[0];
        
        // Создаем гекс
        newMap.push({
          q,
          r,
          s,
          terrainType: terrain.id,
          color: terrain.color,
          height: terrain.height
        });
      }
    }
    
    return this.postProcessTerrain(newMap, radius);
  }

  // Метод 4: Генерация с био-регионами
  generateBiomesTerrain(radius: number, params: GeneratorParams = {}): HexData[] {
    const newMap: HexData[] = [];
    const seed = params.seed || 'default';
    
    // Создаем два генератора шума с разными сидами
    const rng1 = seedrandom(seed);
    const rng2 = seedrandom(seed + '2');
    const noise2D1 = createNoise2D(rng1);
    const noise2D2 = createNoise2D(rng2);
    
    // Параметры
    const tempScale = 0.07; // Масштаб для температуры
    const moistScale = 0.05; // Масштаб для влажности
    
    for (let q = -radius; q <= radius; q++) {
      const r1 = Math.max(-radius, -q - radius);
      const r2 = Math.min(radius, -q + radius);
      
      for (let r = r1; r <= r2; r++) {
        const s = -q - r; // q + r + s = 0
        
        // Получаем значения температуры и влажности для биомов
        const x = q * 1.5;
        const y = q * 0.5 + r;
        
        const temperature = (noise2D1(x * tempScale, y * tempScale) + 1) / 2;
        const moisture = (noise2D2(x * moistScale, y * moistScale) + 1) / 2;
        
        // Определяем биом на основе температуры и влажности
        let terrainType: string;
        
        // Матрица биомов
        if (temperature < 0.3) {
          // Холодно
          if (moisture < 0.3) terrainType = 'mountains'; // Холодно и сухо - горы
          else if (moisture < 0.6) terrainType = 'hills'; // Холодно и умеренно - холмы
          else terrainType = 'swamp'; // Холодно и влажно - болота
        } else if (temperature < 0.7) {
          // Умеренно
          if (moisture < 0.3) terrainType = 'field'; // Умеренно и сухо - поля
          else if (moisture < 0.7) terrainType = 'forest'; // Умеренно и умеренно влажно - леса
          else terrainType = 'swamp'; // Умеренно и очень влажно - болота
        } else {
          // Тепло
          if (moisture < 0.2) terrainType = 'field'; // Тепло и очень сухо - поля
          else if (moisture < 0.5) terrainType = 'field'; // Тепло и сухо - поля
          else if (moisture < 0.8) terrainType = 'forest'; // Тепло и умеренно влажно - леса
          else terrainType = 'water'; // Тепло и очень влажно - вода (озера)
        }
        
        // Реки и озера на основе другого шума
        const waterNoise = (noise2D1((x + 100) * 0.1, (y + 100) * 0.1) + 1) / 2;
        if (waterNoise > 0.8 && moisture > 0.4) {
          terrainType = 'water';
        }
        
        // Добавляем здания с малой вероятностью на полях
        if (terrainType === 'field' && this.rng() < 0.07) {
          terrainType = 'buildings';
        }
        
        // Получаем информацию о выбранном типе местности
        const terrain = this.terrainTypes.find(t => t.id === terrainType) || this.terrainTypes[0];
        
        // Создаем гекс
        newMap.push({
          q,
          r,
          s,
          terrainType: terrain.id,
          color: terrain.color,
          height: terrain.height
        });
      }
    }
    
    return this.postProcessTerrain(newMap, radius);
  }

  // Пост-обработка для сглаживания переходов между разными типами местности
  private postProcessTerrain(map: HexData[], radius: number): HexData[] {
    const processedMap = [...map];
    const hexMap: Record<string, HexData> = {};
    
    // Создаем индекс для быстрого доступа
    map.forEach(hex => {
      const key = `${hex.q},${hex.r},${hex.s}`;
      hexMap[key] = hex;
    });
    
    // Функция для получения соседей гекса
    const getNeighbors = (q: number, r: number, s: number): HexData[] => {
      const neighbors: HexData[] = [];
      const directions = [
        [1, -1, 0], [1, 0, -1], [0, 1, -1],
        [-1, 1, 0], [-1, 0, 1], [0, -1, 1]
      ];
      
      for (const [dq, dr, ds] of directions) {
        const key = `${q + dq},${r + dr},${s + ds}`;
        if (hexMap[key]) {
          neighbors.push(hexMap[key]);
        }
      }
      
      return neighbors;
    };
    
    // Проходим по карте и сглаживаем некоторые переходы
    for (let i = 0; i < processedMap.length; i++) {
      const hex = processedMap[i];
      const neighbors = getNeighbors(hex.q, hex.r, hex.s);
      
      // Сглаживание переходов (пример: создание берегов)
      // Если гекс - не вода, но большинство соседей - вода, делаем его болотом или песком
      if (hex.terrainType !== 'water') {
        const waterNeighbors = neighbors.filter(n => n.terrainType === 'water').length;
        if (waterNeighbors >= 3 && this.rng() > 0.3) {
          hex.terrainType = 'swamp'; // Берег как болото
          const terrain = this.terrainTypes.find(t => t.id === 'swamp') || this.terrainTypes[0];
          hex.color = terrain.color;
          hex.height = terrain.height;
        }
      }
      
      // Изолированные горы окружаем холмами
      if (hex.terrainType === 'mountains') {
        const nonMountainNeighbors = neighbors.filter(n => n.terrainType !== 'mountains').length;
        if (nonMountainNeighbors >= 4) {
          for (let j = 0; j < neighbors.length; j++) {
            if (neighbors[j].terrainType !== 'mountains' && neighbors[j].terrainType !== 'water' && this.rng() > 0.5) {
              const idx = processedMap.findIndex(h => 
                h.q === neighbors[j].q && h.r === neighbors[j].r && h.s === neighbors[j].s
              );
              if (idx !== -1) {
                processedMap[idx].terrainType = 'hills';
                const terrain = this.terrainTypes.find(t => t.id === 'hills') || this.terrainTypes[0];
                processedMap[idx].color = terrain.color;
                processedMap[idx].height = terrain.height;
              }
            }
          }
        }
      }
      
      // Редко добавляем леса рядом с болотами
      if (hex.terrainType === 'field') {
        const swampNeighbors = neighbors.filter(n => n.terrainType === 'swamp').length;
        if (swampNeighbors >= 2 && this.rng() > 0.7) {
          hex.terrainType = 'forest';
          const terrain = this.terrainTypes.find(t => t.id === 'forest') || this.terrainTypes[0];
          hex.color = terrain.color;
          hex.height = terrain.height;
        }
      }
    }
    
    return processedMap;
  }
}

// Конкретные наборы параметров для разных типов местности
export const presetParams = {
  default: {
    seed: 'default',
    waterLevel: 0.3,
    mountainsLevel: 0.7,
    forestDensity: 0.2,
    swampDensity: 0.1,
    buildingsDensity: 0.05,
    hillsDensity: 0.15
  },
  forest: {
    seed: 'forest',
    waterLevel: 0.2,
    mountainsLevel: 0.85,
    forestDensity: 0.5, // Больше лесов
    swampDensity: 0.15,
    buildingsDensity: 0.02,
    hillsDensity: 0.1
  },
  mountain: {
    seed: 'mountain',
    waterLevel: 0.25,
    mountainsLevel: 0.55, // Больше гор
    forestDensity: 0.15,
    swampDensity: 0.05,
    buildingsDensity: 0.03,
    hillsDensity: 0.25 // Больше холмов
  },
  islands: {
    seed: 'islands',
    waterLevel: 0.45, // Больше воды
    mountainsLevel: 0.8,
    forestDensity: 0.3,
    swampDensity: 0.15,
    buildingsDensity: 0.1,
    hillsDensity: 0.15
  },
  swamps: {
    seed: 'swamps',
    waterLevel: 0.35,
    mountainsLevel: 0.85,
    forestDensity: 0.25,
    swampDensity: 0.35, // Больше болот
    buildingsDensity: 0.05,
    hillsDensity: 0.1
  }
}; 