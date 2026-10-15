import { useEffect, useMemo, useState } from 'react'
import {
  BookOpenText,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronRight,
  CirclePlus,
  Clock3,
  FileText,
  History,
  Library,
  LayoutDashboard,
  Menu,
  Mic2,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  Download,
  RotateCcw,
  Printer,
  Columns2,
  Save,
  Paperclip,
  FileDown,
  FolderOpen,
  FileInput,
  WandSparkles,
  ShieldCheck,
  AlertTriangle,
  X,
} from 'lucide-react'
import { useAppData } from './store'
import type { AppData, Attachment, DocumentStatus, DocumentTemplate, DocumentVersion, Material, MinistryDocument, Prayer, Sermon, View, WorshipService } from './types'

const navItems: Array<{ view: View; label: string; icon: typeof LayoutDashboard }> = [
  { view: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { view: 'sermons', label: '설교문', icon: BookOpenText },
  { view: 'prayers', label: '기도문', icon: FileText },
  { view: 'services', label: '예배 일정', icon: CalendarDays },
  { view: 'materials', label: '자료실', icon: Library },
  { view: 'search', label: '통합 검색', icon: Search },
  { view: 'trash', label: '휴지통', icon: Trash2 },
]

const statusOptions: DocumentStatus[] = ['초안', '검토 중', '확정', '보관']
const prayerTypes = ['대표기도', '예배 시작기도', '설교 전 기도', '설교 후 결단기도', '헌금기도', '중보기도', '심방기도', '절기·행사기도']

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(value))
}

function relativeDate(value: string) {
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)
  if (days === 0) return '오늘'
  if (days > 0) return `${days}일 후`
  return `${Math.abs(days)}일 전`
}

function analyzeWriting(content: string) {
  const sentences = content.split(/[.!?。]|\n/).map((item) => item.trim()).filter(Boolean)
  const longSentences = sentences.filter((sentence) => sentence.length >= 90)
  const words = content.match(/[가-힣]{2,}/g) ?? []
  const counts = words.reduce<Record<string, number>>((result, word) => ({ ...result, [word]: (result[word] ?? 0) + 1 }), {})
  const repeated = Object.entries(counts).filter(([, count]) => count >= 4).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return { longSentences, repeated }
}

export default function App() {
  const { data, setData, savedAt, exportBackup, importBackup } = useAppData()
  const [view, setView] = useState<View>('dashboard')
  const [editing, setEditing] = useState<MinistryDocument | null>(null)
  const [serviceModal, setServiceModal] = useState(false)
  const [backupModal, setBackupModal] = useState(false)
  const [reading, setReading] = useState<MinistryDocument | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const saveDocument = (document: MinistryDocument) => {
    setData((current) => {
      if (document.type === 'sermon') {
        const sermons = current.sermons.some((item) => item.id === document.id)
          ? current.sermons.map((item) => item.id === document.id ? document as Sermon : item)
          : [document as Sermon, ...current.sermons]
        return { ...current, sermons }
      }
      const prayers = current.prayers.some((item) => item.id === document.id)
        ? current.prayers.map((item) => item.id === document.id ? document as Prayer : item)
        : [document as Prayer, ...current.prayers]
      return { ...current, prayers }
    })
    setEditing(document)
  }

  const createDocument = (type: 'sermon' | 'prayer', serviceId?: string) => {
    const base = {
      id: uid(type),
      title: type === 'sermon' ? '새 설교문' : '새 기도문',
      content: '',
      status: '초안' as DocumentStatus,
      scripture: '',
      tags: [],
      updatedAt: new Date().toISOString(),
      serviceId,
    }
    const nextDocument: Sermon | Prayer = type === 'sermon'
      ? { ...base, type: 'sermon', audience: '장년', theme: '' }
      : { ...base, type: 'prayer', prayerType: '대표기도', targetMinutes: 3 }
    setEditing(nextDocument)
  }

  const addService = (service: WorshipService) => {
    setData((current) => ({ ...current, services: [service, ...current.services] }))
    setServiceModal(false)
    setView('services')
  }

  const saveVersion = (document: MinistryDocument, label: string) => {
    const version: DocumentVersion = { id: uid('version'), documentId: document.id, createdAt: new Date().toISOString(), label, snapshot: structuredClone(document) }
    setData((current) => ({ ...current, versions: [version, ...current.versions] }))
  }

  const moveToTrash = (document: MinistryDocument) => {
    setData((current) => ({
      ...current,
      sermons: current.sermons.filter((item) => item.id !== document.id),
      prayers: current.prayers.filter((item) => item.id !== document.id),
      trash: [{ deletedAt: new Date().toISOString(), document: structuredClone(document) }, ...current.trash],
    }))
    setEditing(null)
  }

  const markUsed = (document: MinistryDocument, serviceId: string) => {
    setData((current) => ({ ...current, usageRecords: [{ id: uid('usage'), documentId: document.id, serviceId, usedAt: new Date().toISOString(), snapshot: structuredClone(document) }, ...current.usageRecords] }))
  }

  const saveTemplate = (template: DocumentTemplate) => {
    setData((current) => ({ ...current, templates: [template, ...current.templates] }))
  }

  const addAttachment = async (documentId: string) => {
    if (!window.sermonDesktop) {
      window.alert('파일 첨부는 데스크톱 앱에서 사용할 수 있습니다.')
      return
    }
    const attachment = await window.sermonDesktop.addAttachment(documentId)
    if (attachment) setData((current) => ({ ...current, attachments: [attachment, ...current.attachments] }))
  }

  const deleteAttachment = async (attachment: Attachment) => {
    if (!window.sermonDesktop || !window.confirm(`“${attachment.name}” 첨부 파일을 삭제할까요?`)) return
    await window.sermonDesktop.deleteAttachment(attachment)
    setData((current) => ({ ...current, attachments: current.attachments.filter((item) => item.id !== attachment.id) }))
  }

  const importDocument = async () => {
    if (!window.sermonDesktop) {
      window.alert('원고 가져오기는 데스크톱 앱에서 사용할 수 있습니다.')
      return
    }
    const imported = await window.sermonDesktop.importDocument()
    if (!imported) return
    const importedSermon: Sermon = { id: uid('sermon'), type: 'sermon', title: imported.title, content: imported.content, status: '초안', scripture: '', tags: ['가져온 원고'], updatedAt: new Date().toISOString(), audience: '장년', theme: '' }
    setEditing(importedSermon)
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">말</div>
          <div><strong>말씀과 기도</strong><span>Ministry workspace</span></div>
          <button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기"><X size={20} /></button>
        </div>
        <nav>
          {navItems.map((item) => (
            <button key={item.view} className={view === item.view ? 'active' : ''} onClick={() => { setView(item.view); setEditing(null); setSidebarOpen(false) }}>
              <item.icon size={19} strokeWidth={1.8} /><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Sparkles size={18} />
          <p>모든 원고는 이 기기에<br />자동으로 저장됩니다.</p>
        </div>
        <button className="settings-button" onClick={() => setBackupModal(true)}><Settings size={18} /> 데이터 관리</button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={22} /></button>
          <div className="save-state"><span className="save-dot" /> {savedAt ? '모든 변경사항 저장됨' : '로컬 저장 준비됨'}</div>
          <div className="top-actions">
            <button className="button ghost" onClick={importDocument}><FileInput size={17} /> 원고 가져오기</button>
            <button className="button ghost" onClick={() => setServiceModal(true)}><CalendarDays size={17} /> 예배 등록</button>
            <button className="button primary" onClick={() => createDocument(view === 'prayers' ? 'prayer' : 'sermon')}><Plus size={17} /> 새 원고</button>
          </div>
        </header>

        <div className="page-content">
          {editing ? (
            <Editor document={editing} services={data.services} versions={data.versions.filter((item) => item.documentId === editing.id)} templates={data.templates.filter((item) => item.type === editing.type)} attachments={data.attachments.filter((item) => item.documentId === editing.id)} onSave={saveDocument} onVersion={saveVersion} onSaveTemplate={saveTemplate} onAddAttachment={addAttachment} onDeleteAttachment={deleteAttachment} onRead={setReading} onTrash={moveToTrash} onClose={() => setEditing(null)} />
          ) : view === 'dashboard' ? (
            <Dashboard data={data} onNavigate={setView} onCreate={createDocument} onOpen={setEditing} onService={() => setServiceModal(true)} />
          ) : view === 'sermons' ? (
            <DocumentList title="설교문" description="말씀을 준비하고, 사용한 원고를 사역의 자산으로 남깁니다." documents={data.sermons} onCreate={() => createDocument('sermon')} onOpen={setEditing} />
          ) : view === 'prayers' ? (
            <DocumentList title="기도문" description="예배와 상황에 맞는 기도를 차분하게 준비합니다." documents={data.prayers} onCreate={() => createDocument('prayer')} onOpen={setEditing} />
          ) : view === 'services' ? (
            <Services data={data} onCreate={() => setServiceModal(true)} onDocument={createDocument} onUsed={markUsed} />
          ) : view === 'materials' ? (
            <Materials data={data} setData={setData} />
          ) : view === 'search' ? (
            <SearchView data={data} onOpen={setEditing} />
          ) : (
            <TrashView data={data} setData={setData} />
          )}
        </div>
      </section>

      {serviceModal && <ServiceModal onClose={() => setServiceModal(false)} onSave={addService} />}
      {backupModal && <BackupModal onClose={() => setBackupModal(false)} onExport={exportBackup} onImport={importBackup} />}
      {reading && <Reader document={reading} onClose={() => setReading(null)} />}
    </main>
  )
}

function Dashboard({ data, onNavigate, onCreate, onOpen, onService }: {
  data: AppData
  onNavigate: (view: View) => void
  onCreate: (type: 'sermon' | 'prayer', serviceId?: string) => void
  onOpen: (document: MinistryDocument) => void
  onService: () => void
}) {
  const nextService = [...data.services].filter((item) => new Date(item.date).getTime() >= new Date().setHours(0, 0, 0, 0)).sort((a, b) => a.date.localeCompare(b.date))[0]
  const documents = [...data.sermons, ...data.prayers].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const linked = nextService ? documents.filter((item) => item.serviceId === nextService.id) : []
  const ready = linked.filter((item) => item.status === '확정').length
  const progress = linked.length ? Math.round((ready / nextService!.requiredDocuments.length) * 100) : 0

  return (
    <div className="page dashboard-page">
      <section className="welcome">
        <div>
          <p className="eyebrow">오늘의 사역 준비</p>
          <h1>말씀을 준비하고,<br /><em>기도로 이어가세요.</em></h1>
        </div>
        <p className="welcome-copy">흩어진 원고와 일정을 한곳에 모아, 이번 예배부터 다음 사역까지 차분하게 준비합니다.</p>
      </section>

      <section className="quick-actions">
        <button onClick={() => onCreate('sermon')}><span><BookOpenText /></span><b>새 설교문</b><small>본문부터 차분히 시작하기</small><ChevronRight /></button>
        <button onClick={() => onCreate('prayer')}><span><FileText /></span><b>새 기도문</b><small>종류와 목표 시간으로 시작</small><ChevronRight /></button>
        <button onClick={onService}><span><CalendarDays /></span><b>예배 등록</b><small>원고 준비 목록 만들기</small><ChevronRight /></button>
      </section>

      <section className="dashboard-grid">
        <article className="next-service-card">
          <div className="card-heading"><div><p className="eyebrow">다가오는 예배</p><h2>{nextService?.title ?? '등록된 예배가 없습니다'}</h2></div>{nextService && <span className="date-chip">{relativeDate(nextService.date)}</span>}</div>
          {nextService ? <>
            <div className="service-date"><strong>{formatDate(nextService.date)}</strong><span>{nextService.time} · {nextService.theme || '주제 미정'}</span></div>
            <div className="progress-row"><div><span>준비 상태</span><b>{progress}%</b></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>
            <div className="linked-documents">
              {linked.map((item) => <button key={item.id} onClick={() => onOpen(item)}><span className={`document-icon ${item.type}`}><FileText size={17} /></span><span><b>{item.title}</b><small>{item.type === 'sermon' ? '설교문' : (item as Prayer).prayerType}</small></span><StatusBadge status={item.status} /></button>)}
              {linked.length < nextService.requiredDocuments.length && <button className="add-linked" onClick={() => onCreate(linked.some((item) => item.type === 'sermon') ? 'prayer' : 'sermon', nextService.id)}><CirclePlus size={18} /> 필요한 원고 추가하기</button>}
            </div>
          </> : <EmptyState text="먼저 예배를 등록해 준비 목록을 만들어보세요." action="예배 등록" onClick={onService} />}
        </article>

        <article className="ministry-focus">
          <p className="eyebrow">이번 주의 초점</p>
          <blockquote>“항상 기뻐하라.<br />쉬지 말고 기도하라.<br /><em>범사에 감사하라.</em>”</blockquote>
          <span>데살로니가전서 5:16-18</span>
        </article>

        <article className="recent-card">
          <div className="card-heading"><div><p className="eyebrow">최근 원고</p><h2>이어서 작성하기</h2></div><button className="text-button" onClick={() => onNavigate('search')}>모두 보기 <ChevronRight size={16} /></button></div>
          <div className="recent-list">
            {documents.slice(0, 4).map((item) => <button key={item.id} onClick={() => onOpen(item)}><span className={`document-icon ${item.type}`}><FileText size={18} /></span><span className="recent-main"><b>{item.title}</b><small>{item.scripture || (item.type === 'prayer' ? (item as Prayer).prayerType : '본문 미지정')}</small></span><StatusBadge status={item.status} /><small className="modified">{formatDate(item.updatedAt)}</small></button>)}
          </div>
        </article>

        <article className="archive-card">
          <div className="archive-number">{documents.length}</div>
          <p>차곡차곡 쌓인 원고</p>
          <span>설교 {data.sermons.length}편 · 기도 {data.prayers.length}편</span>
          <button onClick={() => onNavigate('search')}>원고 찾아보기 <Search size={16} /></button>
        </article>
      </section>
    </div>
  )
}

function DocumentList({ title, description, documents, onCreate, onOpen }: { title: string; description: string; documents: MinistryDocument[]; onCreate: () => void; onOpen: (document: MinistryDocument) => void }) {
  const [query, setQuery] = useState('')
  const filtered = documents.filter((item) => `${item.title} ${item.content} ${item.scripture} ${item.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="page list-page">
    <PageHeading title={title} description={description} action={`새 ${title.slice(0, -1)}`} onAction={onCreate} />
    <div className="list-toolbar"><label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${title} 검색`} /></label><span>{filtered.length}개의 원고</span></div>
    <div className="document-table">
      <div className="table-header"><span>제목</span><span>본문 · 종류</span><span>상태</span><span>최근 수정</span></div>
      {filtered.map((item) => <button className="table-row" key={item.id} onClick={() => onOpen(item)}><span className="title-cell"><span className={`document-icon ${item.type}`}><FileText size={18} /></span><b>{item.title}</b></span><span>{item.scripture || (item.type === 'prayer' ? (item as Prayer).prayerType : '미지정')}</span><StatusBadge status={item.status} /><span>{formatDate(item.updatedAt)}</span></button>)}
      {!filtered.length && <EmptyState text="조건에 맞는 원고가 없습니다." action={`새 ${title.slice(0, -1)} 작성`} onClick={onCreate} />}
    </div>
  </div>
}

function Services({ data, onCreate, onDocument, onUsed }: { data: AppData; onCreate: () => void; onDocument: (type: 'sermon' | 'prayer', serviceId?: string) => void; onUsed: (document: MinistryDocument, serviceId: string) => void }) {
  return <div className="page list-page"><PageHeading title="예배 일정" description="예배별로 필요한 말씀과 기도를 한눈에 준비합니다." action="예배 등록" onAction={onCreate} />
    <div className="service-list">{[...data.services].sort((a, b) => a.date.localeCompare(b.date)).map((service) => {
      const documents = [...data.sermons, ...data.prayers].filter((item) => item.serviceId === service.id)
      const ready = documents.filter((item) => item.status === '확정').length
      return <article key={service.id}><div className="service-calendar"><b>{new Date(service.date).getDate()}</b><span>{new Intl.DateTimeFormat('ko-KR', { month: 'short' }).format(new Date(service.date))}</span></div><div className="service-info"><span>{service.time} · {relativeDate(service.date)}</span><h3>{service.title}</h3><p>{service.theme || '주제 미정'} {service.scripture && `· ${service.scripture}`}</p></div><div className="service-docs"><span>{ready}/{service.requiredDocuments.length} 준비 완료</span><div>{documents.map((item) => <button className="use-document" key={item.id} disabled={data.usageRecords.some((record) => record.documentId === item.id && record.serviceId === service.id)} onClick={() => onUsed(item, service.id)}>{data.usageRecords.some((record) => record.documentId === item.id && record.serviceId === service.id) ? '사용본 보존됨' : `${item.title} 사용 완료`}</button>)}</div></div><button className="button ghost" onClick={() => onDocument(documents.some((item) => item.type === 'sermon') ? 'prayer' : 'sermon', service.id)}><Plus size={16} /> 원고 추가</button></article>
    })}</div>
  </div>
}

function SearchView({ data, onOpen }: { data: AppData; onOpen: (document: MinistryDocument) => void }) {
  const [query, setQuery] = useState('')
  const all = useMemo(() => [...data.sermons, ...data.prayers].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [data])
  const results = query.trim() ? all.filter((item) => `${item.title} ${item.content} ${item.scripture} ${item.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())) : all
  return <div className="page search-page"><div className="search-hero"><p className="eyebrow">통합 검색</p><h1>필요한 원고를 다시 발견하세요.</h1><label><Search size={23} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목, 본문, 주제, 태그로 검색" /></label></div><p className="result-count">{query ? `“${query}” 검색 결과 ${results.length}개` : `전체 원고 ${results.length}개`}</p><div className="search-results">{results.map((item) => <button key={item.id} onClick={() => onOpen(item)}><span className={`document-icon ${item.type}`}><FileText size={19} /></span><span><b>{item.title}</b><small>{item.content.slice(0, 90) || '작성된 내용이 없습니다.'}</small></span><span className="result-meta"><StatusBadge status={item.status} /><small>{formatDate(item.updatedAt)}</small></span></button>)}</div></div>
}

function Editor({ document, services, versions, templates, attachments, onSave, onVersion, onSaveTemplate, onAddAttachment, onDeleteAttachment, onRead, onTrash, onClose }: { document: MinistryDocument; services: WorshipService[]; versions: DocumentVersion[]; templates: DocumentTemplate[]; attachments: Attachment[]; onSave: (document: MinistryDocument) => void; onVersion: (document: MinistryDocument, label: string) => void; onSaveTemplate: (template: DocumentTemplate) => void; onAddAttachment: (documentId: string) => Promise<void>; onDeleteAttachment: (attachment: Attachment) => Promise<void>; onRead: (document: MinistryDocument) => void; onTrash: (document: MinistryDocument) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(document)
  const [versionLabel, setVersionLabel] = useState('')
  const [compareVersion, setCompareVersion] = useState<DocumentVersion | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const wordsPerMinute = 320
  const readingMinutes = Math.max(1, Math.ceil(draft.content.replace(/\s/g, '').length / wordsPerMinute))
  const writing = useMemo(() => analyzeWriting(draft.content), [draft.content])
  const update = (patch: Partial<MinistryDocument>) => {
    const next = { ...draft, ...patch, updatedAt: new Date().toISOString() } as MinistryDocument
    setDraft(next)
    onSave(next)
  }
  return <div className="editor-page">
    <div className="editor-top"><button className="text-button" onClick={onClose}>← 목록으로</button><div className="editor-actions"><span className="save-state"><span className="save-dot" /> 자동 저장</span><select value={draft.status} onChange={(event) => update({ status: event.target.value as DocumentStatus })}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select><button className="button ghost" onClick={() => { const label = versionLabel.trim() || `${versions.length + 1}번째 저장본`; onVersion(draft, label); setVersionLabel('') }}><History size={16} /> 버전 저장</button><button className="button ghost" onClick={() => window.sermonDesktop ? window.sermonDesktop.exportDocx(draft) : window.alert('DOCX 내보내기는 데스크톱 앱에서 사용할 수 있습니다.')}><FileDown size={16} /> DOCX</button><button className="button ai-button" onClick={() => setAiOpen(true)}><WandSparkles size={16} /> AI 보조</button><button className="button dark" onClick={() => onRead(draft)}><Mic2 size={16} /> 낭독 보기</button></div></div>
    <div className="editor-layout">
      <aside className="document-settings">
        <p className="eyebrow">원고 정보</p>
        <label>문서 유형<input value={draft.type === 'sermon' ? '설교문' : '기도문'} disabled /></label>
        <label>템플릿<select defaultValue="" onChange={(event) => { const template = templates.find((item) => item.id === event.target.value); if (template && window.confirm('현재 본문을 선택한 템플릿으로 바꿀까요?')) update({ content: template.content }); event.target.value = '' }}><option value="">템플릿 선택</option>{templates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}</select></label>
        {draft.type === 'sermon' ? <><label>핵심 주제<input value={(draft as Sermon).theme} onChange={(event) => update({ theme: event.target.value } as Partial<Sermon>)} placeholder="예: 감사" /></label><label>대상 회중<input value={(draft as Sermon).audience} onChange={(event) => update({ audience: event.target.value } as Partial<Sermon>)} /></label></> : <><label>기도 종류<select value={(draft as Prayer).prayerType} onChange={(event) => update({ prayerType: event.target.value } as Partial<Prayer>)}>{prayerTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label>목표 낭독 시간<input type="number" min="1" max="30" value={(draft as Prayer).targetMinutes} onChange={(event) => update({ targetMinutes: Number(event.target.value) } as Partial<Prayer>)} /></label></>}
        <label>성경 본문<input value={draft.scripture} onChange={(event) => update({ scripture: event.target.value })} placeholder="예: 요한복음 3:16" /></label>
        <label>연결 예배<select value={draft.serviceId ?? ''} onChange={(event) => update({ serviceId: event.target.value || undefined })}><option value="">연결하지 않음</option>{services.map((service) => <option value={service.id} key={service.id}>{service.title} · {formatDate(service.date)}</option>)}</select></label>
        <label>태그<input value={draft.tags.join(', ')} onChange={(event) => update({ tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} placeholder="감사, 주일예배" /></label>
        <div className="attachment-panel"><div><span>첨부 자료</span><button onClick={() => onAddAttachment(draft.id)}><Paperclip size={13} /> 추가</button></div>{attachments.map((attachment) => <div className="attachment-row" key={attachment.id}><button className="attachment-item" onClick={() => window.sermonDesktop?.openAttachment(attachment.path)}><FolderOpen size={14} /><span><b>{attachment.name}</b><small>{Math.max(1, Math.round(attachment.size / 1024)).toLocaleString()}KB</small></span></button><button className="attachment-delete" title="첨부 삭제" onClick={() => onDeleteAttachment(attachment)}><X size={12} /></button></div>)}{!attachments.length && <p>연결된 파일이 없습니다.</p>}</div>
      </aside>
      <section className="paper-editor">
        <input className="title-input" value={draft.title} onChange={(event) => update({ title: event.target.value })} />
        <div className="document-meta"><span>{draft.type === 'sermon' ? '설교문' : (draft as Prayer).prayerType}</span>{draft.scripture && <span>{draft.scripture}</span>}</div>
        <textarea value={draft.content} onChange={(event) => update({ content: event.target.value })} placeholder={draft.type === 'sermon' ? '말씀의 첫 문장을 시작해보세요.' : '기도의 첫 문장을 시작해보세요.'} />
        <footer><span>{draft.content.replace(/\s/g, '').length.toLocaleString()}자</span><span><Clock3 size={14} /> 약 {readingMinutes}분 낭독</span></footer>
      </section>
      <aside className="editor-guide"><p className="eyebrow">작성 점검</p><div className="writing-check"><div><span>예상 낭독</span><b>{readingMinutes}분</b></div><div><span>긴 문장</span><b>{writing.longSentences.length}개</b></div><div><span>반복 단어</span><b>{writing.repeated.length}개</b></div>{writing.repeated.length > 0 && <p>{writing.repeated.map(([word, count]) => `${word} ${count}회`).join(' · ')}</p>}</div><p className="eyebrow version-eyebrow">버전 기록</p><div className="version-create"><input value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} placeholder="버전 메모" /><button onClick={() => { const label = versionLabel.trim() || `${versions.length + 1}번째 저장본`; onVersion(draft, label); setVersionLabel('') }}>저장</button></div><div className="version-list">{versions.slice(0, 6).map((version) => <div className="version-row" key={version.id}><button onClick={() => setCompareVersion(version)}><Columns2 size={14} /><span><b>{version.label}</b><small>{new Date(version.createdAt).toLocaleString('ko-KR')}</small></span></button><button title="이 버전 복원" onClick={() => { setDraft(version.snapshot); onSave(version.snapshot) }}><RotateCcw size={13} /></button></div>)}{!versions.length && <p className="guide-note">중요한 수정 전에 수동 버전을 저장하세요.</p>}</div><button className="template-save" onClick={() => { const name = window.prompt('새 템플릿 이름을 입력하세요.', draft.title); if (name) onSaveTemplate({ id: uid('template'), type: draft.type, name, description: `${draft.type === 'sermon' ? '설교' : '기도'} 원고에서 만든 사용자 템플릿`, content: draft.content }) }}><Save size={15} /> 현재 본문을 템플릿으로</button><button className="danger-link" onClick={() => onTrash(draft)}><Trash2 size={15} /> 휴지통으로 이동</button></aside>
    </div>
    {compareVersion && <VersionCompare current={draft} version={compareVersion} onRestore={() => { setDraft(compareVersion.snapshot); onSave(compareVersion.snapshot); setCompareVersion(null) }} onClose={() => setCompareVersion(null)} />}
    {aiOpen && <AIAssistant document={draft} onApply={(content) => update({ content })} onClose={() => setAiOpen(false)} />}
  </div>
}

function ServiceModal({ onClose, onSave }: { onClose: () => void; onSave: (service: WorshipService) => void }) {
  const [service, setService] = useState<WorshipService>({ id: uid('service'), title: '주일예배', date: new Date().toISOString().slice(0, 10), time: '11:00', theme: '', scripture: '', requiredDocuments: ['sermon', 'prayer'] })
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" onSubmit={(event) => { event.preventDefault(); onSave(service) }} onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">새 일정</p><h2>예배 등록</h2></div><button type="button" className="icon-button" onClick={onClose}><X /></button></div><label>예배 이름<input required value={service.title} onChange={(event) => setService({ ...service, title: event.target.value })} /></label><div className="form-grid"><label>날짜<input required type="date" value={service.date} onChange={(event) => setService({ ...service, date: event.target.value })} /></label><label>시간<input required type="time" value={service.time} onChange={(event) => setService({ ...service, time: event.target.value })} /></label></div><label>주제<input value={service.theme} onChange={(event) => setService({ ...service, theme: event.target.value })} placeholder="예: 감사" /></label><label>성경 본문<input value={service.scripture} onChange={(event) => setService({ ...service, scripture: event.target.value })} placeholder="예: 데살로니가전서 5:16-18" /></label><div className="modal-footer"><button type="button" className="button ghost" onClick={onClose}>취소</button><button className="button primary"><Check size={17} /> 예배 등록</button></div></form></div>
}

type AIValidation = {
  overall_score: number
  passed: boolean
  summary: string
  checks: Array<{ category: string; status: 'pass' | 'warning' | 'fail'; finding: string; recommendation: string }>
  questions: string[]
}

function LegacyAIAssistant({ document, onApply, onClose }: { document: MinistryDocument; onApply: (content: string) => void; onClose: () => void }) {
  const [hasKey, setHasKey] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [model, setModel] = useState('gpt-6-luna')
  const [mode, setMode] = useState<'draft' | 'revise'>('draft')
  const [scripture, setScripture] = useState(document.scripture)
  const [topic, setTopic] = useState(document.type === 'sermon' ? (document as Sermon).theme : (document as Prayer).prayerType)
  const [keywords, setKeywords] = useState(document.tags.join(', '))
  const [audience, setAudience] = useState(document.type === 'sermon' ? (document as Sermon).audience : '예배 공동체')
  const [coreMessage, setCoreMessage] = useState('')
  const [structure, setStructure] = useState(document.type === 'sermon' ? '서론, 본문 해설, 3개 대지, 삶의 적용, 결론' : '찬양과 감사, 회개, 말씀과 예배, 교회와 이웃, 맺음')
  const [targetMinutes, setTargetMinutes] = useState(document.type === 'prayer' ? (document as Prayer).targetMinutes : 15)
  const [task, setTask] = useState('문장을 낭독하기 쉽고 자연스럽게 다듬어 주세요.')
  const [redact, setRedact] = useState(true)
  const [result, setResult] = useState('')
  const [validation, setValidation] = useState<AIValidation | null>(null)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { window.sermonDesktop?.getAIKeyStatus().then(setHasKey) }, [])
  const protectedContent = redact ? document.content.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[이메일 제외]').replace(/01[016789]-?\d{3,4}-?\d{4}/g, '[전화번호 제외]') : document.content
  const preflight = mode === 'draft' ? [!topic.trim() && '주제를 입력해 주세요.', document.type === 'sermon' && !document.scripture.trim() && '설교 본문을 입력해 주세요.', !keywords.trim() && '핵심 키워드를 입력해 주세요.', targetMinutes < 1 && '목표 시간을 확인해 주세요.'].filter(Boolean) as string[] : [!document.content.trim() && '다듬을 원고를 먼저 작성해 주세요.'].filter(Boolean) as string[]
  const input = mode === 'draft'
    ? `다음 조건으로 ${document.type === 'sermon' ? '설교문' : '기도문'} 초안을 작성해 주세요.\n성경 본문: ${document.scripture || '없음'}\n주제: ${topic}\n핵심 키워드: ${keywords}\n대상: ${audience}\n핵심 메시지: ${coreMessage || '입력 내용을 바탕으로 제안'}\n구조: ${structure}\n목표 낭독 시간: ${targetMinutes}분\n요구사항: 직접 인용처럼 보이는 성경 문장은 장절 확인이 필요함을 표시하고, 확인되지 않은 사실이나 실제 사례를 만들어내지 마세요.`
    : `작업 요청: ${task}\n문서 유형: ${document.type === 'sermon' ? '설교문' : '기도문'}\n성경 본문: ${document.scripture || '없음'}\n\n원고:\n${protectedContent}`
  const generate = async () => {
    if (!window.sermonDesktop) return setError('AI 보조는 데스크톱 앱에서 사용할 수 있습니다.')
    if (preflight.length) return setError(preflight.join(' '))
    setLoading(true); setError(''); setResult(''); setValidation(null)
    try { setResult(await window.sermonDesktop.generateAI({ model, input })) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'AI 요청에 실패했습니다.') } finally { setLoading(false) }
  }
  const validate = async () => {
    if (!window.sermonDesktop || !result.trim()) return
    setValidating(true); setError('')
    const localReview = analyzeWriting(result)
    const reviewInput = `다음 ${document.type === 'sermon' ? '설교문' : '기도문'} 초안을 검증하세요.\n기준 본문: ${document.scripture || '없음'}\n의도한 주제: ${topic || '없음'}\n의도한 키워드: ${keywords || '없음'}\n목표 낭독 시간: ${targetMinutes}분\n로컬 검사: 긴 문장 ${localReview.longSentences.length}개, 반복 단어 ${localReview.repeated.map(([word, count]) => `${word} ${count}회`).join(', ') || '없음'}\n\n초안:\n${result}`
    try { setValidation(await window.sermonDesktop.validateAI({ model, input: reviewInput })) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : '검증 요청에 실패했습니다.') } finally { setValidating(false) }
  }
  return <div className="modal-backdrop ai-backdrop" onMouseDown={onClose}><div className="ai-modal ai-draft-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">생성·검증·선택 적용</p><h2>AI 원고 작업실</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>{!hasKey ? <section className="api-key-setup"><ShieldCheck /><div><h3>OpenAI API 키 연결</h3><p>키는 Windows 보안 저장소로 암호화되며 원고 데이터와 백업에 포함되지 않습니다.</p><input type="password" value={keyInput} onChange={(event) => setKeyInput(event.target.value)} placeholder="sk-..." /><button className="button primary" disabled={!keyInput.trim()} onClick={async () => { if (!window.sermonDesktop) return; await window.sermonDesktop.setAIKey(keyInput); setKeyInput(''); setHasKey(true) }}>안전하게 저장</button></div></section> : <><nav className="ai-mode-tabs"><button className={mode === 'draft' ? 'active' : ''} onClick={() => { setMode('draft'); setResult(''); setValidation(null) }}>주제에서 초안 생성</button><button className={mode === 'revise' ? 'active' : ''} onClick={() => { setMode('revise'); setResult(''); setValidation(null) }}>현재 원고 다듬기</button></nav><section className="ai-draft-form">{mode === 'draft' ? <><label>주제<input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="예: 돌아온 탕자와 아버지의 은혜" /></label><label>핵심 키워드<input value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="회개, 기다림, 용서, 회복" /></label><label>대상 회중<input value={audience} onChange={(event) => setAudience(event.target.value)} /></label><label>목표 낭독 시간<input type="number" min="1" max="90" value={targetMinutes} onChange={(event) => setTargetMinutes(Number(event.target.value))} /></label><label className="wide">핵심 메시지<textarea value={coreMessage} onChange={(event) => setCoreMessage(event.target.value)} placeholder="반드시 전달하고 싶은 한 문장을 적어주세요." /></label><label className="wide">원고 구조<input value={structure} onChange={(event) => setStructure(event.target.value)} /></label></> : <><label className="wide">수정 작업<select value={task} onChange={(event) => setTask(event.target.value)}><option>문장을 낭독하기 쉽고 자연스럽게 다듬어 주세요.</option><option>핵심 내용은 유지하면서 원고를 더 간결하게 줄여 주세요.</option><option>설교의 주제와 적용을 반영한 기도문 초안을 작성해 주세요.</option><option>원고의 흐름과 적용 질문을 제안해 주세요.</option></select></label></>}<label>모델<input value={model} onChange={(event) => setModel(event.target.value)} /></label><label className="redact-check"><input type="checkbox" checked={redact} onChange={(event) => setRedact(event.target.checked)} /> 연락처 자동 제외</label></section>{preflight.length > 0 && <div className="preflight-errors">{preflight.map((item) => <span key={item}><AlertTriangle size={13} />{item}</span>)}</div>}<div className="draft-workflow"><section className="draft-preview"><h3>외부 전송 미리보기</h3><textarea readOnly value={input} /><div className="privacy-note"><AlertTriangle size={15} /><span>이 내용은 OpenAI API로 전송됩니다. 민감한 목회·개인 정보를 직접 확인해 주세요.</span></div><button className="button primary" disabled={loading || preflight.length > 0} onClick={generate}>{loading ? '초안 작성 중…' : mode === 'draft' ? '초안 생성' : '수정안 생성'}</button></section><section className="draft-result"><h3>생성 결과</h3><textarea value={result} onChange={(event) => { setResult(event.target.value); setValidation(null) }} placeholder="생성 결과가 표시됩니다. 이 단계에서는 기존 원고가 변경되지 않습니다." /><button className="button verify-button" disabled={validating || !result.trim()} onClick={validate}><ShieldCheck size={16} /> {validating ? '검증 중…' : '초안 검증'}</button></section>{validation && <section className="validation-panel"><div className="validation-score"><strong>{validation.overall_score}</strong><span>/ 100</span><b className={validation.passed ? 'passed' : 'review'}>{validation.passed ? '기본 검증 통과' : '검토 필요'}</b></div><p>{validation.summary}</p><div className="validation-checks">{validation.checks.map((check, index) => <article className={`check-${check.status}`} key={`${check.category}-${index}`}><span>{check.category}</span><b>{check.finding}</b><p>{check.recommendation}</p></article>)}</div>{validation.questions.length > 0 && <div className="review-questions"><h4>작성자가 확인할 질문</h4>{validation.questions.map((question) => <p key={question}>{question}</p>)}</div>}</section>}</div><footer><button className="danger-link" onClick={async () => { if (!window.sermonDesktop || !window.confirm('저장된 API 키를 삭제할까요?')) return; await window.sermonDesktop.clearAIKey(); setHasKey(false) }}>저장된 API 키 삭제</button><div><button className="button ghost" onClick={onClose}>닫기</button><button className="button dark" disabled={!result.trim()} onClick={() => { const warning = validation ? '검증 결과를 확인했습니다.' : '아직 AI 검증을 실행하지 않았습니다.'; if (window.confirm(`${warning} 현재 원고에 적용할까요? 적용 전 버전 저장을 권장합니다.`)) { onApply(result); onClose() } }}>원고에 적용</button></div></footer></>}</div></div>
}

type AIPhase = 'idle' | 'checking' | 'preparing' | 'generating' | 'validating' | 'complete' | 'error'
type AIProvider = 'api' | 'chatgpt'
type ChatGPTState = Awaited<ReturnType<NonNullable<Window['sermonDesktop']>['getChatGPTStatus']>>

function AIProgress({ phase, elapsed }: { phase: AIPhase; elapsed: number }) {
  if (phase === 'idle') return null
  const labels: Record<AIPhase, string> = {
    idle: '',
    checking: 'API 키 연결을 확인하고 있습니다',
    preparing: '요청 내용을 안전하게 준비하고 있습니다',
    generating: 'AI가 원고를 작성하고 있습니다',
    validating: 'AI가 원고를 검증하고 있습니다',
    complete: '작업이 완료되었습니다',
    error: '작업을 완료하지 못했습니다',
  }
  const progress = phase === 'checking' ? Math.min(85, 20 + elapsed * 8)
    : phase === 'preparing' ? 12
      : phase === 'generating' || phase === 'validating' ? Math.min(92, 28 + elapsed * 2)
        : phase === 'complete' ? 100 : 100
  return <div className={`ai-progress ai-progress-${phase}`} role="status" aria-live="polite">
    <div><strong>{labels[phase]}</strong><span>{phase === 'complete' || phase === 'error' ? '' : `${progress}% · ${elapsed}초`}</span></div>
    <div className="ai-progress-track"><span style={{ width: `${progress}%` }} /></div>
    {(phase === 'generating' || phase === 'validating') && <small>표시된 진행률은 예상치이며 보통 30초~2분 정도 걸립니다.</small>}
  </div>
}

function AIAssistant({ document, onApply, onClose }: { document: MinistryDocument; onApply: (content: string) => void; onClose: () => void }) {
  const [hasKey, setHasKey] = useState(false)
  const [provider, setProvider] = useState<AIProvider>('chatgpt')
  const [chatgptState, setChatgptState] = useState<ChatGPTState | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [model, setModel] = useState('gpt-6.1-sol')
  const [mode, setMode] = useState<'draft' | 'revise'>('draft')
  const [scripture, setScripture] = useState(document.scripture)
  const [topic, setTopic] = useState(document.type === 'sermon' ? (document as Sermon).theme : (document as Prayer).prayerType)
  const [keywords, setKeywords] = useState(document.tags.join(', '))
  const [audience, setAudience] = useState(document.type === 'sermon' ? (document as Sermon).audience : '예배 공동체')
  const [coreMessage, setCoreMessage] = useState('')
  const [targetMinutes, setTargetMinutes] = useState(document.type === 'prayer' ? (document as Prayer).targetMinutes : 15)
  const [task, setTask] = useState('문장을 낭독하기 쉽고 자연스럽게 다듬어 주세요.')
  const [result, setResult] = useState('')
  const [validation, setValidation] = useState<AIValidation | null>(null)
  const [phase, setPhase] = useState<AIPhase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const busy = ['checking', 'preparing', 'generating', 'validating'].includes(phase)

  useEffect(() => {
    window.sermonDesktop?.getAIKeyStatus().then(setHasKey)
    window.sermonDesktop?.getChatGPTStatus().then((state) => {
      setChatgptState(state)
      if (state.session.sharing && state.models[0]) setModel(state.models[0].slug)
      else setProvider('api')
    }).catch(() => setProvider('api'))
  }, [])
  useEffect(() => {
    if (!busy) return
    setElapsed(0)
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [busy])

  const blockers = mode === 'draft'
    ? [!topic.trim() && '주제를 입력해 주세요.', targetMinutes < 1 && '목표 시간을 확인해 주세요.'].filter(Boolean) as string[]
    : [!document.content.trim() && '다듬을 원고를 먼저 작성해 주세요.'].filter(Boolean) as string[]
  const warnings = mode === 'draft'
    ? [document.type === 'sermon' && !scripture.trim() && '본문 없이도 생성할 수 있지만 성경 본문을 입력하면 더 정확합니다.', !keywords.trim() && '키워드를 넣으면 핵심 방향이 더 분명해집니다.'].filter(Boolean) as string[]
    : []
  const input = mode === 'draft'
    ? `다음 조건으로 ${document.type === 'sermon' ? '설교문' : '기도문'} 초안을 작성해 주세요.\n성경 본문: ${scripture || '미지정'}\n주제: ${topic}\n핵심 키워드: ${keywords || '미지정'}\n대상: ${audience}\n핵심 메시지: ${coreMessage || '주제에 맞게 제안'}\n목표 낭독 시간: ${targetMinutes}분\n확인할 수 없는 사실이나 실제 사례를 만들어내지 말고, 직접 인용처럼 보이는 성경 문장은 장절 확인 필요성을 표시해 주세요.`
    : `작업 요청: ${task}\n문서 유형: ${document.type === 'sermon' ? '설교문' : '기도문'}\n성경 본문: ${scripture || '미지정'}\n\n원고:\n${document.content}`

  const saveAndTestKey = async () => {
    if (!window.sermonDesktop || !keyInput.trim()) return
    setError(''); setPhase('checking')
    try {
      await window.sermonDesktop.setAIKey(keyInput.trim())
      await window.sermonDesktop.testAIKey()
      setKeyInput(''); setHasKey(true); setPhase('complete')
    } catch (requestError) {
      setPhase('error'); setError(requestError instanceof Error ? requestError.message : 'API 키 연결 확인에 실패했습니다.')
    }
  }
  const connectChatGPT = async () => {
    if (!window.sermonDesktop) return
    setError(''); setPhase('checking')
    try {
      const state = await window.sermonDesktop.signInWithChatGPT()
      setChatgptState(state)
      if (!state.session.sharing) throw new Error('로그인은 완료됐지만 ChatGPT 구독 사용 권한이 허용되지 않았습니다.')
      if (state.models[0]) setModel(state.models[0].slug)
      setPhase('complete')
    } catch (requestError) {
      setPhase('error'); setError(requestError instanceof Error ? requestError.message : 'ChatGPT 연결에 실패했습니다.')
    }
  }
  const generate = async () => {
    if (!window.sermonDesktop) return setError('AI 기능은 설치형 앱에서 사용할 수 있습니다.')
    if (blockers.length) return setError(blockers.join(' '))
    setError(''); setResult(''); setValidation(null); setPhase('preparing')
    await new Promise((resolve) => window.setTimeout(resolve, 250))
    setPhase('generating')
    try {
      setResult(await window.sermonDesktop.generateAI({ provider, model, input })); setPhase('complete')
    } catch (requestError) {
      setPhase('error'); setError(requestError instanceof Error ? requestError.message : 'AI 요청에 실패했습니다.')
    }
  }
  const validate = async () => {
    if (!window.sermonDesktop || !result.trim()) return
    setError(''); setPhase('validating')
    try {
      setValidation(await window.sermonDesktop.validateAI({ provider, model, input: `다음 ${document.type === 'sermon' ? '설교문' : '기도문'} 초안을 검증해 주세요.\n기준 본문: ${scripture || '미지정'}\n의도한 주제: ${topic || '미지정'}\n\n초안:\n${result}` })); setPhase('complete')
    } catch (requestError) {
      setPhase('error'); setError(requestError instanceof Error ? requestError.message : '검증 요청에 실패했습니다.')
    }
  }

  return <div className="modal-backdrop ai-backdrop" onMouseDown={onClose}><div className="ai-modal ai-draft-modal" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><p className="eyebrow">생성 · 검증 · 선택 적용</p><h2>AI 원고 작업실</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>
    {!(provider === 'api' ? hasKey : chatgptState?.session.sharing) ? <section className="api-key-setup ai-auth-setup"><ShieldCheck /><div><h3>AI 사용 방법 선택</h3><p>ChatGPT 구독 또는 OpenAI API 키 중 하나를 연결하세요. 언제든 다른 방식으로 전환할 수 있습니다.</p><nav className="auth-choice"><button className={provider === 'chatgpt' ? 'active' : ''} onClick={() => { setProvider('chatgpt'); setError('') }}>ChatGPT 구독</button><button className={provider === 'api' ? 'active' : ''} onClick={() => { setProvider('api'); setError('') }}>API 키</button></nav>{provider === 'chatgpt' ? <div className="chatgpt-connect"><p>브라우저에서 ChatGPT 계정으로 로그인하고 구독 사용 권한을 허용합니다. 대화 기록에는 접근하지 않습니다.</p><button className="button primary" disabled={busy} onClick={connectChatGPT}>{phase === 'checking' ? '브라우저 승인 대기 중…' : 'ChatGPT로 계속하기'}</button></div> : <div><input type="password" value={keyInput} onChange={(event) => setKeyInput(event.target.value)} placeholder="sk-..." disabled={busy} /><button className="button primary" disabled={!keyInput.trim() || busy} onClick={saveAndTestKey}>{phase === 'checking' ? '연결 확인 중…' : '저장하고 연결 확인'}</button></div>}<AIProgress phase={phase} elapsed={elapsed} />{error && <div className="ai-error"><AlertTriangle size={15} />{error}</div>}</div></section> : <>
      <nav className="ai-mode-tabs"><button className={mode === 'draft' ? 'active' : ''} onClick={() => setMode('draft')}>주제에서 초안 생성</button><button className={mode === 'revise' ? 'active' : ''} onClick={() => setMode('revise')}>현재 원고 다듬기</button></nav>
      <section className="ai-draft-form">
        {mode === 'draft' ? <>
          <label className="wide">성경 본문 구절<input value={scripture} onChange={(event) => setScripture(event.target.value)} placeholder="예: 요한복음 3:16-21" /></label>
          <label>주제<input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="예: 돌아온 탕자와 아버지의 은혜" /></label>
          <label>핵심 키워드<input value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="회개, 기다림, 용서, 회복" /></label>
          <label>대상 회중<input value={audience} onChange={(event) => setAudience(event.target.value)} /></label>
          <label>목표 낭독 시간<input type="number" min="1" max="90" value={targetMinutes} onChange={(event) => setTargetMinutes(Number(event.target.value))} /></label>
          <label className="wide">핵심 메시지<textarea value={coreMessage} onChange={(event) => setCoreMessage(event.target.value)} placeholder="반드시 전달하고 싶은 내용을 적어주세요." /></label>
        </> : <label className="wide">수정 작업<select value={task} onChange={(event) => setTask(event.target.value)}><option>문장을 낭독하기 쉽고 자연스럽게 다듬어 주세요.</option><option>핵심 내용은 유지하면서 더 간결하게 줄여 주세요.</option><option>원고의 흐름과 적용 질문을 제안해 주세요.</option></select></label>}
        <label className="wide">AI 모델<select value={model} onChange={(event) => setModel(event.target.value)}>{provider === 'chatgpt' ? chatgptState?.models.map((item) => <option value={item.slug} key={item.slug}>{item.displayName}</option>) : <><option value="gpt-6.1-sol">GPT-6.1 Sol · 권장, 품질과 비용 균형</option><option value="gpt-6-astra">GPT-6 Astra · 최고 품질, 높은 비용</option><option value="gpt-6-luna">GPT-6 Luna · 빠르고 경제적</option></>}</select><small className="field-help">{provider === 'chatgpt' ? 'ChatGPT 구독으로 사용 가능한 모델만 표시됩니다.' : 'API 사용량은 별도로 과금됩니다.'}</small></label>
      </section>
      {(blockers.length > 0 || warnings.length > 0) && <div className="preflight-errors">{blockers.map((item) => <span key={item}><AlertTriangle size={13} />{item}</span>)}{warnings.map((item) => <span className="warning" key={item}><AlertTriangle size={13} />{item}</span>)}</div>}
      <AIProgress phase={phase} elapsed={elapsed} />{error && <div className="ai-error ai-error-banner"><AlertTriangle size={15} />{error}</div>}
      <div className="draft-workflow"><section className="draft-preview"><h3>외부 전송 미리보기</h3><textarea readOnly value={input} /><div className="privacy-note"><AlertTriangle size={15} /><span>이 내용은 OpenAI API로 전송됩니다. 민감한 정보를 확인해 주세요.</span></div><button className="button primary" disabled={busy || blockers.length > 0} onClick={generate}>{phase === 'generating' ? '초안 작성 중…' : mode === 'draft' ? '초안 생성' : '수정안 생성'}</button></section><section className="draft-result"><h3>생성 결과</h3><textarea value={result} onChange={(event) => { setResult(event.target.value); setValidation(null) }} placeholder="생성 결과 또는 오류가 여기에 표시됩니다." /><button className="button verify-button" disabled={busy || !result.trim()} onClick={validate}><ShieldCheck size={16} /> {phase === 'validating' ? '검증 중…' : '초안 검증'}</button></section>
        {validation && <section className="validation-panel"><div className="validation-score"><strong>{validation.overall_score}</strong><span>/ 100</span><b className={validation.passed ? 'passed' : 'review'}>{validation.passed ? '기본 검증 통과' : '검토 필요'}</b></div><p>{validation.summary}</p><div className="validation-checks">{validation.checks.map((check, index) => <article className={`check-${check.status}`} key={`${check.category}-${index}`}><span>{check.category}</span><b>{check.finding}</b><p>{check.recommendation}</p></article>)}</div></section>}
      </div><footer><div className="provider-controls"><span>{provider === 'chatgpt' ? `ChatGPT 구독 사용 중${chatgptState?.session.identity?.email ? ` · ${chatgptState.session.identity.email}` : ''}` : 'OpenAI API 키 사용 중'}</span><button className="danger-link" onClick={async () => { if (provider === 'chatgpt') { await window.sermonDesktop?.disconnectChatGPT(); setChatgptState(null); setProvider(hasKey ? 'api' : 'chatgpt') } else { await window.sermonDesktop?.clearAIKey(); setHasKey(false) } setPhase('idle'); setError('') }}>{provider === 'chatgpt' ? 'ChatGPT 연결 해제' : '저장된 API 키 삭제'}</button><button className="text-button" onClick={() => { const next = provider === 'chatgpt' ? 'api' : 'chatgpt'; setProvider(next); setResult(''); setValidation(null); setError(''); if (next === 'api') setModel('gpt-6.1-sol'); else if (chatgptState?.models[0]) setModel(chatgptState.models[0].slug) }}>다른 방식 사용</button></div><div><button className="button ghost" onClick={onClose}>닫기</button><button className="button dark" disabled={!result.trim() || busy} onClick={() => { onApply(result); onClose() }}>원고에 적용</button></div></footer>
    </>}
  </div></div>
}

function Materials({ data, setData }: { data: AppData; setData: (updater: (current: AppData) => AppData) => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Material['category'] | '전체'>('전체')
  const [draft, setDraft] = useState<Material | null>(null)
  const filtered = data.materials.filter((item) => (category === '전체' || item.category === category) && `${item.title} ${item.content} ${item.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  const save = (material: Material) => {
    setData((current) => ({ ...current, materials: current.materials.some((item) => item.id === material.id) ? current.materials.map((item) => item.id === material.id ? material : item) : [material, ...current.materials] }))
    setDraft(null)
  }
  return <div className="page materials-page"><section className="materials-hero"><div><p className="eyebrow">사역 자료실</p><h1>생각의 조각을 모아<br /><em>다음 말씀의 씨앗으로.</em></h1></div><button className="button primary" onClick={() => setDraft({ id: uid('material'), title: '', category: '본문 연구', content: '', tags: [], updatedAt: new Date().toISOString() })}><Plus size={17} /> 새 자료</button></section><div className="materials-toolbar"><label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="자료 제목, 내용, 태그 검색" /></label><div>{(['전체', '본문 연구', '예화', '공통 문장', '참고 자료'] as const).map((item) => <button className={category === item ? 'active' : ''} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div></div><section className="material-grid">{filtered.map((item) => <button key={item.id} onClick={() => setDraft(item)}><span>{item.category}</span><h2>{item.title}</h2><p>{item.content}</p><footer>{item.tags.map((tag) => <small key={tag}>#{tag}</small>)}</footer></button>)}{!filtered.length && <div className="empty-state"><p>조건에 맞는 자료가 없습니다.</p></div>}</section>{draft && <MaterialModal material={draft} onSave={save} onClose={() => setDraft(null)} />}</div>
}

function MaterialModal({ material, onSave, onClose }: { material: Material; onSave: (material: Material) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(material)
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal material-modal" onSubmit={(event) => { event.preventDefault(); onSave({ ...draft, updatedAt: new Date().toISOString() }) }} onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">사역 메모</p><h2>{material.title ? '자료 편집' : '새 자료'}</h2></div><button type="button" className="icon-button" onClick={onClose}><X /></button></div><label>제목<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="자료 제목" /></label><label>분류<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Material['category'] })}>{['본문 연구', '예화', '공통 문장', '참고 자료'].map((item) => <option key={item}>{item}</option>)}</select></label><label>내용<textarea required value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="설교와 기도에 활용할 생각을 기록하세요." /></label><label>태그<input value={draft.tags.join(', ')} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} placeholder="감사, 예화, 청년부" /></label><div className="modal-footer"><button type="button" className="button ghost" onClick={onClose}>취소</button><button className="button primary"><Save size={16} /> 저장</button></div></form></div>
}

function VersionCompare({ current, version, onRestore, onClose }: { current: MinistryDocument; version: DocumentVersion; onRestore: () => void; onClose: () => void }) {
  const currentParagraphs = current.content.split('\n').filter(Boolean)
  const oldParagraphs = version.snapshot.content.split('\n').filter(Boolean)
  return <div className="modal-backdrop compare-backdrop" onMouseDown={onClose}><div className="compare-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">버전 비교</p><h2>{version.label}</h2></div><div><button className="button ghost" onClick={onRestore}><RotateCcw size={15} /> 이 버전 복원</button><button className="icon-button" onClick={onClose}><X /></button></div></header><div className="compare-grid"><section><h3>저장된 버전</h3><div>{oldParagraphs.map((paragraph, index) => <p className={paragraph !== currentParagraphs[index] ? 'changed' : ''} key={index}>{paragraph}</p>)}</div></section><section><h3>현재 원고</h3><div>{currentParagraphs.map((paragraph, index) => <p className={paragraph !== oldParagraphs[index] ? 'changed' : ''} key={index}>{paragraph}</p>)}</div></section></div></div></div>
}

function TrashView({ data, setData }: { data: AppData; setData: (updater: (current: AppData) => AppData) => void }) {
  const restore = (id: string) => setData((current) => {
    const target = current.trash.find((item) => item.document.id === id)
    if (!target) return current
    return {
      ...current,
      sermons: target.document.type === 'sermon' ? [target.document as Sermon, ...current.sermons] : current.sermons,
      prayers: target.document.type === 'prayer' ? [target.document as Prayer, ...current.prayers] : current.prayers,
      trash: current.trash.filter((item) => item.document.id !== id),
    }
  })
  const remove = (id: string) => {
    if (!window.confirm('이 원고를 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return
    setData((current) => ({ ...current, trash: current.trash.filter((item) => item.document.id !== id), versions: current.versions.filter((item) => item.documentId !== id) }))
  }
  return <div className="page list-page"><PageHeading title="휴지통" description="삭제한 원고를 복원하거나 영구적으로 정리합니다." /><div className="trash-list">{data.trash.map((item) => <article key={item.document.id}><span className={`document-icon ${item.document.type}`}><Trash2 size={17} /></span><div><h3>{item.document.title}</h3><p>{new Date(item.deletedAt).toLocaleString('ko-KR')} 삭제 · {item.document.type === 'sermon' ? '설교문' : '기도문'}</p></div><button className="button ghost" onClick={() => restore(item.document.id)}><RotateCcw size={15} /> 복원</button><button className="danger-link" onClick={() => remove(item.document.id)}>영구 삭제</button></article>)}{!data.trash.length && <div className="empty-state"><p>휴지통이 비어 있습니다.</p><span>삭제한 원고는 이곳에 보관됩니다.</span></div>}</div></div>
}

function LegacyBackupModal({ onClose, onExport, onImport }: { onClose: () => void; onExport: () => void; onImport: (file: File) => Promise<void> }) {
  const [message, setMessage] = useState('')
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal backup-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">데이터 보호</p><h2>백업과 복원</h2></div><button className="icon-button" onClick={onClose}><X /></button></div><p className="modal-description">현재 원고, 버전, 예배 일정과 사용 기록을 하나의 파일로 안전하게 보관합니다.</p><div className="backup-grid"><button onClick={() => { onExport(); setMessage('백업 파일을 저장했습니다.') }}><Download /><b>백업 파일 저장</b><span>현재 모든 데이터를 JSON 파일로 내려받습니다.</span></button><label><Upload /><b>백업 파일 복원</b><span>기존 데이터는 선택한 백업 내용으로 교체됩니다.</span><input type="file" accept="application/json,.json" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await onImport(file); setMessage('백업을 성공적으로 복원했습니다.') } catch (error) { setMessage(error instanceof Error ? error.message : '복원하지 못했습니다.') } }} /></label></div>{message && <p className="backup-message">{message}</p>}<div className="modal-footer"><button className="button primary" onClick={onClose}>완료</button></div></div></div>
}

type AppUpdateStatus = {
  stage: 'idle' | 'checking' | 'available' | 'current' | 'downloading' | 'ready' | 'error'
  currentVersion?: string
  version?: string
  configured?: boolean
  percent?: number
  transferred?: number
  total?: number
  message: string
}

function BackupModal({ onClose, onExport, onImport }: { onClose: () => void; onExport: () => void; onImport: (file: File) => Promise<void> }) {
  const [message, setMessage] = useState('')
  const [update, setUpdate] = useState<AppUpdateStatus>({ stage: 'idle', message: '업데이트 정보를 불러오는 중입니다.' })
  const busy = update.stage === 'checking' || update.stage === 'downloading'
  useEffect(() => {
    if (!window.sermonDesktop) return
    window.sermonDesktop.getUpdateStatus().then(setUpdate).catch((error) => setUpdate({ stage: 'error', message: error instanceof Error ? error.message : '업데이트 정보를 불러오지 못했습니다.' }))
    return window.sermonDesktop.onUpdateStatus(setUpdate)
  }, [])
  const check = async () => {
    if (!window.sermonDesktop) return
    setUpdate((current) => ({ ...current, stage: 'checking', message: '새 버전을 확인하고 있습니다.' }))
    try { await window.sermonDesktop.checkForUpdates() } catch (error) { setUpdate((current) => ({ ...current, stage: 'error', message: error instanceof Error ? error.message : '업데이트 확인에 실패했습니다.' })) }
  }
  const download = async () => {
    if (!window.sermonDesktop) return
    setUpdate((current) => ({ ...current, stage: 'downloading', percent: 0, message: '다운로드를 시작합니다.' }))
    try { await window.sermonDesktop.downloadUpdate() } catch (error) { setUpdate((current) => ({ ...current, stage: 'error', message: error instanceof Error ? error.message : '업데이트 다운로드에 실패했습니다.' })) }
  }
  const install = async () => {
    if (!window.sermonDesktop || !window.confirm('원고 데이터를 자동 백업한 뒤 앱을 재시작하여 업데이트할까요?')) return
    try { await window.sermonDesktop.installUpdate() } catch (error) { setUpdate((current) => ({ ...current, stage: 'error', message: error instanceof Error ? error.message : '업데이트 설치에 실패했습니다.' })) }
  }
  const formatSize = (bytes?: number) => bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : ''
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal backup-modal settings-modal" onMouseDown={(event) => event.stopPropagation()}>
    <div className="modal-heading"><div><p className="eyebrow">데이터 보호 · 앱 관리</p><h2>설정</h2></div><button className="icon-button" onClick={onClose}><X /></button></div>
    <section className="settings-section"><div className="settings-section-title"><div><h3>앱 업데이트</h3><p>삭제하거나 다시 설치하지 않고 새 버전으로 교체합니다.</p></div><span>현재 {update.currentVersion || '확인 중'}</span></div>
      <div className={`update-card update-${update.stage}`}><div><strong>{update.version ? `버전 ${update.version}` : '업데이트 상태'}</strong><p>{update.message}</p></div>{update.stage === 'available' ? <button className="button primary" onClick={download}>다운로드</button> : update.stage === 'ready' ? <button className="button primary" onClick={install}>재시작하여 설치</button> : <button className="button ghost" disabled={busy || update.configured === false} onClick={check}>{update.stage === 'checking' ? '확인 중…' : update.stage === 'downloading' ? '다운로드 중…' : '업데이트 확인'}</button>}
        {update.stage === 'downloading' && <div className="update-progress"><div><span>다운로드</span><b>{update.percent || 0}% {update.total ? `· ${formatSize(update.transferred)} / ${formatSize(update.total)}` : ''}</b></div><div><span style={{ width: `${update.percent || 0}%` }} /></div></div>}
      </div>
    </section>
    <section className="settings-section"><div className="settings-section-title"><div><h3>백업과 복원</h3><p>현재 원고, 버전, 예배 일정과 사용 기록을 보호합니다.</p></div></div><div className="backup-grid"><button onClick={() => { onExport(); setMessage('백업 파일을 저장했습니다.') }}><Download /><b>백업 파일 저장</b><span>현재 모든 데이터를 JSON 파일로 내려받습니다.</span></button><label><Upload /><b>백업 파일 복원</b><span>기존 데이터는 선택한 백업 내용으로 교체됩니다.</span><input type="file" accept="application/json,.json" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await onImport(file); setMessage('백업을 성공적으로 복원했습니다.') } catch (error) { setMessage(error instanceof Error ? error.message : '복원하지 못했습니다.') } }} /></label></div></section>
    {message && <p className="backup-message">{message}</p>}<div className="modal-footer"><button className="button primary" onClick={onClose}>완료</button></div>
  </div></div>
}

function Reader({ document, onClose }: { document: MinistryDocument; onClose: () => void }) {
  const [fontSize, setFontSize] = useState(26)
  const [dark, setDark] = useState(false)
  return <div className={`reader ${dark ? 'reader-dark' : ''}`}><header><div><span>{document.type === 'sermon' ? '설교문' : (document as Prayer).prayerType}</span><h1>{document.title}</h1></div><div><button onClick={() => setFontSize((size) => Math.max(18, size - 2))}>가−</button><button onClick={() => setFontSize((size) => Math.min(42, size + 2))}>가+</button><button onClick={() => setDark((value) => !value)}>{dark ? '밝게' : '어둡게'}</button><button onClick={() => window.print()}><Printer size={15} /> 인쇄·PDF</button><button className="reader-close" onClick={onClose}><X /></button></div></header><article style={{ fontSize }}><div className="reader-meta">{document.scripture}</div><h2>{document.title}</h2>{document.content.split('\n').map((paragraph, index) => paragraph ? <p key={index}>{paragraph}</p> : <br key={index} />)}</article><footer><BookOpenCheck size={18} /><span>{document.content.replace(/\s/g, '').length.toLocaleString()}자</span><span>예상 낭독 {Math.max(1, Math.ceil(document.content.replace(/\s/g, '').length / 320))}분</span></footer></div>
}

function PageHeading({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="page-heading"><div><p className="eyebrow">사역 원고</p><h1>{title}</h1><p>{description}</p></div>{action && onAction && <button className="button primary" onClick={onAction}><Plus size={17} /> {action}</button>}</div>
}

function StatusBadge({ status }: { status: DocumentStatus }) { return <span className={`status status-${status.replace(' ', '-')}`}>{status}</span> }
function EmptyState({ text, action, onClick }: { text: string; action: string; onClick: () => void }) { return <div className="empty-state"><p>{text}</p><button className="text-button" onClick={onClick}>{action} <ChevronRight size={16} /></button></div> }
