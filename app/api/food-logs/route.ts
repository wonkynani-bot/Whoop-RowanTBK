import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCoachDate } from '@/lib/coach-date'

export async function POST(req: NextRequest) {
  let body: {
    meal_name?: string
    protein?: number | null
    carbs?: number | null
    fats?: number | null
    calories?: number | null
    notes?: string | null
    date?: string
  } = {}

  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  if (!body.meal_name?.trim()) {
    return NextResponse.json({ error: 'meal_name is required' }, { status: 400 })
  }

  const today = body.date ?? await getCoachDate()

  const { data, error } = await supabase.from('food_logs').insert({
    date: today,
    meal_name: body.meal_name.trim(),
    protein: body.protein ?? null,
    carbs: body.carbs ?? null,
    fats: body.fats ?? null,
    calories: body.calories ?? null,
    notes: body.notes?.trim() || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function GET() {
  const today = await getCoachDate()
  const { data, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('date', today)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
