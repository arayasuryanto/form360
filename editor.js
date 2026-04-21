// Form Editor JavaScript

const SUPABASE_URL = 'https://ientctrogwvbjyznyvie.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ro6aUrWPrD72pa2qN4I7JQ_JHC8zneU';
let supabase = null;

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

function init() {
    if (window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    loadForms();
    setupEventListeners();
    renderFormList();
}

function loadForms() {
    const saved = localStorage.getItem('form360_forms');
    if (saved) {
        forms = JSON.parse(saved);
    } else {
        // Create a default form
        forms = [createNewFormData()];
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

function setupEventListeners() {
    // Sidebar
    document.getElementById('newFormBtn').addEventListener('click', showNewFormModal);
    document.getElementById('previewBtn').addEventListener('click', showPreview);
    document.getElementById('saveBtn').addEventListener('click', saveCurrentForm);

    // Form settings
    formNameInput.addEventListener('input', updateFormSetting);
    formDescriptionInput.addEventListener('input', updateFormSetting);
    welcomeTitleInput.addEventListener('input', updateFormSetting);
    welcomeSubtitleInput.addEventListener('input', updateFormSetting);
    resultsTitleInput.addEventListener('input', updateFormSetting);
    resultsSubtitleInput.addEventListener('input', updateFormSetting);
    resultsButtonTextInput.addEventListener('input', updateFormSetting);

    // Questions
    document.getElementById('addQuestionBtn').addEventListener('click', addQuestion);

    // New form modal
    document.getElementById('cancelNewForm').addEventListener('click', hideNewFormModal);
    document.getElementById('confirmNewForm').addEventListener('click', createNewForm);

    // Delete modal
    document.getElementById('cancelDelete').addEventListener('click', hideDeleteModal);
    document.getElementById('confirmDelete').addEventListener('click', confirmDelete);

    // Preview modal
    document.getElementById('closePreview').addEventListener('click', hidePreview);
    previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) hidePreview();
    });

    // Respondents modal
    document.getElementById('closeRespondents').addEventListener('click', hideRespondentsModal);
    respondentsModal.addEventListener('click', (e) => {
        if (e.target === respondentsModal) hideRespondentsModal();
    });

    // Share button
    const shareBtn = document.getElementById('shareBtn');
    shareBtn.addEventListener('click', showShareModal);
    document.getElementById('copyLinkBtn').addEventListener('click', copyShareLink);
    document.getElementById('closeShareModal').addEventListener('click', hideShareModal);
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

function showRespondentsModal(formId) {
    const form = forms.find(f => f.id === formId);
    if (!form) return;

    const respondents = getRespondentsForForm(formId);

    // Populate modal header
    document.getElementById('respondentsFormName').textContent = form.name;

    // Render respondents list
    const respondentsList = document.getElementById('respondentsList');
    if (respondents.length === 0) {
        respondentsList.innerHTML = `
            <div class="empty-respondents">
                <p>Belum ada responden</p>
            </div>
        `;
    } else {
        respondentsList.innerHTML = respondents.map((r, i) => `
            <div class="respondent-item" onclick="showRespondentDetail('${formId}', ${r.id})">
                <div class="respondent-info">
                    <span class="respondent-number">#${i + 1}</span>
                    <span class="respondent-time">${new Date(r.timestamp).toLocaleString('id-ID')}</span>
                </div>
                <div class="respondent-actions">
                    <span class="time-badge">${r.timeTaken || '?'} detik</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6 12l4-4-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            </div>
        `).join('');
    }

    // Hide detail view when showing list
    document.getElementById('respondentDetail').style.display = 'none';
    document.getElementById('respondentsList').style.display = 'block';

    respondentsModal.classList.add('active');
}

function hideRespondentsModal() {
    respondentsModal.classList.remove('active');
}

function showRespondentDetail(formId, respondentId) {
    const form = forms.find(f => f.id === formId);
    const respondent = getRespondentData(formId, respondentId);
    if (!form || !respondent) return;

    // Update header with back button
    const detailHeader = document.getElementById('respondentDetailHeader');
    detailHeader.innerHTML = `
        <button class="back-btn" onclick="showRespondentsList('${formId}')">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Kembali
        </button>
        <span>Responden #${respondent.id}</span>
    `;

    // Render answers
    const answersContainer = document.getElementById('respondentAnswers');
    answersContainer.innerHTML = form.questions.map((q, i) => {
        const answer = respondent.answers ? respondent.answers[q.id] : null;
        const answerText = answer || (q.type === 'text_input' ? '-' : 'Tidak dijawab');

        return `
            <div class="answer-item">
                <div class="answer-question">${i + 1}. ${q.title || 'Pertanyaan tanpa judul'}</div>
                <div class="answer-value">${answerText}</div>
            </div>
        `;
    }).join('');

    // Show charts
    renderRespondentCharts(form, respondent);

    // Show detail, hide list
    document.getElementById('respondentsList').style.display = 'none';
    document.getElementById('respondentDetail').style.display = 'block';
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
        const respondentCount = getRespondentsForForm(form.id).length;
        return `
            <div class="form-item ${isActive ? 'active' : ''}">
                <div class="form-item-main" onclick="selectForm('${form.id}')">
                    <div class="form-item-title">${form.name || 'Tanpa Nama'}</div>
                    <div class="form-item-meta">${questionCount} pertanyaan · ${respondentCount} responden</div>
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
    if (!supabase) return null;
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
            const { error } = await supabase.from('forms').update(formData).eq('id', supabaseId);
            if (error) throw error;
        } else {
            const { data, error } = await supabase.from('forms').insert(formData).select().single();
            if (error) throw error;
            supabaseId = data.id;
            form.supabaseId = supabaseId;
        }

        // Replace questions: delete old, insert new
        await supabase.from('questions').delete().eq('form_id', supabaseId);
        const questionsToInsert = form.questions.map((q, i) => ({
            form_id: supabaseId,
            question_order: i + 1,
            question_type: q.type,
            title: q.title,
            placeholder: q.placeholder || null,
            options: q.options ? JSON.stringify(q.options) : null
        }));
        if (questionsToInsert.length > 0) {
            const { data: qData, error: qErr } = await supabase.from('questions').insert(questionsToInsert).select();
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