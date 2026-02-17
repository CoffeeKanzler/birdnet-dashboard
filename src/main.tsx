import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { siteConfig } from './config/site'
import { setLocale } from './i18n'
import './index.css'

setLocale(siteConfig.locale)
document.title = siteConfig.siteName

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
