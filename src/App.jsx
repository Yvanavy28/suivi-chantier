import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Home from './pages/Home'
import NouveauChantier from './pages/NouveauChantier'
import FicheChantier from './pages/FicheChantier'
import ModifierChantier from './pages/ModifierChantier'
import Entreprises from './pages/Entreprises'
import NouvelleEntreprise from './pages/NouvelleEntreprise'
import FicheEntreprise from './pages/FicheEntreprise'

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
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/nouveau-chantier" element={<NouveauChantier />} />
        <Route path="/chantier/:id" element={<FicheChantier />} />
        <Route path="/chantier/:id/modifier" element={<ModifierChantier />} />
        <Route path="/entreprises" element={<Entreprises />} />
        <Route path="/nouvelle-entreprise" element={<NouvelleEntreprise />} />
        <Route path="/entreprise/:id" element={<FicheEntreprise />} />
      </Routes>
    </BrowserRouter>
  )
}