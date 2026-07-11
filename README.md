# 🗞️ The Daily Dispatch — Retro Newspaper AI Search

Enter a topic and get a 1920s-style newspaper front page about it. The app searches the web with **SerpAPI** and writes the article with OpenAI's **gpt-5.4-mini**.

Built with **Vite** (vanilla JS) + a small **Express** API server that keeps your API keys off the client.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure API keys — either way works:

   - **In the app:** enter your [OpenAI API key](https://platform.openai.com/api-keys) and [SerpAPI key](https://serpapi.com/manage-api-key) in the **Print Shop** sidebar. They're stored in your browser's localStorage and sent with each request. Sidebar keys take precedence.
   - **On the server:** `cp .env.example .env` and fill in the keys there as a fallback.

3. Run the app (starts the API server and Vite dev server together):

   ```bash
   npm run dev
   ```

   Open http://localhost:5173

## How it works

1. You wire a topic in from the **Telegraph Desk**.
2. `POST /api/research` hits SerpAPI (Google engine) for fresh results.
3. The results are handed to `gpt-5.4-mini`, which writes a period-style front-page article (headline, deck, dateline, pull quote, paragraphs) as JSON.
4. The front page renders with a drop cap, two-column layout, and source links from the wire.
