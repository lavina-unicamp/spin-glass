// ==========================================
// PHYSICS & SIMULATION CONSTANTS
// ==========================================
let currentLang = 'pt';
const DELTA_V_KB = 555;
const TAU_0 = 1e-11;

let currentT = 150;
let currentTau = Infinity;
let currentQ = 1.0;
let simMode = 'varyQ'; // 'varyQ' or 'varyT'

const T_CUTOFF_CURVES = {
    0.7: [{ T: 100, Tc: 104 }, { T: 125, Tc: 93 }, { T: 150, Tc: 90 }, { T: 175, Tc: 87 }, { T: 200, Tc: 84 }, { T: 250, Tc: 81 }],
    0.8: [{ T: 75,  Tc: 80 },  { T: 100, Tc: 74 }, { T: 125, Tc: 68 }, { T: 150, Tc: 64 }, { T: 200, Tc: 60 }, { T: 250, Tc: 57 }],
    0.9: [{ T: 50,  Tc: 46 },  { T: 100, Tc: 40 }, { T: 150, Tc: 34 }, { T: 200, Tc: 31 }, { T: 250, Tc: 29 }]
};

function calculateTCutoff(q, tVal) {
    if (q >= 1.0) return 0;
    const curve = T_CUTOFF_CURVES[q];
    if (!curve) return 0;

    if (tVal <= curve[0].T) return curve[0].Tc;
    if (tVal >= curve[curve.length - 1].T) return curve[curve.length - 1].Tc;

    for (let i = 0; i < curve.length - 1; i++) {
        const p1 = curve[i];
        const p2 = curve[i + 1];
        if (tVal >= p1.T && tVal <= p2.T) {
            const slope = (p2.Tc - p1.Tc) / (p2.T - p1.T);
            return p1.Tc + slope * (tVal - p1.T);
        }
    }
    return 0;
}

// ==========================================
// THREE.JS 3D SCENE SETUP
// ==========================================
const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0d1117, 0.005);

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, 0, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.autoClear = false;
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);

const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight1.position.set(100, 100, 100);
scene.add(dirLight1);

const dirLight2 = new THREE.DirectionalLight(0x4a90e2, 1.0);
dirLight2.position.set(-100, -100, -100);
scene.add(dirLight2);

// Bounding Box Visualizer
const BOUNDING_BOX = 60;
const boxGeo = new THREE.BoxGeometry(BOUNDING_BOX, BOUNDING_BOX, BOUNDING_BOX);
const boxWireframe = new THREE.WireframeGeometry(boxGeo);
const boxLine = new THREE.LineSegments(boxWireframe);
boxLine.material.color.setHex(0x7a8490);
boxLine.material.transparent = true;
boxLine.material.opacity = 0.8;
scene.add(boxLine);

// Opaque Volume for q > 1 (Surrounding Environment Visual Cue)
const opaqueVolumeGeo = new THREE.BoxGeometry(BOUNDING_BOX * 1.1, BOUNDING_BOX * 1.1, BOUNDING_BOX * 1.1);
const opaqueVolumeMat = new THREE.MeshStandardMaterial({
    color: 0x388bfd,
    transparent: true,
    opacity: 0.12,
    roughness: 0.1,
    side: THREE.BackSide
});
const opaqueVolumeMesh = new THREE.Mesh(opaqueVolumeGeo, opaqueVolumeMat);
opaqueVolumeMesh.visible = false;
scene.add(opaqueVolumeMesh);

// Particle Geometries and Materials
const SPHERE_RADIUS = 5;
const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 32, 32);
const sphereMat = new THREE.MeshStandardMaterial({
    color: 0x79c0ff,
    roughness: 0.15,
    metalness: 0.4,
    emissive: 0x1f447a,
    emissiveIntensity: 0.8
});

function createThickArrow() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x2ea043, roughness: 0.3, metalness: 0.5 });

    const shaftLength = 18;
    const shaftGeo = new THREE.CylinderGeometry(0.6, 0.6, shaftLength, 16);
    const shaft = new THREE.Mesh(shaftGeo, mat);
    shaft.position.y = 0;

    const headLength = 4;
    const headGeo = new THREE.ConeGeometry(2.0, headLength, 16);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = (shaftLength / 2) + (headLength / 2);

    group.add(shaft);
    group.add(head);
    return group;
}

let PARTICLES = [];

// Question Mark Sprite for Unknown Configurations (q > 1)
const qmCanvas = document.createElement('canvas');
qmCanvas.width = 1024;
qmCanvas.height = 256;
const qmCtx = qmCanvas.getContext('2d');
const qmTex = new THREE.CanvasTexture(qmCanvas);
const qmMat = new THREE.SpriteMaterial({ map: qmTex, transparent: true });
const qmSprite = new THREE.Sprite(qmMat);
qmSprite.scale.set(80, 20, 1);
qmSprite.position.set(0, 25, 0);
qmSprite.visible = false;
scene.add(qmSprite);

function updateQmSprite() {
    qmCtx.clearRect(0, 0, 1024, 256);
    qmCtx.textAlign = 'center';
    qmCtx.textBaseline = 'middle';

    qmCtx.fillStyle = '#ffcc00';
    qmCtx.font = 'bold 110px "Segoe UI", sans-serif';
    qmCtx.fillText('?', 512, 70);

    qmCtx.fillStyle = '#c9d1d9';
    qmCtx.font = 'bold 32px "Segoe UI", sans-serif';
    let text = 'Configuração Espacial Desconhecida';
    if (currentLang === 'en') text = 'Unknown Spatial Configuration';
    if (currentLang === 'es') text = 'Configuración Espacial Desconocida';
    qmCtx.fillText(text, 512, 170);

    qmTex.needsUpdate = true;
}
updateQmSprite();

// HUD Overlay Scene
const hudScene = new THREE.Scene();
const hudCamera = new THREE.OrthographicCamera(
    -container.clientWidth / 2, container.clientWidth / 2,
    container.clientHeight / 2, -container.clientHeight / 2,
    0.1, 10
);
hudCamera.position.z = 5;

const hudCanvas = document.createElement('canvas');
hudCanvas.width = 240;
hudCanvas.height = 70;
const hudCtx = hudCanvas.getContext('2d');
const hudTex = new THREE.CanvasTexture(hudCanvas);
const hudMat = new THREE.SpriteMaterial({ map: hudTex, transparent: true });
const hudSprite = new THREE.Sprite(hudMat);
hudSprite.scale.set(240, 70, 1);
hudSprite.position.set(-container.clientWidth / 2 + 140, container.clientHeight / 2 - 50, 0);
hudScene.add(hudSprite);

function updateHUD(qVal) {
    hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);

    hudCtx.fillStyle = 'rgba(13, 17, 23, 0.85)';
    hudCtx.beginPath();
    if (hudCtx.roundRect) hudCtx.roundRect(0, 0, 240, 70, 10);
    else hudCtx.rect(0, 0, 240, 70);
    hudCtx.fill();
    hudCtx.strokeStyle = '#58a6ff';
    hudCtx.lineWidth = 3;
    hudCtx.stroke();

    hudCtx.fillStyle = '#ffffff';
    hudCtx.font = 'bold 32px "Segoe UI", sans-serif';
    hudCtx.textAlign = 'center';
    hudCtx.textBaseline = 'middle';
    hudCtx.fillText(`q = ${qVal.toFixed(2)}`, 120, 35);

    hudTex.needsUpdate = true;
}

// ==========================================
// FLIP AND ROTATION LOGIC
// ==========================================
const FLIP_SPEED = 0.4;

function updateParticleState(p) {
    if (currentTau !== Infinity && currentTau > 0) {
        let flipProbability = 0;
        if (currentQ >= 1.3) flipProbability = 0.25;
        else if (currentQ >= 1.2) flipProbability = 0.15;
        else if (currentQ >= 1.1) flipProbability = 0.10;
        else if (currentQ >= 1.0) flipProbability = 0.05;
        else if (currentQ >= 0.9) flipProbability = 0.015 * (currentT / 150);
        else if (currentQ >= 0.8) flipProbability = 0.003 * (currentT / 150);
        else if (currentQ >= 0.7) flipProbability = 0.0001 * (currentT / 150);

        if (!p.isFlipping && Math.random() < flipProbability) {
            p.isFlipping = true;
            p.targetDir.copy(p.baseDir).negate();

            const randomVec = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
            p.rotationAxis.crossVectors(p.baseDir, randomVec).normalize();
            if (p.rotationAxis.lengthSq() < 0.1) {
                p.rotationAxis.set(1, 0, 0);
            }
        }
    }

    if (p.isFlipping) {
        const angleToTarget = p.currentDir.angleTo(p.targetDir);

        if (angleToTarget < 0.08) {
            p.currentDir.copy(p.targetDir);
            p.baseDir.copy(p.targetDir);
            p.isFlipping = false;
        } else {
            const stepAngle = Math.min(FLIP_SPEED, angleToTarget);
            p.currentDir.applyAxisAngle(p.rotationAxis, stepAngle).normalize();
        }
    } else if (currentTau === Infinity) {
        p.currentDir.copy(p.baseDir);
    }
}

// ==========================================
// PARTICLE MANAGEMENT
// ==========================================
function generateParticle() {
    let px = 0, py = 0, pz = 0;

    if (PARTICLES.length > 0) {
        let valid = false;
        let attempts = 0;

        while (!valid && attempts < 150) {
            valid = true;
            px = (Math.random() - 0.5) * (BOUNDING_BOX - SPHERE_RADIUS * 2);
            py = (Math.random() - 0.5) * (BOUNDING_BOX - SPHERE_RADIUS * 2);
            pz = (Math.random() - 0.5) * (BOUNDING_BOX - SPHERE_RADIUS * 2);

            const proposedPos = new THREE.Vector3(px, py, pz);
            for (let i = 0; i < PARTICLES.length; i++) {
                if (proposedPos.distanceTo(PARTICLES[i].mesh.position) < SPHERE_RADIUS * 2.5) {
                    valid = false;
                    break;
                }
            }
            attempts++;
        }
    }

    const mesh = new THREE.Mesh(sphereGeo, sphereMat);
    mesh.position.set(px, py, pz);
    scene.add(mesh);

    const initialDir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
    ).normalize();

    const arrow = createThickArrow();
    arrow.position.copy(mesh.position);
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), initialDir);
    scene.add(arrow);

    PARTICLES.push({
        mesh: mesh,
        arrow: arrow,
        baseDir: initialDir.clone(),
        currentDir: initialDir.clone(),
        targetDir: initialDir.clone(),
        rotationAxis: new THREE.Vector3(1, 0, 0),
        isFlipping: false
    });
}

function removeParticles(amountToRemove) {
    for (let i = 0; i < amountToRemove; i++) {
        const p = PARTICLES.pop();
        if (p) {
            scene.remove(p.mesh);
            scene.remove(p.arrow);
        }
    }
}

// ==========================================
// PHYSICS & UI UPDATE
// ==========================================
function updatePhysics(q, tVal) {
    let T_star = 0;

    if (q === 1.3) T_star = 80.0;
    if (q === 1.2) T_star = 60.0;
    if (q === 1.1) T_star = 40.0;
    if (q === 1.0) T_star = 0;
    if (q === 0.9) T_star = 25.0;
    if (q === 0.8) T_star = 100.0;
    if (q === 0.7) T_star = 20.0;

    currentQ = q;
    currentT = tVal;
    const T_cutoff = calculateTCutoff(q, currentT);
    let tau = 0;
    let eqText = "";

    updateHUD(q);

    if (q === 1.0) {
        tau = TAU_0 * Math.exp(DELTA_V_KB / currentT);
        eqText = "$$\\tau = \\tau_0 \\exp\\left(\\frac{\\Delta V}{k_B T}\\right)$$";
    } else if (q < 1.0) {
        if (currentT <= T_cutoff) {
            tau = Infinity;
        } else {
            const base = (currentT + T_star) / (currentT - T_cutoff);
            const exponent = (3 - q) / (2 * (1 - q));
            tau = TAU_0 * Math.pow(base, exponent);
        }
        eqText = "$$\\tau = \\tau_0 \\left( \\frac{T + T^*}{T - T_{cut-off}} \\right)^{\\frac{3-q}{2(1-q)}}$$";
    } else if (q > 1.0) {
        const base = (currentT - T_star) / (currentT + T_cutoff);
        if (base <= 0) {
            tau = 0;
        } else {
            const exponent = (3 - q) / (2 * (1 - q));
            tau = TAU_0 * Math.pow(base, exponent);
        }
        eqText = "$$\\tau = \\tau_0 \\left( \\frac{T - T^*}{T + T_{cut-off}} \\right)^{\\frac{3-q}{2(1-q)}}$$";
    }

    currentTau = tau;

    let tauDisplay = "";
    if (tau === Infinity) {
        tauDisplay = "∞";
    } else if (tau === 0) {
        tauDisplay = "0 s";
    } else {
        const [baseStr, exponentStr] = tau.toExponential(2).split('e');
        tauDisplay = `${baseStr} &times; 10<sup>${parseInt(exponentStr)}</sup> s`;
    }

    document.getElementById('qLabel').innerText = q.toFixed(2);
    document.getElementById('tauLabel').innerHTML = tauDisplay;
    document.getElementById('tLabel').innerText = `T = ${currentT} K`;
    document.getElementById('tCutoffLabel').innerText = T_cutoff.toFixed(1) + " K";

    const eqDiv = document.getElementById('equationDisplay');
    eqDiv.innerHTML = eqText;
    if (window.MathJax) {
        MathJax.typesetPromise([eqDiv]);
    }
}

// Select Change Event
const estadosSelect = document.getElementById('estadosSelect');
estadosSelect.addEventListener('change', function () {
    document.getElementById("opt0").disabled = true;
    const qVal = parseFloat(estadosSelect.value);

    let numBolas = 1;
    if (qVal === 0.9) numBolas = 5;
    if (qVal === 0.8) numBolas = 9;
    if (qVal === 0.7) numBolas = 13;

    if (numBolas > PARTICLES.length) {
        const toAdd = numBolas - PARTICLES.length;
        for (let i = 0; i < toAdd; i++) {
            generateParticle();
        }
    } else if (numBolas < PARTICLES.length) {
        removeParticles(PARTICLES.length - numBolas);
    }

    qmSprite.visible = qVal > 1.0;
    opaqueVolumeMesh.visible = qVal > 1.0;

    updatePhysics(qVal, currentT);
});

// Mode Selector (Vary q vs. Vary T)
const modeVaryQBtn = document.getElementById('modeVaryQ');
const modeVaryTBtn = document.getElementById('modeVaryT');
const tempSliderContainer = document.getElementById('tempSliderContainer');
const tempSlider = document.getElementById('tempSlider');
const tSliderVal = document.getElementById('tSliderVal');

modeVaryQBtn.addEventListener('click', () => {
    simMode = 'varyQ';
    modeVaryQBtn.classList.add('active');
    modeVaryTBtn.classList.remove('active');
    tempSliderContainer.classList.add('hidden');
    currentT = 150;
    tempSlider.value = 150;
    tSliderVal.innerText = 150;
    if (currentQ > 0) updatePhysics(currentQ, currentT);
});

modeVaryTBtn.addEventListener('click', () => {
    simMode = 'varyT';
    modeVaryTBtn.classList.add('active');
    modeVaryQBtn.classList.remove('active');
    tempSliderContainer.classList.remove('hidden');
    if (currentQ > 0) updatePhysics(currentQ, currentT);
});

tempSlider.addEventListener('input', (e) => {
    currentT = parseInt(e.target.value, 10);
    tSliderVal.innerText = currentT;
    if (currentQ > 0) updatePhysics(currentQ, currentT);
});

// Accordion Interaction
const infoToggleBtn = document.getElementById('infoToggleBtn');
const infoBox = document.getElementById('infoBox');
const accordionIcon = document.getElementById('accordionIcon');

infoToggleBtn.addEventListener('click', function () {
    if (infoBox.style.maxHeight) {
        infoBox.style.maxHeight = null;
        accordionIcon.innerText = "+";
    } else {
        infoBox.style.maxHeight = infoBox.scrollHeight + "px";
        accordionIcon.innerText = "-";
    }
});

// Window Resizing
window.addEventListener('resize', () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);

    hudCamera.left = -width / 2;
    hudCamera.right = width / 2;
    hudCamera.top = height / 2;
    hudCamera.bottom = -height / 2;
    hudCamera.updateProjectionMatrix();
    hudSprite.position.set(-width / 2 + 140, height / 2 - 50, 0);
});

// ==========================================
// VIDEO RECORDING LOGIC
// ==========================================
const recordBtn = document.getElementById('recordBtn');
const recordDuration = document.getElementById('recordDuration');
let mediaRecorder;
let recordedChunks = [];
let recordTimerInterval;
let currentBlobUrl = null;

recordBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') return;

    if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
    }

    const durationSec = parseInt(recordDuration.value, 10) || 5;
    const durationMs = durationSec * 1000;
    const stream = renderer.domElement.captureStream(30);

    let options = { mimeType: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' };
    let extension = 'mp4';

    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm; codecs=vp9' };
        extension = 'webm';
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: 'video/webm; codecs=vp8' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = { mimeType: 'video/webm' };
            }
        }
    }

    mediaRecorder = new MediaRecorder(stream, options);
    recordedChunks = [];

    mediaRecorder.ondataavailable = function (e) {
        if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = function () {
        clearInterval(recordTimerInterval);
        const blob = new Blob(recordedChunks, { type: options.mimeType });
        const url = URL.createObjectURL(blob);
        currentBlobUrl = url;

        const filenameInput = document.getElementById('recordFilename').value.trim();
        const baseFilename = filenameInput || `spin-glass-sim-q${currentQ.toFixed(2)}`;
        const finalFilename = `${baseFilename}.${extension}`;

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = finalFilename;
        document.body.appendChild(a);
        a.click();
        window.open(url, '_blank');

        setTimeout(() => document.body.removeChild(a), 100);

        recordBtn.innerText = currentLang === 'en' ? 'Record' : 'Gravar';
        recordBtn.classList.remove('recording');
        recordBtn.disabled = false;
    };

    mediaRecorder.start();

    let elapsedSeconds = 0;
    recordBtn.classList.add('recording');
    recordBtn.disabled = true;

    const updateTimerText = () => {
        recordBtn.innerText = currentLang === 'en'
            ? `Recording... (${elapsedSeconds}s / ${durationSec}s)`
            : `Gravando... (${elapsedSeconds}s / ${durationSec}s)`;
    };

    updateTimerText();
    recordTimerInterval = setInterval(() => {
        elapsedSeconds++;
        if (elapsedSeconds <= durationSec) updateTimerText();
    }, 1000);

    setTimeout(() => {
        if (mediaRecorder.state === 'recording') mediaRecorder.stop();
    }, durationMs);
});

// ==========================================
// LANGUAGE TRANSLATIONS
// ==========================================
const translations = {
    en: {
        mainTitle: "A Generalized Approach to Relaxation Time of Magnetic Nanoparticles With Interactions: From Superparamagnetic to Glassy-Like Freezing",
        authors: "J. C. Cardoso Cerbino and D. Muraca",
        selectLabel: "Select q-parameter:",
        opt0: "Select q-parameter",
        opt1: "q = 1.3 (Super-diffusive)",
        opt2: "q = 1.2 (Super-diffusive)",
        optX: "q = 1.1 (Super-diffusive)",
        opt3: "q = 1.0 (Néel-Brown)",
        opt4: "q = 0.9 (Sub-diffusive)",
        opt5: "q = 0.8 (Sub-diffusive)",
        opt6: "q = 0.7 (Spin-Glass)",
        modeVaryQ: "Vary q (Fixed T)",
        modeVaryT: "Vary T (Fixed q)",
        eqHeading: "Equation being used:",
        eqPlaceholder: "Select q-parameter",
        infoBtnText: "Simulation Info",
        infoTitle: "About the 3D Simulation",
        disclaimer: "Note: This simulation is for illustrative purposes only.",
        info1: "<strong>Particles:</strong> Magnetic nanoparticles (MNPs) with dipolar interactions.",
        info2: "<strong>Arrows:</strong> Magnetic dipole moments oriented in 3D.",
        info3: "<strong>180&deg; Flips:</strong> Stochastic Néel relaxation influenced by relaxation time \\(\\tau\\).",
        glossaryTitle: "Variables",
        info5: "<strong>\\(q\\):</strong> Entropic index (interaction strength).",
        info6: "<strong>\\(\\tau\\):</strong> Relaxation time (average wait between flips).",
        info7: "<strong>\\(T\\):</strong> Environmental temperature.",
        info8: "<strong>\\(T_{cut-off}\\):</strong> Critical freezing threshold.",
        creditsTitle: "Credits & Production",
        creditsText: "<strong>Authors:</strong> Jean Claudio Cardoso Cerbino, Diego Muraca<br><strong>Group:</strong> LAVINA (Interactive Virtual Laboratory)<br><strong>Institution:</strong> IFGW - Gleb Wataghin Institute of Physics, Unicamp<br><strong>Contact:</strong> <a href='mailto:lavina@ifi.unicamp.br'>lavina@ifi.unicamp.br</a>",
        recordHeading: "Record Video:",
        recordFilenamePlaceholder: "Filename (optional)",
        recordSecLabel: "sec",
        recordBtn: "Record",
        recordNote: "Note: Saved format (MP4 or WebM) depends on your browser support."
    },
    pt: {
        mainTitle: "A Generalized Approach to Relaxation Time of Magnetic Nanoparticles With Interactions: From Superparamagnetic to Glassy-Like Freezing",
        authors: "J. C. Cardoso Cerbino e D. Muraca",
        selectLabel: "Selecione o parâmetro q:",
        opt0: "Selecione o parâmetro q",
        opt1: "q = 1.3 (Super-difusivo)",
        opt2: "q = 1.2 (Super-difusivo)",
        optX: "q = 1.1 (Super-difusivo)",
        opt3: "q = 1.0 (Néel-Brown)",
        opt4: "q = 0.9 (Sub-difusivo)",
        opt5: "q = 0.8 (Sub-difusivo)",
        opt6: "q = 0.7 (Vidro de Spin)",
        modeVaryQ: "Varia q (T fixo)",
        modeVaryT: "Varia T (q fixo)",
        eqHeading: "Equação utilizada:",
        eqPlaceholder: "Selecione o parâmetro q",
        infoBtnText: "Info da Simulação",
        infoTitle: "Sobre a Simulação 3D",
        disclaimer: "Nota: Esta simulação tem fins exclusivamente ilustrativos.",
        info1: "<strong>Partículas:</strong> Nanopartículas magnéticas (MNPs) com interações dipolares.",
        info2: "<strong>Setas:</strong> Momentos de dipolo magnético orientados em 3D.",
        info3: "<strong>Giros de 180&deg;:</strong> Relaxação de Néel estocástica influenciada pelo tempo de relaxação \\(\\tau\\).",
        glossaryTitle: "Variáveis",
        info5: "<strong>\(q\):</strong> Índice entrópico (força de interação).",
        info6: "<strong>\(\tau\):</strong> Tempo de relaxação (tempo médio de espera entre giros).",
        info7: "<strong>\(T\):</strong> Temperatura ambiente.",
        info8: "<strong>\(T_{cut-off}\):</strong> Limite de temperatura crítica de congelamento.",
        creditsTitle: "Créditos e Produção",
        creditsText: "<strong>Autores:</strong> Jean Claudio Cardoso Cerbino, Diego Muraca<br><strong>Grupo:</strong> LAVINA (Laboratório Virtual Interativo)<br><strong>Instituição:</strong> IFGW - Instituto de Física Gleb Wataghin, Unicamp<br><strong>Contato:</strong> <a href='mailto:lavina@ifi.unicamp.br'>lavina@ifi.unicamp.br</a>",
        recordHeading: "Gravar Vídeo:",
        recordFilenamePlaceholder: "Nome do arquivo (opcional)",
        recordSecLabel: "seg",
        recordBtn: "Gravar",
        recordNote: "Nota: O formato salvo (MP4 ou WebM) depende do suporte do seu navegador."
    },
    es: {
        mainTitle: "A Generalized Approach to Relaxation Time of Magnetic Nanoparticles With Interactions: From Superparamagnetic to Glassy-Like Freezing",
        authors: "J. C. Cardoso Cerbino y D. Muraca",
        selectLabel: "Seleccione el parámetro q:",
        opt0: "Seleccione el parámetro q",
        opt1: "q = 1.3 (Super-difusivo)",
        opt2: "q = 1.2 (Super-difusivo)",
        optX: "q = 1.1 (Super-difusivo)",
        opt3: "q = 1.0 (Néel-Brown)",
        opt4: "q = 0.9 (Sub-difusivo)",
        opt5: "q = 0.8 (Sub-difusivo)",
        opt6: "q = 0.7 (Vidro de Spin)",
        modeVaryQ: "Varía q (T fijo)",
        modeVaryT: "Varía T (q fijo)",
        eqHeading: "Ecuación utilizada:",
        eqPlaceholder: "Seleccione el parámetro q",
        infoBtnText: "Info de la Simulación",
        infoTitle: "Sobre la Simulación 3D",
        disclaimer: "Nota: Esta simulación es solo para fines ilustrativos.",
        info1: "<strong>Partículas:</strong> Nanopartículas magnéticas (MNPs) con interacciones dipolares.",
        info2: "<strong>Flechas:</strong> Momentos de dipolo magnético orientados en 3D.",
        info3: "<strong>Giros de 180&deg;:</strong> Relajación de Néel estocástica influenciada por el tiempo de relajación \\(\\tau\\).",
        glossaryTitle: "Variables",
        info5: "<strong>\\(q\\):</strong> Índice entrópico (fuerza de interacción).",
        info6: "<strong>\\(\\tau\\):</strong> Tiempo de relajación (tiempo promedio de espera entre giros).",
        info7: "<strong>\\(T\\):</strong> Temperatura ambiente.",
        info8: "<strong>\\(T_{cut-off}\\):</strong> Límite de temperatura crítica de congelación.",
        creditsTitle: "Créditos y Producción",
        creditsText: "<strong>Autores:</strong> Jean Claudio Cardoso Cerbino, Diego Muraca<br><strong>Grupo:</strong> LAVINA (Laboratorio Virtual Interactivo)<br><strong>Institución:</strong> IFGW - Instituto de Física Gleb Wataghin, Unicamp<br><strong>Contacto:</strong> <a href='mailto:lavina@ifi.unicamp.br'>lavina@ifi.unicamp.br</a>",
        recordHeading: "Grabar Video:",
        recordFilenamePlaceholder: "Nombre del archivo (opcional)",
        recordSecLabel: "seg",
        recordBtn: "Grabar",
        recordNote: "Nota: El formato guardado (MP4 o WebM) depende de su navegador."
    }
};

document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const lang = e.target.getAttribute('data-lang');
        switchLanguage(lang);
    });
});

function switchLanguage(lang) {
    currentLang = lang;
    const t = translations[lang];

    document.getElementById('mainTitle').innerText = t.mainTitle;
    document.getElementById('authorsLabel').innerText = t.authors;
    document.getElementById('selectLabel').innerText = t.selectLabel;
    document.getElementById('opt0').innerText = t.opt0;
    document.getElementById('opt1').innerText = t.opt1;
    document.getElementById('opt2').innerText = t.opt2;
    document.getElementById('optX').innerText = t.optX;
    document.getElementById('opt3').innerText = t.opt3;
    document.getElementById('opt4').innerText = t.opt4;
    document.getElementById('opt5').innerText = t.opt5;
    document.getElementById('opt6').innerText = t.opt6;
    document.getElementById('modeVaryQ').innerText = t.modeVaryQ;
    document.getElementById('modeVaryT').innerText = t.modeVaryT;
    document.getElementById('eqHeading').innerText = t.eqHeading;
    document.getElementById('infoTitle').innerText = t.infoTitle;
    document.getElementById('disclaimerNote').innerText = t.disclaimer;
    document.getElementById('infoToggleText').innerText = t.infoBtnText;
    document.getElementById('creditsTitle').innerText = t.creditsTitle;
    document.getElementById('creditsContent').innerHTML = t.creditsText;
    document.getElementById('recordHeading').innerText = t.recordHeading;
    document.getElementById('recordFilename').placeholder = t.recordFilenamePlaceholder;
    document.getElementById('recordSecLabel').innerText = t.recordSecLabel;
    document.getElementById('recordNote').innerText = t.recordNote;
    document.getElementById('recordBtn').innerText = t.recordBtn;

    document.getElementById('info1').innerHTML = t.info1;
    document.getElementById('info2').innerHTML = t.info2;
    document.getElementById('info3').innerHTML = t.info3;
    document.getElementById('info5').innerHTML = t.info5;
    document.getElementById('info6').innerHTML = t.info6;
    document.getElementById('info7').innerHTML = t.info7;
    document.getElementById('info8').innerHTML = t.info8;

    updateQmSprite();

    if (window.MathJax) {
        MathJax.typesetPromise([document.getElementById('infoBox')]);
    }
}

// ==========================================
// ANIMATION LOOP
// ==========================================
const UP_AXIS = new THREE.Vector3(0, 1, 0);

function animate() {
    requestAnimationFrame(animate);

    PARTICLES.forEach(p => {
        updateParticleState(p);
        p.arrow.quaternion.setFromUnitVectors(UP_AXIS, p.currentDir);
    });

    controls.update();

    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hudScene, hudCamera);
}

animate();