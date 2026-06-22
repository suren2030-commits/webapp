import { useEffect, useState, useCallback } from 'react';
import {
  Row, Col, Card, Tag, Select, Typography, Space, Button,
  Modal, Form, DatePicker, Input, Spin, Empty, Progress, Tooltip,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ThunderboltOutlined, ToolOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getGates, getTerminals, assignFlight, updateAssignment } from '../api/gates';
import client from '../api/client';
import useAppStore from '../store/useAppStore';
import socket, { joinAirport } from '../socket';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function GateCard({ gate, onAssign, onUpdate }) {
  const occupied = !!gate.assignment_id && gate.assignment_status !== 'cancelled';
  const isMaint  = gate.status === 'maintenance';
  const isActive = gate.assignment_status === 'active';

  let borderColor = '#e8e8e8';
  let headerBg    = '#fafafa';
  let statusIcon  = null;

  if (isMaint) {
    borderColor = '#ff7875';
    headerBg    = '#fff1f0';
    statusIcon  = <ToolOutlined style={{ color: '#f5222d' }} />;
  } else if (isActive) {
    borderColor = '#52c41a';
    headerBg    = '#f6ffed';
    statusIcon  = <ThunderboltOutlined style={{ color: '#52c41a' }} />;
  } else if (occupied) {
    borderColor = '#1677ff';
    headerBg    = '#e6f4ff';
    statusIcon  = <ClockCircleOutlined style={{ color: '#1677ff' }} />;
  }

  return (
    <div style={{
      border: `2px solid ${borderColor}`,
      borderRadius: 12,
      background: '#fff',
      overflow: 'hidden',
      height: '100%',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Card header */}
      <div style={{
        background: headerBg,
        padding: '10px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${borderColor}40`,
      }}>
        <Text strong style={{ fontSize: 18, letterSpacing: 1 }}>
          {gate.code}
        </Text>
        <Space size={4}>
          {statusIcon}
          {gate.has_jetbridge ? (
            <Tooltip title="Jetbridge">
              <span style={{ fontSize: 10, background: '#e6f4ff', color: '#1677ff', borderRadius: 4, padding: '1px 5px' }}>JB</span>
            </Tooltip>
          ) : (
            <Tooltip title="Remote Stand">
              <span style={{ fontSize: 10, background: '#f5f5f5', color: '#595959', borderRadius: 4, padding: '1px 5px' }}>RM</span>
            </Tooltip>
          )}
          <span style={{ fontSize: 10, background: '#fff7e6', color: '#d46b08', borderRadius: 4, padding: '1px 5px' }}>
            Cat {gate.max_category}
          </span>
        </Space>
      </div>

      {/* Card body */}
      <div style={{ padding: '10px 14px' }}>
        {isMaint ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <ToolOutlined style={{ fontSize: 22, color: '#ff4d4f', marginBottom: 4 }} />
            <div><Text type="danger" style={{ fontSize: 12 }}>Under Maintenance</Text></div>
          </div>
        ) : occupied ? (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Space>
              <span style={{
                background: isActive ? '#f6ffed' : '#e6f4ff',
                color: isActive ? '#389e0d' : '#1677ff',
                border: `1px solid ${isActive ? '#b7eb8f' : '#91caff'}`,
                borderRadius: 12, padding: '1px 8px', fontSize: 11, fontWeight: 600,
              }}>
                {isActive ? 'ACTIVE' : 'PLANNED'}
              </span>
              <Text strong style={{ fontSize: 14 }}>{gate.flight_number}</Text>
            </Space>
            <Text style={{ fontSize: 12 }}>
              <Text type="secondary">{gate.origin_iata}</Text>
              <span style={{ margin: '0 4px', color: '#8c8c8c' }}>→</span>
              <Text type="secondary">{gate.dest_iata}</Text>
            </Text>
            <Text style={{ fontSize: 11, color: '#8c8c8c' }}>
              {dayjs(gate.from_time).format('HH:mm')} – {dayjs(gate.to_time).format('HH:mm')}
            </Text>
            <Space size={4} style={{ marginTop: 4 }}>
              {gate.assignment_status === 'planned' && (
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => onUpdate(gate.assignment_id, 'active')}
                  style={{ fontSize: 11, height: 24 }}
                >
                  Activate
                </Button>
              )}
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => onUpdate(gate.assignment_id, 'cancelled')}
                style={{ fontSize: 11, height: 24 }}
              >
                Release
              </Button>
            </Space>
          </Space>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 8 }}>
            <div style={{
              color: '#95de64',
              fontSize: 11,
              fontWeight: 600,
              marginBottom: 8,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}>
              Available
            </div>
            <Button
              size="small"
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => onAssign(gate)}
              style={{ borderRadius: 6, width: '100%', fontSize: 12 }}
            >
              Assign Flight
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function UtilizationCard({ label, value, color }) {
  return (
    <Card
      size="small"
      style={{ borderRadius: 10, background: '#fff' }}
      bodyStyle={{ padding: '12px 16px' }}
    >
      <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
      <div style={{ marginTop: 6 }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 4 }}>
          <Text strong style={{ fontSize: 22, color }}>{value}%</Text>
        </Row>
        <Progress
          percent={value}
          showInfo={false}
          strokeColor={color}
          trailColor="#f0f0f0"
          size="small"
          style={{ margin: 0 }}
        />
      </div>
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
    const refresh = () => fetchGates();
    socket.on('gate:assigned', refresh);
    socket.on('gate:updated',  refresh);
    return () => { socket.off('gate:assigned', refresh); socket.off('gate:updated', refresh); };
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

  const handleUpdate = async (id, status) => {
    await updateAssignment(id, { status });
    fetchGates();
  };

  const grouped = gates.reduce((acc, g) => {
    const key = `${g.terminal_code} — ${g.terminal_name}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  const total       = gates.length;
  const occupied    = gates.filter(g => g.assignment_id && g.assignment_status !== 'cancelled').length;
  const available   = gates.filter(g => g.status === 'active' && !g.assignment_id).length;
  const maintenance = gates.filter(g => g.status === 'maintenance').length;
  const utilPct     = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const availPct    = total > 0 ? Math.round((available / total) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>Gate Management</Title>
        <Space>
          <Select
            placeholder="All terminals"
            style={{ width: 180, borderRadius: 8 }}
            value={terminalId}
            onChange={setTerminalId}
            options={terminals.map(t => ({ value: t.id, label: `Terminal ${t.code}` }))}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={fetchGates} loading={loading} style={{ borderRadius: 8 }}>
            Refresh
          </Button>
        </Space>
      </Row>

      {/* Utilization summary */}
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <UtilizationCard label="Gate Utilization" value={utilPct} color="#1677ff" />
        </Col>
        <Col xs={12} sm={6}>
          <UtilizationCard label="Available" value={availPct} color="#52c41a" />
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10 }} bodyStyle={{ padding: '12px 16px' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Occupied Gates</Text>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff', marginTop: 4 }}>{occupied}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>of {total} total</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{ borderRadius: 10, borderColor: maintenance > 0 ? '#ff4d4f' : '#d9d9d9' }}
            bodyStyle={{ padding: '12px 16px' }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>Maintenance</Text>
            <div style={{ fontSize: 22, fontWeight: 700, color: maintenance > 0 ? '#f5222d' : '#52c41a', marginTop: 4 }}>
              {maintenance}
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>gates unavailable</Text>
          </Card>
        </Col>
      </Row>

      {/* Gates grid */}
      <Spin spinning={loading}>
        {Object.keys(grouped).length === 0 ? (
          <Empty description="No gates found. Select an airport to view gate status." />
        ) : (
          Object.entries(grouped).map(([terminal, termGates]) => {
            const tOccupied  = termGates.filter(g => g.assignment_id && g.assignment_status !== 'cancelled').length;
            const tAvailable = termGates.filter(g => g.status === 'active' && !g.assignment_id).length;
            const tUtil = termGates.length > 0 ? Math.round((tOccupied / termGates.length) * 100) : 0;

            return (
              <div key={terminal} style={{ marginBottom: 28 }}>
                <Row align="middle" style={{ marginBottom: 12 }} gutter={16}>
                  <Col>
                    <Title level={5} style={{ margin: 0 }}>Terminal {terminal}</Title>
                  </Col>
                  <Col>
                    <Space size={6}>
                      <span style={{
                        background: '#e6f4ff', color: '#1677ff',
                        borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600,
                      }}>
                        {tOccupied} occupied
                      </span>
                      <span style={{
                        background: '#f6ffed', color: '#389e0d',
                        borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600,
                      }}>
                        {tAvailable} free
                      </span>
                      <span style={{
                        background: '#f5f5f5', color: '#595959',
                        borderRadius: 6, padding: '2px 10px', fontSize: 12,
                      }}>
                        {tUtil}% util
                      </span>
                    </Space>
                  </Col>
                  <Col flex="auto">
                    <Progress
                      percent={tUtil}
                      showInfo={false}
                      strokeColor={tUtil > 80 ? '#f5222d' : tUtil > 60 ? '#fa8c16' : '#52c41a'}
                      trailColor="#f0f0f0"
                      size="small"
                      style={{ maxWidth: 160, margin: 0 }}
                    />
                  </Col>
                </Row>
                <Row gutter={[10, 10]}>
                  {termGates.map(gate => (
                    <Col key={gate.id} xs={12} sm={8} md={6} lg={4} xl={3}>
                      <GateCard gate={gate} onAssign={openAssign} onUpdate={handleUpdate} />
                    </Col>
                  ))}
                </Row>
              </div>
            );
          })
        )}
      </Spin>

      {/* Assign Flight Modal */}
      <Modal
        title={
          <Space>
            <PlusOutlined style={{ color: '#1677ff' }} />
            <span>Assign Flight to Gate <strong>{assignModal.gate?.code}</strong></span>
          </Space>
        }
        open={assignModal.open}
        onOk={handleAssign}
        onCancel={() => setAssignModal({ open: false, gate: null })}
        okText="Assign"
        width={520}
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
