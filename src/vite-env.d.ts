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
      generateAI: (request: { model: string; input: string }) => Promise<string>
      validateAI: (request: { model: string; input: string }) => Promise<{
        overall_score: number
        passed: boolean
        summary: string
        checks: Array<{ category: string; status: 'pass' | 'warning' | 'fail'; finding: string; recommendation: string }>
        questions: string[]
      }>
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
