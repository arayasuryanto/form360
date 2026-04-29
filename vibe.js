// Formure — Vibe Check (prototype)
// Generative form experience: every keystroke / pick reshapes the card live.

const questions = [
    {
        type: 'text_input',
        title: 'Hey there. What should we call you?',
        hint: 'just a first name is fine',
        placeholder: 'your name',
        key: 'name'
    },
    {
        type: 'multiple_choice',
        title: 'Pick a color that feels like today.',
        hint: 'no wrong answers',
        key: 'palette',
        options: [
            { label: 'Peach', value: 'peach', swatch: '#f5a05a' },
            { label: 'Indigo', value: 'indigo', swatch: '#7c6df0' },
            { label: 'Sage',   value: 'sage',   swatch: '#8fbc8f' },
            { label: 'Amber',  value: 'amber',  swatch: '#ffc107' },
            { label: 'Rose',   value: 'rose',   swatch: '#ff8a9b' },
            { label: 'Slate',  value: 'slate',  swatch: '#6b7d96' }
        ]
    },
    {
        type: 'text_input',
        title: "What's something you're into right now?",
        hint: 'a song, a feeling, anything',
        placeholder: 'into…',
        key: 'tagline'
    },
    {
        type: 'multiple_choice',
        title: "What's your energy?",
        hint: 'pick the closest one',
        key: 'energy',
        options: [
            { label: 'Chill',  value: 'chill',  emoji: '🫧' },
            { label: 'Sharp',  value: 'sharp',  emoji: '⚡' },
            { label: 'Dreamy', value: 'dreamy', emoji: '🌙' },
            { label: 'Wild',   value: 'wild',   emoji: '🎈' }
        ]
    },
    {
        type: 'text_input',
        title: 'Your week in three words.',
        hint: 'separate with commas',
        placeholder: 'soft, busy, grateful',
        key: 'words'
    },
    {
        type: 'multiple_choice',
        title: 'And finally — pick a symbol.',
        hint: 'this becomes the heart of your card',
        key: 'symbol',
        options: [
            { label: 'Star',     value: '✦', emoji: '✦' },
            { label: 'Sun',      value: '☀', emoji: '☀' },
            { label: 'Moon',     value: '☾', emoji: '☾' },
            { label: 'Lightning',value: '⚡', emoji: '⚡' },
            { label: 'Heart',    value: '♥', emoji: '♥' },
            { label: 'Eye',      value: '◉', emoji: '◉' }
        ]
    }
];

const palettes = {
    peach:  { from: '#fff5e6', to: '#ffd6b3', text: '#5a2d0c', accent: '#d97706', decor: '#c2410c' },
    indigo: { from: '#e8e3ff', to: '#b8a8ff', text: '#1e1748', accent: '#5a4ab5', decor: '#4338ca' },
    sage:   { from: '#e8f5e8', to: '#b8d4b8', text: '#1f3a1f', accent: '#5a8a5a', decor: '#15803d' },
    amber:  { from: '#fff8e1', to: '#ffd54f', text: '#3d2c00', accent: '#b8860b', decor: '#a16207' },
    rose:   { from: '#ffe6ec', to: '#ffb3c1', text: '#5a1830', accent: '#d65a72', decor: '#be185d' },
    slate:  { from: '#e8edf4', to: '#a8b8cf', text: '#1e2a3d', accent: '#475569', decor: '#334155' }
};

const state = {
    idx: 0,
    answers: {
        name: '',
        palette: 'peach',
        tagline: '',
        energy: '',
        words: '',
        symbol: '✦'
    }
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
    els.questionWrap = document.getElementById('questionWrap');
    els.progress     = document.getElementById('progress');
    els.card         = document.getElementById('vibeCard');
    els.cardBg       = document.getElementById('cardBg');
    els.avatar       = document.getElementById('cardAvatar');
    els.initials     = document.getElementById('cardInitials');
    els.name         = document.getElementById('cardName');
    els.tagline      = document.getElementById('cardTagline');
    els.symbol       = document.getElementById('cardSymbol');
    els.words        = document.getElementById('cardWords');
    els.cardNo       = document.getElementById('cardNo');
    els.cardDate     = document.getElementById('cardDate');
    els.cardStamp    = document.getElementById('cardStamp');
    els.actions      = document.getElementById('cardActions');
    els.confettiLayer= document.getElementById('confettiLayer');

    const today = new Date();
    els.cardDate.textContent = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    els.cardNo.textContent = '№ ' + String(Math.floor(Math.random() * 9000) + 1000);

    document.getElementById('downloadBtn').addEventListener('click', downloadCard);
    document.getElementById('restartBtn').addEventListener('click', restart);

    applyPalette('peach');
    renderQuestion();
    updateCard();
});

function renderQuestion() {
    const q = questions[state.idx];
    if (!q) return finish();

    els.progress.textContent = `${state.idx + 1} / ${questions.length}`;
    els.questionWrap.classList.remove('entering');
    els.questionWrap.classList.add('changing');

    setTimeout(() => {
        els.questionWrap.replaceChildren();

        const indicator = document.createElement('div');
        indicator.className = 'question-indicator';
        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = state.idx + 1;
        const slash = document.createElement('span');
        slash.textContent = `of ${questions.length}`;
        indicator.append(num, slash);
        els.questionWrap.appendChild(indicator);

        const title = document.createElement('h2');
        title.className = 'question-text';
        title.textContent = q.title;
        els.questionWrap.appendChild(title);

        const hint = document.createElement('p');
        hint.className = 'question-hint';
        hint.textContent = q.hint || '';
        els.questionWrap.appendChild(hint);

        if (q.type === 'text_input') renderTextInput(q);
        else renderOptions(q);

        els.questionWrap.classList.remove('changing');
        els.questionWrap.classList.add('entering');
    }, 220);
}

function renderTextInput(q) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'q-text-input';
    input.placeholder = q.placeholder || '';
    input.value = state.answers[q.key] || '';
    input.autocomplete = 'off';

    const cont = makeContinue();
    cont.disabled = !input.value.trim();

    input.addEventListener('input', e => {
        state.answers[q.key] = e.target.value;
        cont.disabled = !e.target.value.trim();
        updateCard();
    });
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && state.answers[q.key].trim()) {
            e.preventDefault();
            advance();
        }
    });

    els.questionWrap.appendChild(input);
    els.questionWrap.appendChild(cont);
    setTimeout(() => input.focus(), 250);
    cont.addEventListener('click', advance);
}

function renderOptions(q) {
    const wrap = document.createElement('div');
    wrap.className = 'q-options';

    q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'q-option';
        btn.dataset.value = opt.value;
        if (state.answers[q.key] === opt.value) btn.classList.add('selected');

        if (opt.swatch) {
            const sw = document.createElement('span');
            sw.className = 'swatch';
            sw.style.background = opt.swatch;
            btn.appendChild(sw);
        } else if (opt.emoji) {
            const em = document.createElement('span');
            em.className = 'emoji';
            em.textContent = opt.emoji;
            btn.appendChild(em);
        }
        const label = document.createElement('span');
        label.textContent = opt.label;
        btn.appendChild(label);

        btn.addEventListener('click', () => {
            wrap.querySelectorAll('.q-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.answers[q.key] = opt.value;
            updateCard();
            cont.disabled = false;
            // auto-advance after a short beat for picks
            setTimeout(advance, 380);
        });

        wrap.appendChild(btn);
    });

    els.questionWrap.appendChild(wrap);
    const cont = makeContinue();
    cont.disabled = !state.answers[q.key];
    cont.addEventListener('click', advance);
    els.questionWrap.appendChild(cont);
}

function makeContinue() {
    const btn = document.createElement('button');
    btn.className = 'q-continue';
    btn.innerHTML = 'Continue <span class="arrow">→</span>';
    return btn;
}

function advance() {
    if (state.idx < questions.length - 1) {
        state.idx++;
        renderQuestion();
        updateCard();
    } else {
        finish();
    }
}

// ─── Live card update ──────────────────────────────────
function updateCard() {
    const a = state.answers;

    // Avatar / initials
    const name = (a.name || '').trim();
    if (name) {
        els.avatar.classList.remove('empty');
        els.initials.textContent = initialsFrom(name);
        els.name.textContent = name;
        els.name.classList.remove('empty');
    } else {
        els.avatar.classList.add('empty');
        els.initials.textContent = '??';
        els.name.textContent = 'your name';
        els.name.classList.add('empty');
    }

    // Tagline
    const tagline = (a.tagline || '').trim();
    if (tagline) {
        els.tagline.textContent = '“' + tagline + '”';
        els.tagline.classList.remove('empty');
    } else {
        els.tagline.textContent = 'tell us your vibe';
        els.tagline.classList.add('empty');
    }

    // Symbol
    if (a.symbol) {
        els.symbol.textContent = a.symbol;
        els.symbol.classList.remove('empty');
    } else {
        els.symbol.textContent = '✦';
        els.symbol.classList.add('empty');
    }

    // Words (3 badges)
    const words = (a.words || '')
        .split(/[,;\n]/)
        .map(w => w.trim())
        .filter(Boolean)
        .slice(0, 3);
    const slots = els.words.children;
    for (let i = 0; i < 3; i++) {
        const slot = slots[i];
        if (words[i]) {
            const isNew = slot.classList.contains('word-empty') || slot.textContent !== words[i];
            slot.textContent = words[i];
            slot.classList.remove('word-empty');
            if (isNew) {
                slot.classList.remove('word-fresh');
                void slot.offsetWidth; // restart animation
                slot.classList.add('word-fresh');
            }
        } else {
            slot.textContent = 'word';
            slot.classList.add('word-empty');
            slot.classList.remove('word-fresh');
        }
    }

    // Palette → background + accent + decor
    if (a.palette) applyPalette(a.palette);

    // Energy → typography mood
    if (a.energy) els.card.dataset.energy = a.energy;
    else delete els.card.dataset.energy;

    // Card stamp tracks completion
    const filled = ['name', 'palette', 'tagline', 'energy', 'words', 'symbol'].filter(k => a[k] && String(a[k]).trim()).length;
    els.cardStamp.textContent = filled === 6 ? 'VIBE CARD · COMPLETE' : `VIBE CARD · ${filled}/6`;

    // Stage data attribute drives staged decoration reveal in CSS
    els.card.dataset.stage = String(state.idx + 1);
}

function applyPalette(name) {
    const p = palettes[name] || palettes.peach;
    const root = document.documentElement;
    root.style.setProperty('--card-bg-from', p.from);
    root.style.setProperty('--card-bg-to', p.to);
    root.style.setProperty('--card-text', p.text);
    root.style.setProperty('--card-accent', p.accent);
    root.style.setProperty('--card-decor', p.decor);
}

function initialsFrom(name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '??';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Finish: lock the card, confetti, show actions ─────
function finish() {
    state.idx = questions.length;
    els.progress.textContent = `${questions.length} / ${questions.length}`;
    els.questionWrap.classList.add('changing');
    setTimeout(() => {
        els.questionWrap.replaceChildren();
        const h = document.createElement('h2');
        h.className = 'question-text';
        h.textContent = 'Your card is yours.';
        const p = document.createElement('p');
        p.className = 'question-hint';
        p.textContent = 'Made from your answers, in front of you, just now. Save it, share it, or run it again.';
        els.questionWrap.append(h, p);
        els.questionWrap.classList.remove('changing');
        els.questionWrap.classList.add('entering');
    }, 220);

    els.card.dataset.stage = 'done';
    els.card.classList.add('flourish');
    els.actions.classList.add('show');
    burstConfetti();
}

function burstConfetti() {
    const p = palettes[state.answers.palette] || palettes.peach;
    const colors = [p.accent, p.decor, p.text, '#ffffff'];
    for (let i = 0; i < 60; i++) {
        setTimeout(() => {
            const c = document.createElement('div');
            c.className = 'confetti';
            c.style.left = Math.random() * 100 + '%';
            c.style.background = colors[Math.floor(Math.random() * colors.length)];
            c.style.animationDelay = Math.random() * 0.4 + 's';
            c.style.animationDuration = (1.8 + Math.random() * 1.4) + 's';
            els.confettiLayer.appendChild(c);
            setTimeout(() => c.remove(), 3500);
        }, i * 30);
    }
}

function restart() {
    state.idx = 0;
    state.answers = { name: '', palette: 'peach', tagline: '', energy: '', words: '', symbol: '✦' };
    els.actions.classList.remove('show');
    els.card.classList.remove('flourish');
    els.card.dataset.stage = '1';
    delete els.card.dataset.energy;
    applyPalette('peach');
    renderQuestion();
    updateCard();
}

// ─── Download as PNG ───────────────────────────────────
async function downloadCard() {
    // Use the modern html-to-image trick via SVG foreignObject + canvas.
    // Lightweight, no external deps.
    const card = els.card;
    const rect = card.getBoundingClientRect();
    const scale = 2;
    const w = Math.ceil(rect.width);
    const h = Math.ceil(rect.height);

    const cssText = await collectCSS();
    const cardHTML = card.outerHTML;

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}">
  <foreignObject x="0" y="0" width="${w}" height="${h}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;font-family:Inter,sans-serif">
      <style>${cssText}</style>
      ${cardHTML.replace(/transform:\s*rotate\([^)]+\)/g, 'transform:none')}
    </div>
  </foreignObject>
</svg>`.trim();

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#efece4';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(b => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(b);
            a.download = `vibe-card-${(state.answers.name || 'me').replace(/\s+/g, '_').toLowerCase()}.png`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        });
        URL.revokeObjectURL(url);
    };
    img.onerror = () => {
        // Fallback: just open the SVG
        window.open(url, '_blank');
    };
    img.src = url;
}

async function collectCSS() {
    const out = [];
    for (const sheet of document.styleSheets) {
        try {
            for (const rule of sheet.cssRules) out.push(rule.cssText);
        } catch (e) {
            // Skip cross-origin sheets (e.g. Google Fonts)
        }
    }
    return out.join('\n');
}
