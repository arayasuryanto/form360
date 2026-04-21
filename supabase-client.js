// Supabase Client Configuration
// Set environment variables:
// VITE_SUPABASE_URL=https://your-project.supabase.co
// VITE_SUPABASE_ANON_KEY=your-anon-key

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Create client only if env vars are set
let supabase = null
if (supabaseUrl && supabaseAnonKey) {
    supabase = window.supabase || window.createClient?.(supabaseUrl, supabaseAnonKey)
}

// Helper functions
export async function getForm(formId) {
    if (!supabase) return null

    try {
        // Try RPC function first
        const { data, error } = await supabase.rpc('get_form_with_questions', { form_id_param: formId })
        if (error) throw error
        return data
    } catch (e) {
        console.error('getForm error:', e)
        return null
    }
}

export async function submitResponse(formId, timeTaken, answers) {
    if (!supabase) return null

    try {
        const { data, error } = await supabase.rpc('submit_response', {
            form_id_param: formId,
            time_taken_param: timeTaken,
            answers_param: answers
        })
        if (error) throw error
        return data
    } catch (e) {
        console.error('submitResponse error:', e)
        throw e
    }
}

// Form CRUD operations for editor
export async function getAllForms() {
    if (!supabase) return []

    const { data, error } = await supabase
        .from('forms')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function createForm(formData) {
    if (!supabase) return null

    const { data, error } = await supabase
        .from('forms')
        .insert(formData)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateForm(formId, updates) {
    if (!supabase) return null

    const { data, error } = await supabase
        .from('forms')
        .update(updates)
        .eq('id', formId)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteForm(formId) {
    if (!supabase) return null

    const { error } = await supabase
        .from('forms')
        .delete()
        .eq('id', formId)

    if (error) throw error
}

export async function getFormQuestions(formId) {
    if (!supabase) return []

    const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('form_id', formId)
        .order('question_order', { ascending: true })

    if (error) throw error
    return data || []
}

export async function saveFormQuestions(formId, questions) {
    if (!supabase) return null

    // Delete existing questions
    await supabase.from('questions').delete().eq('form_id', formId)

    // Insert new questions
    const questionsToInsert = questions.map((q, i) => ({
        form_id: formId,
        question_order: i + 1,
        question_type: q.type,
        title: q.title,
        placeholder: q.placeholder || null,
        options: q.options ? JSON.stringify(q.options) : null
    }))

    const { data, error } = await supabase
        .from('questions')
        .insert(questionsToInsert)
        .select()

    if (error) throw error
    return data
}

// Responses/Respondents
export async function getFormResponses(formId) {
    if (!supabase) return []

    const { data, error } = await supabase
        .from('responses')
        .select('*')
        .eq('form_id', formId)
        .order('created_at', { ascending: false })

    if (error) throw error

    // Get answers for each response
    if (data) {
        for (const response of data) {
            const { data: answers } = await supabase
                .from('answers')
                .select('*')
                .eq('response_id', response.id)

            response.answers_data = answers || []
        }
    }

    return data || []
}

export async function getResponseDetail(responseId) {
    if (!supabase) return null

    const { data: response, error } = await supabase
        .from('responses')
        .select('*')
        .eq('id', responseId)
        .single()

    if (error) throw error

    const { data: answers } = await supabase
        .from('answers')
        .select('*')
        .eq('response_id', responseId)

    response.answers_data = answers || []

    return response
}

// Check if Supabase is configured
export function isSupabaseConfigured() {
    return !!(supabaseUrl && supabaseAnonKey && supabase)
}