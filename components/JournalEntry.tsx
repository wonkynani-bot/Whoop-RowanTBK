'use client'

import { useState, useRef, useCallback, ChangeEvent } from 'react'

interface Props {
  initialContent: string
}

type SaveStatus = 'idle' | 'saving' | 'saved'

export default function JournalEntry({ initialContent }: Props) {
  const [content, setContent]     = useState(initialContent)
  const [status, setStatus]       = useState<SaveStatus>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(async (text: string) => {
    setStatus('saving')
    try {
      await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2500)
    } catch {
      setStatus('idle')
    }
  }, [])

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setContent(val)
    setStatus('idle')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(val), 1500)
  }

  return (
    <div className="journal-area">
      <div className="journal-header">
        <span className="journal-label">Today&rsquo;s note</span>
        <span className={`journal-status ${status !== 'idle' ? 'visible' : ''}`}>
          {status === 'saving' && 'Saving…'}
          {status === 'saved'  && 'Saved ✓'}
        </span>
      </div>
      <textarea
        className="journal-textarea"
        placeholder="Training session, stress, sleep quality, anything the coach should know…"
        value={content}
        onChange={handleChange}
        rows={3}
      />
    </div>
  )
}
