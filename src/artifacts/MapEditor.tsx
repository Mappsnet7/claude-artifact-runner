import React, { useState, useRef, useEffect, MouseEvent } from 'react';
import * as THREE from 'three';
import { Cell, MapSize, TooltipPosition, GenerationParams } from './types';
import { terrainTypes, DEFAULT_MAP_SIZE, DEFAULT_GENERATION_PARAMS, DEFAULT_CELL_SIZE, DEFAULT_BRUSH_SIZE } from './constants';
import { updateCells, fillMap, createEmptyMap, calculateCellSize } from './utils/mapUtils';
import { generateRandomTerrain } from './utils/terrainGeneration';
import { setupThreeScene, setupCameraControls, createMapMesh, cleanupThreeResources } from './utils/threeUtils';
import GenerationParamsDialog from './components/GenerationParamsDialog';
import HelpDialog from './components/HelpDialog';

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
  
  // Terrain generation parameters
  const [generationParams, setGenerationParams] = useState<GenerationParams>(DEFAULT_GENERATION_PARAMS);
  const [showGenerationParams, setShowGenerationParams] = useState<boolean>(false);

  // ===== REFS =====
  const threeContainer = useRef<HTMLDivElement>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const renderer = useRef<THREE.WebGLRenderer | null>(null);

  // ===== FUNCTIONS =====
  
  // Save state for undo
  const saveState = (newMapData: Cell[][]) => {
    setUndoStack([...undoStack, mapData]);
    setRedoStack([]);
    setMapData(newMapData);
  };

  // Undo last action
  const undo = () => {
    if (undoStack.length === 0) return;
    
    const prevState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, undoStack.length - 1);
    
    setRedoStack([...redoStack, mapData]);
    setUndoStack(newUndoStack);
    setMapData(prevState);
  };

  // Redo undone action
  const redo = () => {
    if (redoStack.length === 0) return;
    
    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, redoStack.length - 1);
    
    setUndoStack([...undoStack, mapData]);
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
      brushSize
    );
    saveState(newMapData);
  };

  // Mouse event handlers
  const handleMouseDown = (row: number, col: number) => {
    setIsDrawing(true);
    updateCell(row, col);
  };
  
  const handleMouseUp = () => {
    setIsDrawing(false);
  };
  
  const handleMouseOver = (row: number, col: number, e: MouseEvent) => {
    if (isDrawing) {
      updateCell(row, col);
    }
    
    // Show cell information
    const cell = mapData[row]?.[col];
    if (cell) {
      const terrainType = terrainTypes.find(t => t.id === cell.type) || { name: 'Неизвестно' };
      setTooltipContent(`${terrainType.name} (Высота: ${cell.height})`);
      setShowTooltip(true);
      setTooltipPosition({ 
        x: e.clientX + 10,
        y: e.clientY + 10
      });
    }
  };
  
  const handleMouseOut = () => {
    setShowTooltip(false);
  };

  // Fill entire map with selected terrain type
  const fillAll = () => {
    const newMapData = fillMap(mapData, mapSize, selectedTool, selectedHeight);
    saveState(newMapData);
  };

  // Random fill the map with procedurally generated terrain
  const randomFill = () => {
    const newMapData = generateRandomTerrain(mapSize, generationParams);
    saveState(newMapData);
  };

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

  // ===== RENDER HELPER COMPONENTS =====

  // Render size selection interface
  const renderSizeStep = () => (
    <div className="flex flex-col items-center space-y-6 p-4 pt-8">
      <h2 className="text-2xl font-bold">Задайте размер карты</h2>
      
      <div className="grid grid-cols-2 gap-6 w-full max-w-lg p-6 bg-white rounded-lg shadow-md">
        <div className="flex flex-col">
          <label htmlFor="width" className="text-sm font-medium mb-2">Ширина:</label>
          <input
            id="width"
            type="number"
            min="4"
            max="128"
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
            max="128"
            value={mapSize.height}
            onChange={(e) => setMapSize({...mapSize, height: parseInt(e.target.value) || 32})}
            className="border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
        </div>
        
        <div className="col-span-2 mt-2">
          <p className="text-sm text-gray-600 mb-2">Выберите размер вашей карты. Для больших карт размер клеток будет автоматически уменьшен для удобства.</p>
        </div>
        
        <div className="col-span-2 flex justify-center">
          <button
            onClick={() => setStep('edit')}
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
  );

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
              <div className="flex items-center space-x-4">
                <div className="font-medium">Типы территорий:</div>
                
                {/* Terrain type selection */}
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
            
            <div className="flex flex-1 p-4 overflow-hidden">
              {/* Main editing area */}
              <div className={`${show3DPreview ? 'w-1/2' : 'w-full'}`}>
                <div className="overflow-auto h-full">
                  <div className="inline-block relative">
                    {/* Top coordinate ruler */}
                    <div className="flex border-b mb-0.5 ml-6">
                      {Array.from({ length: mapSize.width }).map((_, i) => (
                        i % 5 === 0 ? (
                          <div 
                            key={`col-${i}`} 
                            className="flex justify-center items-center text-xs text-gray-500 font-mono"
                            style={{ width: `${cellSize}px`, height: '16px' }}
                          >
                            {i}
                          </div>
                        ) : <div key={`col-${i}`} style={{ width: `${cellSize}px` }}></div>
                      ))}
                    </div>
                    
                    {mapData.map((row, rowIndex) => (
                      <div key={rowIndex} className="flex">
                        {/* Left coordinate ruler */}
                        {rowIndex % 5 === 0 && (
                          <div 
                            className="w-6 flex justify-center items-center text-xs text-gray-500 font-mono"
                            style={{ height: `${cellSize}px` }}
                          >
                            {rowIndex}
                          </div>
                        )}
                        {rowIndex % 5 !== 0 && <div className="w-6"></div>}
                        
                        {row.map((cell, colIndex) => {
                          const terrainType = terrainTypes.find(t => t.id === cell.type);
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
                              onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
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
                        })}
                      </div>
                    ))}
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
    </div>
  );
};

export default MapEditor;