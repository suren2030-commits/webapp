import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { AuthProvider } from './auth/AuthProvider';
import AppLayout from './components/Layout/AppLayout';
import Dashboard    from './pages/Dashboard';
import FlightBoard  from './pages/FlightBoard';
import GateManagement from './pages/GateManagement';
import Incidents    from './pages/Incidents';
import Airlines     from './pages/Airlines';
import Trends       from './pages/Trends';
import MapPage      from './pages/Map';
import Audit        from './pages/Audit';
import useAppStore  from './store/useAppStore';

export default function App() {
  const darkMode = useAppStore(s => s.darkMode);

  return (
    <ConfigProvider theme={{ algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      <AuthProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/"          element={<Dashboard />} />
              <Route path="/flights"   element={<FlightBoard />} />
              <Route path="/gates"     element={<GateManagement />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/airlines"  element={<Airlines />} />
              <Route path="/trends"    element={<Trends />} />
              <Route path="/map"       element={<MapPage />} />
              <Route path="/audit"     element={<Audit />} />
              <Route path="*"          element={<Navigate to="/" replace />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}
