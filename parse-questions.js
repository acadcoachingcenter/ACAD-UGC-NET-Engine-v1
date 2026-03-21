/**
 * parse-questions.js — UGC-NET Engine
 *
 * Handles ALL these option formats:
 *   (A) text        ← one per line with brackets
 *   A. text         ← one per line with dot
 *   A. x B. y C. z D. w   ← all four inline with dot
 *   (A) x (B) y (C) z (D) w ← all four inline with brackets
 *
 * Usage: node parse-questions.js questions.txt
 */

import fs from 'fs'

function getSubject(n) {
  if (n >= 51) return { paper: 2, subject: 'Computer Science' }
  return { paper: 1, subject: 'General' }
}

function parse(raw) {
  const questions = []
  const errors = []
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const total = lines.length
  let i = 0

  const isQuestionLine    = l => /^Q?\d+[.)]\s+\S/.test(l)
  const isAnswerLine      = l => /^(correct\s+answer|answer)\s*:/i.test(l)
  const isExplanationLine = l => /^explanation\s*:/i.test(l)
  const isSkipLine        = l => !l || /^(PAPER\s+(I+|II+)|General Instructions|Questions\s+\d+\s+to|All questions|Each question|Read each|•)/i.test(l)

  // Matches option start: (A) or A. at beginning of string
  const isOptionLine = l => /^(\([A-D]\)|[A-D]\.)\s*/i.test(l)

  // Parse options from one line: "A. x B. y C. z D. w" or "(A) x (B) y"
  function parseInlineOptions(line) {
    // "A. text B. text C. text D. text" — split on letter+dot boundary
    if (/\b[A-D]\./i.test(line)) {
      const parts = line.split(/\s+(?=[A-D]\.)/i)
        .map(p => p.replace(/^[A-D]\.\s*/i, '').trim())
        .filter(Boolean)
      if (parts.length >= 2) return parts
    }
    // "(A) text (B) text" bracket format
    const bm = [...line.matchAll(/\(([A-D])\)\s+([^(]+?)(?=\s*\([A-D]\)|$)/gi)]
    if (bm.length >= 2) return bm.map(m => m[2].trim())
    return null
  }

  while (i < total) {
    const line = lines[i].trim()
    if (isSkipLine(line) || !isQuestionLine(line)) { i++; continue }

    // ── Question text ────────────────────────────────────────────────────
    const qMatch = line.match(/^Q?(\d+)[.)]\s+(.+)/)
    const qNum = parseInt(qMatch[1])
    let qText = qMatch[2].trim()
    i++

    // Question may continue on next lines
    while (i < total) {
      const nxt = lines[i].trim()
      if (!nxt || isOptionLine(nxt) || isAnswerLine(nxt) || isQuestionLine(nxt)) break
      qText += ' ' + nxt
      i++
    }

    // ── Options ──────────────────────────────────────────────────────────
    const opts = []
    while (i < total && !lines[i].trim()) i++  // skip blanks

    while (i < total && opts.length < 4) {
      const ol = lines[i].trim()
      if (!ol || isAnswerLine(ol) || isQuestionLine(ol)) break

      // Try parsing all 4 options from one line
      const inline = parseInlineOptions(ol)
      if (inline && inline.length >= 2) {
        inline.forEach(o => opts.push(o))
        i++; break
      }

      // Single option: (A) text OR A. text
      const single = ol.match(/^(?:\(([A-D])\)|([A-D])\.)\s*(.*)$/i)
      if (single) {
        let optText = (single[3] || '').trim()
        i++
        // Option text may spill to next line
        while (i < total) {
          const nxt = lines[i].trim()
          if (!nxt || isOptionLine(nxt) || isAnswerLine(nxt) || isQuestionLine(nxt)) break
          optText += ' ' + nxt
          i++
        }
        opts.push(optText)
        continue
      }

      // Not an option line — stop without advancing
      break
    }

    // ── Correct Answer ───────────────────────────────────────────────────
    while (i < total && !lines[i].trim()) i++
    let ansIdx = null
    if (i < total && isAnswerLine(lines[i].trim())) {
      const al = lines[i].trim()
      // Match (C) or just C
      const ansMatch = al.match(/\(([A-D])\)|:\s*([A-D])\b/i)
      if (ansMatch) {
        const letter = (ansMatch[1] || ansMatch[2]).toUpperCase()
        ansIdx = letter.charCodeAt(0) - 65  // A→0 B→1 C→2 D→3
      }
      i++
    }

    // ── Explanation ──────────────────────────────────────────────────────
    while (i < total && !lines[i].trim()) i++
    let expText = ''
    if (i < total && isExplanationLine(lines[i].trim())) {
      expText = lines[i].trim().replace(/^explanation\s*:\s*/i, '').trim()
      i++
      while (i < total) {
        const nxt = lines[i].trim()
        if (!nxt || isQuestionLine(nxt) || isAnswerLine(nxt)) break
        expText += ' ' + nxt
        i++
      }
    }

    // ── Validate & push ──────────────────────────────────────────────────
    if (!qText) { errors.push(`Q${qNum}: missing text — skipped`); continue }
    if (opts.length < 4) errors.push(`Q${qNum}: only ${opts.length} option(s) found — check format`)
    if (ansIdx === null)  errors.push(`Q${qNum}: no correct answer found`)

    const { paper, subject } = getSubject(qNum)
    questions.push({
      id: qNum, text: qText, type: 'mcq',
      opts, ans: ansIdx ?? 0,
      exp: expText, subject, paper
    })
  }

  return { questions, errors }
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const inputFile = process.argv[2]
if (!inputFile) {
  console.error('\nUsage: node parse-questions.js <questions.txt>\n')
  process.exit(1)
}
if (!fs.existsSync(inputFile)) {
  console.error(`\nFile not found: ${inputFile}\n`)
  process.exit(1)
}

const raw = fs.readFileSync(inputFile, 'utf8')
const { questions, errors } = parse(raw)

console.log(`\n✓ Parsed ${questions.length} questions`)
if (errors.length) {
  console.log(`\n⚠  ${errors.length} issue(s):`)
  errors.forEach(e => console.log('   • ' + e))
} else {
  console.log('  No errors!')
}

const paper1 = questions.filter(q => q.paper === 1)
const paper2 = questions.filter(q => q.paper === 2)
console.log(`\n  Paper I  (General):          ${paper1.length} questions`)
console.log(`  Paper II (Computer Science): ${paper2.length} questions`)

// Preview first 3
console.log('\n── Preview (first 3 questions) ──────────────')
questions.slice(0, 3).forEach(q => {
  const L = ['A','B','C','D']
  console.log(`\nQ${q.id}. ${q.text}`)
  q.opts.forEach((o, j) => console.log(`  ${j === q.ans ? '✓' : ' '} ${L[j]}. ${o}`))
  if (q.exp) console.log(`  Exp: ${q.exp.slice(0,80)}${q.exp.length>80?'…':''}`)
})
console.log('\n─────────────────────────────────────────────')

const base = inputFile.replace(/\.(txt|docx?)$/i, '')
fs.writeFileSync(base + '-all.json',    JSON.stringify(questions, null, 2))
fs.writeFileSync(base + '-paper1.json', JSON.stringify(paper1,    null, 2))
fs.writeFileSync(base + '-paper2.json', JSON.stringify(paper2,    null, 2))

console.log(`\n📄 Files written:`)
console.log(`   ${base}-all.json`)
console.log(`   ${base}-paper1.json`)
console.log(`   ${base}-paper2.json`)
console.log(`\n👉 Paste paper1.json and paper2.json separately into:`)
console.log(`   admin panel → Upload Questions → JSON Array tab\n`)
