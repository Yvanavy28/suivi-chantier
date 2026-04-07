import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ExtracteurDevis({ lotId, projectId, companyId, onSuccess }) {
  const [step, setStep] = useState('upload')
  const [extracted, setExtracted] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.type !== 'application/pdf') { setError('Seuls les fichiers PDF sont acceptés'); return }
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
          body: JSON.stringify({
            base64,
            type: 'quote',
            prompt: `Tu es un expert en construction. Analyse ce devis PDF et extrait les informations suivantes en JSON uniquement, sans texte avant ou après :
{
  "quote_number": "numéro de devis ou null",
  "quote_date": "date au format YYYY-MM-DD ou null",
  "amount_ht": "montant hors taxes en nombre décimal ou null",
  "tva_rate": "taux de TVA en nombre (ex: 20, 10, 8.5) ou 20 par défaut",
  "amount_ttc": "montant toutes taxes comprises en nombre décimal ou null",
  "company_name": "nom de l'entreprise émettrice ou null"
}
Réponds UNIQUEMENT avec le JSON, rien d'autre.`
          })
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Erreur API')
        }

        const parsed = await response.json()

        // Auto-calculate TTC if missing
        if (parsed.amount_ht && !parsed.amount_ttc) {
          const tva = parseFloat(parsed.tva_rate) || 20
          parsed.amount_ttc = parseFloat((parsed.amount_ht * (1 + tva / 100)).toFixed(2))
        }

        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = (projectId || lotId) + '/devis/' + Date.now() + '_' + cleanName
        await supabase.storage.from('documents').upload(path, file)
        parsed._filePath = path

        setExtracted(parsed)
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
    setExtracted(prev => {
      const updated = { ...prev, [key]: val }
      if (key === 'amount_ht' || key === 'tva_rate') {
        const ht = parseFloat(key === 'amount_ht' ? val : prev.amount_ht) || 0
        const tva = parseFloat(key === 'tva_rate' ? val : prev.tva_rate) || 20
        updated.amount_ttc = (ht * (1 + tva / 100)).toFixed(2)
      }
      return updated
    })
  }

  async function handleValidate() {
    if (!extracted.amount_ttc) { setError('Le montant TTC est obligatoire'); return }
    setSaving(true)
    setError('')
    try {
      const { data } = await supabase.from('quotes').insert([{
        project_lot_id: lotId,
        project_id: projectId,
        company_id: companyId || null,
        quote_number: extracted.quote_number || null,
        quote_date: extracted.quote_date || null,
        amount_ht: extracted.amount_ht ? parseFloat(extracted.amount_ht) : null,
        tva_rate: extracted.tva_rate ? parseFloat(extracted.tva_rate) : 20,
        amount_ttc: parseFloat(extracted.amount_ttc),
        file_path: extracted._filePath || null,
        status: 'accepte',
      }]).select().single()

      if (data) {
        // Update lot amount = sum of accepted quotes
        const { data: allQuotes } = await supabase.from('quotes').select('amount_ttc').eq('project_lot_id', lotId).eq('status', 'accepte')
        const total = allQuotes?.reduce((s, q) => s + (q.amount_ttc || 0), 0) || 0
        await supabase.from('project_lots').update({ amount_ht: total }).eq('id', lotId)

        await supabase.from('documents').insert([{
          project_id: projectId,
          company_id: companyId || null,
          category: 'devis',
          name: extracted.quote_number ? 'Devis ' + extracted.quote_number : file?.name || 'Devis',
          file_path: extracted._filePath || '',
          ai_extracted: true,
        }])
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
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {error && <div style={{ background: '#FCEBEB', color: '#A32D2D', fontSize: 13, padding: '8px 12px', borderRadius: 8 }}>{error}</div>}

      {step === 'upload' && (
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 20, border: '0.5px dashed #185FA5', borderRadius: 10, cursor: uploading ? 'default' : 'pointer', background: '#fff' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="#185FA5" strokeWidth="1.3"/><path d="M10 7v5M8 10l2-2 2 2" stroke="#185FA5" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><line x1="6" y1="14" x2="14" y2="14" stroke="#185FA5" strokeWidth="1" strokeLinecap="round"/></svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{uploading ? 'Analyse en cours...' : 'Importer un devis PDF'}</div>
          <div style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>{uploading ? fileName : "L'IA extrait les montants automatiquement"}</div>
          <div style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#E6F1FB', color: '#0C447C', fontWeight: 500 }}>Extraction IA</div>
          {!uploading && <input type="file" accept="application/pdf" onChange={handleFile} style={{ display: 'none' }} />}
        </label>
      )}

      {step === 'verify' && extracted && (
        <div style={{ background: '#fff', border: '2px solid #185FA5', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ background: '#E6F1FB', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#185FA5" strokeWidth="1.2"/><path d="M5 7l1.5 1.5L9 5" stroke="#185FA5" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#185FA5' }}>Données extraites — vérifiez et validez</div>
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { key: 'quote_number', label: 'N° de devis' },
              { key: 'quote_date', label: 'Date du devis' },
              { key: 'company_name', label: 'Entreprise émettrice' },
              { key: 'amount_ht', label: 'Montant HT (EUR)' },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{f.label}</div>
                <input value={extracted[f.key] || ''} onChange={e => updateField(f.key, e.target.value)}
                  style={{ fontSize: 13, padding: '7px 10px', borderRadius: 7, border: '0.5px solid #1D9E75', background: '#E1F5EE', color: '#085041', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>TVA (%)</div>
              <select value={extracted.tva_rate || 20} onChange={e => updateField('tva_rate', e.target.value)}
                style={{ fontSize: 13, padding: '7px 10px', borderRadius: 7, border: '0.5px solid #1D9E75', background: '#E1F5EE', color: '#085041', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}>
                <option value='20'>20%</option>
                <option value='10'>10%</option>
                <option value='5.5'>5.5%</option>
                <option value='2.1'>2.1%</option>
                <option value='8.5'>8.5% DOM-TOM</option>
                <option value='0'>0%</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Montant TTC (EUR) *</div>
              <input type="number" value={extracted.amount_ttc || ''} onChange={e => updateField('amount_ttc', e.target.value)}
                style={{ fontSize: 13, padding: '7px 10px', borderRadius: 7, border: '0.5px solid #1D9E75', background: '#E1F5EE', color: '#085041', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500 }} />
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
          <div style={{ fontSize: 13, fontWeight: 500, color: '#3B6D11', marginBottom: 4 }}>Devis enregistré</div>
          <div style={{ fontSize: 12, color: '#3B6D11', marginBottom: 10 }}>Montant du lot mis à jour automatiquement</div>
          <button onClick={reset} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: '0.5px solid #1D9E75', background: '#fff', color: '#1D9E75', cursor: 'pointer', fontFamily: 'inherit' }}>
            Ajouter un autre devis
          </button>
        </div>
      )}
    </div>
  )
}
