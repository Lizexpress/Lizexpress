import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Profile {
  id: string
  full_name?: string | null
  avatar_url?: string | null
  residential_address?: string | null
  date_of_birth?: string | null
  language?: string | null
  gender?: string | null
  country?: string | null
  state?: string | null
  zip_code?: string | null
  nationality?: string | null
  is_verified?: boolean
  verification_submitted?: boolean
  profile_completed?: boolean
  created_at?: string
  updated_at?: string
}