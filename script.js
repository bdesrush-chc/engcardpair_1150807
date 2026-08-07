/**
 * English Vocabulary Matching Game Logic
 * Features: 4 words & images, Timer, Score System, Sound Synth, Web Speech API, Confetti Victory
 */

// Vocabulary Data (6 Words = 12 Cards Total)
const VOCAB_DATA = [
  { id: 'apple', en: 'Apple', zh: '蘋果', image: './assets/apple.jpg' },
  { id: 'cat', en: 'Cat', zh: '貓咪', image: './assets/cat.jpg' },
  { id: 'dog', en: 'Dog', zh: '小狗', image: './assets/dog.jpg' },
  { id: 'car', en: 'Car', zh: '汽車', image: './assets/car.jpg' },
  { id: 'sun', en: 'Sun', zh: '太陽', image: './assets/sun.jpg' },
  { id: 'star', en: 'Star', zh: '星星', image: './assets/star.jpg' }
];

// Game State Variables
let cards = [];
let flippedCards = [];
let matchedPairsCount = 0;
let isEvaluating = false;
let isGameStarted = false;
let startTime = null;
let timerInterval = null;
let elapsedTime = 0; // in milliseconds
let wrongAttempts = 0;
let score = 0;
let highScore = 0;

// Settings
let isSoundEnabled = true;
let isSpeechEnabled = true;

// Audio Context for synthesized sound effects
let audioCtx = null;

// DOM Elements
const gameGrid = document.getElementById('game-grid');
const timerDisplay = document.getElementById('timer-display');
const scoreDisplay = document.getElementById('score-display');
const highScoreDisplay = document.getElementById('high-score-display');
const btnRestart = document.getElementById('btn-restart');
const btnAudioToggle = document.getElementById('btn-audio-toggle');
const btnSpeechToggle = document.getElementById('btn-speech-toggle');
const audioIcon = document.getElementById('audio-icon');
const speechIcon = document.getElementById('speech-icon');

// Victory Modal DOM
const victoryModal = document.getElementById('victory-modal');
const finalTimeDisplay = document.getElementById('final-time');
const finalScoreDisplay = document.getElementById('final-score');
const modalHighScoreDisplay = document.getElementById('modal-high-score');
const newHighScoreBanner = document.getElementById('new-high-score-banner');
const btnPlayAgain = document.getElementById('btn-play-again');
const starsContainer = document.getElementById('stars-container');

// Confetti Canvas
const confettiCanvas = document.getElementById('confetti-canvas');
let confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
let confettiParticles = [];
let confettiAnimationId = null;

/* ==========================================================================
   Initialization & Event Listeners
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  loadHighScore();
  initGame();

  btnRestart.addEventListener('click', () => {
    playAudioTone('click');
    resetGame();
  });

  btnPlayAgain.addEventListener('click', () => {
    playAudioTone('click');
    hideVictoryModal();
    resetGame();
  });

  btnAudioToggle.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    audioIcon.textContent = isSoundEnabled ? '🔊' : '🔇';
    if (isSoundEnabled) {
      playAudioTone('click');
    }
  });

  btnSpeechToggle.addEventListener('click', () => {
    isSpeechEnabled = !isSpeechEnabled;
    speechIcon.textContent = isSpeechEnabled ? '🗣️' : '🔇';
    if (isSpeechEnabled) {
      speakWord('English');
    }
  });
});

/* ==========================================================================
   Game Setup & Deck Creation
   ========================================================================== */

function initGame() {
  cards = generateDeck();
  renderGrid(cards);
  resetStats();
}

function resetGame() {
  stopTimer();
  initGame();
}

function generateDeck() {
  const deck = [];

  VOCAB_DATA.forEach(item => {
    // Word Card
    deck.push({
      uniqueId: `${item.id}-word-${Math.random().toString(36).substring(2, 7)}`,
      pairId: item.id,
      type: 'word',
      en: item.en,
      zh: item.zh,
      image: item.image
    });

    // Image Card
    deck.push({
      uniqueId: `${item.id}-img-${Math.random().toString(36).substring(2, 7)}`,
      pairId: item.id,
      type: 'image',
      en: item.en,
      zh: item.zh,
      image: item.image
    });
  });

  return shuffleArray(deck);
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function renderGrid(deck) {
  gameGrid.innerHTML = '';
  deck.forEach((cardData, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item';
    cardEl.dataset.uniqueId = cardData.uniqueId;
    cardEl.dataset.pairId = cardData.pairId;
    cardEl.dataset.cardType = cardData.type;
    cardEl.dataset.en = cardData.en;

    let frontContentHtml = '';
    if (cardData.type === 'word') {
      frontContentHtml = `
        <div class="word-card-content">
          <div class="card-word-en">${cardData.en}</div>
          <div class="card-word-zh">${cardData.zh}</div>
          <div class="card-type-badge">WORD</div>
        </div>
      `;
    } else {
      frontContentHtml = `
        <div class="image-card-content">
          <img src="${cardData.image}" alt="${cardData.en}" class="card-image" loading="eager" />
        </div>
      `;
    }

    cardEl.innerHTML = `
      <div class="card-face card-back">
        <div class="card-back-pattern">🌹</div>
      </div>
      <div class="card-face card-front">
        ${frontContentHtml}
      </div>
    `;

    cardEl.addEventListener('click', () => handleCardClick(cardEl, cardData));
    gameGrid.appendChild(cardEl);
  });
}

function resetStats() {
  matchedPairsCount = 0;
  flippedCards = [];
  isEvaluating = false;
  isGameStarted = false;
  elapsedTime = 0;
  wrongAttempts = 0;
  score = 0;
  
  updateTimerUI();
  updateScoreUI();
}

/* ==========================================================================
   Gameplay Logic
   ========================================================================== */

function handleCardClick(cardEl, cardData) {
  // Ignore clicks if evaluating pair or card is already flipped/matched
  if (isEvaluating || cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) {
    return;
  }

  // Start timer on first card click
  if (!isGameStarted) {
    startTimer();
  }

  // Play flip audio & speak word
  playAudioTone('flip');
  speakWord(cardData.en);

  // Flip card visually
  cardEl.classList.add('flipped');
  flippedCards.push({ element: cardEl, data: cardData });

  // If two cards flipped, check for match
  if (flippedCards.length === 2) {
    evaluateMatch();
  }
}

function evaluateMatch() {
  isEvaluating = true;
  const [first, second] = flippedCards;

  const isPairMatch = (first.data.pairId === second.data.pairId) && (first.data.type !== second.data.type);

  if (isPairMatch) {
    // MATCH SUCCESS
    setTimeout(() => {
      first.element.classList.add('matched', 'match-bounce');
      second.element.classList.add('matched', 'match-bounce');
      
      playAudioTone('match');
      matchedPairsCount++;
      
      // Calculate current score
      calculateScore();

      flippedCards = [];
      isEvaluating = false;

      // Check if Game Complete (All 4 pairs matched)
      if (matchedPairsCount === VOCAB_DATA.length) {
        handleGameVictory();
      }
    }, 300);

  } else {
    // MISMATCH
    wrongAttempts++;
    setTimeout(() => {
      first.element.classList.add('shake');
      second.element.classList.add('shake');
      playAudioTone('error');
    }, 300);

    setTimeout(() => {
      first.element.classList.remove('flipped', 'shake');
      second.element.classList.remove('flipped', 'shake');
      flippedCards = [];
      isEvaluating = false;
      calculateScore();
    }, 1000);
  }
}

/* ==========================================================================
   Timer & Score Management
   ========================================================================== */

function startTimer() {
  isGameStarted = true;
  startTime = Date.now() - elapsedTime;
  timerInterval = setInterval(() => {
    elapsedTime = Date.now() - startTime;
    updateTimerUI();
    calculateScore();
  }, 100);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  isGameStarted = false;
}

function updateTimerUI() {
  const totalSeconds = elapsedTime / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((totalSeconds % 1) * 10);

  const formattedMins = String(minutes).padStart(2, '0');
  const formattedSecs = String(seconds).padStart(2, '0');

  timerDisplay.textContent = `${formattedMins}:${formattedSecs}.${tenths}`;
}

function calculateScore() {
  if (matchedPairsCount === 0 && elapsedTime === 0) {
    score = 0;
    updateScoreUI();
    return;
  }

  const elapsedSeconds = elapsedTime / 1000;
  
  // Scoring formula for 6 pairs (12 cards total):
  // Base Points per pair = 1000 * matchedPairsCount (Max 6000)
  // Time Penalty = 35 pts per second elapsed
  // Wrong Attempt Penalty = 120 pts per mistake
  const baseMatchScore = matchedPairsCount * 1000;
  const timeDeduction = Math.floor(elapsedSeconds * 35);
  const mistakeDeduction = wrongAttempts * 120;

  score = Math.max(0, baseMatchScore - timeDeduction - mistakeDeduction);
  updateScoreUI();
}

function updateScoreUI() {
  scoreDisplay.textContent = score.toLocaleString();
}

function loadHighScore() {
  const saved = localStorage.getItem('english_match_highscore');
  highScore = saved ? parseInt(saved, 10) : 0;
  highScoreDisplay.textContent = highScore.toLocaleString();
}

function saveHighScore(newScore) {
  if (newScore > highScore) {
    highScore = newScore;
    localStorage.setItem('english_match_highscore', highScore.toString());
    highScoreDisplay.textContent = highScore.toLocaleString();
    return true;
  }
  return false;
}

/* ==========================================================================
   Victory Modal & Confetti
   ========================================================================== */

function handleGameVictory() {
  stopTimer();
  calculateScore();
  playAudioTone('victory');

  const isNewRecord = saveHighScore(score);

  // Update Modal Text
  finalTimeDisplay.textContent = timerDisplay.textContent;
  finalScoreDisplay.textContent = score.toLocaleString();
  modalHighScoreDisplay.textContent = highScore.toLocaleString();

  if (isNewRecord) {
    newHighScoreBanner.classList.remove('hidden');
  } else {
    newHighScoreBanner.classList.add('hidden');
  }

  // Update Stars Rating for 6 pairs (3 stars >= 4500, 2 stars >= 2500, 1 star otherwise)
  const stars = starsContainer.querySelectorAll('.star');
  let starCount = 1;
  if (score >= 4500) starCount = 3;
  else if (score >= 2500) starCount = 2;

  stars.forEach((star, idx) => {
    if (idx < starCount) {
      setTimeout(() => star.classList.add('active'), idx * 250);
    } else {
      star.classList.remove('active');
    }
  });

  // Show Modal & Start Confetti
  showVictoryModal();
  startConfetti();
}

function showVictoryModal() {
  victoryModal.classList.remove('hidden');
}

function hideVictoryModal() {
  victoryModal.classList.add('hidden');
  stopConfetti();
}

/* ==========================================================================
   Web Audio API & Audio Unlocker
   ========================================================================== */

function unlockAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Unlock Web Audio Context on first touch/click anywhere on page
document.addEventListener('click', unlockAudio, { passive: true });
document.addEventListener('touchstart', unlockAudio, { passive: true });

function initAudioContext() {
  unlockAudio();
}

function playAudioTone(type) {
  if (!isSoundEnabled) return;
  initAudioContext();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  if (type === 'flip') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.1);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'match') {
    // Happy major chime (C5 -> E5 -> G5 -> C6)
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.4, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.3);
    });
  } else if (type === 'error') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.setValueAtTime(160, now + 0.12);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'click') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, now);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  } else if (type === 'victory') {
    // Fanfare sequence
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.4, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.45);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.45);
    });
  }
}

/* ==========================================================================
   Web Speech API (English Pronunciation)
   ========================================================================== */

let englishVoice = null;

function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  englishVoice = voices.find(v => v.lang === 'en-US' || v.lang === 'en_US') ||
                 voices.find(v => v.lang.startsWith('en')) || null;
}

if ('speechSynthesis' in window) {
  loadVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }
}

function speakWord(wordText) {
  if (!isSpeechEnabled || !('speechSynthesis' in window)) return;
  
  unlockAudio();

  // Load voice if not loaded yet
  if (!englishVoice) {
    loadVoices();
  }

  // Cancel any queued speech for instant response
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(wordText);
  if (englishVoice) {
    utterance.voice = englishVoice;
  }
  utterance.lang = 'en-US';
  utterance.rate = 0.9; // Clear pronunciation rate
  utterance.volume = 1.0;

  window.speechSynthesis.speak(utterance);
}

/* ==========================================================================
   Confetti Particle System
   ========================================================================== */

function startConfetti() {
  if (!confettiCanvas) return;
  confettiCanvas.width = confettiCanvas.parentElement.clientWidth;
  confettiCanvas.height = confettiCanvas.parentElement.clientHeight;

  confettiParticles = [];
  const colors = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#06b6d4'];

  for (let i = 0; i < 70; i++) {
    confettiParticles.push({
      x: Math.random() * confettiCanvas.width,
      y: Math.random() * confettiCanvas.height - confettiCanvas.height,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedY: Math.random() * 3 + 2,
      speedX: Math.random() * 2 - 1,
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 10 - 5
    });
  }

  animateConfetti();
}

function animateConfetti() {
  if (!confettiCtx) return;
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  confettiParticles.forEach(p => {
    p.y += p.speedY;
    p.x += p.speedX;
    p.rotation += p.rotationSpeed;

    if (p.y > confettiCanvas.height) {
      p.y = -10;
      p.x = Math.random() * confettiCanvas.width;
    }

    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate((p.rotation * Math.PI) / 180);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    confettiCtx.restore();
  });

  confettiAnimationId = requestAnimationFrame(animateConfetti);
}

function stopConfetti() {
  if (confettiAnimationId) {
    cancelAnimationFrame(confettiAnimationId);
    confettiAnimationId = null;
  }
  if (confettiCtx && confettiCanvas) {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
}
