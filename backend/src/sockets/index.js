function initSockets(io) {
  io.on('connection', (socket) => {
    socket.on('join-airport', (airportId) => {
      socket.join(`airport:${airportId}`);
    });

    socket.on('leave-airport', (airportId) => {
      socket.leave(`airport:${airportId}`);
    });
  });
}

module.exports = initSockets;
