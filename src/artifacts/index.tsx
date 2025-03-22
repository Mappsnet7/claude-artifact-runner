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

// Типы шашек (военных юнитов)
const unitTypes = [
  { id: 'infantry', name: 'Пехотинец', icon: '👤', color: '#795548' },
  { id: 'sailor', name: 'Матрос', icon: '⚓', color: '#0D47A1' },
  { id: 'guerrilla', name: 'Партизан', icon: '🔫', color: '#006064' },
  { id: 'cavalry', name: 'Кавалерист', icon: '🐎', color: '#FF9800' },
  { id: 'cossack', name: 'Казак', icon: '🏇', color: '#BF360C' },
  { id: 'machinegun', name: 'Пулемётчик', icon: '🔫', color: '#8D6E63' },
  { id: 'tachankagun', name: 'Тачанка', icon: '🔫+🐎', color: '#FFA000' },
  { id: 'sniper', name: 'Снайпер', icon: '⌖', color: '#263238' },
  { id: 'cannon', name: 'Пушка', icon: '💣', color: '#5D4037' },
  { id: 'howitzer', name: 'Гаубица', icon: '💥', color: '#3E2723' },
  { id: 'armoredcar', name: 'Бронеавтомобиль', icon: '🚙', color: '#616161' },
  { id: 'tank', name: 'Танк', icon: '🔘', color: '#212121' }
];

// Основной компонент редактора карт
const HexMapEditor = () => {
  // Состояния для размеров карты
  const [mapRadius, setMapRadius] = useState(5);
  const [showSizeInput, setShowSizeInput] = useState(true);
  const [selectedTerrain, setSelectedTerrain] = useState(terrainTypes[0]);
  const [hexMap, setHexMap] = useState<Array<{q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string} }>>([]);
  const [show3DPreview, setShow3DPreview] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [orientation, setOrientation] = useState<'flat' | 'pointy'>('flat');
  const [hexCount, setHexCount] = useState(0);
  const [editMode, setEditMode] = useState<'terrain' | 'units'>('terrain');
  const [selectedUnit, setSelectedUnit] = useState<typeof unitTypes[0] | null>(null);
  
  // Состояния для управления видом 2D карты
  const [viewTransform, setViewTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const threeContainer = useRef<HTMLDivElement>(null);
  const svgContainer = useRef<HTMLDivElement>(null);
  const svgElement = useRef<SVGSVGElement>(null);
  
  // Добавляем состояние для оптимизации рендеринга
  const [visibleHexes, setVisibleHexes] = useState<Array<{q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string} }>>([]);
  
  // Инициализация карты с гексагональной сеткой в кубических координатах
  const initializeMap = useCallback(() => {
    // Если карта уже существует и не пустая, используем resizeMap для сохранения существующих клеток
    if (hexMap.length > 0) {
      resizeMap(mapRadius);
      return;
    }
    
    // Ограничиваем максимальный радиус для производительности
    const safeRadius = Math.min(mapRadius, 15);
    if (safeRadius !== mapRadius) {
      setMapRadius(safeRadius);
    }
    
    const newMap = [];
    
    // Создаем гексагональную карту с радиусом mapRadius
    for (let q = -safeRadius; q <= safeRadius; q++) {
      const r1 = Math.max(-safeRadius, -q - safeRadius);
      const r2 = Math.min(safeRadius, -q + safeRadius);
      
      for (let r = r1; r <= r2; r++) {
        const s = -q - r; // q + r + s = 0
        newMap.push({
          q,
          r,
          s,
          terrainType: terrainTypes[0].id,
          color: terrainTypes[0].color,
          height: terrainTypes[0].height
        });
      }
    }
    
    setHexMap(newMap);
    setHexCount(newMap.length);
    setShowSizeInput(false);
    // Сбрасываем трансформацию при создании новой карты
    setViewTransform({ scale: 1, x: 0, y: 0 });
  }, [hexMap.length, mapRadius]);
  
  // Расчет позиции хекса с учетом ориентации в кубических координатах
  const getHexPosition = useCallback((q: number, r: number) => {
    const size = 20;
    if (orientation === 'flat') {
      // Плоской стороной вверх (flat-top)
      const x = size * (3/2 * q);
      const y = size * Math.sqrt(3) * (r + q/2);
      return { x, y };
    } else {
      // Острым углом вверх (pointy-top)
      const x = size * Math.sqrt(3) * (q + r/2);
      const y = size * (3/2 * r);
      return { x, y };
    }
  }, [orientation]);
  
  // Обработчик клика по хексу
  const handleHexClick = (hex: {q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string}}) => {
    const updatedMap = hexMap.map(h => {
      if (h.q === hex.q && h.r === hex.r && h.s === hex.s) {
        if (editMode === 'terrain') {
          return {
            ...h,
            terrainType: selectedTerrain.id,
            color: selectedTerrain.color,
            height: selectedTerrain.height
          };
        } else if (editMode === 'units') {
          if (selectedUnit) {
            return {
              ...h,
              unit: {
                type: selectedUnit.id,
                icon: selectedUnit.icon,
                color: selectedUnit.color
              }
            };
          } else {
            // Если выбрано "удалить юнит", то удаляем юнит с гекса
            const { unit, ...restHex } = h;
            return restHex;
          }
        }
      }
      return h;
    });
    setHexMap(updatedMap);
    setHexCount(updatedMap.length);
  };
  
  // Обработчики для рисования с зажатой кнопкой мыши
  const handleMouseDown = (hex: {q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string}}, e: React.MouseEvent) => {
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
  
  const handleMouseEnter = (hex: {q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string}}) => {
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
    const cleanedMap = hexMap.map(hex => {
      const basicHex = {
        position: { q: hex.q, r: hex.r, s: hex.s },
        terrainType: hex.terrainType
      };
      
      // Добавляем юнит, если он существует
      if (hex.unit) {
        return {
          ...basicHex,
          unit: { type: hex.unit.type }
        };
      }
      
      return basicHex;
    });
    
    // Форматируем JSON с отступами для лучшей читаемости
    const jsonData = JSON.stringify({ 
      hexes: cleanedMap, 
      mapRadius 
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
      
      // Ограничиваем количество хексов для 3D предпросмотра
      const maxHexesFor3D = 500;
      const hexesToRender = hexMap.length > maxHexesFor3D 
        ? hexMap.slice(0, maxHexesFor3D) 
        : hexMap;
      
      // Используем requestAnimationFrame для асинхронного добавления хексов
      // чтобы не блокировать интерфейс
      let hexIndex = 0;
      
      const addNextBatchOfHexes = () => {
        const batchSize = 50; // Количество хексов в одной партии
        const endIndex = Math.min(hexIndex + batchSize, hexesToRender.length);
        
        for (let i = hexIndex; i < endIndex; i++) {
          const hex = hexesToRender[i];
          // Создаем геометрию хекса
          const hexShape = new THREE.Shape();
          const radius = 1.0;
          
          // Создаем шестиугольник
          for (let j = 0; j < 6; j++) {
            const angle = (Math.PI / 3) * j + (orientation === 'pointy' ? Math.PI / 6 : 0);
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            if (j === 0) {
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
          
          // Позиционируем хексы в 3D-просмотре с использованием кубических координат
          if (orientation === 'flat') {
            const x = 1.5 * hex.q;
            const z = Math.sqrt(3) * (hex.r + hex.q/2);
            hexMesh.position.x = x;
            hexMesh.position.z = z;
          } else {
            const x = Math.sqrt(3) * (hex.q + hex.r/2);
            const z = 1.5 * hex.r;
            hexMesh.position.x = x;
            hexMesh.position.z = z;
          }
          
          // Устанавливаем высоту (Y в Three.js)
          hexMesh.position.y = 0;
          
          // Добавляем в сцену
          scene.add(hexMesh);
          
          // Добавляем юнит на карту, если он есть
          if (hex.unit) {
            // Создаем цилиндр для представления юнита
            const unitGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.4, 16);
            const unitMaterial = new THREE.MeshLambertMaterial({ color: hex.unit.color });
            const unitMesh = new THREE.Mesh(unitGeometry, unitMaterial);
            
            // Позиционируем юнит над гексом
            unitMesh.position.x = hexMesh.position.x;
            unitMesh.position.z = hexMesh.position.z;
            unitMesh.position.y = 0.3; // Поднимаем над поверхностью гекса
            
            scene.add(unitMesh);
          }
        }
        
        hexIndex = endIndex;
        
        // Если остались еще хексы, запланируем следующую партию
        if (hexIndex < hexesToRender.length) {
          setTimeout(() => requestAnimationFrame(addNextBatchOfHexes), 0);
        }
      };
      
      // Начинаем добавлять хексы
      requestAnimationFrame(addNextBatchOfHexes);
      
      // Добавляем сетку для ориентации
      const gridHelper = new THREE.GridHelper(mapRadius * 4, mapRadius * 2);
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
  }, [show3DPreview, hexMap, mapRadius, orientation]);
  
  // Обновляем видимые гексы при изменении масштаба или позиции просмотра
  useEffect(() => {
    // При небольшом количестве гексов показываем все
    if (hexMap.length < 1000) {
      setVisibleHexes(hexMap);
      return;
    }
    
    const updateVisibleHexes = () => {
      if (!svgElement.current || !svgContainer.current) return;
      
      const svgRect = svgContainer.current.getBoundingClientRect();
      const viewBox = svgElement.current.viewBox.baseVal;
      
      // Вычисляем видимую область с учетом масштаба и позиции
      const visibleLeft = viewBox.x - viewTransform.x / viewTransform.scale;
      const visibleTop = viewBox.y - viewTransform.y / viewTransform.scale;
      const visibleWidth = svgRect.width / viewTransform.scale;
      const visibleHeight = svgRect.height / viewTransform.scale;
      const visibleRight = visibleLeft + visibleWidth;
      const visibleBottom = visibleTop + visibleHeight;
      
      // Добавляем буфер вокруг видимой области для плавного скроллинга
      const bufferSize = 100;
      const bufferedLeft = visibleLeft - bufferSize;
      const bufferedTop = visibleTop - bufferSize;
      const bufferedRight = visibleRight + bufferSize;
      const bufferedBottom = visibleBottom + bufferSize;
      
      // Фильтруем только видимые гексы
      const visible = hexMap.filter(hex => {
        const { x, y } = getHexPosition(hex.q, hex.r);
        const size = 20;
        
        // Проверяем, находится ли гекс в видимой области (с учетом размера гекса)
        return (
          x + size >= bufferedLeft &&
          x - size <= bufferedRight &&
          y + size >= bufferedTop &&
          y - size <= bufferedBottom
        );
      });
      
      setVisibleHexes(visible);
    };
    
    // Обновляем видимые гексы после изменения масштаба или позиции
    updateVisibleHexes();
    
    // Добавляем debounce, чтобы не пересчитывать слишком часто
    const debouncedUpdate = setTimeout(updateVisibleHexes, 100);
    return () => clearTimeout(debouncedUpdate);
  }, [hexMap, viewTransform, getHexPosition]);
  
  // Отрисовываем хекс SVG с координатами
  const renderHexSVG = (hex: {q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string}}) => {
    const { x, y } = getHexPosition(hex.q, hex.r);
    const size = 20;
    const points = [];
    
    for (let i = 0; i < 6; i++) {
      // Для flat-top начинаем с угла 0 градусов (0)
      // Для pointy-top начинаем с угла 30 градусов (PI/6)
      const angle = (Math.PI / 3) * i + (orientation === 'pointy' ? Math.PI / 6 : 0);
      const point_x = x + size * Math.cos(angle);
      const point_y = y + size * Math.sin(angle);
      points.push(`${point_x},${point_y}`);
    }
    
    // Создаем гекс с юнитом, если он есть
    return (
      <g key={`${hex.q},${hex.r},${hex.s}`}>
        <polygon
          points={points.join(' ')}
          fill={hex.color}
          stroke="#333"
          strokeWidth="1"
          onMouseDown={(e) => handleMouseDown(hex, e)}
          onMouseEnter={() => handleMouseEnter(hex)}
        />
        {hex.unit && (
          <g>
            <circle 
              cx={x} 
              cy={y} 
              r={size/2} 
              fill={hex.unit.color} 
              stroke="#000" 
              strokeWidth="1"
              style={{ userSelect: 'none' }}
            />
            <text 
              x={x} 
              y={y} 
              textAnchor="middle" 
              dominantBaseline="middle" 
              fill="white"
              fontSize={size/1.5}
              fontWeight="bold"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {hex.unit.icon}
            </text>
          </g>
        )}
      </g>
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
    let minX = 0;
    let minY = 0;
    
    hexMap.forEach(hex => {
      const { x, y } = getHexPosition(hex.q, hex.r);
      const size = 20;
      
      // Вычисляем крайние точки хекса
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i + (orientation === 'pointy' ? Math.PI / 6 : 0);
        const pointX = x + size * Math.cos(angle);
        const pointY = y + size * Math.sin(angle);
        
        maxX = Math.max(maxX, pointX);
        maxY = Math.max(maxY, pointY);
        minX = Math.min(minX, pointX);
        minY = Math.min(minY, pointY);
      }
    });
    
    // Добавляем отступы
    const padding = 40;
    return {
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
      viewBox: `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`
    };
  };
  
  // Получаем размеры SVG
  const svgDimensions = hexMap.length > 0 ? calculateSvgDimensions() : { width: 100, height: 100, viewBox: "0 0 100 100" };

  // Функции для изменения размера карты с сохранением существующих клеток
  const resizeMap = useCallback((newRadius: number) => {
    // Ограничиваем максимальный радиус для производительности
    const safeRadius = Math.min(newRadius, 15);
    if (safeRadius !== newRadius) {
      setMapRadius(safeRadius);
      newRadius = safeRadius;
    }
    
    // Сохраняем текущую карту в виде объекта для быстрого доступа
    const currentHexes: Record<string, {q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string} }> = {};
    hexMap.forEach(hex => {
      const key = `${hex.q},${hex.r},${hex.s}`;
      currentHexes[key] = hex;
    });
    
    // Используем setTimeout для предотвращения блокировки интерфейса
    setTimeout(() => {
      const newMap = [];
      
      // Создаем новую карту с новым радиусом
      for (let q = -newRadius; q <= newRadius; q++) {
        const r1 = Math.max(-newRadius, -q - newRadius);
        const r2 = Math.min(newRadius, -q + newRadius);
        
        for (let r = r1; r <= r2; r++) {
          const s = -q - r; // q + r + s = 0
          const key = `${q},${r},${s}`;
          
          // Если гекс существовал ранее, сохраняем его свойства
          if (currentHexes[key]) {
            newMap.push(currentHexes[key]);
          } else {
            // Иначе создаем новый гекс с типом по умолчанию
            newMap.push({
              q,
              r,
              s,
              terrainType: terrainTypes[0].id,
              color: terrainTypes[0].color,
              height: terrainTypes[0].height
            });
          }
        }
      }
      
      setHexMap(newMap);
      setHexCount(newMap.length);
      setMapRadius(newRadius);
    }, 0);
  }, [hexMap]);

  const increaseRadius = useCallback(() => {
    // Ограничиваем максимальный радиус
    if (mapRadius >= 15) return;
    resizeMap(mapRadius + 1);
  }, [mapRadius, resizeMap]);

  const decreaseRadius = useCallback(() => {
    if (mapRadius <= 1) return;
    resizeMap(mapRadius - 1);
  }, [mapRadius, resizeMap]);

  // Функция для загрузки карты из JSON
  const importFromJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        
        // Проверяем структуру данных
        if (!jsonData.hexes || !Array.isArray(jsonData.hexes) || !jsonData.mapRadius) {
          throw new Error('Неверный формат файла');
        }

        // Преобразуем загруженные данные в формат карты
        const loadedMap = jsonData.hexes.map((hex: { position: { q: number; r: number; s: number }; terrainType: string; unit?: { type: string } }) => {
          const terrainInfo = terrainTypes.find(t => t.id === hex.terrainType) || terrainTypes[0];
          const basicHex = {
            q: hex.position.q,
            r: hex.position.r,
            s: hex.position.s,
            terrainType: terrainInfo.id,
            color: terrainInfo.color,
            height: terrainInfo.height
          };
          
          // Добавляем юнит, если он существует в JSON
          if (hex.unit && hex.unit.type) {
            const unitInfo = unitTypes.find(u => u.id === hex.unit?.type) || unitTypes[0];
            return {
              ...basicHex,
              unit: {
                type: unitInfo.id,
                icon: unitInfo.icon,
                color: unitInfo.color
              }
            };
          }
          
          return basicHex;
        });

        // Обновляем состояние карты
        setMapRadius(jsonData.mapRadius);
        setHexMap(loadedMap);
        setHexCount(loadedMap.length);
        setShowSizeInput(false);

      } catch (error) {
        alert('Ошибка при загрузке файла: ' + (error as Error).message);
      }
    };
    reader.readAsText(file);
    
    // Очищаем input для возможности повторной загрузки того же файла
    event.target.value = '';
  };

  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4 bg-gray-100 rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-4">Редактор Гексагональных Карт</h1>
      
      {showSizeInput ? (
        <div className="mb-6 p-6 bg-white rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-xl font-semibold mb-4">
            {hexMap.length > 0 ? "Изменение размера карты" : "Определите размер карты"}
          </h2>
          <div className="flex flex-col space-y-4">
            <div className="flex items-center">
              <label className="w-32 text-gray-700">Радиус карты:</label>
              <input
                type="number"
                value={mapRadius}
                onChange={(e) => setMapRadius(parseInt(e.target.value) || 1)}
                className="border rounded px-3 py-2 w-24 text-center"
                min="1"
                max="20"
              />
            </div>
            <div className="text-sm text-gray-600 ml-32">
              Примерное количество гексов: {3 * mapRadius * (mapRadius + 1) + 1}
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
              {hexMap.length > 0 ? "Изменить размер" : "Создать карту"}
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <div className="mb-4 p-4 bg-white rounded-lg shadow-md">
            <div className="flex flex-col space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Режим редактирования</h2>
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
              
              <div className="flex space-x-2 mb-2">
                <button
                  onClick={() => setEditMode('terrain')}
                  className={`px-3 py-2 rounded-md ${
                    editMode === 'terrain' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                  }`}
                >
                  Редактор местности
                </button>
                <button
                  onClick={() => setEditMode('units')}
                  className={`px-3 py-2 rounded-md ${
                    editMode === 'units' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                  }`}
                >
                  Расстановка шашек
                </button>
              </div>
              
              {editMode === 'terrain' ? (
                // Панель для выбора типа местности
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
              ) : (
                // Панель для выбора типа шашек
                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      onClick={() => setSelectedUnit(null)}
                      className={`px-3 py-2 rounded-md bg-red-500 text-white shadow ${
                        selectedUnit === null ? 'ring-2 ring-black' : ''
                      }`}
                    >
                      Удалить юнит
                    </button>
                    {unitTypes.map(unit => (
                      <button
                        key={unit.id}
                        onClick={() => setSelectedUnit(unit)}
                        className={`px-3 py-2 rounded-md text-white shadow ${
                          selectedUnit?.id === unit.id ? 'ring-2 ring-black' : ''
                        }`}
                        style={{ backgroundColor: unit.color }}
                      >
                        {unit.icon} {unit.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600">
                    Выберите тип юнита и кликните по гексу для его размещения. 
                    Выберите "Удалить юнит" для удаления юнита с гекса.
                  </p>
                </div>
              )}
              
              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  <button
                    onClick={increaseRadius}
                    className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded"
                  >
                    + Радиус
                  </button>
                  <button
                    onClick={decreaseRadius}
                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded"
                    disabled={mapRadius <= 1}
                  >
                    - Радиус
                  </button>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm text-gray-600">
                    Радиус карты: {mapRadius}
                  </span>
                  <span className="text-sm text-gray-600">
                    Количество гексов: {hexCount}
                  </span>
                </div>
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
                onMouseLeave={handleMouseUp}
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
                    {visibleHexes.map(renderHexSVG)}
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
              className="bg-blue-600 hover:bg-blue-800 text-white font-bold py-2 px-4 rounded"
            >
              Изменить размер карты
            </button>
            
            <button
              onClick={() => {
                setHexMap([]);
                setShowSizeInput(true);
              }}
              className="bg-red-600 hover:bg-red-800 text-white font-bold py-2 px-4 rounded"
            >
              Начать заново
            </button>

            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={importFromJSON}
                className="hidden"
                id="import-json"
              />
              <label
                htmlFor="import-json"
                className="bg-yellow-600 hover:bg-yellow-800 text-white font-bold py-2 px-4 rounded cursor-pointer"
              >
                Загрузить карту
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HexMapEditor;