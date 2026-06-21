import { useEffect, useState, useCallback } from 'react';
import {
  Row, Col, Card, Tag, Select, Typography, Space, Badge, Button,
  Modal, Form, DatePicker, Input, Tooltip, Spin, Empty, Divider,
} from 'antd';
import { PlusOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getGates, getTerminals, assignFlight, updateAssignment } from '../api/gates';
import client from '../api/client';
import useAppStore from '../store/useAppStore';
import socket, { joinAirport } from '../socket';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const GATE_STATUS_COLOR = {
  active:      'success',
  maintenance: 'error',
  inactive:    'default',
};

const ASSIGNMENT_STATUS_COLOR = {
  planned: 'blue',
  active:  'green',
};

function GateCard({ gate, onAssign, onUpdateAssignment }) {
  const hasAssignment = !!gate.assignment_id;
  const borderColor = gate.status === 'maintenance' ? '#ff4d4f'
    : hasAssignment && gate.assignment_status === 'active' ? '#52c41a'
    : hasAssignment ? '#1677ff'
    : '#d9d9d9';

  return (
    <Card
      size="small"
      style={{ borderColor, borderWidth: 2, cursor: 'pointer', height: '100%' }}
      styles={{ body: { padding: 10 } }}
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Row justify="space-between" align="middle">
          <Text strong style={{ fontSize: 16 }}>Gate {gate.code}</Text>
          <Badge status={GATE_STATUS_COLOR[gate.status]} text={gate.status} />
        </Row>

        <Text type="secondary" style={{ fontSize: 11 }}>
          {gate.has_jetbridge ? 'Jetbridge' : 'Remote'} · Cat {gate.max_category}
        </Text>

        <Divider style={{ margin: '6px 0' }} />

        {hasAssignment ? (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Space>
              <Tag color={ASSIGNMENT_STATUS_COLOR[gate.assignment_status]}>
                {gate.assignment_status}
              </Tag>
              <Text strong>{gate.flight_number}</Text>
              <Text type="secondary">{gate.airline_iata}</Text>
            </Space>
            <Text style={{ fontSize: 11 }}>
              {dayjs(gate.from_time).format('HH:mm')} – {dayjs(gate.to_time).format('HH:mm')}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {gate.origin_iata} → {gate.dest_iata}
            </Text>
            <Space style={{ marginTop: 4 }}>
              {gate.assignment_status === 'planned' && (
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                  onClick={() => onUpdateAssignment(gate.assignment_id, 'active')}>
                  Activate
                </Button>
              )}
              <Button size="small" danger icon={<CloseCircleOutlined />}
                onClick={() => onUpdateAssignment(gate.assignment_id, 'cancelled')}>
                Cancel
              </Button>
            </Space>
          </Space>
        ) : (
          gate.status === 'active' ? (
            <Button size="small" icon={<PlusOutlined />} type="dashed" block
              onClick={() => onAssign(gate)}>
              Assign Flight
            </Button>
          ) : (
            <Text type="secondary" style={{ fontSize: 11 }}>Unavailable</Text>
          )
        )}
      </Space>
    </Card>
  );
}

export default function GateManagement() {
  const { airportId } = useAppStore();
  const [gates, setGates]         = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [terminalId, setTerminalId] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [assignModal, setAssignModal] = useState({ open: false, gate: null });
  const [flights, setFlights]     = useState([]);
  const [form] = Form.useForm();

  const fetchGates = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (airportId)  params.airport_id  = airportId;
      if (terminalId) params.terminal_id = terminalId;
      const data = await getGates(params);
      setGates(data);
    } finally {
      setLoading(false);
    }
  }, [airportId, terminalId]);

  useEffect(() => {
    if (airportId) {
      getTerminals({ airport_id: airportId }).then(setTerminals);
      joinAirport(airportId);
    }
  }, [airportId]);

  useEffect(() => { fetchGates(); }, [fetchGates]);

  useEffect(() => {
    const handler = () => fetchGates();
    socket.on('gate:assigned', handler);
    socket.on('gate:updated',  handler);
    return () => { socket.off('gate:assigned', handler); socket.off('gate:updated', handler); };
  }, [fetchGates]);

  const openAssign = async (gate) => {
    setAssignModal({ open: true, gate });
    const params = { limit: 100 };
    if (airportId) params.airport_id = airportId;
    const data = await client.get('/api/flights', { params }).then(r => r.data);
    setFlights(data.data || []);
    form.resetFields();
  };

  const handleAssign = async () => {
    const values = await form.validateFields();
    await assignFlight(assignModal.gate.id, {
      flight_id:  values.flight_id,
      from_time:  values.timeRange[0].toISOString(),
      to_time:    values.timeRange[1].toISOString(),
      airport_id: airportId,
    });
    setAssignModal({ open: false, gate: null });
    fetchGates();
  };

  const handleUpdateAssignment = async (id, status) => {
    await updateAssignment(id, { status });
    fetchGates();
  };

  // Group gates by terminal
  const grouped = gates.reduce((acc, g) => {
    const key = `${g.terminal_code} — ${g.terminal_name}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  const summary = {
    total:       gates.length,
    available:   gates.filter(g => g.status === 'active' && !g.assignment_id).length,
    occupied:    gates.filter(g => g.assignment_id).length,
    maintenance: gates.filter(g => g.status === 'maintenance').length,
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Space>
          <Title level={4} style={{ margin: 0 }}>Gate Management</Title>
          <Tag color="success">{summary.available} Available</Tag>
          <Tag color="blue">{summary.occupied} Occupied</Tag>
          <Tag color="error">{summary.maintenance} Maintenance</Tag>
        </Space>
        <Space>
          <Select
            placeholder="All terminals"
            style={{ width: 180 }}
            value={terminalId}
            onChange={setTerminalId}
            options={terminals.map(t => ({ value: t.id, label: `Terminal ${t.code}` }))}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={fetchGates} loading={loading}>Refresh</Button>
        </Space>
      </Row>

      <Spin spinning={loading}>
        {Object.keys(grouped).length === 0 ? (
          <Empty description="No gates found. Add airport data to get started." />
        ) : (
          Object.entries(grouped).map(([terminal, termGates]) => (
            <div key={terminal} style={{ marginBottom: 24 }}>
              <Title level={5} style={{ marginBottom: 12 }}>Terminal {terminal}</Title>
              <Row gutter={[12, 12]}>
                {termGates.map(gate => (
                  <Col key={gate.id} xs={12} sm={8} md={6} lg={4}>
                    <GateCard
                      gate={gate}
                      onAssign={openAssign}
                      onUpdateAssignment={handleUpdateAssignment}
                    />
                  </Col>
                ))}
              </Row>
            </div>
          ))
        )}
      </Spin>

      <Modal
        title={`Assign Flight to Gate ${assignModal.gate?.code}`}
        open={assignModal.open}
        onOk={handleAssign}
        onCancel={() => setAssignModal({ open: false, gate: null })}
        okText="Assign"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="flight_id" label="Flight" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Search flight number"
              optionFilterProp="label"
              options={flights.map(f => ({
                value: f.id,
                label: `${f.flight_number} — ${f.origin_iata} → ${f.dest_iata}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="timeRange" label="Time Window" rules={[{ required: true }]}>
            <RangePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
