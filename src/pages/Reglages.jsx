import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Reglages() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [session, setSession] = useState(null)
  const [form, setForm] = useState({
    full_name: '',
    company_name: '',
    phone: '',
    email: '',
    avatar_url: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      if (session) {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        if (data) {
          setForm({
            full_name: data.full_name || '',
            company_name: data.company_name || '',
            phone: data.phone || '',
            email: data.email || session.user.email || '',
            avatar_url: data.avatar_url || '',
          })
        }
      }
    }
    load()
  }, [])

  function setField(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleAvatarUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { alert('Format accepté : JPG, PNG, WEBP'); return }
    if (file.size > 5 * 1024 * 1024) { alert('Fichier trop volumineux (max 5 MB)'); return }
    setUploading(true)
    const path = session.user.id + '/avatar_' + Date.now() + '.' + file.name.split('.').pop()
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      setForm(f => ({ ...f, avatar_url: publicUrl }))
    }
    setUploading(false)
  }

  async function handleSave() {
    setSaving(true)
    setSuccess(false)
    await supabase.from('profiles').update({
      full_name: form.full_name,
      company_name: form.company_name,
      phone: form.phone,
      avatar_url: form.avatar_url,
    }).eq('id', session.user.id)
    setSaving(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  function getInitials() {
    const name = form.company_name || form.full_name || 'BET'
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#f5f4f0' }}>

      <div style={{ background: '#fff', padding: '14px 16px', borderBottom: '0.5px solid #e0dfd7', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div onClick={() => navigate('/')} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e0dfd7', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="#888" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 500 }}>Réglages</div>
      </div>

      <div style={{ padding: '14px 14px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0' }}>
          <label style={{ cursor: 'pointer', position: 'relative' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid #e0dfd7' }}>
              {form.avatar_url ? (
                <img src={form.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 24, fontWeight: 500, color: '#0F6E56' }}>{getInitials()}</span>
              )}
            </div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            {!uploading && <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />}
          </label>
          <div style={{ fontSize: 12, color: '#aaa' }}>{uploading ? 'Upload en cours...' : 'Clique pour changer la photo ou le logo'}</div>
        </div>

        {success && (
          <div style={{ background: '#EAF3DE', color: '#3B6D11', fontSize: 13, padding: '8px 12px', borderRadius: 8, textAlign: 'center' }}>
            Réglages enregistrés
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Bureau d'études</div>

        <div style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Nom du bureau d'études</div>
            <input value={form.company_name} onChange={e => setField('company_name', e.target.value)} placeholder="Ex : BET Stelar" style={inp} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Votre nom</div>
            <input value={form.full_name} onChange={e => setField('full_name', e.target.value)} placeholder="Nom Prénom" style={inp} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Téléphone</div>
            <input value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="+596 6XX XX XX XX" style={inp} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Email</div>
            <input value={form.email} disabled style={{ ...inp, background: '#f5f4f0', color: '#aaa' }} />
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>Compte</div>

        <div style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, borderBottom: '0.5px solid #e0dfd7' }}>
            <span style={{ color: '#888' }}>Connecté via</span>
            <span style={{ fontWeight: 500 }}>GitHub</span>
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
            <span style={{ color: '#888' }}>Version</span>
            <span style={{ fontWeight: 500 }}>Builders MOE v1.0</span>
          </div>
        </div>

        <button onClick={handleLogout} style={{ width: '100%', padding: 12, borderRadius: 10, border: '0.5px solid #E24B4A', background: 'none', color: '#E24B4A', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 }}>
          Se déconnecter
        </button>

      </div>

      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: '0.5px solid #e0dfd7', padding: '12px 14px 24px' }}>
        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#1a1a1a', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>

    </div>
  )
}

const inp = {
  fontSize: 14, padding: '9px 11px', borderRadius: 8,
  border: '0.5px solid #e0dfd7', background: '#fff',
  color: '#1a1a1a', width: '100%', boxSizing: 'border-box',
  fontFamily: 'inherit'
}
