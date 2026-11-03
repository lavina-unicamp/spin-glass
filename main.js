// ==========================================
// PHYSICS & SIMULATION CONSTANTS
// ==========================================
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
    qmCtx.fillText('Unknown Spatial Configuration', 512, 170);

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

    // Dynamic slider locking logic
    if (qVal < 1.0) {
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