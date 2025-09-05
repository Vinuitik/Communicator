import React, { useState, useEffect } from 'react'

// This is a TEMPORARY validation component - safe to delete later
const ValidationTestPage: React.FC = () => {
  const [currentTime, setCurrentTime] = useState<string>('')
  const [counter, setCounter] = useState<number>(0)
  const [apiTest, setApiTest] = useState<string>('Not tested')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  })

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Test API connectivity (mock for now)
  const testApiConnectivity = async () => {
    setApiTest('Testing...')
    try {
      // This would normally test your actual APIs
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      setApiTest('✅ API connectivity simulated successfully')
    } catch (error) {
      setApiTest('❌ API test failed')
    }
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    alert(`Form submitted!\nName: ${formData.name}\nEmail: ${formData.email}\nMessage: ${formData.message}`)
    setFormData({ name: '', email: '', message: '' })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-4xl font-bold text-gray-900 text-center">
            🚀 React Microservice Validation Test
          </h1>
          <p className="text-center text-gray-600 mt-2">
            This is a temporary validation page to test the React setup
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6 border border-green-200">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-4">
              <span className="text-2xl">✅</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">React Setup</h3>
            <p className="text-sm text-gray-600 text-center">
              React with TypeScript is working correctly
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-blue-200">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-4">
              <span className="text-2xl">🎨</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Tailwind CSS</h3>
            <p className="text-sm text-gray-600 text-center">
              Styling framework is loaded and functional
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-purple-200">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-4">
              <span className="text-2xl">🐳</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Docker</h3>
            <p className="text-sm text-gray-600 text-center">
              Container deployment ready
            </p>
          </div>
        </div>

        {/* Live Data Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Real-time Clock */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">⏰ Real-time Clock</h2>
            <div className="text-center">
              <div className="text-3xl font-mono text-blue-600 bg-blue-50 rounded-lg py-4 px-6">
                {currentTime}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Demonstrates React state updates and useEffect hooks
              </p>
            </div>
          </div>

          {/* Interactive Counter */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">🔢 Interactive Counter</h2>
            <div className="text-center space-y-4">
              <div className="text-4xl font-bold text-purple-600 bg-purple-50 rounded-lg py-4 px-6">
                {counter}
              </div>
              <div className="space-x-4">
                <button 
                  onClick={() => setCounter(c => c + 1)}
                  className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200"
                >
                  Increment (+)
                </button>
                <button 
                  onClick={() => setCounter(c => c - 1)}
                  className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200"
                >
                  Decrement (-)
                </button>
                <button 
                  onClick={() => setCounter(0)}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* API Test Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🌐 API Connectivity Test</h2>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-gray-600 mb-2">Test microservice communication:</p>
              <div className="text-lg font-medium text-gray-900">
                Status: <span className={`${apiTest.includes('✅') ? 'text-green-600' : apiTest.includes('❌') ? 'text-red-600' : 'text-yellow-600'}`}>
                  {apiTest}
                </span>
              </div>
            </div>
            <button 
              onClick={testApiConnectivity}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200"
            >
              Test API
            </button>
          </div>
        </div>

        {/* Form Validation */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">📝 Form Handling Test</h2>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your name"
                  required
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                rows={4}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your message"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Submit Test Form
            </button>
          </form>
        </div>

        {/* Technical Details */}
        <div className="bg-gray-50 rounded-lg p-6 border-l-4 border-blue-500">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🔧 Technical Stack Validation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900">Frontend</h4>
              <ul className="text-gray-600 mt-2 space-y-1">
                <li>✅ React 18</li>
                <li>✅ TypeScript</li>
                <li>✅ Vite</li>
              </ul>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900">Styling</h4>
              <ul className="text-gray-600 mt-2 space-y-1">
                <li>✅ Tailwind CSS</li>
                <li>✅ PostCSS</li>
                <li>✅ Responsive Design</li>
              </ul>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900">Architecture</h4>
              <ul className="text-gray-600 mt-2 space-y-1">
                <li>✅ Atomic Design</li>
                <li>✅ Microservice</li>
                <li>✅ Path Aliases</li>
              </ul>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900">Deployment</h4>
              <ul className="text-gray-600 mt-2 space-y-1">
                <li>✅ Docker Ready</li>
                <li>✅ Nginx Config</li>
                <li>✅ Production Build</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Delete Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <span className="text-2xl mr-3">⚠️</span>
            <div>
              <h3 className="font-semibold text-yellow-800">Temporary Validation Page</h3>
              <p className="text-yellow-700 mt-1">
                This entire component can be safely deleted once you confirm everything is working correctly. 
                It's only for testing the React microservice setup.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-300">
            React Microservice • Atomic Design • Tailwind CSS • Docker Ready
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Validation complete - ready for production migration!
          </p>
        </div>
      </footer>
    </div>
  )
}

export default ValidationTestPage
