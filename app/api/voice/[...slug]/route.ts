import { NextRequest, NextResponse } from 'next/server';

const FASTAPI_BASE_URL =
  process.env.FASTAPI_BACKEND_URL || 'http://127.0.0.1:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const path = slug.join('/');
  const targetUrl = `${FASTAPI_BASE_URL}/api/voice/${path}${request.nextUrl.search}`;

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      cache: 'no-store',
    });
    const contentType = res.headers.get('content-type') || 'application/json';
    if (contentType.includes('audio')) {
      const audioBuffer = await res.arrayBuffer();
      return new NextResponse(audioBuffer, {
        status: res.status,
        headers: {
          'Content-Type': contentType,
          'Content-Length': res.headers.get('content-length') || String(audioBuffer.byteLength),
        },
      });
    }
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Voice backend connection error';
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const path = slug.join('/');
  const targetUrl = `${FASTAPI_BASE_URL}/api/voice/${path}${request.nextUrl.search}`;

  try {
    const body = await request.text();
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body || '{}',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Voice backend connection error';
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}
