import { createContext, useContext, useEffect, useState } from 'react';
import { Spin } from 'antd';
import keycloak from './keycloak';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    keycloak
      .init({ onLoad: 'login-required', checkLoginIframe: false })
      .then(() => {
        setReady(true);
        // Refresh token before it expires
        setInterval(() => {
          keycloak.updateToken(70).catch(() => keycloak.logout());
        }, 60000);
      })
      .catch(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Connecting to APOC..." />
      </div>
    );
  }

  return <AuthContext.Provider value={{ keycloak }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
