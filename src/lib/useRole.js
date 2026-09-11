import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Tant que la table team_members n'existe pas encore (avant application de la
// migration SQL), on considère tout utilisateur connecté comme admin pour ne
// pas casser l'application existante.
export function useRole() {
  const [role, setRole] = useState('admin')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { if (active) { setRole('admin'); setLoading(false) }; return }
      const { data, error } = await supabase
        .from('team_members')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .maybeSingle()
      if (active) {
        setRole(error || !data ? 'admin' : data.role)
        setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  return { role, isAdmin: role !== 'lecture_seule', loading }
}
