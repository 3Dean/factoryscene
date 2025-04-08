import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FoliageMaterial } from './FoliageMaterial.js';



export class FluffyTree {
  constructor() {
    this.loader = new GLTFLoader();
    this.foliageMaterial = new FoliageMaterial();
    this.group = new THREE.Group();
    this.shadowMesh = null;
  }

  // Add the debug function here
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
          position: node.position,
          material: node.material ? node.material.type : "None"
        });
      }
    });
    
    console.log("Total meshes found:", meshCount);
    console.log("========================");
  }
  
  async load(modelUrl, alphaMapUrl, position = [0, 0, 0], scale = [1, 1, 1]) {
    // Create the foliage material
    const material = await this.foliageMaterial.create(alphaMapUrl);

    console.log("Foliage material:", material);
    
    // Load the tree model
    return new Promise((resolve, reject) => {
      this.loader.load(modelUrl, (gltf) => {
 
        const model = gltf.scene;

        this.debugTreeModel(model); // Call the debug function here
        
        // Set the model position and scale
        this.group.position.set(...position);
        this.group.scale.set(...scale);
        
        // Process the model
        model.traverse((node) => {
          if (node.isMesh) {
            if (node.name.includes('trunk')) {
              // Apply the trunk material
              node.material = new THREE.MeshStandardMaterial({
                color: '#4a2e0f',
                roughness: 0.9
              });
              node.castShadow = true;
              node.receiveShadow = true;
              this.group.add(node.clone());
            } else if (node.name.includes('foliage')) {
              // Apply the foliage material
              const foliageMesh = node.clone();
              foliageMesh.material = material;
              foliageMesh.castShadow = false;
              foliageMesh.receiveShadow = true;
              this.group.add(foliageMesh);
              
              // Create a shadow-only mesh
              this.createShadowMesh(node);
            }
          }
        });
        
        resolve(this.group);
      }, undefined, reject);
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
  }
  
  update(deltaTime) {
    this.foliageMaterial.update(deltaTime);
  }

  
}