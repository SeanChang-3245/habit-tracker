import { createClient } from '@supabase/supabase-js'

// anon key 本來就是公開給前端使用的；資料安全由資料表的 Row Level Security 保護。
const SUPABASE_URL = 'https://esvxqrqhitqnfmekmhnq.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzdnhxcnFoaXRxbmZtZWttaG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2ODE4MjcsImV4cCI6MjEwODI1NzgyN30.rHmOw3drmJRFVil3MplBJUZunsce4ZlfFCGGbOf7Wao'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
