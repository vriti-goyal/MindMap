import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MapEditor from './pages/MapEditor';
import MyUploads from './pages/MyUploads';
import ExploreSimilarity from './pages/ExploreSimilarity';
import TagManager from './pages/TagManager';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/uploads" 
            element={
              <ProtectedRoute>
                <MyUploads />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/explore" 
            element={
              <ProtectedRoute>
                <ExploreSimilarity />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/maps/:id" 
            element={
              <ProtectedRoute>
                <MapEditor />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings/tags" 
            element={
              <ProtectedRoute>
                <TagManager />
              </ProtectedRoute>
            } 
          />
          {/* Default redirect to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
