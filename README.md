# Form360 - Questionnaire Interface

A minimalist, Typeform-inspired questionnaire interface with smooth animations and keyboard navigation.

## Concept

A clean, focused form experience that guides users through questions one at a time. The design emphasizes:
- **Single-task focus**: One question visible at a time, centered on screen
- **Minimal distractions**: Neutral broken-white background, no visual clutter
- **Smooth transitions**: Animated question transitions and option reveals
- **Keyboard-friendly**: Full keyboard navigation support (A/B/C/D, Enter, Arrow keys)

---

## Design Language

### Colors
```css
--bg: #F7F7F7           /* Page background - broken white */
--card-bg: #EFEFEF        /* Card/question container */
--text-primary: #2D2D2D  /* Main text - dark charcoal */
--text-secondary: #6B6B6B /* Secondary text */
--text-muted: #A0A0A0    /* Hints, placeholders */
--border: #D8D8D8         /* Borders, dividers */
--white: #FFFFFF         /* Option buttons, inputs */
```

### Typography
- Font: System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)
- Question text: 1.75rem, weight 400, line-height 1.4
- Option text: 1rem, weight 500
- Labels/hints: 0.8-0.9rem

### Layout
- **Full viewport**: Form is centered and fixed, no scrolling
- **Max width**: 640px for question card
- **Padding**: 48px-56px on question card, 20px-40px on nav

---

## UI Components

### 1. Top Navigation (Stepper)

Dynamic stepper showing progress through questions.

**States:**
- `mulai-step`: First question indicator with empty dot circle
- `active`: Current question (black filled circle)
- `completed`: Past question (circle with checkmark)
- `hoverable`: Can hover for shadow effect on completed items

**Behavior:**
- On Question 1: Shows "Mulai" + current question number
- On Question 2+: Shows question numbers only, shifting left as you progress
- Only 3 question numbers visible at a time
- Completed questions show checkmark and are clickable to navigate back
- Results page shows all questions with checkmarks + "Selesai"

### 2. Question Card

Centered container for each question.

**Structure:**
```
[Question Indicator: "1 →"]
[Question Text: "Name, apa..."]
[Question Hint: "Pilih salah satu" or "shift ↵ enter untuk baris baru"]

[Options List / Text Input]
[Continue Button]
```

**Animations:**
- Card fade-in on initial load
- Question text fades/changes on navigation
- Options stagger in (0.2s, 0.3s, 0.4s delays)

### 3. Option Buttons (Multiple Choice)

**States:**
- Default: White background, subtle border
- Hover: Border darkens, slight lift (translateY -2px), shadow
- Selected: Bold border, ring shadow, slight lift
- Keyboard (A/B/C/D): Same visual as click selection

**Structure:**
```
[A] Option text here...
[B] Option text here...
```

- Letter key indicator on left (32x32px, rounded)
- Selected state: key turns black with white text

### 4. Text Input (Essay Question)

**Structure:**
- Textarea with inset shadow effect
- Placeholder: "ketik jawaban kamu di sini..."
- Hint below: "shift ↵ enter untuk baris baru"

**Behavior:**
- Enter to submit (without shift)
- Shift+Enter for new line
- Auto-focus on appear

### 5. Continue Button

**States:**
- Disabled: Gray background, no cursor
- Enabled: Black background, white text
- Hover: Slight lift, deeper shadow
- Click: Scale down briefly

### 6. Bottom Navigation

Scroll arrows showing current position.

**Structure:**
```
[1/5]   [↑]
        [↓]
```

- Arrow buttons disabled at first/last questions
- Shows "X/Y" progress count

---

## Features

### Question Types

1. **multiple_choice**: Select one from 2-4 options
   - Options displayed as buttons with A/B/C/D keys
   - Click or keypress to select

2. **text_input**: Free-form text response
   - Textarea with placeholder
   - Enter submits, Shift+Enter for new line

### Keyboard Navigation

| Key | Action |
|-----|--------|
| A/B/C/D | Select option by letter |
| Enter | Submit answer / Continue |
| Arrow Up/Down | Navigate between questions |
| Shift+Enter | New line in text input |

### Answer Persistence

- Answers are saved when navigating between questions
- Returning to a question restores the previous selection/input
- Visual indicator (checkmark) shows which questions have been answered

---

## File Structure

```
sistempakar/
├── index.html      # Main HTML structure
├── styles.css      # All styles
├── script.js       # All JavaScript logic
└── README.md       # This documentation
```

### Key JavaScript Variables

```javascript
questions[]     // Array of question objects
answers{}       // Object storing {questionId: answer}
currentQuestionIndex  // Current position (0-based)
selectedAnswer   // Currently selected option (for multiple choice)
textValue       // Current text input value
isTransitioning // Prevents double-clicks during animations
userName        // User's name from start screen
```

### Adding Questions

Questions are defined in `script.js`:

```javascript
const questions = [
    {
        id: 1,
        type: "multiple_choice",  // or "text_input"
        title: "Question text here",
        options: [
            { text: "Option A", value: "option_a" },
            { text: "Option B", value: "option_b" },
            { text: "Option C", value: "option_c" }
        ]
    },
    {
        id: 2,
        type: "text_input",
        title: "Question text here",
        hint: "shift ↵ enter untuk baris baru",
        placeholder: "ketik jawaban kamu di sini..."
    }
];
```

---

## Customization

### Changing Colors

Edit the CSS variables at the top of `styles.css`:

```css
:root {
    --bg: #F7F7F7;
    --card-bg: #EFEFEF;
    --text-primary: #2D2D2D;
    /* etc */
}
```

### Changing Results Calculation

The `calculateResults()` function in `script.js` maps answer values to result categories. Modify this to change how results are aggregated and displayed.

### Adding New Question Types

1. Add type check in `loadQuestion()` function
2. Create rendering logic for the new type
3. Add validation in `handleContinue()`
4. Handle keyboard shortcuts in `handleKeydown()`

---

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS custom properties (variables)
- CSS animations and transitions
- ES6+ JavaScript

---

## Future Enhancements

### Supabase Integration (Ready for Deployment)

When ready to use Supabase as the database:

**1. Create Supabase Project**
- Go to https://supabase.com and create a project
- Get your project URL and anon key from Settings > API

**2. Set Environment Variables**

Create `.env` file:
```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**3. Run Database Schema**
In Supabase SQL Editor, run `supabase-schema.sql` to create:
- Tables: forms, questions, responses, answers
- Functions: get_form_with_questions, submit_response
- Row Level Security policies

**4. Replace localStorage with Supabase**

In `script.js`, replace localStorage calls with Supabase:
```javascript
// Instead of localStorage.getItem('form360_forms')
// Use: const { data } = await supabase.rpc('get_form_with_questions', { form_id_param: formId })
```

**5. Deploy**

Deploy to Netlify with:
```bash
netlify deploy --prod --dir=dist
```

### Network Deployment Notes

- **Editor** (`editor.html`): For creating/editing forms
- **Viewer** (`index.html`): For respondents to fill forms
- Both can be hosted on Netlify
- Form data is currently encoded in URL for sharing (no backend needed for small scale)
- For production scale, use Supabase database integration