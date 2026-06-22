const router = require('express').Router();

// Called by simulator to broadcast real-time events to socket.io rooms.
// Only reachable within the cluster (not exposed via external ingress path).
router.post('/broadcast', (req, res) => {
  const io = req.app.get('io');
  const { airport_id, event, data } = req.body;
  if (!airport_id || !event) return res.status(400).json({ error: 'airport_id and event required' });
  io.to(`airport:${airport_id}`).emit(event, data);
  res.json({ ok: true });
});

module.exports = router;
