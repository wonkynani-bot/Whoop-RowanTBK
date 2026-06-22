import type { CoachCard as CoachCardType } from '@/lib/supabase'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })
}

// Bold the keyword at the start of each line (e.g. "TRAIN HEAVY", "DO THIS TODAY:", "FLAG:")
function renderBrief(brief: string) {
  return brief.split('\n').filter(Boolean).map((line, i) => {
    const colonIdx = line.indexOf(':')
    const dashIdx = line.indexOf(' — ')
    let label = ''
    let rest = line

    if (line.startsWith('TRAIN') || line.startsWith('REST')) {
      const split = dashIdx > -1 ? dashIdx : line.indexOf(' ', 6)
      label = split > -1 ? line.slice(0, split) : line
      rest = split > -1 ? line.slice(split) : ''
    } else if (colonIdx > 0 && colonIdx < 20) {
      label = line.slice(0, colonIdx + 1)
      rest = line.slice(colonIdx + 1)
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

export default function CoachCard({ card }: Props) {
  return (
    <section className="coach-section">
      <div className="section-title">Today</div>
      <div className="coach-card">
        {card ? (
          <>
            <div className="coach-card-date">{formatDate(card.date)}</div>
            <div className="coach-brief">{renderBrief(card.brief)}</div>
          </>
        ) : (
          <div className="coach-placeholder">
            <span className="coach-placeholder-dot" />
            <br />
            Coach brief generates at 7 am after your Whoop syncs.
            <br />
            Connect your WHOOP below to get started.
          </div>
        )}
      </div>
    </section>
  )
}
