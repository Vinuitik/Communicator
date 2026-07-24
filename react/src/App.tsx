import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PageLayout from './components/templates/PageLayout';
import HomePage from './components/pages/HomePage';
import CalendarPage from './components/pages/CalendarPage';
import GroupsPage from './components/pages/GroupsPage';
import AddFriendPage from './components/pages/AddFriendPage';
import CreateGroupPage from './components/pages/CreateGroupPage';
import { ROUTES } from './utils/constants';

const App: React.FC = () => {
  return (
    <Router basename="/app">
      <PageLayout>
        <Routes>
          <Route path={ROUTES.HOME} element={<HomePage />} />
          <Route path={ROUTES.CALENDAR} element={<CalendarPage />} />
          <Route path={ROUTES.ADD_FRIEND} element={<AddFriendPage />} />
          <Route path={ROUTES.GROUPS} element={<GroupsPage />} />
          <Route path={ROUTES.CREATE_GROUP} element={<CreateGroupPage />} />
        </Routes>
      </PageLayout>
    </Router>
  );
};

export default App;