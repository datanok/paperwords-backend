const logger = require('../utils/logger');
const { isValidWordLength } = require('../utils/validators');

const setupRoomEvents = (io, roomManager) => {
  io.on('connection', (socket) => {
    // userId is set by connectionEvents and stored on socket object

    socket.on('set_user', (userId) => {
      socket.userId = userId;
      logger.debug('User ID set for socket', { userId, socketId: socket.id });
    });

    socket.on('room:create', (data, callback) => {
      try {
        if (!socket.userId) {
          throw new Error('User not identified');
        }

        const room = roomManager.createRoom(socket.userId);
        const player = room.players[socket.userId];
        player.socketId = socket.id;

        socket.roomId = room.id;
        socket.join(room.id);

        logger.info('Room created', { roomId: room.id, hostId: socket.userId });

        if (callback) {
          callback({
            success: true,
            roomId: room.id,
            hostId: socket.userId,
            state: room.state,
          });
        }
      } catch (error) {
        logger.error('Error creating room', { error: error.message, userId: socket.userId });
        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    });

    socket.on('room:join', (data, callback) => {
      try {
        if (!socket.userId) {
          throw new Error('User not identified');
        }

        const { roomId } = data;
        if (!roomId) {
          throw new Error('roomId is required');
        }

        const room = roomManager.joinRoom(roomId, socket.userId);
        const player = room.players[socket.userId];
        player.socketId = socket.id;

        socket.roomId = roomId;
        socket.join(roomId);

        logger.info('Guest joined room', { roomId, guestId: socket.userId });

        // Notify host that guest joined
        io.to(roomId).emit('room:playerJoined', {
          playerId: socket.userId,
          role: 'guest',
          state: room.state,
        });

        if (callback) {
          callback({
            success: true,
            roomId: room.id,
            hostId: room.hostId,
            guestId: room.guestId,
            state: room.state,
            wordLength: room.gameData.wordLength,
          });
        }
      } catch (error) {
        logger.error('Error joining room', { error: error.message, userId: socket.userId });
        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    });

    socket.on('room:setWordLength', (data, callback) => {
      try {
        if (!socket.roomId || !socket.userId) {
          throw new Error('User or room not identified');
        }

        const { wordLength } = data;
        if (!isValidWordLength(wordLength)) {
          throw new Error(`Invalid word length: ${wordLength}. Must be between 4 and 8.`);
        }

        const room = roomManager.getRoom(socket.roomId);
        if (!room) {
          throw new Error('Room not found');
        }

        room.gameData.wordLength = wordLength;
        room.lastActivity = Date.now();

        logger.info('Word length set', { roomId: socket.roomId, wordLength });

        io.to(socket.roomId).emit('game:wordLengthSet', {
          wordLength,
          message: 'Word length selected. Now enter your secret word.',
        });

        if (callback) {
          callback({ success: true, wordLength });
        }
      } catch (error) {
        logger.error('Error setting word length', {
          error: error.message,
          userId: socket.userId,
          roomId: socket.roomId,
        });
        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    });

    socket.on('room:leave', (data, callback) => {
      try {
        if (!socket.roomId || !socket.userId) {
          throw new Error('User or room not identified');
        }

        const room = roomManager.getRoom(socket.roomId);
        if (room) {
          io.to(socket.roomId).emit('room:playerLeft', {
            playerId: socket.userId,
            message: 'Player left the room',
          });

          roomManager.removePlayerFromRoom(socket.roomId, socket.userId);
        }

        socket.leave(socket.roomId);
        const roomId = socket.roomId;
        socket.roomId = null;

        logger.info('Player left room', { roomId, userId: socket.userId });

        if (callback) {
          callback({ success: true });
        }
      } catch (error) {
        logger.error('Error leaving room', {
          error: error.message,
          userId: socket.userId,
          roomId: socket.roomId,
        });
        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    });

    socket.on('disconnect', () => {
      if (socket.roomId && socket.userId) {
        logger.debug('Socket disconnected, cleaning up', {
          roomId: socket.roomId,
          userId: socket.userId,
        });
      }
    });
  });
};

module.exports = { setupRoomEvents };
