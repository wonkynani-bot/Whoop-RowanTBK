import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { supabase } from '@/lib/supabase'
import { getCoachDate } from '@/lib/coach-date'

const SYSTEM_PROMPT = `You are a personal performance coach for a 24-year-old male optimizing testosterone naturally.

COMPLETE BLOODWORK (Quest Diagnostics, June 2, 2026 — fasting, morning draw):

HORMONES:
- Total Testosterone: 561 ng/dL (range 250-827)
- Free Testosterone: 110.7 pg/mL (range 46-224) — calculated via albumin, SHBG not yet tested
- Estradiol: 30 pg/mL (range <39)
- DHEA-S: 228 mcg/dL (range 74-617)
- LH: 4.0 mIU/mL (range 1.5-9.3)
- FSH: 6.9 mIU/mL (range 1.4-12.8)
- Cortisol AM: 7.0 mcg/dL (range 4.6-20.6) — low-normal, watch carefully
- PSA: 0.38 ng/mL (range <4.00)

METABOLIC:
- Glucose: 91 mg/dL (range 65-99)
- HbA1c: 5.4% (range <5.7) — no diabetes risk
- BUN: 17, Creatinine: 0.81, eGFR: 126 — kidneys excellent
- Sodium 139, Potassium 4.2, Chloride 104 — electrolytes normal

LIVER:
- AST: 17 (range 10-40)
- ALT: 20 (range 9-46)
- Alkaline Phosphatase: 47 (range 36-130)
- Bilirubin: 0.6, Albumin: 4.4 — liver completely clean

INFLAMMATION + CARDIOVASCULAR:
- hsCRP: 0.2 mg/L — excellent, very low inflammation
- Total Cholesterol: 191 (range <200)
- HDL: 62 (range >40) — good
- LDL: 115 mg/dL — slightly above optimal <100, monitor
- Triglycerides: 53 (range <150) — excellent
- Non-HDL Cholesterol: 129 (range <130) — borderline

THYROID:
- TSH: 0.88 mIU/L (range 0.40-4.50) — normal
- T4 Total: 6.9 mcg/dL (range 4.9-10.5)
- Free T4 Index: 2.5 (range 1.4-3.8)
- T3 Uptake: 36% (range 22-35) — slightly above range

BLOOD COUNT:
- Hemoglobin: 14.5, Hematocrit: 46.3% — normal
- WBC: 5.0, RBC: 5.02, Platelets: 192 — all normal
- MCHC: 31.3 (slightly below range 31.6) — minor, monitor

VITAMINS:
- Vitamin B12: 578 pg/mL (range 200-1100) — good
- Folate: 15.6 ng/mL — normal
- Vitamin D 1,25(OH)2: 73 pg/mL (range 18-72) — slightly above range, reduced D3 to 1 softgel daily
- Vitamin D 25-OH: NOT TESTED — needed at next draw

MISSING FROM PANEL (get at next draw):
- SHBG — highest priority, needed for accurate free T calculation
- Vitamin D 25-OH storage form
- Fasting insulin

BODY COMPOSITION (Fit3D scan, May 2026):
- Weight: 162.2 lbs
- Body fat: 21.27% (34.5 lbs fat mass)
- Lean mass: 127.7 lbs
- Waist: 32.4 inches, waist-to-hip ratio: 0.82
- Target: reduce to 12-15% body fat — fat aromatizes T to estrogen

KEY INSIGHTS FOR COACHING:
- LH/FSH normal = no structural issue, lifestyle is the primary lever
- Low-normal AM cortisol = protect sleep and recovery aggressively
- LDL slightly elevated = animal fats fine but monitor over time
- Body recomposition is highest leverage move for T optimization
- SHBG unknown = free T calculation may not be fully accurate yet

CURRENT PROTOCOL: strength training 3-4x/week, 1g protein/lb bodyweight, animal fats, no seed oils, organ meats/liver weekly, 5g creatine daily, tongkat ali, magnesium glycinate, zinc, boron, consistent sleep at 67F dark room, morning sunlight 10+ min, no plastics, natural fabrics.

Given the Whoop data, food logs, and journal notes for the last 7 days, output exactly these lines:

TRAIN HEAVY / TRAIN MODERATE / TRAIN LIGHT / REST — one sentence why. (Always line 1. Never omit.)
DO THIS TODAY: one specific action based on the data.
FOOD NOTE: one observation about nutrition based on logs. Omit this line entirely if no food data.
FLAG: one genuine concern if something warrants it, otherwise write NONE.

Max 5 sentences total.

HARD WRITING RULES — no exceptions:
- Never start a sentence with "Here's", "Let's", "Today", "Your", "You", "It's"
- No adverbs
- Active voice only — subject does the action
- No em dashes inside sentences (the separator after TRAIN/REST is the only one)
- Name the specific metric or number — not "sleep was poor" but "sleep score hit 52 two nights running"
- State the conclusion directly — never use "not X, it's Y" framing
- Vary sentence length deliberately
- No hedging, no softening, no justification
- Blunt and direct throughout`

function buildEmailHtml(brief: string, date: string): string {
  const dateStr = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
  const lines = brief.split('\n').filter(Boolean).map(line => {
    const colonIdx = line.indexOf(':')
    if (line.startsWith('TRAIN') || line.startsWith('REST')) {
      return `<p style="margin:10px 0;font-size:15px;color:#FAFAFA;"><strong style="color:#6BE3A4;">${line.split(' — ')[0]}</strong>${line.includes(' — ') ? ' — ' + line.split(' — ').slice(1).join(' — ') : ''}</p>`
    }
    if (colonIdx > 0 && colonIdx < 20) {
      return `<p style="margin:10px 0;font-size:15px;color:#B8B6B0;"><strong style="color:#FAFAFA;">${line.slice(0, colonIdx + 1)}</strong>${line.slice(colonIdx + 1)}</p>`
    }
    return `<p style="margin:10px 0;font-size:15px;color:#B8B6B0;">${line}</p>`
  }).join('')

  return `<!DOCTYPE html><html><body style="background:#0A0A0B;color:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;padding:32px 24px;max-width:480px;margin:0 auto;">
<p style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#E07658;margin:0 0 6px;">Daily Brief</p>
<p style="font-size:13px;color:#76746E;margin:0 0 24px;">${dateStr}</p>
<div style="background:rgba(255,255,255,0.04);border-radius:16px;padding:20px 22px;line-height:1.7;">
  ${lines}
</div>
<p style="font-size:11px;color:#4D4B47;margin-top:24px;">WHOOP Coach · <a href="https://whoop-rowan-tbk.vercel.app" style="color:#4D4B47;">Open app</a></p>
</body></html>`
}

function fmtMin(min: number | null): string {
  if (min == null) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`
}

async function generateCard() {
  const today = await getCoachDate()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [{ data: whoopRows }, { data: foodRows }, { data: journalRows }] = await Promise.all([
    supabase.from('whoop_data').select('*').order('date', { ascending: false }).limit(7),
    supabase.from('food_logs').select('*').gte('date', sevenDaysAgo).order('date', { ascending: false }),
    supabase.from('journal_entries').select('date, content').gte('date', sevenDaysAgo).order('date', { ascending: false }),
  ])

  const whoopSummary = whoopRows?.length
    ? whoopRows.map(r => {
        const parts: (string | null)[] = [
          `${r.date}:`,
          `recovery=${r.recovery_score ?? '—'}%`,
          `hrv=${r.hrv ?? '—'}ms`,
          r.resting_hr != null ? `rhr=${r.resting_hr}bpm` : null,
          `sleep=${r.sleep_score ?? '—'}%`,
          r.sleep_efficiency != null ? `sleep_eff=${r.sleep_efficiency}%` : null,
          r.total_sleep_min != null && r.sleep_needed_min != null
            ? `slept=${fmtMin(r.total_sleep_min)}/needed=${fmtMin(r.sleep_needed_min)}`
            : null,
          r.deep_sleep_min != null ? `deep=${fmtMin(r.deep_sleep_min)}` : null,
          r.rem_sleep_min  != null ? `rem=${fmtMin(r.rem_sleep_min)}`   : null,
          `strain=${r.strain ?? '—'}`,
          r.spo2           != null ? `spo2=${r.spo2}%`                  : null,
          r.skin_temp_delta != null
            ? `skin_temp=${r.skin_temp_delta >= 0 ? '+' : ''}${r.skin_temp_delta}°C`
            : null,
          `resp=${r.respiratory_rate ?? '—'}rpm`,
        ]
        return parts.filter((p): p is string => p !== null).join(' ')
      }).join('\n')
    : 'No Whoop data available.'

  const foodSummary = foodRows?.length
    ? foodRows.map(r =>
        `${r.date} ${r.meal_name}: ${r.calories ?? '?'}kcal, P${r.protein ?? '?'}g C${r.carbs ?? '?'}g F${r.fats ?? '?'}g${r.notes ? ' — ' + r.notes : ''}`
      ).join('\n')
    : 'No food logs available.'

  const journalSummary = journalRows?.length
    ? journalRows.map(r => `${r.date}: ${r.content}`).join('\n')
    : 'No journal entries.'

  const userMessage = [
    `Whoop data (last 7 days):\n${whoopSummary}`,
    `Food logs (last 7 days):\n${foodSummary}`,
    `Journal notes (last 7 days):\n${journalSummary}`,
  ].join('\n\n')

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

// Called by Vercel cron — requires CRON_SECRET, sends email
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const result = await generateCard()

    // Email notification (only on scheduled cron run)
    const apiKey = process.env.RESEND_API_KEY
    const to     = process.env.NOTIFICATION_EMAIL
    if (apiKey && to) {
      try {
        const resend = new Resend(apiKey)
        await resend.emails.send({
          from:    'WHOOP Coach <onboarding@resend.dev>',
          to,
          subject: `Coach Brief — ${result.date}`,
          html:    buildEmailHtml(result.brief, result.date),
        })
      } catch (e) {
        console.error('Email failed (non-fatal):', e)
      }
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// Called by the Generate now / Regenerate button — no auth, no email
export async function POST() {
  try {
    const result = await generateCard()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
