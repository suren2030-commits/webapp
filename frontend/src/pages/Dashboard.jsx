import { useEffect, useState, useCallback } from 'react';
import { Row, Col, Card, Button, Select, Space, Typography, Spin, Progress, Alert } from 'antd';
import {
  ReloadOutlined, RocketOutlined, CheckCircleOutlined, ClockCircleOutlined,
  CloseCircleOutlined, ThunderboltOutlined, FieldTimeOutlined, CarOutlined,
  TeamOutlined, AlertOutlined, ApartmentOutlined, SafetyCertificateOutlined,
  HourglassOutlined, FireOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getLiveStats, getDelayTrends, getKpiSnapshots, getAirportComparison, getDelayHeatmap } from '../api/analytics';
import client from '../api/client';
import useAppStore from '../store/useAppStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const DELAY_COLORS = {
  atc:     '#722ed1',
  airline: '#1677ff',
  airport: '#fa8c16',
  weather: '#52c41a',
  other:   '#8c8c8c',
};

const KPI_STYLES = [
  // Row 1 — primary
  { gradient: 'linear-gradient(135deg,#1890ff,#096dd9)', icon: <RocketOutlined /> },
  { gradient: 'linear-gradient(135deg,#52c41a,#237804)', icon: <CheckCircleOutlined /> },
  { gradient: 'linear-gradient(135deg,#13c2c2,#006d75)', icon: <CheckCircleOutlined /> },
  { gradient: 'linear-gradient(135deg,#fa8c16,#d46b08)', icon: <ClockCircleOutlined /> },
  { gradient: 'linear-gradient(135deg,#722ed1,#391085)', icon: <ThunderboltOutlined /> },
  { gradient: 'linear-gradient(135deg,#f5222d,#a8071a)', icon: <CloseCircleOutlined /> },
  // Row 2 — secondary
  { gradient: 'linear-gradient(135deg,#2f54eb,#10239e)', icon: <TeamOutlined /> },
  { gradient: 'linear-gradient(135deg,#d46b08,#873800)', icon: <HourglassOutlined /> },
  { gradient: 'linear-gradient(135deg,#08979c,#00474f)', icon: <HourglassOutlined /> },
  { gradient: 'linear-gradient(135deg,#08979c,#00474f)', icon: <ApartmentOutlined /> },
  { gradient: 'linear-gradient(135deg,#d4380d,#871400)', icon: <AlertOutlined /> },
  { gradient: 'linear-gradient(135deg,#389e0d,#135200)', icon: <SafetyCertificateOutlined /> },
];

function KpiCard({ title, value, suffix = '', styleIdx, sub }) {
  const s = KPI_STYLES[styleIdx];
  return (
    <div style={{
      background: s.gradient,
      borderRadius: 12,
      padding: '18px 20px',
      color: '#fff',
      minHeight: 100,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
      position: 'relative',
      overflow: 'hidden',
      height: '100%',
    }}>
      <div style={{ position: 'absolute', right: 14, top: 14, fontSize: 36, opacity: 0.15 }}>
        {s.icon}
      </div>
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500 }}>{title}</Text>
      <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, marginTop: 6 }}>
        {value ?? '—'}
        {value != null && <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 3 }}>{suffix}</span>}
      </div>
      {sub && <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 4 }}>{sub}</Text>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(20,20,30,0.92)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 12,
    }}>
      <div style={{ marginBottom: 4, color: 'rgba(255,255,255,0.6)' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color || '#fff' }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(p.value % 1 ? 1 : 0) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

const AIRPORT_COLORS = { MAA: '#1677ff', BLR: '#52c41a', DEL: '#722ed1', BOM: '#fa8c16' };

export default function Dashboard() {
  const { airportId, setAirport } = useAppStore();
  const [airports, setAirports]         = useState([]);
  const [stats, setStats]               = useState(null);
  const [delays, setDelays]             = useState([]);
  const [hourlyKpi, setHourlyKpi]       = useState([]);
  const [dailyKpi, setDailyKpi]         = useState([]);
  const [comparison, setComparison]     = useState([]);
  const [criticalInc, setCriticalInc]   = useState([]);
  const [heatmap, setHeatmap]           = useState([]);
  const [loading, setLoading]           = useState(false);
  const [lastUpdated, setLastUpdated]   = useState(null);

  useEffect(() => {
    client.get('/api/airports').then(r => setAirports(r.data)).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params    = airportId ? { airport_id: airportId } : {};
    const yesterday = dayjs().subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss');
    const dayStart  = dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss');

    const [statsRes, delaysRes, hourlyRes, dailyRes, compRes, incRes, heatmapRes] = await Promise.allSettled([
      getLiveStats(params),
      getDelayTrends({ ...params, group_by: 'day' }),
      getKpiSnapshots({ ...params, period_type: 'hourly', from: dayStart, limit: 24 }),
      getKpiSnapshots({ ...params, period_type: 'daily',  from: yesterday, limit: 7 }),
      getAirportComparison({}),
      client.get('/api/incidents', { params: { severity: 'critical', status: 'open', limit: 5, ...params } }).then(r => r.data),
      getDelayHeatmap(params),
    ]);

    if (statsRes.status  === 'fulfilled') setStats(statsRes.value);
    if (delaysRes.status === 'fulfilled') setDelays(delaysRes.value);
    if (hourlyRes.status === 'fulfilled') setHourlyKpi([...(hourlyRes.value || [])].reverse());
    if (dailyRes.status  === 'fulfilled') setDailyKpi([...(dailyRes.value  || [])].reverse());
    if (compRes.status    === 'fulfilled') setComparison(compRes.value || []);
    if (incRes.status     === 'fulfilled') setCriticalInc(incRes.value?.data || []);
    if (heatmapRes.status === 'fulfilled') setHeatmap(heatmapRes.value || []);

    setLastUpdated(dayjs());
    setLoading(false);
  }, [airportId]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const otp      = Number(stats?.otp_percentage ?? 0);
  const depOtp   = Number(stats?.departure_otp_pct ?? 0);
  const arrOtp   = Number(stats?.arrival_otp_pct  ?? 0);
  const otpColor = otp >= 85 ? '#52c41a' : otp >= 70 ? '#fa8c16' : '#f5222d';

  const delayByCategory = delays.reduce((acc, row) => {
    const cat = row.delay_cause_category || 'other';
    const ex  = acc.find(d => d.category === cat);
    if (ex) ex.count += Number(row.flight_count);
    else acc.push({ category: cat, count: Number(row.flight_count), fill: DELAY_COLORS[cat] || '#8c8c8c' });
    return acc;
  }, []).sort((a, b) => b.count - a.count);

  const statusPieData = stats ? [
    { name: 'Departed',  value: Number(stats.departed  || 0), fill: '#52c41a' },
    { name: 'Arrived',   value: Number(stats.arrived   || 0), fill: '#1677ff' },
    { name: 'Boarding',  value: Number(stats.boarding  || 0), fill: '#13c2c2' },
    { name: 'Scheduled', value: Number(stats.scheduled || 0), fill: '#8c8c8c' },
    { name: 'Delayed',   value: Number(stats.delayed   || 0), fill: '#fa8c16' },
    { name: 'Cancelled', value: Number(stats.cancelled || 0), fill: '#f5222d' },
  ].filter(d => d.value > 0) : [];

  const formatPax = (n) => {
    const num = Number(n || 0);
    return num >= 1000 ? `${(num / 1000).toFixed(1)}k` : String(num);
  };

  // Row 1 KPI cards
  const row1Cards = [
    { title: 'Total Flights',    value: Number(stats?.total_flights ?? 0),       suffix: '',     styleIdx: 0 },
    { title: 'Departure OTP',    value: depOtp,                                   suffix: '%',    styleIdx: 1, sub: `Target ≥ 85%` },
    { title: 'Arrival OTP',      value: arrOtp,                                   suffix: '%',    styleIdx: 2, sub: `Target ≥ 85%` },
    { title: 'Delayed',          value: Number(stats?.delayed ?? 0),              suffix: '',     styleIdx: 3 },
    { title: 'Boarding Now',     value: Number(stats?.boarding ?? 0),             suffix: '',     styleIdx: 4 },
    { title: 'Cancelled',        value: Number(stats?.cancelled ?? 0),            suffix: '',     styleIdx: 5 },
  ];

  // Row 2 KPI cards
  const row2Cards = [
    { title: 'Passengers Today',  value: formatPax(stats?.total_passengers),       suffix: '',     styleIdx: 6 },
    { title: 'Avg Dep Delay',     value: stats?.avg_departure_delay_min != null ? Number(stats.avg_departure_delay_min) : null, suffix: ' min', styleIdx: 7 },
    { title: 'Avg Arr Delay',     value: stats?.avg_arrival_delay_min   != null ? Number(stats.avg_arrival_delay_min)   : null, suffix: ' min', styleIdx: 8 },
    { title: 'Schedule Complete', value: Number(stats?.completed_pct ?? 0),         suffix: '%',    styleIdx: 9,  sub: `${Number(stats?.remaining_flights ?? 0)} flights remaining` },
    { title: 'Open Incidents',   value: Number(stats?.open_incidents ?? 0),         suffix: '',     styleIdx: 10, sub: stats?.critical_incidents ? `${stats.critical_incidents} critical` : undefined },
    { title: 'Remaining Today',  value: Number(stats?.remaining_flights ?? 0),      suffix: '',     styleIdx: 11, sub: 'scheduled + boarding + delayed' },
  ];

  return (
    <div style={{ background: '#f0f2f5', minHeight: '100%' }}>

      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Operations Dashboard</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {lastUpdated ? `Updated ${lastUpdated.format('HH:mm:ss')} · auto-refresh 30s` : 'Loading…'}
          </Text>
        </Col>
        <Col>
          <Space>
            <Select
              placeholder="All Airports"
              style={{ width: 240 }}
              value={airportId}
              onChange={(val, opt) => setAirport(val, opt?.iata, opt?.label)}
              options={airports.map(a => ({ value: a.id, label: `${a.iata_code} — ${a.name}`, iata: a.iata_code }))}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Refresh</Button>
          </Space>
        </Col>
      </Row>

      {/* Critical incident ribbon */}
      {criticalInc.length > 0 && (
        <Alert
          type="error"
          showIcon
          icon={<AlertOutlined />}
          style={{ marginBottom: 16, borderRadius: 10 }}
          message={
            <Space size={16} wrap>
              <Text strong style={{ color: '#a8071a' }}>CRITICAL INCIDENTS ACTIVE</Text>
              {criticalInc.map(i => (
                <span key={i.id} style={{
                  background: '#fff1f0', border: '1px solid #ffa39e',
                  borderRadius: 6, padding: '1px 8px', fontSize: 12, color: '#cf1322',
                }}>
                  {i.airport_iata} · {i.title}
                </span>
              ))}
            </Space>
          }
        />
      )}

      <Spin spinning={loading && !stats}>

        {/* KPI Row 1 */}
        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
          {row1Cards.map((c) => (
            <Col key={c.title} xs={12} sm={8} lg={4}>
              <KpiCard {...c} />
            </Col>
          ))}
        </Row>

        {/* KPI Row 2 */}
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          {row2Cards.map((c) => (
            <Col key={c.title} xs={12} sm={8} lg={4}>
              <KpiCard {...c} />
            </Col>
          ))}
        </Row>

        {/* Charts Row 1: 24-hr throughput + Status donut */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={16}>
            <Card
              title={<span style={{ fontWeight: 600 }}>24-Hour Throughput</span>}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>Flights / hour · OTP %</Text>}
              style={{ borderRadius: 12 }}
              bodyStyle={{ padding: '12px 16px' }}
            >
              {hourlyKpi.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>No hourly data</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={hourlyKpi} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="flightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#1677ff" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#1677ff" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="otpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#52c41a" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#52c41a" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="snapshot_time" tickFormatter={v => dayjs(v).format('HH:mm')} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="flights" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="otp" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area yAxisId="flights" type="monotone" dataKey="total_flights" name="Flights"
                      stroke="#1677ff" fill="url(#flightGrad)" strokeWidth={2} />
                    <Area yAxisId="otp" type="monotone" dataKey="otp_percentage" name="OTP %"
                      stroke="#52c41a" fill="url(#otpGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card
              title={<span style={{ fontWeight: 600 }}>Flight Status</span>}
              style={{ borderRadius: 12, height: '100%' }}
              bodyStyle={{ padding: '12px 8px' }}
            >
              {statusPieData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>No data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={statusPieData} cx="50%" cy="50%"
                        innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                        {statusPieData.map(e => <Cell key={e.name} fill={e.fill} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ padding: '0 8px' }}>
                    {statusPieData.map(d => (
                      <div key={d.name} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '3px 0', borderBottom: '1px solid #f5f5f5',
                      }}>
                        <Space size={6}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.fill, display: 'inline-block' }} />
                          <Text style={{ fontSize: 12 }}>{d.name}</Text>
                        </Space>
                        <Text strong style={{ fontSize: 12 }}>{d.value}</Text>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </Col>
        </Row>

        {/* Charts Row 2: Airport Comparison */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card
              title={<span style={{ fontWeight: 600 }}>Airport Comparison — Today</span>}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>MAA · BLR · DEL · BOM</Text>}
              style={{ borderRadius: 12 }}
              bodyStyle={{ padding: '16px' }}
            >
              {comparison.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No comparison data</div>
              ) : (
                <Row gutter={[16, 16]}>
                  {/* Grouped bar chart */}
                  <Col xs={24} lg={14}>
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={comparison} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="iata_code" tick={{ fontSize: 13, fontWeight: 600 }} />
                        <YAxis yAxisId="flights" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="otp" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar yAxisId="flights" dataKey="total_flights" name="Total Flights" fill="#1677ff" radius={[4,4,0,0]} />
                        <Bar yAxisId="flights" dataKey="delayed"       name="Delayed"       fill="#fa8c16" radius={[4,4,0,0]} />
                        <Bar yAxisId="flights" dataKey="cancelled"     name="Cancelled"     fill="#f5222d" radius={[4,4,0,0]} />
                        <Line yAxisId="otp" type="monotone" dataKey="otp_pct" name="OTP %" stroke="#52c41a" strokeWidth={2.5} dot={{ r: 5, fill: '#52c41a' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Col>

                  {/* Airport stat cards */}
                  <Col xs={24} lg={10}>
                    <Row gutter={[10, 10]}>
                      {comparison.map(ap => {
                        const color = AIRPORT_COLORS[ap.iata_code] || '#8c8c8c';
                        const otp   = Number(ap.otp_pct || 0);
                        return (
                          <Col key={ap.iata_code} span={12}>
                            <div style={{
                              border: `2px solid ${color}40`,
                              borderLeft: `4px solid ${color}`,
                              borderRadius: 10,
                              padding: '12px 14px',
                              background: '#fff',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <Text strong style={{ fontSize: 18, color }}>{ap.iata_code}</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>{ap.city}</Text>
                              </div>
                              <div style={{ fontSize: 12, marginBottom: 4 }}>
                                <span style={{ color: '#595959' }}>{Number(ap.total_flights)} flights</span>
                                {Number(ap.delayed) > 0 && (
                                  <span style={{ marginLeft: 8, color: '#fa8c16' }}>· {Number(ap.delayed)} delayed</span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Progress
                                  percent={otp}
                                  size="small"
                                  showInfo={false}
                                  strokeColor={otp >= 85 ? '#52c41a' : otp >= 70 ? '#fa8c16' : '#f5222d'}
                                  style={{ flex: 1, margin: 0 }}
                                />
                                <Text strong style={{ fontSize: 13, color: otp >= 85 ? '#52c41a' : otp >= 70 ? '#fa8c16' : '#f5222d', minWidth: 42 }}>
                                  {otp}%
                                </Text>
                              </div>
                              <Text type="secondary" style={{ fontSize: 10 }}>
                                {Number(ap.total_passengers).toLocaleString()} pax · {Number(ap.boarding)} boarding
                              </Text>
                            </div>
                          </Col>
                        );
                      })}
                    </Row>
                  </Col>
                </Row>
              )}
            </Card>
          </Col>
        </Row>

        {/* Charts Row 3: Delay causes + 7-day OTP */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={12}>
            <Card
              title={<span style={{ fontWeight: 600 }}>Delays by Cause</span>}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>Last 7 days</Text>}
              style={{ borderRadius: 12 }}
              bodyStyle={{ padding: '12px 16px' }}
            >
              {delayByCategory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>No delay data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={delayByCategory} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="category" type="category" tick={{ fontSize: 12 }} width={60} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Flights" radius={[0, 6, 6, 0]}>
                        {delayByCategory.map(e => <Cell key={e.category} fill={e.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <Row gutter={8} style={{ marginTop: 8 }}>
                    {delayByCategory.map(d => (
                      <Col key={d.category}>
                        <div style={{
                          background: d.fill + '20', border: `1px solid ${d.fill}40`,
                          borderRadius: 6, padding: '2px 10px', fontSize: 11, color: d.fill, fontWeight: 600,
                        }}>
                          {d.category}: {d.count}
                        </div>
                      </Col>
                    ))}
                  </Row>
                </>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title={<span style={{ fontWeight: 600 }}>7-Day OTP Trend</span>}
              extra={
                <div style={{
                  background: otp >= 85 ? '#f6ffed' : otp >= 70 ? '#fff7e6' : '#fff1f0',
                  border: `1px solid ${otpColor}40`,
                  borderRadius: 6, padding: '2px 10px', fontSize: 13, fontWeight: 700, color: otpColor,
                }}>
                  Today: {otp}%
                </div>
              }
              style={{ borderRadius: 12 }}
              bodyStyle={{ padding: '12px 16px' }}
            >
              {dailyKpi.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>No trend data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={dailyKpi} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="snapshot_time" tickFormatter={v => dayjs(v).format('MMM D')} tick={{ fontSize: 11 }} />
                      <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="otp_percentage" name="OTP %"
                        stroke={otpColor} strokeWidth={2.5} dot={{ fill: otpColor, r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  <Row gutter={12} style={{ marginTop: 12 }}>
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 11 }}>Target (85%)</Text>
                      <Progress percent={85} showInfo={false} strokeColor="#52c41a" size="small" style={{ margin: '4px 0 0' }} />
                    </Col>
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 11 }}>Current</Text>
                      <Progress percent={otp} showInfo={false} strokeColor={otpColor} size="small" style={{ margin: '4px 0 0' }} />
                    </Col>
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 11 }}>Dep OTP</Text>
                      <Progress
                        percent={depOtp}
                        showInfo={false}
                        strokeColor={depOtp >= 85 ? '#52c41a' : depOtp >= 70 ? '#fa8c16' : '#f5222d'}
                        size="small"
                        style={{ margin: '4px 0 0' }}
                      />
                    </Col>
                  </Row>
                </>
              )}
            </Card>
          </Col>
        </Row>

        {/* Row 4: Peak hour + Runway + Operational stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={8}>
            <Card
              title={<span style={{ fontWeight: 600 }}>Operational Metrics</span>}
              style={{ borderRadius: 12, height: '100%' }}
              bodyStyle={{ padding: '16px' }}
            >
              {[
                { label: 'Peak Hour Flights',     value: stats?.peak_hour_flights ?? 0,   suffix: ' flights',  color: '#1677ff', icon: <FireOutlined /> },
                { label: 'Runway Movements / hr', value: stats?.runway_movements_hr ?? 0, suffix: ' movements',color: '#722ed1', icon: <RocketOutlined /> },
                { label: 'Combined OTP',           value: otp,                             suffix: '%',         color: otpColor,  icon: <CheckCircleOutlined /> },
                { label: 'Boarding Now',           value: stats?.boarding ?? 0,            suffix: ' flights',  color: '#13c2c2', icon: <ThunderboltOutlined /> },
              ].map(item => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '1px solid #f5f5f5',
                }}>
                  <Space>
                    <span style={{ color: item.color, fontSize: 16 }}>{item.icon}</span>
                    <Text style={{ fontSize: 13 }}>{item.label}</Text>
                  </Space>
                  <Text strong style={{ fontSize: 16, color: item.color }}>
                    {Number(item.value)}{item.suffix}
                  </Text>
                </div>
              ))}
            </Card>
          </Col>

          <Col xs={24} lg={16}>
            <Card
              title={<span style={{ fontWeight: 600 }}>OTP Progress — All Airports</span>}
              style={{ borderRadius: 12, height: '100%' }}
              bodyStyle={{ padding: '16px' }}
            >
              {comparison.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No data</div>
              ) : (
                <Row gutter={[16, 16]}>
                  {comparison.map(ap => {
                    const color = AIRPORT_COLORS[ap.iata_code] || '#8c8c8c';
                    const otp   = Number(ap.otp_pct || 0);
                    const slaColor = otp >= 85 ? '#52c41a' : otp >= 70 ? '#fa8c16' : '#f5222d';
                    return (
                      <Col key={ap.iata_code} xs={24} sm={12}>
                        <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                          <Space size={6}>
                            <span style={{
                              background: color, color: '#fff', borderRadius: 4,
                              padding: '1px 7px', fontSize: 12, fontWeight: 700,
                            }}>{ap.iata_code}</span>
                            <Text type="secondary" style={{ fontSize: 12 }}>{ap.city}</Text>
                          </Space>
                          <Text strong style={{ color: slaColor }}>{otp}%</Text>
                        </div>
                        <Progress
                          percent={otp}
                          showInfo={false}
                          strokeColor={slaColor}
                          trailColor="#f0f0f0"
                          size="small"
                          style={{ margin: 0 }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {Number(ap.completed)} completed · {Number(ap.delayed)} delayed · {Number(ap.total_passengers).toLocaleString()} pax
                        </Text>
                      </Col>
                    );
                  })}
                </Row>
              )}
            </Card>
          </Col>
        </Row>

        {/* Delay Heatmap — Hour of Day */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card
              title={<span style={{ fontWeight: 600 }}>Delay Heatmap — Hour of Day</span>}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>Avg delay (min) · Delayed flights per hour today</Text>}
              style={{ borderRadius: 12 }}
              bodyStyle={{ padding: '12px 16px' }}
            >
              {heatmap.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No data today</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={heatmap} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour_of_day" tickFormatter={h => `${String(h).padStart(2,'0')}:00`} tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="delay" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="delay" dataKey="avg_delay_min" name="Avg Delay (min)" radius={[4,4,0,0]}>
                      {heatmap.map(row => {
                        const d = Number(row.avg_delay_min || 0);
                        const fill = d >= 30 ? '#f5222d' : d >= 15 ? '#fa8c16' : d >= 5 ? '#fadb14' : '#52c41a';
                        return <Cell key={row.hour_of_day} fill={fill} />;
                      })}
                    </Bar>
                    <Bar yAxisId="count" dataKey="delayed_count" name="Delayed Flights" fill="#fa8c16" opacity={0.4} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>
        </Row>

      </Spin>
    </div>
  );
}
