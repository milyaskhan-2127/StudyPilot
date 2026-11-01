import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { addMonths, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, addDays, differenceInCalendarDays, differenceInHours } from 'date-fns'
import { ArrowDownUp, ArrowLeft, ArrowRight, Bell, BookOpen, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Clock3, CloudOff, Compass, LayoutDashboard, ListFilter, Menu, MessageCircle, Plus, RefreshCw, Search, Send, Settings2, ShieldCheck, Sparkles, X } from 'lucide-react'
import { fetchAssignments, loadChatSession, sendChatMessage } from './services/api.js'

const ChatMarkdown = lazy(() => import('./components/ChatMarkdown.jsx'))

const navigation = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/assignments', label: 'Assignments', icon: BookOpen },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/planner', label: 'Study planner', icon: Compass },
  { path: '/assistant', label: 'AI assistant', icon: MessageCircle },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/settings', label: 'Settings', icon: Settings2 },
]

function useStoredState(key, initial) {
  const [state, setState] = useState(() => {
    try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) : initial } catch { return initial }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)) } catch { return } }, [key, state])
  return [state, setState]
}

function useAssignments() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const controllerRef = useRef(null)
  const requestRef = useRef(0)

  const refresh = useCallback(async (initial = false) => {
    const requestId = ++requestRef.current
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    if (initial) setLoading(true)
    else setRefreshing(true)
    try {
      const next = await fetchAssignments(controller.signal)
      if (requestId !== requestRef.current) return
      setItems(next)
      setError('')
      setUpdatedAt(new Date())
    } catch (cause) {
      if (controller.signal.aborted || requestId !== requestRef.current) return
      setError(cause.message || 'Could not load assignments.')
    } finally {
      if (requestId === requestRef.current) { setLoading(false); setRefreshing(false) }
    }
  }, [])

  useEffect(() => {
    refresh(true)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    const onOnline = () => refresh()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 60000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => { controllerRef.current?.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onOnline) }
  }, [refresh])

  return { items, loading, refreshing, error, updatedAt, refresh }
}

function deadlineText(item) {
  if (!item.dueDate) return 'No deadline'
  const days = differenceInCalendarDays(new Date(item.dueDate), new Date())
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return format(new Date(item.dueDate), 'MMM d, yyyy')
}

function getAlerts(items) {
  const now = new Date()
  return items.filter(item => item.status !== 'completed' && item.dueDate).map(item => {
    const hours = differenceInHours(new Date(item.dueDate), now)
    if (hours < 0) return { id: `${item.id}-${item.dueDate}-overdue`, item, tone: 'danger', title: 'Overdue assignment', description: `${item.title} was due ${format(new Date(item.dueDate), 'MMM d')}.` }
    if (hours <= 24) return { id: `${item.id}-${item.dueDate}-urgent`, item, tone: 'danger', title: 'Deadline approaching', description: `${item.title}: ${deadlineText(item)}.` }
    if (hours <= 72) return { id: `${item.id}-${item.dueDate}-soon`, item, tone: 'amber', title: 'Coming up soon', description: `${item.title} is due ${format(new Date(item.dueDate), 'EEEE')}.` }
    return null
  }).filter(Boolean).sort((a, b) => new Date(a.item.dueDate) - new Date(b.item.dueDate))
}

function StatusPill({ status }) {
  return <span className={`status-pill ${status}`}>{status === 'in-progress' ? 'In progress' : status === 'completed' ? 'Completed' : 'Pending'}</span>
}

function SectionHeading({ eyebrow, title, action }) {
  return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</div>
}

function StatePanel({ icon: Icon = BookOpen, title, description, action, compact = false }) {
  return <div className={`state-panel glass ${compact ? 'compact' : ''}`}><div className="state-icon"><Icon size={24} /></div><h3>{title}</h3><p>{description}</p>{action}</div>
}

function AssignmentCard({ item, onAsk, compact = false }) {
  const date = item.dueDate ? new Date(item.dueDate) : null
  const overdue = date && date < new Date() && item.status !== 'completed'
  return <motion.article layout className={`assignment-card glass ${compact ? 'compact' : ''}`} whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
    <div className="assignment-head"><span className="subject-dot" /><span className="subject-label">{item.subject}</span><StatusPill status={item.status} /></div>
    <h3>{item.title}</h3>
    {item.notes && !compact && <p className="assignment-notes">{item.notes}</p>}
    <div className="assignment-meta"><span className={overdue ? 'due danger' : 'due'}><CalendarDays size={15} />{deadlineText(item)}</span><span>{item.priority !== 'normal' ? `${item.priority} priority` : item.difficulty || 'Assignment'}</span></div>
    <div className="progress-track"><motion.span initial={{ width: 0 }} animate={{ width: `${item.progress}%` }} transition={{ duration: 0.7 }} /></div>
    <div className="assignment-foot"><span>{item.progress}% complete</span><button type="button" className="text-button" onClick={() => onAsk(`Help me update the progress for ${item.title}.`)}>Update with AI <ArrowRight size={14} /></button></div>
  </motion.article>
}

function Sidebar({ unread, open, setOpen }) {
  return <><AnimatePresence>{open && <motion.button className="mobile-overlay" aria-label="Close navigation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />}</AnimatePresence><aside className={`sidebar glass ${open ? 'open' : ''}`}>
    <div className="brand"><div className="brand-mark"><Compass size={25} strokeWidth={2.1} /></div><div><strong>StudyPilot<span> AI</span></strong><small>Your study space</small></div><button className="mobile-close icon-button" aria-label="Close menu" onClick={() => setOpen(false)}><X size={20} /></button></div>
    <div className="sidebar-caption">WORKSPACE</div><nav aria-label="Main navigation">{navigation.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} end={path === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon size={19} /><span>{label}</span>{label === 'Notifications' && unread > 0 && <b className="nav-badge">{unread}</b>}</NavLink>)}</nav>
    <div className="sidebar-bottom"><div className="sidebar-tip"><div className="tip-icon"><Sparkles size={17} /></div><strong>Make room for focus.</strong><p>Ask your AI assistant to turn deadlines into a plan.</p><NavLink to="/assistant" onClick={() => setOpen(false)}>Open assistant <ArrowRight size={14} /></NavLink></div><div className="sidebar-footer"><span className="online-dot" /> Your study workspace</div></div>
  </aside></>
}

function Topbar({ title, unread, alerts, onMenu, refreshing, onRefresh, updatedAt }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  return <header className="topbar glass"><div className="topbar-left"><button className="icon-button menu-button" aria-label="Open menu" onClick={onMenu}><Menu size={21} /></button><div><span className="topbar-kicker">STUDYPILOT / WORKSPACE</span><h1>{title}</h1></div></div><div className="topbar-actions"><span className="sync-label">{updatedAt ? `Synced ${format(updatedAt, 'h:mm a')}` : 'Connecting'}</span><button type="button" className="icon-button" aria-label="Refresh assignments" title="Refresh assignments" onClick={() => onRefresh()} disabled={refreshing}><RefreshCw size={18} className={refreshing ? 'spin' : ''} /></button><div className="bell-wrap"><button type="button" className="icon-button notification-button" aria-label={`Notifications, ${unread} unread`} aria-expanded={open} onClick={() => setOpen(!open)}><Bell size={19} />{unread > 0 && <span className="notification-badge">{unread}</span>}</button><AnimatePresence>{open && <motion.div className="bell-popover glass" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><div className="popover-head"><strong>Deadline alerts</strong><button className="text-button" onClick={() => { setOpen(false); navigate('/notifications') }}>View all</button></div>{alerts.length ? alerts.slice(0, 3).map(alert => <div key={alert.id} className="popover-alert"><span className={`alert-dot ${alert.tone}`} /><div><strong>{alert.title}</strong><p>{alert.description}</p></div></div>) : <p className="popover-empty">All clear. No urgent deadlines.</p>}</motion.div>}</AnimatePresence></div><div className="avatar" aria-hidden="true">S</div></div></header>
}

function Dashboard({ data, alerts, name, onAsk }) {
  const navigate = useNavigate()
  const { items, loading, error, refresh } = data
  const pending = items.filter(item => item.status !== 'completed')
  const completed = items.length - pending.length
  const overdue = pending.filter(item => item.dueDate && new Date(item.dueDate) < new Date()).length
  const upcoming = [...pending].filter(item => item.dueDate).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  const spotlight = upcoming[0]
  const completion = items.length ? Math.round(completed / items.length * 100) : 0
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const counts = days.map(day => items.filter(item => item.dueDate && isSameDay(new Date(item.dueDate), day)).length)
  const maxCount = Math.max(...counts, 1)
  if (error && !items.length && !loading) return <StatePanel icon={CloudOff} title="Assignments unavailable" description={error} action={<button className="primary-button" onClick={() => refresh()}><RefreshCw size={16} /> Retry connection</button>} />
  return <motion.div className="page-stack" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
    <div className="welcome"><div><span className="eyebrow">YOUR STUDY DESK</span><h2>Good to see you, {name}<span className="sage-period">.</span></h2><p>One clear view of what matters next.</p></div><button className="primary-button" onClick={() => onAsk('Help me add a new assignment.')}><Plus size={18} /> Add with AI</button></div>
    {error && <div className="error-banner" role="alert"><CloudOff size={19} /><span>{error}{items.length > 0 && ' Showing the last loaded assignments.'}</span><button onClick={() => refresh()}>Retry <RefreshCw size={15} /></button></div>}
    {loading ? <div className="dashboard-grid"><div className="skeleton tall" /><div className="skeleton tall" /><div className="skeleton" /><div className="skeleton" /></div> : items.length === 0 && !error ? <StatePanel title="A clean slate" description="No assignments came back from your n8n workflow. Add your first one with the AI assistant." action={<button className="primary-button" onClick={() => onAsk('Help me add my first assignment.')}><Sparkles size={16} /> Add assignment</button>} /> : <>
      <div className="stats-grid"><div className="stat-card glass"><span>Total assignments</span><strong>{items.length}</strong><small>Across all subjects</small><BookOpen className="stat-watermark" /></div><div className="stat-card glass"><span>Still to do</span><strong>{pending.length}</strong><small>Keep moving forward</small><Clock3 className="stat-watermark" /></div><div className="stat-card glass"><span>Completed</span><strong>{completed}</strong><small>{completion}% of your workload</small><CheckCircle2 className="stat-watermark" /></div><div className="stat-card glass"><span>Overdue</span><strong>{overdue}</strong><small>{overdue ? 'Needs your attention' : 'You are on track'}</small><CircleAlert className="stat-watermark" /></div></div>
      <div className="dashboard-grid"><section className="spotlight glass"><span className="eyebrow">UP NEXT</span>{spotlight ? <><div className="spotlight-icon"><CalendarDays size={25} /></div><h3>{spotlight.title}</h3><p>{spotlight.subject} · {deadlineText(spotlight)}</p><div className="spotlight-bottom"><StatusPill status={spotlight.status} /><button className="light-button" onClick={() => onAsk(`Help me plan and complete ${spotlight.title}.`)}>Plan with AI <ArrowRight size={16} /></button></div></> : <><h3>No upcoming deadlines</h3><p>Your open assignments have no future deadlines.</p><button className="light-button" onClick={() => navigate('/assignments')}>See assignments <ArrowRight size={16} /></button></>}</section><section className="workload glass"><SectionHeading eyebrow="AT A GLANCE" title="This week" action={<button className="text-button" onClick={() => navigate('/calendar')}>Open calendar <ArrowRight size={15} /></button>} /><div className="chart-bars" role="img" aria-label={`Assignments due this week: ${counts.join(', ')}`}>
        {days.map((day, index) => <div key={day.toISOString()} className="chart-day"><span className="bar-track"><motion.span initial={{ height: 0 }} animate={{ height: `${Math.max(counts[index] ? 18 : 5, counts[index] / maxCount * 100)}%` }} transition={{ duration: 0.6, delay: index * 0.05 }} className={isSameDay(day, new Date()) ? 'today' : ''} /></span><small>{format(day, 'EEE')}</small></div>)}</div><p className="workload-summary">{counts.reduce((sum, count) => sum + count, 0)} deadlines this week</p></section></div>
      <div className="content-grid"><section><SectionHeading eyebrow="STAY AHEAD" title="Priority queue" action={<button className="text-button" onClick={() => navigate('/assignments')}>View all <ArrowRight size={15} /></button>} />{upcoming.length ? <div className="card-list">{upcoming.slice(0, 3).map(item => <AssignmentCard key={item.id} item={item} onAsk={onAsk} compact />)}</div> : <StatePanel compact title="Nothing due soon" description="Assignments with deadlines will appear here." />}</section><section className="side-stack"><div className="completion-card glass"><span className="eyebrow">MOMENTUM</span><h3>{completion ? "Progress looks good" : "Start your momentum"}</h3><div className="completion-ring" style={{ '--value': `${completion}%` }}><div><strong>{completion}%</strong><small>complete</small></div></div><p>{completed} of {items.length} assignments finished</p></div><div className="mini-alerts glass"><SectionHeading eyebrow="ON YOUR RADAR" title="Alerts" action={<button className="text-button" onClick={() => navigate('/notifications')}>See all</button>} />{alerts.length ? alerts.slice(0, 2).map(alert => <div key={alert.id} className="alert-row"><span className={`alert-dot ${alert.tone}`} /><div><strong>{alert.item.title}</strong><small>{alert.description}</small></div></div>) : <p className="muted">No urgent deadlines right now.</p>}</div></section></div>
    </>}
  </motion.div>
}

function Assignments({ data, onAsk }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('due')
  const { items, loading, error, refresh } = data
  const visible = useMemo(() => items.filter(item => {
    const matchesSearch = `${item.title} ${item.subject} ${item.notes}`.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || item.status === filter || filter === 'overdue' && item.status !== 'completed' && item.dueDate && new Date(item.dueDate) < new Date()
    return matchesSearch && matchesFilter
  }).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'subject' ? a.subject.localeCompare(b.subject) : (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity)), [items, search, filter, sort])
  if (error && !items.length && !loading) return <StatePanel icon={CloudOff} title="Assignments unavailable" description={error} action={<button className="primary-button" onClick={() => refresh()}><RefreshCw size={16} /> Retry connection</button>} />
  return <motion.div className="page-stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="page-intro"><div><span className="eyebrow">ALL YOUR WORK</span><h2>Assignments</h2><p>Every task, in one clear place.</p></div><button className="primary-button" onClick={() => onAsk('Help me add a new assignment.')}><Plus size={18} /> Add assignment</button></div>
    <div className="filter-bar glass"><label className="search-field"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search assignments" aria-label="Search assignments" /></label><label className="select-field"><ListFilter size={17} /><select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filter assignments"><option value="all">All statuses</option><option value="pending">Pending</option><option value="in-progress">In progress</option><option value="completed">Completed</option><option value="overdue">Overdue</option></select><ChevronDown size={15} /></label><label className="select-field"><ArrowDownUp size={17} /><select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort assignments"><option value="due">Due date</option><option value="title">Title</option><option value="subject">Subject</option></select><ChevronDown size={15} /></label></div>
    {error && <div className="error-banner" role="alert"><CircleAlert size={18} /><span>{error}</span><button onClick={() => refresh()}>Retry</button></div>}
    {loading ? <div className="assignment-grid"><div className="skeleton card" /><div className="skeleton card" /><div className="skeleton card" /></div> : visible.length ? <div className="assignment-grid">{visible.map(item => <AssignmentCard key={item.id} item={item} onAsk={onAsk} />)}</div> : <StatePanel title={items.length ? 'No matching assignments' : 'No assignments yet'} description={items.length ? 'Try a different search or filter.' : 'When your n8n workflow returns assignments, they will appear here.'} action={items.length ? <button className="secondary-button" onClick={() => { setSearch(''); setFilter('all') }}>Clear filters</button> : <button className="primary-button" onClick={() => onAsk('Help me add an assignment.')}><Plus size={16} /> Add with AI</button>} />}
  </motion.div>
}

function Calendar({ data, onAsk }) {
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [selected, setSelected] = useState(new Date())
  const [weekOnly, setWeekOnly] = useState(false)
  const days = weekOnly ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selected, { weekStartsOn: 1 }), i)) : Array.from({ length: 42 }, (_, i) => addDays(startOfWeek(month, { weekStartsOn: 1 }), i))
  const matches = data.items.filter(item => item.dueDate && isSameDay(new Date(item.dueDate), selected))
  if (data.error && !data.items.length && !data.loading) return <StatePanel icon={CloudOff} title="Calendar unavailable" description={data.error} action={<button className="primary-button" onClick={() => data.refresh()}><RefreshCw size={16} /> Retry connection</button>} />
  return <motion.div className="page-stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="page-intro"><div><span className="eyebrow">TIME IN VIEW</span><h2>Calendar</h2><p>See what each day holds.</p></div><button className="secondary-button" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(new Date()) }}>Today</button></div>
    {data.error && <div className="error-banner" role="alert"><CircleAlert size={18} /><span>{data.error}</span><button onClick={() => data.refresh()}>Retry</button></div>}
    <div className="calendar-layout"><section className="calendar-panel glass"><div className="calendar-toolbar"><div><span className="eyebrow">DEADLINE VIEW</span><h3>{format(weekOnly ? selected : month, 'MMMM yyyy')}</h3></div><div className="calendar-controls"><div className="segmented"><button className={!weekOnly ? 'selected' : ''} onClick={() => setWeekOnly(false)}>Month</button><button className={weekOnly ? 'selected' : ''} onClick={() => setWeekOnly(true)}>Week</button></div><button className="icon-button" aria-label="Previous period" onClick={() => { if (weekOnly) { const day = addDays(selected, -7); setSelected(day); setMonth(startOfMonth(day)) } else setMonth(addMonths(month, -1)) }}><ChevronLeft size={20} /></button><button className="icon-button" aria-label="Next period" onClick={() => { if (weekOnly) { const day = addDays(selected, 7); setSelected(day); setMonth(startOfMonth(day)) } else setMonth(addMonths(month, 1)) }}><ChevronRight size={20} /></button></div></div><div className="calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div><div className={`calendar-grid ${weekOnly ? 'week' : ''}`}>{days.map(day => { const count = data.items.filter(item => item.dueDate && isSameDay(new Date(item.dueDate), day)).length; return <button key={day.toISOString()} className={`calendar-cell ${isSameMonth(day, month) ? '' : 'outside'} ${isSameDay(day, selected) ? 'selected' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`} onClick={() => { setSelected(day); setMonth(startOfMonth(day)) }} aria-label={`${format(day, 'MMMM d, yyyy')}, ${count} deadlines`}><span>{format(day, 'd')}</span>{count > 0 && <span className="calendar-count">{count} {count === 1 ? 'due' : 'due'}</span>}</button> })}</div></section><aside className="calendar-detail glass"><span className="eyebrow">SELECTED DAY</span><h3>{format(selected, 'EEEE, MMM d')}</h3><p>{matches.length} {matches.length === 1 ? 'deadline' : 'deadlines'}</p>{matches.length ? <div className="calendar-match-list">{matches.map(item => <div key={item.id} className="calendar-match"><span className="subject-dot" /><div><strong>{item.title}</strong><small>{item.subject} · {item.status}</small></div></div>)}</div> : <div className="calendar-empty"><CalendarDays size={26} /><span>No deadlines on this day.</span></div>}<button className="secondary-button full" onClick={() => onAsk(`Help me plan my work for ${format(selected, 'MMMM d, yyyy')}.`)}>Plan this day <ArrowRight size={15} /></button></aside></div>
  </motion.div>
}

function Planner({ data, onAsk }) {
  const open = data.items.filter(item => item.status !== 'completed')
  const ranked = [...open].sort((a, b) => (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity))
  const today = ranked.filter(item => item.dueDate && differenceInCalendarDays(new Date(item.dueDate), new Date()) <= 0)
  const week = ranked.filter(item => item.dueDate && differenceInCalendarDays(new Date(item.dueDate), new Date()) > 0 && differenceInCalendarDays(new Date(item.dueDate), new Date()) <= 7)
  const estimate = ranked.reduce((sum, item) => sum + item.estimatedMinutes, 0)
  if (data.error && !data.items.length && !data.loading) return <StatePanel icon={CloudOff} title="Planner unavailable" description={data.error} action={<button className="primary-button" onClick={() => data.refresh()}><RefreshCw size={16} /> Retry connection</button>} />
  return <motion.div className="page-stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="page-intro"><div><span className="eyebrow">A CLEARER PATH</span><h2>Study planner</h2><p>Priorities drawn from your saved assignments.</p></div><button className="primary-button" onClick={() => onAsk('Create a study plan using my current assignments and deadlines.')}><Sparkles size={17} /> Generate AI plan</button></div>
    {data.error && <div className="error-banner" role="alert"><CircleAlert size={18} /><span>{data.error}</span><button onClick={() => data.refresh()}>Retry</button></div>}
    {data.loading ? <div className="skeleton tall" /> : open.length ? <><div className="planner-banner glass"><div className="planner-banner-icon"><Compass size={24} /></div><div><span className="eyebrow">YOUR LIVE WORKLOAD</span><h3>{open.length} assignments to move forward</h3><p>{estimate ? `${Math.round(estimate / 60 * 10) / 10} hours estimated from saved assignment data` : 'Add estimated time in your backend to see a workload total.'}</p></div></div><div className="planner-columns"><section className="planner-column glass"><SectionHeading eyebrow="FOCUS FIRST" title="Today & overdue" />{today.length ? today.map((item, index) => <div key={item.id} className="plan-item"><span className="plan-number">0{index + 1}</span><div><strong>{item.title}</strong><small>{item.subject} · {deadlineText(item)}</small></div><ArrowRight size={16} /></div>) : <p className="muted">No assignments due today or overdue.</p>}</section><section className="planner-column glass"><SectionHeading eyebrow="LOOKING AHEAD" title="Next 7 days" />{week.length ? week.map((item, index) => <div key={item.id} className="plan-item"><span className="plan-number">0{index + 1}</span><div><strong>{item.title}</strong><small>{item.subject} · {deadlineText(item)}</small></div><ArrowRight size={16} /></div>) : <p className="muted">No deadlines in the next week.</p>}</section></div><div className="recommendation glass"><div className="recommendation-icon"><Sparkles size={20} /></div><div><strong>Want a personalized plan?</strong><p>The AI assistant can suggest a schedule. Its recommendations are separate from your saved assignments until you ask it to update them.</p></div><button className="secondary-button" onClick={() => onAsk('Build a realistic study plan for my pending assignments this week.')}>Ask AI <ArrowRight size={15} /></button></div></> : <StatePanel title="Nothing to plan yet" description="Your pending assignments will shape this planner when the read workflow returns them." action={<button className="primary-button" onClick={() => onAsk('Help me add an assignment.')}><Plus size={16} /> Add with AI</button>} />}
  </motion.div>
}

function Assistant({ onAction }) {
  const location = useLocation()
  const [sessionId, setSessionId] = useStoredState('studypilot-session', crypto.randomUUID())
  const [messages, setMessages] = useStoredState(`studypilot-chat-${sessionId}`, [])
  const [input, setInput] = useState(location.state?.prompt || '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [historyLoading, setHistoryLoading] = useState(true)
  const bottom = useRef(null)
  const navigate = useNavigate()
  useEffect(() => { if (location.state?.prompt) { setInput(location.state.prompt); navigate(location.pathname, { replace: true, state: null }) } }, [location, navigate])
  useEffect(() => {
    let active = true
    setHistoryLoading(true)
    loadChatSession(sessionId).then(history => { if (active && history.length) setMessages(history) }).catch(() => {}).finally(() => { if (active) setHistoryLoading(false) })
    return () => { active = false }
  }, [sessionId, setMessages])
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, sending])

  const submit = async (event, retryText) => {
    event?.preventDefault()
    const text = (retryText ?? input).trim()
    if (!text || sending) return
    setInput('')
    setError('')
    if (!retryText) setMessages(current => [...current, { id: crypto.randomUUID(), role: 'user', text, time: new Date().toISOString() }])
    setSending(true)
    try {
      const answer = await sendChatMessage(sessionId, text)
      setMessages(current => [...current, { id: crypto.randomUUID(), role: 'assistant', text: answer, time: new Date().toISOString() }])
      await onAction()
    } catch (cause) { setError(cause.message || 'The assistant could not respond.') }
    finally { setSending(false) }
  }
  const newConversation = () => { const id = crypto.randomUUID(); setSessionId(id); setMessages([]); setError(''); setInput('') }
  const suggestions = ['Add an assignment', 'What is due soon?', 'Make a study plan']
  return <motion.div className="assistant-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="assistant-header"><div><span className="eyebrow">YOUR STUDY COPILOT</span><h2>AI assistant</h2><p>Ask naturally. Your agent can help manage work through n8n.</p></div><button className="secondary-button" onClick={newConversation}><Plus size={16} /> New chat</button></div><div className="chat-shell glass"><div className="chat-topline"><div className="assistant-identity"><span className="assistant-avatar"><Sparkles size={19} /></span><div><strong>StudyPilot AI</strong><small><span className="online-dot" /> Powered by n8n</small></div></div><span className="private-session"><ShieldCheck size={15} /> Session saved on this device</span></div><div className="chat-messages" aria-live="polite">{historyLoading && !messages.length ? <div className="chat-loading">Loading conversation…</div> : messages.length ? messages.map(message => <motion.div key={message.id} className={`message ${message.role}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><div className="message-bubble">{message.role === 'assistant' ? <Suspense fallback="Formatting reply…"><ChatMarkdown text={message.text} /></Suspense> : message.text}</div><time>{message.time ? format(new Date(message.time), 'h:mm a') : ''}</time></motion.div>) : <div className="chat-welcome"><div className="welcome-spark"><Sparkles size={29} /></div><span className="eyebrow">READY WHEN YOU ARE</span><h3>Where should we begin?</h3><p>Tell me what you need to add, update, or plan. I’ll keep the conversation going when details are missing.</p><div className="suggestions">{suggestions.map(suggestion => <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion} <ArrowRight size={14} /></button>)}</div></div>}{sending && <div className="message assistant"><div className="message-bubble typing"><i /><i /><i /></div></div>}{error && <div className="chat-error" role="alert"><CircleAlert size={17} /><span>{error}</span><button onClick={() => submit(null, messages.filter(message => message.role === 'user').at(-1)?.text)}>Retry</button></div>}<div ref={bottom} /></div><form className="chat-composer" onSubmit={submit}><label htmlFor="chat-input" className="sr-only">Message StudyPilot AI</label><textarea id="chat-input" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() } }} placeholder="Ask about your assignments..." rows="2" maxLength="4000" /><button className="send-button" type="submit" aria-label="Send message" disabled={!input.trim() || sending}><Send size={19} /></button></form><div className="composer-hint">Enter to send · Shift + Enter for a new line</div></div></motion.div>
}

function Notifications({ alerts, read, setRead, setDismissed, data }) {
  const visible = alerts
  const markAll = () => setRead(current => [...new Set([...current, ...visible.map(alert => alert.id)])])
  if (data.error && !data.items.length && !data.loading) return <StatePanel icon={CloudOff} title="Alerts unavailable" description={data.error} action={<button className="primary-button" onClick={() => data.refresh()}><RefreshCw size={16} /> Retry connection</button>} />
  return <motion.div className="page-stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="page-intro"><div><span className="eyebrow">STAY IN THE KNOW</span><h2>Notifications</h2><p>Deadline alerts calculated from your live assignments.</p></div>{visible.length > 0 && <button className="secondary-button" onClick={markAll}><Check size={16} /> Mark all read</button>}</div>{data.error && <div className="error-banner" role="alert"><CircleAlert size={18} /><span>{data.error}</span><button onClick={() => data.refresh()}>Retry</button></div>}{data.loading ? <div className="skeleton tall" /> : visible.length ? <div className="notification-list">{visible.map(alert => <motion.article layout key={alert.id} className={`notification-card glass ${read.includes(alert.id) ? 'read' : ''}`}><span className={`notification-icon ${alert.tone}`}><Bell size={20} /></span><div><span className="eyebrow">{alert.tone === 'danger' ? 'NEEDS ATTENTION' : 'UPCOMING'}</span><h3>{alert.title}</h3><p>{alert.description}</p><small>{alert.item.subject} · {format(new Date(alert.item.dueDate), 'MMM d, yyyy')}</small></div><div className="notification-actions"><button className="icon-button" title="Dismiss" aria-label={`Dismiss ${alert.item.title} alert`} onClick={() => setDismissed(current => [...current, alert.id])}><X size={17} /></button>{!read.includes(alert.id) && <button className="text-button" onClick={() => setRead(current => [...current, alert.id])}>Mark read</button>}</div></motion.article>)}</div> : <StatePanel icon={Bell} title="You’re all caught up" description="Urgent and upcoming deadlines from your assignments will appear here." />}</motion.div>
}

function Settings({ data, name, setName, preferences, setPreferences }) {
  const [draftName, setDraftName] = useState(name)
  const [saved, setSaved] = useState(false)
  return <motion.div className="page-stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="page-intro"><div><span className="eyebrow">MAKE IT YOURS</span><h2>Settings</h2><p>A few details to keep your space comfortable.</p></div></div><div className="settings-grid"><section className="settings-card glass"><SectionHeading eyebrow="PROFILE" title="Your details" /><form onSubmit={event => { event.preventDefault(); setName(draftName.trim() || 'Student'); setSaved(true); window.setTimeout(() => setSaved(false), 2500) }}><label className="field-label" htmlFor="display-name">Display name</label><input id="display-name" value={draftName} onChange={event => setDraftName(event.target.value)} maxLength="40" /><p className="field-help">Shown only in this browser.</p><button className="primary-button" type="submit">{saved ? <><Check size={16} /> Saved</> : 'Save changes'}</button></form></section><section className="settings-card glass"><SectionHeading eyebrow="PREFERENCES" title="Deadline alerts" /><label className="toggle-row"><div><strong>Show deadline alerts</strong><small>See upcoming and overdue assignments in this workspace.</small></div><input type="checkbox" checked={preferences.alerts} onChange={event => setPreferences(current => ({ ...current, alerts: event.target.checked }))} /></label><p className="field-help">Read states and this preference stay on this device. Email reminders are handled by your n8n workflow.</p></section><section className="settings-card glass"><SectionHeading eyebrow="SYSTEM STATUS" title="Connections" /><div className="connection-row"><span className={`connection-icon ${data.error ? 'bad' : ''}`}>{data.error ? <CloudOff size={19} /> : <ShieldCheck size={19} />}</span><div><strong>Assignments API</strong><small>{data.error ? data.error : data.updatedAt ? `Last synced ${format(data.updatedAt, 'MMM d, h:mm a')}` : 'Connecting to n8n…'}</small></div><button className="icon-button" onClick={() => data.refresh()} aria-label="Retry assignments connection"><RefreshCw size={17} /></button></div><div className="connection-row"><span className="connection-icon"><MessageCircle size={19} /></span><div><strong>AI chat</strong><small>n8n embedded chat · checked when you send a message</small></div></div></section></div></motion.div>
}

export default function App() {
  const data = useAssignments()
  const [name, setName] = useStoredState('studypilot-name', 'Student')
  const [read, setRead] = useStoredState('studypilot-read-alerts', [])
  const [dismissed, setDismissed] = useStoredState('studypilot-dismissed-alerts', [])
  const [preferences, setPreferences] = useStoredState('studypilot-preferences', { alerts: true })
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const alerts = useMemo(() => getAlerts(data.items), [data.items])
  const shownAlerts = preferences.alerts ? alerts.filter(alert => !dismissed.includes(alert.id)) : []
  const unread = shownAlerts.filter(alert => !read.includes(alert.id)).length
  const current = navigation.find(entry => entry.path === location.pathname)?.label || 'Overview'
  const onAsk = prompt => navigate('/assistant', { state: { prompt } })
  return <div className="app-shell"><div className="ambient one" /><div className="ambient two" /><Sidebar unread={unread} open={menuOpen} setOpen={setMenuOpen} /><main className="main"><Topbar title={current} unread={unread} alerts={shownAlerts} onMenu={() => setMenuOpen(true)} refreshing={data.refreshing} onRefresh={data.refresh} updatedAt={data.updatedAt} /><div className="main-content"><Routes><Route path="/" element={<Dashboard data={data} alerts={shownAlerts} name={name} onAsk={onAsk} />} /><Route path="/assignments" element={<Assignments data={data} onAsk={onAsk} />} /><Route path="/calendar" element={<Calendar data={data} onAsk={onAsk} />} /><Route path="/planner" element={<Planner data={data} onAsk={onAsk} />} /><Route path="/assistant" element={<Assistant onAction={data.refresh} />} /><Route path="/notifications" element={<Notifications alerts={shownAlerts} read={read} setRead={setRead} setDismissed={setDismissed} data={data} />} /><Route path="/settings" element={<Settings data={data} name={name} setName={setName} preferences={preferences} setPreferences={setPreferences} />} /><Route path="*" element={<StatePanel title="Page not found" description="This page does not exist." action={<button className="primary-button" onClick={() => navigate('/')}>Back to overview <ArrowLeft size={16} /></button>} />} /></Routes></div></main><nav className="bottom-nav" aria-label="Mobile navigation">{navigation.slice(0, 5).map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={20} /><span>{label === 'Study planner' ? 'Plan' : label === 'AI assistant' ? 'AI' : label}</span></NavLink>)}</nav></div>
}



