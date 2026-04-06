import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ExtracteurIA({ type, projectLotId, companyId, projectId, onSuccess }) {
  const [step, setStep] = useState('upload')
  const [extracted, setExtracted] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')

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
          body: JSON.stringify({ base64, type })
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Erreur API')
        }

        const parsed = await response.json()

        const bucket = type === 'invoice' ? 'invoices' : 'insurances'
        const path = (companyId || projectId) + '/' + Date.now() + '_' + file.name
        await supabase.storage.from(bucket).upload(path, file)

        setExtracted({ ...parsed, _filePath: path })
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
    setSaving(true)
    setError('')
    try {
      if (type === 'invoice') {
        await supabase.from('invoices').insert([{
          project_lot_id: projectLotId,
          project_id: projectId,
          company_id: companyId || null,
          invoice_number: extracted.invoice_number || null,
          situation_number: extracted.situation_number ? parseInt(extracted.situation_number) : null,
          amount_ht: extracted.amount_ht ? parseFloat(extracted.amount_ht) : null,
          amount_ttc: extracted.amount_ttc ? parseFloat(extracted.amount_ttc) : null,
          invoice_date: extracted.invoice_date || null,
          file_path: extracted._filePath || null,
          ai_extracted: true,
          status: 'recue',
        }])
      } else {
        await supabase.from('insurances').insert([{
          company_id: companyId,
          type: extracted.type || 'decennale',
          insurer: extracted.insurer || null,
          policy_number: extracted.policy_number || null,
          activities_covered: extracted.activities_covered || null,
          start_date: extracted.start_date || null,
          end_date: extracted.end_date || null,
          file_path: extracted._filePath || null,
          ai_extracted: true,
        }])
      }
      setStep('done')
      if (onSuccess) onSuccess()
    } catch (err) {
      setError('Erreur lors de l enregistrement : ' + err.message)
    }
    setSaving(false)
  }

  function reset() {
    setStep('upload')
    setExtracted(null)
    setError('')
    setFileName('')
  }

  const fields = type === 'invoice'
    ? [
        { key: 'invoice_number', label: 'N° de facture' },
        { key: 'situation_number', label: 'N° de situation' },
        { key: 'amount_ht', label: 'Montant HT (EUR)' },
        { key: 'amount_ttc', label: 'Montant TTC (EUR)' },
        { key: 'invoice_date', label: 'Date de facture' },
        { key: 'company_name', label: 'Entreprise emettrice' },
      ]
    : [
        { key: 'type', label: 'Type d assurance' },
        { key: 'insurer', label: 'Assureur' },
        { key: 'policy_number', label: 'N° de police' },
        { key: 'activities_covered', label: 'Activites couvertes' },
        { key: 'start_date', label: 'Date de debut' },
        { key: 'end_date', label: 'Date de fin' },
      ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {error && (
        <div style={{ background: '#FCEBEB', color: '#A32D2D', fontSize: 13, padding: '8px 12px', borderRadius: 8 }}>{error}</div>
      )}

      {step === 'upload' && (
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 20, border: '0.5px dashed #1D9E75', borderRadius: 10, cursor: uploading ? 'default' : 'pointer', background: '#fff' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="#185FA5" strokeWidth="1.3"/><path d="M10 7v5M8 10l2-2 2 2" stroke="#185FA5" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><line x1="6" y1="14" x2="14" y2="14" stroke="#185FA5" strokeWidth="1" strokeLinecap="round"/></svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>
            {uploading ? 'Analyse en cours...' : 'Importer un PDF'}
          </div>
          <div style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>
            {uploading ? fileName : 'L IA va extraire les informations automatiquement'}
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
            {fields.map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{f.label}</div>
                <input
                  value={extracted[f.key] || ''}
                  onChange={e => updateField(f.key, e.target.value)}
                  style={{ fontSize: 13, padding: '7px 10px', borderRadius: 7, border: '0.5px solid #1D9E75', background: '#E1F5EE', color: '#085041', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
            ))}
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
          <div style={{ fontSize: 13, fontWeight: 500, color: '#3B6D11', marginBottom: 4 }}>Enregistre avec succes</div>
          <div style={{ fontSize: 12, color: '#3B6D11', marginBottom: 10 }}>Les donnees ont ete extraites et enregistrees</div>
          <button onClick={reset} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: '0.5px solid #1D9E75', background: '#fff', color: '#1D9E75', cursor: 'pointer', fontFamily: 'inherit' }}>
            Ajouter un autre document
          </button>
        </div>
      )}

    </div>
  )
}
