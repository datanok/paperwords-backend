const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { ROOM_STATES, PLAYER_ROLES, DISCONNECT_GRACE_PERIOD, MAX_PLAYERS_PER_ROOM } = require('../constants/gameConstants');

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  createRoom(hostId) {
    if (!hostId) throw new Error('hostId is required');

    const roomId = this.generateRoomId();
    const room = {
      id: roomId,
      hostId,
      guestId: null,
      state: ROOM_STATES.WAITING_FOR_GUEST,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      players: {
        [hostId]: {
          id: hostId,
          role: PLAYER_ROLES.HOST,
          socketId: null,
          connected: true,
          disconnectTimeout: null,
        },
      },
      gameData: {
        wordLength: null,
        hostWord: null,
        guestWord: null,
        hostGuesses: [],
        guestGuesses: [],
        currentTurn: PLAYER_ROLES.HOST,
        winner: null,
        hostReady: false,
        guestReady: false,
      },
    };

    this.rooms.set(roomId, room);
    logger.info('Room created', { roomId, hostId });
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  joinRoom(roomId, guestId) {
    if (!roomId || !guestId) throw new Error('roomId and guestId are required');

    const room = this.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    const playerCount = Object.keys(room.players).length;
    if (playerCount >= MAX_PLAYERS_PER_ROOM) {
      throw new Error('Room is full');
    }

    if (room.guestId) throw new Error('Room already has a guest');

    room.guestId = guestId;
    room.players[guestId] = {
      id: guestId,
      role: PLAYER_ROLES.GUEST,
      socketId: null,
      connected: true,
      disconnectTimeout: null,
    };
    room.state = ROOM_STATES.READY_FOR_WORDS;
    room.lastActivity = Date.now();

    logger.info('Guest joined room', { roomId, guestId });
    return room;
  }

  setPlayerSocketId(roomId, playerId, socketId) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    const player = room.players[playerId];
    if (!player) throw new Error(`Player ${playerId} not in room`);

    player.socketId = socketId;
    player.connected = true;
    room.lastActivity = Date.now();

    logger.debug('Player socket ID set', { roomId, playerId, socketId });
  }

  markPlayerConnected(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    const player = room.players[playerId];
    if (!player) throw new Error(`Player ${playerId} not in room`);

    player.connected = true;
    if (player.disconnectTimeout) {
      clearTimeout(player.disconnectTimeout);
      player.disconnectTimeout = null;
    }
    room.lastActivity = Date.now();

    logger.debug('Player marked connected', { roomId, playerId });
  }

  markPlayerDisconnected(roomId, playerId, onTimeoutCallback) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    const player = room.players[playerId];
    if (!player) throw new Error(`Player ${playerId} not in room`);

    player.connected = false;
    logger.info('Player disconnected', { roomId, playerId });

    player.disconnectTimeout = setTimeout(() => {
      logger.info('Disconnect grace period expired, removing player', { roomId, playerId });
      this.removePlayerFromRoom(roomId, playerId);
      if (onTimeoutCallback) onTimeoutCallback();
    }, DISCONNECT_GRACE_PERIOD);
  }

  removePlayerFromRoom(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room) return;

    const player = room.players[playerId];
    if (player && player.disconnectTimeout) {
      clearTimeout(player.disconnectTimeout);
    }

    delete room.players[playerId];
    room.lastActivity = Date.now();

    logger.info('Player removed from room', { roomId, playerId });

    if (Object.keys(room.players).length === 0) {
      this.deleteRoom(roomId);
    }
  }

  setGameState(roomId, state) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    room.state = state;
    room.lastActivity = Date.now();

    logger.debug('Game state updated', { roomId, state });
  }

  updateLastActivity(roomId) {
    const room = this.getRoom(roomId);
    if (room) {
      room.lastActivity = Date.now();
    }
  }

  deleteRoom(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return;

    for (const playerId in room.players) {
      const player = room.players[playerId];
      if (player.disconnectTimeout) {
        clearTimeout(player.disconnectTimeout);
      }
    }

    this.rooms.delete(roomId);
    logger.info('Room deleted', { roomId });
  }

  getAllRooms() {
    return Array.from(this.rooms.values());
  }

  getRoomCount() {
    return this.rooms.size;
  }

  getStaleRooms(thresholdMs) {
    const now = Date.now();
    return Array.from(this.rooms.values()).filter((room) => now - room.lastActivity > thresholdMs);
  }
}

module.exports = RoomManager;
