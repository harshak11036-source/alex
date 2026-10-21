import { prisma } from '@/lib/prisma-edge'

export class AuditLogService {
  static async log(params: {
    institutionId: string
    userId?: string
    action: string
    entityType: string
    entityId?: string
    oldValues?: Record<string, any>
    newValues?: Record<string, any>
    ipAddress?: string
    userAgent?: string
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          institutionId: params.institutionId,
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          oldValues: params.oldValues as any,
          newValues: params.newValues as any,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      })
    } catch (error) {
      console.error('Audit log error:', error)
    }
  }

  static async getLogs(params: {
    institutionId: string
    entityType?: string
    entityId?: string
    userId?: string
    action?: string
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  }) {
    const where: any = { institutionId: params.institutionId }
    if (params.entityType) where.entityType = params.entityType
    if (params.entityId) where.entityId = params.entityId
    if (params.userId) where.userId = params.userId
    if (params.action) where.action = params.action
    if (params.startDate || params.endDate) {
      where.createdAt = {}
      if (params.startDate) where.createdAt.gte = params.startDate
      if (params.endDate) where.createdAt.lte = params.endDate
    }

    return prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit || 100,
      skip: params.offset || 0,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })
  }
}

