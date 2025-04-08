import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// A simpler approach that uses standard materials with alpha maps
export class SimpleFluffyTree {
  constructor() {
    this.loader = new GLTFLoader();
    this.group = new THREE.Group();
    this.foliageMeshes = [];
    this.windTime = 0;
    this.windSpeed = 1.0;
  }
  
  debugTreeModel(model) {
    console.log("==== Tree Model Debug ====");
    console.log("Number of children:", model.children.length);
    
    let meshCount = 0;
    model.traverse(node => {
      if (node.isMesh) {
        meshCount++;
        console.log(`Mesh #${meshCount}:`, {
          name: node.name,
          vertexCount: node.geometry.attributes.position.count,
          hasUVs: !!node.geometry.attributes.uv,
          position: node.position,
          material: node.material ? node.material.type : "None"
        });
      }
    });
    
    console.log("Total meshes found:", meshCount);
    console.log("========================");
  }
  
  async load(modelUrl, alphaMapUrl, position = [0, 0, 0], scale = [1, 1, 1]) {
    // Set the tree position and scale
    this.group.position.set(...position);
    this.group.scale.set(...scale);
    
    return new Promise((resolve, reject) => {
      // First load the alpha texture
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(alphaMapUrl, (alphaTexture) => {
        console.log("Alpha texture loaded for SimpleFluffyTree");
        
        // Set proper texture parameters
        alphaTexture.wrapS = THREE.ClampToEdgeWrapping;
        alphaTexture.wrapT = THREE.ClampToEdgeWrapping;
        alphaTexture.minFilter = THREE.LinearFilter;
        
        // Now load the model
        this.loader.load(modelUrl, (gltf) => {
          const model = gltf.scene;
          this.debugTreeModel(model);
          
          // Extract the trunk mesh and foliage mesh
          let trunkMesh = null;
          let foliageMesh = null;
          
          model.traverse((node) => {
            if (node.isMesh) {
              if (node.name.includes('trunk') || node.name === 'trunk') {
                trunkMesh = node;
              } else if (node.name.includes('foliage') || node.name === 'foliage') {
                foliageMesh = node;
              }
            }
          });
          
          // Add the trunk with standard material
          if (trunkMesh) {
            const trunk = trunkMesh.clone();
            trunk.material = new THREE.MeshStandardMaterial({
              color: '#4a2e0f',
              roughness: 0.9
            });
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            this.group.add(trunk);
          }
          
          // If we found a foliage mesh, create our billboard quads
          if (foliageMesh || trunkMesh) {
            this.createBillboardFoliage(
              trunkMesh || foliageMesh, // Use either mesh as reference
              alphaTexture
            );
          }
          
          resolve(this.group);
        }, undefined, reject);
      }, undefined, (error) => {
        console.error("Failed to load alpha texture:", error);
        reject(error);
      });
    });
  }
  
  createBillboardFoliage(referenceMesh, alphaTexture) {
    // Get a bounding box of the reference mesh to properly position foliage
    const bbox = new THREE.Box3().setFromObject(referenceMesh);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    
    // Create a standard material with alpha map
    const material = new THREE.MeshStandardMaterial({
      color: '#3f6d21',
      alphaMap: alphaTexture,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide
    });
    
    // Create multiple billboard quads around the center
    const quadWidth = size.x * 2;
    const quadHeight = size.y * 1.5;
    const quadGeometry = new THREE.PlaneGeometry(quadWidth, quadHeight);
    
    // Create 6 billboards around the center point
    const numBillboards = 6;
    const heightOffset = size.y * 0.3; // Place billboards above the base
    
    for (let i = 0; i < numBillboards; i++) {
      const angle = (i / numBillboards) * Math.PI * 2;
      const distance = size.x * 0.4; // Distance from center
      
      const billboard = new THREE.Mesh(quadGeometry, material.clone());
      
      // Position around the center
      billboard.position.set(
        center.x + Math.sin(angle) * distance,
        center.y + heightOffset,
        center.z + Math.cos(angle) * distance
      );
      
      // Rotate to face outward from center
      billboard.rotation.y = angle;
      
      // Add some random variation to make it look more natural
      billboard.rotation.x = (Math.random() - 0.5) * 0.2;
      billboard.rotation.z = (Math.random() - 0.5) * 0.2;
      
      // Store original rotation for animation
      billboard.userData.originalRotation = billboard.rotation.clone();
      billboard.userData.angle = angle;
      billboard.userData.heightOffset = heightOffset;
      
      // Make sure billboards cast and receive shadows
      billboard.castShadow = true;
      billboard.receiveShadow = true;
      
      this.foliageMeshes.push(billboard);
      this.group.add(billboard);
    }
    
    console.log(`Created ${numBillboards} foliage billboards`);
  }
  
  update(deltaTime) {
    // Update wind time
    this.windTime += deltaTime;
    
    // Animate each foliage billboard
    for (const mesh of this.foliageMeshes) {
      const origRotation = mesh.userData.originalRotation;
      const angle = mesh.userData.angle || 0;
      
      // Apply wind effect
      const windStrength = 0.1;
      const windX = Math.sin(this.windTime + angle * 2) * windStrength;
      const windZ = Math.cos(this.windTime * 0.7 + angle) * windStrength * 0.5;
      
      // Apply wind by modifying rotation from original values
      mesh.rotation.x = origRotation.x + windX;
      mesh.rotation.z = origRotation.z + windZ;
      
      // Optionally add some position swaying for more organic feel
      if (mesh.userData.heightOffset) {
        const swayAmount = 0.03;
        mesh.position.y = mesh.position.y + Math.sin(this.windTime * 0.5 + angle) * swayAmount;
      }
    }
  }
}