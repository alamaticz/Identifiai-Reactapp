import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { auth } from './config/firebase';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ChatAgent from './pages/ChatAgent';
import UploadLogs from './pages/UploadLogs';
import GroupingStudio from './pages/GroupingStudio';
import ProtectedRoute from './components/ProtectedRoute';

const App: React.FC = () => {
  const { loading } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');

  if (loading) {
    return <div className="h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login onLoginSuccess={() => { }} />} />
      <Route element={<ProtectedRoute />}>
        <Route
          path="/"
          element={
            <Layout
              activePage={activePage}
              onPageChange={setActivePage}
              onLogout={() => auth.signOut()}
            >
              <div style={{ display: activePage === 'dashboard' ? 'block' : 'none' }}>
                <Dashboard />
              </div>
              <div style={{ display: activePage === 'chat' ? 'block' : 'none' }}>
                <ChatAgent />
              </div>
              <div style={{ display: activePage === 'upload' ? 'block' : 'none' }}>
                <UploadLogs />
              </div>
              <div style={{ display: activePage === 'grouping' ? 'block' : 'none' }}>
                <GroupingStudio />
              </div>
            </Layout>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
