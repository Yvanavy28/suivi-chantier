import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ModifierEntreprise() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', trade: '', contact_name: '', phone: '', email: '', address: '', siret: '', qualification: ''
  })

  useEffect(() => {
    supabase.from('companies').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setForm({
        name: data.name || '',
        trade: data.trade || '',
        contact_name: data.contact_name || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        siret: data.siret || '',
        qualification: data.qualification || '',
      })
      setLoading(false)
    })
  }, [id])

  function setField(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSave() {
    if (!form.name) { setError('Le nom de l entreprise est obligatoire'); return }
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('companies').update(form).eq('id', id)
    if (err) { setError('Erreur : ' + err.message); setSaving(false); return }
    navigate('/entreprise/' + id)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 13 }}>Chargement...</div>

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#f5f4f0' }}>

      <div style={{ background: '#fff', padding: '14px 16px', borderBottom: '0.5px solid #e0dfd7', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div onClick={() => navigate('/entreprise/' + id)} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e0dfd7', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="#888" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 500 }}>Modifier l entreprise</div>
      </div>

      {error && <div style={{ margin: '12px 14px 0', background: '#FCEBEB', color: '#A32D2D', fontSize: 13, padding: '8px 12px', borderRadius: 8 }}>{error}</div>}

      <div style={{ padding: '14px 14px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Identification</div>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Nom de l entreprise *</div>
          <input value={form.name} onChange={e => setField('name', e.target.value)} style={inp} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Corps de metier</div>
          <input value={form.trade} onChange={e => setField('trade', e.target.value)} placeholder="Ex : Gros oeuvre, Electricite..." style={inp} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Qualification</div>
          <input value={form.qualification} onChange={e => setField('qualification', e.target.value)} placeholder="Ex : Qualibat 2111" style={inp} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>SIRET</div>
          <input value={form.siret} onChange={e => setField('siret', e.target.value)} placeholder="XXX XXX XXX XXXXX" style={inp} />
        </div>

        <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 6 }}>Contact</div>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Nom du gerant / contact</div>
          <input value={form.contact_name} onChange={e => setField('contact_name', e.target.value)} placeholder="Nom Prenom" style={inp} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Telephone</div>
          <input value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="+596 596 XX XX XX" style={inp} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Email</div>
          <input type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="contact@entreprise.fr" style={inp} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Adresse</div>
          <textarea value={form.address} onChange={e => setField('address', e.target.value)} placeholder="Adresse complete..." style={{ ...inp, height: 68, resize: 'none', lineHeight: 1.5 }} />
        </div>

      </div>

      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: '0.5px solid #e0dfd7', padding: '12px 14px 24px' }}>
        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#1D9E75', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
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
