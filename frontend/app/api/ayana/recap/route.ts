import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_BACKEND_BASE_URL = 'http://127.0.0.1:8000'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const backendBaseUrl =
    process.env.AYANA_BACKEND_BASE_URL?.replace(/\/$/, '') ??
    DEFAULT_BACKEND_BASE_URL

  try {
    const response = await fetch(`${backendBaseUrl}/api/ayana/recap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
    })

    const responseText = await response.text()
    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        'Content-Type':
          response.headers.get('content-type') ?? 'application/json',
      },
    })
  } catch {
    return NextResponse.json(
      { detail: 'Unable to reach the Ayana backend.' },
      { status: 502 }
    )
  }
}
