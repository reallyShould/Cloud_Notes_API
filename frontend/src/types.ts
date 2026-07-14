export interface User {
  id: number
  login: string
  theme: string
}

export interface Note {
  id: number
  title: string
  text: string | null
  summary: string | null
  tags: string[]
  is_pinned: boolean
  is_favorite: boolean
  is_archived: boolean
  created_time: string
  edit_time: string
  creator_id: number
}

export interface AuthPayload {
  login: string
  password: string
}

export interface NotePayload {
  title: string
  text: string | null
  summary: string | null
  tags: string[]
  is_pinned: boolean
  is_favorite: boolean
  is_archived: boolean
}

export interface UploadResponse {
  url: string
}
