<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { resolveAssetUrl } from '~/composables/assets'
import { correctSpelling, missedWords, readProgress, sentenceBlank, startSession, wordsById, writeProgress } from '~/dictation'

const progress = ref(readProgress())
const stage = ref<HTMLElement>()
const input = ref('')
const answerInput = ref<HTMLInputElement>()
const nextButton = ref<HTMLButtonElement>()
const listOpen = ref(false)
const showMeaning = ref(false)
const showAnswer = ref(false)
const audioError = ref('')
const storageError = ref(false)
const fullscreen = ref(false)
const canFullscreen = document.fullscreenEnabled
const canSpeak = 'speechSynthesis' in window
const background = resolveAssetUrl('study/station.webp')

const session = computed(() => progress.value.session)
const word = computed(() => session.value && wordsById.get(session.value.ids[session.value.cursor]))
const blank = computed(() => word.value ? sentenceBlank(word.value) : null)
const checked = computed(() => session.value?.answers[session.value.cursor])
const complete = computed(() => session.value && session.value.cursor === session.value.ids.length)
const score = computed(() => session.value?.answers.filter(answer => answer.correct).length || 0)
const wrong = computed(() => missedWords(progress.value))
let audio: HTMLAudioElement | undefined

function stopAudio() {
  audio?.pause()
  audio = undefined
  if (canSpeak)
    window.speechSynthesis.cancel()
}

function play() {
  if (!word.value)
    return
  stopAudio()
  audioError.value = ''
  const track = new Audio(resolveAssetUrl(word.value.audio))
  audio = track
  const showError = () => {
    if (audio === track)
      audioError.value = '音频播放失败，请重播或跳过。'
  }
  track.addEventListener('error', showError, { once: true })
  track.play().catch(showError)
}

function readSentence() {
  const example = word.value?.example
  if (!example || !blank.value || !canSpeak)
    return
  stopAudio()
  audioError.value = ''
  const utterance = new SpeechSynthesisUtterance(example)
  utterance.lang = 'en-GB'
  utterance.rate = 0.9
  utterance.onerror = (event) => {
    if (event.error !== 'interrupted' && event.error !== 'canceled')
      audioError.value = '例句朗读暂不可用，可以播放单词录音。'
  }
  window.speechSynthesis.speak(utterance)
}

function persist() {
  storageError.value = !writeProgress(progress.value)
}

function focusAnswer() {
  nextTick(() => answerInput.value?.focus())
}

function submit(skip = false) {
  const current = word.value
  const round = session.value
  const response = input.value.trim()
  if (!current || !round || checked.value || (!response && !skip))
    return
  const correct = !skip && !showAnswer.value && correctSpelling(response, current.answer)
  round.answers.push({ input: skip ? '' : response, correct })
  progress.value.results[current.id] = correct
  persist()
  nextTick(() => nextButton.value?.focus())
}

function resetQuestion() {
  input.value = ''
  showMeaning.value = false
  showAnswer.value = false
  audioError.value = ''
  stopAudio()
  if (word.value) {
    play()
    focusAnswer()
  }
}

function nextWord() {
  if (!session.value || !checked.value)
    return
  session.value.cursor += 1
  persist()
  resetQuestion()
}

function startReview() {
  if (startSession(progress.value, '错词复习', wrong.value, session.value?.ids.length || 10))
    resetQuestion()
}

function onShortcut(event: KeyboardEvent) {
  if (event.isComposing || event.defaultPrevented || !word.value || listOpen.value)
    return
  const key = event.key.toLowerCase()
  if (event.altKey && !event.ctrlKey && !event.metaKey && ['r', 'm', 'a'].includes(key)) {
    event.preventDefault()
    if (key === 'r')
      play()
    else if (key === 'm')
      showMeaning.value = !showMeaning.value
    else if (!checked.value)
      showAnswer.value = true
  }
  else if (event.key === 'ArrowDown' && event.target === answerInput.value && !checked.value) {
    event.preventDefault()
    submit(true)
  }
}

function updateFullscreen() {
  fullscreen.value = document.fullscreenElement === stage.value
}

async function toggleFullscreen() {
  try {
    if (fullscreen.value)
      await document.exitFullscreen()
    else
      await stage.value?.requestFullscreen()
  }
  catch {
    // The standalone practice view also runs without browser fullscreen.
  }
}

onMounted(() => {
  window.addEventListener('keydown', onShortcut)
  document.addEventListener('fullscreenchange', updateFullscreen)
  if (word.value && !checked.value) {
    focusAnswer()
    if (navigator.userActivation?.isActive)
      play()
  }
})

onBeforeUnmount(() => {
  stopAudio()
  window.removeEventListener('keydown', onShortcut)
  document.removeEventListener('fullscreenchange', updateFullscreen)
})
</script>

<template>
  <main ref="stage" class="stage" :style="{ '--background': `url(${background})` }">
    <header class="stage-tools">
      <div v-if="session" class="stage-progress">
        <strong>{{ session.title }}</strong>
        <span>{{ Math.min(session.cursor + 1, session.ids.length) }} / {{ session.ids.length }}</span>
        <progress :max="session.ids.length" :value="session.answers.length" aria-label="本组听写进度" />
      </div>
      <div class="stage-actions">
        <button v-if="canFullscreen" type="button" :aria-pressed="fullscreen" @click="toggleFullscreen">
          <i class="i-carbon-maximize" aria-hidden="true" /> {{ fullscreen ? '退出全屏' : '全屏' }}
        </button>
        <button v-if="session" type="button" :aria-expanded="listOpen" aria-controls="question-list" @click="listOpen = !listOpen">
          <i class="i-carbon-list" aria-hidden="true" /> 词表
        </button>
        <RouterLink to="/">返回词库</RouterLink>
      </div>
    </header>

    <aside v-if="listOpen && session" id="question-list" class="question-list" aria-label="本组词表">
      <div class="list-heading">
        <h2>本组词表</h2>
        <button type="button" @click="listOpen = false">关闭</button>
      </div>
      <ol>
        <li v-for="(id, index) in session.ids" :key="id" :aria-current="index === session.cursor ? 'step' : undefined">
          <span>{{ index + 1 }}. {{ session.answers[index] ? wordsById.get(id)?.answer : index === session.cursor ? '当前题' : '待听写' }}</span>
          <span v-if="session.answers[index]">{{ session.answers[index].correct ? '正确' : '待复习' }}</span>
        </li>
      </ol>
    </aside>

    <section class="exercise" aria-labelledby="exercise-title">
      <template v-if="word">
        <h1 id="exercise-title">{{ blank ? '例句填空' : '听写拼写' }}</h1>
        <form @submit.prevent="submit()">
          <div class="sentence">
            <span v-if="blank" lang="en">{{ blank.before }}</span>
            <label for="dictation-answer" class="sr-only">填写听到的英文</label>
            <input
              id="dictation-answer" ref="answerInput" v-model="input" :disabled="!!checked"
              type="text" :placeholder="blank ? '填写空格' : '拼写听到的英文'"
              lang="en" autocomplete="off" autocapitalize="none" :spellcheck="false" maxlength="120"
            >
            <span v-if="blank" lang="en">{{ blank.after }}</span>
          </div>
          <p v-if="checked" class="feedback" role="status">
            {{ checked.correct ? '正确' : checked.input ? '待复习' : '已跳过' }} · <strong>{{ word.answer }}</strong> · {{ word.meaning }}
          </p>
          <p v-else-if="showAnswer || showMeaning" class="feedback" role="status">
            <strong v-if="showAnswer">{{ word.answer }} · </strong>{{ word.meaning }}
          </p>
          <p v-if="audioError" class="warning" role="status">{{ audioError }}</p>
          <div class="exercise-controls">
            <button type="button" @click="play"><i class="i-carbon-volume-up" aria-hidden="true" /> 播放词音 <kbd>Alt R</kbd></button>
            <button v-if="blank && canSpeak" type="button" @click="readSentence">朗读例句</button>
            <template v-if="!checked">
              <button type="button" :aria-pressed="showMeaning" @click="showMeaning = !showMeaning">词义 <kbd>Alt M</kbd></button>
              <button type="button" :disabled="showAnswer" @click="showAnswer = true">看答案 <kbd>Alt A</kbd></button>
              <button type="button" @click="submit(true)">跳过 <kbd>↓</kbd></button>
              <button class="confirm" type="submit" :disabled="!input.trim()">提交 <kbd>Enter</kbd></button>
            </template>
            <button v-else ref="nextButton" class="confirm" type="button" @click="nextWord">
              {{ session?.cursor === (session?.ids.length || 0) - 1 ? '查看成绩' : '下一题' }}
            </button>
          </div>
        </form>
      </template>
      <template v-else>
        <h1 id="exercise-title">{{ complete ? '本组听写完成' : '准备开始听写' }}</h1>
        <p v-if="complete" class="result" role="status">{{ session?.title }} · 答对 {{ score }} / {{ session?.ids.length }} 题</p>
        <div class="exercise-controls">
          <button v-if="wrong.length" class="confirm" type="button" @click="startReview">复习错词</button>
          <RouterLink to="/">选择词包</RouterLink>
        </div>
      </template>
      <p v-if="storageError" class="warning" role="status">当前浏览器暂时无法保存进度。</p>
    </section>
  </main>
</template>

<style scoped src="../styles/dictate.css"></style>
