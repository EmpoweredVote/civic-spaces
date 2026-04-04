import { Router, Route, useRoute } from 'wouter'
import { Toaster } from 'sonner'
import AppShell from './components/AppShell'
import ProfilePage from './components/ProfilePage'

function AppContent() {
  const [isProfileRoute] = useRoute('/profile/:userId')

  return (
    <>
      <Route path="/profile/:userId">
        {(params) => <ProfilePage userId={params?.userId ?? ''} />}
      </Route>
      <div style={{ display: isProfileRoute ? 'none' : undefined }} className="flex flex-col h-screen">
        <AppShell />
      </div>
    </>
  )
}

export default function App() {
  return (
    <Router>
      <AppContent />
      <Toaster richColors position="top-center" />
    </Router>
  )
}
