import { useEffect, useState, useCallback, useRef } from 'react';
import { Table, Tabs, Tag, Typography, Space, DatePicker, Badge, Tooltip, Input, Button } from 'antd';
import { SearchOutlined, WifiOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getFlights } from '../api/flights';
import socket, { joinAirport, leaveAirport } from '../socket';
import useAppStore from '../store/useAppStore';

const { Title, Text } = Typography;

const STATUS_CONFIG = {
  scheduled: { color: 'blue',    label: 'Scheduled' },
  boarding:  { color: 'cyan',    label: 'Boarding'  },
  departed:  { color: 'green',   label: 'Departed'  },
  arrived:   { color: 'green',   label: 'Arrived'   },
  delayed:   { color: 'orange',  label: 'Delayed'   },
  cancelled: { color: 'red',     label: 'Cancelled' },
  diverted:  { color: 'purple',  label: 'Diverted'  },
};

function delayMinutes(scheduled, estimated) {
  if (!estimated || !scheduled) return null;
  return dayjs(estimated).diff(dayjs(scheduled), 'minute');
}

function TimeCell({ scheduled, estimated }) {
  const delay = delayMinutes(scheduled, estimated);
  return (
    <Space direction="vertical" size={0}>
      <Text>{dayjs(scheduled).format('HH:mm')}</Text>
      {delay !== null && delay > 0 && (
        <Text type="danger" style={{ fontSize: 11 }}>+{delay}m</Text>
      )}
    </Space>
  );
}

const DEPARTURE_COLS = [
  {
    title: 'Flight',
    dataIndex: 'flight_number',
    render: (v, r) => <Space><Text strong>{v}</Text><Text type="secondary" style={{ fontSize: 11 }}>{r.airline_iata}</Text></Space>,
    width: 110,
  },
  { title: 'Destination', dataIndex: 'dest_iata', render: (v, r) => <Tooltip title={r.dest_name}><Text>{v}</Text></Tooltip>, width: 110 },
  { title: 'Scheduled', dataIndex: 'scheduled_departure', render: (v, r) => <TimeCell scheduled={v} estimated={r.estimated_departure} />, width: 90 },
  {
    title: 'Status',
    dataIndex: 'status',
    render: (v) => <Tag color={STATUS_CONFIG[v]?.color}>{STATUS_CONFIG[v]?.label ?? v}</Tag>,
    width: 110,
    filters: Object.entries(STATUS_CONFIG).map(([k, v]) => ({ text: v.label, value: k })),
    onFilter: (value, record) => record.status === value,
  },
  { title: 'Gate', dataIndex: 'gate_code', render: (v) => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text>, width: 70 },
  { title: 'Aircraft', dataIndex: 'aircraft_model', render: (v) => v || '—', width: 100 },
  { title: 'PAX', dataIndex: 'passenger_count', render: (v) => v ?? '—', width: 60 },
];

const ARRIVAL_COLS = [
  {
    title: 'Flight',
    dataIndex: 'flight_number',
    render: (v, r) => <Space><Text strong>{v}</Text><Text type="secondary" style={{ fontSize: 11 }}>{r.airline_iata}</Text></Space>,
    width: 110,
  },
  { title: 'Origin', dataIndex: 'origin_iata', render: (v, r) => <Tooltip title={r.origin_name}><Text>{v}</Text></Tooltip>, width: 110 },
  { title: 'Scheduled', dataIndex: 'scheduled_arrival', render: (v, r) => <TimeCell scheduled={v} estimated={r.estimated_arrival} />, width: 90 },
  {
    title: 'Status',
    dataIndex: 'status',
    render: (v) => <Tag color={STATUS_CONFIG[v]?.color}>{STATUS_CONFIG[v]?.label ?? v}</Tag>,
    width: 110,
    filters: Object.entries(STATUS_CONFIG).map(([k, v]) => ({ text: v.label, value: k })),
    onFilter: (value, record) => record.status === value,
  },
  { title: 'Gate', dataIndex: 'gate_code', render: (v) => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text>, width: 70 },
  { title: 'Aircraft', dataIndex: 'aircraft_model', render: (v) => v || '—', width: 100 },
  { title: 'PAX', dataIndex: 'passenger_count', render: (v) => v ?? '—', width: 60 },
];

export default function FlightBoard() {
  const { airportId } = useAppStore();
  const [flights, setFlights]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [tab, setTab]           = useState('departure');
  const [date, setDate]         = useState(dayjs());
  const [search, setSearch]     = useState('');
  const [liveCount, setLiveCount] = useState(0);
  const flightsRef = useRef(flights);
  flightsRef.current = flights;

  const fetchFlights = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        flight_type: tab,
        date: date.format('YYYY-MM-DD'),
        limit: 200,
      };
      if (airportId) params.airport_id = airportId;
      const data = await getFlights(params);
      setFlights(data.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [tab, date, airportId]);

  useEffect(() => {
    fetchFlights();
  }, [fetchFlights]);

  // Socket.io real-time updates
  useEffect(() => {
    if (!airportId) return;
    joinAirport(airportId);

    const handleUpdate = (updated) => {
      setFlights(prev =>
        prev.map(f => f.id === updated.id ? { ...f, ...updated } : f)
      );
      setLiveCount(c => c + 1);
    };

    socket.on('flight:updated', handleUpdate);
    return () => {
      socket.off('flight:updated', handleUpdate);
      leaveAirport(airportId);
    };
  }, [airportId]);

  const filtered = search
    ? flights.filter(f =>
        f.flight_number.toLowerCase().includes(search.toLowerCase()) ||
        f.origin_iata?.toLowerCase().includes(search.toLowerCase()) ||
        f.dest_iata?.toLowerCase().includes(search.toLowerCase())
      )
    : flights;

  const tabs = [
    {
      key: 'departure',
      label: `Departures (${tab === 'departure' ? filtered.length : '—'})`,
      children: (
        <Table
          rowKey="id"
          columns={DEPARTURE_COLS}
          dataSource={filtered}
          loading={loading}
          size="middle"
          scroll={{ x: 700 }}
          pagination={{ pageSize: 50, showSizeChanger: true }}
          rowClassName={(r) => r.status === 'cancelled' ? 'row-cancelled' : ''}
        />
      ),
    },
    {
      key: 'arrival',
      label: `Arrivals (${tab === 'arrival' ? filtered.length : '—'})`,
      children: (
        <Table
          rowKey="id"
          columns={ARRIVAL_COLS}
          dataSource={filtered}
          loading={loading}
          size="middle"
          scroll={{ x: 700 }}
          pagination={{ pageSize: 50, showSizeChanger: true }}
          rowClassName={(r) => r.status === 'cancelled' ? 'row-cancelled' : ''}
        />
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Space>
          <Title level={4} style={{ margin: 0 }}>Flight Board</Title>
          {liveCount > 0 && (
            <Badge count={liveCount} overflowCount={99}>
              <Tag icon={<WifiOutlined />} color="green">Live</Tag>
            </Badge>
          )}
        </Space>
        <Space wrap>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search flight, origin, destination"
            style={{ width: 260 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
          />
          <DatePicker
            value={date}
            onChange={d => d && setDate(d)}
            allowClear={false}
          />
          <Button onClick={fetchFlights} loading={loading}>Refresh</Button>
        </Space>
      </Space>

      <Tabs
        activeKey={tab}
        onChange={(k) => { setTab(k); setLiveCount(0); }}
        items={tabs}
      />

      <style>{`.row-cancelled td { opacity: 0.5; text-decoration: line-through; }`}</style>
    </div>
  );
}
