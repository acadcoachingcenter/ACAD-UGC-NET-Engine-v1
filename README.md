# UGC-NET Engine

A complete exam engine with admin upload portal, student exam interface, Supabase auth (Email OTP + GitHub), and Vercel deployment.

---

## 🗂 File Structure

```
ugc-net-engine/
├── index.html          # Student portal (browse papers)
├── exam.html           # Exam interface
├── admin.html          # Admin portal (upload questions, manage papers)
├── src/
│   ├── portal.js       # Student portal logic
│   └── app.js          # Exam engine logic
├── supabase-schema.sql # Run this in Supabase SQL Editor
├── vite.config.js
├── vercel.json
├── .env.example
└── package.json
```

---

## ⚡ Quick Setup

### 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) → your project
2. Open **SQL Editor** → paste contents of `supabase-schema.sql` → Run
3. Go to **Authentication → Providers**:
   - Enable **Email** (OTP mode — disable email confirmation, enable magic links)
   - Enable **GitHub** → create a GitHub OAuth App:
     - Homepage URL: your Vercel URL (fill after deploy, use `http://localhost:5173` for dev)
     - Callback URL: `https://your-project.supabase.co/auth/v1/callback`
4. Copy your **Project URL** and **anon public key** from Settings → API

### 2. Environment

```bash
cp .env.example .env
# Fill in your values:
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Make yourself an admin

After signing in once (creates your profile), run in Supabase SQL Editor:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'you@example.com';
```

### 4. Local Development

```bash
npm install
npm run dev
```

---

## 🚀 Vercel Deployment

**IMPORTANT**: Follow your existing deploy process exactly:

```bash
# 1. Delete .vercel folder if it exists
rmdir /s /q .vercel     # Windows
rm -rf .vercel          # Mac/Linux

# 2. Build first (optional, Vercel builds automatically)
npm run build

# 3. Deploy — creates new project
vercel

# When prompted:
# - Link to existing project? → NO
# - Project name: acad-net-v1 (or v2, v3...)
# - Framework: Vite (auto-detected)
# - Connect GitHub? → NO
```

### Add env vars on Vercel

After first deploy, go to **Vercel → Project → Settings → Environment Variables** and add:
```
VITE_SUPABASE_URL = https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY = your-anon-key
```

Then redeploy: `vercel`

### Update GitHub OAuth redirect URL

After deploy, update your GitHub OAuth App's Homepage and Vercel URL → Supabase Auth → GitHub → add `https://your-vercel-url.vercel.app` to **Redirect URLs**.

---

## 📝 Question Format

### JSON (recommended)

```json
[
  {
    "id": 1,
    "text": "Which of the following is a non-deterministic algorithm?",
    "opts": ["Binary Search", "Bubble Sort", "Randomized Quicksort", "Merge Sort"],
    "ans": 2,
    "exp": "Randomized Quicksort uses random pivot selection, making it non-deterministic.",
    "subject": "Computer Science",
    "type": "mcq"
  }
]
```

**Fields:**
- `id` — unique identifier (number)
- `text` — question text (HTML supported)
- `opts` — array of option strings
- `ans` — **zero-based index** of correct option (0=A, 1=B, 2=C, 3=D)
- `exp` — explanation (optional)
- `subject` — subject tag (optional, defaults to paper subject)
- `type` — `"mcq"` or `"integer"` (for numerical answer questions)

### Integer Type Questions

```json
{
  "id": 5,
  "text": "How many edges does a complete graph K5 have?",
  "opts": ["(option not provided)"],
  "ans": 10,
  "type": "integer"
}
```

### Plain Text Format (for Bulk Parser)

```
1. Which of the following data structures uses LIFO?
(A) Queue  (B) Stack  (C) Linked List  (D) Tree
Answer: B
Explanation: Stack follows Last In First Out principle.

2. The time complexity of binary search is?
(A) O(n)  (B) O(n²)  (C) O(log n)  (D) O(n log n)
Answer: C
```

---

## 🔐 Auth Flow

- **Email OTP**: Enter email → receive 6-digit OTP → verify → logged in
- **GitHub OAuth**: One-click OAuth → redirects back → logged in
- **Admin check**: After login, app checks `profiles.role = 'admin'` in Supabase
- **Non-admin users** see a message to contact the admin

---

## 🎯 UGC-NET Exam Config

- Papers can be Paper I (General Aptitude), Paper II (Subject-specific), or Paper III
- Each paper is stored as a JSONB array in the `papers` table
- No separate questions table — same pattern as your ACAD NEET Engine

---

## 📤 Uploading Your 150 Questions

1. Format as JSON array (use the **Bulk Parser** tool in admin if they're in plain text)
2. Go to `admin.html` → sign in → Upload Questions
3. Fill in Paper Title, Subject, Year
4. Paste JSON in the JSON Array tab → Parse & Preview
5. Review the preview table (check for errors)
6. Click **Upload to Supabase**
