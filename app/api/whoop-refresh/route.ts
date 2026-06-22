import { NextRequest, NextResponse } from 'next/server'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  let body: { refresh_token?: string } = {}
  try { body = await req.json() } catch { /* empty body */ }

  const refresh = body?.refresh_token
  if (!refresh) return NextResponse.json({ error: 'refresh_token required' }, { status: 400, headers: CORS })

  const clientId = process.env.WHOOP_CLIENT_ID
  const clientSecret = process.env.WHOOP_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'server not configured' }, { status: 500, headers: CORS })
  }

  try {
    const form = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'offline',
    })
    const r = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    const text = await r.text()
    if (!r.ok) return NextResponse.json({ error: 'refresh failed: ' + text }, { status: 500, headers: CORS })
    return NextResponse.json(JSON.parse(text), { headers: CORS })
  } catch (e) {
    return NextResponse.json(
      { error: 'fetch error: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 500, headers: CORS }
    )
  }
}
