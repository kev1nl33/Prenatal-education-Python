import { NextRequest, NextResponse } from 'next/server';

const PYTHON_API = process.env.PYTHON_API_URL || 'http://localhost:8002';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${PYTHON_API}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status, headers: CORS_HEADERS });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'TTS proxy error';
    return NextResponse.json(
      { ok: false, error: 'TTS_PROXY_ERROR', message },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
