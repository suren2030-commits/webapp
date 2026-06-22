import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Select, Space, Typography, Button, Spin, Statistic, DatePicker } from 'antd';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ReloadOutlined, LineChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getKpiSnapshots } from '../api/analytics';
import client from '../api/client';
import useAppStore from '../store/useAppStore';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(20,20,30,0.92)', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 12,
    }}>
      <div style={{ marginBottom: 4, color: 'rgba(255,255,255,0.6)' }}>
        {dayjs(label).format('DD MMM YYYY')}
      </div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color || '#fff' }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Trends() {
  const { airportId, setAirport } = useAppStore();
  const [airports, setAirports] = useState([]);
  const [kpiData, setKpiData]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [range, setRange]       = useState([
    dayjs().subtract(29, 'day'),
    dayjs(),
  ]);

  useEffect(() => {
    client.get('/api/airports').then(r => setAirports(r.data)).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!range[0] || !range[1]) return;
    setLoading(true);
    try {
      const params = {
        period_type: 'daily',
        from:  range[0].startOf('day').format('YYYY-MM-DD HH:mm:ss'),
        to:    range[1].endOf('day').format('YYYY-MM-DD HH:mm:ss'),
        limit: 90,
      };
      if (airportId) params.airport_id = airportId;
      const rows = await getKpiSnapshots(params);
      setKpiData([...rows].reverse());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [range, airportId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const avgOtp = kpiData.length
    ? Math.round(kpiData.reduce((s, r) => s + Number(r.otp_percentage ?? 0), 0) / kpiData.length)
    : 0;
  const totalFlights = kpiData.reduce((s, r) => s + Number(r.total_flights ?? 0), 0);
  const best  = kpiData.reduce((a, b) => Number(a.otp_percentage ?? 0) > Number(b.otp_percentage ?? 0) ? a : b, {});
  const worst = kpiData.reduce((a, b) => Number(a.otp_percentage ?? 99) < Number(b.otp_percentage ?? 99) ? a : b, {});

  const otpColor = avgOtp >= 85 ? '#52c41a' : avgOtp >= 70 ? '#fa8c16' : '#f5222d';

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <LineChartOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Historical Trends
          </Title>
        </Col>
        <Col>
          <Space>
            <Select
              placeholder="All Airports"
              style={{ width: 220 }}
              value={airportId}
              onChange={(val, opt) => setAirport(val, opt?.iata, opt?.label)}
              options={airports.map(a => ({ value: a.id, label: `${a.iata_code} — ${a.name}`, iata: a.iata_code }))}
              allowClear
            />
            <RangePicker
              value={range}
              onChange={r => r && setRange(r)}
              allowClear={false}
              disabledDate={d => d && d.isAfter(dayjs())}
              presets={[
                { label: 'Last 7 days',  value: [dayjs().subtract(6, 'day'),  dayjs()] },
                { label: 'Last 30 days', value: [dayjs().subtract(29, 'day'), dayjs()] },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Refresh</Button>
          </Space>
        </Col>
      </Row>

      {/* Summary stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { title: 'Period Avg OTP',   value: `${avgOtp}%`,        style: { color: otpColor } },
          { title: 'Total Flights',    value: totalFlights.toLocaleString(), style: {} },
          { title: 'Best Day OTP',     value: best.otp_percentage ? `${Number(best.otp_percentage).toFixed(1)}%` : '—', style: { color: '#52c41a' } },
          { title: 'Worst Day OTP',    value: worst.otp_percentage ? `${Number(worst.otp_percentage).toFixed(1)}%` : '—', style: { color: '#f5222d' } },
        ].map(card => (
          <Col key={card.title} xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 10 }}>
              <Statistic title={card.title} value={card.value} valueStyle={card.style} />
            </Card>
          </Col>
        ))}
      </Row>

      <Spin spinning={loading && kpiData.length === 0}>
        {/* OTP trend */}
        <Card
          title={<span style={{ fontWeight: 600 }}>On-Time Performance Trend</span>}
          extra={<Text type="secondary" style={{ fontSize: 12 }}>Daily OTP % — target 85%</Text>}
          style={{ borderRadius: 12, marginBottom: 16 }}
          bodyStyle={{ padding: '12px 16px' }}
        >
          {kpiData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
              No KPI snapshot data yet — snapshots recorded after each hour
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={kpiData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="otpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#52c41a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#52c41a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="snapshot_time" tickFormatter={v => dayjs(v).format('DD MMM')} tick={{ fontSize: 11 }} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone" dataKey="otp_percentage" name="OTP %"
                  stroke={otpColor} strokeWidth={2.5}
                  dot={{ fill: otpColor, r: 3 }} activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Flight volume trend */}
        <Card
          title={<span style={{ fontWeight: 600 }}>Flight Volume Trend</span>}
          extra={<Text type="secondary" style={{ fontSize: 12 }}>Total flights per day</Text>}
          style={{ borderRadius: 12, marginBottom: 16 }}
          bodyStyle={{ padding: '12px 16px' }}
        >
          {kpiData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={kpiData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="flightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#1677ff" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#1677ff" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="snapshot_time" tickFormatter={v => dayjs(v).format('DD MMM')} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone" dataKey="total_flights" name="Total Flights"
                  stroke="#1677ff" fill="url(#flightGrad)" strokeWidth={2}
                />
                <Area
                  type="monotone" dataKey="delayed_flights" name="Delayed"
                  stroke="#fa8c16" fill="#fa8c1620" strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Avg delay trend */}
        <Card
          title={<span style={{ fontWeight: 600 }}>Average Delay Trend</span>}
          extra={<Text type="secondary" style={{ fontSize: 12 }}>Minutes per day</Text>}
          style={{ borderRadius: 12 }}
          bodyStyle={{ padding: '12px 16px' }}
        >
          {kpiData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={kpiData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="snapshot_time" tickFormatter={v => dayjs(v).format('DD MMM')} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="avg_delay_min" name="Avg Delay (min)" fill="#fa8c16" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </Spin>
    </div>
  );
}
