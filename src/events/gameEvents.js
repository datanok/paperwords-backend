const logger = require('../utils/logger');
const GameService = require('../services/GameService');
const { isValidWord } = require('../utils/validators');

const setupGameEvents = (io, roomManager) => {
  const gameService = new GameService();

  io.on('connection', (socket) => {
    // userId and roomId are set by other event handlers and stored on socket object

    socket.on('game:submitWord', (data, callback) => {
      try {
        if (!socket.roomId || !socket.userId) {
          throw new Error('User or room not identified');
        }

        const { word } = data;
        const room = roomManager.getRoom(socket.roomId);

        if (!room) {
          throw new Error('Room not found');
        }

        if (!word || typeof word !== 'string') {
          throw new Error('Word is required');
        }

        const expectedLength = room.gameData.wordLength;
        if (!isValidWord(word, expectedLength)) {
          throw new Error(`Invalid ${expectedLength}-letter word`);
        }

        // Store the word
        const isHost = socket.userId === room.hostId;
        if (isHost) {
          room.gameData.hostWord = word.toUpperCase();
          room.gameData.hostReady = true;
        } else {
          room.gameData.guestWord = word.toUpperCase();
          room.gameData.guestReady = true;
        }

        room.lastActivity = Date.now();

        logger.info('Word submitted', {
          roomId: socket.roomId,
          playerId: socket.userId,
          wordLength: word.length,
        });

        // Check if both players ready
        if (room.gameData.hostReady && room.gameData.guestReady) {
          // Initialize game state
          gameService.initializeGameState(room);

          // Emit game started to both players
          io.to(socket.roomId).emit('game:gameStarted', {
            hostWordDisplay: room.gameData.hostWordDisplay,
            guestWordDisplay: room.gameData.guestWordDisplay,
            currentTurn: room.gameData.currentTurn,
          });

          // Determine whose turn starts
          const hostSocket = Object.values(room.players).find((p) => p.role === 'host')?.socketId;
          if (hostSocket) {
            io.to(hostSocket).emit('game:yourTurn', { isYourTurn: true });
          }

          const guestSocket = Object.values(room.players).find((p) => p.role === 'guest')?.socketId;
          if (guestSocket) {
            io.to(guestSocket).emit('game:yourTurn', { isYourTurn: false });
          }
        }

        if (callback) {
          callback({ success: true });
        }
      } catch (error) {
        logger.error('Error submitting word', {
          error: error.message,
          userId: socket.userId,
          roomId: socket.roomId,
        });

        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    });

    socket.on('game:guessWord', (data, callback) => {
      try {
        if (!socket.roomId || !socket.userId) {
          throw new Error('User or room not identified');
        }

        const { word } = data;
        if (!word || typeof word !== 'string') {
          throw new Error('Word is required');
        }

        if (!/^[a-zA-Z]+$/.test(word)) {
          throw new Error('Word must contain only letters');
        }

        const room = roomManager.getRoom(socket.roomId);
        if (!room) {
          throw new Error('Room not found');
        }

        const playerRole = socket.userId === room.hostId ? 'host' : 'guest';
        if (room.gameData.currentTurn !== playerRole) {
          if (callback) callback({ success: false, error: 'Not your turn' });
          return;
        }

        const result = gameService.processGuess(room, socket.userId, word.toUpperCase());

        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        // Broadcast guess + feedback to both players
        io.to(socket.roomId).emit('game:feedback', {
          word: word.toUpperCase(),
          feedback: result.feedback,
          playerRole,
        });

        if (result.won) {
          io.to(socket.roomId).emit('game:won', {
            winner: result.winner,
            secretWord: result.winner === 'host' ? room.gameData.guestWord : room.gameData.hostWord,
          });
        } else {
          io.to(socket.roomId).emit('game:turnChanged', {
            currentTurn: room.gameData.currentTurn,
          });
        }

        roomManager.updateLastActivity(socket.roomId);

        if (callback) callback({ success: true });
      } catch (error) {
        logger.error('Error processing word guess', {
          error: error.message,
          userId: socket.userId,
          roomId: socket.roomId,
        });
        if (callback) callback({ success: false, error: error.message });
      }
    });

    socket.on('game:ready', (data, callback) => {
      try {
        if (!socket.roomId || !socket.userId) {
          throw new Error('User or room not identified');
        }

        const room = roomManager.getRoom(socket.roomId);
        if (!room) {
          throw new Error('Room not found');
        }

        // Mark player as ready (after word submission)
        const isHost = socket.userId === room.hostId;
        if (isHost) {
          room.gameData.hostReady = true;
        } else {
          room.gameData.guestReady = true;
        }

        logger.debug('Player ready', { roomId: socket.roomId, playerId: socket.userId });

        // If both ready, start countdown
        if (room.gameData.hostReady && room.gameData.guestReady && room.gameData.hostWord && room.gameData.guestWord) {
          io.to(socket.roomId).emit('game:bothReady', {
            countdownStartsIn: 3000,
          });

          // Start countdown
          let countdown = 3;
          const countdownInterval = setInterval(() => {
            io.to(socket.roomId).emit('game:countdownTick', { remaining: countdown });
            countdown--;

            if (countdown < 0) {
              clearInterval(countdownInterval);
            }
          }, 1000);
        }

        if (callback) {
          callback({ success: true });
        }
      } catch (error) {
        logger.error('Error marking ready', {
          error: error.message,
          userId: socket.userId,
          roomId: socket.roomId,
        });

        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    });

    socket.on('game:sendSticker', (data) => {
      try {
        if (!socket.roomId) return;
        socket.to(socket.roomId).emit('game:stickerReceived', { sticker: data.sticker });
      } catch (error) {
        logger.error('Error sending sticker', { error: error.message });
      }
    });

    socket.on('disconnect', () => {
      // Cleanup handled in connectionEvents
    });
  });
};

module.exports = { setupGameEvents };
