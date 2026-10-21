import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@neondatabase/serverless'

const neon = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ driverAdapter: neon })

export { prisma }

