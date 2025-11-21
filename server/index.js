import { Server } from "socket.io";
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'world.json');

const app = express();
const server = http.createServer(app);

// Serve static files from the Angular app dist folder
// Adjust 'minecraft-vibe-edition' to match your angular.json output path if different
// Usually dist/minecraft-vibe-edition/browser for newer Angular versions
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback for SPA routing
// Using regex for catch-all to satisfy path-to-regexp v8+ used by newer Express
app.get(/(.*)/, (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            // Fallback if browser folder structure is different (older angular)
             res.sendFile(path.join(__dirname, '../dist/minecraft-vibe-edition/index.html'));
        }
    });
});

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const players = {};
let worldChanges = {}; 
let worldSeed = Math.random() * 10000; // Generate a random seed for this server instance

// Load world data
try {
  if (fs.existsSync(DATA_FILE)) {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);
    // Support legacy format (just changes) or new format { seed, changes }
    if (parsed.seed) {
        worldChanges = parsed.changes || {};
        worldSeed = parsed.seed;
    } else {
        worldChanges = parsed;
    }
    console.log('Loaded world with', Object.keys(worldChanges).length, 'changes. Seed:', worldSeed);
  }
} catch (err) {
  console.error('Failed to load world data:', err);
}

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  players[socket.id] = {
    id: socket.id,
    position: { x: 0, y: 10, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    item: null,
    worldChanges: worldChanges
  };

  socket.emit("init", {
    id: socket.id,
    seed: worldSeed,
    players: players,
    worldChanges: worldChanges,
  });

  socket.broadcast.emit("player-join", players[socket.id]);
  console.log(`Total players: ${Object.keys(players).length}`);

  socket.on("move", (data) => {
    if (players[socket.id]) {
      players[socket.id].position = data.position;
      players[socket.id].rotation = data.rotation;
      players[socket.id].item = data.item; 
      socket.broadcast.emit("player-move", {
        id: socket.id,
        position: data.position,
        rotation: data.rotation,
        item: data.item,
      });
    }
  });

  socket.on("block-update", (data) => {
    console.log(`Block update from ${socket.id}: ${data.action} at ${data.x},${data.y},${data.z}`);
    const key = `${data.x},${data.y},${data.z}`;
    if (data.action === 'remove') {
       worldChanges[key] = { ...data, type: null };
    } else {
       worldChanges[key] = data;
    }
    
    // Save world data
    try {
      const dataToSave = {
          seed: worldSeed,
          changes: worldChanges
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2));
    } catch (err) {
      console.error('Failed to save world data:', err);
    }

    socket.broadcast.emit("block-update", data);
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    delete players[socket.id];
    io.emit("player-leave", socket.id);
    console.log(`Total players: ${Object.keys(players).length}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serving static files from ${distPath}`);
});
