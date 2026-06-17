const logger = require('../utils/logger');
const GameService = require('../services/GameService');
const { isValidWord } = require('../utils/validators');
const { ROOM_STATES, PLAYER_ROLES } = require('../constants/gameConstants');

const setupGameEvents = (io, roomManager) => {
  const gameService = new GameService();

  function endRound(room, roomId) {
    const winner = room.gameData.roundWinner;
    if (winner === PLAYER_ROLES.HOST) room.gameData.hostWins++;
    else if (winner === PLAYER_ROLES.GUEST) room.gameData.guestWins++;

    const nextRound = room.gameData.currentRound + 1;
    const halfRounds = room.gameData.totalRounds / 2;
    const isGameOver =
      nextRound > room.gameData.totalRounds ||
      room.gameData.hostWins > halfRounds ||
      room.gameData.guestWins > halfRounds;

    let finalWinner = null;
    if (isGameOver) {
      if (room.gameData.hostWins > room.gameData.guestWins) finalWinner = 'host';
      else if (room.gameData.guestWins > room.gameData.hostWins) finalWinner = 'guest';
      else finalWinner = 'tie';
    }

    room.gameData.currentRound = nextRound;
    room.state = isGameOver ? ROOM_STATES.FINISHED : ROOM_STATES.ROUND_ENDED;
    room.lastActivity = Date.now();

    io.to(roomId).emit('game:roundEnd', {
      roundWinner: winner,
      hostWins: room.gameData.hostWins,
      guestWins: room.gameData.guestWins,
      currentRound: room.gameData.currentRound,
      totalRounds: room.gameData.totalRounds,
      isGameOver,
      finalWinner,
      hostSecretWord: room.gameData.hostWord,
      guestSecretWord: room.gameData.guestWord,
    });
  }

  io.on('connection', (socket) => {

    socket.on('game:submitWord', (data, callback) => {
      try {
        if (!socket.roomId || !socket.userId) throw new Error('User or room not identified');

        const { word } = data;
        const room = roomManager.getRoom(socket.roomId);
        if (!room) throw new Error('Room not found');
        if (!word || typeof word !== 'string') throw new Error('Word is required');

        const expectedLength = room.gameData.wordLength;
        if (!isValidWord(word, expectedLength)) throw new Error(`Invalid ${expectedLength}-letter word`);

        const isHost = socket.userId === room.hostId;
        if (isHost) {
          room.gameData.hostWord = word.toUpperCase();
          room.gameData.hostReady = true;
        } else {
          room.gameData.guestWord = word.toUpperCase();
          room.gameData.guestReady = true;
        }
        room.lastActivity = Date.now();

        logger.info('Word submitted', { roomId: socket.roomId, playerId: socket.userId, wordLength: word.length });

        if (room.gameData.hostReady && room.gameData.guestReady) {
          gameService.initializeGameState(room);
          io.to(socket.roomId).emit('game:gameStarted', {
            hostWordDisplay: room.gameData.hostWordDisplay,
            guestWordDisplay: room.gameData.guestWordDisplay,
            currentTurn: room.gameData.currentTurn,
          });
          const hostSocket = Object.values(room.players).find((p) => p.role === 'host')?.socketId;
          if (hostSocket) io.to(hostSocket).emit('game:yourTurn', { isYourTurn: true });
          const guestSocket = Object.values(room.players).find((p) => p.role === 'guest')?.socketId;
          if (guestSocket) io.to(guestSocket).emit('game:yourTurn', { isYourTurn: false });
        }

        if (callback) callback({ success: true });
      } catch (error) {
        logger.error('Error submitting word', { error: error.message });
        if (callback) callback({ success: false, error: error.message });
      }
    });

    socket.on('game:guessWord', (data, callback) => {
      try {
        if (!socket.roomId || !socket.userId) throw new Error('User or room not identified');

        const { word } = data;
        if (!word || typeof word !== 'string') throw new Error('Word is required');
        if (!/^[a-zA-Z]+$/.test(word)) throw new Error('Word must contain only letters');

        const room = roomManager.getRoom(socket.roomId);
        if (!room) throw new Error('Room not found');

        const playerRole = socket.userId === room.hostId ? 'host' : 'guest';

        if (!room.gameData.roundWinner) {
          // Normal turn-based play
          if (room.gameData.currentTurn !== playerRole) {
            if (callback) callback({ success: false, error: 'Not your turn' });
            return;
          }
        } else {
          // Free-guessing mode — only the loser can still guess
          if (playerRole === room.gameData.roundWinner) {
            if (callback) callback({ success: false, error: 'You already won this round' });
            return;
          }
        }

        const result = gameService.processGuess(room, socket.userId, word.toUpperCase());
        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        io.to(socket.roomId).emit('game:feedback', {
          word: word.toUpperCase(),
          feedback: result.feedback,
          playerRole,
        });

        if (result.won) {
          if (!room.gameData.roundWinner) {
            // First person to solve — they win the round
            room.gameData.roundWinner = playerRole;
            io.to(socket.roomId).emit('game:roundWon', {
              winner: playerRole,
              secretWord: playerRole === 'host' ? room.gameData.guestWord : room.gameData.hostWord,
              hostWins: room.gameData.hostWins,
              guestWins: room.gameData.guestWins,
            });
            // Don't end round yet — loser can keep guessing
          } else {
            // Loser also solved it
            room.gameData[playerRole === 'host' ? 'hostSolved' : 'guestSolved'] = true;
            io.to(socket.roomId).emit('game:loserSolved', {
              word: word.toUpperCase(),
              secretWord: playerRole === 'host' ? room.gameData.guestWord : room.gameData.hostWord,
            });
            endRound(room, socket.roomId);
          }
        } else if (!room.gameData.roundWinner) {
          io.to(socket.roomId).emit('game:turnChanged', { currentTurn: room.gameData.currentTurn });
        }

        roomManager.updateLastActivity(socket.roomId);
        if (callback) callback({ success: true });
      } catch (error) {
        logger.error('Error processing word guess', { error: error.message });
        if (callback) callback({ success: false, error: error.message });
      }
    });

    socket.on('game:giveUp', (data, callback) => {
      try {
        if (!socket.roomId) return;
        const room = roomManager.getRoom(socket.roomId);
        if (!room || !room.gameData.roundWinner) return;
        endRound(room, socket.roomId);
        if (callback) callback({ success: true });
      } catch (error) {
        logger.error('Error giving up', { error: error.message });
      }
    });

    socket.on('game:nextRound', (data, callback) => {
      try {
        if (!socket.roomId || !socket.userId) return;
        const room = roomManager.getRoom(socket.roomId);
        if (!room) return;

        const isHost = socket.userId === room.hostId;
        if (isHost) room.gameData.hostReadyNext = true;
        else room.gameData.guestReadyNext = true;

        socket.to(socket.roomId).emit('game:opponentReadyNext');

        if (room.gameData.hostReadyNext && room.gameData.guestReadyNext) {
          roomManager.resetRound(room.id);
          io.to(socket.roomId).emit('game:roundReset', {
            wordLength: room.gameData.wordLength,
            currentRound: room.gameData.currentRound,
            totalRounds: room.gameData.totalRounds,
            hostWins: room.gameData.hostWins,
            guestWins: room.gameData.guestWins,
          });
        }

        if (callback) callback({ success: true });
      } catch (error) {
        logger.error('Error readying for next round', { error: error.message });
      }
    });

    socket.on('game:typing', (data) => {
      if (!socket.roomId) return;
      socket.to(socket.roomId).emit('game:opponentTyping', { word: data.word || '' });
    });

    socket.on('game:ready', (data, callback) => {
      try {
        if (!socket.roomId || !socket.userId) throw new Error('User or room not identified');
        const room = roomManager.getRoom(socket.roomId);
        if (!room) throw new Error('Room not found');

        const isHost = socket.userId === room.hostId;
        if (isHost) room.gameData.hostReady = true;
        else room.gameData.guestReady = true;

        if (room.gameData.hostReady && room.gameData.guestReady && room.gameData.hostWord && room.gameData.guestWord) {
          io.to(socket.roomId).emit('game:bothReady', { countdownStartsIn: 3000 });
          let countdown = 3;
          const interval = setInterval(() => {
            io.to(socket.roomId).emit('game:countdownTick', { remaining: countdown });
            if (--countdown < 0) clearInterval(interval);
          }, 1000);
        }

        if (callback) callback({ success: true });
      } catch (error) {
        logger.error('Error marking ready', { error: error.message });
        if (callback) callback({ success: false, error: error.message });
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
