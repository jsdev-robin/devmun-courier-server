/* eslint-disable @typescript-eslint/no-unused-vars */
import { Server, Socket } from 'socket.io';

interface AgentInfo {
  socketId: string;
  customerId: string;
  location?: {
    lat: number;
    lng: number;
    speed: number;
    timestamp: number;
  };
}

const onlineAgents = new Map<string, AgentInfo>();

export function initializeSocket(io: Server) {
  const customerNamespace = io.of('/customer');

  customerNamespace.on('connection', (socket: Socket) => {
    socket.on(
      'agentOnline',
      (data: { agentId: string; customerId: string; location?: unknown }) => {
        const location =
          data.location &&
          typeof data.location === 'object' &&
          'lat' in data.location &&
          'lng' in data.location
            ? (data.location as { lat: number; lng: number; speed?: number })
            : undefined;

        onlineAgents.set(data.agentId, {
          socketId: socket.id,
          customerId: data.customerId,
          location: location
            ? {
                lat: location.lat,
                lng: location.lng,
                speed: location.speed || 0,
                timestamp: Date.now(),
              }
            : undefined,
        });

        socket.to(data.customerId).emit('agentOnline', {
          agentId: data.agentId,
          location: onlineAgents.get(data.agentId)?.location,
        });

        const agentsForCustomer = Array.from(onlineAgents.entries())
          .filter(([_, agent]) => agent.customerId === data.customerId)
          .map(([agentId, agent]) => ({ agentId, ...agent }));

        customerNamespace
          .to(data.customerId)
          .emit('allOnlineAgents', agentsForCustomer);
      }
    );

    socket.on('joinCustomerRoom', (customerId: string) => {
      socket.join(customerId);

      const agentsForCustomer = Array.from(onlineAgents.entries())
        .filter(([_, agent]) => agent.customerId === customerId)
        .map(([agentId, agent]) => ({ agentId, ...agent }));

      socket.emit('allOnlineAgents', agentsForCustomer);
    });

    socket.on(
      'agentLocation',
      (data: {
        agentId: string;
        customerId: string;
        lat: number;
        lng: number;
        speed?: number;
      }) => {
        if (onlineAgents.has(data.agentId)) {
          const agent = onlineAgents.get(data.agentId);
          if (agent) {
            agent.location = {
              lat: data.lat,
              lng: data.lng,
              speed: data.speed || 0,
              timestamp: Date.now(),
            };
            onlineAgents.set(data.agentId, agent);
          }
        }

        customerNamespace.to(data.customerId).emit('locationUpdate', {
          agentId: data.agentId,
          lat: data.lat,
          lng: data.lng,
          speed: data.speed || 0,
          timestamp: Date.now(),
        });
      }
    );

    socket.on(
      'agentDisconnect',
      (data: { agentId: string; customerId: string }) => {
        onlineAgents.delete(data.agentId);
        customerNamespace
          .to(data.customerId)
          .emit('agentOffline', { agentId: data.agentId });
      }
    );

    socket.on('disconnect', () => {
      for (const [agentId, agent] of onlineAgents.entries()) {
        if (agent.socketId === socket.id) {
          onlineAgents.delete(agentId);
          customerNamespace
            .to(agent.customerId)
            .emit('agentOffline', { agentId });
        }
      }
    });
  });
}
