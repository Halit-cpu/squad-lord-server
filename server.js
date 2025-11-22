const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ODA YÖNETİMİ
const MAX_PLAYERS_PER_ROOM = 20;
let rooms = {}; // { "room_1": { players: {}, count: 0 }, "room_2": ... }

// Uygun oda bul veya oluştur
function findAvailableRoom() {
    let roomIds = Object.keys(rooms);
    for (let id of roomIds) {
        if (rooms[id].count < MAX_PLAYERS_PER_ROOM) {
            return id;
        }
    }
    // Hiçbir odada yer yoksa yeni oda aç (room_1, room_2...)
    let newRoomId = `room_${roomIds.length + 1}`;
    rooms[newRoomId] = { players: {}, count: 0 };
    console.log(`🆕 YENİ ODA AÇILDI: ${newRoomId}`);
    return newRoomId;
}

io.on("connection", (socket) => {
    console.log("Bağlantı: " + socket.id);
    let currentRoom = null;

    // 1. OYUNA GİRİŞ
    socket.on("join_game", (data) => {
        // Uygun oda bul
        currentRoom = findAvailableRoom();
        socket.join(currentRoom);

        // Oyuncuyu odaya kaydet
        rooms[currentRoom].players[socket.id] = {
            id: socket.id,
            name: data.name || "Komutan",
            x: Math.random() * 20000 + 2500, // Rastgele doğuş (Büyük harita)
            y: Math.random() * 20000 + 2500,
            angle: 0,
            tier: 1,
            power: data.power || 0, // Güç (Liderlik tablosu için)
            kills: data.kills || 0  // Leş
        };
        rooms[currentRoom].count++;

        // Yeni oyuncuya odadaki diğerlerini gönder
        socket.emit("current_players", rooms[currentRoom].players);
        
        // Odadaki diğerlerine yeni oyuncuyu haber ver
        socket.to(currentRoom).emit("new_player", rooms[currentRoom].players[socket.id]);
        
        console.log(`${data.name} -> ${currentRoom} (Kişi: ${rooms[currentRoom].count})`);
    });

    // 2. İSTATİSTİK GÜNCELLEME (Liderlik Tablosu İçin)
    // Oyuncu sürekli kendi güncel gücünü ve leş sayısını gönderir
    socket.on("update_stats", (data) => {
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom].players[socket.id]) {
            let p = rooms[currentRoom].players[socket.id];
            p.power = data.power;
            p.kills = data.kills;
            p.tier = data.tier;
        }
    });

    // 3. HAREKET
    socket.on("player_move", (data) => {
        if (currentRoom && rooms[currentRoom]?.players[socket.id]) {
            let p = rooms[currentRoom].players[socket.id];
            p.x = data.x; p.y = data.y; p.angle = data.angle;
            socket.to(currentRoom).emit("player_moved", p);
        }
    });

    // 4. ATEŞ
    socket.on("player_shoot", (data) => {
        if (currentRoom) {
            socket.to(currentRoom).emit("player_shot", { id: socket.id, ...data });
        }
    });

    // 5. ÇIKIŞ
    socket.on("disconnect", () => {
        if (currentRoom && rooms[currentRoom]) {
            delete rooms[currentRoom].players[socket.id];
            rooms[currentRoom].count--;
            io.to(currentRoom).emit("player_disconnected", socket.id);
            console.log(`Ayrıldı: ${socket.id} (${currentRoom})`);
        }
    });
});

// 6. LİDERLİK TABLOSU YAYINI (Her 1 saniyede bir her odaya özel sıralama gönder)
setInterval(() => {
    for (let roomId in rooms) {
        let room = rooms[roomId];
        if (room.count > 0) {
            // Oyuncuları Güçlerine göre sırala
            let sortedPlayers = Object.values(room.players).sort((a, b) => b.power - a.power);
            // İlk 5 kişiyi al
            let top5 = sortedPlayers.slice(0, 5).map(p => ({ name: p.name, power: p.power, kills: p.kills }));
            
            // Odaya yayınla
            io.to(roomId).emit("leaderboard_update", top5);
        }
    }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu Port ${PORT} üzerinde aktif.`));