import { supabase } from '@/lib/supabase'
import type { CoachCard, WhoopData, FoodLog } from '@/lib/supabase'
import CoachCardComponent from '@/components/CoachCard'
import WhoopConnect from '@/components/WhoopConnect'
import FoodLogForm from '@/components/FoodLogForm'
import CoachHistory from '@/components/CoachHistory'
import DataHistory from '@/components/DataHistory'
import TodayWhoop from '@/components/TodayWhoop'

export const revalidate = 0

async function getTodayWhoop(): Promise<WhoopData | null> {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('whoop_data')
    .select('*')
    .eq('date', today)
    .single()
  return data ?? null
}

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

async function getPastData(): Promise<{ whoopData: WhoopData[]; foodData: FoodLog[] }> {
  const today = new Date().toISOString().slice(0, 10)
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  const [{ data: whoopData }, { data: foodData }] = await Promise.all([
    supabase
      .from('whoop_data')
      .select('*')
      .lt('date', today)
      .gte('date', cutoff)
      .order('date', { ascending: false }),
    supabase
      .from('food_logs')
      .select('*')
      .lt('date', today)
      .gte('date', cutoff)
      .order('created_at', { ascending: true }),
  ])

  return {
    whoopData: (whoopData ?? []) as WhoopData[],
    foodData:  (foodData  ?? []) as FoodLog[],
  }
}

export default async function Home() {
  const [todayWhoop, todayCard, history, pastData] = await Promise.all([
    getTodayWhoop(),
    getTodayCard(),
    getHistory(),
    getPastData(),
  ])

  return (
    <main className="page">
      <TodayWhoop data={todayWhoop} />
      <WhoopConnect />
      <hr className="divider" />
      <CoachCardComponent card={todayCard} />
      <hr className="divider" />
      <FoodLogForm />
      <hr className="divider" />
      <DataHistory whoopData={pastData.whoopData} foodData={pastData.foodData} />
      <CoachHistory cards={history} />
    </main>
  )
}
