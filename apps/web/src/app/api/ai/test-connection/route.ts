import { createServerClientSupabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { provider, apiKey, model } = body

    if (!provider || !apiKey) {
      return NextResponse.json({ error: 'Provider and API key are required' }, { status: 400 })
    }

    let response: string
    let success = false

    switch (provider) {
      case 'OPENAI': {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model || 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Hello, respond with "OK" if you can hear me.' }],
            max_tokens: 10,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          response = data.choices[0]?.message?.content || 'OK'
          success = true
        } else {
          response = `OpenAI error: ${res.status} ${res.statusText}`
        }
        break
      }

      case 'GOOGLE_GEMINI': {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: 'Hello, respond with "OK" if you can hear me.' }] }],
              generationConfig: { maxOutputTokens: 10 },
            }),
          }
        )
        if (res.ok) {
          const data = await res.json()
          response = data.candidates[0]?.content?.parts[0]?.text || 'OK'
          success = true
        } else {
          response = `Gemini error: ${res.status} ${res.statusText}`
        }
        break
      }

      case 'ANTHROPIC': {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: model || 'claude-3-5-sonnet-20241022',
            messages: [{ role: 'user', content: 'Hello, respond with "OK" if you can hear me.' }],
            max_tokens: 10,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          response = data.content[0]?.text || 'OK'
          success = true
        } else {
          response = `Anthropic error: ${res.status} ${res.statusText}`
        }
        break
      }

      case 'NVIDIA_NEMOTRON': {
        const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model || 'nvidia/nemotron-3-ultra',
            messages: [{ role: 'user', content: 'Hello, respond with "OK" if you can hear me.' }],
            max_tokens: 10,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          response = data.choices[0]?.message?.content || 'OK'
          success = true
        } else {
          response = `Nemotron error: ${res.status} ${res.statusText}`
        }
        break
      }

      case 'GROQ': {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model || 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: 'Hello, respond with "OK" if you can hear me.' }],
            max_tokens: 10,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          response = data.choices[0]?.message?.content || 'OK'
          success = true
        } else {
          response = `Groq error: ${res.status} ${res.statusText}`
        }
        break
      }

      case 'MISTRAL': {
        const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model || 'mistral-small-latest',
            messages: [{ role: 'user', content: 'Hello, respond with "OK" if you can hear me.' }],
            max_tokens: 10,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          response = data.choices[0]?.message?.content || 'OK'
          success = true
        } else {
          response = `Mistral error: ${res.status} ${res.statusText}`
        }
        break
      }

      case 'OPENROUTER': {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://alex.app',
            'X-Title': 'ALEX',
          },
          body: JSON.stringify({
            model: model || 'openrouter/auto',
            messages: [{ role: 'user', content: 'Hello, respond with "OK" if you can hear me.' }],
            max_tokens: 10,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          response = data.choices[0]?.message?.content || 'OK'
          success = true
        } else {
          response = `OpenRouter error: ${res.status} ${res.statusText}`
        }
        break
      }

      case 'TOGETHER_AI': {
        const res = await fetch('https://api.together.xyz/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model || 'meta-llama/Meta-Llama-3.1-70B-Instruct',
            messages: [{ role: 'user', content: 'Hello, respond with "OK" if you can hear me.' }],
            max_tokens: 10,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          response = data.choices[0]?.message?.content || 'OK'
          success = true
        } else {
          response = `Together AI error: ${res.status} ${res.statusText}`
        }
        break
      }

      default:
        return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 })
    }

    return NextResponse.json({ success, response: response.slice(0, 500) })
  } catch (error) {
    console.error('AI test connection error:', error)
    return NextResponse.json({ error: 'Connection test failed', success: false }, { status: 500 })
  }
}