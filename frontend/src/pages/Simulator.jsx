import { useState, useEffect, useCallback } from 'react';
import {
  Row, Col, Form, Select, Input, InputNumber, Button,
  Table, Tag, Space, Typography, message, DatePicker, theme,
} from 'antd';
import {
  ControlOutlined, SendOutlined, ArrowUpOutlined, ArrowDownOutlined,
  CalendarOutlined, ThunderboltOutlined, ReloadOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import client from '../api/client';

const { Title, Text } = Typography;

const AIRLINES = [
  { value: 1, label: '6E – IndiGo' },
  { value: 2, label: 'AI – Air India' },
  { value: 3, label: 'QP – Akasa Air' },
  { value: 4, label: 'SG – SpiceJet' },
  { value: 5, label: 'IX – Air India Express' },
  { value: 6, label: 'EK – Emirates' },
  { value: 7, label: 'G9 – Air Arabia' },
  { value: 8, label: 'SQ – Singapore Airlines' },
];

const AIRPORTS = [
  { value: 1,  label: 'BOM – Mumbai' },
  { value: 2,  label: 'AMD – Ahmedabad' },
  { value: 3,  label: 'DEL – Delhi' },
  { value: 4,  label: 'BLR – Bangalore' },
  { value: 5,  label: 'HYD – Hyderabad' },
  { value: 6,  label: 'CCU – Kolkata' },
  { value: 7,  label: 'MAA – Chennai' },
  { value: 8,  label: 'PNQ – Pune' },
  { value: 9,  label: 'GOI – Goa' },
  { value: 10, label: 'DXB – Dubai' },
  { value: 11, label: 'LHR – London Heathrow' },
  { value: 12, label: 'SIN – Singapore Changi' },
];

/* ── Action panel card ───────────────────────────── */
function ActionCard({ title, accentColor, icon, children, token }) {
  return (
    <div style={{
      background:   token.colorBgContainer,
      border:       `1px solid ${token.colorBorderSecondary}`,
      borderTop:    `3px solid ${accentColor}`,
      borderRadius: 12,
      padding:      '16px',
      height:       '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ color: accentColor, fontSize: 16 }}>{icon}</span>
        <Text strong style={{ fontSize: 13, letterSpacing: 0.5, color: accentColor }}>{title}</Text>
      </div>
      {children}
    </div>
  );
}

/* ── Stat mini card ──────────────────────────────── */
function StatPill({ label, value, gradient }) {
  return (
    <div style={{
      background: gradient, borderRadius: 10,
      padding: '12px 16px', color: '#fff',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8, letterSpacing: 0.8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
    </div>
  );
}

/* ── Quick event trigger (inline table action) ───── */
function quickSend(flightId, event, flightNum, logEvent, fetchFlights) {
  client.post('/api/simulator/event', { flight_id: flightId, event, delay_minutes: 0 })
    .then(() => {
      logEvent(flightNum, event);
      message.success(`${flightNum} → ${event.toUpperCase()}`);
      fetchFlights();
    })
    .catch(() => message.error('Event failed'));
}

/* ── Main page ───────────────────────────────────── */
export default function Simulator() {
  const { token } = theme.useToken();
  const [flights,       setFlights]       = useState([]);
  const [loadingQ,      setLoadingQ]      = useState(false);
  const [submitting,    setSubmitting]    = useState({});
  const [eventLog,      setEventLog]      = useState([]);
  const [scheduleForm]                    = Form.useForm();
  const [arrivalForm]                     = Form.useForm();
  const [departureForm]                   = Form.useForm();

  const fetchFlights = useCallback(async () => {
    setLoadingQ(true);
    try {
      const res = await client.get('/api/simulator/flights');
      setFlights(res.data);
    } catch { /* ignore */ }
    finally { setLoadingQ(false); }
  }, []);

  useEffect(() => { fetchFlights(); }, [fetchFlights]);

  const logEvent = (flightNum, event, detail = '') => {
    setEventLog(prev => [
      { key: Date.now(), time: dayjs().format('HH:mm:ss'), flightNum, event, detail },
      ...prev.slice(0, 14),
    ]);
  };

  /* Send arrival or departure event via form */
  const sendEvent = async (values, form, eventType) => {
    setSubmitting(s => ({ ...s, [eventType]: true }));
    try {
      await client.post('/api/simulator/event', {
        flight_id:     values.flight_id,
        event:         eventType,
        delay_minutes: values.delay_minutes || 0,
      });
      const f = flights.find(x => x.id === values.flight_id);
      const detail = values.delay_minutes ? `+${values.delay_minutes}min delay` : '';
      logEvent(f?.flight_number || String(values.flight_id), eventType, detail);
      message.success(`${f?.flight_number || ''} → ${eventType.toUpperCase()}`);
      form.resetFields();
      fetchFlights();
    } catch (err) {
      message.error(err.response?.data?.error || 'Event failed');
    } finally { setSubmitting(s => ({ ...s, [eventType]: false })); }
  };

  /* Create new scheduled flight */
  const scheduleNew = async (values) => {
    setSubmitting(s => ({ ...s, schedule: true }));
    try {
      await client.post('/api/simulator/schedule', {
        flight_number:          values.flight_number.toUpperCase(),
        airline_id:             values.airline_id,
        flight_type:            values.flight_type,
        origin_airport_id:      values.origin_airport_id,
        destination_airport_id: values.destination_airport_id,
        scheduled_departure:    values.dep_time.toISOString(),
        scheduled_arrival:      values.arr_time.toISOString(),
        passenger_count:        values.passenger_count || 150,
      });
      logEvent(values.flight_number.toUpperCase(), 'scheduled');
      message.success(`${values.flight_number.toUpperCase()} added to schedule`);
      scheduleForm.resetFields();
      fetchFlights();
    } catch (err) {
      message.error(err.response?.data?.error || 'Schedule failed');
    } finally { setSubmitting(s => ({ ...s, schedule: false })); }
  };

  /* Flight option lists for selects */
  const depOptions = flights
    .filter(f => f.flight_type === 'departure')
    .map(f => ({
      value: f.id,
      label: `${f.flight_number}  →${f.dest_iata}  ${dayjs(f.scheduled_departure).format('HH:mm')}  (${f.status})`,
    }));

  const arrOptions = flights
    .filter(f => f.flight_type === 'arrival')
    .map(f => ({
      value: f.id,
      label: `${f.flight_number}  ${f.origin_iata}→  ${dayjs(f.scheduled_arrival).format('HH:mm')}  (${f.status})`,
    }));

  /* Table columns */
  const columns = [
    {
      title: 'Flight', dataIndex: 'flight_number', key: 'fn', width: 90,
      render: v => <Text strong style={{ fontFamily: 'monospace', fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Airline', dataIndex: 'airline_iata', key: 'al', width: 55,
      render: v => <Tag style={{ fontSize: 10, fontWeight: 700 }}>{v}</Tag>,
    },
    {
      title: 'Type', dataIndex: 'flight_type', key: 'ft', width: 60,
      render: v => (
        <Tag color={v === 'departure' ? 'blue' : 'green'} style={{ fontSize: 10 }}>
          {v === 'departure' ? 'DEP' : 'ARR'}
        </Tag>
      ),
    },
    {
      title: 'Route', key: 'route', width: 90,
      render: (_, r) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.origin_iata}→{r.dest_iata}</span>
      ),
    },
    {
      title: 'Sched', key: 'sched', width: 65,
      render: (_, r) => {
        const t = r.flight_type === 'departure' ? r.scheduled_departure : r.scheduled_arrival;
        return <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{dayjs(t).format('HH:mm')}</span>;
      },
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 90,
      render: v => {
        const clr = { scheduled: 'default', boarding: 'success', delayed: 'error' };
        return <Tag color={clr[v] || 'default'} style={{ fontSize: 10 }}>{v.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Quick Send', key: 'actions', width: 230,
      render: (_, r) => (
        <Space size={4}>
          {r.flight_type === 'departure' && r.status !== 'boarding' && (
            <Button size="small"
              onClick={() => quickSend(r.id, 'boarding', r.flight_number, logEvent, fetchFlights)}
              style={{ fontSize: 10, height: 22, padding: '0 7px', color: '#52c41a', borderColor: '#52c41a' }}>
              Board
            </Button>
          )}
          {r.flight_type === 'departure' && (
            <Button size="small" type="primary" icon={<ArrowUpOutlined style={{ fontSize: 9 }} />}
              onClick={() => quickSend(r.id, 'departed', r.flight_number, logEvent, fetchFlights)}
              style={{ fontSize: 10, height: 22, padding: '0 7px' }}>
              Depart
            </Button>
          )}
          {r.flight_type === 'arrival' && (
            <Button size="small" icon={<ArrowDownOutlined style={{ fontSize: 9 }} />}
              onClick={() => quickSend(r.id, 'arrived', r.flight_number, logEvent, fetchFlights)}
              style={{ fontSize: 10, height: 22, padding: '0 7px', background: '#52c41a', borderColor: '#52c41a', color: '#fff' }}>
              Land
            </Button>
          )}
          <Button size="small" danger
            onClick={() => quickSend(r.id, 'delayed', r.flight_number, logEvent, fetchFlights)}
            style={{ fontSize: 10, height: 22, padding: '0 7px' }}>
            Delay
          </Button>
        </Space>
      ),
    },
  ];

  const pendingDep = flights.filter(f => f.flight_type === 'departure').length;
  const pendingArr = flights.filter(f => f.flight_type === 'arrival').length;
  const delayedCnt = flights.filter(f => f.status === 'delayed').length;

  return (
    <div style={{ background: token.colorBgLayout, minHeight: '100%', paddingBottom: 24 }}>

      {/* ── Page header ──────────────────────────────── */}
      <div style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 14, padding: '16px 20px', marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <ControlOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
            Flight Event Simulator
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            BOM · Manually push schedule, arrival, or departure events to update flight status and KPIs
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchFlights} loading={loadingQ}>Refresh</Button>
      </div>

      {/* ── Stats row ────────────────────────────────── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <StatPill label="PENDING DEPARTURES" value={pendingDep}
            gradient="linear-gradient(135deg,#1890ff,#096dd9)" />
        </Col>
        <Col xs={8}>
          <StatPill label="PENDING ARRIVALS" value={pendingArr}
            gradient="linear-gradient(135deg,#52c41a,#237804)" />
        </Col>
        <Col xs={8}>
          <StatPill label="DELAYED" value={delayedCnt}
            gradient={delayedCnt > 0
              ? 'linear-gradient(135deg,#f5222d,#a8071a)'
              : 'linear-gradient(135deg,#389e0d,#135200)'} />
        </Col>
      </Row>

      {/* ── Action cards ─────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>

        {/* Schedule Flight */}
        <Col xs={24} md={8}>
          <ActionCard title="Schedule Flight" accentColor="#1890ff" icon={<CalendarOutlined />} token={token}>
            <Form form={scheduleForm} layout="vertical" size="small" onFinish={scheduleNew}>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="flight_number" label="Flight No." rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                    <Input placeholder="6E 123" style={{ textTransform: 'uppercase', fontFamily: 'monospace' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="airline_id" label="Airline" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                    <Select options={AIRLINES} placeholder="Airline" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="flight_type" label="Flight Type" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                <Select options={[
                  { value: 'departure', label: '✈ Departure from BOM' },
                  { value: 'arrival',   label: '🛬 Arrival at BOM' },
                ]} />
              </Form.Item>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="origin_airport_id" label="Origin" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                    <Select options={AIRPORTS} showSearch
                      filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="destination_airport_id" label="Destination" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                    <Select options={AIRPORTS} showSearch
                      filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="dep_time" label="Dep Time" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                    <DatePicker showTime style={{ width: '100%' }} format="DD/MM HH:mm" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="arr_time" label="Arr Time" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                    <DatePicker showTime style={{ width: '100%' }} format="DD/MM HH:mm" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="passenger_count" label="Passengers" style={{ marginBottom: 12 }}>
                <InputNumber min={1} max={600} placeholder="150" style={{ width: '100%' }} />
              </Form.Item>
              <Button block type="primary" htmlType="submit" loading={!!submitting.schedule}
                icon={<CalendarOutlined />}>
                Add to Schedule
              </Button>
            </Form>
          </ActionCard>
        </Col>

        {/* Send Arrival */}
        <Col xs={24} md={8}>
          <ActionCard title="Send Arrival Event" accentColor="#52c41a" icon={<ArrowDownOutlined />} token={token}>
            <Form form={arrivalForm} layout="vertical" size="small"
              onFinish={v => sendEvent(v, arrivalForm, 'arrived')}>
              <Form.Item name="flight_id" label="Select Inbound Flight" rules={[{ required: true }]}
                style={{ marginBottom: 10 }}>
                <Select
                  options={arrOptions}
                  placeholder="Choose arrival flight..."
                  showSearch
                  filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                  notFoundContent={<span style={{ fontSize: 12, color: token.colorTextTertiary }}>No pending arrivals</span>}
                />
              </Form.Item>
              <Form.Item name="delay_minutes" label="Delay (minutes)" initialValue={0}
                style={{ marginBottom: 10 }}>
                <InputNumber min={0} max={300} style={{ width: '100%' }}
                  addonAfter="min" />
              </Form.Item>
              <div style={{
                background: 'rgba(82,196,26,0.08)', border: '1px solid rgba(82,196,26,0.2)',
                borderRadius: 6, padding: '8px 10px', marginBottom: 14, fontSize: 11,
                color: 'rgba(82,196,26,0.9)',
              }}>
                Marks flight as <strong>ARRIVED</strong> · records actual_arrival = now + delay
              </div>
              <Button block htmlType="submit" loading={!!submitting.arrived}
                icon={<ArrowDownOutlined />}
                style={{ background: '#52c41a', borderColor: '#52c41a', color: '#fff', fontWeight: 600 }}>
                Send Arrival
              </Button>
            </Form>
          </ActionCard>
        </Col>

        {/* Send Departure */}
        <Col xs={24} md={8}>
          <ActionCard title="Send Departure Event" accentColor="#fa8c16" icon={<ArrowUpOutlined />} token={token}>
            <Form form={departureForm} layout="vertical" size="small"
              onFinish={v => sendEvent(v, departureForm, 'departed')}>
              <Form.Item name="flight_id" label="Select Outbound Flight" rules={[{ required: true }]}
                style={{ marginBottom: 10 }}>
                <Select
                  options={depOptions}
                  placeholder="Choose departure flight..."
                  showSearch
                  filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                  notFoundContent={<span style={{ fontSize: 12, color: token.colorTextTertiary }}>No pending departures</span>}
                />
              </Form.Item>
              <Form.Item name="delay_minutes" label="Delay (minutes)" initialValue={0}
                style={{ marginBottom: 10 }}>
                <InputNumber min={0} max={300} style={{ width: '100%' }}
                  addonAfter="min" />
              </Form.Item>
              <div style={{
                background: 'rgba(250,140,22,0.08)', border: '1px solid rgba(250,140,22,0.2)',
                borderRadius: 6, padding: '8px 10px', marginBottom: 14, fontSize: 11,
                color: 'rgba(250,140,22,0.9)',
              }}>
                Marks flight as <strong>DEPARTED</strong> · records actual_departure = now + delay
              </div>
              <Button block htmlType="submit" loading={!!submitting.departed}
                icon={<SendOutlined />}
                style={{ background: '#fa8c16', borderColor: '#fa8c16', color: '#fff', fontWeight: 600 }}>
                Send Departure
              </Button>
            </Form>
          </ActionCard>
        </Col>
      </Row>

      {/* ── Event log + pending queue ─────────────────── */}
      <Row gutter={[16, 16]}>

        {/* Event log */}
        <Col xs={24} xl={7}>
          <div style={{
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 12, overflow: 'hidden', height: '100%',
          }}>
            <div style={{
              padding: '10px 14px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgLayout,
            }}>
              <Text strong style={{ fontSize: 12 }}>
                <ThunderboltOutlined style={{ marginRight: 6, color: token.colorPrimary }} />
                Event Log
              </Text>
            </div>
            <div style={{ padding: '8px 12px', minHeight: 120 }}>
              {eventLog.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 12 }}>No events sent this session.</Text>
              ) : eventLog.map(e => {
                const clr = { departed:'blue', arrived:'green', delayed:'red', boarding:'cyan', scheduled:'default' };
                return (
                  <div key={e.key} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0',
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  }}>
                    <Text style={{ fontFamily: 'monospace', fontSize: 10, color: token.colorTextTertiary, minWidth: 52 }}>
                      {e.time}
                    </Text>
                    <Text strong style={{ fontFamily: 'monospace', fontSize: 12, minWidth: 72 }}>
                      {e.flightNum}
                    </Text>
                    <Tag color={clr[e.event] || 'default'} style={{ fontSize: 10, margin: 0, padding: '0 5px' }}>
                      {e.event.toUpperCase()}
                    </Tag>
                    {e.detail && (
                      <Text type="secondary" style={{ fontSize: 10 }}>{e.detail}</Text>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Col>

        {/* Pending flights queue */}
        <Col xs={24} xl={17}>
          <div style={{
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 12, overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 14px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgLayout,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <Text strong style={{ fontSize: 12 }}>
                <ClockCircleOutlined style={{ marginRight: 6, color: token.colorPrimary }} />
                Today's Pending Flights — BOM
              </Text>
              <Button size="small" icon={<ReloadOutlined />} onClick={fetchFlights} loading={loadingQ}>
                Refresh
              </Button>
            </div>
            <Table
              dataSource={flights}
              columns={columns}
              size="small"
              rowKey="id"
              loading={loadingQ}
              pagination={{ pageSize: 12, showSizeChanger: false, showTotal: t => `${t} pending` }}
              scroll={{ x: 680 }}
              style={{ fontSize: 12 }}
            />
          </div>
        </Col>
      </Row>
    </div>
  );
}
