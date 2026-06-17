const logger = require('../utils/logger');
const { ROOM_STATES } = require('../constants/gameConstants');

class GameService {
  computeWordleFeedback(guessedWord, secretWord) {
    const guess = guessedWord.toUpperCase().split('');
    const secret = secretWord.toUpperCase().split('');
    const result = Array(guess.length).fill('absent');
    const secretRemaining = [...secret];

    // First pass: correct positions
    for (let i = 0; i < guess.length; i++) {
      if (guess[i] === secret[i]) {
        result[i] = 'correct';
        secretRemaining[i] = null;
      }
    }

    // Second pass: present but wrong position
    for (let i = 0; i < guess.length; i++) {
      if (result[i] === 'correct') continue;
      const idx = secretRemaining.indexOf(guess[i]);
      if (idx !== -1) {
        result[i] = 'present';
        secretRemaining[idx] = null;
      }
    }

    return guess.map((letter, i) => ({ letter, result: result[i] }));
  }

  createInitialWordDisplay(wordLength) {
    return Array(wordLength).fill('_').join('');
  }

  initializeGameState(room) {
    const hostId = room.hostId;
    const guestId = room.guestId;

    room.gameData.gameStarted = true;
    room.gameData.hostGuesses = [];
    room.gameData.guestGuesses = [];
    room.gameData.hostWordDisplay = this.createInitialWordDisplay(room.gameData.wordLength);
    room.gameData.guestWordDisplay = this.createInitialWordDisplay(room.gameData.wordLength);
    room.gameData.currentTurn = 'host';
    room.gameData.winner = null;
    room.state = ROOM_STATES.PLAYING;
    room.lastActivity = Date.now();

    logger.debug('Game state initialized', {
      roomId: room.id,
      wordLength: room.gameData.wordLength,
    });
  }

  processGuess(room, playerId, guessedWord) {
    const isHost = playerId === room.hostId;
    const secretWord = isHost ? room.gameData.guestWord : room.gameData.hostWord;
    const guessesArray = isHost ? room.gameData.hostGuesses : room.gameData.guestGuesses;

    if (!secretWord) {
      return { success: false, error: 'Game not ready' };
    }

    if (guessedWord.length !== secretWord.length) {
      return { success: false, error: `Word must be ${secretWord.length} letters` };
    }

    const feedback = this.computeWordleFeedback(guessedWord, secretWord);
    const won = feedback.every((f) => f.result === 'correct');

    guessesArray.push({ word: guessedWord.toUpperCase(), feedback, timestamp: Date.now() });
    room.lastActivity = Date.now();

    if (won) {
      room.gameData.winner = isHost ? 'host' : 'guest';
      room.state = ROOM_STATES.FINISHED;

      logger.info('Game won', {
        roomId: room.id,
        winner: room.gameData.winner,
        guessCount: guessesArray.length,
      });

      return { success: true, feedback, won: true, winner: room.gameData.winner };
    }

    // Switch turns
    room.gameData.currentTurn = isHost ? 'guest' : 'host';

    return { success: true, feedback, won: false };
  }
}

module.exports = GameService;
