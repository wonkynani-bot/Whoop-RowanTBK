import { NextRequest, NextResponse } from 'next/server'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'missing bearer token' }, { status: 401, headers: CORS })
  }

  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path') || ''
  if (!path || !path.startsWith('/')) {
    return NextResponse.json({ error: 'path required' }, { status: 400, headers: CORS })
  }

  const fwd = new URLSearchParams()
  searchParams.forEach((v, k) => { if (k !== 'path') fwd.set(k, v) })
  const qs = fwd.toString()

  const base = path.startsWith('/cycle')
    ? 'https://api.prod.whoop.com/developer/v1'
    : 'https://api.prod.whoop.com/developer/v2'
  const url = base + path + (qs ? '?' + qs : '')

  try {
    const r = await fetch(url, {
      headers: { Authorization: auth, Accept: 'application/json' },
    })
    const text = await r.text()
    return new NextResponse(text, {
      status: r.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'proxy fetch failed: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 500, headers: CORS }
    )
  }
}
