import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Typography, Space, Tag } from 'antd';
import {
  DashboardOutlined,
  SwapOutlined,
  UserOutlined,
  LogoutOutlined,
  GlobalOutlined,
  GatewayOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../auth/AuthProvider';
import useAppStore from '../../store/useAppStore';

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
  const location = useLocation();
  const { keycloak } = useAuth();
  const { airportCode, airportName } = useAppStore();

  const username = keycloak.tokenParsed?.preferred_username || 'User';

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Logout',
        onClick: () => keycloak.logout(),
      },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark">
        <div style={{ padding: '16px', textAlign: 'center', color: 'white' }}>
          {collapsed ? (
            <GlobalOutlined style={{ fontSize: 24 }} />
          ) : (
            <Text strong style={{ color: 'white', fontSize: 16 }}>APOC</Text>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={NAV_ITEMS}
        />
      </Sider>

      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
          <Space>
            {airportCode ? (
              <Tag color="blue" style={{ fontSize: 14 }}>
                {airportCode} — {airportName}
              </Tag>
            ) : (
              <Tag color="default">No airport selected</Tag>
            )}
          </Space>

          <Dropdown menu={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <Text>{username}</Text>
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ margin: '24px', minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
