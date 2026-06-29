import { useEffect, useState, useCallback } from 'react';
import {
  Row, Col, Typography, Space, Button, Tag, Select, Input,
  Drawer, Form, Descriptions, Empty, Pagination, theme,
} from 'antd';
import {
  AlertOutlined, PlusOutlined, ReloadOutlined, FireOutlined,
  ExclamationCircleOutlined, InfoCircleOutlined, CheckCircleOutlined,
  ClockCircleOutlined, SendOutlined, SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { getIncidents, createIncident, updateIncident } from '../api/incidents';
import useAppStore from '../store/useAppStore';
import socket, { joinAirport } from '../socket';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/* ─── Config ─────────────────────────────────────── */
const SEV = {
  critical: { color: '#f5222d', label: 'CRITICAL', icon: <FireOutlined />,             rank: 4 },
  high:     { color: '#fa8c16', label: 'HIGH',     icon: <ExclamationCircleOutlined />, rank: 3 },
  medium:   { color: '#fadb14', label: 'MEDIUM',   icon: <ExclamationCircleOutlined />, rank: 2 },
  low:      { color: '#52c41a', label: 'LOW',      icon: <InfoCircleOutlined />,        rank: 1 },
};

const STATUS_COLORS = {
  open:        '#f5222d',
  in_progress: '#1677ff',
  resolved:    '#52c41a',
  closed:      '#8c8c8c',
};

const INCIDENT_TYPES = [
  'technical', 'weather', 'security', 'medical', 'operational', 'fire', 'other',
];

/* ─── Gradient KPI card ──────────────────────────── */
function KpiCard({ label, value, sub, gradient, icon }) {
  return (
    <div style={{
      background: gradient, borderRadius: 12, padding: '16px 18px',
      color: '#fff', position: 'relative', overflow: 'hidden', height: '100%',
    }}>
      <div style={{ position: 'absolute', right: 10, top: 8, fontSize: 36, opacity: 0.1 }}>{icon}</div>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>
        {label.toUpperCase()}
      </Text>
      <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.1, marginTop: 6 }}>{value}</div>
      {sub && (
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 4, display: 'block' }}>
          {sub}
        </Text>
      )}
    </div>
  );
}

/* ─── Incident card ──────────────────────────────── */
function IncidentCard({ inc, token, onClick }) {
  const sev   = SEV[inc.severity] || SEV.low;
  const stCol = STATUS_COLORS[inc.status] || '#8c8c8c';
  const isOpen = ['open', 'in_progress'].includes(inc.status);

  return (
    <div
      onClick={() => onClick(inc)}
      style={{
        background:   token.colorBgContainer,
        border:       `1px solid ${token.colorBorderSecondary}`,
        borderLeft:   `4px solid ${sev.color}`,
        borderRadius: '0 10px 10px 0',
        padding:      '14px 16px',
        cursor:       'pointer',
        transition:   'box-shadow 0.2s, transform 0.1s',
        marginBottom: 8,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `0 4px 16px ${sev.color}30`;
        e.currentTarget.style.transform = 'translateX(2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateX(0)';
      }}
    >
      {/* Top row: badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: sev.color,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {sev.icon} {sev.label}
        </span>
        <span style={{
          fontSize: 10, padding: '1px 7px', borderRadius: 20, fontWeight: 700,
          background: `${stCol}18`, color: stCol, border: `1px solid ${stCol}50`,
        }}>
          {inc.status?.replace('_', ' ').toUpperCase()}
        </span>
        <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px', height: 18, padding: '0 5px' }}>
          {inc.type?.replace(/_/g, ' ')}
        </Tag>
        {isOpen && (
          <span style={{
            fontSize: 9, padding: '1px 6px', borderRadius: 10, fontWeight: 700,
            background: '#f5222d18', color: '#f5222d', border: '1px solid #f5222d40',
          }}>
            ACTIVE
          </span>
        )}
      </div>

      {/* Title */}
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 4, lineHeight: 1.4 }}>
        {inc.title}
      </Text>

      {/* Description preview */}
      {inc.description && (
        <Text type="secondary" style={{
          fontSize: 12, display: 'block', marginBottom: 8,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%',
        }}>
          {inc.description}
        </Text>
      )}

      {/* Meta row */}
      <Space size={10} wrap>
        {inc.airport_iata && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: token.colorPrimary,
            background: `${token.colorPrimary}15`,
            border: `1px solid ${token.colorPrimary}30`,
            borderRadius: 5, padding: '1px 7px',
          }}>
            {inc.airport_iata}
          </span>
        )}
        {inc.affected_flight_number && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            ✈ {inc.affected_flight_number}
          </Text>
        )}
        <Text type="secondary" style={{ fontSize: 11 }}>
          <ClockCircleOutlined style={{ marginRight: 3 }} />
          {dayjs(inc.created_at).fromNow()}
        </Text>
      </Space>
    </div>
  );
}

/* ─── Main component ─────────────────────────────── */
export default function Incidents() {
  const { airportId } = useAppStore();
  const { token }     = theme.useToken();

  const [incidents, setIncidents]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [drawer, setDrawer]         = useState({ open: false, inc: null });
  const [createOpen, setCreateOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [form] = Form.useForm();

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [sevFilter, setSevFilter]       = useState('all');
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const PAGE_SIZE = 10;

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (airportId) params.airport_id = airportId;
      const data = await getIncidents(params);
      setIncidents(data.data || data || []);
    } finally { setLoading(false); }
  }, [airportId]);

  useEffect(() => {
    fetchIncidents();
    if (airportId) joinAirport(airportId);
  }, [fetchIncidents, airportId]);

  useEffect(() => {
    const refresh = () => fetchIncidents();
    socket.on('incident:created', refresh);
    socket.on('incident:updated', refresh);
    return () => { socket.off('incident:created', refresh); socket.off('incident:updated', refresh); };
  }, [fetchIncidents]);

  /* ── Computed stats ── */
  const openCount     = incidents.filter(i => i.status === 'open').length;
  const inProgCount   = incidents.filter(i => i.status === 'in_progress').length;
  const critCount     = incidents.filter(i => i.severity === 'critical' && !['resolved','closed'].includes(i.status)).length;
  const resolvedToday = incidents.filter(i => i.status === 'resolved' && dayjs(i.updated_at).isAfter(dayjs().startOf('day'))).length;
  const criticalAlerts = incidents.filter(i => i.severity === 'critical' && i.status === 'open');

  /* ── Filter + sort ── */
  const filtered = incidents.filter(i => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (sevFilter !== 'all' && i.severity !== sevFilter) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    const rd = (SEV[b.severity]?.rank || 0) - (SEV[a.severity]?.rank || 0);
    if (rd !== 0) return rd;
    return dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf();
  });
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ── Chart data ── */
  const sevData = Object.keys(SEV)
    .map(k => ({ name: SEV[k].label, value: incidents.filter(i => i.severity === k).length, color: SEV[k].color }))
    .filter(d => d.value > 0);

  const typeData = INCIDENT_TYPES
    .map(t => ({ name: t.replace(/_/g, ' '), value: incidents.filter(i => i.type === t).length }))
    .filter(d => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);

  /* ── Handlers ── */
  const handleCreate = async () => {
    const values = await form.validateFields();
    await createIncident({ ...values, airport_id: airportId });
    form.resetFields();
    setCreateOpen(false);
    fetchIncidents();
  };

  const handleStatusChange = async (id, status) => {
    setStatusLoading(true);
    try {
      await updateIncident(id, { status });
      setDrawer(d => ({ ...d, inc: { ...d.inc, status } }));
      fetchIncidents();
    } finally { setStatusLoading(false); }
  };

  return (
    <div style={{ background: token.colorBgLayout, minHeight: '100%', paddingBottom: 24 }}>

      {/* Critical alert ribbons */}
      {criticalAlerts.map(inc => (
        <div key={inc.id} style={{
          background: 'linear-gradient(135deg, #a8071a, #f5222d)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 12, color: '#fff',
        }}>
          <FireOutlined style={{ fontSize: 16 }} />
          <Text style={{ color: '#fff', fontWeight: 700 }}>CRITICAL:</Text>
          <Text style={{ color: 'rgba(255,255,255,0.9)' }}>{inc.title}</Text>
          <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>
            {inc.airport_iata} · {dayjs(inc.created_at).fromNow()}
          </span>
        </div>
      ))}

      {/* Page header */}
      <div style={{
        background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 14, padding: '16px 20px', marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <AlertOutlined style={{ marginRight: 8, color: '#f5222d' }} />
            Incidents
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {incidents.length} total · {openCount + inProgCount} active · real-time updates
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchIncidents} loading={loading}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} danger
            onClick={() => { form.resetFields(); setCreateOpen(true); }}>
            Report Incident
          </Button>
        </Space>
      </div>

      {/* KPI row */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <KpiCard label="Open" value={openCount} sub="needs attention"
            gradient="linear-gradient(135deg,#f5222d,#a8071a)" icon={<AlertOutlined />} />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard label="In Progress" value={inProgCount} sub="being handled"
            gradient="linear-gradient(135deg,#1677ff,#003eb3)" icon={<ClockCircleOutlined />} />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard label="Critical Active" value={critCount} sub="immediate action"
            gradient={critCount > 0
              ? 'linear-gradient(135deg,#ff4d4f,#cf1322)'
              : 'linear-gradient(135deg,#389e0d,#135200)'}
            icon={<FireOutlined />} />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard label="Resolved Today" value={resolvedToday} sub="closed today"
            gradient="linear-gradient(135deg,#52c41a,#237804)" icon={<CheckCircleOutlined />} />
        </Col>
      </Row>

      {/* Main body */}
      <Row gutter={[16, 16]}>
        {/* LEFT: Incident list */}
        <Col xs={24} lg={15}>
          <div style={{
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 14, padding: 16,
          }}>
            {/* Filter bar */}
            <div style={{ marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* Status tabs */}
              <div style={{
                display: 'flex', gap: 4,
                background: token.colorBgLayout,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 8, padding: 3,
              }}>
                {[
                  { key: 'all',         label: 'All' },
                  { key: 'open',        label: 'Open' },
                  { key: 'in_progress', label: 'In Progress' },
                  { key: 'resolved',    label: 'Resolved' },
                ].map(opt => (
                  <button key={opt.key}
                    onClick={() => { setStatusFilter(opt.key); setPage(1); }}
                    style={{
                      border: 'none', cursor: 'pointer', borderRadius: 6,
                      padding: '3px 12px', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                      background: statusFilter === opt.key ? token.colorPrimary : 'transparent',
                      color: statusFilter === opt.key ? '#fff' : token.colorTextSecondary,
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>

              <Select
                value={sevFilter}
                onChange={v => { setSevFilter(v); setPage(1); }}
                style={{ width: 130 }} size="small"
                options={[
                  { value: 'all',      label: 'All severity' },
                  { value: 'critical', label: '🔴 Critical' },
                  { value: 'high',     label: '🟠 High' },
                  { value: 'medium',   label: '🟡 Medium' },
                  { value: 'low',      label: '🟢 Low' },
                ]}
              />

              <Input
                prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
                placeholder="Search incidents…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                allowClear size="small"
                style={{ flex: 1, minWidth: 160 }}
              />
            </div>

            {/* Incident cards */}
            {paginated.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary">No incidents match your filters</Text>}
                style={{ padding: '40px 0' }}
              />
            ) : (
              paginated.map(inc => (
                <IncidentCard key={inc.id} inc={inc} token={token}
                  onClick={i => setDrawer({ open: true, inc: i })} />
              ))
            )}

            {sorted.length > PAGE_SIZE && (
              <div style={{ textAlign: 'right', marginTop: 12 }}>
                <Pagination current={page} pageSize={PAGE_SIZE} total={sorted.length}
                  onChange={setPage} size="small" showTotal={t => `${t} incidents`} />
              </div>
            )}
          </div>
        </Col>

        {/* RIGHT: Charts */}
        <Col xs={24} lg={9}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div style={{
              background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 14, padding: 16,
            }}>
              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
                Severity Breakdown
              </Text>
              {sevData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={sevData} cx="50%" cy="50%"
                      innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                      {sevData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <ReTooltip contentStyle={{
                      background: 'rgba(15,20,35,0.95)',
                      border: `1px solid ${token.colorBorderSecondary}`,
                      borderRadius: 8, color: '#fff', fontSize: 12,
                    }} />
                    <Legend iconType="circle" iconSize={8}
                      formatter={v => <span style={{ fontSize: 11, color: token.colorText }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" style={{ padding: '20px 0' }} />
              )}
            </div>

            <div style={{
              background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 14, padding: 16,
            }}>
              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
                By Type
              </Text>
              {typeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={typeData} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: token.colorTextSecondary }}
                      axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={100}
                      tick={{ fontSize: 10, fill: token.colorTextSecondary }} axisLine={false} tickLine={false} />
                    <ReTooltip contentStyle={{
                      background: 'rgba(15,20,35,0.95)',
                      border: `1px solid ${token.colorBorderSecondary}`,
                      borderRadius: 8, color: '#fff', fontSize: 12,
                    }} />
                    <Bar dataKey="value" fill={token.colorPrimary} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" style={{ padding: '20px 0' }} />
              )}
            </div>
          </Space>
        </Col>
      </Row>

      {/* ── Detail Drawer ── */}
      <Drawer
        title={null}
        open={drawer.open}
        onClose={() => setDrawer({ open: false, inc: null })}
        width={480}
        styles={{ body: { padding: 0 } }}
      >
        {drawer.inc && (() => {
          const inc   = drawer.inc;
          const sev   = SEV[inc.severity] || SEV.low;
          const stCol = STATUS_COLORS[inc.status] || '#8c8c8c';
          return (
            <div>
              {/* Accent header */}
              <div style={{
                background:    `linear-gradient(135deg, ${sev.color}22, ${sev.color}08)`,
                borderBottom:  `3px solid ${sev.color}`,
                padding:       '20px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: sev.color, letterSpacing: 1.2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {sev.icon} {sev.label}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 20,
                    background: `${stCol}20`, color: stCol, border: `1px solid ${stCol}40`,
                  }}>
                    {inc.status?.replace('_', ' ').toUpperCase()}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: token.colorTextSecondary }}>#{inc.id}</span>
                </div>
                <Title level={4} style={{ margin: 0, lineHeight: 1.3 }}>{inc.title}</Title>
              </div>

              <div style={{ padding: '20px 24px' }}>
                <Descriptions column={2} size="small" style={{ marginBottom: 20 }}
                  labelStyle={{ color: token.colorTextSecondary, fontSize: 12 }}
                  contentStyle={{ fontSize: 13, fontWeight: 600 }}>
                  <Descriptions.Item label="Airport">{inc.airport_iata || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Type">{inc.type?.replace(/_/g, ' ') || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Flight">{inc.affected_flight_number || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Reported">{dayjs(inc.created_at).format('DD MMM, HH:mm')}</Descriptions.Item>
                </Descriptions>

                {inc.description && (
                  <div style={{
                    background: token.colorBgLayout,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: 10, padding: '14px 16px', marginBottom: 20,
                  }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
                      DESCRIPTION
                    </Text>
                    <Paragraph style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.6 }}>
                      {inc.description}
                    </Paragraph>
                  </div>
                )}

                {inc.status !== 'closed' && (
                  <div style={{
                    background: token.colorBgLayout,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: 10, padding: '14px 16px',
                  }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>
                      UPDATE STATUS
                    </Text>
                    <Space wrap>
                      {inc.status === 'open' && (
                        <Button size="small" type="primary" icon={<SendOutlined />}
                          loading={statusLoading}
                          onClick={() => handleStatusChange(inc.id, 'in_progress')}>
                          Start Response
                        </Button>
                      )}
                      {inc.status === 'in_progress' && (
                        <Button size="small" type="primary"
                          style={{ background: '#52c41a', borderColor: '#52c41a' }}
                          icon={<CheckCircleOutlined />}
                          loading={statusLoading}
                          onClick={() => handleStatusChange(inc.id, 'resolved')}>
                          Mark Resolved
                        </Button>
                      )}
                      {['resolved', 'in_progress'].includes(inc.status) && (
                        <Button size="small" type="text"
                          style={{ color: token.colorTextSecondary }}
                          loading={statusLoading}
                          onClick={() => handleStatusChange(inc.id, 'closed')}>
                          Close Incident
                        </Button>
                      )}
                    </Space>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Drawer>

      {/* ── Create Incident Drawer ── */}
      <Drawer
        title={
          <Space>
            <AlertOutlined style={{ color: '#f5222d' }} />
            <span>Report New Incident</span>
          </Space>
        }
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        width={480}
        extra={<Button type="primary" danger onClick={handleCreate}>Submit</Button>}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Incident Title" rules={[{ required: true }]}>
            <Input placeholder="Brief description of the incident" />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select options={INCIDENT_TYPES.map(t => ({ value: t, label: t.replace(/_/g, ' ') }))} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="severity" label="Severity" rules={[{ required: true }]}>
                <Select options={Object.keys(SEV).map(k => ({
                  value: k,
                  label: <span style={{ color: SEV[k].color, fontWeight: 700 }}>{SEV[k].label}</span>,
                }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="affected_flight_number" label="Affected Flight">
                <Input placeholder="e.g. AI202" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <TextArea rows={4} placeholder="Detailed description, actions taken, etc." />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
