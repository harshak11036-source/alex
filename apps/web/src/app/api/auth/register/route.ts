import { prisma } from '@/lib/prisma'
import { createLocalSession, LOCAL_AUTH_COOKIE, isLocalAuth } from '@/lib/local-auth'
import { hash } from 'bcryptjs'
import { NextResponse } from 'next/server'
export async function POST(request: Request) {
  if (!isLocalAuth()) return NextResponse.json({ error: 'Local auth is disabled' }, { status: 404 })
  const body = await request.json(); const email = String(body.email || '').trim().toLowerCase(); const password = String(body.password || '')
  if (!email || password.length < 8 || !body.first_name || !body.last_name) return NextResponse.json({ error: 'Name, valid email and password of at least 8 characters are required' }, { status: 400 })
  if (await prisma.user.findUnique({ where: { email } })) return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  const role = body.role === 'LECTURER' ? 'LECTURER' : 'STUDENT'; const user = await prisma.user.create({ data: { email, passwordHash: await hash(password, 12), firstName: body.first_name, lastName: body.last_name, role, isActive: true, emailVerified: new Date() } })
  const response = NextResponse.json({ ok: true }); response.cookies.set(LOCAL_AUTH_COOKIE, createLocalSession(user.id), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 }); return response
}
