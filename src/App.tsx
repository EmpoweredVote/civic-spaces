import { Toaster } from 'sonner'
import AppShell from './components/AppShell'

export default function App() {
  return (
    <>
      <AppShell />
      <Toaster richColors position="top-center" />
    </>
  )
}
