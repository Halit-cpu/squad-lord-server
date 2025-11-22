const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: {
    origin: "*", // Her yerden gelen bağlantıyı kabul et
    methods: ["GET", "POST"]
  }
});

// Oyuncu listesi
let players = {};

// Biri siteye girerse "Sunucu Çalışıyor" desin
app.get("/", (req, res) => {
  res.send("SQUAD LORD SUNUCUSU AKTİF! 🚀");
});

io.on("connection", (socket) => {
  console.log("Yeni Komutan: " + socket.id);

  // 1. OYUNA GİRİŞ
  socket.on("join_game", (data) => {
    players[socket.id] = {
      id: socket.id,
      x: 0, y: 0, angle: 0,
      name: data.name || "Bilinmeyen",
      hp: data.hp || 300,
      maxHp: data.hp || 300
    };
    // Yeni gelene diğerlerini gönder
    socket.emit("current_players", players);
    // Diğerlerine yeni geleni haber ver
    socket.broadcast.emit("new_player", players[socket.id]);
  });

  // 2. HAREKET
  socket.on("player_move", (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].angle = data.angle;
      socket.broadcast.emit("player_moved", players[socket.id]);
    }
  });

  // 3. ATEŞ
  socket.on("player_shoot", (data) => {
    socket.broadcast.emit("player_shot", {
      id: socket.id,
      ...data
    });
  });

  // 4. ÇIKIŞ
  socket.on("disconnect", () => {
    console.log("Ayrıldı: " + socket.id);
    delete players[socket.id];
    io.emit("player_disconnected", socket.id);
  });
});

// Render'ın atadığı portu kullan, yoksa 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu Port ${PORT} üzerinde çalışıyor.`);
});