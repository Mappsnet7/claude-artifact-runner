import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Основные типы местности и их цвета
const terrainTypes = [
  { id: 'field', name: 'Поле', color: '#4CAF50', height: 0 },
  { id: 'swamp', name: 'Болото', color: '#1B5E20', height: -0.2 },
  { id: 'hill', name: 'Возвышенность', color: '#F9A825', height: 0.5 },
  { id: 'water', name: 'Вода', color: '#2196F3', height: -0.3 },
  { id: 'forest', name: 'Лес', color: '#33691E', height: 0.2 },
  { id: 'asphalt', name: 'Асфальт', color: '#424242', height: -0.1 }
];

// Основной компонент редактора карт
const HexMapEditor = () => {
  // Состояния для размеров карты
  const [mapSize, setMapSize] = useState({ width: 32, height: 32 });
  const [showSizeInput, setShowSizeInput] = useState(true);
  const [selectedTerrain, setSelectedTerrain] = useState(terrainTypes[0]);
  const [hexMap, setHexMap] = useState<Array<{q: number; r: number; terrainType: string; color: string; height: number}>>([]);
  const [show3DPreview, setShow3DPreview] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [orientation, setOrientation] = useState<'flat' | 'pointy'>('flat');
  
  // Состояния для управления видом 2D карты
  const [viewTransform, setViewTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const threeContainer = useRef<HTMLDivElement>(null);
  const svgContainer = useRef<HTMLDivElement>(null);
  const svgElement = useRef<SVGSVGElement>(null);
  
  // Инициализация карты с классической гексагональной сеткой
  const initializeMap = () => {
    const newMap = [];
    for (let r = 0; r < mapSize.height; r++) {
      for (let q = 0; q < mapSize.width; q++) {
        newMap.push({
          q,
          r,
          terrainType: terrainTypes[0].id,
          color: terrainTypes[0].color,
          height: terrainTypes[0].height
        });
      }
    }
    setHexMap(newMap);
    setShowSizeInput(false);
    // Сбрасываем трансформацию при создании новой карты
    setViewTransform({ scale: 1, x: 0, y: 0 });
  };
  
  // Расчет позиции хекса с учетом ориентации
  const getHexPosition = (q: number, r: number) => {
    const size = 20;
    if (orientation === 'flat') {
      // Плоской стороной вверх
      const x = size * (1.5 * q);
      const y = size * Math.sqrt(3) * (r + 0.5 * (q % 2));
      return { x, y };
    } else {
      // Острым углом вверх
      const x = size * Math.sqrt(3) * (q + 0.5 * (r % 2));
      const y = size * (1.5 * r);
      return { x, y };
    }
  };
  
  // Обработчик клика по хексу
  const handleHexClick = (hex: {q: number; r: number; terrainType: string; color: string; height: number}) => {
    const updatedMap = hexMap.map(h => {
      if (h.q === hex.q && h.r === hex.r) {
        return {
          ...h,
          terrainType: selectedTerrain.id,
          color: selectedTerrain.color,
          height: selectedTerrain.height
        };
      }
      return h;
    });
    setHexMap(updatedMap);
  };
  
  // Обработчики для рисования с зажатой кнопкой мыши
  const handleMouseDown = (hex: {q: number; r: number; terrainType: string; color: string; height: number}, e: React.MouseEvent) => {
    // Проверяем, что это левая кнопка мыши (0)
    if (e.button === 0) {
      setIsDrawing(true);
      handleHexClick(hex);
      e.stopPropagation(); // Предотвращаем запуск панорамирования
    }
  };
  
  const handleMouseUp = () => {
    setIsDrawing(false);
  };
  
  const handleMouseEnter = (hex: {q: number; r: number; terrainType: string; color: string; height: number}) => {
    if (isDrawing) {
      handleHexClick(hex);
    }
  };
  
  // Обработчики для панорамирования карты
  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    // Только средняя кнопка мыши (1) или правая кнопка (2) для панорамирования
    if (e.button === 1 || e.button === 2) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      e.preventDefault(); // Предотвращаем стандартное поведение браузера
    }
  }, []);
  
  const handleSvgMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setViewTransform(prev => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, dragStart]);
  
  const handleSvgMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Обработчик колесика мыши для масштабирования
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
    
    // Получаем позицию курсора относительно SVG
    const svgRect = svgElement.current?.getBoundingClientRect();
    if (!svgRect) return;
    
    const mouseX = e.clientX - svgRect.left;
    const mouseY = e.clientY - svgRect.top;
    
    setViewTransform(prev => {
      // Вычисляем новый масштаб
      const newScale = prev.scale * scaleFactor;
      
      // Ограничиваем масштаб
      const limitedScale = Math.min(Math.max(newScale, 0.2), 3);
      
      // Вычисляем новые координаты с учетом позиции курсора
      const scaleRatio = limitedScale / prev.scale;
      const newX = mouseX - (mouseX - prev.x) * scaleRatio;
      const newY = mouseY - (mouseY - prev.y) * scaleRatio;
      
      return {
        scale: limitedScale,
        x: newX,
        y: newY
      };
    });
  }, []);
  
  // Устанавливаем обработчики событий для документа
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setIsDrawing(false);
    };
    
    const handleContextMenu = (e: MouseEvent) => {
      // Отключаем контекстное меню при правом клике на SVG
      if (svgContainer.current?.contains(e.target as Node)) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);
  
  // Экспорт в JSON
  const exportToJSON = () => {
    // Создаем новый объект только с нужными полями
    const cleanedMap = hexMap.map(hex => ({
      position: { q: hex.q, r: hex.r },
      terrainType: hex.terrainType
    }));
    
    // Форматируем JSON с отступами для лучшей читаемости
    const jsonData = JSON.stringify({ 
      hexes: cleanedMap, 
      mapSize 
    }, null, 2);
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonData);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "hex_map.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };
  
  // Обработка 3D предпросмотра
  useEffect(() => {
    if (show3DPreview && threeContainer.current) {
      let scene, camera, renderer, controls;
      
      // Создаем сцену
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f0f0);
      
      // Настраиваем камеру
      const width = threeContainer.current.clientWidth;
      const height = 400;
      camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.z = 15;
      camera.position.y = 10;
      camera.position.x = 0;
      camera.lookAt(0, 0, 0);
      
      // Создаем рендерер
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      
      // Очищаем контейнер и добавляем канвас
      while (threeContainer.current.firstChild) {
        threeContainer.current.removeChild(threeContainer.current.firstChild);
      }
      threeContainer.current.appendChild(renderer.domElement);
      
      // Добавляем контроллер орбиты для управления камерой
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.25;
      controls.screenSpacePanning = false;
      controls.maxPolarAngle = Math.PI / 2;
      
      // Добавляем освещение
      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(1, 1, 1).normalize();
      scene.add(light);
      
      const ambientLight = new THREE.AmbientLight(0x404040);
      scene.add(ambientLight);
      
      // Создаем хексы
      hexMap.forEach(hex => {
        // Создаем геометрию хекса
        const hexShape = new THREE.Shape();
        const radius = 1.0;
        
        // Создаем шестиугольник
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i + (orientation === 'pointy' ? 0 : Math.PI / 6);
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);
          if (i === 0) {
            hexShape.moveTo(x, y);
          } else {
            hexShape.lineTo(x, y);
          }
        }
        hexShape.closePath();
        
        // Создаем экструдированную геометрию (призму)
        const extrudeSettings = {
          depth: hex.height > 0 ? hex.height : 0.1,
          bevelEnabled: false
        };
        
        const hexGeometry = new THREE.ExtrudeGeometry(hexShape, extrudeSettings);
        // Поворачиваем геометрию, чтобы она была горизонтальной
        hexGeometry.rotateX(-Math.PI / 2);
        
        // Создаем материал с цветом
        const hexMaterial = new THREE.MeshLambertMaterial({ color: hex.color });
        
        // Создаем меш
        const hexMesh = new THREE.Mesh(hexGeometry, hexMaterial);
        
        // Позиционируем хексы в 3D-просмотре
        // Рассчитываем центр карты для центрирования
        const centerX = mapSize.width / 2;
        const centerY = mapSize.height / 2;
        
        // Коэффициенты для плотной гексагональной сетки в зависимости от ориентации
        if (orientation === 'flat') {
          const hexWidth = 1.5;
          const hexHeight = 1.732;
          const rowOffset = hex.r % 2 === 0 ? 0 : hexWidth / 2;
          hexMesh.position.x = (hex.q - centerX) * hexWidth + rowOffset;
          hexMesh.position.z = (hex.r - centerY) * (hexHeight * 0.75);
        } else {
          const hexWidth = 1.732;
          const hexHeight = 1.5;
          const colOffset = hex.q % 2 === 0 ? 0 : hexHeight / 2;
          hexMesh.position.x = (hex.q - centerX) * (hexWidth * 0.75);
          hexMesh.position.z = (hex.r - centerY) * hexHeight + colOffset;
        }
        
        // Устанавливаем высоту (Y в Three.js)
        hexMesh.position.y = 0;
        
        // Добавляем в сцену
        scene.add(hexMesh);
      });
      
      // Добавляем сетку для ориентации
      const gridHelper = new THREE.GridHelper(Math.max(mapSize.width, mapSize.height) * 2, Math.max(mapSize.width, mapSize.height));
      scene.add(gridHelper);
      
      // Анимация
      let animationFrameId: number;
      
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        
        // Обновляем контроллер орбиты
        controls.update();
        
        renderer.render(scene, camera);
      };
      
      animate();
      
      // Обработчик изменения размера окна
      const handleResize = () => {
        if (threeContainer.current) {
          const width = threeContainer.current.clientWidth;
          const height = 400;
          
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          
          renderer.setSize(width, height);
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      // Очистка при размонтировании
      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
        
        if (threeContainer.current) {
          while (threeContainer.current.firstChild) {
            threeContainer.current.removeChild(threeContainer.current.firstChild);
          }
        }
      };
    }
  }, [show3DPreview, hexMap, mapSize, orientation]);
  
  // Отрисовываем хекс SVG
  const renderHexSVG = (hex: {q: number; r: number; terrainType: string; color: string; height: number}) => {
    const { x, y } = getHexPosition(hex.q, hex.r);
    const size = 20;
    const points = [];
    
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const point_x = x + size * Math.cos(angle);
      const point_y = y + size * Math.sin(angle);
      points.push(`${point_x},${point_y}`);
    }
    
    return (
      <polygon
        key={`${hex.q},${hex.r}`}
        points={points.join(' ')}
        fill={hex.color}
        stroke="#333"
        strokeWidth="1"
        onMouseDown={(e) => handleMouseDown(hex, e)}
        onMouseEnter={() => handleMouseEnter(hex)}
      />
    );
  };
  
  // Функция для сброса масштаба и центрирования карты
  const resetView = () => {
    setViewTransform({ scale: 1, x: 0, y: 0 });
  };
  
  // Вычисляем размеры и отступы для SVG
  const calculateSvgDimensions = () => {
    // Находим максимальные координаты хексов
    let maxX = 0;
    let maxY = 0;
    
    hexMap.forEach(hex => {
      const { x, y } = getHexPosition(hex.q, hex.r);
      const size = 20;
      
      // Вычисляем крайние точки хекса
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const pointX = x + size * Math.cos(angle);
        const pointY = y + size * Math.sin(angle);
        
        maxX = Math.max(maxX, pointX);
        maxY = Math.max(maxY, pointY);
      }
    });
    
    // Добавляем отступы
    const padding = 40;
    return {
      width: maxX + padding,
      height: maxY + padding,
      viewBox: `-${padding} -${padding} ${maxX + padding * 2} ${maxY + padding * 2}`
    };
  };
  
  // Получаем размеры SVG
  const svgDimensions = hexMap.length > 0 ? calculateSvgDimensions() : { width: 100, height: 100, viewBox: "0 0 100 100" };

  // Функции для изменения размера карты
  const addRow = () => {
    const newRow = Array(mapSize.width).fill(null).map((_, q) => ({
      q,
      r: mapSize.height,
      terrainType: terrainTypes[0].id,
      color: terrainTypes[0].color,
      height: terrainTypes[0].height
    }));
    setHexMap([...hexMap, ...newRow]);
    setMapSize(prev => ({ ...prev, height: prev.height + 1 }));
  };

  const removeRow = () => {
    if (mapSize.height <= 1) return;
    const newMap = hexMap.filter(hex => hex.r < mapSize.height - 1);
    setHexMap(newMap);
    setMapSize(prev => ({ ...prev, height: prev.height - 1 }));
  };

  const addColumn = () => {
    const newColumn = Array(mapSize.height).fill(null).map((_, r) => ({
      q: mapSize.width,
      r,
      terrainType: terrainTypes[0].id,
      color: terrainTypes[0].color,
      height: terrainTypes[0].height
    }));
    setHexMap([...hexMap, ...newColumn]);
    setMapSize(prev => ({ ...prev, width: prev.width + 1 }));
  };

  const removeColumn = () => {
    if (mapSize.width <= 1) return;
    const newMap = hexMap.filter(hex => hex.q < mapSize.width - 1);
    setHexMap(newMap);
    setMapSize(prev => ({ ...prev, width: prev.width - 1 }));
  };

  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4 bg-gray-100 rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-4">Редактор Гексагональных Карт</h1>
      
      {showSizeInput ? (
        <div className="mb-6 p-6 bg-white rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-xl font-semibold mb-4">Определите размер карты</h2>
          <div className="flex flex-col space-y-4">
            <div className="flex items-center">
              <label className="w-32 text-gray-700">Ширина:</label>
              <input
                type="number"
                value={mapSize.width}
                onChange={(e) => setMapSize({ ...mapSize, width: parseInt(e.target.value) || 1 })}
                className="border rounded px-3 py-2 w-24 text-center"
                min="1"
                max="100"
              />
            </div>
            <div className="flex items-center">
              <label className="w-32 text-gray-700">Высота:</label>
              <input
                type="number"
                value={mapSize.height}
                onChange={(e) => setMapSize({ ...mapSize, height: parseInt(e.target.value) || 1 })}
                className="border rounded px-3 py-2 w-24 text-center"
                min="1"
                max="100"
              />
            </div>
            <div className="flex items-center">
              <label className="w-32 text-gray-700">Ориентация:</label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as 'flat' | 'pointy')}
                className="border rounded px-3 py-2"
              >
                <option value="flat">Плоской стороной вверх</option>
                <option value="pointy">Острым углом вверх</option>
              </select>
            </div>
            <button
              onClick={initializeMap}
              className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Создать карту
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <div className="mb-4 p-4 bg-white rounded-lg shadow-md">
            <div className="flex flex-col space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Выберите тип местности</h2>
                <div className="flex items-center space-x-2">
                  <label className="text-gray-700">Ориентация:</label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as 'flat' | 'pointy')}
                    className="border rounded px-2 py-1"
                  >
                    <option value="flat">Плоской стороной вверх</option>
                    <option value="pointy">Острым углом вверх</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {terrainTypes.map(terrain => (
                  <button
                    key={terrain.id}
                    onClick={() => setSelectedTerrain(terrain)}
                    className={`px-3 py-2 rounded-md text-white shadow ${
                      selectedTerrain.id === terrain.id ? 'ring-2 ring-black' : ''
                    }`}
                    style={{ backgroundColor: terrain.color }}
                  >
                    {terrain.name}
                  </button>
                ))}
              </div>
              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  <button
                    onClick={addRow}
                    className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded"
                  >
                    + Ряд
                  </button>
                  <button
                    onClick={removeRow}
                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded"
                    disabled={mapSize.height <= 1}
                  >
                    - Ряд
                  </button>
                  <button
                    onClick={addColumn}
                    className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded"
                  >
                    + Столбец
                  </button>
                  <button
                    onClick={removeColumn}
                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded"
                    disabled={mapSize.width <= 1}
                  >
                    - Столбец
                  </button>
                </div>
                <span className="text-sm text-gray-600">
                  Размер карты: {mapSize.width}x{mapSize.height}
                </span>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-600">
              <p>Совет: Зажмите кнопку мыши и проведите по карте для быстрого рисования</p>
            </div>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 p-4 bg-white rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold">Редактор карты</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={resetView}
                    className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                    title="Сбросить масштаб и центрировать"
                  >
                    Сбросить вид
                  </button>
                  <span className="text-sm text-gray-500">Масштаб: {Math.round(viewTransform.scale * 100)}%</span>
                </div>
              </div>
              
              <div 
                ref={svgContainer}
                className="relative overflow-hidden" 
                style={{ height: '70vh', cursor: isDragging ? 'grabbing' : 'grab' }}
                onMouseDown={handleSvgMouseDown}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={handleSvgMouseUp}
                onWheel={handleWheel}
              >
                <svg 
                  ref={svgElement}
                  width="100%" 
                  height="100%" 
                  className="border"
                  viewBox={svgDimensions.viewBox}
                  style={{ 
                    transform: `scale(${viewTransform.scale}) translate(${viewTransform.x}px, ${viewTransform.y}px)`,
                    transformOrigin: '0 0'
                  }}
                >
                  <g>
                    {hexMap.map(renderHexSVG)}
                  </g>
                </svg>
                <div className="absolute bottom-2 right-2 bg-white bg-opacity-75 p-2 rounded text-xs">
                  <p>Колесико мыши: масштаб</p>
                  <p>Правая кнопка мыши: перемещение</p>
                  <p>Левая кнопка мыши: рисование</p>
                </div>
              </div>
            </div>
            
            {show3DPreview && (
              <div className="lg:w-1/2 p-4 bg-white rounded-lg shadow-md">
                <h2 className="text-lg font-semibold mb-2">3D Предпросмотр</h2>
                <div ref={threeContainer} style={{ height: '400px', width: '100%' }}></div>
                <div className="mt-2 text-sm text-gray-600">
                  <p>Управление: вращение - левая кнопка мыши, перемещение - правая кнопка мыши, масштаб - колесико</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-4 flex flex-wrap gap-4">
            <button
              onClick={() => setShow3DPreview(!show3DPreview)}
              className="bg-purple-600 hover:bg-purple-800 text-white font-bold py-2 px-4 rounded"
            >
              {show3DPreview ? "Скрыть 3D предпросмотр" : "Показать 3D предпросмотр"}
            </button>
            
            <button
              onClick={exportToJSON}
              className="bg-green-600 hover:bg-green-800 text-white font-bold py-2 px-4 rounded"
            >
              Экспорт в JSON
            </button>
            
            <button
              onClick={() => setShowSizeInput(true)}
              className="bg-red-600 hover:bg-red-800 text-white font-bold py-2 px-4 rounded"
            >
              Начать заново
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HexMapEditor;