import { prisma } from '@/lib/prisma'
import { createLocalSession, LOCAL_AUTH_COOKIE, isLocalAuth } from '@/lib/local-auth'
import { compare } from 'bcryptjs'
import { NextResponse } from 'next/server'
export async function POST(request: Request) {
  try {
    if (!isLocalAuth()) return NextResponse.json({ error: 'Local auth is disabled' }, { status: 404 })
    const { email, password } = await request.json()
    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } })
    if (!user || !user.isActive || !user.passwordHash || !(await compare(String(password), user.passwordHash))) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    const response = NextResponse.json({ ok: true }); response.cookies.set(LOCAL_AUTH_COOKIE, createLocalSession(user.id), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 }); return response
  } catch (error) {
    console.error('Local login database error:', error)
    return NextResponse.json({ error: 'Database unavailable. Start PostgreSQL and run the ALEX database setup first.' }, { status: 503 })
  }
}
