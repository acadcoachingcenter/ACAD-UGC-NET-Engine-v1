import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── State ───────────────────────────────────────────────────
let questions = []
let userAnswers = {}    // { qIndex: answer }
let flagged = new Set()
let current = 0
let timerInterval = null
let elapsed = 0
let submitted = false
let paperMeta = {}

// ── Boot ────────────────────────────────────────────────────
const params = new URLSearchParams(location.search)
const paperId = params.get('paper')

if (!paperId) {
  document.getElementById('loadingScreen').innerHTML =
    '<div style="color:#f87171;font-family:\'DM Mono\',monospace;padding:20px">No paper specified. <a href="index.html" style="color:#7c6af7">Go back</a></div>'
} else {
  loadPaper(paperId)
}

async function loadPaper(id) {
  const { data, error } = await supabase
    .from('papers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    document.getElementById('loadingScreen').innerHTML =
      '<div style="color:#f87171;font-family:\'DM Mono\',monospace;padding:20px">Paper not found. <a href="index.html" style="color:#7c6af7">Go back</a></div>'
    return
  }

  paperMeta = data
  questions = data.questions || []
  document.title = `${data.title} — UGC-NET Engine`
  document.getElementById('examTitle').textContent = data.title

  document.getElementById('loadingScreen').style.display = 'none'
  document.getElementById('examScreen').style.display = 'block'

  buildGrid()
  renderQuestion(0)
  startTimer()
}

// ── Timer ───────────────────────────────────────────────────
function startTimer() {
  timerInterval = setInterval(() => {
    elapsed++
    const m = Math.floor(elapsed / 60).toString().padStart(2, '0')
    const s = (elapsed % 60).toString().padStart(2, '0')
    const el = document.getElementById('timerDisplay')
    el.textContent = `${m}:${s}`
    // Warn after 100 min (typical UGC-NET 3hr → can be tuned)
    if (elapsed > 9000) el.classList.add('warn')
  }, 1000)
}

// ── Question rendering ──────────────────────────────────────
function renderQuestion(index) {
  current = index
  const q = questions[index]
  if (!q) return

  const total = questions.length
  document.getElementById('qCounter').textContent = `Question ${index + 1} of ${total}`
  document.getElementById('qText').innerHTML = q.text

  const isInteger = q.type === 'integer' || q.opts?.[0] === '(option not provided)'
  const answerArea = document.getElementById('answerArea')

  if (isInteger) {
    const saved = userAnswers[index] !== undefined ? userAnswers[index] : ''
    answerArea.innerHTML = `
      <div class="integer-input-wrap">
        <label style="font-size:0.8rem;color:#6b6b80;font-family:'DM Mono',monospace">
          Enter your answer (numerical value):
        </label>
        <input type="number" id="integerInput" value="${saved}"
          placeholder="0" ${submitted ? 'disabled' : ''}/>
      </div>
    `
    if (!submitted) {
      document.getElementById('integerInput').addEventListener('input', e => {
        const val = e.target.value.trim()
        if (val !== '') userAnswers[index] = parseFloat(val)
        else delete userAnswers[index]
        updateGrid()
        updateProgress()
      })
    } else {
      colorIntegerResult(q, index)
    }
  } else {
    const optLetters = ['A', 'B', 'C', 'D', 'E']
    answerArea.innerHTML = `<ul class="options-list">
      ${(q.opts || []).map((opt, i) => `
        <li class="option" data-i="${i}" ${submitted ? '' : 'onclick="selectOpt(this)"'}>
          <div class="opt-label">${optLetters[i] || i}</div>
          <div>${opt}</div>
        </li>
      `).join('')}
    </ul>`

    const selected = userAnswers[index]
    if (selected !== undefined) {
      document.querySelectorAll('.option')[selected]?.classList.add('selected')
    }

    if (submitted) colorMCQResult(q, index)
  }

  // Explanation — only visible after submission, never during exam
  const expEl = document.getElementById('explanation')
  const expBtn = document.getElementById('showExpBtn')
  expEl.classList.remove('show')
  expBtn.style.display = 'none'  // always hidden during exam

  if (submitted && q.exp) {
    document.getElementById('expText').textContent = q.exp
    expEl.classList.add('show')
  }

  document.getElementById('prevBtn').disabled = index === 0
  document.getElementById('nextBtn').disabled = index === total - 1
  document.getElementById('flagBtn').textContent = flagged.has(index) ? '⚑ Unflag' : '⚑ Flag'

  updateGrid()
}

window.selectOpt = (el) => {
  if (submitted) return
  const i = parseInt(el.dataset.i)
  userAnswers[current] = i
  document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'))
  el.classList.add('selected')
  updateGrid()
  updateProgress()
}

function colorMCQResult(q, index) {
  const opts = document.querySelectorAll('.option')
  const correctIdx = parseInt(q.ans)
  const userAns = userAnswers[index]
  opts.forEach((el, i) => {
    if (i === correctIdx) el.classList.add('correct')
    if (userAns !== undefined && i === userAns && i !== correctIdx) el.classList.add('wrong')
  })
}

function colorIntegerResult(q, index) {
  const input = document.getElementById('integerInput')
  if (!input) return
  const correct = parseFloat(q.ans)
  const user = parseFloat(userAnswers[index])
  input.style.borderColor = (user === correct) ? 'var(--success)' : 'var(--danger)'
}

// ── Grid ────────────────────────────────────────────────────
function buildGrid() {
  const grid = document.getElementById('qGrid')
  grid.innerHTML = questions.map((_, i) => `
    <div class="q-dot" id="dot-${i}" onclick="goTo(${i})">${i + 1}</div>
  `).join('')
}

function updateGrid() {
  questions.forEach((_, i) => {
    const dot = document.getElementById(`dot-${i}`)
    if (!dot) return
    dot.className = 'q-dot'
    if (i === current) dot.classList.add('current')
    else if (flagged.has(i)) dot.classList.add('flagged')
    else if (userAnswers[i] !== undefined) dot.classList.add('answered')
  })
}

function updateProgress() {
  const answered = Object.keys(userAnswers).length
  const pct = (answered / questions.length) * 100
  document.getElementById('progressBar').style.width = pct + '%'
}

window.goTo = (i) => renderQuestion(i)

// ── Navigation ──────────────────────────────────────────────
document.getElementById('prevBtn').addEventListener('click', () => {
  if (current > 0) renderQuestion(current - 1)
})
document.getElementById('nextBtn').addEventListener('click', () => {
  if (current < questions.length - 1) renderQuestion(current + 1)
})
document.getElementById('flagBtn').addEventListener('click', () => {
  if (flagged.has(current)) flagged.delete(current)
  else flagged.add(current)
  renderQuestion(current)
})

// ── Submit ──────────────────────────────────────────────────
document.getElementById('submitBtn').addEventListener('click', () => {
  const answered = Object.keys(userAnswers).length
  const unanswered = questions.length - answered
  const msg = unanswered > 0
    ? `You have ${unanswered} unanswered question(s). Submit anyway?`
    : 'Submit exam and see results?'
  if (!confirm(msg)) return
  submitExam()
})

function submitExam() {
  clearInterval(timerInterval)
  submitted = true
  renderQuestion(current) // re-render with colors

  // Calculate score
  let correct = 0, wrong = 0, skipped = 0
  questions.forEach((q, i) => {
    const ua = userAnswers[i]
    const isInteger = q.type === 'integer' || q.opts?.[0] === '(option not provided)'
    if (ua === undefined) { skipped++; return }
    if (isInteger) {
      if (parseFloat(ua) === parseFloat(q.ans)) correct++
      else wrong++
    } else {
      if (ua === parseInt(q.ans)) correct++
      else wrong++
    }
  })

  const pct = Math.round((correct / questions.length) * 100)
  showResults({ correct, wrong, skipped, pct, total: questions.length })
}

// ── Results ─────────────────────────────────────────────────
function showResults({ correct, wrong, skipped, pct, total }) {
  document.getElementById('examScreen').style.display = 'none'
  const rs = document.getElementById('resultsScreen')
  rs.style.display = 'block'

  document.getElementById('scoreRing').style.setProperty('--pct', pct)
  document.getElementById('scorePct').textContent = pct + '%'
  document.getElementById('resultTitle').textContent =
    pct >= 70 ? '🎉 Excellent Work!' : pct >= 50 ? '📚 Good Effort!' : '💪 Keep Practising'
  document.getElementById('resultSub').textContent =
    `${paperMeta.title} · ${formatTime(elapsed)}`

  document.getElementById('resultStats').innerHTML = `
    <div class="stat-card"><div class="stat-num" style="color:var(--success)">${correct}</div><div class="stat-lbl">Correct</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--danger)">${wrong}</div><div class="stat-lbl">Wrong</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--muted)">${skipped}</div><div class="stat-lbl">Skipped</div></div>
    <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-lbl">Total</div></div>
    <div class="stat-card"><div class="stat-num">${formatTime(elapsed)}</div><div class="stat-lbl">Time Taken</div></div>
  `

  const optLetters = ['A','B','C','D','E']
  document.getElementById('reviewList').innerHTML = questions.map((q, i) => {
    const ua = userAnswers[i]
    const isInteger = q.type === 'integer' || q.opts?.[0] === '(option not provided)'
    let isCorrect = false
    if (ua !== undefined) {
      isCorrect = isInteger
        ? parseFloat(ua) === parseFloat(q.ans)
        : ua === parseInt(q.ans)
    }
    const status = ua === undefined ? 'skipped' : isCorrect ? 'correct' : 'wrong'
    const statusClass = status === 'correct' ? 'correct-item' : status === 'wrong' ? 'wrong-item' : ''

    let ansLine = ''
    if (isInteger) {
      ansLine = `
        <span class="${ua === undefined ? 'tag-skipped' : isCorrect ? 'tag-correct' : 'tag-wrong'}">
          Your: ${ua !== undefined ? ua : '—'}
        </span>
        <span class="tag-correct">Correct: ${q.ans}</span>
      `
    } else {
      const opts = q.opts || []
      ansLine = `
        <span class="${ua === undefined ? 'tag-skipped' : isCorrect ? 'tag-correct' : 'tag-wrong'}">
          Your: ${ua !== undefined ? `${optLetters[ua]}. ${opts[ua] || ''}` : '—'}
        </span>
        <span class="tag-correct">Correct: ${optLetters[parseInt(q.ans)]}. ${opts[parseInt(q.ans)] || ''}</span>
      `
    }

    return `
      <div class="review-item ${statusClass}">
        <div class="review-q"><strong style="font-family:'DM Mono',monospace;color:#6b6b80;font-size:0.75rem">Q${i+1}</strong><br/>${q.text}</div>
        <div class="review-ans">${ansLine}</div>
        ${q.exp ? `<div class="review-exp">💡 ${q.exp}</div>` : ''}
      </div>
    `
  }).join('')
}

function formatTime(secs) {
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}m ${s}s`
}
