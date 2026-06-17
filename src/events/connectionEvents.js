const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { HEARTBEAT_INTERVAL } = require('../constants/gameConstants');

const setupConnectionEvents = (io, roomManager) => {
  io.on('connection', (socket) => {
    const userId = uuidv4();
    socket.userId = userId; // Store on socket object for access in other handlers
    logger.info('Client connected', { userId, socketId: socket.id });

    socket.emit('connection_established', {
      userId,
      sessionId: uuidv4(),
      message: 'Connected to PaperWords server',
    });

    // Heartbeat mechanism
    const heartbeatInterval = setInterval(() => {
      socket.emit('heartbeat:ping', { timestamp: Date.now() });
    }, HEARTBEAT_INTERVAL);

    socket.on('heartbeat:pong', (data) => {
      logger.debug('Heartbeat pong received', { userId, timestamp: data.timestamp });
    });

    socket.on('disconnect', () => {
      clearInterval(heartbeatInterval);
      const userId = socket.userId;
      logger.info('Client disconnected', { userId, socketId: socket.id });

      if (userId) {
        // If the user was in a room, mark them as disconnected
        const allRooms = roomManager.getAllRooms();
        allRooms.forEach((room) => {
          if (room.players[userId]) {
            roomManager.markPlayerDisconnected(room.id, userId, () => {
              // When grace period expires and no reconnect
              const remaining = roomManager.getRoom(room.id);
              if (remaining) {
                io.to(room.id).emit('room:closing', {
                  reason: 'Other player disconnected and did not reconnect',
                  roomId: room.id,
                });
              }
            });

            // Notify the other player
            const otherPlayerId = room.hostId === userId ? room.guestId : room.hostId;
            if (otherPlayerId && room.players[otherPlayerId]?.connected) {
              io.to(room.id).emit('room:playerDisconnected', {
                playerId: userId,
                gracePeriodMs: 60000,
                message: 'Opponent disconnected. Waiting 60 seconds to reconnect...',
              });
            }
          }
        });
      }
    });
  });
};

module.exports = { setupConnectionEvents };
