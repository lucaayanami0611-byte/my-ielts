const CACHE_PREFIX = 'my-ielts'
const SHELL_CACHE = `${CACHE_PREFIX}-shell-v1`
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-v1`
const SHELL_FILES = ['./', './index.html', './manifest.webmanifest', './favicon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && ![SHELL_CACHE, RUNTIME_CACHE].includes(key))
          .map(key => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin)
    return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  if (request.headers.has('range') && /\.mp3$/i.test(url.pathname)) {
    event.respondWith(audioRangeResponse(request))
    return
  }

  if (request.headers.has('range'))
    return

  event.respondWith(cacheFirst(request))
})

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE)

  try {
    const response = await fetch(request)
    if (response.ok)
      await cache.put(request, response.clone())
    return response
  }
  catch {
    return (await cache.match(request))
      || (await caches.match('./index.html'))
      || Response.error()
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached)
    return cached

  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

async function audioRangeResponse(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const fullRequest = new Request(request.url, { credentials: 'same-origin' })
  let response = await cache.match(fullRequest)

  if (!response) {
    response = await fetch(fullRequest)
    if (!response.ok)
      return response
    await cache.put(fullRequest, response.clone())
  }

  const range = request.headers.get('range')
  const match = /^bytes=(\d+)-(\d*)$/i.exec(range || '')
  if (!match)
    return response

  const bytes = await response.arrayBuffer()
  const start = Number(match[1])
  const requestedEnd = match[2] ? Number(match[2]) : bytes.byteLength - 1
  const end = Math.min(requestedEnd, bytes.byteLength - 1)

  if (start >= bytes.byteLength || start > end) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${bytes.byteLength}` },
    })
  }

  const headers = new Headers(response.headers)
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Content-Length', String(end - start + 1))
  headers.set('Content-Range', `bytes ${start}-${end}/${bytes.byteLength}`)

  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers,
  })
}
