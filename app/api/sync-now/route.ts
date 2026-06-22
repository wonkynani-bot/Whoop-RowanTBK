import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchTodayMetrics, refreshWhoopToken } from '@/lib/whoop'

export async function POST() {
  // Step 1: load tokens
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('whoop_tokens')
    .select('*')
    .eq('id', 1)
    .single()

  if (tokenErr || !tokenRow) {
    return NextResponse.json(
      { error: 'No WHOOP tokens found in database. Re-connect your WHOOP account.', step: 'load_tokens', detail: tokenErr?.message },
      { status: 400 }
    )
  }

  let { access_token, refresh_token, expires_at } = tokenRow

  // Step 2: refresh if expiring within 60s
  if (Date.now() > expires_at - 60_000) {
    try {
      const fresh = await refreshWhoopToken(refresh_token)
      access_token = fresh.access_token
      refresh_token = fresh.refresh_token
      expires_at = Date.now() + fresh.expires_in * 1000
      await supabase.from('whoop_tokens').upsert({
        id: 1, access_token, refresh_token, expires_at,
        updated_at: new Date().toISOString(),
      })
    } catch (e) {
      return NextResponse.json(
        { error: 'Token refresh failed — WHOOP may need to be re-connected.', step: 'refresh_token', detail: e instanceof Error ? e.message : String(e) },
        { status: 500 }
      )
    }
  }

  // Step 3: fetch metrics from WHOOP API
  let metrics
  try {
    metrics = await fetchTodayMetrics(access_token)
  } catch (e) {
    return NextResponse.json(
      { error: 'WHOOP API request failed.', step: 'fetch_metrics', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    )
  }

  const today = new Date().toISOString().slice(0, 10)

  // Step 4: save to Supabase
  const { error: upsertErr } = await supabase
    .from('whoop_data')
    .upsert({ date: today, ...metrics }, { onConflict: 'date' })

  if (upsertErr) {
    return NextResponse.json(
      { error: 'Failed to save data.', step: 'save_data', detail: upsertErr.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, date: today, metrics })
}
