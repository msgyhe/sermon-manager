export type View = 'dashboard' | 'sermons' | 'prayers' | 'services' | 'materials' | 'search' | 'trash'
export type DocumentStatus = '초안' | '검토 중' | '확정' | '보관'

export interface MinistryDocument {
  id: string
  type: 'sermon' | 'prayer'
  title: string
  content: string
  status: DocumentStatus
  scripture: string
  tags: string[]
  updatedAt: string
  serviceId?: string
}

export interface DocumentVersion {
  id: string
  documentId: string
  createdAt: string
  label: string
  snapshot: MinistryDocument
}

export interface UsageRecord {
  id: string
  documentId: string
  serviceId: string
  usedAt: string
  snapshot: MinistryDocument
}

export interface TrashedDocument {
  deletedAt: string
  document: MinistryDocument
}

export interface DocumentTemplate {
  id: string
  type: 'sermon' | 'prayer'
  name: string
  description: string
  content: string
}

export interface Material {
  id: string
  title: string
  category: '본문 연구' | '예화' | '공통 문장' | '참고 자료'
  content: string
  tags: string[]
  updatedAt: string
}

export interface Attachment {
  id: string
  documentId: string
  name: string
  path: string
  size: number
  addedAt: string
}

export interface Sermon extends MinistryDocument {
  type: 'sermon'
  audience: string
  theme: string
}

export interface Prayer extends MinistryDocument {
  type: 'prayer'
  prayerType: string
  targetMinutes: number
}

export interface WorshipService {
  id: string
  title: string
  date: string
  time: string
  theme: string
  scripture: string
  requiredDocuments: Array<'sermon' | 'prayer'>
}

export interface AppData {
  sermons: Sermon[]
  prayers: Prayer[]
  services: WorshipService[]
  versions: DocumentVersion[]
  usageRecords: UsageRecord[]
  trash: TrashedDocument[]
  templates: DocumentTemplate[]
  materials: Material[]
  attachments: Attachment[]
}
