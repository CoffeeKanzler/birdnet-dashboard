import { QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'

import { queryClient } from './api/queryClient.ts'
import App from './App.tsx'
import { siteConfig } from './config/site'
import { resolveInitialLocale, setLocale } from './i18n'
import './index.css'

const LOCALE_STORAGE_KEY = 'birdnet-showoff-locale'
const params = new URLSearchParams(window.location.search)
const urlLocale = params.get('lang')

const storedLocale = (() => {
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    return null
  }
})()

const initialLocale = resolveInitialLocale({
  urlLocale,
  storedLocale,
  navigatorLocale: window.navigator.language,
  fallbackLocale: siteConfig.locale,
})

setLocale(initialLocale)
document.title = siteConfig.siteName
document.documentElement.lang = initialLocale

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
