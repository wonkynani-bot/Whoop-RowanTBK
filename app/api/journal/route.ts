import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('date', today)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? null)
}

export async function POST(req: NextRequest) {
  let body: { content?: string } = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('journal_entries')
    .upsert(
      { date: today, content: body.content ?? '', updated_at: new Date().toISOString() },
      { onConflict: 'date' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
