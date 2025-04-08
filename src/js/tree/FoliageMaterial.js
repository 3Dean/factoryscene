import * as THREE from 'three';

export class FoliageMaterial {
  constructor() {
    this.material = null;
    
    // Define the vertex shader directly here
    this.vertexShader = `
      uniform float u_windTime;
      
      // Simpler version for testing
      void main() {
        // Get camera-facing direction
        vec3 cameraDir = normalize(cameraPosition - position);
        
        // Create billboarding effect
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), cameraDir));
        vec3 up = cross(cameraDir, right);
        
        // Offset based on UV
        vec2 offset = (uv - 0.5) * 2.0;
        
        // Add wind animation
        float wind = sin(u_windTime + position.x + position.z) * 0.1;
        
        // Transform position
        vec4 finalPosition = modelViewMatrix * vec4(position, 1.0);
        
        // Apply billboarding and wind
        finalPosition.xyz += (right * offset.x + up * offset.y) * 0.5;
        finalPosition.x += wind;
        
        // Project to clip space
        gl_Position = projectionMatrix * finalPosition;
      }
    `;
    
    // Define a minimal fragment shader
    this.fragmentShader = `
      uniform vec3 diffuse;
      uniform float opacity;
      
      void main() {
        gl_FragColor = vec4(diffuse, opacity);
      }
    `;
  }
  
  create(alphaMapUrl) {
    console.log("Creating foliage material with texture:", alphaMapUrl);
    
    // Create a basic green color material first as a fallback
    const baseMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x3f6d21,
      side: THREE.DoubleSide
    });
    
    // Try to load the alpha texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      alphaMapUrl, 
      // Success callback
      (texture) => {
        console.log("Alpha texture loaded successfully");
        
        // Create the shader material
        const shaderMaterial = new THREE.ShaderMaterial({
          uniforms: {
            diffuse: { value: new THREE.Color(0x3f6d21) },
            opacity: { value: 1.0 },
            u_windTime: { value: 0.0 }
          },
          vertexShader: this.vertexShader,
          fragmentShader: this.fragmentShader,
          side: THREE.DoubleSide
        });
        
        // Replace the material on all meshes that use this material
        this.material = shaderMaterial;
        console.log("Shader material created successfully");
      },
      // Progress callback
      undefined,
      // Error callback
      (error) => {
        console.error("Failed to load alpha texture:", error);
        // Use the basic material as fallback
        this.material = baseMaterial;
      }
    );
    
    // Return the base material initially, it will be updated when texture loads
    this.material = baseMaterial;
    return this.material;
  }
  
  update(deltaTime) {
    if (this.material && this.material.uniforms && this.material.uniforms.u_windTime) {
      this.material.uniforms.u_windTime.value += deltaTime;
    }
  }
}