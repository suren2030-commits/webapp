import { useEffect, useState, useCallback } from 'react';
import {
  Row, Col, Card, Button, Select, Space, Typography, Spin, Progress,
  Alert, Tabs, Statistic, theme,
} from 'antd';
import {
  ReloadOutlined, RocketOutlined, CheckCircleOutlined, ClockCircleOutlined,
  CloseCircleOutlined, ThunderboltOutlined, TeamOutlined, AlertOutlined,
  ApartmentOutlined, SafetyCertificateOutlined, HourglassOutlined,
  FireOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  getLiveStats, getDelayTrends, getKpiSnapshots,
  getAirportComparison, getDelayHeatmap,
} from '../api/analytics';
import client from '../api/client';
import useAppStore from '../store/useAppStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

/* ─── colour maps ─────────────────────────────────── */
const DELAY_COLORS = {
  atc: '#722ed1', airline: '#1677ff', airport: '#fa8c16',
  weather: '#52c41a', other: '#8c8c8c',
};
const AIRPORT_COLORS = { MAA: '#1677ff', BLR: '#52c41a', DEL: '#722ed1', BOM: '#fa8c16' };

const KPI_STYLES = [
  { gradient: 'linear-gradient(135deg,#1890ff,#096dd9)', icon: <RocketOutlined /> },
  { gradient: 'linear-gradient(135deg,#52c41a,#237804)', icon: <CheckCircleOutlined /> },
  { gradient: 'linear-gradient(135deg,#13c2c2,#006d75)', icon: <CheckCircleOutlined /> },
  { gradient: 'linear-gradient(135deg,#fa8c16,#d46b08)', icon: <ClockCircleOutlined /> },
  { gradient: 'linear-gradient(135deg,#722ed1,#391085)', icon: <ThunderboltOutlined /> },
  { gradient: 'linear-gradient(135deg,#f5222d,#a8071a)', icon: <CloseCircleOutlined /> },
  { gradient: 'linear-gradient(135deg,#2f54eb,#10239e)', icon: <TeamOutlined /> },
  { gradient: 'linear-gradient(135deg,#d46b08,#873800)', icon: <HourglassOutlined /> },
  { gradient: 'linear-gradient(135deg,#08979c,#00474f)', icon: <HourglassOutlined /> },
  { gradient: 'linear-gradient(135deg,#531dab,#22075e)', icon: <ApartmentOutlined /> },
  { gradient: 'linear-gradient(135deg,#d4380d,#871400)', icon: <AlertOutlined /> },
  { gradient: 'linear-gradient(135deg,#389e0d,#135200)', icon: <SafetyCertificateOutlined /> },
];

/* ─── sub-components ──────────────────────────────── */
function KpiCard({ title, value, suffix = '', styleIdx, sub }) {
  const s = KPI_STYLES[styleIdx];
  return (
    <div style={{
      background: s.gradient, borderRadius: 14, padding: '18px 20px',
      color: '#fff', minHeight: 100,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      boxShadow: '0 4px 20px rgba(0,0,0,0.18)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', right: 12, top: 12, fontSize: 40, opacity: 0.12 }}>
        {s.icon}
      </div>
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>
        {title.toUpperCase()}
      </Text>
      <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, marginTop: 8 }}>
        {value ?? '—'}
        {value != null && <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 3 }}>{suffix}</span>}
      </div>
      {sub && (
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 6 }}>{sub}</Text>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(15,20,35,0.95)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12,
    }}>
      <div style={{ marginBottom: 5, color: 'rgba(255,255,255,0.5)' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color || '#fff' }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(p.value % 1 ? 1 : 0) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

function SectionCard({ title, extra, children, minHeight }) {
  return (
    <Card
      title={<span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span>}
      extra={extra}
      style={{ borderRadius: 14, height: '100%' }}
      styles={{ body: { padding: '14px 16px', minHeight } }}
    >
      {children}
    </Card>
  );
}

/* ─── main component ──────────────────────────────── */
export default function Dashboard() {
  const { airportId, setAirport } = useAppStore();
  const { token } = theme.useToken();

  const [airports, setAirports]   = useState([]);
  const [stats, setStats]         = useState(null);
  const [delays, setDelays]       = useState([]);
  const [hourlyKpi, setHourlyKpi] = useState([]);
  const [dailyKpi, setDailyKpi]   = useState([]);
  const [comparison, setComparison] = useState([]);
  const [criticalInc, setCriticalInc] = useState([]);
  const [heatmap, setHeatmap]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    client.get('/api/airports').then(r => setAirports(r.data)).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params    = airportId ? { airport_id: airportId } : {};
    const yesterday = dayjs().subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss');
    const dayStart  = dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss');

    const [statsRes, delaysRes, hourlyRes, dailyRes, compRes, incRes, heatmapRes] =
      await Promise.allSettled([
        getLiveStats(params),
        getDelayTrends({ ...params, group_by: 'day' }),
        getKpiSnapshots({ ...params, period_type: 'hourly', from: dayStart, limit: 24 }),
        getKpiSnapshots({ ...params, period_type: 'daily',  from: yesterday, limit: 7 }),
        getAirportComparison({}),
        client.get('/api/incidents', {
          params: { severity: 'critical', status: 'open', limit: 5, ...params },
        }).then(r => r.data),
        getDelayHeatmap(params),
      ]);

    if (statsRes.status    === 'fulfilled') setStats(statsRes.value);
    if (delaysRes.status   === 'fulfilled') setDelays(delaysRes.value);
    if (hourlyRes.status   === 'fulfilled') setHourlyKpi([...(hourlyRes.value || [])].reverse());
    if (dailyRes.status    === 'fulfilled') setDailyKpi([...(dailyRes.value  || [])].reverse());
    if (compRes.status     === 'fulfilled') setComparison(compRes.value || []);
    if (incRes.status      === 'fulfilled') setCriticalInc(incRes.value?.data || []);
    if (heatmapRes.status  === 'fulfilled') setHeatmap(heatmapRes.value || []);

    setLastUpdated(dayjs());
    setLoading(false);
  }, [airportId]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  /* ── derived values ── */
  const otp      = Number(stats?.otp_percentage   ?? 0);
  const depOtp   = Number(stats?.departure_otp_pct ?? 0);
  const arrOtp   = Number(stats?.arrival_otp_pct  ?? 0);
  const otpColor = otp >= 85 ? '#52c41a' : otp >= 70 ? '#fa8c16' : '#f5222d';

  const formatPax = (n) => {
    const num = Number(n || 0);
    return num >= 1000 ? `${(num / 1000).toFixed(1)}k` : String(num);
  };

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

  /* ── KPI card data ── */
  const row1 = [
    { title: 'Total Flights',  value: Number(stats?.total_flights  ?? 0), suffix: '',    styleIdx: 0 },
    { title: 'Departure OTP',  value: depOtp,                              suffix: '%',   styleIdx: 1, sub: 'Target ≥ 85%' },
    { title: 'Arrival OTP',    value: arrOtp,                              suffix: '%',   styleIdx: 2, sub: 'Target ≥ 85%' },
    { title: 'Delayed',        value: Number(stats?.delayed        ?? 0), suffix: '',    styleIdx: 3 },
    { title: 'Boarding Now',   value: Number(stats?.boarding       ?? 0), suffix: '',    styleIdx: 4 },
    { title: 'Cancelled',      value: Number(stats?.cancelled      ?? 0), suffix: '',    styleIdx: 5 },
  ];
  const row2 = [
    { title: 'Passengers',     value: formatPax(stats?.total_passengers),                suffix: '',    styleIdx: 6 },
    { title: 'Avg Dep Delay',  value: stats?.avg_departure_delay_min != null ? Number(stats.avg_departure_delay_min) : null, suffix: ' min', styleIdx: 7 },
    { title: 'Avg Arr Delay',  value: stats?.avg_arrival_delay_min   != null ? Number(stats.avg_arrival_delay_min)   : null, suffix: ' min', styleIdx: 8 },
    { title: 'Schedule Done',  value: Number(stats?.completed_pct ?? 0),                 suffix: '%',   styleIdx: 9,  sub: `${Number(stats?.remaining_flights ?? 0)} remaining` },
    { title: 'Open Incidents', value: Number(stats?.open_incidents ?? 0),                suffix: '',    styleIdx: 10, sub: stats?.critical_incidents ? `${stats.critical_incidents} critical` : undefined },
    { title: 'Remaining Today',value: Number(stats?.remaining_flights ?? 0),             suffix: '',    styleIdx: 11 },
  ];

  /* ════════════════════════════════════════════════ */
  /* TAB 1 — OVERVIEW                                */
  /* ════════════════════════════════════════════════ */
  const overviewTab = (
    <Spin spinning={loading && !stats}>
      {/* Critical ribbon */}
      {criticalInc.length > 0 && (
        <Alert
          type="error" showIcon icon={<AlertOutlined />}
          style={{ marginBottom: 16, borderRadius: 12, border: '1px solid #ffa39e' }}
          message={
            <Space size={16} wrap>
              <Text strong style={{ color: '#a8071a', letterSpacing: 0.5 }}>
                CRITICAL INCIDENTS ACTIVE
              </Text>
              {criticalInc.map(i => (
                <span key={i.id} style={{
                  background: '#fff1f0', border: '1px solid #ffa39e',
                  borderRadius: 6, padding: '2px 10px', fontSize: 12, color: '#cf1322',
                }}>
                  {i.airport_iata} · {i.title}
                </span>
              ))}
            </Space>
          }
        />
      )}

      {/* KPI rows */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {row1.map(c => <Col key={c.title} xs={12} sm={8} lg={4}><KpiCard {...c} /></Col>)}
      </Row>
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {row2.map(c => <Col key={c.title} xs={12} sm={8} lg={4}><KpiCard {...c} /></Col>)}
      </Row>

      {/* Airport comparison */}
      <SectionCard
        title="Airport Comparison — Today"
        extra={<Text type="secondary" style={{ fontSize: 12 }}>MAA · BLR · DEL · BOM</Text>}
      >
        {comparison.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: token.colorTextTertiary }}>No comparison data</div>
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={14}>
              <ResponsiveContainer width="100%" height={230}>
                <ComposedChart data={comparison} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} />
                  <XAxis dataKey="iata_code" tick={{ fontSize: 13, fontWeight: 700 }} />
                  <YAxis yAxisId="flights" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="otp" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="flights" dataKey="total_flights" name="Total Flights" fill="#1677ff" radius={[4,4,0,0]} />
                  <Bar yAxisId="flights" dataKey="delayed"       name="Delayed"       fill="#fa8c16" radius={[4,4,0,0]} />
                  <Bar yAxisId="flights" dataKey="cancelled"     name="Cancelled"     fill="#f5222d" radius={[4,4,0,0]} />
                  <Line yAxisId="otp" type="monotone" dataKey="otp_pct" name="OTP %"
                    stroke="#52c41a" strokeWidth={2.5} dot={{ r: 5, fill: '#52c41a' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Col>
            <Col xs={24} lg={10}>
              <Row gutter={[10, 10]}>
                {comparison.map(ap => {
                  const color = AIRPORT_COLORS[ap.iata_code] || '#8c8c8c';
                  const o     = Number(ap.otp_pct || 0);
                  return (
                    <Col key={ap.iata_code} span={12}>
                      <div style={{
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderLeft: `4px solid ${color}`,
                        borderRadius: 10, padding: '14px 14px',
                        background: token.colorBgLayout,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text strong style={{ fontSize: 20, color }}>{ap.iata_code}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>{ap.city}</Text>
                        </div>
                        <div style={{ fontSize: 12, marginBottom: 6 }}>
                          <Text>{Number(ap.total_flights)} flights</Text>
                          {Number(ap.delayed) > 0 && (
                            <Text style={{ marginLeft: 8, color: '#fa8c16' }}>· {Number(ap.delayed)} delayed</Text>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Progress
                            percent={o} size="small" showInfo={false}
                            strokeColor={o >= 85 ? '#52c41a' : o >= 70 ? '#fa8c16' : '#f5222d'}
                            style={{ flex: 1, margin: 0 }}
                          />
                          <Text strong style={{ fontSize: 13, color: o >= 85 ? '#52c41a' : o >= 70 ? '#fa8c16' : '#f5222d', minWidth: 40 }}>
                            {o}%
                          </Text>
                        </div>
                        <Text type="secondary" style={{ fontSize: 10 }}>
                          {Number(ap.total_passengers).toLocaleString()} pax
                        </Text>
                      </div>
                    </Col>
                  );
                })}
              </Row>
            </Col>
          </Row>
        )}
      </SectionCard>
    </Spin>
  );

  /* ════════════════════════════════════════════════ */
  /* TAB 2 — FLIGHT OPS                              */
  /* ════════════════════════════════════════════════ */
  const opsTab = (
    <Spin spinning={loading && !stats}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {/* Operational metrics */}
        <Col xs={24} lg={8}>
          <SectionCard title="Live Operational Metrics" minHeight={280}>
            {[
              { label: 'Peak Hour Flights',     value: stats?.peak_hour_flights  ?? 0, suffix: ' flights',   color: '#1677ff', icon: <FireOutlined /> },
              { label: 'Runway Movements / hr', value: stats?.runway_movements_hr ?? 0, suffix: ' movements', color: '#722ed1', icon: <RocketOutlined /> },
              { label: 'Combined OTP',          value: otp,                             suffix: '%',          color: otpColor,  icon: <CheckCircleOutlined /> },
              { label: 'Boarding Now',          value: stats?.boarding ?? 0,            suffix: ' flights',   color: '#13c2c2', icon: <ThunderboltOutlined /> },
              { label: 'Arrived Today',         value: stats?.arrived  ?? 0,            suffix: '',           color: '#52c41a', icon: <ArrowDownOutlined /> },
              { label: 'Departed Today',        value: stats?.departed ?? 0,            suffix: '',           color: '#1677ff', icon: <ArrowUpOutlined /> },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 0', borderBottom: `1px solid ${token.colorBorderSecondary}`,
              }}>
                <Space size={8}>
                  <span style={{ color: item.color, fontSize: 15 }}>{item.icon}</span>
                  <Text style={{ fontSize: 13 }}>{item.label}</Text>
                </Space>
                <Text strong style={{ fontSize: 16, color: item.color }}>
                  {Number(item.value)}{item.suffix}
                </Text>
              </div>
            ))}
          </SectionCard>
        </Col>

        {/* OTP progress */}
        <Col xs={24} lg={16}>
          <SectionCard title="OTP Progress — All Airports" minHeight={280}>
            {comparison.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: token.colorTextTertiary }}>No data</div>
            ) : (
              <Row gutter={[16, 24]}>
                {comparison.map(ap => {
                  const color    = AIRPORT_COLORS[ap.iata_code] || '#8c8c8c';
                  const o        = Number(ap.otp_pct || 0);
                  const slaColor = o >= 85 ? '#52c41a' : o >= 70 ? '#fa8c16' : '#f5222d';
                  return (
                    <Col key={ap.iata_code} xs={24} sm={12}>
                      <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space size={6}>
                          <span style={{
                            background: color, color: '#fff', borderRadius: 6,
                            padding: '2px 9px', fontSize: 12, fontWeight: 700, letterSpacing: 1,
                          }}>{ap.iata_code}</span>
                          <Text type="secondary" style={{ fontSize: 12 }}>{ap.city}</Text>
                        </Space>
                        <Text strong style={{ color: slaColor, fontSize: 15 }}>{o}%</Text>
                      </div>
                      <Progress
                        percent={o} showInfo={false} strokeColor={slaColor}
                        trailColor={token.colorBgLayout} size="small" style={{ margin: 0 }}
                      />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {Number(ap.completed)} completed · {Number(ap.delayed)} delayed · {Number(ap.boarding)} boarding
                      </Text>
                    </Col>
                  );
                })}
              </Row>
            )}
          </SectionCard>
        </Col>
      </Row>

      {/* Delay heatmap */}
      <SectionCard
        title="Delay Heatmap — Hour of Day"
        extra={<Text type="secondary" style={{ fontSize: 12 }}>Avg delay (min) per hour · Color = severity</Text>}
      >
        {heatmap.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 50, color: token.colorTextTertiary }}>No data today</div>
        ) : (
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={heatmap} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} />
              <XAxis dataKey="hour_of_day" tickFormatter={h => `${String(h).padStart(2,'0')}:00`} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="delay" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="delay" dataKey="avg_delay_min" name="Avg Delay (min)" radius={[4,4,0,0]}>
                {heatmap.map(row => {
                  const d = Number(row.avg_delay_min || 0);
                  return <Cell key={row.hour_of_day} fill={d >= 30 ? '#f5222d' : d >= 15 ? '#fa8c16' : d >= 5 ? '#fadb14' : '#52c41a'} />;
                })}
              </Bar>
              <Bar yAxisId="count" dataKey="delayed_count" name="Delayed Flights" fill="#fa8c16" opacity={0.4} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>
    </Spin>
  );

  /* ════════════════════════════════════════════════ */
  /* TAB 3 — ANALYTICS                               */
  /* ════════════════════════════════════════════════ */
  const analyticsTab = (
    <Spin spinning={loading && !stats}>
      {/* Row 1: 24hr throughput + Status donut */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <SectionCard
            title="24-Hour Throughput"
            extra={<Text type="secondary" style={{ fontSize: 12 }}>Flights/hr · OTP %</Text>}
          >
            {hourlyKpi.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: token.colorTextTertiary }}>No hourly data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={hourlyKpi} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#1677ff" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#1677ff" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="go" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#52c41a" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#52c41a" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} />
                  <XAxis dataKey="snapshot_time" tickFormatter={v => dayjs(v).format('HH:mm')} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="f" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="o" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area yAxisId="f" type="monotone" dataKey="total_flights" name="Flights"
                    stroke="#1677ff" fill="url(#gf)" strokeWidth={2} />
                  <Area yAxisId="o" type="monotone" dataKey="otp_percentage" name="OTP %"
                    stroke="#52c41a" fill="url(#go)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        </Col>

        <Col xs={24} lg={8}>
          <SectionCard title="Flight Status Breakdown">
            {statusPieData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: token.colorTextTertiary }}>No data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={statusPieData} cx="50%" cy="50%"
                      innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {statusPieData.map(e => <Cell key={e.name} fill={e.fill} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div>
                  {statusPieData.map(d => (
                    <div key={d.name} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '4px 0', borderBottom: `1px solid ${token.colorBorderSecondary}`,
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
          </SectionCard>
        </Col>
      </Row>

      {/* Row 2: Delay causes + 7-day OTP */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SectionCard
            title="Delays by Cause"
            extra={<Text type="secondary" style={{ fontSize: 12 }}>Last 7 days</Text>}
          >
            {delayByCategory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: token.colorTextTertiary }}>No delay data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={delayByCategory} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={token.colorBorderSecondary} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="category" type="category" tick={{ fontSize: 12 }} width={60} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Flights" radius={[0, 6, 6, 0]}>
                      {delayByCategory.map(e => <Cell key={e.category} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <Row gutter={8} style={{ marginTop: 8 }}>
                  {delayByCategory.map(d => (
                    <Col key={d.category}>
                      <div style={{
                        background: `${d.fill}20`, border: `1px solid ${d.fill}40`,
                        borderRadius: 6, padding: '2px 10px', fontSize: 11, color: d.fill, fontWeight: 600,
                      }}>
                        {d.category}: {d.count}
                      </div>
                    </Col>
                  ))}
                </Row>
              </>
            )}
          </SectionCard>
        </Col>

        <Col xs={24} lg={12}>
          <SectionCard
            title="7-Day OTP Trend"
            extra={
              <span style={{
                background: `${otpColor}20`, border: `1px solid ${otpColor}40`,
                borderRadius: 6, padding: '2px 10px', fontSize: 13, fontWeight: 700, color: otpColor,
              }}>
                Today: {otp}%
              </span>
            }
          >
            {dailyKpi.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: token.colorTextTertiary }}>No trend data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyKpi} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} />
                    <XAxis dataKey="snapshot_time" tickFormatter={v => dayjs(v).format('MMM D')} tick={{ fontSize: 11 }} />
                    <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="otp_percentage" name="OTP %"
                      stroke={otpColor} strokeWidth={2.5} dot={{ fill: otpColor, r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
                <Row gutter={12} style={{ marginTop: 12 }}>
                  {[
                    { label: 'Target (85%)', val: 85, color: '#52c41a' },
                    { label: 'Dep OTP',      val: depOtp, color: depOtp >= 85 ? '#52c41a' : '#fa8c16' },
                    { label: 'Arr OTP',      val: arrOtp, color: arrOtp >= 85 ? '#52c41a' : '#fa8c16' },
                  ].map(item => (
                    <Col key={item.label} span={8}>
                      <Text type="secondary" style={{ fontSize: 11 }}>{item.label}</Text>
                      <Progress percent={item.val} showInfo={false} strokeColor={item.color} size="small" style={{ margin: '4px 0 0' }} />
                      <Text strong style={{ color: item.color, fontSize: 12 }}>{item.val}%</Text>
                    </Col>
                  ))}
                </Row>
              </>
            )}
          </SectionCard>
        </Col>
      </Row>
    </Spin>
  );

  /* ════════════════════════════════════════════════ */
  /* RENDER                                          */
  /* ════════════════════════════════════════════════ */
  return (
    <div style={{ background: token.colorBgLayout, minHeight: '100%', paddingBottom: 24 }}>

      {/* Page header */}
      <div style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 14, padding: '16px 20px',
        marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Operations Dashboard</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {lastUpdated
              ? `Updated ${lastUpdated.format('HH:mm:ss')} · auto-refresh every 30s`
              : 'Loading…'}
          </Text>
        </div>
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
      </div>

      {/* Tabs */}
      <Tabs
        defaultActiveKey="overview"
        size="large"
        style={{ marginTop: 0 }}
        tabBarStyle={{ marginBottom: 16, paddingLeft: 4 }}
        items={[
          {
            key:      'overview',
            label:    '✈  Overview',
            children: overviewTab,
          },
          {
            key:      'ops',
            label:    '⚡  Flight Ops',
            children: opsTab,
          },
          {
            key:      'analytics',
            label:    '📊  Analytics',
            children: analyticsTab,
          },
        ]}
      />
    </div>
  );
}
