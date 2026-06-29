import { useEffect, useState, useCallback } from 'react';
import {
  Row, Col, Tag, Select, Typography, Space, Button,
  Modal, Form, DatePicker, Input, Spin, Empty, Progress, Tooltip, theme,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ThunderboltOutlined, ToolOutlined, ClockCircleOutlined, GatewayOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getGates, getTerminals, assignFlight, updateAssignment } from '../api/gates';
import client from '../api/client';
import useAppStore from '../store/useAppStore';
import socket, { joinAirport } from '../socket';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/* ─── GateCard ───────────────────────────────────── */
function GateCard({ gate, token, onAssign, onUpdate }) {
  const occupied = !!gate.assignment_id && gate.assignment_status !== 'cancelled';
  const isMaint  = gate.status === 'maintenance';
  const isActive = gate.assignment_status === 'active';

  let accentColor, statusLabel;
  if (isMaint)      { accentColor = token.colorError;   statusLabel = 'MAINTENANCE'; }
  else if (isActive){ accentColor = token.colorSuccess;  statusLabel = 'ACTIVE'; }
  else if (occupied){ accentColor = token.colorPrimary;  statusLabel = 'PLANNED'; }
  else              { accentColor = token.colorBorderSecondary; statusLabel = 'FREE'; }

  const isAvailable = !isMaint && !occupied;

  return (
    <div style={{
      borderRadius: 10,
      background:   token.colorBgContainer,
      border:       `1px solid ${token.colorBorderSecondary}`,
      borderTop:    `3px solid ${accentColor}`,
      overflow:     'hidden',
      height:       '100%',
      transition:   'box-shadow 0.2s, transform 0.1s',
    }}>
      {/* Gate header */}
      <div style={{
        padding:        '8px 12px',
        background:     token.colorBgLayout,
        borderBottom:   `1px solid ${token.colorBorderSecondary}`,
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
      }}>
        <Text strong style={{ fontSize: 17, letterSpacing: 1 }}>{gate.code}</Text>
        <Space size={3}>
          {gate.has_jetbridge ? (
            <Tooltip title="Jetbridge">
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                background: `${token.colorPrimary}20`, color: token.colorPrimary,
                border: `1px solid ${token.colorPrimary}40`,
                borderRadius: 4, padding: '1px 5px',
              }}>JB</span>
            </Tooltip>
          ) : (
            <Tooltip title="Remote Stand">
              <span style={{
                fontSize: 9, color: token.colorTextTertiary,
                background: token.colorBgLayout,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 4, padding: '1px 5px',
              }}>RM</span>
            </Tooltip>
          )}
          <span style={{
            fontSize: 9, color: '#d46b08',
            background: '#fff7e615',
            border: '1px solid #ffd59140',
            borderRadius: 4, padding: '1px 5px', fontWeight: 600,
          }}>Cat {gate.max_category}</span>
        </Space>
      </div>

      {/* Status pill */}
      <div style={{
        padding: '4px 12px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: 1.2,
          color: accentColor,
        }}>
          {statusLabel}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 12px' }}>
        {isMaint ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <ToolOutlined style={{ fontSize: 20, color: token.colorError, marginBottom: 4 }} />
            <div>
              <Text style={{ fontSize: 12, color: token.colorError }}>Under Maintenance</Text>
            </div>
          </div>
        ) : occupied ? (
          <Space direction="vertical" size={5} style={{ width: '100%' }}>
            <Text strong style={{ fontSize: 14, letterSpacing: 0.5 }}>
              {isActive
                ? <ThunderboltOutlined style={{ color: token.colorSuccess, marginRight: 5 }} />
                : <ClockCircleOutlined style={{ color: token.colorPrimary, marginRight: 5 }} />}
              {gate.flight_number}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {gate.origin_iata}
              <span style={{ margin: '0 5px', color: token.colorTextTertiary }}>→</span>
              {gate.dest_iata}
            </Text>
            <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
              {dayjs(gate.from_time).format('HH:mm')} – {dayjs(gate.to_time).format('HH:mm')}
            </Text>
            <Space size={4} style={{ marginTop: 4 }}>
              {gate.assignment_status === 'planned' && (
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                  onClick={() => onUpdate(gate.assignment_id, 'active')}
                  style={{ fontSize: 11, height: 24 }}>
                  Activate
                </Button>
              )}
              <Button size="small" danger icon={<CloseCircleOutlined />}
                onClick={() => onUpdate(gate.assignment_id, 'cancelled')}
                style={{ fontSize: 11, height: 24 }}>
                Release
              </Button>
            </Space>
          </Space>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 6 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: token.colorSuccess,
              marginBottom: 8, letterSpacing: 1,
            }}>
              AVAILABLE
            </div>
            <Button size="small" type="dashed" icon={<PlusOutlined />}
              onClick={() => onAssign(gate)}
              style={{ borderRadius: 6, width: '100%', fontSize: 12 }}>
              Assign Flight
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Stat mini card ─────────────────────────────── */
function StatMini({ label, value, sub, gradient, icon }) {
  return (
    <div style={{
      background: gradient,
      borderRadius: 12, padding: '14px 18px',
      color: '#fff', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', right: 10, top: 10, fontSize: 32, opacity: 0.12 }}>
        {icon}
      </div>
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
      <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, marginTop: 6 }}>{value}</div>
      {sub && <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 4 }}>{sub}</Text>}
    </div>
  );
}

/* ─── Main component ─────────────────────────────── */
export default function GateManagement() {
  const { airportId } = useAppStore();
  const { token } = theme.useToken();

  const [gates, setGates]           = useState([]);
  const [terminals, setTerminals]   = useState([]);
  const [terminalId, setTerminalId] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [assignModal, setAssignModal] = useState({ open: false, gate: null });
  const [flights, setFlights]       = useState([]);
  const [form] = Form.useForm();

  const fetchGates = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (airportId)  params.airport_id  = airportId;
      if (terminalId) params.terminal_id = terminalId;
      setGates(await getGates(params));
    } finally { setLoading(false); }
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
    <div style={{ background: token.colorBgLayout, minHeight: '100%', paddingBottom: 24 }}>
      {/* Page header */}
      <div style={{
        background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 14, padding: '16px 20px', marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <GatewayOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
            Stand Management
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>Real-time stand status · click a stand to manage assignments</Text>
        </div>
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
      </div>

      {/* Stat cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <StatMini
            label="Stand Utilization" value={`${utilPct}%`}
            gradient="linear-gradient(135deg,#1890ff,#096dd9)"
            icon={<GatewayOutlined />}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatMini
            label="Available" value={available}
            sub="stands free now"
            gradient="linear-gradient(135deg,#52c41a,#237804)"
            icon={<CheckCircleOutlined />}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatMini
            label="Occupied" value={occupied}
            sub={`of ${total} total`}
            gradient="linear-gradient(135deg,#722ed1,#391085)"
            icon={<ThunderboltOutlined />}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatMini
            label="Maintenance" value={maintenance}
            sub="stands unavailable"
            gradient={maintenance > 0
              ? 'linear-gradient(135deg,#f5222d,#a8071a)'
              : 'linear-gradient(135deg,#389e0d,#135200)'}
            icon={<ToolOutlined />}
          />
        </Col>
      </Row>

      {/* Gates grid */}
      <Spin spinning={loading}>
        {Object.keys(grouped).length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 0',
            background: token.colorBgContainer,
            borderRadius: 14, border: `1px solid ${token.colorBorderSecondary}`,
          }}>
            <GatewayOutlined style={{ fontSize: 40, color: token.colorTextTertiary, marginBottom: 12 }} />
            <div>
              <Text type="secondary">No stands found. Select an airport to view stand status.</Text>
            </div>
          </div>
        ) : (
          Object.entries(grouped).map(([terminal, termGates]) => {
            const tOccupied  = termGates.filter(g => g.assignment_id && g.assignment_status !== 'cancelled').length;
            const tAvailable = termGates.filter(g => g.status === 'active' && !g.assignment_id).length;
            const tUtil = termGates.length > 0 ? Math.round((tOccupied / termGates.length) * 100) : 0;
            const utilColor = tUtil > 80 ? token.colorError : tUtil > 60 ? token.colorWarning : token.colorSuccess;

            return (
              <div key={terminal} style={{ marginBottom: 24 }}>
                {/* Terminal header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px', marginBottom: 12,
                  background: token.colorBgContainer,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: 10,
                }}>
                  <Text strong style={{ fontSize: 15 }}>Terminal {terminal}</Text>
                  <div style={{ flex: 1, maxWidth: 160 }}>
                    <Progress
                      percent={tUtil} showInfo={false}
                      strokeColor={utilColor}
                      trailColor={token.colorBorderSecondary}
                      size="small" style={{ margin: 0 }}
                    />
                  </div>
                  <Space size={6}>
                    {[
                      { val: tUtil + '%',  col: utilColor,           label: 'util' },
                      { val: tOccupied,    col: token.colorPrimary,  label: 'occ' },
                      { val: tAvailable,   col: token.colorSuccess,  label: 'free' },
                    ].map(b => (
                      <span key={b.label} style={{
                        fontSize: 11, fontWeight: 700, color: b.col,
                        background: `${b.col}18`,
                        border: `1px solid ${b.col}40`,
                        borderRadius: 6, padding: '2px 8px',
                      }}>
                        {b.val} {b.label}
                      </span>
                    ))}
                  </Space>
                </div>

                <Row gutter={[10, 10]}>
                  {termGates.map(gate => (
                    <Col key={gate.id} xs={12} sm={8} md={6} lg={4} xl={3}>
                      <GateCard gate={gate} token={token} onAssign={openAssign} onUpdate={handleUpdate} />
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
            <PlusOutlined style={{ color: token.colorPrimary }} />
            <span>Assign Flight to Stand <strong>{assignModal.gate?.code}</strong></span>
          </Space>
        }
        open={assignModal.open}
        onOk={handleAssign}
        onCancel={() => setAssignModal({ open: false, gate: null })}
        okText="Assign" width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="flight_id" label="Flight" rules={[{ required: true }]}>
            <Select
              showSearch placeholder="Search flight number"
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
