import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { GroupSocialPage } from './pages/GroupSocialPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root to a default page */}
        <Route path="/" element={
          <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow">
              <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold text-gray-900">
                  Communicator - React Frontend
                </h1>
              </div>
            </header>
            <main>
              <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                  <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
                    <p className="text-lg text-gray-600">
                      React frontend is now properly configured!
                    </p>
                  </div>
                </div>
              </div>
            </main>
          </div>
        } />

        {/* Group social page route */}
        <Route path="/group/:groupId/social" element={<GroupSocialPage />} />
        
        {/* 404 page - fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
