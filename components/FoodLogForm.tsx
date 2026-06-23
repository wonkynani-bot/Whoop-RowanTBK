'use client'

import { useState, useRef, useEffect, useCallback, FormEvent } from 'react'
import type { FoodLog } from '@/lib/supabase'

interface Props {
  initialDate: string  // coach date (sleep-based), passed from server
}

interface FormState {
  meal_name: string
  protein: string
  carbs: string
  fats: string
  calories: string
  notes: string
}

interface EditState {
  meal_name: string
  protein: string
  carbs: string
  fats: string
  calories: string
}

const EMPTY_FORM: FormState = { meal_name: '', protein: '', carbs: '', fats: '', calories: '', notes: '' }
const EMPTY_EDIT: EditState = { meal_name: '', protein: '', carbs: '', fats: '', calories: '' }

type VoiceStage   = 'idle' | 'listening' | 'parsing'
type SubmitStatus = 'idle' | 'saving' | 'saved' | 'error'

function macroStr(log: FoodLog): string {
  const parts: string[] = []
  if (log.protein  != null) parts.push(`P ${Math.round(log.protein)}g`)
  if (log.carbs    != null) parts.push(`C ${Math.round(log.carbs)}g`)
  if (log.fats     != null) parts.push(`F ${Math.round(log.fats)}g`)
  if (log.calories != null) parts.push(`${Math.round(log.calories)} cal`)
  return parts.join(' · ')
}

function prevDay(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = any

export default function FoodLogForm({ initialDate }: Props) {
  const coachDate = initialDate
  const yesterday = prevDay(coachDate)

  const [selectedDate,   setSelectedDate]   = useState(coachDate)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [logs,           setLogs]           = useState<FoodLog[]>([])

  const [form,         setFormState]  = useState<FormState>(EMPTY_FORM)
  const [submitStatus, setSubmit]     = useState<SubmitStatus>('idle')
  const [errMsg,       setErrMsg]     = useState('')

  const [voiceStage, setVoiceStage] = useState<VoiceStage>('idle')
  const [transcript, setTranscript] = useState('')
  const transcriptRef = useRef('')
  const recogRef      = useRef<AnyRec>(null)

  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
  const [editingId,  setEditingId]  = useState<number | null>(null)
  const [editState,  setEditState]  = useState<EditState>(EMPTY_EDIT)
  const [movingId,   setMovingId]   = useState<number | null>(null)
  const [moveDate,   setMoveDate]   = useState(coachDate)

  const fetchLogs = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/food-logs?date=${date}`)
      if (res.ok) setLogs(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchLogs(selectedDate) }, [selectedDate, fetchLogs])

  const totalCal  = logs.reduce((s, m) => s + (m.calories ?? 0), 0)
  const totalProt = logs.reduce((s, m) => s + (m.protein  ?? 0), 0)

  function dateLabel(iso: string): string {
    if (iso === coachDate) return 'Today'
    if (iso === yesterday) return 'Yesterday'
    const d = new Date(iso + 'T12:00:00Z')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }

  function mealsHeader(): string {
    if (selectedDate === coachDate) return "Today's meals"
    if (selectedDate === yesterday) return "Yesterday's meals"
    const d = new Date(selectedDate + 'T12:00:00Z')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) + ' meals'
  }

  function setField(field: keyof FormState, value: string) {
    setFormState(prev => ({ ...prev, [field]: value }))
    if (submitStatus !== 'idle') setSubmit('idle')
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
      setFormState({
        meal_name: data.meal_name ?? '',
        protein:  data.protein  != null ? String(data.protein)  : '',
        carbs:    data.carbs    != null ? String(data.carbs)    : '',
        fats:     data.fats     != null ? String(data.fats)     : '',
        calories: data.calories != null ? String(data.calories) : '',
        notes: '',
      })
    } catch (e) {
      setErrMsg('Could not parse: ' + (e instanceof Error ? e.message : String(e)))
      setSubmit('error')
    } finally {
      setVoiceStage('idle')
    }
  }

  function startListening() {
    const SpeechRec = (window as AnyRec).SpeechRecognition ?? (window as AnyRec).webkitSpeechRecognition
    if (!SpeechRec) {
      setErrMsg('Voice input not supported in this browser — use the form below.')
      setSubmit('error')
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
    setSubmit('idle')
    rec.onresult = (e: { results: SpeechRecognitionResultList }) => {
      const text = Array.from(e.results).map((r: SpeechRecognitionResult) => r[0].transcript).join('')
      transcriptRef.current = text
      setTranscript(text)
    }
    rec.onend = () => {
      const text = transcriptRef.current.trim()
      if (text) parseMeal(text)
      else setVoiceStage('idle')
    }
    rec.onerror = (e: { error: string }) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        setErrMsg('Mic error: ' + e.error)
        setSubmit('error')
      }
      setVoiceStage('idle')
    }
    rec.start()
  }

  function handleMicClick() {
    if (voiceStage === 'listening') recogRef.current?.stop()
    else if (voiceStage === 'idle') startListening()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.meal_name.trim()) return
    setSubmit('saving')
    setErrMsg('')
    try {
      const res = await fetch('/api/food-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:     selectedDate,
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
      setSubmit('saved')
      setFormState(EMPTY_FORM)
      setTranscript('')
      await fetchLogs(selectedDate)
      setTimeout(() => setSubmit('idle'), 3000)
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
      setSubmit('error')
    }
  }

  function selectDate(date: string) {
    setSelectedDate(date)
    setShowDatePicker(false)
    setMenuOpenId(null)
    setEditingId(null)
    setMovingId(null)
  }

  function openMenu(id: number) {
    setMenuOpenId(menuOpenId === id ? null : id)
    setEditingId(null)
    setMovingId(null)
  }

  function startEdit(meal: FoodLog) {
    setEditingId(meal.id)
    setEditState({
      meal_name: meal.meal_name,
      calories:  meal.calories?.toString() ?? '',
      protein:   meal.protein?.toString()  ?? '',
      carbs:     meal.carbs?.toString()    ?? '',
      fats:      meal.fats?.toString()     ?? '',
    })
    setMenuOpenId(null)
    setMovingId(null)
  }

  function startMove(id: number) {
    setMovingId(id)
    setMoveDate(prevDay(selectedDate))  // default to previous day as a sensible target
    setMenuOpenId(null)
    setEditingId(null)
  }

  async function handleEditSave(id: number) {
    const res = await fetch(`/api/food-logs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meal_name: editState.meal_name,
        calories:  editState.calories ? Number(editState.calories) : null,
        protein:   editState.protein  ? Number(editState.protein)  : null,
        carbs:     editState.carbs    ? Number(editState.carbs)    : null,
        fats:      editState.fats     ? Number(editState.fats)     : null,
      }),
    })
    if (res.ok) {
      setEditingId(null)
      fetchLogs(selectedDate)
    }
  }

  async function handleMove(id: number) {
    if (!moveDate || moveDate === selectedDate) return
    await fetch(`/api/food-logs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: moveDate }),
    })
    setMovingId(null)
    // Remove from current list immediately
    setLogs(prev => prev.filter(m => m.id !== id))
  }

  async function handleDelete(id: number) {
    await fetch(`/api/food-logs/${id}`, { method: 'DELETE' })
    setMenuOpenId(null)
    setLogs(prev => prev.filter(m => m.id !== id))
  }

  const isParsing = voiceStage === 'parsing'
  const isSaving  = submitStatus === 'saving'
  const isCustomDate = selectedDate !== coachDate && selectedDate !== yesterday

  return (
    <section className="food-section">
      <div className="section-title">Log food</div>
      <div className="food-card">

        {/* ── Date selector ── */}
        <div className="food-date-row">
          <button
            className={`food-date-chip${selectedDate === yesterday ? ' active' : ''}`}
            onClick={() => selectDate(yesterday)}
          >Yesterday</button>
          <button
            className={`food-date-chip${selectedDate === coachDate ? ' active' : ''}`}
            onClick={() => selectDate(coachDate)}
          >Today</button>
          <button
            className={`food-date-chip${isCustomDate ? ' active' : ''}`}
            onClick={() => setShowDatePicker(v => !v)}
          >
            {isCustomDate ? dateLabel(selectedDate) : 'Pick date'}
          </button>
        </div>
        {showDatePicker && (
          <input
            type="date"
            className="food-date-picker-input"
            value={isCustomDate ? selectedDate : ''}
            max={coachDate}
            onChange={e => { if (e.target.value) selectDate(e.target.value) }}
            autoFocus
          />
        )}

        {/* ── Daily summary for selected date ── */}
        {logs.length > 0 && (
          <div className="daily-summary">
            <span className="daily-summary-meals">{logs.length} meal{logs.length !== 1 ? 's' : ''}</span>
            {totalProt > 0 && <span className="daily-summary-stat"><strong>{Math.round(totalProt)}g</strong> protein</span>}
            {totalCal  > 0 && <span className="daily-summary-stat"><strong>{Math.round(totalCal).toLocaleString()}</strong> cal</span>}
          </div>
        )}

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
            {voiceStage === 'idle'      && `Tap to speak — logs to ${dateLabel(selectedDate)}`}
            {voiceStage === 'listening' && 'Listening… tap to stop'}
            {voiceStage === 'parsing'   && 'Extracting macros…'}
          </p>
          {transcript && <p className="voice-transcript">&ldquo;{transcript}&rdquo;</p>}
        </div>

        <div className="voice-or">or enter manually</div>

        {/* ── Manual form ── */}
        <form className="food-form" onSubmit={handleSubmit}>
          <div className="food-field">
            <label className="food-label" htmlFor="meal-name">Meal</label>
            <input
              id="meal-name"
              className="food-input"
              type="text"
              placeholder="e.g. Ribeye + eggs"
              value={form.meal_name}
              onChange={e => setField('meal_name', e.target.value)}
              required
            />
          </div>
          <div className="food-macros">
            <div className="food-field">
              <label className="food-label" htmlFor="food-protein">Protein (g)</label>
              <input id="food-protein" className="food-input" type="number" min="0" step="0.1" placeholder="0" value={form.protein} onChange={e => setField('protein', e.target.value)} />
            </div>
            <div className="food-field">
              <label className="food-label" htmlFor="food-carbs">Carbs (g)</label>
              <input id="food-carbs" className="food-input" type="number" min="0" step="0.1" placeholder="0" value={form.carbs} onChange={e => setField('carbs', e.target.value)} />
            </div>
            <div className="food-field">
              <label className="food-label" htmlFor="food-fats">Fats (g)</label>
              <input id="food-fats" className="food-input" type="number" min="0" step="0.1" placeholder="0" value={form.fats} onChange={e => setField('fats', e.target.value)} />
            </div>
            <div className="food-field">
              <label className="food-label" htmlFor="food-calories">Calories</label>
              <input id="food-calories" className="food-input" type="number" min="0" step="1" placeholder="0" value={form.calories} onChange={e => setField('calories', e.target.value)} />
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
              onChange={e => setField('notes', e.target.value)}
            />
          </div>
          <button
            className="food-submit"
            type="submit"
            disabled={isSaving || isParsing || !form.meal_name.trim()}
          >
            {isSaving ? 'Saving…' : `Log to ${dateLabel(selectedDate)}`}
          </button>
          {submitStatus === 'saved' && <p className="food-success">Logged ✓</p>}
          {submitStatus === 'error' && errMsg && <p className="food-error">{errMsg}</p>}
        </form>

        {/* ── Meals list ── */}
        {logs.length > 0 && (
          <div className="today-meals">
            <div className="today-meals-header">{mealsHeader()}</div>
            {logs.map(meal => {
              const macros    = macroStr(meal)
              const isEditing = editingId  === meal.id
              const isMoving  = movingId   === meal.id
              const isMenuOpen = menuOpenId === meal.id

              return (
                <div key={meal.id} className={`meal-row${isEditing || isMoving ? ' meal-row-active' : ''}`}>
                  {isEditing ? (
                    <div className="meal-edit-form">
                      <input
                        className="food-input"
                        value={editState.meal_name}
                        onChange={e => setEditState(s => ({ ...s, meal_name: e.target.value }))}
                        placeholder="Meal name"
                        autoFocus
                      />
                      <div className="meal-edit-macros">
                        <input className="food-input" type="number" placeholder="kcal" min="0" value={editState.calories} onChange={e => setEditState(s => ({ ...s, calories: e.target.value }))} />
                        <input className="food-input" type="number" placeholder="P (g)" min="0" value={editState.protein}  onChange={e => setEditState(s => ({ ...s, protein:  e.target.value }))} />
                        <input className="food-input" type="number" placeholder="C (g)" min="0" value={editState.carbs}    onChange={e => setEditState(s => ({ ...s, carbs:    e.target.value }))} />
                        <input className="food-input" type="number" placeholder="F (g)" min="0" value={editState.fats}     onChange={e => setEditState(s => ({ ...s, fats:     e.target.value }))} />
                      </div>
                      <div className="meal-action-row">
                        <button className="meal-action-btn save" onClick={() => handleEditSave(meal.id)}>Save</button>
                        <button className="meal-action-btn" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : isMoving ? (
                    <div className="meal-move-form">
                      <span className="meal-move-label">Move &ldquo;{meal.meal_name}&rdquo; to:</span>
                      <input
                        type="date"
                        className="food-date-picker-input"
                        value={moveDate}
                        max={coachDate}
                        onChange={e => setMoveDate(e.target.value)}
                      />
                      <div className="meal-action-row">
                        <button
                          className="meal-action-btn save"
                          onClick={() => handleMove(meal.id)}
                          disabled={!moveDate || moveDate === selectedDate}
                        >Move</button>
                        <button className="meal-action-btn" onClick={() => setMovingId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="meal-row-header">
                        <span className="meal-row-name">{meal.meal_name}</span>
                        <button
                          className="meal-menu-btn"
                          onClick={() => openMenu(meal.id)}
                          aria-label="Meal options"
                        >•••</button>
                      </div>
                      {macros && <span className="meal-row-macros">{macros}</span>}
                      {meal.notes && <span className="meal-row-notes">{meal.notes}</span>}
                      {isMenuOpen && (
                        <div className="meal-action-strip">
                          <button className="meal-action-btn" onClick={() => startEdit(meal)}>Edit</button>
                          <button className="meal-action-btn" onClick={() => startMove(meal.id)}>Move to date</button>
                          <button className="meal-action-btn danger" onClick={() => handleDelete(meal.id)}>Delete</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </section>
  )
}
