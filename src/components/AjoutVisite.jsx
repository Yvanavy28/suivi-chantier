import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const inp = { fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '0.5px solid #e0dfd7', background: '#fff', color: '#1a1a1a', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }
const btnPrimary = { flex: 2, padding: '9px', borderRadius: 8, border: 'none', background: '#1a1a1a', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const btnSecondary = { flex: 1, padding: '9px', borderRadius: 8, border: '0.5px solid #e0dfd7', background: '#f5f4f0', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }

export default function AjoutVisite({ projectId, onSuccess }) {
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10))
  const [participants, setParticipants] = useState('')
  const [notes, setNotes] = useState('')
  const [reserves, setReserves] = useState([])
  const [reserveInput, setReserveInput] = useState('')
  const [photos, setPhotos] = useState([])
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [transcribing, setTranscribing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(t => t.stop())
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch (err) {
      setError("Impossible d'accéder au micro : " + err.message)
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function transcribeAudio() {
    if (!audioBlob) return
    setTranscribing(true)
    setError('')
    try {
      const reader = new FileReader()
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(audioBlob)
      })
      const response = await fetch('/.netlify/functions/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType: audioBlob.type })
      })
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Erreur de transcription') }
      const data = await response.json()
      setNotes(prev => prev ? prev + '\n' + data.transcript : data.transcript)
    } catch (err) {
      setError('Erreur : ' + err.message)
    }
    setTranscribing(false)
  }

  function addReserve() {
    if (!reserveInput.trim()) return
    setReserves(prev => [...prev, { description: reserveInput.trim(), status: 'ouvert' }])
    setReserveInput('')
  }

  function removeReserve(i) {
    setReserves(prev => prev.filter((_, idx) => idx !== i))
  }

  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || [])
    setPhotos(prev => [...prev, ...files])
  }

  function removePhoto(i) {
    setPhotos(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()

      const { data: visit, error: visitErr } = await supabase.from('visits').insert([{
        project_id: projectId,
        visit_date: visitDate,
        participants: participants || null,
        notes: notes || null,
        created_by: session?.user?.id || null,
      }]).select().single()
      if (visitErr) throw new Error(visitErr.message)

      if (reserves.length > 0) {
        await supabase.from('visit_reserves').insert(
          reserves.map(r => ({ visit_id: visit.id, description: r.description, status: r.status }))
        )
      }

      if (audioBlob) {
        const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm'
        const audioPath = projectId + '/visites/' + visit.id + '/audio.' + ext
        await supabase.storage.from('documents').upload(audioPath, audioBlob)
        await supabase.from('visits').update({ audio_path: audioPath }).eq('id', visit.id)
      }

      for (const photo of photos) {
        const cleanName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = projectId + '/visites/' + visit.id + '/' + Date.now() + '_' + cleanName
        await supabase.storage.from('documents').upload(path, photo)
        await supabase.from('documents').insert([{
          project_id: projectId,
          category: 'visite',
          visit_id: visit.id,
          name: photo.name,
          file_path: path,
        }])
      }

      if (onSuccess) onSuccess()
    } catch (err) {
      setError('Erreur : ' + err.message)
    }
    setSaving(false)
  }

  return (
    <div style={{ background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 500 }}>Nouvelle visite</div>

      {error && <div style={{ background: '#FCEBEB', color: '#A32D2D', fontSize: 12, padding: '8px 12px', borderRadius: 8 }}>{error}</div>}

      <div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Date de la visite</div>
        <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} style={inp} />
      </div>

      <div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Participants</div>
        <input value={participants} onChange={e => setParticipants(e.target.value)} placeholder="Ex : M. Dupont (MOE), Entreprise Xyz" style={inp} />
      </div>

      <div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Enregistrement vocal</div>
        {!audioBlob ? (
          <div onClick={recording ? stopRecording : startRecording}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 8, border: '0.5px solid ' + (recording ? '#E24B4A' : '#185FA5'), background: recording ? '#FCEBEB' : '#E6F1FB', color: recording ? '#A32D2D' : '#185FA5', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: recording ? '#E24B4A' : '#185FA5' }}></div>
            {recording ? 'Arrêter l\'enregistrement' : 'Démarrer l\'enregistrement'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <audio controls src={URL.createObjectURL(audioBlob)} style={{ width: '100%' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={transcribeAudio} disabled={transcribing} style={{ ...btnSecondary, color: '#185FA5' }}>
                {transcribing ? 'Transcription...' : 'Transcrire dans les notes'}
              </button>
              <button onClick={() => setAudioBlob(null)} style={btnSecondary}>Refaire</button>
            </div>
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Observations</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Avancement observé, remarques..." rows={5} style={{ ...inp, resize: 'vertical' }} />
      </div>

      <div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Photos</div>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 8, border: '0.5px dashed #e0dfd7', background: '#f5f4f0', fontSize: 12, color: '#888', cursor: 'pointer' }}>
          + Ajouter des photos
          <input type="file" accept="image/*" multiple onChange={handlePhotoSelect} style={{ display: 'none' }} />
        </label>
        {photos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {photos.map((p, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={URL.createObjectURL(p)} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6 }} />
                <div onClick={() => removePhoto(i)} style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#E24B4A', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>×</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Réserves</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={reserveInput} onChange={e => setReserveInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addReserve())} placeholder="Ex : fissure mur nord" style={{ ...inp, flex: 1 }} />
          <button onClick={addReserve} style={{ padding: '0 14px', borderRadius: 8, border: 'none', background: '#1a1a1a', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+</button>
        </div>
        {reserves.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {reserves.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f5f4f0', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
                <span>{r.description}</span>
                <span onClick={() => removeReserve(i)} style={{ color: '#E24B4A', cursor: 'pointer', fontSize: 14 }}>×</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, flex: 'none' }}>
        {saving ? 'Enregistrement...' : 'Enregistrer la visite'}
      </button>
    </div>
  )
}
