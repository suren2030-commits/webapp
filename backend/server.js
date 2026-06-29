require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');

const flightsRouter   = require('./src/routes/flights');
const analyticsRouter = require('./src/routes/analytics');
const airportsRouter  = require('./src/routes/airports');
const gatesRouter     = require('./src/routes/gates');
const incidentsRouter = require('./src/routes/incidents');
const internalRouter  = require('./src/routes/internal');
const auditRouter     = require('./src/routes/audit');
const simulatorRouter  = require('./src/routes/simulator');
const movementsRouter  = require('./src/routes/movements');
const errorHandler     = require('./src/middleware/errorHandler');
const initSockets    = require('./src/sockets');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST'] },
});

app.set('io', io);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/airports',  airportsRouter);
app.use('/api/flights',   flightsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/gates',     gatesRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/internal',  internalRouter);
app.use('/api/audit',      auditRouter);
app.use('/api/simulator', simulatorRouter);
app.use('/api/movements', movementsRouter);

app.use(errorHandler);

initSockets(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`APOC backend listening on port ${PORT}`));
