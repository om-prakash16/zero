import { NextResponse } from 'next/server';
import { verifySuperAdmin, logAdminAction, getClientIp } from '@/lib/adminAuth';
import { SUPPORTED_LANGUAGES } from '@/lib/languages';

export async function GET(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client } = auth;

  try {
    const { data: setting } = await client
      .from('platform_settings')
      .select('value')
      .eq('key', 'disabled_languages')
      .maybeSingle();

    const disabledCodes: string[] = (setting?.value as string[]) || [];

    const languages = SUPPORTED_LANGUAGES.map((lang) => ({
      ...lang,
      isEnabled: !disabledCodes.includes(lang.code),
    }));

    return NextResponse.json({
      success: true,
      languages,
      totalLanguages: languages.length,
      enabledCount: languages.filter((l) => l.isEnabled).length,
      disabledCount: disabledCodes.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query languages';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client, user: adminUser } = auth;
  const ipAddress = getClientIp(request);

  let body: {
    languageCode?: string;
    isEnabled?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { languageCode, isEnabled } = body;
  if (!languageCode || typeof isEnabled !== 'boolean') {
    return NextResponse.json({ error: 'languageCode and isEnabled boolean required' }, { status: 400 });
  }

  // Verify language exists in registry
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === languageCode);
  if (!lang) {
    return NextResponse.json({ error: `Language code "${languageCode}" not found in registry` }, { status: 404 });
  }

  // Prevent disabling default English fallback
  if (languageCode === 'en' && !isEnabled) {
    return NextResponse.json({ error: 'Cannot disable default fallback language (English)' }, { status: 400 });
  }

  try {
    const { data: existing } = await client
      .from('platform_settings')
      .select('value')
      .eq('key', 'disabled_languages')
      .maybeSingle();

    let disabled: string[] = (existing?.value as string[]) || [];

    if (isEnabled) {
      disabled = disabled.filter((c) => c !== languageCode);
    } else {
      if (!disabled.includes(languageCode)) {
        disabled.push(languageCode);
      }
    }

    const { error: upsertErr } = await client.from('platform_settings').upsert({
      key: 'disabled_languages',
      value: disabled,
      description: 'List of language codes disabled by superadmin',
      updated_at: new Date().toISOString(),
      updated_by: adminUser.id,
    });

    if (upsertErr) throw upsertErr;

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email || 'superadmin',
      action: isEnabled ? 'language_enable' : 'language_disable',
      targetEntity: 'language',
      targetId: languageCode,
      details: { languageName: lang.name, isEnabled },
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Language ${lang.name} is now ${isEnabled ? 'enabled' : 'disabled'}`,
      languageCode,
      isEnabled,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update language setting';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
