// Formure — Viewer
// Loads forms via our own PocketBase (API rules gate public reads to published forms)
// or URL-encoded fallback for previews.
// All user-authored content is rendered with textContent or DOM APIs to prevent XSS.

const cfg = window.FORMURE_CONFIG || {};
const API_URL = cfg.API_URL || '';

let questions = [];
let formConfig = {
    welcome: { title: 'Hello, Welcome!', subtitle: 'Press Start or Enter to begin' },
    results: { title: 'Thank You!', subtitle: 'You have completed this form', buttonText: 'Try Again' }
};

let currentFormId = null;
let currentQuestionIndex = 0;
let answers = {};
let selectedAnswer = null;
let selectedAnswers = [];
let textValue = '';
let isTransitioning = false;
let startTime = null;
let useBackend = false;
let pb = null;

let dynamicStepper, startScreen, questionScreen, resultsScreen;
let startBtn, continueBtn, restartBtn;
let backBtn, nextBtn, progressText;
let optionsList, questionNumberEl, questionTextEl, questionHintEl;

document.addEventListener('DOMContentLoaded', init);

async function init() {
    if (API_URL && window.PocketBase) {
        pb = new PocketBase(API_URL);
        useBackend = true;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const isPreview = urlParams.get('preview') === 'true';
    // Form id can arrive as ?form=<id> or via the pretty /f/<id> and /s/<id> share paths.
    const formId = urlParams.get('form') || (location.pathname.match(/^\/[fs]\/([a-zA-Z0-9]+)/) || [])[1] || null;
    const formDataParam = urlParams.get('data');

    dynamicStepper = document.getElementById('dynamicStepper');
    startScreen = document.getElementById('startScreen');
    questionScreen = document.getElementById('questionScreen');
    resultsScreen = document.getElementById('resultsScreen');
    startBtn = document.getElementById('startBtn');
    continueBtn = document.getElementById('continueBtn');
    restartBtn = document.getElementById('restartBtn');
    backBtn = document.getElementById('backBtn');
    nextBtn = document.getElementById('nextBtn');
    progressText = document.getElementById('progressText');
    optionsList = document.querySelector('.options-list');
    questionNumberEl = document.querySelector('.q-number');
    questionTextEl = document.querySelector('.question-text');
    questionHintEl = document.querySelector('.question-hint');

    if (useBackend && formId && isValidFormId(formId)) {
        const result = await getFormFromBackend(formId);
        if (result.kind === 'ok' && result.data) {
            const formData = result.data;
            currentFormId = formData.id;
            questions = formData.questions || [];
            formConfig = {
                welcome: { title: formData.welcome_title || formConfig.welcome.title, subtitle: formData.welcome_subtitle || formConfig.welcome.subtitle },
                results: { title: formData.results_title || formConfig.results.title, subtitle: formData.results_subtitle || formConfig.results.subtitle, buttonText: formData.results_button_text || formConfig.results.buttonText }
            };
        } else if (result.kind === 'network') {
            showViewerError(
                'Connection problem',
                'Could not reach the server. Check your internet connection, then try again.',
                true
            );
            return;
        }
    }

    if (questions.length === 0 && formDataParam) {
        const formData = decodeFormParam(formDataParam);
        if (formData) {
            currentFormId = formData.id;
            questions = formData.questions || [];
            formConfig = { welcome: formData.welcome || formConfig.welcome, results: formData.results || formConfig.results };
        }
    }

    if (questions.length === 0 && isPreview) {
        const savedForm = sessionStorage.getItem('formure_preview');
        if (savedForm) {
            try {
                const formData = JSON.parse(savedForm);
                currentFormId = formData.id;
                questions = formData.questions || [];
                formConfig = { welcome: formData.welcome || formConfig.welcome, results: formData.results || formConfig.results };
            } catch (e) {}
        }
    }

    if (questions.length === 0) {
        if (!formId && !formDataParam && !isPreview) {
            window.location.href = '/';
            return;
        }
        showViewerError('Form Not Found', 'This form is not available. Make sure the link is correct.', false);
        return;
    }

    startBtn.addEventListener('click', startForm);
    document.addEventListener('keydown', handleKeydown);
    optionsList.addEventListener('click', handleOptionClick);
    continueBtn.addEventListener('click', handleContinue);
    restartBtn.addEventListener('click', restartForm);
    backBtn.addEventListener('click', () => navigate(-1));
    nextBtn.addEventListener('click', handleContinue);

    initWelcomeScreen();
    updateStepper();
}

function decodeFormParam(param) {
    try {
        const urlDecoded = decodeURIComponent(param);
        return JSON.parse(decodeURIComponent(escape(atob(urlDecoded))));
    } catch (e) {
        try {
            return JSON.parse(decodeURIComponent(escape(atob(param.replace(/ /g, '+')))));
        } catch (e2) {
            return null;
        }
    }
}

async function getFormFromBackend(formId) {
    if (!pb) return { kind: 'notfound', data: null };

    // One automatic retry — mobile networks hiccup and a single dropped request
    // should never read as "form not found".
    const attempt = async (fn) => {
        let lastErr;
        for (let i = 0; i < 2; i++) {
            try { return await fn(); } catch (e) { lastErr = e; }
        }
        throw lastErr;
    };

    let data = null;
    try {
        data = await attempt(() => pb.collection('forms').getOne(formId));
    } catch (e) {
        if (!e || e.status !== 404) return { kind: 'network', data: null };
    }
    if (!data) {
        // Short share slug (/f/<slug>) — resolve by slug field.
        try {
            const list = await attempt(() => pb.collection('forms').getList(1, 1, {
                filter: pb.filter('slug = {:s}', { s: formId })
            }));
            data = (list.items && list.items[0]) || null;
        } catch (e) {
            return { kind: 'network', data: null };
        }
    }
    if (!data) return { kind: 'notfound', data: null };

    let questionsData = [];
    try {
        questionsData = await attempt(() => pb.collection('questions').getFullList({
            filter: pb.filter('form_id = {:formId}', { formId: data.id }),
            sort: 'question_order'
        }));
    } catch (e) {
        return { kind: 'network', data: null };
    }

    data.questions = questionsData.map(normalizeQuestion);
    return { kind: 'ok', data };
}

function normalizeQuestion(q) {
    // Supports both new schema (native columns) and legacy schema (encoded in options/placeholder).
    let realType = q.question_type;
    let subtitle = q.subtitle || '';
    let buttonText = q.button_text || 'Continue';
    let color = q.color || null;
    let image = q.image || null;
    let options = null;

    // Legacy fallback: section encoded as text_input with __section__ placeholder
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

    return {
        id: q.id,
        type: realType,
        title: q.title || '',
        placeholder: realType === 'section' ? '' : (q.placeholder || ''),
        subtitle: realType === 'section' ? subtitle : undefined,
        buttonText: realType === 'section' ? buttonText : undefined,
        options,
        color,
        image
    };
}

async function saveResponseToBackend(timeTaken, answersArray) {
    if (!pb) return false;
    try {
        const response = await pb.collection('responses').create({
            form_id: currentFormId,
            time_taken: timeTaken
        });

        // Prefer an atomic batch so a respondent's answers are saved all-or-nothing.
        if (typeof pb.batch === 'function') {
            const batch = pb.batch();
            for (const a of answersArray) {
                batch.collection('answers').create({
                    response_id: response.id,
                    question_id: a.questionId,
                    answer_value: a.answer
                });
            }
            await batch.send();
        } else {
            for (const a of answersArray) {
                await pb.collection('answers').create({
                    response_id: response.id,
                    question_id: a.questionId,
                    answer_value: a.answer
                });
            }
        }
        return true;
    } catch (e) {
        console.error('saveResponseToBackend failed:', e);
        return false;
    }
}

function isValidFormId(str) {
    // PocketBase record ids (15 chars) or short share slugs (7 chars).
    return /^[a-zA-Z0-9]{5,15}$/.test(str);
}

function initWelcomeScreen() {
    const titleEl = document.getElementById('welcomeTitle');
    const subEl = document.getElementById('welcomeSubtitle');
    if (titleEl) titleEl.textContent = formConfig.welcome.title;
    if (subEl) {
        subEl.textContent = '';
        const lines = (formConfig.welcome.subtitle || '').split('\n');
        lines.forEach((line, i) => {
            if (i > 0) subEl.appendChild(document.createElement('br'));
            subEl.appendChild(document.createTextNode(line));
        });
    }
}

// Error screen on the start card: retry=true adds a reload button (network problems
// must never be presented as "form not found").
function showViewerError(title, subtitle, retry) {
    const titleEl = document.getElementById('welcomeTitle');
    const subEl = document.getElementById('welcomeSubtitle');
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle;
    const startBtnElement = document.getElementById('startBtn');
    if (startBtnElement) startBtnElement.style.display = retry ? '' : 'none';
    if (retry && startBtnElement) {
        startBtnElement.textContent = 'Try again';
        startBtnElement.disabled = false;
        startBtnElement.style.opacity = '1';
        startBtnElement.replaceWith(startBtnElement.cloneNode(true));
        const fresh = document.getElementById('startBtn');
        fresh.addEventListener('click', () => window.location.reload());
    }
}

function updateStepper() {
    const totalQuestions = questions.length;
    const currentQ = currentQuestionIndex + 1;
    dynamicStepper.replaceChildren();

    const makeItem = (cls, circleText, label, num) => {
        const item = document.createElement('div');
        item.className = `step-item ${cls}`;
        if (num !== undefined) item.dataset.num = num;
        const circle = document.createElement('div');
        circle.className = 'step-circle';
        circle.textContent = circleText;
        item.appendChild(circle);
        const labelEl = document.createElement('span');
        labelEl.className = 'step-label';
        labelEl.textContent = label;
        item.appendChild(labelEl);
        return item;
    };

    const sep = () => {
        const s = document.createElement('div');
        s.className = 'step-separator';
        return s;
    };

    if (currentQ === 1) {
        dynamicStepper.appendChild(makeItem('mulai-step active', '', 'Start'));
        dynamicStepper.appendChild(sep());
        dynamicStepper.appendChild(makeItem('question-step active', '1', '', 1));
    } else {
        let startQ = Math.max(1, currentQ - 1);
        if (currentQ >= totalQuestions - 1) startQ = Math.max(1, totalQuestions - 2);
        const endQ = Math.min(totalQuestions, startQ + 2);
        for (let q = startQ; q <= endQ; q++) {
            if (q > startQ) dynamicStepper.appendChild(sep());
            const isCurrent = q === currentQ;
            const isAnswered = answers[questions[q - 1]?.id] !== undefined;
            const isPast = q < currentQ;
            const isSection = questions[q - 1] && questions[q - 1].type === 'section';
            const circleText = isSection ? '§' : (isCurrent ? String(q) : (isAnswered && !isCurrent ? '✓' : String(q)));
            const cls = `question-step ${isCurrent ? 'active' : (isPast ? 'completed hoverable' : 'hoverable')} ${isSection ? 'section-step' : ''}`;
            const label = isSection ? (questions[q - 1].title || 'Section') : '';
            dynamicStepper.appendChild(makeItem(cls, circleText, label, q));
        }
    }

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
    if (!q || q.type === 'section') return;
    if (q.type === 'checkbox' && selectedAnswers.length > 0) {
        answers[q.id] = selectedAnswers.join(',');
    } else if (q.type === 'multiple_choice' && selectedAnswer) {
        answers[q.id] = selectedAnswer;
    } else if (q.type === 'text_input' && textValue.trim()) {
        answers[q.id] = textValue;
    }
}

function setContinueEnabled(on) {
    continueBtn.disabled = !on;
    continueBtn.style.opacity = on ? '1' : '0.5';
    if (nextBtn) nextBtn.disabled = !on;
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
        document.body.classList.add('nav-visible');
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

    const letterMap = {};
    for (let k = 0; k < 26; k++) letterMap[String.fromCharCode(97 + k)] = k;
    const idx = letterMap[e.key.toLowerCase()];

    if (q.type === 'checkbox') {
        if (idx !== undefined) toggleOptionByIndex(idx);
        else if (e.key === 'Enter' && !continueBtn.disabled) handleContinue();
        else if (e.key === 'ArrowUp') { e.preventDefault(); navigate(-1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); navigate(1); }
        return;
    }

    if (idx !== undefined) selectOptionByIndex(idx);
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
        const val = btn.dataset.value;
        if (btn.classList.contains('selected')) {
            btn.classList.remove('selected');
            selectedAnswers = selectedAnswers.filter(v => v !== val);
        } else {
            btn.classList.add('selected');
            selectedAnswers.push(val);
        }
        setContinueEnabled(selectedAnswers.length > 0);
    } else {
        optionsList.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAnswer = btn.dataset.value;
        setContinueEnabled(true);
    }
}

function selectOptionByIndex(idx) {
    const btns = optionsList.querySelectorAll('.option-btn');
    if (btns[idx]) {
        btns.forEach(b => b.classList.remove('selected'));
        btns[idx].classList.add('selected');
        selectedAnswer = btns[idx].dataset.value;
        setContinueEnabled(true);
    }
}

function toggleOptionByIndex(idx) {
    const btns = optionsList.querySelectorAll('.option-btn');
    if (!btns[idx]) return;
    const val = btns[idx].dataset.value;
    if (btns[idx].classList.contains('selected')) {
        btns[idx].classList.remove('selected');
        selectedAnswers = selectedAnswers.filter(v => v !== val);
    } else {
        btns[idx].classList.add('selected');
        selectedAnswers.push(val);
    }
    setContinueEnabled(selectedAnswers.length > 0);
}

function handleContinue() {
    if (isTransitioning) return;
    const q = questions[currentQuestionIndex];
    if (!q) return;

    if (q.type === 'section') {
        if (currentQuestionIndex >= questions.length - 1) { showResults(); return; }
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

    if (currentQuestionIndex >= questions.length - 1) { showResults(); return; }
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
    if (backBtn) backBtn.disabled = idx === 0;
    if (nextBtn) {
        nextBtn.disabled = true;
        const isLast = idx === questions.length - 1;
        nextBtn.innerHTML = isLast
            ? 'Finish <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l3.5 3.5 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            : 'Next <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    updateStepper();

    questionTextEl.classList.add('changing');
    questionHintEl.classList.add('changing');

    setTimeout(() => {
        if (q.type === 'section') {
            questionTextEl.textContent = q.title || '';
            questionHintEl.textContent = '';
        } else {
            questionTextEl.textContent = q.title || '';
            questionHintEl.textContent = q.type === 'text_input'
                ? 'shift ↵ enter for new line'
                : (q.type === 'checkbox' ? 'Select one or more' : 'Choose one');
        }
        questionTextEl.classList.remove('changing');
        questionHintEl.classList.remove('changing');
    }, 150);

    optionsList.style.opacity = '0';
    optionsList.style.transform = 'translateY(-10px)';

    setTimeout(() => {
        optionsList.replaceChildren();
        // Adaptive option layout: everything must fit the screen — no hidden scroll,
        // no text bleeding out of boxes. Short labels → 2-col grid; long labels on a
        // phone → single-column compact rows; roomy screens keep the big cards.
        const isNarrow = window.matchMedia('(max-width: 700px)').matches;
        const opts = q.options || [];
        const optCount = opts.length;
        const maxLabelLen = opts.length ? Math.max(...opts.map(o => (o.text || '').length)) : 0;
        const longLabels = maxLabelLen > (isNarrow ? 16 : 30);
        let mode = 'cards';
        if (q.type === 'multiple_choice' || q.type === 'checkbox') {
            if (optCount > 4) mode = (isNarrow && longLabels) ? 'list' : 'grid';
            else if (isNarrow) mode = longLabels ? 'list' : 'grid';
        }
        const compact = mode !== 'cards';
        optionsList.classList.toggle('grid-mode', mode === 'grid');
        optionsList.classList.toggle('list-mode', mode === 'list');
        const btnClass = extra => 'option-btn ' + extra + (compact ? (mode === 'list' ? ' list-compact' : ' compact') : '');

        if (q.type === 'section') {
            setContinueEnabled(true);
            const screen = document.createElement('div');
            screen.className = 'section-screen';
            if (q.color) screen.style.borderTop = `3px solid ${q.color}`;
            const sub = document.createElement('p');
            sub.className = 'section-subtitle';
            sub.textContent = q.subtitle || '';
            const btn = document.createElement('button');
            btn.className = 'continue-btn section-continue-btn';
            btn.id = 'sectionContinueBtn';
            btn.textContent = q.buttonText || 'Continue';
            if (q.color) btn.style.background = q.color;
            btn.addEventListener('click', handleContinue);
            screen.append(sub, btn);
            optionsList.appendChild(screen);
            continueBtn.style.display = 'none';
        } else if (q.type === 'text_input') {
            continueBtn.style.display = '';
            const wrap = document.createElement('div');
            wrap.className = 'text-input-container';
            const ta = document.createElement('textarea');
            ta.id = 'textAnswer';
            ta.className = 'text-input';
            ta.placeholder = q.placeholder || 'Type your answer here...';
            ta.rows = 4;
            const hint = document.createElement('div');
            hint.className = 'text-input-hint';
            hint.textContent = 'shift ↵ enter for new line';
            wrap.append(ta, hint);
            optionsList.appendChild(wrap);

            ta.value = answers[q.id] || '';
            textValue = ta.value;
            ta.addEventListener('input', e => {
                textValue = e.target.value;
                setContinueEnabled(!!textValue.trim());
            });
            ta.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (textValue.trim()) handleContinue();
                }
            });
            if (textValue.trim()) {
                setContinueEnabled(true);
            }
            setTimeout(() => ta.focus(), 100);
        } else if (q.type === 'checkbox') {
            continueBtn.style.display = '';
            selectedAnswers = [];
            const labels = Array.from({ length: 26 }, (_, k) => String.fromCharCode(65 + k));
            (q.options || []).forEach((opt, i) => {
                const btn = document.createElement('button');
                btn.className = btnClass('checkbox-btn');
                btn.dataset.key = labels[i];
                btn.dataset.value = opt.value;
                btn.innerHTML = `
                    <span class="option-key">
                        <svg class="checkbox-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <rect x="1" y="1" width="12" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                        <svg class="checkbox-checked-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" style="display:none">
                            <rect x="1" y="1" width="12" height="12" rx="3" fill="currentColor" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M4 7l2 2 4-4" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </span>
                `;
                const text = document.createElement('span');
                text.className = 'option-text';
                text.textContent = opt.text;
                btn.appendChild(text);
                optionsList.appendChild(btn);
            });

            if (answers[q.id]) {
                const prev = answers[q.id].split(',');
                prev.forEach(val => {
                    const savedBtn = optionsList.querySelector(`[data-value="${cssEscape(val)}"]`);
                    if (savedBtn) {
                        savedBtn.classList.add('selected');
                        savedBtn.querySelector('.checkbox-icon').style.display = 'none';
                        savedBtn.querySelector('.checkbox-checked-icon').style.display = '';
                        selectedAnswers.push(val);
                    }
                });
                setContinueEnabled(true);
            } else {
                setContinueEnabled(false);
            }
            selectedAnswer = null;
        } else {
            continueBtn.style.display = '';
            const labels = Array.from({ length: 26 }, (_, k) => String.fromCharCode(65 + k));
            (q.options || []).forEach((opt, i) => {
                const btn = document.createElement('button');
                btn.className = btnClass('');
                btn.dataset.key = labels[i];
                btn.dataset.value = opt.value;
                const key = document.createElement('span');
                key.className = 'option-key';
                key.textContent = labels[i];
                const text = document.createElement('span');
                text.className = 'option-text';
                text.textContent = opt.text;
                btn.append(key, text);
                optionsList.appendChild(btn);
            });

            if (answers[q.id]) {
                const savedBtn = optionsList.querySelector(`[data-value="${cssEscape(answers[q.id])}"]`);
                if (savedBtn) {
                    savedBtn.classList.add('selected');
                    selectedAnswer = answers[q.id];
                    setContinueEnabled(true);
                }
            } else {
                selectedAnswer = null;
            }
        }

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

        const existingImg = questionScreen.querySelector('.question-image');
        if (existingImg) existingImg.remove();
        if (q.image && q.image.url && q.type !== 'section') {
            const imgDiv = document.createElement('div');
            imgDiv.className = 'question-image';
            const img = document.createElement('img');
            img.src = q.image.url;
            img.style.transform = `scale(${q.image.zoom || 1}) translate(${q.image.offsetX || 0}%, ${q.image.offsetY || 0}%)`;
            img.draggable = false;
            imgDiv.appendChild(img);
            questionTextEl.parentNode.insertBefore(imgDiv, questionHintEl.nextSibling);
        }

        setTimeout(() => { isTransitioning = false; }, 200);
    }, 200);
}

function cssEscape(val) {
    return String(val).replace(/["\\]/g, '\\$&');
}

async function showResults() {
    isTransitioning = true;
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    const answersArray = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));

    if (useBackend) {
        const saved = await saveResponseToBackend(timeTaken, answersArray);
        if (!saved) {
            // Never show "Thank You" on a failed save — the respondent's answers
            // are still in memory; offer a retry instead of losing them silently.
            showSaveFailedScreen(timeTaken, answersArray);
            return;
        }
    }

    dynamicStepper.replaceChildren();
    for (let i = 0; i < questions.length; i++) {
        if (i > 0) {
            const sep = document.createElement('div');
            sep.className = 'step-separator';
            dynamicStepper.appendChild(sep);
        }
        const item = document.createElement('div');
        item.className = 'step-item question-step completed';
        item.dataset.num = i + 1;
        const circle = document.createElement('div');
        circle.className = 'step-circle';
        circle.textContent = '✓';
        item.appendChild(circle);
        dynamicStepper.appendChild(item);
    }
    const sep = document.createElement('div');
    sep.className = 'step-separator';
    const done = document.createElement('div');
    done.className = 'step-item active';
    done.innerHTML = `<div class="step-circle"><svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><span class="step-label">Done</span>`;
    dynamicStepper.append(sep, done);

    questionScreen.style.display = 'none';
    document.getElementById('bottomNav').style.display = 'none';
    document.body.classList.remove('nav-visible');
    resultsScreen.style.display = 'flex';

    document.getElementById('resultsTitle').textContent = formConfig.results.title;
    document.getElementById('resultsSubtitle').textContent = formConfig.results.subtitle;
    restartBtn.textContent = formConfig.results.buttonText || 'Try Again';

    createConfetti();
    isTransitioning = false;
}

// Shown when submitting answers failed (network): keep answers in memory and retry.
function showSaveFailedScreen(timeTaken, answersArray) {
    questionScreen.style.display = 'none';
    document.getElementById('bottomNav').style.display = 'none';
    document.body.classList.remove('nav-visible');
    resultsScreen.style.display = 'flex';
    document.getElementById('resultsTitle').textContent = 'Connection problem';
    const sub = document.getElementById('resultsSubtitle');
    sub.textContent = 'Your answers were not saved yet. Check your connection and press Try Again.';
    restartBtn.textContent = 'Try Again';
    restartBtn.replaceWith(restartBtn.cloneNode(true));
    const fresh = document.getElementById('restartBtn');
    fresh.addEventListener('click', async () => {
        fresh.disabled = true;
        fresh.textContent = 'Saving…';
        const ok = await saveResponseToBackend(timeTaken, answersArray);
        if (ok) {
            window.location.reload();
        } else {
            fresh.disabled = false;
            fresh.textContent = 'Try Again';
        }
    });
    isTransitioning = false;
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
    const baseColor = (questions.find(q => q.color) || {}).color;
    const colors = baseColor
        ? [baseColor, baseColor + 'cc', baseColor + '99', '#2D2D2D', '#A0A0A0']
        : ['#2D2D2D', '#6B6B6B', '#A0A0A0', '#D8D8D8', '#4DABF7'];
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const c = document.createElement('div');
            c.className = 'confetti';
            c.style.cssText = `left:${Math.random() * 100}%;background:${colors[Math.floor(Math.random() * colors.length)]};animation-delay:${Math.random() * 0.5}s;animation-duration:${2 + Math.random()}s`;
            document.body.appendChild(c);
            setTimeout(() => c.remove(), 3000);
        }, i * 40);
    }
}
