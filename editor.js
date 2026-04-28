// Formure — Editor
// Source of truth: Supabase (RLS-gated by owner_id). localStorage is only a UI cache.
// All user-authored content is rendered via DOM APIs (textContent / setAttribute) to prevent XSS.

const cfg = window.FORMURE_CONFIG || {};
const SUPABASE_URL = cfg.SUPABASE_URL || '';
const SUPABASE_KEY = cfg.SUPABASE_KEY || '';

let sbClient = null;
let currentUser = null;

let forms = [];
let currentFormId = null;
let questionToDelete = null;
let formToDelete = null;
const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const COLORS = ['#e53935', '#f57c00', '#fbc02d', '#43a047', '#1e88e5', '#5e35b1', '#d81b60', '#00897b', '#6d4c41', '#546e7a'];

const formList = document.getElementById('formList');
const formNameInput = document.getElementById('formName');
const formDescriptionInput = document.getElementById('formDescription');
const welcomeTitleInput = document.getElementById('welcomeTitle');
const welcomeSubtitleInput = document.getElementById('welcomeSubtitle');
const resultsTitleInput = document.getElementById('resultsTitle');
const resultsSubtitleInput = document.getElementById('resultsSubtitle');
const resultsButtonTextInput = document.getElementById('resultsButtonText');
const questionsList = document.getElementById('questionsList');
const previewModal = document.getElementById('previewModal');
const newFormModal = document.getElementById('newFormModal');
const deleteModal = document.getElementById('deleteModal');
const previewFrame = document.getElementById('previewFrame');
const respondentsModal = document.getElementById('respondentsModal');

document.addEventListener('DOMContentLoaded', init);

async function init() {
    if (!window.supabase || !SUPABASE_URL || !SUPABASE_KEY) {
        showAuthError('Supabase is not configured. See config.js.');
        return;
    }
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    setupAuth();

    const { data: { session } } = await sbClient.auth.getSession();
    if (session && session.user) {
        currentUser = session.user;
        await enterEditor();
    } else {
        showAuthGate();
    }
}

// ─────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────

function setupAuth() {
    const form = document.getElementById('authForm');
    const toggle = document.getElementById('authToggleLink');
    const submit = document.getElementById('authSubmit');
    const subtitle = document.getElementById('authSubtitle');
    const switchPrompt = document.getElementById('authSwitchPrompt');
    let mode = 'sign_in';

    toggle.addEventListener('click', e => {
        e.preventDefault();
        mode = mode === 'sign_in' ? 'sign_up' : 'sign_in';
        if (mode === 'sign_up') {
            submit.textContent = 'Create account';
            subtitle.textContent = 'Create your Formure account';
            switchPrompt.textContent = 'Already have an account?';
            toggle.textContent = 'Sign in';
        } else {
            submit.textContent = 'Sign in';
            subtitle.textContent = 'Sign in to manage your forms';
            switchPrompt.textContent = 'No account?';
            toggle.textContent = 'Create one';
        }
        showAuthError('');
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        if (!email || password.length < 6) {
            showAuthError('Enter a valid email and a password of at least 6 characters.');
            return;
        }
        submit.disabled = true;
        submit.textContent = mode === 'sign_up' ? 'Creating…' : 'Signing in…';
        try {
            const fn = mode === 'sign_up' ? 'signUp' : 'signInWithPassword';
            const { data, error } = await sbClient.auth[fn]({ email, password });
            if (error) throw error;
            if (mode === 'sign_up' && !data.session) {
                showAuthError('Check your email to confirm the account, then sign in.');
                submit.disabled = false;
                submit.textContent = 'Create account';
                return;
            }
            currentUser = data.user;
            await enterEditor();
        } catch (err) {
            showAuthError(err.message || 'Authentication failed.');
            submit.disabled = false;
            submit.textContent = mode === 'sign_up' ? 'Create account' : 'Sign in';
        }
    });

    bind('signOutBtn', 'click', async () => {
        await sbClient.auth.signOut();
        location.reload();
    });
}

function showAuthGate() {
    document.getElementById('authGate').style.display = 'flex';
    document.getElementById('topNav').style.display = 'none';
    document.getElementById('editorContainer').style.display = 'none';
}

function showAuthError(msg) {
    const el = document.getElementById('authError');
    if (!el) return;
    if (msg) {
        el.textContent = msg;
        el.style.display = 'block';
    } else {
        el.textContent = '';
        el.style.display = 'none';
    }
}

async function enterEditor() {
    document.getElementById('authGate').style.display = 'none';
    document.getElementById('topNav').style.display = '';
    document.getElementById('editorContainer').style.display = '';
    const userBadge = document.getElementById('navUser');
    if (userBadge && currentUser) userBadge.textContent = currentUser.email || '';

    setupEventListeners();
    try {
        await loadForms();
    } catch (e) {
        forms = [];
    }
    renderFormList();
    if (forms.length === 0) {
        // Create a default form for new users
        await createDefaultForm();
    }
}

async function createDefaultForm() {
    const newForm = createNewFormData('My First Form');
    const id = await persistFormToSupabase(newForm);
    if (id) {
        newForm.id = id;
        forms.push(newForm);
        cacheForms();
        renderFormList();
        selectForm(id);
    }
}

// ─────────────────────────────────────────────────────────────────────
// Data layer
// ─────────────────────────────────────────────────────────────────────

async function loadForms() {
    const { data: remoteForms, error } = await sbClient
        .from('forms')
        .select('*')
        .eq('owner_id', currentUser.id)
        .order('created_at', { ascending: true });
    if (error) throw error;

    forms = [];
    for (const rf of (remoteForms || [])) {
        const questions = await fetchQuestionsForForm(rf.id);
        forms.push({
            id: rf.id,
            name: rf.name || 'Untitled',
            description: rf.description || '',
            welcome: { title: rf.welcome_title || 'Hello, Welcome!', subtitle: rf.welcome_subtitle || 'Press Start or Enter to begin' },
            results: { title: rf.results_title || 'Thank You!', subtitle: rf.results_subtitle || 'You have completed this form', buttonText: rf.results_button_text || 'Try Again' },
            questions
        });
    }
    cacheForms();
}

async function fetchQuestionsForForm(formId) {
    const { data, error } = await sbClient
        .from('questions')
        .select('*')
        .eq('form_id', formId)
        .order('question_order', { ascending: true });
    if (error) return [];
    return (data || []).map(q => {
        // Native columns are the source of truth; legacy fallback for older rows.
        let realType = q.question_type;
        let subtitle = q.subtitle || '';
        let buttonText = q.button_text || 'Continue';
        let color = q.color || null;
        let image = q.image || null;
        let options = null;

        if (q.question_type === 'text_input' && q.placeholder && q.placeholder.startsWith('__section__')) {
            realType = 'section';
            const parts = q.placeholder.split('__section__');
            subtitle = subtitle || parts[1] || '';
            buttonText = buttonText !== 'Continue' ? buttonText : (parts[2] || 'Continue');
        }

        if (q.options) {
            const parsed = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
            if (parsed && parsed._options !== undefined) {
                options = parsed._options;
                color = color || parsed._color || null;
                image = image || parsed._image || null;
                if (parsed._realType) realType = parsed._realType;
            } else {
                options = parsed;
            }
        }

        const base = { id: q.id, type: realType, title: q.title || '', color, image };
        if (realType === 'multiple_choice' || realType === 'checkbox') base.options = options || [];
        if (realType === 'text_input') base.placeholder = q.placeholder || '';
        if (realType === 'section') { base.subtitle = subtitle; base.buttonText = buttonText; }
        return base;
    });
}

function cacheForms() {
    try {
        localStorage.setItem(`formure_cache_${currentUser.id}`, JSON.stringify(forms));
    } catch (e) {}
}

function createNewFormData(name = 'New Form') {
    return {
        id: null,
        name,
        description: '',
        welcome: { title: 'Hello, Welcome!', subtitle: 'Press Start or Enter to begin' },
        results: { title: 'Thank You!', subtitle: 'You have completed this form', buttonText: 'Try Again' },
        questions: [
            createQuestionData('multiple_choice'),
            createQuestionData('multiple_choice')
        ]
    };
}

function createQuestionData(type = 'multiple_choice') {
    const base = { id: tempId(), type, title: '', color: null };
    if (type === 'multiple_choice' || type === 'checkbox') {
        base.options = [
            { text: 'Option A', value: 'opt_a' },
            { text: 'Option B', value: 'opt_b' },
            { text: 'Option C', value: 'opt_c' },
            { text: 'Option D', value: 'opt_d' }
        ];
    } else if (type === 'section') {
        base.subtitle = '';
        base.buttonText = 'Continue';
    } else {
        base.placeholder = 'Type your answer here...';
    }
    return base;
}

function tempId() {
    return 'tmp_' + Math.random().toString(36).slice(2, 11);
}

// ─────────────────────────────────────────────────────────────────────
// Event listeners
// ─────────────────────────────────────────────────────────────────────

function bind(id, event, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, fn);
}

function setupEventListeners() {
    bind('newFormBtn', 'click', showNewFormModal);
    bind('previewBtn', 'click', showPreview);
    bind('saveBtn', 'click', saveCurrentForm);
    bind('addQuestionBtn', 'click', addQuestion);
    bind('cancelNewForm', 'click', hideNewFormModal);
    bind('confirmNewForm', 'click', createNewForm);
    bind('cancelDelete', 'click', hideDeleteModal);
    bind('confirmDelete', 'click', confirmDelete);
    bind('closePreview', 'click', hidePreview);
    bind('closeRespondents', 'click', hideRespondentsModal);
    bind('shareBtn', 'click', showShareModal);
    bind('copyLinkBtn', 'click', copyShareLink);
    bind('closeShareModal', 'click', hideShareModal);
    bind('cancelDeleteForm', 'click', cancelDeleteForm);
    bind('confirmDeleteForm', 'click', confirmDeleteForm);
    bind('cancelAddQuestion', 'click', cancelAddQuestion);
    bind('addQuestionQuestion', 'click', () => confirmAddQuestion('multiple_choice'));
    bind('addQuestionSection', 'click', () => confirmAddQuestion('section'));

    [formNameInput, formDescriptionInput, welcomeTitleInput, welcomeSubtitleInput,
     resultsTitleInput, resultsSubtitleInput, resultsButtonTextInput].forEach(el => {
        if (el) el.addEventListener('input', updateFormSetting);
    });

    if (previewModal) previewModal.addEventListener('click', e => { if (e.target === previewModal) hidePreview(); });
    if (respondentsModal) respondentsModal.addEventListener('click', e => { if (e.target === respondentsModal) hideRespondentsModal(); });

    if (formList) {
        formList.addEventListener('click', e => {
            const btn = e.target.closest('.icon-btn');
            if (btn) {
                e.stopPropagation();
                e.preventDefault();
                const formItem = btn.closest('.form-item');
                if (!formItem) return;
                const formId = formItem.dataset.formId;
                if (btn.classList.contains('export-btn')) downloadFormExcel(formId);
                else if (btn.classList.contains('view-btn')) showRespondentsModal(formId);
                else if (btn.classList.contains('delete-btn')) showDeleteFormModal(formId);
                return;
            }
            const main = e.target.closest('.form-item-main');
            if (main) {
                const formItem = main.closest('.form-item');
                if (formItem) selectForm(formItem.dataset.formId);
            }
        });
    }

    setupDragAndDrop();
    document.addEventListener('click', e => {
        if (!e.target.closest('.color-dot') && !e.target.closest('.color-picker-popover')) {
            document.querySelectorAll('.color-picker-popover').forEach(p => p.style.display = 'none');
        }
    });

    setupImagePan();
}

function setupDragAndDrop() {
    let draggedQuestionId = null;
    if (!questionsList) return;
    questionsList.addEventListener('dragstart', e => {
        const item = e.target.closest('.question-item');
        if (!item) return;
        draggedQuestionId = item.dataset.id;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedQuestionId);
    });
    questionsList.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const item = e.target.closest('.question-item');
        if (!item || item.dataset.id === draggedQuestionId) return;
        questionsList.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
        const rect = item.getBoundingClientRect();
        item.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-top' : 'drag-over-bottom');
    });
    questionsList.addEventListener('dragleave', e => {
        const item = e.target.closest('.question-item');
        if (item) item.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    questionsList.addEventListener('drop', e => {
        e.preventDefault();
        const form = getCurrentForm();
        if (!form || !draggedQuestionId) return;
        const targetItem = e.target.closest('.question-item');
        if (!targetItem) return;
        const targetId = targetItem.dataset.id;
        if (targetId === draggedQuestionId) return;
        const fromIdx = form.questions.findIndex(q => String(q.id) === draggedQuestionId);
        const toIdx = form.questions.findIndex(q => String(q.id) === targetId);
        if (fromIdx === -1 || toIdx === -1) return;
        const rect = targetItem.getBoundingClientRect();
        const insertBefore = e.clientY < rect.top + rect.height / 2;
        const [moved] = form.questions.splice(fromIdx, 1);
        let newIdx = form.questions.findIndex(q => String(q.id) === targetId);
        if (!insertBefore) newIdx++;
        form.questions.splice(newIdx, 0, moved);
        cacheForms();
        renderQuestions();
    });
    questionsList.addEventListener('dragend', () => {
        draggedQuestionId = null;
        questionsList.querySelectorAll('.dragging, .drag-over-top, .drag-over-bottom').forEach(el => el.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom'));
    });
}

// ─────────────────────────────────────────────────────────────────────
// Form CRUD
// ─────────────────────────────────────────────────────────────────────

function showNewFormModal() {
    document.getElementById('newFormName').value = '';
    newFormModal.classList.add('active');
    setTimeout(() => document.getElementById('newFormName').focus(), 100);
}

function hideNewFormModal() {
    newFormModal.classList.remove('active');
}

async function createNewForm() {
    const name = document.getElementById('newFormName').value.trim() || 'New Form';
    const newForm = createNewFormData(name);
    hideNewFormModal();
    const id = await persistFormToSupabase(newForm);
    if (!id) {
        showToast('Could not create form', true);
        return;
    }
    newForm.id = id;
    forms.push(newForm);
    cacheForms();
    renderFormList();
    selectForm(id);
}

function showDeleteModal(questionId) {
    questionToDelete = questionId;
    deleteModal.classList.add('active');
}

function hideDeleteModal() {
    questionToDelete = null;
    deleteModal.classList.remove('active');
}

function confirmDelete() {
    if (questionToDelete !== null) {
        const form = getCurrentForm();
        form.questions = form.questions.filter(q => q.id !== questionToDelete);
        cacheForms();
        renderQuestions();
        renderFormList();
    }
    hideDeleteModal();
}

function showDeleteFormModal(formId) {
    const form = forms.find(f => f.id === formId);
    if (!form) return;
    formToDelete = formId;
    const msgEl = document.getElementById('deleteFormMsg');
    if (msgEl) msgEl.textContent = `Delete "${form.name || 'Untitled'}"? Existing respondent data will be kept (with form name snapshot) for your records.`;
    document.getElementById('deleteFormModal').classList.add('active');
}

function cancelDeleteForm() {
    formToDelete = null;
    document.getElementById('deleteFormModal').classList.remove('active');
}

async function confirmDeleteForm() {
    if (!formToDelete) return;
    try {
        const { error } = await sbClient.from('forms').delete().eq('id', formToDelete);
        if (error) throw error;
    } catch (e) {
        showToast('Delete failed: ' + (e.message || ''), true);
        return;
    }
    forms = forms.filter(f => f.id !== formToDelete);
    if (currentFormId === formToDelete) currentFormId = forms.length > 0 ? forms[0].id : null;
    formToDelete = null;
    cacheForms();
    document.getElementById('deleteFormModal').classList.remove('active');
    showToast('Form deleted');
    renderFormList();
    if (currentFormId) selectForm(currentFormId);
    else renderQuestions();
}

function showPreview() {
    saveCurrentFormLocal();
    const form = getCurrentForm();
    if (!form) return;
    sessionStorage.setItem('formure_preview', JSON.stringify(form));
    previewFrame.src = 'viewer.html?preview=true';
    previewModal.classList.add('active');
}

function hidePreview() {
    previewModal.classList.remove('active');
    previewFrame.src = '';
}

async function showShareModal() {
    const form = getCurrentForm();
    if (!form) return;
    const validation = validateFormForShare(form);
    if (!validation.ok) {
        showToast(validation.message, true);
        return;
    }
    const shareBtn = document.getElementById('shareBtn');
    const originalText = shareBtn.textContent;
    shareBtn.textContent = 'Saving…';
    shareBtn.disabled = true;
    const id = await persistFormToSupabase(form);
    shareBtn.textContent = originalText;
    shareBtn.disabled = false;
    if (!id) {
        showToast('Could not generate share link', true);
        return;
    }
    cacheForms();
    const baseUrl = window.location.origin + '/viewer.html';
    document.getElementById('shareLink').value = `${baseUrl}?form=${id}`;
    document.getElementById('shareModal').classList.add('active');
}

function hideShareModal() {
    document.getElementById('shareModal').classList.remove('active');
}

function copyShareLink() {
    const input = document.getElementById('shareLink');
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
        const btn = document.getElementById('copyLinkBtn');
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.background = '#2e7d32';
        setTimeout(() => { btn.textContent = original; btn.style.background = ''; }, 2000);
    });
}

function validateFormForShare(form) {
    if (!form.name.trim()) return { ok: false, message: 'Form name is required' };
    if (form.questions.length === 0) return { ok: false, message: 'Add at least one question' };
    for (const q of form.questions) {
        if (q.type !== 'section' && !q.title.trim()) return { ok: false, message: 'Every question needs a title' };
        if ((q.type === 'multiple_choice' || q.type === 'checkbox')) {
            if (!q.options || q.options.length < 2) return { ok: false, message: 'Each choice question needs at least 2 options' };
            if (q.options.some(o => !o.text.trim())) return { ok: false, message: 'Options cannot be empty' };
        }
    }
    return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────
// Respondents
// ─────────────────────────────────────────────────────────────────────

async function showRespondentsModal(formId) {
    const form = forms.find(f => f.id === formId);
    if (!form) return;
    document.getElementById('respondentsFormName').textContent = form.name;
    document.getElementById('respondentDetail').style.display = 'none';
    document.getElementById('respondentsList').style.display = 'block';
    respondentsModal.classList.add('active');

    const respondentsList = document.getElementById('respondentsList');
    respondentsList.replaceChildren(emptyState('Loading...'));

    let respondents = await fetchRespondentsFromSupabase(formId) || [];
    respondentsList.replaceChildren();

    if (respondents.length === 0) {
        respondentsList.appendChild(emptyState('No respondents yet'));
        return;
    }

    respondents.forEach((r, i) => {
        const item = document.createElement('div');
        item.className = 'respondent-item';
        item.dataset.formId = formId;
        item.dataset.respondentId = r.id;
        const info = document.createElement('div');
        info.className = 'respondent-info';
        const number = document.createElement('span');
        number.className = 'respondent-number';
        number.textContent = '#' + (i + 1);
        const time = document.createElement('span');
        time.className = 'respondent-time';
        time.textContent = r.created_at ? new Date(r.created_at).toLocaleString() : '';
        info.append(number, time);
        const actions = document.createElement('div');
        actions.className = 'respondent-actions';
        const badge = document.createElement('span');
        badge.className = 'time-badge';
        badge.textContent = (r.time_taken ?? '?') + ' sec';
        actions.appendChild(badge);
        actions.insertAdjacentHTML('beforeend', `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 12l4-4-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
        item.append(info, actions);
        item.addEventListener('click', () => showRespondentDetail(formId, r.id));
        respondentsList.appendChild(item);
    });
}

function emptyState(text) {
    const wrap = document.createElement('div');
    wrap.className = 'empty-respondents';
    const p = document.createElement('p');
    p.textContent = text;
    wrap.appendChild(p);
    return wrap;
}

function hideRespondentsModal() {
    respondentsModal.classList.remove('active');
}

async function showRespondentDetail(formId, respondentId) {
    const form = forms.find(f => f.id === formId);
    if (!form) return;

    document.getElementById('respondentsList').style.display = 'none';
    document.getElementById('respondentDetail').style.display = 'block';

    const detailHeader = document.getElementById('respondentDetailHeader');
    detailHeader.replaceChildren();
    const back = document.createElement('button');
    back.className = 'back-btn';
    back.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    back.appendChild(document.createTextNode(' Back'));
    back.addEventListener('click', () => showRespondentsModal(formId));
    detailHeader.appendChild(back);

    const answersContainer = document.getElementById('respondentAnswers');
    answersContainer.replaceChildren();
    answersContainer.appendChild(Object.assign(document.createElement('p'), {
        textContent: 'Loading answers...', style: 'color:var(--text-muted);font-size:0.9rem'
    }));

    const rawAnswers = await fetchAnswersFromSupabase(respondentId);
    const answersMap = {};
    rawAnswers.forEach(a => { answersMap[a.question_id] = a.answer_value; });

    answersContainer.replaceChildren();
    form.questions.forEach((q, i) => {
        let answerText = answersMap[q.id] ?? '-';
        if (q.type === 'checkbox' && q.options && answerText !== '-') {
            answerText = answerText.split(',').map(v => {
                const opt = q.options.find(o => o.value === v);
                return opt ? opt.text : v;
            }).join(', ');
        } else if (q.type === 'multiple_choice' && q.options && answerText !== '-') {
            const opt = q.options.find(o => o.value === answerText);
            if (opt) answerText = opt.text;
        }
        const item = document.createElement('div');
        item.className = 'answer-item';
        const label = document.createElement('div');
        label.className = 'answer-question';
        label.textContent = q.type === 'section' ? 'Section' : `${i + 1}. ${q.title || 'Untitled question'}`;
        const value = document.createElement('div');
        value.className = 'answer-value';
        value.textContent = q.type === 'section' ? '-' : answerText;
        item.append(label, value);
        answersContainer.appendChild(item);
    });

    const respondentForChart = { answers: Object.fromEntries(form.questions.map(q => [q.id, answersMap[q.id]])) };
    const respondentMeta = await fetchRespondentMeta(respondentId);
    if (respondentMeta) respondentForChart.timeTaken = respondentMeta.time_taken;
    renderRespondentCharts(form, respondentForChart);
}

async function fetchRespondentMeta(respondentId) {
    try {
        const { data } = await sbClient.from('responses').select('time_taken').eq('id', respondentId).single();
        return data;
    } catch (e) { return null; }
}

function renderRespondentCharts(form, respondent) {
    const chartCanvas = document.getElementById('answerPieChart');
    const ctx = chartCanvas.getContext('2d');
    const choiceAnswers = {};
    form.questions.forEach(q => {
        if (q.type === 'multiple_choice' && q.options) {
            const answer = respondent.answers ? respondent.answers[q.id] : null;
            if (answer) {
                const opt = q.options.find(o => o.value === answer);
                if (opt) choiceAnswers[opt.text] = (choiceAnswers[opt.text] || 0) + 1;
            }
        }
    });
    ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
    const colors = ['#2D2D2D', '#6B6B6B', '#A0A0A0', '#D8D8D8', '#4DABF7', '#34e8a0', '#f5c842', '#ff6b7a'];
    const entries = Object.entries(choiceAnswers);
    const total = entries.reduce((s, [, c]) => s + c, 0) || 1;
    let startAngle = 0;
    const cx = chartCanvas.width / 2, cy = chartCanvas.height / 2;
    const radius = Math.min(cx, cy) - 10;
    entries.forEach(([, count], i) => {
        const slice = (count / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        startAngle += slice;
    });

    const timeTaken = respondent.timeTaken || 0;
    const timeStats = document.getElementById('timeStats');
    timeStats.replaceChildren();
    const stat = document.createElement('div');
    stat.className = 'time-stat';
    const value = document.createElement('div');
    value.className = 'time-value';
    value.textContent = timeTaken + ' sec';
    const label = document.createElement('div');
    label.className = 'time-label';
    label.textContent = 'Completion time';
    stat.append(value, label);
    timeStats.appendChild(stat);
}

async function fetchRespondentsFromSupabase(formId) {
    try {
        const { data, error } = await sbClient
            .from('responses')
            .select('id, time_taken, created_at')
            .eq('form_id', formId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (e) { return null; }
}

async function fetchAnswersFromSupabase(responseId) {
    try {
        const { data, error } = await sbClient
            .from('answers')
            .select('question_id, answer_value')
            .eq('response_id', responseId);
        if (error) throw error;
        return data || [];
    } catch (e) { return []; }
}

// ─────────────────────────────────────────────────────────────────────
// Form selection / settings
// ─────────────────────────────────────────────────────────────────────

function getCurrentForm() {
    return forms.find(f => f.id === currentFormId);
}

function selectForm(formId) {
    currentFormId = formId;
    const form = getCurrentForm();
    if (!form) return;
    renderFormList();
    formNameInput.value = form.name;
    formDescriptionInput.value = form.description || '';
    welcomeTitleInput.value = form.welcome.title;
    welcomeSubtitleInput.value = form.welcome.subtitle;
    resultsTitleInput.value = form.results.title;
    resultsSubtitleInput.value = form.results.subtitle;
    resultsButtonTextInput.value = form.results.buttonText || 'Try Again';
    renderQuestions();
}

function updateFormSetting() {
    const form = getCurrentForm();
    if (!form) return;
    form.name = formNameInput.value;
    form.description = formDescriptionInput.value;
    form.welcome.title = welcomeTitleInput.value;
    form.welcome.subtitle = welcomeSubtitleInput.value;
    form.results.title = resultsTitleInput.value;
    form.results.subtitle = resultsSubtitleInput.value;
    form.results.buttonText = resultsButtonTextInput.value;
    cacheForms();
    renderFormList();
}

function saveCurrentFormLocal() {
    updateFormSetting();
    cacheForms();
}

// ─────────────────────────────────────────────────────────────────────
// Questions
// ─────────────────────────────────────────────────────────────────────

function addQuestion() {
    document.getElementById('addQuestionModal').classList.add('active');
}

function confirmAddQuestion(type) {
    const form = getCurrentForm();
    if (!form) return;
    const newQ = createQuestionData(type);
    form.questions.push(newQ);
    cacheForms();
    renderQuestions();
    document.getElementById('addQuestionModal').classList.remove('active');
    setTimeout(() => {
        const items = questionsList.querySelectorAll('.question-item');
        if (items.length > 0) items[items.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

function cancelAddQuestion() {
    document.getElementById('addQuestionModal').classList.remove('active');
}

function deleteQuestion(questionId) {
    showDeleteModal(questionId);
}

// ─────────────────────────────────────────────────────────────────────
// Render: form list
// ─────────────────────────────────────────────────────────────────────

function renderFormList() {
    formList.replaceChildren();
    forms.forEach(form => {
        const item = document.createElement('div');
        item.className = 'form-item' + (form.id === currentFormId ? ' active' : '');
        item.dataset.formId = form.id;

        const main = document.createElement('div');
        main.className = 'form-item-main';
        const title = document.createElement('div');
        title.className = 'form-item-title';
        title.textContent = form.name || 'Untitled';
        const meta = document.createElement('div');
        meta.className = 'form-item-meta';
        meta.id = 'meta-' + form.id;
        meta.textContent = `${form.questions.length} questions · … respondents`;
        main.append(title, meta);

        const actions = document.createElement('div');
        actions.className = 'form-item-actions';
        actions.innerHTML = `
            <button class="icon-btn export-btn" title="Export Excel" type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </button>
            <button class="icon-btn view-btn" title="View respondents" type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="icon-btn delete-btn" title="Delete form" type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
        `;

        item.append(main, actions);
        formList.appendChild(item);
    });

    if (!currentFormId && forms.length > 0) selectForm(forms[0].id);

    // Async refresh of respondent counts
    forms.forEach(async form => {
        if (!form.id) return;
        try {
            const { count, error } = await sbClient
                .from('responses')
                .select('*', { count: 'exact', head: true })
                .eq('form_id', form.id);
            if (error || count === null) return;
            const el = document.getElementById('meta-' + form.id);
            if (el) el.textContent = `${form.questions.length} questions · ${count} respondents`;
        } catch (e) {}
    });
}

// ─────────────────────────────────────────────────────────────────────
// Render: questions
// ─────────────────────────────────────────────────────────────────────

function renderQuestions() {
    const form = getCurrentForm();
    questionsList.replaceChildren();
    if (!form) {
        questionsList.appendChild(placeholder('Select a form to edit'));
        return;
    }
    if (form.questions.length === 0) {
        questionsList.appendChild(placeholder('No questions yet', 'Add a new question'));
        return;
    }

    form.questions.forEach((q, index) => {
        const item = document.createElement('div');
        item.className = 'question-item' + (q.type === 'section' ? ' section-item' : '');
        item.dataset.id = q.id;
        item.draggable = true;
        if (q.color) {
            item.style.background = q.color + '15';
            item.style.borderColor = q.color + '40';
        }

        // Header
        const header = document.createElement('div');
        header.className = 'question-header';

        const numWrap = document.createElement('div');
        numWrap.className = 'question-number';
        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.title = 'Drag to reorder';
        handle.textContent = '⠿';
        numWrap.appendChild(handle);

        const badge = document.createElement('span');
        badge.className = 'question-badge' + (q.type === 'section' ? ' section-badge' : '');
        badge.textContent = q.type === 'section' ? 'S' : String(index + 1);
        numWrap.appendChild(badge);

        if (q.type !== 'section') {
            const select = document.createElement('select');
            select.className = 'question-type-select';
            [['multiple_choice', 'Multiple Choice'], ['checkbox', 'Checkbox'], ['text_input', 'Text Input']].forEach(([val, lbl]) => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = lbl;
                if (q.type === val) opt.selected = true;
                select.appendChild(opt);
            });
            select.addEventListener('change', e => changeQuestionType(q.id, e.target.value));
            numWrap.appendChild(select);
        }
        header.appendChild(numWrap);

        // Actions (color + delete)
        const actions = document.createElement('div');
        actions.className = 'question-actions';
        actions.style.position = 'relative';

        const dot = document.createElement('span');
        dot.className = 'color-dot' + (q.color ? '' : ' color-dot-empty');
        if (q.color) dot.style.background = q.color;
        dot.addEventListener('click', e => { e.stopPropagation(); toggleColorPicker(q.id); });
        actions.appendChild(dot);

        const picker = document.createElement('div');
        picker.className = 'color-picker-popover';
        picker.id = 'colorPicker-' + q.id;
        picker.style.display = 'none';
        COLORS.forEach(c => {
            const sw = document.createElement('span');
            sw.className = 'color-swatch' + (q.color === c ? ' active' : '');
            sw.style.background = c;
            sw.addEventListener('click', e => { e.stopPropagation(); setQuestionColor(q.id, c); });
            picker.appendChild(sw);
        });
        const remove = document.createElement('span');
        remove.className = 'color-swatch color-swatch-remove';
        remove.textContent = '✕';
        remove.addEventListener('click', e => { e.stopPropagation(); setQuestionColor(q.id, null); });
        picker.appendChild(remove);
        actions.appendChild(picker);

        const delBtn = document.createElement('button');
        delBtn.className = 'delete';
        delBtn.title = 'Delete';
        delBtn.textContent = '🗑';
        delBtn.addEventListener('click', () => deleteQuestion(q.id));
        actions.appendChild(delBtn);

        header.appendChild(actions);
        item.appendChild(header);

        // Fields
        const fields = document.createElement('div');
        fields.className = 'question-fields';
        if (q.type === 'section') {
            fields.appendChild(makeInput('text', q.title || '', 'Section title...', v => updateQuestionTitle(q.id, v)));
            fields.appendChild(makeTextarea(q.subtitle || '', 'Subtitle (optional)...', v => updateSectionSubtitle(q.id, v)));
            fields.appendChild(makeInput('text', q.buttonText || 'Continue', 'Button text...', v => updateSectionButtonText(q.id, v)));
        } else if (q.type === 'text_input') {
            fields.appendChild(makeInput('text', q.title, 'Question...', v => updateQuestionTitle(q.id, v)));
            fields.appendChild(makeInput('text', q.placeholder || '', 'Placeholder (optional)...', v => updateQuestionPlaceholder(q.id, v)));
        } else {
            fields.appendChild(makeInput('text', q.title, 'Question...', v => updateQuestionTitle(q.id, v)));
            const editor = document.createElement('div');
            editor.className = 'options-editor';
            const lbl = document.createElement('div');
            lbl.className = 'options-label';
            lbl.textContent = q.type === 'checkbox' ? 'Options (multiple selection):' : 'Options:';
            editor.appendChild(lbl);
            (q.options || []).forEach((opt, i) => {
                const row = document.createElement('div');
                row.className = 'option-item';
                const key = document.createElement('span');
                key.className = 'option-key';
                key.textContent = OPTION_KEYS[i];
                row.appendChild(key);
                const input = document.createElement('input');
                input.type = 'text';
                input.value = opt.text;
                input.placeholder = 'Option...';
                input.addEventListener('change', e => updateOptionText(q.id, i, e.target.value));
                row.appendChild(input);
                if (q.options.length > 2) {
                    const del = document.createElement('button');
                    del.className = 'option-delete-btn';
                    del.innerHTML = '&times;';
                    del.addEventListener('click', () => deleteOption(q.id, i));
                    row.appendChild(del);
                }
                editor.appendChild(row);
            });
            if (q.options.length < 8) {
                const add = document.createElement('button');
                add.className = 'add-option-btn';
                add.textContent = '+ Add Option';
                add.addEventListener('click', () => addOption(q.id));
                editor.appendChild(add);
            }
            fields.appendChild(editor);
        }

        // Image
        if (q.type !== 'section') fields.appendChild(makeImageSection(q));
        item.appendChild(fields);
        questionsList.appendChild(item);
    });
}

function placeholder(title, sub) {
    const wrap = document.createElement('div');
    wrap.className = 'placeholder-message';
    const h = document.createElement('h3');
    h.textContent = title;
    wrap.appendChild(h);
    if (sub) {
        const p = document.createElement('p');
        p.textContent = sub;
        wrap.appendChild(p);
    }
    return wrap;
}

function makeInput(type, value, placeholder, onChange) {
    const el = document.createElement('input');
    el.type = type;
    el.value = value;
    el.placeholder = placeholder;
    el.addEventListener('change', e => onChange(e.target.value));
    return el;
}

function makeTextarea(value, placeholder, onChange) {
    const el = document.createElement('textarea');
    el.placeholder = placeholder;
    el.rows = 2;
    el.value = value;
    el.addEventListener('change', e => onChange(e.target.value));
    return el;
}

function makeImageSection(q) {
    const wrap = document.createElement('div');
    wrap.className = 'question-image-section';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.id = 'imgInput-' + q.id;
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', e => handleImageUpload(q.id, e.target));

    if (q.image && q.image.url) {
        const frame = document.createElement('div');
        frame.className = 'image-preview-frame';
        frame.id = 'imgFrame-' + q.id;
        const img = document.createElement('img');
        img.src = q.image.url;
        img.style.transform = `scale(${q.image.zoom || 1}) translate(${q.image.offsetX || 0}%, ${q.image.offsetY || 0}%)`;
        img.draggable = false;
        const remove = document.createElement('button');
        remove.className = 'image-remove-btn';
        remove.title = 'Remove image';
        remove.innerHTML = '&times;';
        remove.addEventListener('click', e => { e.stopPropagation(); removeQuestionImage(q.id); });
        frame.append(img, remove);
        wrap.appendChild(frame);

        const ctrls = document.createElement('div');
        ctrls.className = 'image-controls';
        const lbl = document.createElement('span');
        lbl.className = 'image-controls-label';
        lbl.textContent = 'Zoom';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'image-zoom-slider';
        slider.min = 100;
        slider.max = 300;
        slider.value = Math.round((q.image.zoom || 1) * 100);
        const value = document.createElement('span');
        value.className = 'image-zoom-value';
        value.textContent = slider.value + '%';
        slider.addEventListener('input', e => updateImageZoom(q.id, e.target.value));
        ctrls.append(lbl, slider, value);
        wrap.appendChild(ctrls);
    } else {
        const upload = document.createElement('div');
        upload.className = 'image-upload-area';
        upload.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Add Image</span>`;
        upload.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
        wrap.appendChild(upload);
    }
    wrap.appendChild(fileInput);
    return wrap;
}

// ─────────────────────────────────────────────────────────────────────
// Question manipulation
// ─────────────────────────────────────────────────────────────────────

function changeQuestionType(questionId, newType) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (!q) return;
    const oldType = q.type;
    q.type = newType;
    const hasOptions = newType === 'multiple_choice' || newType === 'checkbox';
    const hadOptions = oldType === 'multiple_choice' || oldType === 'checkbox';
    if (hasOptions && !hadOptions) {
        q.options = [
            { text: 'Option A', value: 'opt_a' },
            { text: 'Option B', value: 'opt_b' },
            { text: 'Option C', value: 'opt_c' },
            { text: 'Option D', value: 'opt_d' }
        ];
        delete q.placeholder;
        delete q.subtitle;
        delete q.buttonText;
    } else if (!hasOptions && hadOptions) {
        if (newType === 'text_input') q.placeholder = q.placeholder || '';
        delete q.options;
    }
    cacheForms();
    renderQuestions();
}

function updateQuestionTitle(questionId, title) { updateQ(questionId, q => q.title = title); }
function updateQuestionPlaceholder(questionId, placeholder) { updateQ(questionId, q => q.placeholder = placeholder); }
function updateSectionSubtitle(questionId, subtitle) { updateQ(questionId, q => q.subtitle = subtitle); }
function updateSectionButtonText(questionId, text) { updateQ(questionId, q => q.buttonText = text); }

function updateQ(questionId, mutator) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (q) { mutator(q); cacheForms(); }
}

function toggleColorPicker(questionId) {
    document.querySelectorAll('.color-picker-popover').forEach(p => {
        if (p.id !== 'colorPicker-' + questionId) p.style.display = 'none';
    });
    const picker = document.getElementById('colorPicker-' + questionId);
    if (picker) picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
}

function setQuestionColor(questionId, color) {
    updateQ(questionId, q => q.color = color);
    renderQuestions();
}

function updateOptionText(questionId, optionIndex, text) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (q && q.options && q.options[optionIndex]) {
        q.options[optionIndex].text = text;
        q.options[optionIndex].value = text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `opt_${optionIndex}`;
        cacheForms();
    }
}

function addOption(questionId) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (q && q.options && q.options.length < 8) {
        const i = q.options.length;
        const key = OPTION_KEYS[i];
        q.options.push({ text: `Option ${key}`, value: `opt_${key.toLowerCase()}` });
        cacheForms();
        renderQuestions();
    }
}

function deleteOption(questionId, optionIndex) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (q && q.options && q.options.length > 2) {
        q.options.splice(optionIndex, 1);
        cacheForms();
        renderQuestions();
    }
}

// ─────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────

async function persistFormToSupabase(form) {
    if (!sbClient || !currentUser) return null;
    try {
        const formData = {
            owner_id: currentUser.id,
            name: form.name || 'New Form',
            description: form.description || '',
            welcome_title: form.welcome.title,
            welcome_subtitle: form.welcome.subtitle,
            results_title: form.results.title,
            results_subtitle: form.results.subtitle,
            results_button_text: form.results.buttonText
        };

        let formId = form.id && !String(form.id).startsWith('tmp_') ? form.id : null;
        if (formId) {
            const { error } = await sbClient.from('forms').update(formData).eq('id', formId);
            if (error) throw error;
        } else {
            const { data, error } = await sbClient.from('forms').insert(formData).select().single();
            if (error) throw error;
            formId = data.id;
        }

        // Resync questions: keep existing UUIDs, add new ones, drop deleted ones.
        const { data: existing } = await sbClient.from('questions').select('id').eq('form_id', formId);
        const existingIds = new Set((existing || []).map(q => q.id));
        const keepIds = new Set(form.questions.filter(q => q.id && !String(q.id).startsWith('tmp_')).map(q => q.id));
        const toDelete = [...existingIds].filter(id => !keepIds.has(id));
        if (toDelete.length > 0) await sbClient.from('questions').delete().in('id', toDelete);

        // Upsert each question with a stable order
        const ops = form.questions.map((q, i) => buildQuestionRow(formId, q, i + 1));
        const toInsert = ops.filter(op => op.isNew).map(op => op.row);
        const toUpdate = ops.filter(op => !op.isNew);

        if (toInsert.length > 0) {
            const { data: inserted, error } = await sbClient.from('questions').insert(toInsert).select();
            if (error) throw error;
            // Map tmp ids → real UUIDs
            ops.filter(op => op.isNew).forEach((op, idx) => {
                const newId = inserted[idx]?.id;
                if (newId) {
                    const q = form.questions.find(qq => qq.id === op.tmpId);
                    if (q) q.id = newId;
                }
            });
        }
        for (const op of toUpdate) {
            await sbClient.from('questions').update(op.row).eq('id', op.id);
        }

        form.id = formId;
        return formId;
    } catch (e) {
        console.error('persistFormToSupabase error:', e);
        return null;
    }
}

function buildQuestionRow(formId, q, order) {
    const isNew = !q.id || String(q.id).startsWith('tmp_');
    const row = {
        form_id: formId,
        question_order: order,
        question_type: q.type,
        title: q.title || '',
        placeholder: q.type === 'text_input' ? (q.placeholder || null) : null,
        subtitle: q.type === 'section' ? (q.subtitle || null) : null,
        button_text: q.type === 'section' ? (q.buttonText || null) : null,
        color: q.color || null,
        image: q.image || null,
        options: (q.type === 'multiple_choice' || q.type === 'checkbox') ? (q.options || []) : null
    };
    return isNew ? { isNew: true, row, tmpId: q.id } : { isNew: false, row, id: q.id };
}

function showToast(message, isError = false) {
    const existing = document.getElementById('editor-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'editor-toast';
    toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${isError ? '#c0392b' : '#2e7d32'};color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;z-index:9999;pointer-events:none`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

async function saveCurrentForm() {
    saveCurrentFormLocal();
    const form = getCurrentForm();
    if (!form) return;
    const validation = validateFormForShare(form);
    if (!validation.ok) {
        showToast(validation.message, true);
        return;
    }
    const saveBtn = document.getElementById('saveBtn');
    const original = saveBtn.textContent;
    saveBtn.textContent = 'Saving…';
    saveBtn.disabled = true;
    const id = await persistFormToSupabase(form);
    saveBtn.textContent = original;
    saveBtn.disabled = false;
    if (id) {
        cacheForms();
        renderQuestions();
        showToast('Form saved');
    } else {
        showToast('Save failed', true);
    }
}

// ─────────────────────────────────────────────────────────────────────
// Excel export — lazy-load SheetJS
// ─────────────────────────────────────────────────────────────────────

async function downloadFormExcel(formId) {
    const form = forms.find(f => f.id === formId);
    if (!form) return;
    showToast('Preparing Excel file...');

    if (typeof XLSX === 'undefined') {
        try {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'xlsx.full.min.js';
                s.onload = resolve;
                s.onerror = () => reject(new Error('Failed to load SheetJS'));
                document.head.appendChild(s);
            });
        } catch (e) {
            showToast('Failed to load Excel library', true);
            return;
        }
    }
    if (typeof XLSX === 'undefined') {
        showToast('Failed to load Excel library', true);
        return;
    }

    const respondents = await fetchRespondentsFromSupabase(formId) || [];
    const answersByResp = {};
    for (const r of respondents) {
        answersByResp[r.id] = await fetchAnswersFromSupabase(r.id);
    }

    const qList = form.questions;
    const fmt = v => (v === null || v === undefined || v === '') ? '-' : String(v);

    const summary = [
        ['Formure — Summary'],
        [],
        ['Form Name', form.name || 'Untitled'],
        ['Total Questions', qList.length],
        ['Total Respondents', respondents.length],
        ['Average Time', respondents.length > 0
            ? Math.round(respondents.reduce((s, r) => s + (r.time_taken || 0), 0) / respondents.length) + ' sec'
            : '-'],
        ['First Respondent', respondents.length > 0 && respondents[respondents.length - 1].created_at
            ? new Date(respondents[respondents.length - 1].created_at).toLocaleString()
            : '-'],
        ['Last Respondent', respondents.length > 0 && respondents[0].created_at
            ? new Date(respondents[0].created_at).toLocaleString()
            : '-']
    ];

    const respHeader = ['#', 'Submitted At', 'Duration (sec)', ...qList.map((q, i) => `Q${i + 1}: ${fmt(q.title)}`)];
    const respRows = respondents.map((r, i) => {
        const ts = r.created_at ? new Date(r.created_at).toLocaleString() : '-';
        const dur = r.time_taken ?? '-';
        const ansMap = {};
        (answersByResp[r.id] || []).forEach(a => { ansMap[a.question_id] = a.answer_value; });
        const qAnswers = qList.map(q => {
            if (q.type === 'section') return '-';
            const val = ansMap[q.id] ?? '-';
            if (val === '-' || val === null) return '-';
            if ((q.type === 'multiple_choice' || q.type === 'checkbox') && q.options) {
                if (q.type === 'checkbox') {
                    return val.split(',').map(v => {
                        const opt = q.options.find(o => o.value === v);
                        return opt ? opt.text : v;
                    }).join(', ');
                }
                const opt = q.options.find(o => o.value === val);
                return opt ? opt.text : val;
            }
            return fmt(val);
        });
        return [i + 1, ts, dur, ...qAnswers];
    });

    const distHeader = ['Question', 'Option / Value', 'Count', 'Percentage'];
    const distRows = [];
    qList.forEach((q, qi) => {
        if (q.type === 'section') {
            distRows.push([`Section ${qi + 1}: ${fmt(q.title)}`, '(Section)', '-', '-']);
        } else if ((q.type === 'multiple_choice' || q.type === 'checkbox') && q.options) {
            const answersForQ = respondents.flatMap(r => {
                const v = (answersByResp[r.id] || []).find(a => a.question_id === q.id);
                if (!v) return [];
                return q.type === 'checkbox' ? v.answer_value.split(',') : [v.answer_value];
            });
            q.options.forEach(opt => {
                const count = answersForQ.filter(v => v === opt.value).length;
                const pct = answersForQ.length > 0 ? ((count / answersForQ.length) * 100).toFixed(1) + '%' : '0%';
                distRows.push([`Q${qi + 1}: ${fmt(q.title)}`, opt.text, count, pct]);
            });
        } else {
            distRows.push([`Q${qi + 1}: ${fmt(q.title)}`, '(Text input)', '-', '-']);
        }
    });

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.aoa_to_sheet(summary);
    const wsResp = XLSX.utils.aoa_to_sheet([respHeader, ...respRows]);
    const wsDist = XLSX.utils.aoa_to_sheet([distHeader, ...distRows]);
    wsResp['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 14 }, ...qList.map(() => ({ wch: 25 }))];
    wsDist['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    XLSX.utils.book_append_sheet(wb, wsResp, 'Respondents');
    XLSX.utils.book_append_sheet(wb, wsDist, 'Distribution');
    const filename = `Formure_${(form.name || 'form').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast('Excel downloaded');
}

// ─────────────────────────────────────────────────────────────────────
// Image upload + pan
// ─────────────────────────────────────────────────────────────────────

async function handleImageUpload(questionId, input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (!q) return;
    if (file.size > 10 * 1024 * 1024) {
        showToast('Image too large (max 10 MB)', true);
        return;
    }
    let processedFile = file;
    if (file.size > 2 * 1024 * 1024) {
        try { processedFile = await compressImage(file, 1200); } catch (e) {}
    }
    if (sbClient && form.id && !String(form.id).startsWith('tmp_')) {
        try {
            const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
            const path = `form-images/${form.id}/${questionId}_${Date.now()}.${ext}`;
            const { error } = await sbClient.storage.from('form-images').upload(path, processedFile, { upsert: true, contentType: file.type });
            if (error) throw error;
            const { data: urlData } = sbClient.storage.from('form-images').getPublicUrl(path);
            q.image = { url: urlData.publicUrl, zoom: 1, offsetX: 0, offsetY: 0 };
        } catch (e) {
            const url = await fileToBase64(processedFile);
            q.image = { url, zoom: 1, offsetX: 0, offsetY: 0 };
            showToast('Stored image inline (Supabase upload failed)', true);
        }
    } else {
        const url = await fileToBase64(processedFile);
        q.image = { url, zoom: 1, offsetX: 0, offsetY: 0 };
    }
    cacheForms();
    renderQuestions();
    input.value = '';
}

function compressImage(file, maxWidth) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            if (w > maxWidth) {
                h = Math.round(h * maxWidth / w);
                w = maxWidth;
            }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), 'image/jpeg', 0.85);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function updateImageZoom(questionId, value) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (!q || !q.image) return;
    q.image.zoom = value / 100;
    cacheForms();
    const frame = document.getElementById('imgFrame-' + questionId);
    if (frame) {
        const img = frame.querySelector('img');
        if (img) img.style.transform = `scale(${q.image.zoom}) translate(${q.image.offsetX}%, ${q.image.offsetY}%)`;
        const label = frame.parentElement.querySelector('.image-zoom-value');
        if (label) label.textContent = value + '%';
    }
}

async function removeQuestionImage(questionId) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (!q || !q.image) return;
    if (sbClient && q.image.url && !q.image.url.startsWith('data:')) {
        try {
            const url = new URL(q.image.url);
            const parts = url.pathname.split('/storage/v1/object/public/form-images/');
            if (parts[1]) await sbClient.storage.from('form-images').remove([parts[1]]);
        } catch (e) {}
    }
    q.image = null;
    cacheForms();
    renderQuestions();
}

function setupImagePan() {
    let panState = null;
    document.addEventListener('mousedown', e => {
        const frame = e.target.closest('.image-preview-frame');
        if (!frame) return;
        e.preventDefault();
        const idStr = frame.id.replace('imgFrame-', '');
        const form = getCurrentForm();
        const q = form && form.questions.find(qq => String(qq.id) === idStr);
        if (!q || !q.image) return;
        panState = { questionId: q.id, startX: e.clientX, startY: e.clientY, startOX: q.image.offsetX || 0, startOY: q.image.offsetY || 0 };
        frame.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', e => {
        if (!panState) return;
        const form = getCurrentForm();
        const q = form && form.questions.find(qq => qq.id === panState.questionId);
        if (!q || !q.image) return;
        const dx = (e.clientX - panState.startX) / 2;
        const dy = (e.clientY - panState.startY) / 2;
        q.image.offsetX = Math.max(-50, Math.min(50, panState.startOX + dx));
        q.image.offsetY = Math.max(-50, Math.min(50, panState.startOY + dy));
        const frame = document.getElementById('imgFrame-' + q.id);
        if (frame) {
            const img = frame.querySelector('img');
            if (img) img.style.transform = `scale(${q.image.zoom}) translate(${q.image.offsetX}%, ${q.image.offsetY}%)`;
        }
    });
    document.addEventListener('mouseup', () => {
        if (panState) {
            cacheForms();
            const frame = document.getElementById('imgFrame-' + panState.questionId);
            if (frame) frame.style.cursor = '';
            panState = null;
        }
    });
}
