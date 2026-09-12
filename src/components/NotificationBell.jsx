import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAlerts } from '../lib/notifications'

export default function NotificationBell() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    fetchAlerts().then(a => { if (active) { setAlerts(a); setLoading(false) } })
    return () => { active = false }
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <div onClick={() => setOpen(o => !o)} style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '0.5px solid #e0dfd7' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2a4 4 0 00-4 4v2.2L2.8 10.5a.6.6 0 00.5.9h9.4a.6.6 0 00.5-.9L12 8.2V6a4 4 0 00-4-4z" stroke="#555" strokeWidth="1.2" strokeLinejoin="round"/>
          <path d="M6.5 13a1.6 1.6 0 003 0" stroke="#555" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        {alerts.length > 0 && (
          <div style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, background: '#E24B4A', color: '#fff', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
            {alerts.length}
          </div>
        )}
      </div>

      {open && (
        <div style={{ position: 'absolute', top: 44, right: 0, background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', width: 280, maxHeight: 360, overflowY: 'auto', zIndex: 200 }}>
          <div style={{ padding: '10px 14px', borderBottom: '0.5px solid #e0dfd7', fontSize: 13, fontWeight: 500 }}>Notifications</div>
          {loading && <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#aaa' }}>Chargement...</div>}
          {!loading && alerts.length === 0 && <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#aaa' }}>Aucune alerte</div>}
          {alerts.map(a => (
            <div key={a.id} onClick={() => { setOpen(false); navigate(a.link) }} style={{ padding: '10px 14px', borderBottom: '0.5px solid #f0efea', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: a.severity === 'high' ? '#E24B4A' : '#EF9F27' }}></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{a.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
