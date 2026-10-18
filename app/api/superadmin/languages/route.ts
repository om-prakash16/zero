import { NextResponse } from 'next/server';
import { verifySuperAdmin, logAdminAction, getClientIp } from '@/lib/adminAuth';
import { SUPPORTED_LANGUAGES } from '@/lib/languages';
import type { Language } from '@/lib/types';

export async function GET(request: Request) {
  const auth = await verifySuperAdmin(request, { allowAdmin: true });
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client } = auth;

  try {
    const [disabledRes, customRes] = await Promise.all([
      client.from('platform_settings').select('value').eq('key', 'disabled_languages').maybeSingle(),
      client.from('platform_settings').select('value').eq('key', 'custom_languages').maybeSingle(),
    ]);

    const disabledCodes: string[] = (disabledRes.data?.value as string[]) || [];
    const customLanguages: Language[] = (customRes.data?.value as Language[]) || [];
    const customMap = new Map<string, Language>();
    customLanguages.forEach((l) => customMap.set(l.code, l));

    // Merge base registry with custom overrides and new languages
    const mergedList: (Language & { isEnabled: boolean; isCustom: boolean })[] = [];

    SUPPORTED_LANGUAGES.forEach((base) => {
      if (customMap.has(base.code)) {
        const custom = customMap.get(base.code)!;
        customMap.delete(base.code);
        mergedList.push({
          ...custom,
          isEnabled: !disabledCodes.includes(custom.code),
          isCustom: true,
        });
      } else {
        mergedList.push({
          ...base,
          isEnabled: !disabledCodes.includes(base.code),
          isCustom: false,
        });
      }
    });

    // Add any completely new custom languages
    customMap.forEach((newLang) => {
      mergedList.push({
        ...newLang,
        isEnabled: !disabledCodes.includes(newLang.code),
        isCustom: true,
      });
    });

    return NextResponse.json({
      success: true,
      languages: mergedList,
      totalLanguages: mergedList.length,
      enabledCount: mergedList.filter((l) => l.isEnabled).length,
      disabledCount: disabledCodes.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query languages';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client, user: adminUser } = auth;
  const ipAddress = getClientIp(request);

  let body: { language?: Language };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { language } = body;
  if (!language || !language.code?.trim() || !language.name?.trim()) {
    return NextResponse.json({ error: 'Language code and name are required' }, { status: 400 });
  }

  const code = language.code.trim().toLowerCase();
  const name = language.name.trim();
  const nativeName = language.nativeName?.trim() || name;
  const script = language.script?.trim() || 'Latin';
  const speechCode = language.speechCode?.trim() || `${code}-${code.toUpperCase()}`;

  const cleanLang: Language = {
    code,
    name,
    nativeName,
    script,
    speechCode,
    capabilities: {
      textTranslation: Boolean(language.capabilities?.textTranslation ?? true),
      speechRecognition: Boolean(language.capabilities?.speechRecognition ?? false),
      speechSynthesis: Boolean(language.capabilities?.speechSynthesis ?? false),
      verified: Boolean(language.capabilities?.verified ?? false),
    },
  };

  try {
    const { data: existing } = await client
      .from('platform_settings')
      .select('value')
      .eq('key', 'custom_languages')
      .maybeSingle();

    const customLanguages: Language[] = (existing?.value as Language[]) || [];
    const filtered = customLanguages.filter((l) => l.code !== code);
    filtered.push(cleanLang);

    const { error: upsertErr } = await client.from('platform_settings').upsert({
      key: 'custom_languages',
      value: filtered,
      description: 'Custom added or modified languages by superadmin',
      updated_at: new Date().toISOString(),
      updated_by: adminUser.id,
    });

    if (upsertErr) throw upsertErr;

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email || 'superadmin',
      action: 'language_add',
      targetEntity: 'language',
      targetId: code,
      details: { language: cleanLang },
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Language ${name} (${code}) added successfully`,
      language: cleanLang,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to add language';
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
    action?: 'toggle' | 'edit';
    languageCode?: string;
    isEnabled?: boolean;
    language?: Language;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // 1. Edit Language action
  if (body.action === 'edit' || body.language) {
    const langToEdit = body.language;
    if (!langToEdit || !langToEdit.code?.trim() || !langToEdit.name?.trim()) {
      return NextResponse.json({ error: 'Valid language object with code and name required' }, { status: 400 });
    }

    const code = langToEdit.code.trim().toLowerCase();
    const cleanLang: Language = {
      code,
      name: langToEdit.name.trim(),
      nativeName: langToEdit.nativeName?.trim() || langToEdit.name.trim(),
      script: langToEdit.script?.trim() || 'Latin',
      speechCode: langToEdit.speechCode?.trim() || `${code}-${code.toUpperCase()}`,
      capabilities: {
        textTranslation: Boolean(langToEdit.capabilities?.textTranslation ?? true),
        speechRecognition: Boolean(langToEdit.capabilities?.speechRecognition ?? false),
        speechSynthesis: Boolean(langToEdit.capabilities?.speechSynthesis ?? false),
        verified: Boolean(langToEdit.capabilities?.verified ?? false),
      },
    };

    try {
      const { data: existing } = await client
        .from('platform_settings')
        .select('value')
        .eq('key', 'custom_languages')
        .maybeSingle();

      const customLanguages: Language[] = (existing?.value as Language[]) || [];
      const filtered = customLanguages.filter((l) => l.code !== code);
      filtered.push(cleanLang);

      const { error: upsertErr } = await client.from('platform_settings').upsert({
        key: 'custom_languages',
        value: filtered,
        description: 'Custom added or modified languages by superadmin',
        updated_at: new Date().toISOString(),
        updated_by: adminUser.id,
      });

      if (upsertErr) throw upsertErr;

      await logAdminAction({
        adminId: adminUser.id,
        adminEmail: adminUser.email || 'superadmin',
        action: 'language_edit',
        targetEntity: 'language',
        targetId: code,
        details: { language: cleanLang },
        ipAddress,
      });

      return NextResponse.json({
        success: true,
        message: `Language ${cleanLang.name} updated successfully`,
        language: cleanLang,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to edit language';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // 2. Toggle Status action
  const { languageCode, isEnabled } = body;
  if (!languageCode || typeof isEnabled !== 'boolean') {
    return NextResponse.json({ error: 'languageCode and isEnabled boolean required' }, { status: 400 });
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
      details: { languageCode, isEnabled },
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Language ${languageCode} is now ${isEnabled ? 'enabled' : 'disabled'}`,
      languageCode,
      isEnabled,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update language setting';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client, user: adminUser } = auth;
  const ipAddress = getClientIp(request);
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') || '').trim().toLowerCase();

  if (!code) {
    return NextResponse.json({ error: 'Language code parameter is required' }, { status: 400 });
  }

  if (code === 'en') {
    return NextResponse.json({ error: 'Cannot delete core English language' }, { status: 400 });
  }

  try {
    const { data: existing } = await client
      .from('platform_settings')
      .select('value')
      .eq('key', 'custom_languages')
      .maybeSingle();

    const customLanguages: Language[] = (existing?.value as Language[]) || [];
    const filtered = customLanguages.filter((l) => l.code !== code);

    const { error: upsertErr } = await client.from('platform_settings').upsert({
      key: 'custom_languages',
      value: filtered,
      description: 'Custom added or modified languages by superadmin',
      updated_at: new Date().toISOString(),
      updated_by: adminUser.id,
    });

    if (upsertErr) throw upsertErr;

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email || 'superadmin',
      action: 'language_delete',
      targetEntity: 'language',
      targetId: code,
      details: { code },
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Custom language configuration for ${code} removed`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete language';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
