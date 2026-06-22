import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  let body: { transcript?: string } = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const transcript = body.transcript?.trim()
  if (!transcript) return NextResponse.json({ error: 'transcript required' }, { status: 400 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: 'You extract meal nutrition from voice descriptions. Respond ONLY with valid JSON — no prose, no markdown fences.',
      messages: [{
        role: 'user',
        content: `Extract the meal and estimated macros. Use reasonable estimates for common foods if exact amounts aren't stated. Return ONLY this JSON:
{"meal_name":"string","protein":number_or_null,"carbs":number_or_null,"fats":number_or_null,"calories":number_or_null}

Voice log: "${transcript}"`,
      }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}'
    const clean = raw.replace(/^```json?\s*/i, '').replace(/```$/, '').trim()
    return NextResponse.json(JSON.parse(clean))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
