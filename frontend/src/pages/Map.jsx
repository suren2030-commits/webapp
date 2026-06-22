import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Typography, Space, Badge, Button, Spin, Tag } from 'antd';
import { ReloadOutlined, RadarChartOutlined } from '@ant-design/icons';
import { getLiveStats } from '../api/analytics';
import client from '../api/client';

const { Title, Text } = Typography;

// India SVG map: viewBox 0 0 550 600
// Scale: x = (lon - 68) * 18.33,  y = (37 - lat) * 20
const INDIA_PATH =
  'M 115 0 L 185 18 L 215 62 L 330 175 L 445 198 L 510 178 L 445 280 ' +
  'L 382 298 L 348 338 L 300 345 L 225 475 L 200 560 L 175 578 L 148 558 ' +
  'L 108 438 L 90 358 L 70 320 L 38 292 L 10 280 L 38 200 L 110 138 L 128 80 Z';

const AIRPORTS = [
  { id: 1, iata: 'MAA', name: 'Chennai',   lat: 13.08, lon: 80.27 },
  { id: 2, iata: 'BLR', name: 'Bangalore', lat: 13.20, lon: 77.71 },
  { id: 3, iata: 'DEL', name: 'Delhi',     lat: 28.56, lon: 77.10 },
  { id: 4, iata: 'BOM', name: 'Mumbai',    lat: 19.09, lon: 72.87 },
];

function toSvgX(lon) { return (lon - 68) * 18.33; }
function toSvgY(lat) { return (37 - lat) * 20; }

function otpColor(otp) {
  if (otp == null) return '#8c8c8c';
  return otp >= 85 ? '#52c41a' : otp >= 70 ? '#fa8c16' : '#f5222d';
}

function AirportBubble({ airport, stats, selected, onClick }) {
  const cx  = toSvgX(airport.lon);
  const cy  = toSvgY(airport.lat);
  const otp = stats ? Number(stats.otp_percentage ?? 0) : null;
  const col = otpColor(otp);
  const r   = stats ? Math.max(20, Math.min(38, 18 + (Number(stats.total_flights ?? 0) / 12))) : 20;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <circle cx={cx} cy={cy} r={r + 6} fill={col} opacity={selected ? 0.25 : 0.12} />
      <circle cx={cx} cy={cy} r={r} fill={col} opacity={selected ? 0.9 : 0.75}
        stroke={selected ? '#fff' : col} strokeWidth={selected ? 2.5 : 1} />
      <text x={cx} y={cy - 2} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700}>
        {airport.iata}
      </text>
      {stats && (
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#fff" fontSize={9}>
          {Number(stats.total_flights ?? 0)}f
        </text>
      )}
    </g>
  );
}

export default function MapPage() {
  const [allAirports, setAllAirports] = useState([]);
  const [statsMap, setStatsMap]       = useState({});
  const [selected, setSelected]       = useState(null);
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    client.get('/api/airports').then(r => setAllAirports(r.data)).catch(() => {});
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        AIRPORTS.map(a => getLiveStats({ airport_id: a.id }))
      );
      const map = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') map[AIRPORTS[i].id] = r.value;
      });
      setStatsMap(map);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 30000); return () => clearInterval(id); }, [fetchAll]);

  const sel = selected ? AIRPORTS.find(a => a.id === selected) : null;
  const selStats = sel ? statsMap[sel.id] : null;

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <RadarChartOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Live Ops Map
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>Bubble size = flights · Color = OTP health · Auto-refresh 30s</Text>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>Refresh</Button>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* SVG Map */}
        <Col xs={24} lg={14}>
          <Card style={{ borderRadius: 12, overflow: 'hidden' }} bodyStyle={{ padding: 12 }}>
            <Spin spinning={loading && Object.keys(statsMap).length === 0}>
              <svg viewBox="0 0 550 600" style={{ width: '100%', maxHeight: 520 }}>
                {/* Ocean background */}
                <rect width="550" height="600" fill="#e8f4f8" />
                {/* Grid */}
                {[0,1,2,3,4,5].map(i => (
                  <line key={`v${i}`} x1={i*110} y1={0} x2={i*110} y2={600} stroke="#d0e8f0" strokeWidth={0.5} />
                ))}
                {[0,1,2,3,4,5].map(i => (
                  <line key={`h${i}`} x1={0} y1={i*120} x2={550} y2={i*120} stroke="#d0e8f0" strokeWidth={0.5} />
                ))}
                {/* India outline */}
                <path d={INDIA_PATH} fill="#f5f0e8" stroke="#c8b89a" strokeWidth={1.5} />
                {/* Airport bubbles */}
                {AIRPORTS.map(ap => (
                  <AirportBubble
                    key={ap.id}
                    airport={ap}
                    stats={statsMap[ap.id]}
                    selected={selected === ap.id}
                    onClick={() => setSelected(selected === ap.id ? null : ap.id)}
                  />
                ))}
                {/* Legend */}
                {[
                  { col: '#52c41a', label: 'OTP ≥ 85%', x: 20 },
                  { col: '#fa8c16', label: 'OTP 70–84%', x: 120 },
                  { col: '#f5222d', label: 'OTP < 70%', x: 235 },
                ].map(l => (
                  <g key={l.label}>
                    <circle cx={l.x + 6} cy={588} r={5} fill={l.col} />
                    <text x={l.x + 15} y={592} fontSize={10} fill="#555">{l.label}</text>
                  </g>
                ))}
              </svg>
            </Spin>
          </Card>
        </Col>

        {/* Side panel */}
        <Col xs={24} lg={10}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {/* Airport detail card */}
            {sel && selStats && (
              <Card
                title={
                  <Space>
                    <Text strong style={{ fontSize: 18 }}>{sel.iata}</Text>
                    <Text type="secondary">{sel.name}</Text>
                  </Space>
                }
                style={{ borderRadius: 12, borderTop: `4px solid ${otpColor(Number(selStats.otp_percentage ?? 0))}` }}
                bodyStyle={{ padding: '14px 16px' }}
              >
                <Row gutter={[12, 12]}>
                  {[
                    { label: 'Total Flights',  value: Number(selStats.total_flights ?? 0)                  },
                    { label: 'Departed',       value: Number(selStats.departed ?? 0)                       },
                    { label: 'OTP %',          value: `${Number(selStats.otp_percentage ?? 0)}%`          },
                    { label: 'Delayed',        value: Number(selStats.delayed ?? 0)                        },
                    { label: 'Boarding',       value: Number(selStats.boarding ?? 0)                       },
                    { label: 'Open Incidents', value: Number(selStats.open_incidents ?? 0)                 },
                  ].map(item => (
                    <Col key={item.label} span={12}>
                      <Text type="secondary" style={{ fontSize: 11 }}>{item.label}</Text>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{item.value}</div>
                    </Col>
                  ))}
                </Row>
              </Card>
            )}

            {/* All airport summary list */}
            {AIRPORTS.map(ap => {
              const s   = statsMap[ap.id];
              const otp = s ? Number(s.otp_percentage ?? 0) : null;
              const col = otpColor(otp);
              return (
                <Card
                  key={ap.id}
                  size="small"
                  style={{
                    borderRadius: 10,
                    borderLeft: `4px solid ${col}`,
                    cursor: 'pointer',
                    background: selected === ap.id ? `${col}10` : undefined,
                  }}
                  bodyStyle={{ padding: '10px 14px' }}
                  onClick={() => setSelected(selected === ap.id ? null : ap.id)}
                >
                  <Row align="middle" justify="space-between">
                    <Col>
                      <Space>
                        <Text strong style={{ fontSize: 16, color: col }}>{ap.iata}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{ap.name}</Text>
                      </Space>
                    </Col>
                    <Col>
                      {s ? (
                        <Space size={12}>
                          <span>
                            <Text style={{ fontSize: 13, fontWeight: 700 }}>{Number(s.total_flights ?? 0)}</Text>
                            <Text type="secondary" style={{ fontSize: 11 }}> flt</Text>
                          </span>
                          <Tag color={otp >= 85 ? 'success' : otp >= 70 ? 'warning' : 'error'} style={{ margin: 0 }}>
                            {otp}% OTP
                          </Tag>
                          {Number(s.delayed ?? 0) > 0 && (
                            <Badge count={Number(s.delayed)} style={{ background: '#fa8c16' }} />
                          )}
                        </Space>
                      ) : (
                        <Text type="secondary">—</Text>
                      )}
                    </Col>
                  </Row>
                </Card>
              );
            })}
          </Space>
        </Col>
      </Row>
    </div>
  );
}
