import React, { useState } from 'react';
import { TerrainGenerator, presetParams, GeneratorParams } from './terrainGenerator';
import { FaDice, FaCog, FaChevronDown, FaChevronRight, FaPlay, FaInfoCircle } from 'react-icons/fa';
import { GiMountains, GiIsland, GiForest, GiSwamp, GiWaterDrop, GiHouse, GiHillFort } from 'react-icons/gi';
import { RiEarthLine } from 'react-icons/ri';
import { BsPuzzle, BsShuffle } from 'react-icons/bs';

interface TerrainGeneratorPanelProps {
  terrainTypes: Array<any>;
  onGenerateTerrain: (hexMap: Array<any>, hexCount: number) => void;
  radius: number;
}

const TerrainGeneratorPanel: React.FC<TerrainGeneratorPanelProps> = ({ terrainTypes, onGenerateTerrain, radius }) => {
  const [generatorType, setGeneratorType] = useState<string>('procedural');
  const [randomSeed, setRandomSeed] = useState<string>('default');
  const [presetType, setPresetType] = useState<'default' | 'forest' | 'mountain' | 'islands' | 'swamps'>('default');
  const [waterLevel, setWaterLevel] = useState<number>(0.3);
  const [mountainsLevel, setMountainsLevel] = useState<number>(0.7);
  const [forestDensity, setForestDensity] = useState<number>(0.2);
  const [swampDensity, setSwampDensity] = useState<number>(0.1);
  const [buildingsDensity, setBuildingsDensity] = useState<number>(0.05);
  const [hillsDensity, setHillsDensity] = useState<number>(0.15);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const generateRandomSeed = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRandomSeed(result);
  };

  const handlePresetChange = (preset: 'default' | 'forest' | 'mountain' | 'islands' | 'swamps') => {
    setPresetType(preset);
    const params = presetParams[preset];
    setWaterLevel(params.waterLevel);
    setMountainsLevel(params.mountainsLevel);
    setForestDensity(params.forestDensity);
    setSwampDensity(params.swampDensity);
    setBuildingsDensity(params.buildingsDensity);
    setHillsDensity(params.hillsDensity);
    setRandomSeed(params.seed);
  };

  const tooltips: Record<string, string> = {
    procedural: "Процедурный генератор — шум Симплекса",
    random: "Полностью случайное размещение",
    island: "Остров с береговой линией и горами в центре",
    biomes: "Биомы на основе температуры и влажности",
    default: "Сбалансированное распределение",
    forest: "Больше лесов, меньше гор",
    mountain: "Больше гор и холмов",
    islands: "Архипелаг островов",
    swamps: "Больше болот и воды"
  };

  const generateTerrain = () => {
    const generator = new TerrainGenerator(terrainTypes, randomSeed);
    const params: GeneratorParams = {
      seed: randomSeed, waterLevel, mountainsLevel,
      forestDensity, swampDensity, buildingsDensity, hillsDensity
    };
    let newMap;
    switch (generatorType) {
      case 'random': newMap = generator.generateTerrain(radius, params); break;
      case 'island': newMap = generator.generateIslandTerrain(radius, params); break;
      case 'biomes': newMap = generator.generateBiomesTerrain(radius, params); break;
      default: newMap = generator.generateTerrain(radius, params); break;
    }
    onGenerateTerrain(newMap, newMap.length);
  };

  const GenTypeBtn = ({ type, icon, label }: { type: string; icon: React.ReactNode; label: string }) => (
    <button
      className={`ech-btn flex-1 justify-center ${generatorType === type ? 'ech-btn-active' : ''}`}
      onClick={() => setGeneratorType(type)}
      onMouseEnter={() => setShowTooltip(type)}
      onMouseLeave={() => setShowTooltip(null)}
    >
      {icon} {label}
    </button>
  );

  const PresetBtn = ({ preset, icon, label }: { preset: 'default' | 'forest' | 'mountain' | 'islands' | 'swamps'; icon: React.ReactNode; label: string }) => (
    <button
      className={`ech-btn flex-1 justify-center ${presetType === preset ? 'ech-btn-active' : ''}`}
      onClick={() => handlePresetChange(preset)}
      onMouseEnter={() => setShowTooltip(preset)}
      onMouseLeave={() => setShowTooltip(null)}
    >
      {icon} {label}
    </button>
  );

  const Slider = ({ label, icon, value, onChange }: { label: string; icon: React.ReactNode; value: number; onChange: (v: number) => void }) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--echelon-text-dim)' }}>
          {icon} {label}
        </span>
        <span className="ech-stat">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range" min="0" max="1" step="0.01" value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="ech-slider"
      />
    </div>
  );

  return (
    <div className="ech-panel p-5 w-full max-w-lg" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
      <h2 className="text-xl font-bold mb-5 flex items-center gap-2"
        style={{ color: 'var(--echelon-amber)', fontFamily: "'Rajdhani', sans-serif" }}>
        <RiEarthLine /> Генератор карт
      </h2>

      {/* Generator type */}
      <div className="mb-4">
        <span className="ech-label mb-2 block">
          <BsPuzzle className="inline mr-1" /> Тип генерации
        </span>
        <div className="grid grid-cols-2 gap-1">
          <GenTypeBtn type="procedural" icon={<RiEarthLine size={12} />} label="Процедурная" />
          <GenTypeBtn type="random" icon={<BsShuffle size={12} />} label="Случайная" />
          <GenTypeBtn type="island" icon={<GiIsland size={13} />} label="Остров" />
          <GenTypeBtn type="biomes" icon={<RiEarthLine size={12} />} label="Биомы" />
        </div>
      </div>

      {/* Presets */}
      <div className="mb-4">
        <span className="ech-label mb-2 block">
          <FaCog className="inline mr-1" /> Пресет
        </span>
        <div className="grid grid-cols-3 gap-1">
          <PresetBtn preset="default" icon={<FaCog size={10} />} label="Стандарт" />
          <PresetBtn preset="forest" icon={<GiForest size={13} />} label="Лес" />
          <PresetBtn preset="mountain" icon={<GiMountains size={13} />} label="Горы" />
          <PresetBtn preset="islands" icon={<GiIsland size={13} />} label="Острова" />
          <PresetBtn preset="swamps" icon={<GiSwamp size={13} />} label="Болота" />
        </div>
      </div>

      {/* Seed */}
      <div className="mb-4">
        <span className="ech-label mb-2 block">
          <FaDice className="inline mr-1" /> Сид
        </span>
        <div className="flex gap-1">
          <input
            type="text" value={randomSeed}
            onChange={e => setRandomSeed(e.target.value)}
            className="ech-input flex-1"
            placeholder="Введите сид"
          />
          <button onClick={generateRandomSeed} className="ech-btn ech-btn-amber" title="Случайный сид">
            <FaDice size={14} />
          </button>
        </div>
        <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: 'var(--echelon-text-muted)' }}>
          <FaInfoCircle size={10} /> Одинаковый сид = одинаковая карта
        </p>
      </div>

      {/* Advanced settings */}
      <div className="mb-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="ech-btn w-full justify-between"
        >
          <span className="flex items-center gap-1.5">
            <FaCog size={11} /> Расширенные настройки
          </span>
          {showAdvanced ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
        </button>

        {showAdvanced && (
          <div className="ech-panel-inset p-4 mt-1 space-y-4">
            <Slider label="Уровень воды" icon={<GiWaterDrop size={12} style={{ color: '#2196F3' }} />} value={waterLevel} onChange={setWaterLevel} />
            <Slider label="Уровень гор" icon={<GiMountains size={12} style={{ color: '#9E9E9E' }} />} value={mountainsLevel} onChange={setMountainsLevel} />
            <Slider label="Плотность лесов" icon={<GiForest size={12} style={{ color: '#4CAF50' }} />} value={forestDensity} onChange={setForestDensity} />
            <Slider label="Плотность болот" icon={<GiSwamp size={12} style={{ color: '#1B5E20' }} />} value={swampDensity} onChange={setSwampDensity} />
            <Slider label="Плотность зданий" icon={<GiHouse size={12} style={{ color: '#F44336' }} />} value={buildingsDensity} onChange={setBuildingsDensity} />
            <Slider label="Плотность холмов" icon={<GiHillFort size={12} style={{ color: '#F9A825' }} />} value={hillsDensity} onChange={setHillsDensity} />
          </div>
        )}
      </div>

      {/* Generate button */}
      <button onClick={generateTerrain} className="ech-btn ech-btn-amber w-full justify-center py-2.5 text-sm font-bold">
        <FaPlay size={11} /> Сгенерировать ландшафт
      </button>

      <p className="text-xs mt-3 text-center" style={{ color: 'var(--echelon-text-muted)' }}>
        Радиус: {radius}
      </p>

      {/* Tooltip */}
      {showTooltip && tooltips[showTooltip] && (
        <div className="mt-3 text-xs p-2" style={{ background: 'var(--echelon-bg)', border: '1px solid var(--echelon-border)', color: 'var(--echelon-text-dim)' }}>
          <FaInfoCircle className="inline mr-1" style={{ color: 'var(--echelon-amber-dim)' }} />
          {tooltips[showTooltip]}
        </div>
      )}
    </div>
  );
};

export default TerrainGeneratorPanel;
