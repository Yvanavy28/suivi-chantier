import { useState } from 'react'
import { supabase } from '../lib/supabase'

const TVA_OPTIONS = [
  { label: '20% — Taux normal (France)', value: 20 },
  { label: '10% — Taux intermédiaire', value: 10 },
  { label: '5.5% — Taux réduit', value: 5.5 },
  { label: '2.1% — Taux super réduit', value: 2.1 },
  { label: '8.5% — DOM-TOM taux normal', value: 8.5 },
  { label: '0% — Exonéré / Auto-liquidation', value: 0 },
]

export default function AjoutFacture({ projectId, lots, companies, defaultLotId, onSuccess }) {
  const [step, setStep] = useState('upload')
  const [extracted, setExtracted] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [matchedLotId, setMatchedLotId] = useState(defaultLotId || '')
  const [matchedCompanyId, setMatchedCompanyId] = useState('')
  const [invoiceType, setInvoiceType] = useState('base')
  const [tvaRate, setTvaRate] = useState(8.5)
  const [manualForm, setManualForm] = useState({
    invoice_number: '', situation_number: '', amount_ht: '', amount_ttc: '', invoice_date: '', company_name: ''
  })

  function setManualField(key, val) {
    setManualForm(f => ({ ...f, [key]: val }))
  }

  function handleHtChange(val) {
    setManualField('amount_ht', val)
    const ht = parseFloat(val) || 0
    setManualField('amount_ttc', (ht * (1 + tvaRate / 100)).toFixed(2))
  }

  function handleTvaChange(val) {
    const rate = parseFloat(val)
    setTvaRate(rate)
    const ht = parseFloat(manualForm.amount_ht) || 0
    setManualField('amount_ttc', (ht * (1 + rate / 100)).toFixed(2))
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.type !== 'application/pdf') { setError('Seuls les fichiers PDF sont acceptes'); return }
    if (file.size > 20 * 1024 * 1024) { setError('Fichier trop volumineux (max 20 MB)'); return }
    setUploading(true)
    setError('')
    setFileName(file.name)
    try {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(',')[1]
        const response = await fetch('/.netlify/functions/extract-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, type: 'invoice' })
        })
        if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Erreur API') }
        const parsed = await response.json()
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = projectId + '/factures/' + Date.now() + '_' + cleanName
        await supabase.storage.from('invoices').upload(path, file)
        parsed._filePath = path
        const companyName = (parsed.company_name || '').toLowerCase().trim()
        let foundCompany = null, foundLot = null
        if (companyName) {
          foundCompany = companies.find(c => c.name.toLowerCase().includes(companyName) || companyName.includes(c.name.toLowerCase()))
          if (foundCompany) {
            setMatchedCompanyId(foundCompany.id)
            const lotForCompany = lots.find(l => l.company_id === foundCompany.id)
            if (lotForCompany && !defaultLotId) { setMatchedLotId(lotForCompany.id); foundLot = lotForCompany }
          }
        }
        setExtracted({ ...parsed, _foundCompany: foundCompany, _foundLot: foundLot })
        setStep('verify')
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (err) { setError('Erreur : ' + err.message); setUploading(false) }
  }

  function updateField(key, val) { setExtracted(prev => ({ ...prev, [key]: val })) }

  async function saveInvoice(data) {
    if (!matchedLotId) { setError('Veuillez selectionner un lot'); return }
    setSaving(true)
    setError('')
    try {
      await supabase.from('invoices').insert([{
        project_lot_id: matchedLotId,
        project_id: projectId,
        company_id: matchedCompanyId || null,
        invoice_number: data.invoice_number || null,
        situation_number: data.situation_number ? parseInt(data.situation_number) : null,
        amount_ht: data.amount_ht ? parseFloat(data.amount_ht) : null,
        amount_ttc: data.amount_ttc ? parseFloat(data.amount_ttc) : null,
        invoice_date: data.invoice_date || null,
        file_path: data._filePath || null,
        ai_extracted: !!data._filePath,
        status: 'recue',
        invoice_type: invoiceType,
      }])

      await supabase.from('documents').insert([{
        project_id: projectId,
        company_id: matchedCompanyId || null,
        category: 'factures',
        name: data.invoice_number
          ? 'Facture ' + data.invoice_number + (invoiceType === 'supplementaire' ? ' (TS)' : '')
          : (data._filePath ? fileName : 'Facture manuelle'),
        file_path: data._filePath || '',
        ai_extracted: !!data._filePath,
      }])

      if (data.amount_ht && matchedLotId) {
        const { data: currentLot } = await supabase.from('project_lots').select('unlocked_ht, extra_ht').eq('id', matchedLotId).single()
        if (invoiceType === 'base') {
          await supabase.from('project_lots').update({ unlocked_ht: (currentLot?.unlocked_ht || 0) + parseFloat(data.amount_ht) }).eq('id', matchedLotId)
        } else {
          await supabase.from('project_lots').update({ extra_ht: (currentLot?.extra_ht || 0) + parseFloat(data.amount_ht) }).eq('id', matchedLotId)
        }
      }
      setStep('done')
      if (onSuccess) onSuccess()
    } catch (err) { setError('Erreur : ' + err.message); setSaving(false) }
  }

  function reset() {
    setStep('upload')
    setExtracted(null)
    setError('')
    setFileName('')
    setMatchedLotId(defaultLotId || '')
    setMatchedCompanyId('')
    setInvoiceType('base')
    setTvaRate(8.5)
    setManualForm({ invoice_number: '', situation_number: '', amount_ht: '', amount_ttc: '', invoice_date: '', company_name: '' })
  }

  const TypeSelector = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
      <div onClick={() => setInvoiceType('base')} style={{ padding: '10px 12px', borderRadius: 8, border: '0.5px solid ' + (invoiceType === 'base' ? '#1D9E75' : '#e0dfd7'), background: invoiceType === 'base' ? '#E1F5EE' : '#fff', cursor: 'pointer', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: invoiceType === 'base' ? '#0F6E56' : '#1a1a1a' }}>Budget de base</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Déduit du marché</div>
      </div>
      <div onClick={() => setInvoiceType('supplementaire')} style={{ padding: '10px 12px', borderRadius: 8, border: '0.5px solid ' + (invoiceType === 'supplementaire' ? '#EF9F27' : '#e0dfd7'), background: invoiceType === 'supplementaire' ? '#FAEEDA' : '#fff', cursor: 'pointer', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: invoiceType === 'supplementaire' ? '#854F0B' : '#1a1a1a' }}>Travaux supp.</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Hors marché</div>
      </div>
    </div>
  )

  const LotSelector = () => (
    <div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Attribuer au lot *</div>
      <select value={matchedLotId} onChange={e => { setMatchedLotId(e.target.value); const lot = lots.find(l => l.id === e.target.value); if (lot) setMatchedCompanyId(lot.company_id || '') }}
        style={inp}>
        <option value="">-- Choisir un lot --</option>
        {lots.map(l => <option key={l.id} value={l.id}>{l.lots?.name}{l.companies ? ' · ' + l.companies.name : ''}</option>)}
      </select>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {error && <div style={{ background: '#FCEBEB', color: '#A32D2D', fontSize: 13, padding: '8px 12px', borderRadius: 8 }}>{error}</div>}

      {step === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Type de facture</div>
            <TypeSelector />
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 20, border: '0.5px dashed #185FA5', borderRadius: 10, cursor: uploading ? 'default' : 'pointer', background: '#fff' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="#185FA5" strokeWidth="1.3"/><path d="M10 7v5M8 10l2-2 2 2" stroke="#185FA5" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><line x1="6" y1="14" x2="14" y2="14" stroke="#185FA5" strokeWidth="1" strokeLinecap="round"/></svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{uploading ? 'Analyse en cours...' : 'Importer une facture PDF'}</div>
            <div style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>{uploading ? fileName : "L'IA extrait les données automatiquement"}</div>
            <div style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#E6F1FB', color: '#0C447C', fontWeight: 500 }}>Extraction IA</div>
            {!uploading && <input type="file" accept="application/pdf" onChange={handleFile} style={{ display: 'none' }} />}
          </label>
          <div onClick={() => setStep('manual')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#888', border: '0.5px dashed #e0dfd7', borderRadius: 8, padding: '9px', cursor: 'pointer', background: '#fff' }}>
            + Saisir manuellement
          </div>
        </div>
      )}

      {step === 'manual' && (
        <div style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '0.5px solid #e0dfd7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Saisie manuelle</div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: invoiceType === 'supplementaire' ? '#FAEEDA' : '#E1F5EE', color: invoiceType === 'supplementaire' ? '#854F0B' : '#0F6E56', fontWeight: 500 }}>
              {invoiceType === 'supplementaire' ? 'Travaux supp.' : 'Budget de base'}
            </span>
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <TypeSelector />

            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>N° de facture</div>
              <input value={manualForm.invoice_number} onChange={e => setManualField('invoice_number', e.target.value)} placeholder="FA-2025-001" style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>N° de situation</div>
              <input type="number" value={manualForm.situation_number} onChange={e => setManualField('situation_number', e.target.value)} placeholder="1" style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Montant HT (EUR)</div>
              <input type="number" value={manualForm.amount_ht} onChange={e => handleHtChange(e.target.value)} placeholder="0.00" style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>TVA applicable</div>
              <select value={tvaRate} onChange={e => handleTvaChange(e.target.value)} style={inp}>
                {TVA_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Montant TTC (EUR) — calculé automatiquement</div>
              <input type="number" value={manualForm.amount_ttc} onChange={e => setManualField('amount_ttc', e.target.value)} placeholder="0.00"
                style={{ ...inp, border: '0.5px solid #1D9E75', background: '#E1F5EE', color: '#085041' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Date de facture</div>
              <input type="date" value={manualForm.invoice_date} onChange={e => setManualField('invoice_date', e.target.value)} style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Entreprise emettrice</div>
              <input value={manualForm.company_name} onChange={e => setManualField('company_name', e.target.value)} placeholder="Nom de l'entreprise" style={inp} />
            </div>
            <LotSelector />
          </div>
          <div style={{ padding: '10px 14px', borderTop: '0.5px solid #e0dfd7', display: 'flex', gap: 8 }}>
            <button onClick={reset} style={btnSecondary}>Annuler</button>
            <button onClick={() => saveInvoice(manualForm)} disabled={saving} style={btnPrimary}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {step === 'verify' && extracted && (
        <div style={{ background: '#fff', border: '2px solid #185FA5', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ background: '#E6F1FB', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#185FA5' }}>Données extraites — vérifiez et validez</div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: invoiceType === 'supplementaire' ? '#FAEEDA' : '#E1F5EE', color: invoiceType === 'supplementaire' ? '#854F0B' : '#0F6E56', fontWeight: 500 }}>
              {invoiceType === 'supplementaire' ? 'Travaux supp.' : 'Budget de base'}
            </span>
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <TypeSelector />
            {extracted._foundCompany && (
              <div style={{ background: '#EAF3DE', border: '0.5px solid #1D9E75', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#3B6D11' }}>
                Entreprise reconnue : <strong>{extracted._foundCompany.name}</strong>
              </div>
            )}
            {[
              { key: 'invoice_number', label: 'N° de facture' },
              { key: 'situation_number', label: 'N° de situation' },
              { key: 'amount_ht', label: 'Montant HT (EUR)' },
              { key: 'amount_ttc', label: 'Montant TTC (EUR)' },
              { key: 'invoice_date', label: 'Date de facture' },
              { key: 'company_name', label: 'Entreprise emettrice' },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{f.label}</div>
                <input value={extracted[f.key] || ''} onChange={e => updateField(f.key, e.target.value)}
                  style={{ ...inp, border: '0.5px solid #1D9E75', background: '#E1F5EE', color: '#085041' }} />
              </div>
            ))}
            <LotSelector />
          </div>
          <div style={{ padding: '10px 14px', borderTop: '0.5px solid #e0dfd7', display: 'flex', gap: 8 }}>
            <button onClick={reset} style={btnSecondary}>Annuler</button>
            <button onClick={() => saveInvoice(extracted)} disabled={saving} style={btnPrimary}>
              {saving ? 'Enregistrement...' : 'Valider et enregistrer'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div style={{ background: '#EAF3DE', border: '0.5px solid #1D9E75', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#3B6D11', marginBottom: 4 }}>Facture enregistrée</div>
          <div style={{ fontSize: 12, color: '#3B6D11', marginBottom: 10 }}>
            {invoiceType === 'supplementaire' ? 'Ajoutée aux travaux supplémentaires' : 'Déduite du budget de base'}
          </div>
          <button onClick={reset} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: '0.5px solid #1D9E75', background: '#fff', color: '#1D9E75', cursor: 'pointer', fontFamily: 'inherit' }}>
            Ajouter une autre facture
          </button>
        </div>
      )}

    </div>
  )
}

const inp = { fontSize: 13, padding: '7px 10px', borderRadius: 7, border: '0.5px solid #e0dfd7', background: '#fff', color: '#1a1a1a', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }
const btnPrimary = { flex: 2, padding: '9px', borderRadius: 8, border: 'none', background: '#1a1a1a', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const btnSecondary = { flex: 1, padding: '9px', borderRadius: 8, border: '0.5px solid #e0dfd7', background: '#f5f4f0', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
