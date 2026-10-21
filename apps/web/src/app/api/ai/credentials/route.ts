import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { encrypt } from '@/lib/encryption'
import { generateKeyHash } from '@/lib/encryption'

export async function GET() {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const credentials = await prisma.aICredential.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    })

    // Don't return the actual encrypted keys
    const safeCredentials = credentials.map(c => ({
      id: c.id,
      provider: c.provider,
      providerName: c.providerName,
      isActive: c.isActive,
      isDefault: c.isDefault,
      models: c.models || [],
      usageLimit: c.usageLimit,
      usageCount: c.usageCount,
      lastUsedAt: c.lastUsedAt,
      createdAt: c.createdAt,
    }))

    return NextResponse.json(safeCredentials)
  } catch (error) {
    console.error('AI credentials fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { provider, providerName, apiKey, models, isDefault, usageLimit } = body

    if (!provider || !apiKey) {
      return NextResponse.json({ error: 'Provider and API key are required' }, { status: 400 })
    }

    // If setting as default, unset other defaults for this provider
    if (isDefault) {
      await prisma.aICredential.updateMany({
        where: { userId: user.id, provider: provider as any, isDefault: true },
        data: { isDefault: false },
      })
    }

    const encryptedKey = await encrypt(apiKey)
    const keyHash = generateKeyHash(apiKey)

    const credential = await prisma.aICredential.create({
      data: {
        userId: user.id,
        provider: provider as any,
        providerName: providerName || provider,
        encryptedKey,
        keyHash,
        models: models || [],
        isDefault: isDefault || false,
        usageLimit,
        isActive: true,
      },
    })

    return NextResponse.json({
      id: credential.id,
      provider: credential.provider,
      providerName: credential.providerName,
      isActive: credential.isActive,
      isDefault: credential.isDefault,
      models: credential.models,
      usageLimit: credential.usageLimit,
      usageCount: credential.usageCount,
      createdAt: credential.createdAt,
    })
  } catch (error) {
    console.error('AI credential create error:', error)
    return NextResponse.json({ error: 'Failed to create credential' }, { status: 500 })
  }
}