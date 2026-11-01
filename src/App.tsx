import { Router, Route, useRoute } from 'wouter'
import { Toaster } from 'sonner'
import AppShell from './components/AppShell'
import ProfilePage from './components/ProfilePage'
import AccountsExplainer from './components/AccountsExplainer'

function AppContent() {
  const [isProfileRoute] = useRoute('/profile/:userId')
  const [isAccountsRoute] = useRoute('/accounts')

  return (
    <>
      <Route path="/profile/:userId">
        {(params) => <ProfilePage userId={params?.userId ?? ''} />}
      </Route>
      {/* 🔴 `/accounts` HIDES the shell rather than unmounting it, exactly as the
          profile route does. AppShell holds nearly all the state — scroll positions,
          the open thread, the visited place — and unmounting it would mean a reader
          who presses the door and comes back has lost the conversation they were in.
          D-37 puts this page after the attempt; the attempt is worth returning to. */}
      <Route path="/accounts">
        <AccountsExplainer />
      </Route>
      <div
        style={{ display: isProfileRoute || isAccountsRoute ? 'none' : undefined }}
        className="flex flex-col min-h-screen"
      >
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
