import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/minecraft.css'
import './index.css'
import App from './App.tsx'
import { DialogProvider } from './context/DialogContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DialogProvider>
      <App />
    </DialogProvider>
  </StrictMode>,
)
