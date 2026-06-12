import { clearBackgroundStatus, upsertBackgroundStatus } from '@/store/composer-status'
import { $activeSessionId, $selectedStoredSessionId } from '@/store/session'
import { clearSessionSubagents, upsertSubagent } from '@/store/subagents'

/**
 * Dev-only helpers for stress-testing the composer status stack without a real
 * delegation/background run. Exposed on `window.__hermesStatusMocks` in dev:
 *
 *   __hermesStatusMocks.seed()   // populate the active session
 *   __hermesStatusMocks.clear()  // tear it down
 *
 * Not bundled in production (imported behind an `import.meta.env.DEV` guard).
 */

// Mirror the composer's key resolution (selectedStoredSessionId || activeSessionId)
// so seeded data lands on the key the status stack reads.
const composerSessionKey = () => $selectedStoredSessionId.get() ?? $activeSessionId.get()

function seed(sessionId?: string) {
  const sid = sessionId ?? composerSessionKey()

  if (!sid) {
    console.warn('[status-mocks] no active session — open a chat first')

    return
  }

  upsertSubagent(
    sid,
    {
      goal: 'Audit auth middleware for token leaks',
      status: 'running',
      subagent_id: 'mock-sub-1',
      task_count: 3,
      task_index: 0,
      tool_name: 'search_files'
    },
    true,
    'subagent.start'
  )
  upsertSubagent(
    sid,
    {
      goal: 'Draft migration for the sessions table',
      status: 'running',
      subagent_id: 'mock-sub-2',
      task_count: 3,
      task_index: 1,
      tool_name: 'read_file'
    },
    true,
    'subagent.start'
  )

  upsertBackgroundStatus(sid, {
    id: 'mock-bg-1',
    output: [
      '$ vitest --run',
      ' RUN  v4.1.5',
      '',
      ' ✓ src/store/composer-status.test.ts (6)',
      ' ✓ src/lib/desktop-slash-commands.test.ts (12)',
      ' ❯ src/app/chat/composer/queue-panel.test.tsx (3)',
      '   running…'
    ].join('\n'),
    state: 'running',
    title: 'npm test',
    type: 'background'
  })
  upsertBackgroundStatus(sid, {
    id: 'mock-bg-2',
    state: 'running',
    title: 'Research caching strategies',
    type: 'background'
  })
  upsertBackgroundStatus(sid, {
    exitCode: 1,
    id: 'mock-bg-3',
    output: [
      '$ npm run build',
      'vite v8.0.10 building for production...',
      'transforming...',
      'src/app/chat/composer/index.tsx:1782:12 - error TS2304:',
      "  Cannot find name 'COMPOSER_FADE_BACKGROUND'.",
      '',
      'ERROR: build failed with 1 error',
      'exit code 1'
    ].join('\n'),
    state: 'failed',
    title: 'Production build',
    type: 'background'
  })

  console.info('[status-mocks] seeded subagents + background tasks for', sid)
}

function clear(sessionId?: string) {
  const sid = sessionId ?? composerSessionKey()

  clearSessionSubagents(sid ?? '')
  clearBackgroundStatus(sid ?? '')
  console.info('[status-mocks] cleared', sid)
}

export function installStatusStackDevMocks() {
  if (typeof window === 'undefined') {
    return
  }

  ;(window as unknown as { __hermesStatusMocks?: unknown }).__hermesStatusMocks = { clear, seed }
}
