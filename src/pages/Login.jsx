import { supabase } from '../lib/supabase'

export default function Login() {

  async function handleGithub() {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin
      }
    })
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f4f0' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:'32px 28px', width:320, border:'0.5px solid #e0dfd7', textAlign:'center' }}>
        <h1 style={{ fontSize:20, fontWeight:500, marginBottom:6 }}>Suivi chantier</h1>
        <p style={{ fontSize:13, color:'#888', marginBottom:28 }}>Connecte-toi pour accéder à l'application</p>
        <button onClick={handleGithub} style={{ width:'100%', padding:'11px', borderRadius:8, background:'#1a1a1a', color:'#fff', border:'none', fontSize:14, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
          Se connecter avec GitHub
        </button>
      </div>
    </div>
  )
}