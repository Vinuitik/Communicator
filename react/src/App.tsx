import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import PageLayout from './components/templates/PageLayout';
import { ToastProvider } from './components/molecules/Toast';
import HomePage from './components/pages/HomePage';
import FriendsPage from './components/pages/FriendsPage';
import GroupsPage from './components/pages/GroupsPage';
import AddFriendPage from './components/pages/AddFriendPage';
import CreateGroupPage from './components/pages/CreateGroupPage';
import GroupDetailsPage from './components/pages/GroupDetailsPage';
import SettingsPage from './components/pages/SettingsPage';
import InsightsPage from './components/pages/InsightsPage';
import ProfilePage from './components/pages/ProfilePage';
import { ROUTES, profilePath } from './utils/constants';

// Talked/Knowledge/Social/FileUpload used to be standalone routes — all four
// are folded into the Profile hub now (hero's Log chat/Edit details, the
// Overview tab's Knowledge card, the Socials tab, the Media tab's "+ Add
// media"). Old per-friend links redirect to that friend's Profile instead
// of 404ing.
const RedirectToProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={profilePath(Number(id))} replace />;
};

const App: React.FC = () => {
  return (
    <Router basename="/app">
      <ToastProvider>
        <PageLayout>
          <Routes>
            <Route path={ROUTES.HOME} element={<HomePage />} />
            <Route path={ROUTES.FRIENDS} element={<FriendsPage />} />
            {/* Week board absorbed Calendar's role — old bookmarks still land somewhere real. */}
            <Route path={ROUTES.CALENDAR} element={<Navigate to={ROUTES.HOME} replace />} />
            <Route path={ROUTES.ADD_FRIEND} element={<AddFriendPage />} />
            <Route path={ROUTES.TALKED} element={<RedirectToProfile />} />
            <Route path={ROUTES.FRIEND_KNOWLEDGE} element={<RedirectToProfile />} />
            <Route path={ROUTES.FRIEND_SOCIAL} element={<RedirectToProfile />} />
            <Route path={ROUTES.FILE_UPLOAD} element={<RedirectToProfile />} />
            <Route path={ROUTES.GROUPS} element={<GroupsPage />} />
            <Route path={ROUTES.CREATE_GROUP} element={<CreateGroupPage />} />
            <Route path={ROUTES.GROUP_DETAILS} element={<GroupDetailsPage />} />
            <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
            {/* Old "Analytics" bookmarks still land somewhere real. */}
            <Route path="/analytics" element={<Navigate to={ROUTES.INSIGHTS} replace />} />
            <Route path={ROUTES.INSIGHTS} element={<InsightsPage />} />
            <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
          </Routes>
        </PageLayout>
      </ToastProvider>
    </Router>
  );
};

export default App;
