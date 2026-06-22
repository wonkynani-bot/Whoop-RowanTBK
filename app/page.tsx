import { supabase } from '@/lib/supabase'
import type { CoachCard } from '@/lib/supabase'
import CoachCardComponent from '@/components/CoachCard'
import WhoopConnect from '@/components/WhoopConnect'
import FoodLogForm from '@/components/FoodLogForm'
import CoachHistory from '@/components/CoachHistory'

export const revalidate = 0 // always fresh on load

async function getTodayCard(): Promise<CoachCard | null> {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('coach_cards')
    .select('*')
    .eq('date', today)
    .single()
  return data ?? null
}

async function getHistory(): Promise<CoachCard[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('coach_cards')
    .select('*')
    .neq('date', today)
    .order('date', { ascending: false })
    .limit(30)
  return data ?? []
}

export default async function Home() {
  const [todayCard, history] = await Promise.all([getTodayCard(), getHistory()])

  return (
    <main className="page">
      <CoachCardComponent card={todayCard} />
      <hr className="divider" />
      <WhoopConnect />
      <FoodLogForm />
      <hr className="divider" />
      <CoachHistory cards={history} />
    </main>
  )
}
