import { supabase } from './supabase'

// Returns the "coach day" date (YYYY-MM-DD) based on WHOOP sleep data.
// If the UTC clock says June 23 but the user hasn't woken up yet (no wake_time
// stored for June 23), we return June 22. Falls back to a 10am UTC cutoff
// (covers up to ~6am ET) when no WHOOP row exists for the clock date.
export async function getCoachDate(): Promise<string> {
  const now = new Date()
  const clockDate = now.toISOString().slice(0, 10)

  try {
    const { data } = await supabase
      .from('whoop_data')
      .select('wake_time')
      .eq('date', clockDate)
      .single()

    if (data?.wake_time) {
      return clockDate
    }
  } catch {
    // PGRST116 = no row — that's expected, fall through
  }

  // No synced data for clock date → check if we're still in pre-wake hours
  if (now.getUTCHours() < 10) {
    const yesterday = new Date(now)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    return yesterday.toISOString().slice(0, 10)
  }

  return clockDate
}
