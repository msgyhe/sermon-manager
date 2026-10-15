import { useEffect, useState } from 'react'
import { initialData } from './data'
import type { AppData } from './types'

const STORAGE_KEY = 'word-and-prayer-data-v1'

function migrateData(data: Partial<AppData>): AppData {
  return {
    sermons: data.sermons ?? initialData.sermons,
    prayers: data.prayers ?? initialData.prayers,
    services: data.services ?? initialData.services,
    versions: data.versions ?? [],
    usageRecords: data.usageRecords ?? [],
    trash: data.trash ?? [],
    templates: data.templates ?? initialData.templates,
    materials: data.materials ?? [],
    attachments: data.attachments ?? [],
  }
}

function loadData(): AppData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? migrateData(JSON.parse(saved) as Partial<AppData>) : initialData
  } catch {
    return initialData
  }
}

export function useAppData() {
  const [data, setData] = useState<AppData>(loadData)
  const [savedAt, setSavedAt] = useState<string>('')
  const [desktopReady, setDesktopReady] = useState(!window.sermonDesktop)

  useEffect(() => {
    if (!window.sermonDesktop) return
    window.sermonDesktop.loadData().then((saved) => {
      if (saved) setData(migrateData(saved))
      setDesktopReady(true)
    })
  }, [])

  useEffect(() => {
    if (!desktopReady) return
    const timer = window.setTimeout(() => {
      const save = window.sermonDesktop ? window.sermonDesktop.saveData(data) : Promise.resolve(localStorage.setItem(STORAGE_KEY, JSON.stringify(data)))
      save.then(() => setSavedAt(new Date().toISOString()))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [data, desktopReady])

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `말씀과기도-백업-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importBackup = async (file: File) => {
    const parsed = JSON.parse(await file.text()) as Partial<AppData>
    if (!Array.isArray(parsed.sermons) || !Array.isArray(parsed.prayers) || !Array.isArray(parsed.services)) {
      throw new Error('올바른 백업 파일이 아닙니다.')
    }
    setData(migrateData(parsed))
  }

  return { data, setData, savedAt, exportBackup, importBackup }
}
