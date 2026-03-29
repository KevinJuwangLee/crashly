import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://mfvyjksetlmzfxrviadq.supabase.co'
export const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mdnlqa3NldGxtemZ4cnZpYWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDkyNzAsImV4cCI6MjA5MDI4NTI3MH0.jHXUbbZ85beSAMpXjaVqLGnL__27CbkJDIkdBJfZ6cU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)