import { SquarePen } from 'lucide-react'

import type { TranslationKey } from '../i18n'
import { htmlToPlainText } from '../lib/note-utils'
import type { Note } from '../types'

export type Shelf = 'all' | 'pinned' | 'favorites' | 'archived'

type Translator = (
  key: TranslationKey,
  values?: Record<string, string | number>,
) => string

interface NotesSidebarProps {
  activeShelf: Shelf
  busy: boolean
  counts: Record<Shelf, number>
  hidden: boolean
  notes: Note[]
  selectedNoteId: number | null
  t: Translator
  onCreate: () => void
  onSelect: (noteId: number) => void
  onShelfChange: (shelf: Shelf) => void
}

const shelves: Shelf[] = ['all', 'pinned', 'favorites', 'archived']

function shelfTranslationKey(shelf: Shelf): TranslationKey {
  if (shelf === 'all') return 'notes'
  if (shelf === 'archived') return 'archive'
  return shelf
}

export function NotesSidebar({
  activeShelf,
  busy,
  counts,
  hidden,
  notes,
  selectedNoteId,
  t,
  onCreate,
  onSelect,
  onShelfChange,
}: NotesSidebarProps) {
  return (
    <aside className={`notes-sidebar${hidden ? ' notes-sidebar--hidden' : ''}`}>
      <div className="notes-sidebar__top">
        <button className="icon-button" type="button" onClick={onCreate}>
          <SquarePen size={16} />
        </button>
      </div>

      <div className="notes-sidebar__section">
        <h2>{t(shelfTranslationKey(activeShelf))}</h2>
        <span>{counts[activeShelf]}</span>
      </div>

      <div className="sidebar-shelves">
        {shelves.map((shelf) => (
          <button
            key={shelf}
            className={`sidebar-shelf${activeShelf === shelf ? ' sidebar-shelf--active' : ''}`}
            type="button"
            onClick={() => onShelfChange(shelf)}
          >
            <span>{t(shelfTranslationKey(shelf))}</span>
            <span>{counts[shelf]}</span>
          </button>
        ))}
      </div>

      <div className="notes-list notes-list--dark">
        {busy ? <p className="muted muted--dark">{t('loading')}</p> : null}
        {notes.map((note) => (
          <button
            key={note.id}
            className={`note-row${note.id === selectedNoteId ? ' note-row--active' : ''}`}
            type="button"
            onClick={() => onSelect(note.id)}
          >
            <strong>{note.title}</strong>
            <span>{note.summary || htmlToPlainText(note.text ?? '') || t('emptyNote')}</span>
          </button>
        ))}
        {!busy && !notes.length ? (
          <p className="muted muted--dark">{t('noShelfNotes')}</p>
        ) : null}
      </div>
    </aside>
  )
}
