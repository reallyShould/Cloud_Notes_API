export type Locale = 'en' | 'ru'

const translations = {
  en: {
    notes: 'Notes', pinned: 'Pinned', favorites: 'Favorites', archive: 'Archive',
    loading: 'Loading…', emptyNote: 'Empty note', noShelfNotes: 'No notes in this shelf.',
    editorPlaceholder: 'Start writing your note…', title: 'Title', heading: 'Heading', text: 'Text', bodyText: 'Body text',
    blockQuote: 'Block quote', enterLink: 'Enter a link', link: 'Link', checklist: 'Checklist', table: 'Table',
    purpleText: 'Purple text', resetColor: 'Reset color', tags: 'Tags', search: 'Search',
    lightTheme: 'Light theme', darkTheme: 'Dark theme', switchLight: 'Switch to light theme', switchDark: 'Switch to dark theme',
    signOut: 'Sign out', signingOut: 'Signing out…', noNoteSelected: 'No note selected', saving: 'Saving…', unsaved: 'Unsaved',
    favorite: 'Favorite', archived: 'Archived', draft: 'Draft', dropImage: 'Drop image to insert', imageFormats: 'PNG, JPG, WEBP or GIF',
    words: '{count} words', minRead: '{count} min read', tagCount: '{count} tags', noTags: 'No tags',
    summaryChars: '{count} summary chars', noSummary: 'No summary', duplicate: 'Duplicate', save: 'Save', delete: 'Delete', deleting: 'Deleting…',
    createFirst: 'Create a note to start writing.', newNote: 'New note', searchCommands: 'Search commands', noCommands: 'No commands found.',
    opening: 'Opening notes…', cloudNotes: 'Cloud Notes', authHeading: 'Dark, focused notes with visual formatting.',
    authCopy: 'Apple Notes inspired workspace with secure sign in, formatting buttons, note library and autosave.',
    login: 'Login', password: 'Password', openWorkspace: 'Open workspace', createAccount: 'Create account',
    createInstead: 'Create account instead', existingAccount: 'I already have an account', language: 'Language',
    largeHeading: 'Large heading', sectionHeading: 'Section heading', subsection: 'Subsection', quote: 'Quote', bulletList: 'Bullet list',
    numberedList: 'Numbered list', codeBlock: 'Code block', divider: 'Divider', image: 'Image',
    defaultParagraph: 'Default paragraph block', primaryTitle: 'Primary section title', secondaryHeading: 'Secondary heading block',
    compactHeading: 'Compact heading block', emphasizedQuote: 'Block quote with emphasis', unorderedList: 'Unordered list',
    orderedSequence: 'Ordered sequence', taskList: 'Trackable task list', preformattedBlock: 'Monospaced preformatted block',
    sectionBreak: 'Visual section break', grid: '3 by 3 grid', uploadDevice: 'Upload from device',
  },
  ru: {
    notes: 'Заметки', pinned: 'Закреплённые', favorites: 'Избранное', archive: 'Архив',
    loading: 'Загрузка…', emptyNote: 'Пустая заметка', noShelfNotes: 'В этом разделе нет заметок.',
    editorPlaceholder: 'Начните писать заметку…', title: 'Название', heading: 'Заголовок', text: 'Текст', bodyText: 'Основной текст',
    blockQuote: 'Блок цитаты', enterLink: 'Введите ссылку', link: 'Ссылка', checklist: 'Чек-лист', table: 'Таблица',
    purpleText: 'Фиолетовый текст', resetColor: 'Сбросить цвет', tags: 'Теги', search: 'Поиск',
    lightTheme: 'Светлая тема', darkTheme: 'Тёмная тема', switchLight: 'Включить светлую тему', switchDark: 'Включить тёмную тему',
    signOut: 'Выйти', signingOut: 'Выход…', noNoteSelected: 'Заметка не выбрана', saving: 'Сохранение…', unsaved: 'Не сохранено',
    favorite: 'Избранное', archived: 'В архиве', draft: 'Черновик', dropImage: 'Перетащите изображение сюда', imageFormats: 'PNG, JPG, WEBP или GIF',
    words: 'Слов: {count}', minRead: 'Чтение: {count} мин', tagCount: 'Тегов: {count}', noTags: 'Нет тегов',
    summaryChars: 'Символов в описании: {count}', noSummary: 'Нет описания', duplicate: 'Дублировать', save: 'Сохранить', delete: 'Удалить', deleting: 'Удаление…',
    createFirst: 'Создайте заметку, чтобы начать.', newNote: 'Новая заметка', searchCommands: 'Поиск команд', noCommands: 'Команды не найдены.',
    opening: 'Открываем заметки…', cloudNotes: 'Облачные заметки', authHeading: 'Сосредоточьтесь на заметках и форматировании.',
    authCopy: 'Рабочее пространство в стиле Apple Notes с безопасным входом, форматированием, библиотекой заметок и автосохранением.',
    login: 'Логин', password: 'Пароль', openWorkspace: 'Открыть заметки', createAccount: 'Создать аккаунт',
    createInstead: 'Создать аккаунт', existingAccount: 'У меня уже есть аккаунт', language: 'Язык',
    largeHeading: 'Большой заголовок', sectionHeading: 'Заголовок раздела', subsection: 'Подзаголовок', quote: 'Цитата', bulletList: 'Маркированный список',
    numberedList: 'Нумерованный список', codeBlock: 'Блок кода', divider: 'Разделитель', image: 'Изображение',
    defaultParagraph: 'Обычный абзац', primaryTitle: 'Главный заголовок раздела', secondaryHeading: 'Вторичный заголовок',
    compactHeading: 'Компактный заголовок', emphasizedQuote: 'Выделенный блок цитаты', unorderedList: 'Неупорядоченный список',
    orderedSequence: 'Упорядоченная последовательность', taskList: 'Список задач', preformattedBlock: 'Моноширинный блок кода',
    sectionBreak: 'Визуальный разделитель', grid: 'Сетка 3 на 3', uploadDevice: 'Загрузить с устройства',
  },
} as const

export type TranslationKey = keyof typeof translations.en

export function translate(locale: Locale, key: TranslationKey, values?: Record<string, string | number>) {
  let value: string = translations[locale][key]
  for (const [name, replacement] of Object.entries(values ?? {})) {
    value = value.replace(`{${name}}`, String(replacement))
  }
  return value
}
