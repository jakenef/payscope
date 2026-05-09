import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminApp from './admin/AdminApp.jsx'
import { AuthProvider } from './auth/AuthContext'

const REQUIRED_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
const missing = REQUIRED_VARS.filter((k) => !import.meta.env[k])

if (missing.length > 0) {
  document.getElementById('root').innerHTML = `
    <div style="font-family:monospace;padding:40px;color:#e05252;background:#1a0a0a;min-height:100vh">
      <strong>Missing environment variables:</strong><br><br>
      ${missing.map((k) => `&nbsp;&nbsp;${k}`).join('<br>')}
      <br><br>Add them to <code>frontend/.env.local</code> and restart the dev server.
    </div>`
  throw new Error(`Missing env vars: ${missing.join(', ')}`)
}

// Hidden admin area — pathname-based, no router dep. Type /admin in the URL.
const isAdminPath = window.location.pathname.startsWith('/admin')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      {isAdminPath ? <AdminApp /> : <App />}
    </AuthProvider>
  </StrictMode>,
)
