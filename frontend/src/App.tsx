import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import {
  Archive,
  Bold,
  CheckSquare,
  Code2,
  Copy,
  Download,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  PanelLeft,
  PencilLine,
  Pilcrow,
  Pin,
  Rows3,
  Star,
  Quote,
  Search,
  Share,
  Slash,
  SquarePen,
  Strikethrough,
  Table2,
  Trash2,
  Underline as UnderlineIcon,
  Focus,
} from 'lucide-react'

import './App.css'
import {
  createNote,
  deleteNote,
  getCurrentUser,
  getNotes,
  login,
  logout,
  register,
  updateNote,
  uploadAttachment,
} from './lib/api'
import type { AuthPayload, Note, NotePayload } from './types'

type SessionStatus = 'booting' | 'anonymous' | 'authenticated'
type AuthMode = 'login' | 'register'
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved'
type Shelf = 'all' | 'pinned' | 'favorites' | 'archived'

interface Toast {
  id: number
  text: string
}

interface CommandItem {
  id: string
  label: string
  hint: string
  keywords: string
  icon: typeof Pilcrow
  action: () => void
}

const defaultDraft: NotePayload = {
  title: '',
  text: '',
  summary: '',
  tags: [],
  is_pinned: false,
  is_favorite: false,
  is_archived: false,
}

const shelfLabels: Record<Shelf, string> = {
  all: 'Notes',
  pinned: 'Pinned',
  favorites: 'Favorites',
  archived: 'Archive',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function sortNotes(items: Note[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.edit_time).getTime() - new Date(left.edit_time).getTime(),
  )
}

function htmlToPlainText(value: string) {
  if (!value) {
    return ''
  }

  const doc = new DOMParser().parseFromString(value, 'text/html')
  return doc.body.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

function extractSummary(value: string) {
  const text = htmlToPlainText(value)
  return text.slice(0, 280)
}

function estimateReadingTime(words: number) {
  return Math.max(1, Math.ceil(words / 180))
}

function noteToPayload(note: Note): NotePayload {
  return {
    title: note.title,
    text: note.text ?? '',
    summary: note.summary ?? '',
    tags: note.tags,
    is_pinned: note.is_pinned,
    is_favorite: note.is_favorite,
    is_archived: note.is_archived,
  }
}

function payloadEqualsNote(payload: NotePayload, note: Note | null) {
  if (!note) {
    return false
  }

  return JSON.stringify({
    ...payload,
    text: payload.text ?? '',
    summary: payload.summary ?? '',
  }) === JSON.stringify(noteToPayload(note))
}

function App() {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('booting')
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authForm, setAuthForm] = useState<AuthPayload>({ login: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null)
  const [draft, setDraft] = useState<NotePayload>(defaultDraft)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [notesBusy, setNotesBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [notice, setNotice] = useState('Private notes synced with secure cookie auth.')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeShelf, setActiveShelf] = useState<Shelf>('all')
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [focusMode, setFocusMode] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [uploadBusy, setUploadBusy] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [toasts, setToasts] = useState<Toast[]>([])

  const toastIdRef = useRef(0)
  const autosaveTimerRef = useRef<number | null>(null)
  const titleRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const hydratedNoteIdRef = useRef<number | null>(null)
  const dragDepthRef = useRef(0)

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null
  const shelfCounts = useMemo(
    () => ({
      all: notes.filter((note) => !note.is_archived).length,
      pinned: notes.filter((note) => note.is_pinned && !note.is_archived).length,
      favorites: notes.filter((note) => note.is_favorite && !note.is_archived).length,
      archived: notes.filter((note) => note.is_archived).length,
    }),
    [notes],
  )

  const filteredNotes = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase()

    const shelfItems = notes.filter((note) => {
      if (activeShelf === 'pinned') {
        return note.is_pinned && !note.is_archived
      }

      if (activeShelf === 'favorites') {
        return note.is_favorite && !note.is_archived
      }

      if (activeShelf === 'archived') {
        return note.is_archived
      }

      return !note.is_archived
    })

    if (!normalized) {
      return shelfItems
    }

    return shelfItems.filter((note) => {
      const haystack = [
        note.title,
        note.summary ?? '',
        htmlToPlainText(note.text ?? ''),
      ]
        .join('\n')
        .toLowerCase()

      return haystack.includes(normalized)
    })
  }, [activeShelf, notes, searchQuery])

  const pushToast = useCallback((text: string) => {
    const nextToast = { id: ++toastIdRef.current, text }
    setToasts((current) => [...current, nextToast])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== nextToast.id))
    }, 2600)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: 'Начните писать заметку…',
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Highlight,
      TextStyle,
      Color,
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class: 'notes-editor__content',
      },
    },
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML()
      setDraft((current) => ({
        ...current,
        text: html,
        summary: extractSummary(html),
      }))
    },
  })

  const dirty = selectedNote ? !payloadEqualsNote(draft, selectedNote) : false
  const plainText = htmlToPlainText(draft.text ?? '')
  const wordCount = plainText ? plainText.split(/\s+/).length : 0
  const readingTime = estimateReadingTime(wordCount)

  const commandItems = useMemo<CommandItem[]>(() => {
    if (!editor) {
      return []
    }

    return [
      {
        id: 'paragraph',
        label: 'Body text',
        hint: 'Default paragraph block',
        keywords: 'paragraph body text normal',
        icon: Pilcrow,
        action: () => editor.chain().focus().setParagraph().run(),
      },
      {
        id: 'title',
        label: 'Large heading',
        hint: 'Primary section title',
        keywords: 'heading h1 title big',
        icon: Heading1,
        action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        id: 'section',
        label: 'Section heading',
        hint: 'Secondary heading block',
        keywords: 'heading h2 section subtitle',
        icon: Heading2,
        action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        id: 'subsection',
        label: 'Subsection',
        hint: 'Compact heading block',
        keywords: 'heading h3 subsection',
        icon: Heading3,
        action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        id: 'quote',
        label: 'Quote',
        hint: 'Block quote with emphasis',
        keywords: 'quote citation blockquote',
        icon: Quote,
        action: () => editor.chain().focus().toggleBlockquote().run(),
      },
      {
        id: 'bullets',
        label: 'Bullet list',
        hint: 'Unordered list',
        keywords: 'list bullets unordered',
        icon: List,
        action: () => editor.chain().focus().toggleBulletList().run(),
      },
      {
        id: 'numbered',
        label: 'Numbered list',
        hint: 'Ordered sequence',
        keywords: 'list ordered numbered',
        icon: ListOrdered,
        action: () => editor.chain().focus().toggleOrderedList().run(),
      },
      {
        id: 'checklist',
        label: 'Checklist',
        hint: 'Trackable task list',
        keywords: 'task checklist todos',
        icon: CheckSquare,
        action: () => editor.chain().focus().toggleTaskList().run(),
      },
      {
        id: 'code',
        label: 'Code block',
        hint: 'Monospaced preformatted block',
        keywords: 'code snippet block',
        icon: Code2,
        action: () => editor.chain().focus().toggleCodeBlock().run(),
      },
      {
        id: 'divider',
        label: 'Divider',
        hint: 'Visual section break',
        keywords: 'divider separator line rule',
        icon: Minus,
        action: () => editor.chain().focus().insertContent('<hr /><p></p>').run(),
      },
      {
        id: 'table',
        label: 'Table',
        hint: '3 by 3 grid',
        keywords: 'table grid columns rows',
        icon: Table2,
        action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
      {
        id: 'image',
        label: 'Image',
        hint: 'Upload from device',
        keywords: 'image media upload picture photo',
        icon: ImagePlus,
        action: () => fileInputRef.current?.click(),
      },
    ]
  }, [editor])

  const filteredCommands = useMemo(() => {
    const query = commandQuery.trim().toLowerCase()
    if (!query) {
      return commandItems
    }

    return commandItems.filter((item) =>
      `${item.label} ${item.hint} ${item.keywords}`.toLowerCase().includes(query),
    )
  }, [commandItems, commandQuery])

  const syncDraft = useCallback((nextNote: Note | null) => {
    const payload = nextNote ? noteToPayload(nextNote) : defaultDraft
    setDraft(payload)
    setTagInput(payload.tags.join(', '))
    setSaveState('idle')
    setToolbarOpen(false)

    if (editor) {
      editor.commands.setContent(payload.text || '<p></p>', { emitUpdate: false })
    }
  }, [editor])

  const loadNotes = useCallback(async (preferredId?: number | null) => {
    setNotesBusy(true)

    try {
      const nextNotes = sortNotes(await getNotes())
      setNotes(nextNotes)
      setSelectedNoteId((currentId) => {
        const candidate = preferredId ?? currentId
        if (candidate && nextNotes.some((note) => note.id === candidate)) {
          return candidate
        }
        return nextNotes[0]?.id ?? null
      })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to load notes.')
    } finally {
      setNotesBusy(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser()
        setSessionStatus('authenticated')
        setNotice(`Welcome back, ${user.login}.`)
        await loadNotes()
      } catch {
        setNotes([])
        setSelectedNoteId(null)
        setSessionStatus('anonymous')
        setNotice('Sign in to open your notes workspace.')
      }
    })()
  }, [loadNotes])

  useEffect(() => {
    if (!editor) {
      return
    }

    if (selectedNoteId === null) {
      if (hydratedNoteIdRef.current !== null) {
        hydratedNoteIdRef.current = null
        syncDraft(null)
      }
      return
    }

    if (hydratedNoteIdRef.current === selectedNoteId) {
      return
    }

    const nextNote = notes.find((note) => note.id === selectedNoteId) ?? null
    hydratedNoteIdRef.current = selectedNoteId
    syncDraft(nextNote)
  }, [editor, notes, selectedNoteId, syncDraft])

  const persistCurrentNote = useCallback(async (successNotice?: string, silent = false) => {
    if (!selectedNoteId || !selectedNote) {
      return
    }

    setSaveState('saving')

    try {
      const payload = {
        ...draft,
        title: draft.title.trim() || 'Untitled note',
        text: draft.text || '<p></p>',
        summary: extractSummary(draft.text || ''),
      }

      const updated = await updateNote(selectedNoteId, payload)
      setNotes((current) =>
        sortNotes(current.map((note) => (note.id === updated.id ? updated : note))),
      )
      setDraft(noteToPayload(updated))
      setTagInput(updated.tags.join(', '))
      setSaveState('saved')
      setNotice(successNotice ?? 'Note saved.')
      if (!silent) {
        pushToast(successNotice ?? 'Saved')
      }
    } catch (error) {
      setSaveState('dirty')
      setNotice(error instanceof Error ? error.message : 'Failed to save note.')
      if (!silent) {
        pushToast('Save failed')
      }
    }
  }, [draft, pushToast, selectedNote, selectedNoteId])

  useEffect(() => {
    if (!selectedNote || !dirty) {
      if (saveState !== 'saving') {
        setSaveState(selectedNote ? 'saved' : 'idle')
      }
      return
    }

    setSaveState('dirty')
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current)
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void persistCurrentNote('Autosaved.', true)
    }, 900)

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [dirty, persistCurrentNote, saveState, selectedNote])

  const handleCreateNote = useCallback(async () => {
    try {
      const note = await createNote({
        ...defaultDraft,
        title: `Untitled note ${notes.length + 1}`,
      })

      setNotes((current) => sortNotes([note, ...current.filter((item) => item.id !== note.id)]))
      setSelectedNoteId(note.id)
      setNotice('New note created.')
      pushToast('New note')
      window.setTimeout(() => titleRef.current?.focus(), 60)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to create note.')
    }
  }, [notes.length, pushToast])

  const handleDuplicateNote = useCallback(async () => {
    if (!selectedNote) {
      return
    }

    try {
      const duplicate = await createNote({
        ...noteToPayload(selectedNote),
        title: `${selectedNote.title} copy`,
      })
      setNotes((current) => sortNotes([duplicate, ...current]))
      setSelectedNoteId(duplicate.id)
      setNotice('Note duplicated.')
      pushToast('Duplicated')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to duplicate note.')
    }
  }, [pushToast, selectedNote])

  const handleDeleteNote = useCallback(async () => {
    if (!selectedNoteId || !selectedNote) {
      return
    }

    if (!window.confirm(`Delete "${selectedNote.title}"?`)) {
      return
    }

    setDeleteBusy(true)
    try {
      await deleteNote(selectedNoteId)
      const remaining = notes.filter((note) => note.id !== selectedNoteId)
      setNotes(remaining)
      setSelectedNoteId(remaining[0]?.id ?? null)
      setNotice('Note deleted.')
      pushToast('Deleted')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to delete note.')
    } finally {
      setDeleteBusy(false)
    }
  }, [notes, pushToast, selectedNote, selectedNoteId])

  const handleExportNote = useCallback(() => {
    if (!selectedNote) {
      return
    }

    const content = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${draft.title || 'Untitled note'}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 760px; margin: 48px auto; padding: 0 20px; color: #171717; line-height: 1.7; }
      h1, h2, h3 { line-height: 1.15; }
      img { max-width: 100%; border-radius: 16px; }
      blockquote { margin: 0; padding-left: 16px; border-left: 3px solid #d4d4d4; color: #555; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; }
      code { background: #f2f2f2; border-radius: 6px; padding: 2px 6px; }
      pre { background: #111; color: #f5f5f5; border-radius: 12px; padding: 16px; overflow: auto; }
    </style>
  </head>
  <body>
    <h1>${draft.title || 'Untitled note'}</h1>
    ${draft.text || '<p></p>'}
  </body>
</html>`

    const blob = new Blob([content], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${(draft.title || 'untitled-note').replace(/\s+/g, '-').toLowerCase()}.html`
    link.click()
    URL.revokeObjectURL(url)
    pushToast('Exported')
  }, [draft, pushToast, selectedNote])

  const updateDraftFlag = useCallback((key: 'is_pinned' | 'is_favorite' | 'is_archived') => {
    setDraft((current) => ({ ...current, [key]: !current[key] }))
  }, [])

  const applyTags = useCallback((value: string) => {
    const nextTags = value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    setTagInput(value)
    setDraft((current) => ({ ...current, tags: nextTags }))
  }, [])

  const handleCommandSelect = useCallback((command: CommandItem) => {
    command.action()
    setCommandOpen(false)
    setCommandQuery('')
    setToolbarOpen(false)
  }, [])

  const uploadImageFile = useCallback(async (file: File) => {
    if (!editor || !selectedNoteId) {
      return
    }

    setUploadBusy(true)
    try {
      const result = await uploadAttachment(file)
      editor.chain().focus().setImage({ src: result.url, alt: file.name }).run()
      setNotice('Image inserted into note.')
      pushToast('Image added')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to upload image.')
      pushToast('Upload failed')
    } finally {
      setUploadBusy(false)
    }
  }, [editor, pushToast, selectedNoteId])

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')

    try {
      if (authMode === 'register') {
        await register(authForm)
      }
      await login(authForm)
      const user = await getCurrentUser()
      setSessionStatus('authenticated')
      setAuthForm({ login: '', password: '' })
      setNotice(authMode === 'register' ? `Account created for ${user.login}.` : `Signed in as ${user.login}.`)
      await loadNotes()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleLogout() {
    setAuthBusy(true)
    try {
      await logout()
    } finally {
      setNotes([])
      setSelectedNoteId(null)
      setDraft(defaultDraft)
      setSessionStatus('anonymous')
      setAuthBusy(false)
      setNotice('Signed out.')
    }
  }

  async function handleUploadImage() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      return
    }

    try {
      await uploadImageFile(file)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey

      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void persistCurrentNote('Saved manually.')
      }

      if (meta && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        void handleCreateNote()
      }

      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      }

      if (event.key === '/' && editor?.isFocused) {
        const currentBlockText = editor.state.selection.$from.parent.textContent.trim()
        if (!currentBlockText) {
          event.preventDefault()
          setCommandOpen(true)
        }
      }

      if (event.key === 'Escape') {
        setCommandOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editor, handleCreateNote, persistCurrentNote])

  if (sessionStatus === 'booting') {
    return (
      <main className="app-shell app-shell--loading">
        <div className="loading-mark">
          <span className="loading-mark__orbit" />
          <p>Opening notes…</p>
        </div>
      </main>
    )
  }

  if (sessionStatus === 'anonymous') {
    return (
      <main className="app-shell auth-screen">
        <section className="auth-screen__panel">
          <div className="auth-screen__brand">
            <span className="auth-screen__badge">Cloud Notes</span>
            <h1>Dark, focused notes with visual formatting.</h1>
            <p>
              Apple Notes inspired workspace with secure sign in, formatting buttons, note
              library and autosave.
            </p>
          </div>

          <form className="auth-form auth-form--dark" onSubmit={handleAuthSubmit}>
            <label>
              <span>Login</span>
              <input
                required
                type="text"
                value={authForm.login}
                onChange={(event) =>
                  setAuthForm((current) => ({ ...current, login: event.target.value }))
                }
              />
            </label>

            <label>
              <span>Password</span>
              <input
                required
                type="password"
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>

            {authError ? <p className="form-error">{authError}</p> : null}

            <button className="button button--bright" disabled={authBusy} type="submit">
              {authMode === 'login' ? 'Open workspace' : 'Create account'}
            </button>

            <button
              className="auth-switch"
              type="button"
              onClick={() =>
                setAuthMode((current) => (current === 'login' ? 'register' : 'login'))
              }
            >
              {authMode === 'login' ? 'Create account instead' : 'I already have an account'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className={`app-shell notes-app${focusMode ? ' notes-app--focus' : ''}`}>
      <aside className={`notes-sidebar${sidebarOpen ? '' : ' notes-sidebar--collapsed'}${focusMode ? ' notes-sidebar--hidden' : ''}`}>
        <div className="notes-sidebar__top">
          <button className="icon-button" type="button" onClick={() => setSidebarOpen((current) => !current)}>
            <PanelLeft size={16} />
          </button>
          <button className="icon-button" type="button" onClick={() => void handleCreateNote()}>
            <SquarePen size={16} />
          </button>
        </div>

        <div className="notes-sidebar__section">
          <h2>{shelfLabels[activeShelf]}</h2>
          <span>{shelfCounts[activeShelf]}</span>
        </div>

        <div className="sidebar-shelves">
          {(['all', 'pinned', 'favorites', 'archived'] as Shelf[]).map((shelf) => (
            <button
              key={shelf}
              className={`sidebar-shelf${activeShelf === shelf ? ' sidebar-shelf--active' : ''}`}
              type="button"
              onClick={() => setActiveShelf(shelf)}
            >
              <span>{shelfLabels[shelf]}</span>
              <span>{shelfCounts[shelf]}</span>
            </button>
          ))}
        </div>

        <div className="notes-list notes-list--dark">
          {notesBusy ? <p className="muted muted--dark">Loading…</p> : null}
          {filteredNotes.map((note) => (
            <button
              key={note.id}
              className={`note-row${note.id === selectedNoteId ? ' note-row--active' : ''}`}
              type="button"
              onClick={() => setSelectedNoteId(note.id)}
            >
              <strong>{note.title}</strong>
              <span>{note.summary || htmlToPlainText(note.text ?? '') || 'Empty note'}</span>
            </button>
          ))}
          {!notesBusy && !filteredNotes.length ? (
            <p className="muted muted--dark">No notes in this shelf.</p>
          ) : null}
        </div>
      </aside>

      <section className="notes-workspace">
        <header className="notes-toolbar">
          <div className="notes-toolbar__left">
            <button className="icon-button" type="button" onClick={() => setToolbarOpen((current) => !current)}>
              <PencilLine size={16} />
            </button>
          </div>

          <div className="notes-toolbar__center">
            <div className="toolbar-pill">
              <button
                className={`toolbar-pill__button${editor?.isActive('bold') ? ' is-active' : ''}`}
                type="button"
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                <Bold size={16} />
              </button>
              <button
                className={`toolbar-pill__button${editor?.isActive('italic') ? ' is-active' : ''}`}
                type="button"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                <Italic size={16} />
              </button>
              <button
                className={`toolbar-pill__button${editor?.isActive('underline') ? ' is-active' : ''}`}
                type="button"
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
              >
                <UnderlineIcon size={16} />
              </button>
              <button
                className={`toolbar-pill__button${editor?.isActive('strike') ? ' is-active' : ''}`}
                type="button"
                onClick={() => editor?.chain().focus().toggleStrike().run()}
              >
                <Strikethrough size={16} />
              </button>
              <button
                className={`toolbar-pill__button${editor?.isActive('highlight') ? ' is-active' : ''}`}
                type="button"
                onClick={() => editor?.chain().focus().toggleHighlight().run()}
              >
                <Highlighter size={16} />
              </button>
              <button className="toolbar-pill__button" type="button" onClick={() => setToolbarOpen((current) => !current)}>
                Aa
              </button>
              <button
                className={`toolbar-pill__button${editor?.isActive('bulletList') ? ' is-active' : ''}`}
                type="button"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              >
                <List size={16} />
              </button>
              <button
                className={`toolbar-pill__button${editor?.isActive('orderedList') ? ' is-active' : ''}`}
                type="button"
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              >
                <ListOrdered size={16} />
              </button>
              <button
                className={`toolbar-pill__button${editor?.isActive('taskList') ? ' is-active' : ''}`}
                type="button"
                onClick={() => editor?.chain().focus().toggleTaskList().run()}
              >
                <CheckSquare size={16} />
              </button>
              <button
                className={`toolbar-pill__button${editor?.isActive('table') ? ' is-active' : ''}`}
                type="button"
                onClick={() =>
                  editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                }
              >
                <Table2 size={16} />
              </button>
              <button className="toolbar-pill__button" type="button" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus size={16} />
              </button>
            </div>

            {toolbarOpen ? (
              <div className="format-popover">
                <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
                  <Heading1 size={16} />
                  <span>Название</span>
                </button>
                <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
                  <Heading2 size={16} />
                  <span>Заголовок</span>
                </button>
                <button type="button" onClick={() => editor?.chain().focus().setParagraph().run()}>
                  <span className="format-popover__text">Текст</span>
                  <span>Основной текст</span>
                </button>
                <button type="button" onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
                  <Quote size={16} />
                  <span>Блок цитаты</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt('Вставьте ссылку')
                    if (url) {
                      editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
                    }
                  }}
                >
                  <Link2 size={16} />
                  <span>Ссылка</span>
                </button>
                <button type="button" onClick={() => editor?.chain().focus().toggleTaskList().run()}>
                  <CheckSquare size={16} />
                  <span>Чеклист</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                  }
                >
                  <Rows3 size={16} />
                  <span>Таблица</span>
                </button>
                <button type="button" onClick={() => editor?.chain().focus().setColor('#caa8ff').run()}>
                  <span className="format-popover__swatch format-popover__swatch--purple" />
                  <span>Фиолетовый текст</span>
                </button>
                <button type="button" onClick={() => editor?.chain().focus().unsetColor().run()}>
                  <span className="format-popover__swatch format-popover__swatch--clear" />
                  <span>Сбросить цвет</span>
                </button>
              </div>
            ) : null}
          </div>

          <div className="notes-toolbar__right">
            <button
              className={`icon-button${focusMode ? ' icon-button--active' : ''}`}
              type="button"
              onClick={() => setFocusMode((current) => !current)}
            >
              <Focus size={16} />
            </button>
            {selectedNote ? (
              <>
                <button
                  className={`icon-button${draft.is_pinned ? ' icon-button--active' : ''}`}
                  type="button"
                  onClick={() => updateDraftFlag('is_pinned')}
                >
                  <Pin size={16} />
                </button>
                <button
                  className={`icon-button${draft.is_favorite ? ' icon-button--active' : ''}`}
                  type="button"
                  onClick={() => updateDraftFlag('is_favorite')}
                >
                  <Star size={16} />
                </button>
                <button
                  className={`icon-button${draft.is_archived ? ' icon-button--active' : ''}`}
                  type="button"
                  onClick={() => updateDraftFlag('is_archived')}
                >
                  <Archive size={16} />
                </button>
              </>
            ) : null}
            <button className="icon-button" type="button" onClick={handleExportNote}>
              <Download size={16} />
            </button>
            <button className="icon-button" type="button" onClick={() => setSearchQuery('')}>
              <Search size={16} />
            </button>
            <button className="icon-button" type="button" onClick={() => setCommandOpen(true)}>
              <Slash size={16} />
            </button>
            <input
              className="toolbar-search"
              placeholder="Поиск"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </header>

        <div className="notes-stage">
          <div className="notes-stage__meta">
            <span>{selectedNote ? formatDate(selectedNote.edit_time) : 'No note selected'}</span>
            <span>{saveState === 'saving' ? 'Saving…' : saveState === 'dirty' ? 'Unsaved' : notice}</span>
            {selectedNote ? (
              <span>
                {draft.is_pinned ? 'Pinned' : draft.is_favorite ? 'Favorite' : draft.is_archived ? 'Archived' : 'Draft'}
              </span>
            ) : null}
          </div>

          {selectedNote ? (
            <article
              className={`notes-canvas${dragActive ? ' notes-canvas--drag' : ''}`}
              onDragEnter={(event) => {
                event.preventDefault()
                dragDepthRef.current += 1
                setDragActive(true)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'copy'
              }}
              onDragLeave={(event) => {
                event.preventDefault()
                dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
                if (dragDepthRef.current === 0) {
                  setDragActive(false)
                }
              }}
              onDrop={(event) => {
                event.preventDefault()
                dragDepthRef.current = 0
                setDragActive(false)

                const file = Array.from(event.dataTransfer.files).find((item) =>
                  item.type.startsWith('image/'),
                )

                if (file) {
                  void uploadImageFile(file)
                }
              }}
            >
              {dragActive ? (
                <div className="drop-overlay">
                  <strong>Drop image to insert</strong>
                  <span>PNG, JPG, WEBP or GIF</span>
                </div>
              ) : null}

              <div className="notes-canvas__head">
                <div className="notes-canvas__meta-pills">
                  <span className="meta-pill">{wordCount} words</span>
                  <span className="meta-pill">{readingTime} min read</span>
                  <span className="meta-pill">{draft.tags.length} tags</span>
                  {uploadBusy ? <span className="meta-pill">Uploading image…</span> : null}
                </div>

                <label className="tag-field">
                  <span>Tags</span>
                  <input
                    placeholder="research, chapter, draft"
                    type="text"
                    value={tagInput}
                    onBlur={() => applyTags(tagInput)}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        applyTags(tagInput)
                      }
                    }}
                  />
                </label>
              </div>

              <input
                ref={titleRef}
                className="notes-title"
                placeholder="Название"
                type="text"
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
              />

              {draft.tags.length ? (
                <div className="tag-cloud">
                  {draft.tags.map((tag) => (
                    <button
                      key={tag}
                      className="tag-chip"
                      type="button"
                      onClick={() => {
                        const nextTags = draft.tags.filter((item) => item !== tag)
                        setTagInput(nextTags.join(', '))
                        setDraft((current) => ({ ...current, tags: nextTags }))
                      }}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="quick-insert">
                <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
                  Section
                </button>
                <button type="button" onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
                  Quote
                </button>
                <button type="button" onClick={() => editor?.chain().focus().toggleTaskList().run()}>
                  Checklist
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().insertContent('<hr /><p></p>').run()}
                >
                  Divider
                </button>
                <button type="button" onClick={() => setCommandOpen(true)}>
                  Slash menu
                </button>
              </div>

              <EditorContent editor={editor} />

              <footer className="notes-footer">
                <div className="notes-footer__stats">
                  <span>{wordCount} words</span>
                  <span>{readingTime} min read</span>
                  <span>{draft.tags.length ? `${draft.tags.length} tags` : 'No tags'}</span>
                  <span>{draft.summary ? `${draft.summary.length} summary chars` : 'No summary'}</span>
                </div>
                <div className="notes-footer__actions">
                  <button className="ghost-button" type="button" onClick={() => void handleDuplicateNote()}>
                    <Copy size={14} />
                    <span>Duplicate</span>
                  </button>
                  <button className="ghost-button" type="button" onClick={() => void persistCurrentNote('Saved manually.')}>
                    Save
                  </button>
                  <button className="ghost-button" type="button" onClick={handleExportNote}>
                    <Share size={14} />
                    <span>Export</span>
                  </button>
                  <button className="ghost-button ghost-button--danger" disabled={deleteBusy} type="button" onClick={() => void handleDeleteNote()}>
                    <Trash2 size={14} />
                    <span>{deleteBusy ? 'Deleting…' : 'Delete'}</span>
                  </button>
                  <button className="ghost-button ghost-button--bright" disabled={authBusy} type="button" onClick={handleLogout}>
                    Sign out
                  </button>
                </div>
              </footer>
            </article>
          ) : (
            <div className="notes-empty">
              <h2>No note selected</h2>
              <p>Create a note to start writing.</p>
              <button className="button button--bright" type="button" onClick={() => void handleCreateNote()}>
                New note
              </button>
            </div>
          )}
        </div>
      </section>

      <input
        ref={fileInputRef}
        accept=".jpg,.jpeg,.png,.webp,.gif"
        hidden
        type="file"
        onChange={() => void handleUploadImage()}
      />

      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            {toast.text}
          </div>
        ))}
      </div>

      {commandOpen ? (
        <div className="command-overlay" role="presentation" onClick={() => setCommandOpen(false)}>
          <div className="command-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="command-panel__head">
              <Slash size={16} />
              <input
                autoFocus
                className="command-panel__input"
                placeholder="Search commands"
                type="text"
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
              />
            </div>

            <div className="command-panel__list">
              {filteredCommands.map((command) => {
                const Icon = command.icon
                return (
                  <button
                    key={command.id}
                    className="command-item"
                    type="button"
                    onClick={() => handleCommandSelect(command)}
                  >
                    <span className="command-item__icon">
                      <Icon size={16} />
                    </span>
                    <span className="command-item__copy">
                      <strong>{command.label}</strong>
                      <small>{command.hint}</small>
                    </span>
                  </button>
                )
              })}
              {!filteredCommands.length ? (
                <p className="command-empty">No commands found.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default App
