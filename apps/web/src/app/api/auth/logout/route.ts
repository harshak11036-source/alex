import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const response = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
  response.cookies.set('alex_local_session', '', { maxAge: 0, path: '/' })
  return response
}

