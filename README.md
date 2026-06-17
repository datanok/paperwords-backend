# PaperWords Backend

Real-time multiplayer word-guessing game backend built with Node.js, Express, and Socket.io.

## Phase 1 Completion: Backend Infrastructure ✅

### What's Implemented

**Core Services:**
- ✅ `RoomManager` - Room lifecycle management (create, join, leave, cleanup)
- ✅ `GarbageCollector` - Automatic cleanup of stale rooms (every 10 min)
- ✅ Socket.io configuration with CORS support
- ✅ Connection event handling (connect, disconnect, heartbeat)
- ✅ Room event handling (create, join, set word length, leave)
- ✅ Session management with 60-second grace period for disconnects

**Features:**
- Unique 6-character alphanumeric room IDs
- Max 2 players per room
- Heartbeat mechanism (ping/pong every 5 seconds)
- Automatic disconnect handling with configurable grace period
- Stale room garbage collection (removes rooms inactive >30 min)
- In-memory room store with complete game state
- Comprehensive logging and error handling

## Getting Started

### Installation

```bash
npm install
```

### Environment Setup

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure as needed:
- `NODE_ENV`: development or production
- `PORT`: Server port (default: 3001)
- `SOCKET_IO_CORS_ORIGIN`: Frontend URL for CORS
- `LOG_LEVEL`: debug, info, warn, or error

### Running the Server

**Development mode** (with auto-reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm start
```

The server will start on the configured port (default: 3001).

### Running Tests

```bash
npm test              # Run all tests once
npm run test:watch   # Run tests in watch mode
```

All Phase 1 unit tests pass:
- ✅ RoomManager CRUD operations
- ✅ Room state management
- ✅ Player connection tracking
- ✅ Stale room detection

## API Reference

### HTTP Endpoints

#### Health Check
```
GET /health
Response: { status: "ok", timestamp, rooms: <count> }
```

#### Room Info (Debug)
```
GET /api/rooms/:roomId
Response: { id, hostId, guestId, state, players, createdAt, lastActivity }
```

### Socket.io Events

#### Connection
```javascript
// Server -> Client
connection_established { userId, sessionId }

// Client heartbeat
heartbeat:ping { timestamp }
heartbeat:pong { timestamp }
```

#### Room Management
```javascript
// Client -> Server
room:create() -> { success, roomId, hostId }
room:join({ roomId }) -> { success, roomId, hostId, guestId, state }
room:setWordLength({ wordLength }) -> { success, wordLength }
room:leave() -> { success }

// Server -> Client
room:playerJoined { playerId, role, state }
room:playerDisconnected { playerId, gracePeriodMs, message }
room:playerLeft { playerId, message }
room:closing { reason, roomId }
game:wordLengthSet { wordLength, message }
```

## File Structure

```
src/
├── index.js                 # Entry point, Express + Socket.io setup
├── config/
│   └── socket.js           # Socket.io configuration
├── services/
│   ├── RoomManager.js      # Room lifecycle management
│   └── GarbageCollector.js # Stale room cleanup
├── events/
│   ├── connectionEvents.js # Connection/disconnect handling
│   ├── roomEvents.js       # Room create/join/leave logic
│   └── gameEvents.js       # Game logic (Phase 3)
├── constants/
│   └── gameConstants.js    # Game rules, timeouts, states
└── utils/
    ├── logger.js           # Logging utility
    └── validators.js       # Input validation
```

## Key Architectural Decisions

### In-Memory Store
- Rooms and sessions stored in Node.js Map objects
- **Why**: Simple, fast for MVP. Suitable for single-process deployment
- **Limitation**: Lost on server restart; doesn't scale beyond 1 process
- **Future**: Add Redis adapter for horizontal scaling in Phase 5

### Heartbeat Mechanism
- Client pings server every 5 seconds
- **Why**: Detects stale connections early
- **Implementation**: Server emits `heartbeat:ping`, client responds with `heartbeat:pong`

### Disconnect Grace Period
- 60-second window to reconnect after unexpected disconnect
- **Why**: Handles network blips without losing game state
- **Implementation**: Timeout is cleared if player reconnects within window

### Garbage Collector
- Runs every 10 minutes via node-cron
- Deletes rooms inactive for 30+ minutes
- **Why**: Prevents unbounded memory growth
- **Alternative**: Could use a background queue (Bull) for production

## Testing

### Unit Tests
Coverage includes:
- RoomManager creation, joining, leaving
- State transitions
- Stale room detection
- Disconnect timeout handling

Run tests:
```bash
npm test
```

### Integration Tests (Phase 2-4)
Will test complete Socket.io event flows once frontend is built.

### Manual Testing
To test the server locally:

```bash
# Terminal 1: Start the server
npm start

# Terminal 2: Test endpoints
curl http://localhost:3001/health

# Terminal 3: Use Socket.io client library to connect and test room creation/joining
```

## Next Steps (Phase 2)

1. Build React frontend with Rough.js aesthetic
2. Implement Socket.io client hooks (useSocket, useSession)
3. Create UI for room creation/joining
4. Add session persistence with sessionStorage

## Security Considerations

**Phase 1 Design**:
- ✅ Input validation on all socket events
- ✅ Room IDs are random, not sequential
- ✅ Max 2 players enforced server-side
- ⚠️ No authentication (intentional for MVP; add in Phase 4+)
- ⚠️ Secret words not hashed (acceptable for casual 1v1; trust model is single opponent)

**Future**:
- Add JWT authentication for production
- Implement rate limiting on socket events
- Add SQL injection protection if database is added

## Troubleshooting

**Server won't start:**
- Check port 3001 is available: `netstat -an | grep 3001`
- Check .env file exists and PORT is not occupied
- Run `npm install` to ensure dependencies are installed

**Tests failing:**
- Ensure node_modules is installed: `npm install`
- Check jest is available: `npm list jest`

**CORS errors in browser:**
- Ensure `SOCKET_IO_CORS_ORIGIN` in .env matches frontend URL
- Default is `http://localhost:3000`

## Performance Notes

- Heartbeat interval: 5 seconds
- Disconnect grace period: 60 seconds
- Garbage collector interval: 10 minutes
- Room cleanup threshold: 30 minutes of inactivity

All values are configurable in `.env` and `src/constants/gameConstants.js`.

## License

MIT
