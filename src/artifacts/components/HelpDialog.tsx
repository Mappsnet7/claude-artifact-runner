import React from 'react';

interface HelpDialogProps {
  onClose: () => void;
}

const HelpDialog: React.FC<HelpDialogProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-auto">
        <h2 className="text-2xl font-bold mb-4">Справка по редактору карт</h2>
        
        <div className="mb-4">
          <h3 className="text-xl font-semibold mb-2">Инструменты рисования</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Выберите тип территории, кликнув на соответствующую цветную кнопку</li>
            <li>Используйте "Инструмент высоты" и ползунок, чтобы изменять высоту ландшафта</li>
            <li>Регулируйте размер кисти для одновременного изменения нескольких клеток</li>
          </ul>
        </div>
        
        <div className="mb-4">
          <h3 className="text-xl font-semibold mb-2">Основные функции</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Нажмите "Предпросмотр 3D" для просмотра карты в трехмерном режиме</li>
            <li>В 3D режиме используйте мышь для вращения камеры и колесико для масштабирования</li>
            <li>Кнопки "Отменить" (Ctrl+Z) и "Вернуть" (Ctrl+Y) позволяют управлять историей изменений</li>
            <li>Кнопка "Заполнить всю карту" заполняет карту выбранным типом территории или высотой</li>
            <li>Кнопка "Случайный ландшафт" открывает панель с настройками генерации ландшафта</li>
            <li>Используйте "Экспорт в JSON" для сохранения карты в виде файла</li>
          </ul>
        </div>
        
        <div className="mb-4">
          <h3 className="text-xl font-semibold mb-2">Настройки генерации ландшафта</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Масштаб ландшафта: определяет размер форм рельефа</li>
            <li>Гористость: влияет на высоту и количество гор</li>
            <li>Водность: определяет количество воды и рек</li>
            <li>Задайте зерно генерации для воспроизведения одинаковых карт при одинаковых параметрах</li>
            <li>Используйте готовые пресеты для быстрого создания типичных ландшафтов</li>
          </ul>
        </div>
        
        <div className="mb-4">
          <h3 className="text-xl font-semibold mb-2">Управление картой</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Вы можете изменять размер отображения клеток кнопками "+" и "-" в нижней части экрана</li>
            <li>Для наведения на клетку отображается подсказка с информацией о типе и высоте</li>
            <li>Кнопка "Показать/скрыть цифры" позволяет управлять отображением значений высоты</li>
          </ul>
        </div>
        
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpDialog;