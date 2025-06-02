const express = require("express");
const compression = require("compression");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

// Включаем сжатие
app.use(compression());

// Глобальные заголовки для всех ответов
app.use((req, res, next) => {
  // Отключаем строгую проверку MIME-типов для модулей JavaScript
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  next();
});

// Настраиваем правильные MIME-типы для JavaScript-модулей
app.use((req, res, next) => {
  // Проверяем файлы с хешами, например index-BquoTul2.js
  if (/\.js(\?.*)?$/.test(req.url)) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  }
  if (/\.mjs(\?.*)?$/.test(req.url)) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  }
  if (/\.cjs(\?.*)?$/.test(req.url)) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  }
  next();
});

// Статические файлы с явным указанием MIME-типов
app.use(express.static(path.join(__dirname, "dist"), {
  setHeaders: (res, filePath) => {
    // Используем регулярные выражения для проверки файлов с хешами
    if (/\.js$/.test(filePath)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    if (/\.mjs$/.test(filePath)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    if (/\.css$/.test(filePath)) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
    if (/\.html$/.test(filePath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    if (/\.json$/.test(filePath)) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    if (/\.svg$/.test(filePath)) {
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    }
    
    // Включаем CORS для модулей
    if (/\.(js|mjs|css)$/.test(filePath)) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  }
}));

// Для всех остальных маршрутов возвращаем index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT} - сервер статических файлов для приложения`);
});
