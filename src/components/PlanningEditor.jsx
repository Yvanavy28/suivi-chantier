import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function PlanningEditor({ project, onUpdate, projectId }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    start_date: project.start_date || '',
    duration_months: project.duration_months || '',
    delay_weeks: project.delay_weeks || 0,
    status: project.status || 'en_cours',
  })
  const [saving, setSaving] = useState(false)

  function getEndDate(p) {
    if (!p.start_date || !p.duration_months) return null
    const d = new Date(p.start_date)
    d.setMonth(d.getMonth() + parseInt(p.duration_months) + Math.round((p.delay_weeks || 0) * 7 / 30))
    return d
  }

  function getJoursOuvrables(endDate) {
    if (!endDate) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(0, 0, 0, 0)
    if (end < today) return null
    let count = 0
    const current = new Date(today)
    while (current <= end) {
      const day = current.getDay()
      if (day !== 0 && day !== 6) count++
      current.setDate(current.getDate() + 1)
    }
    return count
  }

  const endDate = getEndDate(form)
  const joursOuvrables = getJoursOuvrables(endDate)
  const isAlert = endDate && endDate < new Date()

  async function handleSave() {
    setSaving(true)
    await supabase.from('projects').update({
      start_date: form.start_date || null,
      duration_months: form.duration_months ? parseInt(form.duration_months) : null,
      delay_weeks: parseInt(form.delay_weeks) || 0,
      status: form.status,
    }).eq('id', projectId)
    onUpdate({
      start_date: form.start_date,
      duration_months: parseInt(form.duration_months),
      delay_weeks: parseInt(form.delay_weeks) || 0,
      status: form.status,
    })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div style={{ background: '#fff', border: '0.5px solid ' + (isAlert ? '#E24B4A' : '#e0dfd7'), borderRadius: 10, padding: '12px 14px' }}>

      {!editing ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Planning</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: isAlert ? '#FCEBEB' : form.delay_weeks > 0 ? '#FAEEDA' : '#EAF3DE', color: isAlert ? '#A32D2D' : form.delay_weeks > 0 ? '#854F0B' : '#3B6D11', fontWeight: 500 }}>
                {isAlert ? 'Délai dépassé' : form.delay_weeks > 0 ? 'Retard' : 'En cours'}
              </span>
              <div onClick={() => setEditing(true)} style={{ fontSize: 11, color: '#185FA5', cursor: 'pointer', padding: '3px 8px', border: '0.5px solid #185FA5', borderRadius: 6, fontWeight: 500 }}>
                Modifier
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Démarrage</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{form.start_date ? new Date(form.start_date).toLocaleDateString('fr-FR') : '-'}</div>
            </div>
            <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Durée prévue</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{form.duration_months ? form.duration_months + ' mois' : '-'}</div>
            </div>
            <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Fin prévue</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{endDate ? endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</div>
            </div>
            <div style={{ background: isAlert ? '#FCEBEB' : '#f5f4f0', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Décompte</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: isAlert ? '#A32D2D' : '#1a1a1a' }}>
                {isAlert ? 'Délai dépassé' : joursOuvrables !== null ? 'J-' + joursOuvrables + ' jo' : '-'}
              </div>
            </div>
          </div>

          {form.delay_weeks > 0 && (
            <div style={{ fontSize: 11, color: '#BA7517', textAlign: 'right' }}>+{form.delay_weeks} semaines de retard</div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Modifier le planning</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Date de démarrage</div>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Durée (mois)</div>
                <input type="number" value={form.duration_months} onChange={e => setForm(f => ({ ...f, duration_months: e.target.value }))} placeholder="12" style={inp} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Retard supplémentaire (semaines)</div>
              <input type="number" value={form.delay_weeks} onChange={e => setForm(f => ({ ...f, delay_weeks: e.target.value }))} placeholder="0" style={inp} />
            </div>

            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Statut du chantier</div>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                <option value="en_cours">En cours</option>
                <option value="en_pause">En pause / À venir</option>
                <option value="terminé">Terminé</option>
                <option value="réceptionné">Réceptionné</option>
              </select>
            </div>

            {endDate && (
              <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#888' }}>
                Fin calculée : <strong style={{ color: isAlert ? '#A32D2D' : '#1a1a1a' }}>{endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                {joursOuvrables !== null && <span> · J-{joursOuvrables} jo</span>}
                {isAlert && <span style={{ color: '#A32D2D' }}> · Délai dépassé</span>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(false)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '0.5px solid #e0dfd7', background: '#f5f4f0', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none', background: '#1a1a1a', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const inp = {
  fontSize: 13, padding: '8px 10px', borderRadius: 8,
  border: '0.5px solid #e0dfd7', background: '#fff',
  color: '#1a1a1a', width: '100%', boxSizing: 'border-box',
  fontFamily: 'inherit'
}
