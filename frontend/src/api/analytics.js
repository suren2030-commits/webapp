import client from './client';

export const getLiveStats = (params) =>
  client.get('/api/analytics/live-stats', { params }).then((r) => r.data);

export const getDelayTrends = (params) =>
  client.get('/api/analytics/delays', { params }).then((r) => r.data);
