import { useNavigate, useLocation } from 'react-router-dom'
import { useRole } from '../lib/useRole'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin } = useRole()

  const allTabs = [
    {
      path: '/',
      label: 'Accueil',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M3 9.5L11 3l8 6.5V19a1 1 0 01-1 1H14v-5h-4v5H4a1 1 0 01-1-1V9.5z"
            stroke={active ? '#1a1a1a' : '#aaa'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
            fill={active ? '#f5f4f0' : 'none'} />
        </svg>
      )
    },
    {
      path: '/nouveau-chantier',
      label: 'Nouveau',
      icon: () => (
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: -10, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <line x1="9" y1="3" x2="9" y2="15" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="3" y1="9" x2="15" y2="9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
      )
    },
    {
      path: '/entreprises',
      label: 'Entreprises',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect x="3" y="7" width="16" height="13" rx="1.5" stroke={active ? '#1a1a1a' : '#aaa'} strokeWidth="1.4" fill={active ? '#f5f4f0' : 'none'}/>
          <path d="M7 7V5a2 2 0 014 0v2" stroke={active ? '#1a1a1a' : '#aaa'} strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M11 7V5a2 2 0 014 0v2" stroke={active ? '#1a1a1a' : '#aaa'} strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="3" y1="12" x2="19" y2="12" stroke={active ? '#1a1a1a' : '#aaa'} strokeWidth="1.2"/>
        </svg>
      )
    }
  ]

  const tabs = isAdmin ? allTabs : allTabs.filter(t => t.path !== '/nouveau-chantier')

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: '0.5px solid #e0dfd7', display: 'flex', alignItems: 'center', paddingBottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 100 }}>
      {tabs.map((tab, i) => {
        const active = isActive(tab.path)
        return (
          <div key={i} onClick={() => navigate(tab.path)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: tab.path === '/nouveau-chantier' ? '6px 0 8px' : '8px 0 10px', cursor: 'pointer', gap: 3 }}>
            {tab.icon(active)}
            {tab.path !== '/nouveau-chantier' && (
              <div style={{ fontSize: 10, color: active ? '#1a1a1a' : '#aaa', fontWeight: active ? 500 : 400 }}>{tab.label}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
