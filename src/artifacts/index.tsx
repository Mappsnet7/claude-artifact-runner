import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import TerrainGeneratorPanel from './TerrainGeneratorPanel';
import {
  FaSave, FaUndo, FaTimes, FaUpload, FaCube,
  FaRuler, FaEdit, FaFile, FaEye, FaWater
} from 'react-icons/fa';
import { RiMapFill, RiEarthLine } from 'react-icons/ri';
import { countHexes, getRowBounds, normalizeAdditionalMiddleRows } from './hexUtils';

// Основные типы местности и их цвета
const terrainTypes = [
  { 
    id: 'field', 
    name: 'Поле', 
    color: '#4CAF50', 
    height: 0,
    pattern: (
      <pattern id="fieldPattern" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="#4CAF50" />
        <path d="M0,10 L20,10 M10,0 L10,20" stroke="#3da142" strokeWidth="0.5" />
        <circle cx="10" cy="10" r="1" fill="#8bc34a" />
      </pattern>
    )
  },
  { 
    id: 'hills', 
    name: 'Холмы', 
    color: '#F9A825', 
    height: 0.5,
    pattern: (
      <pattern id="hillsPattern" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="#F9A825" />
        <path d="M0,15 Q5,5 10,15 Q15,5 20,15" stroke="#e59a14" strokeWidth="1.5" fill="none" />
      </pattern>
    )
  },
  { 
    id: 'forest', 
    name: 'Лес', 
    color: '#33691E', 
    height: 0.2,
    pattern: (
      <pattern id="forestPattern" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="#33691E" />
        <path d="M5,15 L8,5 L11,15 Z" fill="#2c5518" />
        <path d="M12,13 L15,5 L18,13 Z" fill="#2c5518" />
      </pattern>
    )
  },
  { 
    id: 'swamp', 
    name: 'Болота', 
    color: '#1B5E20', 
    height: -0.2,
    pattern: (
      <pattern id="swampPattern" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="#1B5E20" />
        <circle cx="5" cy="5" r="1.5" fill="#6c9e71" />
        <circle cx="15" cy="5" r="1" fill="#6c9e71" />
        <circle cx="10" cy="10" r="2" fill="#6c9e71" />
        <circle cx="5" cy="15" r="1" fill="#6c9e71" />
        <circle cx="15" cy="15" r="1.5" fill="#6c9e71" />
      </pattern>
    )
  },
  { 
    id: 'buildings', 
    name: 'Здания', 
    color: '#424242', 
    height: 0.3,
    pattern: (
      <pattern id="buildingsPattern" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="#424242" />
        <rect x="2" y="2" width="7" height="7" fill="#555555" />
        <rect x="11" y="2" width="7" height="7" fill="#555555" />
        <rect x="2" y="11" width="7" height="7" fill="#555555" />
        <rect x="11" y="11" width="7" height="7" fill="#555555" />
      </pattern>
    )
  },
  { 
    id: 'void', 
    name: 'Пустота', 
    color: '#808080', 
    height: 0,
    pattern: null
  },
  { 
    id: 'water', 
    name: 'Водоём', 
    color: '#2196F3', 
    height: -0.3,
    pattern: (
      <pattern id="waterPattern" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="#2196F3" />
        <path d="M0,5 Q5,3 10,5 Q15,7 20,5" stroke="#1976D2" strokeWidth="1" fill="none" />
        <path d="M0,10 Q5,8 10,10 Q15,12 20,10" stroke="#1976D2" strokeWidth="1" fill="none" />
        <path d="M0,15 Q5,13 10,15 Q15,17 20,15" stroke="#1976D2" strokeWidth="1" fill="none" />
      </pattern>
    )
  },
  { 
    id: 'empty', 
    name: 'Пустая клетка', 
    color: 'transparent', 
    height: 0, 
    isEmpty: true,
    pattern: null
  }
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

// Типы для рек
type Point = { x: number; y: number };
type River = { 
  id: string; 
  points: Point[]; 
  thickness: number; 
  smoothingEnabled: boolean; 
};
type Vertex = { q: number; r: number; s: number; index: number; x: number; y: number };

// Основной компонент редактора карт
const HexMapEditor = () => {
  // Состояния для размеров карты
  const [mapRadius, setMapRadius] = useState(5);
  const [middleRowsToAdd, setMiddleRowsToAdd] = useState(0);
  const [showSizeInput, setShowSizeInput] = useState(true);
  const [selectedTerrain, setSelectedTerrain] = useState(terrainTypes[0]);
  const [hexMap, setHexMap] = useState<Array<{q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string} }>>([]);
  const [show3DPreview, setShow3DPreview] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [orientation, setOrientation] = useState<'flat' | 'pointy'>('flat');
  const [hexCount, setHexCount] = useState(0);
  const [editMode, setEditMode] = useState<'terrain' | 'units' | 'manage' | 'rivers'>('terrain');
  const [manageAction, setManageAction] = useState<'add' | 'delete'>('add');
  const [selectedUnit, setSelectedUnit] = useState<typeof unitTypes[0] | null>(null);
  const [showTerrainGenerator, setShowTerrainGenerator] = useState(false);
  const [showUnits, setShowUnits] = useState(true); // Состояние для отображения/скрытия юнитов
  const [maxPlayerUnits, setMaxPlayerUnits] = useState(8); // Максимальное количество шашек игрока

  const normalizedAdditionalRows = useMemo(
    () => normalizeAdditionalMiddleRows(middleRowsToAdd),
    [middleRowsToAdd]
  );
  const estimatedHexCount = useMemo(
    () => countHexes(mapRadius, normalizedAdditionalRows),
    [mapRadius, normalizedAdditionalRows]
  );
  
  // Состояния для рек
  const [rivers, setRivers] = useState<River[]>([]);
  const [selectedRiverId, setSelectedRiverId] = useState<string | null>(null);
  const [hoveredVertex, setHoveredVertex] = useState<Vertex | null>(null);
  const [allVertices, setAllVertices] = useState<Vertex[]>([]);

  // Состояния для перетаскивания точек реки
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [draggedPointInfo, setDraggedPointInfo] = useState<{ riverId: string; pointIndex: number } | null>(null);

  // Состояния для управления видом 2D карты
  const [viewTransform, setViewTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Добавляем константу для масштаба юнитов (более реалистичный размер)
  const UNIT_SCALE = 2.0; // Масштаб юнитов относительно гекса
  
  const threeContainer = useRef<HTMLDivElement>(null);
  const svgContainer = useRef<HTMLDivElement>(null);
  const svgElement = useRef<SVGSVGElement>(null);
  
  // Добавляем состояние для оптимизации рендеринга
  const [visibleHexes, setVisibleHexes] = useState<Array<{q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string} }>>([]);
  
  // Сохраняем удаленные гексы для возможности восстановления
  const [deletedHexes, setDeletedHexes] = useState<Array<{q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string} }>>([]);
  
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
  
  // Функция для получения вершин гекса
  const getHexVertices = useCallback((hex: { q: number; r: number; s: number }) => {
    const { x, y } = getHexPosition(hex.q, hex.r);
    const size = 20;
    const vertices: Point[] = [];
    for (let i = 0; i < 6; i++) {
      // Правильный расчет углов для вершин гекса
      const angle = (Math.PI / 3) * i + (orientation === 'pointy' ? Math.PI / 6 : 0);
      vertices.push({
        x: x + size * Math.cos(angle),
        y: y + size * Math.sin(angle),
      });
    }
    return vertices;
  }, [getHexPosition, orientation]);

  useEffect(() => {
    if (editMode === 'rivers') {
      const vertices: Vertex[] = [];
      hexMap.forEach(hex => {
        if (hex.terrainType !== 'empty') {
          // Добавляем вершины гекса
          const hexVertices = getHexVertices(hex);
          hexVertices.forEach((vertex, index) => {
            vertices.push({ ...vertex, q: hex.q, r: hex.r, s: hex.s, index });
          });
          
          // Добавляем центр гекса как дополнительную точку привязки
          const { x, y } = getHexPosition(hex.q, hex.r);
          vertices.push({ 
            x, 
            y, 
            q: hex.q, 
            r: hex.r, 
            s: hex.s, 
            index: -1 // Специальный индекс для центра
          });
        }
      });
      setAllVertices(vertices);
    } else {
      setAllVertices([]);
    }
  }, [editMode, hexMap, getHexVertices, getHexPosition]);
  
  // Функция для получения всех возможных координат гексов в пределах радиуса
  // Эта функция не используется и была удалена
  
  // Функция для определения, существует ли гекс на карте
  // Эта функция не используется и была удалена
  
  // Функция для получения гекса по координатам (или null, если его нет)
  // Эта функция не используется и была удалена
  
  // Обработчик клика по хексу
  const handleHexClick = (hex: {q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string}}) => {
    if (editMode === 'terrain') {
      const updatedMap = hexMap.map(h => {
        if (h.q === hex.q && h.r === hex.r && h.s === hex.s) {
          return {
            ...h,
            terrainType: selectedTerrain.id,
            color: selectedTerrain.color,
            height: selectedTerrain.height
          };
        }
        return h;
      });
      
      // Обновляем счетчик видимых гексов
      const wasEmpty = hex.terrainType === 'empty';
      const becomesEmpty = selectedTerrain.id === 'empty';
      
      if (wasEmpty && !becomesEmpty) {
        setHexCount(prev => prev + 1);
      } else if (!wasEmpty && becomesEmpty) {
        setHexCount(prev => prev - 1);
      }
      
      setHexMap(updatedMap);
    } else if (editMode === 'units') {
      // Не добавляем юниты на пустые клетки
      if (hex.terrainType === 'empty') return;

      const updatedMap = hexMap.map(h => {
        if (h.q === hex.q && h.r === hex.r && h.s === hex.s) {
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
        return h;
      });
      setHexMap(updatedMap);
    } else if (editMode === 'manage') {
      if (manageAction === 'add' && hex.terrainType === 'empty') {
        // Меняем тип гекса с "empty" на выбранный
        const updatedMap = hexMap.map(h => {
          if (h.q === hex.q && h.r === hex.r && h.s === hex.s) {
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
        setHexCount(prev => prev + 1);
      } else if (manageAction === 'delete' && hex.terrainType !== 'empty') {
        // Меняем тип гекса на "empty" вместо удаления
        const emptyTerrain = terrainTypes.find(t => t.id === 'empty') || terrainTypes[0];
        
        const updatedMap = hexMap.map(h => {
          if (h.q === hex.q && h.r === hex.r && h.s === hex.s) {
            // Сохраняем удаленный гекс для возможности восстановления
            const savedHex = {...h};
            setDeletedHexes(prev => [...prev, savedHex]);
            
            return {
              ...h,
              terrainType: emptyTerrain.id,
              color: emptyTerrain.color,
              height: emptyTerrain.height,
              unit: undefined // Удаляем юнит, если он был
            };
          }
          return h;
        });
        
        setHexMap(updatedMap);
        setHexCount(prev => prev - 1);
      }
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
  
  
  // Устанавливаем обработчики событий для документа
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setIsDrawing(false);
      setIsDraggingPoint(false);
      setDraggedPointInfo(null);
    };
    
    const handleContextMenu = (e: MouseEvent) => {
      // Отключаем контекстное меню при правом клике на SVG
      if (svgContainer.current?.contains(e.target as Node)) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('contextmenu', handleContextMenu);

    const container = svgContainer.current;
    const handleWheelEvent = (e: WheelEvent) => {
        e.preventDefault();
        
        const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
        
        const svgRect = svgElement.current?.getBoundingClientRect();
        if (!svgRect) return;
        
        const mouseX = e.clientX - svgRect.left;
        const mouseY = e.clientY - svgRect.top;
        
        setViewTransform(prev => {
          const newScale = prev.scale * scaleFactor;
          const limitedScale = Math.min(Math.max(newScale, 0.2), 3);
          const scaleRatio = limitedScale / prev.scale;
          const newX = mouseX - (mouseX - prev.x) * scaleRatio;
          const newY = mouseY - (mouseY - prev.y) * scaleRatio;
          
          return {
            scale: limitedScale,
            x: newX,
            y: newY
          };
        });
    };
    
    if (container) {
      container.addEventListener('wheel', handleWheelEvent, { passive: false });
    }
    
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('contextmenu', handleContextMenu);
      if (container) {
        container.removeEventListener('wheel', handleWheelEvent);
      }
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
    
    // Для полноты карты добавляем информацию о пустых клетках
    // Для создания полных границ карты
    const fullCoordinates = [];
    for (let q = -mapRadius; q <= mapRadius; q++) {
      const { start: r1, end: r2 } = getRowBounds(mapRadius, q, normalizedAdditionalRows);

      for (let r = r1; r <= r2; r++) {
        const s = -q - r; // q + r + s = 0
        fullCoordinates.push({ q, r, s });
      }
    }
    
    // Найти координаты, которых нет на текущей карте (пустые клетки)
    const emptyCoordinates = fullCoordinates.filter(coord => 
      !hexMap.some(hex => hex.q === coord.q && hex.r === coord.r && hex.s === coord.s)
    ).map(coord => ({
      position: { q: coord.q, r: coord.r, s: coord.s },
      terrainType: 'empty'
    }));
    
    // Форматируем JSON с отступами для лучшей читаемости
    const jsonData = JSON.stringify({ 
      hexes: [...cleanedMap, ...emptyCoordinates], 
      mapRadius,
      additionalMiddleRows: normalizedAdditionalRows,
      maxPlayerUnits,
      rivers: rivers
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
      scene.background = new THREE.Color(0x87CEEB); // Более красивый цвет фона (голубое небо)
      
      // Настраиваем камеру
      const width = threeContainer.current.clientWidth;
      const height = 400;
      camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
      camera.position.z = 15;
      camera.position.y = 12;
      camera.position.x = 5;
      camera.lookAt(0, 0, 0);
      
      // Создаем рендерер с включенными тенями
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Мягкие тени
      renderer.outputColorSpace = THREE.SRGBColorSpace; // Улучшенная цветопередача
      renderer.toneMapping = THREE.ACESFilmicToneMapping; // Кинематографический тональный маппинг
      renderer.toneMappingExposure = 1.2; // Немного увеличиваем экспозицию для более яркой картинки
      
      // Очищаем контейнер и добавляем канвас
      while (threeContainer.current.firstChild) {
        threeContainer.current.removeChild(threeContainer.current.firstChild);
      }
      threeContainer.current.appendChild(renderer.domElement);
      
      // Добавляем контроллер орбиты для управления камерой
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.15;
      controls.screenSpacePanning = false;
      controls.maxPolarAngle = Math.PI / 2;
      controls.minDistance = 5;
      controls.maxDistance = 50;
      
      // Улучшенное освещение
      // Основное направленное освещение (солнце)
      const sunLight = new THREE.DirectionalLight(0xffffcc, 1);
      sunLight.position.set(5, 10, 7);
      sunLight.castShadow = true;
      
      // Настройка теней
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.camera.near = 0.5;
      sunLight.shadow.camera.far = 50;
      sunLight.shadow.bias = -0.001;
      
      // Установка размеров области видимости теней
      const d = 20;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      
      scene.add(sunLight);
      
      // Добавляем дополнительное направленное освещение для подсветки теней
      const fillLight = new THREE.DirectionalLight(0xaaccff, 0.5);
      fillLight.position.set(-5, 8, -5);
      scene.add(fillLight);
      
      // Улучшенное окружающее освещение
      const ambientLight = new THREE.AmbientLight(0x555555);
      scene.add(ambientLight);
      
      // Добавляем полусферическое освещение для большей реалистичности
      const hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
      scene.add(hemiLight);
      
      // Создаем текстуры для разных типов местности
      const textures: Record<string, THREE.Texture> = {};
      
      // Функция для генерации канваса с текстурой
      const createTextureCanvas = (terrainType: string): HTMLCanvasElement => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return canvas;
        
        const terrain = terrainTypes.find(t => t.id === terrainType);
        if (!terrain) return canvas;
        
        // Заполняем фон основным цветом
        ctx.fillStyle = terrain.color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Добавляем детали в зависимости от типа местности
        switch (terrainType) {
          case 'field':
            // Рисуем траву и небольшие детали
            ctx.strokeStyle = '#3da142';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
              const x = Math.random() * canvas.width;
              const y = Math.random() * canvas.height;
              ctx.moveTo(x, y);
              ctx.lineTo(x + 5, y - 10);
            }
            ctx.stroke();
            break;
            
          case 'hills':
            // Рисуем контуры холмов
            ctx.strokeStyle = '#e59a14';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 100);
            ctx.quadraticCurveTo(30, 50, 60, 100);
            ctx.quadraticCurveTo(90, 50, 128, 100);
            ctx.stroke();
            break;
            
          case 'forest':
            // Рисуем деревья
            ctx.fillStyle = '#2c5518';
            for (let i = 0; i < 5; i++) {
              const x = 20 + i * 20;
              const y = 80;
              // Ствол
              ctx.fillRect(x - 2, y, 4, 20);
              // Крона
              ctx.beginPath();
              ctx.moveTo(x - 15, y);
              ctx.lineTo(x, y - 30);
              ctx.lineTo(x + 15, y);
              ctx.fill();
            }
            break;
            
          case 'swamp':
            // Рисуем детали болот
            ctx.fillStyle = '#6c9e71';
            for (let i = 0; i < 20; i++) {
              const x = Math.random() * canvas.width;
              const y = Math.random() * canvas.height;
              const radius = 2 + Math.random() * 5;
              ctx.beginPath();
              ctx.arc(x, y, radius, 0, Math.PI * 2);
              ctx.fill();
            }
            break;
            
          case 'buildings':
            // Рисуем здания
            ctx.fillStyle = '#555555';
            for (let i = 0; i < 3; i++) {
              for (let j = 0; j < 3; j++) {
                const x = 10 + i * 40;
                const y = 10 + j * 40;
                ctx.fillRect(x, y, 30, 30);
              }
            }
            break;
            
          case 'water':
            // Рисуем волны
            ctx.strokeStyle = '#1976D2';
            ctx.lineWidth = 2;
            for (let i = 0; i < 5; i++) {
              const y = 20 + i * 20;
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.bezierCurveTo(30, y - 10, 60, y + 10, 128, y - 5);
              ctx.stroke();
            }
            break;

          case 'void':
            // Без дополнительных деталей — однотонная серая плитка
            // Фон уже залит основным цветом
            break;
            
          default:
            break;
        }
        
        return canvas;
      };
      
      // Создаем текстуры для каждого типа местности
      terrainTypes.forEach(terrain => {
        if (terrain.id !== 'empty') {
          const canvas = createTextureCanvas(terrain.id);
          const texture = new THREE.CanvasTexture(canvas);
          textures[terrain.id] = texture;
        }
      });
      
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
          
          // Пропускаем пустые клетки
          if (hex.terrainType === 'empty') {
            continue;
          }
          
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
            depth: hex.terrainType === 'void' ? 0 : (hex.height > 0 ? hex.height : 0.1),
            bevelEnabled: false
          };
          
          const hexGeometry = new THREE.ExtrudeGeometry(hexShape, extrudeSettings);
          // Поворачиваем геометрию, чтобы она была горизонтальной
          hexGeometry.rotateX(-Math.PI / 2);
          
          // Создаем материал с текстурой, если она доступна
          const texture = textures[hex.terrainType];
          const hexMaterial = texture 
            ? new THREE.MeshLambertMaterial({ 
                map: texture, 
                color: 0xffffff  // Белый цвет для неискаженного отображения текстуры
              })
            : new THREE.MeshLambertMaterial({ color: hex.color });
          
          // Создаем меш
          const hexMesh = new THREE.Mesh(hexGeometry, hexMaterial);
          hexMesh.castShadow = true;
          hexMesh.receiveShadow = true;
          
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
          
          // Добавляем юнит на карту, если он есть и юниты не скрыты
          if (hex.unit && showUnits) {
            // Создаем цилиндр для представления юнита
            const unitGeometry = new THREE.CylinderGeometry(0.3 * UNIT_SCALE, 0.3 * UNIT_SCALE, 0.4, 16);
            const unitMaterial = new THREE.MeshLambertMaterial({ 
              color: hex.unit.color,
              emissive: new THREE.Color(hex.unit.color).multiplyScalar(0.2) // Добавляем слабое свечение
            });
            
            const unitMesh = new THREE.Mesh(unitGeometry, unitMaterial);
            unitMesh.castShadow = true;
            unitMesh.receiveShadow = true;
            
            // Позиционируем юнит над гексом, учитывая высоту ландшафта
            unitMesh.position.x = hexMesh.position.x;
            unitMesh.position.z = hexMesh.position.z;
            
            // Размещаем юнит над поверхностью гекса, с учетом высоты ландшафта
            // Вычисляем высоту с учетом того, что высота хранится как коэффициент,
            // а depth из extrudeSettings - это фактическая высота в 3D
            const terrainHeight = hex.height > 0 ? hex.height : 0.1;
            unitMesh.position.y = terrainHeight + 0.2; // Устанавливаем юнит чуть выше поверхности
            
            // Добавляем круглую платформу под юнитом для визуального улучшения
            const platformGeometry = new THREE.CylinderGeometry(0.35 * UNIT_SCALE, 0.35 * UNIT_SCALE, 0.05, 16);
            const platformMaterial = new THREE.MeshLambertMaterial({ 
              color: 0x333333,
              emissive: 0x111111
            });
            const platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);
            platformMesh.position.set(
              unitMesh.position.x,
              unitMesh.position.y - 0.2, // Размещаем платформу под юнитом
              unitMesh.position.z
            );
            platformMesh.castShadow = true;
            platformMesh.receiveShadow = true;
            
            scene.add(platformMesh);
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
      const effectiveRadius = mapRadius + normalizedAdditionalRows;
      const gridHelper = new THREE.GridHelper(effectiveRadius * 4, effectiveRadius * 2);
      gridHelper.position.y = -0.05; // Размещаем сетку чуть ниже уровня местности
      gridHelper.material.opacity = 0.2;
      gridHelper.material.transparent = true;
      scene.add(gridHelper);

      // Добавляем небольшую декоративную плоскость под картой
      const planeGeometry = new THREE.PlaneGeometry(effectiveRadius * 6, effectiveRadius * 6);
      const planeMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x336699, 
        metalness: 0.1,
        roughness: 0.8,
        side: THREE.DoubleSide
      });
      const plane = new THREE.Mesh(planeGeometry, planeMaterial);
      plane.rotation.x = -Math.PI / 2; // Размещаем горизонтально
      plane.position.y = -0.1; // Немного ниже основной сетки
      plane.receiveShadow = true;
      scene.add(plane);
      
      // Добавляем туман для создания атмосферы
      scene.fog = new THREE.FogExp2(0x87CEEB, 0.01);
      
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
  }, [show3DPreview, hexMap, mapRadius, orientation, showUnits, normalizedAdditionalRows]);
  
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
    
    // Определяем курсор и обработчики в зависимости от режима
    let cursorStyle = "pointer";
    if (editMode === 'manage' && manageAction === 'delete') {
      cursorStyle = "not-allowed";
    }
    
    // Находим информацию о текущем типе местности
    const terrainInfo = terrainTypes.find(t => t.id === hex.terrainType);
    const fillValue = terrainInfo && terrainInfo.pattern ? `url(#${hex.terrainType}Pattern)` : hex.color;
    
    // Создаем гекс без юнита, юниты будут отрисованы отдельно позже
    return (
      <polygon
        key={`hex-${hex.q},${hex.r},${hex.s}`}
        points={points.join(' ')}
        fill={fillValue}
        stroke="#333"
        strokeWidth="1"
        style={{ cursor: cursorStyle }}
        onMouseDown={(e) => {
          if (editMode === 'manage' && manageAction === 'delete') {
            handleHexClick(hex);
            e.stopPropagation();
          } else if (editMode !== 'rivers') {
            handleMouseDown(hex, e);
          }
        }}
        onMouseEnter={() => handleMouseEnter(hex)}
      />
    );
  };

  // Отдельная функция для отрисовки юнитов
  const renderUnitSVG = (hex: {q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string}}) => {
    if (!hex.unit || !showUnits) return null;
    
    const { x, y } = getHexPosition(hex.q, hex.r);
    const size = 20;
    
    return (
      <g key={`unit-${hex.q},${hex.r},${hex.s}`}>
        <circle 
          cx={x} 
          cy={y} 
          r={size * UNIT_SCALE / 2} 
          fill={hex.unit.color} 
          stroke="#000" 
          strokeWidth="1"
          style={{ cursor: editMode === 'units' && selectedUnit === null ? 'not-allowed' : 'pointer', userSelect: 'none', pointerEvents: 'all' }}
          onClick={(e) => handleUnitClick(hex, e)}
        />
        <text 
          x={x} 
          y={y} 
          textAnchor="middle" 
          dominantBaseline="middle" 
          fill="white"
          fontSize={size * UNIT_SCALE / 2}
          fontWeight="bold"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {hex.unit.icon}
        </text>
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
  const resizeMap = useCallback((newRadius: number, additionalRowsOverride?: number) => {
    // Ограничиваем максимальный радиус для производительности
    const safeRadius = Math.min(newRadius, 15);
    if (safeRadius !== newRadius) {
      setMapRadius(safeRadius);
      newRadius = safeRadius;
    }

    const rowsToUse = additionalRowsOverride ?? normalizedAdditionalRows;

    // Сохраняем текущую карту в виде объекта для быстрого доступа
    const currentHexes: Record<string, {q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string} }> = {};
    hexMap.forEach(hex => {
      const key = `${hex.q},${hex.r},${hex.s}`;
      currentHexes[key] = hex;
    });
    
    // Используем setTimeout для предотвращения блокировки интерфейса
    setTimeout(() => {
      const newMap: Array<{q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string} }> = [];
      const fieldTerrain = terrainTypes.find(t => t.id === 'field') || terrainTypes[0];

      // Создаем новую карту с новым радиусом
      for (let q = -newRadius; q <= newRadius; q++) {
        const { start: r1, end: r2 } = getRowBounds(newRadius, q, rowsToUse);

        for (let r = r1; r <= r2; r++) {
          const s = -q - r; // q + r + s = 0
          const key = `${q},${r},${s}`;

          // Если гекс существовал ранее, сохраняем его свойства
          if (currentHexes[key]) {
            newMap.push(currentHexes[key]);
          } else {
            // Для новых гексов всегда используем тип "поле"
            newMap.push({
              q,
              r,
              s,
              terrainType: fieldTerrain.id,
              color: fieldTerrain.color,
              height: fieldTerrain.height
            });
          }
        }
      }
      
      // Подсчитываем количество видимых (не пустых) гексов
      const visibleHexCount = newMap.filter(hex => hex.terrainType !== 'empty').length;

      setHexMap(newMap);
      setHexCount(visibleHexCount);
      setMapRadius(newRadius);
    }, 0);
  }, [hexMap, terrainTypes, normalizedAdditionalRows]);

  const increaseRadius = useCallback(() => {
    // Ограничиваем максимальный радиус
    if (mapRadius >= 15) return;
    resizeMap(mapRadius + 1);
  }, [mapRadius, resizeMap]);

  const decreaseRadius = useCallback(() => {
    if (mapRadius <= 1) return;
    resizeMap(mapRadius - 1);
  }, [mapRadius, resizeMap]);

  const handleMiddleRowsChange = useCallback((value: number) => {
    const numericValue = Math.max(0, Math.min(Math.floor(value), mapRadius));
    setMiddleRowsToAdd(numericValue);

    if (!showSizeInput && hexMap.length > 0) {
      const normalizedValue = normalizeAdditionalMiddleRows(numericValue);
      resizeMap(mapRadius, normalizedValue);
    }
  }, [hexMap.length, mapRadius, resizeMap, showSizeInput]);

  useEffect(() => {
    if (middleRowsToAdd > mapRadius) {
      handleMiddleRowsChange(mapRadius);
    }
  }, [handleMiddleRowsChange, mapRadius, middleRowsToAdd]);

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
      const { start: r1, end: r2 } = getRowBounds(safeRadius, q, normalizedAdditionalRows);

      for (let r = r1; r <= r2; r++) {
        const s = -q - r; // q + r + s = 0

        // Все гексы создаются с типом поля
        const fieldTerrain = terrainTypes.find(t => t.id === 'field') || terrainTypes[0];

        newMap.push({
          q,
          r,
          s,
          terrainType: fieldTerrain.id,
          color: fieldTerrain.color,
          height: fieldTerrain.height
        });
      }
    }

    setHexMap(newMap);
    setHexCount(newMap.length);
    setShowSizeInput(false);
    // Сбрасываем трансформацию при создании новой карты
    setViewTransform({ scale: 1, x: 0, y: 0 });
  }, [hexMap.length, mapRadius, normalizedAdditionalRows, terrainTypes, resizeMap]);

  // Функция для загрузки карты из JSON
  const importFromJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        
        // Проверяем структуру данных
        if (!jsonData.hexes || !Array.isArray(jsonData.hexes) || typeof jsonData.mapRadius !== 'number') {
          throw new Error('Неверный формат файла: отсутствует hexes или mapRadius');
        }

        if (jsonData.rivers && Array.isArray(jsonData.rivers)) {
          // Обеспечиваем обратную совместимость - добавляем значения по умолчанию для старых файлов
          const riversWithDefaults = jsonData.rivers.map((river: any) => ({
            ...river,
            thickness: river.thickness || 3,
            smoothingEnabled: river.smoothingEnabled ?? true
          }));
          setRivers(riversWithDefaults);
        } else {
          setRivers([]);
        }

        // Сначала создаем полную карту с полями
        const fieldTerrain = terrainTypes.find(t => t.id === 'field') || terrainTypes[0];
        const radius = jsonData.mapRadius;
        const importedMaxPlayerUnits = typeof jsonData.maxPlayerUnits === 'number' ? jsonData.maxPlayerUnits : 8; // Значение по умолчанию, если отсутствует
        const additionalRowsFromJson = normalizeAdditionalMiddleRows(jsonData.additionalMiddleRows ?? 0);
        const fullMap: Array<{q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string} }> = [];

        // Создаем базовую карту с полями
        for (let q = -radius; q <= radius; q++) {
          const { start: r1, end: r2 } = getRowBounds(radius, q, additionalRowsFromJson);

          for (let r = r1; r <= r2; r++) {
            const s = -q - r; // q + r + s = 0

            fullMap.push({
              q,
              r,
              s,
              terrainType: fieldTerrain.id,
              color: fieldTerrain.color,
              height: fieldTerrain.height
            });
          }
        }
        
        // Создаем индекс для быстрого доступа
        const hexIndex: Record<string, number> = {};
        fullMap.forEach((hex, index) => {
          const key = `${hex.q},${hex.r},${hex.s}`;
          hexIndex[key] = index;
        });
        
        // Обновляем гексы на основе загруженных данных
        jsonData.hexes.forEach((hex: { position: { q: number; r: number; s: number }; terrainType: string; unit?: { type: string } }) => {
          // Пропускаем гексы, которые не должны быть на карте
          if (hex.terrainType === 'empty') return;
          
          const key = `${hex.position.q},${hex.position.r},${hex.position.s}`;
          const index = hexIndex[key];
          
          // Если гекс находится в пределах карты
          if (index !== undefined) {
            const terrainInfo = terrainTypes.find(t => t.id === hex.terrainType) || terrainTypes[0];
            
            // Обновляем гекс
            fullMap[index] = {
              ...fullMap[index],
              terrainType: terrainInfo.id,
              color: terrainInfo.color,
              height: terrainInfo.height
            };
            
            // Добавляем юнит, если он существует в JSON
            if (hex.unit && hex.unit.type) {
              const unitInfo = unitTypes.find(u => u.id === hex.unit?.type) || unitTypes[0];
              fullMap[index].unit = {
                type: unitInfo.id,
                icon: unitInfo.icon,
                color: unitInfo.color
              };
            }
          }
        });
        
        // Подсчитываем количество видимых гексов (не пустых)
        const visibleHexCount = fullMap.filter(hex => hex.terrainType !== 'empty').length;
        
        // Обновляем состояние карты
        setMapRadius(radius);
        setMiddleRowsToAdd(additionalRowsFromJson);
        setHexMap(fullMap);
        setHexCount(visibleHexCount);
        setShowSizeInput(false);
        setMaxPlayerUnits(importedMaxPlayerUnits); // Устанавливаем импортированное или значение по умолчанию
        
        // Сбрасываем вид
        setViewTransform({ scale: 1, x: 0, y: 0 });

      } catch (error) {
        alert('Ошибка при загрузке файла: ' + (error as Error).message);
      }
    };
    reader.readAsText(file);
    
    // Очищаем input для возможности повторной загрузки того же файла
    event.target.value = '';
  };

  // Функция для восстановления удаленных гексов
  const restoreDeletedHexes = () => {
    if (deletedHexes.length === 0) {
      alert('Нет удаленных гексов для восстановления.');
      return;
    }
    
    // Восстанавливаем удаленные гексы
    let updatedMap = [...hexMap];
    let restoredCount = 0;
    
    deletedHexes.forEach(deletedHex => {
      // Находим соответствующий гекс в текущей карте
      const index = updatedMap.findIndex(h => 
        h.q === deletedHex.q && h.r === deletedHex.r && h.s === deletedHex.s
      );
      
      if (index !== -1 && updatedMap[index].terrainType === 'empty') {
        // Восстанавливаем удаленный гекс
        updatedMap[index] = {...deletedHex};
        restoredCount++;
      }
    });
    
    if (restoredCount === 0) {
      alert('Не удалось восстановить гексы. Возможно, они уже были изменены или выходят за границы текущей карты.');
      return;
    }
    
    setHexMap(updatedMap);
    setHexCount(prev => prev + restoredCount);
    setDeletedHexes([]);
    
    alert(`Восстановлено ${restoredCount} гексов.`);
  };

  // Отрисовываем контуры потенциальных гексов в режиме добавления
  const renderPotentialHexes = () => {
    if (editMode !== 'manage' || manageAction !== 'add') return null;
    
    // Отображаем только пустые гексы как потенциальные
    const emptyHexes = hexMap.filter(hex => hex.terrainType === 'empty');
    
    return emptyHexes.map(hex => {
      const { x, y } = getHexPosition(hex.q, hex.r);
      const size = 20;
      const points = [];
      
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i + (orientation === 'pointy' ? Math.PI / 6 : 0);
        const point_x = x + size * Math.cos(angle);
        const point_y = y + size * Math.sin(angle);
        points.push(`${point_x},${point_y}`);
      }
      
      // Используем шаблонное заполнение для потенциальных гексов
      return (
        <g key={`potential-${hex.q},${hex.r},${hex.s}`}>
          <defs>
            <pattern 
              id={`potentialHexPattern-${hex.q}-${hex.r}-${hex.s}`} 
              patternUnits="userSpaceOnUse" 
              width="10" 
              height="10"
            >
              <rect width="10" height="10" fill="#f0f0f0" />
              <path d="M-1,1 l2,-2 M0,10 l10,-10 M9,11 l2,-2" stroke="#888" strokeWidth="1" />
            </pattern>
          </defs>
          <polygon
            points={points.join(' ')}
            fill={`url(#potentialHexPattern-${hex.q}-${hex.r}-${hex.s})`}
            stroke="#999"
            strokeWidth="1"
            strokeDasharray="3,3"
            style={{ cursor: "pointer" }}
            onClick={() => handleHexClick(hex)}
          />
        </g>
      );
    });
  };

  // Функция для импорта сгенерированного ландшафта
  const handleGeneratedTerrain = (
    generatedMap: Array<{q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string}}>,
    generatedHexCount: number
  ) => {
    setHexMap(generatedMap);
    setHexCount(generatedHexCount);
    setShowSizeInput(false);
    setShowTerrainGenerator(false);
    // Сбрасываем трансформацию при создании новой карты
    setViewTransform({ scale: 1, x: 0, y: 0 });
  };

  // Обработчик клика по юниту
  const handleUnitClick = (hex: {q: number; r: number; s: number; terrainType: string; color: string; height: number; unit?: {type: string; icon: string; color: string}}, e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем всплытие события к гексу
    
    if (editMode === 'units' && selectedUnit === null) {
      // Если мы в режиме удаления юнита (выбрано "Удалить юнит")
      const updatedMap = hexMap.map(h => {
        if (h.q === hex.q && h.r === hex.r && h.s === hex.s) {
          // Удаляем юнит с гекса
          const { unit, ...restHex } = h;
          return restHex;
        }
        return h;
      });
      setHexMap(updatedMap);
    }
  };

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
    
    if (editMode === 'rivers' && svgElement.current) {
      // Используем встроенный метод SVG для правильного преобразования координат
      const svg = svgElement.current;
      const ctm = svg.getScreenCTM();
      
      if (!ctm) return;
      
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      
      // Преобразуем координаты экрана в координаты SVG с учетом всех трансформаций
      const svgP = pt.matrixTransform(ctm.inverse());
      const mouseX = svgP.x;
      const mouseY = svgP.y;

      let closestVertex: Vertex | null = null;
      let minDistance = Infinity;

      allVertices.forEach(vertex => {
        const distance = Math.sqrt(Math.pow(vertex.x - mouseX, 2) + Math.pow(vertex.y - mouseY, 2));
        // Уменьшаем порог привязки при перетаскивании для более точного контроля
        const snapThreshold = isDraggingPoint ? 8 : 15;
        if (distance < minDistance && distance < snapThreshold) {
          minDistance = distance;
          closestVertex = vertex;
        }
      });

      setHoveredVertex(closestVertex);

      if (isDraggingPoint && draggedPointInfo) {
        setRivers(prevRivers =>
          prevRivers.map(river => {
            if (river.id === draggedPointInfo.riverId) {
              const newPoints = [...river.points];
              // Если есть ближайшая вершина, привязываемся к ней, иначе используем координаты мыши
              if (closestVertex) {
                newPoints[draggedPointInfo.pointIndex] = { x: closestVertex.x, y: closestVertex.y };
              } else {
                // Свободное перетаскивание без привязки к вершинам
                newPoints[draggedPointInfo.pointIndex] = { x: mouseX, y: mouseY };
              }
              return { ...river, points: newPoints };
            }
            return river;
          })
        );
      }
    }
  }, [isDragging, dragStart, editMode, allVertices, viewTransform, isDraggingPoint, draggedPointInfo]);
  
  const handleCanvasClick = useCallback(() => {
    if (editMode === 'rivers' && hoveredVertex && selectedRiverId) {
      setRivers(prevRivers =>
        prevRivers.map(river => {
          if (river.id === selectedRiverId) {
            // Проверяем, не добавляем ли мы точку слишком близко к уже существующей
            const newPoint = { x: hoveredVertex.x, y: hoveredVertex.y };
            const tooClose = river.points.some(point => 
              Math.sqrt(Math.pow(point.x - newPoint.x, 2) + Math.pow(point.y - newPoint.y, 2)) < 5
            );
            
            if (!tooClose) {
              return { ...river, points: [...river.points, newPoint] };
            }
          }
          return river;
        })
      );
    }
  }, [editMode, hoveredVertex, selectedRiverId]);

  const handleSvgMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsDraggingPoint(false);
    setDraggedPointInfo(null);
  }, []);

  // Функция для отрисовки рек
  const renderRivers = () => {
    return rivers.map(river => {
      if (river.points.length === 0) {
        return null;
      }
      
      // Если только одна точка, показываем её как круг
      if (river.points.length === 1 && river.id === selectedRiverId) {
        return (
          <g key={river.id}>
            <circle
              cx={river.points[0].x}
              cy={river.points[0].y}
              r="4"
              fill={isDraggingPoint && draggedPointInfo?.riverId === river.id && draggedPointInfo?.pointIndex === 0 ? "orange" : "red"}
              style={{ cursor: isDraggingPoint ? 'grabbing' : 'grab' }}
              onMouseDown={(e) => {
                if (e.button === 0) {
                  e.stopPropagation();
                  setIsDraggingPoint(true);
                  setDraggedPointInfo({ riverId: river.id, pointIndex: 0 });
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setRivers(prevRivers =>
                  prevRivers.map(r =>
                    r.id === river.id
                      ? { ...r, points: [] }
                      : r
                  )
                );
              }}
            />
          </g>
        );
      }
      
      if (river.points.length < 2) {
        return null;
      }

      // Создаем путь для реки с учетом настроек сглаживания
      let pathData = `M ${river.points[0].x} ${river.points[0].y}`;
      
      if (!river.smoothingEnabled || river.points.length === 2) {
        // Без сглаживания или для двух точек - просто прямые линии
        for (let i = 1; i < river.points.length; i++) {
          pathData += ` L ${river.points[i].x} ${river.points[i].y}`;
        }
      } else {
        // Со сглаживанием - используем простые кривые Безье
        for (let i = 1; i < river.points.length; i++) {
          const prev = river.points[i - 1];
          const current = river.points[i];
          
          if (i === 1) {
            // Первый сегмент - прямая линия
            pathData += ` L ${current.x} ${current.y}`;
          } else {
            // Остальные сегменты - квадратичные кривые для плавности
            const prevPrev = river.points[i - 2];
            const controlX = prev.x + (current.x - prevPrev.x) * 0.1;
            const controlY = prev.y + (current.y - prevPrev.y) * 0.1;
            
            pathData += ` Q ${controlX} ${controlY}, ${current.x} ${current.y}`;
          }
        }
      }

      return (
        <g key={river.id}>
          <path
            d={pathData}
            stroke="blue"
            strokeWidth={river.thickness}
            fill="none"
            opacity={0.7}
          />
          {river.id === selectedRiverId && river.points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="4"
              fill={isDraggingPoint && draggedPointInfo?.riverId === river.id && draggedPointInfo?.pointIndex === index ? "orange" : "red"}
              style={{ cursor: isDraggingPoint ? 'grabbing' : 'grab' }}
              onMouseDown={(e) => {
                if (e.button === 0) { // Left click to drag
                  e.stopPropagation();
                  setIsDraggingPoint(true);
                  setDraggedPointInfo({ riverId: river.id, pointIndex: index });
                }
              }}
              onContextMenu={(e) => { // Right click to delete
                e.preventDefault();
                setRivers(prevRivers =>
                  prevRivers.map(r =>
                    r.id === river.id
                      ? { ...r, points: r.points.filter((_, i) => i !== index) }
                      : r
                  )
                );
              }}
            />
          ))}
        </g>
      );
    });
  };

  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4 bg-gray-800 rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-4 text-white flex items-center">
        <RiMapFill className="mr-2 text-yellow-400" /> 
        Редактор Гексагональных Карт
      </h1>
      
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
            <div className="flex items-center">
              <label className="w-32 text-gray-700">Ряды в центре:</label>
              <input
                type="number"
                value={middleRowsToAdd}
                onChange={(e) => handleMiddleRowsChange(parseInt(e.target.value) || 0)}
                className="border rounded px-3 py-2 w-24 text-center"
                min="0"
                max={mapRadius}
              />
            </div>
            <div className="flex items-center">
              <label className="w-32 text-gray-700">Макс. шашек игрока:</label>
              <input
                type="number"
                value={maxPlayerUnits}
                onChange={(e) => setMaxPlayerUnits(parseInt(e.target.value) || 0)}
                className="border rounded px-3 py-2 w-24 text-center"
                min="0"
              />
            </div>
            <div className="text-sm text-gray-600 ml-32">
              Примерное количество гексов: {estimatedHexCount}
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
            <div className="flex gap-2">
              <button
                onClick={initializeMap}
                className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                {hexMap.length > 0 ? "Изменить размер" : "Создать пустую карту"}
              </button>
              <button
                onClick={() => setShowTerrainGenerator(true)}
                className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                Сгенерировать ландшафт
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <div className="mb-4 p-4 bg-white rounded-lg shadow-md">
            <div className="flex flex-col space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Режим редактирования</h2>
                <div className="flex items-center space-x-2">
                  <label className="text-gray-700 mr-4">
                    <input 
                      type="checkbox" 
                      checked={showUnits} 
                      onChange={() => setShowUnits(!showUnits)}
                      className="mr-1"
                    />
                    Показать юниты
                  </label>
                  <label className="text-gray-700 mr-2">Макс. шашек игрока:</label>
                  <input
                    type="number"
                    value={maxPlayerUnits}
                    onChange={(e) => setMaxPlayerUnits(parseInt(e.target.value) || 0)}
                    className="border rounded px-2 py-1 w-16 text-center mr-4"
                    min="0"
                  />
                  <label className="text-gray-700 mr-2">Ряды в центре:</label>
                  <input
                    type="number"
                    value={middleRowsToAdd}
                    onChange={(e) => handleMiddleRowsChange(parseInt(e.target.value) || 0)}
                    className="border rounded px-2 py-1 w-16 text-center mr-4"
                    min="0"
                    max={mapRadius}
                  />
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
                <button
                  onClick={() => setEditMode('manage')}
                  className={`px-3 py-2 rounded-md ${
                    editMode === 'manage' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                  }`}
                >
                  Управление гексами
                </button>
                <button
                  onClick={() => setEditMode('rivers')}
                  className={`px-3 py-2 rounded-md ${
                    editMode === 'rivers' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                  }`}
                >
                  <FaWater className="inline-block mr-2" />
                  Реки
                </button>
              </div>
              
              {editMode === 'terrain' ? (
                // Панель для выбора типа местности
                <div className="flex flex-wrap gap-2">
                  {terrainTypes.filter(terrain => terrain.id !== 'empty').map(terrain => (
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
              ) : editMode === 'units' ? (
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
              ) : editMode === 'manage' ? (
                // Панель для управления гексами (добавление/удаление)
                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      onClick={() => setManageAction('add')}
                      className={`px-3 py-2 rounded-md bg-green-500 text-white shadow ${
                        manageAction === 'add' ? 'ring-2 ring-black' : ''
                      }`}
                    >
                      Добавить гексы
                    </button>
                    <button
                      onClick={() => setManageAction('delete')}
                      className={`px-3 py-2 rounded-md bg-red-500 text-white shadow ${
                        manageAction === 'delete' ? 'ring-2 ring-black' : ''
                      }`}
                    >
                      Удалить гексы
                    </button>
                  </div>
                  {manageAction === 'add' && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">
                        Кликните по полупрозрачным контурам, чтобы добавить гексы с выбранным типом местности:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {terrainTypes.filter(terrain => terrain.id !== 'empty').map(terrain => (
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
                    </div>
                  )}
                  {manageAction === 'delete' && (
                    <p className="text-sm text-gray-600">
                      Кликните по существующему гексу, чтобы удалить его с карты.
                    </p>
                  )}
                </div>
              ) : editMode === 'rivers' ? (
                // Панель для управления реками
                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      onClick={() => {
                        const newRiverId = `river-${Date.now()}`;
                        setRivers([...rivers, { 
                          id: newRiverId, 
                          points: [], 
                          thickness: 3, 
                          smoothingEnabled: true 
                        }]);
                        setSelectedRiverId(newRiverId);
                      }}
                      className="px-3 py-2 rounded-md bg-green-500 text-white shadow"
                    >
                      Добавить реку
                    </button>
                    <button
                      onClick={() => {
                        if (selectedRiverId) {
                          setRivers(rivers.filter(r => r.id !== selectedRiverId));
                          setSelectedRiverId(null);
                        }
                      }}
                      disabled={!selectedRiverId}
                      className="px-3 py-2 rounded-md bg-red-500 text-white shadow disabled:bg-gray-400"
                    >
                      Удалить выбранную реку
                    </button>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm text-gray-600">Выберите реку для редактирования:</p>
                    <div className="flex flex-col gap-1 mt-1">
                      {rivers.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">Нет созданных рек. Нажмите "Добавить реку" для создания.</p>
                      ) : (
                        rivers.map((river, index) => (
                          <button
                            key={river.id}
                            onClick={() => setSelectedRiverId(river.id)}
                            className={`text-left px-2 py-1 rounded ${selectedRiverId === river.id ? 'bg-blue-200' : 'bg-gray-100'}`}
                          >
                            Река {index + 1} ({river.points.length} точек, толщина: {river.thickness}{river.smoothingEnabled ? ', сглаженная' : ', угловатая'})
                          </button>
                        ))
                      )}
                    </div>
                    {!selectedRiverId && rivers.length > 0 && (
                      <p className="text-xs text-orange-600 mt-1">⚠️ Выберите реку из списка выше для редактирования</p>
                    )}
                    {selectedRiverId && (
                      <div className="mt-2">
                        <p className="text-xs text-green-600 mb-2">ЛКМ на углы (синие круги) или центры (зеленые квадраты) гексов</p>
                        <p className="text-xs text-red-600 mb-2">ПКМ по точке для удаления</p>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <label className="text-xs text-gray-600 w-16">Толщина:</label>
                            <input
                              type="range"
                              min="1"
                              max="30"
                              step="0.5"
                              value={rivers.find(r => r.id === selectedRiverId)?.thickness || 3}
                              onChange={(e) => {
                                const newThickness = parseFloat(e.target.value);
                                setRivers(prevRivers =>
                                  prevRivers.map(river =>
                                    river.id === selectedRiverId
                                      ? { ...river, thickness: newThickness }
                                      : river
                                  )
                                );
                              }}
                              className="flex-1"
                            />
                            <span className="text-xs text-gray-600 w-8">
                              {rivers.find(r => r.id === selectedRiverId)?.thickness || 3}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <label className="text-xs text-gray-600">
                              <input
                                type="checkbox"
                                checked={rivers.find(r => r.id === selectedRiverId)?.smoothingEnabled ?? true}
                                onChange={(e) => {
                                  setRivers(prevRivers =>
                                    prevRivers.map(river =>
                                      river.id === selectedRiverId
                                        ? { ...river, smoothingEnabled: e.target.checked }
                                        : river
                                    )
                                  );
                                }}
                                className="mr-1"
                              />
                              Сглаживание
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // Панель для управления гексами (добавление/удаление)
                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      onClick={() => setManageAction('add')}
                      className={`px-3 py-2 rounded-md bg-green-500 text-white shadow ${
                        manageAction === 'add' ? 'ring-2 ring-black' : ''
                      }`}
                    >
                      Добавить гексы
                    </button>
                    <button
                      onClick={() => setManageAction('delete')}
                      className={`px-3 py-2 rounded-md bg-red-500 text-white shadow ${
                        manageAction === 'delete' ? 'ring-2 ring-black' : ''
                      }`}
                    >
                      Удалить гексы
                    </button>
                  </div>
                  {manageAction === 'add' && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">
                        Кликните по полупрозрачным контурам, чтобы добавить гексы с выбранным типом местности:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {terrainTypes.filter(terrain => terrain.id !== 'empty').map(terrain => (
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
                    </div>
                  )}
                  {manageAction === 'delete' && (
                    <p className="text-sm text-gray-600">
                      Кликните по существующему гексу, чтобы удалить его с карты.
                    </p>
                  )}
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
                    Макс. шашек игрока: {maxPlayerUnits}
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
                style={{ height: '70vh', cursor: isDragging ? 'grabbing' : editMode === 'manage' ? (manageAction === 'add' ? 'crosshair' : 'not-allowed') : 'grab' }}
                onMouseDown={handleSvgMouseDown}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={() => {
                  handleSvgMouseUp();
                  handleCanvasClick();
                }}
                onClick={handleCanvasClick}
                onMouseLeave={handleMouseUp}
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
                  <defs>
                    {terrainTypes.filter(terrain => terrain.pattern).map(terrain => (
                      <React.Fragment key={terrain.id}>
                        {terrain.pattern}
                      </React.Fragment>
                    ))}
                  </defs>
                  
                  {/* Рендерим сначала все потенциальные гексы */}
                  {editMode === 'manage' && manageAction === 'add' && renderPotentialHexes()}
                  
                  {/* Рендерим все обычные гексы */}
                  <g>
                    {visibleHexes.map(renderHexSVG)}
                  </g>
                  
                  {renderRivers()}

                  {editMode === 'rivers' && hoveredVertex && (
                    hoveredVertex.index === -1 ? (
                      // Центр гекса - отображаем квадратом
                      <rect
                        x={hoveredVertex.x - 4}
                        y={hoveredVertex.y - 4}
                        width="8"
                        height="8"
                        fill="rgba(0, 255, 0, 0.6)"
                        stroke="green"
                        strokeWidth="2"
                        style={{ pointerEvents: 'none' }}
                      />
                    ) : (
                      // Вершина гекса - отображаем кругом
                      <circle
                        cx={hoveredVertex.x}
                        cy={hoveredVertex.y}
                        r="5"
                        fill="rgba(0, 0, 255, 0.5)"
                        stroke="blue"
                        strokeWidth="2"
                        style={{ pointerEvents: 'none' }}
                      />
                    )
                  )}

                  {/* Рендерим все юниты поверх гексов */}
                  <g style={{ pointerEvents: 'all' }}>
                    {visibleHexes.map(renderUnitSVG)}
                  </g>
                </svg>
                <div className="absolute bottom-2 right-2 bg-white bg-opacity-75 p-2 rounded text-xs">
                  <p>Колесико мыши: масштаб</p>
                  <p>Правая кнопка мыши: перемещение</p>
                  <p>Левая кнопка мыши: {
                    editMode === 'manage' 
                      ? (manageAction === 'add' ? 'добавление гексов' : 'удаление гексов') 
                      : editMode === 'rivers' ? 'добавление точек реки' : 'рисование'
                  }</p>
                  {editMode === 'rivers' && (
                    <div className="mt-1 pt-1 border-t border-gray-300">
                      <p>Вершин: {allVertices.length}</p>
                      <p>Выбрана река: {selectedRiverId ? 'Да' : 'Нет'}</p>
                      <p>Подсвечена вершина: {hoveredVertex ? 'Да' : 'Нет'}</p>
                      {hoveredVertex && (
                        <p>Позиция: ({Math.round(hoveredVertex.x)}, {Math.round(hoveredVertex.y)}) - {hoveredVertex.index === -1 ? 'Центр' : 'Угол'}</p>
                      )}
                    </div>
                  )}
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
          
          <div className="mt-4 space-y-4">
            {/* Группа для работы с файлами */}
            <div className="bg-gray-700 p-3 rounded-lg shadow-inner">
              <h3 className="text-white text-sm mb-2 font-semibold flex items-center">
                <FaFile className="mr-2" /> Работа с файлами
              </h3>
              <div className="grid grid-cols-2 gap-3">
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
                    className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 transform hover:scale-105 cursor-pointer w-full h-full"
                  >
                    <FaUpload className="mr-2" />
                    Загрузить карту
                  </label>
                </div>
                <button
                  onClick={exportToJSON}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 transform hover:scale-105"
                >
                  <FaSave className="mr-2" />
                  Экспорт в JSON
                </button>
              </div>
            </div>
            
            {/* Группа для просмотра и визуализации */}
            <div className="bg-gray-700 p-3 rounded-lg shadow-inner">
              <h3 className="text-white text-sm mb-2 font-semibold flex items-center">
                <FaEye className="mr-2" /> Просмотр и генерация
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShow3DPreview(!show3DPreview)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 transform hover:scale-105"
                >
                  <FaCube className="mr-2" />
                  {show3DPreview ? "Скрыть 3D" : "Показать 3D"}
                </button>
                <button
                  onClick={() => setShowTerrainGenerator(!showTerrainGenerator)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 transform hover:scale-105"
                >
                  <RiEarthLine className="mr-2" />
                  {showTerrainGenerator ? "Скрыть генератор" : "Генератор ландшафта"}
                </button>
              </div>
            </div>
            
            {/* Группа для редактирования карты */}
            <div className="bg-gray-700 p-3 rounded-lg shadow-inner">
              <h3 className="text-white text-sm mb-2 font-semibold flex items-center">
                <FaEdit className="mr-2" /> Изменение карты
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowSizeInput(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 transform hover:scale-105"
                >
                  <FaRuler className="mr-2" />
                  Изменить размер
                </button>
                <button
                  onClick={restoreDeletedHexes}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 transform hover:scale-105"
                  title="Восстановить последние удаленные гексы"
                >
                  <FaUndo className="mr-2" />
                  Восстановить гексы
                </button>
                <button
                  onClick={() => {
                    setHexMap([]);
                    setShowSizeInput(true);
                    // Примечание: maxPlayerUnits не сбрасывается здесь намеренно,
                    // чтобы пользователь мог его настроить на экране создания карты.
                    // Если нужен полный сброс, добавьте setMaxPlayerUnits(10);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 col-span-2 transform hover:scale-105"
                >
                  <FaTimes className="mr-2" />
                  Начать заново
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {showTerrainGenerator && (
        <TerrainGeneratorPanel
          terrainTypes={terrainTypes}
          onGenerateTerrain={handleGeneratedTerrain}
          radius={mapRadius}
          additionalMiddleRows={middleRowsToAdd}
        />
      )}
    </div>
  );
};

export default HexMapEditor;