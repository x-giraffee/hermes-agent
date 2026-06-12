import { atom, computed } from 'nanostores'

import { $subagentsBySession, type SubagentProgress } from './subagents'

/**
 * Unified, typed status feed for the composer status stack.
 *
 * Everything the stack shows is one flat `ComposerStatusItem[]` per session,
 * each carrying a `type` so the stack can group it magically. Subagents are
 * mirrored from the overlay's store (still the source of truth for the Agents
 * view); background work is owned here. The merged view is a derived/computed
 * atom, so the stack has a single thing to read and never juggles sources.
 */
export type StatusItemState = 'done' | 'failed' | 'running'
export type StatusItemType = 'background' | 'subagent'

export interface ComposerStatusItem {
  /** background: non-zero exit shown inline when failed. */
  exitCode?: number
  /** subagent: active tool label shown on the right. */
  currentTool?: string
  id: string
  /** background process: captured stdout/stderr tail for the inline viewer. */
  output?: string
  state: StatusItemState
  title: string
  type: StatusItemType
}

// Writable source for background work (`/background` runs + bg terminal procs).
export const $backgroundStatusBySession = atom<Record<string, ComposerStatusItem[]>>({})

const subToItem = (s: SubagentProgress): ComposerStatusItem => ({
  currentTool: s.currentTool,
  id: s.id,
  state: 'running',
  title: s.goal,
  type: 'subagent'
})

// The single thing the stack reads: a typed, merged item list per session.
export const $statusItemsBySession = computed([$subagentsBySession, $backgroundStatusBySession], (subs, background) => {
  const out: Record<string, ComposerStatusItem[]> = {}

  const push = (sid: string, items: ComposerStatusItem[]) => {
    if (items.length > 0) {
      out[sid] = out[sid] ? [...out[sid], ...items] : items
    }
  }

  for (const [sid, list] of Object.entries(subs)) {
    push(sid, list.filter(s => s.status === 'running' || s.status === 'queued').map(subToItem))
  }

  for (const [sid, list] of Object.entries(background)) {
    push(sid, list)
  }

  return out
})

// Fixed render order for the groups in the stack (top → bottom, above queue).
const TYPE_ORDER: readonly StatusItemType[] = ['subagent', 'background']

export interface StatusGroup {
  items: ComposerStatusItem[]
  type: StatusItemType
}

export function groupStatusItems(items: readonly ComposerStatusItem[]): StatusGroup[] {
  const byType = new Map<StatusItemType, ComposerStatusItem[]>()

  for (const item of items) {
    const list = byType.get(item.type)

    if (list) {
      list.push(item)
    } else {
      byType.set(item.type, [item])
    }
  }

  return TYPE_ORDER.filter(type => byType.has(type)).map(type => ({ items: byType.get(type)!, type }))
}

const writeBackground = (sid: string, items: ComposerStatusItem[]) => {
  const current = $backgroundStatusBySession.get()
  const next = { ...current }

  if (items.length > 0) {
    next[sid] = items
  } else {
    delete next[sid]
  }

  $backgroundStatusBySession.set(next)
}

export function upsertBackgroundStatus(sid: string, item: ComposerStatusItem) {
  const list = $backgroundStatusBySession.get()[sid] ?? []
  const idx = list.findIndex(existing => existing.id === item.id)

  writeBackground(sid, idx >= 0 ? list.map((existing, i) => (i === idx ? item : existing)) : [...list, item])
}

export function removeBackgroundStatus(sid: string, id: string) {
  const list = $backgroundStatusBySession.get()[sid] ?? []

  writeBackground(
    sid,
    list.filter(item => item.id !== id)
  )
}

export function clearBackgroundStatus(sid: string) {
  writeBackground(sid, [])
}
