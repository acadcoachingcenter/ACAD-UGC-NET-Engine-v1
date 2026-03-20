/**
 * parse-questions.js
 * ------------------
 * Parses the UGC-NET question docx (copy-pasted as .txt) into
 * upload-ready JSON for the UGC-NET Engine admin portal.
 *
 * Usage:
 *   node parse-questions.js questions.txt
 *
 * Output:
 *   questions.json  — paste into admin → JSON Array tab
 *
 * Expected input format:
 *   Q1. Which of the following...
 *   (A)  Option text
 *   (B)  Option text
 *   (C)  Option text
 *   (D)  Option text
 *   Correct Answer: (C) Speculative
 *   Explanation: Full explanation text here.
 *
 * Options can be on one line or multiple lines — both handled.
 * Section headers (PAPER I, PAPER II, Q1 to Q50 etc.) are auto-skipped.
 */

import fs from 'fs'
import path from 'path'

// ── Config ────────────────────────────────────────────────────────────────────
const SUBJECT_MAP = {
  1:  { paper: 1, subject: 'General' },   // Q1–Q50: Paper I
  51: { paper: 2, subject: 'Computer Science' }, // Q51–Q150: Paper II
}

function getSubjectForQNum(n) {
  if (n >= 51)  return SUBJECT_MAP[51]
  return SUBJECT_MAP[1]
}

// ── Parser ────────────────────────────────────────────────────────────────────
function parse(raw) {
  const questions = []
  const errors = []

  // Normalise line endings, collapse blank lines to single blank
  const lines = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')

  let i = 0

  // Helper: skip non-question lines (headers, instructions, blank)
  function isHeaderLine(line) {
    const l = line.trim()
    if (!l) return true
    if (/^(PAPER\s+(I+|II+|III+)|General Instructions|Questions\s+\d+\s+to\s+\d+|All questions|Each question|Read each|•)/i.test(l)) return true
    return false
  }

  while (i < lines.length) {
    const line = lines[i].trim()

    // Match question start: Q1. or Q1) or 1. (with optional bold markers)
    const qMatch = line.match(/^Q?(\d+)[.)]\s+(.+)/)
    if (!qMatch) { i++; continue }

    const qNum = parseInt(qMatch[1])
    let qText = qMatch[2].trim()

    // Question text may continue on next lines until we hit (A)
    i++
    while (i < lines.length) {
      const next = lines[i].trim()
      if (/^\([A-E]\)/i.test(next) || /^Correct Answer/i.test(next)) break
      if (!next || isHeaderLine(next)) break
      qText += ' ' + next
      i++
    }

    // ── Parse options ──────────────────────────────────────────────────────
    const opts = []
    // Options may be on one line: (A) foo  (B) bar  (C) baz  (D) qux
    // or on separate lines: (A)\n foo\n(B)\n bar
    while (i < lines.length && opts.length < 4) {
      const ol = lines[i].trim()
      if (!ol) { i++; continue }

      // Check if this line has multiple options inline
      const inlineMatches = [...ol.matchAll(/\(([A-D])\)\s+([^(]+?)(?=\s*\([A-D]\)|$)/gi)]
      if (inlineMatches.length >= 2) {
        inlineMatches.forEach(m => opts.push(m[2].trim()))
        i++
        break
      }

      // Single option on this line
      const singleOpt = ol.match(/^\(([A-D])\)\s*(.*)$/i)
      if (singleOpt) {
        let optText = singleOpt[2].trim()
        // Option text may spill onto next line
        i++
        while (i < lines.length) {
          const nxt = lines[i].trim()
          if (!nxt || /^\([A-D]\)/i.test(nxt) || /^Correct Answer/i.test(nxt)) break
          optText += ' ' + nxt
          i++
        }
        opts.push(optText)
        continue
      }

      // Not an option line and not a correct-answer line → stop
      if (!/^Correct Answer/i.test(ol)) { i++ }
      break
    }

    // ── Parse correct answer ───────────────────────────────────────────────
    let ansIdx = null
    while (i < lines.length) {
      const al = lines[i].trim()
      if (!al) { i++; continue }
      const ansMatch = al.match(/^Correct Answer\s*:\s*\(([A-D])\)/i)
      if (ansMatch) {
        ansIdx = ansMatch[1].toUpperCase().charCodeAt(0) - 65 // A→0, B→1…
        i++
        break
      }
      // If we've passed the options and haven't found it, stop looking
      if (opts.length && !/^\([A-D]\)/i.test(al)) break
      i++
    }

    // ── Parse explanation ──────────────────────────────────────────────────
    let expText = ''
    while (i < lines.length) {
      const el = lines[i].trim()
      if (!el) { i++; continue }
      const expMatch = el.match(/^Explanation\s*:\s*(.*)$/i)
      if (expMatch) {
        expText = expMatch[1].trim()
        i++
        // Explanation may span multiple lines
        while (i < lines.length) {
          const nxt = lines[i].trim()
          if (!nxt || /^Q?\d+[.)]/i.test(nxt) || /^PAPER/i.test(nxt)) break
          expText += ' ' + nxt
          i++
        }
        break
      }
      break
    }

    // ── Validate & push ────────────────────────────────────────────────────
    if (!qText) { errors.push(`Q${qNum}: missing question text`); continue }
    if (opts.length < 4) { errors.push(`Q${qNum}: only ${opts.length} options found (need 4)`) }
    if (ansIdx === null) { errors.push(`Q${qNum}: no correct answer found`) }

    const { paper, subject } = getSubjectForQNum(qNum)

    questions.push({
      id:      qNum,
      text:    qText,
      type:    'mcq',
      opts:    opts,
      ans:     ansIdx ?? 0,
      exp:     expText,
      subject: subject,
      paper:   paper,
    })
  }

  return { questions, errors }
}

// ── CLI runner ────────────────────────────────────────────────────────────────
const inputFile = process.argv[2]
if (!inputFile) {
  console.error('Usage: node parse-questions.js <input.txt>')
  console.error('  Save your Word doc as plain text (.txt) first,')
  console.error('  or copy-paste all content into a .txt file.')
  process.exit(1)
}

const raw = fs.readFileSync(inputFile, 'utf8')
const { questions, errors } = parse(raw)

// Summary
console.log(`\n✓ Parsed ${questions.length} questions`)
if (errors.length) {
  console.log(`\n⚠  ${errors.length} warning(s):`)
  errors.forEach(e => console.log('  ' + e))
} else {
  console.log('  No errors — all questions valid!')
}

// Split by paper for convenience
const paper1 = questions.filter(q => q.paper === 1)
const paper2 = questions.filter(q => q.paper === 2)
console.log(`\n  Paper I  (General): ${paper1.length} questions`)
console.log(`  Paper II (CS):      ${paper2.length} questions`)

// Write output files
const outAll  = inputFile.replace(/\.(txt|docx?)$/i, '') + '-all.json'
const outP1   = inputFile.replace(/\.(txt|docx?)$/i, '') + '-paper1.json'
const outP2   = inputFile.replace(/\.(txt|docx?)$/i, '') + '-paper2.json'

fs.writeFileSync(outAll,  JSON.stringify(questions, null, 2))
fs.writeFileSync(outP1,   JSON.stringify(paper1,    null, 2))
fs.writeFileSync(outP2,   JSON.stringify(paper2,    null, 2))

console.log(`\n📄 Output files:`)
console.log(`  ${outAll}   ← all 150 questions`)
console.log(`  ${outP1}  ← Paper I only (Q1–Q50)`)
console.log(`  ${outP2}  ← Paper II only (Q51–Q150)`)
console.log(`\nNext: paste contents of either JSON file into admin → Upload Questions → JSON Array tab.\n`)
