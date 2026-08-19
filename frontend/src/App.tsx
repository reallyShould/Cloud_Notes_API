import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import {
  EditorContent,
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  useEditorState,
} from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
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
import CodeBlock from '@tiptap/extension-code-block'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import {
  Archive,
  Bold,
  Check,
  CheckSquare,
  Code2,
  Copy,
  Download,
  Ellipsis,
  Highlighter,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  LogOut,
  Menu,
  Moon,
  Pin,
  Star,
  Quote,
  Search,
  SquareCode,
  Strikethrough,
  Table2,
  Trash2,
  Underline as UnderlineIcon,
  Unlink,
  Sun,
  X,
} from 'lucide-react'

import './App.css'
import {
  createNote,
  deleteNote,
  getCurrentUser,
  getNotes,
  login,
  logout,
  openNoteEvents,
  register,
  updateNote,
  ApiError,
  updateUserTheme,
  uploadAttachment,
} from './lib/api'
import type { NoteEvent } from './lib/api'
import type { AuthPayload, Note, NotePayload } from './types'
import { translate } from './i18n'
import type { Locale, TranslationKey } from './i18n'
import { AuthScreen } from './components/AuthScreen'
import { NotesSidebar } from './components/NotesSidebar'
import type { Shelf } from './components/NotesSidebar'
import {
  defaultDraft,
  extractSummary,
  formatDate,
  htmlToPlainText,
  noteToPayload,
  payloadEqualsNote,
  sortNotes,
} from './lib/note-utils'

type SessionStatus = 'booting' | 'anonymous' | 'authenticated'
type AuthMode = 'login' | 'register'
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved'

interface Toast {
  id: number
  text: string
}

function RemovableImageView({ node, deleteNode, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      className={`editor-image${selected ? ' editor-image--selected' : ''}`}
      data-drag-handle
    >
      <img
        src={node.attrs.src as string}
        alt={(node.attrs.alt as string | null) ?? ''}
        title={(node.attrs.title as string | null) ?? undefined}
        draggable={false}
      />
      <button
        className="editor-image__remove"
        type="button"
        aria-label="Remove image"
        title="Remove image"
        contentEditable={false}
        onPointerDown={(event) => event.preventDefault()}
        onClick={deleteNode}
      >
        <X size={16} strokeWidth={2.4} />
      </button>
    </NodeViewWrapper>
  )
}

const RemovableImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(RemovableImageView)
  },
})

function copyTextFallback(value: string) {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

function GitHubCodeBlockView({ node }: NodeViewProps) {
  const [copied, setCopied] = useState(false)
  const currentLocale: Locale = document.documentElement.lang === 'ru' ? 'ru' : 'en'
  const buttonLabel = translate(currentLocale, copied ? 'copied' : 'copyCode')
  const codeLabel = translate(currentLocale, 'codeBlock')

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API is unavailable')
      }
      await navigator.clipboard.writeText(node.textContent)
    } catch {
      copyTextFallback(node.textContent)
    }

    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <NodeViewWrapper className="github-code-block">
      <div className="github-code-block__header" contentEditable={false}>
        <span>{codeLabel}</span>
        <button
          className="github-code-block__copy"
          type="button"
          aria-label={buttonLabel}
          title={buttonLabel}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => void handleCopy()}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          <span>{buttonLabel}</span>
        </button>
      </div>
      <NodeViewContent<'code'> as="code" className="github-code-block__content" />
    </NodeViewWrapper>
  )
}

const GitHubCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(GitHubCodeBlockView)
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state, view } = this.editor
        const { $from, empty, from } = state.selection
        const selectedNode = (state.selection as { node?: typeof $from.nodeAfter }).node
        const paragraph = state.schema.nodes.paragraph

        const removeBlockFormattingAt = (position: number) => {
          view.dispatch(state.tr.setNodeMarkup(position, paragraph).scrollIntoView())
          this.editor.commands.setTextSelection(position + 1)
          return true
        }

        if (selectedNode?.type.name === this.name) {
          return removeBlockFormattingAt(from)
        }

        if (empty && $from.nodeAfter?.type.name === this.name) {
          return removeBlockFormattingAt($from.pos)
        }

        if (empty && $from.parent.type.name === this.name && $from.parentOffset === 0) {
          return this.editor.commands.setNode('paragraph')
        }

        return false
      },
    }
  },
})

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
  const [, setNotice] = useState('Private notes synced with secure cookie auth.')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeShelf, setActiveShelf] = useState<Shelf>('all')
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = window.localStorage.getItem('notes-theme')
    return savedTheme
      ? savedTheme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [locale, setLocale] = useState<Locale>(() =>
    window.localStorage.getItem('notes-locale') === 'ru' ? 'ru' : 'en',
  )
  const [tagInput, setTagInput] = useState('')
  const [, setUploadBusy] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  const toastIdRef = useRef(0)
  const autosaveTimerRef = useRef<number | null>(null)
  const draftRevisionRef = useRef(0)
  const draftBaseEditTimeRef = useRef<string | null>(null)
  const draftRef = useRef(draft)
  const notesRef = useRef(notes)
  const dirtySinceRef = useRef<number | null>(null)
  const selectedNoteIdRef = useRef<number | null>(null)
  const notesRefreshInFlightRef = useRef(false)
  const titleRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const hydratedNoteIdRef = useRef<number | null>(null)
  const dragDepthRef = useRef(0)
  const localeRef = useRef(locale)
  const t = useCallback(
    (key: TranslationKey, values?: Record<string, string | number>) => translate(locale, key, values),
    [locale],
  )

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null
  const activeShelfTitle = t(
    activeShelf === 'all' ? 'notes' : activeShelf === 'archived' ? 'archive' : activeShelf,
  )
  draftRef.current = draft
  notesRef.current = notes
  selectedNoteIdRef.current = selectedNoteId
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
    }, 7000)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('notes-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    window.localStorage.setItem('notes-locale', locale)
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    document.title = selectedNote?.title
      ? `${selectedNote.title} — Cloud Notes`
      : 'Cloud Notes'
  }, [selectedNote?.title])

  useEffect(() => {
    if (sessionStatus !== 'authenticated') {
      return
    }

    void updateUserTheme(darkMode ? 'dark' : 'light').catch((error) => {
      setNotice(error instanceof Error ? error.message : 'Failed to save theme.')
    })
  }, [darkMode, sessionStatus])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: () => translate(localeRef.current, 'editorPlaceholder'),
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Highlight,
      TextStyle,
      Color,
      GitHubCodeBlock,
      RemovableImage.configure({
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
      handleKeyDown: (view, event) => {
        const { $from, empty } = view.state.selection
        if (
          event.key === 'Backspace' &&
          empty &&
          $from.parent.type.name === 'paragraph' &&
          $from.parent.content.size === 0 &&
          $from.parentOffset === 0
        ) {
          const paragraphPosition = $from.before()
          const nodeBefore = view.state.doc.resolve(paragraphPosition).nodeBefore
          if (nodeBefore?.type.name === 'codeBlock') {
            event.preventDefault()
            view.dispatch(
              view.state.tr
                .delete(paragraphPosition, paragraphPosition + $from.parent.nodeSize)
                .scrollIntoView(),
            )
            editor?.commands.setTextSelection(paragraphPosition - 1)
            return true
          }
        }

        if (event.key !== ' ' || !view.state.selection.empty) {
          return false
        }

        const linkMark = view.state.schema.marks.link
        const activeMarks = view.state.storedMarks ?? view.state.selection.$from.marks()
        if (!linkMark || !linkMark.isInSet(activeMarks)) {
          return false
        }

        event.preventDefault()
        view.dispatch(
          view.state.tr
            .removeStoredMark(linkMark)
            .insertText(' '),
        )
        return true
      },
    },
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML()
      draftRevisionRef.current += 1
      setDraft((current) => ({
        ...current,
        text: html,
        summary: extractSummary(html),
      }))
    },
  })

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor?.isActive('bold') ?? false,
      italic: currentEditor?.isActive('italic') ?? false,
      underline: currentEditor?.isActive('underline') ?? false,
      strike: currentEditor?.isActive('strike') ?? false,
      code: currentEditor?.isActive('code') ?? false,
      codeBlock: currentEditor?.isActive('codeBlock') ?? false,
      highlight: currentEditor?.isActive('highlight') ?? false,
      link: currentEditor?.isActive('link') ?? false,
      heading1: currentEditor?.isActive('heading', { level: 1 }) ?? false,
      heading2: currentEditor?.isActive('heading', { level: 2 }) ?? false,
      bulletList: currentEditor?.isActive('bulletList') ?? false,
      orderedList: currentEditor?.isActive('orderedList') ?? false,
      taskList: currentEditor?.isActive('taskList') ?? false,
      table: currentEditor?.isActive('table') ?? false,
    }),
  })

  useEffect(() => {
    localeRef.current = locale
    editor?.view.dispatch(editor.state.tr)
  }, [editor, locale])

  const dirty = selectedNote ? !payloadEqualsNote(draft, selectedNote) : false
  const plainText = htmlToPlainText(draft.text ?? '')
  const wordCount = plainText ? plainText.split(/\s+/).length : 0

  const syncDraft = useCallback((nextNote: Note | null) => {
    const payload = nextNote ? noteToPayload(nextNote) : defaultDraft
    draftBaseEditTimeRef.current = nextNote?.edit_time ?? null
    draftRevisionRef.current += 1
    dirtySinceRef.current = null
    setDraft(payload)
    setTagInput(payload.tags.join(', '))
    setSaveState('idle')
    setToolbarOpen(false)

    if (editor) {
      const content = payload.text || '<p></p>'
      if (editor.getHTML() !== content) {
        editor.commands.setContent(content, { emitUpdate: false })
      }
    }
  }, [editor])

  const loadNotes = useCallback(async (preferredId?: number | null, silent = false) => {
    if (notesRefreshInFlightRef.current) {
      return
    }

    notesRefreshInFlightRef.current = true
    if (!silent) {
      setNotesBusy(true)
    }

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
      if (!silent) {
        setNotice(error instanceof Error ? error.message : 'Failed to load notes.')
      }
    } finally {
      notesRefreshInFlightRef.current = false
      if (!silent) {
        setNotesBusy(false)
      }
    }
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser()
        setDarkMode(user.theme === 'dark')
        setSessionStatus('authenticated')
        setNotice('')
        await loadNotes()
      } catch {
        setNotes([])
        setSelectedNoteId(null)
        setSessionStatus('anonymous')
        setNotice(t('signInPrompt'))
      }
    })()
  }, [loadNotes, t])

  useEffect(() => {
    if (sessionStatus !== 'authenticated') {
      return
    }

    const refreshNotes = () => {
      if (document.visibilityState === 'visible') {
        void loadNotes(undefined, true)
      }
    }
    const intervalId = window.setInterval(refreshNotes, 10_000)

    window.addEventListener('focus', refreshNotes)
    document.addEventListener('visibilitychange', refreshNotes)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshNotes)
      document.removeEventListener('visibilitychange', refreshNotes)
    }
  }, [loadNotes, sessionStatus])

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !editor) {
      return
    }

    let socket: WebSocket | null = null
    let reconnectTimer: number | null = null
    let stopped = false

    const connect = () => {
      socket = openNoteEvents()
      socket.onmessage = (message) => {
        const event = JSON.parse(message.data as string) as NoteEvent
        if (event.source_client_id === window.localStorage.getItem('cloud-notes-client-id')) {
          return
        }
        if (event.type === 'note_deleted') {
          setNotes((current) => current.filter((note) => note.id !== event.note_id))
          if (selectedNoteIdRef.current === event.note_id) {
            setSelectedNoteId(null)
          }
          return
        }

        const incoming = event.note
        const current = notesRef.current.find((note) => note.id === incoming.id)
        const isOpen = selectedNoteIdRef.current === incoming.id
        const hasLocalChanges = isOpen && current
          ? !payloadEqualsNote(draftRef.current, current)
          : false
        const isSameContent = payloadEqualsNote(draftRef.current, incoming)

        setNotes((items) => sortNotes([
          incoming,
          ...items.filter((note) => note.id !== incoming.id),
        ]))

        if (isOpen && (!hasLocalChanges || isSameContent)) {
          syncDraft(incoming)
        } else if (isOpen) {
          setNotice(t('noteConflict'))
          pushToast(t('noteConflict'))
        }
      }
      socket.onclose = () => {
        if (!stopped) {
          reconnectTimer = window.setTimeout(connect, 1500)
        }
      }
    }

    connect()
    return () => {
      stopped = true
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
      }
      socket?.close()
    }
  }, [editor, pushToast, sessionStatus, syncDraft, t])

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
      return false
    }

    const noteIdAtStart = selectedNoteId
    const revisionAtStart = draftRevisionRef.current
    const expectedEditTime = draftBaseEditTimeRef.current
    if (!expectedEditTime) {
      return false
    }
    setSaveState('saving')

    try {
      const payload = {
        ...draft,
        title: draft.title.trim() || t('untitledNote'),
        text: draft.text || '<p></p>',
        summary: extractSummary(draft.text || ''),
      }

      const updated = await updateNote(noteIdAtStart, payload, expectedEditTime)
      setNotes((current) =>
        sortNotes(current.map((note) => (note.id === updated.id ? updated : note))),
      )

      const noNewerChanges = draftRevisionRef.current === revisionAtStart
      const sameNoteIsOpen = selectedNoteIdRef.current === noteIdAtStart
      if (sameNoteIsOpen) {
        draftBaseEditTimeRef.current = updated.edit_time
      }
      if (noNewerChanges && sameNoteIsOpen) {
        dirtySinceRef.current = null
        setDraft(noteToPayload(updated))
        setTagInput(updated.tags.join(', '))
        setSaveState('saved')
        setNotice(successNotice ?? t('saved'))
        if (!silent) {
          pushToast(successNotice ?? t('saved'))
        }
      } else if (sameNoteIsOpen) {
        setSaveState('dirty')
      }
      return noNewerChanges
    } catch (error) {
      setSaveState('dirty')
      const message = error instanceof ApiError && error.status === 409
        ? t('noteConflict')
        : error instanceof Error
          ? error.message
          : 'Failed to save note.'
      setNotice(message)
      if (!silent) {
        pushToast(message)
      }
      return false
    }
  }, [draft, pushToast, selectedNote, selectedNoteId, t])

  useEffect(() => {
    if (!selectedNote || !dirty) {
      dirtySinceRef.current = null
      setSaveState((current) => current === 'saving' ? current : selectedNote ? 'saved' : 'idle')
      return
    }

    setSaveState('dirty')
    dirtySinceRef.current ??= Date.now()
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current)
    }

    const maxWaitRemaining = Math.max(0, 3_000 - (Date.now() - dirtySinceRef.current))
    const delay = Math.min(700, maxWaitRemaining)
    autosaveTimerRef.current = window.setTimeout(() => {
      void persistCurrentNote(t('autosaved'), true)
    }, delay)

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [dirty, persistCurrentNote, selectedNote, t])

  useEffect(() => {
    if (!selectedNote || !dirty) {
      return
    }

    const flushPendingChanges = () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
      }
      void persistCurrentNote(t('autosaved'), true)
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingChanges()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', flushPendingChanges)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', flushPendingChanges)
    }
  }, [dirty, persistCurrentNote, selectedNote, t])

  const handleSelectNote = useCallback(async (nextNoteId: number) => {
    if (nextNoteId === selectedNoteId) {
      return
    }

    if (dirty) {
      const saved = await persistCurrentNote(t('autosaved'), true)
      if (!saved) {
        return
      }
    }

    setSelectedNoteId(nextNoteId)
    setMobileNavigationOpen(false)
  }, [dirty, persistCurrentNote, selectedNoteId, t])

  const handleCreateNote = useCallback(async () => {
    try {
      const note = await createNote({
        ...defaultDraft,
        title: `${t('untitledNote')} ${notes.length + 1}`,
      })

      setNotes((current) => sortNotes([note, ...current.filter((item) => item.id !== note.id)]))
      setSelectedNoteId(note.id)
      setMobileNavigationOpen(false)
      setNotice(t('newNoteCreated'))
      pushToast(t('newNoteToast'))
      window.setTimeout(() => titleRef.current?.focus(), 60)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to create note.')
    }
  }, [notes.length, pushToast, t])

  const handleDuplicateNote = useCallback(async () => {
    if (!selectedNote) {
      return
    }

    try {
      const duplicate = await createNote({
        ...noteToPayload(selectedNote),
        title: `${selectedNote.title} ${t('copySuffix')}`,
      })
      setNotes((current) => sortNotes([duplicate, ...current]))
      setSelectedNoteId(duplicate.id)
      setNotice(t('noteDuplicated'))
      pushToast(t('duplicated'))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to duplicate note.')
    }
  }, [pushToast, selectedNote, t])

  const handleDeleteNote = useCallback(async () => {
    if (!selectedNoteId || !selectedNote) {
      return
    }

    if (!window.confirm(t('deleteConfirm', { title: selectedNote.title }))) {
      return
    }

    setDeleteBusy(true)
    try {
      await deleteNote(selectedNoteId)
      const remaining = notes.filter((note) => note.id !== selectedNoteId)
      setNotes(remaining)
      setSelectedNoteId(remaining[0]?.id ?? null)
      setNotice(t('noteDeleted'))
      pushToast(t('deleted'))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to delete note.')
    } finally {
      setDeleteBusy(false)
    }
  }, [notes, pushToast, selectedNote, selectedNoteId, t])

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
    pushToast(t('exported'))
  }, [draft, pushToast, selectedNote, t])

  const updateDraftFlag = useCallback((key: 'is_pinned' | 'is_favorite' | 'is_archived') => {
    draftRevisionRef.current += 1
    setDraft((current) => ({ ...current, [key]: !current[key] }))
  }, [])

  const applyTags = useCallback((value: string) => {
    const nextTags = value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    draftRevisionRef.current += 1
    setTagInput(value)
    setDraft((current) => ({ ...current, tags: nextTags }))
  }, [])

  const uploadImageFile = useCallback(async (file: File) => {
    if (!editor || !selectedNoteId) {
      return
    }

    setUploadBusy(true)
    try {
      const result = await uploadAttachment(file)
      editor.chain().focus().setImage({ src: result.url, alt: file.name }).run()
      setNotice(t('imageInserted'))
      pushToast(t('imageAdded'))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to upload image.')
      pushToast(t('uploadFailed'))
    } finally {
      setUploadBusy(false)
    }
  }, [editor, pushToast, selectedNoteId, t])

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
      setDarkMode(user.theme === 'dark')
      setSessionStatus('authenticated')
      setAuthForm({ login: '', password: '' })
      setNotice(authMode === 'register' ? t('accountCreated', { login: user.login }) : t('signedInAs', { login: user.login }))
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
      setNotice(t('signedOut'))
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

  function handleSetLink() {
    if (!editor) {
      return
    }

    const currentUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt(t('enterLink'), currentUrl ?? 'https://')
    if (url === null) {
      return
    }

    const normalizedUrl = url.trim()
    if (!normalizedUrl) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: normalizedUrl }).run()
  }

  function handleUnsetLink() {
    editor?.chain().focus().extendMarkRange('link').unsetLink().run()
  }

  function handleCodeBlock() {
    if (!editor) {
      return
    }

    const { from, to, empty, $from, $to } = editor.state.selection
    if (
      editor.isActive('codeBlock') &&
      !empty &&
      $from.sameParent($to) &&
      $from.parent.type.name === 'codeBlock'
    ) {
      const codeBlockType = editor.state.schema.nodes.codeBlock
      const paragraphType = editor.state.schema.nodes.paragraph
      const fullText = $from.parent.textContent
      const beforeText = fullText.slice(0, $from.parentOffset).replace(/\n$/, '')
      const selectedText = fullText.slice($from.parentOffset, $to.parentOffset)
      const afterText = fullText.slice($to.parentOffset).replace(/^\n/, '')
      const beforeNode = beforeText
        ? codeBlockType.create(null, editor.state.schema.text(beforeText))
        : null
      const paragraphNode = paragraphType.create(
        null,
        selectedText ? editor.state.schema.text(selectedText) : undefined,
      )
      const afterNode = afterText
        ? codeBlockType.create(null, editor.state.schema.text(afterText))
        : null
      const replacement = [beforeNode, paragraphNode, afterNode].filter(
        (node): node is NonNullable<typeof node> => node !== null,
      )
      const blockPosition = $from.before()
      const paragraphPosition = blockPosition + (beforeNode?.nodeSize ?? 0)

      editor.view.dispatch(
        editor.state.tr
          .replaceWith(blockPosition, blockPosition + $from.parent.nodeSize, replacement)
          .scrollIntoView(),
      )
      editor.commands.setTextSelection({
        from: paragraphPosition + 1,
        to: paragraphPosition + 1 + selectedText.length,
      })
      editor.commands.focus()
      return
    }

    if (editor.isActive('codeBlock')) {
      editor.chain().focus().toggleCodeBlock().run()
      return
    }

    if (empty) {
      editor.chain().focus().toggleCodeBlock().run()
      return
    }

    const selectedText = editor.state.doc.textBetween(from, to, '\n')
    const codeBlock = editor.state.schema.nodes.codeBlock.create(
      null,
      selectedText ? editor.state.schema.text(selectedText) : undefined,
    )
    editor.view.dispatch(
      editor.state.tr.replaceRangeWith(from, to, codeBlock).scrollIntoView(),
    )
    editor.commands.focus()
  }

  function handleEditorAreaPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (target.closest('.notes-editor__content')) {
      return
    }

    event.preventDefault()
    editor?.chain().focus('end').run()
  }

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey

      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void persistCurrentNote(t('savedManually'))
      }

      if (meta && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        void handleCreateNote()
      }

    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleCreateNote, persistCurrentNote, t])

  if (sessionStatus === 'booting') {
    return (
      <main className="app-shell app-shell--loading">
        <div className="loading-mark">
          <span className="loading-mark__orbit" />
          <p>{t('opening')}</p>
        </div>
      </main>
    )
  }

  if (sessionStatus === 'anonymous') {
    return (
      <AuthScreen
        busy={authBusy}
        error={authError}
        form={authForm}
        locale={locale}
        mode={authMode}
        t={t}
        onFormChange={setAuthForm}
        onSubmit={handleAuthSubmit}
        onToggleLocale={() => setLocale((current) => (current === 'en' ? 'ru' : 'en'))}
        onToggleMode={() =>
          setAuthMode((current) => (current === 'login' ? 'register' : 'login'))
        }
      />
    )
  }

  return (
    <main className={`app-shell notes-app${darkMode ? ' notes-app--dark' : ''}`}>
      <NotesSidebar
        activeShelf={activeShelf}
        busy={notesBusy}
        counts={shelfCounts}
        hidden={false}
        mobileOpen={mobileNavigationOpen}
        notes={filteredNotes}
        selectedNoteId={selectedNoteId}
        t={t}
        onCreate={() => void handleCreateNote()}
        onClose={() => setMobileNavigationOpen(false)}
        onSelect={(noteId) => void handleSelectNote(noteId)}
        onShelfChange={(shelf) => {
          setActiveShelf(shelf)
          setMobileNavigationOpen(false)
        }}
      />
      {mobileNavigationOpen ? (
        <button
          className="mobile-sidebar-backdrop"
          type="button"
          aria-label={t('close')}
          onClick={() => setMobileNavigationOpen(false)}
        />
      ) : null}

      <section className="notes-workspace">
        <header className="mobile-app-bar">
          <button
            className="icon-button"
            type="button"
            aria-label={t('notes')}
            onClick={() => setMobileNavigationOpen(true)}
          >
            <Menu size={22} />
          </button>
          <strong>{activeShelfTitle}</strong>
          <div className="mobile-app-bar__actions">
            <button
              className="icon-button"
              type="button"
              aria-label={t('newNote')}
              onClick={() => void handleCreateNote()}
            >
              <span className="mobile-add-icon" aria-hidden="true">+</span>
            </button>
            <button
              className={`icon-button${mobileActionsOpen ? ' icon-button--active' : ''}`}
              type="button"
              aria-label={t('moreActions')}
              onClick={() => setMobileActionsOpen((current) => !current)}
            >
              <Ellipsis size={22} />
            </button>
          </div>
        </header>

        {mobileActionsOpen ? (
          <section className="mobile-actions-panel" aria-label={t('moreActions')}>
            <input
              className="mobile-actions-panel__search"
              placeholder={t('search')}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {selectedNote ? (
              <div className="mobile-actions-panel__note-actions">
                <button
                  className={`icon-button${draft.is_pinned ? ' icon-button--active' : ''}`}
                  type="button"
                  aria-label={t('pinned')}
                  onClick={() => updateDraftFlag('is_pinned')}
                >
                  <Pin size={18} />
                </button>
                <button
                  className={`icon-button${draft.is_favorite ? ' icon-button--active' : ''}`}
                  type="button"
                  aria-label={t('favorites')}
                  onClick={() => updateDraftFlag('is_favorite')}
                >
                  <Star size={18} />
                </button>
                <button
                  className={`icon-button${draft.is_archived ? ' icon-button--active' : ''}`}
                  type="button"
                  aria-label={t('archive')}
                  onClick={() => updateDraftFlag('is_archived')}
                >
                  <Archive size={18} />
                </button>
                <button className="icon-button" type="button" aria-label={t('exported')} onClick={handleExportNote}>
                  <Download size={18} />
                </button>
              </div>
            ) : null}
            <input
              className="mobile-actions-panel__tags"
              placeholder={t('tags')}
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
            <div className="mobile-actions-panel__preferences">
              <button
                className="icon-button toolbar-theme-button"
                type="button"
                aria-label={darkMode ? t('switchLight') : t('switchDark')}
                onClick={() => setDarkMode((current) => !current)}
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                className="icon-button locale-button"
                type="button"
                aria-label={t('language')}
                onClick={() => setLocale((current) => (current === 'en' ? 'ru' : 'en'))}
              >
                <span className="locale-code">{locale.toUpperCase()}</span>
              </button>
              <button
                className="icon-button toolbar-signout"
                disabled={authBusy}
                type="button"
                title={authBusy ? t('signingOut') : t('signOut')}
                aria-label={authBusy ? t('signingOut') : t('signOut')}
                onClick={handleLogout}
              >
                <LogOut size={18} />
              </button>
            </div>
          </section>
        ) : null}

        <header className="notes-toolbar">
          <div className="notes-toolbar__center">
            <div className="toolbar-format-window">
              <div className="toolbar-pill">
              <button
                className={`toolbar-pill__button${toolbarState?.bold ? ' is-active' : ''}`}
                type="button"
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                <Bold size={16} />
              </button>
              <button
                className={`toolbar-pill__button${toolbarState?.italic ? ' is-active' : ''}`}
                type="button"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                <Italic size={16} />
              </button>
              <button
                className={`toolbar-pill__button${toolbarState?.underline ? ' is-active' : ''}`}
                type="button"
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
              >
                <UnderlineIcon size={16} />
              </button>
              <button
                className={`toolbar-pill__button${toolbarState?.strike ? ' is-active' : ''}`}
                type="button"
                onClick={() => editor?.chain().focus().toggleStrike().run()}
              >
                <Strikethrough size={16} />
              </button>
              <button
                className={`toolbar-pill__button${toolbarState?.code ? ' is-active' : ''}`}
                type="button"
                title={t('inlineCode')}
                aria-label={t('inlineCode')}
                onClick={() => editor?.chain().focus().toggleCode().run()}
              >
                <Code2 size={16} />
              </button>
              <button
                className={`toolbar-pill__button${toolbarState?.codeBlock ? ' is-active' : ''}`}
                type="button"
                title={t('codeBlock')}
                aria-label={t('codeBlock')}
                onClick={handleCodeBlock}
              >
                <SquareCode size={16} />
              </button>
              <button
                className={`toolbar-pill__button${toolbarState?.highlight ? ' is-active' : ''}`}
                type="button"
                onClick={() => editor?.chain().focus().toggleHighlight().run()}
              >
                <Highlighter size={16} />
              </button>
              <button
                className={`toolbar-pill__button${toolbarState?.link ? ' is-active' : ''}`}
                type="button"
                title={t('createLink')}
                aria-label={t('createLink')}
                onClick={handleSetLink}
              >
                <Link2 size={16} />
              </button>
              <button
                className="toolbar-pill__button"
                disabled={!toolbarState?.link}
                type="button"
                title={t('removeLink')}
                aria-label={t('removeLink')}
                onClick={handleUnsetLink}
              >
                <Unlink size={16} />
              </button>
              <button className="toolbar-pill__button" type="button" onClick={() => setToolbarOpen((current) => !current)}>
                Aa
              </button>
              <button
                className={`toolbar-pill__button${toolbarState?.bulletList ? ' is-active' : ''}`}
                type="button"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              >
                <List size={16} />
              </button>
              <button
                className={`toolbar-pill__button${toolbarState?.orderedList ? ' is-active' : ''}`}
                type="button"
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              >
                <ListOrdered size={16} />
              </button>
              <button
                className={`toolbar-pill__button${toolbarState?.taskList ? ' is-active' : ''}`}
                type="button"
                onClick={() => editor?.chain().focus().toggleTaskList().run()}
              >
                <CheckSquare size={16} />
              </button>
              <button
                className={`toolbar-pill__button${toolbarState?.table ? ' is-active' : ''}`}
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
                  <span>{t('title')}</span>
                </button>
                <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
                  <Heading2 size={16} />
                  <span>{t('heading')}</span>
                </button>
                <button type="button" onClick={() => editor?.chain().focus().setParagraph().run()}>
                  <span className="format-popover__text" aria-hidden="true">Tt</span>
                  <span>{t('bodyText')}</span>
                </button>
                <button type="button" onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
                  <Quote size={16} />
                  <span>{t('blockQuote')}</span>
                </button>
                <button type="button" onClick={() => editor?.chain().focus().setColor('#caa8ff').run()}>
                  <span className="format-popover__swatch format-popover__swatch--purple" />
                  <span>{t('purpleText')}</span>
                </button>
                <button type="button" onClick={() => editor?.chain().focus().unsetColor().run()}>
                  <span className="format-popover__swatch format-popover__swatch--clear" />
                  <span>{t('resetColor')}</span>
                </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="notes-toolbar__right">
            <div className="toolbar-action-group">
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
            </div>
            <div className="toolbar-filter-field toolbar-filter-field--tags">
              <input
                className="toolbar-tags"
                placeholder={t('tags')}
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
            </div>
            <div className="toolbar-filter-field toolbar-filter-field--search">
              <Search className="toolbar-filter-field__icon" size={18} aria-hidden="true" />
              <input
                className="toolbar-search"
                placeholder={t('search')}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <div className="toolbar-preferences-group">
              <button
                className="icon-button toolbar-theme-button"
                type="button"
                title={darkMode ? t('lightTheme') : t('darkTheme')}
                aria-label={darkMode ? t('switchLight') : t('switchDark')}
                onClick={() => setDarkMode((current) => !current)}
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                className="icon-button locale-button"
                type="button"
                title={t('language')}
                aria-label={t('language')}
                onClick={() => setLocale((current) => (current === 'en' ? 'ru' : 'en'))}
              >
                <span className="locale-code">{locale.toUpperCase()}</span>
              </button>
              <button
                className="icon-button toolbar-signout"
                disabled={authBusy}
                type="button"
                title={authBusy ? t('signingOut') : t('signOut')}
                aria-label={authBusy ? t('signingOut') : t('signOut')}
                onClick={handleLogout}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <div className="notes-stage">
          {selectedNote ? (
            <article
              className={`notes-canvas${dragActive ? ' notes-canvas--drag' : ''}`}
              onPointerDown={() => setToolbarOpen(false)}
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
                  <strong>{t('dropImage')}</strong>
                  <span>{t('imageFormats')}</span>
                </div>
              ) : null}

              <input
                ref={titleRef}
                className="notes-title"
                placeholder={t('title')}
                type="text"
                value={draft.title}
                onChange={(event) => {
                  draftRevisionRef.current += 1
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }}
              />

              <div className="notes-title-divider" aria-hidden="true" />

              {draft.tags.length ? (
                <div className="tag-cloud">
                  {draft.tags.map((tag) => (
                    <button
                      key={tag}
                      className="tag-chip"
                      type="button"
                      onClick={() => {
                        const nextTags = draft.tags.filter((item) => item !== tag)
                        draftRevisionRef.current += 1
                        setTagInput(nextTags.join(', '))
                        setDraft((current) => ({ ...current, tags: nextTags }))
                      }}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="notes-editor" onPointerDown={handleEditorAreaPointerDown}>
                <EditorContent editor={editor} />
              </div>

              <nav className="mobile-editor-toolbar" aria-label={t('moreActions')}>
                <button
                  className={`icon-button${toolbarState?.bold ? ' icon-button--active' : ''}`}
                  type="button"
                  aria-label="Bold"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                >
                  <Bold size={18} />
                </button>
                <button
                  className={`icon-button${toolbarState?.italic ? ' icon-button--active' : ''}`}
                  type="button"
                  aria-label="Italic"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                >
                  <Italic size={18} />
                </button>
                <button
                  className={`icon-button${toolbarState?.underline ? ' icon-button--active' : ''}`}
                  type="button"
                  aria-label={t('inlineCode')}
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                >
                  <UnderlineIcon size={18} />
                </button>
                <button
                  className={`icon-button${toolbarState?.strike ? ' icon-button--active' : ''}`}
                  type="button"
                  aria-label="Strikethrough"
                  onClick={() => editor?.chain().focus().toggleStrike().run()}
                >
                  <Strikethrough size={18} />
                </button>
                <button
                  className={`icon-button${toolbarState?.code ? ' icon-button--active' : ''}`}
                  type="button"
                  aria-label={t('inlineCode')}
                  onClick={() => editor?.chain().focus().toggleCode().run()}
                >
                  <Code2 size={18} />
                </button>
                <button
                  className={`icon-button${toolbarState?.codeBlock ? ' icon-button--active' : ''}`}
                  type="button"
                  aria-label={t('codeBlock')}
                  onClick={handleCodeBlock}
                >
                  <SquareCode size={18} />
                </button>
                <button
                  className={`icon-button${toolbarState?.highlight ? ' icon-button--active' : ''}`}
                  type="button"
                  aria-label={t('purpleText')}
                  onClick={() => editor?.chain().focus().toggleHighlight().run()}
                >
                  <Highlighter size={18} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={t('createLink')}
                  onClick={handleSetLink}
                >
                  <Link2 size={18} />
                </button>
                <button
                  className="icon-button"
                  disabled={!toolbarState?.link}
                  type="button"
                  aria-label={t('removeLink')}
                  onClick={handleUnsetLink}
                >
                  <Unlink size={18} />
                </button>
                <button
                  className={`icon-button${toolbarState?.heading1 ? ' icon-button--active' : ''}`}
                  type="button"
                  aria-label={t('title')}
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                >
                  <Heading1 size={18} />
                </button>
                <button
                  className={`icon-button${toolbarState?.heading2 ? ' icon-button--active' : ''}`}
                  type="button"
                  aria-label={t('heading')}
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                  <Heading2 size={18} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={t('blockQuote')}
                  onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                >
                  <Quote size={18} />
                </button>
                <button
                  className={`icon-button${toolbarState?.bulletList ? ' icon-button--active' : ''}`}
                  type="button"
                  aria-label={t('bulletList')}
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                >
                  <List size={18} />
                </button>
                <button
                  className={`icon-button${toolbarState?.orderedList ? ' icon-button--active' : ''}`}
                  type="button"
                  aria-label={t('numberedList')}
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                >
                  <ListOrdered size={18} />
                </button>
                <button
                  className={`icon-button${toolbarState?.taskList ? ' icon-button--active' : ''}`}
                  type="button"
                  aria-label={t('checklist')}
                  onClick={() => editor?.chain().focus().toggleTaskList().run()}
                >
                  <CheckSquare size={18} />
                </button>
                <button
                  className={`icon-button${toolbarState?.table ? ' icon-button--active' : ''}`}
                  type="button"
                  aria-label={t('table')}
                  onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                >
                  <Table2 size={18} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={t('image')}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus size={18} />
                </button>
              </nav>

              <footer className="notes-footer">
                <div className="notes-footer__stats">
                  <span>{t('savedAt', { date: formatDate(selectedNote.edit_time) })}</span>
                  {saveState === 'saving' || saveState === 'dirty' ? (
                    <span>{saveState === 'saving' ? t('saving') : t('unsaved')}</span>
                  ) : null}
                  <span>{t('words', { count: wordCount })}</span>
                  <span>{draft.summary ? t('summaryChars', { count: draft.summary.length }) : t('noSummary')}</span>
                </div>
                <div className="notes-footer__actions">
                  <button className="notes-footer__action-button" type="button" title={t('duplicate')} aria-label={t('duplicate')} onClick={() => void handleDuplicateNote()}>
                    <Copy size={18} />
                  </button>
                  <button className="notes-footer__action-button" type="button" title={t('save')} aria-label={t('save')} onClick={() => void persistCurrentNote(t('savedManually'))}>
                    <Check size={18} />
                  </button>
                  <button className="notes-footer__action-button notes-footer__action-button--danger" disabled={deleteBusy} type="button" title={deleteBusy ? t('deleting') : t('delete')} aria-label={deleteBusy ? t('deleting') : t('delete')} onClick={() => void handleDeleteNote()}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </footer>
            </article>
          ) : (
            <div className="notes-empty">
              <h2>{t('noNoteSelected')}</h2>
              <p>{t('createFirst')}</p>
              <button className="button button--bright" type="button" onClick={() => void handleCreateNote()}>
                {t('newNote')}
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

    </main>
  )
}

export default App
