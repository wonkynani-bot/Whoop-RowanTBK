'use client'

import { useState } from 'react'
import type { CoachCard as CoachCardType } from '@/lib/supabase'

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

function renderBrief(brief: string) {
  return brief.split('\n').filter(Boolean).map((line, i) => {
    const colonIdx = line.indexOf(':')
    const dashIdx = line.indexOf(' — ')
    let label = ''
    let rest = line

    if (line.startsWith('TRAIN') || line.startsWith('REST')) {
      const split = dashIdx > -1 ? dashIdx : line.indexOf(' ', 6)
      label = split > -1 ? line.slice(0, split) : line
      rest  = split > -1 ? line.slice(split)  : ''
    } else if (colonIdx > 0 && colonIdx < 20) {
      label = line.slice(0, colonIdx + 1)
      rest  = line.slice(colonIdx + 1)
    }

    return (
      <span key={i} className="coach-brief-line">
        {label ? <span className="coach-label">{label}</span> : null}
        {rest}
      </span>
    )
  })
}

interface Props {
  card: CoachCardType | null
}

export default function CoachCard({ card: initialCard }: Props) {
  const [card, setCard] = useState<CoachCardType | null>(initialCard)
  const [generating, setGenerating] = useState(false)
  const [genErr, setGenErr] = useState('')

  async function handleGenerate() {
    setGenerating(true)
    setGenErr('')
    try {
      const res = await fetch('/api/coach-card', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Generation failed')
      setCard({
        id: 0,
        date: json.date,
        brief: json.brief,
        whoop_summary: null,
        food_summary: null,
        created_at: new Date().toISOString(),
      })
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section className="coach-section">
      <div className="section-title">Coach</div>
      <div className="coach-card">
        {generating ? (
          <div className="coach-placeholder">
            <span className="coach-placeholder-dot" />
            <br />
            Generating your brief…
          </div>
        ) : card ? (
          <>
            <div className="coach-card-date">{formatDate(card.date)}</div>
            <div className="coach-brief">{renderBrief(card.brief)}</div>
            <button className="generate-btn secondary" onClick={handleGenerate} disabled={generating}>
              Regenerate
            </button>
          </>
        ) : (
          <>
            <div className="coach-placeholder">
              <span className="coach-placeholder-dot" />
              <br />
              No brief yet today. Generate one now or wait for the 7am auto-run.
            </div>
            <button className="generate-btn" onClick={handleGenerate} disabled={generating}>
              Generate now
            </button>
          </>
        )}

        {genErr && (
          <div className="gen-error">
            <strong>Error:</strong> {genErr}
          </div>
        )}
      </div>
    </section>
  )
}
