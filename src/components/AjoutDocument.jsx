import { useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  { value: 'contrats', label: 'Contrat' },
  { value: 'plans', label: 'Plan' },
  { value: 'pv_reunion', label: 'PV de réunion' },
  { value: 'factures', label: 'Facture' },
  { value: 'devis', label: 'Devis' },
  { value: 'autre', label: 'Autre' },
]

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.dwg'

export default function AjoutDocument({ projectId, companyId, onSuccess }) {
  const [step, setStep] = useState('select')
  const [category, setCategory] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  function handleCategorySelect(cat) {
    setCategory(cat)
    setStep('upload')
  }

  async function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    if (f.size > 50 * 1024 * 1024) { setError('Fichier trop volumineux (max 50 MB)'); return }
    setFile(f)
    setUploading(true)
    setError('')

    try {
      const cleanName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = (projectId || companyId) + '/' + category + '/' + Date.now() + '_' + cleanName
      const { error: upErr } = await supabase.storage.from('documents').upload(path, f)
      if (upErr) throw new Error(upErr.message)

      await supabase.from('documents').insert([{
        project_id: projectId || null,
        company_id: companyId || null,
        category,
        name: f.name,
        file_path: path,
        ai_extracted: false,
      }])

      setStep('done')
      if (onSuccess) onSuccess()
    } catch (err) {
      setError('Erreur : ' + err.message)
    }
    setUploading(false)
  }

  function reset() {
    setStep('select')
    setCategory('')
    setFile(null)
    setError('')
  }

  const catLabel = CATEGORIES.find(c => c.value === category)?.label || ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {error && (
        <div style={{ background: '#FCEBEB', color: '#A32D2D', fontSize: 13, padding: '8px 12px', borderRadius: 8 }}>{error}</div>
      )}

      {step === 'select' && (
        <div style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 500, color: '#888', borderBottom: '0.5px solid #e0dfd7' }}>
            Choisir le type de document
          </div>
          {CATEGORIES.map(cat => (
            <div key={cat.value} onClick={() => handleCategorySelect(cat.value)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '0.5px solid #f0efea', cursor: 'pointer', fontSize: 13, color: '#1a1a1a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke="#185FA5" strokeWidth="1.2"/><line x1="4.5" y1="5" x2="9.5" y2="5" stroke="#185FA5" strokeWidth="1"/><line x1="4.5" y1="7.5" x2="9.5" y2="7.5" stroke="#185FA5" strokeWidth="1"/></svg>
                </div>
                {cat.label}
              </div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="#ccc" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          ))}
        </div>
      )}

      {step === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#888' }}>
            <div onClick={() => setStep('select')} style={{ cursor: 'pointer', color: '#185FA5' }}>← Changer</div>
            <span>·</span>
            <span>Catégorie : <strong style={{ color: '#1a1a1a' }}>{catLabel}</strong></span>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 24, border: '0.5px dashed #185FA5', borderRadius: 10, cursor: uploading ? 'default' : 'pointer', background: '#fff' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="3" y="2" width="16" height="18" rx="2" stroke="#185FA5" strokeWidth="1.3"/>
                <path d="M11 8v6M9 11l2-2 2 2" stroke="#185FA5" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="7" y1="15" x2="15" y2="15" stroke="#185FA5" strokeWidth="1" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>
              {uploading ? 'Téléchargement en cours...' : 'Sélectionner un fichier'}
            </div>
            <div style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>
              {uploading ? file?.name : 'PDF, Word, Excel, Image, DWG · max 50 MB'}
            </div>
            {!uploading && <input type="file" accept={ACCEPTED_TYPES} onChange={handleFile} style={{ display: 'none' }} />}
          </label>

          <button onClick={reset} style={{ fontSize: 13, padding: '9px', borderRadius: 8, border: '0.5px solid #e0dfd7', background: '#f5f4f0', cursor: 'pointer', fontFamily: 'inherit', color: '#888' }}>
            Annuler
          </button>
        </div>
      )}

      {step === 'done' && (
        <div style={{ background: '#EAF3DE', border: '0.5px solid #1D9E75', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#3B6D11', marginBottom: 4 }}>Document ajouté</div>
          <div style={{ fontSize: 12, color: '#3B6D11', marginBottom: 10 }}>Rangé dans la catégorie "{catLabel}"</div>
          <button onClick={reset} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: '0.5px solid #1D9E75', background: '#fff', color: '#1D9E75', cursor: 'pointer', fontFamily: 'inherit' }}>
            Ajouter un autre document
          </button>
        </div>
      )}

    </div>
  )
}
