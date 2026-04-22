// Form Viewer JavaScript
// Works with both URL-encoded data (local) and Supabase (production)

let questions = [];
let formConfig = {
    welcome: {
        title: 'Halo, Selamat Datang!',
        subtitle: 'Tekan Mulai atau Enter untuk memulai'
    },
    results: {
        title: 'Terima Kasih!',
        subtitle: 'Kamu telah menyelesaikan form ini',
        buttonText: 'Ikuti Lagi'
    }
};

let currentFormId = null;
let currentQuestionIndex = 0;
let userName = "";
let answers = {};
let selectedAnswer = null;
let selectedAnswers = [];
let textValue = "";
let isTransitioning = false;
let startTime = null;
let useSupabase = false;

const SUPABASE_URL = 'https://ientctrogwvbjyznyvie.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ro6aUrWPrD72pa2qN4I7JQ_JHC8zneU';
let sbClient = null;

// DOM Elements
let dynamicStepper;
let startScreen, questionScreen, resultsScreen;
let startBtn, continueBtn, restartBtn;
let scrollUpBtn, scrollDownBtn, progressText;
let optionsList, questionNumberEl, questionTextEl, questionHintEl;

document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Initialize Supabase if configured
    if (SUPABASE_URL && SUPABASE_KEY && window.supabase) {
        sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        useSupabase = true;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const isPreview = urlParams.get('preview') === 'true';
    const formId = urlParams.get('form');
    const formDataParam = urlParams.get('data');

    // Get DOM elements
    dynamicStepper = document.getElementById('dynamicStepper');
    startScreen = document.getElementById('startScreen');
    questionScreen = document.getElementById('questionScreen');
    resultsScreen = document.getElementById('resultsScreen');
    startBtn = document.getElementById('startBtn');
    continueBtn = document.getElementById('continueBtn');
    restartBtn = document.getElementById('restartBtn');
    scrollUpBtn = document.getElementById('scrollUp');
    scrollDownBtn = document.getElementById('scrollDown');
    progressText = document.getElementById('progressText');
    optionsList = document.querySelector('.options-list');
    questionNumberEl = document.querySelector('.q-number');
    questionTextEl = document.querySelector('.question-text');
    questionHintEl = document.querySelector('.question-hint');

    // Try Supabase first if configured and formId is a valid UUID
    if (useSupabase && formId && isValidUUID(formId)) {
        try {
            const formData = await getFormFromSupabase(formId);
            if (formData) {
                currentFormId = formData.id;
                questions = formData.questions || [];
                formConfig = {
                    welcome: { title: formData.welcome_title || formConfig.welcome.title, subtitle: formData.welcome_subtitle || formConfig.welcome.subtitle },
                    results: { title: formData.results_title || formConfig.results.title, subtitle: formData.results_subtitle || formConfig.results.subtitle, buttonText: formData.results_button_text || formConfig.results.buttonText }
                };
            }
        } catch (e) {
            console.error('Supabase fetch failed:', e);
        }
    }

    // Check for URL-encoded form data (fallback / local sharing)
    if (questions.length === 0 && formDataParam) {
        try {
            const urlDecoded = decodeURIComponent(formDataParam);
            const decoded = decodeURIComponent(escape(atob(urlDecoded)));
            const formData = JSON.parse(decoded);
            currentFormId = formData.id;
            questions = formData.questions || [];
            formConfig = {
                welcome: formData.welcome || formConfig.welcome,
                results: formData.results || formConfig.results
            };
        } catch (e) {
            console.error('URL decode failed:', e);
            try {
                const altDecoded = decodeURIComponent(escape(atob(formDataParam.replace(/ /g, '+'))));
                const formData = JSON.parse(altDecoded);
                currentFormId = formData.id;
                questions = formData.questions || [];
                formConfig = {
                    welcome: formData.welcome || formConfig.welcome,
                    results: formData.results || formConfig.results
                };
            } catch (e2) {
                console.error('Alternate decode also failed:', e2);
            }
        }
    }

    // Preview mode from editor (localStorage)
    if (questions.length === 0 && isPreview) {
        const savedForm = localStorage.getItem('form360_preview');
        if (savedForm) {
            const formData = JSON.parse(savedForm);
            currentFormId = formData.id;
            questions = formData.questions || [];
            formConfig = {
                welcome: formData.welcome || formConfig.welcome,
                results: formData.results || formConfig.results
            };
        }
    }

    // Check if form was loaded successfully
    if (questions.length === 0) {
        const welcomeTitle = document.getElementById('welcomeTitle');
        const welcomeSubtitle = document.getElementById('welcomeSubtitle');
        const startBtnElement = document.getElementById('startBtn');

        if (welcomeTitle) welcomeTitle.textContent = 'Form Tidak Ditemukan';
        if (welcomeSubtitle) welcomeSubtitle.textContent = 'Form belum tersedia. Pastikan link yang digunakan benar.';
        if (startBtnElement) startBtnElement.style.display = 'none';
        return;
    }

    // Setup event listeners
    startBtn.addEventListener('click', startForm);
    document.addEventListener('keydown', handleKeydown);
    optionsList.addEventListener('click', handleOptionClick);
    continueBtn.addEventListener('click', handleContinue);
    restartBtn.addEventListener('click', restartForm);

    scrollUpBtn.addEventListener('click', () => navigate(-1));
    scrollDownBtn.addEventListener('click', () => navigate(1));

    initWelcomeScreen();
    updateStepper();
}

// Supabase Functions
async function getFormFromSupabase(formId) {
    if (!sbClient) return null;

    try {
        const { data, error } = await sbClient
            .from('forms')
            .select('*')
            .eq('id', formId)
            .single();

        if (error || !data) return null;

        const { data: questionsData, error: qError } = await sbClient
            .from('questions')
            .select('*')
            .eq('form_id', formId)
            .order('question_order', { ascending: true });

        data.questions = (questionsData || []).map(q => ({
            id: q.id,
            type: q.question_type,
            title: q.title,
            placeholder: q.placeholder,
            subtitle: q.question_type === 'section' ? (q.placeholder || '') : undefined,
            buttonText: q.question_type === 'section' ? 'Lanjut' : undefined,
            options: q.options ? JSON.parse(q.options) : null,
            color: q.color || null,
            image: q.image ? (typeof q.image === 'string' ? JSON.parse(q.image) : q.image) : null
        }));

        return data;
    } catch (e) {
        console.error('Supabase error:', e);
        return null;
    }
}

async function saveResponseToSupabase(timeTaken, answersArray) {
    if (!sbClient) return false;

    try {
        console.log('[DEBUG VIEWER] saving answersArray:', answersArray);
        console.log('[DEBUG VIEWER] currentFormId:', currentFormId);
        // Insert response
        const { data: response, error: respError } = await sbClient
            .from('responses')
            .insert({ form_id: currentFormId, time_taken: timeTaken })
            .select()
            .single();

        if (respError) throw respError;
        console.log('[DEBUG VIEWER] response saved, id:', response.id);

        // Insert answers
        const answersToInsert = answersArray.map(a => ({
            response_id: response.id,
            question_id: a.questionId,
            answer_value: a.answer
        }));
        console.log('[DEBUG VIEWER] answersToInsert:', answersToInsert);

        await sbClient.from('answers').insert(answersToInsert);
        return true;
    } catch (e) {
        console.error('Save response error:', e);
        return false;
    }
}

function isValidUUID(str) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function initWelcomeScreen() {
    const welcomeTitleEl = document.getElementById('welcomeTitle');
    const welcomeSubtitleEl = document.getElementById('welcomeSubtitle');
    if (welcomeTitleEl) welcomeTitleEl.textContent = formConfig.welcome.title;
    if (welcomeSubtitleEl) welcomeSubtitleEl.innerHTML = (formConfig.welcome.subtitle || '').replace(/\n/g, '<br>');
}

function updateStepper() {
    const totalQuestions = questions.length;
    const currentQ = currentQuestionIndex + 1;
    let html = '';

    // Build step items showing section labels
    const getStepLabel = (idx) => {
        const q = questions[idx];
        if (q.type === 'section') return q.title || 'Section';
        return '';
    };

    if (currentQ === 1) {
        html += `
            <div class="step-item mulai-step active">
                <div class="step-circle"></div>
                <span class="step-label">Mulai</span>
            </div>
            <div class="step-separator"></div>
            <div class="step-item question-step active">
                <div class="step-circle">1</div>
                <span class="step-label"></span>
            </div>
        `;
    } else {
        let startQ = Math.max(1, currentQ - 1);
        if (currentQ >= totalQuestions - 1) {
            startQ = Math.max(1, totalQuestions - 2);
        }
        let endQ = Math.min(totalQuestions, startQ + 2);

        for (let q = startQ; q <= endQ; q++) {
            const isCurrent = q === currentQ;
            const isAnswered = answers[q] !== undefined;
            const isPast = q < currentQ;

            if (q > startQ) {
                html += '<div class="step-separator"></div>';
            }

            const circleNum = isCurrent ? q : (isAnswered && !isCurrent ? '✓' : q);
            const activeClass = isCurrent ? 'active' : (isPast ? 'completed hoverable' : 'hoverable');
            const isSection = questions[q - 1] && questions[q - 1].type === 'section';
            const stepLabel = isSection ? (questions[q - 1].title || 'Section') : '';

            html += `
                <div class="step-item question-step ${activeClass} ${isSection ? 'section-step' : ''}" data-type="question" data-num="${q}">
                    <div class="step-circle">${isSection ? '§' : circleNum}</div>
                    <span class="step-label">${stepLabel}</span>
                </div>
            `;
        }
    }

    dynamicStepper.innerHTML = html;

    dynamicStepper.querySelectorAll('.step-item.question-step').forEach(item => {
        item.addEventListener('click', () => {
            if (isTransitioning) return;
            const num = parseInt(item.dataset.num);
            const targetIndex = num - 1;
            if (targetIndex >= 0 && targetIndex < questions.length) {
                saveCurrentAnswer();
                currentQuestionIndex = targetIndex;
                loadQuestion(currentQuestionIndex);
            }
        });
    });
}

function saveCurrentAnswer() {
    const q = questions[currentQuestionIndex];
    if (!q) return;
    if (q.type === 'section') return; // sections don't collect answers
    if (q.type === 'checkbox' && selectedAnswers.length > 0) {
        answers[q.id] = selectedAnswers.join(',');
    } else if (q.type === 'multiple_choice' && selectedAnswer) {
        answers[q.id] = selectedAnswer;
    } else if (q.type === 'text_input' && textValue.trim()) {
        answers[q.id] = textValue;
    }
}

function startForm() {
    if (isTransitioning) return;
    isTransitioning = true;
    startTime = Date.now();

    startScreen.querySelector('.question-card').style.animation = 'cardFadeOut 0.3s ease forwards';

    setTimeout(() => {
        startScreen.style.display = 'none';
        questionScreen.style.display = 'flex';
        document.getElementById('bottomNav').style.display = 'flex';
        updateStepper();
        loadQuestion(0);
        setTimeout(() => { isTransitioning = false; }, 300);
    }, 300);
}

function handleKeydown(e) {
    if (isTransitioning) return;
    const q = questions[currentQuestionIndex];
    if (!q) return;

    if (q.type === 'section') {
        if (e.key === 'Enter') handleContinue();
        return;
    }

    if (q.type === 'text_input') {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (textValue.trim()) handleContinue();
        }
        return;
    }

    if (q.type === 'checkbox') {
        if (e.key === 'a' || e.key === 'A') toggleOptionByIndex(0);
        else if (e.key === 'b' || e.key === 'B') toggleOptionByIndex(1);
        else if (e.key === 'c' || e.key === 'C') toggleOptionByIndex(2);
        else if (e.key === 'd' || e.key === 'D') toggleOptionByIndex(3);
        else if (e.key === 'e' || e.key === 'E') toggleOptionByIndex(4);
        else if (e.key === 'f' || e.key === 'F') toggleOptionByIndex(5);
        else if (e.key === 'g' || e.key === 'G') toggleOptionByIndex(6);
        else if (e.key === 'h' || e.key === 'H') toggleOptionByIndex(7);
        else if (e.key === 'Enter' && !continueBtn.disabled) handleContinue();
        else if (e.key === 'ArrowUp') { e.preventDefault(); navigate(-1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); navigate(1); }
        return;
    }

    if (e.key === 'a' || e.key === 'A') selectOptionByIndex(0);
    else if (e.key === 'b' || e.key === 'B') selectOptionByIndex(1);
    else if (e.key === 'c' || e.key === 'C') selectOptionByIndex(2);
    else if (e.key === 'd' || e.key === 'D') selectOptionByIndex(3);
    else if (e.key === 'Enter' && !continueBtn.disabled) handleContinue();
    else if (e.key === 'ArrowUp') { e.preventDefault(); navigate(-1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); navigate(1); }
}

function handleOptionClick(e) {
    if (isTransitioning) return;
    const btn = e.target.closest('.option-btn');
    if (!btn) return;

    const q = questions[currentQuestionIndex];
    if (!q) return;

    if (q.type === 'checkbox') {
        // Toggle selection
        const val = btn.dataset.value;
        if (btn.classList.contains('selected')) {
            btn.classList.remove('selected');
            selectedAnswers = selectedAnswers.filter(v => v !== val);
        } else {
            btn.classList.add('selected');
            selectedAnswers.push(val);
        }
        const hasSelection = selectedAnswers.length > 0;
        continueBtn.disabled = !hasSelection;
        continueBtn.style.opacity = hasSelection ? '1' : '0.5';
    } else {
        // Single select (multiple_choice)
        optionsList.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAnswer = btn.dataset.value;
        continueBtn.disabled = false;
        continueBtn.style.opacity = '1';
    }
}

function selectOptionByIndex(idx) {
    const btns = optionsList.querySelectorAll('.option-btn');
    if (btns[idx]) {
        btns.forEach(b => b.classList.remove('selected'));
        btns[idx].classList.add('selected');
        selectedAnswer = btns[idx].dataset.value;
        continueBtn.disabled = false;
        continueBtn.style.opacity = '1';
    }
}

function toggleOptionByIndex(idx) {
    const btns = optionsList.querySelectorAll('.option-btn');
    if (btns[idx]) {
        const val = btns[idx].dataset.value;
        if (btns[idx].classList.contains('selected')) {
            btns[idx].classList.remove('selected');
            selectedAnswers = selectedAnswers.filter(v => v !== val);
        } else {
            btns[idx].classList.add('selected');
            selectedAnswers.push(val);
        }
        const hasSelection = selectedAnswers.length > 0;
        continueBtn.disabled = !hasSelection;
        continueBtn.style.opacity = hasSelection ? '1' : '0.5';
    }
}

function handleContinue() {
    if (isTransitioning) return;
    const q = questions[currentQuestionIndex];
    if (!q) return;

    // Sections just advance
    if (q.type === 'section') {
        if (currentQuestionIndex >= questions.length - 1) {
            showResults();
            return;
        }
        currentQuestionIndex++;
        loadQuestion(currentQuestionIndex);
        return;
    }

    if (q.type === 'checkbox') {
        if (selectedAnswers.length === 0) return;
        answers[q.id] = selectedAnswers.join(',');
    } else if (q.type === 'multiple_choice') {
        if (!selectedAnswer) return;
        answers[q.id] = selectedAnswer;
    } else if (q.type === 'text_input') {
        if (!textValue.trim()) return;
        answers[q.id] = textValue;
    }

    if (currentQuestionIndex >= questions.length - 1) {
        showResults();
        return;
    }

    currentQuestionIndex++;
    loadQuestion(currentQuestionIndex);
}

function navigate(dir) {
    if (isTransitioning) return;
    const newIdx = currentQuestionIndex + dir;
    if (newIdx < 0 || newIdx >= questions.length) return;
    saveCurrentAnswer();
    currentQuestionIndex = newIdx;
    loadQuestion(currentQuestionIndex);
}

function loadQuestion(idx) {
    isTransitioning = true;
    continueBtn.disabled = true;
    continueBtn.style.opacity = '0.5';

    const q = questions[idx];
    if (!q) return;

    questionNumberEl.textContent = idx + 1;
    progressText.textContent = `${idx + 1}/${questions.length}`;
    scrollUpBtn.disabled = idx === 0;
    scrollDownBtn.disabled = idx === questions.length - 1;

    updateStepper();

    questionTextEl.classList.add('changing');
    questionHintEl.classList.add('changing');

    setTimeout(() => {
        if (q.type === 'section') {
            questionTextEl.innerHTML = q.title || '';
            questionHintEl.textContent = '';
        } else {
            questionTextEl.innerHTML = q.title;
            questionHintEl.textContent = q.type === 'text_input' ? 'shift ↵ enter untuk baris baru' : (q.type === 'checkbox' ? 'Pilih satu atau lebih' : 'Pilih salah satu');
        }
        questionTextEl.classList.remove('changing');
        questionHintEl.classList.remove('changing');
    }, 150);

    optionsList.style.opacity = '0';
    optionsList.style.transform = 'translateY(-10px)';

    setTimeout(() => {
        if (q.type === 'section') {
            // Section: show centered card with title, subtitle, button
            const colorStyle = q.color ? `border-top:3px solid ${q.color};` : '';
            const btnColorStyle = q.color ? `background:${q.color};` : '';
            optionsList.innerHTML = `
                <div class="section-screen" style="${colorStyle}">
                    <p class="section-subtitle">${q.subtitle || ''}</p>
                    <button class="continue-btn section-continue-btn" style="${btnColorStyle}" id="sectionContinueBtn">${q.buttonText || 'Lanjut'}</button>
                </div>
            `;
            const sectionBtn = document.getElementById('sectionContinueBtn');
            if (sectionBtn) {
                sectionBtn.style.opacity = '1';
                sectionBtn.disabled = false;
                sectionBtn.addEventListener('click', handleContinue);
            }
            continueBtn.style.display = 'none';
        } else if (q.type === 'text_input') {
            continueBtn.style.display = '';
            const placeholder = q.placeholder || 'ketik jawaban kamu di sini...';
            optionsList.innerHTML = `
                <div class="text-input-container">
                    <textarea id="textAnswer" class="text-input" placeholder="${placeholder}" rows="4"></textarea>
                    <div class="text-input-hint">shift ↵ enter untuk baris baru</div>
                </div>
            `;

            const ta = document.getElementById('textAnswer');
            ta.value = answers[q.id] || '';
            textValue = answers[q.id] || '';

            ta.addEventListener('input', (e) => {
                textValue = e.target.value;
                continueBtn.disabled = !textValue.trim();
                continueBtn.style.opacity = textValue.trim() ? '1' : '0.5';
            });
            ta.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (textValue.trim()) handleContinue();
                }
            });

            if (textValue.trim()) {
                continueBtn.disabled = false;
                continueBtn.style.opacity = '1';
            }
            setTimeout(() => ta.focus(), 100);
        } else if (q.type === 'checkbox') {
            continueBtn.style.display = '';
            const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
            selectedAnswers = [];
            optionsList.innerHTML = q.options.map((opt, i) => `
                <button class="option-btn checkbox-btn" data-key="${labels[i]}" data-value="${opt.value}">
                    <span class="option-key">
                        <svg class="checkbox-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <rect x="1" y="1" width="12" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                        <svg class="checkbox-checked-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" style="display:none">
                            <rect x="1" y="1" width="12" height="12" rx="3" fill="currentColor" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M4 7l2 2 4-4" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </span>
                    <span class="option-text">${opt.text}</span>
                </button>
            `).join('');

            // Restore previous selections
            if (answers[q.id]) {
                const prevAnswers = answers[q.id].split(',');
                prevAnswers.forEach(val => {
                    const savedBtn = optionsList.querySelector(`[data-value="${val}"]`);
                    if (savedBtn) {
                        savedBtn.classList.add('selected');
                        savedBtn.querySelector('.checkbox-icon').style.display = 'none';
                        savedBtn.querySelector('.checkbox-checked-icon').style.display = '';
                        selectedAnswers.push(val);
                    }
                });
                continueBtn.disabled = false;
                continueBtn.style.opacity = '1';
            } else {
                selectedAnswers = [];
                continueBtn.disabled = true;
                continueBtn.style.opacity = '0.5';
            }
            selectedAnswer = null;
        } else {
            // multiple_choice
            continueBtn.style.display = '';
            const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
            optionsList.innerHTML = q.options.map((opt, i) => `
                <button class="option-btn" data-key="${labels[i]}" data-value="${opt.value}">
                    <span class="option-key">${labels[i]}</span>
                    <span class="option-text">${opt.text}</span>
                </button>
            `).join('');

            if (answers[q.id]) {
                const savedBtn = optionsList.querySelector(`[data-value="${answers[q.id]}"]`);
                if (savedBtn) {
                    savedBtn.classList.add('selected');
                    selectedAnswer = answers[q.id];
                    continueBtn.disabled = false;
                    continueBtn.style.opacity = '1';
                }
            } else {
                selectedAnswer = null;
            }
        }

        // Apply color to full page and card — seamless
        const mainContainer = questionScreen;
        const questionCard = mainContainer ? mainContainer.querySelector('.question-card') : null;
        if (q.color) {
            mainContainer.style.background = q.color + '18';
            if (questionCard) {
                questionCard.style.background = q.color + '18';
                questionCard.style.boxShadow = 'none';
            }
        } else {
            mainContainer.style.background = '';
            if (questionCard) {
                questionCard.style.background = '';
                questionCard.style.boxShadow = '';
            }
        }

        optionsList.style.opacity = '1';
        optionsList.style.transform = 'translateY(0)';

        // Render question image if exists (not for sections)
        const existingImg = questionScreen.querySelector('.question-image');
        if (existingImg) existingImg.remove();

        if (q.image && q.image.url && q.type !== 'section') {
            const imgDiv = document.createElement('div');
            imgDiv.className = 'question-image';
            imgDiv.innerHTML = `<img src="${q.image.url}" style="transform: scale(${q.image.zoom || 1}) translate(${q.image.offsetX || 0}%, ${q.image.offsetY || 0}%)" draggable="false">`;
            questionTextEl.parentNode.insertBefore(imgDiv, questionHintEl.nextSibling);
        }

        setTimeout(() => { isTransitioning = false; }, 200);
    }, 200);
}

async function showResults() {
    isTransitioning = true;

    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    const answersArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer
    }));

    // Save to Supabase if configured, else localStorage
    if (useSupabase) {
        await saveResponseToSupabase(timeTaken, answersArray);
    } else {
        saveRespondentData(answers, timeTaken);
    }

    // Update stepper
    let resultsHtml = '';
    for (let i = 0; i < questions.length; i++) {
        if (i > 0) resultsHtml += '<div class="step-separator"></div>';
        resultsHtml += `
            <div class="step-item question-step completed" data-type="question" data-num="${i + 1}">
                <div class="step-circle">✓</div>
                <span class="step-label"></span>
            </div>
        `;
    }
    resultsHtml += `
        <div class="step-separator"></div>
        <div class="step-item active">
            <div class="step-circle">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <span class="step-label">Selesai</span>
        </div>
    `;
    dynamicStepper.innerHTML = resultsHtml;

    questionScreen.style.display = 'none';
    document.getElementById('bottomNav').style.display = 'none';
    resultsScreen.style.display = 'flex';

    document.getElementById('resultsTitle').textContent = formConfig.results.title;
    document.getElementById('resultsSubtitle').textContent = formConfig.results.subtitle;
    restartBtn.textContent = formConfig.results.buttonText || 'Ikuti Lagi';

    createConfetti();
    isTransitioning = false;
}

function saveRespondentData(answersData, timeTaken) {
    const allRespondents = JSON.parse(localStorage.getItem('form360_respondents') || '[]');
    const newRespondent = {
        id: Date.now(),
        formId: currentFormId,
        answers: answersData,
        timeTaken: timeTaken,
        timestamp: Date.now()
    };
    allRespondents.push(newRespondent);
    localStorage.setItem('form360_respondents', JSON.stringify(allRespondents));
}

function restartForm() {
    currentQuestionIndex = 0;
    answers = {};
    selectedAnswer = null;
    selectedAnswers = [];
    textValue = '';
    startTime = null;

    resultsScreen.style.display = 'none';
    startScreen.style.display = 'flex';
    startScreen.querySelector('.question-card').style.animation = 'cardFadeIn 0.5s ease';

    initWelcomeScreen();
    updateStepper();
}

function createConfetti() {
    const colors = ['#2D2D2D', '#6B6B6B', '#A0A0A0', '#D8D8D8', '#4DABF7'];
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const c = document.createElement('div');
            c.className = 'confetti';
            c.style.cssText = `left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};animation-delay:${Math.random()*0.5}s;animation-duration:${2+Math.random()}s`;
            document.body.appendChild(c);
            setTimeout(() => c.remove(), 3000);
        }, i * 40);
    }
}