import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchTodayMetrics, refreshWhoopToken } from '@/lib/whoop'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Load stored tokens
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('whoop_tokens')
    .select('*')
    .eq('id', 1)
    .single()

  if (tokenErr || !tokenRow) {
    return NextResponse.json({ error: 'No Whoop tokens stored — connect your account first.' }, { status: 400 })
  }

  let { access_token, refresh_token, expires_at } = tokenRow

  // Refresh if expiring within 60 seconds
  if (Date.now() > expires_at - 60_000) {
    try {
      const fresh = await refreshWhoopToken(refresh_token)
      access_token = fresh.access_token
      refresh_token = fresh.refresh_token
      expires_at = Date.now() + fresh.expires_in * 1000
      await supabase.from('whoop_tokens').upsert({
        id: 1,
        access_token,
        refresh_token,
        expires_at,
        updated_at: new Date().toISOString(),
      })
    } catch (e) {
      return NextResponse.json(
        { error: 'Token refresh failed: ' + (e instanceof Error ? e.message : String(e)) },
        { status: 500 }
      )
    }
  }

  // Fetch today's metrics from Whoop
  let metrics
  try {
    metrics = await fetchTodayMetrics(access_token)
  } catch (e) {
    return NextResponse.json(
      { error: 'Whoop fetch failed: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    )
  }

  const today = new Date().toISOString().slice(0, 10)

  const { error: upsertErr } = await supabase.from('whoop_data').upsert({
    date: today,
    ...metrics,
  }, { onConflict: 'date' })

  if (upsertErr) {
    return NextResponse.json({ error: 'Supabase upsert failed: ' + upsertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, date: today, metrics })
}
