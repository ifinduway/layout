const express = require("express");
const https = require("https");
const fs = require("fs");
const app = express();

// Путь к SSL сертификатам
// TODO: добавить сертификаты
const options = {
  key: fs.readFileSync("PRIVATE_KEY"),
  cert: fs.readFileSync("CERTIFICATE"),
};

const PORT = process.env.PORT || 3000;

const server = https.createServer(options, app);

const io = require("socket.io")(server, {
  cors: {
    origin: true,
  },
});

const rooms = {}; // Объект для хранения информации о комнатах
const connectedClients = {}; // Словарь для отслеживания подключенных клиентов

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Получаем callId из URL-запроса
  const callId = socket.handshake.query.call_id;
  // Если callId не указан, отключаем клиента
  if (!callId) {
    console.log("Client disconnected (no callId provided):", socket.id);
    socket.disconnect();
    return;
  }

  // Если комната для callId не существует, создаем ее
  if (!rooms[callId]) {
    rooms[callId] = {
      clients: [],
    };
  }

  // Добавляем клиента в комнату
  rooms[callId].clients.push(socket.id);

  // Присоединяем клиента к комнате
  socket.join(callId);

  console.log(`Client ${socket.id} joined room ${callId}`);

  // Добавляем каждого подключенного клиента в словарь connectedClients
  connectedClients[socket.id] = {
    socket,
    isAudioEnabled: true, // Начальное состояние микрофона
    isVideoEnabled: true, // Начальное состояние видеокамеры
  };

  // Проверяем, есть ли другой подключенный клиент
  const otherClient = rooms[callId].clients.find(
    (clientId) => clientId !== socket.id
  );

  // Если другой клиент существует, отправляем ему текущее состояние микрофона и видеокамеры
  if (otherClient) {
    console.log("==========> EMITTED otherClient! <=========");
    socket.emit("toggle-mic", connectedClients[otherClient].isAudioEnabled);
    socket.emit("toggle-camera", connectedClients[otherClient].isVideoEnabled);
  }

  socket.on("signal", (data) => {
    rooms[callId].clients.forEach((clientId) => {
      if (clientId !== socket.id) {
        connectedClients[clientId].socket.emit("signal", data);
      }
    });
  });

  socket.on("end-call", (data) => {
    console.log("Ending call for client:", socket.id);
    rooms[callId].clients.forEach((clientId) => {
      if (clientId !== socket.id) {
        connectedClients[clientId].socket.emit("end-call", data);
      }
    });
  });

  // Обработчик события приема состояния микрофона
  socket.on("toggle-mic", (isAudioStart) => {
    // Обновляем состояние микрофона для текущего пользователя
    connectedClients[socket.id].isAudioEnabled = isAudioStart;

    // Отправляем новое состояние микрофона всем остальным пользователям в той же комнате
    rooms[callId].clients.forEach((clientId) => {
      if (clientId !== socket.id) {
        connectedClients[clientId].socket.emit(
          "toggle-mic",
          connectedClients[socket.id].isAudioEnabled
        );
      }
    });
  });

  // Обработчик события приема состояния видеокамеры
  socket.on("toggle-camera", (isVideoStart) => {
    // Обновляем состояние видеокамеры для текущего пользователя
    connectedClients[socket.id].isVideoEnabled = isVideoStart;

    // Отправляем новое состояние видеокамеры всем остальным пользователям в той же комнате
    rooms[callId].clients.forEach((clientId) => {
      if (clientId !== socket.id) {
        connectedClients[clientId].socket.emit(
          "toggle-camera",
          connectedClients[socket.id].isVideoEnabled
        );
      }
    });
  });

  socket.on("start-video", (data) => {
    connectedClients[socket.id].data = { ...data };

    // Отправляем новое состояние видеокамеры всем остальным пользователям в той же комнате
    rooms[callId].clients.forEach((clientId) => {
      if (clientId !== socket.id) {
        connectedClients[clientId].socket.emit("start-video", data);
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    // Получаем callId из URL-запроса
    const callId = socket.handshake.query.call_id;

    // Если callId существует, удаляем клиента из комнаты
    if (callId && rooms[callId]) {
      rooms[callId].clients = rooms[callId].clients.filter(
        (clientId) => clientId !== socket.id
      );

      // Если в комнате больше нет клиентов, удаляем комнату
      if (rooms[callId].clients.length === 0) {
        delete rooms[callId];
      }

      console.log(`Client ${socket.id} left room ${callId}`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
