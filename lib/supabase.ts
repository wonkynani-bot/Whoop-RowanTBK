import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

// Server-side client using service role key — never expose to browser
export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    if (!url || !key) throw new Error('Supabase env vars not configured.')
    _client = createClient(url, key)
  }
  return _client
}

// Convenience proxy so callers can still write `supabase.from(...)`
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export interface WhoopToken {
  id: number
  access_token: string
  refresh_token: string
  expires_at: number
  updated_at: string
}

export interface WhoopData {
  id: number
  date: string
  hrv: number | null
  recovery_score: number | null
  sleep_score: number | null
  strain: number | null
  respiratory_rate: number | null
  created_at: string
}

export interface FoodLog {
  id: number
  date: string
  meal_name: string
  protein: number | null
  carbs: number | null
  fats: number | null
  calories: number | null
  notes: string | null
  created_at: string
}

export interface CoachCard {
  id: number
  date: string
  whoop_summary: Record<string, unknown> | null
  food_summary: Record<string, unknown> | null
  brief: string
  created_at: string
}
