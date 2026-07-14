import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
import type { AuthPayload, Note, NotePayload, User } from './types'

type SessionStatus = 'booting' | 'anonymous' | 'authenticated'
type AuthMode = 'login' | 'register'
type ViewMode = 'split' | 'write' | 'preview'
type Shelf = 'inbox' | 'favorites' | 'pinned' | 'archived' | 'all'
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved'
type SortMode = 'recent' | 'title' | 'length'

interface Toast {
  id: number
  text: string
}

const quickPrompts = [
  'Draft a calmer, sharper weekly review.',
  'Outline a long-form essay with section notes.',
  'Capture research with images and markdown callouts.',
]

const defaultDraft: NotePayload = {
  title: '',
  text: '',
  summary: '',
  tags: [],
  is_pinned: false,
  is_favorite: false,
  is_archived: false,
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function readingTime(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  return Math.max(1, Math.ceil(words / 220))
}

function sortNotes(items: Note[]) {
  return [...items].sort((left, right) => {
    if (left.is_pinned !== right.is_pinned) {
      return Number(right.is_pinned) - Number(left.is_pinned)
    }

    return new Date(right.edit_time).getTime() - new Date(left.edit_time).getTime()
  })
}

function sortVisibleNotes(items: Note[], mode: SortMode) {
  return [...items].sort((left, right) => {
    if (left.is_pinned !== right.is_pinned) {
      return Number(right.is_pinned) - Number(left.is_pinned)
    }

    if (mode === 'title') {
      return left.title.localeCompare(right.title, 'ru')
    }

    if (mode === 'length') {
      return (right.text?.length ?? 0) - (left.text?.length ?? 0)
    }

    return new Date(right.edit_time).getTime() - new Date(left.edit_time).getTime()
  })
}

function extractSummary(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized ? normalized.slice(0, 280) : ''
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

  const normalizedPayload = JSON.stringify({
    ...payload,
    summary: payload.summary ?? '',
    text: payload.text ?? '',
  })
  const normalizedNote = JSON.stringify(noteToPayload(note))
  return normalizedPayload === normalizedNote
}

function App() {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('booting')
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authForm, setAuthForm] = useState<AuthPayload>({ login: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null)
  const [draft, setDraft] = useState<NotePayload>(defaultDraft)
  const [tagInput, setTagInput] = useState('')
  const [notesBusy, setNotesBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [notice, setNotice] = useState('Private writing space secured with HttpOnly cookies.')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [activeShelf, setActiveShelf] = useState<Shelf>('inbox')
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [focusMode, setFocusMode] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [toasts, setToasts] = useState<Toast[]>([])

  const searchRef = useRef<HTMLInputElement | null>(null)
  const titleRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const autosaveTimerRef = useRef<number | null>(null)
  const toastIdRef = useRef(0)

  const deferredSearch = useDeferredValue(searchQuery)
  const normalizedSearch = deferredSearch.trim().toLowerCase()
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null
  const dirty = selectedNote ? !payloadEqualsNote(draft, selectedNote) : false
  const bodyText = draft.text ?? ''
  const words = bodyText.trim() ? bodyText.trim().split(/\s+/).length : 0
  const saveStateLabel =
    saveState === 'saving'
      ? 'Saving'
      : saveState === 'dirty'
        ? 'Unsaved'
        : saveState === 'saved'
          ? 'Saved'
          : 'Idle'

  function pushToast(text: string) {
    const nextToast = { id: ++toastIdRef.current, text }
    setToasts((current) => [...current, nextToast])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== nextToast.id))
    }, 2600)
  }

  function syncDraft(nextNote: Note | null) {
    setDraft(nextNote ? noteToPayload(nextNote) : defaultDraft)
    setTagInput(nextNote ? nextNote.tags.join(', ') : '')
    setSaveState('idle')
  }

  const visibleNotes = useMemo(() => {
    const filtered = notes.filter((note) => {
      switch (activeShelf) {
        case 'favorites':
          if (!note.is_favorite || note.is_archived) {
            return false
          }
          break
        case 'pinned':
          if (!note.is_pinned || note.is_archived) {
            return false
          }
          break
        case 'archived':
          if (!note.is_archived) {
            return false
          }
          break
        case 'inbox':
          if (note.is_archived) {
            return false
          }
          break
        case 'all':
        default:
          break
      }

      if (!normalizedSearch) {
        return true
      }

      const haystack = [
        note.title,
        note.summary ?? '',
        note.text ?? '',
        note.tags.join(' '),
      ]
        .join('\n')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })

    return sortVisibleNotes(filtered, sortMode)
  }, [notes, activeShelf, normalizedSearch, sortMode])

  const noteCounts = useMemo(
    () => ({
      inbox: notes.filter((note) => !note.is_archived).length,
      favorites: notes.filter((note) => note.is_favorite && !note.is_archived).length,
      pinned: notes.filter((note) => note.is_pinned && !note.is_archived).length,
      archived: notes.filter((note) => note.is_archived).length,
      all: notes.length,
    }),
    [notes],
  )

  const loadNotes = useCallback(async (preferredId?: number | null) => {
    setNotesBusy(true)

    try {
      const nextNotes = sortNotes(await getNotes())
      setNotes(nextNotes)
      setSelectedNoteId((currentId) => {
        const candidateId = preferredId ?? currentId
        if (candidateId && nextNotes.some((note) => note.id === candidateId)) {
          return candidateId
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
      setSessionStatus('booting')

      try {
        const user = await getCurrentUser()
        setCurrentUser(user)
        setSessionStatus('authenticated')
        setNotice(`Welcome back, ${user.login}.`)
        await loadNotes()
      } catch {
        setCurrentUser(null)
        setNotes([])
        setSelectedNoteId(null)
        syncDraft(null)
        setSessionStatus('anonymous')
        setNotice('Create an account or sign in to continue.')
      }
    })()
  }, [loadNotes])

  useEffect(() => {
    syncDraft(selectedNote)
  }, [selectedNote])

  const persistCurrentNote = useCallback(async (successNotice?: string, silent = false) => {
    if (!selectedNoteId || !selectedNote) {
      return
    }

    const nextPayload = {
      ...draft,
      title: draft.title.trim() || 'Untitled note',
      summary: (draft.summary?.trim() || extractSummary(draft.text ?? '')).slice(0, 280),
      text: draft.text ?? '',
    }

    setSaveState('saving')

    try {
      const updated = await updateNote(selectedNoteId, nextPayload)
      setNotes((currentNotes) =>
        sortNotes(currentNotes.map((note) => (note.id === updated.id ? updated : note))),
      )
      setDraft(noteToPayload(updated))
      setTagInput(updated.tags.join(', '))
      setSaveState('saved')
      setNotice(successNotice ?? 'Draft synced.')
      if (!silent) {
        pushToast(successNotice ?? 'Draft saved')
      }
    } catch (error) {
      setSaveState('dirty')
      setNotice(error instanceof Error ? error.message : 'Failed to save note.')
      if (!silent) {
        pushToast('Save failed')
      }
    }
  }, [draft, selectedNote, selectedNoteId])

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

  const handleCreateNote = useCallback(async (seedTitle?: string) => {
    const template = seedTitle ?? `Untitled draft ${notes.length + 1}`

    try {
      const note = await createNote({
        title: template,
        text: '',
        summary: '',
        tags: [],
        is_pinned: false,
        is_favorite: false,
        is_archived: false,
      })

      setSearchQuery('')
      setActiveShelf('inbox')
      setNotes((currentNotes) =>
        sortNotes([note, ...currentNotes.filter((item) => item.id !== note.id)]),
      )
      setSelectedNoteId(note.id)
      syncDraft(note)
      setNotice('New draft opened.')
      pushToast('New draft created')
      window.setTimeout(() => titleRef.current?.focus(), 80)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to create note.')
    }
  }, [notes.length])

  const duplicateCurrentNote = useCallback(async () => {
    if (!selectedNote) {
      return
    }

    try {
      const duplicate = await createNote({
        ...noteToPayload(selectedNote),
        title: `${selectedNote.title} copy`,
        is_pinned: false,
      })

      setNotes((currentNotes) =>
        sortNotes([duplicate, ...currentNotes.filter((item) => item.id !== duplicate.id)]),
      )
      setSelectedNoteId(duplicate.id)
      syncDraft(duplicate)
      setNotice('Draft duplicated.')
      pushToast('Draft duplicated')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to duplicate draft.')
    }
  }, [selectedNote])

  const exportCurrentDraft = useCallback(() => {
    if (!selectedNote) {
      return
    }

    const content = [
      `# ${draft.title || 'Untitled note'}`,
      '',
      draft.summary ? `> ${draft.summary}` : '',
      draft.summary ? '' : '',
      draft.text ?? '',
      '',
      draft.tags.length > 0 ? `Tags: ${draft.tags.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const normalizedTitle = (draft.title || 'untitled-note')
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/^-+|-+$/g, '')

    anchor.href = url
    anchor.download = `${normalizedTitle || 'untitled-note'}.md`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('Markdown export downloaded.')
    pushToast('Exported .md')
  }, [draft, selectedNote])

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey

      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((current) => !current)
      }

      if (meta && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setFocusMode((current) => !current)
      }

      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void persistCurrentNote('Saved manually.')
      }

      if (meta && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        void handleCreateNote()
      }

      if (event.key === 'Escape') {
        setCommandOpen(false)
      }

      if (event.key === '/' && document.activeElement === document.body) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleCreateNote, persistCurrentNote])

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
      setCurrentUser(user)
      setSessionStatus('authenticated')
      setAuthForm({ login: '', password: '' })
      setNotice(authMode === 'register' ? 'Account created.' : 'Signed in.')
      pushToast(authMode === 'register' ? 'Account created' : 'Signed in')
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
      setCurrentUser(null)
      setNotes([])
      setSelectedNoteId(null)
      syncDraft(null)
      setSessionStatus('anonymous')
      setAuthBusy(false)
      setNotice('Signed out.')
    }
  }

  async function handleDeleteNote() {
    if (!selectedNoteId || !selectedNote) {
      return
    }

    if (!window.confirm(`Delete "${selectedNote.title}"?`)) {
      return
    }

    setDeleteBusy(true)
    try {
      await deleteNote(selectedNoteId)
      const remainingNotes = notes.filter((note) => note.id !== selectedNoteId)
      setNotes(remainingNotes)
      setSelectedNoteId(remainingNotes[0]?.id ?? null)
      setNotice('Draft deleted.')
      pushToast('Draft deleted')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to delete note.')
    } finally {
      setDeleteBusy(false)
    }
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !selectedNoteId) {
      return
    }

    setUploadBusy(true)
    try {
      const result = await uploadAttachment(file)
      const markdown = `![${file.name}](${result.url})`
      const nextText = `${draft.text ?? ''}${draft.text ? '\n\n' : ''}${markdown}`
      setDraft((current) => ({ ...current, text: nextText }))
      setNotice('Attachment inserted into draft.')
      pushToast('Attachment uploaded')
      window.setTimeout(() => textareaRef.current?.focus(), 40)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to upload attachment.')
    } finally {
      setUploadBusy(false)
      event.target.value = ''
    }
  }

  function applyTags(rawValue: string) {
    const tags = rawValue
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .filter((tag, index, all) => all.indexOf(tag) === index)
      .slice(0, 12)

    setTagInput(tags.join(', '))
    setDraft((current) => ({ ...current, tags }))
  }

  function insertMarkdown(before: string, after = '') {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const source = draft.text ?? ''
    const selected = source.slice(start, end) || 'text'
    const nextText =
      source.slice(0, start) +
      before +
      selected +
      after +
      source.slice(end)

    setDraft((current) => ({ ...current, text: nextText }))
    window.setTimeout(() => {
      textarea.focus()
      const cursor = start + before.length + selected.length + after.length
      textarea.setSelectionRange(cursor, cursor)
    }, 0)
  }

  const commands = [
    {
      label: 'Create new draft',
      action: () => void handleCreateNote(),
    },
    {
      label: 'Toggle split view',
      action: () => setViewMode('split'),
    },
    {
      label: focusMode ? 'Exit focus mode' : 'Enter focus mode',
      action: () => setFocusMode((current) => !current),
    },
    {
      label: 'Focus search',
      action: () => searchRef.current?.focus(),
    },
    {
      label: 'Show favorites',
      action: () => setActiveShelf('favorites'),
    },
    {
      label: 'Show archive',
      action: () => setActiveShelf('archived'),
    },
    {
      label: 'Pin or unpin current draft',
      action: () =>
        setDraft((current) => ({ ...current, is_pinned: !current.is_pinned })),
    },
    {
      label: 'Duplicate current draft',
      action: () => void duplicateCurrentNote(),
    },
    {
      label: 'Export current draft',
      action: () => exportCurrentDraft(),
    },
  ].filter((command) =>
    command.label.toLowerCase().includes(commandQuery.trim().toLowerCase()),
  )

  if (sessionStatus === 'booting') {
    return (
      <main className="shell shell--loading">
        <div className="loading-mark">
          <span className="loading-mark__orbit" />
          <p>Warming up your writing room</p>
        </div>
      </main>
    )
  }

  if (sessionStatus === 'anonymous') {
    return (
      <main className="shell shell--landing">
        <section className="landing">
          <div className="landing__hero">
            <p className="eyebrow">Premium Writing Workspace</p>
            <h1>Write with structure, not noise.</h1>
            <p className="landing__copy">
              A calm drafting environment with secure sessions, markdown-native writing,
              image attachments, search, and a focused editorial rhythm.
            </p>

            <div className="landing__metrics">
              <article>
                <strong>Split editor</strong>
                <span>Write and preview in the same deliberate workspace</span>
              </article>
              <article>
                <strong>Autosave flow</strong>
                <span>Draft state syncs quietly while you stay in the sentence</span>
              </article>
              <article>
                <strong>Organized notes</strong>
                <span>Pinned, favorite, archived, searchable writing inventory</span>
              </article>
            </div>

            <div className="landing__prompts">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  className="prompt-chip"
                  type="button"
                  onClick={() => setNotice(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <aside className="auth-card">
            <div className="auth-card__header">
              <p className="eyebrow">{authMode === 'login' ? 'Welcome back' : 'Open a studio'}</p>
              <h2>{authMode === 'login' ? 'Sign in' : 'Create your workspace'}</h2>
              <p>{notice}</p>
            </div>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <label>
                <span>Login</span>
                <input
                  autoComplete="username"
                  maxLength={50}
                  minLength={3}
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
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  maxLength={128}
                  minLength={8}
                  required
                  type="password"
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, password: event.target.value }))
                  }
                />
              </label>

              {authError ? <p className="form-error">{authError}</p> : null}

              <button className="button button--primary" disabled={authBusy} type="submit">
                {authBusy
                  ? 'Please wait...'
                  : authMode === 'login'
                    ? 'Enter workspace'
                    : 'Create account'}
              </button>
            </form>

            <button
              className="auth-switch"
              type="button"
              onClick={() => {
                setAuthError('')
                setAuthMode((current) => (current === 'login' ? 'register' : 'login'))
              }}
            >
              {authMode === 'login'
                ? 'Need an account? Register'
                : 'Already have an account? Sign in'}
            </button>
          </aside>
        </section>
      </main>
    )
  }

  return (
    <main className={`shell shell--workspace${focusMode ? ' shell--focus' : ''}`}>
      <header className="topbar">
        <div className="topbar__title">
          <p className="eyebrow">Writing Workspace</p>
          <h1>Cloud Notes</h1>
          <p className="topbar__summary">
            Focused drafting with autosave, markdown preview, attachments, and quick note organization.
          </p>
        </div>

        <div className="topbar__actions">
          <div className="identity-pill">
            <span className="identity-pill__dot" />
            <div>
              <strong>{currentUser?.login}</strong>
              <small>{saveStateLabel}</small>
            </div>
          </div>

          <button className="button button--ghost" type="button" onClick={() => setCommandOpen(true)}>
            Commands
          </button>
          <button className="button button--ghost" disabled={authBusy} onClick={handleLogout} type="button">
            Sign out
          </button>
        </div>
      </header>

      <section className="workspace-shell">
        <div className="workspace-shell__header">
          <div className="workspace-shell__status">
            <span className="status-banner__dot" />
            <p>{notice}</p>
          </div>
          <div className="workspace-shell__stats">
            <span>{notes.length} drafts</span>
            <span>{visibleNotes.length} visible</span>
            <span>{words} words</span>
          </div>
        </div>

        <section className="workspace">
          <aside className="panel panel--sidebar">
          <div className="panel__section">
            <div className="panel__heading">
              <h2>Library</h2>
              <button className="button button--primary" type="button" onClick={() => void handleCreateNote()}>
                New draft
              </button>
            </div>

            <label className="sort-select">
              <span>Sort</span>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                <option value="recent">Recent</option>
                <option value="title">Title</option>
                <option value="length">Longest</option>
              </select>
            </label>

            <label className="searchbox">
              <span>Search</span>
              <input
                ref={searchRef}
                placeholder="Find title, text, tag"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
          </div>

          <div className="shelf-list">
            {([
              ['inbox', 'Inbox'],
              ['favorites', 'Favorites'],
              ['pinned', 'Pinned'],
              ['archived', 'Archive'],
              ['all', 'All notes'],
            ] as [Shelf, string][]).map(([shelf, label]) => (
              <button
                key={shelf}
                className={`shelf-item${activeShelf === shelf ? ' shelf-item--active' : ''}`}
                type="button"
                onClick={() => setActiveShelf(shelf)}
              >
                <span>{label}</span>
                <strong>{noteCounts[shelf]}</strong>
              </button>
            ))}
          </div>

          <div className="notes-list">
            {notesBusy ? <p className="muted">Refreshing drafts…</p> : null}
            {!notesBusy && visibleNotes.length === 0 ? (
              <div className="empty-state empty-state--small">
                <p>No drafts match this shelf.</p>
                <button className="button button--secondary" type="button" onClick={() => void handleCreateNote(quickPrompts[0])}>
                  Start from prompt
                </button>
              </div>
            ) : null}

            {visibleNotes.map((note) => (
              <button
                key={note.id}
                className={`note-card${note.id === selectedNoteId ? ' note-card--active' : ''}`}
                type="button"
                onClick={() => setSelectedNoteId(note.id)}
              >
                <div className="note-card__meta">
                  <strong>{note.title}</strong>
                  <div className="note-flags">
                    {note.is_pinned ? <span>Pinned</span> : null}
                    {note.is_favorite ? <span>Favorite</span> : null}
                    {note.is_archived ? <span>Archive</span> : null}
                  </div>
                </div>
                <span>{note.summary || extractSummary(note.text ?? '') || 'Empty draft'}</span>
                <div className="note-card__footer">
                  <small>{formatDate(note.edit_time)}</small>
                  <small>{note.tags.slice(0, 2).join(' · ')}</small>
                </div>
              </button>
            ))}
          </div>
          </aside>

          <section className="panel panel--editor">
            {selectedNote ? (
              <>
                <div className="editor-context">
                  <div className="editor-context__main">
                    <div>
                      <p className="eyebrow">Current Draft</p>
                      <h2>{draft.title || 'Untitled note'}</h2>
                    </div>
                    <div className="editor-context__meta">
                      <span>{readingTime(bodyText)} min read</span>
                      <span>{formatDate(selectedNote.edit_time)}</span>
                    </div>
                  </div>
                  <div className="editor-context__controls">
                    <div className="segmented-control">
                      {(['write', 'split', 'preview'] as ViewMode[]).map((mode) => (
                        <button
                          key={mode}
                          className={viewMode === mode ? 'is-active' : ''}
                          type="button"
                          onClick={() => setViewMode(mode)}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                    <button className="button button--secondary" type="button" onClick={() => void persistCurrentNote('Saved manually.')}>
                      Save
                    </button>
                    <button className="button button--ghost" type="button" onClick={() => void duplicateCurrentNote()}>
                      Duplicate
                    </button>
                    <button className="button button--ghost" type="button" onClick={exportCurrentDraft}>
                      Export
                    </button>
                    <button className="button button--ghost" type="button" onClick={() => setFocusMode((current) => !current)}>
                      {focusMode ? 'Exit focus' : 'Focus'}
                    </button>
                    <button className="button button--danger" disabled={deleteBusy} type="button" onClick={handleDeleteNote}>
                      {deleteBusy ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>

                <div className="editor-meta-strip">
                  <div className="toggle-grid toggle-grid--inline">
                    <button
                      className={`toggle-card${draft.is_favorite ? ' toggle-card--active' : ''}`}
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, is_favorite: !current.is_favorite }))}
                    >
                      Favorite
                    </button>
                    <button
                      className={`toggle-card${draft.is_pinned ? ' toggle-card--active' : ''}`}
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, is_pinned: !current.is_pinned }))}
                    >
                      Pin
                    </button>
                    <button
                      className={`toggle-card${draft.is_archived ? ' toggle-card--active' : ''}`}
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, is_archived: !current.is_archived }))}
                    >
                      Archive
                    </button>
                  </div>

                  <label className="tag-input">
                    <span>Tags</span>
                    <input
                      placeholder="essay, research, draft"
                      type="text"
                      value={tagInput}
                      onBlur={() => applyTags(tagInput)}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          applyTags(tagInput)
                        }
                      }}
                    />
                  </label>

                  <label className="upload-inline">
                    <input
                      accept=".jpg,.jpeg,.png,.webp,.gif"
                      disabled={!selectedNoteId || uploadBusy}
                      type="file"
                      onChange={(event) => void handleFileUpload(event)}
                    />
                    <span>{uploadBusy ? 'Uploading…' : 'Attach image'}</span>
                  </label>
                </div>

                <div className="tag-cloud">
                  {draft.tags.length > 0 ? draft.tags.map((tag) => <span key={tag}>{tag}</span>) : <span className="muted">No tags yet</span>}
                </div>

                <div className="editor-toolbar">
                  <button type="button" onClick={() => insertMarkdown('**', '**')}>Bold</button>
                  <button type="button" onClick={() => insertMarkdown('## ')}>H2</button>
                  <button type="button" onClick={() => insertMarkdown('> ')}>Quote</button>
                  <button type="button" onClick={() => insertMarkdown('- [ ] ')}>Task</button>
                  <button type="button" onClick={() => insertMarkdown('`', '`')}>Code</button>
                  <button type="button" onClick={() => setDraft((current) => ({ ...current, summary: extractSummary(current.text ?? '') }))}>
                    Summarize
                  </button>
                </div>

                <div className={`editor-layout editor-layout--${viewMode}`}>
                  {(viewMode === 'write' || viewMode === 'split') ? (
                    <div className="editor-pane">
                      <label className="editor-field">
                        <span>Title</span>
                        <input
                          ref={titleRef}
                          maxLength={100}
                          type="text"
                          value={draft.title}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, title: event.target.value }))
                          }
                        />
                      </label>

                      <label className="editor-field">
                        <span>Summary</span>
                        <textarea
                          maxLength={280}
                          rows={3}
                          value={draft.summary ?? ''}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, summary: event.target.value }))
                          }
                        />
                      </label>

                      <label className="editor-field">
                        <span>Body</span>
                        <textarea
                          ref={textareaRef}
                          className="editor-field__body"
                          placeholder="Write in markdown. Cmd/Ctrl+S saves, Cmd/Ctrl+K opens commands."
                          rows={18}
                          value={draft.text ?? ''}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, text: event.target.value }))
                          }
                        />
                      </label>
                    </div>
                  ) : null}

                  {(viewMode === 'preview' || viewMode === 'split') ? (
                    <div className="preview-pane">
                      <div className="preview-pane__header">
                        <strong>{draft.title || 'Untitled note'}</strong>
                        <span>{draft.summary || 'No summary yet'}</span>
                      </div>
                      <article className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {draft.text || '*Start writing to preview your draft.*'}
                        </ReactMarkdown>
                      </article>
                    </div>
                  ) : null}
                </div>

                <div className="editor-meta">
                  <span>{words} words</span>
                  <span>{readingTime(bodyText)} min read</span>
                  <span>Created {formatDate(selectedNote.created_time)}</span>
                  <span>Updated {formatDate(selectedNote.edit_time)}</span>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <h2>No draft selected</h2>
                <p>Open an existing note or start a new draft to begin writing.</p>
                <button className="button button--primary" onClick={() => void handleCreateNote()} type="button">
                  Create first draft
                </button>
              </div>
            )}
          </section>
        </section>
      </section>

      {commandOpen ? (
        <div className="command-overlay" role="presentation" onClick={() => setCommandOpen(false)}>
          <div className="command-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <input
              autoFocus
              placeholder="Search commands"
              type="text"
              value={commandQuery}
              onChange={(event) => setCommandQuery(event.target.value)}
            />
            <div className="command-results">
              {commands.map((command) => (
                <button
                  key={command.label}
                  type="button"
                  onClick={() => {
                    command.action()
                    setCommandOpen(false)
                    setCommandQuery('')
                  }}
                >
                  {command.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            {toast.text}
          </div>
        ))}
      </div>
    </main>
  )
}

export default App
