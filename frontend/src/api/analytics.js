import client from './client';

export const getLiveStats          = (p) => client.get('/api/analytics/live-stats',         { params: p }).then(r => r.data);
export const getAirportComparison  = (p) => client.get('/api/analytics/airport-comparison', { params: p }).then(r => r.data);
export const getDelayTrends        = (p) => client.get('/api/analytics/delays',             { params: p }).then(r => r.data);
export const getKpiSnapshots       = (p) => client.get('/api/analytics/kpi',                { params: p }).then(r => r.data);
export const getFlightEvents       = (p) => client.get('/api/analytics/flight-events',      { params: p }).then(r => r.data);
export const getResourceUtil       = (p) => client.get('/api/analytics/utilization',        { params: p }).then(r => r.data);
export const getAirlinePerformance = (p) => client.get('/api/analytics/airlines',           { params: p }).then(r => r.data);
export const getDelayHeatmap       = (p) => client.get('/api/analytics/delay-heatmap',      { params: p }).then(r => r.data);
