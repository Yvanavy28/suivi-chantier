import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import { useRole } from '../lib/useRole'

export default function Entreprises() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { isAdmin } = useRole()

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from('companies').select('*, insurances(*)').order('name')
      if (data) setCompanies(data)
      setLoading(false)
    }
    fetch()
  }, [])

  function getInsuranceStatus(company) {
    if (!company.insurances || company.insurances.length === 0) return 'aucune'
    const today = new Date()
    const soonDays = 60
    for (const ins of company.insurances) {
      if (!ins.end_date) continue
      const end = new Date(ins.end_date)
      const diff = Math.round((end - today) / (1000 * 60 * 60 * 24))
      if (diff < 0) return 'expiree'
      if (diff <= soonDays) return 'bientot'
    }
    return 'ok'
  }

  function getInitials(name) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.trade || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 80, minHeight: '100vh', background: '#f5f4f0' }}>

      <div style={{ background: '#fff', padding: '16px', borderBottom: '0.5px solid #e0dfd7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>Entreprises</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{companies.length} entreprise{companies.length > 1 ? 's' : ''}</div>
        </div>
        {isAdmin && (
          <div onClick={() => navigate('/nouvelle-entreprise')} style={{ width: 34, height: 34, borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="8" y1="2" x2="8" y2="14" stroke="white" strokeWidth="1.6" strokeLinecap="round"/><line x1="2" y1="8" x2="14" y2="8" stroke="white" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 14px 4px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une entreprise..."
          style={{ width: '100%', fontSize: 14, padding: '9px 12px', borderRadius: 8, border: '0.5px solid #e0dfd7', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>Chargement...</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>
            {search ? 'Aucun resultat' : 'Aucune entreprise.'}<br />
            {!search && isAdmin && <span onClick={() => navigate('/nouvelle-entreprise')} style={{ color: '#1D9E75', cursor: 'pointer' }}>Ajouter une entreprise</span>}
          </div>
        )}
        {filtered.map(c => {
          const status = getInsuranceStatus(c)
          return (
            <div key={c.id} onClick={() => navigate('/entreprise/' + c.id)} style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, color: '#0F6E56', flexShrink: 0 }}>
                {getInitials(c.name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{c.trade || '-'}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                {status === 'expiree' && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#FCEBEB', color: '#A32D2D', fontWeight: 500 }}>Expiree</span>}
                {status === 'bientot' && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#FAEEDA', color: '#854F0B', fontWeight: 500 }}>Bientot</span>}
                {status === 'ok' && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#EAF3DE', color: '#3B6D11', fontWeight: 500 }}>Valide</span>}
                {status === 'aucune' && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#f5f4f0', color: '#aaa', fontWeight: 500 }}>Aucune</span>}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="#ccc" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          )
        })}
      </div>

      <Navbar />
    </div>
  )
}
