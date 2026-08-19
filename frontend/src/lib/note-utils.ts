import type { Note, NotePayload } from '../types'

export const defaultDraft: NotePayload = {
  title: '',
  text: '',
  summary: '',
  tags: [],
  is_pinned: false,
  is_favorite: false,
  is_archived: false,
}

export function formatDate(value: string) {
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  const date = new Date(hasTimeZone ? value : `${value}Z`)
  const pad = (part: number) => String(part).padStart(2, '0')

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function sortNotes(items: Note[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.edit_time).getTime() - new Date(left.edit_time).getTime(),
  )
}

export function htmlToPlainText(value: string) {
  if (!value) return ''

  const document = new DOMParser().parseFromString(value, 'text/html')
  return document.body.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

export function extractSummary(value: string) {
  return htmlToPlainText(value).slice(0, 280)
}

export function estimateReadingTime(words: number) {
  return Math.max(1, Math.ceil(words / 180))
}

export function noteToPayload(note: Note): NotePayload {
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

export function payloadEqualsNote(payload: NotePayload, note: Note | null) {
  if (!note) return false

  return JSON.stringify({
    ...payload,
    text: payload.text ?? '',
    summary: payload.summary ?? '',
  }) === JSON.stringify(noteToPayload(note))
}
