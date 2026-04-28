-- Formure v2 migration
-- Idempotent: adds owner-based RLS, native question columns, snapshot fields,
-- and rewrites RLS policies so anonymous users can only read published forms.

CREATE TABLE IF NOT EXISTS forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    welcome_title TEXT DEFAULT 'Hello, Welcome!',
    welcome_subtitle TEXT DEFAULT 'Press Start or Enter to begin',
    results_title TEXT DEFAULT 'Thank You!',
    results_subtitle TEXT DEFAULT 'You have completed this form',
    results_button_text TEXT DEFAULT 'Try Again',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL,
    question_order INTEGER NOT NULL,
    question_type TEXT NOT NULL,
    title TEXT,
    placeholder TEXT,
    options JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID,
    time_taken INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID NOT NULL,
    question_id UUID,
    answer_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE forms     ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE forms     ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS subtitle TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS button_text TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS image JSONB;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS form_name_snapshot TEXT;
ALTER TABLE answers   ADD COLUMN IF NOT EXISTS question_title_snapshot TEXT;

-- Adjust foreign keys (preserve respondent data on form delete)
DO $$
BEGIN
    ALTER TABLE responses DROP CONSTRAINT IF EXISTS responses_form_id_fkey;
    ALTER TABLE responses
        ADD CONSTRAINT responses_form_id_fkey
        FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE answers DROP CONSTRAINT IF EXISTS answers_question_id_fkey;
    ALTER TABLE answers
        ADD CONSTRAINT answers_question_id_fkey
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'answers' AND constraint_name = 'answers_response_id_fkey'
    ) THEN
        ALTER TABLE answers
            ADD CONSTRAINT answers_response_id_fkey
            FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'questions' AND constraint_name = 'questions_form_id_fkey'
    ) THEN
        ALTER TABLE questions
            ADD CONSTRAINT questions_form_id_fkey
            FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Replace question_type CHECK to allow checkbox + section natively
DO $$
DECLARE chk_name TEXT;
BEGIN
    SELECT conname INTO chk_name
    FROM pg_constraint
    WHERE conrelid = 'questions'::regclass AND contype = 'c'
    LIMIT 1;
    IF chk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE questions DROP CONSTRAINT ' || quote_ident(chk_name);
    END IF;
    ALTER TABLE questions
        ADD CONSTRAINT questions_question_type_check
        CHECK (question_type IN ('multiple_choice', 'checkbox', 'text_input', 'section'));
END $$;

CREATE INDEX IF NOT EXISTS idx_forms_owner ON forms(owner_id);
CREATE INDEX IF NOT EXISTS idx_questions_form_id ON questions(form_id);
CREATE INDEX IF NOT EXISTS idx_responses_form_id ON responses(form_id);
CREATE INDEX IF NOT EXISTS idx_answers_response_id ON answers(response_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);

-- RLS
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p RECORD;
BEGIN
    FOR p IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename IN ('forms', 'questions', 'responses', 'answers')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    END LOOP;
END $$;

CREATE POLICY "Public read published forms"
    ON forms FOR SELECT
    USING (is_published = TRUE OR owner_id = auth.uid());

CREATE POLICY "Authenticated users create forms"
    ON forms FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Owners update their forms"
    ON forms FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners delete their forms"
    ON forms FOR DELETE
    USING (owner_id = auth.uid());

CREATE POLICY "Read questions of readable forms"
    ON questions FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM forms f
        WHERE f.id = questions.form_id
        AND (f.is_published = TRUE OR f.owner_id = auth.uid())
    ));

CREATE POLICY "Owners manage their questions"
    ON questions FOR ALL
    USING (EXISTS (
        SELECT 1 FROM forms f
        WHERE f.id = questions.form_id AND f.owner_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM forms f
        WHERE f.id = questions.form_id AND f.owner_id = auth.uid()
    ));

CREATE POLICY "Anyone submits responses"
    ON responses FOR INSERT
    WITH CHECK (
        form_id IS NULL OR EXISTS (
            SELECT 1 FROM forms f
            WHERE f.id = responses.form_id AND f.is_published = TRUE
        )
    );

CREATE POLICY "Owners read responses"
    ON responses FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM forms f
        WHERE f.id = responses.form_id AND f.owner_id = auth.uid()
    ));

CREATE POLICY "Owners delete responses"
    ON responses FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM forms f
        WHERE f.id = responses.form_id AND f.owner_id = auth.uid()
    ));

CREATE POLICY "Anyone submits answers"
    ON answers FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM responses r WHERE r.id = answers.response_id
    ));

CREATE POLICY "Owners read answers of their forms"
    ON answers FOR SELECT
    USING (EXISTS (
        SELECT 1
        FROM responses r
        JOIN forms f ON f.id = r.form_id
        WHERE r.id = answers.response_id AND f.owner_id = auth.uid()
    ));

-- Functions
CREATE OR REPLACE FUNCTION get_form_with_questions(form_id_param UUID)
RETURNS JSON AS $$
DECLARE result JSON;
BEGIN
    SELECT json_build_object(
        'id', f.id,
        'name', f.name,
        'description', f.description,
        'welcome', json_build_object('title', f.welcome_title, 'subtitle', f.welcome_subtitle),
        'results', json_build_object('title', f.results_title, 'subtitle', f.results_subtitle, 'buttonText', f.results_button_text),
        'questions', (
            SELECT json_agg(
                json_build_object(
                    'id', q.id,
                    'type', q.question_type,
                    'title', q.title,
                    'placeholder', q.placeholder,
                    'subtitle', q.subtitle,
                    'buttonText', q.button_text,
                    'color', q.color,
                    'image', q.image,
                    'options', q.options
                )
                ORDER BY q.question_order
            )
            FROM questions q WHERE q.form_id = form_id_param
        )
    )
    INTO result
    FROM forms f
    WHERE f.id = form_id_param
      AND (f.is_published = TRUE OR f.owner_id = auth.uid());
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE OR REPLACE FUNCTION submit_response(
    form_id_param UUID,
    time_taken_param INTEGER,
    answers_param JSONB
)
RETURNS UUID AS $$
DECLARE
    response_id_val UUID;
    form_name_val TEXT;
BEGIN
    SELECT name INTO form_name_val FROM forms WHERE id = form_id_param AND is_published = TRUE;
    IF form_name_val IS NULL THEN
        RAISE EXCEPTION 'Form not found or not published';
    END IF;

    INSERT INTO responses (form_id, form_name_snapshot, time_taken)
    VALUES (form_id_param, form_name_val, time_taken_param)
    RETURNING id INTO response_id_val;

    INSERT INTO answers (response_id, question_id, question_title_snapshot, answer_value)
    SELECT
        response_id_val,
        (a->>'questionId')::UUID,
        (SELECT title FROM questions WHERE id = (a->>'questionId')::UUID),
        a->>'answer'
    FROM jsonb_array_elements(answers_param) AS a;

    RETURN response_id_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS forms_updated_at ON forms;
CREATE TRIGGER forms_updated_at
    BEFORE UPDATE ON forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
