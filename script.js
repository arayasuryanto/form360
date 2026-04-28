// Formure — Viewer
// Loads forms via Supabase (anon key + RLS) or URL-encoded fallback for previews.
// All user-authored content is rendered with textContent or DOM APIs to prevent XSS.

const cfg = window.FORMURE_CONFIG || {};
const SUPABASE_URL = cfg.SUPABASE_URL || '';
const SUPABASE_KEY = cfg.SUPABASE_KEY || '';

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
let useSupabase = false;
let sbClient = null;

let dynamicStepper, startScreen, questionScreen, resultsScreen;
let startBtn, continueBtn, restartBtn;
let scrollUpBtn, scrollDownBtn, progressText;
let optionsList, questionNumberEl, questionTextEl, questionHintEl;

document.addEventListener('DOMContentLoaded', init);

async function init() {
    if (SUPABASE_URL && SUPABASE_KEY && window.supabase) {
        sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        useSupabase = true;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const isPreview = urlParams.get('preview') === 'true';
    const formId = urlParams.get('form');
    const formDataParam = urlParams.get('data');

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
            // Silent — falls through to error screen below
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
        document.getElementById('welcomeTitle').textContent = 'Form Not Found';
        document.getElementById('welcomeSubtitle').textContent = 'This form is not available. Make sure the link is correct.';
        const startBtnElement = document.getElementById('startBtn');
        if (startBtnElement) startBtnElement.style.display = 'none';
        return;
    }

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

async function getFormFromSupabase(formId) {
    if (!sbClient) return null;
    const { data, error } = await sbClient.from('forms').select('*').eq('id', formId).single();
    if (error || !data) return null;

    const { data: questionsData } = await sbClient
        .from('questions')
        .select('*')
        .eq('form_id', formId)
        .order('question_order', { ascending: true });

    data.questions = (questionsData || []).map(normalizeQuestion);
    return data;
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

async function saveResponseToSupabase(timeTaken, answersArray) {
    if (!sbClient) return false;
    try {
        const { data: response, error: respError } = await sbClient
            .from('responses')
            .insert({ form_id: currentFormId, time_taken: timeTaken })
            .select()
            .single();
        if (respError) throw respError;

        const answersToInsert = answersArray.map(a => ({
            response_id: response.id,
            question_id: a.questionId,
            answer_value: a.answer
        }));
        await sbClient.from('answers').insert(answersToInsert);
        return true;
    } catch (e) {
        return false;
    }
}

function isValidUUID(str) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
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

    const letterMap = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, g: 6, h: 7 };
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
        const has = selectedAnswers.length > 0;
        continueBtn.disabled = !has;
        continueBtn.style.opacity = has ? '1' : '0.5';
    } else {
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
    if (!btns[idx]) return;
    const val = btns[idx].dataset.value;
    if (btns[idx].classList.contains('selected')) {
        btns[idx].classList.remove('selected');
        selectedAnswers = selectedAnswers.filter(v => v !== val);
    } else {
        btns[idx].classList.add('selected');
        selectedAnswers.push(val);
    }
    const has = selectedAnswers.length > 0;
    continueBtn.disabled = !has;
    continueBtn.style.opacity = has ? '1' : '0.5';
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
    scrollUpBtn.disabled = idx === 0;
    scrollDownBtn.disabled = idx === questions.length - 1;
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

        if (q.type === 'section') {
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
                continueBtn.disabled = !textValue.trim();
                continueBtn.style.opacity = textValue.trim() ? '1' : '0.5';
            });
            ta.addEventListener('keydown', e => {
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
            selectedAnswers = [];
            const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
            (q.options || []).forEach((opt, i) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn checkbox-btn';
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
                continueBtn.disabled = false;
                continueBtn.style.opacity = '1';
            } else {
                continueBtn.disabled = true;
                continueBtn.style.opacity = '0.5';
            }
            selectedAnswer = null;
        } else {
            continueBtn.style.display = '';
            const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
            (q.options || []).forEach((opt, i) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
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
                    continueBtn.disabled = false;
                    continueBtn.style.opacity = '1';
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

    if (useSupabase) {
        await saveResponseToSupabase(timeTaken, answersArray);
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
    resultsScreen.style.display = 'flex';

    document.getElementById('resultsTitle').textContent = formConfig.results.title;
    document.getElementById('resultsSubtitle').textContent = formConfig.results.subtitle;
    restartBtn.textContent = formConfig.results.buttonText || 'Try Again';

    createConfetti();
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
