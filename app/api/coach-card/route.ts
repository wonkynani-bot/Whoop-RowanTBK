import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const SYSTEM_PROMPT = `You are a personal performance coach for a 24-year-old male optimizing testosterone naturally. Permanent context — baseline labs: Total T 561 ng/dL, Free T 110.7 pg/mL, AM Cortisol 7.0 mcg/dL (low-normal), DHEA-S 228, Estradiol 30, hsCRP 0.2, HbA1c 5.4, Active Vitamin D slightly above range (reducing D3 dosage), SHBG unknown (testing soon). Current protocol: strength training 3-4x/week, 1g protein/lb bodyweight, animal fats, no seed oils, organ meats/liver weekly, 5g creatine daily, tongkat ali, magnesium glycinate, zinc, boron, consistent sleep at 67F dark room, morning sunlight 10+ min, no plastics, natural fabrics. Goal: maximize testosterone naturally through lifestyle.
Given the Whoop data and food logs for the last 7 days, output exactly:
Line 1: TRAIN HEAVY / TRAIN MODERATE / TRAIN LIGHT / REST — one sentence why.
Line 2: DO THIS TODAY: one specific action based on the data.
Line 3: FOOD NOTE: one observation about nutrition based on logs, skip if no food data.
Line 4: FLAG: one genuine concern only if something warrants it, otherwise write NONE.
Max 5 sentences total. Direct, no fluff.`

async function generateCard() {
  const today = new Date().toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [{ data: whoopRows }, { data: foodRows }] = await Promise.all([
    supabase.from('whoop_data').select('*').order('date', { ascending: false }).limit(7),
    supabase.from('food_logs').select('*').gte('date', sevenDaysAgo).order('date', { ascending: false }),
  ])

  const whoopSummary = whoopRows?.length
    ? whoopRows.map(r =>
        `${r.date}: recovery=${r.recovery_score ?? '—'}%, hrv=${r.hrv ?? '—'}ms, sleep=${r.sleep_score ?? '—'}%, strain=${r.strain ?? '—'}, resp=${r.respiratory_rate ?? '—'}rpm`
      ).join('\n')
    : 'No Whoop data available.'

  const foodSummary = foodRows?.length
    ? foodRows.map(r =>
        `${r.date} ${r.meal_name}: ${r.calories ?? '?'}kcal, P${r.protein ?? '?'}g C${r.carbs ?? '?'}g F${r.fats ?? '?'}g${r.notes ? ' — ' + r.notes : ''}`
      ).join('\n')
    : 'No food logs available.'

  const userMessage = `Whoop data (last 7 days):\n${whoopSummary}\n\nFood logs (last 7 days):\n${foodSummary}`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })
  const brief = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''

  const { error: upsertErr } = await supabase.from('coach_cards').upsert({
    date: today,
    whoop_summary: whoopRows ?? [],
    food_summary: foodRows ?? [],
    brief,
  }, { onConflict: 'date' })

  if (upsertErr) throw new Error('Supabase upsert failed: ' + upsertErr.message)

  return { date: today, brief }
}

// Called by Vercel cron — requires CRON_SECRET
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const result = await generateCard()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// Called by the Generate now button — no auth needed for personal app
export async function POST() {
  try {
    const result = await generateCard()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
