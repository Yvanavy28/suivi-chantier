import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

export default function Home() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchProjects() {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'en_cours')
        .order('created_at', { ascending: false })
      if (!error) setProjects(data)
      setLoading(false)
    }
    fetchProjects()
  }, [])

  function getBudgetPct(project) {
    if (!project.budget_ht || project.budget_ht === 0) return 0
    return Math.round((project.unlocked_ht || 0) / project.budget_ht * 100)
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 80, minHeight: '100vh', background: '#f5f4f0' }}>

      <div style={{ background: '#fff', padding: '16px', borderBottom: '0.5px solid #e0dfd7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>Mes chantiers</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{projects.length} en cours</div>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: '#0F6E56', cursor: 'pointer' }}>
          YV
        </div>
      </div>

      <div style={{ padding: '12px 14px 4px', fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Chantiers en cours
      </div>

      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>Chargement...</div>
        )}
        {!loading && projects.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>
            Aucun chantier en cours.<br />
            <span onClick={() => navigate('/nouveau-chantier')} style={{ color: '#1D9E75', cursor: 'pointer' }}>Creer votre premier chantier</span>
          </div>
        )}
        {projects.map(p => {
          const pct = getBudgetPct(p)
          const fillColor = pct > 80 ? '#E24B4A' : pct > 50 ? '#EF9F27' : '#1D9E75'
          return (
            <div key={p.id} onClick={() => navigate('/chantier/' + p.id)} style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 12, padding: '12px 14px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: p.delay_weeks > 0 ? '#FAEEDA' : '#EAF3DE', color: p.delay_weeks > 0 ? '#854F0B' : '#3B6D11', fontWeight: 500 }}>
                  {p.delay_weeks > 0 ? 'Retard' : 'En cours'}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Budget prevu HT</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{p.budget_ht ? p.budget_ht.toLocaleString('fr-FR') + ' EUR' : '-'}</div>
                </div>
                <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Debloque</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: fillColor }}>{pct}%</div>
                  <div style={{ height: 3, background: '#e0dfd7', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: fillColor, borderRadius: 2 }}></div>
                  </div>
                </div>
                <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Delai prevu</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{p.duration_months ? p.duration_months + ' mois' : '-'}</div>
                </div>
                <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Delai en cours</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: p.delay_weeks > 0 ? '#E24B4A' : '#1D9E75' }}>
                    {p.delay_weeks > 0 ? '+' + p.delay_weeks + ' sem.' : 'Dans les temps'}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Navbar />
    </div>
  )
}
