import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function CoverImageUpload({ projectId, currentUrl, onSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { setError('Format accepté : JPG, PNG, WEBP'); return }
    if (file.size > 10 * 1024 * 1024) { setError('Fichier trop volumineux (max 10 MB)'); return }

    setUploading(true)
    setError('')

    const path = projectId + '/cover_' + Date.now() + '.' + file.name.split('.').pop()
    const { error: upErr } = await supabase.storage.from('project-images').upload(path, file, { upsert: true })

    if (upErr) { setError('Erreur upload : ' + upErr.message); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage.from('project-images').getPublicUrl(path)

    await supabase.from('projects').update({ cover_image_url: publicUrl }).eq('id', projectId)

    setUploading(false)
    if (onSuccess) onSuccess(publicUrl)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {error && <div style={{ background: '#FCEBEB', color: '#A32D2D', fontSize: 12, padding: '6px 10px', borderRadius: 6 }}>{error}</div>}

      <label style={{ cursor: uploading ? 'default' : 'pointer' }}>
        {currentUrl ? (
          <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', height: 140 }}>
            <img src={currentUrl} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.4)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#fff' }}>{uploading ? 'Chargement...' : 'Photo de couverture'}</span>
              {!uploading && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', border: '0.5px solid rgba(255,255,255,0.5)', padding: '2px 8px', borderRadius: 10 }}>Changer</span>}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px', border: '0.5px dashed #e0dfd7', borderRadius: 10, background: '#f5f4f0' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="12" rx="2" stroke="#888" strokeWidth="1.3"/><circle cx="7" cy="8.5" r="1.5" stroke="#888" strokeWidth="1.1"/><path d="M2 13l4-3 3 3 3-3 4 4" stroke="#888" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#555' }}>{uploading ? 'Chargement...' : 'Ajouter une photo'}</div>
            <div style={{ fontSize: 11, color: '#aaa' }}>JPG, PNG, WEBP · max 10 MB</div>
          </div>
        )}
        {!uploading && <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} style={{ display: 'none' }} />}
      </label>
    </div>
  )
}
