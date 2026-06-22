import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Typography, Space, Tag, Badge } from 'antd';
import {
  DashboardOutlined, SwapOutlined, UserOutlined, LogoutOutlined,
  GlobalOutlined, GatewayOutlined, AlertOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../auth/AuthProvider';
import useAppStore from '../../store/useAppStore';
import dayjs from 'dayjs';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const NAV_ITEMS = [
  { key: '/',          icon: <DashboardOutlined />, label: <Link to="/">Dashboard</Link> },
  { key: '/flights',   icon: <SwapOutlined />,      label: <Link to="/flights">Flight Board</Link> },
  { key: '/gates',     icon: <GatewayOutlined />,   label: <Link to="/gates">Gate Management</Link> },
  { key: '/incidents', icon: <AlertOutlined />,     label: <Link to="/incidents">Incidents</Link> },
];

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [time, setTime] = useState(dayjs());
  const location = useLocation();
  const { keycloak } = useAuth();
  const { airportCode, airportName } = useAppStore();

  useEffect(() => {
    const id = setInterval(() => setTime(dayjs()), 1000);
    return () => clearInterval(id);
  }, []);

  const username = keycloak.tokenParsed?.name
    || keycloak.tokenParsed?.preferred_username
    || 'User';

  const userMenu = {
    items: [{
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: () => keycloak.logout(),
    }],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.15)' }}
      >
        <div style={{
          padding: collapsed ? '20px 8px' : '20px 16px',
          textAlign: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          marginBottom: 8,
        }}>
          {collapsed ? (
            <GlobalOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          ) : (
            <Space direction="vertical" size={2}>
              <Text strong style={{ color: '#fff', fontSize: 18, letterSpacing: 2 }}>APOC</Text>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>
                AIRPORT OPERATIONS
              </Text>
            </Space>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={NAV_ITEMS}
          style={{ borderRight: 0 }}
        />
      </Sider>

      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
          boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          <Space size={12}>
            {airportCode ? (
              <Tag
                color="blue"
                style={{ fontSize: 13, padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}
              >
                ✈ {airportCode} — {airportName}
              </Tag>
            ) : (
              <Tag color="default" style={{ fontSize: 13, padding: '3px 10px' }}>
                ✈ All Airports
              </Tag>
            )}
            <Badge status="processing" color="green" />
            <Text type="secondary" style={{ fontSize: 12 }}>LIVE</Text>
          </Space>

          <Space size={20}>
            <Space size={6}>
              <ClockCircleOutlined style={{ color: '#8c8c8c', fontSize: 13 }} />
              <Text style={{ fontFamily: 'monospace', fontSize: 14, color: '#595959', fontWeight: 500 }}>
                {time.format('HH:mm:ss')}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {time.format('DD MMM YYYY')}
              </Text>
            </Space>

            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  icon={<UserOutlined />}
                  style={{ background: '#1677ff' }}
                  size="small"
                />
                <Text style={{ fontWeight: 500 }}>{username}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{
          margin: '20px 24px',
          padding: 0,
          minHeight: 280,
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
