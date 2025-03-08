import { Cell, MapSize, GenerationParams, NoiseParams } from '../types';

/**
 * Генерирует шумовую карту с использованием простой реализации шума Перлина
 * @param params Параметры генерации шума
 * @returns 2D массив, содержащий значения шума от 0 до 1
 */
const generateNoise = (params: NoiseParams): number[][] => {
  const { width, height, scale, octaves, persistence, lacunarity, seed } = params;
  
  // Простая псевдослучайная функция с сидом
  const random = (x: number, y: number, s: number): number => {
    const value = Math.sin(x * 12.9898 + y * 78.233 + s * 43.7498) * 43758.5453;
    return value - Math.floor(value);
  };
  
  // Функция интерполяции
  const lerp = (a: number, b: number, t: number): number => a + t * (b - a);
  
  // Функция сглаживания
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  
  // Создание шумовой карты
  const noiseMap: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
  
  // Для каждой октавы
  for (let octave = 0; octave < octaves; octave++) {
    // Вычисление частоты и амплитуды для текущей октавы
    const frequency = Math.pow(lacunarity, octave);
    const amplitude = Math.pow(persistence, octave);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Масштабирование координат
        const sX = x / scale * frequency;
        const sY = y / scale * frequency;
        
        // Определение ячейки сетки
        const cellX = Math.floor(sX);
        const cellY = Math.floor(sY);
        
        // Вычисление смещения внутри ячейки
        const fracX = sX - cellX;
        const fracY = sY - cellY;
        
        // Смещение координат для интерполяции
        const smoothX = smooth(fracX);
        const smoothY = smooth(fracY);
        
        // Получение значений шума в углах ячейки
        const c00 = random(cellX, cellY, seed + octave);
        const c10 = random(cellX + 1, cellY, seed + octave);
        const c01 = random(cellX, cellY + 1, seed + octave);
        const c11 = random(cellX + 1, cellY + 1, seed + octave);
        
        // Интерполяция значений
        const top = lerp(c00, c10, smoothX);
        const bottom = lerp(c01, c11, smoothX);
        const value = lerp(top, bottom, smoothY);
        
        // Добавление шума в карту
        noiseMap[y][x] += value * amplitude;
      }
    }
  }
  
  // Нормализация значений шума в диапазоне [0, 1]
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
 * Генерирует случайные данные о местности на основе предоставленных параметров
 * @param mapSize Размер карты для генерации
 * @param params Параметры генерации
 * @returns 2D массив объектов Cell
 */
const generateRandomTerrain = (mapSize: MapSize, params: GenerationParams): Cell[][] => {
  // Создание начальных пустых данных карты
  const mapData: Cell[][] = Array(mapSize.height).fill(0).map(() => 
    Array(mapSize.width).fill(0).map(() => ({
      type: 'field',
      height: 1
    }))
  );
  
  // Использование сида из параметров генерации или генерация нового, если 0
  const seed = params.randomSeed || Math.floor(Math.random() * 10000);
  
  // Константы для настройки алгоритма
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
  
  // Генерация шума высоты
  const heightMap = generateNoise({
    width: mapSize.width, 
    height: mapSize.height, 
    scale: heightScale,
    octaves: heightOctaves,
    persistence: heightPersistence,
    lacunarity: heightLacunarity,
    seed
  });
  
  // Генерация шума биомов
  const biomesMap = generateNoise({
    width: mapSize.width,
    height: mapSize.height,
    scale: biomeScale,
    octaves: biomeOctaves,
    persistence: biomePersistence,
    lacunarity: biomeLacunarity,
    seed: seed + 1000
  });
  
  // Генерация шума влажности
  const moistureMap = generateNoise({
    width: mapSize.width,
    height: mapSize.height,
    scale: moistureScale,
    octaves: moistureOctaves,
    persistence: moisturePersistence,
    lacunarity: moistureLacunarity,
    seed: seed + 2000
  });
  
  // Порог воды - влияет на количество воды (выше = больше воды)
  const waterThreshold = 0.4 - (params.waterLevel * 0.05);
  
  // Множитель высоты - влияет на высоту гор (выше = выше горы)
  const heightMultiplier = 0.8 + (params.mountainsLevel * 0.1);
  
  // Определение типов местности на основе высоты и влажности
  for (let y = 0; y < mapSize.height; y++) {
    for (let x = 0; x < mapSize.width; x++) {
      const elevation = heightMap[y][x] * heightMultiplier;
      const moisture = moistureMap[y][x];
      
      // Определение типа ландшафта на основе высоты и влажности
      let terrainType: string;
      let terrainHeight: number;
      
      // Распределение биомов по высоте и влажности
      if (elevation < 0.3) {
        // Низкая местность
        if (moisture < waterThreshold) {
          terrainType = 'field'; // Сухие низины - поля
          terrainHeight = Math.max(1, Math.round(elevation * 5));
        } else {
          terrainType = 'water'; // Влажные низины - вода
          terrainHeight = 1;
        }
      } else if (elevation < 0.5) {
        // Средне-низкая местность
        if (moisture < waterThreshold) {
          terrainType = 'field'; // Сухая средняя - поля
          terrainHeight = Math.max(1, Math.round(elevation * 6));
        } else if (moisture < 0.7) {
          terrainType = 'swamp'; // Средне-влажная - болота
          terrainHeight = Math.max(1, Math.round(elevation * 4));
        } else {
          terrainType = 'water'; // Очень влажная - вода
          terrainHeight = 1;
        }
      } else if (elevation < 0.7) {
        // Средне-высокая местность
        if (moisture < waterThreshold) {
          terrainType = 'field'; // Сухая высокая - поля
          terrainHeight = Math.max(3, Math.round(elevation * 7));
        } else if (moisture < 0.8) {
          terrainType = 'forest'; // Влажная высокая - леса
          terrainHeight = Math.max(2, Math.round(elevation * 8));
        } else {
          terrainType = 'swamp'; // Очень влажная высокая - болота
          terrainHeight = Math.max(2, Math.round(elevation * 5));
        }
      } else {
        // Высокая местность
        if (moisture < 0.5) {
          terrainType = 'highland'; // Сухие горы
          terrainHeight = Math.max(5, Math.round(elevation * 10));
        } else {
          terrainType = 'forest'; // Влажные горы - лес
          terrainHeight = Math.max(4, Math.round(elevation * 8));
        }
      }
      
      // Добавление асфальта как дорог/путей (редко)
      if (biomesMap[y][x] > 0.48 && biomesMap[y][x] < 0.52 && Math.random() < 0.7) {
        terrainType = 'asphalt';
        terrainHeight = Math.max(1, Math.min(terrainHeight - 1, 3));
      }
      
      // Применение типа и высоты
      mapData[y][x].type = terrainType;
      mapData[y][x].height = terrainHeight;
    }
  }
  
  return mapData;
};

// Обработчик сообщений для Web Worker
self.onmessage = (e: MessageEvent) => {
  const { mapSize, params } = e.data;
  
  // Генерация карты
  const mapData = generateRandomTerrain(mapSize, params);
  
  // Отправка результата обратно в основной поток
  self.postMessage({ mapData });
};

export {}; 