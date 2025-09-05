import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PageLayout from './components/templates/PageLayout';
import HomePage from './components/pages/HomePage';
import FriendsPage from './components/pages/FriendsPage';
import GroupsPage from './components/pages/GroupsPage';

const App: React.FC = () => {
  return (
    <Router>
      <PageLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/groups" element={<GroupsPage />} />
        </Routes>
      </PageLayout>
    </Router>
  );
};

export default App;