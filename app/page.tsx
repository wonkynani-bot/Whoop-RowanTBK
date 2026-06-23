import { supabase } from '@/lib/supabase'
import { getCoachDate } from '@/lib/coach-date'
import type { CoachCard, WhoopData, FoodLog } from '@/lib/supabase'
import CoachCardComponent from '@/components/CoachCard'
import WhoopConnect from '@/components/WhoopConnect'
import FoodLogForm from '@/components/FoodLogForm'
import CoachHistory from '@/components/CoachHistory'
import DataHistory from '@/components/DataHistory'
import TodayWhoop from '@/components/TodayWhoop'
import EnergyCurve from '@/components/EnergyCurve'
import JournalEntry from '@/components/JournalEntry'

export const revalidate = 0

async function getTodayWhoop(today: string): Promise<WhoopData | null> {
  const { data } = await supabase.from('whoop_data').select('*').eq('date', today).single()
  return data ?? null
}

async function getTodayCard(today: string): Promise<CoachCard | null> {
  const { data } = await supabase.from('coach_cards').select('*').eq('date', today).single()
  return data ?? null
}

async function getHistory(today: string): Promise<CoachCard[]> {
  const { data } = await supabase
    .from('coach_cards')
    .select('*')
    .neq('date', today)
    .order('date', { ascending: false })
    .limit(30)
  return data ?? []
}

async function getPastData(today: string): Promise<{ whoopData: WhoopData[]; foodData: FoodLog[] }> {
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const [{ data: whoopData }, { data: foodData }] = await Promise.all([
    supabase.from('whoop_data').select('*').lt('date', today).gte('date', cutoff).order('date', { ascending: false }),
    supabase.from('food_logs').select('*').lt('date', today).gte('date', cutoff).order('created_at', { ascending: true }),
  ])
  return {
    whoopData: (whoopData ?? []) as WhoopData[],
    foodData:  (foodData  ?? []) as FoodLog[],
  }
}

async function getTodayJournal(today: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('journal_entries')
      .select('content')
      .eq('date', today)
      .single()
    return data?.content ?? ''
  } catch {
    return ''
  }
}

export default async function Home() {
  const today = await getCoachDate()

  const [todayWhoop, todayCard, history, pastData, journalContent] = await Promise.all([
    getTodayWhoop(today),
    getTodayCard(today),
    getHistory(today),
    getPastData(today),
    getTodayJournal(today),
  ])

  return (
    <main className="page">
      <TodayWhoop data={todayWhoop} />
      <WhoopConnect />
      <EnergyCurve data={todayWhoop} />
      <hr className="divider" />
      <CoachCardComponent card={todayCard} />
      <JournalEntry initialContent={journalContent} />
      <hr className="divider" />
      <FoodLogForm />
      <hr className="divider" />
      <DataHistory whoopData={pastData.whoopData} foodData={pastData.foodData} />
      <CoachHistory cards={history} />
    </main>
  )
}
