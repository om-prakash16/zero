import { NextResponse } from 'next/server';
import { getAdminSupabaseClient } from '@/lib/adminAuth';
import { sendOtpEmail } from '@/lib/emailMailer';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body.email || '').trim().toLowerCase();
    const fullName = (body.fullName || '').trim();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }
    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    const adminClient = getAdminSupabaseClient();

    // 1. Check if user already exists in profiles
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in instead.' },
        { status: 409 }
      );
    }

    // 2. Generate ephemeral secret and obtain authoritative Supabase signup OTP
    const ephemeralSecret = `${crypto.randomUUID()}${Math.random().toString(36).slice(2)}!Aa9`;
    const isSuperAdmin = email === 'prakash.om.global@gmail.com';

    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'signup',
      email,
      password: ephemeralSecret,
      options: {
        data: {
          full_name: fullName,
          name: fullName,
          role: isSuperAdmin ? 'superadmin' : 'user',
        },
      },
    });

    if (linkErr) {
      if (linkErr.message.includes('already exists') || linkErr.message.includes('already registered')) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please sign in instead.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: linkErr.message }, { status: 400 });
    }

    const otp = linkData?.properties?.email_otp;
    if (!otp) {
      return NextResponse.json({ error: 'Failed to generate verification OTP' }, { status: 500 });
    }

    // 3. Send email containing ONLY numeric OTP code (No link!)
    await sendOtpEmail({
      to: email,
      otp,
      purpose: 'signup',
    });

    return NextResponse.json({
      success: true,
      message: `8-digit verification code sent to ${email}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to dispatch verification code';
    console.error('Send signup OTP error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
