-- ====================================================================
-- HARU TALK DATABASE SCHEMA & POLICY DEFINITIONS
--
-- WHY: Provides a robust, secure, and performant relational structure
-- for chat sessions, dialog logs, and AI-summarized diaries.
-- Implements PostgreSQL check constraints to enforce domain data integrity,
-- cascading deletes to prevent orphaned rows, and granular Row Level Security (RLS)
-- to ensure strict user privacy compliant with OWASP security practices.
-- ====================================================================

-- Enable UUID extension in the schema for secure, non-sequential primary keys.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 1. CHAT SESSIONS TABLE
--
-- WHY: Tracks the active and historical dialogue sessions initiated by users,
-- locking in the chosen companion persona and session status.
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    persona TEXT NOT NULL CONSTRAINT check_persona CHECK (persona IN ('warm_f', 'rational_t', 'dog_c')),
    status TEXT NOT NULL DEFAULT 'chatting' CONSTRAINT check_status CHECK (status IN ('chatting', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index user_id and created_at to support fast lookup and ordering.
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON public.chat_sessions(created_at DESC);

-- Enable RLS on chat_sessions to restrict direct read/write from client SDKs.
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Users can only read their own chat sessions.
CREATE POLICY "Users can select their own chat sessions" 
ON public.chat_sessions FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- INSERT Policy: Users can only create chat sessions representing themselves.
CREATE POLICY "Users can insert their own chat sessions" 
ON public.chat_sessions FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- UPDATE Policy: Users can only modify their own chat sessions.
CREATE POLICY "Users can update their own chat sessions" 
ON public.chat_sessions FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- DELETE Policy: Users can only delete their own chat sessions.
CREATE POLICY "Users can delete their own chat sessions" 
ON public.chat_sessions FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);


-- ====================================================================
-- 2. CHAT MESSAGES TABLE
--
-- WHY: Records individual turns (User prompts and AI responses) within a session.
-- Implements cascade deletion to automatically clean up logs when a session is deleted.
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CONSTRAINT check_sender CHECK (sender IN ('user', 'ai')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index session_id and created_at to ensure speedy retrieval of session history.
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at ASC);

-- Enable RLS on chat_messages.
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Users can select messages belonging to sessions they own.
CREATE POLICY "Users can select messages of owned sessions" 
ON public.chat_messages FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.chat_sessions 
        WHERE chat_sessions.id = chat_messages.session_id 
        AND chat_sessions.user_id = auth.uid()
    )
);

-- INSERT Policy: Users can insert messages into sessions they own.
CREATE POLICY "Users can insert messages into owned sessions" 
ON public.chat_messages FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.chat_sessions 
        WHERE chat_sessions.id = session_id 
        AND chat_sessions.user_id = auth.uid()
    )
);

-- DELETE Policy: Users can delete messages from sessions they own.
CREATE POLICY "Users can delete messages of owned sessions" 
ON public.chat_messages FOR DELETE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.chat_sessions 
        WHERE chat_sessions.id = chat_messages.session_id 
        AND chat_sessions.user_id = auth.uid()
    )
);


-- ====================================================================
-- 3. DIARIES TABLE
--
-- WHY: Stores the structured, finalized diary logs created from completed chat sessions.
-- Integrates sentiment analysis values and major emotion tags for aesthetic calendar renders.
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.diaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    emotion TEXT NOT NULL CONSTRAINT check_emotion CHECK (emotion IN ('happy', 'sad', 'calm', 'tired', 'angry')),
    sentiment_score NUMERIC(3, 1) NOT NULL DEFAULT 5.0 CONSTRAINT check_sentiment CHECK (sentiment_score >= 0.0 AND sentiment_score <= 10.0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index to prevent duplicate diaries representing the same chat session.
CREATE UNIQUE INDEX IF NOT EXISTS idx_diaries_session_id ON public.diaries(session_id);
-- Index user_id and date for performant archive and filtering lookups.
CREATE INDEX IF NOT EXISTS idx_diaries_user_id ON public.diaries(user_id);
CREATE INDEX IF NOT EXISTS idx_diaries_date ON public.diaries(date DESC);

-- Enable RLS on diaries.
ALTER TABLE public.diaries ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Users can read their own diaries.
CREATE POLICY "Users can select their own diaries" 
ON public.diaries FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- INSERT Policy: Users can write their own diaries.
CREATE POLICY "Users can insert their own diaries" 
ON public.diaries FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- DELETE Policy: Users can delete their own diaries from the archive.
CREATE POLICY "Users can delete their own diaries" 
ON public.diaries FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);
