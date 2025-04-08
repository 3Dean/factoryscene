import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ImprovedFoliageMaterial } from './ImprovedFoliageMaterial.js';

export class ImprovedFluffyTree {
  constructor() {
    this.loader = new GLTFLoader();
    this.foliageMaterial = new ImprovedFoliageMaterial();
    this.group = new THREE.Group();
    this.shadowMesh = null;
    this.debug = false; // Set to false to disable debug logs
  }
  
  // Debug function
  debugTreeModel(model) {
    if (!this.debug) return;
    
    console.log("==== Tree Model Debug ====");
    console.log("Number of children:", model.children.length);
    
    let meshCount = 0;
    model.traverse(node => {
      if (node.isMesh) {
        meshCount++;
        console.log(`Mesh #${meshCount}:`, {
          name: node.name,
          vertexCount: node.geometry.attributes.position.count,
          hasUvs: !!node.geometry.attributes.uv,
          position: node.position,
          material: node.material ? node.material.type : "None"
        });
      }
    });
    
    console.log("Total meshes found:", meshCount);
    console.log("========================");
  }
  
  // Add default UVs if missing
  addDefaultUVs(geometry) {
    console.log("Adding default UVs to geometry");
    const positions = geometry.attributes.position;
    const count = positions.count;
    const uvs = new Float32Array(count * 2);
    
    // Create UVs based on normalized position
    for (let i = 0; i < count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      
      // Simple planar mapping
      uvs[i * 2] = (x + 1) / 2;    // U coordinate
      uvs[i * 2 + 1] = (y + 1) / 2; // V coordinate
    }
    
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    console.log("Default UVs added to geometry");
  }
  
  async load(modelUrl, alphaMapUrl, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
    console.log(`Loading tree model from ${modelUrl} with texture ${alphaMapUrl}`);
    
    // Create the foliage material
    const material = await this.foliageMaterial.create(alphaMapUrl);
    
    if (this.debug) {
      console.log("Foliage material created:", material);
      // No debug texture call here
    }
    
    // Load the tree model
    return new Promise((resolve, reject) => {
      this.loader.load(modelUrl, (gltf) => {
        const model = gltf.scene;
        
        // Debug model structure
        this.debugTreeModel(model);
        
        // Set the model position and scale
        this.group.position.set(...position);
        this.group.scale.set(...scale);
        this.group.rotation.set(...rotation);
        
        // Process the model
        model.traverse((node) => {
          if (node.isMesh) {
            // Ensure mesh has UVs for texture mapping
            if (!node.geometry.attributes.uv) {
              console.warn(`Mesh ${node.name} has no UVs, adding default UVs`);
              this.addDefaultUVs(node.geometry);
            }
            
            if (node.name.includes('trunk') || node.name === 'trunk') {
              // Apply the trunk material
              node.material = new THREE.MeshStandardMaterial({
                color: '#53523c',
                roughness: 0.9
              });
              node.castShadow = true;
              node.receiveShadow = true;
              this.group.add(node.clone());
              console.log("Added trunk to scene");
            } else if (node.name.includes('foliage') || node.name === 'foliage') {
              // Apply the foliage material
              const foliageMesh = node.clone();
              
              foliageMesh.material = material;
              foliageMesh.castShadow = true;
              foliageMesh.receiveShadow = true;
              this.group.add(foliageMesh);
              console.log("Added foliage mesh to scene with custom material");
              
              // Create a shadow-only mesh
              this.createShadowMesh(node);
            } else {
              // For any other mesh, clone it with its original material
              const meshClone = node.clone();
              meshClone.castShadow = true;
              meshClone.receiveShadow = true;
              this.group.add(meshClone);
            }
          }
        });
        
        console.log("Tree model loaded successfully");
        resolve(this.group);
      }, 
      // Progress callback
      (xhr) => {
        if (this.debug) {
          console.log(`Model ${Math.round(xhr.loaded / xhr.total * 100)}% loaded`);
        }
      }, 
      // Error callback
      (error) => {
        console.error("Error loading tree model:", error);
        reject(error);
      });
    });
  }
  
  createShadowMesh(node) {
    // Clone the geometry for the shadow
    const shadowGeometry = node.geometry.clone();
    
    // Create a shadow material
    const shadowMaterial = new THREE.ShadowMaterial({
      color: 0x000000,
      opacity: 0.6,
      transparent: true
    });
    
    // Create the shadow mesh
    this.shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
    this.shadowMesh.castShadow = true;
    this.shadowMesh.receiveShadow = false;
    
    // Copy the transform
    this.shadowMesh.position.copy(node.position);
    this.shadowMesh.rotation.copy(node.rotation);
    this.shadowMesh.scale.copy(node.scale);
    
    // Add to the group
    this.group.add(this.shadowMesh);
    console.log("Shadow mesh added");
  }
  
  update(deltaTime) {
    this.foliageMaterial.update(deltaTime);
  }
}