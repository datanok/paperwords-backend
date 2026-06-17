module.exports = {
  // Room constraints
  MAX_PLAYERS_PER_ROOM: 2,
  ROOM_ID_LENGTH: 6,

  // Word constraints
  MIN_WORD_LENGTH: 4,
  MAX_WORD_LENGTH: 8,

  // Timeouts (in milliseconds)
  HEARTBEAT_INTERVAL: 5000,
  DISCONNECT_GRACE_PERIOD: 60000, // 60 seconds
  STALE_ROOM_CLEANUP_INTERVAL: 10 * 60 * 1000, // 10 minutes
  STALE_ROOM_THRESHOLD: 30 * 60 * 1000, // 30 minutes

  // Game states
  ROOM_STATES: {
    WAITING_FOR_GUEST: 'waiting_for_guest',
    READY_FOR_WORDS: 'ready_for_words',
    PLAYING: 'playing',
    ROUND_ENDED: 'round_ended',
    FINISHED: 'finished',
  },

  PLAYER_ROLES: {
    HOST: 'host',
    GUEST: 'guest',
  },

  // Default values
  DEFAULT_HEARTBEAT_TIMEOUT: 10000,
};
