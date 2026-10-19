import { NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/adminAuth';
import { sendOtpEmail } from '@/lib/emailMailer';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = (body.email || '').trim().toLowerCase();

    if (!rawEmail || !rawEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    // Resolve aliases if entered
    const email =
      rawEmail === 'prakash' || rawEmail === 'admin'
        ? 'prakash.om.global@gmail.com'
        : rawEmail;

    const adminClient = getAdminSupabaseClient();

    // 1. Check if user exists in auth or profiles
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    // 2. Generate authoritative Supabase recovery OTP
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    if (linkErr) {
      if (linkErr.message.includes('not found') || linkErr.message.includes('User not found')) {
        return NextResponse.json(
          { error: 'No account found with this email address' },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: linkErr.message }, { status: 400 });
    }

    const otp = linkData?.properties?.email_otp;
    if (!otp) {
      return NextResponse.json({ error: 'Failed to generate recovery OTP' }, { status: 500 });
    }

    // 3. Send email containing ONLY numeric OTP code (No link!)
    await sendOtpEmail({
      to: email,
      otp,
      purpose: 'recovery',
    });

    return NextResponse.json({
      success: true,
      email,
      message: `8-digit recovery code sent to ${email}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to dispatch recovery code';
    console.error('Send recovery OTP error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
