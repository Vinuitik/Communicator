import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PageLayout from './components/templates/PageLayout';
import HomePage from './components/pages/HomePage';
import FriendsPage from './components/pages/FriendsPage';
import GroupsPage from './components/pages/GroupsPage';
import AddFriendPage from './components/pages/AddFriendPage';
import { ROUTES } from './utils/constants';

const App: React.FC = () => {
  return (
    <Router basename="/app">
      <PageLayout>
        <Routes>
          <Route path={ROUTES.HOME} element={<HomePage />} />
          <Route path={ROUTES.FRIENDS} element={<FriendsPage />} />
          <Route path={ROUTES.ADD_FRIEND} element={<AddFriendPage />} />
          <Route path={ROUTES.GROUPS} element={<GroupsPage />} />
        </Routes>
      </PageLayout>
    </Router>
  );
};

export default App;