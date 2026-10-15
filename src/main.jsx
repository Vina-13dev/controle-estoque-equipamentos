import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { UnitProvider } from './contexts/UnitContext'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <UnitProvider>
          <App />
        </UnitProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
)
