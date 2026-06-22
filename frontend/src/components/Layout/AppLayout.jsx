import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Typography, Space, Badge, Button, theme, Divider } from 'antd';
import {
  DashboardOutlined, SwapOutlined, UserOutlined, LogoutOutlined,
  GatewayOutlined, AlertOutlined, ClockCircleOutlined,
  BulbOutlined, BulbFilled, BellOutlined,
  BarChartOutlined, LineChartOutlined, RadarChartOutlined, FileSearchOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../auth/AuthProvider';
import useAppStore from '../../store/useAppStore';
import { useNotifications } from '../../hooks/useNotifications';
import dayjs from 'dayjs';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const NAV_GROUPS = [
  {
    key: 'core',
    label: 'CORE',
    children: [
      { key: '/',          icon: <DashboardOutlined />,  label: 'Dashboard',          to: '/'          },
      { key: '/flights',   icon: <SwapOutlined />,       label: 'Flight Board',       to: '/flights'   },
      { key: '/gates',     icon: <GatewayOutlined />,    label: 'Gate Management',    to: '/gates'     },
      { key: '/incidents', icon: <AlertOutlined />,      label: 'Incidents',          to: '/incidents' },
    ],
  },
  {
    key: 'analytics',
    label: 'ANALYTICS',
    children: [
      { key: '/airlines', icon: <BarChartOutlined />,   label: 'Airline Performance', to: '/airlines' },
      { key: '/trends',   icon: <LineChartOutlined />,  label: 'Historical Trends',   to: '/trends'   },
      { key: '/map',      icon: <RadarChartOutlined />, label: 'Live Ops Map',        to: '/map'      },
    ],
  },
  {
    key: 'admin',
    label: 'ADMIN',
    children: [
      { key: '/audit', icon: <FileSearchOutlined />, label: 'Audit Log', to: '/audit' },
    ],
  },
];

function buildMenuItems(groups, collapsed) {
  if (collapsed) {
    return groups.flatMap(g => g.children.map(item => ({
      key:   item.key,
      icon:  item.icon,
      label: <Link to={item.to}>{item.label}</Link>,
    })));
  }
  return groups.map(g => ({
    type:     'group',
    label:    (
      <span style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
        {g.label}
      </span>
    ),
    children: g.children.map(item => ({
      key:   item.key,
      icon:  item.icon,
      label: <Link to={item.to}>{item.label}</Link>,
    })),
  }));
}

function ApocLogo({ collapsed }) {
  if (collapsed) {
    return (
      <div style={{
        margin: '12px 8px',
        borderRadius: 10,
        background: 'linear-gradient(135deg, #1677ff 0%, #003eb3 100%)',
        padding: '14px 8px',
        textAlign: 'center',
      }}>
        <GlobalOutlined style={{ fontSize: 20, color: '#fff' }} />
      </div>
    );
  }
  return (
    <div style={{
      margin: '12px',
      borderRadius: 12,
      background: 'linear-gradient(135deg, #1677ff 0%, #003eb3 100%)',
      padding: '18px 16px',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* decorative ring */}
      <div style={{
        position: 'absolute', right: -24, top: -24,
        width: 80, height: 80, borderRadius: '50%',
        background: 'rgba(255,255,255,0.07)',
      }} />
      <div style={{
        position: 'absolute', left: -16, bottom: -16,
        width: 60, height: 60, borderRadius: '50%',
        background: 'rgba(255,255,255,0.05)',
      }} />

      <div style={{
        fontSize: 28, fontWeight: 900, color: '#fff',
        letterSpacing: 8, lineHeight: 1, position: 'relative',
      }}>
        APOC
      </div>
      <div style={{
        width: 40, height: 2,
        background: 'rgba(255,255,255,0.4)',
        margin: '8px auto',
        borderRadius: 2,
      }} />
      <div style={{
        fontSize: 8.5, color: 'rgba(255,255,255,0.65)',
        letterSpacing: 1.8, position: 'relative',
        fontWeight: 600,
      }}>
        AIRPORT OPERATIONS CENTER
      </div>
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 4, position: 'relative' }}>
        {['MAA', 'BLR', 'DEL', 'BOM'].map(c => (
          <span key={c} style={{
            fontSize: 8, fontWeight: 700, letterSpacing: 0.5,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4, padding: '2px 5px', color: 'rgba(255,255,255,0.9)',
          }}>
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [time, setTime] = useState(dayjs());
  const location = useLocation();
  const { keycloak } = useAuth();
  const { airportCode, airportName, darkMode, toggleDarkMode } = useAppStore();
  const { unread, clearUnread } = useNotifications();
  const { token } = theme.useToken();

  useEffect(() => {
    const id = setInterval(() => setTime(dayjs()), 1000);
    return () => clearInterval(id);
  }, []);

  const username = keycloak.tokenParsed?.name
    || keycloak.tokenParsed?.preferred_username
    || 'User';

  const userMenu = {
    items: [{
      key: 'logout', icon: <LogoutOutlined />, label: 'Sign Out',
      onClick: () => keycloak.logout(),
    }],
  };

  const menuItems = buildMenuItems(NAV_GROUPS, collapsed);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={220}
        style={{
          background: '#0a0f1e',
          boxShadow: '2px 0 12px rgba(0,0,0,0.4)',
        }}
      >
        <ApocLogo collapsed={collapsed} />

        {!collapsed && (
          <div style={{
            height: 1, background: 'rgba(255,255,255,0.06)',
            margin: '0 12px 8px',
          }} />
        )}

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{
            background: 'transparent',
            borderRight: 0,
            fontSize: 13,
          }}
        />
      </Sider>

      <Layout style={{ background: token.colorBgLayout }}>
        <Header style={{
          background:     token.colorBgContainer,
          padding:        '0 20px',
          height:         56,
          lineHeight:     '56px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          borderBottom:   `1px solid ${token.colorBorderSecondary}`,
          position:       'sticky',
          top:             0,
          zIndex:          100,
        }}>
          {/* Left: Airport context */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: token.colorBgLayout,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 8, padding: '5px 14px',
            }}>
              <span style={{ fontSize: 16 }}>✈</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: token.colorPrimary }}>
                {airportCode || 'ALL'}
              </span>
              {airportName && (
                <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  — {airportName}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#52c41a',
                boxShadow: '0 0 6px #52c41a',
                display: 'inline-block',
                animation: 'pulse 2s infinite',
              }} />
              <Text style={{ fontSize: 11, color: '#52c41a', fontWeight: 600, letterSpacing: 1 }}>
                LIVE
              </Text>
            </div>
          </div>

          {/* Right: Controls */}
          <Space size={4}>
            {/* Clock */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: token.colorBgLayout,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 8, padding: '5px 12px',
            }}>
              <ClockCircleOutlined style={{ color: token.colorTextSecondary, fontSize: 12 }} />
              <Text style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, letterSpacing: 1 }}>
                {time.format('HH:mm:ss')}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>UTC+5:30</Text>
            </div>

            {/* Dark mode */}
            <Button
              type="text"
              size="small"
              title={darkMode ? 'Light Mode' : 'Dark Mode'}
              onClick={toggleDarkMode}
              style={{ width: 36, height: 36 }}
              icon={darkMode
                ? <BulbFilled style={{ color: '#fadb14', fontSize: 15 }} />
                : <BulbOutlined style={{ fontSize: 15 }} />}
            />

            {/* Notifications */}
            <Badge count={unread} size="small" overflowCount={9} offset={[-2, 2]}>
              <Button
                type="text"
                size="small"
                title="Notifications"
                onClick={clearUnread}
                style={{ width: 36, height: 36 }}
                icon={<BellOutlined style={{ fontSize: 15 }} />}
              />
            </Badge>

            {/* User */}
            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer', padding: '0 8px' }} size={8}>
                <Avatar
                  size={28}
                  style={{ background: 'linear-gradient(135deg, #1677ff, #0040a8)', fontSize: 12, fontWeight: 700 }}
                >
                  {username.charAt(0).toUpperCase()}
                </Avatar>
                <Text style={{ fontWeight: 500, fontSize: 13 }}>{username}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: '20px 24px', padding: 0, minHeight: 280 }}>
          {children}
        </Content>
      </Layout>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #52c41a; }
          50%       { opacity: 0.6; box-shadow: 0 0 2px #52c41a; }
        }
        .ant-menu-item-group-title { padding-top: 16px !important; }
      `}</style>
    </Layout>
  );
}
