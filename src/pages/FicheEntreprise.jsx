import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ExtracteurIA from '../components/ExtracteurIA'
import { useRole } from '../lib/useRole'

export default function FicheEntreprise() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useRole()
  const [tab, setTab] = useState(0)
  const [company, setCompany] = useState(null)
  const [insurances, setInsurances] = useState([])
  const [chantiers, setChantiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddIns, setShowAddIns] = useState(false)
  const [insForm, setInsForm] = useState({ type: 'decennale', insurer: '', policy_number: '', activities_covered: '', start_date: '', end_date: '' })
  const [savingIns, setSavingIns] = useState(false)

  useEffect(() => {
    async function fetch() {
      const [{ data: c }, { data: ins }, { data: pl }] = await Promise.all([
        supabase.from('companies').select('*').eq('id', id).single(),
        supabase.from('insurances').select('*').eq('company_id', id).order('end_date'),
        supabase.from('project_lots').select('*, projects(*), lots(*)').eq('company_id', id),
      ])
      if (c) setCompany(c)
      if (ins) setInsurances(ins)
      if (pl) setChantiers(pl)
      setLoading(false)
    }
    fetch()
  }, [id])

  function getInitials(name) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }

  function getDaysLeft(endDate) {
    if (!endDate) return null
    return Math.round((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24))
  }

  function getInsStatus(ins) {
    const d = getDaysLeft(ins.end_date)
    if (d === null) return 'inconnu'
    if (d < 0) return 'expiree'
    if (d <= 60) return 'bientot'
    return 'ok'
  }

  async function saveInsurance() {
    if (!insForm.type) return
    setSavingIns(true)
    const { data } = await supabase.from('insurances').insert([{ ...insForm, company_id: id }]).select().single()
    if (data) { setInsurances(prev => [...prev, data]); setShowAddIns(false); setInsForm({ type: 'decennale', insurer: '', policy_number: '', activities_covered: '', start_date: '', end_date: '' }) }
    setSavingIns(false)
  }

  async function deleteInsurance(insId) {
    await supabase.from('insurances').delete().eq('id', insId)
    setInsurances(prev => prev.filter(i => i.id !== insId))
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>Chargement...</div>
  if (!company) return <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>Entreprise introuvable</div>

  const tabs = ['Decennales', 'Chantiers', 'Infos']

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#f5f4f0' }}>

      <div style={{ background: '#fff', padding: '14px 16px', borderBottom: '0.5px solid #e0dfd7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div onClick={() => navigate('/entreprises')} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e0dfd7', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="#888" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{company.name}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{company.trade || 'Entreprise'}</div>
          </div>
        </div>
        {isAdmin && (
          <div onClick={() => navigate('/entreprise/' + id + '/modifier')} style={{ fontSize: 12, color: '#1a1a1a', border: '0.5px solid #1a1a1a', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 500 }}>Modifier</div>
        )}
      </div>

      <div style={{ background: '#fff', padding: '14px 16px', borderBottom: '0.5px solid #e0dfd7', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 500, color: '#0F6E56', flexShrink: 0 }}>
          {getInitials(company.name)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{company.name}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{company.trade || '-'}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {company.phone && (
              <a href={'tel:' + company.phone} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '0.5px solid #e0dfd7', color: '#555', textDecoration: 'none', background: '#f5f4f0' }}>
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 2a1 1 0 011-1h2.5l1 3-1.5 1a9 9 0 004 4l1-1.5 3 1V11a1 1 0 01-1 1C5 12 2 7 2 2z" stroke="#555" strokeWidth="1.2"/></svg>
                Appeler
              </a>
            )}
            {company.email && (
              <a href={'mailto:' + company.email} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '0.5px solid #e0dfd7', color: '#555', textDecoration: 'none', background: '#f5f4f0' }}>
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1.5" stroke="#555" strokeWidth="1.2"/><polyline points="1,4 7,8 13,4" stroke="#555" strokeWidth="1" fill="none"/></svg>
                Mail
              </a>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', background: '#fff', borderBottom: '0.5px solid #e0dfd7' }}>
        {tabs.map((t, i) => (
          <div key={i} onClick={() => setTab(i)} style={{ flex: 1, padding: '10px 6px', fontSize: 12, textAlign: 'center', cursor: 'pointer', borderBottom: tab === i ? '2px solid #1a1a1a' : '2px solid transparent', color: tab === i ? '#1a1a1a' : '#888', fontWeight: tab === i ? 500 : 400 }}>
            {t}
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 14px 80px' }}>

        {tab === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isAdmin && (
              <>
                <ExtracteurIA
                  type="insurance"
                  companyId={id}
                  onSuccess={() => window.location.reload()}
                />
                <div onClick={() => setShowAddIns(!showAddIns)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: '#888', border: '0.5px dashed #e0dfd7', borderRadius: 8, padding: '9px', cursor: 'pointer', background: '#fff' }}>
                  + Saisir manuellement
                </div>
              </>
            )}

            {showAddIns && (
              <div style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', marginBottom: 2 }}>Nouvelle assurance</div>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Type</div>
                  <select value={insForm.type} onChange={e => setInsForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                    <option value="decennale">Decennale</option>
                    <option value="rc_pro">RC Pro</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Assureur</div>
                  <input value={insForm.insurer} onChange={e => setInsForm(f => ({ ...f, insurer: e.target.value }))} placeholder="Ex : SMABTP" style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>N° de police</div>
                  <input value={insForm.policy_number} onChange={e => setInsForm(f => ({ ...f, policy_number: e.target.value }))} placeholder="DEC-2024-XXXXX" style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Activites couvertes</div>
                  <input value={insForm.activities_covered} onChange={e => setInsForm(f => ({ ...f, activities_covered: e.target.value }))} placeholder="Gros oeuvre, maconnerie..." style={inp} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Date debut</div>
                    <input type="date" value={insForm.start_date} onChange={e => setInsForm(f => ({ ...f, start_date: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Date fin</div>
                    <input type="date" value={insForm.end_date} onChange={e => setInsForm(f => ({ ...f, end_date: e.target.value }))} style={inp} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowAddIns(false)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '0.5px solid #e0dfd7', background: '#f5f4f0', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                  <button onClick={saveInsurance} disabled={savingIns} style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none', background: '#1a1a1a', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {savingIns ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            )}

            {insurances.length === 0 && !showAddIns && (
              <div style={{ textAlign: 'center', padding: 30, color: '#aaa', fontSize: 13 }}>Aucune assurance enregistree</div>
            )}

            {insurances.map(ins => {
              const status = getInsStatus(ins)
              const days = getDaysLeft(ins.end_date)
              const statusColors = {
                ok: { bg: '#EAF3DE', color: '#3B6D11', label: 'Valide' },
                bientot: { bg: '#FAEEDA', color: '#854F0B', label: 'Expire bientot' },
                expiree: { bg: '#FCEBEB', color: '#A32D2D', label: 'Expiree' },
                inconnu: { bg: '#f5f4f0', color: '#aaa', label: 'Inconnu' },
              }
              const sc = statusColors[status]
              const pct = ins.start_date && ins.end_date
                ? Math.min(100, Math.round((new Date() - new Date(ins.start_date)) / (new Date(ins.end_date) - new Date(ins.start_date)) * 100))
                : 0
              const barColor = status === 'ok' ? '#1D9E75' : status === 'bientot' ? '#EF9F27' : '#E24B4A'

              return (
                <div key={ins.id} style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid #e0dfd7' }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{ins.type === 'decennale' ? 'Assurance decennale' : ins.type === 'rc_pro' ? 'RC Pro' : ins.type}</div>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500 }}>{sc.label}</span>
                  </div>
                  <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {ins.insurer && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: '#888' }}>Assureur</span><span style={{ fontWeight: 500 }}>{ins.insurer}</span></div>}
                    {ins.policy_number && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: '#888' }}>N° de police</span><span style={{ fontWeight: 500 }}>{ins.policy_number}</span></div>}
                    {ins.end_date && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: '#888' }}>Echeance</span>
                        <span style={{ fontWeight: 500, color: sc.color }}>
                          {new Date(ins.end_date).toLocaleDateString('fr-FR')} · {days >= 0 ? 'dans ' + days + ' j.' : 'expiree'}
                        </span>
                      </div>
                    )}
                    {ins.activities_covered && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: '#888' }}>Activites</span><span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{ins.activities_covered}</span></div>}
                    <div style={{ height: 4, background: '#e0dfd7', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: barColor, borderRadius: 2 }}></div>
                    </div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{pct}% de la duree ecoulee</div>
                  </div>
                  <div style={{ padding: '8px 14px', borderTop: '0.5px solid #e0dfd7', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => deleteInsurance(ins.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #e0dfd7', background: 'none', color: '#E24B4A', cursor: 'pointer', fontFamily: 'inherit' }}>Supprimer</button>
                    {company.email && (
                      <a href={'mailto:' + company.email + '?subject=Renouvellement assurance decennale&body=Bonjour,%0A%0ANous souhaitons vous informer que votre assurance arrive a expiration.%0AMerci de nous faire parvenir votre attestation renouvelee.%0A%0ACordialement'}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #1a1a1a', background: '#1a1a1a', color: '#fff', cursor: 'pointer', textDecoration: 'none' }}>
                        Demander renouvellement
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Chantiers</div>
            {chantiers.length === 0 && (
              <div style={{ textAlign: 'center', padding: 30, color: '#aaa', fontSize: 13 }}>Aucun chantier associe</div>
            )}
            {chantiers.map((pl, i) => {
              const colors = ['#1D9E75','#EF9F27','#378ADD','#7F77DD','#D85A30']
              return (
                <div key={pl.id} onClick={() => navigate('/chantier/' + pl.project_id)} style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[i % colors.length], flexShrink: 0 }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{pl.projects?.name}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>Lot {pl.lots?.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{pl.amount_ht ? pl.amount_ht.toLocaleString('fr-FR') + ' EUR' : '- EUR'}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{pl.amount_ht ? Math.round((pl.unlocked_ht || 0) / pl.amount_ht * 100) : 0}% debloque</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Coordonnees</div>
            {[
              ['Gerant / contact', company.contact_name || '-'],
              ['Telephone', company.phone || '-'],
              ['Email', company.email || '-'],
              ['Adresse', company.address || '-'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0', borderBottom: '0.5px solid #e0dfd7', fontSize: 13 }}>
                <span style={{ color: '#888' }}>{k}</span>
                <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{v}</span>
              </div>
            ))}
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>Informations legales</div>
            {[
              ['SIRET', company.siret || '-'],
              ['Corps de metier', company.trade || '-'],
              ['Qualification', company.qualification || '-'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0', borderBottom: '0.5px solid #e0dfd7', fontSize: 13 }}>
                <span style={{ color: '#888' }}>{k}</span>
                <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{v}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

const inp = {
  fontSize: 14, padding: '9px 11px', borderRadius: 8,
  border: '0.5px solid #e0dfd7', background: '#fff',
  color: '#1a1a1a', width: '100%', boxSizing: 'border-box',
  fontFamily: 'inherit'
}
