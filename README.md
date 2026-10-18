# CROSSWIRE

> **"You don't need the same language to have the same argument."**

CROSSWIRE is a real-time multilingual argument application that lets two people who don't share a language have a natural, emotionally expressive conversation — with voice, interruption, and full emotion preserved in translation.

## Features

- 🎙️ **Live voice recognition** via Web Speech API
- 🌐 **Real-time translation** via Google Gemini 2.0 Flash (server-side, secure)
- 🔊 **Speech synthesis** — hear the translated text spoken
- ⚡ **Interrupt & Speak** — stop playback mid-sentence and respond
- 💬 **Text fallback** for browsers without speech recognition
- 🔒 **Private rooms** — two participants max, Row Level Security enforced
- 📡 **Supabase Realtime** — synchronized conversation across both sessions
- 📱 **Responsive** — desktop and mobile

## Supported Languages

English, Hindi, Spanish, French, German, Portuguese, Japanese, Arabic, Chinese, Korean, Italian, Russian

---

## Prerequisites

- Node.js 18+
- npm 9+
- [Supabase](https://supabase.com) account (free tier works)
- [Google AI Studio](https://aistudio.google.com) API key for Gemini

---

## Local Development

### 1. Clone and install

```bash
git clone <your-repo-url>
cd crosswire
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
GEMINI_API_KEY=your-gemini-api-key-here
```

### 3. Set up Supabase

**Create a project** at [supabase.com](https://supabase.com).

**Run the migration** in Supabase SQL Editor:

1. Go to your project → **SQL Editor**
2. Paste and run the contents of `supabase/migrations/001_initial_schema.sql`

**Enable Realtime** (required for live messaging):

1. Go to **Database → Replication**
2. Ensure the `supabase_realtime` publication includes: `rooms`, `participants`, `messages`

**Enable Anonymous Auth**:

1. Go to **Authentication → Providers**
2. Enable **Anonymous sign-ins**

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000

---

## How it Works

1. **Person A** visits CROSSWIRE and clicks "Start an Argument" — a private room is created with a short code.
2. **Person B** joins via the invite link or room code.
3. Both participants select their **display name** and **language**.
4. Either person can speak (voice) or type. Their message is:
   - Recognized by the browser's Web Speech API
   - Sent to the server-side `/api/translate` endpoint
   - Translated by Gemini 2.0 Flash with full emotion preservation
   - Delivered to both participants via Supabase Realtime
   - Read aloud to the other participant via Speech Synthesis
5. The other participant can hit **"Interrupt & Speak"** to cut in — this immediately stops playback and lets them respond.

---

## Vercel Deployment

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial CROSSWIRE implementation"
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repository
3. Framework: **Next.js** (auto-detected)

### 3. Set Environment Variables in Vercel

In Vercel project settings → **Environment Variables**, add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `GEMINI_API_KEY` | Your Google Gemini API key |

### 4. Deploy

Click **Deploy**. Vercel will build and deploy automatically.

---

## Architecture

```
app/
  page.tsx                  ← Landing page
  room/[code]/page.tsx      ← Room page (auth + loading + state routing)
  api/translate/route.ts    ← Server-side Gemini translation endpoint
  layout.tsx / globals.css  ← Root layout + design system

components/
  ConversationRoom.tsx      ← Full real-time conversation logic
  JoinRoomModal.tsx         ← Name + language selection
  MessageList.tsx           ← Message bubbles with translation
  RoomHeader.tsx            ← Status, participant names, room code
  SpeakingPanel.tsx         ← Mic, text input, Interrupt button

lib/
  supabase.ts               ← Supabase client
  types.ts                  ← Shared TypeScript types + language list
  speech.ts                 ← SpeechSynthesis utilities with interruption
  roomCode.ts               ← Room code generation

supabase/migrations/
  001_initial_schema.sql    ← Full DB schema with RLS + triggers
```

---

## Known Limitations

### Browser Speech Recognition

- **Chrome/Edge** (desktop): Best support. Works well for all languages.
- **Safari**: Limited support. May require explicit user gesture.
- **Firefox**: `SpeechRecognition` is not supported — text fallback is used.
- **Mobile Chrome**: Works but may require HTTPS. Localhost works in development.
- **Mobile Safari**: Limited/no support — text fallback is used.

### Speech Synthesis

- Voice quality varies by OS and language.
- Some languages (e.g., Arabic, Hindi) may have limited or no voices installed on Windows.
- On mobile, audio autoplay may be blocked until user interacts with the page.

### Translation

- The Gemini free tier has rate limits. If you hit them, translation will fail with a clear error message.
- Translation latency is typically 1–3 seconds.

### Interruption

- "Interrupt & Speak" stops local playback immediately.
- The remote participant's playback is stopped when they receive a new incoming message (their browser will cancel queued speech).

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key (public) |
| `GEMINI_API_KEY` | Yes | Google Gemini API key (server-side only) |

> ⚠️ `GEMINI_API_KEY` is only used server-side in `/api/translate`. It is never exposed to the browser.
