'use client'

import { useState } from 'react'
import type { CoachCard } from '@/lib/supabase'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

interface Props {
  cards: CoachCard[]
}

export default function CoachHistory({ cards }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)

  if (!cards.length) return null

  return (
    <section className="history-section">
      <div className="section-title">History</div>
      <div className="history-list">
        {cards.map(card => (
          <div
            key={card.id}
            className={`history-card ${expanded === card.id ? '' : 'is-collapsed'}`}
            onClick={() => setExpanded(expanded === card.id ? null : card.id)}
          >
            <div className="history-card-date">{formatDate(card.date)}</div>
            <div className="history-card-brief">{card.brief}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
