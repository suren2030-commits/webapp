import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Table, Tag, Typography, Space, DatePicker, Badge, Tooltip,
  Input, Button, Row, Col, Card,
} from 'antd';
import { SearchOutlined, WifiOutlined, ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getFlights } from '../api/flights';
import socket, { joinAirport, leaveAirport } from '../socket';
import useAppStore from '../store/useAppStore';

const { Title, Text } = Typography;

const STATUS_CONFIG = {
  scheduled: { color: '#1677ff',  bg: '#e6f4ff',  dot: 'processing', label: 'Scheduled' },
  boarding:  { color: '#08979c',  bg: '#e6fffb',  dot: 'processing', label: 'Boarding'  },
  departed:  { color: '#389e0d',  bg: '#f6ffed',  dot: 'success',    label: 'Departed'  },
  arrived:   { color: '#52c41a',  bg: '#f6ffed',  dot: 'success',    label: 'Arrived'   },
  delayed:   { color: '#d46b08',  bg: '#fff7e6',  dot: 'warning',    label: 'Delayed'   },
  cancelled: { color: '#cf1322',  bg: '#fff1f0',  dot: 'error',      label: 'Cancelled' },
  diverted:  { color: '#531dab',  bg: '#f9f0ff',  dot: 'warning',    label: 'Diverted'  },
};

const STATUS_ORDER = ['boarding', 'delayed', 'scheduled', 'departed', 'arrived', 'cancelled', 'diverted'];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: '#8c8c8c', bg: '#f5f5f5', label: status };
  return (
    <span style={{
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.color}40`,
      borderRadius: 20,
      padding: '2px 10px',
      fontSize: 12,
      fontWeight: 600,
      display: 'inline-block',
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function TimeCell({ scheduled, estimated, type }) {
  const delay = scheduled && estimated
    ? dayjs(estimated).diff(dayjs(scheduled), 'minute')
    : null;
  return (
    <Space direction="vertical" size={0}>
      <Text style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 14 }}>
        {dayjs(scheduled).format('HH:mm')}
      </Text>
      {delay !== null && delay > 1 && (
        <Text style={{ fontSize: 11, color: '#d46b08', fontWeight: 600 }}>
          +{delay}m late
        </Text>
      )}
    </Space>
  );
}

function AirportCell({ iata, name }) {
  return (
    <Tooltip title={name}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Text strong style={{ fontSize: 15, letterSpacing: 1 }}>{iata}</Text>
        <Text type="secondary" style={{ fontSize: 10, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </Text>
      </div>
    </Tooltip>
  );
}

function SummaryBar({ flights }) {
  const counts = flights.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1;
    return acc;
  }, {});

  const items = STATUS_ORDER.filter(s => counts[s]).map(s => ({
    ...STATUS_CONFIG[s],
    status: s,
    count: counts[s],
  }));

  return (
    <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
      {items.map(item => (
        <Col key={item.status}>
          <div style={{
            background: item.bg,
            border: `1px solid ${item.color}40`,
            borderRadius: 8,
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: item.color, display: 'inline-block',
            }} />
            <Text style={{ color: item.color, fontWeight: 700, fontSize: 15 }}>{item.count}</Text>
            <Text style={{ color: item.color, fontSize: 12 }}>{item.label}</Text>
          </div>
        </Col>
      ))}
    </Row>
  );
}

function buildColumns(type) {
  const isDep = type === 'departure';
  return [
    {
      title: 'Flight',
      dataIndex: 'flight_number',
      width: 120,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 14, letterSpacing: 1 }}>{v}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.airline_iata} · {r.aircraft_model || 'N/A'}</Text>
        </Space>
      ),
    },
    {
      title: isDep ? 'Destination' : 'Origin',
      dataIndex: isDep ? 'dest_iata' : 'origin_iata',
      width: 130,
      render: (v, r) => (
        <AirportCell
          iata={v}
          name={isDep ? r.dest_name : r.origin_name}
        />
      ),
    },
    {
      title: isDep ? 'Departs' : 'Arrives',
      dataIndex: isDep ? 'scheduled_departure' : 'scheduled_arrival',
      width: 90,
      sorter: (a, b) => {
        const ka = isDep ? 'scheduled_departure' : 'scheduled_arrival';
        return dayjs(a[ka]).valueOf() - dayjs(b[ka]).valueOf();
      },
      defaultSortOrder: 'ascend',
      render: (v, r) => (
        <TimeCell
          scheduled={v}
          estimated={isDep ? r.estimated_departure : r.estimated_arrival}
          type={type}
        />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      filters: Object.entries(STATUS_CONFIG).map(([k, v]) => ({ text: v.label, value: k })),
      onFilter: (value, record) => record.status === value,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: 'Gate',
      dataIndex: 'gate_code',
      width: 70,
      render: (v) => v ? (
        <span style={{
          background: '#f0f5ff',
          color: '#2f54eb',
          border: '1px solid #adc6ff',
          borderRadius: 6,
          padding: '2px 8px',
          fontWeight: 700,
          fontSize: 13,
        }}>
          {v}
        </span>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'PAX',
      dataIndex: 'passenger_count',
      width: 60,
      render: (v) => v != null ? (
        <Text style={{ fontSize: 13 }}>{v}</Text>
      ) : <Text type="secondary">—</Text>,
    },
  ];
}

const TAB_STYLE_ACTIVE = {
  background: '#1677ff',
  color: '#fff',
  border: '1px solid #1677ff',
};
const TAB_STYLE_INACTIVE = {
  background: '#fff',
  color: '#595959',
  border: '1px solid #d9d9d9',
};

export default function FlightBoard() {
  const { airportId } = useAppStore();
  const [flights, setFlights]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [tab, setTab]           = useState('departure');
  const [date, setDate]         = useState(dayjs());
  const [search, setSearch]     = useState('');
  const [liveCount, setLiveCount] = useState(0);

  const fetchFlights = useCallback(async () => {
    setLoading(true);
    try {
      const params = { flight_type: tab, date: date.format('YYYY-MM-DD'), limit: 200 };
      if (airportId) params.airport_id = airportId;
      const data = await getFlights(params);
      setFlights(data.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [tab, date, airportId]);

  useEffect(() => { fetchFlights(); }, [fetchFlights]);

  useEffect(() => {
    if (!airportId) return;
    joinAirport(airportId);
    const handleUpdate = (updated) => {
      setFlights(prev => prev.map(f => f.id === updated.id ? { ...f, ...updated } : f));
      setLiveCount(c => c + 1);
    };
    socket.on('flight:updated', handleUpdate);
    return () => { socket.off('flight:updated', handleUpdate); leaveAirport(airportId); };
  }, [airportId]);

  const filtered = search
    ? flights.filter(f =>
        f.flight_number?.toLowerCase().includes(search.toLowerCase()) ||
        f.origin_iata?.toLowerCase().includes(search.toLowerCase()) ||
        f.dest_iata?.toLowerCase().includes(search.toLowerCase()) ||
        f.gate_code?.toLowerCase().includes(search.toLowerCase())
      )
    : flights;

  const getRowStyle = (record) => {
    if (record.status === 'cancelled') return { opacity: 0.55, textDecoration: 'line-through', background: '#fff1f0' };
    if (record.status === 'boarding')  return { background: '#e6fffb' };
    if (record.status === 'delayed')   return { background: '#fffbe6' };
    return {};
  };

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Space align="center" size={12}>
          <Title level={3} style={{ margin: 0 }}>Flight Board</Title>
          {liveCount > 0 && (
            <Badge count={liveCount} overflowCount={99} style={{ background: '#52c41a' }}>
              <span style={{
                background: '#f6ffed',
                border: '1px solid #52c41a',
                color: '#237804',
                borderRadius: 20,
                padding: '2px 10px',
                fontSize: 12,
                fontWeight: 600,
              }}>
                <WifiOutlined style={{ marginRight: 4 }} />LIVE
              </span>
            </Badge>
          )}
        </Space>
        <Space wrap>
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Search flight, airport, gate…"
            style={{ width: 240, borderRadius: 8 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
          />
          <DatePicker
            value={date}
            onChange={d => d && setDate(d)}
            allowClear={false}
            style={{ borderRadius: 8 }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchFlights}
            loading={loading}
            style={{ borderRadius: 8 }}
          >
            Refresh
          </Button>
        </Space>
      </Row>

      {/* Departure / Arrival Toggle */}
      <Row style={{ marginBottom: 16 }} gutter={0}>
        <Col>
          <Space size={0}>
            <button
              onClick={() => { setTab('departure'); setLiveCount(0); }}
              style={{
                ...(tab === 'departure' ? TAB_STYLE_ACTIVE : TAB_STYLE_INACTIVE),
                padding: '7px 22px',
                borderRadius: '8px 0 0 8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <ArrowUpOutlined /> Departures
              <span style={{
                background: tab === 'departure' ? 'rgba(255,255,255,0.3)' : '#f0f0f0',
                borderRadius: 10,
                padding: '1px 7px',
                fontSize: 12,
              }}>
                {tab === 'departure' ? filtered.length : ''}
              </span>
            </button>
            <button
              onClick={() => { setTab('arrival'); setLiveCount(0); }}
              style={{
                ...(tab === 'arrival' ? TAB_STYLE_ACTIVE : TAB_STYLE_INACTIVE),
                padding: '7px 22px',
                borderRadius: '0 8px 8px 0',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 6,
                marginLeft: -1,
              }}
            >
              <ArrowDownOutlined /> Arrivals
              <span style={{
                background: tab === 'arrival' ? 'rgba(255,255,255,0.3)' : '#f0f0f0',
                borderRadius: 10,
                padding: '1px 7px',
                fontSize: 12,
              }}>
                {tab === 'arrival' ? filtered.length : ''}
              </span>
            </button>
          </Space>
        </Col>
      </Row>

      {/* Summary pill bar */}
      {filtered.length > 0 && <SummaryBar flights={filtered} />}

      {/* Table */}
      <Card
        style={{ borderRadius: 12, overflow: 'hidden' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          rowKey="id"
          columns={buildColumns(tab)}
          dataSource={filtered}
          loading={loading}
          size="middle"
          scroll={{ x: 700 }}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showTotal: (t) => `${t} flights`,
          }}
          onRow={(record) => ({ style: getRowStyle(record) })}
          style={{ fontSize: 13 }}
        />
      </Card>
    </div>
  );
}
