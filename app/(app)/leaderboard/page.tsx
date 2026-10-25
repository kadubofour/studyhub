'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Trophy } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Board, ViewSwitch } from '@/components/social/Board'
import { FriendsPanel, copyText } from '@/components/social/FriendsPanel'
import { GroupsPanel } from '@/components/social/GroupsPanel'
import { useProfile } from '@/components/providers/ProfileProvider'
import { useToast } from '@/components/providers/ToastProvider'
import { leaderboard, myFriendRequests, myFriends, myGroups, type Friend, type FriendRequest, type Group } from '@/lib/data/social'
import { rankRows, type BoardRow, type BoardView } from '@/lib/social/rank'
import { supabase } from '@/lib/supabase/client'
import { useEdgeFade } from '@/lib/ui/useEdgeFade'

const FRIENDS = 'friends'

// The Leaderboard: a board for friends and one for each study group, This week or All time, with friends and groups
// managed beside it (under it on a phone). `?group=<id>` opens on that group's board.
export default function LeaderboardPage() {
  const { profile } = useProfile()
  const toast = useToast()
  const asked = useSearchParams().get('group')
  const [tab, setTab] = useState<string>(asked || FRIENDS)
  const [view, setView] = useState<BoardView>('week')
  const [boards, setBoards] = useState<Record<string, BoardRow[]>>({})
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [failed, setFailed] = useState(false)
  const { ref: rowRef, more: rowMore } = useEdgeFade<HTMLDivElement>()

  // A group that is gone (left, deleted, removed from) falls back to the friends board
  const group = tab === FRIENDS ? null : groups?.find(g => g.id === tab) ?? null
  const current = group ? group.id : groups === null && tab !== FRIENDS ? tab : FRIENDS

  const loadBoard = async (key: string) => {
    const rows = await leaderboard(supabase(), key === FRIENDS ? null : key)
    setBoards(b => ({ ...b, [key]: rows }))
  }
  async function reloadFriends() {
    const sb = supabase()
    const [f, r] = await Promise.all([myFriends(sb), myFriendRequests(sb), loadBoard(FRIENDS)])
    setFriends(f); setRequests(r)
    return f
  }
  async function reloadGroups() {
    const g = await myGroups(supabase())
    setGroups(g)
    const still = tab !== FRIENDS && g.some(x => x.id === tab)
    await (still ? loadBoard(tab) : Promise.resolve())
    return g
  }

  useEffect(() => {
    let live = true
    const sb = supabase()
    Promise.all([myFriends(sb), myFriendRequests(sb), myGroups(sb)])
      .then(([f, r, g]) => { if (live) { setFriends(f); setRequests(r); setGroups(g) } })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])
  useEffect(() => {
    let live = true
    leaderboard(supabase(), current === FRIENDS ? null : current)
      .then(rows => { if (live) setBoards(b => ({ ...b, [current]: rows })) })
      .catch(() => { if (live) setBoards(b => ({ ...b, [current]: [] })) })
    return () => { live = false }
  }, [current])

  const rows = boards[current]
  const ranked = rows ? rankRows(rows, view) : null
  const noFriends = current === FRIENDS && friends !== null && friends.length === 0
  const chip = (on: boolean) => `inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm transition pointer-coarse:min-h-11 ${on ? 'bg-accent-soft font-medium text-fg' : 'text-fg hover:bg-surface'}`

  return (
    <div>
      <PageHeader title="Leaderboard" summary="How you are doing against friends and study groups. This week starts again every Monday." />

      <div ref={rowRef} data-more={rowMore || undefined} role="group" aria-label="Boards"
        className="no-scrollbar -mx-4 mb-4 flex items-center gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        <button type="button" className={chip(current === FRIENDS)} aria-pressed={current === FRIENDS} onClick={() => setTab(FRIENDS)}>Friends</button>
        {(groups ?? []).map(g => (
          <button key={g.id} type="button" className={chip(current === g.id)} aria-pressed={current === g.id} onClick={() => setTab(g.id)}>{g.name}</button>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section aria-label="Board" className="min-w-0 space-y-4">
          {noFriends ? (
            <EmptyState icon={Trophy} tone="a" title="Add your first friend"
              body={`Send them your code, ${profile.friend_code}, or your link. Once they accept, you will see each other here.`}>
              <button type="button" className="btn" onClick={async () => toast(await copyText(profile.friend_code) ? 'Code copied.' : 'Couldn\'t copy.')}>Copy code</button>
            </EmptyState>
          ) : (
            <>
              <ViewSwitch value={view} onChange={setView} />
              {ranked ? <Board rows={ranked} view={view} label={group ? `${group.name} board` : 'Friends board'} />
                : <div className="card py-10 text-center text-sm text-muted">{failed ? 'Couldn\'t load the board. Check your connection.' : 'Loading the board…'}</div>}
            </>
          )}
          {profile.show_on_boards === false && (
            <p className="text-sm text-muted">Others do not see your numbers. <Link href="/settings?section=privacy" className="font-medium text-accent underline-offset-2 hover:underline">Change in Settings</Link></p>
          )}
        </section>

        <aside aria-label="Friends and groups" className="min-w-0 space-y-5">
          {current === FRIENDS && friends !== null && <FriendsPanel friends={friends} requests={requests} onChange={reloadFriends} />}
          {groups !== null && <GroupsPanel groups={groups} selected={group} onSelect={id => setTab(id ?? FRIENDS)} onChange={reloadGroups} />}
        </aside>
      </div>
    </div>
  )
}
