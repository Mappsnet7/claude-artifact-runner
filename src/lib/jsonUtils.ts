import { Cell, MapSize } from '../artifacts/types';

/**
 * Интерфейс для структуры данных карты, которая будет экспортирована в JSON
 */
export interface MapData {
  width: number;
  height: number;
  data: Cell[][];
  name?: string;
  description?: string;
  createdAt?: string;
  version?: string;
}

/**
 * Экспортирует данные карты в JSON файл
 * @param mapData Данные карты
 * @param mapSize Размер карты
 * @param fileName Имя файла (по умолчанию 'map-export.json')
 * @param additionalData Дополнительные данные для включения в экспорт
 */
export const exportMapToJSON = (
  mapData: Cell[][],
  mapSize: MapSize,
  fileName: string = 'map-export.json',
  additionalData: Partial<MapData> = {}
): void => {
  try {
    // Создаем объект с данными карты
    const exportData: MapData = {
      width: mapSize.width,
      height: mapSize.height,
      data: mapData,
      createdAt: new Date().toISOString(),
      version: '1.0',
      ...additionalData
    };

    // Преобразуем объект в строку JSON
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Создаем Blob с данными JSON
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Создаем URL для Blob
    const url = URL.createObjectURL(blob);
    
    // Создаем временную ссылку для скачивания
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    
    // Добавляем ссылку в DOM, кликаем по ней и удаляем
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Освобождаем URL
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Ошибка при экспорте карты в JSON:', error);
    throw new Error(`Не удалось экспортировать карту: ${error}`);
  }
};

/**
 * Импортирует данные карты из JSON файла
 * @returns Promise с данными карты
 */
export const importMapFromJSON = (): Promise<MapData> => {
  return new Promise((resolve, reject) => {
    try {
      // Создаем элемент input для выбора файла
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      // Обрабатываем выбор файла
      input.onchange = (event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        
        if (!file) {
          reject(new Error('Файл не выбран'));
          return;
        }
        
        // Создаем FileReader для чтения содержимого файла
        const reader = new FileReader();
        
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string;
            const mapData = JSON.parse(content) as MapData;
            
            // Проверяем, что файл содержит необходимые данные
            if (!mapData.width || !mapData.height || !mapData.data) {
              reject(new Error('Некорректный формат файла JSON'));
              return;
            }
            
            resolve(mapData);
          } catch (error) {
            reject(new Error(`Ошибка при разборе JSON: ${error}`));
          }
        };
        
        reader.onerror = () => {
          reject(new Error('Ошибка при чтении файла'));
        };
        
        // Читаем файл как текст
        reader.readAsText(file);
      };
      
      // Кликаем по input для открытия диалога выбора файла
      input.click();
    } catch (error) {
      reject(new Error(`Ошибка при импорте карты: ${error}`));
    }
  });
}; 