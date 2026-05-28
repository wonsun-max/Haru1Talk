# 🌙 Haru Talk (하루톡) — Your Conversational Bedtime AI Retrospective Companion

[![Next.js](https://img.shields.io/badge/Next.js-16.2.6-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.4-blue?style=flat-square&logo=react)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-emerald?style=flat-square&logo=supabase)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini%20%2F%20Whisper%20%2F%20TTS-412991?style=flat-square&logo=openai)](https://openai.com/)

> A premium, glassmorphic retrospective web application that turns the friction of writing daily diaries into a warm, voice-enabled bedside conversation.

---

## 🌌 Inspiration

In modern society, burnout, stress, and isolation are at an all-time high. Yet, taking time to self-reflect and write a diary is often met with high cognitive friction. When you are physically and mentally exhausted at the end of a long day, sitting down to type out your thoughts feels like another chore. 

We asked ourselves: **What if writing a diary was as easy as chatting with a close friend in bed?**

**Haru Talk (하루톡)** was born out of this desire. By transforming the active chore of writing a diary into a comforting bedtime dialog with personalized AI companions, we aim to lower the emotional and behavioral barriers to self-reflection. Whether through warm text chats or low-latency, hands-free voice calls, Haru Talk helps users peacefully archive their days.

---

## ✨ What it does

Haru Talk is a complete retrospective ecosystem containing the following core features:

1. **Tailored AI Companion Personas**
   Users can choose their retrospective partner from three custom-engineered AI companion profiles:
   * 🌸 **Warm Empathy Mate (F - INFJ/ENFJ):** Focuses on emotional validation, deep empathy, and warm comfort for sadness and fatigue.
   * ⚡ **Rational Solution Mate (T - INTJ/ENTJ):** Focuses on structured cognitive framing, objective analysis, and growth-oriented solutions.
   * 🐶 **Praising Puppy Mate (Dog - ENFP/ESFP):** Floods the user with high-energy affection, adorable animal behavioral descriptions (e.g., `[wags tail]`), and unconditional positive reinforcement.

2. **Multimodal Bedtime Interaction Gateway**
   * **Voice Call Mode:** A completely hands-free, ultra-low latency simulated voice call that lets users speak their thoughts. Powered by custom Whisper-1 Speech-to-Text (STT) and TTS-1 Text-to-Speech (TTS) backend proxy streams.
   * **Text Chat Mode:** A highly interactive, beautiful, and secure real-time chat interface featuring spatial animations and responsive design.

3. **Generative 1st-Person Literary Diaries**
   * Upon completing a chat session, a specialized OpenAI JSON model dynamically distills the entire conversation script.
   * It generates a structured diary consisting of:
     * A poetic, emotional title.
     * A structured first-person ("나") narrative written in natural literary Korean.
     * An emotional category classification (`happy`, `sad`, `calm`, `tired`, `angry`).
     * A high-fidelity emotional sentiment score ranging from `0.0` (deep fatigue/sorrow) to `10.0` (peak peace/happiness).

4. **Starry Retrospective Calendar & Analytics**
   * Diaries are archived in a premium, glassmorphic interactive calendar gallery.
   * Each day is visualized with a glowing emotional star color-coded to the day's predominant emotion, offering an immediate intuitive view of user wellness over time.

5. **Multi-Channel Vercel Cron-Scheduled Alarms**
   * Users can schedule custom retrospective times on the dashboard.
   * A periodic Vercel Cron scheduler queries alarm times in Korea Standard Time (KST).
   * It dispatches push notifications directly to **KakaoTalk** (using Kakao's native Memo Send API) or falls back to starry-night responsive HTML emails to **Gmail** (via Resend API) to invite the user to reflect.

---

## 🛠️ How we built it

We built Haru Talk with a modern, secure, and production-ready tech stack:

* **Frontend Framework:** Next.js 16 (App Router) combined with React 19 and strict TypeScript.
* **Database & Auth (BaaS):** Supabase (PostgreSQL) handles fast query indexing, user sessions (Kakao/Google OAuth & Email logins), and granular Row Level Security (RLS) policies to keep private logs strictly confidential.
* **UI Design & Animations:** Tailwind CSS 4 for advanced styling, Framer Motion for high-fidelity micro-interactions and transitions, and Lucide React for modern, aesthetic icons.
* **AI Engines & Multimodal Stream Proxies:**
  * **OpenAI GPT-4o-mini:** Powers custom persona-driven systems prompts and strict schema JSON-mode diary summarizations.
  * **OpenAI Whisper-1:** Secure in-memory stream processing of user audio blobs into Korean text transcripts.
  * **OpenAI TTS-1:** Real-time synthesis of AI text into natural MP3 streams returned via chunked transfer encoding.
* **Backend Notifications & Scheduling:**
  * **KakaoTalk Messaging API:** Kakao OAuth mapping and native `memo/send` integration.
  * **Resend API:** Starry-night styled HTML fallbacks dispatched to users.
  * **Vercel Cron Jobs:** Serverless triggers checking database user schedules dynamically.

---

## 🚧 Challenges we ran into

### 1. React 19 Strict Impure Render Constraints
React 19 aggressively checks for impure execution (like calling `Date.now()` or using mutating side effects during render). We resolved state synchronization errors in our real-time landing page preview simulator by lifting global module counters and separating state effects cleanly.

### 2. Multi-Hop Voice Latency
Processing audio requires converting user audio blobs, sending them to Whisper, retrieving text, sending to GPT-4o-mini, receiving replies, calling TTS, and streaming back. We drastically reduced latency by writing an in-memory streaming proxy endpoint on the Next.js server side. By avoiding disk I/O and streaming binary MP3 chunks with `Transfer-Encoding: chunked`, voice responses feel remarkably immediate.

### 3. KakaoTalk OAuth Token Lifecycles
KakaoTalk OAuth access tokens expire every few hours. When Vercel Cron jobs trigger scheduled alerts in the middle of the night, expired tokens would crash the notification chain. We resolved this by implementing an auto-sync middleware on our main Dashboard dashboard page. Every time a user opens the dashboard, a fresh provider access token is silently synced to their metadata, ensuring robust nighttime alerts.

### 4. Database Race Conditions & Self-Healing REST APIs
Under high latency or rapid submissions, double-clicks could trigger concurrent `/api/summarize` requests, leading to duplicate diary creations. We resolved this by defining unique PostgreSQL database indexes on `session_id`. We built a self-healing API handler: if a duplicate write fails on a PostgreSQL unique constraint (error code `23505`), the endpoint catches the error, fetches the winning record, and returns it gracefully, preventing app crashes.

---

## 🏆 Accomplishments that we're proud of

* **Premium, Starry Dark Aesthetics:** A gorgeous glassmorphic interface that instantly evokes a calm, cozy bedtime mood.
* **Zero-Configuration Onboarding:** An interactive, client-side preview chat simulator on the landing page so users can test-drive F, T, and Dog companions instantly before signing up.
* **Seamless Multi-Channel Notifications:** A fully production-ready scheduler that bridges KakaoTalk and Resend fallback channels seamlessly.
* **Atomic Multimodal Pipeline:** Bringing Whisper and TTS together in Next.js Serverless Routes for immediate voice-to-voice feedback.

---

## 💡 What we learned

* **Prompt Engineering & Personas:** Crafting conversational instructions that control tone, response length, validation, and emotive action descriptors (`[wags tail]`) without ruining natural dialogue flow.
* **BaaS Architecture Security:** Leveraging PostgreSQL RLS policies to restrict read/write authorization and check constraints (`check_emotion`, `check_status`, `check_persona`) to enforce strict domain-driven database integrity.
* **Serverless Audio Streaming:** Techniques for processing and piping raw audio buffers through Next.js route handlers without filling up local disk space.

---

## 🚀 What's next for Haru Talk

* **Interactive Mood Charts (Analytics):** Integrating visually stunning charts (using libraries like Recharts) to let users analyze monthly sentiment trajectories and emotional triggers.
* **Custom Companion Architectures:** Allowing users to create and fine-tune their own custom companion personas, tailoring names, MBTIs, and support styles.
* **Wearable Integration:** Dispatches alerts to smartwatches, letting users dictate their bedtime diaries directly from their wrist.

---

## 🛠️ Built with

* **Languages:** TypeScript, PostgreSQL SQL, HTML5, CSS3
* **Frameworks:** Next.js 16 (App Router), React 19
* **Styling & Motion:** Tailwind CSS 4, Framer Motion, Lucide React
* **Database & Authentication:** Supabase (PostgreSQL), Kakao OAuth, Google OAuth
* **Cloud & Infrastructure:** Vercel Hosting, Vercel Cron Scheduler
* **APIs:** OpenAI API (GPT-4o-mini, Whisper-1, TTS-1), KakaoTalk Memo API, Resend Email API
