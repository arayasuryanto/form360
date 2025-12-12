// Data pertanyaan
const questions = [
    {
        id: 1,
        title: "Manakah cara yang paling membantu kamu memahami materi baru?",
        options: [
            { text: "Melihat diagram, grafik, atau ilustrasi visual", value: "visual", cf: 0.9 },
            { text: "Mendengar penjelasan lisan dari guru/dosen", value: "auditory", cf: 0.9 },
            { text: "Mempraktikkan atau menyentuh objek langsung", value: "kinesthetic", cf: 0.9 }
        ]
    },
    {
        id: 2,
        title: "Saat membuat catatan, mana yang paling sering kamu lakukan?",
        options: [
            { text: "Membuat catatan berwarna dengan highlight dan gambar", value: "visual", cf: 0.87 },
            { text: "Merekam penjelasan atau mendiskusikannya dengan orang lain", value: "auditory", cf: 0.87 },
            { text: "Mencatat sambil bergerak atau membuat contoh praktik", value: "kinesthetic", cf: 0.87 }
        ]
    },
    {
        id: 3,
        title: "Media pembelajaran mana yang paling efektif untukmu?",
        options: [
            { text: "Slide presentasi dengan visualisasi yang menarik", value: "visual", cf: 0.9 },
            { text: "Rekaman audio, podcast, atau penjelasan verbal", value: "auditory", cf: 0.9 },
            { text: "Eksperimen, simulasi, atau praktik langsung", value: "kinesthetic", cf: 0.9 }
        ]
    },
    {
        id: 4,
        title: "Apa yang biasanya terjadi ketika kamu membaca teks pelajaran?",
        options: [
            { text: "Membayangkan visualisasi dari konsep yang dijelaskan", value: "visual", cf: 0.8 },
            { text: "Membaca dengan suara keras atau dalam hati", value: "auditory", cf: 0.8 },
            { text: "Merasa perlu mencoba langsung konsep tersebut", value: "kinesthetic", cf: 0.8 }
        ]
    },
    {
        id: 5,
        title: "Jenis petunjuk mana yang paling membantumu mengikuti instruksi?",
        options: [
            { text: "Petunjuk tertulis atau diagram langkah demi langkah", value: "visual", cf: 0.74 },
            { text: "Penjelasan lisan atau diskusi kelompok", value: "auditory", cf: 0.74 },
            { text: "Mencoba langsung langkah-langkahnya sendiri", value: "kinesthetic", cf: 0.74 }
        ]
    },
    {
        id: 6,
        title: "Informasi apa yang paling mudah kamu ingat?",
        options: [
            { text: "Wajah orang tetapi sulit mengingat nama", value: "visual", cf: 0.88 },
            { text: "Nama orang tetapi sulit mengingat wajahnya", value: "auditory", cf: 0.88 },
            { text: "Gerakan atau pengalaman fisik yang pernah dilakukan", value: "kinesthetic", cf: 0.88 }
        ]
    },
    {
        id: 7,
        title: "Lingkungan belajar seperti apa yang paling nyaman untukmu?",
        options: [
            { text: "Meja rapi dengan visual yang terorganisir", value: "visual", cf: 0.8 },
            { text: "Lingkungan dengan suara tertentu atau musik", value: "auditory", cf: 0.8 },
            { text: "Kebebasan untuk bergerak dan tidak harus diam", value: "kinesthetic", cf: 0.8 }
        ]
    },
    {
        id: 8,
        title: "Teknik belajar mana yang paling cocok untukmu?",
        options: [
            { text: "Membuat mind map, sketsa, atau diagram", value: "visual", cf: 0.8 },
            { text: "Berdiskusi dan menjelaskan ke orang lain", value: "auditory", cf: 0.8 },
            { text: "Belajar melalui proyek atau kegiatan hands-on", value: "kinesthetic", cf: 0.8 }
        ]
    },
    {
        id: 9,
        title: "Bagaimana cara terbaik memahami konsep baru?",
        options: [
            { text: "Melihat contoh nyata atau demonstrasi", value: "visual", cf: 0.65 },
            { text: "Mendengar penjelasan dari ahli atau guru", value: "auditory", cf: 0.65 },
            { text: "Mengikuti intuisi dan mencoba langsung", value: "kinesthetic", cf: 0.65 }
        ]
    },
    {
        id: 10,
        title: "Cara mana yang paling memperkuat pemahamanmu?",
        options: [
            { text: "Melihat peta konsep atau diagram alur", value: "visual", cf: 0.66 },
            { text: "Mengulang materi dengan menjelaskan verbal", value: "auditory", cf: 0.66 },
            { text: "Melakukan praktik atau simulasi langsung", value: "kinesthetic", cf: 0.66 }
        ]
    },
    {
        id: 11,
        title: "Bagaimana kamu paling mudah mengingat informasi penting?",
        options: [
            { text: "Menulis atau melihat catatan visual", value: "visual", cf: 0.78 },
            { text: "Mendengarkan berulang kali atau merekamnya", value: "auditory", cf: 0.78 },
            { text: "Mengaitkan dengan pengalaman atau gerakan fisik", value: "kinesthetic", cf: 0.78 }
        ]
    },
    {
        id: 12,
        title: "Apa yang paling membantumu saat presentasi?",
        options: [
            { text: "Slide visual yang mendukung poin utama", value: "visual", cf: 0.9 },
            { text: "Berbicara dan berinteraksi dengan audiens", value: "auditory", cf: 0.9 },
            { text: "Menggunakan demonstrasi atau alat peraga", value: "kinesthetic", cf: 0.9 }
        ]
    },
    {
        id: 13,
        title: "Bagaimana kamu lebih suka berkomunikasi?",
        options: [
            { text: "Melalui pesan teks atau media visual", value: "visual", cf: 0.84 },
            { text: "Berbicara langsung atau melalui telepon", value: "auditory", cf: 0.84 },
            { text: "Bertemu langsung dengan bahasa tubuh", value: "kinesthetic", cf: 0.84 }
        ]
    },
    {
        id: 14,
        title: "Pendekatan apa yang kamu gunakan untuk menyelesaikan masalah?",
        options: [
            { text: "Membuat diagram atau langkah visual", value: "visual", cf: 0.77 },
            { text: "Berdiskusi dan brainstorming dengan orang lain", value: "auditory", cf: 0.77 },
            { text: "Langsung mencoba berbagai solusi praktis", value: "kinesthetic", cf: 0.77 }
        ]
    },
    {
        id: 15,
        title: "Bagaimana cara belajar keterampilan baru?",
        options: [
            { text: "Menonton tutorial atau manual bergambar", value: "visual", cf: 0.7 },
            { text: "Mendengarkan instruksi atau penjelasan", value: "auditory", cf: 0.7 },
            { text: "Langsung mencoba dan belajar dari praktik", value: "kinesthetic", cf: 0.7 }
        ]
    },
    {
        id: 16,
        title: "Kapan kamu paling berkonsentrasi saat belajar?",
        options: [
            { text: "Ketika ada visual yang menarik dan teratur", value: "visual", cf: 0.85 },
            { text: "Ketika mendengar penjelasan yang jelas", value: "auditory", cf: 0.85 },
            { text: "Ketika bisa bergerak atau aktivitas fisik", value: "kinesthetic", cf: 0.85 }
        ]
    },
    {
        id: 17,
        title: "Bagaimana cara terbaik mengikuti instruksi?",
        options: [
            { text: "Melihat gambar, diagram, atau video", value: "visual", cf: 0.8 },
            { text: "Mendengar penjelasan langkah demi langkah", value: "auditory", cf: 0.8 },
            { text: "Mengikuti sambil mempraktikkan langsung", value: "kinesthetic", cf: 0.8 }
        ]
    },
    {
        id: 18,
        title: "Setelah belajar, apa yang paling kamu ingat?",
        options: [
            { text: "Gambar, warna, atau layout materi", value: "visual", cf: 0.65 },
            { text: "Suara, nada, atau diskusi yang terjadi", value: "auditory", cf: 0.65 },
            { text: "Perasaan, gerakan, atau pengalaman saat belajar", value: "kinesthetic", cf: 0.65 }
        ]
    },
    {
        id: 19,
        title: "Bagaimana kamu mempersiapkan diri untuk ujian?",
        options: [
            { text: "Membaca catatan dan membuat rangkuman visual", value: "visual", cf: 0.75 },
            { text: "Menjelaskan materi ke diri sendiri atau orang lain", value: "auditory", cf: 0.75 },
            { text: "Mengerjakan latihan soal atau simulasi", value: "kinesthetic", cf: 0.75 }
        ]
    },
    {
        id: 20,
        title: "Apa yang paling memotivasimu untuk terus belajar?",
        options: [
            { text: "Melihat progress visual atau hasil terukur", value: "visual", cf: 0.85 },
            { text: "Mendapat feedback verbal atau pujian", value: "auditory", cf: 0.85 },
            { text: "Merasakan peningkatan kemampuan melalui praktik", value: "kinesthetic", cf: 0.85 }
        ]
    }
];

// Mengelola status aplikasi
let currentQuestionIndex = 0;
let userName = "";
let answers = [];

// Flag untuk mencegah warning muncul berulang kali
let warningFlags = {
    allSameAnswer: false
};

// Elemen DOM
const homepage = document.getElementById("homepage");
const questionnaire = document.getElementById("questionnaire");
const resultsPage = document.getElementById("resultsPage");
const userNameInput = document.getElementById("userName");
const startBtn = document.getElementById("startBtn");
const questionNumber = document.getElementById("questionNumber");
const questionTitle = document.getElementById("questionTitle");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const progressFill = document.getElementById("progressFill");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalBtn = document.getElementById("modalBtn");
const closeModal = document.querySelector(".close");

// Elemen halaman hasil
const resultUserName = document.getElementById("resultUserName");
const visualCF = document.getElementById("visualCF");
const auditoryCF = document.getElementById("auditoryCF");
const kinestheticCF = document.getElementById("kinestheticCF");
const visualBar = document.getElementById("visualBar");
const auditoryBar = document.getElementById("auditoryBar");
const kinestheticBar = document.getElementById("kinestheticBar");
const visualResult = document.getElementById("visualResult");
const auditoryResult = document.getElementById("auditoryResult");
const kinestheticResult = document.getElementById("kinestheticResult");
const dominantIcon = document.getElementById("dominantIcon");
const dominantName = document.getElementById("dominantName");
const recommendationContent = document.getElementById("recommendationContent");
const restartBtn = document.getElementById("restartBtn");
const printBtn = document.getElementById("printBtn");

// Inisialisasi
document.addEventListener("DOMContentLoaded", () => {
    initializeEventListeners();
});

function initializeEventListeners() {
    startBtn.addEventListener("click", handleStart);
    prevBtn.addEventListener("click", handlePrevious);
    nextBtn.addEventListener("click", handleNext);
    modalBtn.addEventListener("click", closeModalPopup);
    closeModal.addEventListener("click", closeModalPopup);
    restartBtn.addEventListener("click", handleRestart);
    printBtn.addEventListener("click", handlePrint);

    // Tutup modal saat klik di luar
    window.addEventListener("click", (e) => {
        if (e.target === modal) {
            closeModalPopup();
        }
    });
}

function handleStart() {
    const name = userNameInput.value.trim();

    if (name === "") {
        showModal("Perhatian", "Silakan masukkan nama Anda terlebih dahulu.");
        return;
    }

    userName = name;
    showModal("Selamat Datang", `Halo ${userName}! Anda akan menjawab ${questions.length} pertanyaan. Setiap pertanyaan memiliki 3 bagian yang perlu dijawab.`, () => {
        homepage.classList.remove("active");
        questionnaire.classList.add("active");
        loadQuestion(0);
    });
}

function loadQuestion(index) {
    currentQuestionIndex = index;
    const question = questions[index];

    // Update question header
    questionNumber.textContent = `Pertanyaan ${index + 1} dari ${questions.length}`;
    questionTitle.textContent = question.title;

    // Update progress bar
    const progress = ((index + 1) / questions.length) * 100;
    progressFill.style.width = `${progress}%`;

    // Clear and populate options
    const questionOptions = document.querySelector(".question-options");
    questionOptions.innerHTML = "";

    // Create option elements from the question data
    question.options.forEach(option => {
        const label = document.createElement("label");
        label.className = "choice-option";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = "answer";
        input.value = option.value;

        const span = document.createElement("span");
        span.className = "option-text";
        span.textContent = option.text;

        label.appendChild(input);
        label.appendChild(span);
        questionOptions.appendChild(label);
    });

    // Load saved answer if exists
    if (answers[index]) {
        const selectedOption = document.querySelector(`input[name="answer"][value="${answers[index]}"]`);
        if (selectedOption) {
            selectedOption.checked = true;
        }
    }

    // Update navigation buttons
    prevBtn.disabled = index === 0;
    prevBtn.style.opacity = index === 0 ? "0.5" : "1";

    if (index === questions.length - 1) {
        nextBtn.textContent = "Selesai";
    } else {
        nextBtn.textContent = "Selanjutnya";
    }
}

function saveCurrentAnswers() {
    const selectedRadio = document.querySelector(`input[name="answer"]:checked`);
    if (selectedRadio) {
        answers[currentQuestionIndex] = selectedRadio.value;
    }
}

function validateCurrentQuestion() {
    if (!answers[currentQuestionIndex]) {
        showModal("Perhatian", "Mohon pilih salah satu jawaban sebelum melanjutkan.");
        return false;
    }

    return true;
}

// Cek pola jawaban yang mencurigakan
function checkSuspiciousPattern() {
    // Hitung jawaban yang sama (misalnya semua visual)
    const answerCounts = { visual: 0, auditory: 0, kinesthetic: 0 };

    answers.forEach(answer => {
        if (answer) {
            answerCounts[answer]++;
        }
    });

    // Peringatan jika semua jawaban sama (hanya sekali)
    if ((answerCounts.visual === answers.length ||
            answerCounts.auditory === answers.length ||
            answerCounts.kinesthetic === answers.length) &&
        !warningFlags.allSameAnswer &&
        answers.length >= 10) {

        warningFlags.allSameAnswer = true;
        showModal(
            "⚠️ Peringatan",
            "Anda menjawab dengan pilihan yang sama untuk semua pertanyaan. Pastikan Anda membaca setiap pilihan dengan teliti dan menjawab sesuai preferensi sebenarnya."
        );
    }
}

function handlePrevious() {
    saveCurrentAnswers();

    if (currentQuestionIndex > 0) {
        loadQuestion(currentQuestionIndex - 1);
    }
}

function handleNext() {
    saveCurrentAnswers();

    if (!validateCurrentQuestion()) {
        return;
    }

    if (currentQuestionIndex < questions.length - 1) {
        loadQuestion(currentQuestionIndex + 1);
    } else {
        // Finish questionnaire
        finishQuestionnaire();
    }
}

function finishQuestionnaire() {
    console.log("User:", userName);
    console.log("All Answers:", answers);

    // Calculate CF and show results
    calculateAndShowResults();
}

function resetQuestionnaire() {
    currentQuestionIndex = 0;
    answers = [];
    userNameInput.value = "";

    // Reset warning flags
    warningFlags = {
        allSameAnswer: false
    };

    questionnaire.classList.remove("active");
    resultsPage.classList.remove("active");
    homepage.classList.add("active");
}

function handleRestart() {
    resetQuestionnaire();
}

function handlePrint() {
    window.print();
}

// Fungsi modal
function showModal(title, message, callback = null) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.classList.add("active");

    // Store callback for OK button
    modalBtn.onclick = () => {
        closeModalPopup();
        if (callback) {
            callback();
        }
    };
}

function closeModalPopup() {
    modal.classList.remove("active");
}

// Fungsi untuk mengambil semua jawaban
function getAllAnswers() {
    return {
        userName: userName,
        answers: answers,
        timestamp: new Date().toISOString()
    };
}

// ==================== FUNGSI CERTAINTY FACTOR ====================

// Hitung CF untuk setiap gaya belajar (Visual, Auditory, Kinesthetic)
function calculateCF() {
    let visualCF = 0;
    let auditoryCF = 0;
    let kinestheticCF = 0;
    let visualCount = 0;
    let auditoryCount = 0;
    let kinestheticCount = 0;

    // Kumpulkan nilai CF dari setiap jawaban
    answers.forEach((answer, index) => {
        if (answer && questions[index]) {
            const question = questions[index];
            // Cari opsi yang dipilih dan ambil nilai CF nya
            const selectedOption = question.options.find(option => option.value === answer);

            if (selectedOption) {
                const cfPakar = selectedOption.cf; // Nilai CF dari ahli
                const cfUser = 1.0; // CF User = 1.0 (pasti saat memilih)
                const cfEvidence = cfUser * cfPakar; // CF_Evidence = CF_User × CF_Pakar

                if (answer === "visual") {
                    visualCF += cfEvidence;
                    visualCount++;
                } else if (answer === "auditory") {
                    auditoryCF += cfEvidence;
                    auditoryCount++;
                } else if (answer === "kinesthetic") {
                    kinestheticCF += cfEvidence;
                    kinestheticCount++;
                }
            }
        }
    });

    // Normalisasi CF ke range 0-1 untuk tampilan persentase
    const maxPossibleCF = Math.max(visualCF, auditoryCF, kinestheticCF, 1);
    const normalizedVisualCF = visualCF / maxPossibleCF;
    const normalizedAuditoryCF = auditoryCF / maxPossibleCF;
    const normalizedKinestheticCF = kinestheticCF / maxPossibleCF;

    return {
        visual: normalizedVisualCF,
        auditory: normalizedAuditoryCF,
        kinesthetic: normalizedKinestheticCF,
        counts: {
            visual: visualCount,
            auditory: auditoryCount,
            kinesthetic: kinestheticCount
        }
    };
}

// Tentukan kombinasi gaya belajar
function determineLearningStyleCombination(cfResults) {
    const { visual, auditory, kinesthetic } = cfResults;
    const threshold = 0.3; // Batas minimum 30%

    // Urutkan gaya belajar dari tertinggi ke terendah
    const styles = [
        { name: "Visual", value: visual, key: "visual" },
        { name: "Auditory", value: auditory, key: "auditory" },
        { name: "Kinesthetic", value: kinesthetic, key: "kinesthetic" }
    ].sort((a, b) => b.value - a.value);

    // Cari gaya belajar yang di atas threshold
    const significantStyles = styles.filter(style => style.value >= threshold);

    if (significantStyles.length === 1) {
        return {
            combination: significantStyles[0].name,
            type: "UNIMODAL",
            icon: getStyleIcon(significantStyles[0].key),
            styles: significantStyles
        };
    } else if (significantStyles.length === 2) {
        return {
            combination: significantStyles[0].name + " + " + significantStyles[1].name,
            type: "BIMODAL",
            icon: getStyleIcon(significantStyles[0].key) + " + " + getStyleIcon(significantStyles[1].key),
            styles: significantStyles
        };
    } else if (significantStyles.length === 3) {
        return {
            combination: "VAK (Multimodal)",
            type: "MULTIMODAL",
            icon: "🌟",
            styles: significantStyles
        };
    } else {
        return {
            combination: "Tidak Diketahui",
            type: "UNDEFINED",
            icon: "❓",
            styles: []
        };
    }
}

// Ambil icon untuk setiap gaya belajar
function getStyleIcon(key) {
    const icons = {
        visual: "👁️",
        auditory: "👂",
        kinesthetic: "🤸"
    };
    return icons[key] || "❓";
}

function getBasicRecommendations(styleKey) {
    const basic = {
        visual: [
            "Gunakan diagram, grafik, dan peta konsep saat belajar",
            "Tonton video edukatif dan presentasi visual",
            "Gunakan warna-warna berbeda untuk highlight informasi penting",
            "Buat catatan dengan gambar dan simbol visual"
        ],
        auditory: [
            "Dengarkan podcast dan audiobook terkait materi pembelajaran",
            "Rekam penjelasan materi dan dengarkan kembali",
            "Diskusikan materi dengan teman atau kelompok belajar",
            "Baca materi dengan suara keras"
        ],
        kinesthetic: [
            "Praktikkan langsung konsep yang dipelajari",
            "Gunakan model atau objek fisik untuk memahami konsep",
            "Ambil jeda untuk bergerak saat belajar",
            "Buat proyek hands-on terkait materi"
        ]
    };

    return basic[styleKey] || [];
}


// Fungsi utama untuk hitung dan tampilkan hasil
function calculateAndShowResults() {
    const cfResults = calculateCF();

    // Tentukan kombinasi gaya belajar
    const styleCombination = determineLearningStyleCombination(cfResults);

    // Buat rekomendasi berdasarkan kombinasi
    const recommendations = generateCombinationRecommendations(styleCombination);

    // Tampilkan halaman hasil
    questionnaire.classList.remove("active");
    resultsPage.classList.add("active");

    // Tampilkan nama user
    resultUserName.textContent = userName;

    // Update nilai CF dan progress bar
    updateCFDisplay(cfResults);

    // Tampilkan kombinasi gaya belajar
    displayStyleCombination(styleCombination);

    // Tampilkan rekomendasi
    displayRecommendations(recommendations, styleCombination.combination);
}

// Update tampilan CF dengan animasi (tampil sebagai persentase)
function updateCFDisplay(cfResults) {
    // Animasi penghitungan persentase
    function animateCounter(element, target, duration = 1000) {
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;

        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            element.textContent = Math.round(current);
        }, 16);
    }

    // Visual - CF sudah di range 0-1, jadi tinggal kalikan 100
    const visualPercentage = cfResults.visual * 100;
    animateCounter(visualCF, visualPercentage);
    setTimeout(() => {
        visualBar.style.width = `${visualPercentage}%`;
    }, 100);

    // Auditori
    const auditoryPercentage = cfResults.auditory * 100;
    animateCounter(auditoryCF, auditoryPercentage);
    setTimeout(() => {
        auditoryBar.style.width = `${auditoryPercentage}%`;
    }, 300);

    // Kinestetik
    const kinestheticPercentage = cfResults.kinesthetic * 100;
    animateCounter(kinestheticCF, kinestheticPercentage);
    setTimeout(() => {
        kinestheticBar.style.width = `${kinestheticPercentage}%`;
    }, 500);

    // Highlight CF tertinggi dengan efek pulse
    setTimeout(() => {
        const max = Math.max(cfResults.visual, cfResults.auditory, cfResults.kinesthetic);

        visualResult.classList.remove("highlight");
        auditoryResult.classList.remove("highlight");
        kinestheticResult.classList.remove("highlight");

        let highestResult;
        if (cfResults.visual === max) {
            visualResult.classList.add("highlight");
            highestResult = visualResult;
        } else if (cfResults.auditory === max) {
            auditoryResult.classList.add("highlight");
            highestResult = auditoryResult;
        } else if (cfResults.kinesthetic === max) {
            kinestheticResult.classList.add("highlight");
            highestResult = kinestheticResult;
        }

        // Tambahkan efek pulse pada pemenang
        if (highestResult) {
            highestResult.style.animation = 'pulse 1s ease-in-out 3';
            setTimeout(() => {
                highestResult.style.animation = '';
            }, 3000);
        }
    }, 700);

    // Tambahkan animasi pulse jika belum ada
    if (!document.getElementById('pulse-style')) {
        const style = document.createElement('style');
        style.id = 'pulse-style';
        style.textContent = `
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Tampilkan badge gaya belajar dominan dengan info profil
function displayDominantStyle(dominant, profile) {
    dominantIcon.textContent = dominant.icon;

    // Show dominant name with profile type
    let displayText = dominant.name;
    if (profile.type && profile.type !== "NORMAL") {
        displayText += ` (${profile.type})`;
    }

    dominantName.textContent = displayText;

    // Show profile message if exists
    if (profile.message) {
        console.log("Profile:", profile.type, "-", profile.message);
    }
}

// Buat rekomendasi berdasarkan kombinasi gaya belajar
function generateCombinationRecommendations(styleCombination) {
    let recommendations = [];

    if (styleCombination.type === "UNIMODAL") {
        const style = styleCombination.styles[0].key.toLowerCase();
        recommendations = getBasicRecommendations(style);
    } else if (styleCombination.type === "BIMODAL") {
        const style1 = styleCombination.styles[0].key.toLowerCase();
        const style2 = styleCombination.styles[1].key.toLowerCase();

        // Combine recommendations from both styles
        recommendations = [
            ...getBasicRecommendations(style1).slice(0, 2),
            ...getBasicRecommendations(style2).slice(0, 2),
            "Kombinasikan metode pembelajaran yang sesuai dengan kedua gaya belajar Anda",
            "Fleksibel dalam menggunakan berbagai pendekatan pembelajaran"
        ];
    } else if (styleCombination.type === "MULTIMODAL") {
        recommendations = [
            "Kombinasikan berbagai metode pembelajaran (Visual, Auditory, Kinesthetic)",
            "Gunakan pendekatan terintegrasi dengan video, diskusi, dan praktik",
            "Sangat fleksibel sesuai materi dan konteks pembelajaran",
            "Manfaatkan semua modalitas belajar untuk hasil maksimal",
            "Buat pengalaman belajar yang kaya dan beragam"
        ];
    } else {
        recommendations = [
            "Coba identifikasi kembali preferensi belajar Anda",
            "Eksperimen dengan berbagai metode pembelajaran",
            "Konsultasi dengan pengajar untuk menemukan gaya yang paling sesuai"
        ];
    }

    return recommendations;
}

// Tampilkan kombinasi gaya belajar
function displayStyleCombination(styleCombination) {
    dominantIcon.textContent = styleCombination.icon;
    dominantName.textContent = styleCombination.combination;

    // Tambahkan animasi perayaan ke badge
    const badge = document.getElementById("dominantBadge");
    badge.classList.add("celebrate");

    // Tambahkan animasi ke ikon dominan
    setTimeout(() => {
        dominantIcon.style.animation = "float 3s ease-in-out infinite";
    }, 500);

    // Buat efek confetti untuk multimodal
    if (styleCombination.type === "MULTIMODAL") {
        createConfetti();
    }
}

// Buat efek confetti sederhana
function createConfetti() {
    const colors = ['#E36254', '#C0392B', '#FFD700', '#FF6B6B', '#4ECDC4'];
    const confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                width: 10px;
                height: 10px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}%;
                top: -10px;
                border-radius: 50%;
                pointer-events: none;
                z-index: 9999;
                animation: fall 2s ease-in forwards;
            `;
            document.body.appendChild(confetti);

            setTimeout(() => confetti.remove(), 2000);
        }, i * 50);
    }

    // Tambahkan animasi jatuh
    if (!document.getElementById('confetti-style')) {
        const style = document.createElement('style');
        style.id = 'confetti-style';
        style.textContent = `
            @keyframes fall {
                to {
                    transform: translateY(100vh) rotate(360deg);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Tampilkan rekomendasi berdasarkan rekomendasi yang dibuat
function displayRecommendations(recommendations, styleName) {
    let html = `
        <h3>Rekomendasi untuk Gaya Belajar ${styleName}</h3>
        <ul>
    `;

    recommendations.forEach((tip, index) => {
        html += `<li style="animation-delay: ${index * 0.1}s">${tip}</li>`;
    });

    html += `</ul>`;

    recommendationContent.innerHTML = html;

    // Tambahkan animasi bertahap ke item daftar
    setTimeout(() => {
        const listItems = recommendationContent.querySelectorAll('li');
        listItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateX(-20px)';
            setTimeout(() => {
                item.style.transition = 'all 0.5s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateX(0)';
            }, index * 100);
        });
    }, 100);
}
