import { useEffect, useState, useCallback } from 'react';
import { Row, Col, Card, Statistic, Button, Select, Space, Typography, Alert, Spin } from 'antd';
import {
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  RocketOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getLiveStats, getDelayTrends } from '../api/analytics';
import client from '../api/client';
import useAppStore from '../store/useAppStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const DELAY_COLORS = {
  airline: '#1677ff',
  airport: '#faad14',
  weather: '#52c41a',
  atc:     '#722ed1',
  security:'#f5222d',
  other:   '#8c8c8c',
};

export default function Dashboard() {
  const { airportId, airportCode, setAirport } = useAppStore();
  const [airports, setAirports]     = useState([]);
  const [stats, setStats]           = useState(null);
  const [delays, setDelays]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    client.get('/api/airports').then(r => setAirports(r.data)).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = airportId ? { airport_id: airportId } : {};
      const [statsData, delayData] = await Promise.all([
        getLiveStats(params),
        getDelayTrends({ ...params, group_by: 'day' }),
      ]);
      setStats(statsData);
      setDelays(delayData);
      setLastUpdated(dayjs());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [airportId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const otp = stats?.otp_percentage ?? 0;
  const otpColor = otp >= 85 ? '#52c41a' : otp >= 70 ? '#faad14' : '#f5222d';

  // Aggregate delay chart data
  const delayChartData = delays.reduce((acc, row) => {
    const existing = acc.find(d => d.category === row.delay_cause_category);
    if (existing) existing.count += Number(row.flight_count);
    else acc.push({ category: row.delay_cause_category || 'other', count: Number(row.flight_count) });
    return acc;
  }, []);

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Operations Dashboard</Title>
          {lastUpdated && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Last updated: {lastUpdated.format('HH:mm:ss')}
            </Text>
          )}
        </Col>
        <Col>
          <Space>
            <Select
              placeholder="Select airport"
              style={{ width: 200 }}
              value={airportId}
              onChange={(val, opt) => setAirport(val, opt.iata, opt.label)}
              options={airports.map(a => ({ value: a.id, label: `${a.iata_code} — ${a.name}`, iata: a.iata_code }))}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
              Refresh
            </Button>
          </Space>
        </Col>
      </Row>

      {!airportId && (
        <Alert
          message="Select an airport above to filter data, or view system-wide stats."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={loading && !stats}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={4}>
            <Card>
              <Statistic
                title="Total Flights"
                value={stats?.total_flights ?? 0}
                prefix={<RocketOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card>
              <Statistic
                title="On-Time Performance"
                value={otp}
                suffix="%"
                precision={1}
                valueStyle={{ color: otpColor }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card>
              <Statistic
                title="Avg Departure Delay"
                value={stats?.avg_departure_delay_min ?? 0}
                suffix="min"
                precision={1}
                valueStyle={{ color: (stats?.avg_departure_delay_min ?? 0) > 15 ? '#f5222d' : '#52c41a' }}
                prefix={<FieldTimeOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card>
              <Statistic
                title="Delayed"
                value={stats?.delayed ?? 0}
                valueStyle={{ color: '#faad14' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card>
              <Statistic
                title="Boarding Now"
                value={stats?.boarding ?? 0}
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card>
              <Statistic
                title="Cancelled"
                value={stats?.cancelled ?? 0}
                valueStyle={{ color: '#f5222d' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card title="Delays by Cause (Last 7 Days)">
              {delayChartData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c' }}>
                  No delay data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={delayChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" name="Flights">
                      {delayChartData.map((entry) => (
                        <Cell key={entry.category} fill={DELAY_COLORS[entry.category] || '#8c8c8c'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="Today's Summary">
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Statistic title="Departed" value={stats?.departed ?? 0} valueStyle={{ color: '#52c41a' }} />
                </Col>
                <Col span={12}>
                  <Statistic title="Arrived" value={stats?.arrived ?? 0} valueStyle={{ color: '#52c41a' }} />
                </Col>
                <Col span={12}>
                  <Statistic title="Scheduled" value={stats?.scheduled ?? 0} />
                </Col>
                <Col span={12}>
                  <Statistic title="Date" value={stats?.date ?? dayjs().format('YYYY-MM-DD')} />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
