// ==========================================
// PHYSICS & SIMULATION CONSTANTS
// ==========================================
const DELTA_V_KB = 555;
const TAU_0 = 1e-11;

let currentT = 150;
let currentTau = Infinity;
let currentQ = 1.0;

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

// Helper to convert exponent integers into unicode superscripts for Canvas HUD
function toSuperscript(numStr) {
    const superscripts = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
        '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        '-': '⁻', '+': '⁺'
    };
    return String(numStr).split('').map(char => superscripts[char] || char).join('');
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

// Opaque Volume for q > 1
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
    qmCtx.fillText('Unknown Spatial Configuration', 512, 170);

    qmTex.needsUpdate = true;
}
updateQmSprite();

// ==========================================
// HUD OVERLAY SCENE & DRAGGABLE PHYSICS CARD
// ==========================================
const hudScene = new THREE.Scene();
const hudCamera = new THREE.OrthographicCamera(
    -container.clientWidth / 2, container.clientWidth / 2,
    container.clientHeight / 2, -container.clientHeight / 2,
    0.1, 10
);
hudCamera.position.z = 5;

const HUD_WIDTH = 300;
const HUD_HEIGHT = 180;

const hudCanvas = document.createElement('canvas');
hudCanvas.width = HUD_WIDTH;
hudCanvas.height = HUD_HEIGHT;
const hudCtx = hudCanvas.getContext('2d');
const hudTex = new THREE.CanvasTexture(hudCanvas);
const hudMat = new THREE.SpriteMaterial({ map: hudTex, transparent: true });
const hudSprite = new THREE.Sprite(hudMat);
hudSprite.scale.set(HUD_WIDTH, HUD_HEIGHT, 1);

// Initial position: Top-left corner
hudSprite.position.set(
    -container.clientWidth / 2 + HUD_WIDTH / 2 + 20,
    container.clientHeight / 2 - HUD_HEIGHT / 2 - 20,
    0
);
hudScene.add(hudSprite);

function updateHUD(qVal, tVal, tCutoff, tauText) {
    hudCtx.clearRect(0, 0, HUD_WIDTH, HUD_HEIGHT);

    // Draw background card with rounded corners
    hudCtx.fillStyle = 'rgba(13, 17, 23, 0.90)';
    hudCtx.beginPath();
    if (hudCtx.roundRect) hudCtx.roundRect(0, 0, HUD_WIDTH, HUD_HEIGHT, 10);
    else hudCtx.rect(0, 0, HUD_WIDTH, HUD_HEIGHT);
    hudCtx.fill();
    hudCtx.strokeStyle = '#58a6ff';
    hudCtx.lineWidth = 3;
    hudCtx.stroke();

    // Drag handle bar
    hudCtx.fillStyle = '#30363d';
    hudCtx.fillRect(120, 8, 60, 4);

    hudCtx.textAlign = 'left';
    hudCtx.textBaseline = 'top';

    // Variable: q
    hudCtx.font = 'italic bold 20px "Times New Roman", serif';
    hudCtx.fillStyle = '#ffffff';
    hudCtx.fillText('q', 20, 25);
    hudCtx.font = '20px "Segoe UI", sans-serif';
    hudCtx.fillText(` = ${qVal.toFixed(2)}`, 35, 25);

    // Variable: T
    hudCtx.font = 'italic bold 20px "Times New Roman", serif';
    hudCtx.fillText('T', 20, 60);
    hudCtx.font = '20px "Segoe UI", sans-serif';
    hudCtx.fillText(` = ${tVal} K`, 38, 60);

    // Variable: T_cutoff
    hudCtx.font = 'italic bold 20px "Times New Roman", serif';
    hudCtx.fillText('T', 20, 95);
    hudCtx.font = '13px "Segoe UI", sans-serif';
    hudCtx.fillText('cutoff', 34, 105);
    hudCtx.font = '20px "Segoe UI", sans-serif';
    hudCtx.fillText(` = ${tCutoff.toFixed(1)} K`, 72, 95);

    // Variable: tau
    hudCtx.font = 'bold 22px "Times New Roman", serif';
    hudCtx.fillStyle = '#58a6ff';
    hudCtx.fillText('τ', 20, 130);
    hudCtx.font = '20px "Segoe UI", sans-serif';
    hudCtx.fillText(` = ${tauText}`, 38, 130);

    hudTex.needsUpdate = true;
}

// ==========================================
// HUD WATERMARK WITH LAVINA BRANDING & LOGO
// ==========================================
const WM_WIDTH = 340;
const WM_HEIGHT = 90;

const wmCanvas = document.createElement('canvas');
wmCanvas.width = WM_WIDTH;
wmCanvas.height = WM_HEIGHT;
const wmCtx = wmCanvas.getContext('2d');

const wmTex = new THREE.CanvasTexture(wmCanvas);
const wmMat = new THREE.SpriteMaterial({ map: wmTex, transparent: true, opacity: 0.95 });
const wmSprite = new THREE.Sprite(wmMat);
wmSprite.scale.set(WM_WIDTH, WM_HEIGHT, 1);

wmSprite.position.set(container.clientWidth / 2 - WM_WIDTH / 2 - 15, container.clientHeight / 2 - WM_HEIGHT / 2 - 15, 0);
hudScene.add(wmSprite);

const logoImg = new Image();
logoImg.src = 'logo-lavina-nome.jpg';

function drawWatermark() {
    wmCtx.clearRect(0, 0, WM_WIDTH, WM_HEIGHT);

    if (logoImg.complete && logoImg.naturalWidth !== 0) {
        wmCtx.drawImage(logoImg, WM_WIDTH - 330, 10, 70, 70);
    }

    wmCtx.textAlign = 'right';
    wmCtx.textBaseline = 'top';

    wmCtx.fillStyle = '#ffffff';
    wmCtx.font = '800 32px "Segoe UI", sans-serif';
    wmCtx.fillText('LAVINA', WM_WIDTH - 10, 12);

    wmCtx.fillStyle = '#58a6ff';
    wmCtx.font = '700 14px "Segoe UI", sans-serif';
    wmCtx.fillText('IFGW • UNICAMP', WM_WIDTH - 10, 52);

    wmTex.needsUpdate = true;
}

drawWatermark();
logoImg.onload = () => {
    drawWatermark();
};

// ==========================================
// MOUSE DRAG HANDLERS FOR HUD CARD
// ==========================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isDraggingHUD = false;
const dragOffset = new THREE.Vector3();

function getCanvasHUDCoords(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hudX = x - container.clientWidth / 2;
    const hudY = -(y - container.clientHeight / 2);
    return new THREE.Vector3(hudX, hudY, 0);
}

renderer.domElement.addEventListener('pointerdown', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, hudCamera);
    const intersects = raycaster.intersectObject(hudSprite);

    if (intersects.length > 0) {
        isDraggingHUD = true;
        controls.enabled = false;
        const clickWorldPos = getCanvasHUDCoords(e);
        dragOffset.subVectors(hudSprite.position, clickWorldPos);
    }
});

renderer.domElement.addEventListener('pointermove', (e) => {
    if (!isDraggingHUD) return;

    const mouseHUDPos = getCanvasHUDCoords(e);
    const newPos = mouseHUDPos.add(dragOffset);

    const minX = -container.clientWidth / 2 + HUD_WIDTH / 2;
    const maxX = container.clientWidth / 2 - HUD_WIDTH / 2;
    const minY = -container.clientHeight / 2 + HUD_HEIGHT / 2;
    const maxY = container.clientHeight / 2 - HUD_HEIGHT / 2;

    hudSprite.position.x = Math.max(minX, Math.min(maxX, newPos.x));
    hudSprite.position.y = Math.max(minY, Math.min(maxY, newPos.y));
});

window.addEventListener('pointerup', () => {
    if (isDraggingHUD) {
        isDraggingHUD = false;
        controls.enabled = true;
    }
});

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
        eqText = "$$\\tau = \\tau_0 \\left( \\frac{T + T^*}{T - T_{cutoff}} \\right)^{\\frac{3-q}{2(1-q)}}$$";
    } else if (q > 1.0) {
        const base = (currentT - T_star) / (currentT + T_cutoff);
        if (base <= 0) {
            tau = 0;
        } else {
            const exponent = (3 - q) / (2 * (1 - q));
            tau = TAU_0 * Math.pow(base, exponent);
        }
        eqText = "$$\\tau = \\tau_0 \\left( \\frac{T - T^*}{T + T_{cutoff}} \\right)^{\\frac{3-q}{2(1-q)}}$$";
    }

    currentTau = tau;

    let tauHTMLDisplay = "";
    let plainTauText = "";

    if (tau === Infinity) {
        tauHTMLDisplay = "∞ <span style='font-size:11px; color:#e3b341;'>(Frozen / Spin-Glass)</span>";
        plainTauText = "∞ (Frozen)";
    } else if (tau === 0) {
        tauHTMLDisplay = "0 s";
        plainTauText = "0 s";
    } else {
        const [baseStr, exponentStr] = tau.toExponential(2).split('e');
        const expVal = parseInt(exponentStr, 10);
        tauHTMLDisplay = `${baseStr} &times; 10<sup>${expVal}</sup> s`;
        plainTauText = `${baseStr} × 10${toSuperscript(expVal)} s`;
    }

    // Direct DOM Updates for Sidebar Panel
    const qLabelEl = document.getElementById('qLabel');
    const tauLabelEl = document.getElementById('tauLabel');
    const tLabelEl = document.getElementById('tLabel');
    const tCutoffLabelEl = document.getElementById('tCutoffLabel');

    if (qLabelEl) qLabelEl.innerText = q.toFixed(2);
    if (tauLabelEl) tauLabelEl.innerHTML = tauHTMLDisplay;
    if (tLabelEl) tLabelEl.innerText = `T = ${currentT} K`;
    if (tCutoffLabelEl) tCutoffLabelEl.innerText = T_cutoff.toFixed(1) + " K";

    const eqDiv = document.getElementById('equationDisplay');
    if (eqDiv) {
        eqDiv.innerHTML = eqText;
        if (window.MathJax && window.MathJax.typesetPromise) {
            MathJax.typesetPromise([eqDiv]);
        }
    }

    // Update Floating Canvas HUD Card
    updateHUD(q, currentT, T_cutoff, plainTauText);
}

// Select Change Event
const estadosSelect = document.getElementById('estadosSelect');
const tempSlider = document.getElementById('tempSlider');
const tempLockNote = document.getElementById('tempLockNote');

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

    if (qVal <= 1.0) {
        tempSlider.disabled = false;
        tempLockNote.style.display = 'none';
    } else {
        tempSlider.disabled = true;
        currentT = 150;
        tempSlider.value = 150;
        document.getElementById('tSliderVal').innerText = 150;
        tempLockNote.style.display = 'block';
    }

    qmSprite.visible = qVal > 1.0;
    opaqueVolumeMesh.visible = qVal > 1.0;

    updatePhysics(qVal, currentT);
});

// Temperature Slider Listener
tempSlider.addEventListener('input', (e) => {
    currentT = parseInt(e.target.value, 10);
    document.getElementById('tSliderVal').innerText = currentT;
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

    wmSprite.position.set(width / 2 - WM_WIDTH / 2 - 15, height / 2 - WM_HEIGHT / 2 - 15, 0);
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

        recordBtn.innerText = 'Record';
        recordBtn.classList.remove('recording');
        recordBtn.disabled = false;
    };

    mediaRecorder.start();

    let elapsedSeconds = 0;
    recordBtn.classList.add('recording');
    recordBtn.disabled = true;

    const updateTimerText = () => {
        recordBtn.innerText = `Recording... (${elapsedSeconds}s / ${durationSec}s)`;
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
// DEFAULT RESET ON PAGE LOAD / REFRESH
// ==========================================
function resetToDefaults() {
    currentT = 150;
    currentTau = Infinity;
    currentQ = 1.0;

    if (estadosSelect) {
        estadosSelect.value = "0";
        document.getElementById("opt0").disabled = false;
    }

    if (tempSlider) {
        tempSlider.value = 150;
        tempSlider.disabled = true;
    }

    const tSliderVal = document.getElementById('tSliderVal');
    if (tSliderVal) tSliderVal.innerText = 150;

    const tempLockNote = document.getElementById('tempLockNote');
    if (tempLockNote) {
        tempLockNote.style.display = 'block';
        tempLockNote.innerText = 'Select a q parameter to enable temperature adjustments';
    }

    if (PARTICLES.length > 0) {
        removeParticles(PARTICLES.length);
    }
    generateParticle();

    if (typeof qmSprite !== 'undefined') qmSprite.visible = false;
    if (typeof opaqueVolumeMesh !== 'undefined') opaqueVolumeMesh.visible = false;

    const qLabel = document.getElementById('qLabel');
    const tauLabel = document.getElementById('tauLabel');
    const tLabel = document.getElementById('tLabel');
    const tCutoffLabel = document.getElementById('tCutoffLabel');
    const eqDiv = document.getElementById('equationDisplay');

    if (qLabel) qLabel.innerText = "1.00";
    if (tauLabel) tauLabel.innerHTML = "0.00 s";
    if (tLabel) tLabel.innerText = "T = 150 K";
    if (tCutoffLabel) tCutoffLabel.innerText = "0.0 K";
    if (eqDiv) eqDiv.innerHTML = '<span id="eqPlaceholder">Select q-parameter</span>';

    updateHUD(1.0, 150, 0, "Select q");
}

document.addEventListener('DOMContentLoaded', resetToDefaults);
window.onbeforeunload = () => {
    resetToDefaults();
};

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