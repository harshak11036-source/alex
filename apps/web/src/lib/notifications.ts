export interface NotificationMessage {
  provider: string
  config: Record<string, any>
  recipient: string
  subject: string
  message: string
}

export interface NotificationResult {
  success: boolean
  response?: any
  error?: string
}

export class NotificationService {
  static async send(params: NotificationMessage): Promise<NotificationResult> {
    try {
      switch (params.provider.toLowerCase()) {
        case 'email':
        case 'sendgrid':
        case 'mailgun':
        case 'nodemailer':
          return await this.sendEmail(params)
        case 'sms':
        case 'twilio':
        case 'vonage':
          return await this.sendSMS(params)
        case 'whatsapp':
        case 'twilio-whatsapp':
          return await this.sendWhatsApp(params)
        case 'push':
        case 'firebase':
        case 'fcm':
          return await this.sendPush(params)
        case 'webhook':
          return await this.sendWebhook(params)
        default:
          return { success: false, error: `Unsupported provider: ${params.provider}` }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async sendEmail(params: NotificationMessage): Promise<NotificationResult> {
    const { config, recipient, subject, message } = params

    if (config.apiKey && config.fromEmail) {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipient }], subject }],
          from: { email: config.fromEmail, name: config.fromName || 'ALEX' },
          content: [{ type: 'text/plain', value: message }],
        }),
      })

      if (response.ok) {
        return { success: true, response: await response.json() }
      }
      return { success: false, error: `SendGrid error: ${response.statusText}` }
    }

    return { success: false, error: 'Email provider not configured' }
  }

  static async sendSMS(params: NotificationMessage): Promise<NotificationResult> {
    const { config, recipient, message } = params

    if (config.accountSid && config.authToken && config.fromNumber) {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: recipient,
            From: config.fromNumber,
            Body: message,
          }),
        }
      )

      if (response.ok) {
        return { success: true, response: await response.json() }
      }
      return { success: false, error: `Twilio error: ${response.statusText}` }
    }

    return { success: false, error: 'SMS provider not configured' }
  }

  static async sendWhatsApp(params: NotificationMessage): Promise<NotificationResult> {
    const { config, recipient, message } = params

    if (config.accountSid && config.authToken && config.fromNumber) {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: `whatsapp:${recipient}`,
            From: `whatsapp:${config.fromNumber}`,
            Body: message,
          }),
        }
      )

      if (response.ok) {
        return { success: true, response: await response.json() }
      }
      return { success: false, error: `Twilio WhatsApp error: ${response.statusText}` }
    }

    return { success: false, error: 'WhatsApp provider not configured' }
  }

  static async sendPush(params: NotificationMessage): Promise<NotificationResult> {
    const { config, recipient, subject, message } = params

    if (config.serverKey && recipient) {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${config.serverKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipient,
          notification: { title: subject, body: message },
        }),
      })

      if (response.ok) {
        return { success: true, response: await response.json() }
      }
      return { success: false, error: `FCM error: ${response.statusText}` }
    }

    return { success: false, error: 'Push provider not configured' }
  }

  static async sendWebhook(params: NotificationMessage): Promise<NotificationResult> {
    const { config, subject, message } = params

    if (config.url) {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, timestamp: new Date().toISOString() }),
      })

      if (response.ok) {
        return { success: true, response: await response.json() }
      }
      return { success: false, error: `Webhook error: ${response.statusText}` }
    }

    return { success: false, error: 'Webhook not configured' }
  }
}

