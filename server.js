import 'dotenv/config'
import express from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(express.json())

// Serve the built frontend (npm run build) so the app can run as a single server
const distDir = path.join(__dirname, 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
}

const PORT = process.env.PORT || 3001
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY

async function searchSerpApi(topic, apiKey) {
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', topic)
  // NOTE: Google discontinued the `num` parameter, so SerpApi no longer honors it
  // on the standard google engine (it can error or return inconsistent counts).
  // We simply take the default page of organic results and slice what we need.
  url.searchParams.set('api_key', apiKey)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`SerpAPI error: ${res.status} ${await res.text()}`)
  const data = await res.json()

  if (data.error) throw new Error(`SerpAPI error: ${data.error}`)

  const results = (data.organic_results || []).slice(0, 8).map(r => ({
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

async function writeArticle(topic, search, apiKey) {
  const context = [
    search.answerBox ? `Answer box: ${search.answerBox.title} — ${search.answerBox.answer}` : null,
    ...search.results.map((r, i) => `[${i + 1}] ${r.title} (${r.source})\n${r.snippet}\nURL: ${r.link}`)
  ].filter(Boolean).join('\n\n')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      // GPT-5-class models are reasoning models: the legacy
      // `response_format: { type: 'json_object' }` is unreliable here. The current
      // documented path is a strict json_schema, which forces the model to return
      // exactly this shape so JSON.parse never fails.
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'newspaper_article',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['headline', 'subheadline', 'dateline', 'article', 'pull_quote'],
            properties: {
              headline: { type: 'string', description: 'Short, punchy, uppercase-friendly' },
              subheadline: { type: 'string', description: 'One-sentence deck' },
              dateline: { type: 'string', description: 'e.g. "NEW YORK — By Wire Service"' },
              article: {
                type: 'array',
                description: '4-6 paragraphs',
                items: { type: 'string' }
              },
              pull_quote: { type: 'string', description: 'One striking sentence from the story' }
            }
          }
        }
      },
      messages: [
        {
          role: 'system',
          content: `You are a 1920s newspaper journalist writing for "THE DAILY DISPATCH". Given a topic and fresh web search results, write a newspaper front-page piece in period style — authoritative, vivid, slightly dramatic, but factually grounded ONLY in the provided search results.`
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
  const message = data.choices?.[0]?.message
  if (message?.refusal) throw new Error(`OpenAI refused the request: ${message.refusal}`)
  if (!message?.content) throw new Error('OpenAI returned an empty response.')
  return JSON.parse(message.content)
}

app.post('/api/research', async (req, res) => {
  const topic = (req.body?.topic || '').trim()
  if (!topic) return res.status(400).json({ error: 'Please provide a topic.' })
  // Keys supplied from the sidebar take precedence over server .env keys
  const openaiKey = (req.body?.openaiKey || '').trim() || OPENAI_API_KEY
  const serpapiKey = (req.body?.serpapiKey || '').trim() || SERPAPI_API_KEY

  if (!openaiKey || !serpapiKey) {
    return res.status(400).json({ error: 'Missing API keys. Enter your OpenAI and SerpAPI keys in the Print Shop sidebar (or set them in .env on the server).' })
  }

  try {
    const search = await searchSerpApi(topic, serpapiKey)
    const article = await writeArticle(topic, search, openaiKey)
    res.json({ ...article, sources: search.results.slice(0, 5) })
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`)
})
