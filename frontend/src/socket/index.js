import { io } from 'socket.io-client';
import keycloak from '../auth/keycloak';

const socket = io(import.meta.env.VITE_API_URL, {
  autoConnect: false,
  auth: (cb) => cb({ token: keycloak.token }),
});

export function joinAirport(airportId) {
  if (!socket.connected) socket.connect();
  socket.emit('join-airport', airportId);
}

export function leaveAirport(airportId) {
  socket.emit('leave-airport', airportId);
}

export default socket;
