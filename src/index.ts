import { serve } from '@hono/node-server'
import { Hono } from 'hono'

// Load environment variables locally from .env (in production Railway injects them)
try {
  process.loadEnvFile()
} catch {
  // If .env is missing, ignore
}

const app = new Hono()

// Root route
app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// Marco Polo route checking 
app.get('/marco', (c) => {
  return c.text('polo')
})

// Telegram Webhook route (Echo bot)
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

      // Echo message back to user via Telegram Bot API
      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: userText
        })
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('Failed to send Telegram message:', errorData)
      }
    }

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
