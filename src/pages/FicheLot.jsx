import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AjoutFacture from '../components/AjoutFacture'

export default function FicheLot() {
  const { projectId, lotId } = useParams()
  const navigate = useNavigate()
  const [lot, setLot] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [allLots, setAllLots] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAjout, setShowAjout] = useState(false)

  useEffect(() => {
    loadData()
  }, [lotId])

  async function loadData() {
    const [{ data: l }, { data: inv }, { data: ls }, { data: cs }] = await Promise.all([
      supabase.from('project_lots').select('*, lots(*), companies(*)').eq('id', lotId).single(),
      supabase.from('invoices').select('*').eq('project_lot_id', lotId).order('created_at', { ascending: false }),
      supabase.from('project_lots').select('*, lots(*), companies(*)').eq('project_id', projectId),
      supabase.from('companies').select('*').order('name'),
    ])
    if (l) setLot(l)
    if (inv) setInvoices(inv)
    if (ls) setAllLots(ls)
    if (cs) setCompanies(cs)
    setLoading(false)
  }

  async function updateAmountHT(val) {
    await supabase.from('project_lots').update({ amount_ht: parseFloat(val) || null }).eq('id', lotId)
    setLot(prev => ({ ...prev, amount_ht: parseFloat(val) || null }))
  }

  async function updateCompany(companyId) {
    await supabase.from('project_lots').update({ company_id: companyId || null }).eq('id', lotId)
    const company = companies.find(c => c.id === companyId) || null
    setLot(prev => ({ ...prev, company_id: companyId, companies: company }))
  }

  function getLotPct() {
    if (!lot?.amount_ht || lot.amount_ht === 0) return 0
    const unlocked = invoices.filter(i => ['validee','payee'].includes(i.status)).reduce((s, i) => s + (i.amount_ht || 0), 0)
    return Math.round(unlocked / lot.amount_ht * 100)
  }

  function getTotalInvoiced() {
    return invoices.reduce((s, i) => s + (i.amount_ht || 0), 0)
  }

  const statusLabel = { recue: 'Recue', verifiee: 'Verifiee', validee: 'Validee', payee: 'Payee' }
  const statusColor = { recue: { bg: '#f5f4f0', color: '#888' }, verifiee: { bg: '#E6F1FB', color: '#185FA5' }, validee: { bg: '#EAF3DE', color: '#3B6D11' }, payee: { bg: '#EAF3DE', color: '#3B6D11' } }

  async function updateInvoiceStatus(invId, status) {
    await supabase.from('invoices').update({ status }).eq('id', invId)
    setInvoices(prev => prev.map(i => i.id === invId ? { ...i, status } : i))

    const validated = invoices.map(i => i.id === invId ? { ...i, status } : i)
      .filter(i => ['validee','payee'].includes(i.status))
      .reduce((s, i) => s + (i.amount_ht || 0), 0)
    await supabase.from('project_lots').update({ unlocked_ht: validated }).eq('id', lotId)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>Chargement...</div>
  if (!lot) return <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>Lot introuvable</div>

  const pct = getLotPct()

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

      <div style={{ padding: '14px 14px 80px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Informations du lot</div>

        <div style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Entreprise</div>
            <select value={lot.company_id || ''} onChange={e => updateCompany(e.target.value)} style={inp}>
              <option value="">-- Choisir une entreprise --</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Montant du marche HT (EUR)</div>
            <input
              type="number"
              defaultValue={lot.amount_ht || ''}
              onBlur={e => updateAmountHT(e.target.value)}
              placeholder="0"
              style={inp}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={card}>
            <div style={cardLabel}>Marche HT</div>
            <div style={cardVal}>{lot.amount_ht ? lot.amount_ht.toLocaleString('fr-FR') + ' EUR' : '-'}</div>
          </div>
          <div style={card}>
            <div style={cardLabel}>Facture</div>
            <div style={{ ...cardVal, color: pct > 80 ? '#E24B4A' : '#1D9E75' }}>{getTotalInvoiced().toLocaleString('fr-FR')} EUR</div>
          </div>
          <div style={card}>
            <div style={cardLabel}>Valide / Paye</div>
            <div style={{ ...cardVal, color: '#1D9E75' }}>{pct}%</div>
            <div style={{ height: 4, background: '#e0dfd7', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: pct + '%', background: '#1D9E75', borderRadius: 2 }}></div>
            </div>
          </div>
          <div style={card}>
            <div style={cardLabel}>Nb factures</div>
            <div style={cardVal}>{invoices.length}</div>
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>Factures</div>

        <div onClick={() => setShowAjout(!showAjout)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#185FA5', border: '0.5px solid #185FA5', borderRadius: 8, padding: '10px', cursor: 'pointer', background: '#E6F1FB' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke="#185FA5" strokeWidth="1.2"/><line x1="4.5" y1="5" x2="9.5" y2="5" stroke="#185FA5" strokeWidth="1"/><line x1="4.5" y1="7.5" x2="9.5" y2="7.5" stroke="#185FA5" strokeWidth="1"/></svg>
          {showAjout ? 'Fermer' : '+ Ajouter une facture'}
        </div>

        {showAjout && (
          <AjoutFacture
            projectId={projectId}
            lots={allLots}
            companies={companies}
            defaultLotId={lotId}
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
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{inv.invoice_number || 'Sans numero'}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('fr-FR') : '-'}</div>
                </div>
                <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500 }}>{statusLabel[inv.status] || inv.status}</span>
              </div>
              <div style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#888' }}>Montant HT</span>
                <span style={{ fontWeight: 500 }}>{inv.amount_ht ? inv.amount_ht.toLocaleString('fr-FR') + ' EUR' : '-'}</span>
              </div>
              <div style={{ padding: '4px 14px 8px', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#888' }}>Montant TTC</span>
                <span style={{ fontWeight: 500 }}>{inv.amount_ttc ? inv.amount_ttc.toLocaleString('fr-FR') + ' EUR' : '-'}</span>
              </div>
              {inv.ai_extracted && (
                <div style={{ padding: '0 14px 6px' }}>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: '#E6F1FB', color: '#0C447C' }}>IA</span>
                </div>
              )}
              <div style={{ padding: '8px 14px', borderTop: '0.5px solid #e0dfd7', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11, color: '#888', marginRight: 4, lineHeight: '24px' }}>Statut :</div>
                {['recue','verifiee','validee','payee'].map(s => (
                  <div key={s} onClick={() => updateInvoiceStatus(inv.id, s)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, cursor: 'pointer', background: inv.status === s ? '#1a1a1a' : '#f5f4f0', color: inv.status === s ? '#fff' : '#888', fontWeight: inv.status === s ? 500 : 400 }}>
                    {statusLabel[s]}
                  </div>
                ))}
              </div>
            </div>
          )
        })}

      </div>
    </div>
  )
}

const inp = { fontSize: 14, padding: '9px 11px', borderRadius: 8, border: '0.5px solid #e0dfd7', background: '#fff', color: '#1a1a1a', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }
const card = { background: '#f5f4f0', borderRadius: 8, padding: '10px 12px' }
const cardLabel = { fontSize: 11, color: '#888', marginBottom: 4 }
const cardVal = { fontSize: 16, fontWeight: 500, color: '#1a1a1a' }
