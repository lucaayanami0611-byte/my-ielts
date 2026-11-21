<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { resolveAssetUrl } from '~/composables/assets'
import { correctSpelling, filteredWords, keywordPack, packs, pickWords, readProgress, wordsById, writeProgress } from '~/dictation'
import type { DictationWord, Pack, WordFilter } from '~/dictation'

const progress = ref(readProgress())
const query = ref('')
const filter = ref<WordFilter>('all')
const roundSize = ref(10)
const input = ref('')
const answerInput = ref<HTMLInputElement>()
const nextButton = ref<HTMLButtonElement>()
const practice = ref<HTMLElement>()
const library = ref<HTMLElement>()
const audioError = ref('')
const storageError = ref(false)
const expanded = ref(false)
let audio: HTMLAudioElement | undefined

const filterOptions: { key: WordFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'word', label: '单词' },
  { key: 'phrase', label: '词组' },
]
const references = [
  { title: '词汇与跟打', to: '/vocabulary/typing' },
  { title: '语法课程', to: '/grammar' },
  { title: '听力技巧', to: '/listening' },
  { title: '口语资料', to: '/speaking' },
  { title: '阅读同义词', to: '/reading' },
  { title: '写作翻译练习', to: '/writing' },
]

const session = computed(() => progress.value.session)
const word = computed(() => session.value && wordsById.get(session.value.ids[session.value.cursor]))
const checked = computed(() => session.value?.answers[session.value.cursor])
const complete = computed(() => session.value && session.value.cursor === session.value.ids.length)
const learned = computed(() => Object.keys(progress.value.results).length)
const wrong = computed(() => Array.from(wordsById.values()).filter(item => progress.value.results[item.id] === false))
const rate = computed(() => learned.value ? `${Math.round((learned.value - wrong.value.length) * 100 / learned.value)}%` : '—')
const score = computed(() => session.value?.answers.filter(answer => answer.correct).length ?? 0)

const packList = computed(() => packs
  .filter(pack => pack.title.toLowerCase().includes(query.value.trim().toLowerCase()))
  .map(pack => ({ pack, words: filteredWords(pack, filter.value) }))
  .filter(item => item.words.length)
  .map(item => ({
    ...item,
    known: item.words.filter(word => progress.value.results[word.id] === true).length,
  })))
const visiblePacks = computed(() => expanded.value || query.value.trim() ? packList.value : packList.value.slice(0, 9))

function persist() {
  storageError.value = !writeProgress(progress.value)
}

function stopAudio() {
  audio?.pause()
  audio = undefined
}

function play() {
  const current = word.value
  if (!current)
    return
  stopAudio()
  audioError.value = ''
  const track = new Audio(resolveAssetUrl(current.audio))
  audio = track
  const showError = () => {
    if (audio === track)
      audioError.value = '这段音频播放失败，请点重播或跳过本题。'
  }
  track.addEventListener('error', showError, { once: true })
  track.play().catch(showError)
}

function focusAnswer() {
  nextTick(() => answerInput.value?.focus())
}

function start(title: string, available: DictationWord[]) {
  const ids = pickWords(available, progress.value.results, roundSize.value).map(item => item.id)
  if (!ids.length)
    return
  progress.value.session = { title, ids, cursor: 0, answers: [] }
  input.value = ''
  persist()
  play()
  nextTick(() => practice.value?.scrollIntoView({ block: 'nearest' }))
  focusAnswer()
}

function startPack(pack: Pack) {
  start(pack.title, filteredWords(pack, filter.value))
}

function submit(skip = false) {
  const current = word.value
  const round = session.value
  const response = input.value.trim()
  if (!current || !round || checked.value || (!response && !skip))
    return
  const correct = !skip && correctSpelling(response, current.answer)
  round.answers.push({ input: skip ? '' : response, correct })
  progress.value.results[current.id] = correct
  persist()
  nextTick(() => nextButton.value?.focus())
}

function nextWord() {
  if (!session.value || !checked.value)
    return
  session.value.cursor += 1
  input.value = ''
  audioError.value = ''
  persist()
  stopAudio()
  if (word.value) {
    play()
    focusAnswer()
  }
}

onBeforeUnmount(stopAudio)
</script>

<template>
  <main class="study">
    <div class="top-grid">
      <section ref="practice" class="practice-panel" :class="{ 'practice-intro': !session || complete }" aria-labelledby="practice-title">
        <template v-if="!session || complete">
          <p class="panel-label">
            雅思听写
          </p>
          <h1 id="practice-title">
            {{ complete ? '这组听写已完成' : '练听力，从听写开始' }}
          </h1>
          <p v-if="complete" aria-live="polite">
            {{ session?.title }} · 答对 {{ score }} / {{ session?.ids.length }} 题
          </p>
          <p v-else>
            选一个场景，听录音后写下英文。做错的词可以单独重练。
          </p>
          <div class="practice-actions">
            <button v-if="!complete" type="button" class="primary" @click="startPack(keywordPack)">
              <i class="i-carbon-headphones" aria-hidden="true" />
              开始听力 179
            </button>
            <button v-if="complete && wrong.length" type="button" class="primary" @click="start('错词复习', wrong)">
              复习错词
            </button>
            <button class="secondary" type="button" @click="library?.scrollIntoView({ block: 'start' })">
              选择词包 <span aria-hidden="true">↓</span>
            </button>
          </div>
        </template>

        <template v-else-if="word">
          <div class="practice-top">
            <p class="panel-label">正在听写</p>
            <span>第 {{ session.cursor + 1 }} / {{ session.ids.length }} 题</span>
          </div>
          <h1 id="practice-title">{{ session.title }}</h1>
          <progress :max="session.ids.length" :value="session.cursor + (checked ? 1 : 0)" aria-label="练习进度" />
          <button type="button" class="secondary replay" @click="play">
            <i class="i-carbon-volume-up" aria-hidden="true" /> 播放 / 重播
          </button>
          <p v-if="audioError" class="audio-error" role="status">{{ audioError }}</p>
          <form v-if="!checked" class="answer-row" @submit.prevent="submit()">
            <label for="dictation-answer" class="sr-only">填写听到的英文</label>
            <input
              id="dictation-answer" ref="answerInput" v-model="input" type="text"
              placeholder="填写听到的英文" autocomplete="off" autocapitalize="none" :spellcheck="false"
            >
            <button type="submit" class="primary" :disabled="!input.trim()">检查</button>
            <button type="button" class="secondary" @click="submit(true)">跳过</button>
          </form>
          <div v-else class="answer-row feedback">
            <p role="status">
              <strong>{{ checked.correct ? '正确' : checked.input ? '拼写有误' : '已跳过' }} · {{ word.answer }}</strong>
              <span>{{ word.meaning }}</span>
            </p>
            <button ref="nextButton" type="button" class="primary" @click="nextWord">
              {{ session.cursor === session.ids.length - 1 ? '看本组结果' : '下一题' }}
            </button>
          </div>
        </template>
      </section>

      <aside class="summary" aria-labelledby="summary-title">
        <h2 id="summary-title">练习记录</h2>
        <p>进度保存在当前浏览器。</p>
        <dl>
          <div><dt>已练词条</dt><dd>{{ learned }}</dd></div>
          <div><dt>最近作答正确率</dt><dd>{{ rate }}</dd></div>
          <div><dt>待复习</dt><dd>{{ wrong.length }}</dd></div>
        </dl>
        <button type="button" class="review-button" :disabled="!wrong.length" @click="start('错词复习', wrong)">
          <i class="i-carbon-renew" aria-hidden="true" /> 复习错词
        </button>
        <p v-if="storageError" role="status" class="storage-error">此浏览器暂时无法保存进度。</p>
      </aside>
    </div>

    <section ref="library" class="library" aria-labelledby="library-title">
      <div class="library-heading">
        <div>
          <h2 id="library-title">场景词包</h2>
          <p>{{ packs.length }} 个词包 · 使用 My IELTS 自带音频</p>
        </div>
        <label class="search">
          <i class="i-carbon-search" aria-hidden="true" />
          <span class="sr-only">搜索词包</span>
          <input v-model="query" type="search" placeholder="搜索主题，例如交通">
        </label>
      </div>
      <div class="filters">
        <div class="segments" role="group" aria-label="听写内容">
          <button
            v-for="option in filterOptions" :key="option.key" type="button"
            :aria-pressed="filter === option.key" @click="filter = option.key"
          >
            {{ option.label }}
          </button>
        </div>
        <label class="round-size">
          每组题量
          <select v-model.number="roundSize">
            <option :value="10">10 题</option>
            <option :value="20">20 题</option>
            <option :value="30">30 题</option>
          </select>
        </label>
      </div>
      <p v-if="!visiblePacks.length" class="empty" role="status">没有匹配的词包。可以修改搜索词或切换听写内容。</p>
      <ul v-else class="pack-grid">
        <li v-for="item in visiblePacks" :key="item.pack.id">
          <button type="button" class="pack" @click="startPack(item.pack)">
            <span class="pack-icon" aria-hidden="true"><i :class="item.pack === keywordPack ? 'i-carbon-headphones' : 'i-carbon-book'" /></span>
            <span class="pack-content">
              <strong>{{ item.pack.title }}</strong>
              <span>{{ item.words.length }} 词条<span v-if="item.known"> · {{ item.known }} 已答对</span></span>
            </span>
            <span class="pack-arrow" aria-hidden="true">→</span>
          </button>
        </li>
      </ul>
      <button
        v-if="!query.trim() && packList.length > 9" type="button" class="all-packs"
        :aria-expanded="expanded" @click="expanded = !expanded"
      >
        {{ expanded ? '收起词包' : `查看全部 ${packList.length} 个词包` }}
      </button>
    </section>

    <section class="references" aria-labelledby="references-title">
      <h2 id="references-title">备考资料</h2>
      <nav aria-label="备考资料">
        <RouterLink v-for="resource in references" :key="resource.to" :to="resource.to">
          {{ resource.title }} <span aria-hidden="true">↗</span>
        </RouterLink>
      </nav>
    </section>
  </main>
</template>

<style scoped src="../styles/study.css"></style>
