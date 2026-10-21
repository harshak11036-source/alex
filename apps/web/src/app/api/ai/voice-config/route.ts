import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { decrypt } from '@/lib/encryption'

export async function GET() {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const voiceCreds = await prisma.aICredential.findFirst({
      where: {
        userId: user.id,
        provider: 'OTHER',
        providerName: { in: ['elevenlabs', 'openai-tts', 'google-stt'] },
        isActive: true,
      },
    })

    if (!voiceCreds) {
      return NextResponse.json({
        sttProvider: 'browser',
        ttsProvider: 'browser',
        defaultLanguage: 'en-US',
      })
    }

    const apiKey = await decrypt(voiceCreds.encryptedKey)

    let sttProvider = 'browser'
    let ttsProvider = 'browser'

    if (voiceCreds.providerName === 'elevenlabs') {
      ttsProvider = 'elevenlabs'
    } else if (voiceCreds.providerName === 'openai-tts') {
      ttsProvider = 'openai-tts'
    } else if (voiceCreds.providerName === 'google-stt') {
      sttProvider = 'google-stt'
    }

    return NextResponse.json({
      sttProvider,
      ttsProvider,
      sttApiKey: voiceCreds.providerName === 'google-stt' ? apiKey : undefined,
      ttsApiKey: ['elevenlabs', 'openai-tts'].includes(voiceCreds.providerName) ? apiKey : undefined,
      defaultLanguage: 'en-US',
    })
  } catch (error) {
    console.error('Voice config error:', error)
    return NextResponse.json({ error: 'Failed to get voice config' }, { status: 500 })
  }
}