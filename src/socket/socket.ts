import { Server, Socket } from 'socket.io';

export function initializeSocket(io: Server) {
  const customerNamespace = io.of('/customer');

  customerNamespace.on('connection', (socket: Socket) => {
    socket.on('joinCustomerRoom', (customerId: string) => {
      socket.join(customerId);
    });

    socket.on(
      'agentLocation',
      ({
        customerId,
        lat,
        lng,
        speed,
      }: {
        customerId: string;
        lat: number;
        lng: number;
        speed?: number;
      }) => {
        customerNamespace.to(customerId).emit('locationUpdate', {
          lat,
          lng,
          speed: speed || 0,
          timestamp: Date.now(),
        });
        console.log(`Location: ${lat}, ${lng}, Speed: ${speed || 0} km/h`);
      }
    );

    socket.on('agentDisconnect', (customerId: string) => {
      customerNamespace.to(customerId).emit('agentDisconnected');
    });

    socket.on('disconnect', () => {
      console.log('Customer disconnected');
    });
  });
}
