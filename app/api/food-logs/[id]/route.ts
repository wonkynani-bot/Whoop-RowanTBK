import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params
  const id = parseInt(rawId, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (body.meal_name  !== undefined) update.meal_name  = body.meal_name
  if (body.calories   !== undefined) update.calories   = body.calories
  if (body.protein    !== undefined) update.protein    = body.protein
  if (body.carbs      !== undefined) update.carbs      = body.carbs
  if (body.fats       !== undefined) update.fats       = body.fats
  if (body.notes      !== undefined) update.notes      = body.notes
  if (body.date       !== undefined) update.date       = body.date

  const { data, error } = await supabase
    .from('food_logs')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params
  const id = parseInt(rawId, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  const { error } = await supabase.from('food_logs').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
