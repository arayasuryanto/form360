// Form Editor JavaScript

const SUPABASE_URL = 'https://ientctrogwvbjyznyvie.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ro6aUrWPrD72pa2qN4I7JQ_JHC8zneU';
let sbClient = null;

// State
let forms = [];
let currentFormId = null;
let questionToDelete = null;
const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// DOM Elements
const formList = document.getElementById('formList');
const editorPanel = document.getElementById('editorPanel');
const formNameInput = document.getElementById('formName');
const formDescriptionInput = document.getElementById('formDescription');
const welcomeTitleInput = document.getElementById('welcomeTitle');
const welcomeSubtitleInput = document.getElementById('welcomeSubtitle');
const resultsTitleInput = document.getElementById('resultsTitle');
const resultsSubtitleInput = document.getElementById('resultsSubtitle');
const resultsButtonTextInput = document.getElementById('resultsButtonText');
const questionsList = document.getElementById('questionsList');

// Modal elements
const previewModal = document.getElementById('previewModal');
const newFormModal = document.getElementById('newFormModal');
const deleteModal = document.getElementById('deleteModal');
const previewFrame = document.getElementById('previewFrame');
const respondentsModal = document.getElementById('respondentsModal');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }
    } catch (e) {
        console.error('Supabase init error:', e);
    }
    try {
        await loadForms();
    } catch (e) {
        console.error('loadForms error:', e);
        forms = [createNewFormData()];
    }
    setupEventListeners();
    renderFormList();
}

async function loadForms() {
    // Load local first so editor is responsive immediately
    const saved = localStorage.getItem('form360_forms');
    if (saved) {
        forms = JSON.parse(saved);
    } else {
        forms = [createNewFormData()];
    }

    // Sync from Supabase: pull any forms saved by other editors
    if (sbClient) {
        try {
            const { data: remoteForms, error } = await sbClient
                .from('forms')
                .select('*')
                .order('created_at', { ascending: true });

            if (!error && remoteForms && remoteForms.length > 0) {
                remoteForms.forEach(rf => {
                    // Skip if we already have this form (matched by supabaseId)
                    const alreadyHave = forms.some(f => f.supabaseId === rf.id);
                    if (alreadyHave) return;

                    // Fetch its questions
                    fetchQuestionsForForm(rf.id).then(questions => {
                        const localForm = {
                            id: rf.id,            // use supabase UUID as local id for consistency
                            supabaseId: rf.id,
                            name: rf.name || 'Tanpa Nama',
                            description: rf.description || '',
                            welcome: {
                                title: rf.welcome_title || 'Halo, Selamat Datang!',
                                subtitle: rf.welcome_subtitle || 'Tekan Mulai atau Enter untuk memulai'
                            },
                            results: {
                                title: rf.results_title || 'Terima Kasih!',
                                subtitle: rf.results_subtitle || 'Kamu telah menyelesaikan form ini',
                                buttonText: rf.results_button_text || 'Ikuti Lagi'
                            },
                            questions: questions
                        };
                        forms.push(localForm);
                        saveForms();
                        renderFormList();
                    });
                });
            }
        } catch (e) {
            console.error('loadForms Supabase sync error:', e);
        }
    }
}

async function fetchQuestionsForForm(supabaseFormId) {
    if (!sbClient) return [];
    try {
        const { data, error } = await sbClient
            .from('questions')
            .select('*')
            .eq('form_id', supabaseFormId)
            .order('question_order', { ascending: true });
        if (error) throw error;
        return (data || []).map((q, i) => {
            const base = {
                id: i + 1,
                type: q.question_type,
                title: q.title || '',
                placeholder: q.placeholder || ''
            };
            if (q.question_type === 'multiple_choice' && q.options) {
                base.options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
            }
            return base;
        });
    } catch (e) {
        console.error('fetchQuestionsForForm error:', e);
        return [];
    }
}

function saveForms() {
    localStorage.setItem('form360_forms', JSON.stringify(forms));
}

function createNewFormData(name = 'Form Baru') {
    return {
        id: Date.now().toString(),
        name: name,
        description: '',
        welcome: {
            title: 'Halo, Selamat Datang!',
            subtitle: 'Tekan Mulai atau Enter untuk memulai'
        },
        results: {
            title: 'Terima Kasih!',
            subtitle: 'Kamu telah menyelesaikan form ini',
            buttonText: 'Ikuti Lagi'
        },
        questions: [
            createQuestionData(1, 'multiple_choice'),
            createQuestionData(2, 'multiple_choice')
        ]
    };
}

function createQuestionData(id, type = 'multiple_choice') {
    const base = {
        id: id,
        type: type,
        title: ''
    };

    if (type === 'multiple_choice') {
        base.options = [
            { text: 'Opsi A', value: 'opt_a' },
            { text: 'Opsi B', value: 'opt_b' },
            { text: 'Opsi C', value: 'opt_c' },
            { text: 'Opsi D', value: 'opt_d' }
        ];
    } else {
        base.placeholder = 'ketik jawaban kamu di sini...';
        // hint is now hardcoded in viewer, not editable
    }

    return base;
}

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

    if (formNameInput) formNameInput.addEventListener('input', updateFormSetting);
    if (formDescriptionInput) formDescriptionInput.addEventListener('input', updateFormSetting);
    if (welcomeTitleInput) welcomeTitleInput.addEventListener('input', updateFormSetting);
    if (welcomeSubtitleInput) welcomeSubtitleInput.addEventListener('input', updateFormSetting);
    if (resultsTitleInput) resultsTitleInput.addEventListener('input', updateFormSetting);
    if (resultsSubtitleInput) resultsSubtitleInput.addEventListener('input', updateFormSetting);
    if (resultsButtonTextInput) resultsButtonTextInput.addEventListener('input', updateFormSetting);

    if (previewModal) previewModal.addEventListener('click', (e) => { if (e.target === previewModal) hidePreview(); });
    if (respondentsModal) respondentsModal.addEventListener('click', (e) => { if (e.target === respondentsModal) hideRespondentsModal(); });
}

function showNewFormModal() {
    document.getElementById('newFormName').value = '';
    newFormModal.classList.add('active');
    setTimeout(() => document.getElementById('newFormName').focus(), 100);
}

function hideNewFormModal() {
    newFormModal.classList.remove('active');
}

function createNewForm() {
    const name = document.getElementById('newFormName').value.trim() || 'Form Baru';
    const newForm = createNewFormData(name);
    forms.push(newForm);
    saveForms();
    renderFormList();
    selectForm(newForm.id);
    hideNewFormModal();
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
        // Renumber remaining questions
        form.questions.forEach((q, i) => q.id = i + 1);
        saveForms();
        renderQuestions();
        renderFormList();
    }
    hideDeleteModal();
}

function showPreview() {
    saveCurrentForm();
    const form = getCurrentForm();
    if (form) {
        // Save to localStorage for preview
        localStorage.setItem('form360_preview', JSON.stringify(form));
        previewFrame.src = 'viewer.html?preview=true';
        previewModal.classList.add('active');
    }
}

function hidePreview() {
    previewModal.classList.remove('active');
    previewFrame.src = '';
}

async function showShareModal() {
    const form = getCurrentForm();
    if (!form) return;

    const shareBtn = document.getElementById('shareBtn');
    const originalHtml = shareBtn.innerHTML;
    shareBtn.innerHTML = 'Menyimpan...';
    shareBtn.disabled = true;

    const baseUrl = window.location.origin + '/viewer.html';
    let shareLink;

    // Save to Supabase for a clean UUID-based link
    const supabaseId = await saveFormToSupabase(form);
    saveForms();

    if (supabaseId) {
        shareLink = `${baseUrl}?form=${supabaseId}`;
    } else {
        // Fallback: Unicode-safe base64 URL
        const formJson = JSON.stringify(form);
        const encodedData = btoa(unescape(encodeURIComponent(formJson)));
        shareLink = `${baseUrl}?data=${encodeURIComponent(encodedData)}`;
    }

    shareBtn.innerHTML = originalHtml;
    shareBtn.disabled = false;

    document.getElementById('shareLink').value = shareLink;
    document.getElementById('shareModal').classList.add('active');
}

function hideShareModal() {
    document.getElementById('shareModal').classList.remove('active');
}

function copyShareLink() {
    const shareLinkInput = document.getElementById('shareLink');
    shareLinkInput.select();
    navigator.clipboard.writeText(shareLinkInput.value).then(() => {
        const copyBtn = document.getElementById('copyLinkBtn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Tersalin!';
        copyBtn.style.background = '#2e7d32';
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = '';
        }, 2000);
    });
}

async function showRespondentsModal(formId) {
    const form = forms.find(f => f.id === formId);
    if (!form) return;

    document.getElementById('respondentsFormName').textContent = form.name;
    document.getElementById('respondentDetail').style.display = 'none';
    document.getElementById('respondentsList').style.display = 'block';
    respondentsModal.classList.add('active');

    const respondentsList = document.getElementById('respondentsList');
    respondentsList.innerHTML = '<div class="empty-respondents"><p>Memuat...</p></div>';

    // Try Supabase first, fall back to localStorage
    let respondents = null;
    if (sbClient && form.supabaseId) {
        respondents = await fetchRespondentsFromSupabase(form.supabaseId);
    }
    if (respondents === null) {
        respondents = getRespondentsForForm(formId);
    }

    if (respondents.length === 0) {
        respondentsList.innerHTML = '<div class="empty-respondents"><p>Belum ada responden</p></div>';
    } else {
        respondentsList.innerHTML = respondents.map((r, i) => {
            const ts = r.created_at ? new Date(r.created_at).toLocaleString('id-ID') : new Date(r.timestamp).toLocaleString('id-ID');
            const duration = r.time_taken ?? r.timeTaken ?? '?';
            return `
                <div class="respondent-item" onclick="showRespondentDetail('${formId}', '${r.id}')">
                    <div class="respondent-info">
                        <span class="respondent-number">#${i + 1}</span>
                        <span class="respondent-time">${ts}</span>
                    </div>
                    <div class="respondent-actions">
                        <span class="time-badge">${duration} detik</span>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M6 12l4-4-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                </div>
            `;
        }).join('');
    }
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
    detailHeader.innerHTML = `
        <button class="back-btn" onclick="showRespondentsModal('${formId}')">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Kembali
        </button>
    `;

    const answersContainer = document.getElementById('respondentAnswers');
    answersContainer.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Memuat jawaban...</p>';

    let answersMap = {};

    if (sbClient && form.supabaseId) {
        // Load answers from Supabase
        const rawAnswers = await fetchAnswersFromSupabase(respondentId);
        rawAnswers.forEach(a => { answersMap[a.question_id] = a.answer_value; });

        // Build reverse map: local question id → supabase uuid
        const qIdMap = form.supabaseQuestionIds || {};

        answersContainer.innerHTML = form.questions.map((q, i) => {
            const supabaseQId = qIdMap[q.id];
            const answerText = (supabaseQId && answersMap[supabaseQId]) || '-';
            return `
                <div class="answer-item">
                    <div class="answer-question">${i + 1}. ${q.title || 'Pertanyaan tanpa judul'}</div>
                    <div class="answer-value">${answerText}</div>
                </div>
            `;
        }).join('');

        // Minimal chart placeholder using supabase data
        renderRespondentCharts(form, { answers: Object.fromEntries(
            form.questions.map(q => [q.id, answersMap[qIdMap[q.id]]])
        )});
    } else {
        const respondent = getRespondentData(formId, respondentId);
        if (respondent) {
            answersContainer.innerHTML = form.questions.map((q, i) => {
                const answer = respondent.answers ? respondent.answers[q.id] : null;
                return `
                    <div class="answer-item">
                        <div class="answer-question">${i + 1}. ${q.title || 'Pertanyaan tanpa judul'}</div>
                        <div class="answer-value">${answer || '-'}</div>
                    </div>
                `;
            }).join('');
            renderRespondentCharts(form, respondent);
        }
    }
}

function showRespondentsList(formId) {
    document.getElementById('respondentsList').style.display = 'block';
    document.getElementById('respondentDetail').style.display = 'none';
}

function renderRespondentCharts(form, respondent) {
    // Simple pie chart based on answer distribution
    const chartCanvas = document.getElementById('answerPieChart');
    const ctx = chartCanvas.getContext('2d');

    // Count multiple choice answers
    const choiceAnswers = {};
    form.questions.forEach(q => {
        if (q.type === 'multiple_choice' && q.options) {
            const answer = respondent.answers ? respondent.answers[q.id] : null;
            if (answer) {
                const opt = q.options.find(o => o.value === answer);
                if (opt) {
                    choiceAnswers[opt.text] = (choiceAnswers[opt.text] || 0) + 1;
                }
            }
        }
    });

    // Clear canvas
    ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);

    // Draw simple pie chart
    const colors = ['#2D2D2D', '#6B6B6B', '#A0A0A0', '#D8D8D8', '#4DABF7', '#34e8a0', '#f5c842', '#ff6b7a'];
    const entries = Object.entries(choiceAnswers);
    const total = entries.reduce((sum, [, count]) => sum + count, 0) || 1;

    let startAngle = 0;
    const centerX = chartCanvas.width / 2;
    const centerY = chartCanvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    entries.forEach(([label, count], i) => {
        const sliceAngle = (count / total) * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();

        startAngle = endAngle;
    });

    // Time chart
    const timeTaken = respondent.timeTaken || 0;
    const avgTime = getAverageTimeForForm(form.id) || 1;
    const timeComparison = timeTaken / avgTime;

    const timeChartHtml = `
        <div class="time-stat">
            <div class="time-value">${timeTaken} detik</div>
            <div class="time-label">Waktu pengerjaan</div>
        </div>
        <div class="time-stat">
            <div class="time-value">${avgTime.toFixed(0)} detik</div>
            <div class="time-label">Rata-rata</div>
        </div>
        <div class="time-stat ${timeComparison > 1.5 ? 'slow' : timeComparison < 0.5 ? 'fast' : ''}">
            <div class="time-value">${timeComparison > 1 ? '+' : ''}${((timeComparison - 1) * 100).toFixed(0)}%</div>
            <div class="time-label">vs rata-rata</div>
        </div>
    `;
    document.getElementById('timeStats').innerHTML = timeChartHtml;
}

function getRespondentsForForm(formId) {
    const allRespondents = JSON.parse(localStorage.getItem('form360_respondents') || '[]');
    return allRespondents.filter(r => r.formId === formId).sort((a, b) => b.timestamp - a.timestamp);
}

function getRespondentData(formId, respondentId) {
    const respondents = getRespondentsForForm(formId);
    return respondents.find(r => r.id === respondentId);
}

function getAverageTimeForForm(formId) {
    const respondents = getRespondentsForForm(formId);
    if (respondents.length === 0) return 0;
    const total = respondents.reduce((sum, r) => sum + (r.timeTaken || 0), 0);
    return total / respondents.length;
}

async function fetchRespondentsFromSupabase(supabaseFormId) {
    if (!sbClient || !supabaseFormId) return null;
    try {
        const { data, error } = await sbClient
            .from('responses')
            .select('id, time_taken, created_at')
            .eq('form_id', supabaseFormId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('fetchRespondents error:', e);
        return null;
    }
}

async function fetchAnswersFromSupabase(responseId) {
    if (!sbClient) return [];
    try {
        const { data, error } = await sbClient
            .from('answers')
            .select('question_id, answer_value')
            .eq('response_id', responseId);
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('fetchAnswers error:', e);
        return [];
    }
}

function getCurrentForm() {
    return forms.find(f => f.id === currentFormId);
}

function selectForm(formId) {
    currentFormId = formId;
    const form = getCurrentForm();
    if (!form) return;

    // Update form list selection
    renderFormList();

    // Populate editor fields
    formNameInput.value = form.name;
    formDescriptionInput.value = form.description || '';
    welcomeTitleInput.value = form.welcome.title;
    welcomeSubtitleInput.value = form.welcome.subtitle;
    resultsTitleInput.value = form.results.title;
    resultsSubtitleInput.value = form.results.subtitle;
    resultsButtonTextInput.value = form.results.buttonText || 'Ikuti Lagi';

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

    saveForms();
    renderFormList();
}

function addQuestion() {
    const form = getCurrentForm();
    if (!form) return;

    const newId = form.questions.length + 1;
    const newQuestion = createQuestionData(newId, 'multiple_choice');
    form.questions.push(newQuestion);
    saveForms();
    renderQuestions();
}

function deleteQuestion(questionId) {
    showDeleteModal(questionId);
}

function renderFormList() {
    formList.innerHTML = forms.map(form => {
        const isActive = form.id === currentFormId;
        const questionCount = form.questions.length;
        const localCount = getRespondentsForForm(form.id).length;
        return `
            <div class="form-item ${isActive ? 'active' : ''}">
                <div class="form-item-main" onclick="selectForm('${form.id}')">
                    <div class="form-item-title">${form.name || 'Tanpa Nama'}</div>
                    <div class="form-item-meta" id="meta-${form.id}">${questionCount} pertanyaan · ${localCount} responden</div>
                </div>
                <div class="form-item-actions">
                    <button class="icon-btn view-btn" onclick="event.stopPropagation(); showRespondentsModal('${form.id}')" title="Lihat Responden">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Auto-select first form if none selected
    if (!currentFormId && forms.length > 0) {
        selectForm(forms[0].id);
    }

    // Async: refresh counts from Supabase
    forms.forEach(async form => {
        if (!sbClient || !form.supabaseId) return;
        try {
            const { count, error } = await sbClient
                .from('responses')
                .select('*', { count: 'exact', head: true })
                .eq('form_id', form.supabaseId);
            if (error || count === null) return;
            const el = document.getElementById(`meta-${form.id}`);
            if (el) el.textContent = `${form.questions.length} pertanyaan · ${count} responden`;
        } catch (e) {}
    });
}

function renderQuestions() {
    const form = getCurrentForm();
    if (!form) {
        questionsList.innerHTML = '<div class="placeholder-message"><h3>Pilih form untuk diedit</h3></div>';
        return;
    }

    if (form.questions.length === 0) {
        questionsList.innerHTML = '<div class="placeholder-message"><h3>Belum ada pertanyaan</h3><p>Tambahkan pertanyaan baru</p></div>';
        return;
    }

    questionsList.innerHTML = form.questions.map((q, index) => `
        <div class="question-item" data-id="${q.id}">
            <div class="question-header">
                <div class="question-number">
                    <span class="question-badge">${q.id}</span>
                    <select class="question-type-select" onchange="changeQuestionType(${q.id}, this.value)">
                        <option value="multiple_choice" ${q.type === 'multiple_choice' ? 'selected' : ''}>Pilihan Ganda</option>
                        <option value="text_input" ${q.type === 'text_input' ? 'selected' : ''}>Isian Teks</option>
                    </select>
                </div>
                <div class="question-actions">
                    <button class="delete" onclick="deleteQuestion(${q.id})" title="Hapus">🗑</button>
                </div>
            </div>
            <div class="question-fields">
                <input type="text" value="${q.title}" placeholder="Pertanyaan..." onchange="updateQuestionTitle(${q.id}, this.value)">
                ${q.type === 'text_input' ? `
                    <input type="text" value="${q.placeholder || ''}" placeholder="Placeholder (opsional)..." onchange="updateQuestionPlaceholder(${q.id}, this.value)">
                ` : `
                    <div class="options-editor">
                        <div class="options-label">Opsi:</div>
                        ${q.options.map((opt, i) => `
                            <div class="option-item">
                                <span class="option-key">${OPTION_KEYS[i]}</span>
                                <input type="text" value="${opt.text}" placeholder="Opsi..." onchange="updateOptionText(${q.id}, ${i}, this.value)">
                                <button class="option-delete-btn" onclick="deleteOption(${q.id}, ${i})">&times;</button>
                            </div>
                        `).join('')}
                        ${q.options.length < 8 ? `<button class="add-option-btn" onclick="addOption(${q.id})">+ Tambah Opsi</button>` : ''}
                    </div>
                `}
            </div>
        </div>
    `).join('');
}

// Question manipulation functions
function changeQuestionType(questionId, newType) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (!q) return;

    const oldType = q.type;
    q.type = newType;

    if (newType === 'text_input' && oldType === 'multiple_choice') {
        q.placeholder = q.placeholder || '';
        // hint is now hardcoded
        delete q.options;
    } else if (newType === 'multiple_choice' && oldType === 'text_input') {
        q.options = [
            { text: 'Opsi A', value: 'opt_a' },
            { text: 'Opsi B', value: 'opt_b' },
            { text: 'Opsi C', value: 'opt_c' },
            { text: 'Opsi D', value: 'opt_d' }
        ];
        delete q.placeholder;
        delete q.hint;
    }

    saveForms();
    renderQuestions();
}

function updateQuestionTitle(questionId, title) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (q) {
        q.title = title;
        saveForms();
    }
}

function updateQuestionPlaceholder(questionId, placeholder) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (q) {
        q.placeholder = placeholder;
        saveForms();
    }
}

function updateOptionText(questionId, optionIndex, text) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (q && q.options && q.options[optionIndex]) {
        q.options[optionIndex].text = text;
        q.options[optionIndex].value = text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        saveForms();
    }
}

function addOption(questionId) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (q && q.options && q.options.length < 8) {
        const newIndex = q.options.length;
        const key = OPTION_KEYS[newIndex];
        q.options.push({ text: `Opsi ${key}`, value: `opt_${key.toLowerCase()}` });
        saveForms();
        renderQuestions();
    }
}

function deleteOption(questionId, optionIndex) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (q && q.options && q.options.length > 2) {
        q.options.splice(optionIndex, 1);
        saveForms();
        renderQuestions();
    }
}

async function saveFormToSupabase(form) {
    if (!sbClient) return null;
    try {
        const formData = {
            name: form.name || 'Form Baru',
            description: form.description || '',
            welcome_title: form.welcome.title,
            welcome_subtitle: form.welcome.subtitle,
            results_title: form.results.title,
            results_subtitle: form.results.subtitle,
            results_button_text: form.results.buttonText
        };

        let supabaseId = form.supabaseId;
        if (supabaseId) {
            const { error } = await sbClient.from('forms').update(formData).eq('id', supabaseId);
            if (error) throw error;
        } else {
            const { data, error } = await sbClient.from('forms').insert(formData).select().single();
            if (error) throw error;
            supabaseId = data.id;
            form.supabaseId = supabaseId;
        }

        // Replace questions: delete old, insert new
        await sbClient.from('questions').delete().eq('form_id', supabaseId);
        const questionsToInsert = form.questions.map((q, i) => ({
            form_id: supabaseId,
            question_order: i + 1,
            question_type: q.type,
            title: q.title,
            placeholder: q.placeholder || null,
            options: q.options ? JSON.stringify(q.options) : null
        }));
        if (questionsToInsert.length > 0) {
            const { data: qData, error: qErr } = await sbClient.from('questions').insert(questionsToInsert).select();
            if (qErr) throw qErr;
            // Map local question IDs to Supabase UUIDs for response linking
            form.supabaseQuestionIds = {};
            (qData || []).forEach((sq, i) => {
                form.supabaseQuestionIds[form.questions[i].id] = sq.id;
            });
        }

        return supabaseId;
    } catch (e) {
        console.error('Supabase save error:', e);
        return null;
    }
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
    updateFormSetting();
    saveForms();
    const form = getCurrentForm();
    if (!form) return;
    const saveBtn = document.getElementById('saveBtn');
    const original = saveBtn.textContent;
    saveBtn.textContent = 'Menyimpan...';
    saveBtn.disabled = true;
    const id = await saveFormToSupabase(form);
    saveForms(); // persist supabaseId back to localStorage
    saveBtn.textContent = original;
    saveBtn.disabled = false;
    showToast(id ? 'Form tersimpan!' : 'Tersimpan lokal (Supabase gagal)');
}

// Make functions available globally
window.selectForm = selectForm;
window.changeQuestionType = changeQuestionType;
window.updateQuestionTitle = updateQuestionTitle;
window.updateQuestionPlaceholder = updateQuestionPlaceholder;
window.updateOptionText = updateOptionText;
window.addOption = addOption;
window.deleteOption = deleteOption;
window.deleteQuestion = deleteQuestion;
window.showRespondentsModal = showRespondentsModal;
window.showRespondentDetail = showRespondentDetail;
window.showRespondentsList = showRespondentsList;