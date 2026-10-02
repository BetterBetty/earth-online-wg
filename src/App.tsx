import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react'

type Tab = 'today' | 'schedule' | 'rewards' | 'growth'
type RewardTab = 'store' | 'wallet' | 'history'
type TaskType = 'main' | 'daily' | 'learning'

type Task = {
  id: number
  title: string
  points: number
  type: TaskType
  completed: boolean
  delayed?: number
  backlog?: number
  source?: string
  link?: string
  date?: string
  completedAt?: string
}

type Reward = { id: number; emoji: string; name: string; cost: number; note: string }
type Voucher = { id: number; rewardId: number; name: string; emoji: string; cost: number; acquiredAt: string }
type HistoryVoucher = Voucher & { status: 'used' | 'refunded'; finishedAt: string }
type CompletionRecord = { id: number; taskId: number; title: string; type: TaskType; points: number; completedAt: string }
type DetailType = 'completed' | 'xp' | 'points' | 'rewards' | null

const initialTasks: Task[] = [
  { id: 1, title: '完成产品原型体验反馈', points: 10, type: 'main', completed: false, delayed: 2, date: todayIso() },
  { id: 2, title: '每日阅读 20 分钟', points: 3, type: 'daily', completed: false, backlog: 3, date: todayIso() },
  { id: 3, title: '了解一个喜欢的产品案例', points: 5, type: 'learning', completed: false, source: 'B站', link: 'https://www.bilibili.com', date: todayIso() },
  { id: 4, title: '整理今天的桌面', points: 1, type: 'main', completed: true, date: todayIso(), completedAt: '今天' },
]

const initialCompletions: CompletionRecord[] = [
  { id: 4, taskId: 4, title: '整理今天的桌面', type: 'main', points: 1, completedAt: '今天' },
]

const initialRewards: Reward[] = [
  { id: 1, emoji: '🎁', name: '买一个盲盒', cost: 100, note: '挑一个真正喜欢的系列' },
  { id: 2, emoji: '🍽️', name: '吃一顿大餐', cost: 300, note: '认真享受，不带负罪感' },
  { id: 3, emoji: '🎬', name: '完整电影时间', cost: 80, note: '选一部想看很久的电影' },
]

const typeMeta: Record<TaskType, { label: string; icon: string }> = {
  main: { label: '主线任务', icon: '◈' },
  daily: { label: '日常任务', icon: '↻' },
  learning: { label: '学习副本', icon: '◇' },
}

const stageTitles = [
  '地球NPC', '地球新手玩家', '地球探索者', '地球主线推进者', '地球熟练玩家',
  '地球自由玩家', '地球高玩', '地球规则改写者', '地球随心所欲玩家', '地球外挂持有者',
]

function levelFromXp(xp: number) {
  let level = 1
  let threshold = 50
  let remaining = xp
  while (remaining >= threshold) {
    remaining -= threshold
    level += 1
    threshold += 25
  }
  return { level, current: remaining, needed: threshold }
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(date)
}

function todayIso() {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10)
}

function useStoredState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? JSON.parse(saved) as T : initialValue
    } catch { return initialValue }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)) }, [key, value])
  return [value, setValue] as const
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [rewardTab, setRewardTab] = useState<RewardTab>('store')
  const [tasks, setTasks] = useStoredState<Task[]>('earth-wg-tasks-v2', initialTasks)
  const [availablePoints, setAvailablePoints] = useStoredState('earth-wg-points-v2', 230)
  const [lifetimeXp, setLifetimeXp] = useStoredState('earth-wg-xp-v2', 48)
  const [rewards, setRewards] = useStoredState<Reward[]>('earth-wg-rewards-v2', initialRewards)
  const [vouchers, setVouchers] = useStoredState<Voucher[]>('earth-wg-vouchers-v2', [])
  const [voucherHistory, setVoucherHistory] = useStoredState<HistoryVoucher[]>('earth-wg-voucher-history-v2', [])
  const [completions, setCompletions] = useStoredState<CompletionRecord[]>('earth-wg-completions-v2', initialCompletions)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [toast, setToast] = useState('')
  const [selectedDay, setSelectedDay] = useState(0)
  const [showFullCalendar, setShowFullCalendar] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editingReward, setEditingReward] = useState<Reward | null>(null)
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [detailType, setDetailType] = useState<DetailType>(null)

  const player = levelFromXp(lifetimeXp)
  const title = stageTitles[Math.min(Math.floor((player.level - 1) / 10), stageTitles.length - 1)]
  const todayTasks = tasks.filter((task) => (task.date ?? todayIso()) === todayIso())

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2200)
  }

  function toggleTask(task: Task) {
    const multiplier = task.backlog ?? 1
    const gain = task.points * multiplier
    const beforeLevel = levelFromXp(lifetimeXp).level
    const nextCompleted = !task.completed
    setTasks((items) => items.map((item) => item.id === task.id ? { ...item, completed: nextCompleted } : item))
    if (nextCompleted) {
      const nextXp = lifetimeXp + gain
      setLifetimeXp(nextXp)
      setAvailablePoints((value) => value + gain)
      setCompletions((items) => [{ id: Date.now(), taskId: task.id, title: task.title, type: task.type, points: gain, completedAt: new Date().toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }, ...items])
      flash(`任务完成 · 成长值 +${gain} · 积分 +${gain}`)
      if (levelFromXp(nextXp).level > beforeLevel) setShowLevelUp(true)
    } else {
      setLifetimeXp((value) => Math.max(0, value - gain))
      setAvailablePoints((value) => Math.max(0, value - gain))
      setCompletions((items) => {
        const index = items.findIndex((item) => item.taskId === task.id)
        return index < 0 ? items : items.filter((_, itemIndex) => itemIndex !== index)
      })
      flash(`已撤销完成 · 扣回 ${gain} 成长值与积分`)
    }
  }

  function updateTask(task: Task) {
    setTasks((items) => items.map((item) => item.id === task.id ? { ...item, ...task } : item))
    setEditingTask(null)
    flash('任务设置已更新')
  }

  function deleteTask(task: Task) {
    if (!window.confirm(`确认删除“${task.title}”吗？`)) return
    setTasks((items) => items.filter((item) => item.id !== task.id))
    flash('任务已删除')
  }

  function reorderTasks(draggedId: number, targetId: number) {
    setTasks((items) => {
      const from = items.findIndex((item) => item.id === draggedId)
      const to = items.findIndex((item) => item.id === targetId)
      if (from < 0 || to < 0 || from === to) return items
      const next = [...items]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  function saveReward(reward: Omit<Reward, 'id'> & { id?: number }) {
    if (reward.id) setRewards((items) => items.map((item) => item.id === reward.id ? { ...reward, id: reward.id! } : item))
    else setRewards((items) => [{ ...reward, id: Date.now() }, ...items])
    setShowRewardModal(false)
    setEditingReward(null)
    flash(reward.id ? '奖励已更新' : '新奖励已加入奖励库')
  }

  function deleteReward(reward: Reward) {
    if (!window.confirm(`确认删除奖励“${reward.name}”吗？已兑换的奖券不会受影响。`)) return
    setRewards((items) => items.filter((item) => item.id !== reward.id))
    flash('奖励已删除')
  }

  function addTask(task: Omit<Task, 'id' | 'completed'>) {
    setTasks((items) => [...items, { ...task, id: Date.now(), completed: false }])
    setShowTaskModal(false)
    flash(task.date === todayIso() ? '任务已加入今日主线' : '任务已安排到指定日期')
  }

  function exchangeReward(reward: Reward) {
    if (availablePoints < reward.cost) return
    const voucher: Voucher = {
      id: Date.now(), rewardId: reward.id, name: reward.name, emoji: reward.emoji,
      cost: reward.cost, acquiredAt: new Date().toLocaleDateString('zh-CN'),
    }
    setAvailablePoints((value) => value - reward.cost)
    setVouchers((items) => [voucher, ...items])
    setRewardTab('wallet')
    flash(`兑换成功 · ${reward.name}`)
  }

  function finishVoucher(voucher: Voucher, status: 'used' | 'refunded') {
    setVouchers((items) => items.filter((item) => item.id !== voucher.id))
    setVoucherHistory((items) => [{ ...voucher, status, finishedAt: new Date().toLocaleDateString('zh-CN') }, ...items])
    if (status === 'refunded') setAvailablePoints((value) => value + voucher.cost)
    flash(status === 'used' ? '奖券已核销，快乐已到账' : `兑换已撤销 · 积分 +${voucher.cost}`)
  }

  const page = activeTab === 'today'
    ? <TodayPage tasks={todayTasks} points={availablePoints} xp={lifetimeXp} player={player} title={title} onToggle={toggleTask} onEdit={setEditingTask} onDelete={deleteTask} />
    : activeTab === 'schedule'
      ? <SchedulePage tasks={tasks} selectedDay={selectedDay} onSelectDay={setSelectedDay} showCalendar={showFullCalendar} onToggleCalendar={() => setShowFullCalendar((value) => !value)} onReorder={reorderTasks} />
      : activeTab === 'rewards'
        ? <RewardsPage tab={rewardTab} onTab={setRewardTab} points={availablePoints} rewards={rewards} vouchers={vouchers} history={voucherHistory} onExchange={exchangeReward} onFinish={finishVoucher} onAdd={() => { setEditingReward(null); setShowRewardModal(true) }} onEdit={(reward) => { setEditingReward(reward); setShowRewardModal(true) }} onDelete={deleteReward} />
        : <GrowthPage xp={lifetimeXp} points={availablePoints} player={player} title={title} tasks={tasks} vouchers={voucherHistory} completions={completions} onDetail={setDetailType} />

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="phone-frame">
        {page}
        <button className="fab" aria-label="发布任务" onClick={() => setShowTaskModal(true)}>＋</button>
        <BottomNav active={activeTab} onChange={setActiveTab} />
      </section>
      {showTaskModal && <TaskModal onClose={() => setShowTaskModal(false)} onSubmit={addTask} />}
      {editingTask && <TaskModal initialTask={editingTask} onClose={() => setEditingTask(null)} onUpdate={updateTask} onSubmit={addTask} />}
      {showRewardModal && <RewardModal reward={editingReward} onClose={() => { setShowRewardModal(false); setEditingReward(null) }} onSubmit={saveReward} />}
      {detailType && <StatDetailModal type={detailType} completions={completions} xp={lifetimeXp} points={availablePoints} vouchers={voucherHistory} onClose={() => setDetailType(null)} />}
      {showLevelUp && <LevelUpModal level={levelFromXp(lifetimeXp).level} onClose={() => setShowLevelUp(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  )
}

function PageHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{action}</header>
}

function PlayerCard({ points, xp, player, title }: { points: number; xp: number; player: ReturnType<typeof levelFromXp>; title: string }) {
  const progress = Math.min(100, Math.round((player.current / player.needed) * 100))
  return <article className="player-card">
    <div className="grid-overlay" />
    <div className="player-card-top"><span className="system-chip">PLAYER STATUS</span><span className="online-dot">● ONLINE</span></div>
    <div className="player-main"><div className="level-orb"><small>LV.</small><strong>{player.level}</strong></div><div><h2>{title}</h2><p>地球探索进度持续记录中</p></div></div>
    <div className="xp-row"><span>成长值 {xp}</span><span>{player.current} / {player.needed} XP</span></div>
    <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
    <div className="point-balance"><span className="coin">✦</span><div><small>可用积分</small><strong>{points}</strong></div><span className="card-code">WG / 01</span></div>
  </article>
}

function TodayPage({ tasks, points, xp, player, title, onToggle, onEdit, onDelete }: {
  tasks: Task[]; points: number; xp: number; player: ReturnType<typeof levelFromXp>; title: string; onToggle: (task: Task) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void
}) {
  const missions = tasks.filter((task) => task.type !== 'learning')
  const learning = tasks.filter((task) => task.type === 'learning')
  const openMissions = missions.filter((task) => !task.completed)
  const openLearning = learning.filter((task) => !task.completed)
  const completedMissions = missions.filter((task) => task.completed)
  const completedLearning = learning.filter((task) => task.completed)
  const renderGroup = (items: Task[], completed: Task[], emptyTitle: string, emptyText: string) => <>
    <section className="task-list">
      {items.map((task) => <TaskCard key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />)}
      {items.length === 0 && completed.length === 0 && <EmptyState icon="✓" title={emptyTitle} text={emptyText} />}
    </section>
    {completed.length > 0 && <details className="completed-section"><summary>已完成 {completed.length} 项 <span>展开</span></summary>{completed.map((task) => <TaskCard key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />)}</details>}
  </>
  return <div className="page page-today">
    <PageHeader eyebrow="EARTH ONLINE · WG" title="今日主线" action={<button className="icon-button">⌁</button>} />
    <PlayerCard points={points} xp={xp} player={player} title={title} />
    <div className="section-heading"><div><p>{formatDate()}</p><h3>今日任务</h3></div><span className="completion-count">{completedMissions.length} / {missions.length}</span></div>
    {renderGroup(openMissions, completedMissions, '今日任务已清空', '今天暂时没有待完成的主线与日常任务。')}
    <div className="section-heading learning-heading"><div><p>LEARNING QUEST</p><h3>学习副本</h3></div><span className="completion-count learning-count">{completedLearning.length} / {learning.length}</span></div>
    {renderGroup(openLearning, completedLearning, '暂无学习副本', '添加想了解的主题或稍后要看的内容。')}
  </div>
}

function TaskCard({ task, onToggle, onEdit, onDelete }: { task: Task; onToggle: (task: Task) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void }) {
  const [open, setOpen] = useState(false)
  const gain = task.points * (task.backlog ?? 1)
  return <article className={`task-card ${task.completed ? 'is-complete' : ''}`}>
    <button className="task-check" aria-label={task.completed ? '撤销完成' : '完成任务'} onClick={() => onToggle(task)}>{task.completed ? '✓' : ''}</button>
    <div className="task-copy"><div className="task-title-row"><h4>{task.title}</h4><span className="task-points">+{gain}</span></div>
      <div className="task-meta"><span className={`type-tag type-${task.type}`}>{typeMeta[task.type].icon} {typeMeta[task.type].label}</span>{task.delayed && <span className="delay-tag">已拖延 {task.delayed} 天</span>}{task.backlog && <span className="backlog-tag">积压 {task.backlog} 期</span>}</div>
      {task.source && <p className="source-line">信息源：{task.source} {task.link && <a href={task.link} target="_blank" rel="noreferrer">打开链接 ↗</a>}</p>}
    </div>
    <div className="task-menu-wrap"><button className="more-button" aria-label="更多操作" aria-expanded={open} onClick={() => setOpen((value) => !value)}>···</button>{open && <div className="task-menu"><button onClick={() => { setOpen(false); onEdit(task) }}>修改任务</button><button className="danger" onClick={() => { setOpen(false); onDelete(task) }}>删除任务</button></div>}</div>
  </article>
}

function SchedulePage({ tasks, selectedDay, onSelectDay, showCalendar, onToggleCalendar, onReorder }: { tasks: Task[]; selectedDay: number; onSelectDay: (n: number) => void; showCalendar: boolean; onToggleCalendar: () => void; onReorder: (draggedId: number, targetId: number) => void }) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() + index)
    return { weekday: '日一二三四五六'[date.getDay()], day: date.getDate(), date }
  }), [])
  const selectedIso = (() => { const d = days[selectedDay].date; const offset = d.getTimezoneOffset(); return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10) })()
  const displayTasks = tasks.filter((task) => !task.completed && (task.date ?? todayIso()) === selectedIso)
  return <div className="page">
    <PageHeader eyebrow="MISSION MAP" title="日程" action={<button className={`icon-button ${showCalendar ? 'active' : ''}`} onClick={onToggleCalendar}>▦</button>} />
    <div className="week-strip">{days.map((item, index) => <button key={item.day} className={selectedDay === index ? 'selected' : ''} onClick={() => onSelectDay(index)}><small>{index === 0 ? '今天' : `周${item.weekday}`}</small><strong>{item.day}</strong>{index === 0 || index === 2 || index === 5 ? <i /> : null}</button>)}</div>
    {showCalendar && <div className="calendar-preview"><div className="calendar-title"><strong>{new Date().getFullYear()}年 {new Date().getMonth() + 1}月</strong><span>完整月历预览</span></div><div className="calendar-grid">{Array.from({ length: 28 }, (_, i) => <span className={i + 1 === new Date().getDate() ? 'today' : ''} key={i}>{i + 1}</span>)}</div></div>}
    <div className="section-heading schedule-heading"><div><p>{formatDate(days[selectedDay].date)}</p><h3>{displayTasks.length} 项任务</h3></div><span className="drag-hint">长按拖动排序</span></div>
    <section className="sortable-list">{displayTasks.map((task, index) => <SortableTask key={task.id} task={task} index={index} onReorder={onReorder} />)}{displayTasks.length === 0 && <EmptyState icon="▦" title="这一天还没有任务" text="点击右下角的加号安排一项任务。" />}</section>
  </div>
}

function SortableTask({ task, index, onReorder }: { task: Task; index: number; onReorder: (draggedId: number, targetId: number) => void }) {
  const [dragging, setDragging] = useState(false)
  const timer = useRef<number | null>(null)
  const active = useRef(false)
  function start(event: ReactPointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    timer.current = window.setTimeout(() => { active.current = true; setDragging(true); if (navigator.vibrate) navigator.vibrate(25) }, 320)
  }
  function move(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!active.current) return
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-task-id]')
    const targetId = Number(target?.dataset.taskId)
    if (targetId && targetId !== task.id) onReorder(task.id, targetId)
  }
  function end() {
    if (timer.current) window.clearTimeout(timer.current)
    active.current = false
    setDragging(false)
  }
  return <article className={`schedule-card ${dragging ? 'is-dragging' : ''}`} data-task-id={task.id} draggable onDragStart={(event) => { event.dataTransfer.setData('text/plain', String(task.id)); setDragging(true) }} onDragEnd={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onReorder(Number(event.dataTransfer.getData('text/plain')), task.id) }}>
    <button className="drag-handle" aria-label={`长按拖动${task.title}`} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>≡</button><div><h4>{task.title}</h4><span>{typeMeta[task.type].label}</span></div><strong>+{task.points * (task.backlog ?? 1)}</strong><span className="order-number">{String(index + 1).padStart(2, '0')}</span>
  </article>
}

function RewardsPage({ tab, onTab, points, rewards, vouchers, history, onExchange, onFinish, onAdd, onEdit, onDelete }: { tab: RewardTab; onTab: (tab: RewardTab) => void; points: number; rewards: Reward[]; vouchers: Voucher[]; history: HistoryVoucher[]; onExchange: (reward: Reward) => void; onFinish: (voucher: Voucher, status: 'used' | 'refunded') => void; onAdd: () => void; onEdit: (reward: Reward) => void; onDelete: (reward: Reward) => void }) {
  return <div className="page">
    <PageHeader eyebrow="REWARD CENTER" title="奖励商店" action={<div className="points-pill"><span>✦</span>{points}</div>} />
    <div className="segmented-control"><button className={tab === 'store' ? 'active' : ''} onClick={() => onTab('store')}>奖励库</button><button className={tab === 'wallet' ? 'active' : ''} onClick={() => onTab('wallet')}>我的奖券 {vouchers.length > 0 && <b>{vouchers.length}</b>}</button><button className={tab === 'history' ? 'active' : ''} onClick={() => onTab('history')}>历史</button></div>
    {tab === 'store' && <><button className="add-reward-button" onClick={onAdd}><span>＋</span><div><strong>自定义新奖励</strong><small>为自己上架一份值得期待的快乐</small></div></button><section className="reward-grid">{rewards.map((reward) => <RewardCard key={reward.id} reward={reward} points={points} onExchange={onExchange} onEdit={onEdit} onDelete={onDelete} />)}{rewards.length === 0 && <EmptyState icon="◇" title="奖励库还是空的" text="添加第一份你真正想兑换的奖励。" />}</section></>}
    {tab === 'wallet' && <section className="voucher-list">{vouchers.length === 0 ? <EmptyState icon="⌑" title="暂时没有奖券" text="继续完成任务，兑换一份真实的快乐。" /> : vouchers.map((voucher) => <VoucherCard key={voucher.id} voucher={voucher} onFinish={onFinish} />)}</section>}
    {tab === 'history' && <section className="history-list">{history.length === 0 ? <EmptyState icon="◷" title="奖券历史为空" text="核销或退款后的奖券会保留在这里。" /> : history.map((item) => <div className="history-item" key={item.id}><span>{item.emoji}</span><div><strong>{item.name}</strong><small>{item.status === 'used' ? '已核销' : '已退款'} · {item.finishedAt}</small></div><b className={item.status}>{item.status === 'used' ? 'USED' : `+${item.cost}`}</b></div>)}</section>}
  </div>
}

function RewardCard({ reward, points, onExchange, onEdit, onDelete }: { reward: Reward; points: number; onExchange: (reward: Reward) => void; onEdit: (reward: Reward) => void; onDelete: (reward: Reward) => void }) {
  const [open, setOpen] = useState(false)
  return <article className="reward-card"><div className="reward-emoji">{reward.emoji}</div><div className="reward-copy"><h3>{reward.name}</h3><p>{reward.note || '给努力生活的自己一份奖励'}</p><strong><span>✦</span>{reward.cost}</strong></div><div className="reward-menu-wrap"><button aria-label="管理奖励" onClick={() => setOpen((value) => !value)}>···</button>{open && <div className="task-menu reward-menu"><button onClick={() => { setOpen(false); onEdit(reward) }}>修改奖励</button><button className="danger" onClick={() => { setOpen(false); onDelete(reward) }}>删除奖励</button></div>}</div><button className="exchange-button" disabled={points < reward.cost} onClick={() => onExchange(reward)}>{points < reward.cost ? `还差 ${reward.cost - points}` : '立即兑换'}</button></article>
}

function VoucherCard({ voucher, onFinish }: { voucher: Voucher; onFinish: (voucher: Voucher, status: 'used' | 'refunded') => void }) {
  return <article className="voucher-card"><div className="ticket-notch notch-left" /><div className="ticket-notch notch-right" /><div className="voucher-icon">{voucher.emoji}</div><div className="voucher-copy"><small>EARTH ONLINE REWARD</small><h3>{voucher.name}</h3><p>兑换于 {voucher.acquiredAt} · {voucher.cost} 积分</p><div><button onClick={() => onFinish(voucher, 'used')}>确认核销</button><button className="text-button" onClick={() => onFinish(voucher, 'refunded')}>撤销兑换</button></div></div><span className="voucher-code">WG-{String(voucher.id).slice(-4)}</span></article>
}

function GrowthPage({ xp, points, player, title, tasks, vouchers, completions, onDetail }: { xp: number; points: number; player: ReturnType<typeof levelFromXp>; title: string; tasks: Task[]; vouchers: HistoryVoucher[]; completions: CompletionRecord[]; onDetail: (type: DetailType) => void }) {
  const delayed = tasks.filter((task) => task.delayed).length
  const usedRewards = vouchers.filter((voucher) => voucher.status === 'used')
  return <div className="page">
    <PageHeader eyebrow="PLAYER ARCHIVE" title="成长档案" action={<button className="icon-button">⚙</button>} />
    <PlayerCard points={points} xp={xp} player={player} title={title} />
    <section className="stats-grid"><button onClick={() => onDetail('completed')}><span>✓</span><strong>{completions.length}</strong><small>累计完成任务数</small></button><button onClick={() => onDetail('xp')}><span>⌁</span><strong>{xp}</strong><small>累计成长值</small></button><button onClick={() => onDetail('points')}><span>✦</span><strong>{points}</strong><small>当前积分</small></button><button onClick={() => onDetail('rewards')}><span>⌑</span><strong>{usedRewards.length}</strong><small>已核销奖励</small></button></section>
    <section className="record-panel"><div className="panel-heading"><h3>最近记录</h3><button onClick={() => onDetail('completed')}>查看全部</button></div>{completions.slice(0, 2).map((record) => <div className="record-row" key={record.id}><span className="record-icon earn">+</span><div><strong>完成：{record.title}</strong><small>{record.completedAt} · {typeMeta[record.type].label}</small></div><b>+{record.points}</b></div>)}{delayed > 0 && <div className="record-row"><span className="record-icon delay">!</span><div><strong>任务仍在顺延</strong><small>当前有 {delayed} 项拖延任务</small></div><b className="neutral">记录</b></div>}{completions.length === 0 && delayed === 0 && <EmptyState icon="◷" title="还没有成长记录" text="完成第一项任务后，记录会出现在这里。" />}</section>
    <div className="utility-actions"><button><span>◷</span><div><strong>任务历史</strong><small>完成与放弃记录</small></div><b>›</b></button><button><span>⇩</span><div><strong>数据备份</strong><small>导出或恢复本地数据</small></div><b>›</b></button></div>
  </div>
}

function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const items: { key: Tab; icon: string; label: string }[] = [{ key: 'today', icon: '✓', label: '今日' }, { key: 'schedule', icon: '▦', label: '日程' }, { key: 'rewards', icon: '◇', label: '奖励' }, { key: 'growth', icon: '↗', label: '成长' }]
  return <nav className="bottom-nav">{items.map((item) => <button key={item.key} className={active === item.key ? 'active' : ''} onClick={() => onChange(item.key)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>
}

function TaskModal({ onClose, onSubmit, onUpdate, initialTask }: { onClose: () => void; onSubmit: (task: Omit<Task, 'id' | 'completed'>) => void; onUpdate?: (task: Task) => void; initialTask?: Task }) {
  const [title, setTitle] = useState(initialTask?.title ?? '')
  const [type, setType] = useState<TaskType>(initialTask?.type ?? 'main')
  const [points, setPoints] = useState(initialTask?.points ?? 5)
  const [dateChoice, setDateChoice] = useState<'today' | 'tomorrow' | 'weekend' | 'custom'>(initialTask?.date && initialTask.date !== todayIso() ? 'custom' : 'today')
  const [customDate, setCustomDate] = useState(initialTask?.date ?? todayIso())
  const [source, setSource] = useState(initialTask?.source ?? '')
  const [link, setLink] = useState(initialTask?.link ?? '')
  const [repeat, setRepeat] = useState(Boolean(initialTask?.backlog))
  const [accumulate, setAccumulate] = useState(initialTask?.backlog !== undefined)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  function resolveDate() {
    const date = new Date()
    if (dateChoice === 'tomorrow') date.setDate(date.getDate() + 1)
    if (dateChoice === 'weekend') date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7 || 7))
    if (dateChoice === 'custom') return customDate
    const offset = date.getTimezoneOffset()
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    const values = { title: title.trim(), points, type, date: resolveDate(), source: type === 'learning' ? source : undefined, link: type === 'learning' ? link : undefined, backlog: repeat && accumulate ? (initialTask?.backlog ?? 1) : undefined }
    if (initialTask && onUpdate) onUpdate({ ...initialTask, ...values })
    else onSubmit(values)
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><form className="task-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
    <div className="modal-grabber" />
    <div className="modal-header"><button type="button" onClick={onClose}>取消</button><div><small>{initialTask ? 'EDIT MISSION' : 'NEW MISSION'}</small><h2>{initialTask ? '修改任务设置' : '发布新任务'}</h2></div><span /></div>
    <label className="field-label">要做什么？<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="输入一个清晰、可完成的任务" /></label>
    <fieldset><legend>任务类型</legend><div className="choice-row type-choice"><button type="button" className={type === 'main' ? 'active' : ''} onClick={() => setType('main')}>◈ 普通任务</button><button type="button" className={type === 'learning' ? 'active' : ''} onClick={() => setType('learning')}>◇ 学习副本</button></div></fieldset>
    <fieldset><legend>安排日期</legend><div className="choice-row date-choice">{([['today', '今天'], ['tomorrow', '明天'], ['weekend', '周末'], ['custom', '选择日期']] as const).map(([key, label]) => <button type="button" key={key} className={dateChoice === key ? 'active' : ''} onClick={() => setDateChoice(key)}>{label}</button>)}</div>{dateChoice === 'custom' && <input className="date-input" type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />}</fieldset>
    <fieldset><legend>任务积分</legend><div className="choice-row point-choice">{[1, 3, 5, 10].map((value) => <button type="button" key={value} className={points === value ? 'active' : ''} onClick={() => setPoints(value)}>+{value}</button>)}</div></fieldset>
    {type === 'learning' && <div className="learning-fields"><label className="field-label">信息源（选填）<input value={source} onChange={(e) => setSource(e.target.value)} placeholder="例如：B站、公众号、朋友推荐" /></label><label className="field-label">链接（选填）<input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></label></div>}
    <button className="advanced-toggle" type="button" onClick={() => setAdvancedOpen((value) => !value)}><span>↻ 重复与积压</span><b>{advancedOpen ? '⌃' : '⌄'}</b></button>
    {advancedOpen && <div className="advanced-panel"><label className="switch-row"><span><strong>重复任务</strong><small>按周期自动生成日常任务</small></span><input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} /></label>{repeat && <label className="switch-row"><span><strong>允许积压</strong><small>错过的期数累计积分</small></span><input type="checkbox" checked={accumulate} onChange={(e) => setAccumulate(e.target.checked)} /></label>}</div>}
    <button className="primary-button" type="submit" disabled={!title.trim()}>{initialTask ? '保存修改' : '发布任务'} <span>→</span></button>
  </form></div>
}

function RewardModal({ reward, onClose, onSubmit }: { reward: Reward | null; onClose: () => void; onSubmit: (reward: Omit<Reward, 'id'> & { id?: number }) => void }) {
  const [emoji, setEmoji] = useState(reward?.emoji ?? '🎁')
  const [name, setName] = useState(reward?.name ?? '')
  const [cost, setCost] = useState(reward?.cost ?? 50)
  const [note, setNote] = useState(reward?.note ?? '')
  function submit(event: FormEvent) { event.preventDefault(); if (!name.trim() || cost < 1) return; onSubmit({ id: reward?.id, emoji: emoji.trim() || '🎁', name: name.trim(), cost, note: note.trim() }) }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="task-modal reward-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><div className="modal-grabber"/><div className="modal-header"><button type="button" onClick={onClose}>取消</button><div><small>REWARD SETTINGS</small><h2>{reward ? '修改奖励' : '上架新奖励'}</h2></div><span/></div><div className="reward-form-row"><label className="field-label emoji-field">图标<input value={emoji} maxLength={4} onChange={(event) => setEmoji(event.target.value)} /></label><label className="field-label">奖励名称<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：吃一顿大餐" /></label></div><label className="field-label">兑换价格<input type="number" min="1" step="1" value={cost} onChange={(event) => setCost(Math.max(1, Number(event.target.value)))} /></label><label className="field-label">奖励说明（选填）<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="写一句让自己更期待的话" /></label><button className="primary-button" disabled={!name.trim()}>{reward ? '保存奖励' : '加入奖励库'}</button></form></div>
}

function StatDetailModal({ type, completions, xp, points, vouchers, onClose }: { type: Exclude<DetailType, null>; completions: CompletionRecord[]; xp: number; points: number; vouchers: HistoryVoucher[]; onClose: () => void }) {
  const titles = { completed: '累计完成任务数', xp: '累计成长值', points: '当前积分', rewards: '已核销奖励' }
  const values = { completed: completions.length, xp, points, rewards: vouchers.filter((voucher) => voucher.status === 'used').length }
  const items = type === 'rewards' ? vouchers.filter((voucher) => voucher.status === 'used').map((voucher) => ({ id: voucher.id, title: voucher.name, meta: `核销于 ${voucher.finishedAt}`, value: `${voucher.cost} 积分` })) : completions.map((record) => ({ id: record.id, title: record.title, meta: `${record.completedAt} · ${typeMeta[record.type].label}`, value: `+${record.points}` }))
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="detail-modal" onMouseDown={(event) => event.stopPropagation()}><div className="detail-header"><div><small>PLAYER DATA</small><h2>{titles[type]}</h2></div><button onClick={onClose}>×</button></div><div className="detail-total"><strong>{values[type]}</strong><span>{type === 'completed' ? '项任务' : type === 'xp' ? 'XP' : type === 'points' ? '可用积分' : '张奖券'}</span></div>{(type === 'xp' || type === 'points') && <p className="detail-note">数值会随任务完成、撤销及奖励兑换实时变化；下方列出相关任务记录。</p>}<div className="detail-list">{items.map((item) => <div className="detail-row" key={item.id}><div><strong>{item.title}</strong><small>{item.meta}</small></div><b>{item.value}</b></div>)}{items.length === 0 && <EmptyState icon="◷" title="暂无相关历史" text="新的记录会自动保存在这里。" />}</div></section></div>
}

function LevelUpModal({ level, onClose }: { level: number; onClose: () => void }) {
  const title = stageTitles[Math.min(Math.floor((level - 1) / 10), stageTitles.length - 1)]
  return <div className="modal-backdrop level-backdrop"><div className="level-modal"><div className="level-rings"><span /><span /><div>LV.<strong>{level}</strong></div></div><small>SYSTEM UPDATE</small><h2>等级提升</h2><p>新的地球探索进度已经记录</p><div className="new-title">当前称号 · {title}</div><button className="primary-button" onClick={onClose}>继续地球Online</button></div></div>
}

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p></div>
}

