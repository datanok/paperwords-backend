const { MIN_WORD_LENGTH, MAX_WORD_LENGTH, ROOM_ID_LENGTH } = require('../constants/gameConstants');

const isValidWordLength = (length) => {
  return Number.isInteger(length) && length >= MIN_WORD_LENGTH && length <= MAX_WORD_LENGTH;
};

const isValidWord = (word, expectedLength) => {
  if (!word || typeof word !== 'string') return false;
  if (word.length !== expectedLength) return false;
  return /^[a-zA-Z]+$/.test(word);
};

const isValidRoomId = (roomId) => {
  return roomId && typeof roomId === 'string' && roomId.length === ROOM_ID_LENGTH;
};

const isValidSessionId = (sessionId) => {
  return sessionId && typeof sessionId === 'string' && sessionId.length > 0;
};

const isValidUserId = (userId) => {
  return userId && typeof userId === 'string' && userId.length > 0;
};

module.exports = {
  isValidWordLength,
  isValidWord,
  isValidRoomId,
  isValidSessionId,
  isValidUserId,
};
