import { createContext, useContext, useEffect, useState } from 'react';
import { Spin, Result, Button } from 'antd';
import keycloak from './keycloak';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady]   = useState(false);
  const [error, setError]   = useState(null);

  useEffect(() => {
    keycloak
      .init({ onLoad: 'login-required', checkLoginIframe: false })
      .then(() => {
        setReady(true);
        setInterval(() => {
          keycloak.updateToken(70).catch(() => keycloak.logout());
        }, 60000);
      })
      .catch((err) => {
        console.error('Keycloak init failed:', err);
        setError(err);
        setReady(true);
      });
  }, []);

  if (!ready || (!error && !keycloak.authenticated)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip={keycloak.authenticated === false ? 'Redirecting to login...' : 'Connecting to APOC...'} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Result
          status="403"
          title="Authentication Failed"
          subTitle="Unable to connect to the authentication server. Please check your network or contact your administrator."
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return <AuthContext.Provider value={{ keycloak }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
