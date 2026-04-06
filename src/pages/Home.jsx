import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

export default function Home() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [activeTab, setActiveTab] = useState('en_cours')
  const [now, setNow] = useState(new Date())
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        if (prof) setProfile(prof)
      }
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
      if (!error) setProjects(data)
      setLoading(false)
    }
    fetchData()
  }, [])

  function getBudgetPct(project) {
    if (!project.budget_ht || project.budget_ht === 0) return 0
    return Math.round((project.unlocked_ht || 0) / project.budget_ht * 100)
  }

  function getInitials() {
    const name = profile?.company_name || profile?.full_name || 'BET'
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }

  function getDisplayName() {
    return profile?.company_name || 'BET Stelar'
  }

  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  const filtered = projects.filter(p => {
    if (activeTab === 'en_cours') return p.status === 'en_cours'
    if (activeTab === 'termine') return p.status === 'terminé' || p.status === 'réceptionné'
    if (activeTab === 'a_venir') return p.status === 'en_pause'
    return true
  })

  const counts = {
    en_cours: projects.filter(p => p.status === 'en_cours').length,
    termine: projects.filter(p => p.status === 'terminé' || p.status === 'réceptionné').length,
    a_venir: projects.filter(p => p.status === 'en_pause').length,
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 80, minHeight: '100vh', background: '#f5f4f0' }}>

      <div style={{ background: '#fff', padding: '16px', borderBottom: '0.5px solid #e0dfd7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 2 }}>
              {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)} · {timeStr}
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#1a1a1a' }}>{getDisplayName()}</div>
          </div>
          <div onClick={() => navigate('/reglages')} style={{ cursor: 'pointer', flexShrink: 0 }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e0dfd7' }} />
            ) : (
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: '#0F6E56' }}>
                {getInitials()}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 500, color: '#1a1a1a', marginBottom: 10 }}>Mes chantiers</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'en_cours', label: 'En cours', count: counts.en_cours },
              { key: 'termine', label: 'Terminés', count: counts.termine },
              { key: 'a_venir', label: 'À venir', count: counts.a_venir },
            ].map(tab => (
              <div key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, cursor: 'pointer', background: activeTab === tab.key ? '#1a1a1a' : '#f5f4f0', border: '0.5px solid ' + (activeTab === tab.key ? '#1a1a1a' : '#e0dfd7') }}>
                <span style={{ fontSize: 12, fontWeight: activeTab === tab.key ? 500 : 400, color: activeTab === tab.key ? '#fff' : '#888' }}>{tab.label}</span>
                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 10, background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : '#e0dfd7', color: activeTab === tab.key ? '#fff' : '#888' }}>{tab.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>Chargement...</div>}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>
            Aucun chantier {activeTab === 'en_cours' ? 'en cours' : activeTab === 'termine' ? 'terminé' : 'à venir'}.<br />
            {activeTab === 'en_cours' && <span onClick={() => navigate('/nouveau-chantier')} style={{ color: '#1D9E75', cursor: 'pointer' }}>Créer un chantier</span>}
          </div>
        )}

        {filtered.map(p => {
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
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Budget prévu HT</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{p.budget_ht ? p.budget_ht.toLocaleString('fr-FR') + ' EUR' : '-'}</div>
                </div>
                <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Débloqué</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: fillColor }}>{pct}%</div>
                  <div style={{ height: 3, background: '#e0dfd7', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: fillColor, borderRadius: 2 }}></div>
                  </div>
                </div>
                <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Délai prévu</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{p.duration_months ? p.duration_months + ' mois' : '-'}</div>
                </div>
                <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Délai en cours</div>
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
