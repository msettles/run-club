import React from 'react'
import ReactDOM from 'react-dom/client'
import './services/install' // capture the browser's install prompt as early as possible
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
