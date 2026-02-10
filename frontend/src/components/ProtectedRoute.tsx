import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="h-screen flex items-center justify-center">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
