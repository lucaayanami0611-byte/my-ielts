<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { resolveAssetUrl } from '~/composables/assets'
import { filteredWords, keywordPack, missedWords, packs, readProgress, startSession } from '~/dictation'
import type { DictationWord, Pack, WordFilter } from '~/dictation'

const router = useRouter()
const progress = readProgress()
const current = progress.session
const inProgress = current && current.cursor < current.ids.length
const correctCount = Object.values(progress.results).filter(Boolean).length
const keywordCorrect = keywordPack.words.filter(item => progress.results[item.id] === true).length
const wrong = missedWords(progress)
const query = ref('')
const filter = ref<WordFilter>('all')
const roundSize = ref(10)
const expanded = ref(false)
const scenery = resolveAssetUrl('study/station.webp')

const typeOptions: { key: WordFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'word', label: '单词' },
  { key: 'phrase', label: '词组' },
]
const references = [
  { title: '词汇跟打', to: '/vocabulary/typing' },
  { title: '语法课程', to: '/grammar' },
  { title: '听力技巧', to: '/listening' },
  { title: '阅读同义词', to: '/reading' },
  { title: '写作翻译', to: '/writing' },
]
const packIcons = [
  'i-carbon-headphones', 'i-carbon-earth', 'i-carbon-tree', 'i-carbon-map-boundary-vegetation',
  'i-carbon-rocket', 'i-carbon-education', 'i-carbon-chip', 'i-carbon-catalog',
  'i-carbon-translate', 'i-carbon-basketball', 'i-carbon-cube', 'i-carbon-shopping-bag',
  'i-carbon-restaurant', 'i-carbon-building', 'i-carbon-train', 'i-carbon-flag',
  'i-carbon-finance', 'i-carbon-document', 'i-carbon-security', 'i-carbon-group',
  'i-carbon-activity', 'i-carbon-health-cross', 'i-carbon-calendar',
]
const libraryPacks = computed(() => packs
  .map((pack, index) => ({ pack, icon: packIcons[index], tone: index % 4, words: filteredWords(pack, filter.value) }))
  .filter(item => item.words.length && item.pack.title.toLowerCase().includes(query.value.trim().toLowerCase()))
  .map(item => ({ ...item, known: item.words.filter(word => progress.results[word.id] === true).length })))
const visiblePacks = computed(() => expanded.value || query.value.trim() ? libraryPacks.value : libraryPacks.value.slice(0, 9))

function begin(title: string, words: DictationWord[]) {
  if (startSession(progress, title, words, roundSize.value))
    void router.push('/dictate')
}

function beginPack(pack: Pack) {
  begin(pack.title, filteredWords(pack, filter.value))
}
</script>

<template>
  <main class="study">
    <section aria-labelledby="current-title">
      <div class="section-title current-title">
        <h1 id="current-title">{{ inProgress ? '继续听写' : '开始听写' }}</h1>
        <span v-if="wrong.length">{{ wrong.length }} 个词待复习</span>
      </div>
      <div class="current-card">
        <div class="cover">
          <img :src="scenery" alt="" fetchpriority="high">
        </div>
        <div class="current-info">
          <h2>{{ inProgress ? current?.title : keywordPack.title }}</h2>
          <p>{{ inProgress ? '接着上次的位置继续练。' : '从常见听力词汇开始，结合例句练拼写。' }}</p>
          <div class="current-progress">
            <span>{{ inProgress ? '本组进度' : '考点词掌握进度' }}</span>
            <strong>
              {{ inProgress ? current?.answers.length : keywordCorrect }}
              / {{ inProgress ? current?.ids.length : keywordPack.words.length }}
            </strong>
          </div>
          <progress
            :value="inProgress ? current?.answers.length : keywordCorrect"
            :max="inProgress ? current?.ids.length : keywordPack.words.length"
            aria-label="词包进度"
          />
        </div>
        <div class="current-actions">
          <div class="current-count">
            <span>已答对词条</span>
            <strong>{{ correctCount }}</strong>
          </div>
          <RouterLink v-if="inProgress" class="start-button" to="/dictate">
            继续听写 <span aria-hidden="true">→</span>
          </RouterLink>
          <button v-else class="start-button" type="button" @click="beginPack(keywordPack)">
            开始听写 <span aria-hidden="true">→</span>
          </button>
          <button v-if="wrong.length" class="review-button" type="button" @click="begin('错词复习', wrong)">
            复习错词
          </button>
        </div>
      </div>
    </section>

    <section class="library" aria-labelledby="library-title">
      <div class="section-title">
        <h2 id="library-title">场景词库</h2>
        <label class="round-size">
          每组题量
          <select v-model.number="roundSize">
            <option :value="10">10 题</option>
            <option :value="20">20 题</option>
            <option :value="30">30 题</option>
          </select>
        </label>
      </div>
      <div class="filters">
        <div class="segments" role="group" aria-label="听写内容">
          <button
            v-for="option in typeOptions" :key="option.key" type="button"
            :aria-pressed="filter === option.key" @click="filter = option.key"
          >
            {{ option.label }}
          </button>
        </div>
        <label class="search">
          <i class="i-carbon-search" aria-hidden="true" />
          <span class="sr-only">搜索词包</span>
          <input v-model="query" type="search" placeholder="搜索主题，例如交通">
        </label>
      </div>
      <p v-if="!visiblePacks.length" class="empty" role="status">没有匹配的词包。</p>
      <ul v-else class="pack-grid">
        <li v-for="item in visiblePacks" :key="item.pack.id">
          <button type="button" class="pack" @click="begin(item.pack.title, item.words)">
            <span class="pack-art" :data-tone="item.tone" aria-hidden="true"><i :class="item.icon" /></span>
            <span class="pack-content">
              <strong>{{ item.pack.title }}</strong>
              <span>{{ item.words.length }} 个词条</span>
              <span v-if="item.known" class="pack-progress">已答对 {{ item.known }} / {{ item.words.length }}</span>
            </span>
            <span class="pack-arrow" aria-hidden="true">↗</span>
          </button>
        </li>
      </ul>
      <button
        v-if="!query.trim() && libraryPacks.length > 9" type="button" class="all-packs"
        :aria-expanded="expanded" @click="expanded = !expanded"
      >
        {{ expanded ? '收起词包' : `查看全部 ${libraryPacks.length} 个词包` }}
      </button>
    </section>

    <nav class="references" aria-label="备考资料">
      <RouterLink v-for="resource in references" :key="resource.to" :to="resource.to">{{ resource.title }}</RouterLink>
    </nav>
  </main>
</template>

<style scoped src="../styles/study.css"></style>
