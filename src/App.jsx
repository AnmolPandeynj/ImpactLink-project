import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import VolunteerDashboard from './pages/VolunteerDashboard';
import AuthForm from './components/Auth/AuthForm';
import RequireRole from './components/Auth/RequireRole';
import RoleSelectionModal from './components/Auth/RoleSelectionModal';

import { ProjectProvider } from './context/ProjectContext';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <BrowserRouter>
          <Routes>
          {/* Public Entry Point */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthForm />} />
          <Route path="/setup" element={<RoleSelectionModal />} />
          
          {/* Protected Command Center */}
          <Route 
            path="/dashboard" 
            element={
              <RequireRole role="Administrator">
                <Dashboard />
              </RequireRole>
            } 
          />

          {/* Protected Volunteer Portal */}
          <Route 
            path="/volunteer" 
            element={
              <RequireRole role="Volunteer">
                <VolunteerDashboard />
              </RequireRole>
            } 
          />

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
      </ProjectProvider>
    </AuthProvider>
  );
}

export default App;
