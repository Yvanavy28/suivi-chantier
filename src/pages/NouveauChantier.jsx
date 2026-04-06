import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const PHASES = [
  { code: 'ACT', desc: 'Assistance contrats travaux' },
  { code: 'VISA', desc: "Visa des etudes d'execution" },
  { code: 'DET', desc: "Direction execution travaux" },
  { code: 'OPC', desc: 'Ordonnancement, pilotage, coordination' },
  { code: 'AOR', desc: 'Assistance operations reception' },
]

export default function NouveauChantier() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [clients, setClients] = useState([])
  const [lots, setLots] = useState([])
  const [selectedLots, setSelectedLots] = useState([])
  const [customLots, setCustomLots] = useState([])
  const [newLotName, setNewLotName] = useState('')
  const [selectedPhases, setSelectedPhases] = useState(['ACT', 'DET', 'AOR'])
  const [showNewClient, setShowNewClient] = useState(false)

  const [form, setForm] = useState({
    ref_number: '', name: '', address: '', budget_ht: '', contingency_pct: '5',
    start_date: '', duration_months: '', client_id: '',
  })

  const [clientForm, setClientForm] = useState({
    last_name: '', first_name: '', type: 'particulier', company_name: '', phone: '', email: '', address: ''
  })

  useEffect(() => {
    supabase.from('clients').select('*').order('last_name').then(({ data }) => { if (data) setClients(data) })
    supabase.from('lots').select('*').eq('is_default', true).order('name').then(({ data }) => { if (data) setLots(data) })
  }, [])

  function setField(key, val) { setForm(f => ({ ...f, [key]: val })) }
  function setClientField(key, val) { setClientForm(f => ({ ...f, [key]: val })) }

  function toggleLot(id) {
    setSelectedLots(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function togglePhase(code) {
    setSelectedPhases(prev => prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code])
  }

  function addCustomLot() {
    if (!newLotName.trim()) return
    setCustomLots(prev => [...prev, newLotName.trim()])
    setNewLotName('')
  }

  async function handleSave() {
    if (!form.ref_number || !form.name) { setError('Le numero d affaire et le nom sont obligatoires'); return }
    setSaving(true)
    setError('')

    try {
      let clientId = form.client_id

      if (showNewClient && clientForm.last_name) {
        const { data: newClient, error: clientErr } = await supabase
          .from('clients').insert([clientForm]).select().single()
        if (clientErr) throw new Error('Erreur creation client')
        clientId = newClient.id
        setClients(prev => [...prev, newClient])
      }

      const { data: project, error: projErr } = await supabase
        .from('projects')
        .insert([{
          ref_number: form.ref_number,
          name: form.name,
          address: form.address || null,
          budget_ht: form.budget_ht ? parseFloat(form.budget_ht) : null,
          contingency_pct: form.contingency_pct ? parseFloat(form.contingency_pct) : 5,
          start_date: form.start_date || null,
          duration_months: form.duration_months ? parseInt(form.duration_months) : null,
          client_id: clientId || null,
          mission_phases: selectedPhases,
          status: 'en_cours',
        }])
        .select().single()

      if (projErr) throw new Error('Erreur creation chantier : ' + projErr.message)

      const lotRows = selectedLots.map(lotId => ({ project_id: project.id, lot_id: lotId }))

      for (const name of customLots) {
        const { data: newLot } = await supabase.from('lots').insert([{ name, is_default: false }]).select().single()
        if (newLot) lotRows.push({ project_id: project.id, lot_id: newLot.id })
      }

      if (lotRows.length > 0) {
        await supabase.from('project_lots').insert(lotRows)
      }

      navigate('/')
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  const tabs = ['General', 'Maitre d\'ouvrage', 'Lots', 'Mission']

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#f5f4f0' }}>

      <div style={{ background: '#fff', padding: '14px 16px', borderBottom: '0.5px solid #e0dfd7', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div onClick={() => navigate('/')} style={{ width: 30, height: 30, borderRadius: '50%', border: '0.5px solid #e0dfd7', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="#888" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 500 }}>Nouveau chantier</div>
      </div>

      <div style={{ display: 'flex', background: '#fff', borderBottom: '0.5px solid #e0dfd7', overflowX: 'auto' }}>
        {tabs.map((t, i) => (
          <div key={i} onClick={() => setTab(i)} style={{ padding: '10px 14px', fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer', borderBottom: tab === i ? '2px solid #1a1a1a' : '2px solid transparent', color: tab === i ? '#1a1a1a' : '#888', fontWeight: tab === i ? 500 : 400 }}>
            {t}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ margin: '12px 14px 0', background: '#FCEBEB', color: '#A32D2D', fontSize: 13, padding: '8px 12px', borderRadius: 8 }}>{error}</div>
      )}

      <div style={{ padding: '14px 14px 100px' }}>

        {tab === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>Identification</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>N° d affaire *</div>
                <input value={form.ref_number} onChange={e => setField('ref_number', e.target.value)} placeholder="2026-001" style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Statut</div>
                <select style={inp} disabled><option>En cours</option></select>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Nom du chantier *</div>
              <input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Ex : Villa Sainte-Anne" style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Adresse des travaux</div>
              <textarea value={form.address} onChange={e => setField('address', e.target.value)} placeholder="Rue, commune, code postal..." style={{ ...inp, height: 68, resize: 'none', lineHeight: 1.5 }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 6 }}>Budget</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Budget total HT (EUR)</div>
                <input type="number" value={form.budget_ht} onChange={e => setField('budget_ht', e.target.value)} placeholder="0" style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Provision imprevus (%)</div>
                <input type="number" value={form.contingency_pct} onChange={e => setField('contingency_pct', e.target.value)} placeholder="5" style={inp} />
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 6 }}>Planning</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Date de demarrage</div>
                <input type="date" value={form.start_date} onChange={e => setField('start_date', e.target.value)} style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Duree (mois)</div>
                <input type="number" value={form.duration_months} onChange={e => setField('duration_months', e.target.value)} placeholder="12" style={inp} />
              </div>
            </div>
          </div>
        )}

        {tab === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>Client existant</div>
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Selectionner un client</div>
              <select value={form.client_id} onChange={e => { setField('client_id', e.target.value); setShowNewClient(false) }} style={inp}>
                <option value="">-- Choisir un client --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.last_name} {c.first_name || ''}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
              <div style={{ flex: 1, height: '0.5px', background: '#e0dfd7' }}></div>
              <span style={{ fontSize: 11, color: '#aaa' }}>ou</span>
              <div style={{ flex: 1, height: '0.5px', background: '#e0dfd7' }}></div>
            </div>
            <div onClick={() => { setShowNewClient(!showNewClient); setField('client_id', '') }} style={{ fontSize: 13, color: '#1D9E75', cursor: 'pointer', textAlign: 'center', padding: '8px', border: '0.5px dashed #1D9E75', borderRadius: 8 }}>
              {showNewClient ? 'Annuler' : '+ Creer un nouveau client'}
            </div>
            {showNewClient && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#fff', borderRadius: 10, padding: 14, border: '0.5px solid #e0dfd7' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Nom *</div>
                    <input value={clientForm.last_name} onChange={e => setClientField('last_name', e.target.value)} placeholder="Nom" style={inp} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Prenom</div>
                    <input value={clientForm.first_name} onChange={e => setClientField('first_name', e.target.value)} placeholder="Prenom" style={inp} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Type</div>
                  <select value={clientForm.type} onChange={e => setClientField('type', e.target.value)} style={inp}>
                    <option value="particulier">Particulier</option>
                    <option value="société">Societe</option>
                    <option value="collectivité">Collectivite</option>
                  </select>
                </div>
                {clientForm.type === 'société' && (
                  <div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Nom de la societe</div>
                    <input value={clientForm.company_name} onChange={e => setClientField('company_name', e.target.value)} placeholder="Raison sociale" style={inp} />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Telephone</div>
                  <input value={clientForm.phone} onChange={e => setClientField('phone', e.target.value)} placeholder="+596 6XX XX XX XX" style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Email</div>
                  <input type="email" value={clientForm.email} onChange={e => setClientField('email', e.target.value)} placeholder="email@exemple.fr" style={inp} />
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>Lots standards</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: -6 }}>Selectionne les lots de ce chantier</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {lots.map(l => (
                <div key={l.id} onClick={() => toggleLot(l.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: selectedLots.includes(l.id) ? '0.5px solid #1D9E75' : '0.5px solid #e0dfd7', background: selectedLots.includes(l.id) ? '#E1F5EE' : '#fff', cursor: 'pointer', fontSize: 12, color: selectedLots.includes(l.id) ? '#0F6E56' : '#555' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, border: selectedLots.includes(l.id) ? 'none' : '0.5px solid #ccc', background: selectedLots.includes(l.id) ? '#1D9E75' : '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {selectedLots.includes(l.id) && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  {l.name}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 6 }}>Lots personnalises</div>
            {customLots.map((name, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ flex: 1, fontSize: 13 }}>{name}</div>
                <div onClick={() => setCustomLots(prev => prev.filter((_, j) => j !== i))} style={{ width: 18, height: 18, borderRadius: '50%', background: '#FCEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="#A32D2D" strokeWidth="1.4" strokeLinecap="round"/></svg>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newLotName} onChange={e => setNewLotName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomLot()} placeholder="Nom du lot personnalise..." style={{ ...inp, flex: 1 }} />
              <button onClick={addCustomLot} style={{ fontSize: 13, padding: '8px 14px', borderRadius: 8, border: '0.5px solid #e0dfd7', background: '#f5f4f0', cursor: 'pointer' }}>+ Ajouter</button>
            </div>
          </div>
        )}

        {tab === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>Phases de mission</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: -4 }}>Selectionne les phases incluses dans ton contrat</div>
            {PHASES.map(p => (
              <div key={p.code} onClick={() => togglePhase(p.code)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: selectedPhases.includes(p.code) ? '0.5px solid #185FA5' : '0.5px solid #e0dfd7', background: selectedPhases.includes(p.code) ? '#E6F1FB' : '#fff', cursor: 'pointer' }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: selectedPhases.includes(p.code) ? 'none' : '0.5px solid #ccc', background: selectedPhases.includes(p.code) ? '#185FA5' : '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {selectedPhases.includes(p.code) && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div style={{ fontWeight: 500, fontSize: 13, color: selectedPhases.includes(p.code) ? '#0C447C' : '#333' }}>{p.code}</div>
                <div style={{ fontSize: 11, color: selectedPhases.includes(p.code) ? '#185FA5' : '#aaa', marginLeft: 'auto' }}>{p.desc}</div>
              </div>
            ))}
          </div>
        )}

      </div>

      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: '0.5px solid #e0dfd7', padding: '12px 14px 24px', display: 'flex', gap: 10 }}>
        {tab > 0 && (
          <button onClick={() => setTab(t => t - 1)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '0.5px solid #e0dfd7', background: '#f5f4f0', fontSize: 14, cursor: 'pointer' }}>Precedent</button>
        )}
        {tab < 3 ? (
          <button onClick={() => setTab(t => t + 1)} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: '#1a1a1a', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Suivant</button>
        ) : (
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: '#1D9E75', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            {saving ? 'Enregistrement...' : 'Creer le chantier'}
          </button>
        )}
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
