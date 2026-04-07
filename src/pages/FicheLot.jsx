import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AjoutFacture from '../components/AjoutFacture'
import AjoutDocument from '../components/AjoutDocument'
import ExtracteurDevis from '../components/ExtracteurDevis'

export default function FicheLot() {
  const { projectId, lotId } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [lot, setLot] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [quotes, setQuotes] = useState([])
  const [allLots, setAllLots] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAjout, setShowAjout] = useState(false)
  const [lotDocuments, setLotDocuments] = useState([])
  const [showAddQuote, setShowAddQuote] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustedAmount, setAdjustedAmount] = useState('')
  const [quoteForm, setQuoteForm] = useState({ quote_number: '', quote_date: '', amount_ht: '', tva_rate: '20', amount_ttc: '' })
  const [savingQuote, setSavingQuote] = useState(false)

  useEffect(() => { loadData() }, [lotId])

  async function loadData() {
    const [{ data: l }, { data: inv }, { data: q }, { data: ls }, { data: cs }, { data: ldocs }] = await Promise.all([
      supabase.from('project_lots').select('*, lots(*), companies(*)').eq('id', lotId).single(),
      supabase.from('invoices').select('*, quotes(quote_number, amount_ttc, amount_ht)').eq('project_lot_id', lotId).order('created_at', { ascending: false }),
      supabase.from('quotes').select('*').eq('project_lot_id', lotId).order('created_at', { ascending: false }),
      supabase.from('project_lots').select('*, lots(*), companies(*)').eq('project_id', projectId),
      supabase.from('companies').select('*').order('name'),
      supabase.from('documents').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    ])
    if (l) setLot(l)
    if (inv) setInvoices(inv)
    if (q) setQuotes(q)
    if (ls) setAllLots(ls)
    if (cs) setCompanies(cs)
    if (ldocs) setLotDocuments(ldocs)
    setLoading(false)
  }

  function getTotalDevisTTC() {
    return quotes.filter(q => q.status === 'accepte').reduce((s, q) => s + (q.amount_ttc || q.amount_ht || 0), 0)
  }

  function getTotalFactureTTC() {
    return invoices.reduce((s, i) => s + (i.amount_ttc || i.amount_ht || 0), 0)
  }

  function getMarcheTTC() {
    if (lot?.amount_ht_adjusted) return lot.amount_ht_adjusted
    return getTotalDevisTTC()
  }

  function getQuoteFacturedTTC(quoteId) {
    return invoices.filter(i => i.quote_id === quoteId).reduce((s, i) => s + (i.amount_ttc || i.amount_ht || 0), 0)
  }

  async function updateCompany(companyId) {
    await supabase.from('project_lots').update({ company_id: companyId || null }).eq('id', lotId)
    const company = companies.find(c => c.id === companyId) || null
    setLot(prev => ({ ...prev, company_id: companyId, companies: company }))
  }

  async function saveAdjust() {
    const val = parseFloat(adjustedAmount) || null
    await supabase.from('project_lots').update({ amount_ht_adjusted: val }).eq('id', lotId)
    setLot(prev => ({ ...prev, amount_ht_adjusted: val }))
    setShowAdjust(false)
  }

  async function saveQuote() {
    if (!quoteForm.amount_ttc) return
    setSavingQuote(true)
    const { data } = await supabase.from('quotes').insert([{
      project_lot_id: lotId,
      project_id: projectId,
      company_id: lot.company_id || null,
      quote_number: quoteForm.quote_number || null,
      quote_date: quoteForm.quote_date || null,
      amount_ht: quoteForm.amount_ht ? parseFloat(quoteForm.amount_ht) : null,
      tva_rate: parseFloat(quoteForm.tva_rate) || 20,
      amount_ttc: parseFloat(quoteForm.amount_ttc),
      status: 'accepte',
    }]).select().single()

    if (data) {
      const newQuotes = [data, ...quotes]
      setQuotes(newQuotes)
      const totalTTC = newQuotes.filter(q => q.status === 'accepte').reduce((s, q) => s + (q.amount_ttc || 0), 0)
      await supabase.from('project_lots').update({ amount_ht: totalTTC }).eq('id', lotId)
      setShowAddQuote(false)
      setQuoteForm({ quote_number: '', quote_date: '', amount_ht: '', tva_rate: '20', amount_ttc: '' })
    }
    setSavingQuote(false)
  }

  async function deleteQuote(quoteId) {
    if (!window.confirm('Supprimer ce devis ?')) return
    const newQuotes = quotes.filter(q => q.id !== quoteId)
    await supabase.from('quotes').delete().eq('id', quoteId)
    setQuotes(newQuotes)
    const totalTTC = newQuotes.filter(q => q.status === 'accepte').reduce((s, q) => s + (q.amount_ttc || 0), 0)
    await supabase.from('project_lots').update({ amount_ht: totalTTC }).eq('id', lotId)
  }

  async function updateInvoiceStatus(invId, status) {
    await supabase.from('invoices').update({ status }).eq('id', invId)
    setInvoices(prev => prev.map(i => i.id === invId ? { ...i, status } : i))
    const validated = invoices.map(i => i.id === invId ? { ...i, status } : i)
      .filter(i => ['validee','payee'].includes(i.status))
      .reduce((s, i) => s + (i.amount_ttc || i.amount_ht || 0), 0)
    await supabase.from('project_lots').update({ unlocked_ht: validated }).eq('id', lotId)
  }

  async function deleteInvoice(invId) {
    if (!window.confirm('Supprimer cette facture ?')) return
    await supabase.from('invoices').delete().eq('id', invId)
    setInvoices(prev => prev.filter(i => i.id !== invId))
    loadData()
  }

  async function getSignedUrl(filePath) {
    const buckets = ['documents', 'invoices', 'insurances']
    for (const bucket of buckets) {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(filePath, 300)
      if (data?.signedUrl) return data.signedUrl
    }
    return null
  }

  async function previewFile(filePath) {
    const url = await getSignedUrl(filePath)
    if (url) window.open(url, '_blank')
  }

  async function shareFile(filePath, name) {
    const url = await getSignedUrl(filePath)
    if (!url) return
    if (navigator.share) {
      await navigator.share({ title: name, url })
    } else {
      await navigator.clipboard.writeText(url)
      alert('Lien copié dans le presse-papiers')
    }
  }

  async function downloadFile(filePath, name) {
    const url = await getSignedUrl(filePath)
    if (url) {
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.target = '_blank'
      a.click()
    }
  }

  async function deleteFile(filePath) {
    const buckets = ['documents', 'invoices', 'insurances']
    for (const bucket of buckets) {
      await supabase.storage.from(bucket).remove([filePath])
    }
    await supabase.from('documents').delete().eq('file_path', filePath)
  }

  const statusLabel = { recue: 'Reçue', verifiee: 'Vérifiée', validee: 'Validée', payee: 'Payée' }
  const statusColor = {
    recue: { bg: '#f5f4f0', color: '#888' },
    verifiee: { bg: '#E6F1FB', color: '#185FA5' },
    validee: { bg: '#EAF3DE', color: '#3B6D11' },
    payee: { bg: '#EAF3DE', color: '#3B6D11' }
  }
  const quoteStatusLabel = { en_attente: 'En attente', accepte: 'Accepté', refuse: 'Refusé' }
  const quoteStatusColor = {
    en_attente: { bg: '#FAEEDA', color: '#854F0B' },
    accepte: { bg: '#EAF3DE', color: '#3B6D11' },
    refuse: { bg: '#FCEBEB', color: '#A32D2D' }
  }

  function FileActions({ filePath, name }) {
    if (!filePath) return null
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px 8px', borderTop: '0.5px solid #f0efea' }}>
        <div style={{ fontSize: 11, color: '#888', marginRight: 4 }}>Document :</div>
        <div onClick={() => previewFile(filePath)} style={{ width: 26, height: 26, borderRadius: 6, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title='Aperçu'>
          <svg width='13' height='13' viewBox='0 0 14 14' fill='none'><circle cx='7' cy='7' r='4' stroke='#185FA5' strokeWidth='1.2'/><circle cx='7' cy='7' r='1.5' fill='#185FA5'/></svg>
        </div>
        <div onClick={() => shareFile(filePath, name)} style={{ width: 26, height: 26, borderRadius: 6, background: '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title='Partager'>
          <svg width='13' height='13' viewBox='0 0 14 14' fill='none'><circle cx='11' cy='3' r='1.5' stroke='#3B6D11' strokeWidth='1.1'/><circle cx='11' cy='11' r='1.5' stroke='#3B6D11' strokeWidth='1.1'/><circle cx='3' cy='7' r='1.5' stroke='#3B6D11' strokeWidth='1.1'/><line x1='4.5' y1='6.2' x2='9.5' y2='3.8' stroke='#3B6D11' strokeWidth='1.1'/><line x1='4.5' y1='7.8' x2='9.5' y2='10.2' stroke='#3B6D11' strokeWidth='1.1'/></svg>
        </div>
        <div onClick={() => downloadFile(filePath, name)} style={{ width: 26, height: 26, borderRadius: 6, background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title='Télécharger'>
          <svg width='13' height='13' viewBox='0 0 14 14' fill='none'><path d='M7 2v7M4 7l3 3 3-3' stroke='#555' strokeWidth='1.3' strokeLinecap='round' strokeLinejoin='round'/><line x1='2' y1='12' x2='12' y2='12' stroke='#555' strokeWidth='1.3' strokeLinecap='round'/></svg>
        </div>
        <div onClick={async () => { if (!window.confirm('Supprimer ce document ?')) return; await deleteFile(filePath); loadData() }} style={{ width: 26, height: 26, borderRadius: 6, background: '#FCEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title='Supprimer'>
          <svg width='13' height='13' viewBox='0 0 14 14' fill='none'><path d='M2 4h10M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3 4l.8 7.5h6.4L11 4' stroke='#E24B4A' strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round'/></svg>
        </div>
      </div>
    )
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>Chargement...</div>
  if (!lot) return <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>Lot introuvable</div>

  const marcheTTC = getMarcheTTC()
  const totalFactureTTC = getTotalFactureTTC()
  const resteTotal = marcheTTC - totalFactureTTC
  const acceptedQuotes = quotes.filter(q => q.status === 'accepte')
  const tabs = ['Résumé', 'Devis', 'Factures', 'Documents']

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#f5f4f0' }}>

      <div style={{ background: '#fff', padding: '14px 16px', borderBottom: '0.5px solid #e0dfd7', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div onClick={() => navigate('/chantier/' + projectId)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e0dfd7', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="#888" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Lot {lot.lots?.name}</div>
          <div style={{ fontSize: 11, color: '#888' }}>{lot.companies?.name || 'Aucune entreprise'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', background: '#fff', borderBottom: '0.5px solid #e0dfd7' }}>
        {tabs.map((t, i) => (
          <div key={i} onClick={() => setTab(i)} style={{ flex: 1, padding: '10px 6px', fontSize: 12, textAlign: 'center', cursor: 'pointer', borderBottom: tab === i ? '2px solid #1a1a1a' : '2px solid transparent', color: tab === i ? '#1a1a1a' : '#888', fontWeight: tab === i ? 500 : 400 }}>
            {t}
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 14px 100px' }}>

        {tab === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Entreprise</div>
            <div style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Entreprise attribuée</div>
              <select value={lot.company_id || ''} onChange={e => updateCompany(e.target.value)} style={inp}>
                <option value="">-- Choisir une entreprise --</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Situation financière (TTC)</div>

            <div style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid #e0dfd7' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Montant du marché TTC</div>
                  <div style={{ fontSize: 18, fontWeight: 500 }}>{marcheTTC.toLocaleString('fr-FR')} EUR</div>
                  {lot.amount_ht_adjusted && <div style={{ fontSize: 11, color: '#EF9F27' }}>Montant ajusté manuellement</div>}
                  {!lot.amount_ht_adjusted && <div style={{ fontSize: 11, color: '#aaa' }}>= somme des devis acceptés</div>}
                </div>
                <div onClick={() => { setAdjustedAmount(marcheTTC); setShowAdjust(!showAdjust) }} style={{ fontSize: 11, color: '#185FA5', border: '0.5px solid #185FA5', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                  Ajuster
                </div>
              </div>
              {showAdjust && (
                <div style={{ padding: '10px 14px', background: '#f5f4f0', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '0.5px solid #e0dfd7' }}>
                  <input type="number" value={adjustedAmount} onChange={e => setAdjustedAmount(e.target.value)} placeholder="Montant TTC ajusté" style={{ ...inp, flex: 2 }} />
                  <button onClick={saveAdjust} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: '#1a1a1a', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>OK</button>
                  {lot.amount_ht_adjusted && (
                    <button onClick={async () => { await supabase.from('project_lots').update({ amount_ht_adjusted: null }).eq('id', lotId); setLot(prev => ({ ...prev, amount_ht_adjusted: null })); setShowAdjust(false) }}
                      style={{ flex: 1, padding: '9px', borderRadius: 8, border: '0.5px solid #e0dfd7', background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: '#888' }}>Reset</button>
                  )}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                <div style={{ padding: '10px 14px', borderRight: '0.5px solid #e0dfd7', borderBottom: '0.5px solid #e0dfd7' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Total facturé TTC</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: '#EF9F27' }}>{totalFactureTTC.toLocaleString('fr-FR')} EUR</div>
                </div>
                <div style={{ padding: '10px 14px', borderBottom: '0.5px solid #e0dfd7', background: resteTotal < 0 ? '#FCEBEB' : '#EAF3DE' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Reste à facturer TTC</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: resteTotal < 0 ? '#A32D2D' : '#3B6D11' }}>
                    {resteTotal < 0 ? '⚠ ' : ''}{resteTotal.toLocaleString('fr-FR')} EUR
                  </div>
                </div>
                <div style={{ padding: '10px 14px', borderRight: '0.5px solid #e0dfd7' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Nb factures</div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{invoices.length}</div>
                </div>
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Nb devis acceptés</div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{acceptedQuotes.length}</div>
                </div>
              </div>
            </div>

            {resteTotal < 0 && (
              <div style={{ background: '#FCEBEB', border: '0.5px solid #E24B4A', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#A32D2D' }}>
                ⚠ Surfacturation détectée — Le total facturé dépasse le marché de {Math.abs(resteTotal).toLocaleString('fr-FR')} EUR TTC.
              </div>
            )}

            {acceptedQuotes.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Avancement par devis</div>
                {acceptedQuotes.map(q => {
                  const factureTTC = getQuoteFacturedTTC(q.id)
                  const resteTTC = (q.amount_ttc || 0) - factureTTC
                  const pct = q.amount_ttc > 0 ? Math.round(factureTTC / q.amount_ttc * 100) : 0
                  return (
                    <div key={q.id} style={{ background: '#fff', border: '0.5px solid ' + (resteTTC < 0 ? '#E24B4A' : '#e0dfd7'), borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{q.quote_number || 'Devis'}</div>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: resteTTC < 0 ? '#FCEBEB' : '#EAF3DE', color: resteTTC < 0 ? '#A32D2D' : '#3B6D11', fontWeight: 500 }}>
                          {pct}% facturé
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 4 }}>
                        <span>Devis TTC</span>
                        <span style={{ fontWeight: 500, color: '#1a1a1a' }}>{(q.amount_ttc || 0).toLocaleString('fr-FR')} EUR</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 4 }}>
                        <span>Facturé TTC</span>
                        <span style={{ fontWeight: 500, color: '#EF9F27' }}>{factureTTC.toLocaleString('fr-FR')} EUR</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 6 }}>
                        <span>Reste à facturer</span>
                        <span style={{ fontWeight: 500, color: resteTTC < 0 ? '#A32D2D' : '#1D9E75' }}>{resteTTC < 0 ? '⚠ ' : ''}{resteTTC.toLocaleString('fr-FR')} EUR</span>
                      </div>
                      <div style={{ height: 5, background: '#e0dfd7', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: Math.min(100, pct) + '%', background: resteTTC < 0 ? '#E24B4A' : '#1D9E75', borderRadius: 3 }}></div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {tab === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ExtracteurDevis
              lotId={lotId}
              projectId={projectId}
              companyId={lot.company_id}
              onSuccess={() => loadData()}
            />
            <div onClick={() => setShowAddQuote(!showAddQuote)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: '#888', border: '0.5px dashed #e0dfd7', borderRadius: 8, padding: '9px', cursor: 'pointer', background: '#fff' }}>
              + Saisir manuellement
            </div>

            {showAddQuote && (
              <div style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Nouveau devis</div>
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>N° de devis</div>
                  <input value={quoteForm.quote_number} onChange={e => setQuoteForm(f => ({ ...f, quote_number: e.target.value }))} placeholder="DEV-2025-001" style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Date du devis</div>
                  <input type="date" value={quoteForm.quote_date} onChange={e => setQuoteForm(f => ({ ...f, quote_date: e.target.value }))} style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Montant HT (EUR)</div>
                  <input type="number" value={quoteForm.amount_ht} onChange={e => {
                    const ht = parseFloat(e.target.value) || 0
                    const tva = parseFloat(quoteForm.tva_rate) || 20
                    setQuoteForm(f => ({ ...f, amount_ht: e.target.value, amount_ttc: (ht * (1 + tva / 100)).toFixed(2) }))
                  }} placeholder="0.00" style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>TVA applicable</div>
                  <select value={quoteForm.tva_rate} onChange={e => {
                    const tva = parseFloat(e.target.value)
                    const ht = parseFloat(quoteForm.amount_ht) || 0
                    setQuoteForm(f => ({ ...f, tva_rate: e.target.value, amount_ttc: (ht * (1 + tva / 100)).toFixed(2) }))
                  }} style={inp}>
                    <option value='20'>20% — Taux normal</option>
                    <option value='10'>10% — Taux intermédiaire</option>
                    <option value='5.5'>5.5% — Taux réduit</option>
                    <option value='2.1'>2.1% — Taux super réduit</option>
                    <option value='8.5'>8.5% — DOM-TOM</option>
                    <option value='0'>0% — Exonéré</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Montant TTC (EUR) *</div>
                  <input type="number" value={quoteForm.amount_ttc} onChange={e => setQuoteForm(f => ({ ...f, amount_ttc: e.target.value }))}
                    placeholder="0.00" style={{ ...inp, border: '0.5px solid #1D9E75', background: '#E1F5EE', color: '#085041' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowAddQuote(false)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '0.5px solid #e0dfd7', background: '#f5f4f0', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                  <button onClick={saveQuote} disabled={savingQuote} style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none', background: '#1a1a1a', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {savingQuote ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            )}

            {quotes.length === 0 && !showAddQuote && (
              <div style={{ textAlign: 'center', padding: 30, color: '#aaa', fontSize: 13 }}>Aucun devis pour ce lot</div>
            )}

            {quotes.map(q => {
              const factureTTC = getQuoteFacturedTTC(q.id)
              const resteTTC = (q.amount_ttc || 0) - factureTTC
              const pct = q.amount_ttc > 0 ? Math.round(factureTTC / q.amount_ttc * 100) : 0
              const sc = quoteStatusColor[q.status] || quoteStatusColor.accepte
              return (
                <div key={q.id} style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid #e0dfd7' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{q.quote_number || 'Sans numéro'}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{q.quote_date ? new Date(q.quote_date).toLocaleDateString('fr-FR') : '-'}</div>
                    </div>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500 }}>{quoteStatusLabel[q.status]}</span>
                  </div>
                  <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {q.amount_ht && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: '#888' }}>HT</span><span style={{ fontWeight: 500 }}>{q.amount_ht.toLocaleString('fr-FR')} EUR</span></div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: '#888' }}>TVA {q.tva_rate || 20}%</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: '#888' }}>TTC</span><span style={{ fontWeight: 500, color: '#185FA5' }}>{(q.amount_ttc || 0).toLocaleString('fr-FR')} EUR</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: '#888' }}>Facturé TTC</span><span style={{ fontWeight: 500, color: '#EF9F27' }}>{factureTTC.toLocaleString('fr-FR')} EUR</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: '#888' }}>Reste</span><span style={{ fontWeight: 500, color: resteTTC < 0 ? '#A32D2D' : '#1D9E75' }}>{resteTTC < 0 ? '⚠ ' : ''}{resteTTC.toLocaleString('fr-FR')} EUR</span></div>
                    <div style={{ height: 4, background: '#e0dfd7', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.min(100, pct) + '%', background: resteTTC < 0 ? '#E24B4A' : '#1D9E75', borderRadius: 2 }}></div>
                    </div>
                    <div style={{ fontSize: 11, color: '#aaa', textAlign: 'right' }}>{pct}% facturé</div>
                  </div>
                  <FileActions filePath={q.file_path} name={q.quote_number || 'Devis'} />
                  <div style={{ padding: '8px 14px', borderTop: '0.5px solid #e0dfd7', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => deleteQuote(q.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #e0dfd7', background: 'none', color: '#E24B4A', cursor: 'pointer', fontFamily: 'inherit' }}>Supprimer</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div onClick={() => setShowAjout(!showAjout)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#185FA5', border: '0.5px solid #185FA5', borderRadius: 8, padding: '10px', cursor: 'pointer', background: '#E6F1FB' }}>
              {showAjout ? 'Fermer' : '+ Ajouter une facture'}
            </div>

            {showAjout && (
              <AjoutFacture
                projectId={projectId}
                lots={allLots}
                companies={companies}
                defaultLotId={lotId}
                quotes={quotes}
                onSuccess={() => { setShowAjout(false); loadData() }}
              />
            )}

            {invoices.length === 0 && !showAjout && (
              <div style={{ textAlign: 'center', padding: 20, color: '#aaa', fontSize: 13 }}>Aucune facture pour ce lot</div>
            )}

            {invoices.map(inv => {
              const sc = statusColor[inv.status] || statusColor.recue
              return (
                <div key={inv.id} style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid #e0dfd7' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{inv.invoice_number || 'Sans numéro'}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
                        {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('fr-FR') : '-'}
                        {inv.quotes && <span style={{ color: '#185FA5' }}> · {inv.quotes.quote_number || 'Devis lié'}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {inv.invoice_type === 'supplementaire' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: '#FAEEDA', color: '#854F0B', fontWeight: 500 }}>TS</span>}
                      {inv.ai_extracted && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: '#E6F1FB', color: '#0C447C' }}>IA</span>}
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500 }}>{statusLabel[inv.status] || inv.status}</span>
                    </div>
                  </div>
                  <div style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#888' }}>HT</span>
                    <span style={{ fontWeight: 500 }}>{inv.amount_ht ? inv.amount_ht.toLocaleString('fr-FR') + ' EUR' : '-'}</span>
                  </div>
                  <div style={{ padding: '4px 14px 8px', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#888' }}>TTC</span>
                    <span style={{ fontWeight: 500, color: '#185FA5' }}>{inv.amount_ttc ? inv.amount_ttc.toLocaleString('fr-FR') + ' EUR' : '-'}</span>
                  </div>
                  <div style={{ padding: '8px 14px', borderTop: '0.5px solid #e0dfd7', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 11, color: '#888', marginRight: 4, lineHeight: '24px' }}>Statut :</div>
                    {['recue','verifiee','validee','payee'].map(s => (
                      <div key={s} onClick={() => updateInvoiceStatus(inv.id, s)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, cursor: 'pointer', background: inv.status === s ? '#1a1a1a' : '#f5f4f0', color: inv.status === s ? '#fff' : '#888', fontWeight: inv.status === s ? 500 : 400 }}>
                        {statusLabel[s]}
                      </div>
                    ))}
                  </div>
                  <FileActions filePath={inv.file_path} name={inv.invoice_number || 'Facture'} />
                  <div style={{ padding: '6px 14px 8px', display: 'flex', justifyContent: 'flex-end', borderTop: '0.5px solid #f0efea' }}>
                    <button onClick={() => deleteInvoice(inv.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #e0dfd7', background: 'none', color: '#E24B4A', cursor: 'pointer', fontFamily: 'inherit' }}>Supprimer</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AjoutDocument
              projectId={projectId}
              companyId={lot.company_id}
              onSuccess={() => loadData()}
            />
            {lotDocuments.length > 0 && (
              <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>
                Documents récents
              </div>
            )}
            {lotDocuments.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: '#aaa', fontSize: 13 }}>Aucun document pour ce lot</div>
            )}
            {lotDocuments.map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f5f4f0', border: '0.5px solid #e0dfd7', borderRadius: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: 5, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke="#185FA5" strokeWidth="1.2"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>
                    {doc.category} · {doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </div>
                </div>
                <FileActions filePath={doc.file_path} name={doc.name} docId={doc.id} />
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

const inp = { fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '0.5px solid #e0dfd7', background: '#fff', color: '#1a1a1a', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }
const card = { background: '#f5f4f0', borderRadius: 8, padding: '10px 12px' }
const cardLabel = { fontSize: 11, color: '#888', marginBottom: 4 }
const cardVal = { fontSize: 16, fontWeight: 500, color: '#1a1a1a' }
