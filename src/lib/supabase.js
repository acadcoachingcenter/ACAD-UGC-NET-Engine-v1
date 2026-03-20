import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = window.__ENV?.SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = window.__ENV?.SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
