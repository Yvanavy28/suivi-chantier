import { useNavigate, useLocation } from 'react-router-dom'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: '0.5px solid #e0dfd7', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '10px 8px 14px', zIndex: 100 }}>

      <div onClick={() => navigate('/')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', flex: 1 }}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect x="2" y="2" width="8" height="8" rx="1.5" stroke={location.pathname === '/' ? '#1a1a1a' : '#aaa'} strokeWidth="1.3"/>
          <rect x="12" y="2" width="8" height="8" rx="1.5" stroke={location.pathname === '/' ? '#1a1a1a' : '#aaa'} strokeWidth="1.3"/>
          <rect x="2" y="12" width="8" height="8" rx="1.5" stroke={location.pathname === '/' ? '#1a1a1a' : '#aaa'} strokeWidth="1.3"/>
          <rect x="12" y="12" width="8" height="8" rx="1.5" stroke={location.pathname === '/' ? '#1a1a1a' : '#aaa'} strokeWidth="1.3"/>
        </svg>
        <span style={{ fontSize: 10, color: location.pathname === '/' ? '#1a1a1a' : '#aaa', fontWeight: location.pathname === '/' ? 500 : 400 }}>Accueil</span>
      </div>

      <div onClick={() => navigate('/nouveau-chantier')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', flex: 1 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <line x1="9" y1="3" x2="9" y2="15" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="3" y1="9" x2="15" y2="9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <span style={{ fontSize: 10, color: '#aaa' }}>Nouveau</span>
      </div>

      <div onClick={() => navigate('/entreprises')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', flex: 1 }}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect x="3" y="9" width="16" height="11" rx="1.5" stroke={location.pathname === '/entreprises' ? '#1a1a1a' : '#aaa'} strokeWidth="1.3"/>
          <path d="M7 9V7a4 4 0 018 0v2" stroke={location.pathname === '/entreprises' ? '#1a1a1a' : '#aaa'} strokeWidth="1.3" strokeLinecap="round"/>
          <circle cx="11" cy="14" r="1.5" fill={location.pathname === '/entreprises' ? '#1a1a1a' : '#aaa'}/>
        </svg>
        <span style={{ fontSize: 10, color: location.pathname === '/entreprises' ? '#1a1a1a' : '#aaa', fontWeight: location.pathname === '/entreprises' ? 500 : 400 }}>Entreprises</span>
      </div>

    </div>
  )
}
