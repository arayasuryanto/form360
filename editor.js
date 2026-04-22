// Form Editor JavaScript

const SUPABASE_URL = 'https://ientctrogwvbjyznyvie.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ro6aUrWPrD72pa2qN4I7JQ_JHC8zneU';
let sbClient = null;

// State
let forms = [];
let currentFormId = null;
let questionToDelete = null;
let formToDelete = null;
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
                    const existingForm = forms.find(f => f.supabaseId === rf.id);

                    if (existingForm) {
                        // Form exists but may be missing supabaseQuestionIds — rebuild it
                        if (!existingForm.supabaseQuestionIds) {
                            fetchQuestionsForForm(rf.id).then(questions => {
                                existingForm.questions = questions;
                                existingForm.supabaseQuestionIds = {};
                                questions.forEach(q => { existingForm.supabaseQuestionIds[q.id] = q.supabaseQId; });
                                existingForm.supabaseId = rf.id;
                                saveForms();
                                renderFormList();
                            });
                        }
                        return;
                    }

                    // Brand new form — create from scratch
                    fetchQuestionsForForm(rf.id).then(questions => {
                        // Build supabaseQuestionIds map: local id → supabase UUID
                        const qIdMap = {};
                        questions.forEach(q => { qIdMap[q.id] = q.supabaseQId; });

                        const localForm = {
                            id: rf.id,            // use supabase UUID as local id for consistency
                            supabaseId: rf.id,
                            name: rf.name || 'Untitled',
                            description: rf.description || '',
                            welcome: {
                                title: rf.welcome_title || 'Halo, Selamat Datang!',
                                subtitle: rf.welcome_subtitle || 'Press Start or Enter to begin'
                            },
                            results: {
                                title: rf.results_title || 'Terima Kasih!',
                                subtitle: rf.results_subtitle || 'You have completed this form',
                                buttonText: rf.results_button_text || 'Try Again'
                            },
                            questions: questions,
                            supabaseQuestionIds: qIdMap
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
                supabaseQId: q.id,
                type: q.question_type,
                title: q.title || '',
                placeholder: q.placeholder || '',
                color: q.color || null,
                image: q.image ? (typeof q.image === 'string' ? JSON.parse(q.image) : q.image) : null
            };
            if ((q.question_type === 'multiple_choice' || q.question_type === 'checkbox') && q.options) {
                base.options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
            }
            if (q.question_type === 'section') {
                base.subtitle = q.placeholder || '';
                base.buttonText = 'Continue';
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

function createNewFormData(name = 'New Form') {
    return {
        id: Date.now().toString(),
        name: name,
        description: '',
        welcome: {
            title: 'Halo, Selamat Datang!',
            subtitle: 'Press Start or Enter to begin'
        },
        results: {
            title: 'Terima Kasih!',
            subtitle: 'You have completed this form',
            buttonText: 'Try Again'
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
        title: '',
        color: null
    };

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
        base.placeholder = 'ketik jawaban kamu di sini...';
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
    bind('cancelDeleteForm', 'click', cancelDeleteForm);
    bind('confirmDeleteForm', 'click', confirmDeleteForm);
    bind('cancelAddQuestion', 'click', cancelAddQuestion);
    bind('addQuestionQuestion', 'click', () => confirmAddQuestion('multiple_choice'));
    bind('addQuestionSection', 'click', () => confirmAddQuestion('section'));

    if (formNameInput) formNameInput.addEventListener('input', updateFormSetting);
    if (formDescriptionInput) formDescriptionInput.addEventListener('input', updateFormSetting);
    if (welcomeTitleInput) welcomeTitleInput.addEventListener('input', updateFormSetting);
    if (welcomeSubtitleInput) welcomeSubtitleInput.addEventListener('input', updateFormSetting);
    if (resultsTitleInput) resultsTitleInput.addEventListener('input', updateFormSetting);
    if (resultsSubtitleInput) resultsSubtitleInput.addEventListener('input', updateFormSetting);
    if (resultsButtonTextInput) resultsButtonTextInput.addEventListener('input', updateFormSetting);

    if (previewModal) previewModal.addEventListener('click', (e) => { if (e.target === previewModal) hidePreview(); });
    if (respondentsModal) respondentsModal.addEventListener('click', (e) => { if (e.target === respondentsModal) hideRespondentsModal(); });

    // Event delegation for form list buttons — survives re-renders
    if (formList) {
        formList.addEventListener('click', function(e) {
            const btn = e.target.closest('.icon-btn');
            if (btn) {
                e.stopPropagation();
                e.preventDefault();
                const formItem = btn.closest('.form-item');
                if (!formItem) return;
                const formId = formItem.getAttribute('data-form-id');
                if (btn.classList.contains('export-btn')) { downloadFormExcel(formId); return; }
                if (btn.classList.contains('view-btn')) { showRespondentsModal(formId); return; }
                if (btn.classList.contains('delete-btn')) { showDeleteFormModal(formId); return; }
            }
            // Click on form-item-main selects the form
            const main = e.target.closest('.form-item-main');
            if (main) {
                const formItem = main.closest('.form-item');
                if (formItem) selectForm(formItem.getAttribute('data-form-id'));
            }
        });
    }

    // Drag and drop for questions
    let draggedQuestionId = null;
    if (questionsList) {
        questionsList.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.question-item');
            if (!item) return;
            draggedQuestionId = item.getAttribute('data-id');
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedQuestionId);
        });

        questionsList.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const item = e.target.closest('.question-item');
            if (!item || item.getAttribute('data-id') === draggedQuestionId) return;

            // Remove all existing indicators
            questionsList.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
                el.classList.remove('drag-over-top', 'drag-over-bottom');
            });

            const rect = item.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
                item.classList.add('drag-over-top');
            } else {
                item.classList.add('drag-over-bottom');
            }
        });

        questionsList.addEventListener('dragleave', (e) => {
            const item = e.target.closest('.question-item');
            if (item) item.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        questionsList.addEventListener('drop', (e) => {
            e.preventDefault();
            const form = getCurrentForm();
            if (!form || !draggedQuestionId) return;

            const targetItem = e.target.closest('.question-item');
            if (!targetItem) return;
            const targetId = targetItem.getAttribute('data-id');
            if (targetId === draggedQuestionId) return;

            const fromIdx = form.questions.findIndex(q => String(q.id) === draggedQuestionId);
            const toIdx = form.questions.findIndex(q => String(q.id) === targetId);
            if (fromIdx === -1 || toIdx === -1) return;

            // Determine if inserting before or after target
            const rect = targetItem.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const insertBefore = e.clientY < midY;

            // Remove dragged item
            const [moved] = form.questions.splice(fromIdx, 1);

            // Calculate new insert index
            let newIdx = form.questions.findIndex(q => String(q.id) === targetId);
            if (!insertBefore) newIdx++;
            form.questions.splice(newIdx, 0, moved);

            // Renumber
            form.questions.forEach((q, i) => q.id = i + 1);

            saveForms();
            renderQuestions();
        });

        questionsList.addEventListener('dragend', () => {
            draggedQuestionId = null;
            questionsList.querySelectorAll('.dragging, .drag-over-top, .drag-over-bottom').forEach(el => {
                el.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
            });
        });
    }
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
    const name = document.getElementById('newFormName').value.trim() || 'New Form';
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

function showDeleteFormModal(formId) {
    console.log('[DEBUG] showDeleteFormModal called with:', formId);
    const form = forms.find(f => f.id === formId);
    if (!form) { console.log('[DEBUG] form not found'); return; }
    formToDelete = formId;
    const msgEl = document.getElementById('deleteFormMsg');
    if (msgEl) {
        msgEl.textContent = 'Delete "' + (form.name || 'Untitled') + '"? Respondent data will be kept.';
    }
    const modal = document.getElementById('deleteFormModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function cancelDeleteForm() {
    formToDelete = null;
    const m = document.getElementById('deleteFormModal');
    if (m) { m.classList.remove('active'); m.style.cssText = ''; }
}

async function confirmDeleteForm() {
    if (!formToDelete) return;
    const form = forms.find(f => f.id === formToDelete);
    if (form && form.supabaseId && sbClient) {
        try {
            await sbClient.from('forms').delete().eq('id', form.supabaseId);
        } catch (e) {
            console.error('Delete form from Supabase error:', e);
        }
    }
    forms = forms.filter(f => f.id !== formToDelete);
    if (currentFormId === formToDelete) {
        currentFormId = forms.length > 0 ? forms[0].id : null;
    }
    formToDelete = null;
    saveForms();
    const m = document.getElementById('deleteFormModal');
    if (m) {
        m.classList.remove('active');
        m.style.cssText = '';
    }
    showToast('Form deleted');
    renderFormList();
    if (currentFormId) selectForm(currentFormId);
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
        copyBtn.textContent = 'Copied!';
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
    respondentsList.innerHTML = '<div class="empty-respondents"><p>Loading...</p></div>';

    // Try Supabase first, fall back to localStorage
    let respondents = null;
    if (sbClient && form.supabaseId) {
        respondents = await fetchRespondentsFromSupabase(form.supabaseId);
    }
    if (respondents === null) {
        respondents = getRespondentsForForm(formId);
    }

    if (respondents.length === 0) {
        respondentsList.innerHTML = '<div class="empty-respondents"><p>No respondents yet</p></div>';
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
                        <span class="time-badge">${duration} sec</span>
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
    answersContainer.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Loading answers...</p>';

    let answersMap = {};

    if (sbClient && form.supabaseId) {
        // Load answers from Supabase
        const rawAnswers = await fetchAnswersFromSupabase(respondentId);
        rawAnswers.forEach(a => { answersMap[a.question_id] = a.answer_value; });

        // Ensure each question has supabaseQId — rebuild from Supabase if missing
        let needsRebuild = form.questions.some(q => !q.supabaseQId);
        if (needsRebuild) {
            const remoteQuestions = await fetchQuestionsForForm(form.supabaseId);
            // Match by order (both are ordered)
            form.questions.forEach((q, i) => {
                if (remoteQuestions[i]) {
                    q.supabaseQId = remoteQuestions[i].supabaseQId;
                }
            });
            form.supabaseQuestionIds = {};
            form.questions.forEach(q => {
                if (q.supabaseQId) form.supabaseQuestionIds[q.id] = q.supabaseQId;
            });
            saveForms();
        }

        console.log('[DEBUG] rawAnswers from Supabase:', rawAnswers);
        console.log('[DEBUG] answersMap:', answersMap);

        answersContainer.innerHTML = form.questions.map((q, i) => {
            const supabaseQId = q.supabaseQId;
            let answerText = (supabaseQId && answersMap[supabaseQId]) || '-';
            // For checkbox, convert values to labels
            if (q.type === 'checkbox' && q.options && answerText !== '-') {
                answerText = answerText.split(',').map(v => {
                    const opt = q.options.find(o => o.value === v);
                    return opt ? opt.text : v;
                }).join(', ');
            } else if ((q.type === 'multiple_choice') && q.options && answerText !== '-') {
                const opt = q.options.find(o => o.value === answerText);
                if (opt) answerText = opt.text;
            }
            const label = q.type === 'section' ? 'Section' : `${i + 1}. ${q.title || 'Untitled question'}`;
            return `
                <div class="answer-item">
                    <div class="answer-question">${label}</div>
                    <div class="answer-value">${q.type === 'section' ? '-' : answerText}</div>
                </div>
            `;
        }).join('');

        // Minimal chart placeholder using supabase data
        renderRespondentCharts(form, { answers: Object.fromEntries(
            form.questions.map(q => [q.id, q.supabaseQId ? answersMap[q.supabaseQId] : undefined])
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
            <div class="time-value">${timeTaken} sec</div>
            <div class="time-label">Completion time</div>
        </div>
        <div class="time-stat">
            <div class="time-value">${avgTime.toFixed(0)} sec</div>
            <div class="time-label">Average</div>
        </div>
        <div class="time-stat ${timeComparison > 1.5 ? 'slow' : timeComparison < 0.5 ? 'fast' : ''}">
            <div class="time-value">${timeComparison > 1 ? '+' : ''}${((timeComparison - 1) * 100).toFixed(0)}%</div>
            <div class="time-label">vs average</div>
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

    saveForms();
    renderFormList();
}

function addQuestion() {
    const modal = document.getElementById('addQuestionModal');
    if (modal) modal.classList.add('active');
}

function confirmAddQuestion(type) {
    const form = getCurrentForm();
    if (!form) return;

    const newId = form.questions.length + 1;
    const newQuestion = createQuestionData(newId, type);
    form.questions.push(newQuestion);
    saveForms();
    renderQuestions();

    const modal = document.getElementById('addQuestionModal');
    if (modal) modal.classList.remove('active');

    // Scroll to the new question
    setTimeout(() => {
        const items = questionsList.querySelectorAll('.question-item');
        if (items.length > 0) items[items.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

function cancelAddQuestion() {
    const modal = document.getElementById('addQuestionModal');
    if (modal) modal.classList.remove('active');
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
            <div class="form-item ${isActive ? 'active' : ''}" data-form-id="${form.id}">
                <div class="form-item-main">
                    <div class="form-item-title">${form.name || 'Untitled'}</div>
                    <div class="form-item-meta" id="meta-${form.id}">${questionCount} questions · ${localCount} respondents</div>
                </div>
                <div class="form-item-actions">
                    <button class="icon-btn export-btn" title="Export Excel">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                    </button>
                    <button class="icon-btn view-btn" title="Lihat Responden">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                    <button class="icon-btn delete-btn" title="Hapus Form">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6"/>
                            <path d="M14 11v6"/>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Buttons are handled via event delegation in setupEventListeners

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
            if (el) el.textContent = `${form.questions.length} questions · ${count} respondents`;
        } catch (e) {}
    });
}

function renderQuestions() {
    const form = getCurrentForm();
    if (!form) {
        questionsList.innerHTML = '<div class="placeholder-message"><h3>Select a form to edit</h3></div>';
        return;
    }

    if (form.questions.length === 0) {
        questionsList.innerHTML = '<div class="placeholder-message"><h3>No questions yet</h3><p>Add a new question</p></div>';
        return;
    }

    const COLORS = ['#e53935','#f57c00','#fbc02d','#43a047','#1e88e5','#5e35b1','#d81b60','#00897b','#6d4c41','#546e7a'];

    questionsList.innerHTML = form.questions.map((q, index) => {
        const typeSelect = q.type === 'section' ? '' : `
            <select class="question-type-select" onchange="changeQuestionType(${q.id}, this.value)">
                <option value="multiple_choice" ${q.type === 'multiple_choice' ? 'selected' : ''}>Pilihan Ganda</option>
                <option value="checkbox" ${q.type === 'checkbox' ? 'selected' : ''}>Kotak Centang</option>
                <option value="text_input" ${q.type === 'text_input' ? 'selected' : ''}>Isian Teks</option>
            </select>`;

        const badge = q.type === 'section'
            ? `<span class="question-badge section-badge">S</span>`
            : `<span class="question-badge">${q.id}</span>`;

        const colorDot = q.color
            ? `<span class="color-dot" style="background:${q.color}" onclick="event.stopPropagation(); toggleColorPicker(${q.id})"></span>`
            : `<span class="color-dot color-dot-empty" onclick="event.stopPropagation(); toggleColorPicker(${q.id})"></span>`;

        const colorPicker = `<div class="color-picker-popover" id="colorPicker-${q.id}" style="display:none">
            ${COLORS.map(c => `<span class="color-swatch ${q.color === c ? 'active' : ''}" style="background:${c}" onclick="event.stopPropagation(); setQuestionColor(${q.id}, '${c}')"></span>`).join('')}
            <span class="color-swatch color-swatch-remove" onclick="event.stopPropagation(); setQuestionColor(${q.id}, null)">✕</span>
        </div>`;

        let fields = '';
        if (q.type === 'section') {
            fields = `
                <input type="text" value="${q.title || ''}" placeholder="Section title..." onchange="updateQuestionTitle(${q.id}, this.value)">
                <textarea placeholder="Subtitle (optional)..." onchange="updateSectionSubtitle(${q.id}, this.value)" rows="2">${q.subtitle || ''}</textarea>
                <input type="text" value="${q.buttonText || 'Continue'}" placeholder="Button text..." onchange="updateSectionButtonText(${q.id}, this.value)">
            `;
        } else if (q.type === 'text_input') {
            fields = `
                <input type="text" value="${q.title}" placeholder="Question..." onchange="updateQuestionTitle(${q.id}, this.value)">
                <input type="text" value="${q.placeholder || ''}" placeholder="Placeholder (optional)..." onchange="updateQuestionPlaceholder(${q.id}, this.value)">
            `;
        } else {
            // multiple_choice or checkbox — same options editor
            fields = `
                <input type="text" value="${q.title}" placeholder="Question..." onchange="updateQuestionTitle(${q.id}, this.value)">
                <div class="options-editor">
                    <div class="options-label">${q.type === 'checkbox' ? 'Options (multiple selection):' : 'Options:'}</div>
                    ${q.options.map((opt, i) => `
                        <div class="option-item">
                            <span class="option-key">${OPTION_KEYS[i]}</span>
                            <input type="text" value="${opt.text}" placeholder="Option..." onchange="updateOptionText(${q.id}, ${i}, this.value)">
                            <button class="option-delete-btn" onclick="deleteOption(${q.id}, ${i})">&times;</button>
                        </div>
                    `).join('')}
                    ${q.options.length < 8 ? `<button class="add-option-btn" onclick="addOption(${q.id})">+ Add Option</button>` : ''}
                </div>
            `;
        }

        // Image section
        let imageSection = '';
        if (q.type !== 'section') {
            if (q.image && q.image.url) {
                imageSection = `
                    <div class="question-image-section">
                        <div class="image-preview-frame" id="imgFrame-${q.id}">
                            <img src="${q.image.url}" style="transform: scale(${q.image.zoom || 1}) translate(${q.image.offsetX || 0}%, ${q.image.offsetY || 0}%)" draggable="false">
                            <button class="image-remove-btn" onclick="event.stopPropagation(); removeQuestionImage(${q.id})" title="Remove image">&times;</button>
                        </div>
                        <div class="image-controls">
                            <span class="image-controls-label">Zoom</span>
                            <input type="range" class="image-zoom-slider" min="100" max="300" value="${Math.round((q.image.zoom || 1) * 100)}" oninput="updateImageZoom(${q.id}, this.value)">
                            <span class="image-zoom-value">${Math.round((q.image.zoom || 1) * 100)}%</span>
                        </div>
                        <input type="file" accept="image/*" id="imgInput-${q.id}" style="display:none" onchange="handleImageUpload(${q.id}, this)">
                    </div>
                `;
            } else {
                imageSection = `
                    <div class="question-image-section">
                        <div class="image-upload-area" onclick="event.stopPropagation(); document.getElementById('imgInput-${q.id}').click()">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                            </svg>
                            <span>Add Image</span>
                        </div>
                        <input type="file" accept="image/*" id="imgInput-${q.id}" style="display:none" onchange="handleImageUpload(${q.id}, this)">
                    </div>
                `;
            }
        }

        return `
            <div class="question-item ${q.type === 'section' ? 'section-item' : ''}" data-id="${q.id}" draggable="true" style="${q.color ? 'background:' + q.color + '15;border-color:' + q.color + '40;' : ''}">
                <div class="question-header">
                    <div class="question-number">
                        <span class="drag-handle" title="Drag to reorder">⠿</span>
                        ${badge}
                        ${typeSelect}
                    </div>
                    <div class="question-actions" style="position:relative">
                        ${colorDot}
                        ${colorPicker}
                        <button class="delete" onclick="deleteQuestion(${q.id})" title="Hapus">🗑</button>
                    </div>
                </div>
                <div class="question-fields">
                    ${fields}
                    ${imageSection}
                </div>
            </div>
        `;
    }).join('');
}

// Question manipulation functions
function changeQuestionType(questionId, newType) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (!q) return;

    const oldType = q.type;
    q.type = newType;

    const hasOptions = (newType === 'multiple_choice' || newType === 'checkbox');
    const hadOptions = (oldType === 'multiple_choice' || oldType === 'checkbox');

    if (hasOptions && !hadOptions) {
        // Coming from text_input or section — add default options
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
        // Going to text_input — remove options
        if (newType === 'text_input') {
            q.placeholder = q.placeholder || '';
        }
        delete q.options;
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

function updateSectionSubtitle(questionId, subtitle) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (q) {
        q.subtitle = subtitle;
        saveForms();
    }
}

function updateSectionButtonText(questionId, text) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (q) {
        q.buttonText = text;
        saveForms();
    }
}

function toggleColorPicker(questionId) {
    // Close all other pickers first
    document.querySelectorAll('.color-picker-popover').forEach(p => {
        if (p.id !== 'colorPicker-' + questionId) p.style.display = 'none';
    });
    const picker = document.getElementById('colorPicker-' + questionId);
    if (picker) {
        picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
    }
}

function setQuestionColor(questionId, color) {
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (q) {
        q.color = color;
        saveForms();
        renderQuestions();
    }
}

// Close color picker when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.color-dot') && !e.target.closest('.color-picker-popover')) {
        document.querySelectorAll('.color-picker-popover').forEach(p => p.style.display = 'none');
    }
});

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
        q.options.push({ text: `Option ${key}`, value: `opt_${key.toLowerCase()}` });
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
            name: form.name || 'New Form',
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

        // Replace questions: update existing, insert new, delete removed
        // First, fetch current questions from Supabase
        const { data: existingQs } = await sbClient
            .from('questions')
            .select('id')
            .eq('form_id', supabaseId);
        const existingQIds = new Set((existingQs || []).map(q => q.id));

        const newSupabaseIds = [];
        for (let i = 0; i < form.questions.length; i++) {
            const q = form.questions[i];
            const qData = {
                form_id: supabaseId,
                question_order: i + 1,
                question_type: q.type,
                title: q.title,
                placeholder: q.type === 'section' ? (q.subtitle || '') : (q.placeholder || null),
                options: q.options ? JSON.stringify(q.options) : null,
                color: q.color || null,
                image: q.image ? JSON.stringify(q.image) : null
            };

            const sqId = q.supabaseQId;
            if (sqId && existingQIds.has(sqId)) {
                // Update existing question — preserves UUID so answers stay linked
                const { error } = await sbClient.from('questions').update(qData).eq('id', sqId);
                if (error) console.error('Question update error:', error);
                newSupabaseIds.push(sqId);
            } else {
                // Insert new question
                const { data: inserted, error } = await sbClient.from('questions').insert(qData).select();
                if (error) console.error('Question insert error:', error);
                if (inserted && inserted[0]) {
                    newSupabaseIds.push(inserted[0].id);
                    q.supabaseQId = inserted[0].id;
                }
            }
        }

        // Delete questions that no longer exist in the form
        const toDelete = [...existingQIds].filter(id => !newSupabaseIds.includes(id));
        if (toDelete.length > 0) {
            await sbClient.from('questions').delete().in('id', toDelete);
        }

        // Rebuild supabaseQuestionIds map
        form.supabaseQuestionIds = {};
        form.questions.forEach((q, i) => {
            if (newSupabaseIds[i]) {
                q.supabaseQId = newSupabaseIds[i];
                form.supabaseQuestionIds[q.id] = newSupabaseIds[i];
            }
        });

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
    showToast(id ? 'Form saved!' : 'Saved locally (Supabase failed)');
}

async function downloadFormExcel(formId) {
    const form = forms.find(f => f.id === formId);
    if (!form) return;
    showToast(' Preparing Excel file...');

    // Load SheetJS dynamically if not already loaded
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
            showToast(' Failed to load Excel library', true);
            return;
        }
    }
    if (typeof XLSX === 'undefined') {
        showToast(' Gagal memuat pustaka Excel', true);
        return;
    }
    showToast(' Preparing Excel file...');

    // Gather respondents
    let respondents = [];
    if (sbClient && form.supabaseId) {
        respondents = await fetchRespondentsFromSupabase(form.supabaseId) || [];
    }
    if (respondents.length === 0) {
        respondents = getRespondentsForForm(formId);
    }

    // Build answers map for each respondent
    const answersByResp = {};
    for (const r of respondents) {
        if (sbClient && form.supabaseId) {
            answersByResp[r.id] = await fetchAnswersFromSupabase(r.id);
        } else {
            const local = getRespondentData(formId, r.id);
            answersByResp[r.id] = local ? Object.entries(local.answers || {}).map(([qId, val]) => ({ question_id: qId, answer_value: val })) : [];
        }
    }

    // Ensure questions have supabaseQId
    const qList = form.questions;
    const fmt = v => (v === null || v === undefined || v === '') ? '-' : String(v);

    // ── Sheet 1: Ringkasan ──────────────────────────────────────────
    const ringkasanData = [
        ['Formure — Ringkasan'],
        [],
        ['Form Name', form.name || 'Untitled'],
        ['Total Questions', qList.length],
        ['Total Respondents', respondents.length],
        ['Average Time', respondents.length > 0
            ? Math.round(respondents.reduce((s, r) => s + (r.time_taken ?? r.timeTaken ?? 0), 0) / respondents.length) + ' sec'
            : '-'],
        ['First Respondent', respondents.length > 0
            ? (respondents[respondents.length - 1].created_at
                ? new Date(respondents[respondents.length - 1].created_at).toLocaleString('en-US')
                : '-')
            : '-'],
        ['Last Respondent', respondents.length > 0
            ? (respondents[0].created_at
                ? new Date(respondents[0].created_at).toLocaleString('en-US')
                : '-')
            : '-'],
    ];

    // ── Sheet 2: Responden ──────────────────────────────────────────
    const respHeader = ['#', 'Submitted At', 'Duration (sec)', ...qList.map((q, i) => `Q${i + 1}: ${fmt(q.title)}`)];
    const respRows = respondents.map((r, i) => {
        const ts = r.created_at ? new Date(r.created_at).toLocaleString('id-ID') : '-';
        const dur = r.time_taken ?? r.timeTaken ?? '-';
        const ans = answersByResp[r.id] || [];
        const ansMap = {};
        ans.forEach(a => { ansMap[a.question_id] = a.answer_value; });

        const qAnswers = qList.map(q => {
            if (q.type === 'section') return '-';
            const sbQId = q.supabaseQId;
            const localId = q.id;
            const val = ansMap[sbQId] ?? ansMap[String(localId)] ?? '-';
            if (val === '-' || val === null) return '-';
            // For multiple choice or checkbox, show text label(s)
            if ((q.type === 'multiple_choice' || q.type === 'checkbox') && q.options) {
                if (q.type === 'checkbox') {
                    // Multiple values separated by comma
                    const vals = val.split(',');
                    return vals.map(v => {
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

    // ── Sheet 3: Distribusi ────────────────────────────────────────
    const distHeader = ['Question', 'Option / Value', 'Count', 'Percentage'];
    const distRows = [];
    qList.forEach((q, qi) => {
        if (q.type === 'section') {
            distRows.push([`Section ${qi + 1}: ${fmt(q.title)}`, '(Section)', '-', '-']);
        } else if ((q.type === 'multiple_choice' || q.type === 'checkbox') && q.options) {
            const ans = (answersByResp[respondents[0]?.id] || []).length > 0
                ? respondents.flatMap(r => (answersByResp[r.id] || []).map(a => {
                    const sbQId = q.supabaseQId;
                    return a.question_id === sbQId ? a.answer_value : null;
                })).filter(Boolean)
                : [];
            q.options.forEach(opt => {
                const count = ans.filter(v => v === opt.value).length;
                const pct = ans.length > 0 ? ((count / ans.length) * 100).toFixed(1) + '%' : '0%';
                distRows.push([`Q${qi + 1}: ${fmt(q.title)}`, opt.text, count, pct]);
            });
        } else {
            distRows.push([`Q${qi + 1}: ${fmt(q.title)}`, '(Isian teks)', '-', '-']);
        }
    });

    // ── Write workbook ───────────────────────────────────────────────
    const wb = XLSX.utils.book_new();
    const wsRingkasan = XLSX.utils.aoa_to_sheet(ringkasanData);
    const wsResponden = XLSX.utils.aoa_to_sheet([respHeader, ...respRows]);
    const wsDist = XLSX.utils.aoa_to_sheet([distHeader, ...distRows]);

    // Column widths
    wsResponden['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 14 }, ...qList.map(() => ({ wch: 25 }))];
    wsDist['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 10 }, { wch: 12 }];

    XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Summary');
    XLSX.utils.book_append_sheet(wb, wsResponden, 'Respondents');
    XLSX.utils.book_append_sheet(wb, wsDist, 'Distribution');

    const filename = `Formure_${(form.name || 'form').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast(' Excel downloaded!');
}

// Image upload functions
async function handleImageUpload(questionId, input) {
    const file = input.files && input.files[0];
    if (!file) return;

    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === questionId);
    if (!q) return;

    // Compress if > 2MB
    let processedFile = file;
    if (file.size > 2 * 1024 * 1024) {
        try {
            processedFile = await compressImage(file, 1200);
        } catch (e) {
            console.error('Image compression error:', e);
        }
    }

    // Upload to Supabase Storage
    if (sbClient) {
        try {
            const ext = file.name.split('.').pop() || 'jpg';
            const path = `form-images/${form.id}/${questionId}_${Date.now()}.${ext}`;
            const { data, error } = await sbClient.storage
                .from('form-images')
                .upload(path, processedFile, { upsert: true, contentType: file.type });

            if (error) throw error;

            const { data: urlData } = sbClient.storage.from('form-images').getPublicUrl(path);
            q.image = { url: urlData.publicUrl, zoom: 1, offsetX: 0, offsetY: 0 };
        } catch (e) {
            console.error('Supabase upload error:', e);
            showToast('Failed to upload image to Supabase', true);
            // Fallback: base64
            const url = await fileToBase64(file);
            q.image = { url, zoom: 1, offsetX: 0, offsetY: 0 };
        }
    } else {
        // No Supabase: use base64
        const url = await fileToBase64(file);
        q.image = { url, zoom: 1, offsetX: 0, offsetY: 0 };
    }

    saveForms();
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
            canvas.width = w;
            canvas.height = h;
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
    saveForms();
    // Update live preview without full re-render
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

    // Try to remove from Supabase Storage
    if (sbClient && q.image.url && !q.image.url.startsWith('data:')) {
        try {
            const url = new URL(q.image.url);
            const pathParts = url.pathname.split('/storage/v1/object/public/form-images/');
            if (pathParts[1]) {
                await sbClient.storage.from('form-images').remove([pathParts[1]]);
            }
        } catch (e) {}
    }

    q.image = null;
    saveForms();
    renderQuestions();
}

// Image pan (drag to reposition in editor)
let imagePanState = null;

document.addEventListener('mousedown', (e) => {
    const frame = e.target.closest('.image-preview-frame');
    if (!frame) return;
    e.preventDefault();
    const idStr = frame.id.replace('imgFrame-', '');
    const form = getCurrentForm();
    const q = form.questions.find(q => String(q.id) === idStr);
    if (!q || !q.image) return;
    imagePanState = { questionId: q.id, startX: e.clientX, startY: e.clientY, startOX: q.image.offsetX, startOY: q.image.offsetY };
    frame.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
    if (!imagePanState) return;
    const form = getCurrentForm();
    const q = form.questions.find(q => q.id === imagePanState.questionId);
    if (!q || !q.image) return;
    const dx = (e.clientX - imagePanState.startX) / 2;
    const dy = (e.clientY - imagePanState.startY) / 2;
    q.image.offsetX = Math.max(-50, Math.min(50, imagePanState.startOX + dx));
    q.image.offsetY = Math.max(-50, Math.min(50, imagePanState.startOY + dy));
    const frame = document.getElementById('imgFrame-' + q.id);
    if (frame) {
        const img = frame.querySelector('img');
        if (img) img.style.transform = `scale(${q.image.zoom}) translate(${q.image.offsetX}%, ${q.image.offsetY}%)`;
    }
});

document.addEventListener('mouseup', () => {
    if (imagePanState) {
        const form = getCurrentForm();
        const q = form.questions.find(q => q.id === imagePanState.questionId);
        if (q && q.image) saveForms();
        const frame = document.getElementById('imgFrame-' + imagePanState.questionId);
        if (frame) frame.style.cursor = '';
        imagePanState = null;
    }
});

// Make functions available globally
window.selectForm = selectForm;
window.changeQuestionType = changeQuestionType;
window.updateQuestionTitle = updateQuestionTitle;
window.updateQuestionPlaceholder = updateQuestionPlaceholder;
window.updateSectionSubtitle = updateSectionSubtitle;
window.updateSectionButtonText = updateSectionButtonText;
window.updateOptionText = updateOptionText;
window.addOption = addOption;
window.deleteOption = deleteOption;
window.deleteQuestion = deleteQuestion;
window.showRespondentsModal = showRespondentsModal;
window.showRespondentDetail = showRespondentDetail;
window.showRespondentsList = showRespondentsList;
window.showDeleteFormModal = showDeleteFormModal;
window.cancelDeleteForm = cancelDeleteForm;
window.confirmDeleteForm = confirmDeleteForm;
window.downloadFormExcel = downloadFormExcel;
window.toggleColorPicker = toggleColorPicker;
window.setQuestionColor = setQuestionColor;
window.addQuestion = addQuestion;
window.confirmAddQuestion = confirmAddQuestion;
window.cancelAddQuestion = cancelAddQuestion;
window.handleImageUpload = handleImageUpload;
window.updateImageZoom = updateImageZoom;
window.removeQuestionImage = removeQuestionImage;