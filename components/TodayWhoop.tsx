import type { WhoopData } from '@/lib/supabase'

interface Props {
  data: WhoopData | null
}

function fmtNum(n: number | null, decimals = 0): string {
  if (n == null) return '—'
  return n.toFixed(decimals)
}

function recoveryColor(score: number | null): string {
  if (score == null) return ''
  if (score >= 67) return 'whoop-metric-green'
  if (score >= 34) return 'whoop-metric-yellow'
  return 'whoop-metric-red'
}

export default function TodayWhoop({ data }: Props) {
  const hasAny = data && (
    data.recovery_score != null ||
    data.hrv != null ||
    data.sleep_score != null ||
    data.strain != null
  )

  return (
    <section className="today-section">
      <div className="section-title">Today</div>
      {hasAny ? (
        <div className="today-metrics">
          {data!.recovery_score != null && (
            <div className="today-metric">
              <span className="today-metric-label">Recovery</span>
              <span className={`today-metric-value ${recoveryColor(data!.recovery_score)}`}>
                {fmtNum(data!.recovery_score)}%
              </span>
            </div>
          )}
          {data!.hrv != null && (
            <div className="today-metric">
              <span className="today-metric-label">HRV</span>
              <span className="today-metric-value">{fmtNum(data!.hrv)}ms</span>
            </div>
          )}
          {data!.sleep_score != null && (
            <div className="today-metric">
              <span className="today-metric-label">Sleep</span>
              <span className="today-metric-value">{fmtNum(data!.sleep_score)}%</span>
            </div>
          )}
          {data!.strain != null && (
            <div className="today-metric">
              <span className="today-metric-label">Strain</span>
              <span className="today-metric-value">{fmtNum(data!.strain, 1)}</span>
            </div>
          )}
          {data!.respiratory_rate != null && (
            <div className="today-metric">
              <span className="today-metric-label">Resp</span>
              <span className="today-metric-value">{fmtNum(data!.respiratory_rate, 1)}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="today-empty">
          No data yet — tap <strong>Sync now</strong> to pull from WHOOP.
        </div>
      )}
    </section>
  )
}
