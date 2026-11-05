// ==========================================
// PHYSICS & SIMULATION CONSTANTS
// ==========================================
const DELTA_V_KB = 450;
const TAU_0 = 1e-11;

let currentT = 150;
let currentTau = Infinity;
let currentQ = 1.0;

const T_CUTOFF_CURVES = {
    0.7: [{ T: 100, Tc: 104 }, { T: 125, Tc: 93 }, { T: 150, Tc: 90 }, { T: 175, Tc: 87 }, { T: 200, Tc: 84 }, { T: 250, Tc: 81 }],
    0.8: [{ T: 75,  Tc: 80 },  { T: 100, Tc: 74 }, { T: 125, Tc: 68 }, { T: 150, Tc: 64 }, { T: 200, Tc: 60 }, { T: 250, Tc: 57 }],
    0.9: [{ T: 50,  Tc: 46 },  { T: 100, Tc: 40 }, { T: 150, Tc: 34 }, { T: 200, Tc: 31 }, { T: 250, Tc: 29 }],
    // Placeholder data for q > 1 (Update Tc values with exact numbers from your research)
    1.1: [{ T: 50, Tc: 20 },   { T: 100, Tc: 18 }, { T: 150, Tc: 16 }, { T: 200, Tc: 14 }, { T: 250, Tc: 12 }],
    1.3: [{ T: 50, Tc: 10 },   { T: 100, Tc: 8 },  { T: 150, Tc: 6 },  { T: 200, Tc: 4 },  { T: 250, Tc: 2 }]
};

const T_STAR_CURVES = {
    0.7: [{ T: 50, Ts: 10 }, { T: 100, Ts: 18 }, { T: 150, Ts: 32 }, { T: 200, Ts: 40 }, { T: 250, Ts: 47 }],
    0.8: [{ T: 75, Ts: 12 }, { T: 100, Ts: 15 }, { T: 150, Ts: 25 }, { T: 200, Ts: 30 }, { T: 250, Ts: 36 }],
    0.9: [{ T: 50, Ts: 4 },  { T: 100, Ts: 10 }, { T: 150, Ts: 15 }, { T: 200, Ts: 18 }, { T: 250, Ts: 21 }],
    // Placeholder data for q > 1 (Update Ts values with exact numbers from your research)
    1.1: [{ T: 50, Ts: 8 },  { T: 100, Ts: 12 }, { T: 150, Ts: 18 }, { T: 200, Ts: 22 }, { T: 250, Ts: 26 }],
    1.3: [{ T: 50, Ts: 15 }, { T: 100, Ts: 20 }, { T: 150, Ts: 28 }, { T: 200, Ts: 35 }, { T: 250, Ts: 42 }]
};

function calculateTStar(q, tVal) {
    if (q === 1.0 || !T_STAR_CURVES[q]) return 0;
    const curve = T_STAR_CURVES[q];
    
    if (tVal <= curve[0].T) return curve[0].Ts;
    if (tVal >= curve[curve.length - 1].T) return curve[curve.length - 1].Ts;
    
    for (let i = 0; i < curve.length - 1; i++) {
        if (tVal >= curve[i].T && tVal <= curve[i + 1].T) {
            const slope = (curve[i + 1].Ts - curve[i].Ts) / (curve[i + 1].T - curve[i].T);
            return curve[i].Ts + slope * (tVal - curve[i].T);
        }
    }
    return 0;
}

function calculateTCutoff(q, tVal) {
    // Fixed: Now only returns 0 if q is exactly 1.0, or if curve data is missing
    if (q === 1.0 || !T_CUTOFF_CURVES[q]) return 0;
    const curve = T_CUTOFF_CURVES[q];

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
// Adjusted initial camera angle and distance
camera.position.set(45, 10, 105);

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

// Particle Geometries and Materials (Toned down brightness)
const SPHERE_RADIUS = 5;
const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 32, 32);
const sphereMat = new THREE.MeshStandardMaterial({
    color: 0x58a6ff,
    roughness: 0.35,
    metalness: 0.2,
    emissive: 0x0d2847,
    emissiveIntensity: 0.25
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

let HUD_WIDTH = 180;
let HUD_HEIGHT = 180;
let lastTauText = "Select q"; // Remembers the tau value during resizes

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

    // Calculate how much the box has scaled compared to the base 300x180 size
    // Using Math.min ensures the text doesn't stretch weirdly if only one side is dragged
    const scale = Math.min(HUD_WIDTH / 180, HUD_HEIGHT / 180);

    // Draw background card (fills the full new width/height)
    hudCtx.fillStyle = 'rgba(13, 17, 23, 0.90)';
    hudCtx.beginPath();
    if (hudCtx.roundRect) hudCtx.roundRect(0, 0, HUD_WIDTH, HUD_HEIGHT, 10);
    else hudCtx.rect(0, 0, HUD_WIDTH, HUD_HEIGHT);
    hudCtx.fill();
    hudCtx.strokeStyle = '#58a6ff';
    hudCtx.lineWidth = 3 * scale;
    hudCtx.stroke();

    // Center the top drag handle dynamically and scale its size
    hudCtx.fillStyle = '#30363d';
    hudCtx.fillRect((HUD_WIDTH / 2) - (30 * scale), 8 * scale, 60 * scale, 4 * scale);

    hudCtx.textAlign = 'left';
    hudCtx.textBaseline = 'top';

    // Helper function to easily apply the scale to font sizes
    const getFont = (size, family, style = '') => `${style} ${size * scale}px ${family}`.trim();

    // Variable: q
    hudCtx.font = getFont(20, '"Times New Roman", serif', 'italic bold');
    hudCtx.fillStyle = '#ffffff';
    hudCtx.fillText('q', 20 * scale, 25 * scale);
    hudCtx.font = getFont(20, '"Segoe UI", sans-serif');
    hudCtx.fillText(` = ${qVal.toFixed(2)}`, 35 * scale, 25 * scale);

    // Variable: T
    hudCtx.font = getFont(20, '"Times New Roman", serif', 'italic bold');
    hudCtx.fillText('T', 20 * scale, 60 * scale);
    hudCtx.font = getFont(20, '"Segoe UI", sans-serif');
    hudCtx.fillText(` = ${tVal} K`, 38 * scale, 60 * scale);

    // Variable: T_cutoff
    hudCtx.font = getFont(20, '"Times New Roman", serif', 'italic bold');
    hudCtx.fillText('T', 20 * scale, 95 * scale);
    hudCtx.font = getFont(13, '"Segoe UI", sans-serif');
    hudCtx.fillText('cutoff', 34 * scale, 105 * scale);
    hudCtx.font = getFont(20, '"Segoe UI", sans-serif');
    hudCtx.fillText(` = ${tCutoff.toFixed(1)} K`, 72 * scale, 95 * scale);

    // Variable: tau
    hudCtx.font = getFont(22, '"Times New Roman", serif', 'bold');
    hudCtx.fillStyle = '#58a6ff';
    hudCtx.fillText('τ', 20 * scale, 130 * scale);
    hudCtx.font = getFont(20, '"Segoe UI", sans-serif');
    hudCtx.fillText(` = ${tauText}`, 38 * scale, 130 * scale);

    // Draw the resize handle (diagonal lines firmly in the bottom right corner)
    hudCtx.strokeStyle = '#58a6ff';
    hudCtx.lineWidth = 2 * scale;
    hudCtx.beginPath();
    hudCtx.moveTo(HUD_WIDTH - (12 * scale), HUD_HEIGHT - (4 * scale));
    hudCtx.lineTo(HUD_WIDTH - (4 * scale), HUD_HEIGHT - (12 * scale));
    hudCtx.moveTo(HUD_WIDTH - (18 * scale), HUD_HEIGHT - (4 * scale));
    hudCtx.lineTo(HUD_WIDTH - (4 * scale), HUD_HEIGHT - (18 * scale));
    hudCtx.stroke();

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

let hudScale = 1.0;

function updateOverlayLayout() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    hudScale = Math.min(1, width / 700);

    // 1. Watermark: Strictly pinned to Top-Right
    const scaledWmWidth = WM_WIDTH * hudScale;
    const scaledWmHeight = WM_HEIGHT * hudScale;
    wmSprite.scale.set(scaledWmWidth, scaledWmHeight, 1);
    wmSprite.position.set(
        (width / 2) - (scaledWmWidth / 2) - 15,   // 15px from Right
        (height / 2) - (scaledWmHeight / 2) - 15, // 15px from Top
        0
    );

    // 2. HUD Box: Strictly pinned to Top-Left
    const scaledHudWidth = HUD_WIDTH * hudScale;
    const scaledHudHeight = HUD_HEIGHT * hudScale;
    hudSprite.scale.set(scaledHudWidth, scaledHudHeight, 1);
    
    // Calculate strict 20px padding from the top-left corner
    const topLeftX = (-width / 2) + (scaledHudWidth / 2) + 20;
    const topLeftY = (height / 2) - (scaledHudHeight / 2) - 20;
    
    hudSprite.position.set(topLeftX, topLeftY, 0);

    // 3. Mouse Instructions: Pinned to Bottom-Left
    const controlsHint = document.querySelector('.controls-hint');
    if (controlsHint) {
        controlsHint.style.transform = `scale(${hudScale})`;
        controlsHint.style.transformOrigin = 'bottom left'; 
    }
}

// Apply the initial layout size right away
updateOverlayLayout();

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

// Variables for dragging and resizing
let isResizingHUD = false;

let startResizeWidth = 0;
let startResizeHeight = 0;
let startMouseX = 0;
let startMouseY = 0;
let dragStartTopLeftX = 0;
let dragStartTopLeftY = 0;
const MIN_HUD_WIDTH = 180;
const MIN_HUD_HEIGHT = 150;

renderer.domElement.addEventListener('pointerdown', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, hudCamera);
    const intersects = raycaster.intersectObject(hudSprite);

    if (intersects.length > 0) {
        controls.enabled = false;
        
        // Check if the click is in the bottom-right corner (uv.x > 0.85 & uv.y < 0.15)
        const uv = intersects[0].uv; 
        
        if (uv.x > 0.85 && uv.y < 0.15) {
            // Trigger Resize Mode
            isResizingHUD = true;
            startResizeWidth = HUD_WIDTH;
            startResizeHeight = HUD_HEIGHT;
            startMouseX = e.clientX;
            startMouseY = e.clientY;
            
            // Save the exact top-left point so it scales cleanly outward from it
            dragStartTopLeftX = hudSprite.position.x - (HUD_WIDTH * hudScale / 2);
            dragStartTopLeftY = hudSprite.position.y + (HUD_HEIGHT * hudScale / 2);
        } else {
            // Standard Drag Mode
            isDraggingHUD = true;
            const clickWorldPos = getCanvasHUDCoords(e);
            dragOffset.subVectors(hudSprite.position, clickWorldPos);
        }
    }
});

renderer.domElement.addEventListener('pointermove', (e) => {
    if (isResizingHUD) {
        // Calculate mouse movement, adjusted for scale
        const deltaX = (e.clientX - startMouseX) / hudScale;
        const deltaY = (e.clientY - startMouseY) / hudScale;

        // Apply new dimensions with a minimum limit
        HUD_WIDTH = Math.max(MIN_HUD_WIDTH, startResizeWidth + deltaX);
        HUD_HEIGHT = Math.max(MIN_HUD_HEIGHT, startResizeHeight + deltaY);

        // Update actual canvas and redraw
        hudCanvas.width = HUD_WIDTH;
        hudCanvas.height = HUD_HEIGHT;
        const tCutoff = calculateTCutoff(currentQ, currentT);
        updateHUD(currentQ, currentT, tCutoff, lastTauText);

        // Apply scale and anchor firmly to its original top-left corner
        hudSprite.scale.set(HUD_WIDTH * hudScale, HUD_HEIGHT * hudScale, 1);
        hudSprite.position.x = dragStartTopLeftX + (HUD_WIDTH * hudScale / 2);
        hudSprite.position.y = dragStartTopLeftY - (HUD_HEIGHT * hudScale / 2);
        return;
    }

    if (!isDraggingHUD) return;

    // Standard Drag Logic
    const mouseHUDPos = getCanvasHUDCoords(e);
    const newPos = mouseHUDPos.add(dragOffset);

    const scaledHudWidth = HUD_WIDTH * hudScale;
    const scaledHudHeight = HUD_HEIGHT * hudScale;

    const minX = -container.clientWidth / 2 + scaledHudWidth / 2;
    const maxX = container.clientWidth / 2 - scaledHudWidth / 2;
    const minY = -container.clientHeight / 2 + scaledHudHeight / 2;
    const maxY = container.clientHeight / 2 - scaledHudHeight / 2;

    const clampedX = Math.max(minX, Math.min(maxX, newPos.x));
    const clampedY = Math.max(minY, Math.min(maxY, newPos.y));
    
    hudSprite.position.set(clampedX, clampedY, 0);
});

window.addEventListener('pointerup', () => {
    if (isDraggingHUD || isResizingHUD) {
        isDraggingHUD = false;
        isResizingHUD = false;
        controls.enabled = true;
    }
});

// ==========================================
// FLIP AND ROTATION LOGIC
// ==========================================
const FLIP_SPEED = 0.4;

function updateParticleState(p) {
    if (currentTau !== Infinity && currentTau > 0) {
        let baseProbability = 0;

        // 1. MANUALLY FORCED VISUAL TIERS FOR PRESENTATION
        if (currentQ >= 1.1) {
            baseProbability = 0.15; 
        } else if (currentQ === 1.0) {
            baseProbability = 0.05; 
        } else if (currentQ === 0.9) {
            baseProbability = 0.01; 
        } else if (currentQ === 0.8) {
            baseProbability = 0.002; 
        } else if (currentQ <= 0.7) {
            baseProbability = 0.0003; 
        }

        // 2. APPLY TEMPERATURE SCALING
        // Centers at 150K (multiplier = 1.0). 
        // Exponentially scales up as it gets hotter, slows down as it gets colder.
        const tempModifier = Math.exp((currentT - 150) / 25);
        
        let flipProbability = baseProbability * tempModifier;

        // Cap the absolute max chance per frame so the fastest states don't visually break at 200K
        flipProbability = Math.min(0.35, flipProbability);

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
        // The system still strictly obeys the T_cutoff freeze physics
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
    let T_star = calculateTStar(q, tVal);

    

    currentQ = q;
    currentT = tVal;
    const T_cutoff = calculateTCutoff(q, currentT);
    let tau = 0;
    let eqText = "";

    if (q === 1.0) {
        // Normal Diffusion (Baseline)
        tau = TAU_0 * Math.exp(DELTA_V_KB / currentT);
        eqText = "$$\\tau = \\tau_0 \\exp\\left(\\frac{\\Delta V}{k_B T}\\right)$$";
        
    } else if (q < 1.0) {
        // SUBDIFFUSIVE (q < 1): Always strictly larger than q=1
        if (currentT <= T_cutoff) {
            tau = Infinity; // System freezes completely
        } else {
            const base = (currentT + T_star) / (currentT - T_cutoff);
            const exponent = (3 - q) / (2 * (1 - q));
            tau = TAU_0 * Math.pow(base, exponent);
        }
        eqText = "$$\\tau = \\tau_0 \\left( \\frac{T + T^*}{T - T_{cutoff}} \\right)^{\\frac{3-q}{2(1-q)}}$$";
        
    } else if (q > 1.0) {
        // SUPERDIFFUSIVE (q > 1): Always strictly smaller than q=1
        const base = (currentT - T_star) / (currentT + T_cutoff);
        
        if (base <= 0) {
            tau = 0; // Instantaneous relaxation
        } else {
            const exponent = (3 - q) / (2 * (1 - q)); 
            tau = TAU_0 * Math.pow(base, exponent);
        }
        eqText = "$$\\tau = \\tau_0 \\left( \\frac{T - T^*}{T + T_{cutoff}} \\right)^{\\frac{3-q}{2(1-q)}}$$";
    }

    currentTau = tau;

    let tauText = "";

    if (tau === Infinity) {
        tauText = "∞ (Frozen)";
    } else if (tau === 0) {
        tauText = "0 s";
    } else if (tau < 1e-12) {
        tauText = (tau * 1e15).toFixed(2) + " fs";
    } else if (tau < 1e-9) {
        tauText = (tau * 1e12).toFixed(2) + " ps";
    } else if (tau < 1e-6) {
        tauText = (tau * 1e9).toFixed(2) + " ns";
    } else if (tau < 1e-3) {
        tauText = (tau * 1e6).toFixed(2) + " µs";
    } else if (tau < 1) {
        tauText = (tau * 1e3).toFixed(2) + " ms";
    } else {
        tauText = tau.toFixed(2) + " s";
    }

    // Direct DOM Updates for Sidebar Panel
    const qLabelEl = document.getElementById('qLabel');
    const tauLabelEl = document.getElementById('tauLabel');
    const tLabelEl = document.getElementById('tLabel');
    const tCutoffLabelEl = document.getElementById('tCutoffLabel');
    const eqDiv = document.getElementById('equationDisplay'); // Add equation div

    if (qLabelEl) qLabelEl.innerText = q.toFixed(2);
    if (tauLabelEl) tauLabelEl.innerText = tauText;
    if (tLabelEl) tLabelEl.innerText = `${tVal} K`;
    if (tCutoffLabelEl) tCutoffLabelEl.innerText = T_cutoff.toFixed(1) + " K";
    
    // Inject the equation text and re-render MathJax
    if (eqDiv && eqText !== "") {
        eqDiv.innerHTML = eqText;
        if (window.MathJax && window.MathJax.typesetPromise) {
            MathJax.typesetPromise([eqDiv]).catch((err) => console.error(err.message));
        }
    }
// Save the text so the resize function can redraw it smoothly
    lastTauText = tauText; 
    
    // Update Floating Canvas HUD Card
    updateHUD(q, currentT, T_cutoff, tauText);
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
    // Get the exact new dimensions of the container
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Update Main 3D Camera
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // 2. Update Renderer
    renderer.setSize(width, height);

    // 3. Update HUD Camera boundaries (Crucial for the resize math to work!)
    hudCamera.left = -width / 2;
    hudCamera.right = width / 2;
    hudCamera.top = height / 2;
    hudCamera.bottom = -height / 2;
    hudCamera.updateProjectionMatrix();

    // 4. Re-apply the layout math now that the camera matches the screen
    updateOverlayLayout();
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

    // Reset camera position to new isometric view
    camera.position.set(45, 10, 105);
    controls.reset();

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
    if (tauLabel) tauLabel.innerText = "0.00 s";
    if (tLabel) tLabel.innerText = "150 K";
    if (tCutoffLabel) tCutoffLabel.innerText = "0.0 K";
    if (eqDiv) eqDiv.innerHTML = '';

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