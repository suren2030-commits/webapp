import client from './client';

export const getFlights = (params) =>
  client.get('/api/flights', { params }).then((r) => r.data);

export const getFlight = (id) =>
  client.get(`/api/flights/${id}`).then((r) => r.data);

export const updateFlightStatus = (id, data) =>
  client.patch(`/api/flights/${id}/status`, data).then((r) => r.data);
