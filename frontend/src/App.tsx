import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { LiveSession } from './pages/LiveSession';
import { SessionSummary } from './pages/SessionSummary';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/session" element={<LiveSession />} />
          <Route path="/summary/:id" element={<SessionSummary />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
