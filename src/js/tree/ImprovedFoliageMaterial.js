import * as THREE from 'three';

export class ImprovedFoliageMaterial {
  constructor() {
    this.material = null;
    this.uniforms = {
      u_effectBlend: { value: 1.0 },
      u_inflate: { value: 0.2 },
      u_scale: { value: 1.5 },
      u_windSpeed: { value: 1.0 },
      u_windTime: { value: 0.0 },
      diffuse: { value: new THREE.Color(0x426d22) },
      opacity: { value: 1.0 },
      alphaMap: { value: null },
      // Add lighting uniforms
      ambientLightColor: { value: new THREE.Color(0x404040) },
      directionalLights: { value: [] },
      pointLights: { value: [] }
    };
    
    // Define the vertex shader with lighting calculations
    this.vertexShader = `
      uniform float u_effectBlend;
      uniform float u_inflate;
      uniform float u_scale;
      uniform float u_windSpeed;
      uniform float u_windTime;
      
      // Add needed lighting variables
      varying vec3 vViewPosition;
      varying vec3 vNormal;
      varying vec2 vUv;
      
      // Helper functions for effect
      float inverseLerp(float v, float minValue, float maxValue) {
        return (v - minValue) / (maxValue - minValue);
      }
      
      float remap(float v, float inMin, float inMax, float outMin, float outMax) {
        float t = inverseLerp(v, inMin, inMax);
        return mix(outMin, outMax, t);
      }
      
      mat4 rotateZ(float radians) {
        float c = cos(radians);
        float s = sin(radians);
      
        return mat4(
          c, -s, 0, 0,
          s, c, 0, 0,
          0, 0, 1, 0,
          0, 0, 0, 1
        );
      }
      
      vec4 applyWind(vec4 v) {
        float boundedYNormal = remap(normal.y, -1.0, 1.0, 0.0, 1.0);
        float posXZ = position.x + position.z;
        float power = u_windSpeed / 5.0 * -0.5;
      
        float topFacing = remap(sin(u_windTime + posXZ), -1.0, 1.0, 0.0, power);
        float bottomFacing = remap(cos(u_windTime + posXZ), -1.0, 1.0, 0.0, 0.05);
        float radians = mix(bottomFacing, topFacing, boundedYNormal);
      
        return rotateZ(radians) * v;
      }
      
      vec2 calcInitialOffsetFromUVs() {
        vec2 offset = vec2(
          remap(uv.x, 0.0, 1.0, -1.0, 1.0),
          remap(uv.y, 0.0, 1.0, -1.0, 1.0)
        );
      
        offset *= vec2(-1.0, 1.0);
        offset = normalize(offset) * u_scale;
      
        return offset;
      }
      
      vec3 inflateOffset(vec3 offset) {
        return offset + normal.xyz * u_inflate;
      }
      
      void main() {
        // Pass data to fragment shader
        vUv = uv;
        
        // Calculate the offset
        vec2 vertexOffset = calcInitialOffsetFromUVs();
        vec3 inflatedVertexOffset = inflateOffset(vec3(vertexOffset, 0.0));
        
        // Transform vertex to view space
        vec4 worldViewPosition = modelViewMatrix * vec4(position, 1.0);
        
        // Apply the offset with blend factor
        worldViewPosition += vec4(mix(vec3(0.0), inflatedVertexOffset, u_effectBlend), 0.0);
        
        // Apply wind animation
        worldViewPosition = applyWind(worldViewPosition);
        
        // Set values needed for lighting
        vViewPosition = -worldViewPosition.xyz;
        vNormal = normalMatrix * normal;
        
        // Set the final position
        gl_Position = projectionMatrix * worldViewPosition;
      }
    `;
    
    // Define a fragment shader with lighting
    this.fragmentShader = `
      uniform vec3 diffuse;
      uniform float opacity;
      uniform sampler2D alphaMap;
      
      // Lighting uniforms
      uniform vec3 ambientLightColor;
      
      // Add varying variables from vertex shader
      varying vec3 vViewPosition;
      varying vec3 vNormal;
      varying vec2 vUv;
      
void main() {
  // Sample the texture (single channel grayscale)
  vec4 texColor = texture2D(alphaMap, vUv);
  
  // For grayscale images, all RGB channels have the same value
  // We'll use the red channel as our alpha mask
  float alpha = texColor.r; // Use red channel from grayscale image
  
  // Binary cutout approach
  if (alpha < 0.5) discard; // Discard transparent pixels
  
  // Calculate lighting
  vec3 normal = normalize(vNormal);
  
  // Simple ambient light
  vec3 lightColor = ambientLightColor;
  
  // Add directional light effect
  vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
  float diff = max(dot(normal, lightDir), 0.0);
  
  // Create a gradient from top to bottom for extra volume
  float gradient = mix(0.7, 1.0, dot(normal, vec3(0.0, 1.0, 0.0)));
  
  // Add some side illumination 
  float rimLight = max(0.0, dot(normalize(vViewPosition), normal));
  rimLight = pow(1.0 - rimLight, 3.0) * 0.3;
  
  // Final lighting calculation
  vec3 litColor = diffuse * (lightColor + diff + rimLight) * gradient;
  
  // With cutout technique, we use full opacity
  gl_FragColor = vec4(litColor, 1.0);
}
    `;
  }
  
  async create(alphaMapUrl) {
    return new Promise((resolve, reject) => {
      // Load the alpha texture
      const textureLoader = new THREE.TextureLoader();
      
      console.log("Loading texture from:", alphaMapUrl);
      
      textureLoader.load(
        alphaMapUrl, 
        (texture) => {
          console.log("Alpha texture loaded successfully");
          
          // Ensure texture settings are correct
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          
          // Set this for a grayscale texture used as alpha
          //texture.format = THREE.LuminanceFormat; // Important for grayscale!
          texture.needsUpdate = true;
          
          // Update the uniform with the loaded texture
          this.uniforms.alphaMap.value = texture;
          
          // Get environment lighting from scene if possible
          try {
            const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
            this.uniforms.ambientLightColor.value = ambientLight.color.multiplyScalar(ambientLight.intensity);
          } catch (error) {
            console.warn("Could not get scene lighting, using defaults");
          }
          
          // Create the shader material
          const shaderMaterial = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
      side: THREE.DoubleSide,
      transparent: false, // Using cutout approach
      alphaTest: 0.5,     // Higher threshold for clean edges
      depthWrite: true
          });
          
          this.material = shaderMaterial;
          console.log("Shader material created successfully with texture and lighting");
          resolve(this.material);
        },
        // Progress callback
        (xhr) => {
          console.log(`Texture ${Math.round(xhr.loaded / xhr.total * 100)}% loaded`);
        },
        // Error callback
        (error) => {
          console.error("Failed to load alpha texture:", error);
          
          // Create a simple colored material as fallback
          const fallbackMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x3f6d21,
            side: THREE.DoubleSide
          });
          
          this.material = fallbackMaterial;
          console.warn("Using fallback material due to texture loading error");
          resolve(this.material);
        }
      );
    });
  }
  
  update(deltaTime) {
    if (this.material && this.material.uniforms && this.material.uniforms.u_windTime) {
      this.material.uniforms.u_windTime.value += this.material.uniforms.u_windSpeed.value * deltaTime;
    }
  }
}