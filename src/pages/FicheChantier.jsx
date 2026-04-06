import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PlanningGantt from '../components/PlanningGantt'

export default function FicheChantier() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [project, setProject] = useState(null)
  const [lots, setLots] = useState([])
  const [loading, setLoading] = useState(true)
  const [delayWeeks, setDelayWeeks] = useState(0)

  useEffect(() => {
    async function fetch() {
      const { data: p } = await supabase.from('projects').select('*, clients(*)').eq('id', id).single()
      if (p) { setProject(p); setDelayWeeks(p.delay_weeks || 0) }
      const { data: pl } = await supabase.from('project_lots').select('*, lots(*), companies(*)').eq('project_id', id)
      if (pl) setLots(pl)
      setLoading(false)
    }
    fetch()
  }, [id])

  async function saveDelay(val) {
    setDelayWeeks(val)
    await supabase.from('projects').update({ delay_weeks: parseInt(val) || 0 }).eq('id', id)
  }

  function getEndDate() {
    if (!project?.start_date || !project?.duration_months) return '-'
    const d = new Date(project.start_date)
    d.setMonth(d.getMonth() + project.duration_months + Math.round(delayWeeks * 7 / 30))
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  function getBudgetPct() {
    if (!project?.budget_ht || project.budget_ht === 0) return 0
    const unlocked = lots.reduce((s, l) => s + (l.unlocked_ht || 0), 0)
    return Math.round(unlocked / project.budget_ht * 100)
  }

  function getTotalUnlocked() {
    return lots.reduce((s, l) => s + (l.unlocked_ht || 0), 0)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>Chargement...</div>
  if (!project) return <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>Chantier introuvable</div>

  const pct = getBudgetPct()
  const fillColor = pct > 80 ? '#E24B4A' : pct > 50 ? '#EF9F27' : '#1D9E75'
  const tabs = ['Synthese', 'Lots', 'Planning', 'Alertes', 'Documents', 'Infos']

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#f5f4f0' }}>

      <div style={{ background: '#fff', padding: '14px 16px', borderBottom: '0.5px solid #e0dfd7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div onClick={() => navigate('/')} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e0dfd7', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="#888" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{project.name}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{project.ref_number}{project.address ? ' · ' + project.address : ''}</div>
          </div>
        </div>
 <div onClick={() => navigate('/chantier/' + id + '/modifier')} style={{ fontSize: 12, color: '#1a1a1a', border: '0.5px solid #1a1a1a', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 500 }}>Modifier</div>
      </div>

      <div style={{ display: 'flex', background: '#fff', borderBottom: '0.5px solid #e0dfd7', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {tabs.map((t, i) => (
          <div key={i} onClick={() => setTab(i)} style={{ padding: '10px 12px', fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer', borderBottom: tab === i ? '2px solid #1a1a1a' : '2px solid transparent', color: tab === i ? '#1a1a1a' : '#888', fontWeight: tab === i ? 500 : 400, flexShrink: 0 }}>
            {t}
          </div>
        ))}
      </div>

      <div style={{ padding: tab === 2 ? '14px 8px 80px' : '14px 14px 80px' }}>

        {tab === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Budget</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={card}>
                <div style={cardLabel}>Budget prevu HT</div>
                <div style={cardVal}>{project.budget_ht ? project.budget_ht.toLocaleString('fr-FR') + ' EUR' : '-'}</div>
                {project.budget_ht && project.contingency_pct && (
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>+ {Math.round(project.budget_ht * project.contingency_pct / 100).toLocaleString('fr-FR')} EUR imprevus</div>
                )}
              </div>
              <div style={card}>
                <div style={cardLabel}>Debloque</div>
                <div style={{ ...cardVal, color: fillColor }}>{pct}%</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{getTotalUnlocked().toLocaleString('fr-FR')} EUR</div>
                <div style={{ height: 4, background: '#e0dfd7', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct + '%', background: fillColor, borderRadius: 2 }}></div>
                </div>
              </div>
              <div style={card}>
                <div style={cardLabel}>Restant</div>
                <div style={cardVal}>{project.budget_ht ? (project.budget_ht - getTotalUnlocked()).toLocaleString('fr-FR') + ' EUR' : '-'}</div>
              </div>
              <div style={card}>
                <div style={cardLabel}>Solde imprevus</div>
                <div style={{ ...cardVal, color: '#1D9E75' }}>
                  {project.budget_ht && project.contingency_pct
                    ? Math.round(project.budget_ht * project.contingency_pct / 100).toLocaleString('fr-FR') + ' EUR'
                    : '-'}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>Planning & delai</div>
            <div style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}>Avancement</span>
                <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: delayWeeks > 0 ? '#FAEEDA' : '#EAF3DE', color: delayWeeks > 0 ? '#854F0B' : '#3B6D11', fontWeight: 500 }}>
                  {delayWeeks > 0 ? 'Retard' : 'En cours'}
                </span>
              </div>
              {project.start_date && (
                <div style={{ fontSize: 12, color: '#888' }}>
                  {new Date(project.start_date).toLocaleDateString('fr-FR')} → {getEndDate()}
                </div>
              )}
              <div style={{ height: 4, background: '#e0dfd7', borderRadius: 2, margin: '8px 0 4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', background: '#EF9F27', borderRadius: 2 }}></div>
              </div>
              {delayWeeks > 0 && (
                <div style={{ fontSize: 11, color: '#BA7517', textAlign: 'right' }}>+{delayWeeks} semaines de retard</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #e0dfd7' }}>
                <div style={{ flex: 1, fontSize: 12, color: '#888' }}>Correction manuelle du retard</div>
                <input type="number" value={delayWeeks} onChange={e => saveDelay(e.target.value)} style={{ width: 60, fontSize: 13, padding: '5px 8px', borderRadius: 6, border: '0.5px solid #e0dfd7', background: '#f5f4f0', textAlign: 'center', fontFamily: 'inherit' }} />
                <div style={{ fontSize: 12, color: '#888' }}>semaines</div>
              </div>
            </div>
          </div>
        )}

        {tab === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Lots du chantier</div>
            {lots.length === 0 && (
              <div style={{ textAlign: 'center', padding: 30, color: '#aaa', fontSize: 13 }}>Aucun lot defini pour ce chantier</div>
            )}
            {lots.map((l, i) => {
              const colors = ['#1D9E75','#EF9F27','#378ADD','#7F77DD','#D85A30','#D4537E','#3B6D11']
              const color = colors[i % colors.length]
              const lotPct = l.amount_ht ? Math.round((l.unlocked_ht || 0) / l.amount_ht * 100) : 0
              return (
                <div key={l.id} style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{l.lots?.name}</div>
                    <div style={{ fontSize: 11, color: l.companies ? '#888' : '#E24B4A', marginTop: 1 }}>
                      {l.companies ? l.companies.name : 'Aucune entreprise'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{l.amount_ht ? l.amount_ht.toLocaleString('fr-FR') + ' EUR' : '- EUR'}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{lotPct}% debloque</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 2 && (
          <PlanningGantt projectId={id} lots={lots} />
        )}

        {tab === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Alertes</div>
            {delayWeeks > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', borderRadius: 8, background: '#FCEBEB', cursor: 'pointer' }} onClick={() => setTab(0)}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#E24B4A', marginTop: 4, flexShrink: 0 }}></div>
                <div>
                  <div style={{ fontSize: 12, color: '#1a1a1a' }}>Retard de {delayWeeks} semaine(s) sur ce chantier</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>Modifier dans l onglet Synthese</div>
                  <div style={{ fontSize: 11, color: '#185FA5', fontWeight: 500, marginTop: 4 }}>→ Voir la synthese</div>
                </div>
              </div>
            )}
            {delayWeeks === 0 && (
              <div style={{ textAlign: 'center', padding: 30, color: '#aaa', fontSize: 13 }}>Aucune alerte pour ce chantier</div>
            )}
          </div>
        )}

        {tab === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['Contrats','Plans','PV de reunion','Factures','Devis'].map(cat => (
              <div key={cat}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#888', padding: '6px 0 4px', display: 'flex', justifyContent: 'space-between' }}>
                  {cat} <span style={{ fontSize: 11, background: '#f5f4f0', padding: '1px 6px', borderRadius: 10 }}>0</span>
                </div>
                <div style={{ fontSize: 12, color: '#aaa', padding: '6px 10px', background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 8 }}>Aucun document</div>
              </div>
            ))}
            <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: '#888', border: '0.5px dashed #ccc', borderRadius: 8, padding: 9, cursor: 'pointer', background: 'none', width: '100%', fontFamily: 'inherit' }}>
              + Ajouter un document
            </button>
          </div>
        )}

        {tab === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Chantier</div>
            {[
              ['N° d affaire', project.ref_number],
              ['Adresse', project.address || '-'],
              ['Statut', project.status],
              ['Mission', project.mission_phases?.join(' · ') || '-'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0', borderBottom: '0.5px solid #e0dfd7', fontSize: 13 }}>
                <span style={{ color: '#888' }}>{k}</span>
                <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{v}</span>
              </div>
            ))}
            {project.clients && (
              <>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>Maitre d ouvrage</div>
                {[
                  ['Nom', project.clients.last_name + ' ' + (project.clients.first_name || '')],
                  ['Telephone', project.clients.phone || '-'],
                  ['Email', project.clients.email || '-'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0', borderBottom: '0.5px solid #e0dfd7', fontSize: 13 }}>
                    <span style={{ color: '#888' }}>{k}</span>
                    <span style={{ fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </>
            )}
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>Planning</div>
            {[
              ['Demarrage', project.start_date ? new Date(project.start_date).toLocaleDateString('fr-FR') : '-'],
              ['Duree prevue', project.duration_months ? project.duration_months + ' mois' : '-'],
              ['Fin theorique', getEndDate()],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0', borderBottom: '0.5px solid #e0dfd7', fontSize: 13 }}>
                <span style={{ color: '#888' }}>{k}</span>
                <span style={{ fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

const card = { background: '#f5f4f0', borderRadius: 8, padding: '10px 12px' }
const cardLabel = { fontSize: 11, color: '#888', marginBottom: 4 }
const cardVal = { fontSize: 16, fontWeight: 500, color: '#1a1a1a' }
