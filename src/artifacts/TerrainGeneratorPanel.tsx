import React, { useState } from 'react';
import { TerrainGenerator, presetParams, GeneratorParams } from './terrainGenerator';
import { FaDice, FaCog, FaChevronDown, FaChevronRight, FaPlay, FaInfoCircle } from 'react-icons/fa';
import { GiMountains, GiIsland, GiForest, GiSwamp, GiWaterDrop, GiHouse, GiHillFort } from 'react-icons/gi';
import { RiMapFill, RiEarthLine } from 'react-icons/ri';
import { BsPuzzle, BsShuffle } from 'react-icons/bs';

// Интерфейс для пропсов компонента
interface TerrainGeneratorPanelProps {
  terrainTypes: Array<any>;
  onGenerateTerrain: (hexMap: Array<any>, hexCount: number) => void;
  radius: number;
}

// Основной компонент генератора ландшафта
const TerrainGeneratorPanel: React.FC<TerrainGeneratorPanelProps> = ({ terrainTypes, onGenerateTerrain, radius }) => {
  // Состояния для параметров генератора
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

  // Функция для генерации случайного сида
  const generateRandomSeed = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRandomSeed(result);
  };

  // Функция для выбора пресета
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

  // Функция для отображения всплывающих подсказок
  const handleShowTooltip = (tipId: string) => {
    setShowTooltip(tipId);
  };

  // Функция для скрытия всплывающих подсказок
  const handleHideTooltip = () => {
    setShowTooltip(null);
  };

  // Описания для всплывающих подсказок
  const tooltips: Record<string, string> = {
    procedural: "Процедурный генератор создаёт реалистичную карту с использованием шума Симплекса",
    random: "Полностью случайное размещение всех типов ландшафта",
    island: "Создаёт реалистичный остров с береговой линией и горами в центре",
    biomes: "Создаёт карту с различными биомами на основе температуры и влажности",
    default: "Сбалансированное распределение всех типов местности",
    forest: "Повышенная плотность лесов и меньше гор",
    mountain: "Больше гор и холмов, меньше лесов и болот",
    islands: "Больше водных областей, формирующих архипелаг островов",
    swamps: "Больше болот и воды, меньше гор"
  };

  // Функция для генерации ландшафта и передачи его родительскому компоненту
  const generateTerrain = () => {
    // Создаем генератор с текущими параметрами
    const generator = new TerrainGenerator(terrainTypes, randomSeed);
    
    // Параметры генерации
    const params: GeneratorParams = {
      seed: randomSeed,
      waterLevel,
      mountainsLevel,
      forestDensity,
      swampDensity,
      buildingsDensity,
      hillsDensity
    };
    
    // Выбираем метод генерации в зависимости от типа
    let newMap;
    switch (generatorType) {
      case 'random':
        newMap = generator.generateTerrain(radius, params);
        break;
      case 'island':
        newMap = generator.generateIslandTerrain(radius, params);
        break;
      case 'biomes':
        newMap = generator.generateBiomesTerrain(radius, params);
        break;
      case 'procedural':
      default:
        newMap = generator.generateTerrain(radius, params);
        break;
    }
    
    // Подсчитываем количество непустых гексов
    const hexCount = newMap.length;
    
    // Передаем сгенерированную карту обратно родительскому компоненту
    onGenerateTerrain(newMap, hexCount);
  };

  return (
    <div className="mb-6 p-6 bg-gray-800 rounded-lg shadow-lg w-full max-w-lg text-white relative">
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <RiMapFill className="mr-2 text-yellow-400" /> 
        Генератор карт Echelon
      </h2>
      
      {/* Выбор типа генератора */}
      <div className="mb-6 bg-gray-700 p-4 rounded-lg">
        <label className="flex items-center text-gray-300 mb-3">
          <BsPuzzle className="mr-2 text-blue-400" />
          <span className="font-semibold">Тип генерации:</span>
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            className={`px-3 py-2 rounded-md flex items-center justify-center transition-all duration-200 ${
              generatorType === 'procedural' 
                ? 'bg-blue-600 text-white shadow-md transform scale-105' 
                : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
            }`}
            onClick={() => setGeneratorType('procedural')}
            onMouseEnter={() => handleShowTooltip('procedural')}
            onMouseLeave={handleHideTooltip}
          >
            <RiEarthLine className="mr-2" />
            Процедурная
          </button>
          <button
            className={`px-3 py-2 rounded-md flex items-center justify-center transition-all duration-200 ${
              generatorType === 'random' 
                ? 'bg-blue-600 text-white shadow-md transform scale-105' 
                : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
            }`}
            onClick={() => setGeneratorType('random')}
            onMouseEnter={() => handleShowTooltip('random')}
            onMouseLeave={handleHideTooltip}
          >
            <BsShuffle className="mr-2" />
            Случайная
          </button>
          <button
            className={`px-3 py-2 rounded-md flex items-center justify-center transition-all duration-200 ${
              generatorType === 'island' 
                ? 'bg-blue-600 text-white shadow-md transform scale-105' 
                : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
            }`}
            onClick={() => setGeneratorType('island')}
            onMouseEnter={() => handleShowTooltip('island')}
            onMouseLeave={handleHideTooltip}
          >
            <GiIsland className="mr-2" />
            Остров
          </button>
          <button
            className={`px-3 py-2 rounded-md flex items-center justify-center transition-all duration-200 ${
              generatorType === 'biomes' 
                ? 'bg-blue-600 text-white shadow-md transform scale-105' 
                : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
            }`}
            onClick={() => setGeneratorType('biomes')}
            onMouseEnter={() => handleShowTooltip('biomes')}
            onMouseLeave={handleHideTooltip}
          >
            <RiEarthLine className="mr-2" />
            Биомы
          </button>
        </div>
      </div>
      
      {/* Выбор пресета */}
      <div className="mb-6 bg-gray-700 p-4 rounded-lg">
        <label className="flex items-center text-gray-300 mb-3">
          <FaCog className="mr-2 text-purple-400" />
          <span className="font-semibold">Пресет:</span>
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            className={`px-3 py-2 rounded-md flex items-center justify-center transition-all duration-200 ${
              presetType === 'default' 
                ? 'bg-purple-600 text-white shadow-md transform scale-105' 
                : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
            }`}
            onClick={() => handlePresetChange('default')}
            onMouseEnter={() => handleShowTooltip('default')}
            onMouseLeave={handleHideTooltip}
          >
            <FaCog className="mr-2" />
            Стандарт
          </button>
          <button
            className={`px-3 py-2 rounded-md flex items-center justify-center transition-all duration-200 ${
              presetType === 'forest' 
                ? 'bg-purple-600 text-white shadow-md transform scale-105' 
                : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
            }`}
            onClick={() => handlePresetChange('forest')}
            onMouseEnter={() => handleShowTooltip('forest')}
            onMouseLeave={handleHideTooltip}
          >
            <GiForest className="mr-2" />
            Лесистый
          </button>
          <button
            className={`px-3 py-2 rounded-md flex items-center justify-center transition-all duration-200 ${
              presetType === 'mountain' 
                ? 'bg-purple-600 text-white shadow-md transform scale-105' 
                : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
            }`}
            onClick={() => handlePresetChange('mountain')}
            onMouseEnter={() => handleShowTooltip('mountain')}
            onMouseLeave={handleHideTooltip}
          >
            <GiMountains className="mr-2" />
            Горный
          </button>
          <button
            className={`px-3 py-2 rounded-md flex items-center justify-center transition-all duration-200 ${
              presetType === 'islands' 
                ? 'bg-purple-600 text-white shadow-md transform scale-105' 
                : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
            }`}
            onClick={() => handlePresetChange('islands')}
            onMouseEnter={() => handleShowTooltip('islands')}
            onMouseLeave={handleHideTooltip}
          >
            <GiIsland className="mr-2" />
            Острова
          </button>
          <button
            className={`px-3 py-2 rounded-md flex items-center justify-center transition-all duration-200 ${
              presetType === 'swamps' 
                ? 'bg-purple-600 text-white shadow-md transform scale-105' 
                : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
            }`}
            onClick={() => handlePresetChange('swamps')}
            onMouseEnter={() => handleShowTooltip('swamps')}
            onMouseLeave={handleHideTooltip}
          >
            <GiSwamp className="mr-2" />
            Болотистый
          </button>
        </div>
      </div>
      
      {/* Сид для генерации */}
      <div className="mb-6 bg-gray-700 p-4 rounded-lg">
        <label className="flex items-center text-gray-300 mb-3">
          <FaDice className="mr-2 text-amber-400" />
          <span className="font-semibold">Сид для генерации:</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={randomSeed}
            onChange={(e) => setRandomSeed(e.target.value)}
            className="border bg-gray-600 border-gray-500 rounded px-3 py-2 flex-grow text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Введите сид"
          />
          <button
            onClick={generateRandomSeed}
            className="bg-amber-600 hover:bg-amber-700 transition-colors duration-200 px-3 py-2 rounded flex items-center"
            title="Сгенерировать случайный сид"
          >
            <FaDice className="text-lg" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 flex items-center">
          <FaInfoCircle className="mr-1" />
          Одинаковый сид всегда даёт одинаковую карту
        </p>
      </div>
      
      {/* Расширенные настройки */}
      <div className="mb-6 bg-gray-700 p-4 rounded-lg">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center text-gray-300 mb-2 w-full justify-between px-3 py-2 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors duration-200"
        >
          <div className="flex items-center">
            <FaCog className="mr-2 text-green-400" />
            <span className="font-semibold">Расширенные настройки</span>
          </div>
          <span className="text-lg">{showAdvanced ? <FaChevronDown /> : <FaChevronRight />}</span>
        </button>
        
        {showAdvanced && (
          <div className="mt-4 space-y-5 bg-gray-600 p-4 rounded-md">
            <div>
              <label className="flex items-center text-gray-300 mb-2">
                <GiWaterDrop className="mr-2 text-blue-400" />
                <span>Уровень воды: <span className="font-bold">{Math.round(waterLevel * 100)}%</span></span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={waterLevel}
                onChange={(e) => setWaterLevel(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="flex items-center text-gray-300 mb-2">
                <GiMountains className="mr-2 text-gray-400" />
                <span>Уровень гор: <span className="font-bold">{Math.round(mountainsLevel * 100)}%</span></span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={mountainsLevel}
                onChange={(e) => setMountainsLevel(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="flex items-center text-gray-300 mb-2">
                <GiForest className="mr-2 text-green-500" />
                <span>Плотность лесов: <span className="font-bold">{Math.round(forestDensity * 100)}%</span></span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={forestDensity}
                onChange={(e) => setForestDensity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="flex items-center text-gray-300 mb-2">
                <GiSwamp className="mr-2 text-green-700" />
                <span>Плотность болот: <span className="font-bold">{Math.round(swampDensity * 100)}%</span></span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={swampDensity}
                onChange={(e) => setSwampDensity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="flex items-center text-gray-300 mb-2">
                <GiHouse className="mr-2 text-red-400" />
                <span>Плотность зданий: <span className="font-bold">{Math.round(buildingsDensity * 100)}%</span></span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={buildingsDensity}
                onChange={(e) => setBuildingsDensity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="flex items-center text-gray-300 mb-2">
                <GiHillFort className="mr-2 text-amber-600" />
                <span>Плотность холмов: <span className="font-bold">{Math.round(hillsDensity * 100)}%</span></span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={hillsDensity}
                onChange={(e) => setHillsDensity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Кнопка генерации */}
      <div className="flex justify-center">
        <button
          onClick={generateTerrain}
          className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-bold py-3 px-6 rounded-lg w-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 shadow-lg"
        >
          <FaPlay className="mr-2" />
          Сгенерировать ландшафт
        </button>
      </div>
      
      <p className="text-xs text-gray-400 mt-4 flex items-center justify-center">
        <FaInfoCircle className="mr-1" />
        Примечание: Генерация может занять некоторое время для больших карт (радиус: {radius})
      </p>
      
      {/* Фиксированный контейнер для подсказок */}
      <div className="h-12 mt-4">
        {showTooltip && tooltips[showTooltip] && (
          <div className="text-sm text-gray-300 bg-gray-900 p-2 rounded-md">
            <FaInfoCircle className="inline mr-1 text-blue-400" />
            {tooltips[showTooltip]}
          </div>
        )}
      </div>
    </div>
  );
};

export default TerrainGeneratorPanel; 