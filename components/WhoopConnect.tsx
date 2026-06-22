'use client'

import { useEffect, useState } from 'react'

const TOKEN_KEY = 'whoop_tokens_v1'
const SCOPES = 'read:recovery read:sleep read:workout read:cycles read:profile read:body_measurement offline'

interface WhoopTokens {
  access: string
  refresh: string
  expires: number
}

function loadTokens(): WhoopTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveTokens(t: WhoopTokens) {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify(t)) } catch { /* ignore */ }
}

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error'

export default function WhoopConnect() {
  const [connected, setConnected] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncErr, setSyncErr] = useState('')

  useEffect(() => {
    if (location.hash && location.hash.includes('whoop_access')) {
      const h = new URLSearchParams(location.hash.slice(1))
      const access = h.get('whoop_access')
      const refresh = h.get('whoop_refresh') ?? ''
      const expires = Number(h.get('whoop_expires')) || Date.now() + 3500 * 1000
      if (access) {
        saveTokens({ access, refresh, expires })
        history.replaceState(null, '', location.pathname + location.search)
      }
    }
    setConnected(!!loadTokens()?.access)
  }, [])

  async function handleSync() {
    setSyncStatus('syncing')
    setSyncErr('')
    try {
      const res = await fetch('/api/sync-now', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        const msg = json.error ?? 'Sync failed'
        const detail = json.detail ? ` (${json.detail})` : ''
        const step = json.step ? ` [step: ${json.step}]` : ''
        throw new Error(msg + detail + step)
      }
      setSyncStatus('done')
      setTimeout(() => { window.location.reload() }, 1200)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sync failed — unknown error'
      setSyncErr(msg)
      setSyncStatus('error')
    }
  }

  if (connected) {
    return (
      <div className="whoop-sync-wrapper">
        <div className="whoop-sync-row">
          <span className="whoop-sync-label">
            <span className="whoop-brand-mark-sm">W</span>
            WHOOP connected
          </span>
          <button
            className={`whoop-sync-btn${syncStatus === 'done' ? ' is-done' : ''}`}
            type="button"
            onClick={handleSync}
            disabled={syncStatus === 'syncing' || syncStatus === 'done'}
          >
            {syncStatus === 'idle'    && 'Sync now'}
            {syncStatus === 'syncing' && (
              <>
                <span className="whoop-sync-spinner" />
                Syncing…
              </>
            )}
            {syncStatus === 'done'    && '✓ Synced'}
            {syncStatus === 'error'   && 'Retry sync'}
          </button>
        </div>

        {syncStatus === 'error' && syncErr && (
          <div className="sync-error-msg">
            <strong>Sync failed:</strong> {syncErr}
          </div>
        )}
      </div>
    )
  }

  const handleConnect = () => {
    const clientId = process.env.NEXT_PUBLIC_WHOOP_CLIENT_ID
    const redirect = window.location.origin + '/api/whoop-callback'
    const url =
      'https://api.prod.whoop.com/oauth/oauth2/auth' +
      '?client_id=' + encodeURIComponent(clientId ?? '') +
      '&redirect_uri=' + encodeURIComponent(redirect) +
      '&response_type=code' +
      '&scope=' + encodeURIComponent(SCOPES) +
      '&state=' + Math.random().toString(36).slice(2)
    location.href = url
  }

  return (
    <section className="coach-section">
      <div className="card">
        <div className="whoop-disconnected">
          <div className="whoop-brand">
            <span className="whoop-brand-mark">W</span>
            <span className="whoop-brand-text">WHOOP</span>
          </div>
          <div className="whoop-disconnected-title">Not connected</div>
          <div className="whoop-disconnected-sub">
            Link your WHOOP to pull live recovery, sleep, and strain data.
          </div>
          <button className="whoop-connect-btn" type="button" onClick={handleConnect}>
            Connect WHOOP
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="13 5 20 12 13 19" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}
