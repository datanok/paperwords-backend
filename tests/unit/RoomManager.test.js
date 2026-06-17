const RoomManager = require('../../src/services/RoomManager');
const { ROOM_STATES, PLAYER_ROLES } = require('../../src/constants/gameConstants');

describe('RoomManager', () => {
  let roomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  describe('createRoom', () => {
    it('should create a room with a host', () => {
      const hostId = 'user-123';
      const room = roomManager.createRoom(hostId);

      expect(room).toBeDefined();
      expect(room.hostId).toBe(hostId);
      expect(room.guestId).toBeNull();
      expect(room.state).toBe(ROOM_STATES.WAITING_FOR_GUEST);
      expect(room.players[hostId]).toBeDefined();
      expect(room.players[hostId].role).toBe(PLAYER_ROLES.HOST);
    });

    it('should throw error if hostId is missing', () => {
      expect(() => roomManager.createRoom(null)).toThrow();
    });

    it('should generate unique room IDs', () => {
      const room1 = roomManager.createRoom('user-1');
      const room2 = roomManager.createRoom('user-2');

      expect(room1.id).not.toBe(room2.id);
    });
  });

  describe('joinRoom', () => {
    it('should add guest to existing room', () => {
      const hostId = 'user-123';
      const guestId = 'user-456';

      const room = roomManager.createRoom(hostId);
      const updatedRoom = roomManager.joinRoom(room.id, guestId);

      expect(updatedRoom.guestId).toBe(guestId);
      expect(updatedRoom.players[guestId]).toBeDefined();
      expect(updatedRoom.players[guestId].role).toBe(PLAYER_ROLES.GUEST);
      expect(updatedRoom.state).toBe(ROOM_STATES.READY_FOR_WORDS);
    });

    it('should throw error if room does not exist', () => {
      expect(() => roomManager.joinRoom('invalid-room', 'user-456')).toThrow(
        'not found'
      );
    });

    it('should throw error if room is full', () => {
      const hostId = 'user-123';
      const guestId = 'user-456';
      const extraId = 'user-789';

      const room = roomManager.createRoom(hostId);
      roomManager.joinRoom(room.id, guestId);

      expect(() => roomManager.joinRoom(room.id, extraId)).toThrow('full');
    });
  });

  describe('removePlayerFromRoom', () => {
    it('should remove a player from the room', () => {
      const hostId = 'user-123';
      const room = roomManager.createRoom(hostId);

      expect(room.players[hostId]).toBeDefined();
      roomManager.removePlayerFromRoom(room.id, hostId);

      const updatedRoom = roomManager.getRoom(room.id);
      expect(updatedRoom).toBeUndefined();
    });

    it('should delete room if all players are removed', () => {
      const hostId = 'user-123';
      const guestId = 'user-456';

      const room = roomManager.createRoom(hostId);
      roomManager.joinRoom(room.id, guestId);
      roomManager.removePlayerFromRoom(room.id, hostId);
      roomManager.removePlayerFromRoom(room.id, guestId);

      expect(roomManager.getRoom(room.id)).toBeUndefined();
    });
  });

  describe('getStaleRooms', () => {
    it('should identify rooms inactive for longer than threshold', () => {
      const hostId = 'user-123';
      const room = roomManager.createRoom(hostId);

      // Simulate old lastActivity
      room.lastActivity = Date.now() - 35 * 60 * 1000; // 35 minutes ago

      const staleRooms = roomManager.getStaleRooms(30 * 60 * 1000); // 30 min threshold
      expect(staleRooms).toContain(room);
    });

    it('should not include recent rooms as stale', () => {
      const hostId = 'user-123';
      const room = roomManager.createRoom(hostId);

      const staleRooms = roomManager.getStaleRooms(30 * 60 * 1000);
      expect(staleRooms).not.toContain(room);
    });
  });
});
