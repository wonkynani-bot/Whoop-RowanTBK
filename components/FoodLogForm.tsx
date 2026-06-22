'use client'

import { useState, useRef, FormEvent } from 'react'

interface FormState {
  meal_name: string
  protein: string
  carbs: string
  fats: string
  calories: string
  notes: string
}

const EMPTY: FormState = { meal_name: '', protein: '', carbs: '', fats: '', calories: '', notes: '' }

type VoiceStage = 'idle' | 'listening' | 'parsing'
type SubmitStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function FoodLogForm() {
  const [voiceStage, setVoiceStage] = useState<VoiceStage>('idle')
  const [transcript, setTranscript] = useState('')
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')
  const [errMsg, setErrMsg] = useState('')
  const transcriptRef = useRef('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null)

  function set(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (submitStatus !== 'idle') setSubmitStatus('idle')
  }

  async function parseMeal(text: string) {
    setVoiceStage('parsing')
    try {
      const res = await fetch('/api/parse-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setForm({
        meal_name: data.meal_name ?? '',
        protein:  data.protein  != null ? String(data.protein)  : '',
        carbs:    data.carbs    != null ? String(data.carbs)    : '',
        fats:     data.fats     != null ? String(data.fats)     : '',
        calories: data.calories != null ? String(data.calories) : '',
        notes: '',
      })
    } catch (e) {
      setErrMsg('Could not parse: ' + (e instanceof Error ? e.message : String(e)))
      setSubmitStatus('error')
    } finally {
      setVoiceStage('idle')
    }
  }

  function startListening() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SpeechRec) {
      setErrMsg('Voice input not supported in this browser — use the form below.')
      setSubmitStatus('error')
      return
    }

    const rec = new SpeechRec()
    rec.lang = 'en-US'
    rec.continuous = false
    rec.interimResults = true
    recogRef.current = rec
    transcriptRef.current = ''

    setVoiceStage('listening')
    setTranscript('')
    setErrMsg('')
    setSubmitStatus('idle')

    rec.onresult = (e: { results: SpeechRecognitionResultList }) => {
      const text = Array.from(e.results).map((r: SpeechRecognitionResult) => r[0].transcript).join('')
      transcriptRef.current = text
      setTranscript(text)
    }

    rec.onend = () => {
      const text = transcriptRef.current.trim()
      if (text) {
        parseMeal(text)
      } else {
        setVoiceStage('idle')
      }
    }

    rec.onerror = (e: { error: string }) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        setErrMsg('Mic error: ' + e.error)
        setSubmitStatus('error')
      }
      setVoiceStage('idle')
    }

    rec.start()
  }

  function handleMicClick() {
    if (voiceStage === 'listening') {
      recogRef.current?.stop()
    } else if (voiceStage === 'idle') {
      startListening()
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.meal_name.trim()) return

    setSubmitStatus('saving')
    setErrMsg('')

    try {
      const res = await fetch('/api/food-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_name: form.meal_name.trim(),
          protein:  form.protein  ? Number(form.protein)  : null,
          carbs:    form.carbs    ? Number(form.carbs)    : null,
          fats:     form.fats     ? Number(form.fats)     : null,
          calories: form.calories ? Number(form.calories) : null,
          notes:    form.notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'unknown error' }))
        throw new Error(json.error || 'Save failed')
      }
      setSubmitStatus('saved')
      setForm(EMPTY)
      setTranscript('')
      setTimeout(() => setSubmitStatus('idle'), 3000)
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
      setSubmitStatus('error')
    }
  }

  const isParsing = voiceStage === 'parsing'
  const isSaving  = submitStatus === 'saving'

  return (
    <section className="food-section">
      <div className="section-title">Log food</div>
      <div className="food-card">

        {/* ── Voice input ── */}
        <div className="voice-area">
          <button
            className={`voice-btn${voiceStage === 'listening' ? ' is-listening' : ''}${isParsing ? ' is-parsing' : ''}`}
            type="button"
            onClick={handleMicClick}
            disabled={isParsing || isSaving}
            aria-label={voiceStage === 'listening' ? 'Stop recording' : 'Start voice input'}
          >
            {isParsing ? (
              <svg className="voice-spin" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.22-8.56" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="11" rx="3" />
                <path d="M19 10a7 7 0 0 1-14 0" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8"  y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          <p className="voice-label">
            {voiceStage === 'idle'     && 'Tap to speak'}
            {voiceStage === 'listening' && 'Listening… tap to stop'}
            {voiceStage === 'parsing'  && 'Extracting macros…'}
          </p>

          {transcript && (
            <p className="voice-transcript">&ldquo;{transcript}&rdquo;</p>
          )}
        </div>

        <div className="voice-or">or enter manually</div>

        {/* ── Manual form (always visible as fallback) ── */}
        <form className="food-form" onSubmit={handleSubmit}>
          <div className="food-field">
            <label className="food-label" htmlFor="meal-name">Meal</label>
            <input
              id="meal-name"
              className="food-input"
              type="text"
              placeholder="e.g. Ribeye + eggs"
              value={form.meal_name}
              onChange={e => set('meal_name', e.target.value)}
              required
            />
          </div>

          <div className="food-macros">
            <div className="food-field">
              <label className="food-label" htmlFor="food-protein">Protein (g)</label>
              <input id="food-protein" className="food-input" type="number" min="0" step="0.1" placeholder="0" value={form.protein} onChange={e => set('protein', e.target.value)} />
            </div>
            <div className="food-field">
              <label className="food-label" htmlFor="food-carbs">Carbs (g)</label>
              <input id="food-carbs" className="food-input" type="number" min="0" step="0.1" placeholder="0" value={form.carbs} onChange={e => set('carbs', e.target.value)} />
            </div>
            <div className="food-field">
              <label className="food-label" htmlFor="food-fats">Fats (g)</label>
              <input id="food-fats" className="food-input" type="number" min="0" step="0.1" placeholder="0" value={form.fats} onChange={e => set('fats', e.target.value)} />
            </div>
            <div className="food-field">
              <label className="food-label" htmlFor="food-calories">Calories</label>
              <input id="food-calories" className="food-input" type="number" min="0" step="1" placeholder="0" value={form.calories} onChange={e => set('calories', e.target.value)} />
            </div>
          </div>

          <div className="food-field">
            <label className="food-label" htmlFor="food-notes">Notes (optional)</label>
            <input
              id="food-notes"
              className="food-input"
              type="text"
              placeholder="e.g. grass-fed, post-workout"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          <button
            className="food-submit"
            type="submit"
            disabled={isSaving || isParsing || !form.meal_name.trim()}
          >
            {isSaving ? 'Saving…' : 'Log meal'}
          </button>

          {submitStatus === 'saved' && <p className="food-success">Logged ✓</p>}
          {submitStatus === 'error'  && errMsg && <p className="food-error">{errMsg}</p>}
        </form>

      </div>
    </section>
  )
}
