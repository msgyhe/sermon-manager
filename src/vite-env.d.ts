/// <reference types="vite/client" />

import type { AppData, Attachment, MinistryDocument } from './types'

declare global {
  interface Window {
    sermonDesktop?: {
      loadData: () => Promise<Partial<AppData> | null>
      saveData: (data: AppData) => Promise<boolean>
      exportDocx: (document: MinistryDocument) => Promise<string | null>
      addAttachment: (documentId: string) => Promise<Attachment | null>
      deleteAttachment: (attachment: Attachment) => Promise<boolean>
      openAttachment: (path: string) => Promise<string>
      importDocument: () => Promise<{ title: string; content: string } | null>
      getAIKeyStatus: () => Promise<boolean>
      setAIKey: (key: string) => Promise<boolean>
      testAIKey: () => Promise<boolean>
      clearAIKey: () => Promise<boolean>
      generateAI: (request: { provider?: 'api' | 'chatgpt'; model: string; input: string }) => Promise<string>
      validateAI: (request: { provider?: 'api' | 'chatgpt'; model: string; input: string }) => Promise<{
        overall_score: number
        passed: boolean
        summary: string
        checks: Array<{ category: string; status: 'pass' | 'warning' | 'fail'; finding: string; recommendation: string }>
        questions: string[]
      }>
      getChatGPTStatus: () => Promise<ChatGPTConnection>
      signInWithChatGPT: () => Promise<ChatGPTConnection>
      disconnectChatGPT: () => Promise<boolean>
      createBackup: () => Promise<string | null>
      getUpdateStatus: () => Promise<UpdateStatus>
      checkForUpdates: () => Promise<boolean>
      downloadUpdate: () => Promise<boolean>
      installUpdate: () => Promise<boolean>
      onUpdateStatus: (listener: (status: UpdateStatus) => void) => () => void
    }
  }
}

interface UpdateStatus {
  stage: 'idle' | 'checking' | 'available' | 'current' | 'downloading' | 'ready' | 'error'
  currentVersion?: string
  version?: string
  configured?: boolean
  percent?: number
  transferred?: number
  total?: number
  message: string
}

interface ChatGPTConnection {
  session: {
    status: 'disconnected' | 'connecting' | 'connected' | 'reauth_required'
    sharing: boolean
    identity?: { name?: string; email?: string }
    error?: { message: string }
  }
  models: Array<{ slug: string; displayName: string }>
}
