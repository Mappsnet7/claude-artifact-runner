import { Cell, MapSize, SoftBrushSettings } from '../types';

/**
 * Вычисляет коэффициент убывания для мягкой кисти
 * @param distance Расстояние от центра кисти
 * @param radius Радиус кисти
 * @param falloffType Тип убывания
 * @param strength Сила эффекта (0-1)
 * @returns Коэффициент убывания (0-1)
 */
export const calculateFalloff = (
  distance: number,
  radius: number,
  falloffType: SoftBrushSettings['falloffType'],
  strength: number
): number => {
  // Нормализуем расстояние (0-1)
  const normalizedDistance = Math.min(distance / radius, 1);
  
  // Применяем коэффициент силы
  const adjustedStrength = Math.max(0.1, Math.min(1, strength));
  
  // Вычисляем коэффициент убывания в зависимости от типа
  switch (falloffType) {
    case 'linear':
      // Линейное убывание от центра к краям
      return Math.max(0, 1 - normalizedDistance) * adjustedStrength;
      
    case 'quadratic':
      // Квадратичное убывание (более плавное)
      return Math.max(0, 1 - normalizedDistance * normalizedDistance) * adjustedStrength;
      
    case 'gaussian':
      // Гауссово убывание (колоколообразное)
      return Math.exp(-4 * normalizedDistance * normalizedDistance) * adjustedStrength;
      
    case 'plateau':
      // Плато в центре с резким спадом к краям
      if (normalizedDistance < 0.5) {
        return adjustedStrength;
      } else {
        return Math.max(0, 1 - (normalizedDistance - 0.5) * 2) * adjustedStrength;
      }
      
    default:
      return 1;
  }
};

/**
 * Обновляет ячейки на карте на основе размера кисти и выбранного инструмента/высоты
 * Оптимизировано для больших карт
 * @param mapData Текущие данные карты
 * @param row Целевая строка
 * @param col Целевой столбец
 * @param mapSize Размеры карты
 * @param selectedTool Выбранный инструмент
 * @param selectedHeight Выбранная высота
 * @param brushSize Размер кисти
 * @param brushType Тип кисти ('normal' или 'soft')
 * @param softBrushSettings Настройки мягкой кисти (если используется)
 * @returns Обновленные данные карты
 */
export const updateCells = (
  mapData: Cell[][],
  row: number,
  col: number,
  mapSize: MapSize,
  selectedTool: string,
  selectedHeight: number,
  brushSize: number,
  brushType: string = 'normal',
  softBrushSettings?: SoftBrushSettings
): Cell[][] => {
  // Создаем новый массив, но копируем только те строки, которые будут изменены
  const newMapData: Cell[][] = [...mapData];
  
  // Determine brush radius (brushSize is the diameter)
  const radius = Math.floor(brushSize / 2);
  
  // Определяем границы области, которую нужно обновить
  const startRow = Math.max(0, row - radius);
  const endRow = Math.min(mapSize.height - 1, row + radius);
  
  // Для очень больших карт (более 40000 ячеек) используем более эффективный алгоритм
  const totalCells = mapSize.width * mapSize.height;
  const isVeryLargeMap = totalCells > 40000;
  
  // Создаем массив измененных ячеек для оптимизации
  const changedCells: {row: number, col: number, cell: Cell}[] = [];
  
  // Итерируем только по строкам, которые будут изменены
  for (let targetRow = startRow; targetRow <= endRow; targetRow++) {
    // Копируем строку только если она будет изменена и мы еще не на очень большой карте
    if (!isVeryLargeMap) {
      newMapData[targetRow] = [...mapData[targetRow]];
    }
    
    for (let c = -radius; c <= radius; c++) {
      const targetCol = col + c;
      
      // Skip cells outside map boundaries
      if (targetCol < 0 || targetCol >= mapSize.width) {
        continue;
      }
      
      // Вычисляем расстояние от центра кисти
      const r = targetRow - row;
      const distance = Math.sqrt(r * r + c * c);
      
      // If using a circular brush, check if cell is within the circle
      if (brushSize > 1 && distance > radius) {
        continue;
      }
      
      // Определяем коэффициент влияния для мягкой кисти
      let falloffFactor = 1;
      if (brushType === 'soft' && softBrushSettings) {
        falloffFactor = calculateFalloff(
          distance,
          radius,
          softBrushSettings.falloffType,
          softBrushSettings.strength
        );
        
        // Если коэффициент слишком мал, пропускаем ячейку
        if (falloffFactor < 0.01) {
          continue;
        }
      }
      
      // Для очень больших карт собираем изменения, но не применяем их сразу
      if (isVeryLargeMap) {
        const newCell = { ...mapData[targetRow][targetCol] };
        
        if (selectedTool === 'height') {
          if (brushType === 'soft' && softBrushSettings) {
            // Для мягкой кисти интерполируем между текущей и целевой высотой
            const currentHeight = mapData[targetRow][targetCol].height;
            const targetHeight = selectedHeight;
            newCell.height = Math.round(currentHeight + (targetHeight - currentHeight) * falloffFactor);
          } else {
            // Для обычной кисти просто устанавливаем высоту
            newCell.height = selectedHeight;
          }
        } else {
          // Для изменения типа территории не используем мягкую кисть
          newCell.type = selectedTool;
        }
        
        changedCells.push({
          row: targetRow,
          col: targetCol,
          cell: newCell
        });
      } else {
        // Для карт обычного размера применяем изменения сразу
        if (selectedTool === 'height') {
          if (brushType === 'soft' && softBrushSettings) {
            // Для мягкой кисти интерполируем между текущей и целевой высотой
            const currentHeight = mapData[targetRow][targetCol].height;
            const targetHeight = selectedHeight;
            const newHeight = Math.round(currentHeight + (targetHeight - currentHeight) * falloffFactor);
            
            newMapData[targetRow][targetCol] = {
              ...newMapData[targetRow][targetCol],
              height: newHeight
            };
          } else {
            // Для обычной кисти просто устанавливаем высоту
            newMapData[targetRow][targetCol] = {
              ...newMapData[targetRow][targetCol],
              height: selectedHeight
            };
          }
        } else {
          // Specific terrain type selected
          newMapData[targetRow][targetCol] = {
            ...newMapData[targetRow][targetCol],
            type: selectedTool
          };
        }
      }
    }
  }
  
  // Для очень больших карт применяем изменения пакетно
  if (isVeryLargeMap && changedCells.length > 0) {
    // Группируем изменения по строкам для минимизации копирований
    const rowsToUpdate = new Set(changedCells.map(cell => cell.row));
    
    // Копируем только те строки, которые будут изменены
    rowsToUpdate.forEach(rowIndex => {
      newMapData[rowIndex] = [...mapData[rowIndex]];
    });
    
    // Применяем все изменения
    changedCells.forEach(({row, col, cell}) => {
      newMapData[row][col] = cell;
    });
  }
  
  return newMapData;
};

/**
 * Заполняет всю карту выбранным типом территории или высотой
 * Оптимизировано для больших карт
 * @param mapData Текущие данные карты
 * @param mapSize Размеры карты
 * @param selectedTool Выбранный инструмент
 * @param selectedHeight Выбранная высота
 * @returns Обновленные данные карты
 */
export const fillMap = (
  mapData: Cell[][],
  mapSize: MapSize,
  selectedTool: string,
  selectedHeight: number
): Cell[][] => {
  // Определяем, является ли карта очень большой
  const totalCells = mapSize.width * mapSize.height;
  const isVeryLargeMap = totalCells > 40000;
  
  // Для очень больших карт используем оптимизированный подход
  if (isVeryLargeMap) {
    // Создаем новый массив строк
    const newMapData: Cell[][] = [];
    
    // Создаем шаблон строки для повторного использования
    const templateRow: Cell[] = [];
    for (let col = 0; col < mapSize.width; col++) {
      if (selectedTool === 'height') {
        templateRow.push({
          ...mapData[0][col],
          height: selectedHeight
        });
      } else {
        templateRow.push({
          ...mapData[0][col],
          type: selectedTool
        });
      }
    }
    
    // Заполняем карту, копируя шаблон строки
    for (let row = 0; row < mapSize.height; row++) {
      newMapData.push([...templateRow]);
    }
    
    return newMapData;
  } else {
    // Для карт обычного размера используем стандартный подход
    const newMapData: Cell[][] = mapData.map(row => [...row]);
    
    // Fill the entire map
    for (let row = 0; row < mapSize.height; row++) {
      for (let col = 0; col < mapSize.width; col++) {
        if (selectedTool === 'height') {
          newMapData[row][col] = {
            ...newMapData[row][col],
            height: selectedHeight
          };
        } else {
          newMapData[row][col] = {
            ...newMapData[row][col],
            type: selectedTool
          };
        }
      }
    }
    
    return newMapData;
  }
};

/**
 * Создает новую пустую карту с значениями по умолчанию
 * Оптимизировано для больших карт
 * @param mapSize Размеры карты
 * @returns Новые данные карты
 */
export const createEmptyMap = (mapSize: MapSize): Cell[][] => {
  // Определяем, является ли карта очень большой
  const totalCells = mapSize.width * mapSize.height;
  const isVeryLargeMap = totalCells > 40000;
  
  if (isVeryLargeMap) {
    // Для очень больших карт используем оптимизированный подход
    const result: Cell[][] = [];
    
    // Создаем шаблон строки для повторного использования
    const templateRow: Cell[] = [];
    for (let col = 0; col < mapSize.width; col++) {
      templateRow.push({
        type: 'field',
        height: 1
      });
    }
    
    // Заполняем карту, копируя шаблон строки
    for (let row = 0; row < mapSize.height; row++) {
      result.push([...templateRow]);
    }
    
    return result;
  } else {
    // Для карт обычного размера используем стандартный подход
    return Array(mapSize.height).fill(0).map(() => 
      Array(mapSize.width).fill(0).map(() => ({
        type: 'field',
        height: 1
      }))
    );
  }
};

/**
 * Вычисляет подходящий размер ячейки на основе размеров карты
 * @param mapSize Размеры карты
 * @returns Подходящий размер ячейки
 */
export const calculateCellSize = (mapSize: MapSize): number => {
  const totalCells = mapSize.width * mapSize.height;
  
  // Для очень больших карт устанавливаем минимальный размер ячеек
  if (totalCells > 40000) {
    return 4;
  } else if (totalCells > 20000) {
    return 6;
  } else if (totalCells > 10000) {
    return 8;
  }
  
  // Для карт обычного размера вычисляем размер на основе размеров карты
  const cellSizeW = Math.floor(600 / mapSize.width);
  const cellSizeH = Math.floor(400 / mapSize.height);
  return Math.max(4, Math.min(cellSizeW, cellSizeH, 12));
};