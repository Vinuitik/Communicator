import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import ValidationTestPage from './components/pages/ValidationTestPage'

// This is a placeholder component for initial setup
const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Communicator React UI
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          React microservice with Atomic Design & Tailwind CSS
        </p>
        <div className="space-y-2 text-sm text-gray-500">
          <p>✅ React + TypeScript</p>
          <p>✅ Tailwind CSS</p>
          <p>✅ Atomic Design Structure</p>
          <p>✅ Docker Ready</p>
        </div>
        <div className="mt-8">
          <a 
            href="/validation" 
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
          >
            View Validation Test Page
          </a>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/validation" element={<ValidationTestPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
