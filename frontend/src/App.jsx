import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { AuthProvider } from './auth/AuthProvider';
import AppLayout from './components/Layout/AppLayout';
import Dashboard from './pages/Dashboard';
import FlightBoard from './pages/FlightBoard';
import GateManagement from './pages/GateManagement';
import Incidents from './pages/Incidents';

export default function App() {
  return (
    <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
      <AuthProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/"          element={<Dashboard />} />
              <Route path="/flights"   element={<FlightBoard />} />
              <Route path="/gates"     element={<GateManagement />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="*"          element={<Navigate to="/" replace />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}
