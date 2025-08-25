import { Server } from 'socket.io';
import { nodeClient } from '../configs/redis';

export async function liveLocationSocket(io: Server) {
  const agentNamespace = io.of('/agent');
  const redisSubscriber = nodeClient.duplicate();
  await redisSubscriber.connect();

  await redisSubscriber.subscribe('locationsChannel', (message: string) => {
    const data = JSON.parse(message);
    agentNamespace.emit('locationUpdate', data);
  });

  agentNamespace.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on(
      'updateLocation',
      async (data: {
        id: string;
        name: string;
        vehicleType: string;
        location: {
          lat: number;
          lng: number;
        };
      }) => {
        await nodeClient.hSet(
          'deliveryLocations',
          data.id,
          JSON.stringify({
            name: data.name,
            vehicleType: data.vehicleType,
            location: data.location,
          })
        );

        await nodeClient.publish(
          'locationsChannel',
          JSON.stringify({
            id: data.id,
            name: data.name,
            vehicleType: data.vehicleType,
            location: data.location,
          })
        );
      }
    );

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}
