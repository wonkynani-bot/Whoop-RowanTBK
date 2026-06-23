const WHOOP_V1 = 'https://api.prod.whoop.com/developer/v1'
const WHOOP_V2 = 'https://api.prod.whoop.com/developer/v2'
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'

export interface WhoopApiTokens {
  access_token: string
  refresh_token: string
  expires_in: number
}

export async function refreshWhoopToken(refreshToken: string): Promise<WhoopApiTokens> {
  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
    scope: 'offline',
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`)
  return res.json()
}

async function whoopGet(path: string, accessToken: string) {
  const base = path.startsWith('/cycle') ? WHOOP_V1 : WHOOP_V2
  const res = await fetch(base + path, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`WHOOP ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function fetchTodayMetrics(accessToken: string) {
  const [rec, sleep, cycle] = await Promise.allSettled([
    whoopGet('/recovery?limit=1', accessToken),
    whoopGet('/activity/sleep?limit=1', accessToken),
    whoopGet('/cycle?limit=1', accessToken),
  ])

  const recScore     = rec.status   === 'fulfilled' ? rec.value?.records?.[0]?.score   : null
  const sleepRec     = sleep.status === 'fulfilled' ? sleep.value?.records?.[0]         : null
  const sleepScore   = sleepRec?.score
  const stageSummary = sleepScore?.stage_summary
  const sleepNeeded  = sleepScore?.sleep_needed
  const cycleScore   = cycle.status === 'fulfilled' ? cycle.value?.records?.[0]?.score  : null

  const toMin = (ms: number | null | undefined): number | null =>
    ms != null ? Math.round(ms / 60000) : null

  const totalSleepMs = stageSummary
    ? ((stageSummary.total_in_bed_time_milli ?? 0) - (stageSummary.total_awake_time_milli ?? 0))
    : null
  const neededMs = sleepNeeded
    ? ((sleepNeeded.baseline_milli ?? 0)
       + (sleepNeeded.need_from_sleep_debt_milli ?? 0)
       + (sleepNeeded.need_from_recent_strain_milli ?? 0))
    : null

  return {
    hrv:              recScore?.hrv_rmssd_milli            ? Math.round(recScore.hrv_rmssd_milli)                : null,
    recovery_score:   recScore?.recovery_score             ? Math.round(recScore.recovery_score)                 : null,
    sleep_score:      sleepScore?.sleep_performance_percentage
                        ? Math.round(sleepScore.sleep_performance_percentage)
                        : null,
    strain:           cycleScore?.strain != null            ? Number(cycleScore.strain.toFixed(1))               : null,
    respiratory_rate: sleepScore?.respiratory_rate          ? Number(sleepScore.respiratory_rate.toFixed(1))     : null,
    resting_hr:       recScore?.resting_heart_rate          ? Math.round(recScore.resting_heart_rate)            : null,
    spo2:             recScore?.spo2_percentage             ? Number(recScore.spo2_percentage.toFixed(1))        : null,
    skin_temp_delta:  recScore?.skin_temp_celsius != null   ? Number(recScore.skin_temp_celsius.toFixed(2))      : null,
    sleep_efficiency: sleepScore?.sleep_efficiency_percentage
                        ? Math.round(sleepScore.sleep_efficiency_percentage)
                        : null,
    deep_sleep_min:   toMin(stageSummary?.total_slow_wave_sleep_time_milli),
    rem_sleep_min:    toMin(stageSummary?.total_rem_sleep_time_milli),
    total_sleep_min:  toMin(totalSleepMs),
    sleep_needed_min: toMin(neededMs),
    wake_time:        (sleepRec?.end as string | undefined) ?? null,
  }
}
