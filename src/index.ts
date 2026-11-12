import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { GoogleGenAI } from '@google/genai'

// Load environment variables locally from .env (in production Railway injects them)
try {
  process.loadEnvFile()
} catch {
  // If .env is missing, ignore
}

// Helper to generate AI response from Gemini using official SDK
async function generateAiReply(userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const ai = new GoogleGenAI({ apiKey })
  const models = ['gemini-3.5-flash', 'gemini-3.5-flash-lite']
  let lastError: any = null

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: userPrompt
      })
      if (response?.text) {
        return response.text
      }
    } catch (err: any) {
      console.warn(`Model ${model} failed:`, err?.message || err)
      lastError = err
    }
  }

  throw lastError || new Error('All Gemini models were unavailable')
}

// Helper to send message to Telegram
async function sendTelegramMessage(botToken: string, chatId: number | string, text: string) {
  // Truncate to stay safely within Telegram's 4096-character limit
  const safeText = text.length > 4000 ? text.slice(0, 4000) + '...' : text

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: safeText
    })
  })

  if (!response.ok) {
    const errorData = await response.text()
    console.error('Failed to send Telegram message:', errorData)
  }
}

const app = new Hono()

// Root route
app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// Marco Polo route
app.get('/marco', (c) => {
  return c.text('polo')
})

// Telegram Webhook route (AI Bot)
app.post('/webhook', async (c) => {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  const botToken = process.env.TELEGRAM_BOT_TOKEN

  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN is not configured')
    return c.json({ ok: false, error: 'Server misconfigured' }, 500)
  }

  // Validate Telegram secret token if configured
  if (expectedSecret) {
    const receivedSecret = c.req.header('x-telegram-bot-api-secret-token')
    if (receivedSecret !== expectedSecret) {
      console.warn('Unauthorized webhook request: secret token mismatch')
      return c.json({ ok: false, error: 'Unauthorized' }, 401)
    }
  }

  try {
    const update = await c.req.json()

    // Check if the update contains a text message
    if (update?.message?.text && update?.message?.chat?.id) {
      const chatId = update.message.chat.id
      const userText = update.message.text

      // Send immediate "typing..." status so user knows bot is thinking
      fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' })
      }).catch(() => {})

      // Process AI response asynchronously to prevent Telegram webhook timeout
      ;(async () => {
        try {
          const replyText = await generateAiReply(userText)
          await sendTelegramMessage(botToken, chatId, replyText)
        } catch (aiErr) {
          console.error('AI generation error:', aiErr)
          await sendTelegramMessage(
            botToken,
            chatId,
            "Sorry, I had trouble generating a reply. Please try asking again in a moment!"
          )
        }
      })()
    }

    // Acknowledge Telegram immediately with 200 OK
    return c.json({ ok: true })
  } catch (err) {
    console.error('Error handling webhook update:', err)
    return c.json({ ok: false, error: 'Bad request' }, 400)
  }
})

// Helper route to register the webhook with Telegram
app.get('/webhook/set', async (c) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  const customUrl = c.req.query('url')

  if (!botToken) {
    return c.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' }, 500)
  }

  const host = c.req.header('host')
  const protocol = c.req.header('x-forwarded-proto') || 'https'
  const webhookUrl = customUrl || `${protocol}://${host}/webhook`

  const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret
    })
  })

  const result = await response.json()
  return c.json({
    configuredWebhookUrl: webhookUrl,
    telegramResponse: result
  })
})

// Helper route to inspect current Telegram webhook status
app.get('/webhook/info', async (c) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return c.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' }, 500)
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
  const result = await response.json()
  return c.json(result)
})

export default app

const port = Number(process.env.PORT) || 3000

serve({
  fetch: app.fetch,
  port
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
