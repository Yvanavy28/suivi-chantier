import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const COLS = 14
const COLORS = ['#1D9E75','#BA7517','#185FA5','#534AB7','#993C1D','#993556','#3B6D11','#888780']

export default function PlanningGantt({ projectId, lots }) {
  const [tasks, setTasks] = useState([])
  const [view, setView] = useState('mois')
  const [loading, setLoading] = useState(true)
  const [showMenu, setShowMenu] = useState(false)

  const colW = view === 'mois' ? 36 : view === 'semaine' ? 30 : 24
  const labels = view === 'mois'
    ? ['Mars','Avr','Mai','Juin','Juil','Aout','Sep','Oct','Nov','Dec','Jan','Fev','Mars','Avr']
    : view === 'semaine'
    ? Array.from({length:COLS},(_,i)=>'S'+(i+1))
    : Array.from({length:COLS},(_,i)=>''+(i*2+1))

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('planning_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order')
      if (data && data.length > 0) {
        const parents = data.filter(t => !t.parent_id).map(t => ({
          ...t, expanded: true,
          subs: data.filter(s => s.parent_id === t.id)
        }))
        setTasks(parents)
      }
      setLoading(false)
    }
    fetch()
  }, [projectId])

  async function addTaskFromLot(lot) {
    setShowMenu(false)
    const color = COLORS[tasks.length % COLORS.length]
    const newTask = {
      project_id: projectId,
      label: lot.lots?.name || lot.label,
      color,
      start_col: 0,
      duration_col: 2,
      sort_order: tasks.length,
      parent_id: null
    }
    const { data } = await supabase.from('planning_tasks').insert([newTask]).select().single()
    if (data) setTasks(prev => [...prev, { ...data, expanded: true, subs: [] }])
  }

  async function addCustomTask() {
    setShowMenu(false)
    const label = prompt('Nom de la tache :')
    if (!label) return
    const color = COLORS[tasks.length % COLORS.length]
    const newTask = {
      project_id: projectId,
      label,
      color,
      start_col: 0,
      duration_col: 2,
      sort_order: tasks.length,
      parent_id: null
    }
    const { data } = await supabase.from('planning_tasks').insert([newTask]).select().single()
    if (data) setTasks(prev => [...prev, { ...data, expanded: true, subs: [] }])
  }

  async function addSubTask(parentTask) {
    const label = prompt('Nom de la sous-tache :')
    if (!label) return
    const newSub = {
      project_id: projectId,
      label,
      color: parentTask.color,
      start_col: parentTask.start_col,
      duration_col: 1,
      sort_order: parentTask.subs.length,
      parent_id: parentTask.id
    }
    const { data } = await supabase.from('planning_tasks').insert([newSub]).select().single()
    if (data) {
      setTasks(prev => prev.map(t => t.id === parentTask.id
        ? { ...t, subs: [...t.subs, data] }
        : t
      ))
    }
  }

  function toggleExpand(id) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, expanded: !t.expanded } : t))
  }

  async function updateBar(id, isParent, parentId, newStart, newDur) {
    const s = Math.max(0, Math.min(COLS - newDur, newStart))
    const d = Math.max(0.5, Math.min(COLS - s, newDur))
    if (isParent) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, start_col: s, duration_col: d } : t))
    } else {
      setTasks(prev => prev.map(t => t.id === parentId
        ? { ...t, subs: t.subs.map(s2 => s2.id === id ? { ...s2, start_col: s, duration_col: d } : s2) }
        : t
      ))
    }
    await supabase.from('planning_tasks').update({ start_col: s, duration_col: d }).eq('id', id)
  }

  function Bar({ task, isParent, parentId }) {
    const trackRef = useRef(null)
    const h = isParent ? 22 : 14
    const top = 8

    function startDrag(e, mode) {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.touches ? e.touches[0].clientX : e.clientX
      const origStart = task.start_col
      const origDur = task.duration_col

      function onMove(ev) {
        const cx = ev.touches ? ev.touches[0].clientX : ev.clientX
        const dx = cx - startX
        const tw = trackRef.current ? trackRef.current.offsetWidth : COLS * colW
        const delta = dx / (tw / COLS)
        const step = 0.5
        const snapped = Math.round(delta / step) * step
        if (mode === 'move') {
          updateBar(task.id, isParent, parentId, origStart + snapped, origDur)
        } else {
          updateBar(task.id, isParent, parentId, origStart, origDur + snapped)
        }
      }
      function onEnd() {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onEnd)
        window.removeEventListener('touchmove', onMove)
        window.removeEventListener('touchend', onEnd)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onEnd)
      window.addEventListener('touchmove', onMove, { passive: false })
      window.addEventListener('touchend', onEnd)
    }

    const left = (task.start_col / COLS * 100).toFixed(2) + '%'
    const width = (task.duration_col / COLS * 100).toFixed(2) + '%'

    return (
      <div ref={trackRef} style={{ flex: 1, position: 'relative', height: '100%', minHeight: isParent ? 38 : 30 }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, display: 'flex' }}>
          {Array.from({length: COLS}).map((_,i) => (
            <div key={i} style={{ flex: 1, borderRight: '0.5px solid #e0dfd7', opacity: 0.5 }}></div>
          ))}
        </div>
        <div
          style={{ position: 'absolute', left, width, top, height: h, borderRadius: 4, background: task.color, cursor: 'grab', display: 'flex', alignItems: 'center', paddingLeft: 5, overflow: 'hidden', zIndex: 1, userSelect: 'none' }}
          onMouseDown={e => startDrag(e, 'move')}
          onTouchStart={e => startDrag(e, 'move')}
        >
          <span style={{ fontSize: 9, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', flex: 1 }}>{task.label}</span>
          <div
            style={{ width: 8, height: '100%', cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            onMouseDown={e => startDrag(e, 'resize')}
            onTouchStart={e => startDrag(e, 'resize')}
          >
            <svg width="4" height="10" viewBox="0 0 4 10"><line x1="1" y1="1" x2="1" y2="9" stroke="rgba(255,255,255,0.6)" strokeWidth="1"/><line x1="3" y1="1" x2="3" y2="9" stroke="rgba(255,255,255,0.6)" strokeWidth="1"/></svg>
          </div>
        </div>
      </div>
    )
  }

  const totalW = 120 + COLS * colW
  const existingLabels = tasks.map(t => t.label)
  const availableLots = (lots || []).filter(l => !existingLabels.includes(l.lots?.name))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
        {['mois','semaine','jour'].map(v => (
          <button key={v} onClick={() => setView(v)} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 6, border: '0.5px solid #e0dfd7', background: view === v ? '#1a1a1a' : 'none', color: view === v ? '#fff' : '#888', cursor: 'pointer', fontFamily: 'inherit' }}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button onClick={() => setShowMenu(m => !m)} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 6, border: '0.5px solid #e0dfd7', background: 'none', color: '#888', cursor: 'pointer', fontFamily: 'inherit' }}>
            + Tache
          </button>
          {showMenu && (
            <div style={{ position: 'absolute', right: 0, top: 30, background: '#fff', border: '0.5px solid #e0dfd7', borderRadius: 8, minWidth: 200, zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              {availableLots.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: '#aaa', padding: '8px 12px 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Depuis les lots</div>
                  {availableLots.map(l => (
                    <div key={l.id} onClick={() => addTaskFromLot(l)} style={{ padding: '8px 12px', fontSize: 13, color: '#1a1a1a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75', flexShrink: 0 }}></div>
                      {l.lots?.name}
                    </div>
                  ))}
                  <div style={{ height: '0.5px', background: '#e0dfd7', margin: '4px 0' }}></div>
                </>
              )}
              <div onClick={addCustomTask} style={{ padding: '8px 12px', fontSize: 13, color: '#888', cursor: 'pointer' }}>
                + Tache personnalisee
              </div>
            </div>
          )}
        </div>
      </div>

      {showMenu && (
        <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }}></div>
      )}

      <div style={{ overflowX: 'auto', border: '0.5px solid #e0dfd7', borderRadius: 8, background: '#fff' }}>
        <div style={{ minWidth: totalW }}>
          <div style={{ display: 'flex', borderBottom: '0.5px solid #e0dfd7', background: '#f5f4f0' }}>
            <div style={{ width: 120, flexShrink: 0, padding: '6px 8px', fontSize: 10, color: '#aaa', borderRight: '0.5px solid #e0dfd7' }}>Tache</div>
            <div style={{ flex: 1, display: 'flex' }}>
              {labels.map((l, i) => (
                <div key={i} style={{ width: colW, flexShrink: 0, textAlign: 'center', fontSize: 10, color: '#888', padding: '6px 2px', borderRight: '0.5px solid #e0dfd7' }}>{l}</div>
              ))}
            </div>
          </div>

          {loading && <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#aaa' }}>Chargement...</div>}
          {!loading && tasks.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#aaa' }}>
              Clique sur "+ Tache" pour ajouter une tache depuis tes lots.
            </div>
          )}

          {tasks.map(t => (
            <div key={t.id} style={{ borderBottom: '0.5px solid #e0dfd7' }}>
              <div style={{ display: 'flex', alignItems: 'center', minHeight: 38, background: '#f9f9f7' }}>
                <div style={{ width: 120, flexShrink: 0, padding: '4px 8px', borderRight: '0.5px solid #e0dfd7', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {t.subs.length > 0 ? (
                    <div onClick={() => toggleExpand(t.id)} style={{ width: 14, height: 14, borderRadius: 3, border: '0.5px solid #ccc', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: 9, color: '#666' }}>
                      {t.expanded ? '▾' : '▸'}
                    </div>
                  ) : <div style={{ width: 14, flexShrink: 0 }}></div>}
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#1a1a1a', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{t.label}</div>
                  <div onClick={() => addSubTask(t)} style={{ fontSize: 9, color: '#aaa', cursor: 'pointer', padding: '1px 4px', border: '0.5px solid #e0dfd7', borderRadius: 3, flexShrink: 0, background: '#fff' }}>+</div>
                </div>
                <Bar task={t} isParent={true} parentId={null} />
              </div>
              {t.expanded && t.subs.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', minHeight: 30, background: '#fff' }}>
                  <div style={{ width: 120, flexShrink: 0, padding: '4px 8px', borderRight: '0.5px solid #e0dfd7', display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 24 }}>
                    <span style={{ fontSize: 10, color: '#aaa' }}>↳</span>
                    <div style={{ fontSize: 10, color: '#888', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{s.label}</div>
                  </div>
                  <Bar task={s} isParent={false} parentId={t.id} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center' }}>
        Glisser pour deplacer · Poignee droite pour redimensionner · + pour sous-tache
      </div>
    </div>
  )
}
