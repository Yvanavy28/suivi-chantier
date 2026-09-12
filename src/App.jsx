import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useRole } from './lib/useRole'
import Login from './pages/Login'
import Home from './pages/Home'
import Navbar from './components/Navbar'

const NouveauChantier = lazy(() => import('./pages/NouveauChantier'))
const FicheChantier = lazy(() => import('./pages/FicheChantier'))
const ModifierChantier = lazy(() => import('./pages/ModifierChantier'))
const Entreprises = lazy(() => import('./pages/Entreprises'))
const NouvelleEntreprise = lazy(() => import('./pages/NouvelleEntreprise'))
const FicheEntreprise = lazy(() => import('./pages/FicheEntreprise'))
const ModifierEntreprise = lazy(() => import('./pages/ModifierEntreprise'))
const FicheLot = lazy(() => import('./pages/FicheLot'))
const Reglages = lazy(() => import('./pages/Reglages'))

function RequireAdmin({ children }) {
  const { isAdmin, loading } = useRole()
  if (loading) return null
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

function AppContent() {
  const location = useLocation()
  const hideNavbar = ['/', '/entreprises', '/nouveau-chantier', '/nouvelle-entreprise'].includes(location.pathname) ||
    location.pathname.includes('/modifier') ||
    location.pathname.includes('/reglages')

  return (
    <>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/nouveau-chantier" element={<RequireAdmin><NouveauChantier /></RequireAdmin>} />
          <Route path="/chantier/:id" element={<FicheChantier />} />
          <Route path="/chantier/:id/modifier" element={<RequireAdmin><ModifierChantier /></RequireAdmin>} />
          <Route path="/chantier/:projectId/lot/:lotId" element={<FicheLot />} />
          <Route path="/entreprises" element={<Entreprises />} />
          <Route path="/nouvelle-entreprise" element={<RequireAdmin><NouvelleEntreprise /></RequireAdmin>} />
          <Route path="/entreprise/:id" element={<FicheEntreprise />} />
          <Route path="/entreprise/:id/modifier" element={<RequireAdmin><ModifierEntreprise /></RequireAdmin>} />
          <Route path="/reglages" element={<Reglages />} />
        </Routes>
      </Suspense>
      {!hideNavbar && <Navbar />}
    </>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return null
  if (!session) return <Login />

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
