/**
 * Host half of the DSH Notebook bundle.
 *
 * Storage: `$DSH_HOME/plugin-data/dshnotebook/notebooks.json` plus pasted
 * images under `images/`.
 *
 * Routes (all same-origin, JSON carries `apiVersion`):
 *   GET  /plugin/dshnotebook/api                     -> snapshot
 *   POST /plugin/dshnotebook/api                     -> { action, ... }
 *   GET  /plugin/dshnotebook/images/<id>.<ext>       -> image bytes
 *   GET  /plugin/dshnotebook/export?notebookId=...   -> Markdown / ZIP
 *   GET  /plugin/dshnotebook/export?format=json      -> full backup (images inline)
 *
 * Notebooks support pinning, entries support tags and image captions, deletes
 * go to a trash that the UI can restore, and a JSON/ZIP/Markdown import keeps
 * a backup portable. The optional `notebook` Agent tool shares this store.
 */
import { access, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { inflateRawSync } from 'node:zlib'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const OCR_SCRIPT = fileURLToPath(new URL('./ocr.swift', import.meta.url))

const ROUTE_PATH = '/plugin/dshnotebook/api'
const IMAGE_ROUTE_PREFIX = '/plugin/dshnotebook/images'
const EXPORT_ROUTE_PATH = '/plugin/dshnotebook/export'
const API_VERSION = 3
const DATA_VERSION = 3
const BACKUP_FORMAT = 'dshnotebook-backup'

const MAX_NAME_LENGTH = 120
const MAX_TEXT_LENGTH = 100000
const MAX_SOURCE_LENGTH = 300
const MAX_IMAGE_NAME_LENGTH = 200
const MAX_CAPTION_LENGTH = 200
const MAX_TAGS = 20
const MAX_TAG_LENGTH = 40
const MAX_NOTEBOOKS = 500
const MAX_ENTRIES_PER_NOTEBOOK = 5000
const MAX_IMAGES_PER_ENTRY = 20
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_BODY_BYTES = 48 * 1024 * 1024
const MAX_TRASH = 200
const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_IMPORT_BYTES = 128 * 1024 * 1024
const MAX_IMPORT_ENTRIES = 2000
const IMAGE_ID_PATTERN = /^img_[a-z0-9]{8,40}$/u
const IMAGE_FILE_PATTERN = /^(img_[a-z0-9]{8,40})\.(png|jpg|webp|gif)$/u

const IMAGE_FORMATS = {
  png: { mediaType: 'image/png' },
  jpg: { mediaType: 'image/jpeg' },
  webp: { mediaType: 'image/webp' },
  gif: { mediaType: 'image/gif' },
}

class ActionError extends Error {
  constructor (code, message, status = 400) {
    super(message)
    this.name = 'ActionError'
    this.code = code
    this.status = status
  }
}

function newId (prefix) {
  return `${prefix}_${randomUUID().replace(/-/gu, '').slice(0, 20)}`
}

function nowIso () {
  return new Date().toISOString()
}

function isoOr (value, fallback) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : fallback
}

function limitText (value, max) {
  if (typeof value !== 'string') return ''
  return value.length > max ? value.slice(0, max) : value
}

function positiveDimension (value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 && number <= 20000 ? Math.round(number) : null
}

function normalizeSource (input) {
  const source = input && typeof input === 'object' ? input : {}
  return {
    sessionId: limitText(source.sessionId, MAX_SOURCE_LENGTH),
    sessionTitle: limitText(source.sessionTitle, MAX_SOURCE_LENGTH),
    workspace: limitText(source.workspace, MAX_SOURCE_LENGTH),
  }
}

function normalizeTags (input) {
  if (!Array.isArray(input)) return []
  const tags = []
  const seen = new Set()
  for (const raw of input) {
    const tag = limitText(typeof raw === 'string' ? raw.trim() : '', MAX_TAG_LENGTH)
    if (tag === '' || seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    tags.push(tag)
    if (tags.length >= MAX_TAGS) break
  }
  return tags
}

function imageExtension (value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(IMAGE_FORMATS, value) ? value : ''
}

function normalizeImage (input) {
  if (!input || typeof input !== 'object') return null
  const id = typeof input.id === 'string' ? input.id : ''
  const ext = imageExtension(typeof input.ext === 'string' ? input.ext.toLowerCase() : '')
  if (!IMAGE_ID_PATTERN.test(id) || ext === '') return null
  return {
    id,
    ext,
    mediaType: IMAGE_FORMATS[ext].mediaType,
    name: limitText(typeof input.name === 'string' ? input.name.trim() : '', MAX_IMAGE_NAME_LENGTH) || `${id}.${ext}`,
    caption: limitText(typeof input.caption === 'string' ? input.caption.trim() : '', MAX_CAPTION_LENGTH),
    width: positiveDimension(input.width),
    height: positiveDimension(input.height),
    size: Number.isFinite(Number(input.size)) ? Math.max(0, Math.round(Number(input.size))) : null,
  }
}

function normalizeImages (input) {
  if (!Array.isArray(input)) return []
  const images = []
  const seen = new Set()
  for (const item of input) {
    const image = normalizeImage(item)
    if (image === null || seen.has(image.id)) continue
    seen.add(image.id)
    images.push(image)
    if (images.length >= MAX_IMAGES_PER_ENTRY) break
  }
  return images
}

function normalizeEntry (input) {
  if (!input || typeof input !== 'object') return null
  const text = typeof input.text === 'string' ? input.text : ''
  const images = normalizeImages(input.images)
  const tags = normalizeTags(input.tags)
  const knownId = typeof input.id === 'string' && input.id !== ''
  if (!knownId && text.trim() === '' && images.length === 0) return null
  const createdAt = isoOr(input.createdAt, nowIso())
  return {
    id: knownId ? input.id : newId('entry'),
    text: limitText(text, MAX_TEXT_LENGTH),
    images,
    tags,
    createdAt,
    updatedAt: isoOr(input.updatedAt, createdAt),
    source: normalizeSource(input.source),
  }
}

function normalizeNotebook (input) {
  if (!input || typeof input !== 'object') return null
  const name = limitText(typeof input.name === 'string' ? input.name.trim() : '', MAX_NAME_LENGTH)
  const entries = Array.isArray(input.entries)
    ? input.entries.map(normalizeEntry).filter((entry) => entry !== null).slice(-MAX_ENTRIES_PER_NOTEBOOK)
    : []
  const createdAt = isoOr(input.createdAt, nowIso())
  const updatedAt = isoOr(input.updatedAt, createdAt)
  return {
    id: typeof input.id === 'string' && input.id !== '' ? input.id : newId('notebook'),
    name: name === '' ? 'Notebook' : name,
    pinned: input.pinned === true,
    createdAt,
    updatedAt,
    entries,
  }
}

function normalizeTrashItem (input) {
  if (!input || typeof input !== 'object') return null
  const id = typeof input.id === 'string' && input.id !== '' ? input.id : newId('trash')
  const deletedAt = isoOr(input.deletedAt, nowIso())
  if (input.kind === 'notebook') {
    const notebook = normalizeNotebook(input.notebook)
    if (notebook === null) return null
    return { id, kind: 'notebook', deletedAt, notebook }
  }
  if (input.kind === 'entry') {
    const entry = normalizeEntry(input.entry)
    if (entry === null) return null
    return {
      id,
      kind: 'entry',
      deletedAt,
      notebookId: limitText(input.notebookId, 80),
      notebookName: limitText(input.notebookName, MAX_NAME_LENGTH),
      entry,
    }
  }
  return null
}

function dataFilePath () {
  const base = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(base, 'plugin-data', 'dshnotebook', 'notebooks.json')
}

function imagesDirOf (file) {
  return join(dirname(file), 'images')
}

function requireName (value) {
  const name = typeof value === 'string' ? value.trim() : ''
  if (name === '') throw new ActionError('invalid-name', 'A notebook name is required.')
  return limitText(name, MAX_NAME_LENGTH)
}

function requireText (value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ActionError('invalid-text', 'There is no text to save.')
  }
  if (value.length > MAX_TEXT_LENGTH) {
    throw new ActionError('invalid-text', `The text exceeds the ${MAX_TEXT_LENGTH.toLocaleString('en-US')} character limit.`)
  }
  return value
}

function softText (value) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new ActionError('invalid-text', 'The text must be a string.')
  if (value.length > MAX_TEXT_LENGTH) {
    throw new ActionError('invalid-text', `The text exceeds the ${MAX_TEXT_LENGTH.toLocaleString('en-US')} character limit.`)
  }
  return value
}

function optionalText (value) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw new ActionError('invalid-text', 'The text must be a string.')
  if (value.trim() === '') return null
  return requireText(value)
}

function safeExportName (value) {
  const cleaned = String(value || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/gu, '_')
    .replace(/[. ]+$/u, '')
    .trim()
    .slice(0, 80)
  return cleaned === '' ? 'notebook' : cleaned
}

/* --------------------------------- images --------------------------------- */

function detectImageExtension (buffer) {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png'
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  if (buffer.length >= 6) {
    const head = buffer.toString('ascii', 0, 6)
    if (head === 'GIF87a' || head === 'GIF89a') return 'gif'
  }
  return null
}

function imageFileName (image) {
  return `${image.id}.${image.ext}`
}

function imageRouteUrl (image) {
  return `${IMAGE_ROUTE_PREFIX}/${imageFileName(image)}`
}

function readBase64 (value) {
  const raw = typeof value === 'string' ? value : ''
  if (raw === '') throw new ActionError('unsupported-image', 'The image is empty.')
  const comma = raw.indexOf(',')
  const base64 = raw.startsWith('data:') && comma >= 0 ? raw.slice(comma + 1) : raw
  if (base64.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 64) {
    throw new ActionError('image-too-large', 'The image exceeds the 8 MB limit.', 413)
  }
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length === 0) throw new ActionError('unsupported-image', 'The image could not be decoded.')
  if (buffer.length > MAX_IMAGE_BYTES) throw new ActionError('image-too-large', 'The image exceeds the 8 MB limit.', 413)
  return buffer
}

function isPrivateHost (hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/gu, '')
  if (host === '' || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(host)
  if (v4 === null) return false
  const first = Number(v4[1])
  const second = Number(v4[2])
  if (first === 0 || first === 10 || first === 127) return true
  if (first === 169 && second === 254) return true
  if (first === 192 && second === 168) return true
  if (first === 172 && second >= 16 && second <= 31) return true
  return false
}

/* ------------------------------- export (zip) ------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1)
    }
    table[index] = value >>> 0
  }
  return table
})()

function crc32 (buffer) {
  let value = 0xffffffff
  for (let index = 0; index < buffer.length; index += 1) {
    value = CRC_TABLE[(value ^ buffer[index]) & 0xff] ^ (value >>> 8)
  }
  return (value ^ 0xffffffff) >>> 0
}

function dosDateTime (date) {
  return {
    time: ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f),
    date: (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f),
  }
}

/** Store-only ZIP (no compression): images are already compressed. */
function makeZip (files) {
  const stamp = dosDateTime(new Date())
  const locals = []
  const central = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8')
    const data = file.data
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(stamp.time, 10)
    local.writeUInt16LE(stamp.date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, name, data)
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0x0800, 8)
    entry.writeUInt16LE(0, 10)
    entry.writeUInt16LE(stamp.time, 12)
    entry.writeUInt16LE(stamp.date, 14)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(data.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(name.length, 28)
    entry.writeUInt16LE(0, 30)
    entry.writeUInt16LE(0, 32)
    entry.writeUInt16LE(0, 34)
    entry.writeUInt16LE(0, 36)
    entry.writeUInt32LE(0, 38)
    entry.writeUInt32LE(offset, 42)
    central.push(entry, name)
    offset += local.length + name.length + data.length
  }
  const centralBuffer = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuffer.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...locals, centralBuffer, end])
}

/** Read a ZIP central directory; supports stored and deflated entries. */
function readZip (buffer) {
  if (buffer.length < 22) throw new ActionError('invalid-archive', 'The ZIP archive is unreadable.')
  let eocd = -1
  const limit = Math.max(0, buffer.length - 22 - 65535)
  for (let index = buffer.length - 22; index >= limit; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocd = index
      break
    }
  }
  if (eocd < 0) throw new ActionError('invalid-archive', 'The ZIP archive is unreadable.')
  const count = buffer.readUInt16LE(eocd + 10)
  const directoryOffset = buffer.readUInt32LE(eocd + 16)
  if (count > MAX_IMPORT_ENTRIES) throw new ActionError('limit', 'The archive holds too many files.')
  const files = new Map()
  let total = 0
  let pointer = directoryOffset
  for (let index = 0; index < count; index += 1) {
    if (pointer + 46 > buffer.length || buffer.readUInt32LE(pointer) !== 0x02014b50) {
      throw new ActionError('invalid-archive', 'The ZIP central directory is malformed.')
    }
    const method = buffer.readUInt16LE(pointer + 10)
    const compressedSize = buffer.readUInt32LE(pointer + 20)
    const size = buffer.readUInt32LE(pointer + 24)
    const nameLength = buffer.readUInt16LE(pointer + 28)
    const extraLength = buffer.readUInt16LE(pointer + 30)
    const commentLength = buffer.readUInt16LE(pointer + 32)
    const localOffset = buffer.readUInt32LE(pointer + 42)
    const name = buffer.toString('utf8', pointer + 46, pointer + 46 + nameLength)
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new ActionError('invalid-archive', 'The ZIP local header is malformed.')
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const start = localOffset + 30 + localNameLength + localExtraLength
    if (start + compressedSize > buffer.length) {
      throw new ActionError('invalid-archive', 'The ZIP entry extends past the archive.')
    }
    if (size > MAX_IMPORT_BYTES || total + size > MAX_IMPORT_BYTES) {
      throw new ActionError('limit', 'The archive is too large to import.')
    }
    const raw = buffer.subarray(start, start + compressedSize)
    let data
    if (method === 0) data = Buffer.from(raw)
    else if (method === 8) data = inflateRawSync(raw)
    else throw new ActionError('invalid-archive', 'The ZIP entry uses an unsupported compression method.')
    if (data.length > MAX_IMPORT_BYTES) throw new ActionError('limit', 'The archive is too large to import.')
    total += data.length
    files.set(name, data)
    pointer += 46 + nameLength + extraLength + commentLength
  }
  return files
}

function exportDate (lang) {
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US'
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
}

function exportStamp (value, lang) {
  const date = new Date(typeof value === 'string' ? value : '')
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/* -------------------------------- transport ------------------------------- */

function readJson (req) {
  return (async () => {
    let size = 0
    const chunks = []
    for await (const chunk of req) {
      size += chunk.length
      if (size > MAX_BODY_BYTES) throw new ActionError('too-large', 'The request body is too large.', 413)
      chunks.push(chunk)
    }
    const text = Buffer.concat(chunks).toString('utf8')
    if (text.trim() === '') return {}
    try {
      return JSON.parse(text)
    } catch {
      throw new ActionError('invalid-json', 'The request body is not valid JSON.')
    }
  })()
}

function respond (res, status, value) {
  const payload = value && typeof value === 'object' && !Array.isArray(value)
    ? { apiVersion: API_VERSION, ...value }
    : value
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function describeToolValue (value) {
  if (!value || value.ok !== true) return `DSH Notebook error: ${value && value.message ? value.message : 'unknown failure'}`
  if (value.notebook) {
    const notebook = value.notebook
    return `Saved to "${notebook.name}" (${notebook.id}); it now has ${notebook.entryCount} notes.`
  }
  const notebooks = Array.isArray(value.notebooks) ? value.notebooks : []
  if (notebooks.length === 0) return 'DSH Notebook has no notebooks yet.'
  return [
    `DSH Notebook has ${notebooks.length} notebooks:`,
    ...notebooks.map((notebook) => `- ${notebook.name} (${notebook.id}, ${notebook.entryCount} notes)`),
  ].join('\n')
}

export const inject = ['webServer']

export function apply (ctx) {
  const file = dataFilePath()
  const imagesDir = imagesDirOf(file)
  const state = { notebooks: [], trash: [] }
  /** Images uploaded in this process but not yet referenced by a saved entry. */
  const pendingImages = new Set()
  let chain = Promise.resolve()
  let pruneTimer = null
  let ocrBuild = null
  const ocrBinDir = join(dirname(file), 'bin')
  const ocrBinPath = join(ocrBinDir, 'ocr')
  const ocrModuleCache = join(dirname(file), '.swift-module-cache')

  const ensureOcrBinary = async () => {
    if (process.platform !== 'darwin') {
      throw new ActionError('ocr-unavailable', 'OCR is only available on macOS.', 501)
    }
    if (ocrBuild !== null) return ocrBuild
    ocrBuild = (async () => {
      try {
        const [binary, script] = await Promise.all([stat(ocrBinPath), stat(OCR_SCRIPT)])
        if (binary.mtimeMs >= script.mtimeMs) return ocrBinPath
      } catch {
        // Build below.
      }
      await mkdir(ocrBinDir, { recursive: true })
      await mkdir(ocrModuleCache, { recursive: true })
      try {
        await execFileAsync('/usr/bin/swiftc', [
          '-O',
          '-module-cache-path', ocrModuleCache,
          OCR_SCRIPT,
          '-o', ocrBinPath,
        ], { timeout: 180000, maxBuffer: 4 * 1024 * 1024 })
      } catch (error) {
        ocrBuild = null
        throw new ActionError('ocr-unavailable', `The OCR helper could not be built: ${error instanceof Error ? error.message : String(error)}`, 503)
      }
      return ocrBinPath
    })()
    try {
      return await ocrBuild
    } catch (error) {
      ocrBuild = null
      throw error
    }
  }

  const ocrImage = async (input) => {
    const id = typeof input.id === 'string' ? input.id : ''
    const ext = imageExtension(typeof input.ext === 'string' ? input.ext.toLowerCase() : '')
    if (!IMAGE_ID_PATTERN.test(id) || ext === '') {
      throw new ActionError('invalid-image', 'The image reference is invalid.')
    }
    const path = join(imagesDir, `${id}.${ext}`)
    try {
      await access(path)
    } catch {
      throw new ActionError('invalid-image', 'The image is missing.', 404)
    }
    const binary = await ensureOcrBinary()
    try {
      const { stdout } = await execFileAsync(binary, [path], { timeout: 30000, maxBuffer: 2 * 1024 * 1024 })
      return {
        ok: true,
        text: limitText(String(stdout || '').trim(), 10000),
        notebooks: state.notebooks,
        trash: trashSummary(),
      }
    } catch (error) {
      throw new ActionError('ocr-failed', `Text recognition failed: ${error instanceof Error ? error.message : String(error)}`, 502)
    }
  }

  const load = async () => {
    let raw
    try {
      raw = await readFile(file, 'utf8')
    } catch (error) {
      if (error && error.code === 'ENOENT') return
      console.error('[dshnotebook] could not read the notebook store:', error)
      return
    }
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      const backup = `${file}.corrupt-${Date.now()}`
      try {
        await rename(file, backup)
      } catch {
        // Keeping the unreadable file in place still beats overwriting it silently.
      }
      console.error('[dshnotebook] unreadable notebook store; original kept at', backup, error)
      return
    }
    const stored = Array.isArray(parsed && parsed.notebooks) ? parsed.notebooks : []
    state.notebooks = stored
      .map(normalizeNotebook)
      .filter((notebook) => notebook !== null)
      .slice(0, MAX_NOTEBOOKS)
    const trash = Array.isArray(parsed && parsed.trash) ? parsed.trash : []
    const cutoff = Date.now() - TRASH_TTL_MS
    state.trash = trash
      .map(normalizeTrashItem)
      .filter((item) => item !== null && Date.parse(item.deletedAt) >= cutoff)
      .slice(0, MAX_TRASH)
  }

  const ready = load()

  const save = async () => {
    await mkdir(dirname(file), { recursive: true })
    const temporary = `${file}.${process.pid}.tmp`
    await writeFile(temporary, JSON.stringify({ version: DATA_VERSION, notebooks: state.notebooks, trash: state.trash }, null, 2), 'utf8')
    await rename(temporary, file)
  }

  const referencedImageFiles = () => {
    const referenced = new Set()
    const addEntry = (entry) => {
      for (const image of entry.images) referenced.add(imageFileName(image))
    }
    for (const notebook of state.notebooks) {
      for (const entry of notebook.entries) addEntry(entry)
    }
    for (const item of state.trash) {
      if (item.kind === 'notebook') {
        for (const entry of item.notebook.entries) addEntry(entry)
      } else {
        addEntry(item.entry)
      }
    }
    return referenced
  }

  const pruneImages = async () => {
    await ready
    const referenced = referencedImageFiles()
    let names
    try {
      names = await readdir(imagesDir)
    } catch {
      return
    }
    const cutoff = Date.now() - 60 * 60 * 1000
    for (const name of names) {
      if (!IMAGE_FILE_PATTERN.test(name) || referenced.has(name)) continue
      if (pendingImages.has(name.split('.')[0])) continue
      try {
        const info = await stat(join(imagesDir, name))
        if (info.mtimeMs < cutoff) await unlink(join(imagesDir, name))
      } catch {
        // A file removed by another path is already in the desired state.
      }
    }
  }

  const schedulePrune = () => {
    if (pruneTimer !== null) return
    pruneTimer = setTimeout(() => {
      pruneTimer = null
      void pruneImages().catch((error) => {
        console.error('[dshnotebook] image cleanup failed:', error)
      })
    }, 60000)
    if (typeof pruneTimer.unref === 'function') pruneTimer.unref()
  }

  const trimTrash = () => {
    if (state.trash.length > MAX_TRASH) state.trash.length = MAX_TRASH
  }

  const mutate = (operation) => {
    const result = chain.then(async () => {
      const value = await operation()
      await save()
      schedulePrune()
      return value
    })
    chain = result.then(() => undefined, () => undefined)
    return result
  }

  const summaries = () => state.notebooks.map((notebook) => ({
    id: notebook.id,
    name: notebook.name,
    pinned: notebook.pinned,
    entryCount: notebook.entries.length,
    imageCount: notebook.entries.reduce((total, entry) => total + entry.images.length, 0),
    createdAt: notebook.createdAt,
    updatedAt: notebook.updatedAt,
  }))

  const trashSummary = () => state.trash.map((item) => ({
    id: item.id,
    kind: item.kind,
    deletedAt: item.deletedAt,
    notebookId: item.kind === 'notebook' ? item.notebook.id : item.notebookId,
    notebookName: item.kind === 'notebook' ? item.notebook.name : item.notebookName,
    entryId: item.kind === 'entry' ? item.entry.id : undefined,
    preview: item.kind === 'entry'
      ? limitText(item.entry.text.replace(/\s+/gu, ' ').trim(), 120)
      : `${item.notebook.entries.length} notes`,
  }))

  const notebookResult = (notebook, mode, extra = {}) => ({
    ok: true,
    notebookId: notebook.id,
    createdId: notebook.id,
    name: notebook.name,
    entryCount: notebook.entries.length,
    notebooks: mode === 'summary' ? summaries() : state.notebooks,
    trash: trashSummary(),
    ...(mode === 'summary' ? { notebook: { id: notebook.id, name: notebook.name, entryCount: notebook.entries.length } } : {}),
    ...extra,
  })

  const findNotebook = (notebookId) => {
    const notebook = state.notebooks.find((candidate) => candidate.id === notebookId)
    if (notebook === undefined) throw new ActionError('not-found', 'That notebook does not exist.', 404)
    return notebook
  }

  const findEntry = (notebook, entryId) => {
    const entry = notebook.entries.find((candidate) => candidate.id === entryId)
    if (entry === undefined) throw new ActionError('entry-not-found', 'That note does not exist.', 404)
    return entry
  }

  const assertImagesExist = async (images) => {
    for (const image of images) {
      try {
        await access(join(imagesDir, imageFileName(image)))
      } catch {
        throw new ActionError('invalid-image', 'An attached image is missing; paste it again.', 409)
      }
      pendingImages.delete(image.id)
    }
  }

  const writeImageBuffer = async (buffer, name, width, height, caption) => {
    const ext = detectImageExtension(buffer)
    if (ext === null) throw new ActionError('unsupported-image', 'Only PNG, JPEG, WebP, and GIF images are supported.')
    if (buffer.length > MAX_IMAGE_BYTES) throw new ActionError('image-too-large', 'The image exceeds the 8 MB limit.', 413)
    const id = newId('img')
    await mkdir(imagesDir, { recursive: true })
    await writeFile(join(imagesDir, `${id}.${ext}`), buffer)
    pendingImages.add(id)
    return {
      id,
      ext,
      mediaType: IMAGE_FORMATS[ext].mediaType,
      name: limitText(typeof name === 'string' ? name.trim() : '', MAX_IMAGE_NAME_LENGTH) || `${id}.${ext}`,
      caption: limitText(typeof caption === 'string' ? caption.trim() : '', MAX_CAPTION_LENGTH),
      width: positiveDimension(width),
      height: positiveDimension(height),
      size: buffer.length,
      url: imageRouteUrl({ id, ext }),
    }
  }

  const uploadImage = async (input) => {
    const buffer = readBase64(input && input.data)
    const image = await writeImageBuffer(buffer, input.name, input.width, input.height, input.caption)
    return { ok: true, image, notebooks: state.notebooks, trash: trashSummary() }
  }

  const fetchImage = async (input) => {
    const raw = typeof input.url === 'string' ? input.url.trim() : ''
    let parsed
    try {
      parsed = new URL(raw)
    } catch {
      throw new ActionError('invalid-url', 'Enter a valid http or https image URL.')
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new ActionError('invalid-url', 'Enter a valid http or https image URL.')
    }
    if (isPrivateHost(parsed.hostname)) {
      throw new ActionError('invalid-url', 'Local and private network addresses are not allowed.')
    }
    let response
    try {
      response = await fetch(parsed, { redirect: 'follow', signal: AbortSignal.timeout(10000) })
    } catch {
      throw new ActionError('fetch-failed', 'The image could not be downloaded.', 502)
    }
    if (!response.ok) throw new ActionError('fetch-failed', `The image server returned HTTP ${response.status}.`, 502)
    try {
      if (isPrivateHost(new URL(response.url).hostname)) {
        throw new ActionError('invalid-url', 'Local and private network addresses are not allowed.')
      }
    } catch (error) {
      if (error instanceof ActionError) throw error
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > MAX_IMAGE_BYTES) throw new ActionError('image-too-large', 'The image exceeds the 8 MB limit.', 413)
    let name = 'image'
    try {
      name = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).at(-1) || 'image')
    } catch {
      name = 'image'
    }
    const image = await writeImageBuffer(buffer, name, input.width, input.height, input.caption)
    return { ok: true, image, notebooks: state.notebooks, trash: trashSummary() }
  }

  const trashNotebook = (notebook) => {
    const item = { id: newId('trash'), kind: 'notebook', deletedAt: nowIso(), notebook: structuredClone(notebook) }
    state.trash.unshift(item)
    trimTrash()
    return item
  }

  const trashEntry = (notebook, entry) => {
    const item = {
      id: newId('trash'),
      kind: 'entry',
      deletedAt: nowIso(),
      notebookId: notebook.id,
      notebookName: notebook.name,
      entry: structuredClone(entry),
    }
    state.trash.unshift(item)
    trimTrash()
    return item
  }

  /* -------------------------------- import -------------------------------- */

  const importImageMap = async (source) => {
    // source: Map<fileName, Buffer>; returns Map<oldId+ext, newDescriptor>
    const remapped = new Map()
    for (const [name, buffer] of source) {
      const match = IMAGE_FILE_PATTERN.exec(name.split('/').at(-1) || '')
      if (match === null) continue
      if (buffer.length > MAX_IMAGE_BYTES) continue
      const image = await writeImageBuffer(buffer, name.split('/').at(-1) || match[0], null, null, '')
      remapped.set(`${match[1]}.${match[2]}`, image)
    }
    return remapped
  }

  const importNotebook = async (raw, imageMap, fallbackName) => {
    const normalized = normalizeNotebook(raw)
    if (normalized === null) throw new ActionError('invalid-backup', 'The backup contains an invalid notebook.')
    const notebook = {
      id: newId('notebook'),
      name: normalized.name || fallbackName || 'Imported notebook',
      pinned: normalized.pinned,
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
      entries: [],
    }
    for (const entry of normalized.entries) {
      const images = []
      for (const image of entry.images) {
        const remapped = imageMap.get(`${image.id}.${image.ext}`)
        if (remapped === undefined) continue
        images.push({
          ...remapped,
          name: image.name || remapped.name,
          caption: image.caption || '',
          width: image.width ?? remapped.width,
          height: image.height ?? remapped.height,
          url: undefined,
        })
      }
      notebook.entries.push({
        ...entry,
        id: newId('entry'),
        images: images.map(({ url, ...rest }) => rest),
      })
    }
    return notebook
  }

  const applyImport = async (input) => {
    const kind = input && typeof input.kind === 'string' ? input.kind : ''
    const imported = []
    if (kind === 'markdown') {
      const name = limitText(typeof input.name === 'string' ? input.name.trim() : '', MAX_NAME_LENGTH) || 'Imported notes'
      const text = softText(input.text)
      if (text.trim() === '') throw new ActionError('invalid-text', 'The file is empty.')
      const createdAt = nowIso()
      const notebook = normalizeNotebook({
        name: name.replace(/\.(md|markdown|txt)$/iu, '') || 'Imported notes',
        createdAt,
        updatedAt: createdAt,
        entries: [{ text, createdAt, updatedAt: createdAt, tags: input.tags }],
      })
      if (notebook === null) throw new ActionError('invalid-text', 'The file is empty.')
      state.notebooks.unshift(notebook)
      return { ok: true, imported: [{ notebookId: notebook.id, name: notebook.name }], notebookId: notebook.id, notebooks: state.notebooks, trash: trashSummary() }
    }
    if (kind === 'json') {
      const backup = input.backup
      if (!backup || typeof backup !== 'object' || backup.format !== BACKUP_FORMAT || !Array.isArray(backup.notebooks)) {
        throw new ActionError('invalid-backup', 'This is not a DSH Notebook backup file.')
      }
      if (backup.notebooks.length > MAX_NOTEBOOKS) throw new ActionError('limit', 'The backup contains too many notebooks.')
      const imageFiles = new Map()
      if (backup.images && typeof backup.images === 'object') {
        for (const [name, base64] of Object.entries(backup.images)) {
          if (typeof base64 !== 'string') continue
          const buffer = Buffer.from(base64, 'base64')
          if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) continue
          if (detectImageExtension(buffer) === null) continue
          imageFiles.set(name, buffer)
        }
      }
      const imageMap = await importImageMap(imageFiles)
      for (const raw of backup.notebooks) {
        const notebook = await importNotebook(raw, imageMap, raw && raw.name)
        state.notebooks.unshift(notebook)
        imported.push({ notebookId: notebook.id, name: notebook.name })
      }
      return { ok: true, imported, notebookId: imported[0] ? imported[0].notebookId : undefined, notebooks: state.notebooks, trash: trashSummary() }
    }
    if (kind === 'zip') {
      const raw = typeof input.data === 'string' ? input.data : ''
      const buffer = Buffer.from(raw, 'base64')
      if (buffer.length === 0) throw new ActionError('invalid-archive', 'The ZIP archive is empty.')
      if (buffer.length > MAX_BODY_BYTES) throw new ActionError('too-large', 'The archive is too large.', 413)
      const files = readZip(buffer)
      const imageFiles = new Map()
      for (const [name, data] of files) {
        if (!name.startsWith('images/')) continue
        if (detectImageExtension(data) === null) continue
        imageFiles.set(name.split('/').at(-1), data)
      }
      const imageMap = await importImageMap(imageFiles)
      const manifest = files.get('notebook.json')
      if (manifest !== undefined) {
        let parsed
        try {
          parsed = JSON.parse(manifest.toString('utf8'))
        } catch {
          parsed = null
        }
        const rawNotebook = parsed && parsed.notebook ? parsed.notebook : parsed
        if (rawNotebook && typeof rawNotebook === 'object') {
          const notebook = await importNotebook(rawNotebook, imageMap, input.name)
          state.notebooks.unshift(notebook)
          imported.push({ notebookId: notebook.id, name: notebook.name })
          return { ok: true, imported, notebookId: imported[0] ? imported[0].notebookId : undefined, notebooks: state.notebooks, trash: trashSummary() }
        }
      }
      const markdownFile = [...files.entries()].find(([name]) => /\.(md|markdown|txt)$/iu.test(name))
      if (markdownFile === undefined) throw new ActionError('invalid-archive', 'The ZIP holds no notebook.json or Markdown file.')
      const [mdName, mdData] = markdownFile
      const createdAt = nowIso()
      const notebook = normalizeNotebook({
        name: limitText(mdName.split('/').at(-1).replace(/\.(md|markdown|txt)$/iu, ''), MAX_NAME_LENGTH) || 'Imported notes',
        createdAt,
        updatedAt: createdAt,
        entries: [{
          text: mdData.toString('utf8'),
          createdAt,
          updatedAt: createdAt,
          images: [...imageMap.values()].map(({ url, ...rest }) => rest),
        }],
      })
      if (notebook === null) throw new ActionError('invalid-archive', 'The archive could not be imported.')
      state.notebooks.unshift(notebook)
      imported.push({ notebookId: notebook.id, name: notebook.name })
      return { ok: true, imported, notebookId: imported[0] ? imported[0].notebookId : undefined, notebooks: state.notebooks, trash: trashSummary() }
    }
    throw new ActionError('invalid-action', 'Unknown import kind.')
  }

  /* -------------------------------- export -------------------------------- */

  const collectImages = async (notebooks) => {
    const images = {}
    const files = new Map()
    for (const notebook of notebooks) {
      for (const entry of notebook.entries) {
        for (const image of entry.images) {
          if (files.has(imageFileName(image))) continue
          try {
            files.set(imageFileName(image), await readFile(join(imagesDir, imageFileName(image))))
          } catch {
            // A missing image is simply absent from the export.
          }
        }
      }
    }
    for (const [name, data] of files) images[name] = data.toString('base64')
    return { images, files }
  }

  const buildMarkdown = async (notebook, entries, lang) => {
    const labels = lang === 'zh'
      ? { intro: '导出自 DSH Notebook', notes: '条笔记' }
      : { intro: 'Exported from DSH Notebook', notes: 'notes' }
    const lines = [
      `# ${notebook.name}`,
      '',
      `> ${labels.intro} · ${entries.length} ${labels.notes} · ${exportDate(lang)}`,
      '',
    ]
    const files = []
    for (const entry of entries) {
      lines.push('---', '', `### ${exportStamp(entry.createdAt, lang)}`)
      const source = entry.source
      if (source.sessionTitle !== '') {
        lines.push('', `*${source.sessionTitle}${source.workspace !== '' ? ` · ${source.workspace}` : ''}*`)
      }
      if (entry.tags.length > 0) lines.push('', `\`${entry.tags.join('` `')}\``)
      if (entry.text.trim() !== '') lines.push('', entry.text)
      for (const image of entry.images) {
        const fileName = imageFileName(image)
        try {
          const data = await readFile(join(imagesDir, fileName))
          files.push({ name: `images/${fileName}`, data })
          lines.push('', `![${(image.caption || image.name).replace(/[[\]]/gu, '')}](images/${fileName})`)
          if (image.caption !== '') lines.push('', `*${image.caption}*`)
        } catch {
          // A missing image file simply omits that attachment from the export.
        }
      }
      lines.push('')
    }
    return { markdown: `${lines.join('\n')}\n`, files }
  }

  const runAction = async (input, mode) => {
    await ready
    const action = input && typeof input.action === 'string' ? input.action : ''
    const list = () => (mode === 'summary' ? summaries() : state.notebooks)
    switch (action) {
      case 'list':
        return { ok: true, notebooks: summaries(), trash: trashSummary() }
      case 'snapshot':
        return { ok: true, notebooks: state.notebooks, trash: trashSummary() }
      case 'uploadImage':
        return uploadImage(input)
      case 'fetchImage':
        return fetchImage(input)
      case 'ocrImage':
        return ocrImage(input)
      case 'import':
        return mutate(async () => applyImport(input))
      case 'create':
        return mutate(async () => {
          if (state.notebooks.length >= MAX_NOTEBOOKS) {
            throw new ActionError('limit', `The ${MAX_NOTEBOOKS} notebook limit has been reached.`, 409)
          }
          const name = requireName(input.name)
          const text = optionalText(input.text)
          const images = normalizeImages(input.images)
          const tags = normalizeTags(input.tags)
          await assertImagesExist(images)
          const createdAt = nowIso()
          const notebook = { id: newId('notebook'), name, pinned: false, createdAt, updatedAt: createdAt, entries: [] }
          if (text !== null || images.length > 0) {
            notebook.entries.push({
              id: newId('entry'),
              text: text === null ? '' : text,
              images,
              tags,
              createdAt,
              updatedAt: createdAt,
              source: normalizeSource(input.source),
            })
          }
          state.notebooks.unshift(notebook)
          return notebookResult(notebook, mode)
        })
      case 'rename':
        return mutate(() => {
          const notebook = findNotebook(typeof input.notebookId === 'string' ? input.notebookId : '')
          notebook.name = requireName(input.name)
          notebook.updatedAt = nowIso()
          return notebookResult(notebook, mode)
        })
      case 'pin':
        return mutate(() => {
          const notebook = findNotebook(typeof input.notebookId === 'string' ? input.notebookId : '')
          notebook.pinned = input.pinned === true
          return notebookResult(notebook, mode)
        })
      case 'append':
        return mutate(async () => {
          const notebook = findNotebook(typeof input.notebookId === 'string' ? input.notebookId : '')
          if (notebook.entries.length >= MAX_ENTRIES_PER_NOTEBOOK) {
            throw new ActionError('limit', `This notebook already holds ${MAX_ENTRIES_PER_NOTEBOOK} notes.`, 409)
          }
          const text = requireText(input.text)
          const images = normalizeImages(input.images)
          const tags = normalizeTags(input.tags)
          await assertImagesExist(images)
          const entryId = newId('entry')
          notebook.entries.push({
            id: entryId,
            text,
            images,
            tags,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            source: normalizeSource(input.source),
          })
          notebook.updatedAt = nowIso()
          return notebookResult(notebook, mode, { entryId })
        })
      case 'addEntry':
        return mutate(() => {
          const notebook = findNotebook(typeof input.notebookId === 'string' ? input.notebookId : '')
          if (notebook.entries.length >= MAX_ENTRIES_PER_NOTEBOOK) {
            throw new ActionError('limit', `This notebook already holds ${MAX_ENTRIES_PER_NOTEBOOK} notes.`, 409)
          }
          const createdAt = nowIso()
          const entryId = newId('entry')
          notebook.entries.push({
            id: entryId,
            text: '',
            images: [],
            tags: [],
            createdAt,
            updatedAt: createdAt,
            source: normalizeSource(null),
          })
          notebook.updatedAt = createdAt
          return notebookResult(notebook, mode, { entryId })
        })
      case 'updateEntry':
        return mutate(async () => {
          const notebook = findNotebook(typeof input.notebookId === 'string' ? input.notebookId : '')
          const entry = findEntry(notebook, typeof input.entryId === 'string' ? input.entryId : '')
          const text = softText(input.text)
          const images = normalizeImages(input.images)
          const tags = normalizeTags(input.tags)
          await assertImagesExist(images)
          entry.text = text
          entry.images = images
          entry.tags = tags
          entry.updatedAt = nowIso()
          notebook.updatedAt = entry.updatedAt
          return notebookResult(notebook, mode, { entryId: entry.id })
        })
      case 'deleteEntry':
        return mutate(() => {
          const notebook = findNotebook(typeof input.notebookId === 'string' ? input.notebookId : '')
          const entryId = typeof input.entryId === 'string' ? input.entryId : ''
          const index = notebook.entries.findIndex((candidate) => candidate.id === entryId)
          if (index < 0) throw new ActionError('entry-not-found', 'That note does not exist.', 404)
          const [entry] = notebook.entries.splice(index, 1)
          const item = trashEntry(notebook, entry)
          notebook.updatedAt = nowIso()
          return notebookResult(notebook, mode, { entryId, trashId: item.id })
        })
      case 'deleteEntries':
        return mutate(() => {
          const notebook = findNotebook(typeof input.notebookId === 'string' ? input.notebookId : '')
          const ids = Array.isArray(input.entryIds) ? input.entryIds.filter((id) => typeof id === 'string') : []
          const trashIds = []
          for (const entryId of ids) {
            const index = notebook.entries.findIndex((candidate) => candidate.id === entryId)
            if (index < 0) continue
            const [entry] = notebook.entries.splice(index, 1)
            trashIds.push(trashEntry(notebook, entry).id)
          }
          notebook.updatedAt = nowIso()
          return notebookResult(notebook, mode, { trashIds })
        })
      case 'delete':
        return mutate(() => {
          const notebookId = typeof input.notebookId === 'string' ? input.notebookId : ''
          const index = state.notebooks.findIndex((candidate) => candidate.id === notebookId)
          if (index < 0) throw new ActionError('not-found', 'That notebook does not exist.', 404)
          const [removed] = state.notebooks.splice(index, 1)
          const item = trashNotebook(removed)
          return {
            ok: true,
            deletedId: removed.id,
            name: removed.name,
            trashId: item.id,
            notebooks: list(),
            trash: trashSummary(),
          }
        })
      case 'restoreTrash':
        return mutate(() => {
          const trashId = typeof input.trashId === 'string' ? input.trashId : ''
          const index = state.trash.findIndex((candidate) => candidate.id === trashId)
          if (index < 0) throw new ActionError('trash-not-found', 'That trash item no longer exists.', 404)
          const item = state.trash[index]
          if (item.kind === 'notebook') {
            if (state.notebooks.some((notebook) => notebook.id === item.notebook.id)) {
              throw new ActionError('conflict', 'That notebook already exists.', 409)
            }
            state.notebooks.unshift(item.notebook)
          } else {
            const notebook = state.notebooks.find((candidate) => candidate.id === item.notebookId)
            if (notebook === undefined) throw new ActionError('notebook-missing', 'Restore the notebook first.', 409)
            if (notebook.entries.some((entry) => entry.id === item.entry.id)) {
              throw new ActionError('conflict', 'That note already exists.', 409)
            }
            notebook.entries.push(item.entry)
            notebook.updatedAt = nowIso()
          }
          state.trash.splice(index, 1)
          return {
            ok: true,
            restoredId: item.id,
            kind: item.kind,
            name: item.kind === 'notebook' ? item.notebook.name : item.notebookName,
            notebookId: item.kind === 'notebook' ? item.notebook.id : item.notebookId,
            notebooks: state.notebooks,
            trash: trashSummary(),
          }
        })
      case 'purgeTrash':
        return mutate(() => {
          const trashId = typeof input.trashId === 'string' ? input.trashId : ''
          const index = state.trash.findIndex((candidate) => candidate.id === trashId)
          if (index < 0) throw new ActionError('trash-not-found', 'That trash item no longer exists.', 404)
          state.trash.splice(index, 1)
          return { ok: true, notebooks: state.notebooks, trash: trashSummary() }
        })
      case 'emptyTrash':
        return mutate(() => {
          state.trash = []
          return { ok: true, notebooks: state.notebooks, trash: [] }
        })
      case 'moveEntries':
        return mutate(() => {
          const source = findNotebook(typeof input.notebookId === 'string' ? input.notebookId : '')
          const target = findNotebook(typeof input.targetNotebookId === 'string' ? input.targetNotebookId : '')
          if (source.id === target.id) throw new ActionError('invalid-action', 'Choose a different notebook.')
          const ids = Array.isArray(input.entryIds) ? input.entryIds : []
          if (target.entries.length + ids.length > MAX_ENTRIES_PER_NOTEBOOK) {
            throw new ActionError('limit', 'The target notebook cannot hold that many notes.', 409)
          }
          const moving = []
          for (const entryId of ids) {
            const index = source.entries.findIndex((candidate) => candidate.id === entryId)
            if (index < 0) continue
            moving.push(source.entries.splice(index, 1)[0])
          }
          for (const entry of moving) {
            target.entries.push({ ...entry, id: newId('entry') })
          }
          const now = nowIso()
          source.updatedAt = now
          target.updatedAt = now
          return {
            ok: true,
            moved: moving.length,
            notebooks: state.notebooks,
            trash: trashSummary(),
            notebookId: target.id,
          }
        })
      case 'mergeNotebook':
        return mutate(() => {
          const source = findNotebook(typeof input.notebookId === 'string' ? input.notebookId : '')
          const target = findNotebook(typeof input.targetNotebookId === 'string' ? input.targetNotebookId : '')
          if (source.id === target.id) throw new ActionError('invalid-action', 'Choose a different notebook.')
          if (target.entries.length + source.entries.length > MAX_ENTRIES_PER_NOTEBOOK) {
            throw new ActionError('limit', 'The target notebook cannot hold that many notes.', 409)
          }
          for (const entry of source.entries) target.entries.push({ ...entry, id: newId('entry') })
          source.entries = []
          const now = nowIso()
          target.updatedAt = now
          const index = state.notebooks.findIndex((candidate) => candidate.id === source.id)
          if (index >= 0) state.notebooks.splice(index, 1)
          const item = trashNotebook(source)
          return {
            ok: true,
            merged: true,
            trashId: item.id,
            notebooks: state.notebooks,
            trash: trashSummary(),
            notebookId: target.id,
          }
        })
      default:
        throw new ActionError('invalid-action', 'Unknown notebook action.')
    }
  }

  /* --------------------------------- routes -------------------------------- */

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE_PATH,
    handler: async (req, res) => {
      try {
        if (req.method === 'GET') {
          respond(res, 200, await runAction({ action: 'snapshot' }, 'full'))
          return
        }
        if (req.method !== 'POST') {
          res.writeHead(405, { allow: 'GET, POST' })
          res.end()
          return
        }
        const contentType = String(req.headers['content-type'] || '').toLowerCase()
        if (!contentType.startsWith('application/json')) {
          throw new ActionError('unsupported-media-type', 'Expected application/json.', 415)
        }
        const body = await readJson(req)
        respond(res, 200, await runAction(body, 'full'))
      } catch (error) {
        const status = error instanceof ActionError ? error.status : 500
        const code = error instanceof ActionError ? error.code : 'internal'
        if (!(error instanceof ActionError)) console.error('[dshnotebook] request failed:', error)
        respond(res, status, {
          ok: false,
          code,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    },
  }), 'dshnotebook: http route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: IMAGE_ROUTE_PREFIX,
    resource: async (request) => {
      const url = new URL(request.url, 'http://localhost')
      const name = url.pathname.startsWith(`${IMAGE_ROUTE_PREFIX}/`)
        ? url.pathname.slice(IMAGE_ROUTE_PREFIX.length + 1)
        : ''
      if (!IMAGE_FILE_PATTERN.test(name)) return new Response('Not found', { status: 404 })
      try {
        const bytes = await readFile(join(imagesDir, name))
        const ext = name.slice(name.lastIndexOf('.') + 1)
        return new Response(bytes, {
          headers: {
            'content-type': IMAGE_FORMATS[ext].mediaType,
            'content-length': String(bytes.length),
            'cache-control': 'public, max-age=31536000, immutable',
            'x-content-type-options': 'nosniff',
          },
        })
      } catch {
        return new Response('Not found', { status: 404 })
      }
    },
  }), 'dshnotebook: image route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: EXPORT_ROUTE_PATH,
    handler: async (req, res) => {
      try {
        if (req.method !== 'GET') {
          res.writeHead(405, { allow: 'GET' })
          res.end()
          return
        }
        const url = new URL(req.url, 'http://localhost')
        const notebookId = url.searchParams.get('notebookId') || ''
        const lang = url.searchParams.get('lang') === 'zh' ? 'zh' : 'en'
        const format = url.searchParams.get('format') || 'auto'
        await ready
        if (format === 'json') {
          const scope = notebookId === '' ? state.notebooks : [findNotebook(notebookId)]
          const { images } = await collectImages(scope)
          const backup = {
            format: BACKUP_FORMAT,
            version: DATA_VERSION,
            exportedAt: nowIso(),
            notebooks: scope,
            images,
          }
          const body = Buffer.from(JSON.stringify(backup, null, 2), 'utf8')
          const safeName = scope.length === 1 ? safeExportName(scope[0].name) : 'dshnotebook-backup'
          res.writeHead(200, {
            'content-type': 'application/json; charset=utf-8',
            'content-length': body.length,
            'content-disposition': `attachment; filename="notebook-backup.json"; filename*=UTF-8''${encodeURIComponent(`${safeName}.json`)}`,
            'cache-control': 'no-store',
          })
          res.end(body)
          return
        }
        const notebook = state.notebooks.find((candidate) => candidate.id === notebookId)
        if (notebook === undefined) throw new ActionError('not-found', 'That notebook does not exist.', 404)
        const requestedEntries = (url.searchParams.get('entries') || '').split(',').map((value) => value.trim()).filter(Boolean)
        const entries = requestedEntries.length === 0
          ? notebook.entries
          : notebook.entries.filter((entry) => requestedEntries.includes(entry.id))
        const { markdown, files } = await buildMarkdown(notebook, entries, lang)
        const safeName = safeExportName(notebook.name)
        if (files.length > 0) {
          const manifest = { format: 'dshnotebook-notebook', version: DATA_VERSION, notebook: { ...notebook, entries } }
          const archive = makeZip([
            { name: 'notebook.json', data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8') },
            { name: `${safeName}.md`, data: Buffer.from(markdown, 'utf8') },
            ...files,
          ])
          res.writeHead(200, {
            'content-type': 'application/zip',
            'content-length': archive.length,
            'content-disposition': `attachment; filename="notebook.zip"; filename*=UTF-8''${encodeURIComponent(`${safeName}.zip`)}`,
            'cache-control': 'no-store',
          })
          res.end(archive)
          return
        }
        const body = Buffer.from(markdown, 'utf8')
        res.writeHead(200, {
          'content-type': 'text/markdown; charset=utf-8',
          'content-length': body.length,
          'content-disposition': `attachment; filename="notebook.md"; filename*=UTF-8''${encodeURIComponent(`${safeName}.md`)}`,
          'cache-control': 'no-store',
        })
        res.end(body)
      } catch (error) {
        const status = error instanceof ActionError ? error.status : 500
        const code = error instanceof ActionError ? error.code : 'internal'
        if (!(error instanceof ActionError)) console.error('[dshnotebook] export failed:', error)
        respond(res, status, { ok: false, code, message: error instanceof Error ? error.message : String(error) })
      }
    },
  }), 'dshnotebook: export route')

  /* ---------------------------------- tool --------------------------------- */

  const tools = ctx.get('tools')
  if (tools && typeof tools.register === 'function') {
    ctx.effect(() => tools.register({
      name: 'notebook',
      description: 'Read and add to the user\'s DSH Notebook notebooks. "list" returns notebook ids, names, note counts, and pins. "create" starts a notebook with an optional first note. "append" adds text to an existing notebook. Editing, deleting, and restoring are intentionally left to the DSH Notebook panel.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'create', 'append'],
            description: 'list | create | append',
          },
          notebookId: {
            type: 'string',
            description: 'Target notebook id from list; required for append.',
          },
          name: {
            type: 'string',
            description: 'Notebook name for create, 1-120 characters.',
          },
          text: {
            type: 'string',
            description: 'Markdown or plain text stored as the first or next note.',
          },
        },
        required: ['action'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean' },
            code: { type: 'string' },
            message: { type: 'string' },
            notebooks: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  entryCount: { type: 'integer' },
                  imageCount: { type: 'integer' },
                  pinned: { type: 'boolean' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
                required: ['id', 'name'],
              },
            },
            notebook: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                entryCount: { type: 'integer' },
              },
              required: ['id', 'name'],
            },
          },
          required: ['ok'],
        },
        render: (_args, value) => [{ type: 'text', text: describeToolValue(value) }],
      },
      async execute (args) {
        const input = args && typeof args === 'object' ? args : {}
        try {
          const result = await runAction(input, 'summary')
          if (result.notebook) {
            return { ok: true, notebook: result.notebook, notebooks: result.notebooks }
          }
          return { ok: true, notebooks: result.notebooks }
        } catch (error) {
          return {
            ok: false,
            code: error && typeof error.code === 'string' ? error.code : 'internal',
            message: error instanceof Error ? error.message : String(error),
          }
        }
      },
    }), 'dshnotebook: agent tool')
  }

  ctx.effect(() => () => {
    if (pruneTimer !== null) {
      clearTimeout(pruneTimer)
      pruneTimer = null
    }
  }, 'dshnotebook: prune timer')

  void ready.then(() => {
    schedulePrune()
    // Build the OCR helper in the background so the first use is instant.
    if (process.platform === 'darwin') void ensureOcrBinary().catch(() => {})
  })
}
