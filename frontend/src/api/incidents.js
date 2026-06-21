import client from './client';

export const getIncidents    = (params) => client.get('/api/incidents', { params }).then(r => r.data);
export const getIncident     = (id)     => client.get(`/api/incidents/${id}`).then(r => r.data);
export const getStats        = (params) => client.get('/api/incidents/stats', { params }).then(r => r.data);
export const createIncident  = (data)   => client.post('/api/incidents', data).then(r => r.data);
export const updateIncident  = (id, data) => client.patch(`/api/incidents/${id}`, data).then(r => r.data);
export const addUpdate       = (id, data) => client.post(`/api/incidents/${id}/updates`, data).then(r => r.data);
