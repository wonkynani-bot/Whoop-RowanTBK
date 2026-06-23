'use client'

import { useMemo } from 'react'
import type { WhoopData } from '@/lib/supabase'

// Two-process circadian model:
//   Quality factor (qf) scales amplitude based on recovery + sleep scores.
//   Morning Gaussian peak ≈ 10:30am, post-lunch dip ≈ 2pm,
//   afternoon shoulder ≈ 5:30pm. 45-min sleep-inertia ramp after 7am wake.
function computeCurve(recovery: number, sleep: number): number[] {
  const qf = 0.55 + 0.28 * (recovery / 100) + 0.17 * (sleep / 100)
  return Array.from({ length: 97 }, (_, i) => {
    const h = i * 0.25
    if (h <= 7 || h >= 23) return 5
    const t = h - 7
    const ramp = Math.min(1, t / 0.75)
    const val =
      38
      + 48 * Math.exp(-0.5 * ((t - 3.5) / 1.6) ** 2)
      - 18 * Math.exp(-0.5 * ((t - 7.0) / 0.85) ** 2)
      + 28 * Math.exp(-0.5 * ((t - 10.5) / 2.1) ** 2)
      - 0.8 * t
    return Math.max(5, Math.min(100, Math.round(val * ramp * qf)))
  })
}

function fmtH(h: number): string {
  const n = Math.max(0, Math.min(23, Math.round(h)))
  if (n === 0)  return '12a'
  if (n === 12) return '12p'
  return n < 12 ? `${n}a` : `${n - 12}p`
}

interface Props { data: WhoopData | null }

export default function EnergyCurve({ data }: Props) {
  const recovery = data?.recovery_score ?? 65
  const sleep    = data?.sleep_score    ?? 65
  const isEstimate = !data || (data.recovery_score == null && data.sleep_score == null)

  const curve = useMemo(() => computeCurve(recovery, sleep), [recovery, sleep])

  const peakScore = Math.max(...curve)

  // Morning cognitive peak (8am–1pm, i=32–52)
  const mornSlice = curve.slice(32, 53)
  const mornMax   = Math.max(...mornSlice)
  const mornPeakH = (32 + mornSlice.indexOf(mornMax)) * 0.25

  // Afternoon physical peak (2pm–8pm, i=56–80)
  const aftSlice = curve.slice(56, 81)
  const aftMax   = Math.max(...aftSlice)
  const aftPeakH = (56 + aftSlice.indexOf(aftMax)) * 0.25

  // SVG path — viewBox 0 0 400 100, y=0 is top (high energy)
  const linePath = curve
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${((i * 0.25 / 24) * 400).toFixed(1)},${(100 - v).toFixed(1)}`)
    .join('')
  const areaPath = `${linePath}L400,100 L0,100 Z`

  // Current time marker (client only — always valid since 'use client')
  const now = new Date()
  const nowH = now.getHours() + now.getMinutes() / 60
  const nowLeftPct = `${(nowH / 24) * 100}%`
  const nowIdx = Math.min(96, Math.round(nowH * 4))
  const nowTopPct = `${100 - curve[nowIdx]}%`

  // Peak score color mirrors recovery
  let peakColor = 'var(--text-primary)'
  if      (recovery >= 67) peakColor = 'var(--success)'
  else if (recovery >= 34) peakColor = 'var(--warning)'
  else                     peakColor = 'var(--danger)'

  return (
    <section className="energy-section">
      <div className="energy-header">
        <div className="section-title" style={{ margin: 0 }}>Energy</div>
        <div className="peak-score-block">
          <span className="peak-score-label">Peak</span>
          <span className="peak-score-value" style={{ color: peakColor }}>{peakScore}</span>
        </div>
      </div>

      <div className="energy-card">
        {/* Chart area */}
        <div className="energy-chart-wrapper">
          <svg
            viewBox="0 0 400 100"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            style={{ display: 'block' }}
          >
            <defs>
              <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="rgba(107,227,164,0.28)" />
                <stop offset="100%" stopColor="rgba(107,227,164,0.02)" />
              </linearGradient>
            </defs>

            {/* Sleep zone tint: midnight–7am and 11pm–midnight */}
            <rect x="0"    y="0" width={(7 / 24 * 400).toFixed(1)}  height="100" fill="rgba(0,0,0,0.18)" />
            <rect x={(23 / 24 * 400).toFixed(1)} y="0" width={(1 / 24 * 400).toFixed(1)} height="100" fill="rgba(0,0,0,0.18)" />

            {/* Focus window highlight */}
            {mornMax > 52 && (
              <rect
                x={((Math.max(0, mornPeakH - 1) / 24) * 400).toFixed(1)}
                y="0"
                width={(2 / 24 * 400).toFixed(1)}
                height="100"
                fill="rgba(107,227,164,0.09)"
              />
            )}

            {/* Train window highlight */}
            {aftMax > 38 && (
              <rect
                x={((Math.max(0, aftPeakH - 1) / 24) * 400).toFixed(1)}
                y="0"
                width={(2 / 24 * 400).toFixed(1)}
                height="100"
                fill="rgba(224,118,88,0.09)"
              />
            )}

            {/* 50% reference line */}
            <line x1="0" y1="50" x2="400" y2="50" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />

            <path d={areaPath} fill="url(#energyGrad)" />
            <path d={linePath} fill="none" stroke="#6BE3A4" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>

          {/* "Now" indicator as HTML overlay (avoids SVG scaling distortion) */}
          <div className="now-line" style={{ left: nowLeftPct }} aria-hidden="true" />
          <div className="now-dot"  style={{ left: nowLeftPct, top: nowTopPct }} aria-hidden="true" />
        </div>

        {/* X-axis labels */}
        <div className="energy-x-labels">
          {([0, 6, 12, 18, 24] as const).map(h => (
            <span key={h} style={{ left: `${(h / 24) * 100}%` }}>{fmtH(h)}</span>
          ))}
        </div>

        {/* Peak windows */}
        <div className="energy-windows">
          {mornMax > 52 && (
            <span className="energy-window">
              <span className="energy-window-tag focus">Focus</span>
              {fmtH(Math.round(mornPeakH) - 1)}–{fmtH(Math.round(mornPeakH) + 1)}
            </span>
          )}
          {aftMax > 38 && (
            <span className="energy-window">
              <span className="energy-window-tag train">Train</span>
              {fmtH(Math.round(aftPeakH) - 1)}–{fmtH(Math.round(aftPeakH) + 1)}
            </span>
          )}
        </div>
      </div>

      {isEstimate && (
        <p className="energy-estimate-note">Estimated — sync WHOOP for your personal curve</p>
      )}
    </section>
  )
}
