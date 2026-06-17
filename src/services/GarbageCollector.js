const cron = require('node-cron');
const logger = require('../utils/logger');
const { STALE_ROOM_CLEANUP_INTERVAL, STALE_ROOM_THRESHOLD } = require('../constants/gameConstants');

class GarbageCollector {
  constructor(roomManager, io) {
    this.roomManager = roomManager;
    this.io = io;
    this.task = null;
  }

  start() {
    const intervalInMinutes = Math.round(STALE_ROOM_CLEANUP_INTERVAL / 60000);
    this.task = cron.schedule(`*/${intervalInMinutes} * * * *`, () => {
      this.cleanup();
    });
    logger.info(`Garbage collector started (runs every ${intervalInMinutes} minutes)`);
  }

  cleanup() {
    const staleRooms = this.roomManager.getStaleRooms(STALE_ROOM_THRESHOLD);
    logger.info('Running garbage collection', {
      totalRooms: this.roomManager.getRoomCount(),
      staleRooms: staleRooms.length,
    });

    staleRooms.forEach((room) => {
      logger.info('Removing stale room', {
        roomId: room.id,
        inactiveForMs: Date.now() - room.lastActivity,
      });

      // Notify any remaining connected players
      this.io.to(room.id).emit('room:closing', {
        reason: 'Room was inactive for too long',
        roomId: room.id,
      });

      // Delete the room
      this.roomManager.deleteRoom(room.id);
    });
  }

  stop() {
    if (this.task) {
      this.task.stop();
      logger.info('Garbage collector stopped');
    }
  }
}

module.exports = GarbageCollector;
