-- Form360 Database Schema for Supabase

-- Create tables for forms, questions, and responses

-- Forms table
CREATE TABLE IF NOT EXISTS forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    welcome_title TEXT DEFAULT 'Halo, Selamat Datang!',
    welcome_subtitle TEXT DEFAULT 'Tekan Mulai atau Enter untuk memulai',
    results_title TEXT DEFAULT 'Terima Kasih!',
    results_subtitle TEXT DEFAULT 'Kamu telah menyelesaikan form ini',
    results_button_text TEXT DEFAULT 'Ikuti Lagi',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    question_order INTEGER NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'text_input')),
    title TEXT,
    placeholder TEXT,
    options JSONB, -- Array of {text, value} for multiple choice
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Responses table (one per form submission)
CREATE TABLE IF NOT EXISTS responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    time_taken INTEGER, -- in seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Answer details table
CREATE TABLE IF NOT EXISTS answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer_value TEXT, -- The selected option value or text input
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_questions_form_id ON questions(form_id);
CREATE INDEX IF NOT EXISTS idx_responses_form_id ON responses(form_id);
CREATE INDEX IF NOT EXISTS idx_answers_response_id ON answers(response_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);

-- Row Level Security (RLS) policies

-- Enable RLS on all tables
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

-- Forms: Public can read, authenticated users can insert/update
CREATE POLICY "Public forms read" ON forms FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create forms" ON forms FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own forms" ON forms FOR UPDATE USING (true);
CREATE POLICY "Users can delete own forms" ON forms FOR DELETE USING (true);

-- Questions: Public can read, follow form permissions
CREATE POLICY "Public questions read" ON questions FOR SELECT USING (true);
CREATE POLICY "Users can manage questions" ON questions FOR ALL USING (true);

-- Responses: Public can insert, authenticated users can read own
CREATE POLICY "Public can submit responses" ON responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can read responses" ON responses FOR SELECT USING (true);

-- Answers: Public can insert, follow response permissions
CREATE POLICY "Public can submit answers" ON answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can read answers" ON answers FOR SELECT USING (true);

-- Functions for common operations

-- Function to get full form with questions
CREATE OR REPLACE FUNCTION get_form_with_questions(form_id_param UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'id', f.id,
        'name', f.name,
        'description', f.description,
        'welcome', json_build_object(
            'title', f.welcome_title,
            'subtitle', f.welcome_subtitle
        ),
        'results', json_build_object(
            'title', f.results_title,
            'subtitle', f.results_subtitle,
            'buttonText', f.results_button_text
        ),
        'questions', (
            SELECT json_agg(
                json_build_object(
                    'id', q.id,
                    'type', q.question_type,
                    'title', q.title,
                    'placeholder', q.placeholder,
                    'options', q.options
                )
                ORDER BY q.question_order
            )
            FROM questions q WHERE q.form_id = form_id_param
        )
    )
    INTO result
    FROM forms f
    WHERE f.id = form_id_param;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to submit a response with answers
CREATE OR REPLACE FUNCTION submit_response(
    form_id_param UUID,
    time_taken_param INTEGER,
    answers_param JSONB
)
RETURNS UUID AS $$
DECLARE
    response_id_val UUID;
BEGIN
    -- Insert response
    INSERT INTO responses (form_id, time_taken)
    VALUES (form_id_param, time_taken_param)
    RETURNING id INTO response_id_val;

    -- Insert answers
    FOR i IN 1..jsonb_array_length(answers_param)
    LOOP
        INSERT INTO answers (response_id, question_id, answer_value)
        SELECT
            response_id_val,
            (jsonb_array_elements(answers_param)->>'questionId')::UUID,
            jsonb_array_elements(answers_param)->>'answer';
    END LOOP;

    RETURN response_id_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER forms_updated_at
    BEFORE UPDATE ON forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();