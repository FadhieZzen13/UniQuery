-- Campus Connect Supabase Schema --

-- Public user profile table linked to auth.users
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    major TEXT,
    year TEXT,
    avatar TEXT,
    reputation INT DEFAULT 0,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT users_email_edu_check CHECK (POSITION('.edu' IN LOWER(email)) > 0)
);

-- Tags table for question tagging
CREATE TABLE IF NOT EXISTS public.tags (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questions table
CREATE TABLE IF NOT EXISTS public.questions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Question-Tags junction table (many-to-many)
CREATE TABLE IF NOT EXISTS public.question_tags (
    question_id INTEGER REFERENCES public.questions(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, tag_id)
);

-- Answers table
CREATE TABLE IF NOT EXISTS public.answers (
    id SERIAL PRIMARY KEY,
    question_id INTEGER REFERENCES public.questions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Votes table (for both questions and answers)
CREATE TABLE IF NOT EXISTS public.votes (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES public.questions(id) ON DELETE CASCADE,
    answer_id INTEGER REFERENCES public.answers(id) ON DELETE CASCADE,
    value INT CHECK (value IN (-1, 1)),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, question_id),
    UNIQUE(user_id, answer_id),
    CONSTRAINT votes_target_check CHECK ((question_id IS NOT NULL)::INT + (answer_id IS NOT NULL)::INT = 1)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_questions_user_id ON public.questions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_category ON public.questions(category);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON public.answers(question_id);
CREATE INDEX IF NOT EXISTS idx_votes_question_id ON public.votes(question_id);
CREATE INDEX IF NOT EXISTS idx_votes_answer_id ON public.votes(answer_id);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Policies for users
CREATE POLICY users_select_public ON public.users
    FOR SELECT USING (TRUE);

CREATE POLICY users_insert_self ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY users_update_self ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Policies for tags
CREATE POLICY tags_select_public ON public.tags
    FOR SELECT USING (TRUE);

CREATE POLICY tags_insert_auth ON public.tags
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Policies for questions
CREATE POLICY questions_select_public ON public.questions
    FOR SELECT USING (TRUE);

CREATE POLICY questions_insert_auth ON public.questions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY questions_update_owner ON public.questions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY questions_delete_owner ON public.questions
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for question_tags
CREATE POLICY question_tags_select_public ON public.question_tags
    FOR SELECT USING (TRUE);

CREATE POLICY question_tags_insert_owner ON public.question_tags
    FOR INSERT WITH CHECK (
        auth.uid() = (SELECT user_id FROM public.questions WHERE id = question_id)
    );

CREATE POLICY question_tags_delete_owner ON public.question_tags
    FOR DELETE USING (
        auth.uid() = (SELECT user_id FROM public.questions WHERE id = question_id)
    );

-- Policies for answers
CREATE POLICY answers_select_public ON public.answers
    FOR SELECT USING (TRUE);

CREATE POLICY answers_insert_auth ON public.answers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY answers_update_owner ON public.answers
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY answers_delete_owner ON public.answers
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for votes
CREATE POLICY votes_select_owner ON public.votes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY votes_insert_owner ON public.votes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY votes_update_owner ON public.votes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY votes_delete_owner ON public.votes
    FOR DELETE USING (auth.uid() = user_id);
