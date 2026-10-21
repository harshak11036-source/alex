import { createServerClientSupabase } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerClientSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configs = await prisma.aIModelConfig.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error('AI model configs fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch model configs' }, { status: 500 })
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
    const { provider, modelId, taskType, isDefault, parameters } = body

    if (!provider || !modelId || !taskType) {
      return NextResponse.json({ error: 'Provider, modelId, and taskType are required' }, { status: 400 })
    }

    // If setting as default, unset other defaults for this task type
    if (isDefault) {
      await prisma.aIModelConfig.updateMany({
        where: { userId: user.id, taskType, isDefault: true },
        data: { isDefault: false },
      })
    }

    const config = await prisma.aIModelConfig.upsert({
      where: {
        userId_provider_modelId_taskType: {
          userId: user.id,
          provider: provider as any,
          modelId,
          taskType,
        },
      },
      update: {
        isDefault: isDefault || false,
        parameters: parameters || {},
      },
      create: {
        userId: user.id,
        provider: provider as any,
        modelId,
        taskType,
        isDefault: isDefault || false,
        parameters: parameters || {},
      },
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error('AI model config create error:', error)
    return NextResponse.json({ error: 'Failed to create model config' }, { status: 500 })
  }
}