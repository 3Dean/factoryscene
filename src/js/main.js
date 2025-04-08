import '../style.css'
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ColorManagement, SRGBColorSpace, ACESFilmicToneMapping } from 'three';

// Add a global variable for the trees
let fluffyTrees = [];
let lastTime = 0;
let windMaterials = [];

// Wait for everything to load
window.addEventListener("load", init);

function init() {

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

  // Variables
  let scene, camera, renderer;
  let player, navmesh;
  let audioContext, audioSource, gainNode;
  let audioBuffer,
    audioIsPlaying = false;
  let audioInitialized = false;
  let pointLights = [];
  let hues = [];
  let particleSystem;
  let analyser, audioDataArray;

// Add this function to your code
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
  
  // Import the improved tree class
  // Make sure to adjust the import path based on your file structure
  // You might need to import at the top of your file instead
  import('./tree/ImprovedFluffyTree.js').then(module => {
    const ImprovedFluffyTree = module.ImprovedFluffyTree;
    
    // Load each tree
    Promise.all(treePositions.map(async (treeData) => {
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
        console.log('Improved fluffy tree added at', treeData.pos);
        return tree;
      } catch (error) {
        console.error('Failed to load fluffy tree:', error);
        return null;
      }
    })).then(trees => {
      console.log(`Successfully loaded ${trees.filter(Boolean).length} fluffy trees`);
    }).catch(error => {
      console.error("Error in tree loading promise chain:", error);
    });
  }).catch(error => {
    console.error("Failed to import ImprovedFluffyTree module:", error);
  });
}

  const playerHeight = 1.9;
  const playerRadius = 0.25;
  const moveSpeed = 0.1;
  let velocity = new THREE.Vector3();
  let verticalVelocity = 0;
  const gravity = 0.01;
  let isOnGround = false;
  const jumpForce = 0.25;

  // Object to store loaded models
  let models = {};

  // For flower animation
  const scrollingTextures = [];
  const flowerParts = [];
  const windSettings = {
    strength: 0.1,
    speed: 1.5,
    chaos: 0.2,
    maxAngle: 0.15,
  };

  // Detect if on mobile device
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  // Initialize audio system
  setupAudio();

  // Audio control elements
  const playPauseButton = document.getElementById("play-pause");
  const volumeSlider = document.getElementById("volume-slider");
  const volumeLabel = document.getElementById("volume-label");

  // Add event listeners for audio controls
  playPauseButton.addEventListener("click", toggleAudio);
  volumeSlider.addEventListener("input", updateVolume);

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
      playPauseButton.textContent = "Play Music";
    } else {
      audioSource = audioContext.createBufferSource();
      audioSource.buffer = audioBuffer;
      audioSource.loop = true;
      audioSource.connect(gainNode);
      audioSource.start(0);
      audioIsPlaying = true;
      playPauseButton.textContent = "Pause Music";
    }
  }

  function updateVolume() {
    const volumeValue = volumeSlider.value;
    volumeLabel.textContent = `Volume: ${volumeValue}%`;
    if (gainNode) {
      gainNode.gain.value = volumeValue / 100;
    }
  }

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
        glowTexture.colorSpace = THREE.SRGBColorSpace; // optional: keeps colors true
        glowTexture.needsUpdate = true;
    
        const material = new THREE.PointsMaterial({
          map: glowTexture,
          color: 0xffffff,
          size: .1, // adjust this to make them larger/smaller
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
      }    
    );
    }
    

    // Lights and other scene setup (unchanged) ...

        const ambientLight = new THREE.AmbientLight(0xf7c6a1, 0.5); // Increased ambient intensity
        scene.add(ambientLight);

          // Directional light
            const directionalLight = new THREE.DirectionalLight(0xa1cff7, 10);
            directionalLight.position.set(0, 10, 0);
            scene.add(directionalLight);

            // Create spotlight 1
            const spotLight = new THREE.SpotLight(0xffffff, 600); // (color, intensity)
            spotLight.position.set(-11.0, 33, 0); // adjust to fit your scene
            spotLight.angle = Math.PI / 7; // cone angle
            spotLight.penumbra = 0.2; // softness of the edges
            spotLight.decay = 1; // how the light dims over distance
            spotLight.distance = 50; // how far the light reaches
            
            spotLight.target.position.set(-12.4, 0, 0); // Change this to wherever you want it to point
            
            // Enable shadows (optional but cool)
            spotLight.castShadow = true;
            spotLight.shadow.mapSize.width = 1024;
            spotLight.shadow.mapSize.height = 1024;
            spotLight.shadow.bias = -0.001;       // fixes acne
            spotLight.shadow.normalBias = 0.02;   // fixes peter panning
            spotLight.shadow.camera.near = 1;
            spotLight.shadow.camera.far = 100;
            spotLight.shadow.camera.fov = 30;
            
            // Add to the scene
            scene.add(spotLight);
            scene.add(spotLight.target);
            
            // (Optional) Add a helper to see the spotlight cone while debugging
            const spotLightHelper = new THREE.SpotLightHelper(spotLight);
            //scene.add(spotLightHelper);
            
            // Create spotlight 2
            const spotLight2 = new THREE.SpotLight(0xffffff, 600); // (color, intensity)
            spotLight2.position.set(-11.0, 31, 25); // adjust to fit your scene
            spotLight2.angle = Math.PI / 7; // cone angle
            spotLight2.penumbra = 0.2; // softness of the edges
            spotLight2.decay = 1; // how the light dims over distance
            spotLight2.distance = 50; // how far the light reaches
            
            spotLight2.target.position.set(-12.4, 0, 25); // Change this to wherever you want it to point
            
            // Enable shadows (optional but cool)
            spotLight2.castShadow = true;
            spotLight2.shadow.mapSize.width = 1024;
            spotLight2.shadow.mapSize.height = 1024;
            spotLight2.shadow.bias = -0.001;       // fixes acne
            spotLight2.shadow.normalBias = 0.02;   // fixes peter panning
            spotLight2.shadow.camera.near = 1;
            spotLight2.shadow.camera.far = 100;
            spotLight2.shadow.camera.fov = 30;
            
            // Add to the scene
            scene.add(spotLight2);
            scene.add(spotLight2.target);
            
            // (Optional) Add a helper to see the spotlight cone while debugging
            const spotLight2Helper = new THREE.SpotLightHelper(spotLight2);
            //scene.add(spotLight2Helper);
            
            // Create spotlight 3
            const spotLight3 = new THREE.SpotLight(0xffffff, 600); // (color, intensity)
            spotLight3.position.set(-11.0, 31, -25); // adjust to fit your scene
            spotLight3.angle = Math.PI / 7; // cone angle
            spotLight3.penumbra = 0.2; // softness of the edges
            spotLight3.decay = 1; // how the light dims over distance
            spotLight3.distance = 50; // how far the light reaches
            
            spotLight3.target.position.set(-12.4, 0, -25); // Change this to wherever you want it to point
            
            // Enable shadows (optional but cool)
            spotLight3.castShadow = true;
            spotLight3.shadow.mapSize.width = 1024;
            spotLight3.shadow.mapSize.height = 1024;
            spotLight3.shadow.bias = -0.001;       // fixes acne
            spotLight3.shadow.normalBias = 0.02;   // fixes peter panning
            spotLight3.shadow.camera.near = 1;
            spotLight3.shadow.camera.far = 100;
            spotLight3.shadow.camera.fov = 30;
            
            // Add to the scene
            scene.add(spotLight3);
            scene.add(spotLight3.target);
            
            // (Optional) Add a helper to see the spotlight cone while debugging
            const spotLight3Helper = new THREE.SpotLightHelper(spotLight3);
            //scene.add(spotLight3Helper);

            // Point lights
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
             // Optional: Add a helper to visualize the point light
             //const helper = new THREE.PointLightHelper(light, 1);
             //scene.add(helper);
            pointLights.push(light);
            hues.push(Math.random()); // optional: gives each light a different starting color
        });

// Load environment map from Skybox file
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

    // Handle window resize
    window.addEventListener("resize", onWindowResize);
    loadEnvironmentMap();
    addParticles();
   }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Model loading functions remain unchanged
  function loadModels() {
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
          }
          else if (modelInfo.name === "fluffyTrees") {
            model.traverse(function (node) {
              if (node.isMesh) {
                if (node.name.includes("trunk")) {
                  // Apply trunk material
                  node.castShadow = true;
                  node.receiveShadow = true;
                  node.material = new THREE.MeshStandardMaterial({
                    color: "#53523c", 
                    roughness: 0.9
                  });
                } else if (node.name.includes("foliage")) {
                  // Apply foliage material with wind effect
                  node.receiveShadow = true;
                  node.castShadow = true;
                  node.material = createFoliageMaterial();
                  // Add to animated objects list if needed
                  flowerParts.push(node);
                }
              }
            });
            function createFoliageMaterial() {
                // Load the alpha texture
                const textureLoader = new THREE.TextureLoader();
                const alphaMap = textureLoader.load('/assets/textures/foliage_alpha3.png');
                
                // Create a custom shader material for the foliage
                const uniforms = {
                  u_effectBlend: { value: 1.0 },
                  u_inflate: { value: 0.2 },
                  u_scale: { value: 1.0 },
                  u_windSpeed: { value: 1.0 },
                  u_windTime: { value: 0.0 },
                };
                
                // Create the material using ShaderMaterial
                const material = new THREE.ShaderMaterial({
                  vertexShader: foliageVertexShader, // Use the loaded shader
                  fragmentShader: THREE.ShaderLib.standard.fragmentShader,
                  uniforms: THREE.UniformsUtils.merge([
                    THREE.ShaderLib.standard.uniforms,
                    uniforms
                  ]),
                  lights: true,
                  transparent: true,
                  alphaMap: alphaMap,
                  alphaTest: 0.5,
                  side: THREE.FrontSide
                });
                
                // Add the material to the list to update wind time
                windMaterials.push(material);
                
                return material;
              }
          }
          // Special handling for grass to enable wind animation
                    else if (modelInfo.name === "grass") {
                      // Process standard model materials
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
                              node.material.roughness = Math.max(
                                0.2,
                                node.material.roughness
                              );
                              node.material.metalness = Math.min(
                                0.8,
                                node.material.metalness
                              );
                              node.material.needsUpdate = true;
          
                            } else if (Array.isArray(node.material)) {
                              node.material.forEach((material) => {
                                if (material.isMeshStandardMaterial) {
                                  material.envMapIntensity = 0.7;
                                  material.roughness = Math.max(
                                    0.2,
                                    material.roughness
                                  );
                                  material.metalness = Math.min(
                                    0.8,
                                    material.metalness
                                  );
                                }
                              });
                            }
                          }
                        }
                      });
          
                      console.log(
                        `Found ${flowerParts.length} meshes for flower animation`
                      );
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
                              node.material.roughness = Math.max(
                                0.2,
                                node.material.roughness
                              );
                              node.material.metalness = Math.min(
                                0.8,
                                node.material.metalness
                              );
                            } else if (Array.isArray(node.material)) {
                              node.material.forEach((material) => {
                                if (material.isMeshStandardMaterial) {
                                  material.envMapIntensity = 0.7;
                                  material.roughness = Math.max(
                                    0.2,
                                    material.roughness
                                  );
                                  material.metalness = Math.min(
                                    0.8,
                                    material.metalness
                                  );
                                }
                              });
                            }
                          }
                        }
                      });
                    }
          // Process other models as before...
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
    loadingManager.onLoad = function () {
      document.getElementById("loading-screen").style.display = "none";
      if (audioBuffer && !audioIsPlaying) {
        playPauseButton.style.backgroundColor = "rgba(80, 200, 120, 0.3)";
        setTimeout(() => {
          playPauseButton.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
        }, 2000);
      }
    };
  }

  

  // Backup model functions remain unchanged...
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
      // Optionally display mobile instructions (already in HTML/CSS)
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

    // Teleport click remains for desktop; you might extend this for mobile tap jump if desired
    setupTeleport();
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
    if (!mouseEnabled) return;
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;
    euler.y -= movementX * 0.002;
    euler.x -= movementY * 0.002;
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
    camera.rotation.copy(euler);
    playerDirection.set(0, 0, -1).applyQuaternion(camera.quaternion);
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

  // Teleport functionality remains unchanged
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
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0;
    cameraDirection.normalize();
    const cameraRight = new THREE.Vector3(-cameraDirection.z, 0, cameraDirection.x);
    const currentSpeed = keys.shift ? moveSpeed * 2 : moveSpeed;
    if (keys.forward) velocity.add(cameraDirection.clone().multiplyScalar(currentSpeed));
    if (keys.backward) velocity.add(cameraDirection.clone().multiplyScalar(-currentSpeed));
    if (keys.right) velocity.add(cameraRight.clone().multiplyScalar(currentSpeed));
    if (keys.left) velocity.add(cameraRight.clone().multiplyScalar(-currentSpeed));
    if (velocity.lengthSq() > 0) {
      velocity.normalize().multiplyScalar(currentSpeed);
    }
    const oldPosition = player.position.clone();
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

  function animategrass(time) {
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

  function animate(time) {
    // Calculate delta time
  const now = performance.now() / 1000; // Convert to seconds
  const deltaTime = now - (lastTime || now);
  lastTime = now;

    requestAnimationFrame(animate);
    updatePlayerMovement();
    scrollingTextures.forEach(tex => tex.offset.y += 0.0005);
    animategrass(time);

    // Add to your existing animate function
windMaterials.forEach(material => {
    material.uniforms.u_windTime.value += material.uniforms.u_windSpeed.value * 0.016; // Approx for delta time
  });

    // Add this to update the tree animations
    fluffyTrees.forEach(tree => tree.update(deltaTime));

   // === Color cycle each light ===
   pointLights.forEach((light, i) => {
    hues[i] += 0.001; // control speed here
    if (hues[i] > 1) hues[i] = 0;
    light.color.setHSL(hues[i], 1, 0.5);
});
if (particleSystem && analyser) {
  analyser.getByteFrequencyData(audioDataArray);

  let avg = 0;
  for (let i = 0; i < audioDataArray.length; i++) {
    avg += audioDataArray[i];
  }
  avg /= audioDataArray.length;
  const pulse = avg / 256;

  // 🧪 Log what's going on
  console.log("Pulse:", pulse.toFixed(2), 
              "Size:", particleSystem.material.size.toFixed(2), 
              "Opacity:", particleSystem.material.opacity.toFixed(2));

  particleSystem.material.size = .5 + pulse * 1;
  particleSystem.material.opacity = .5 + pulse * 0.4;
  particleSystem.material.color.setHSL(pulse, 1.0, 1.0);

  particleSystem.rotation.y += 0.0005 + pulse * 0.003;
  particleSystem.position.y = Math.sin(performance.now() * 0.001) * (0.5 + pulse * 0.5);

  particleSystem.material.needsUpdate = true;
}

  renderer.render(scene, camera);
  }

function start() {
    setupScene();
    setupPlayer();
    loadModels();
    loadFluffyTrees().then(() => {
        console.log("Fluffy trees loaded successfully");
      }).catch(error => {
        console.error("Error loading fluffy trees:", error);
      });
    setTimeout(() => { /* Fix shadow artifacts */ }, 2000);
    requestAnimationFrame(animate);
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

  }

  start();
}
