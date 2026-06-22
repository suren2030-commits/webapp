import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Table, Select, DatePicker, Space, Typography, Button, Spin, Progress } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ReloadOutlined, BarChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getAirlinePerformance } from '../api/analytics';
import client from '../api/client';
import useAppStore from '../store/useAppStore';

const { Title, Text } = Typography;

function OtpBar({ value }) {
  const color = value >= 85 ? '#52c41a' : value >= 70 ? '#fa8c16' : '#f5222d';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <Progress percent={value ?? 0} showInfo={false} strokeColor={color} size="small" style={{ flex: 1, margin: 0 }} />
      <Text strong style={{ color, minWidth: 38, fontSize: 13 }}>{value ?? '—'}%</Text>
    </div>
  );
}

const COLUMNS = [
  {
    title: 'Airline', dataIndex: 'airline_name', width: 200,
    render: (v, r) => (
      <Space direction="vertical" size={0}>
        <Text strong>{v}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>{r.iata_code}</Text>
      </Space>
    ),
  },
  { title: 'Flights',   dataIndex: 'total_flights', width: 80,  sorter: (a,b) => a.total_flights - b.total_flights, defaultSortOrder: 'descend', render: v => Number(v) },
  { title: 'Completed', dataIndex: 'completed',     width: 100, render: v => Number(v) },
  {
    title: 'Delayed', dataIndex: 'delayed', width: 80,
    render: v => <Text style={{ color: Number(v) > 0 ? '#fa8c16' : 'inherit' }}>{Number(v)}</Text>,
  },
  {
    title: 'Cancelled', dataIndex: 'cancelled', width: 90,
    render: v => <Text style={{ color: Number(v) > 0 ? '#f5222d' : 'inherit' }}>{Number(v)}</Text>,
  },
  {
    title: 'Avg Dep Delay', dataIndex: 'avg_dep_delay_min', width: 120,
    sorter: (a,b) => (a.avg_dep_delay_min ?? 0) - (b.avg_dep_delay_min ?? 0),
    render: v => v != null ? <Text style={{ color: v > 15 ? '#fa8c16' : 'inherit' }}>{v} min</Text> : '—',
  },
  {
    title: 'OTP %', dataIndex: 'otp_pct', width: 180,
    sorter: (a,b) => (a.otp_pct ?? 0) - (b.otp_pct ?? 0),
    render: v => <OtpBar value={Number(v ?? 0)} />,
  },
  {
    title: 'Passengers', dataIndex: 'total_passengers', width: 110,
    sorter: (a,b) => (a.total_passengers ?? 0) - (b.total_passengers ?? 0),
    render: v => Number(v).toLocaleString(),
  },
];

export default function Airlines() {
  const { airportId, setAirport } = useAppStore();
  const [airports, setAirports] = useState([]);
  const [data, setData]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [date, setDate]         = useState(dayjs());

  useEffect(() => {
    client.get('/api/airports').then(r => setAirports(r.data)).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { date: date.format('YYYY-MM-DD') };
      if (airportId) params.airport_id = airportId;
      const rows = await getAirlinePerformance(params);
      setData(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [date, airportId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = [...data]
    .sort((a, b) => Number(b.total_flights) - Number(a.total_flights))
    .slice(0, 12)
    .map(r => ({
      name:     r.iata_code,
      otp:      Number(r.otp_pct ?? 0),
      delayed:  Number(r.delayed ?? 0),
      flights:  Number(r.total_flights ?? 0),
    }));

  const avgOtp    = data.length ? Math.round(data.reduce((s, r) => s + Number(r.otp_pct ?? 0), 0) / data.length) : 0;
  const totalPax  = data.reduce((s, r) => s + Number(r.total_passengers ?? 0), 0);
  const mostDelay = data.reduce((a, b) => Number(a.avg_dep_delay_min ?? 0) > Number(b.avg_dep_delay_min ?? 0) ? a : b, {});

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <BarChartOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Airline Performance
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
            <DatePicker value={date} onChange={d => d && setDate(d)} allowClear={false} />
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Refresh</Button>
          </Space>
        </Col>
      </Row>

      {/* Summary cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Airlines',     value: data.length,                      color: '#1677ff' },
          { label: 'Avg OTP',      value: `${avgOtp}%`,                     color: avgOtp >= 85 ? '#52c41a' : avgOtp >= 70 ? '#fa8c16' : '#f5222d' },
          { label: 'Total Pax',    value: totalPax.toLocaleString(),         color: '#722ed1' },
          { label: 'Most Delayed', value: mostDelay.iata_code ?? '—',        color: '#fa8c16' },
        ].map(card => (
          <Col key={card.label} xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 10, borderTop: `3px solid ${card.color}` }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{card.label}</Text>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* OTP bar chart */}
      <Card
        title={<span style={{ fontWeight: 600 }}>OTP % by Airline (Top 12)</span>}
        style={{ borderRadius: 12, marginBottom: 16 }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        {chartData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fontWeight: 600 }} width={40} />
              <Tooltip formatter={(v, n) => [n === 'otp' ? `${v}%` : v, n === 'otp' ? 'OTP' : 'Flights']} />
              <Bar dataKey="otp" name="OTP %" radius={[0, 6, 6, 0]}>
                {chartData.map(row => (
                  <Cell
                    key={row.name}
                    fill={row.otp >= 85 ? '#52c41a' : row.otp >= 70 ? '#fa8c16' : '#f5222d'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Table */}
      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
        <Spin spinning={loading}>
          <Table
            rowKey="airline_id"
            columns={COLUMNS}
            dataSource={data}
            size="middle"
            scroll={{ x: 900 }}
            pagination={{ pageSize: 25, showTotal: t => `${t} airlines` }}
          />
        </Spin>
      </Card>
    </div>
  );
}
