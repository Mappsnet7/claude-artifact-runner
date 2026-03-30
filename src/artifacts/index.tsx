// src/artifacts/index.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TerrainGeneratorPanel from './TerrainGeneratorPanel';
import {
  FaSave, FaUndo, FaTimes, FaUpload, FaCube,
  FaRuler, FaEdit, FaFile, FaEye, FaPlus, FaMinus, FaTrash
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

  const UNIT_SCALE = 1.2;

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
        stroke="#1a1f1c"
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
              <rect width="10" height="10" fill="white" fillOpacity="0.05" />
              <path d="M0,0 L10,10 M-5,5 L5,-5 M5,15 L15,5" stroke="#3a4540" strokeWidth="0.5" />
            </pattern>
          </defs>
          <polygon
            points={points}
            fill={`url(#potentialHexPattern-${hex.q}-${hex.r}-${hex.s})`}
            stroke="#3a4540" strokeWidth="1" strokeDasharray="4,2"
            style={{ cursor: 'crosshair' }}
            onClick={() => handleHexClick(hex)}
          />
        </g>
      );
    });
  };

  // ── Mode tab button helper ────────────────────────────────────────────────
  const ModeTab = ({ mode, label, icon }: { mode: EditMode; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => setEditMode(mode)}
      className={`ech-btn ${editMode === mode ? 'ech-btn-active' : ''}`}
    >
      {icon} {label}
    </button>
  );

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--echelon-bg)' }}>
      {/* ── TOP BAR ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 h-11 flex-shrink-0"
        style={{ background: 'var(--echelon-surface)', borderBottom: '1px solid var(--echelon-border)' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold tracking-wider flex items-center gap-2" style={{ fontFamily: "'Rajdhani', sans-serif", color: 'var(--echelon-amber)' }}>
            <RiMapFill /> ECHELON
          </h1>
          <span className="text-xs" style={{ color: 'var(--echelon-text-muted)' }}>Map Editor</span>
        </div>

        {!showSizeInput && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="ech-label">Радиус</span>
              <span className="ech-stat">{mapRadius}</span>
              <span className="ech-label">Гексы</span>
              <span className="ech-stat">{hexCount}</span>
              <span className="ech-label">Макс. шашек</span>
              <input
                type="number" value={maxPlayerUnits}
                onChange={e => setMaxPlayerUnits(parseInt(e.target.value) || 0)}
                className="ech-input w-14 text-center" min="0"
              />
            </div>

            <div style={{ width: 1, height: 20, background: 'var(--echelon-border)' }} />

            <div className="flex items-center gap-1">
              <label className="ech-btn" style={{ cursor: 'pointer' }}>
                <FaUpload size={11} /> Загрузить
                <input type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importFromJSON(f, resetView); }} />
              </label>
              <button onClick={exportToJSON} className="ech-btn ech-btn-green">
                <FaSave size={11} /> Экспорт
              </button>
            </div>
          </div>
        )}
      </header>

      {showSizeInput ? (
        /* ── MAP SETUP SCREEN ────────────────────────────────────────── */
        <div className="flex-1 flex items-center justify-center">
          <div className="ech-panel p-8 w-full max-w-md">
            <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--echelon-amber)', fontFamily: "'Rajdhani', sans-serif" }}>
              {hexMap.length > 0 ? 'Изменение размера карты' : 'Новая карта'}
            </h2>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <label className="ech-label w-36">Радиус карты</label>
                <input type="number" value={mapRadius}
                  onChange={e => { const v = parseInt(e.target.value) || 1; resizeMap(v); }}
                  className="ech-input w-20 text-center" min="1" max="20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="ech-label w-36">Макс. шашек игрока</label>
                <input type="number" value={maxPlayerUnits}
                  onChange={e => setMaxPlayerUnits(parseInt(e.target.value) || 0)}
                  className="ech-input w-20 text-center" min="0" />
              </div>
              <div className="ech-stat ml-[9.5rem]">
                ~ {3 * mapRadius * (mapRadius + 1) + 1} гексов
              </div>
              <hr className="ech-divider" />
              <div className="flex gap-2">
                <button onClick={() => initializeMap(resetView)} className="ech-btn ech-btn-amber flex-1">
                  {hexMap.length > 0 ? 'Изменить размер' : 'Создать пустую карту'}
                </button>
                <button onClick={() => setShowTerrainGenerator(true)} className="ech-btn ech-btn-green flex-1">
                  <RiEarthLine /> Генератор
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── MAIN EDITOR LAYOUT ──────────────────────────────────────── */
        <div className="flex flex-1 overflow-hidden">
          {/* ── LEFT SIDEBAR ── */}
          <aside className="w-64 flex-shrink-0 flex flex-col overflow-y-auto"
            style={{ background: 'var(--echelon-surface)', borderRight: '1px solid var(--echelon-border)' }}>

            {/* Mode Tabs */}
            <div className="p-3 flex flex-col gap-1">
              <span className="ech-label mb-1">Режим</span>
              <ModeTab mode="terrain" label="Местность" icon={<RiMapFill size={13} />} />
              <ModeTab mode="units" label="Шашки" icon={<FaEdit size={11} />} />
              <ModeTab mode="manage" label="Управление" icon={<FaRuler size={11} />} />
            </div>

            <hr className="ech-divider mx-3" />

            {/* Mode-specific tools */}
            <div className="p-3 flex-1">
              {editMode === 'terrain' && (
                <div>
                  <span className="ech-label mb-2 block">Тип местности</span>
                  <div className="flex flex-col gap-0.5">
                    {terrainTypes.filter(t => t.id !== 'empty').map(terrain => (
                      <button
                        key={terrain.id}
                        onClick={() => setSelectedTerrainId(terrain.id)}
                        className={`ech-btn w-full justify-start ${selectedTerrainId === terrain.id ? 'ech-btn-active' : ''}`}
                      >
                        <span className="w-3 h-3 flex-shrink-0" style={{ background: terrain.color, display: 'inline-block' }} />
                        <span className="text-xs">{terrain.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {editMode === 'units' && (
                <div>
                  <span className="ech-label mb-2 block">Юниты</span>
                  <button
                    onClick={() => setSelectedUnit(null)}
                    className={`ech-btn w-full mb-2 ${selectedUnit === null ? 'ech-btn-active' : ''}`}
                    style={selectedUnit === null ? {} : { borderColor: 'var(--echelon-red)', color: 'var(--echelon-red)' }}
                  >
                    <FaTrash size={10} /> Удалить юнит
                  </button>
                  <div className="flex flex-col gap-1">
                    {unitTypes.map(unit => (
                      <button
                        key={unit.id}
                        onClick={() => setSelectedUnit(unit)}
                        className={`ech-btn w-full justify-start ${selectedUnit?.id === unit.id ? 'ech-btn-active' : ''}`}
                      >
                        <span className="w-3 h-3 flex-shrink-0" style={{ background: unit.color, display: 'inline-block' }} />
                        <span className="text-xs">{unit.icon}</span>
                        <span className="text-xs truncate">{unit.name}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs mt-3" style={{ color: 'var(--echelon-text-muted)' }}>
                    Клик по гексу — разместить. &quot;Удалить&quot; — снять юнит.
                  </p>
                </div>
              )}

              {editMode === 'manage' && (
                <div>
                  <span className="ech-label mb-2 block">Действие</span>
                  <div className="flex gap-1 mb-3">
                    <button
                      onClick={() => setManageAction('add')}
                      className={`ech-btn flex-1 ${manageAction === 'add' ? 'ech-btn-active' : ''}`}
                    >
                      <FaPlus size={10} /> Добавить
                    </button>
                    <button
                      onClick={() => setManageAction('delete')}
                      className={`ech-btn flex-1 ${manageAction === 'delete' ? '' : ''}`}
                      style={manageAction === 'delete' ? { background: 'var(--echelon-red)', borderColor: 'var(--echelon-red)', color: '#fff' } : {}}
                    >
                      <FaTrash size={10} /> Удалить
                    </button>
                  </div>
                  {manageAction === 'add' && (
                    <div>
                      <span className="ech-label mb-2 block">Тип для добавления</span>
                      <div className="flex flex-col gap-0.5">
                        {terrainTypes.filter(t => t.id !== 'empty').map(terrain => (
                          <button
                            key={terrain.id}
                            onClick={() => setSelectedTerrainId(terrain.id)}
                            className={`ech-btn w-full justify-start ${selectedTerrainId === terrain.id ? 'ech-btn-active' : ''}`}
                          >
                            <span className="w-3 h-3 flex-shrink-0" style={{ background: terrain.color, display: 'inline-block' }} />
                            <span className="text-xs">{terrain.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs mt-3" style={{ color: 'var(--echelon-text-muted)' }}>
                    {manageAction === 'add' ? 'Клик по контуру — добавить гекс.' : 'Клик по гексу — удалить его.'}
                  </p>
                </div>
              )}
            </div>

            <hr className="ech-divider mx-3" />

            {/* Bottom actions */}
            <div className="p-3 flex flex-col gap-1.5">
              <span className="ech-label mb-1">Карта</span>
              <div className="flex gap-1">
                <button onClick={increaseRadius} className="ech-btn flex-1"><FaPlus size={9} /> Радиус</button>
                <button onClick={decreaseRadius} className="ech-btn flex-1" disabled={mapRadius <= 1}><FaMinus size={9} /> Радиус</button>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setShow3DPreview(v => !v)} className="ech-btn flex-1">
                  <FaCube size={11} /> {show3DPreview ? 'Скрыть 3D' : '3D вид'}
                </button>
                <button onClick={() => setShowTerrainGenerator(v => !v)} className="ech-btn flex-1">
                  <RiEarthLine size={12} /> Генератор
                </button>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setShowSizeInput(true)} className="ech-btn flex-1">
                  <FaRuler size={10} /> Размер
                </button>
                <button onClick={restoreDeletedHexes} className="ech-btn flex-1">
                  <FaUndo size={10} /> Восстановить
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs mt-1 cursor-pointer" style={{ color: 'var(--echelon-text-dim)' }}>
                <input type="checkbox" checked={showUnits} onChange={() => setShowUnits(v => !v)}
                  className="accent-amber-500" />
                Показать юниты
              </label>

              <button
                onClick={() => { setHexMap([]); setShowSizeInput(true); }}
                className="ech-btn ech-btn-red mt-2 justify-center"
              >
                <FaTimes size={10} /> Начать заново
              </button>
            </div>
          </aside>

          {/* ── MAP CANVAS ── */}
          <main className="flex-1 flex flex-col overflow-hidden">
            <div
              ref={svgContainer}
              className="flex-1 relative overflow-hidden"
              style={{
                background: '#0a0c0b',
                cursor: isDragging ? 'grabbing' : editMode === 'manage' ? (manageAction === 'add' ? 'crosshair' : 'not-allowed') : 'grab'
              }}
              onMouseDown={handleSvgMouseDown}
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <svg
                ref={svgElement}
                width="100%" height="100%"
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

              {/* Canvas status bar */}
              <div className="absolute bottom-0 left-0 right-0 h-7 flex items-center justify-between px-3"
                style={{ background: 'var(--echelon-surface)', borderTop: '1px solid var(--echelon-border)', opacity: 0.9 }}>
                <div className="flex items-center gap-4">
                  <span className="text-xs" style={{ color: 'var(--echelon-text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                    Масштаб: {Math.round(viewTransform.scale * 100)}%
                  </span>
                  <button onClick={resetView} className="text-xs hover:underline" style={{ color: 'var(--echelon-amber-dim)' }}>
                    Сброс
                  </button>
                </div>
                <div className="text-xs" style={{ color: 'var(--echelon-text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                  ПКМ: перемещение &middot; Колесо: масштаб &middot; ЛКМ: {editMode === 'manage' ? (manageAction === 'add' ? 'добавить' : 'удалить') : 'рисовать'}
                </div>
              </div>
            </div>

            {/* 3D Preview */}
            {show3DPreview && (
              <div className="flex-shrink-0" style={{ borderTop: '1px solid var(--echelon-border)', background: 'var(--echelon-surface)' }}>
                <div className="flex items-center justify-between px-3 h-8"
                  style={{ borderBottom: '1px solid var(--echelon-border)' }}>
                  <span className="ech-label">3D Предпросмотр</span>
                  <button onClick={() => setShow3DPreview(false)} className="text-xs" style={{ color: 'var(--echelon-text-muted)' }}>
                    <FaTimes />
                  </button>
                </div>
                <div ref={threeContainer} style={{ height: '300px', width: '100%' }} />
              </div>
            )}
          </main>
        </div>
      )}

      {/* Terrain Generator Modal */}
      {showTerrainGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="relative">
            <button
              onClick={() => setShowTerrainGenerator(false)}
              className="absolute top-3 right-3 z-10 ech-btn"
            >
              <FaTimes size={10} />
            </button>
            <TerrainGeneratorPanel
              terrainTypes={terrainTypes}
              onGenerateTerrain={(generatedMap: HexData[], _hexCount: number) => {
                setHexMap(generatedMap);
                setShowSizeInput(false);
                setShowTerrainGenerator(false);
              }}
              radius={mapRadius}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default HexMapEditor;
