import 'dotenv/config'
import express from 'express'

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3001
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY

async function searchSerpApi(topic) {
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', topic)
  url.searchParams.set('num', '8')
  url.searchParams.set('api_key', SERPAPI_API_KEY)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`SerpAPI error: ${res.status} ${await res.text()}`)
  const data = await res.json()

  const results = (data.organic_results || []).map(r => ({
    title: r.title,
    link: r.link,
    snippet: r.snippet || '',
    source: r.source || ''
  }))

  const answerBox = data.answer_box
    ? { title: data.answer_box.title || '', answer: data.answer_box.answer || data.answer_box.snippet || '' }
    : null

  return { results, answerBox }
}

async function writeArticle(topic, search) {
  const context = [
    search.answerBox ? `Answer box: ${search.answerBox.title} — ${search.answerBox.answer}` : null,
    ...search.results.map((r, i) => `[${i + 1}] ${r.title} (${r.source})\n${r.snippet}\nURL: ${r.link}`)
  ].filter(Boolean).join('\n\n')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a 1920s newspaper journalist writing for "THE DAILY DISPATCH". Given a topic and fresh web search results, write a newspaper front-page piece in period style — authoritative, vivid, slightly dramatic, but factually grounded ONLY in the provided search results. Respond with JSON: {"headline": string (short, punchy, uppercase-friendly), "subheadline": string (one-sentence deck), "dateline": string (e.g. "NEW YORK — By Wire Service"), "article": string[] (4-6 paragraphs), "pull_quote": string (one striking sentence from the story)}.`
        },
        {
          role: 'user',
          content: `Topic: ${topic}\n\nSearch results:\n${context}`
        }
      ]
    })
  })
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

app.post('/api/research', async (req, res) => {
  const topic = (req.body?.topic || '').trim()
  if (!topic) return res.status(400).json({ error: 'Please provide a topic.' })
  if (!OPENAI_API_KEY || !SERPAPI_API_KEY) {
    return res.status(500).json({ error: 'Server missing OPENAI_API_KEY or SERPAPI_API_KEY. See .env.example.' })
  }

  try {
    const search = await searchSerpApi(topic)
    const article = await writeArticle(topic, search)
    res.json({ ...article, sources: search.results.slice(0, 5) })
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`)
})
