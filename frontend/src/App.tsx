import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ChatAgent from './pages/ChatAgent';
import UploadLogs from './pages/UploadLogs';
import GroupingStudio from './pages/GroupingStudio';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated') === 'true';
    setIsAuthenticated(authStatus);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    setIsAuthenticated(false);
  };

  if (isAuthenticated === null) return null; // Wait for localStorage check

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Layout
      activePage={activePage}
      onPageChange={setActivePage}
      onLogout={handleLogout}
    >
      {activePage === 'dashboard' && <Dashboard />}
      {activePage === 'chat' && <ChatAgent />}
      {activePage === 'upload' && <UploadLogs />}
      {activePage === 'grouping' && <GroupingStudio />}
    </Layout>
  );
};

export default App;
