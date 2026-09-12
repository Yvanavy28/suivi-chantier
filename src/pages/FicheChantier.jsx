import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PlanningGantt from '../components/PlanningGantt'
import AjoutFacture from '../components/AjoutFacture'
import AjoutDocument from '../components/AjoutDocument'
import PlanningEditor from '../components/PlanningEditor'
import CoverImageUpload from '../components/CoverImageUpload'
import AjoutVisite from '../components/AjoutVisite'
import { useRole } from '../lib/useRole'
import { generateVisitPdf } from '../lib/visitPdf'

export default function FicheChantier() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useRole()
  const [tab, setTab] = useState(0)
  const [project, setProject] = useState(null)
  const [lots, setLots] = useState([])
  const [companies, setCompanies] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [delayWeeks, setDelayWeeks] = useState(0)
  const [showAjoutFacture, setShowAjoutFacture] = useState(false)
  const [visits, setVisits] = useState([])
  const [visitReserves, setVisitReserves] = useState([])
  const [showAjoutVisite, setShowAjoutVisite] = useState(false)
  const [expandedVisitId, setExpandedVisitId] = useState(null)

  async function loadData() {
    const [{ data: p }, { data: pl }, { data: cs }, { data: docs }, { data: vis }, { data: res }] = await Promise.all([
      supabase.from('projects').select('*, clients(*)').eq('id', id).single(),
      supabase.from('project_lots').select('*, lots(*), companies(*)').eq('project_id', id),
      supabase.from('companies').select('*').order('name'),
      supabase.from('documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('visits').select('*').eq('project_id', id).order('visit_date', { ascending: false }),
      supabase.from('visit_reserves').select('*, visits!inner(project_id)').eq('visits.project_id', id),
    ])
    if (p) { setProject(p); setDelayWeeks(p.delay_weeks || 0) }
    if (pl) setLots(pl)
    if (cs) setCompanies(cs)
    if (docs) setDocuments(docs)
    if (vis) setVisits(vis)
    if (res) setVisitReserves(res)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData() }, [id])

  function getBudgetPct() {
    if (!project?.budget_ht || project.budget_ht === 0) return 0
    const unlocked = lots.reduce((s, l) => s + (l.unlocked_ht || 0), 0)
    return Math.round(unlocked / project.budget_ht * 100)
  }

  function getTotalUnlocked() { return lots.reduce((s, l) => s + (l.unlocked_ht || 0), 0) }
  function getTotalExtra() { return lots.reduce((s, l) => s + (l.extra_ht || 0), 0) }
  function getDocsByCategory(cat) { return documents.filter(d => d.category === cat) }

  async function getSignedUrl(filePath) {
    const buckets = ['documents', 'invoices', 'insurances']
    for (const bucket of buckets) {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(filePath, 300)
      if (data?.signedUrl) return data.signedUrl
    }
    return null
  }

  async function downloadDoc(filePath, fileName) {
    const url = await getSignedUrl(filePath)
    if (url) {
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.target = '_blank'
      a.click()
    }
  }

  async function previewDoc(filePath) {
    const url = await getSignedUrl(filePath)
    if (url) window.open(url, '_blank')
  }

  async function shareDoc(filePath, fileName) {
    const url = await getSignedUrl(filePath)
    if (!url) return
    if (navigator.share) {
      await navigator.share({ title: fileName, url })
    } else {
      await navigator.clipboard.writeText(url)
      alert('Lien copié dans le presse-papiers')
    }
  }

  async function deleteDoc(docId, filePath) {
    if (!window.confirm('Supprimer ce document ?')) return
    const buckets = ['documents', 'invoices', 'insurances']
    for (const bucket of buckets) {
      await supabase.storage.from(bucket).remove([filePath])
    }
    await supabase.from('documents').delete().eq('id', docId)
    loadData()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>Chargement...</div>
  if (!project) return <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>Chantier introuvable</div>

  const pct = getBudgetPct()
  const fillColor = pct > 80 ? '#E24B4A' : pct > 50 ? '#EF9F27' : '#1D9E75'
  const totalExtra = getTotalExtra()
  const tabs = ['Synthese', 'Lots', 'Planning', 'Alertes', 'Documents', 'Infos', 'Visites']
  const docCategories = [
    { key: 'contrats', label: 'Contrats' },
    { key: 'plans', label: 'Plans' },
    { key: 'pv_reunion', label: 'PV de reunion' },
    { key: 'factures', label: 'Factures' },
    { key: 'devis', label: 'Devis' },
    { key: 'visite', label: 'Visites' },
    { key: 'autre', label: 'Autre' },
  ]

  function getReservesForVisit(visitId) {
    return visitReserves.filter(r => r.visit_id === visitId)
  }

  function getPhotosForVisit(visitId) {
    return documents.filter(d => d.visit_id === visitId)
  }

  async function toggleReserveStatus(reserve) {
    const newStatus = reserve.status === 'resolu' ? 'ouvert' : 'resolu'
    await supabase.from('visit_reserves').update({
      status: newStatus,
      resolved_at: newStatus === 'resolu' ? new Date().toISOString() : null,
    }).eq('id', reserve.id)
    loadData()
  }

  function downloadVisitPdf(visit) {
    generateVisitPdf({ projectName: project.name, visit, reserves: getReservesForVisit(visit.id) })
  }

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
        {isAdmin && (
          <div onClick={() => navigate('/chantier/' + id + '/modifier')} style={{ fontSize: 12, color: '#1a1a1a', border: '0.5px solid #1a1a1a', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 500 }}>Modifier</div>
        )}
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
                <div style={cardLabel}>Budget prévu HT</div>
                <div style={cardVal}>{project.budget_ht ? project.budget_ht.toLocaleString('fr-FR') + ' EUR' : '-'}</div>
                {project.budget_ht && project.contingency_pct && (
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>+ {Math.round(project.budget_ht * project.contingency_pct / 100).toLocaleString('fr-FR')} EUR imprevus</div>
                )}
              </div>
              <div style={card}>
                <div style={cardLabel}>Débloqué</div>
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

            {totalExtra > 0 && (
              <div style={{ background: '#FAEEDA', border: '0.5px solid #EF9F27', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#854F0B', marginBottom: 2 }}>Budget travaux supplémentaires</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#854F0B' }}>{totalExtra.toLocaleString('fr-FR')} EUR</div>
                </div>
                <div style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: '#EF9F27', color: '#fff', fontWeight: 500 }}>TS</div>
              </div>
            )}

            {isAdmin && (
              <div onClick={() => setShowAjoutFacture(!showAjoutFacture)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#185FA5', border: '0.5px solid #185FA5', borderRadius: 8, padding: '10px', cursor: 'pointer', background: '#E6F1FB' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke="#185FA5" strokeWidth="1.2"/><line x1="4.5" y1="5" x2="9.5" y2="5" stroke="#185FA5" strokeWidth="1"/><line x1="4.5" y1="7.5" x2="9.5" y2="7.5" stroke="#185FA5" strokeWidth="1"/></svg>
                {showAjoutFacture ? 'Fermer' : '+ Ajouter une facture'}
              </div>
            )}

            {showAjoutFacture && isAdmin && (
              <AjoutFacture
                projectId={id}
                lots={lots}
                companies={companies}
                onSuccess={() => { setShowAjoutFacture(false); loadData() }}
              />
            )}

            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>Planning & delai</div>
            <PlanningEditor
              project={project}
              projectId={id}
              readOnly={!isAdmin}
              onUpdate={(updated) => {
                setProject(prev => ({ ...prev, ...updated }))
                setDelayWeeks(updated.delay_weeks || 0)
              }}
            />
          </div>
        )}

        {tab === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Lots du chantier</div>
            {lots.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: '#aaa', fontSize: 13 }}>Aucun lot defini</div>}
            {lots.map((l, i) => {
              const colors = ['#1D9E75','#EF9F27','#378ADD','#7F77DD','#D85A30','#D4537E','#3B6D11']
              const color = colors[i % colors.length]
              const lotPct = l.amount_ht ? Math.round((l.unlocked_ht || 0) / l.amount_ht * 100) : 0
              return (
                <div key={l.id} onClick={() => navigate('/chantier/' + id + '/lot/' + l.id)} style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 8, padding: '10px 12px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{l.lots?.name}</div>
                      <div style={{ fontSize: 11, color: l.companies ? '#888' : '#E24B4A', marginTop: 1 }}>{l.companies ? l.companies.name : 'Aucune entreprise'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{l.amount_ht ? l.amount_ht.toLocaleString('fr-FR') + ' EUR' : '- EUR'}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{lotPct}% debloque</div>
                    </div>
                  </div>
                  {(l.extra_ht > 0) && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#854F0B', background: '#FAEEDA', borderRadius: 5, padding: '3px 8px', display: 'inline-block' }}>
                      + {l.extra_ht.toLocaleString('fr-FR')} EUR TS
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab === 2 && <PlanningGantt projectId={id} lots={lots} />}

        {tab === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Alertes</div>
            {delayWeeks > 0 ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', borderRadius: 8, background: '#FCEBEB', cursor: 'pointer' }} onClick={() => setTab(0)}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#E24B4A', marginTop: 4, flexShrink: 0 }}></div>
                <div>
                  <div style={{ fontSize: 12, color: '#1a1a1a' }}>Retard de {delayWeeks} semaine(s)</div>
                  <div style={{ fontSize: 11, color: '#185FA5', fontWeight: 500, marginTop: 4 }}>→ Voir la synthese</div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 30, color: '#aaa', fontSize: 13 }}>Aucune alerte</div>
            )}
          </div>
        )}

        {tab === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isAdmin && <AjoutDocument projectId={id} onSuccess={() => loadData()} />}
            {docCategories.map(cat => {
              const docs = getDocsByCategory(cat.key)
              if (docs.length === 0) return null
              return (
                <div key={cat.key}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#888', padding: '6px 0 4px', display: 'flex', justifyContent: 'space-between' }}>
                    {cat.label}
                    <span style={{ fontSize: 11, background: '#f5f4f0', padding: '1px 6px', borderRadius: 10 }}>{docs.length}</span>
                  </div>
                  {docs.map(doc => (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 8, marginBottom: 5 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke="#185FA5" strokeWidth="1.2"/></svg>
                      </div>
                      <div style={{ flex: 1, fontSize: 12, color: '#1a1a1a' }}>{doc.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {doc.ai_extracted && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: '#E6F1FB', color: '#0C447C' }}>IA</span>}
                        <div onClick={() => previewDoc(doc.file_path)} style={{ width: 28, height: 28, borderRadius: 6, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title='Aperçu'>
                          <svg width='14' height='14' viewBox='0 0 14 14' fill='none'><circle cx='7' cy='7' r='4' stroke='#185FA5' strokeWidth='1.2'/><circle cx='7' cy='7' r='1.5' fill='#185FA5'/></svg>
                        </div>
                        <div onClick={() => shareDoc(doc.file_path, doc.name)} style={{ width: 28, height: 28, borderRadius: 6, background: '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title='Partager'>
                          <svg width='14' height='14' viewBox='0 0 14 14' fill='none'><circle cx='11' cy='3' r='1.5' stroke='#3B6D11' strokeWidth='1.1'/><circle cx='11' cy='11' r='1.5' stroke='#3B6D11' strokeWidth='1.1'/><circle cx='3' cy='7' r='1.5' stroke='#3B6D11' strokeWidth='1.1'/><line x1='4.5' y1='6.2' x2='9.5' y2='3.8' stroke='#3B6D11' strokeWidth='1.1'/><line x1='4.5' y1='7.8' x2='9.5' y2='10.2' stroke='#3B6D11' strokeWidth='1.1'/></svg>
                        </div>
                        <div onClick={() => downloadDoc(doc.file_path, doc.name)} style={{ width: 28, height: 28, borderRadius: 6, background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title='Télécharger'>
                          <svg width='14' height='14' viewBox='0 0 14 14' fill='none'><path d='M7 2v7M4 7l3 3 3-3' stroke='#555' strokeWidth='1.3' strokeLinecap='round' strokeLinejoin='round'/><line x1='2' y1='12' x2='12' y2='12' stroke='#555' strokeWidth='1.3' strokeLinecap='round'/></svg>
                        </div>
                        <div onClick={() => deleteDoc(doc.id, doc.file_path)} style={{ width: 28, height: 28, borderRadius: 6, background: '#FCEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title='Supprimer'>
                          <svg width='14' height='14' viewBox='0 0 14 14' fill='none'><path d='M2 4h10M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3 4l.8 7.5h6.4L11 4' stroke='#E24B4A' strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round'/></svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
            {documents.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: '#aaa', fontSize: 13 }}>Aucun document ajouté</div>}
          </div>
        )}

        {tab === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <CoverImageUpload
              projectId={id}
              currentUrl={project.cover_image_url}
              onSuccess={(url) => setProject(prev => ({ ...prev, cover_image_url: url }))}
            />
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, marginTop: 14 }}>Chantier</div>
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
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0', borderBottom: '0.5px solid #e0dfd7', fontSize: 13 }}>
                <span style={{ color: '#888' }}>{k}</span>
                <span style={{ fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isAdmin && (
              <div onClick={() => setShowAjoutVisite(!showAjoutVisite)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#185FA5', border: '0.5px solid #185FA5', borderRadius: 8, padding: '10px', cursor: 'pointer', background: '#E6F1FB' }}>
                {showAjoutVisite ? 'Fermer' : '+ Nouvelle visite'}
              </div>
            )}

            {showAjoutVisite && isAdmin && (
              <AjoutVisite projectId={id} onSuccess={() => { setShowAjoutVisite(false); loadData() }} />
            )}

            {visits.length === 0 && !showAjoutVisite && (
              <div style={{ textAlign: 'center', padding: 30, color: '#aaa', fontSize: 13 }}>Aucune visite enregistrée</div>
            )}

            {visits.map(v => {
              const isExpanded = expandedVisitId === v.id
              const vReserves = getReservesForVisit(v.id)
              const vPhotos = getPhotosForVisit(v.id)
              const openReserves = vReserves.filter(r => r.status === 'ouvert').length
              return (
                <div key={v.id} style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 10, overflow: 'hidden' }}>
                  <div onClick={() => setExpandedVisitId(isExpanded ? null : v.id)} style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{new Date(v.visit_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{v.participants || 'Participants non renseignés'}</div>
                    </div>
                    {openReserves > 0 && (
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: '#FCEBEB', color: '#A32D2D', fontWeight: 500 }}>{openReserves} réserve{openReserves > 1 ? 's' : ''}</span>
                    )}
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '0.5px solid #e0dfd7' }}>
                      {v.audio_path && <VisitAudioPlayer filePath={v.audio_path} getSignedUrl={getSignedUrl} />}

                      {v.notes && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Observations</div>
                          <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{v.notes}</div>
                        </div>
                      )}

                      {vReserves.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Réserves</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {vReserves.map(r => (
                              <div key={r.id} onClick={() => isAdmin && toggleReserveStatus(r)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: r.status === 'resolu' ? '#EAF3DE' : '#FCEBEB', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: isAdmin ? 'pointer' : 'default' }}>
                                <span style={{ color: r.status === 'resolu' ? '#3B6D11' : '#A32D2D' }}>{r.description}</span>
                                <span style={{ fontSize: 10, fontWeight: 500, color: r.status === 'resolu' ? '#3B6D11' : '#A32D2D' }}>{r.status === 'resolu' ? 'Résolu' : 'Ouvert'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {vPhotos.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Photos ({vPhotos.length})</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {vPhotos.map(doc => (
                              <div key={doc.id} onClick={() => previewDoc(doc.file_path)} style={{ width: 56, height: 56, borderRadius: 6, background: '#f5f4f0', border: '0.5px solid #e0dfd7', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 10, color: '#888', textAlign: 'center', padding: 4 }}>
                                {doc.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button onClick={() => downloadVisitPdf(v)} style={{ fontSize: 12, padding: '8px', borderRadius: 8, border: '0.5px solid #e0dfd7', background: '#f5f4f0', cursor: 'pointer', fontFamily: 'inherit', color: '#1a1a1a' }}>
                        Télécharger le compte-rendu (PDF)
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

function VisitAudioPlayer({ filePath, getSignedUrl }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let active = true
    getSignedUrl(filePath).then(u => { if (active) setUrl(u) })
    return () => { active = false }
  }, [filePath, getSignedUrl])

  if (!url) return <div style={{ fontSize: 12, color: '#aaa' }}>Chargement de l'enregistrement...</div>
  return (
    <div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Enregistrement</div>
      <audio controls src={url} style={{ width: '100%' }} />
    </div>
  )
}

const card = { background: '#f5f4f0', borderRadius: 8, padding: '10px 12px' }
const cardLabel = { fontSize: 11, color: '#888', marginBottom: 4 }
const cardVal = { fontSize: 16, fontWeight: 500, color: '#1a1a1a' }
