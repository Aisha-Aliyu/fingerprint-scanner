// script.js
gsap.registerPlugin();

// DOM refs
const button = document.querySelector('.button');
const statusText = document.querySelector('.status');
const resultIcon = document.querySelector('.result-icon');
const fingerprintPaths = Array.from(document.querySelectorAll('.prints path'));
const svg = document.querySelector('svg');
const scanLine = document.querySelector('.scan-line');
const shimmer = document.querySelector('.shimmer');
const progressContainer = document.querySelector('.progress-container');
const progressBar = document.querySelector('.progress-bar');
const percentageEl = document.querySelector('.percentage');

const scanSound = document.getElementById('scanSound');
const successSound = document.getElementById('successSound');
const failSound = document.getElementById('failSound');

// Internal state
let particleIntervals = [];
let pathRevealTweens = [];
let scanLineTween = null;
let shimmerTween = null;
let progressTween = null;
let fingerprintGlowTween = null;
let progressObj = { v: 0 }; // store progress so we can resume
let scanning = false;

// Init fingerprint visible
function initPaths() {
  fingerprintPaths.forEach(path => {
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len} ${len}`;
    path.style.strokeDashoffset = 0;
    path.style.opacity = 1;
  });
}
initPaths();

/* --------- Particle system --------- */
function createSvgParticle(x, y, color = '#00ffea', r = 1.6, life = 0.8) {
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', x);
  c.setAttribute('cy', y);
  c.setAttribute('r', r);
  c.setAttribute('fill', color);
  c.setAttribute('opacity', '1');
  svg.appendChild(c);

  const dx = (Math.random() - 0.5) * 8;
  const dy = (Math.random() - 0.5) * 8;
  gsap.to(c, {
    attr: { cx: x + dx, cy: y + dy, r: r * 1.8 },
    opacity: 0,
    duration: life,
    ease: 'power1.out',
    onComplete: () => c.remove()
  });
}
function createSvgSparks(cx, cy, color = '#00ffea', count = 8) {
  for (let i = 0; i < count; i++) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', cx);
    rect.setAttribute('y', cy);
    rect.setAttribute('width', 3);
    rect.setAttribute('height', 8);
    rect.setAttribute('rx', 1);
    rect.setAttribute('fill', color);
    svg.appendChild(rect);

    const dx = (Math.random() - 0.5) * 120;
    const dy = (Math.random() - 0.5) * 120;
    gsap.to(rect, {
      attr: { x: cx + dx, y: cy + dy },
      opacity: 0,
      rotation: (Math.random() - 0.5) * 360,
      transformOrigin: 'center center',
      duration: 0.9 + Math.random() * 0.6,
      ease: 'power3.out',
      onComplete: () => rect.remove()
    });
  }
}
function animateParticlesOnPath(path, interval = 80, color = '#00ffea') {
  const length = path.getTotalLength();
  let offset = 0;
  const step = Math.max(4, Math.floor(length / 120));
  const id = setInterval(() => {
    const pt = path.getPointAtLength(offset);
    createSvgParticle(pt.x, pt.y, color, 1.6, 0.8);
    offset += step;
    if (offset > length) offset = 0;
  }, interval);
  return id;
}
function clearParticleIntervals() {
  particleIntervals.forEach(i => clearInterval(i));
  particleIntervals = [];
}
function stopLoopTweens() {
  if (scanLineTween) { scanLineTween.kill(); scanLineTween = null; }
  if (shimmerTween) { shimmerTween.kill(); shimmerTween = null; }
  if (progressTween) { progressTween.kill(); progressTween = null; }
  if (fingerprintGlowTween) { fingerprintGlowTween.kill(); fingerprintGlowTween = null; }
  pathRevealTweens.forEach(t => t.kill && t.kill());
  pathRevealTweens = [];
}

/* --------- Glow helper --------- */
function setFingerprintGlow(color, pulse = false) {
  if (fingerprintGlowTween) fingerprintGlowTween.kill();
  fingerprintGlowTween = gsap.to(fingerprintPaths, {
    stroke: color,
    filter: `drop-shadow(0 0 14px ${color})`,
    duration: 0.6,
    ease: "power2.inOut",
    repeat: pulse ? -1 : 0,
    yoyo: pulse
  });
}

/* --------- Scan animation --------- */
function startScan() {scanning = true;
  statusText.textContent = 'Scanning...';
  resultIcon.style.display = 'none';
  progressContainer.style.display = 'block';
  percentageEl.style.display = 'block';

  // Sounds
  if (scanSound) { scanSound.currentTime = 0; scanSound.play().catch(()=>{}); }

  // Glow effect while scanning (cyan pulse)
  setFingerprintGlow("#00ffea", true);

  // Shimmer + line
  shimmerTween = gsap.fromTo(shimmer, { x: '-100%' }, { x: '120%', duration: 2.2, repeat: -1, ease: 'linear' });
  scanLineTween = gsap.fromTo(scanLine, { y: '-6%' }, { y: '96%', duration: 1.4, repeat: -1, ease: 'power1.inOut' });

  // Reveal fingerprint paths
  fingerprintPaths.forEach(path => {
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len} ${len}`;
    path.style.strokeDashoffset = len;
  });
  const revealTween = gsap.to(fingerprintPaths, { strokeDashoffset: 0, duration: 1.8, stagger: 0.12, ease: 'power2.inOut' });
  pathRevealTweens.push(revealTween);

  // Particle trails
  clearParticleIntervals();
  fingerprintPaths.forEach(path => {
    const id = animateParticlesOnPath(path, 72, '#00ffea');
    particleIntervals.push(id);
  });

  // Progress (resume from saved value)
  progressTween = gsap.to(progressObj, {
    v: 100,
    duration: (100 - progressObj.v) * 0.04, // speed factor
    ease: 'linear',
    onUpdate: () => {
      const val = Math.round(progressObj.v);
      progressBar.style.width = val + '%';
      percentageEl.textContent = val + '%';
    },
    onComplete: finishScan
  });
}

function pauseScan() {
  scanning = false;
  stopLoopTweens();
  clearParticleIntervals();
  if (scanSound) scanSound.pause();
  statusText.textContent = 'Scan incomplete, hold again to continue';
}

function finishScan() {
  scanning = false;
  stopLoopTweens();
  clearParticleIntervals();
  if (scanSound) scanSound.pause();

  const success = Math.random() > 0.45;
  if (success) {
    statusText.textContent = 'Access Granted';
    statusText.style.color = '#00ff6a';
    resultIcon.textContent = '✅';
    resultIcon.style.display = 'block';
    successSound.play().catch(()=>{});
    createSvgSparks(50, 50, '#00ff6a', 12);

    // Change glow to green
    setFingerprintGlow("#00ff6a");
  } else {
    statusText.textContent = 'Access Denied';
    statusText.classList.add('glitch');
    statusText.style.color = '#ff0033';
    resultIcon.textContent = '❌';
    resultIcon.style.display = 'block';
    failSound.play().catch(()=>{});
    createSvgSparks(50, 50, '#ff0033', 12);

    // Change glow to red
    setFingerprintGlow("#ff0033");
  }

  // Reset after done
  gsap.to({}, { delay: 1.5, onComplete: () => {
    progressContainer.style.display = 'none';
    percentageEl.style.display = 'none';
    statusText.classList.remove('glitch');
    progressObj.v = 0; // reset progress for next scan
    progressBar.style.width = '0%';
    percentageEl.textContent = '';

    // Auto fade glow back to neutral
    setFingerprintGlow("#888888"); 
  }});
}

/* --------- Event listeners (long press) --------- */
button.addEventListener('mousedown', () => {
  if (!scanning) startScan();
});
button.addEventListener('mouseup', () => {
  if (progressObj.v < 100) pauseScan();
});
button.addEventListener('mouseleave', () => {
  if (progressObj.v < 100 && scanning) pauseScan();
});

// Touch support
button.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!scanning) startScan();
});
button.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (progressObj.v < 100) pauseScan();
});