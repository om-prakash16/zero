import { NextRequest, NextResponse } from 'next/server';

const FASTAPI_BASE_URL =
  process.env.FASTAPI_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const path = slug.join('/');
  const targetUrl = `${FASTAPI_BASE_URL}/api/speech/${path}${request.nextUrl.search}`;

  try {
    const contentType = request.headers.get('content-type') || 'application/json';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const res = await fetch(targetUrl, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    const textBody = await request.text();
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: textBody || '{}',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Speech backend connection error';
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}
