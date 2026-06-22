import client from './client';

export const getAuditLog = (p) => client.get('/api/audit', { params: p }).then(r => r.data);
