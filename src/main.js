import './style.css'

const app = document.querySelector('#app')

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})

app.innerHTML = `
  <div class="layout">
  <aside class="sidebar">
    <h2 class="sidebar-title">The Print Shop</h2>
    <p class="sidebar-note">Furnish your own credentials, and the presses shall run on your account.</p>

    <label class="sidebar-label" for="openai-key">OPENAI KEY</label>
    <input id="openai-key" class="sidebar-input" type="password" placeholder="sk-..." autocomplete="off" />

    <label class="sidebar-label" for="serpapi-key">SERPAPI KEY</label>
    <input id="serpapi-key" class="sidebar-input" type="password" placeholder="Your SerpAPI key" autocomplete="off" />

    <button id="save-keys" class="sidebar-btn">SET THE TYPE</button>
    <button id="clear-keys" class="sidebar-btn sidebar-btn-secondary">CLEAR</button>
    <p id="keys-status" class="sidebar-status"></p>
    <p class="sidebar-fineprint">Keys are kept in your browser only (localStorage) and sent with each dispatch.</p>
  </aside>
  <div class="paper">
    <header class="masthead">
      <div class="masthead-top">
        <span>VOL. CXVII — No. 42</span>
        <span>${today.toUpperCase()}</span>
        <span>PRICE: TWO CENTS</span>
      </div>
      <h1 class="masthead-title">The Daily Dispatch</h1>
      <div class="masthead-motto">"ALL THE NEWS THE WIRE CAN CARRY" &mdash; POWERED BY GPT-5.4-MINI &amp; SERPAPI</div>
    </header>

    <section class="telegraph-desk">
      <h2 class="desk-heading">✦ TELEGRAPH DESK ✦</h2>
      <p class="desk-note">Wire us a topic, and our correspondents shall scour the globe for the latest intelligence.</p>
      <form id="topic-form" class="topic-form">
        <input
          id="topic-input"
          type="text"
          placeholder="e.g. The future of electric motorcars…"
          autocomplete="off"
          required
        />
        <button type="submit" id="submit-btn">DISPATCH!</button>
      </form>
    </section>

    <section id="result" class="result hidden"></section>

    <footer class="footer">
      ESTABLISHED 1909 &bull; PRINTED ON RECYCLED ELECTRONS &bull; THE DAILY DISPATCH CO.
    </footer>
  </div>
  </div>
`

const openaiKeyInput = document.querySelector('#openai-key')
const serpapiKeyInput = document.querySelector('#serpapi-key')
const saveKeysBtn = document.querySelector('#save-keys')
const clearKeysBtn = document.querySelector('#clear-keys')
const keysStatus = document.querySelector('#keys-status')

openaiKeyInput.value = localStorage.getItem('openaiKey') || ''
serpapiKeyInput.value = localStorage.getItem('serpapiKey') || ''
if (openaiKeyInput.value || serpapiKeyInput.value) keysStatus.textContent = '✓ Keys on file'

saveKeysBtn.addEventListener('click', () => {
  localStorage.setItem('openaiKey', openaiKeyInput.value.trim())
  localStorage.setItem('serpapiKey', serpapiKeyInput.value.trim())
  keysStatus.textContent = '✓ Keys set in type'
})

clearKeysBtn.addEventListener('click', () => {
  localStorage.removeItem('openaiKey')
  localStorage.removeItem('serpapiKey')
  openaiKeyInput.value = ''
  serpapiKeyInput.value = ''
  keysStatus.textContent = 'Keys cleared'
})

const form = document.querySelector('#topic-form')
const input = document.querySelector('#topic-input')
const button = document.querySelector('#submit-btn')
const result = document.querySelector('#result')

const esc = s =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

form.addEventListener('submit', async e => {
  e.preventDefault()
  const topic = input.value.trim()
  if (!topic) return

  button.disabled = true
  button.textContent = 'WIRING…'
  result.classList.remove('hidden')
  result.innerHTML = `
    <div class="loading">
      <div class="loading-spinner">✳</div>
      <p>STOP THE PRESSES &mdash; our correspondents are on the wire&hellip;</p>
    </div>
  `

  try {
    const res = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        openaiKey: openaiKeyInput.value.trim(),
        serpapiKey: serpapiKeyInput.value.trim()
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Unknown error')
    renderArticle(data)
  } catch (err) {
    result.innerHTML = `
      <div class="error-box">
        <h3>PRINTING PRESS JAMMED!</h3>
        <p>${esc(err.message)}</p>
      </div>
    `
  } finally {
    button.disabled = false
    button.textContent = 'DISPATCH!'
  }
})

function renderArticle(data) {
  const paragraphs = (data.article || []).map(p => `<p>${esc(p)}</p>`).join('')
  const sources = (data.sources || [])
    .map(s => `<li><a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.title)}</a> <span class="source-name">&mdash; ${esc(s.source || 'wire report')}</span></li>`)
    .join('')

  result.innerHTML = `
    <hr class="double-rule" />
    <h2 class="headline">${esc(data.headline || '')}</h2>
    <h3 class="subheadline">${esc(data.subheadline || '')}</h3>
    <div class="dateline">${esc(data.dateline || '')}</div>
    <div class="article-body">
      ${data.pull_quote ? `<blockquote class="pull-quote">&ldquo;${esc(data.pull_quote)}&rdquo;</blockquote>` : ''}
      ${paragraphs}
    </div>
    ${sources ? `
      <div class="sources">
        <h4>&mdash; SOURCES FROM THE WIRE &mdash;</h4>
        <ul>${sources}</ul>
      </div>` : ''}
  `
  result.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
