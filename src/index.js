require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const logger = require('./utils/logger');
const { configureSocket } = require('./config/socket');
const RoomManager = require('./services/RoomManager');
const GarbageCollector = require('./services/GarbageCollector');
const { setupConnectionEvents } = require('./events/connectionEvents');
const { setupRoomEvents } = require('./events/roomEvents');
const { setupGameEvents } = require('./events/gameEvents');

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();
const server = http.createServer(app);
const io = configureSocket(server);
const roomManager = new RoomManager();
const garbageCollector = new GarbageCollector(roomManager, io);

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    rooms: roomManager.getRoomCount(),
  });
});

// API endpoint to get room info (for debugging)
app.get('/api/rooms/:roomId', (req, res) => {
  const room = roomManager.getRoom(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  // Don't expose secret words in API response
  const safeRoom = {
    id: room.id,
    hostId: room.hostId,
    guestId: room.guestId,
    state: room.state,
    createdAt: room.createdAt,
    lastActivity: room.lastActivity,
    players: Object.keys(room.players).map((playerId) => ({
      id: playerId,
      role: room.players[playerId].role,
      connected: room.players[playerId].connected,
    })),
  };

  res.json(safeRoom);
});

// Setup Socket.io event handlers
setupConnectionEvents(io, roomManager);
setupRoomEvents(io, roomManager);
setupGameEvents(io, roomManager);

// Start server
server.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Start garbage collector
garbageCollector.start();

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully');
  garbageCollector.stop();
  io.close();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io, roomManager };
