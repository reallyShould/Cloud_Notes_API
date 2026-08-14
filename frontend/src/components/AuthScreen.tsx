import type { Dispatch, FormEventHandler, SetStateAction } from 'react'
import { Languages } from 'lucide-react'

import type { Locale, TranslationKey } from '../i18n'
import type { AuthPayload } from '../types'

type AuthMode = 'login' | 'register'
type Translator = (
  key: TranslationKey,
  values?: Record<string, string | number>,
) => string

interface AuthScreenProps {
  busy: boolean
  error: string
  form: AuthPayload
  locale: Locale
  mode: AuthMode
  t: Translator
  onFormChange: Dispatch<SetStateAction<AuthPayload>>
  onSubmit: FormEventHandler<HTMLFormElement>
  onToggleLocale: () => void
  onToggleMode: () => void
}

export function AuthScreen({
  busy,
  error,
  form,
  locale,
  mode,
  t,
  onFormChange,
  onSubmit,
  onToggleLocale,
  onToggleMode,
}: AuthScreenProps) {
  return (
    <main className="app-shell auth-screen">
      <section className="auth-screen__panel">
        <form className="auth-form auth-form--dark" onSubmit={onSubmit}>
          <label>
            <span>{t('login')}</span>
            <input
              required
              type="text"
              value={form.login}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  login: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>{t('password')}</span>
            <input
              required
              type="password"
              value={form.password}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="button button--bright" disabled={busy} type="submit">
            {mode === 'login' ? t('openWorkspace') : t('createAccount')}
          </button>

          <button className="auth-switch" type="button" onClick={onToggleMode}>
            {mode === 'login' ? t('createInstead') : t('existingAccount')}
          </button>
          <button className="auth-switch" type="button" onClick={onToggleLocale}>
            <Languages size={15} /> {locale === 'en' ? 'Русский' : 'English'}
          </button>
        </form>
      </section>
    </main>
  )
}
