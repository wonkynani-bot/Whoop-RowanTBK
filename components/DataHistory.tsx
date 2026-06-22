import type { WhoopData, FoodLog } from '@/lib/supabase'

interface Props {
  whoopData: WhoopData[]
  foodData: FoodLog[]
}

function fmtDate(d: string): string {
  const date = new Date(d + 'T12:00:00Z')
  return date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).toUpperCase()
}

function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—'
  return n.toFixed(decimals)
}

function recoveryClass(score: number | null | undefined): string {
  if (score == null) return ''
  if (score >= 67) return 'metric-green'
  if (score >= 34) return 'metric-yellow'
  return 'metric-red'
}

export default function DataHistory({ whoopData, foodData }: Props) {
  // Build union of all dates, newest first
  const dateSet = new Set<string>()
  whoopData.forEach(r => dateSet.add(r.date))
  foodData.forEach(r => dateSet.add(r.date))
  const dates = Array.from(dateSet).sort((a, b) => b.localeCompare(a))

  // Index by date
  const whoopByDate = new Map(whoopData.map(r => [r.date, r]))
  const foodByDate = new Map<string, FoodLog[]>()
  for (const log of foodData) {
    const arr = foodByDate.get(log.date) ?? []
    arr.push(log)
    foodByDate.set(log.date, arr)
  }

  if (dates.length === 0) return null

  return (
    <section className="data-section">
      <div className="section-title">Past data</div>
      <div className="data-list">
        {dates.map(date => {
          const w = whoopByDate.get(date)
          const meals = foodByDate.get(date) ?? []
          const totalCal = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0)
          const totalProt = meals.reduce((sum, m) => sum + (m.protein ?? 0), 0)

          return (
            <div key={date} className="data-day">
              <div className="data-day-date">{fmtDate(date)}</div>

              {w && (
                <div className="data-metrics">
                  {w.recovery_score != null && (
                    <div className="data-metric">
                      <span className="data-metric-label">Recovery</span>
                      <span className={`data-metric-value ${recoveryClass(w.recovery_score)}`}>
                        {fmtNum(w.recovery_score)}%
                      </span>
                    </div>
                  )}
                  {w.hrv != null && (
                    <div className="data-metric">
                      <span className="data-metric-label">HRV</span>
                      <span className="data-metric-value">{fmtNum(w.hrv)}ms</span>
                    </div>
                  )}
                  {w.sleep_score != null && (
                    <div className="data-metric">
                      <span className="data-metric-label">Sleep</span>
                      <span className="data-metric-value">{fmtNum(w.sleep_score)}%</span>
                    </div>
                  )}
                  {w.strain != null && (
                    <div className="data-metric">
                      <span className="data-metric-label">Strain</span>
                      <span className="data-metric-value">{fmtNum(w.strain, 1)}</span>
                    </div>
                  )}
                  {w.respiratory_rate != null && (
                    <div className="data-metric">
                      <span className="data-metric-label">Resp</span>
                      <span className="data-metric-value">{fmtNum(w.respiratory_rate, 1)}</span>
                    </div>
                  )}
                </div>
              )}

              {meals.length > 0 && (
                <div className="data-food">
                  <div className="data-food-meals">
                    {meals.map((m, i) => (
                      <span key={m.id}>
                        {m.meal_name}{i < meals.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                  <div className="data-food-totals">
                    {totalProt > 0 && <span>P {Math.round(totalProt)}g</span>}
                    {totalCal > 0  && <span>{Math.round(totalCal)} cal</span>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
