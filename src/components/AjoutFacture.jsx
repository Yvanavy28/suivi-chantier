import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AjoutFacture({ projectId, lots, companies, onSuccess }) {
  const [step, setStep] = useState('upload')
  const [extracted, setExtracted] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [matchedLotId, setMatchedLotId] = useState('')
  const [matchedCompanyId, setMatchedCompanyId] = useState('')

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

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Erreur API')
        }

        const parsed = await response.json()

        const path = projectId + '/factures/' + Date.now() + '_' + file.name
        await supabase.storage.from('invoices').upload(path, file)
        parsed._filePath = path

        const companyName = (parsed.company_name || '').toLowerCase().trim()
        let foundCompany = null
        let foundLot = null

        if (companyName) {
          foundCompany = companies.find(c =>
            c.name.toLowerCase().includes(companyName) ||
            companyName.includes(c.name.toLowerCase())
          )
          if (foundCompany) {
            setMatchedCompanyId(foundCompany.id)
            const lotForCompany = lots.find(l => l.company_id === foundCompany.id)
            if (lotForCompany) {
              setMatchedLotId(lotForCompany.id)
              foundLot = lotForCompany
            }
          }
        }

        setExtracted({ ...parsed, _foundCompany: foundCompany, _foundLot: foundLot })
        setStep('verify')
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setError('Erreur : ' + err.message)
      setUploading(false)
    }
  }

  function updateField(key, val) {
    setExtracted(prev => ({ ...prev, [key]: val }))
  }

  async function handleValidate() {
    if (!matchedLotId) { setError('Veuillez selectionner un lot'); return }
    setSaving(true)
    setError('')

    try {
      const { error: invErr } = await supabase.from('invoices').insert([{
        project_lot_id: matchedLotId,
        project_id: projectId,
        company_id: matchedCompanyId || null,
        invoice_number: extracted.invoice_number || null,
        situation_number: extracted.situation_number ? parseInt(extracted.situation_number) : null,
        amount_ht: extracted.amount_ht ? parseFloat(extracted.amount_ht) : null,
        amount_ttc: extracted.amount_ttc ? parseFloat(extracted.amount_ttc) : null,
        invoice_date: extracted.invoice_date || null,
        file_path: extracted._filePath || null,
        ai_extracted: true,
        status: 'recue',
      }])

      if (invErr) throw new Error(invErr.message)

      await supabase.from('documents').insert([{
        project_id: projectId,
        company_id: matchedCompanyId || null,
        category: 'factures',
        name: extracted.invoice_number
          ? 'Facture ' + extracted.invoice_number + (extracted.invoice_date ? ' - ' + extracted.invoice_date : '')
          : fileName,
        file_path: extracted._filePath || '',
        ai_extracted: true,
      }])

      if (extracted.amount_ht && matchedLotId) {
        const { data: currentLot } = await supabase
          .from('project_lots')
          .select('unlocked_ht')
          .eq('id', matchedLotId)
          .single()

        const newUnlocked = (currentLot?.unlocked_ht || 0) + parseFloat(extracted.amount_ht)
        await supabase.from('project_lots').update({ unlocked_ht: newUnlocked }).eq('id', matchedLotId)
      }

      setStep('done')
      if (onSuccess) onSuccess()
    } catch (err) {
      setError('Erreur : ' + err.message)
    }
    setSaving(false)
  }

  function reset() {
    setStep('upload')
    setExtracted(null)
    setError('')
    setFileName('')
    setMatchedLotId('')
    setMatchedCompanyId('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {error && (
        <div style={{ background: '#FCEBEB', color: '#A32D2D', fontSize: 13, padding: '8px 12px', borderRadius: 8 }}>{error}</div>
      )}

      {step === 'upload' && (
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 20, border: '0.5px dashed #185FA5', borderRadius: 10, cursor: uploading ? 'default' : 'pointer', background: '#fff' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="#185FA5" strokeWidth="1.3"/><path d="M10 7v5M8 10l2-2 2 2" stroke="#185FA5" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><line x1="6" y1="14" x2="14" y2="14" stroke="#185FA5" strokeWidth="1" strokeLinecap="round"/></svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>
            {uploading ? 'Analyse en cours...' : 'Importer une facture PDF'}
          </div>
          <div style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>
            {uploading ? fileName : "L'IA extrait les donnees et reconnait l'entreprise"}
          </div>
          <div style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#E6F1FB', color: '#0C447C', fontWeight: 500 }}>Extraction IA</div>
          {!uploading && <input type="file" accept="application/pdf" onChange={handleFile} style={{ display: 'none' }} />}
        </label>
      )}

      {step === 'verify' && extracted && (
        <div style={{ background: '#fff', border: '2px solid #185FA5', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ background: '#E6F1FB', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#185FA5" strokeWidth="1.2"/><path d="M5 7l1.5 1.5L9 5" stroke="#185FA5" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#185FA5' }}>Donnees extraites — verifie et valide</div>
          </div>

          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

            {extracted._foundCompany && (
              <div style={{ background: '#EAF3DE', border: '0.5px solid #1D9E75', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#3B6D11' }}>
                Entreprise reconnue : <strong>{extracted._foundCompany.name}</strong>
                {extracted._foundLot && <span> · Lot {extracted._foundLot.lots?.name || ''}</span>}
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
                <input
                  value={extracted[f.key] || ''}
                  onChange={e => updateField(f.key, e.target.value)}
                  style={{ fontSize: 13, padding: '7px 10px', borderRadius: 7, border: '0.5px solid #1D9E75', background: '#E1F5EE', color: '#085041', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
            ))}

            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Attribuer au lot *</div>
              <select
                value={matchedLotId}
                onChange={e => {
                  setMatchedLotId(e.target.value)
                  const lot = lots.find(l => l.id === e.target.value)
                  if (lot) setMatchedCompanyId(lot.company_id || '')
                }}
                style={{ fontSize: 13, padding: '7px 10px', borderRadius: 7, border: '0.5px solid #e0dfd7', background: '#fff', color: '#1a1a1a', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
              >
                <option value="">-- Choisir un lot --</option>
                {lots.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.lots?.name}{l.companies ? ' · ' + l.companies.name : ''}
                  </option>
                ))}
              </select>
            </div>

          </div>

          <div style={{ padding: '10px 14px', borderTop: '0.5px solid #e0dfd7', display: 'flex', gap: 8 }}>
            <button onClick={reset} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '0.5px solid #e0dfd7', background: '#f5f4f0', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
            <button onClick={handleValidate} disabled={saving} style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none', background: '#1a1a1a', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Enregistrement...' : 'Valider et enregistrer'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div style={{ background: '#EAF3DE', border: '0.5px solid #1D9E75', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#3B6D11', marginBottom: 4 }}>Facture enregistree</div>
          <div style={{ fontSize: 12, color: '#3B6D11', marginBottom: 10 }}>Ajoutee aux documents et au lot correspondant</div>
          <button onClick={reset} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: '0.5px solid #1D9E75', background: '#fff', color: '#1D9E75', cursor: 'pointer', fontFamily: 'inherit' }}>
            Ajouter une autre facture
          </button>
        </div>
      )}

    </div>
  )
}
