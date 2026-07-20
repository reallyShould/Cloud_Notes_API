import type { AuthPayload, Note, NotePayload, UploadResponse, User } from '../types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(
  /\/$/,
  '',
)

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
    ...init,
  })

  if (!response.ok) {
    let message = 'Request failed.'

    try {
      const data = (await response.json()) as { detail?: string }
      if (data.detail) {
        message = data.detail
      }
    } catch {
      message = response.statusText || message
    }

    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function register(payload: AuthPayload) {
  return request<User>('/users/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function login(payload: AuthPayload) {
  return request<{ message: string }>('/users/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function logout() {
  return request<{ message: string }>('/users/logout', {
    method: 'POST',
  })
}

export function getCurrentUser() {
  return request<User>('/users/me')
}

export function updateUserTheme(theme: 'light' | 'dark') {
  return request<User>('/users/me/theme', {
    method: 'PATCH',
    body: JSON.stringify({ theme }),
  })
}

export function getNotes() {
  return request<Note[]>('/notes')
}

export function createNote(payload: NotePayload) {
  return request<Note>('/notes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getNote(noteId: number) {
  return request<Note>(`/notes/${noteId}`)
}

export function updateNote(noteId: number, payload: NotePayload) {
  return request<Note>(`/notes/${noteId}`, {
    method: 'PUT',
    keepalive: true,
    body: JSON.stringify(payload),
  })
}

export function deleteNote(noteId: number) {
  return request<{ message: string }>(`/notes/${noteId}`, {
    method: 'DELETE',
  })
}

export function uploadAttachment(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return request<UploadResponse>('/attachments', {
    method: 'POST',
    body: formData,
  })
}
