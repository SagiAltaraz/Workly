import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  workspaceApi,
  type MeetingPatch,
  type NewMeeting,
  type NewTask,
  type StageMap,
  type TaskPatch,
} from '../api/workspaceApi'
import type { BriefFieldKey } from '../types/brief'
import type { CommandResult, ResolvedCommand } from '../types/command'
import type { Workspace } from '../types/workspace'

const idKey = 'workly.workspaceId'
const referenceKey = 'workly.userReferenceDate'
// Present only while looking at the demo: the workspace to go back to. Its presence *is* "in demo mode".
const beforeDemoKey = 'workly.beforeDemoWorkspaceId'

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // the workspace still works for this visit without storage
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'משהו השתבש'
}

export type Phase = 'loading' | 'ready' | 'failed'

// A line shown for a few seconds. When it reports a change, it offers to undo it.
export interface Notice {
  text: string
  undoable: boolean
}

interface MutateOptions {
  // Say what changed, with an undo button. Used for changes that are easy to regret.
  announce?: boolean
}

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [bootError, setBootError] = useState<string | null>(null)
  const [modelConfigured, setModelConfigured] = useState(true)
  const [resumed, setResumed] = useState(false)
  const [stages, setStages] = useState<StageMap>({})
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [commandResults, setCommandResults] = useState<CommandResult[]>([])
  const [notice, setNotice] = useState<Notice | null>(null)
  const [userReferenceDate, setUserReferenceDateState] = useState<string | null>(() => readStorage(referenceKey))
  const [isDemo, setIsDemo] = useState(() => readStorage(beforeDemoKey) !== null)
  const [demoLoading, setDemoLoading] = useState(false)
  const booted = useRef(false)

  const adopt = useCallback((next: Workspace) => {
    setWorkspace(next)
    writeStorage(idKey, next.id)
  }, [])

  useEffect(() => {
    if (booted.current) return
    booted.current = true

    async function boot() {
      try {
        const health = await workspaceApi.health()
        setModelConfigured(health.modelConfigured)

        const params = new URLSearchParams(window.location.search)
        const wanted = params.get('workspace') ?? readStorage(idKey)
        let loaded: Workspace | null = null
        if (wanted) {
          loaded = await workspaceApi.get(wanted).catch((error) => {
            if (error instanceof ApiError && error.status === 404) return null
            throw error
          })
        }
        if (params.has('workspace')) window.history.replaceState(null, '', window.location.pathname)

        setResumed(loaded !== null && loaded.sources.length > 0)
        adopt(loaded ?? (await workspaceApi.create()))
        setPhase('ready')
      } catch (error) {
        setBootError(messageOf(error))
        setPhase('failed')
      }
    }
    void boot()
  }, [adopt])

  const analyze = useCallback(
    async (text: string) => {
      if (!workspace || running) return
      setRunning(true)
      setRunError(null)
      setStages({})
      setCommandResults([])
      try {
        const outcome = await workspaceApi.analyze(workspace.id, text, userReferenceDate, (event) =>
          setStages((current) => ({ ...current, [event.stage]: event })),
        )
        adopt(outcome.workspace)
        setCommandResults(outcome.commandResults)
      } catch (error) {
        setRunError(messageOf(error))
      } finally {
        setRunning(false)
      }
    },
    [adopt, running, userReferenceDate, workspace],
  )

  // Every card action goes through here: call the server, show the new state, or say what failed.
  const mutate = useCallback(
    async (change: (id: string) => Promise<Workspace>, options: MutateOptions = {}) => {
      if (!workspace) return false
      try {
        const next = await change(workspace.id)
        adopt(next)
        if (options.announce) setNotice({ text: next.activity.at(-1)?.label ?? 'בוצע', undoable: true })
        return true
      } catch (error) {
        setNotice({ text: messageOf(error), undoable: false })
        return false
      }
    },
    [adopt, workspace],
  )

  return {
    workspace,
    phase,
    bootError,
    modelConfigured,
    resumed,
    stages,
    running,
    runError,
    commandResults,
    notice,
    userReferenceDate,
    analyze,
    dismissNotice: () => setNotice(null),
    showNotice: (text: string) => setNotice({ text, undoable: false }),
    setUserReferenceDate: (date: string | null) => {
      setUserReferenceDateState(date)
      writeStorage(referenceKey, date)
    },

    addTask: (task: NewTask) => mutate((id) => workspaceApi.addTask(id, task)),
    patchTask: (taskId: string, patch: TaskPatch) => mutate((id) => workspaceApi.patchTask(id, taskId, patch)),
    orderCards: (ids: string[]) => mutate((id) => workspaceApi.setCardOrder(id, ids), { announce: true }),

    // Moving a card is visible on the board, but easy to regret, so it offers to undo.
    moveTask: (taskId: string, patch: TaskPatch) =>
      mutate((id) => workspaceApi.patchTask(id, taskId, patch), { announce: true }),
    moveMeeting: (meetingId: string, patch: MeetingPatch) =>
      mutate((id) => workspaceApi.patchMeeting(id, meetingId, patch), { announce: true }),
    deleteTask: (taskId: string) => mutate((id) => workspaceApi.deleteTask(id, taskId), { announce: true }),
    restoreTask: (taskId: string) => mutate((id) => workspaceApi.restoreTask(id, taskId)),

    addMeeting: (meeting: NewMeeting) => mutate((id) => workspaceApi.addMeeting(id, meeting)),
    patchMeeting: (meetingId: string, patch: MeetingPatch) =>
      mutate((id) => workspaceApi.patchMeeting(id, meetingId, patch)),
    deleteMeeting: (meetingId: string) => mutate((id) => workspaceApi.deleteMeeting(id, meetingId), { announce: true }),
    restoreMeeting: (meetingId: string) => mutate((id) => workspaceApi.restoreMeeting(id, meetingId)),

    addBrief: () => mutate((id) => workspaceApi.addBrief(id)),
    patchBriefField: (briefId: string, key: BriefFieldKey, value: string | null) =>
      mutate((id) => workspaceApi.patchBriefField(id, briefId, key, value)),
    addBriefItem: (briefId: string | null, list: 'deliverables' | 'constraints', text: string) =>
      mutate((id) => workspaceApi.addBriefItem(id, briefId, list, text)),
    editBriefItem: (itemId: string, text: string) => mutate((id) => workspaceApi.editBriefItem(id, itemId, text)),
    deleteBriefItem: (itemId: string) => mutate((id) => workspaceApi.deleteBriefItem(id, itemId), { announce: true }),
    promoteSuggestion: (itemId: string, into: 'deliverables' | 'constraints') =>
      mutate((id) => workspaceApi.promoteSuggestion(id, itemId, into)),
    answerMissingDetail: (itemId: string, answer: string) =>
      mutate((id) => workspaceApi.answerMissingDetail(id, itemId, answer)),

    resolveContradiction: (contradictionId: string, choice: 'keepExisting' | 'useIncoming') =>
      mutate((id) => workspaceApi.resolveContradiction(id, contradictionId, choice)),
    dismissQuestion: (questionId: string) => mutate((id) => workspaceApi.dismissQuestion(id, questionId), { announce: true }),

    // An instruction that named several possible items, once the person picked one.
    chooseCommandTarget: async (result: CommandResult, targetId: string) => {
      if (!result.command) return false
      const command: ResolvedCommand = result.command
      const done = await mutate((id) => workspaceApi.executeCommand(id, command, targetId), { announce: true })
      if (done) setCommandResults((current) => current.filter((item) => item !== result))
      return done
    },

    undo: async () => {
      if (!workspace) return
      try {
        adopt(await workspaceApi.undo(workspace.id))
        setNotice(null)
        setCommandResults([])
      } catch (error) {
        setNotice({ text: messageOf(error), undoable: false })
      }
    },

    isDemo,
    demoLoading,
    // First click: remember the current workspace, switch to the demo (seeded once from the
    // assignment's own texts, cached after that). Second click: switch back to what was remembered.
    toggleDemo: async () => {
      if (demoLoading) return
      setDemoLoading(true)
      try {
        const before = readStorage(beforeDemoKey)
        if (before === null) {
          // Fetch first; only remember "before" and flip the flag once the demo actually loaded.
          const demo = await workspaceApi.demo()
          if (workspace) writeStorage(beforeDemoKey, workspace.id)
          adopt(demo)
          setIsDemo(true)
        } else {
          const restored = await workspaceApi.get(before).catch((error) => {
            if (error instanceof ApiError && error.status === 404) return null
            throw error
          })
          adopt(restored ?? (await workspaceApi.create()))
          writeStorage(beforeDemoKey, null)
          setIsDemo(false)
        }
      } catch (error) {
        setNotice({ text: messageOf(error), undoable: false })
      } finally {
        setDemoLoading(false)
      }
    },

    startOver: async () => {
      try {
        setStages({})
        setRunError(null)
        setResumed(false)
        setCommandResults([])
        adopt(await workspaceApi.create())
      } catch (error) {
        setNotice({ text: messageOf(error), undoable: false })
      }
    },
  }
}

export type WorkspaceApp = ReturnType<typeof useWorkspace>
