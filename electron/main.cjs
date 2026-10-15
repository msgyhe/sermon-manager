const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx')
const JSZip = require('jszip')
const OpenAI = require('openai')
const { autoUpdater } = require('electron-updater')

let database
let mainWindow
let updateConfigured = false
let chatgpt

function credentialEncryption() {
  const available = () => app.isReady() && safeStorage.isEncryptionAvailable()
  return {
    id: 'electron-safe-storage-v1',
    isAvailable: available,
    encrypt(plaintext) {
      if (!available()) throw new Error('Windows 보안 저장소를 사용할 수 없습니다.')
      return safeStorage.encryptString(plaintext)
    },
    decrypt(ciphertext) {
      if (!available()) throw new Error('Windows 보안 저장소를 사용할 수 없습니다.')
      return safeStorage.decryptString(Buffer.from(ciphertext))
    },
  }
}

async function initializeChatGPT() {
  const { createChatGPT } = await import('@siwc/local')
  chatgpt = createChatGPT({
    appName: '말씀과 기도',
    appId: 'sermon-manager',
    redirectPort: 0,
    storageDir: path.join(appDirectory(), 'chatgpt'),
    credentialEncryption: credentialEncryption(),
    sendHostId: true,
    openBrowser: async (url) => {
      const target = new URL(url)
      if (target.origin !== 'https://auth.openai.com') throw new Error('허용되지 않은 로그인 주소입니다.')
      await shell.openExternal(target.href)
    },
  })
}

function appDirectory() {
  const directory = app.getPath('userData')
  fs.mkdirSync(directory, { recursive: true })
  return directory
}

function openDatabase() {
  const file = path.join(appDirectory(), 'ministry.db')
  database = new Database(file)
  database.pragma('journal_mode = WAL')
  database.exec('CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, updated_at TEXT NOT NULL)')
}

function createBackup(data) {
  const directory = path.join(appDirectory(), 'backups')
  fs.mkdirSync(directory, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const destination = path.join(directory, `ministry-${stamp}.json`)
  fs.writeFileSync(destination, JSON.stringify(data, null, 2), 'utf8')
  const backups = fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort().reverse()
  backups.slice(10).forEach((name) => fs.unlinkSync(path.join(directory, name)))
  return destination
}

function backupCurrentData() {
  const row = database?.prepare('SELECT data FROM app_state WHERE id = 1').get()
  return row ? createBackup(JSON.parse(row.data)) : null
}

function sendUpdateStatus(status) {
  mainWindow?.webContents.send('update:status', status)
}

function configureUpdater() {
  if (!app.isPackaged) return
  const environmentUrl = process.env.SERMON_UPDATE_URL?.trim()
  if (environmentUrl) autoUpdater.setFeedURL({ provider: 'generic', url: environmentUrl })
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  updateConfigured = true
}

function needsAutomaticBackup() {
  const directory = path.join(appDirectory(), 'backups')
  if (!fs.existsSync(directory)) return true
  const latest = fs.readdirSync(directory).filter((name) => name.endsWith('.json')).map((name) => fs.statSync(path.join(directory, name)).mtimeMs).sort((a, b) => b - a)[0]
  return !latest || Date.now() - latest > 86400000
}

function apiKeyFile() {
  return path.join(appDirectory(), 'openai-key.bin')
}

function readApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  const file = apiKeyFile()
  if (!fs.existsSync(file) || !safeStorage.isEncryptionAvailable()) return null
  return safeStorage.decryptString(fs.readFileSync(file))
}

function createOpenAIClient(apiKey, timeout = 120000) {
  return new OpenAI({ apiKey, timeout, maxRetries: 1 })
}

function friendlyOpenAIError(error) {
  const status = error?.status
  const code = error?.code
  if (status === 401) return new Error('API 키가 올바르지 않거나 만료되었습니다. 키를 다시 확인해 주세요.')
  if (status === 403) return new Error('이 API 키에는 요청한 모델을 사용할 권한이 없습니다.')
  if (status === 404) return new Error('입력한 AI 모델을 찾을 수 없습니다. 모델 이름을 확인해 주세요.')
  if (status === 429 || code === 'insufficient_quota') return new Error('API 사용 한도 또는 결제 상태를 확인해 주세요.')
  if (code === 'ETIMEDOUT' || error?.name === 'APIConnectionTimeoutError') return new Error('AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.')
  if (error?.name === 'APIConnectionError') return new Error('OpenAI 서버에 연결하지 못했습니다. 인터넷과 방화벽을 확인해 주세요.')
  return new Error(error?.message || 'OpenAI 요청 처리 중 알 수 없는 오류가 발생했습니다.')
}

function decodeXmlText(value) {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}

async function readDocxText(file) {
  const archive = await JSZip.loadAsync(fs.readFileSync(file))
  const documentXml = await archive.file('word/document.xml').async('string')
  return decodeXmlText(documentXml.replace(/<w:tab\/?\s*>/g, '\t').replace(/<\/w:p>/g, '\n').replace(/<w:br\/?\s*>/g, '\n').replace(/<[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim()
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 700,
    backgroundColor: '#f3f1eb',
    title: '말씀과 기도',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow = window
  window.removeMenu()
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    dialog.showErrorBox('앱 화면을 불러오지 못했습니다', `${errorDescription} (${errorCode})`)
  })
  if (!app.isPackaged) window.loadURL('http://127.0.0.1:5173')
  else window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(async () => {
  openDatabase()
  await initializeChatGPT()
  configureUpdater()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

autoUpdater.on('checking-for-update', () => sendUpdateStatus({ stage: 'checking', message: '새 버전을 확인하고 있습니다.' }))
autoUpdater.on('update-available', (info) => sendUpdateStatus({ stage: 'available', version: info.version, message: `새 버전 ${info.version}을 사용할 수 있습니다.` }))
autoUpdater.on('update-not-available', () => sendUpdateStatus({ stage: 'current', message: '현재 최신 버전을 사용하고 있습니다.' }))
autoUpdater.on('download-progress', (progress) => sendUpdateStatus({ stage: 'downloading', percent: Math.round(progress.percent), transferred: progress.transferred, total: progress.total, message: '업데이트를 다운로드하고 있습니다.' }))
autoUpdater.on('update-downloaded', (info) => sendUpdateStatus({ stage: 'ready', version: info.version, percent: 100, message: '다운로드가 완료되었습니다. 재시작하면 업데이트됩니다.' }))
autoUpdater.on('error', (error) => sendUpdateStatus({ stage: 'error', message: error?.message || '업데이트 처리 중 오류가 발생했습니다.' }))

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('data:load', () => {
  const row = database.prepare('SELECT data FROM app_state WHERE id = 1').get()
  return row ? JSON.parse(row.data) : null
})

ipcMain.handle('data:save', (_event, data) => {
  database.prepare('INSERT INTO app_state (id, data, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').run(JSON.stringify(data), new Date().toISOString())
  if (needsAutomaticBackup()) createBackup(data)
  return true
})

ipcMain.handle('backup:create', () => {
  const row = database.prepare('SELECT data FROM app_state WHERE id = 1').get()
  return row ? createBackup(JSON.parse(row.data)) : null
})

ipcMain.handle('update:get-status', () => ({
  stage: 'idle',
  currentVersion: app.getVersion(),
  configured: updateConfigured,
  message: updateConfigured ? '업데이트를 확인할 수 있습니다.' : '업데이트 배포 서버가 아직 연결되지 않았습니다.',
}))

ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) throw new Error('업데이트 확인은 설치된 앱에서 사용할 수 있습니다.')
  if (!updateConfigured) throw new Error('업데이트 배포 서버가 아직 연결되지 않았습니다.')
  await autoUpdater.checkForUpdates()
  return true
})

ipcMain.handle('update:download', async () => {
  if (!updateConfigured) throw new Error('업데이트 배포 서버가 아직 연결되지 않았습니다.')
  await autoUpdater.downloadUpdate()
  return true
})

ipcMain.handle('update:install', () => {
  backupCurrentData()
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return true
})

ipcMain.handle('attachment:add', async (_event, documentId) => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], title: '첨부할 파일 선택' })
  if (result.canceled || !result.filePaths[0]) return null
  const source = result.filePaths[0]
  const directory = path.join(appDirectory(), 'attachments', documentId)
  fs.mkdirSync(directory, { recursive: true })
  const destination = path.join(directory, `${Date.now()}-${path.basename(source)}`)
  fs.copyFileSync(source, destination)
  const stat = fs.statSync(destination)
  return { id: `attachment-${Date.now()}`, documentId, name: path.basename(source), path: destination, size: stat.size, addedAt: new Date().toISOString() }
})

ipcMain.handle('attachment:open', (_event, filePath) => shell.openPath(filePath))

ipcMain.handle('attachment:delete', (_event, attachment) => {
  if (attachment.path && fs.existsSync(attachment.path)) fs.unlinkSync(attachment.path)
  return true
})

ipcMain.handle('document:import', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], title: '기존 원고 가져오기', filters: [{ name: '원고 파일', extensions: ['txt', 'docx'] }] })
  if (result.canceled || !result.filePaths[0]) return null
  const file = result.filePaths[0]
  const extension = path.extname(file).toLowerCase()
  const content = extension === '.docx' ? await readDocxText(file) : fs.readFileSync(file, 'utf8')
  return { title: path.basename(file, extension), content }
})

ipcMain.handle('ai:key:status', () => Boolean(readApiKey()))

ipcMain.handle('ai:key:set', (_event, key) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('이 컴퓨터에서 보안 저장소를 사용할 수 없습니다.')
  fs.writeFileSync(apiKeyFile(), safeStorage.encryptString(key.trim()))
  return true
})

ipcMain.handle('ai:key:clear', () => {
  const file = apiKeyFile()
  if (fs.existsSync(file)) fs.unlinkSync(file)
  return true
})

ipcMain.handle('chatgpt:status', async () => {
  if (!chatgpt) return { session: { status: 'disconnected', sharing: false }, models: [] }
  const session = await chatgpt.getSession()
  const models = session.status === 'connected' && session.sharing ? await chatgpt.listModels() : []
  return { session, models }
})

ipcMain.handle('chatgpt:sign-in', async () => {
  if (!chatgpt) throw new Error('ChatGPT 로그인 기능을 초기화하지 못했습니다.')
  const session = await chatgpt.signIn()
  const models = session.status === 'connected' && session.sharing ? await chatgpt.listModels() : []
  return { session, models }
})

ipcMain.handle('chatgpt:disconnect', async () => {
  await chatgpt?.disconnect()
  return true
})

ipcMain.handle('ai:key:test', async () => {
  const apiKey = readApiKey()
  if (!apiKey) throw new Error('OpenAI API 키를 먼저 저장해 주세요.')
  try {
    await createOpenAIClient(apiKey, 15000).models.list()
    return true
  } catch (error) {
    throw friendlyOpenAIError(error)
  }
})

ipcMain.handle('ai:generate', async (_event, request) => {
  if (request.provider === 'chatgpt') {
    if (!chatgpt) throw new Error('ChatGPT 로그인 기능을 초기화하지 못했습니다.')
    try {
      const response = await chatgpt.streamResponse({
        model: request.model,
        instructions: '당신은 한국 교회 목회자의 설교문과 기도문 작성을 보조합니다. 사용자의 신학적 판단을 대신하지 말고, 요청받은 원고만 자연스럽고 낭독하기 쉬운 한국어로 제안하세요. 개인정보를 추측하거나 추가하지 마세요.',
        input: request.input,
      })
      return response.text
    } catch (error) {
      throw friendlyOpenAIError(error)
    }
  }
  const apiKey = readApiKey()
  if (!apiKey) throw new Error('OpenAI API 키를 먼저 저장해 주세요.')
  const client = createOpenAIClient(apiKey)
  const instructions = '당신은 한국 교회 목회자의 설교문과 기도문 작성을 보조합니다. 사용자의 신학적 판단을 대신하지 말고, 요청받은 원고만 자연스럽고 낭독하기 쉬운 한국어로 제안하세요. 개인정보를 추측하거나 추가하지 마세요.'
  try {
    const response = await client.responses.create({ model: request.model || 'gpt-6-luna', instructions, input: request.input })
    return response.output_text
  } catch (error) {
    throw friendlyOpenAIError(error)
  }
})

ipcMain.handle('ai:validate', async (_event, request) => {
  if (request.provider === 'chatgpt') {
    if (!chatgpt) throw new Error('ChatGPT 로그인 기능을 초기화하지 못했습니다.')
    try {
      const response = await chatgpt.streamResponse({
        model: request.model,
        instructions: '한국어 설교문 또는 기도문을 검증하고 JSON만 출력하세요. 형식: {"overall_score":0,"passed":false,"summary":"","checks":[{"category":"","status":"pass|warning|fail","finding":"","recommendation":""}],"questions":[""]}',
        input: request.input,
      })
      return JSON.parse(response.text.replace(/^```json\s*|\s*```$/g, '').trim())
    } catch (error) {
      throw friendlyOpenAIError(error)
    }
  }
  const apiKey = readApiKey()
  if (!apiKey) throw new Error('OpenAI API 키를 먼저 저장해 주세요.')
  const client = createOpenAIClient(apiKey)
  try {
    const response = await client.responses.create({
    model: request.model || 'gpt-6-luna',
    instructions: '당신은 한국어 설교문과 기도문의 검토자입니다. 신학적 정확성을 확정하지 말고, 본문과 대조하거나 작성자가 확인해야 할 부분을 구체적으로 표시하세요. 성경 직접 인용처럼 보이는 표현, 논리적 비약, 목회적 민감성, 구조, 반복, 낭독 적합성을 검토하세요.',
    input: request.input,
    text: {
      format: {
        type: 'json_schema',
        name: 'ministry_document_review',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            overall_score: { type: 'integer', minimum: 0, maximum: 100 },
            passed: { type: 'boolean' },
            summary: { type: 'string' },
            checks: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  category: { type: 'string' },
                  status: { type: 'string', enum: ['pass', 'warning', 'fail'] },
                  finding: { type: 'string' },
                  recommendation: { type: 'string' },
                },
                required: ['category', 'status', 'finding', 'recommendation'],
              },
            },
            questions: { type: 'array', items: { type: 'string' } },
          },
          required: ['overall_score', 'passed', 'summary', 'checks', 'questions'],
        },
      },
    },
    })
    return JSON.parse(response.output_text)
  } catch (error) {
    throw friendlyOpenAIError(error)
  }
})

ipcMain.handle('document:docx', async (_event, ministryDocument) => {
  const result = await dialog.showSaveDialog({ title: 'DOCX로 저장', defaultPath: `${ministryDocument.title}.docx`, filters: [{ name: 'Word 문서', extensions: ['docx'] }] })
  if (result.canceled || !result.filePath) return null
  const paragraphs = ministryDocument.content.split('\n').map((line) => new Paragraph({ children: [new TextRun({ text: line, size: 23, font: 'Malgun Gothic' })], spacing: { after: line ? 180 : 80, line: 380 } }))
  const document = new Document({ sections: [{ properties: {}, children: [new Paragraph({ text: ministryDocument.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 240 } }), ...(ministryDocument.scripture ? [new Paragraph({ text: ministryDocument.scripture, alignment: AlignmentType.CENTER, spacing: { after: 400 } })] : []), ...paragraphs] }] })
  fs.writeFileSync(result.filePath, await Packer.toBuffer(document))
  return result.filePath
})
