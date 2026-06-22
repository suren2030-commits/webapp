import { useEffect, useState, useCallback } from 'react';
import { Row, Col, Card, Button, Select, Space, Typography, Spin, Progress } from 'antd';
import {
  ReloadOutlined, RocketOutlined, CheckCircleOutlined, ClockCircleOutlined,
  CloseCircleOutlined, ThunderboltOutlined, FieldTimeOutlined, CarOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getLiveStats, getDelayTrends, getKpiSnapshots } from '../api/analytics';
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

const KPI_CARD_STYLES = [
  { gradient: 'linear-gradient(135deg,#1890ff,#096dd9)', icon: <RocketOutlined /> },
  { gradient: 'linear-gradient(135deg,#52c41a,#237804)', icon: <CheckCircleOutlined /> },
  { gradient: 'linear-gradient(135deg,#13c2c2,#006d75)', icon: <ThunderboltOutlined /> },
  { gradient: 'linear-gradient(135deg,#fa8c16,#d46b08)', icon: <ClockCircleOutlined /> },
  { gradient: 'linear-gradient(135deg,#722ed1,#391085)', icon: <FieldTimeOutlined /> },
  { gradient: 'linear-gradient(135deg,#f5222d,#a8071a)', icon: <CloseCircleOutlined /> },
];

function KpiCard({ title, value, suffix = '', style, icon }) {
  return (
    <div style={{
      background: style.gradient,
      borderRadius: 12,
      padding: '20px 24px',
      color: '#fff',
      minHeight: 100,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', right: 16, top: 16,
        fontSize: 40, opacity: 0.15,
      }}>
        {icon}
      </div>
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500 }}>
        {title}
      </Text>
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1, marginTop: 8 }}>
        {value}<span style={{ fontSize: 16, fontWeight: 400, marginLeft: 4 }}>{suffix}</span>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(20,20,30,0.92)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: '10px 14px',
      color: '#fff',
      fontSize: 12,
    }}>
      <div style={{ marginBottom: 4, color: 'rgba(255,255,255,0.6)' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(p.value % 1 ? 1 : 0) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { airportId, setAirport } = useAppStore();
  const [airports, setAirports]       = useState([]);
  const [stats, setStats]             = useState(null);
  const [delays, setDelays]           = useState([]);
  const [hourlyKpi, setHourlyKpi]     = useState([]);
  const [dailyKpi, setDailyKpi]       = useState([]);
  const [loading, setLoading]         = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    client.get('/api/airports').then(r => setAirports(r.data)).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = airportId ? { airport_id: airportId } : {};

    const yesterday = dayjs().subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss');
    const dayStart  = dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss');

    const [statsRes, delaysRes, hourlyRes, dailyRes] = await Promise.allSettled([
      getLiveStats(params),
      getDelayTrends({ ...params, group_by: 'day' }),
      getKpiSnapshots({ ...params, period_type: 'hourly', from: dayStart, limit: 24 }),
      getKpiSnapshots({ ...params, period_type: 'daily',  from: yesterday, limit: 7 }),
    ]);

    if (statsRes.status  === 'fulfilled') setStats(statsRes.value);
    if (delaysRes.status === 'fulfilled') setDelays(delaysRes.value);
    if (hourlyRes.status === 'fulfilled') setHourlyKpi([...(hourlyRes.value || [])].reverse());
    if (dailyRes.status  === 'fulfilled') setDailyKpi([...(dailyRes.value || [])].reverse());

    setLastUpdated(dayjs());
    setLoading(false);
  }, [airportId]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const otp = stats?.otp_percentage ?? 0;
  const otpColor = otp >= 85 ? '#52c41a' : otp >= 70 ? '#fa8c16' : '#f5222d';

  const delayByCategory = delays.reduce((acc, row) => {
    const cat = row.delay_cause_category || 'other';
    const existing = acc.find(d => d.category === cat);
    if (existing) existing.count += Number(row.flight_count);
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

  const kpiCards = [
    { title: 'Total Flights',    value: stats?.total_flights ?? 0,             suffix: '',    styleIdx: 0 },
    { title: 'On-Time %',        value: otp,                                   suffix: '%',   styleIdx: 1 },
    { title: 'Boarding',         value: stats?.boarding ?? 0,                  suffix: '',    styleIdx: 2 },
    { title: 'Delayed',          value: stats?.delayed ?? 0,                   suffix: '',    styleIdx: 3 },
    { title: 'Avg Delay',        value: stats?.avg_departure_delay_min ?? 0,   suffix: ' min',styleIdx: 4 },
    { title: 'Cancelled',        value: stats?.cancelled ?? 0,                 suffix: '',    styleIdx: 5 },
  ];

  const pageBackground = '#f0f2f5';

  return (
    <div style={{ background: pageBackground, minHeight: '100%' }}>
      {/* Header Row */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={3} style={{ margin: 0, color: '#141414' }}>Operations Dashboard</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {lastUpdated ? `Updated ${lastUpdated.format('HH:mm:ss')}` : 'Loading...'}
          </Text>
        </Col>
        <Col>
          <Space>
            <Select
              placeholder="All Airports"
              style={{ width: 220 }}
              value={airportId}
              onChange={(val, opt) => setAirport(val, opt?.iata, opt?.label)}
              options={airports.map(a => ({
                value: a.id, label: `${a.iata_code} — ${a.name}`, iata: a.iata_code,
              }))}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
              Refresh
            </Button>
          </Space>
        </Col>
      </Row>

      <Spin spinning={loading && !stats}>
        {/* KPI Cards Row */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          {kpiCards.map((card, i) => (
            <Col key={card.title} xs={12} sm={8} lg={4}>
              <KpiCard
                title={card.title}
                value={card.value}
                suffix={card.suffix}
                style={KPI_CARD_STYLES[card.styleIdx]}
                icon={KPI_CARD_STYLES[card.styleIdx].icon}
              />
            </Col>
          ))}
        </Row>

        {/* Charts Row 1: Hourly Area + Status Donut */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={16}>
            <Card
              title={<span style={{ fontWeight: 600 }}>24-Hour Throughput</span>}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>Flights / hour</Text>}
              style={{ borderRadius: 12 }}
              bodyStyle={{ padding: '12px 16px' }}
            >
              {hourlyKpi.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
                  No hourly data available
                </div>
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
                    <XAxis
                      dataKey="snapshot_time"
                      tickFormatter={v => dayjs(v).format('HH:mm')}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis yAxisId="flights" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="otp" orientation="right" domain={[0,100]} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      yAxisId="flights"
                      type="monotone"
                      dataKey="total_flights"
                      name="Flights"
                      stroke="#1677ff"
                      fill="url(#flightGrad)"
                      strokeWidth={2}
                    />
                    <Area
                      yAxisId="otp"
                      type="monotone"
                      dataKey="otp_percentage"
                      name="OTP %"
                      stroke="#52c41a"
                      fill="url(#otpGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card
              title={<span style={{ fontWeight: 600 }}>Flight Status</span>}
              style={{ borderRadius: 12 }}
              bodyStyle={{ padding: '12px 8px' }}
            >
              {statusPieData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>No data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {statusPieData.map(entry => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ padding: '0 8px' }}>
                    {statusPieData.map(d => (
                      <div key={d.name} style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', padding: '3px 0',
                        borderBottom: '1px solid #f5f5f5',
                      }}>
                        <Space size={6}>
                          <span style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: d.fill, display: 'inline-block',
                          }} />
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

        {/* Charts Row 2: Delay by Cause + 7-day OTP Trend */}
        <Row gutter={[16, 16]}>
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
                    <BarChart
                      data={delayByCategory}
                      layout="vertical"
                      margin={{ top: 0, right: 30, left: 20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="category" type="category" tick={{ fontSize: 12 }} width={60} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Flights" radius={[0, 6, 6, 0]}>
                        {delayByCategory.map(entry => (
                          <Cell key={entry.category} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <Row gutter={8} style={{ marginTop: 8 }}>
                    {delayByCategory.map(d => (
                      <Col key={d.category}>
                        <div style={{
                          background: d.fill + '20',
                          border: `1px solid ${d.fill}40`,
                          borderRadius: 6, padding: '2px 10px',
                          fontSize: 11, color: d.fill, fontWeight: 600,
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
                  borderRadius: 6, padding: '2px 10px',
                  fontSize: 13, fontWeight: 700, color: otpColor,
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
                      <XAxis
                        dataKey="snapshot_time"
                        tickFormatter={v => dayjs(v).format('MMM D')}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="otp_percentage"
                        name="OTP %"
                        stroke={otpColor}
                        strokeWidth={2.5}
                        dot={{ fill: otpColor, r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 12 }}>
                    <Row gutter={12}>
                      <Col span={8}>
                        <Text type="secondary" style={{ fontSize: 11 }}>OTP Target</Text>
                        <Progress
                          percent={85} showInfo={false}
                          strokeColor="#52c41a" size="small"
                          style={{ margin: '4px 0 0' }}
                        />
                      </Col>
                      <Col span={8}>
                        <Text type="secondary" style={{ fontSize: 11 }}>Current</Text>
                        <Progress
                          percent={otp} showInfo={false}
                          strokeColor={otpColor} size="small"
                          style={{ margin: '4px 0 0' }}
                        />
                      </Col>
                      <Col span={8}>
                        <Text type="secondary" style={{ fontSize: 11 }}>Avg Delay</Text>
                        <div style={{ fontWeight: 700, color: '#595959', fontSize: 16, marginTop: 2 }}>
                          {stats?.avg_departure_delay_min ?? 0} min
                        </div>
                      </Col>
                    </Row>
                  </div>
                </>
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
