// Function to toggle light helpers visibility
function toggleLightHelpers() {
  if (lightHelpers.length === 0) {
    console.log("No light helpers to toggle");
    return;
  }
  
  // Toggle visibility of all helpers
  let currentState = null;
  
  // Get current state from first helper
  if (lightHelpers[0]) {
    currentState = lightHelpers[0].visible;
  }
  
  // Toggle to opposite state
  const newState = (currentState === null) ? true : !currentState;
  
  lightHelpers.forEach(helper => {
    helper.visible = newState;
  });
  
  console.log(`Light helpers ${newState ? 'shown' : 'hidden'}`);
}import '../style.css'
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ColorManagement, SRGBColorSpace, ACESFilmicToneMapping } from 'three';

// Global variables and state
let scene, camera, renderer;
let player, navmesh;
let audioContext, audioSource, gainNode;
let audioBuffer, audioIsPlaying = false;
let audioInitialized = false;
let pointLights = [];
let hues = [];
let particleSystem;
let analyser, audioDataArray;
let fluffyTrees = [];
let lastTime = 0;
let windMaterials = [];
let flowerParts = [];
let interactiveModels = []; // Store interactive models
let raycaster; // For detecting clicks on models
let lightHelpers = []; // Store light helpers

// Performance optimization: Create reusable vectors outside functions
const cameraDirection = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
const oldPosition = new THREE.Vector3();
const velocity = new THREE.Vector3();
const mouse = new THREE.Vector2(); // For interactive model clicking
let verticalVelocity = 0;

// Debug flag for development
const DEBUG = false;

// Constants
const playerHeight = 1.9;
const playerRadius = 0.25;
const moveSpeed = 0.1;
const gravity = 0.01;
const jumpForce = 0.25;
let isOnGround = false;

// Detect if on mobile device
const isMobile = /Mobi|Android/i.test(navigator.userAgent);

// Object to store loaded models
let models = {};

// For wind animation
const windSettings = {
  strength: 0.1,
  speed: 1.5,
  chaos: 0.2,
  maxAngle: 0.15,
};

// Player movement state
const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  shift: false,
};

// Mouse and touch controls
let mouseEnabled = false;
let mouseX = 0, mouseY = 0;
let playerDirection = new THREE.Vector3(0, 0, -1);
let euler = new THREE.Euler(0, Math.PI / 2, 0, "YXZ");

// Shader definitions
const foliageVertexShader = `
uniform float u_windTime;
uniform float u_effectBlend;
uniform float u_scale;

void main() {
  // Get camera-facing direction
  vec3 cameraDir = normalize(cameraPosition - position);
  
  // Create billboarding effect
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), cameraDir));
  vec3 up = cross(cameraDir, right);
  
  // Offset based on UV
  vec2 offset = (uv - 0.5) * 2.0 * u_scale;
  
  // Add wind animation
  float wind = sin(u_windTime + position.x + position.z) * 0.1;
  
  // Transform position
  vec4 finalPosition = modelViewMatrix * vec4(position, 1.0);
  
  // Apply billboarding and wind with blend factor
  finalPosition.xyz += (right * offset.x + up * offset.y) * u_effectBlend;
  finalPosition.x += wind * u_effectBlend;
  
  // Project to clip space
  gl_Position = projectionMatrix * finalPosition;
}
`;

// Wait for everything to load
window.addEventListener("load", init);

// Function to load fluffy trees
async function loadFluffyTrees() {
  console.log("========================");
  console.log("LOADING IMPROVED FLUFFY TREES");
  console.log("========================");
  
  // Clear any existing fluffy trees
  fluffyTrees = [];
  
  const treePositions = [
    //Row 1
    { pos: [39.26, 1.76, -24.72], scale: [1, 1, 1], rotation: [0, Math.PI / 2, 0], },
    { pos: [48.63, 1.56, -18.37], scale: [0.8, 0.8, 0.8], rotation: [0, Math.PI / 2, 0],  },
    { pos: [52, 1.46, -5.5], scale: [1.6, 1.6, 1.6], rotation: [0, Math.PI / 2, 0],  },
    { pos: [51.36, 1.32, 4.56], scale: [0.8, 0.8, 0.8], rotation: [0, Math.PI / 2, 0],  },
    { pos: [41.87, 1.25, 18], scale: [1.8, 1.8, 1.8], rotation: [0, Math.PI / 2, 0],  },
    
    //Row 2
    { pos: [63.62, 4, -33.36], scale: [1.2, 1.2, 1.2], rotation: [0, Math.PI / 2, 0],  },
    { pos: [67.23, 2, -18.13], scale: [1.1, 1.1, 1.1], rotation: [0, Math.PI / 2, 0],  },
    { pos: [67.21, 3.14, -9], scale: [1.4, 1.4, 1.4], rotation: [0, Math.PI / 2, 0],  },
    { pos: [66.54, 3.42, 4], scale: [1.6, 1.6, 1.6], rotation: [0, Math.PI / 2, 0],  },
    { pos: [65.71, 3, 17.13], scale: [1.4, 1.4, 1.4], rotation: [0, Math.PI / 2, 0],  },
    { pos: [67.2, 3.46, 34.18], scale: [1.8, 1.8, 1.8], rotation: [0, Math.PI / 2, 0],  }
  ];
  
  try {
    // Import the improved tree class
    const module = await import('./tree/ImprovedFluffyTree.js');
    const ImprovedFluffyTree = module.ImprovedFluffyTree;
    
    // Load each tree
    const treePromises = treePositions.map(async (treeData) => {
      try {
        const tree = new ImprovedFluffyTree();
        const treeGroup = await tree.load(
          '/assets/models/tree.glb',           // Model path
          '/assets/textures/foliage_alpha3.png', // Alpha texture 
          treeData.pos,
          treeData.scale,
          treeData.rotation
        );
        
        scene.add(treeGroup);
        fluffyTrees.push(tree);
        if (DEBUG) console.log('Improved fluffy tree added at', treeData.pos);
        return tree;
      } catch (error) {
        console.error('Failed to load fluffy tree:', error);
        return null;
      }
    });
    
    const trees = await Promise.all(treePromises);
    console.log(`Successfully loaded ${trees.filter(Boolean).length} fluffy trees`);
    return trees.filter(Boolean);
  } catch (error) {
    console.error("Failed to import ImprovedFluffyTree module:", error);
    return [];
  }
}

// Define artworks with their URLs
const artworks = [
  {
    name: "artwork01",
    url: "assets/models/artwork01.glb",
    position: new THREE.Vector3(-20, 5.5, -33.2), // Positioned near one of your point lights for visibility
    scale: new THREE.Vector3(1, 1, 1),
    rotation: new THREE.Euler(0, 0, 0),
    linkUrl: "https://example.com/artwork1", // URL to open when clicked
  }
  // Add more artworks as needed following the same structure
];

// Main initialization function
function init() {
  // Initialize audio system
  setupAudio();

  // Audio control elements
  const playPauseButton = document.getElementById("play-pause");
  const volumeSlider = document.getElementById("volume-slider");
  const volumeLabel = document.getElementById("volume-label");

  // Add event listeners for audio controls
  playPauseButton.addEventListener("click", toggleAudio);
  volumeSlider.addEventListener("input", updateVolume);

  // Initialize raycaster for interactive models
  raycaster = new THREE.Raycaster();

  // Add event listener for model clicks
  window.addEventListener('click', onModelClick);
  window.addEventListener('mousemove', onMouseMove);
  
  // Create a debug info element
  if (DEBUG) {
    const debugElement = document.createElement('div');
    debugElement.id = 'debug-info';
    debugElement.style.position = 'absolute';
    debugElement.style.top = '10px';
    debugElement.style.left = '10px';
    debugElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    debugElement.style.color = 'white';
    debugElement.style.padding = '10px';
    debugElement.style.borderRadius = '5px';
    debugElement.style.fontFamily = 'monospace';
    debugElement.style.zIndex = '1000';
    document.body.appendChild(debugElement);
  }

  // Start the application
  start();
}

// Setup audio system
function setupAudio() {
  // Use click (or touch) anywhere to initialize audio (browser requirement)
  window.addEventListener("touchstart", initializeAudioContext, { once: true });
  window.addEventListener("click", initializeAudioContext, { once: true });
  
  // Pre-load the audio file
  const audioUrl = "assets/audio/IliaqueNebula.mp3";
  console.log("Preloading audio from:", audioUrl);
  fetch(audioUrl)
    .then((response) => response.arrayBuffer())
    .then((arrayBuffer) => {
      audioBuffer = arrayBuffer;
      console.log("Audio file preloaded");
    })
    .catch((error) => {
      console.error("Error loading audio file:", error);
    });
}

function initializeAudioContext() {
  if (audioInitialized) return;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioContext.createGain();
    const volumeSlider = document.getElementById("volume-slider");
    gainNode.gain.value = volumeSlider.value / 100;
    gainNode.connect(audioContext.destination);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256; // Smaller = faster but less detailed
    const bufferLength = analyser.frequencyBinCount;
    audioDataArray = new Uint8Array(bufferLength);

    // Connect analyser to the audio chain
    gainNode.connect(analyser);
    analyser.connect(audioContext.destination);

    if (audioBuffer) {
      audioContext.decodeAudioData(audioBuffer)
        .then((decodedData) => {
          audioBuffer = decodedData;
          console.log("Audio ready to play");
        })
        .catch((err) => console.error("Error decoding audio data", err));
    }
    audioInitialized = true;
    console.log("Audio context initialized");
  } catch (e) {
    console.error("Web Audio API not supported in this browser:", e);
  }
}

function toggleAudio() {
  if (!audioInitialized || !audioBuffer) {
    console.log("Audio not yet initialized or loaded");
    return;
  }
  if (audioIsPlaying) {
    if (audioSource) {
      audioSource.stop();
      audioSource = null;
    }
    audioIsPlaying = false;
    document.getElementById("play-pause").textContent = "Play Music";
  } else {
    audioSource = audioContext.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.loop = true;
    audioSource.connect(gainNode);
    audioSource.start(0);
    audioIsPlaying = true;
    document.getElementById("play-pause").textContent = "Pause Music";
  }
}

function updateVolume() {
  const volumeSlider = document.getElementById("volume-slider");
  const volumeLabel = document.getElementById("volume-label");
  const volumeValue = volumeSlider.value;
  volumeLabel.textContent = `Volume: ${volumeValue}%`;
  if (gainNode) {
    gainNode.gain.value = volumeValue / 100;
  }
}

// Setup the scene
function setupScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.y = playerHeight;
  camera.rotation.copy(euler);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = .2;
  renderer.outputColorSpace = SRGBColorSpace;
  ColorManagement.enabled = true;
  document.body.appendChild(renderer.domElement);

  addLighting();
  loadEnvironmentMap();
  addParticles();

  // Handle window resize
  window.addEventListener("resize", onWindowResize);
}

function addLighting() {
  // Clear any existing light helpers
  lightHelpers.forEach(helper => {
    if (helper.parent) {
      helper.parent.remove(helper);
    }
  });
  lightHelpers = [];
  
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xf7c6a1, 0.5);
  scene.add(ambientLight);

  // Directional light
  const directionalLight = new THREE.DirectionalLight(0xa1cff7, 10);
  directionalLight.position.set(0, 10, 0);
  scene.add(directionalLight);
  
  // Add directional light helper
  const directionalHelper = new THREE.DirectionalLightHelper(directionalLight, 5);
  scene.add(directionalHelper);
  lightHelpers.push(directionalHelper);

  // Create spotlight 1
  const spotLight = new THREE.SpotLight(0xffffff, 600);
  spotLight.position.set(-11.0, 33, 0);
  spotLight.angle = Math.PI / 7;
  spotLight.penumbra = 0.2;
  spotLight.decay = 1;
  spotLight.distance = 50;
  
  spotLight.target.position.set(-12.4, 0, 0);
  
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.width = 1024;
  spotLight.shadow.mapSize.height = 1024;
  spotLight.shadow.bias = -0.001;
  spotLight.shadow.normalBias = 0.02;
  spotLight.shadow.camera.near = 1;
  spotLight.shadow.camera.far = 100;
  spotLight.shadow.camera.fov = 30;
  
  scene.add(spotLight);
  scene.add(spotLight.target);
  
  // Add spotlight helper
  const spotLightHelper = new THREE.SpotLightHelper(spotLight);
  scene.add(spotLightHelper);
  lightHelpers.push(spotLightHelper);
  
  // Create spotlight 2
  const spotLight2 = new THREE.SpotLight(0xffffff, 600);
  spotLight2.position.set(-11.0, 31, 25);
  spotLight2.angle = Math.PI / 7;
  spotLight2.penumbra = 0.2;
  spotLight2.decay = 1;
  spotLight2.distance = 50;
  
  spotLight2.target.position.set(-12.4, 0, 25);
  
  spotLight2.castShadow = true;
  spotLight2.shadow.mapSize.width = 1024;
  spotLight2.shadow.mapSize.height = 1024;
  spotLight2.shadow.bias = -0.001;
  spotLight2.shadow.normalBias = 0.02;
  spotLight2.shadow.camera.near = 1;
  spotLight2.shadow.camera.far = 100;
  spotLight2.shadow.camera.fov = 30;
  
  scene.add(spotLight2);
  scene.add(spotLight2.target);
  
  // Add spotlight helper
  const spotLight2Helper = new THREE.SpotLightHelper(spotLight2);
  scene.add(spotLight2Helper);
  lightHelpers.push(spotLight2Helper);
  
  // Create spotlight 3
  const spotLight3 = new THREE.SpotLight(0xffffff, 600);
  spotLight3.position.set(-11.0, 31, -25);
  spotLight3.angle = Math.PI / 7;
  spotLight3.penumbra = 0.2;
  spotLight3.decay = 1;
  spotLight3.distance = 50;
  
  spotLight3.target.position.set(-12.4, 0, -25);
  
  spotLight3.castShadow = true;
  spotLight3.shadow.mapSize.width = 1024;
  spotLight3.shadow.mapSize.height = 1024;
  spotLight3.shadow.bias = -0.001;
  spotLight3.shadow.normalBias = 0.02;
  spotLight3.shadow.camera.near = 1;
  spotLight3.shadow.camera.far = 100;
  spotLight3.shadow.camera.fov = 30;
  
  scene.add(spotLight3);
  scene.add(spotLight3.target);
  
  // Add spotlight helper
  const spotLight3Helper = new THREE.SpotLightHelper(spotLight3);
  scene.add(spotLight3Helper);
  lightHelpers.push(spotLight3Helper);

  // Point lights (original array for color cycling)
  const positions = [
    new THREE.Vector3(-9, 5, 0),     // Light 1
    //new THREE.Vector3(-6.7, 5, -3.36),     // Light 2
    //new THREE.Vector3(-6.7, 5, 3.17),    // Light 3
    //new THREE.Vector3(-11, 5, 3.13)     // Light 4
  ];
  
  positions.forEach((pos, i) => {
    const light = new THREE.PointLight(0xffffff, 300, 50, 2);
    light.position.copy(pos);
    scene.add(light);
    pointLights.push(light);
    hues.push(Math.random()); // optional: gives each light a different starting color
    
    // Add point light helper
    const pointLightHelper = new THREE.PointLightHelper(light, 1);
    scene.add(pointLightHelper);
    lightHelpers.push(pointLightHelper);
  });
  
  // NEW: Add standalone point lights (not part of the color cycling array)
  // Method 1: Static colored light
  /* const staticLight = new THREE.PointLight(0x00ffff, 250, 40, 2); // Cyan light
  staticLight.position.set(20, 5, 15);
  scene.add(staticLight);
  
  // Add helper for static light
  const staticLightHelper = new THREE.PointLightHelper(staticLight, 1);
  scene.add(staticLightHelper);
  lightHelpers.push(staticLightHelper); */
  
  // Method 2: Custom cycling light with its own parameters
  const customLight = new THREE.PointLight(0xff00ff, 200, 60, 2); // Start with magenta
  customLight.position.set(-26, 8, -13);
  customLight.userData = {
    cycleSpeed: 0.002, // Faster color cycling
    hue: Math.random(), // Random starting hue
    saturation: 0.9,
    lightness: 0.7
  };
  scene.add(customLight);
  window.customLights = window.customLights || [];
  window.customLights.push(customLight);
  
  // Add helper for custom light
  const customLightHelper = new THREE.PointLightHelper(customLight, 1);
  scene.add(customLightHelper);
  lightHelpers.push(customLightHelper);
  
  // Method 3: Blinking light
  /* const blinkingLight = new THREE.PointLight(0xffaa00, 150, 30, 2); // Orange light
  blinkingLight.position.set(0, 1, 0);
  blinkingLight.userData = {
    blinkSpeed: 2.0, // Blinks per second
    minIntensity: 50,
    maxIntensity: 300,
    originalIntensity: 150
  };
  scene.add(blinkingLight);
  window.blinkingLights = window.blinkingLights || [];
  window.blinkingLights.push(blinkingLight);
  
  // Add helper for blinking light
  const blinkingLightHelper = new THREE.PointLightHelper(blinkingLight, 1);
  scene.add(blinkingLightHelper);
  lightHelpers.push(blinkingLightHelper); */
    
}

  // Method 4: Add a light to track an interactive artwork
// First, we add the light during scene setup
function addArtworkLights(artworksData) {
  // Check if artworksData is defined, otherwise use the global artworks array
  const artworkItems = artworksData || artworks;
  
  if (artworkItems && artworkItems.length > 0) {
    const artworkData = artworkItems[0];
    const artworkLight = new THREE.PointLight(0xffffff, 100, 5, 2);
    
    // Position light above the artwork
    artworkLight.position.set(
      artworkData.position.x, 
      artworkData.position.y,
      artworkData.position.z,
    );
    scene.add(artworkLight);

    // Store in global array for updates
    window.artworkLights = window.artworkLights || [];
    window.artworkLights.push({
      light: artworkLight,
      artworkIndex: 0  // Reference to first artwork
    });
    
    // Add helper to visualize the light
    const artworkLightHelper = new THREE.PointLightHelper(artworkLight, 1);
    scene.add(artworkLightHelper);
    lightHelpers.push(artworkLightHelper);

    console.log("Artwork light added for:", artworkData.name);
  } else {
    console.log("No artwork data available for lights");
  }
  // Hide all helpers initially
  lightHelpers.forEach(helper => {
    helper.visible = false;
  });
}

function addParticles() {
  const particleCount = 2000;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const x = THREE.MathUtils.randFloatSpread(300);
    const y = THREE.MathUtils.randFloat(0, 300);
    const z = THREE.MathUtils.randFloatSpread(300);
    positions.set([x, y, z], i * 3);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load('assets/images/dustball.png', (glowTexture) => {
    glowTexture.colorSpace = THREE.SRGBColorSpace;
    glowTexture.needsUpdate = true;

    const material = new THREE.PointsMaterial({
      map: glowTexture,
      color: 0xffffff,
      size: .1,
      transparent: true,
      alphaTest: 0.1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);
    console.log("✨ Glowing square particles initialized!");
  },
  undefined,
  (err) => {
    console.error("🚨 Error loading texture: assets/images/dustball.png", err);
  });
}

function loadEnvironmentMap() {
  const textureLoader = new THREE.TextureLoader();
  const texturePath = isMobile 
    ? "assets/images/skybox2k.jpg"  // 2048x1024
    : "assets/images/skybox8k.jpg"; // 4096x2048 or more

  textureLoader.load(texturePath, function (texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    // Use environment on desktop only to avoid iOS crashing
    if (!isMobile) {
      scene.environment = texture;
    }
    scene.background = texture;
    console.log(`Loaded ${isMobile ? "mobile" : "desktop"} skybox`);
  }, undefined, function (err) {
    console.error("Failed to load skybox texture:", err);
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Setup player and input controls
function setupPlayer() {
  const geometry = new THREE.CylinderGeometry(playerRadius, playerRadius, playerHeight, 16);
  geometry.translate(0, playerHeight / 2, 0);
  const material = new THREE.MeshPhongMaterial({
    color: 0xff0000,
    opacity: 0,
    transparent: true,
  });
  player = new THREE.Mesh(geometry, material);
  player.position.y = 0;
  player.castShadow = true;
  scene.add(player);
  camera.position.set(0, playerHeight, 0);
  player.add(camera);

  // Keyboard controls for desktop
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  // Only enable pointer lock for non-mobile devices
  if (!isMobile) {
    renderer.domElement.addEventListener("click", function () {
      if (!mouseEnabled) {
        mouseEnabled = true;
        renderer.domElement.requestPointerLock();
      }
    });
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("mousemove", onMouseMove);
  } else {
    // Initialize mobile touch controls
    setupMobileControls();
    // Prevent pinch-to-zoom and double-tap zoom
    document.addEventListener("gesturestart", (e) => e.preventDefault());
    document.addEventListener("gesturechange", (e) => e.preventDefault());
    document.addEventListener("gestureend", (e) => e.preventDefault());
    const jumpButton = document.getElementById("jump-button");
    // Mobile Jump Button
    if (jumpButton) {
      jumpButton.addEventListener("touchstart", () => {
        if (isOnGround) {
          verticalVelocity = jumpForce;
          isOnGround = false;
          // Haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate(50);
          }
        }
      });
    }
  }

  // Teleport click remains for desktop
  setupTeleport();
}

// Helper function to log player position (for easier artwork placement)
function logPlayerPosition() {
  if (!player) return;
  
  console.log(`Player position: [${player.position.x.toFixed(2)}, ${player.position.y.toFixed(2)}, ${player.position.z.toFixed(2)}]`);
  console.log(`Camera rotation: [${camera.rotation.x.toFixed(2)}, ${camera.rotation.y.toFixed(2)}, ${camera.rotation.z.toFixed(2)}]`);
}

function onKeyDown(event) {
  switch (event.code) {
    case "KeyW": keys.forward = true; break;
    case "KeyS": keys.backward = true; break;
    case "KeyA": keys.left = true; break;
    case "KeyD": keys.right = true; break;
    case "ShiftLeft":
    case "ShiftRight": keys.shift = true; break;
    case "Space":
      if (isOnGround) {
        verticalVelocity = jumpForce;
        isOnGround = false;
      }
      break;
    case "KeyT": toggleNavmeshVisibility(); break;
    case "KeyM": toggleAudio(); break;
    case "KeyP": logPlayerPosition(); break; // Add P key to log position
    case "KeyL": toggleLightHelpers(); break; // Add L key to toggle light helpers
  }
}

function onKeyUp(event) {
  switch (event.code) {
    case "KeyW": keys.forward = false; break;
    case "KeyS": keys.backward = false; break;
    case "KeyA": keys.left = false; break;
    case "KeyD": keys.right = false; break;
    case "ShiftLeft":
    case "ShiftRight": keys.shift = false; break;
  }
}

function onPointerLockChange() {
  mouseEnabled = document.pointerLockElement === renderer.domElement;
}

function onMouseMove(event) {
  // For camera rotation when pointer is locked
  if (mouseEnabled) {
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;
    euler.y -= movementX * 0.002;
    euler.x -= movementY * 0.002;
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
    camera.rotation.copy(euler);
    playerDirection.set(0, 0, -1).applyQuaternion(camera.quaternion);
    return;
  }
  
  // For interactive model hover effect
  // Calculate mouse position in normalized device coordinates (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
  
  // Check for hover
  checkInteractiveModelHover();
}

// Function to check if mouse is hovering over an interactive model
// Function to check if mouse is hovering over an interactive model
function checkInteractiveModelHover() {
  if (!raycaster || !camera || interactiveModels.length === 0) return;
  
  // Update the raycaster with the camera and mouse position
  raycaster.setFromCamera(mouse, camera);
  
  // Calculate objects intersecting the picking ray
  const intersects = raycaster.intersectObjects(interactiveModels, true);
  
  // Reset all models to their original state
  interactiveModels.forEach(model => {
    model.traverse(child => {
      if (child.isMesh && child.userData.originalMaterial) {
        if (child.userData.isHighlighted) {
          // Only change emissive property back to original
          child.material.emissive.set(0, 0, 0);
          child.material.emissiveIntensity = 0;
          child.userData.isHighlighted = false;
        }
      }
    });
  });
  
  // Reset cursor
  document.body.style.cursor = 'auto';
  
  // Highlight the first intersected object
  if (intersects.length > 0) {
    const object = intersects[0].object;
    let interactiveModel = object;
    
    // Find the top-level interactive model
    while (interactiveModel.parent && !interactiveModel.userData.isInteractiveModel) {
      interactiveModel = interactiveModel.parent;
    }
    
    if (interactiveModel.userData.isInteractiveModel) {
      // Change cursor to indicate clickable
      document.body.style.cursor = 'pointer';
      
      // Highlight using emissive property
      interactiveModel.traverse(child => {
        if (child.isMesh) {
          // Store original material if not already stored
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = child.material;
          }
          
          // Set emissive color (using a nice blue glow)
          child.material.emissive.set(0.2, 0.5, 1.0);
          child.material.emissiveIntensity = 0.5; // Adjust intensity as needed
          child.userData.isHighlighted = true;
        }
      });
    }
  }
}

// Function to handle clicks on interactive models
function onModelClick(event) {
  // Update the mouse position
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
  
  // Update the picking ray
  raycaster.setFromCamera(mouse, camera);
  
  // Find intersections
  const intersects = raycaster.intersectObjects(interactiveModels, true);
  
  if (intersects.length > 0) {
    const object = intersects[0].object;
    let interactiveModel = object;
    
    // Find the top-level interactive model
    while (interactiveModel.parent && !interactiveModel.userData.isInteractiveModel) {
      interactiveModel = interactiveModel.parent;
    }
    
    if (interactiveModel.userData.isInteractiveModel && interactiveModel.userData.linkUrl) {
      // Store the URL we want to open
      const urlToOpen = interactiveModel.userData.linkUrl;
      
      // Stop event propagation to prevent other click handlers
      event.stopPropagation();
      
      // Check if pointer is locked
      if (document.pointerLockElement === renderer.domElement) {
        // First exit pointer lock
        document.exitPointerLock();
        
        // Listen for the pointerlockchange event once
        const handlePointerLockChange = function() {
          // Only proceed if pointer lock is truly exited
          if (document.pointerLockElement === null) {
            // Remove the event listener to avoid multiple calls
            document.removeEventListener('pointerlockchange', handlePointerLockChange);
            // Now it's safe to open the URL
            window.open(urlToOpen, '_blank');
          }
        };
        
        // Add the event listener
        document.addEventListener('pointerlockchange', handlePointerLockChange, { once: true });
      } else {
        // If pointer lock is not active, open URL directly
        window.open(urlToOpen, '_blank');
      }
    }
  }
}

// Mobile touch controls for movement and camera rotation
function setupMobileControls() {
  let leftTouchId = null, rightTouchId = null;
  let leftStart = null, rightStart = null;

  window.addEventListener("touchstart", function(e) {
    for (let touch of e.changedTouches) {
      if (touch.clientX < window.innerWidth / 2 && leftTouchId === null) {
        leftTouchId = touch.identifier;
        leftStart = { x: touch.clientX, y: touch.clientY };
      } else if (touch.clientX >= window.innerWidth / 2 && rightTouchId === null) {
        rightTouchId = touch.identifier;
        rightStart = { x: touch.clientX, y: touch.clientY };
      }
    }
  }, false);

  window.addEventListener("touchmove", function(e) {
    for (let touch of e.changedTouches) {
      if (touch.identifier === leftTouchId) {
        let deltaX = touch.clientX - leftStart.x;
        let deltaY = touch.clientY - leftStart.y;
        keys.forward = deltaY < -20;
        keys.backward = deltaY > 20;
        keys.left = deltaX < -20;
        keys.right = deltaX > 20;
      } else if (touch.identifier === rightTouchId) {
        let deltaX = touch.clientX - rightStart.x;
        let deltaY = touch.clientY - rightStart.y;
        euler.y -= deltaX * 0.005;
        euler.x -= deltaY * 0.005;
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.rotation.copy(euler);
        rightStart = { x: touch.clientX, y: touch.clientY };
      }
    }
  }, false);

  window.addEventListener("touchend", function(e) {
    for (let touch of e.changedTouches) {
      if (touch.identifier === leftTouchId) {
        leftTouchId = null;
        keys.forward = keys.backward = keys.left = keys.right = false;
      } else if (touch.identifier === rightTouchId) {
        rightTouchId = null;
      }
    }
  }, false);
}

// Teleport functionality
function setupTeleport() {
  const raycaster = new THREE.Raycaster();
  renderer.domElement.addEventListener("mousedown", function (event) {
    if (!mouseEnabled) return;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObject(navmesh, true);
    if (intersects.length > 0) {
      const targetPosition = intersects[0].point.clone();
      player.position.x = targetPosition.x;
      player.position.z = targetPosition.z;
      player.position.y = targetPosition.y;
      verticalVelocity = 0;
    }
  });
}

function toggleNavmeshVisibility() {
  if (!navmesh) return;
  navmesh.traverse(function (node) {
    if (node.isMesh) {
      node.material.visible = !node.material.visible;
    }
  });
}

function placePlayerOnNavmesh(fallbackPosition) {
  if (!navmesh) {
    player.position.copy(fallbackPosition);
    return;
  }
  const raycaster = new THREE.Raycaster();
  const startPosition = new THREE.Vector3(fallbackPosition.x, 100, fallbackPosition.z);
  raycaster.set(startPosition, new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObject(navmesh, true);
  if (intersects.length > 0) {
    player.position.x = intersects[0].point.x;
    player.position.z = intersects[0].point.z;
    player.position.y = intersects[0].point.y;
    console.log("Player placed at position:", player.position);
    verticalVelocity = 0;
    isOnGround = true;
  } else {
    console.log("Navmesh intersection not found, using fallback position");
    player.position.copy(fallbackPosition);
  }
}

function checkIsOnNavmesh(x, z) {
  const raycaster = new THREE.Raycaster();
  const pos = new THREE.Vector3(x, 100, z);
  raycaster.set(pos, new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObject(navmesh, true);
  return intersects.length > 0;
}

function updatePlayerMovement() {
  if (!player || !navmesh) return;
  
  velocity.set(0, 0, 0);
  camera.getWorldDirection(cameraDirection);
  cameraDirection.y = 0;
  cameraDirection.normalize();
  cameraRight.set(-cameraDirection.z, 0, cameraDirection.x);
  
  const currentSpeed = keys.shift ? moveSpeed * 2 : moveSpeed;
  
  if (keys.forward) velocity.add(cameraDirection.clone().multiplyScalar(currentSpeed));
  if (keys.backward) velocity.add(cameraDirection.clone().multiplyScalar(-currentSpeed));
  if (keys.right) velocity.add(cameraRight.clone().multiplyScalar(currentSpeed));
  if (keys.left) velocity.add(cameraRight.clone().multiplyScalar(-currentSpeed));
  
  if (velocity.lengthSq() > 0) {
    velocity.normalize().multiplyScalar(currentSpeed);
  }
  
  oldPosition.copy(player.position);
  player.position.x += velocity.x;
  player.position.z += velocity.z;
  
  let isOnNavmesh = checkIsOnNavmesh(player.position.x, player.position.z);
  if (!isOnNavmesh) {
    player.position.x = oldPosition.x;
    player.position.z = oldPosition.z;
  }
  
  applyGravityAndVerticalMovement();
}

function applyGravityAndVerticalMovement() {
  verticalVelocity -= gravity;
  player.position.y += verticalVelocity;
  
  const raycaster = new THREE.Raycaster();
  const pos = new THREE.Vector3(player.position.x, player.position.y + 100, player.position.z);
  raycaster.set(pos, new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObject(navmesh, true);
  
  if (intersects.length > 0) {
    const groundY = intersects[0].point.y;
    if (player.position.y <= groundY) {
      player.position.y = groundY;
      verticalVelocity = 0;
      isOnGround = true;
    } else {
      isOnGround = false;
    }
  } else {
    isOnGround = false;
    if (player.position.y < -50) {
      placePlayerOnNavmesh(new THREE.Vector3(0, 10, 0));
    }
  }
}

function animateGrass(time) {
  if (!flowerParts.length) return;
  
  flowerParts.forEach((flowerPart) => {
    if (!flowerPart.userData.originalRotation) return;
    
    const windTime = time * windSettings.speed * 0.001;
    const windOffset = flowerPart.userData.windOffset || 0;
    const windFactor = flowerPart.userData.windFactor || 1;
    const windAmount = Math.sin(windTime + windOffset) * windSettings.strength * windFactor;
    const chaosX = Math.sin(windTime * 1.3 + windOffset * 2) * windSettings.chaos * windFactor;
    const chaosZ = Math.cos(windTime * 0.7 + windOffset * 3) * windSettings.chaos * windFactor;
    
    const xAngle = Math.max(-windSettings.maxAngle, Math.min(windSettings.maxAngle, windAmount + chaosX));
    const zAngle = Math.max(-windSettings.maxAngle, Math.min(windSettings.maxAngle, windAmount * 0.5 + chaosZ));
    
    flowerPart.rotation.x = flowerPart.userData.originalRotation.x + xAngle;
    flowerPart.rotation.z = flowerPart.userData.originalRotation.z + zAngle;
    
    if (flowerPart.userData.originalPosition) {
      flowerPart.position.x = flowerPart.userData.originalPosition.x + chaosX * 0.02;
      flowerPart.position.z = flowerPart.userData.originalPosition.z + chaosZ * 0.02;
    }
  });
}

// Debug function to update information about interactive models
function updateDebugInfo() {
  if (!DEBUG) return;
  
  const debugElement = document.getElementById('debug-info');
  if (!debugElement) return;
  
  let content = '<strong>Interactive Models:</strong><br>';
  
  if (interactiveModels.length === 0) {
    content += 'No models loaded yet.';
  } else {
    interactiveModels.forEach((model, index) => {
      content += `<b>${index + 1}. ${model.userData.name || 'Unnamed'}</b><br>`;
      content += `Position: (${model.position.x.toFixed(2)}, ${model.position.y.toFixed(2)}, ${model.position.z.toFixed(2)})<br>`;
      content += `URL: ${model.userData.linkUrl}<br>`;
      
      // Count meshes
      let meshCount = 0;
      model.traverse(child => {
        if (child.isMesh) meshCount++;
      });
      
      content += `Meshes: ${meshCount}<br><br>`;
    });
  }
  
  // Add mouse position
  content += `<b>Mouse:</b> X: ${mouse.x.toFixed(2)}, Y: ${mouse.y.toFixed(2)}<br>`;
  
  // Add camera position
  content += `<b>Camera:</b> (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})<br>`;
  
  debugElement.innerHTML = content;
}

function animate(time) {
  // Calculate delta time
  const now = performance.now() / 1000; // Convert to seconds
  const deltaTime = now - (lastTime || now);
  lastTime = now;

  requestAnimationFrame(animate);
  updatePlayerMovement();
  animateGrass(time);

  // Update wind materials
  windMaterials.forEach(material => {
    material.uniforms.u_windTime.value += material.uniforms.u_windSpeed.value * deltaTime;
  });

  // Update tree animations
  fluffyTrees.forEach(tree => tree.update(deltaTime));

  // Check interactive model hover if not in pointer lock mode
  if (!mouseEnabled && interactiveModels.length > 0) {
    checkInteractiveModelHover();
  }
  
  // Update debug info
  if (DEBUG) {
    updateDebugInfo();
  }

  // Update original color cycling point lights
  pointLights.forEach((light, i) => {
    hues[i] += 0.001; // control speed here
    if (hues[i] > 1) hues[i] = 0;
    light.color.setHSL(hues[i], 1, 0.5);
  });
  
  // Update custom cycling lights
  if (window.customLights && window.customLights.length > 0) {
    window.customLights.forEach(light => {
      if (light.userData) {
        light.userData.hue += light.userData.cycleSpeed || 0.001;
        if (light.userData.hue > 1) light.userData.hue = 0;
        light.color.setHSL(
          light.userData.hue,
          light.userData.saturation || 1.0,
          light.userData.lightness || 0.5
        );
      }
    });
  }
  
  // Update blinking lights
  if (window.blinkingLights && window.blinkingLights.length > 0) {
    window.blinkingLights.forEach(light => {
      if (light.userData) {
        const { blinkSpeed, minIntensity, maxIntensity } = light.userData;
        // Create a sine wave pattern for smooth blinking
        const intensityFactor = (Math.sin(time * 0.001 * blinkSpeed * Math.PI) + 1) * 0.5; // 0 to 1
        const newIntensity = minIntensity + intensityFactor * (maxIntensity - minIntensity);
        light.intensity = newIntensity;
      }
    });
  }
  
  // Update artwork tracking lights
  if (window.artworkLights && window.artworkLights.length > 0) {
    window.artworkLights.forEach(item => {
      if (artworks[item.artworkIndex] && interactiveModels[item.artworkIndex]) {
        // Get current artwork position
        const artworkPos = interactiveModels[item.artworkIndex].position;
        // Position light above the artwork
        item.light.position.set(artworkPos.x, artworkPos.y + 1, artworkPos.z + 2);
        
        // Optional: create a spotlight effect by changing light properties
        // when mouse is hovering over the artwork
        const isArtworkHovered = document.body.style.cursor === 'pointer';
        if (isArtworkHovered) {
          item.light.intensity = 200; // Brighter when hovered
          // Create subtle pulsing effect
          const pulse = (Math.sin(time * 0.003) + 1) * 0.5; // 0 to 1
          item.light.distance = 15 + pulse * 10; // Pulse the light radius
        } else {
          item.light.intensity = 100; // Normal brightness
          item.light.distance = 15; // Normal radius
        }
      }
      
    });
    
  }

    // Update light helpers
    lightHelpers.forEach(helper => {
      if (helper.update) {
        helper.update();
      }
    });
  
  // Audio visualization
  if (particleSystem && analyser) {
    analyser.getByteFrequencyData(audioDataArray);

    let avg = 0;
    for (let i = 0; i < audioDataArray.length; i++) {
      avg += audioDataArray[i];
    }
    avg /= audioDataArray.length;
    const pulse = avg / 256;

    // Only log in debug mode
    if (DEBUG) {
      console.log("Pulse:", pulse.toFixed(2), 
                "Size:", particleSystem.material.size.toFixed(2), 
                "Opacity:", particleSystem.material.opacity.toFixed(2));
    }

    particleSystem.material.size = .5 + pulse * 1;
    particleSystem.material.opacity = .5 + pulse * 0.4;
    particleSystem.material.color.setHSL(pulse, 1.0, 1.0);

    particleSystem.rotation.y += 0.0005 + pulse * 0.003;
    particleSystem.position.y = Math.sin(performance.now() * 0.001) * (0.5 + pulse * 0.5);

    particleSystem.material.needsUpdate = true;
  }

  renderer.render(scene, camera);
}

// Load models
function loadModels() {
  const loadingManager = new THREE.LoadingManager(
    function () {
      console.log("All models loaded!");
      const screen = document.getElementById("loading-screen");
      if (screen) {
        screen.style.opacity = "0";
        setTimeout(() => screen.style.display = "none", 1000);
      }
    },
    function (url, itemsLoaded, itemsTotal) {
      const progress = Math.round((itemsLoaded / itemsTotal) * 100);
      const text = document.getElementById("loader-text");
      if (text) text.textContent = `Loading... ${progress}%`;
    },
    function (url) {
      console.error("Error loading:", url);
    }
  );

  const loader = new GLTFLoader(loadingManager);
  
  // Define all the models to load
  const modelsList = [
    {
      name: "terrain1",
      url: "assets/models/terrain1.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "terrain2",
      url: "assets/models/terrain2.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "terrain3",
      url: "assets/models/terrain3.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "terrain4",
      url: "assets/models/terrain4.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "navmesh",
      url: "assets/models/navmesh.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "stairs",
      url: "assets/models/stairs.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "backroom",
      url: "assets/models/backroom.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "grass",
      url: "assets/models/grass.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "frontwall",
      url: "assets/models/frontwall.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "fence",
      url: "assets/models/fence.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "wall",
      url: "assets/models/wall.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
  ];
  
  modelsList.forEach((modelInfo) => {
    loader.load(
      modelInfo.url,
      function (gltf) {
        const model = gltf.scene;
        model.position.copy(modelInfo.position);
        model.scale.copy(modelInfo.scale);
        model.rotation.copy(modelInfo.rotation);
        
        if (modelInfo.name === "navmesh") {
          const navmeshMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            opacity: 0.3,
            transparent: true,
            visible: false,
          });
          model.traverse(function (node) {
            if (node.isMesh) {
              node.material = navmeshMaterial;
              node.castShadow = false;
              node.receiveShadow = false;
            }
          });
          navmesh = model;
        } else if (modelInfo.name === "grass") {
          // Process grass model for wind animation
          model.traverse(function (node) {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;

              // Store original positions and rotations for the animation
              node.userData.originalPosition = node.position.clone();
              node.userData.originalRotation = node.rotation.clone();

              // Add some randomness to make the animation more natural
              node.userData.windOffset = Math.random() * Math.PI * 2;
              node.userData.windFactor = 0.8 + Math.random() * 0.4; // Between 0.8 and 1.2

              // Add to flowerParts array for animation
              flowerParts.push(node);

              // Enhance materials to work with environment lighting
              if (node.material) {
                if (node.material.isMeshStandardMaterial) {
                  node.material.envMapIntensity = 0.7;
                  node.material.roughness = Math.max(0.2, node.material.roughness);
                  node.material.metalness = Math.min(0.8, node.material.metalness);
                  node.material.needsUpdate = true;
                } else if (Array.isArray(node.material)) {
                  node.material.forEach((material) => {
                    if (material.isMeshStandardMaterial) {
                      material.envMapIntensity = 0.7;
                      material.roughness = Math.max(0.2, material.roughness);
                      material.metalness = Math.min(0.8, material.metalness);
                    }
                  });
                }
              }
            }
          });
        } else {
          // Process standard model materials
          model.traverse(function (node) {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;

              // Enhance materials to work with environment lighting
              if (node.material) {
                if (node.material.isMeshStandardMaterial) {
                  node.material.envMapIntensity = 0.7;
                  node.material.roughness = Math.max(0.2, node.material.roughness);
                  node.material.metalness = Math.min(0.8, node.material.metalness);
                } else if (Array.isArray(node.material)) {
                  node.material.forEach((material) => {
                    if (material.isMeshStandardMaterial) {
                      material.envMapIntensity = 0.7;
                      material.roughness = Math.max(0.2, material.roughness);
                      material.metalness = Math.min(0.8, material.metalness);
                    }
                  });
                }
              }
            }
          });
        }
        
        models[modelInfo.name] = model;
        scene.add(model);
        console.log(`Model "${modelInfo.name}" loaded`);
        
        if (modelInfo.name === "navmesh" && player) {
          placePlayerOnNavmesh(new THREE.Vector3(30, 10, 0));
        }
      },
      function (xhr) {
        console.log(`${modelInfo.name}: ${Math.round((xhr.loaded / xhr.total) * 100)}% loaded`);
      },
      function (error) {
        console.error(`Error loading ${modelInfo.name}:`, error);
        if (modelInfo.name === "navmesh") {
          createBackupNavmesh();
        }
      }
    );
  });
}

function createBackupNavmesh() {
  const geometry = new THREE.BoxGeometry(50, 0.1, 50);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    wireframe: true,
    opacity: 0.3,
    transparent: true,
    visible: false,
  });
  navmesh = new THREE.Mesh(geometry, material);
  navmesh.position.y = 0;
  scene.add(navmesh);
  placePlayerOnNavmesh(new THREE.Vector3(0, 2, 0));
}

// Application cleanup function
function cleanup() {
  // Remove event listeners
  window.removeEventListener("resize", onWindowResize);
  document.removeEventListener("keydown", onKeyDown);
  document.removeEventListener("keyup", onKeyUp);
  document.removeEventListener("pointerlockchange", onPointerLockChange);
  document.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("click", onModelClick);
  
  // Reset cursor
  document.body.style.cursor = 'auto';
  
  // Stop audio if playing
  if (audioSource) {
    audioSource.stop();
    audioSource = null;
  }
  
  // Clean up interactive models
  interactiveModels.forEach(model => {
    scene.remove(model);
  });
  interactiveModels = [];

    // Clean up light helpers
    lightHelpers.forEach(helper => {
      scene.remove(helper);
    });
    lightHelpers = [];
  
  // Clean up additional light references
  window.customLights = [];
  window.blinkingLights = [];
  window.artworkLights = [];
  
  // Dispose of geometries, materials, textures
  scene.traverse(object => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(material => material.dispose());
      } else {
        object.material.dispose();
      }
    }
  });
  
  // Dispose of renderer
  if (renderer) {
    renderer.dispose();
  }
  
  console.log("Application resources cleaned up");
}

// Function to load interactive artwork models
function loadArtworkModels() {
  console.log("Loading interactive artwork models...");
  
  const loader = new GLTFLoader();
  
  artworks.forEach(artwork => {
    loader.load(
      artwork.url,
      function(gltf) {
        const model = gltf.scene;
        
        // Set position, scale, and rotation
        model.position.copy(artwork.position);
        model.scale.copy(artwork.scale);
        model.rotation.copy(artwork.rotation);
        
        // Mark as interactive model and store link URL
        model.userData.isInteractiveModel = true;
        model.userData.linkUrl = artwork.linkUrl;
        model.userData.name = artwork.name;
        
        // Add to scene and track in our array
        scene.add(model);
        interactiveModels.push(model);
        
        console.log(`Interactive model "${artwork.name}" loaded and placed at ${artwork.position.x}, ${artwork.position.y}, ${artwork.position.z}`);
        
        // Setup material for all meshes in the model
        model.traverse(child => {
          if (child.isMesh) {
            // Ensure the mesh casts and receives shadows
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Make sure the material is properly set for emissive highlighting
            if (child.material && !child.material.isMeshStandardMaterial) {
              // If not already a MeshStandardMaterial, convert it
              const stdMaterial = new THREE.MeshStandardMaterial({
                map: child.material.map,
                color: child.material.color ? child.material.color.clone() : 0xffffff,
                roughness: 0.7,
                metalness: 0.3
              });
              
              // Store and apply the new material
              child.userData.originalMaterial = stdMaterial;
              child.material = stdMaterial;
            } else {
              // Just store reference to the original material
              child.userData.originalMaterial = child.material;
            }
            
            child.userData.isHighlighted = false;
          }
        });
      },
      function(xhr) {
        console.log(`${artwork.name}: ${Math.round((xhr.loaded / xhr.total) * 100)}% loaded`);
      },
      function(error) {
        console.error(`Error loading ${artwork.name}:`, error);
      }
    );
  });
}

// Main start function
function start() {
  setupScene();
  setupPlayer();
  loadModels();
  loadFluffyTrees();
  loadArtworkModels(); // Load the interactive artwork models

// Wait until models are loaded before adding lights
setTimeout(() => {
  try {
    // Only call if the function exists
    if (typeof addArtworkLights === 'function') {
      addArtworkLights(artworks);
      console.log("Artwork lights added successfully");
    } else {
      console.warn("addArtworkLights function not found");
    }
  } catch (error) {
    console.error("Error adding artwork lights:", error);
  }
}, 1000); // Wait 1 second to ensure models are loaded
  
  // Tutorial Overlay
  if (isMobile) {
    if (!localStorage.getItem("tutorialSeen")) {
      document.getElementById("tutorial-overlay").style.display = "flex";
      document.getElementById("close-tutorial").addEventListener("click", () => {
        document.getElementById("tutorial-overlay").style.display = "none";
        localStorage.setItem("tutorialSeen", "true");
      });
    }
  }
  
  // Start animation loop
  requestAnimationFrame(animate);
  
  // Add window unload event for cleanup
  window.addEventListener("unload", cleanup);
}

// Module exports (for potential future modularization)
export { start, cleanup };