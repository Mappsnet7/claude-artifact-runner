import React, { useState, useRef, useEffect, MouseEvent as ReactMouseEvent, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { Cell, MapSize, TooltipPosition, GenerationParams, SoftBrushSettings } from './types';
import { terrainTypes, DEFAULT_MAP_SIZE, DEFAULT_GENERATION_PARAMS, DEFAULT_CELL_SIZE, DEFAULT_BRUSH_SIZE, brushTypes, DEFAULT_SOFT_BRUSH_SETTINGS, heightLevels } from './constants';
import { updateCells, fillMap, createEmptyMap, calculateCellSize } from './utils/mapUtils';
import { generateRandomTerrain } from './utils/terrainGeneration';
import { setupThreeScene, setupCameraControls, createMapMesh, cleanupThreeResources } from './utils/threeUtils';
import GenerationParamsDialog from './components/GenerationParamsDialog';
import HelpDialog from './components/HelpDialog';
import './styles/brushStyles.css';

const MapEditor: React.FC = () => {
  // ===== STATE =====
  const [step, setStep] = useState<'size' | 'edit'>('size');
  const [mapSize, setMapSize] = useState<MapSize>(DEFAULT_MAP_SIZE);
  const [mapData, setMapData] = useState<Cell[][]>([]);
  const [selectedTool, setSelectedTool] = useState<string>('field');
  const [selectedHeight, setSelectedHeight] = useState<number>(1);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [show3DPreview, setShow3DPreview] = useState<boolean>(false);
  const [showHeightNumbers, setShowHeightNumbers] = useState<boolean>(true);
  const [cellSize, setCellSize] = useState<number>(DEFAULT_CELL_SIZE);
  const [brushSize, setBrushSize] = useState<number>(DEFAULT_BRUSH_SIZE);
  const [showJsonExport, setShowJsonExport] = useState<boolean>(false);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [tooltipContent, setTooltipContent] = useState<string>('');
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({ x: 0, y: 0 });
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [undoStack, setUndoStack] = useState<Cell[][][]>([]);
  const [redoStack, setRedoStack] = useState<Cell[][][]>([]);
  
  // Новые состояния для мягкой кисти
  const [selectedBrushType, setSelectedBrushType] = useState<string>('normal');
  const [softBrushSettings, setSoftBrushSettings] = useState<SoftBrushSettings>(DEFAULT_SOFT_BRUSH_SETTINGS);
  const [showBrushSettings, setShowBrushSettings] = useState<boolean>(false);
  
  // Terrain generation parameters
  const [generationParams, setGenerationParams] = useState<GenerationParams>(DEFAULT_GENERATION_PARAMS);
  const [showGenerationParams, setShowGenerationParams] = useState<boolean>(false);

  // ===== REFS =====
  const threeContainer = useRef<HTMLDivElement>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [useCanvasRenderer, setUseCanvasRenderer] = useState<boolean>(false);
  const [hoveredCell, setHoveredCell] = useState<{row: number, col: number} | null>(null);
  const [viewportOffset, setViewportOffset] = useState<{x: number, y: number}>({x: 0, y: 0});
  const [viewportSize, setViewportSize] = useState<{width: number, height: number}>({width: 0, height: 0});
  const isDraggingViewport = useRef<boolean>(false);
  const lastDragPosition = useRef<{x: number, y: number} | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const lastDrawTime = useRef<number>(0);
  const drawThrottleTimeout = useRef<NodeJS.Timeout | null>(null);

  // Добавляем состояние для отслеживания ошибок Canvas
  const [canvasError, setCanvasError] = useState<boolean>(false);

  // Создаем ref для хранения функции renderMapToCanvas
  const renderMapToCanvasRef = useRef<() => void>(() => {});

  // ===== FUNCTIONS =====
  
  // Константы для ограничения стека undo/redo
  const MAX_UNDO_STATES_NORMAL = 50;
  const MAX_UNDO_STATES_LARGE = 20;
  const MAX_UNDO_STATES_VERY_LARGE = 10;

  // Save state for undo
  const saveState = (newMapData: Cell[][]) => {
    // Для очень больших карт используем ссылки вместо глубоких копий
    const totalCells = mapSize.width * mapSize.height;
    const isVeryLargeMap = totalCells > 40000;
    const isLargeMap = totalCells > 10000;
    
    // Определяем максимальное количество состояний в стеке
    let maxUndoStates = MAX_UNDO_STATES_NORMAL;
    if (isVeryLargeMap) {
      maxUndoStates = MAX_UNDO_STATES_VERY_LARGE;
    } else if (isLargeMap) {
      maxUndoStates = MAX_UNDO_STATES_LARGE;
    }
    
    let newUndoStack;
    
    if (isVeryLargeMap) {
      // Для очень больших карт просто сохраняем ссылку на предыдущее состояние
      // Это безопасно, так как мы всегда создаем новый массив при изменении
      newUndoStack = [...undoStack, mapData];
      
      // Ограничиваем размер стека
      if (newUndoStack.length > maxUndoStates) {
        newUndoStack = newUndoStack.slice(newUndoStack.length - maxUndoStates);
      }
    } else {
      // Для карт обычного размера делаем неглубокую копию массива
      // Это работает, потому что updateCells уже создает новые объекты для измененных ячеек
      const mapDataCopy = mapData.map(row => [...row]);
      newUndoStack = [...undoStack, mapDataCopy];
      
      // Ограничиваем размер стека
      if (newUndoStack.length > maxUndoStates) {
        newUndoStack = newUndoStack.slice(newUndoStack.length - maxUndoStates);
      }
    }
    
    setUndoStack(newUndoStack);
    setRedoStack([]);
    setMapData(newMapData);
  };

  // Undo last action
  const undo = () => {
    if (undoStack.length === 0) return;
    
    const prevState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, undoStack.length - 1);
    
    // Для очень больших карт используем ссылки вместо глубоких копий
    const totalCells = mapSize.width * mapSize.height;
    const isVeryLargeMap = totalCells > 40000;
    
    if (isVeryLargeMap) {
      // Для очень больших карт просто сохраняем ссылку на текущее состояние
      setRedoStack([...redoStack, mapData]);
    } else {
      // Для карт обычного размера делаем неглубокую копию массива
      const mapDataCopy = mapData.map(row => [...row]);
      setRedoStack([...redoStack, mapDataCopy]);
    }
    
    setUndoStack(newUndoStack);
    setMapData(prevState);
  };

  // Redo undone action
  const redo = () => {
    if (redoStack.length === 0) return;
    
    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, redoStack.length - 1);
    
    // Для очень больших карт используем ссылки вместо глубоких копий
    const totalCells = mapSize.width * mapSize.height;
    const isVeryLargeMap = totalCells > 40000;
    
    if (isVeryLargeMap) {
      // Для очень больших карт просто сохраняем ссылку на текущее состояние
      setUndoStack([...undoStack, mapData]);
    } else {
      // Для карт обычного размера делаем неглубокую копию массива
      const mapDataCopy = mapData.map(row => [...row]);
      setUndoStack([...undoStack, mapDataCopy]);
    }
    
    setRedoStack(newRedoStack);
    setMapData(nextState);
  };

  // Update cell function
  const updateCell = (row: number, col: number) => {
    const newMapData = updateCells(
      mapData, 
      row, 
      col, 
      mapSize, 
      selectedTool, 
      selectedHeight, 
      brushSize,
      selectedBrushType,
      selectedBrushType === 'soft' ? softBrushSettings : undefined
    );
    saveState(newMapData);
  };

  // Функция для отложенного обновления ячейки с троттлингом
  const throttledUpdateCell = useCallback((row: number, col: number) => {
    const now = Date.now();
    const totalCells = mapSize.width * mapSize.height;
    const isVeryLargeMap = totalCells > 40000;
    
    // Для очень больших карт применяем троттлинг
    if (isVeryLargeMap) {
      // Минимальный интервал между обновлениями (мс)
      const throttleInterval = 50;
      
      // Если прошло достаточно времени с последнего обновления
      if (now - lastDrawTime.current >= throttleInterval) {
        // Обновляем ячейку
        updateCell(row, col);
        lastDrawTime.current = now;
        
        // Очищаем таймер, если он был установлен
        if (drawThrottleTimeout.current) {
          clearTimeout(drawThrottleTimeout.current);
          drawThrottleTimeout.current = null;
        }
      } else if (!drawThrottleTimeout.current) {
        // Устанавливаем таймер для отложенного обновления
        drawThrottleTimeout.current = setTimeout(() => {
          updateCell(row, col);
          lastDrawTime.current = Date.now();
          drawThrottleTimeout.current = null;
        }, throttleInterval - (now - lastDrawTime.current));
      }
    } else {
      // Для карт обычного размера обновляем сразу
      updateCell(row, col);
    }
  }, [mapSize, updateCell]);
  
  // Обновляем обработчики событий мыши для использования троттлинга
  const handleMouseDown = useCallback((row: number, col: number) => {
    setIsDrawing(true);
    throttledUpdateCell(row, col);
  }, [throttledUpdateCell]);
  
  const handleMouseUp = () => {
    setIsDrawing(false);
  };
  
  const handleMouseOver = useCallback((row: number, col: number, e: ReactMouseEvent<Element> | MouseEvent) => {
    if (isDrawing) {
      throttledUpdateCell(row, col);
    }
    
    // Показываем подсказку
    const cell = mapData[row][col];
    const terrainType = terrainTypes.find(t => t.id === cell.type);
    setTooltipContent(`${terrainType?.name || 'Неизвестно'} (Высота: ${cell.height})`);
    
    // Получаем координаты для подсказки
    let clientX, clientY;
    if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      // Если это не событие мыши с clientX/Y, используем значения по умолчанию
      clientX = 0;
      clientY = 0;
    }
    
    setTooltipPosition({ x: clientX, y: clientY });
    setShowTooltip(true);
  }, [isDrawing, mapData, terrainTypes, throttledUpdateCell]);
  
  const handleMouseOut = () => {
    setShowTooltip(false);
  };

  // Функция для рендеринга карты на Canvas с виртуализацией
  const renderMapToCanvas = useCallback(() => {
    if (!canvasRef.current || !mapData.length) {
      console.error('Canvas не найден или данные карты пусты');
      setCanvasError(true);
      return;
    }
    
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Не удалось получить контекст Canvas');
        setCanvasError(true);
        return;
      }
      
      // Сбрасываем флаг ошибки, если Canvas работает
      setCanvasError(false);
      
      // Очищаем canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Получаем видимую область
      const { startRow, startCol, endRow, endCol } = calculateVisibleMapArea();
      
      // Рисуем только видимые ячейки
      for (let row = startRow; row < endRow; row++) {
        for (let col = startCol; col < endCol; col++) {
          if (!mapData[row] || !mapData[row][col]) continue;
          
          const cell = mapData[row][col];
          const terrainType = terrainTypes.find(t => t.id === cell.type);
          
          // Позиция и размер ячейки с учетом смещения видимой области
          const x = col * cellSize + viewportOffset.x;
          const y = row * cellSize + viewportOffset.y;
          
          // Рисуем фон ячейки
          ctx.fillStyle = terrainType?.color || '#CCCCCC';
          ctx.fillRect(x, y, cellSize, cellSize);
          
          // Применяем яркость в зависимости от высоты
          ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + 0.1 * (cell.height / 10)})`;
          ctx.fillRect(x, y, cellSize, cellSize);
          
          // Рисуем границу ячейки только если ячейки достаточно большие
          if (cellSize >= 3) {
            ctx.strokeStyle = '#AAAAAA';
            ctx.lineWidth = cellSize >= 8 ? 1 : 0.5;
            ctx.strokeRect(x, y, cellSize, cellSize);
          }
          
          // Рисуем номер высоты, если нужно и ячейки достаточно большие
          if (showHeightNumbers && cellSize >= 8) {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `bold ${Math.max(cellSize/2 - 1, 4)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.lineWidth = 2;
            ctx.strokeText(cell.height.toString(), x + cellSize/2, y + cellSize/2);
            ctx.fillText(cell.height.toString(), x + cellSize/2, y + cellSize/2);
          }
          
          // Выделяем ячейку под курсором
          if (hoveredCell && hoveredCell.row === row && hoveredCell.col === col) {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, cellSize, cellSize);
          }
        }
      }
      
      // Рисуем мини-карту для навигации
      if (mapSize.width > 100 || mapSize.height > 100) {
        const miniMapSize = 150;
        const miniMapScale = Math.min(
          miniMapSize / (mapSize.width * cellSize),
          miniMapSize / (mapSize.height * cellSize)
        );
        
        const miniMapWidth = mapSize.width * cellSize * miniMapScale;
        const miniMapHeight = mapSize.height * cellSize * miniMapScale;
        
        // Фон мини-карты
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(canvas.width - miniMapWidth - 10, 10, miniMapWidth, miniMapHeight);
        
        // Рисуем упрощенную карту
        for (let row = 0; row < mapSize.height; row += 4) {
          for (let col = 0; col < mapSize.width; col += 4) {
            if (!mapData[row] || !mapData[row][col]) continue;
            
            const cell = mapData[row][col];
            const terrainType = terrainTypes.find(t => t.id === cell.type);
            
            const x = canvas.width - miniMapWidth - 10 + col * cellSize * miniMapScale;
            const y = 10 + row * cellSize * miniMapScale;
            const size = Math.max(1, cellSize * miniMapScale * 4);
            
            ctx.fillStyle = terrainType?.color || '#CCCCCC';
            ctx.fillRect(x, y, size, size);
          }
        }
        
        // Рисуем рамку видимой области
        const viewportRectX = canvas.width - miniMapWidth - 10 - (viewportOffset.x * miniMapScale);
        const viewportRectY = 10 - (viewportOffset.y * miniMapScale);
        const viewportRectWidth = viewportSize.width * miniMapScale;
        const viewportRectHeight = viewportSize.height * miniMapScale;
        
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          viewportRectX,
          viewportRectY,
          viewportRectWidth,
          viewportRectHeight
        );
      }
    } catch (error) {
      console.error('Ошибка при рендеринге Canvas:', error);
      setCanvasError(true);
    }
  }, [
    mapData, 
    cellSize, 
    showHeightNumbers, 
    hoveredCell, 
    terrainTypes, 
    viewportOffset, 
    viewportSize, 
    mapSize
  ]);
  
  // Обновляем ref при изменении функции
  useEffect(() => {
    renderMapToCanvasRef.current = renderMapToCanvas;
  }, [renderMapToCanvas]);
  
  // Объявляем centerViewport, используя ref для доступа к renderMapToCanvas
  const centerViewport = useCallback(() => {
    if (!useCanvasRenderer || !canvasRef.current) {
      console.log('Центрирование невозможно: Canvas не активен или не найден');
      return;
    }
    
    console.log('Центрирование видимой области');
    
    // Вычисляем центральное смещение
    const totalMapWidth = mapSize.width * cellSize;
    const totalMapHeight = mapSize.height * cellSize;
    
    // Если карта меньше viewport, центрируем её
    if (totalMapWidth <= viewportSize.width) {
      const centerX = (viewportSize.width - totalMapWidth) / 2;
      setViewportOffset(prev => ({ ...prev, x: centerX }));
    } else {
      // Иначе устанавливаем смещение, чтобы показать центр карты
      const centerX = Math.min(0, -(totalMapWidth - viewportSize.width) / 2);
      setViewportOffset(prev => ({ ...prev, x: centerX }));
    }
    
    if (totalMapHeight <= viewportSize.height) {
      const centerY = (viewportSize.height - totalMapHeight) / 2;
      setViewportOffset(prev => ({ ...prev, y: centerY }));
    } else {
      const centerY = Math.min(0, -(totalMapHeight - viewportSize.height) / 2);
      setViewportOffset(prev => ({ ...prev, y: centerY }));
    }
    
    // Сбрасываем состояние перетаскивания
    isDraggingViewport.current = false;
    lastDragPosition.current = null;
    
    // Перерисовываем карту
    setTimeout(() => renderMapToCanvasRef.current(), 0);
  }, [useCanvasRenderer, mapSize, cellSize, viewportSize]);
  
  // Обновляем функцию создания карты, чтобы показывать индикатор загрузки
  const createMap = useCallback(() => {
    const totalCells = mapSize.width * mapSize.height;
    
    // Для больших карт показываем индикатор загрузки
    if (totalCells > 10000) {
      setIsLoading(true);
      setLoadingMessage('Создание карты...');
      
      // Используем setTimeout, чтобы дать браузеру время для обновления UI
      setTimeout(() => {
        const newMapData = createEmptyMap(mapSize);
        setMapData(newMapData);
        setCellSize(calculateCellSize(mapSize));
        setStep('edit');
        setIsLoading(false);
        
        // Центрируем видимую область после создания карты
        if (useCanvasRenderer) {
          setTimeout(() => centerViewport(), 100);
        }
      }, 100);
    } else {
      // Для карт обычного размера создаем сразу
      const newMapData = createEmptyMap(mapSize);
      setMapData(newMapData);
      setCellSize(calculateCellSize(mapSize));
      setStep('edit');
      
      // Центрируем видимую область после создания карты
      if (useCanvasRenderer) {
        setTimeout(() => centerViewport(), 100);
      }
    }
  }, [mapSize, useCanvasRenderer, centerViewport]);

  // Обновляем функцию fillAll для больших карт
  const fillAll = useCallback(() => {
    const totalCells = mapSize.width * mapSize.height;
    
    // Для больших карт показываем индикатор загрузки
    if (totalCells > 10000) {
      setIsLoading(true);
      setLoadingMessage('Заполнение карты...');
      
      // Используем setTimeout, чтобы дать браузеру время для обновления UI
      setTimeout(() => {
        const newMapData = fillMap(mapData, mapSize, selectedTool, selectedHeight);
        saveState(newMapData);
        setIsLoading(false);
      }, 100);
    } else {
      // Для карт обычного размера заполняем сразу
      const newMapData = fillMap(mapData, mapSize, selectedTool, selectedHeight);
      saveState(newMapData);
    }
  }, [mapData, mapSize, selectedTool, selectedHeight, saveState]);
  
  // Обновляем функцию randomFill для больших карт
  const randomFill = useCallback(() => {
    const totalCells = mapSize.width * mapSize.height;
    
    // Для больших карт показываем индикатор загрузки
    if (totalCells > 10000) {
      setIsLoading(true);
      setLoadingMessage('Генерация случайного ландшафта...');
      
      // Используем setTimeout, чтобы дать браузеру время для обновления UI
      setTimeout(() => {
        const newMapData = generateRandomTerrain(mapSize, generationParams);
        saveState(newMapData);
        setIsLoading(false);
      }, 100);
    } else {
      // Для карт обычного размера генерируем сразу
      const newMapData = generateRandomTerrain(mapSize, generationParams);
      saveState(newMapData);
    }
  }, [mapSize, generationParams, saveState]);

  // Export to JSON
  const exportToJSON = () => {
    try {
      // Toggle JSON display mode
      setShowJsonExport(true);
    } catch (error) {
      console.error('Error exporting map:', error);
      alert('An error occurred while exporting the map.');
    }
  };

  // Функция для определения видимой области карты без зависимости от useCallback
  function calculateVisibleMapArea() {
    // Проверяем, что размеры viewport и cellSize корректны
    if (viewportSize.width <= 0 || viewportSize.height <= 0 || cellSize <= 0) {
      return { 
        startRow: 0, 
        startCol: 0, 
        endRow: Math.min(50, mapSize.height), 
        endCol: Math.min(50, mapSize.width) 
      };
    }
    
    // Исправляем расчет видимой области
    // Проблема была в том, что при отрицательном viewportOffset формулы давали некорректные результаты
    
    // Ограничиваем смещение видимой области, чтобы предотвратить бесконечный рост
    const maxOffsetX = Math.max(0, mapSize.width * cellSize - viewportSize.width);
    const maxOffsetY = Math.max(0, mapSize.height * cellSize - viewportSize.height);
    
    // Нормализуем смещение, чтобы оно не выходило за пределы карты
    const normalizedOffsetX = Math.max(-viewportSize.width + cellSize, Math.min(maxOffsetX, -viewportOffset.x));
    const normalizedOffsetY = Math.max(-viewportSize.height + cellSize, Math.min(maxOffsetY, -viewportOffset.y));
    
    // Вычисляем границы видимой области с учетом нормализованного смещения
    const startCol = Math.max(0, Math.floor(normalizedOffsetX / cellSize));
    const startRow = Math.max(0, Math.floor(normalizedOffsetY / cellSize));
    
    // Вычисляем конечные индексы с учетом размера viewport
    const visibleCols = Math.ceil(viewportSize.width / cellSize) + 1; // +1 для учета частично видимых ячеек
    const visibleRows = Math.ceil(viewportSize.height / cellSize) + 1;
    
    const endCol = Math.min(mapSize.width, startCol + visibleCols);
    const endRow = Math.min(mapSize.height, startRow + visibleRows);
    
    // Логируем для отладки
    console.log('Visible area:', { startRow, startCol, endRow, endCol, 
      viewportOffset, normalizedOffset: { x: normalizedOffsetX, y: normalizedOffsetY },
      visibleCells: { cols: visibleCols, rows: visibleRows }
    });
    
    return { startRow, startCol, endRow, endCol };
  }
  
  // Обновляем размер видимой области при изменении размера контейнера
  useEffect(() => {
    if (mapContainerRef.current) {
      const updateViewportSize = () => {
        const container = mapContainerRef.current;
        if (container) {
          // Устанавливаем начальные размеры viewport
          const newWidth = container.clientWidth || 800;
          const newHeight = container.clientHeight || 600;
          
          setViewportSize({
            width: newWidth,
            height: newHeight
          });
          
          // Обновляем размеры canvas, если он существует
          if (canvasRef.current) {
            canvasRef.current.width = newWidth;
            canvasRef.current.height = newHeight;
            
            // Перерисовываем карту после изменения размеров
            if (useCanvasRenderer) {
              renderMapToCanvasRef.current();
            }
          }
        }
      };
      
      // Вызываем сразу и добавляем небольшую задержку для корректной инициализации
      updateViewportSize();
      const timeoutId = setTimeout(updateViewportSize, 100);
      
      // Добавляем слушатель изменения размера окна
      window.addEventListener('resize', updateViewportSize);
      
      return () => {
        window.removeEventListener('resize', updateViewportSize);
        clearTimeout(timeoutId);
      };
    }
  }, [useCanvasRenderer, renderMapToCanvasRef]);
  
  // Обработчики для перемещения видимой области карты
  const handleCanvasMouseDownForDrag = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Если нажата средняя кнопка мыши или зажат пробел
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      isDraggingViewport.current = true;
      lastDragPosition.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, []);
  
  const handleCanvasMouseMoveForDrag = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingViewport.current && lastDragPosition.current) {
      const dx = e.clientX - lastDragPosition.current.x;
      const dy = e.clientY - lastDragPosition.current.y;
      
      // Вычисляем максимально допустимые смещения
      const maxOffsetX = Math.max(0, mapSize.width * cellSize - viewportSize.width);
      const maxOffsetY = Math.max(0, mapSize.height * cellSize - viewportSize.height);
      
      // Обновляем смещение с ограничениями
      setViewportOffset(prev => {
        // Новые значения смещения с учетом ограничений
        const newX = Math.min(0, Math.max(-maxOffsetX, prev.x + dx));
        const newY = Math.min(0, Math.max(-maxOffsetY, prev.y + dy));
        
        // Логируем для отладки
        console.log('Drag update:', { 
          dx, dy, 
          prevOffset: prev, 
          newOffset: { x: newX, y: newY },
          maxOffset: { x: maxOffsetX, y: maxOffsetY }
        });
        
        return { x: newX, y: newY };
      });
      
      lastDragPosition.current = { x: e.clientX, y: e.clientY };
    }
  }, [mapSize, cellSize, viewportSize]);
  
  const handleCanvasMouseUpForDrag = useCallback(() => {
    isDraggingViewport.current = false;
    lastDragPosition.current = null;
  }, []);
  
  // Обновляем обработчики событий для Canvas с учетом виртуализации
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !mapData.length) return;
    
    // Если это перетаскивание видимой области, обрабатываем отдельно
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      handleCanvasMouseDownForDrag(e);
      return;
    }
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Определяем ячейку по координатам с учетом смещения
    const col = Math.floor((x - viewportOffset.x) / cellSize);
    const row = Math.floor((y - viewportOffset.y) / cellSize);
    
    // Проверяем, что ячейка находится в пределах карты
    if (row >= 0 && row < mapSize.height && col >= 0 && col < mapSize.width) {
      handleMouseDown(row, col);
    }
  }, [
    canvasRef, 
    mapData, 
    viewportOffset, 
    cellSize, 
    mapSize, 
    handleMouseDown, 
    handleCanvasMouseDownForDrag
  ]);
  
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !mapData.length) return;
    
    // Если это перетаскивание видимой области, обрабатываем отдельно
    if (isDraggingViewport.current) {
      handleCanvasMouseMoveForDrag(e);
      return;
    }
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Определяем ячейку по координатам с учетом смещения
    const col = Math.floor((x - viewportOffset.x) / cellSize);
    const row = Math.floor((y - viewportOffset.y) / cellSize);
    
    // Проверяем, что ячейка находится в пределах карты
    if (row >= 0 && row < mapSize.height && col >= 0 && col < mapSize.width) {
      setHoveredCell({row, col});
      
      if (isDrawing) {
        handleMouseOver(row, col, e);
      }
      
      // Показываем подсказку
      const cell = mapData[row][col];
      const terrainType = terrainTypes.find(t => t.id === cell.type);
      setTooltipContent(`${terrainType?.name || 'Неизвестно'} (Высота: ${cell.height})`);
      setTooltipPosition({ x: e.clientX, y: e.clientY });
      setShowTooltip(true);
    } else {
      setHoveredCell(null);
      setShowTooltip(false);
    }
  }, [
    canvasRef, 
    mapData, 
    viewportOffset, 
    cellSize, 
    mapSize, 
    isDrawing, 
    handleMouseOver, 
    handleCanvasMouseMoveForDrag
  ]);
  
  const handleCanvasMouseOut = useCallback(() => {
    setHoveredCell(null);
    setShowTooltip(false);
    handleMouseUp();
    handleCanvasMouseUpForDrag();
  }, [handleMouseUp, handleCanvasMouseUpForDrag]);
  
  // Автоматически включаем Canvas для больших карт и устанавливаем меньший размер ячеек
  useEffect(() => {
    // Если карта больше определенного размера, используем Canvas и уменьшаем размер ячеек
    const totalCells = mapSize.width * mapSize.height;
    
    if (totalCells > 10000) {
      console.log('Автоматически включаем Canvas для большой карты', { totalCells });
      setUseCanvasRenderer(true);
      
      // Для очень больших карт устанавливаем меньший размер ячеек
      if (totalCells > 40000) {
        setCellSize(Math.min(cellSize, 4));
      } else if (totalCells > 20000) {
        setCellSize(Math.min(cellSize, 6));
      }
    }
    
    // Устанавливаем размеры canvas
    if (canvasRef.current && viewportSize.width > 0 && viewportSize.height > 0) {
      console.log('Устанавливаем размеры canvas', { 
        width: viewportSize.width, 
        height: viewportSize.height 
      });
      
      canvasRef.current.width = viewportSize.width;
      canvasRef.current.height = viewportSize.height;
      
      // Перерисовываем карту после изменения размеров
      if (useCanvasRenderer) {
        console.log('Перерисовываем карту после изменения размеров');
        setTimeout(() => renderMapToCanvasRef.current(), 0);
      }
    } else {
      console.log('Не удалось установить размеры canvas', { 
        canvasExists: !!canvasRef.current,
        viewportWidth: viewportSize.width,
        viewportHeight: viewportSize.height
      });
    }
  }, [mapSize, cellSize, viewportSize, useCanvasRenderer, renderMapToCanvasRef]);

  // Добавляем отдельный эффект для принудительного обновления canvas при изменении режима рендеринга
  useEffect(() => {
    if (useCanvasRenderer) {
      console.log('Режим Canvas включен, обновляем canvas');
      
      // Небольшая задержка для уверенности, что DOM обновился
      const timeoutId = setTimeout(() => {
        if (canvasRef.current) {
          console.log('Обновляем размеры canvas после включения режима Canvas');
          canvasRef.current.width = viewportSize.width || 800;
          canvasRef.current.height = viewportSize.height || 600;
          
          // Автоматически центрируем видимую область при включении Canvas
          centerViewport();
        } else {
          console.error('Canvas элемент не найден после включения режима Canvas');
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [useCanvasRenderer, viewportSize, renderMapToCanvasRef, centerViewport]);

  // Добавляем эффект для центрирования при изменении размера карты
  useEffect(() => {
    if (useCanvasRenderer && mapData.length > 0) {
      // Центрируем видимую область при изменении размера карты
      console.log('Размер карты изменился, центрируем видимую область');
      centerViewport();
    }
  }, [mapSize, useCanvasRenderer, mapData.length, centerViewport]);

  // Добавляем функцию для принудительного обновления Canvas, используя ref
  const forceCanvasUpdate = useCallback(() => {
    if (!useCanvasRenderer || !canvasRef.current) {
      console.log('Принудительное обновление Canvas невозможно: Canvas не активен или не найден');
      return;
    }
    
    console.log('Принудительное обновление Canvas');
    
    // Обновляем размеры canvas
    if (mapContainerRef.current) {
      const container = mapContainerRef.current;
      const newWidth = container.clientWidth || 800;
      const newHeight = container.clientHeight || 600;
      
      canvasRef.current.width = newWidth;
      canvasRef.current.height = newHeight;
      
      setViewportSize({
        width: newWidth,
        height: newHeight
      });
    }
    
    // Сбрасываем смещение видимой области
    setViewportOffset({ x: 0, y: 0 });
    
    // Сбрасываем состояние перетаскивания
    isDraggingViewport.current = false;
    lastDragPosition.current = null;
    
    // Сбрасываем флаг ошибки Canvas
    setCanvasError(false);
    
    // Перерисовываем карту
    setTimeout(() => renderMapToCanvasRef.current(), 0);
  }, [useCanvasRenderer]);

  // Обновляем canvas при изменении данных или видимой области
  useEffect(() => {
    if (useCanvasRenderer) {
      renderMapToCanvasRef.current();
    }
  }, [
    useCanvasRenderer, 
    viewportOffset, 
    viewportSize
  ]);

  // Добавляем эффект для обновления canvas при изменении данных карты
  useEffect(() => {
    if (useCanvasRenderer && mapData.length > 0) {
      console.log('Данные карты изменились, обновляем canvas');
      renderMapToCanvasRef.current();
    }
  }, [useCanvasRenderer, mapData]);

  // ===== EFFECTS =====

  // Initialize map and hotkeys
  useEffect(() => {
    if (step === 'edit' && mapData.length === 0) {
      const newMapData = createEmptyMap(mapSize);
      setMapData(newMapData);
      setUndoStack([]);
      setRedoStack([]);
      
      // Automatically adapt cell size for large maps
      const newCellSize = calculateCellSize(mapSize);
      setCellSize(newCellSize);
    }
    
    // Add key handlers for undo/redo
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        undo();
        e.preventDefault();
      } else if (e.ctrlKey && e.key === 'y') {
        redo();
        e.preventDefault();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [step, mapSize]);

  // Handle 3D scene
  useEffect(() => {
    if (show3DPreview && threeContainer.current) {
      // Create THREE.js scene
      const threeSetup = setupThreeScene(threeContainer.current, mapSize);
      scene.current = threeSetup.scene;
      camera.current = threeSetup.camera;
      renderer.current = threeSetup.renderer;
      
      // Setup camera controls
      setupCameraControls(renderer.current, camera.current, mapSize);
      
      // Create 3D map model
      createMapMesh(scene.current, mapData, mapSize);
      
      // Create animation loop
      const animate = () => {
        if (!show3DPreview) return;
        
        requestAnimationFrame(animate);
        
        if (renderer.current && scene.current && camera.current) {
          renderer.current.render(scene.current, camera.current);
        }
      };
      
      // Start animation
      animate();
      
      // Cleanup when unmounting
      return () => {
        cleanupThreeResources(threeContainer.current, scene.current, renderer.current);
        scene.current = null;
        camera.current = null;
        renderer.current = null;
      };
    }
  }, [show3DPreview, mapSize]);

  // Update 3D model when map data changes
  useEffect(() => {
    if (show3DPreview && scene.current) {
      try {
        createMapMesh(scene.current, mapData, mapSize);
      } catch (error) {
        console.error("Error creating 3D model:", error);
      }
    }
  }, [mapData, show3DPreview]);

  // Мемоизируем поиск типа территории для улучшения производительности
  const getTerrainType = useCallback((typeId: string) => {
    return terrainTypes.find(t => t.id === typeId);
  }, [terrainTypes]);
  
  // Мемоизируем рендеринг ячейки для DOM-рендерера
  const renderCell = useCallback((cell: Cell, rowIndex: number, colIndex: number) => {
    const terrainType = getTerrainType(cell.type);
    
    return (
      <div
        key={`${rowIndex}-${colIndex}`}
        className="relative border border-gray-300 flex items-center justify-center select-none transition-all hover:z-10 hover:shadow-md"
        style={{ 
          width: `${cellSize}px`,
          height: `${cellSize}px`,
          backgroundImage: `url(${terrainType?.texture || ''})`,
          backgroundSize: 'cover',
          filter: `brightness(${0.8 + 0.2 * (cell.height / 10)})`
        }}
        onMouseDown={(e) => handleMouseDown(rowIndex, colIndex)}
        onMouseUp={handleMouseUp}
        onMouseOver={(e) => handleMouseOver(rowIndex, colIndex, e)}
        onMouseOut={handleMouseOut}
        title={`${terrainType?.name || 'Неизвестно'} (Высота: ${cell.height})`}
      >
        {showHeightNumbers && cellSize >= 8 && (
          <span 
            className="absolute inset-0 flex items-center justify-center font-bold select-none pointer-events-none" 
            style={{ 
              color: '#FFF',
              textShadow: '1px 1px 1px rgba(0,0,0,0.8), -1px -1px 1px rgba(0,0,0,0.8), 1px -1px 1px rgba(0,0,0,0.8), -1px 1px 1px rgba(0,0,0,0.8)',
              fontSize: `${Math.max(cellSize/2 - 1, 4)}px`
            }}
          >
            {cell.height}
          </span>
        )}
      </div>
    );
  }, [cellSize, showHeightNumbers, getTerrainType, handleMouseDown, handleMouseUp, handleMouseOver, handleMouseOut]);
  
  // Мемоизируем стили для контейнера карты
  const mapContainerStyle = useMemo(() => ({
    gridTemplateColumns: `repeat(${mapSize.width}, ${cellSize}px)`,
    width: `${mapSize.width * cellSize}px`,
    height: `${mapSize.height * cellSize}px`
  }), [mapSize.width, mapSize.height, cellSize]);
  
  // Модифицируем рендеринг карты с использованием мемоизации
  const renderMap = useCallback(() => {
    if (useCanvasRenderer && !canvasError) {
      // Добавляем отладочную информацию
      console.log('Rendering with Canvas', {
        viewportSize,
        mapSize,
        cellSize,
        canvasExists: !!canvasRef.current
      });
      
      return (
        <>
          <canvas
            ref={canvasRef}
            width={viewportSize.width || 800}
            height={viewportSize.height || 600}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleMouseUp}
            onMouseOut={handleCanvasMouseOut}
            onMouseLeave={handleCanvasMouseUpForDrag}
            className="border border-gray-300 shadow-inner"
            style={{ cursor: isDraggingViewport.current ? 'grabbing' : 'pointer' }}
          />
          {/* Добавляем информацию о режиме Canvas */}
          <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white p-2 rounded text-xs">
            <p>Canvas режим активен</p>
            <p>Размер карты: {mapSize.width}x{mapSize.height}</p>
            <p>Размер ячейки: {cellSize}px</p>
            <p>Видимая область: {viewportSize.width}x{viewportSize.height}</p>
          </div>
        </>
      );
    } else {
      // Если Canvas не работает, но режим Canvas включен, показываем предупреждение
      if (useCanvasRenderer && canvasError) {
        console.warn('Canvas режим включен, но произошла ошибка. Используем DOM-рендеринг');
      }
      
      // Стандартный рендеринг через DOM для небольших карт или при ошибке Canvas
      return (
        <div 
          className="grid grid-flow-row auto-rows-auto gap-0 overflow-auto"
          style={mapContainerStyle}
        >
          {canvasError && useCanvasRenderer && (
            <div className="absolute top-2 left-2 bg-red-500 bg-opacity-80 text-white p-2 rounded text-xs z-10">
              <p>Ошибка Canvas-рендеринга. Используется резервный DOM-рендеринг.</p>
              <p>Это может быть медленно для больших карт.</p>
            </div>
          )}
          {mapData.map((row, rowIndex) => 
            row.map((cell, colIndex) => renderCell(cell, rowIndex, colIndex))
          )}
        </div>
      );
    }
  }, [
    useCanvasRenderer, 
    canvasError,
    viewportSize,
    handleCanvasMouseDown, 
    handleCanvasMouseMove, 
    handleMouseUp, 
    handleCanvasMouseOut,
    handleCanvasMouseUpForDrag,
    isDraggingViewport,
    mapData,
    renderCell,
    mapContainerStyle,
    mapSize,
    cellSize
  ]);

  // ===== RENDER HELPER COMPONENTS =====

  // Render size selection interface
  const renderSizeStep = useCallback(() => (
    <div className="flex flex-col items-center space-y-6 p-4 pt-8">
      <h2 className="text-2xl font-bold">Задайте размер карты</h2>
      
      <div className="grid grid-cols-2 gap-6 w-full max-w-lg p-6 bg-white rounded-lg shadow-md">
        <div className="flex flex-col">
          <label htmlFor="width" className="text-sm font-medium mb-2">Ширина:</label>
          <input
            id="width"
            type="number"
            min="4"
            max="512"
            value={mapSize.width}
            onChange={(e) => setMapSize({...mapSize, width: parseInt(e.target.value) || 32})}
            className="border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
        </div>
        
        <div className="flex flex-col">
          <label htmlFor="height" className="text-sm font-medium mb-2">Высота:</label>
          <input
            id="height"
            type="number"
            min="4"
            max="512"
            value={mapSize.height}
            onChange={(e) => setMapSize({...mapSize, height: parseInt(e.target.value) || 32})}
            className="border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
        </div>
        
        <div className="col-span-2 mt-2">
          <p className="text-sm text-gray-600 mb-2">Выберите размер вашей карты. Для больших карт размер клеток будет автоматически уменьшен для удобства.</p>
          {mapSize.width * mapSize.height > 40000 && (
            <p className="text-sm text-amber-600 font-medium">
              Внимание: Вы создаете очень большую карту ({mapSize.width}x{mapSize.height} = {mapSize.width * mapSize.height} ячеек).
              Это может повлиять на производительность.
            </p>
          )}
        </div>
        
        <div className="col-span-2 flex justify-center">
          <button
            onClick={createMap}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded shadow-md transition-colors transform hover:scale-105 active:scale-95"
          >
            Создать карту
          </button>
        </div>
      </div>
      
      <div className="mt-6 text-center text-gray-600">
        <p>Вы всегда можете изменить размер карты позже, нажав кнопку "Изменить размер карты"</p>
      </div>
    </div>
  ), [mapSize, createMap]);

  // Компонент настроек мягкой кисти
  const SoftBrushSettingsDialog = () => {
    const [localSettings, setLocalSettings] = useState<SoftBrushSettings>(softBrushSettings);
    
    const handleSave = () => {
      setSoftBrushSettings(localSettings);
      setShowBrushSettings(false);
    };
    
    const handleCancel = () => {
      setShowBrushSettings(false);
    };
    
    return (
      <div className="dialog-overlay">
        <div className="dialog">
          <h2>Настройки мягкой кисти</h2>
          
          <div className="form-group">
            <label>Тип убывания:</label>
            <select 
              value={localSettings.falloffType} 
              onChange={(e) => setLocalSettings({...localSettings, falloffType: e.target.value as SoftBrushSettings['falloffType']})}
            >
              <option value="linear">Линейный</option>
              <option value="quadratic">Квадратичный</option>
              <option value="gaussian">Гауссов</option>
              <option value="plateau">Плато</option>
            </select>
          </div>
          
          {/* Визуализация типов мягкой кисти */}
          <div className="brush-preview">
            <div className="brush-preview-item">
              <div className={`brush-preview-image ${localSettings.falloffType}`}></div>
              <div className="brush-preview-label">Профиль кисти</div>
            </div>
          </div>
          
          <div className="form-group">
            <label>Сила эффекта: {localSettings.strength.toFixed(1)}</label>
            <input 
              type="range" 
              min="0.1" 
              max="1" 
              step="0.1" 
              value={localSettings.strength} 
              onChange={(e) => setLocalSettings({...localSettings, strength: parseFloat(e.target.value)})}
            />
          </div>
          
          <div className="form-group">
            <label>
              <input 
                type="checkbox" 
                checked={localSettings.preserveTerrainType} 
                onChange={(e) => setLocalSettings({...localSettings, preserveTerrainType: e.target.checked})}
              />
              Сохранять тип территории
            </label>
          </div>
          
          <div className="dialog-buttons">
            <button onClick={handleSave}>Сохранить</button>
            <button onClick={handleCancel}>Отмена</button>
          </div>
        </div>
      </div>
    );
  };

  // Рендер панели инструментов
  const renderToolbar = () => {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-4">
          {/* Типы территорий */}
          <div className="tool-section">
            <h3>Типы территорий</h3>
            <div className="flex items-center space-x-2">
              {terrainTypes.map(terrain => (
                <button
                  key={terrain.id}
                  className={`w-8 h-8 rounded border-2 transition-all transform ${selectedTool === terrain.id ? 'border-black scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ 
                    backgroundImage: `url(${terrain.texture})`,
                    backgroundSize: 'cover'
                  }}
                  onClick={() => setSelectedTool(terrain.id)}
                  title={terrain.name}
                />
              ))}
            </div>
          </div>
          
          {/* Высота */}
          <div className="tool-section">
            <h3>Высота</h3>
            <div className="flex items-center space-x-1">
              <button
                className={`w-8 h-8 rounded border-2 transition-all transform flex items-center justify-center ${selectedTool === 'height' ? 'border-black scale-110 bg-gray-200' : 'border-transparent hover:scale-105 bg-gray-100'}`}
                onClick={() => setSelectedTool('height')}
                title="Инструмент изменения высоты"
              >
                H
              </button>
              
              <select
                value={selectedHeight}
                onChange={(e) => setSelectedHeight(parseInt(e.target.value))}
                className="h-8 rounded border border-gray-300 bg-white"
                disabled={selectedTool !== 'height'}
              >
                {heightLevels.map((level: number) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Размер кисти */}
          <div className="tool-section">
            <h3>Размер кисти: {brushSize}</h3>
            <input
              type="range"
              min="1"
              max="9"
              step="2"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-32"
            />
          </div>
          
          {/* Тип кисти */}
          <div className="tool-section">
            <h3>Тип кисти</h3>
            <div className="brush-types">
              {brushTypes.map(brush => (
                <button
                  key={brush.id}
                  className={`brush-type-btn ${selectedBrushType === brush.id ? 'selected' : ''}`}
                  onClick={() => setSelectedBrushType(brush.id)}
                  title={brush.description}
                >
                  {brush.name}
                </button>
              ))}
            </div>
            
            {selectedBrushType === 'soft' && (
              <button 
                className="brush-settings-btn"
                onClick={() => setShowBrushSettings(true)}
                title="Настройки мягкой кисти"
              >
                Настройки кисти
              </button>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Undo/redo buttons */}
          <div className="flex items-center space-x-1">
            <button
              onClick={undo}
              disabled={undoStack.length === 0}
              className={`px-3 py-1 rounded ${undoStack.length > 0 ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-gray-300 text-gray-500 cursor-not-allowed'} transition-colors`}
              title="Отменить (Ctrl+Z)"
            >
              ↩ Отменить
            </button>
            <button
              onClick={redo}
              disabled={redoStack.length === 0}
              className={`px-3 py-1 rounded ${redoStack.length > 0 ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-gray-300 text-gray-500 cursor-not-allowed'} transition-colors`}
              title="Вернуть (Ctrl+Y)"
            >
              ↪ Вернуть
            </button>
          </div>
          
          {/* Additional actions */}
          <div className="flex items-center space-x-1">
            <button
              onClick={fillAll}
              className="px-3 py-1 rounded bg-purple-500 text-white hover:bg-purple-600 transition-colors"
              title="Заполнить всю карту выбранным типом территории или высотой"
            >
              Заполнить всю карту
            </button>
            <button
              onClick={() => setShowGenerationParams(true)}
              className="px-3 py-1 rounded bg-purple-500 text-white hover:bg-purple-600 transition-colors"
              title="Настроить и создать случайный ландшафт"
            >
              Случайный ландшафт
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ===== MAIN RENDER =====
  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="p-4 bg-gray-800 text-white flex justify-between items-center">
        <h1 className="text-xl font-bold">Редактор карт</h1>
        <div className="flex space-x-2">
          {step === 'edit' && (
            <>
              <button
                onClick={() => setShowHelp(true)}
                className="px-3 py-1 rounded bg-gray-600 text-white hover:bg-gray-500 transition-colors"
                title="Показать справку"
              >
                ?
              </button>
              <button
                onClick={() => {
                  setStep('size');
                  setMapData([]);
                  setShowHeightNumbers(true);
                  setShow3DPreview(false);
                  setUndoStack([]);
                  setRedoStack([]);
                }}
                className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              >
                Изменить размер карты
              </button>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        {step === 'size' && renderSizeStep()}
        {step === 'edit' && !showJsonExport && (
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center p-4 bg-gray-100">
              {/* Toolbar content */}
              {renderToolbar()}
            </div>
            
            <div className="flex items-center justify-between p-2 bg-gray-50 border-t border-b border-gray-200">
              {/* Height settings */}
              <div className="flex items-center space-x-2">
                <button
                  className={`px-3 py-1 rounded ${selectedTool === 'height' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
                  onClick={() => setSelectedTool('height')}
                >
                  Инструмент высоты
                </button>
                
                <div className="flex items-center space-x-1">
                  <span className="whitespace-nowrap">Высота:</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={selectedHeight}
                    onChange={(e) => setSelectedHeight(parseInt(e.target.value))}
                    className="w-32"
                  />
                  <span className="bg-white border rounded px-2 py-1 min-w-[30px] text-center">
                    {selectedHeight}
                  </span>
                </div>
              </div>
              
              {/* Brush size */}
              <div className="flex items-center space-x-1">
                <span className="whitespace-nowrap">Размер кисти:</span>
                <select
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="border rounded p-1 bg-white"
                >
                  <option value="1">1x1</option>
                  <option value="3">3x3</option>
                  <option value="5">5x5</option>
                  <option value="7">7x7</option>
                  <option value="9">9x9</option>
                </select>
                <div 
                  className="border rounded bg-white p-1 relative" 
                  style={{ 
                    width: `${Math.min(42, brushSize * 3 + 10)}px`, 
                    height: `${Math.min(42, brushSize * 3 + 10)}px` 
                  }}
                >
                  <div 
                    className="absolute bg-black rounded-full opacity-50"
                    style={{ 
                      width: `${Math.min(36, brushSize * 3)}px`, 
                      height: `${Math.min(36, brushSize * 3)}px`,
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)'
                    }}
                  ></div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowHeightNumbers(!showHeightNumbers)}
                  className={`px-3 py-1 rounded ${showHeightNumbers ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
                >
                  {showHeightNumbers ? 'Скрыть цифры' : 'Показать цифры'}
                </button>

                <button
                  onClick={() => setShow3DPreview(!show3DPreview)}
                  className={`px-3 py-1 rounded ${show3DPreview ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
                >
                  {show3DPreview ? 'Скрыть 3D' : 'Предпросмотр 3D'}
                </button>
                
                <button
                  onClick={exportToJSON}
                  className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                >
                  Экспорт в JSON
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              <div className="flex h-full">
                <div className={`${show3DPreview ? 'w-1/2' : 'w-full'} h-full overflow-auto`}>
                  <div className="flex flex-col items-center">
                    <div 
                      ref={mapContainerRef}
                      className="relative border rounded shadow-inner overflow-auto"
                    >
                      {renderMap()}
                    </div>
                  </div>
                </div>
                
                {/* 3D preview */}
                {show3DPreview && (
                  <div className="w-1/2 h-full ml-4 border rounded shadow-inner relative">
                    <div ref={threeContainer} className="w-full h-full" />
                    <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-2 rounded text-xs">
                      <p>Управление: удерживайте левую кнопку мыши для вращения</p>
                      <p>Колесо мыши: приближение/удаление</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Legend */}
            <div className="p-4 bg-gray-100">
              <div className="flex justify-between">
                <div>
                  <div className="font-medium mb-2">Легенда территорий:</div>
                  <div className="flex flex-wrap gap-4">
                    {terrainTypes.map(terrain => (
                      <div key={terrain.id} className="flex items-center">
                        <div 
                          className="w-6 h-6 mr-2 border border-gray-400" 
                          style={{ 
                            backgroundImage: `url(${terrain.texture})`,
                            backgroundSize: 'cover'
                          }} 
                        />
                        <span>{terrain.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <div className="font-medium mb-2">Текущий инструмент:</div>
                  <div className="flex items-center">
                    {selectedTool === 'height' ? (
                      <div className="flex items-center">
                        <span className="mr-2">Инструмент высоты (значение: {selectedHeight})</span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <div 
                          className="w-6 h-6 mr-2 border border-gray-400" 
                          style={{ 
                            backgroundImage: `url(${terrainTypes.find(t => t.id === selectedTool)?.texture || ''})`,
                            backgroundSize: 'cover'
                          }} 
                        />
                        <span>{terrainTypes.find(t => t.id === selectedTool)?.name || 'Неизвестно'}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <button
                    onClick={() => {
                      // Decrease cell size
                      setCellSize(Math.max(4, cellSize - 1));
                    }}
                    className="px-2 py-1 rounded bg-gray-200 mr-2 hover:bg-gray-300 transition-colors"
                    title="Уменьшить размер клеток"
                  >
                    −
                  </button>
                  <button
                    onClick={() => {
                      // Increase cell size
                      setCellSize(Math.min(64, cellSize + 1));
                    }}
                    className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 transition-colors"
                    title="Увеличить размер клеток"
                  >
                    +
                  </button>
                  <span className="ml-2">Размер клеток: {cellSize}px</span>
                </div>
              </div>
            </div>
            
            {/* Добавляем переключатель режима рендеринга */}
            <div className="flex items-center space-x-2 mt-2 p-2 bg-gray-100">
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCanvasRenderer}
                  onChange={(e) => setUseCanvasRenderer(e.target.checked)}
                  className="form-checkbox h-4 w-4 text-blue-600"
                />
                <span>Использовать Canvas для рендеринга (быстрее для больших карт)</span>
              </label>
              
              {useCanvasRenderer && (
                <>
                  <button
                    onClick={forceCanvasUpdate}
                    className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors ml-4"
                    title="Принудительно обновить Canvas, если он не отображается корректно"
                  >
                    Обновить Canvas
                  </button>
                  <button
                    onClick={centerViewport}
                    className="px-3 py-1 rounded bg-green-500 text-white hover:bg-green-600 transition-colors ml-2"
                    title="Центрировать видимую область на карте"
                  >
                    Центрировать
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        
        {step === 'edit' && showJsonExport && (
          // JSON export mode
          <div className="w-full h-full flex flex-col p-4">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-xl font-bold">Экспорт JSON</h3>
              <button
                onClick={() => setShowJsonExport(false)}
                className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              >
                Вернуться к редактированию
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-100 p-4 rounded border">
              <pre className="text-sm">{JSON.stringify({
                width: mapSize.width,
                height: mapSize.height,
                data: mapData
              }, null, 2)}</pre>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">
                Скопируйте JSON-код выше и сохраните его в файл с расширением .json на вашем компьютере.
              </p>
              <button
                onClick={() => {
                  const jsonText = JSON.stringify({
                    width: mapSize.width,
                    height: mapSize.height,
                    data: mapData
                  }, null, 2);
                  
                  navigator.clipboard.writeText(jsonText)
                    .then(() => alert('JSON скопирован в буфер обмена!'))
                    .catch(err => alert('Не удалось скопировать: ' + err));
                }}
                className="px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
              >
                Копировать в буфер обмена
              </button>
            </div>
          </div>
        )}
      </div>
      
      {showTooltip && (
        <div 
          className="fixed bg-black bg-opacity-75 text-white rounded px-2 py-1 text-sm pointer-events-none z-50"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y
          }}
        >
          {tooltipContent}
        </div>
      )}
      
      {/* Generation parameters dialog */}
      {showGenerationParams && (
        <GenerationParamsDialog 
          generationParams={generationParams}
          setGenerationParams={setGenerationParams}
          onClose={() => setShowGenerationParams(false)}
          onGenerate={randomFill}
        />
      )}
      
      {/* Help dialog */}
      {showHelp && (
        <HelpDialog onClose={() => setShowHelp(false)} />
      )}
      
      {/* Индикатор загрузки */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-lg font-medium">{loadingMessage}</p>
          </div>
        </div>
      )}
      
      {/* Добавляем диалог настроек мягкой кисти */}
      {showBrushSettings && <SoftBrushSettingsDialog />}
    </div>
  );
};

export default MapEditor;