import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Auth state ──────────────────────────────────────────────
let currentUser = null

async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) await setUser(session.user)
  supabase.auth.onAuthStateChange(async (_e, session) => {
    await setUser(session?.user || null)
  })
}

async function setUser(user) {
  currentUser = user
  const nav = document.getElementById('navActions')
  const heroLink = document.getElementById('heroAdminLink')
  if (heroLink) heroLink.style.display = 'none'

  if (user) {
    const initials = (user.email || user.user_metadata?.user_name || '?')
      .slice(0, 2).toUpperCase()
    const displayName = user.email || user.user_metadata?.user_name || ''

    // Check admin role FIRST, then render nav once
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log('Profile fetch:', profile, profileError)

    const isAdmin = profile?.role === 'admin'

    nav.innerHTML = `
      <div class="user-pill">
        <div class="avatar">${initials}</div>
        <span>${displayName}</span>
      </div>
      ${isAdmin ? `<a href="admin.html" class="btn btn-ghost btn-sm">Admin ↗</a>` : ''}
      <button class="btn btn-ghost btn-sm" id="signOutBtn">Sign Out</button>
    `
    document.getElementById('signOutBtn')?.addEventListener('click', signOut)

    if (isAdmin && heroLink) heroLink.style.display = 'inline-flex'
  } else {
    nav.innerHTML = `
      <button class="btn btn-primary btn-sm" id="loginBtn">Sign In</button>
    `
    document.getElementById('loginBtn')?.addEventListener('click', showLogin)
  }
}

async function signOut() {
  await supabase.auth.signOut()
  setUser(null)
}

// ── Login Modal ─────────────────────────────────────────────
function showLogin() {
  document.getElementById('loginModal').classList.remove('hidden')
  document.getElementById('emailInput')?.focus()
}
function hideLogin() {
  document.getElementById('loginModal').classList.add('hidden')
  showMsg('', '')
}

function showMsg(type, text) {
  const el = document.getElementById('authMsg')
  if (!text) { el.classList.add('hidden'); return }
  el.className = `msg msg-${type}`
  el.textContent = text
}

document.getElementById('closeModal').addEventListener('click', hideLogin)
document.getElementById('loginModal').addEventListener('click', e => {
  if (e.target === document.getElementById('loginModal')) hideLogin()
})
document.getElementById('loginBtn')?.addEventListener('click', showLogin)

// Email OTP flow
document.getElementById('sendOtpBtn').addEventListener('click', async () => {
  const email = document.getElementById('emailInput').value.trim()
  if (!email) return showMsg('error', 'Please enter your email.')
  const btn = document.getElementById('sendOtpBtn')
  btn.textContent = 'Sending…'; btn.disabled = true
  const { error } = await supabase.auth.signInWithOtp({ email })
  btn.textContent = 'Send OTP →'; btn.disabled = false
  if (error) return showMsg('error', error.message)
  showMsg('success', `OTP sent to ${email}`)
  document.getElementById('emailStep').style.display = 'none'
  document.getElementById('otpStep').style.display = 'block'
})

document.getElementById('verifyOtpBtn').addEventListener('click', async () => {
  const email = document.getElementById('emailInput').value.trim()
  const token = document.getElementById('otpInput').value.trim()
  if (!token) return showMsg('error', 'Enter the OTP.')
  const btn = document.getElementById('verifyOtpBtn')
  btn.textContent = 'Verifying…'; btn.disabled = true
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  btn.textContent = 'Verify & Sign In →'; btn.disabled = false
  if (error) return showMsg('error', error.message)
  hideLogin()
})

document.getElementById('backBtn').addEventListener('click', () => {
  document.getElementById('otpStep').style.display = 'none'
  document.getElementById('emailStep').style.display = 'block'
  showMsg('', '')
})

document.getElementById('githubBtn').addEventListener('click', async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.origin }
  })
  if (error) showMsg('error', error.message)
})

// ── Papers ──────────────────────────────────────────────────
let allPapers = []
let activeSubject = 'all'

async function loadPapers() {
  const { data, error } = await supabase
    .from('papers')
    .select('id, title, subject, year, paper_no, questions, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    document.getElementById('papersGrid').innerHTML =
      `<div class="empty-state">Failed to load papers. Check Supabase config.</div>`
    return
  }

  allPapers = data || []
  buildFilters()
  renderPapers()
}

function buildFilters() {
  const subjects = [...new Set(allPapers.map(p => p.subject))].sort()
  const bar = document.getElementById('filterBar')
  bar.innerHTML = `<div class="filter-chip active" data-subject="all">All</div>`
  subjects.forEach(s => {
    const chip = document.createElement('div')
    chip.className = 'filter-chip'
    chip.dataset.subject = s
    chip.textContent = s
    chip.addEventListener('click', () => setFilter(s))
    bar.appendChild(chip)
  })
  bar.querySelector('[data-subject="all"]').addEventListener('click', () => setFilter('all'))
}

function setFilter(subject) {
  activeSubject = subject
  document.querySelectorAll('.filter-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.subject === subject)
  })
  renderPapers()
}

function renderPapers() {
  const grid = document.getElementById('papersGrid')
  const filtered = activeSubject === 'all'
    ? allPapers
    : allPapers.filter(p => p.subject === activeSubject)

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state">No papers found. Upload some in the admin panel.</div>`
    return
  }

  grid.innerHTML = filtered.map(paper => {
    const qCount = Array.isArray(paper.questions) ? paper.questions.length : 0
    const yearLabel = paper.year ? `${paper.year}` : 'Practice'
    return `
      <div class="paper-card" data-id="${paper.id}" onclick="startExam('${paper.id}')">
        <div class="paper-tag">Paper ${paper.paper_no || 'I'} · ${yearLabel}</div>
        <div class="paper-title">${paper.title}</div>
        <div class="paper-meta">
          <span>📚 ${paper.subject}</span>
        </div>
        <div class="paper-footer">
          <div class="q-count"><strong>${qCount}</strong> questions</div>
          <button class="btn btn-primary btn-sm">Start Exam →</button>
        </div>
      </div>
    `
  }).join('')
}

window.startExam = (paperId) => {
  window.location.href = `exam.html?paper=${paperId}`
}

document.getElementById('browseBtn').addEventListener('click', () => {
  document.querySelector('.section').scrollIntoView({ behavior: 'smooth' })
})

// ── Init ────────────────────────────────────────────────────
initAuth()
loadPapers()