import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { config } from './configs/config';
import {
  initializeCloudinary,
  initializeMongoDB,
  initializeRedis,
} from './configs/initializeConnection';
import { nodeClient } from './configs/redis';

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: 'https://www.devmun.xyz',
    // origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// io.use((socket, next) => {
//   const cookieHeader = socket.handshake.headers.cookie;
//   if (!cookieHeader) return next(new Error('Unauthorized'));
//   next();
// });

io.on('connection', (socket) => {
  socket.on('joinCustomerRoom', async (customerId) => {
    socket.join(customerId);

    const agentLocation = await nodeClient.get(`agent:${customerId}`);
    if (agentLocation) {
      const location = JSON.parse(agentLocation);
      io.to(customerId).emit('locationUpdate', location);
    }
  });

  socket.on('agentLocation', async ({ customerId, lat, lng }) => {
    await nodeClient.setEx(
      `agent:${customerId}`,
      3600,
      JSON.stringify({ lat, lng })
    );
    io.to(customerId).emit('locationUpdate', { lat, lng });

    console.log(lat);
  });

  socket.on('agentDisconnect', async (customerId) => {
    await nodeClient.del(`agent:${customerId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Utility: Graceful shutdown
async function gracefulShutdown(server: http.Server, signal: string) {
  console.log(`\n${signal} signal received: Closing HTTP server...`);

  // Close server
  server.close(async () => {
    console.log('✅ HTTP server closed 🛑');

    // Disconnect Redis clients
    try {
      await nodeClient.quit();
      console.log('✅ Node Redis client disconnected 🔌');
    } catch (error) {
      console.error(
        '❌ Error disconnecting Node Redis client 🔌:',
        (error as Error).message
      );
    }

    process.exit(0);
  });
}

// Initialize MongoDB, Redis, Cloudinary, etc.
(async function initializeApplication() {
  try {
    await initializeMongoDB();
    await initializeRedis();
    await initializeCloudinary();
  } catch (error) {
    console.error(
      '❌ Application Initialization Failed 💥:',
      (error as Error).message
    );
    process.exit(1);
  }
})();

httpServer.listen(Number(config.PORT), () => {
  console.log(
    `🚀 Auth server is running on port ${config.PORT} in ${config.NODE_ENV}`
  );
});

// Graceful shutdown on termination signals
['SIGINT', 'SIGTERM'].forEach((signal) =>
  process.on(signal, () => gracefulShutdown(httpServer, signal))
);

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('❌ UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('❌ UNHANDLED PROMISE REJECTION 💥:', err.message);
  process.exit(1);
});
