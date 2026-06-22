import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) return new NextResponse('WHOOP auth error: ' + error, { status: 400 })
  if (!code) return new NextResponse('Missing code parameter.', { status: 400 })

  const clientId = process.env.WHOOP_CLIENT_ID
  const clientSecret = process.env.WHOOP_CLIENT_SECRET
  const redirectUri = process.env.WHOOP_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return new NextResponse('Server not configured (missing WHOOP_* env vars).', { status: 500 })
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    })

    const tokenRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    const text = await tokenRes.text()
    if (!tokenRes.ok) return new NextResponse('WHOOP token exchange failed: ' + text, { status: 500 })

    let json: { access_token?: string; refresh_token?: string; expires_in?: number }
    try { json = JSON.parse(text) } catch { return new NextResponse('Non-JSON: ' + text, { status: 500 }) }

    const access = json.access_token || ''
    const refresh = json.refresh_token || ''
    const expiresIn = json.expires_in || 3600
    const expiresAt = Date.now() + expiresIn * 1000

    // Persist tokens server-side so cron jobs can use them
    await supabase.from('whoop_tokens').upsert({
      id: 1,
      access_token: access,
      refresh_token: refresh,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })

    // Pass tokens to client via URL hash so they land in localStorage
    const hash = new URLSearchParams({
      whoop_access: access,
      whoop_refresh: refresh,
      whoop_expires: String(expiresAt),
    }).toString()

    return NextResponse.redirect(new URL('/?connected=1#' + hash, req.url))
  } catch (e) {
    return new NextResponse('Unexpected: ' + (e instanceof Error ? e.message : String(e)), { status: 500 })
  }
}
