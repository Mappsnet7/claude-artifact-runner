// src/artifacts/index.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TerrainGeneratorPanel from './TerrainGeneratorPanel';
import {
  FaSave, FaUndo, FaTimes, FaUpload, FaCube,
  FaRuler, FaEdit, FaFile, FaEye
} from 'react-icons/fa';
import { RiMapFill, RiEarthLine } from 'react-icons/ri';
import type { HexData, TerrainType, UnitType, EditMode, ViewTransform } from './types';
import { getHexPosition, calculateSvgDimensions } from './hexUtils';
import { useHexMap } from './useHexMap';
import { use3DPreview } from './use3DPreview';

// ─── SVG pattern definitions (visual only, not used for logic) ─────────────────

const svgPatternDefs: Record<string, React.ReactNode> = {
  field: (
    <pattern key="fieldPattern" id="fieldPattern" patternUnits="userSpaceOnUse" width="20" height="20">
      <rect width="20" height="20" fill="#4CAF50" />
      <path d="M0,10 L20,10 M10,0 L10,20" stroke="#3da142" strokeWidth="0.5" />
      <circle cx="10" cy="10" r="1" fill="#8bc34a" />
    </pattern>
  ),
  hills: (
    <pattern key="hillsPattern" id="hillsPattern" patternUnits="userSpaceOnUse" width="20" height="20">
      <rect width="20" height="20" fill="#F9A825" />
      <path d="M0,15 Q5,5 10,15 Q15,5 20,15" stroke="#e59a14" strokeWidth="1.5" fill="none" />
    </pattern>
  ),
  forest: (
    <pattern key="forestPattern" id="forestPattern" patternUnits="userSpaceOnUse" width="20" height="20">
      <rect width="20" height="20" fill="#33691E" />
      <path d="M5,15 L8,5 L11,15 Z" fill="#2c5518" />
      <path d="M12,13 L15,5 L18,13 Z" fill="#2c5518" />
    </pattern>
  ),
  swamp: (
    <pattern key="swampPattern" id="swampPattern" patternUnits="userSpaceOnUse" width="20" height="20">
      <rect width="20" height="20" fill="#1B5E20" />
      <circle cx="5" cy="5" r="1.5" fill="#6c9e71" />
      <circle cx="15" cy="5" r="1" fill="#6c9e71" />
      <circle cx="10" cy="10" r="2" fill="#6c9e71" />
      <circle cx="5" cy="15" r="1" fill="#6c9e71" />
      <circle cx="15" cy="15" r="1.5" fill="#6c9e71" />
    </pattern>
  ),
  buildings: (
    <pattern key="buildingsPattern" id="buildingsPattern" patternUnits="userSpaceOnUse" width="20" height="20">
      <rect width="20" height="20" fill="#424242" />
      <rect x="2" y="2" width="7" height="7" fill="#555555" />
      <rect x="11" y="2" width="7" height="7" fill="#555555" />
      <rect x="2" y="11" width="7" height="7" fill="#555555" />
      <rect x="11" y="11" width="7" height="7" fill="#555555" />
    </pattern>
  ),
  water: (
    <pattern key="waterPattern" id="waterPattern" patternUnits="userSpaceOnUse" width="20" height="20">
      <rect width="20" height="20" fill="#2196F3" />
      <path d="M0,5 Q5,3 10,5 Q15,7 20,5" stroke="#1976D2" strokeWidth="1" fill="none" />
      <path d="M0,10 Q5,8 10,10 Q15,12 20,10" stroke="#1976D2" strokeWidth="1" fill="none" />
      <path d="M0,15 Q5,13 10,15 Q15,17 20,15" stroke="#1976D2" strokeWidth="1" fill="none" />
    </pattern>
  ),
};

const TERRAIN_IDS_WITH_PATTERN = Object.keys(svgPatternDefs);

// ─── Component ─────────────────────────────────────────────────────────────────

const HexMapEditor = () => {
  // UI state
  const [editMode, setEditMode] = useState<EditMode>('terrain');
  const [manageAction, setManageAction] = useState<'add' | 'delete'>('add');
  const [selectedTerrainId, setSelectedTerrainId] = useState<string>('field');
  const [selectedUnit, setSelectedUnit] = useState<UnitType | null>(null);
  const [showUnits, setShowUnits] = useState(true);
  const [showTerrainGenerator, setShowTerrainGenerator] = useState(false);

  // Pan/zoom state
  const [viewTransform, setViewTransform] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [visibleHexes, setVisibleHexes] = useState<HexData[]>([]);

  const UNIT_SCALE = 2.0;

  const svgContainer = useRef<HTMLDivElement>(null);
  const svgElement = useRef<SVGSVGElement>(null);

  const resetView = () => setViewTransform({ scale: 1, x: 0, y: 0 });

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const {
    hexMap, setHexMap,
    mapRadius,
    hexCount,
    maxPlayerUnits, setMaxPlayerUnits,
    setDeletedHexes,
    showSizeInput, setShowSizeInput,
    initializeMap, resizeMap,
    increaseRadius, decreaseRadius,
    restoreDeletedHexes,
    exportToJSON, importFromJSON,
    terrainTypes,
    unitTypes,
  } = useHexMap();

  const { show3DPreview, setShow3DPreview, containerRef: threeContainer } =
    use3DPreview({ hexMap, mapRadius, terrainTypes, showUnits });

  // Derive selected terrain object from id
  const selectedTerrain: TerrainType =
    terrainTypes.find(t => t.id === selectedTerrainId) ?? terrainTypes[0];

  // ── Viewport culling ──────────────────────────────────────────────────────
  useEffect(() => {
    if (hexMap.length < 1000) { setVisibleHexes(hexMap); return; }
    const update = () => {
      if (!svgElement.current || !svgContainer.current) return;
      const svgRect = svgContainer.current.getBoundingClientRect();
      const vb = svgElement.current.viewBox.baseVal;
      const left = vb.x - viewTransform.x / viewTransform.scale;
      const top = vb.y - viewTransform.y / viewTransform.scale;
      const w = svgRect.width / viewTransform.scale;
      const h = svgRect.height / viewTransform.scale;
      const buf = 100;
      setVisibleHexes(hexMap.filter(hex => {
        const { x, y } = getHexPosition(hex.q, hex.r);
        const sz = 20;
        return x + sz >= left - buf && x - sz <= left + w + buf &&
               y + sz >= top - buf && y - sz <= top + h + buf;
      }));
    };
    update();
    const t = setTimeout(update, 100);
    return () => clearTimeout(t);
  }, [hexMap, viewTransform]);

  // ── Global mouse/wheel events ─────────────────────────────────────────────
  useEffect(() => {
    const onMouseUp = () => { setIsDragging(false); setIsDrawing(false); };
    const onContextMenu = (e: MouseEvent) => {
      if (svgContainer.current?.contains(e.target as Node)) e.preventDefault();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const rect = svgElement.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setViewTransform(prev => {
        const next = Math.min(Math.max(prev.scale * factor, 0.2), 3);
        const ratio = next / prev.scale;
        return { scale: next, x: mx - (mx - prev.x) * ratio, y: my - (my - prev.y) * ratio };
      });
    };
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('contextmenu', onContextMenu);
    const container = svgContainer.current;
    container?.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('contextmenu', onContextMenu);
      container?.removeEventListener('wheel', onWheel);
    };
  }, []);

  // ── Hex click handler ─────────────────────────────────────────────────────
  const handleHexClick = useCallback((hex: HexData) => {
    if (editMode === 'terrain') {
      setHexMap(prev => prev.map(h =>
        h.q === hex.q && h.r === hex.r && h.s === hex.s
          ? { ...h, terrainType: selectedTerrain.id, color: selectedTerrain.color, height: selectedTerrain.height }
          : h
      ));
    } else if (editMode === 'units') {
      if (hex.terrainType === 'empty') return;
      setHexMap(prev => prev.map(h => {
        if (h.q !== hex.q || h.r !== hex.r || h.s !== hex.s) return h;
        if (selectedUnit) return { ...h, unit: { type: selectedUnit.id, icon: selectedUnit.icon, color: selectedUnit.color } };
        const { unit: _u, ...rest } = h;
        return rest as HexData;
      }));
    } else if (editMode === 'manage') {
      if (manageAction === 'add' && hex.terrainType === 'empty') {
        setHexMap(prev => prev.map(h =>
          h.q === hex.q && h.r === hex.r && h.s === hex.s
            ? { ...h, terrainType: selectedTerrain.id, color: selectedTerrain.color, height: selectedTerrain.height }
            : h
        ));
      } else if (manageAction === 'delete' && hex.terrainType !== 'empty') {
        const emptyT = terrainTypes.find(t => t.id === 'empty');
        if (!emptyT) return;
        setDeletedHexes(prev => [...prev, { ...hex }]);
        setHexMap(prev => prev.map(h =>
          h.q === hex.q && h.r === hex.r && h.s === hex.s
            ? { ...h, terrainType: emptyT.id, color: emptyT.color, height: emptyT.height, unit: undefined }
            : h
        ));
      }
    }
  }, [editMode, selectedTerrain, selectedUnit, manageAction, terrainTypes, setHexMap, setDeletedHexes]);

  // ── Unit click handler ────────────────────────────────────────────────────
  const handleUnitClick = (hex: HexData, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editMode === 'units' && selectedUnit === null) {
      setHexMap(prev => prev.map(h => {
        if (h.q !== hex.q || h.r !== hex.r || h.s !== hex.s) return h;
        const { unit: _u, ...rest } = h;
        return rest as HexData;
      }));
    }
  };

  // ── Pan handlers ──────────────────────────────────────────────────────────
  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  }, []);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setViewTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart]);

  const handleSvgMouseUp = useCallback(() => setIsDragging(false), []);

  const handleMouseDown = (hex: HexData, e: React.MouseEvent) => {
    if (e.button === 0) { setIsDrawing(true); handleHexClick(hex); e.stopPropagation(); }
  };
  const handleMouseUp = () => setIsDrawing(false);
  const handleMouseEnter = (hex: HexData) => { if (isDrawing) handleHexClick(hex); };

  // ── SVG rendering ─────────────────────────────────────────────────────────
  const svgDimensions = hexMap.length > 0
    ? calculateSvgDimensions(mapRadius)
    : { width: 100, height: 100, offsetX: 50, offsetY: 50 };

  const viewBox = hexMap.length > 0
    ? `-${svgDimensions.offsetX} -${svgDimensions.offsetY} ${svgDimensions.width} ${svgDimensions.height}`
    : '0 0 100 100';

  const renderHexSVG = (hex: HexData) => {
    const { x, y } = getHexPosition(hex.q, hex.r);
    const size = 20;
    const points = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i;
      return `${x + size * Math.cos(a)},${y + size * Math.sin(a)}`;
    }).join(' ');

    const hasPattern = TERRAIN_IDS_WITH_PATTERN.includes(hex.terrainType);
    const fillValue = hasPattern ? `url(#${hex.terrainType}Pattern)` : hex.color;
    const cursorStyle = editMode === 'manage' && manageAction === 'delete' ? 'not-allowed' : 'pointer';

    return (
      <polygon
        key={`hex-${hex.q},${hex.r},${hex.s}`}
        points={points}
        fill={fillValue}
        stroke="#333"
        strokeWidth="1"
        style={{ cursor: cursorStyle }}
        onMouseDown={e => {
          if (editMode === 'manage' && manageAction === 'delete') { handleHexClick(hex); e.stopPropagation(); }
          else handleMouseDown(hex, e);
        }}
        onMouseEnter={() => handleMouseEnter(hex)}
      />
    );
  };

  const renderUnitSVG = (hex: HexData) => {
    if (!hex.unit || !showUnits) return null;
    const { x, y } = getHexPosition(hex.q, hex.r);
    const size = 20;
    return (
      <g key={`unit-${hex.q},${hex.r},${hex.s}`}>
        <circle
          cx={x} cy={y} r={size * UNIT_SCALE / 2}
          fill={hex.unit.color} stroke="#000" strokeWidth="1"
          style={{ cursor: editMode === 'units' && selectedUnit === null ? 'not-allowed' : 'pointer', userSelect: 'none', pointerEvents: 'all' }}
          onClick={e => handleUnitClick(hex, e)}
        />
        <text
          x={x} y={y} textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize={size * UNIT_SCALE / 2} fontWeight="bold"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {hex.unit.icon}
        </text>
      </g>
    );
  };

  const renderPotentialHexes = () => {
    if (editMode !== 'manage' || manageAction !== 'add') return null;
    return hexMap.filter(h => h.terrainType === 'empty').map(hex => {
      const { x, y } = getHexPosition(hex.q, hex.r);
      const size = 20;
      const points = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i;
        return `${x + size * Math.cos(a)},${y + size * Math.sin(a)}`;
      }).join(' ');
      return (
        <g key={`potential-${hex.q},${hex.r},${hex.s}`}>
          <defs>
            <pattern
              id={`potentialHexPattern-${hex.q}-${hex.r}-${hex.s}`}
              patternUnits="userSpaceOnUse" width="10" height="10"
            >
              <rect width="10" height="10" fill="white" fillOpacity="0.1" />
              <path d="M0,0 L10,10 M-5,5 L5,-5 M5,15 L15,5" stroke="#aaa" strokeWidth="1" />
            </pattern>
          </defs>
          <polygon
            points={points}
            fill={`url(#potentialHexPattern-${hex.q}-${hex.r}-${hex.s})`}
            stroke="#aaa" strokeWidth="1" strokeDasharray="4,2"
            style={{ cursor: 'crosshair' }}
            onClick={() => handleHexClick(hex)}
          />
        </g>
      );
    });
  };

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4 bg-gray-800 rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-4 text-white flex items-center">
        <RiMapFill className="mr-2 text-yellow-400" />
        Редактор Гексагональных Карт
      </h1>

      {showSizeInput ? (
        <div className="mb-6 p-6 bg-white rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-xl font-semibold mb-4">
            {hexMap.length > 0 ? 'Изменение размера карты' : 'Определите размер карты'}
          </h2>
          <div className="flex flex-col space-y-4">
            <div className="flex items-center">
              <label className="w-32 text-gray-700">Радиус карты:</label>
              <input type="number" value={mapRadius}
                onChange={e => { const v = parseInt(e.target.value) || 1; resizeMap(v); }}
                className="border rounded px-3 py-2 w-24 text-center" min="1" max="20" />
            </div>
            <div className="flex items-center">
              <label className="w-32 text-gray-700">Макс. шашек игрока:</label>
              <input type="number" value={maxPlayerUnits}
                onChange={e => setMaxPlayerUnits(parseInt(e.target.value) || 0)}
                className="border rounded px-3 py-2 w-24 text-center" min="0" />
            </div>
            <div className="text-sm text-gray-600 ml-32">
              Примерное количество гексов: {3 * mapRadius * (mapRadius + 1) + 1}
            </div>
            <div className="flex gap-2">
              <button onClick={() => initializeMap(resetView)}
                className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                {hexMap.length > 0 ? 'Изменить размер' : 'Создать пустую карту'}
              </button>
              <button onClick={() => setShowTerrainGenerator(true)}
                className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
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
                    <input type="checkbox" checked={showUnits} onChange={() => setShowUnits(v => !v)} className="mr-1" />
                    Показать юниты
                  </label>
                  <label className="text-gray-700 mr-2">Макс. шашек игрока:</label>
                  <input type="number" value={maxPlayerUnits}
                    onChange={e => setMaxPlayerUnits(parseInt(e.target.value) || 0)}
                    className="border rounded px-2 py-1 w-16 text-center mr-4" min="0" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEditMode('terrain')}
                  className={`px-3 py-2 rounded-md ${editMode === 'terrain' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  Редактор местности
                </button>
                <button onClick={() => setEditMode('units')}
                  className={`px-3 py-2 rounded-md ${editMode === 'units' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  Расстановка шашек
                </button>
                <button onClick={() => setEditMode('manage')}
                  className={`px-3 py-2 rounded-md ${editMode === 'manage' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  Управление гексами
                </button>
              </div>

              {editMode === 'terrain' ? (
                <div className="flex flex-wrap gap-2">
                  {terrainTypes.filter(t => t.id !== 'empty').map(terrain => (
                    <button key={terrain.id} onClick={() => setSelectedTerrainId(terrain.id)}
                      className={`px-3 py-2 rounded-md text-white shadow ${selectedTerrainId === terrain.id ? 'ring-2 ring-black' : ''}`}
                      style={{ backgroundColor: terrain.color }}>
                      {terrain.name}
                    </button>
                  ))}
                </div>
              ) : editMode === 'units' ? (
                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button onClick={() => setSelectedUnit(null)}
                      className={`px-3 py-2 rounded-md bg-red-500 text-white shadow ${selectedUnit === null ? 'ring-2 ring-black' : ''}`}>
                      Удалить юнит
                    </button>
                    {unitTypes.map(unit => (
                      <button key={unit.id} onClick={() => setSelectedUnit(unit)}
                        className={`px-3 py-2 rounded-md text-white shadow ${selectedUnit?.id === unit.id ? 'ring-2 ring-black' : ''}`}
                        style={{ backgroundColor: unit.color }}>
                        {unit.icon} {unit.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600">Выберите тип юнита и кликните по гексу для его размещения. Выберите &quot;Удалить юнит&quot; для удаления юнита с гекса.</p>
                </div>
              ) : editMode === 'manage' ? (
                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button onClick={() => setManageAction('add')}
                      className={`px-3 py-2 rounded-md bg-green-500 text-white shadow ${manageAction === 'add' ? 'ring-2 ring-black' : ''}`}>
                      Добавить гексы
                    </button>
                    <button onClick={() => setManageAction('delete')}
                      className={`px-3 py-2 rounded-md bg-red-500 text-white shadow ${manageAction === 'delete' ? 'ring-2 ring-black' : ''}`}>
                      Удалить гексы
                    </button>
                  </div>
                  {manageAction === 'add' && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Кликните по полупрозрачным контурам, чтобы добавить гексы с выбранным типом местности:</p>
                      <div className="flex flex-wrap gap-2">
                        {terrainTypes.filter(t => t.id !== 'empty').map(terrain => (
                          <button key={terrain.id} onClick={() => setSelectedTerrainId(terrain.id)}
                            className={`px-3 py-2 rounded-md text-white shadow ${selectedTerrainId === terrain.id ? 'ring-2 ring-black' : ''}`}
                            style={{ backgroundColor: terrain.color }}>
                            {terrain.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {manageAction === 'delete' && (
                    <p className="text-sm text-gray-600">Кликните по существующему гексу, чтобы удалить его с карты.</p>
                  )}
                </div>
              ) : null}

              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  <button onClick={increaseRadius} className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded">+ Радиус</button>
                  <button onClick={decreaseRadius} className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded" disabled={mapRadius <= 1}>- Радиус</button>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm text-gray-600">Радиус карты: {mapRadius}</span>
                  <span className="text-sm text-gray-600">Макс. шашек игрока: {maxPlayerUnits}</span>
                  <span className="text-sm text-gray-600">Количество гексов: {hexCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 p-4 bg-white rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold">Редактор карты</h2>
                <div className="flex gap-2">
                  <button onClick={resetView} className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm">Сбросить вид</button>
                  <span className="text-sm text-gray-500">Масштаб: {Math.round(viewTransform.scale * 100)}%</span>
                </div>
              </div>
              <div
                ref={svgContainer}
                className="relative overflow-hidden"
                style={{ height: '70vh', cursor: isDragging ? 'grabbing' : editMode === 'manage' ? (manageAction === 'add' ? 'crosshair' : 'not-allowed') : 'grab' }}
                onMouseDown={handleSvgMouseDown}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={handleSvgMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <svg
                  ref={svgElement}
                  width="100%" height="100%"
                  className="border"
                  viewBox={viewBox}
                  style={{ transform: `scale(${viewTransform.scale}) translate(${viewTransform.x}px, ${viewTransform.y}px)`, transformOrigin: '0 0' }}
                >
                  <defs>
                    {TERRAIN_IDS_WITH_PATTERN.map(id => svgPatternDefs[id])}
                  </defs>
                  {editMode === 'manage' && manageAction === 'add' && renderPotentialHexes()}
                  <g>{visibleHexes.map(renderHexSVG)}</g>
                  <g style={{ pointerEvents: 'all' }}>{visibleHexes.map(renderUnitSVG)}</g>
                </svg>
                <div className="absolute bottom-2 right-2 bg-white bg-opacity-75 p-2 rounded text-xs">
                  <p>Колесико мыши: масштаб</p>
                  <p>Правая кнопка мыши: перемещение</p>
                  <p>Левая кнопка мыши: {editMode === 'manage' ? (manageAction === 'add' ? 'добавление гексов' : 'удаление гексов') : 'рисование'}</p>
                </div>
              </div>
            </div>

            {show3DPreview && (
              <div className="lg:w-1/2 p-4 bg-white rounded-lg shadow-md">
                <h2 className="text-lg font-semibold mb-2">3D Предпросмотр</h2>
                <div ref={threeContainer} style={{ height: '400px', width: '100%' }} />
                <div className="mt-2 text-sm text-gray-600">
                  <p>Управление: вращение — левая кнопка мыши, перемещение — правая кнопка мыши, масштаб — колесико</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-gray-700 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-600 p-3 rounded-lg shadow-inner">
                <h3 className="text-white text-sm mb-2 font-semibold flex items-center">
                  <FaFile className="mr-2" /> Работа с файлами
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <label className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center cursor-pointer transition-all duration-200 transform hover:scale-105">
                    <FaUpload className="mr-2" /> Загрузить карту
                    <input type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importFromJSON(f, resetView); }} />
                  </label>
                  <button onClick={exportToJSON}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 transform hover:scale-105">
                    <FaSave className="mr-2" /> Экспорт в JSON
                  </button>
                </div>
              </div>

              <div className="bg-gray-600 p-3 rounded-lg shadow-inner">
                <h3 className="text-white text-sm mb-2 font-semibold flex items-center">
                  <FaEye className="mr-2" /> Просмотр и генерация
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShow3DPreview(v => !v)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 transform hover:scale-105">
                    <FaCube className="mr-2" /> {show3DPreview ? 'Скрыть 3D' : 'Показать 3D'}
                  </button>
                  <button onClick={() => setShowTerrainGenerator(v => !v)}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 transform hover:scale-105">
                    <RiEarthLine className="mr-2" /> Генератор ландшафта
                  </button>
                </div>
              </div>

              <div className="bg-gray-700 p-3 rounded-lg shadow-inner">
                <h3 className="text-white text-sm mb-2 font-semibold flex items-center">
                  <FaEdit className="mr-2" /> Изменение карты
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setShowSizeInput(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 transform hover:scale-105">
                    <FaRuler className="mr-2" /> Изменить размер
                  </button>
                  <button onClick={restoreDeletedHexes}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center transition-all duration-200 transform hover:scale-105">
                    <FaUndo className="mr-2" /> Восстановить гексы
                  </button>
                  <button onClick={() => { setHexMap([]); setShowSizeInput(true); }}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center col-span-2 transform hover:scale-105">
                    <FaTimes className="mr-2" /> Начать заново
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTerrainGenerator && (
        <TerrainGeneratorPanel
          terrainTypes={terrainTypes}
          onGenerateTerrain={(generatedMap: HexData[], _hexCount: number) => {
            setHexMap(generatedMap);
            setShowSizeInput(false);
            setShowTerrainGenerator(false);
          }}
          radius={mapRadius}
        />
      )}
    </div>
  );
};

export default HexMapEditor;
