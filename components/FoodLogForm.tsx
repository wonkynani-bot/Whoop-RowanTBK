'use client'

import { useState, FormEvent } from 'react'

interface FormState {
  meal_name: string
  protein: string
  carbs: string
  fats: string
  calories: string
  notes: string
}

const EMPTY: FormState = { meal_name: '', protein: '', carbs: '', fats: '', calories: '', notes: '' }

export default function FoodLogForm() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  function set(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (status !== 'idle') setStatus('idle')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.meal_name.trim()) return

    setStatus('saving')
    setErrMsg('')

    try {
      const res = await fetch('/api/food-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_name: form.meal_name.trim(),
          protein: form.protein ? Number(form.protein) : null,
          carbs: form.carbs ? Number(form.carbs) : null,
          fats: form.fats ? Number(form.fats) : null,
          calories: form.calories ? Number(form.calories) : null,
          notes: form.notes.trim() || null,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'unknown error' }))
        throw new Error(json.error || 'Save failed')
      }

      setStatus('saved')
      setForm(EMPTY)
      setTimeout(() => setStatus('idle'), 3000)
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }

  return (
    <section className="food-section">
      <div className="section-title">Log food</div>
      <div className="food-card">
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
              <input
                id="food-protein"
                className="food-input"
                type="number"
                min="0"
                step="0.1"
                placeholder="0"
                value={form.protein}
                onChange={e => set('protein', e.target.value)}
              />
            </div>
            <div className="food-field">
              <label className="food-label" htmlFor="food-carbs">Carbs (g)</label>
              <input
                id="food-carbs"
                className="food-input"
                type="number"
                min="0"
                step="0.1"
                placeholder="0"
                value={form.carbs}
                onChange={e => set('carbs', e.target.value)}
              />
            </div>
            <div className="food-field">
              <label className="food-label" htmlFor="food-fats">Fats (g)</label>
              <input
                id="food-fats"
                className="food-input"
                type="number"
                min="0"
                step="0.1"
                placeholder="0"
                value={form.fats}
                onChange={e => set('fats', e.target.value)}
              />
            </div>
            <div className="food-field">
              <label className="food-label" htmlFor="food-calories">Calories</label>
              <input
                id="food-calories"
                className="food-input"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={form.calories}
                onChange={e => set('calories', e.target.value)}
              />
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
            disabled={status === 'saving' || !form.meal_name.trim()}
          >
            {status === 'saving' ? 'Saving…' : 'Log meal'}
          </button>

          {status === 'saved' && <p className="food-success">Logged ✓</p>}
          {status === 'error' && <p className="food-error">{errMsg}</p>}
        </form>
      </div>
    </section>
  )
}
