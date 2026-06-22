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

  const recData = rec.status === 'fulfilled' ? rec.value?.records?.[0]?.score : null
  const sleepData = sleep.status === 'fulfilled' ? sleep.value?.records?.[0] : null
  const cycleData = cycle.status === 'fulfilled' ? cycle.value?.records?.[0]?.score : null

  return {
    hrv: recData?.hrv_rmssd_milli ? Math.round(recData.hrv_rmssd_milli) : null,
    recovery_score: recData?.recovery_score ? Math.round(recData.recovery_score) : null,
    sleep_score: sleepData?.score?.sleep_performance_percentage
      ? Math.round(sleepData.score.sleep_performance_percentage)
      : null,
    strain: cycleData?.strain != null ? Number(cycleData.strain.toFixed(1)) : null,
    respiratory_rate: sleepData?.score?.respiratory_rate
      ? Number(sleepData.score.respiratory_rate.toFixed(1))
      : null,
  }
}
