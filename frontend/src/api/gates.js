import client from './client';

export const getGates      = (params) => client.get('/api/gates', { params }).then(r => r.data);
export const getTerminals  = (params) => client.get('/api/gates/terminals', { params }).then(r => r.data);
export const assignFlight  = (gateId, data) => client.post(`/api/gates/${gateId}/assign`, data).then(r => r.data);
export const updateAssignment = (id, data) => client.patch(`/api/gates/assignments/${id}`, data).then(r => r.data);
