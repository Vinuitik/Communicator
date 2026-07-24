import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PageLayout from './components/templates/PageLayout';
import { ToastProvider } from './components/molecules/Toast';
import HomePage from './components/pages/HomePage';
import CalendarPage from './components/pages/CalendarPage';
import GroupsPage from './components/pages/GroupsPage';
import AddFriendPage from './components/pages/AddFriendPage';
import TalkedPage from './components/pages/TalkedPage';
import FactsPage from './components/pages/FactsPage';
import CreateGroupPage from './components/pages/CreateGroupPage';
import GroupDetailsPage from './components/pages/GroupDetailsPage';
import SettingsPage from './components/pages/SettingsPage';
import AnalyticsPage from './components/pages/AnalyticsPage';
import SocialPage from './components/pages/SocialPage';
import FileUploadPage from './components/pages/FileUploadPage';
import ProfilePage from './components/pages/ProfilePage';
import { ROUTES } from './utils/constants';

const App: React.FC = () => {
  return (
    <Router basename="/app">
      <ToastProvider>
        <PageLayout>
          <Routes>
            <Route path={ROUTES.HOME} element={<HomePage />} />
            <Route path={ROUTES.CALENDAR} element={<CalendarPage />} />
            <Route path={ROUTES.ADD_FRIEND} element={<AddFriendPage />} />
            <Route path={ROUTES.TALKED} element={<TalkedPage />} />
            <Route path={ROUTES.FRIEND_KNOWLEDGE} element={<FactsPage />} />
            <Route path={ROUTES.GROUPS} element={<GroupsPage />} />
            <Route path={ROUTES.CREATE_GROUP} element={<CreateGroupPage />} />
            <Route path={ROUTES.GROUP_DETAILS} element={<GroupDetailsPage />} />
            <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
            <Route path={ROUTES.ANALYTICS} element={<AnalyticsPage />} />
            <Route path={ROUTES.FRIEND_SOCIAL} element={<SocialPage />} />
            <Route path={ROUTES.FILE_UPLOAD} element={<FileUploadPage />} />
            <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
          </Routes>
        </PageLayout>
      </ToastProvider>
    </Router>
  );
};

export default App;