const socketIO = require('socket.io');

const configureSocket = (server) => {
  const corsOrigin = process.env.SOCKET_IO_CORS_ORIGIN || 'http://localhost:3000';

  const io = new socketIO.Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  return io;
};

module.exports = { configureSocket };
