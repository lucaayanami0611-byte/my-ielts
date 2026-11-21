import keywords from './pages/listening/listening179.json'
import vocabulary from './pages/vocabulary/vocabulary.js'

export interface DictationWord {
  id: string
  answer: string
  meaning: string
  audio: string
}

interface VocabularyChapter {
  label: string
  words: { id: number; word: string[]; meaning: string }[][]
}

export interface Pack {
  id: string
  title: string
  words: DictationWord[]
}

export const keywordPack: Pack = {
  id: 'listening179',
  title: '听力 179 考点词',
  words: keywords.map(entry => ({
    id: `keyword-${entry.index}`,
    answer: entry.word,
    meaning: entry.meaning,
    audio: `179_audios/${entry.word}.mp3`,
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
      })),
  })),
]

export const wordsById = new Map(packs.flatMap(pack => pack.words).map(word => [word.id, word]))

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

export function readProgress(): Progress {
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
    return true
  }
  catch {
    return false
  }
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
