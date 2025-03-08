import React from 'react';
import { GenerationParams } from '../types';

interface GenerationParamsDialogProps {
  generationParams: GenerationParams;
  setGenerationParams: React.Dispatch<React.SetStateAction<GenerationParams>>;
  onClose: () => void;
  onGenerate: () => void;
}

const GenerationParamsDialog: React.FC<GenerationParamsDialogProps> = ({
  generationParams,
  setGenerationParams,
  onClose,
  onGenerate
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg">
        <h2 className="text-2xl font-bold mb-4">Настройки случайного ландшафта</h2>
        
        {/* Seed control */}
        <div className="mb-4">
          <label className="block font-medium mb-1">Зерно генерации:</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={generationParams.randomSeed}
              onChange={(e) => setGenerationParams({
                ...generationParams,
                randomSeed: parseInt(e.target.value) || 0
              })}
              className="border rounded p-2 w-32"
            />
            <button
              onClick={() => setGenerationParams({
                ...generationParams,
                randomSeed: Math.floor(Math.random() * 10000)
              })}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Случайное
            </button>
          </div>
          <p className="text-sm text-gray-600">Используйте одинаковое зерно для воспроизведения одинаковых карт</p>
        </div>
        
        {/* Main terrain parameters */}
        <div className="mb-6">
          <div className="mb-4">
            <label className="block font-medium mb-1">Масштаб ландшафта:</label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={generationParams.terrainScale}
              onChange={(e) => setGenerationParams({
                ...generationParams,
                terrainScale: parseInt(e.target.value)
              })}
              className="w-full"
            />
            <div className="flex justify-between text-sm">
              <span>Крупные формы</span>
              <span>Средние</span>
              <span>Мелкие детали</span>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block font-medium mb-1">Гористость:</label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={generationParams.mountainsLevel}
              onChange={(e) => setGenerationParams({
                ...generationParams,
                mountainsLevel: parseInt(e.target.value)
              })}
              className="w-full"
            />
            <div className="flex justify-between text-sm">
              <span>Равнины</span>
              <span>Холмы</span>
              <span>Высокие горы</span>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block font-medium mb-1">Водность:</label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={generationParams.waterLevel}
              onChange={(e) => setGenerationParams({
                ...generationParams,
                waterLevel: parseInt(e.target.value)
              })}
              className="w-full"
            />
            <div className="flex justify-between text-sm">
              <span>Мало воды</span>
              <span>Средне</span>
              <span>Много воды</span>
            </div>
          </div>
        </div>
        
        {/* Presets */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Пресеты</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setGenerationParams({
                terrainScale: 6,
                mountainsLevel: 5,
                waterLevel: 3,
                randomSeed: generationParams.randomSeed
              })}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Стандартный
            </button>
            
            <button
              onClick={() => setGenerationParams({
                terrainScale: 4,
                mountainsLevel: 9,
                waterLevel: 5,
                randomSeed: generationParams.randomSeed
              })}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Горный
            </button>
            
            <button
              onClick={() => setGenerationParams({
                terrainScale: 8,
                mountainsLevel: 2,
                waterLevel: 2,
                randomSeed: generationParams.randomSeed
              })}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Равнинный
            </button>
            
            <button
              onClick={() => setGenerationParams({
                terrainScale: 5,
                mountainsLevel: 4,
                waterLevel: 8,
                randomSeed: generationParams.randomSeed
              })}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Островной
            </button>
            
            <button
              onClick={() => setGenerationParams({
                terrainScale: 3,
                mountainsLevel: 6,
                waterLevel: 9,
                randomSeed: generationParams.randomSeed
              })}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Водный мир
            </button>
            
            <button
              onClick={() => setGenerationParams({
                terrainScale: 2,
                mountainsLevel: 10,
                waterLevel: 1,
                randomSeed: generationParams.randomSeed
              })}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Фэнтези
            </button>
          </div>
        </div>
        
        <div className="flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Отмена
          </button>
          
          <button
            onClick={() => {
              onClose();
              onGenerate();
            }}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Генерировать карту
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerationParamsDialog;