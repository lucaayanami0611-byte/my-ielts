import keywords from './pages/listening/listening179.json'
import vocabulary from './pages/vocabulary/vocabulary.js'

export interface DictationWord {
  id: string
  answer: string
  meaning: string
  audio: string
  example?: string
}

interface VocabularyChapter {
  label: string
  words: { id: number; word: string[]; meaning: string; example: string }[][]
}

export interface Pack {
  id: string
  title: string
  words: DictationWord[]
}

const keywordExamples: Record<string, string> = {
  'reserve': 'Could you reserve a quiet room for me?',
  'in advance': 'Please book your ticket in advance.',
  'have to': 'Visitors have to sign in at the front desk.',
  'adjust': 'You can adjust the temperature in your room.',
  'and': 'The tour includes transport and lunch.',
  'but': 'The room is small but comfortable.',
  'because': 'We arrived early because the trains were delayed.',
  'diversity': 'The museum celebrates the diversity of local cultures.',
  'fee': 'The enrolment fee includes all course materials.',
  'establish': 'The team wants to establish a new research centre.',
  'transfer': 'Passengers can transfer to the airport bus at this stop.',
  'habitat': 'The project protects the natural habitat of the birds.',
  'international': 'The university welcomes international students.',
  'export': 'Local businesses export their goods by rail.',
}

export const keywordPack: Pack = {
  id: 'listening179',
  title: '听力 179 考点词',
  words: keywords.map(entry => ({
    id: `keyword-${entry.index}`,
    answer: entry.word,
    meaning: entry.meaning,
    audio: `179_audios/${entry.word}.mp3`,
    example: keywordExamples[entry.word],
  })),
}

export const packs: Pack[] = [
  keywordPack,
  ...Object.entries(vocabulary as Record<string, VocabularyChapter>).map(([chapter, entries]) => ({
    id: chapter,
    title: entries.label.replace(/^\d+_/, ''),
    words: entries.words.flat()
      // This entry has no recording in the source audio library.
      .filter(entry => !(chapter === '12_饮食健康' && entry.id === 1749))
      .map(entry => ({
        id: `vocabulary-${entry.id}`,
        answer: entry.word[0],
        meaning: entry.meaning,
        audio: `vocabulary/audio/${chapter}/${entry.word[0]}.mp3`,
        example: entry.example,
      })),
  })),
]

export const wordsById = new Map(packs.flatMap(pack => pack.words).map(word => [word.id, word]))

export function sentenceBlank(word: DictationWord) {
  if (!word.example)
    return null
  const pattern = word.answer.trim().split(/\s+/)
    .map(part => part.replace(/[.*+?^$${}()|[\]\\]/g, '\\$&')).join('\\s+')
  const matches = [...word.example.matchAll(new RegExp(`(^|[^\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`, 'giu'))]
  if (matches.length !== 1)
    return null
  const [match] = matches
  const start = (match.index ?? 0) + match[1].length
  return {
    before: word.example.slice(0, start),
    after: word.example.slice(start + match[2].length),
  }
}

export type WordFilter = 'all' | 'word' | 'phrase'
export function filteredWords(pack: Pack, filter: WordFilter) {
  if (filter === 'all')
    return pack.words
  return pack.words.filter(word => (/\s/.test(word.answer) ? 'phrase' : 'word') === filter)
}

type Results = Record<string, boolean>

export interface Session {
  title: string
  ids: string[]
  cursor: number
  answers: { input: string; correct: boolean }[]
}

export interface Progress {
  results: Results
  session: Session | null
}

let volatileProgress: Progress | undefined

export function readProgress(): Progress {
  if (volatileProgress)
    return volatileProgress
  try {
    const stored: Progress = JSON.parse(localStorage.getItem('my-ielts-dictation-v1') || 'null')
    if (stored?.results && typeof stored.results === 'object') {
      const results = Object.fromEntries(Object.entries(stored.results)
        .filter(([id, correct]) => wordsById.has(id) && typeof correct === 'boolean'))
      const session = stored.session
      if (session && typeof session.title === 'string'
        && Array.isArray(session.ids) && session.ids.length > 0 && session.ids.length <= 30
        && session.ids.every(id => wordsById.has(id))
        && Number.isInteger(session.cursor) && session.cursor >= 0 && session.cursor <= session.ids.length
        && Array.isArray(session.answers) && session.answers.length >= session.cursor
        && session.answers.length <= Math.min(session.cursor + 1, session.ids.length)
        && session.answers.every(answer => typeof answer?.input === 'string' && typeof answer.correct === 'boolean'))
        return { results, session }
      return { results, session: null }
    }
  }
  catch {
    // Storage may be unavailable or contain an older invalid record.
  }
  return { results: {}, session: null }
}

export function writeProgress(progress: Progress) {
  try {
    localStorage.setItem('my-ielts-dictation-v1', JSON.stringify(progress))
    volatileProgress = undefined
    return true
  }
  catch {
    volatileProgress = progress
    return false
  }
}

export function missedWords(progress: Progress) {
  return Array.from(wordsById.values()).filter(word => progress.results[word.id] === false)
}

export function startSession(progress: Progress, title: string, words: DictationWord[], size: number) {
  const ids = pickWords(words, progress.results, size).map(word => word.id)
  if (!ids.length)
    return false
  progress.session = { title, ids, cursor: 0, answers: [] }
  writeProgress(progress)
  return true
}

export function pickWords(words: DictationWord[], results: Results, count: number) {
  const rank = (word: DictationWord) => results[word.id] === undefined ? 0 : results[word.id] ? 2 : 1
  return [...words].sort((first, second) => rank(first) - rank(second)).slice(0, count)
}

export function correctSpelling(input: string, answer: string) {
  const normalize = (word: string) => word.normalize('NFKC').toLowerCase().trim()
    .replace(/[‘’]/g, "'").replace(/\s+/g, ' ')
  return normalize(input) === normalize(answer)
}
