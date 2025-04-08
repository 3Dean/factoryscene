// A simple utility to test texture loading in the browser
// You can include this in your HTML to debug texture issues

export class TextureDebugger {
    constructor() {
      this.container = null;
      this.createUI();
    }
    
    createUI() {
      // Create container
      this.container = document.createElement('div');
      this.container.style.position = 'fixed';
      this.container.style.bottom = '10px';
      this.container.style.right = '10px';
      this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      this.container.style.padding = '10px';
      this.container.style.borderRadius = '5px';
      this.container.style.zIndex = '1000';
      this.container.style.color = 'white';
      this.container.style.fontFamily = 'monospace';
      
      // Create header
      const header = document.createElement('h3');
      header.textContent = 'Texture Debugger';
      header.style.margin = '0 0 10px 0';
      this.container.appendChild(header);
      
      // Create input for texture URL
      const urlInput = document.createElement('input');
      urlInput.type = 'text';
      urlInput.placeholder = 'Texture URL';
      urlInput.value = '/assets/textures/foliage_alpha.png';
      urlInput.style.width = '100%';
      urlInput.style.marginBottom = '10px';
      urlInput.style.padding = '5px';
      this.container.appendChild(urlInput);
      
      // Create load button
      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'Load & Test Texture';
      loadBtn.style.padding = '5px 10px';
      loadBtn.style.marginRight = '5px';
      loadBtn.onclick = () => this.loadTexture(urlInput.value);
      this.container.appendChild(loadBtn);
      
      // Create show/hide button
      const toggleBtn = document.createElement('button');
      toggleBtn.textContent = 'Hide Preview';
      toggleBtn.style.padding = '5px 10px';
      toggleBtn.onclick = () => this.togglePreview();
      this.container.appendChild(toggleBtn);
      
      // Create results container
      const results = document.createElement('div');
      results.id = 'texture-debug-results';
      results.style.marginTop = '10px';
      results.style.maxHeight = '300px';
      results.style.overflowY = 'auto';
      this.container.appendChild(results);
      
      // Create image preview container
      const preview = document.createElement('div');
      preview.id = 'texture-preview';
      preview.style.marginTop = '10px';
      preview.style.maxWidth = '200px';
      preview.style.maxHeight = '200px';
      preview.style.overflow = 'hidden';
      preview.style.border = '1px solid #666';
      preview.style.display = 'flex';
      preview.style.alignItems = 'center';
      preview.style.justifyContent = 'center';
      this.container.appendChild(preview);
      
      // Add to DOM
      document.body.appendChild(this.container);
      
      console.log('Texture Debugger UI created');
    }
    
    loadTexture(url) {
      const resultsEl = document.getElementById('texture-debug-results');
      const previewEl = document.getElementById('texture-preview');
      
      resultsEl.innerHTML = '<p>Loading texture...</p>';
      previewEl.innerHTML = '';
      
      // Create both an Image element and use THREE.js TextureLoader
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // Log image load result
      img.onload = () => {
        resultsEl.innerHTML += `
          <p style="color: #7f7">✓ Image loaded successfully via Image API</p>
          <p>Dimensions: ${img.width} × ${img.height}</p>
        `;
        
        // Show the image
        const imgPreview = document.createElement('img');
        imgPreview.src = url;
        imgPreview.style.maxWidth = '100%';
        imgPreview.style.maxHeight = '100%';
        previewEl.appendChild(imgPreview);
        
        // Test with THREE.js
        this.loadWithThree(url);
      };
      
      img.onerror = (err) => {
        resultsEl.innerHTML += `
          <p style="color: #f77">✗ Image failed to load via Image API</p>
          <p>Error: ${err.message || 'Unknown error'}</p>
        `;
      };
      
      img.src = url;
    }
    
    loadWithThree(url) {
      const resultsEl = document.getElementById('texture-debug-results');
      
      try {
        // Dynamically import THREE.js
        import('three').then(THREE => {
          const textureLoader = new THREE.TextureLoader();
          
          textureLoader.load(
            url,
            (texture) => {
              resultsEl.innerHTML += `
                <p style="color: #7f7">✓ Texture loaded successfully via THREE.TextureLoader</p>
                <p>THREE UUID: ${texture.uuid}</p>
                <p>Image dimensions: ${texture.image.width} × ${texture.image.height}</p>
              `;
              
              // Test using the texture in a simple material
              this.testInShader(THREE, texture);
            },
            (xhr) => {
              resultsEl.innerHTML += `
                <p>Loading: ${Math.round(xhr.loaded / xhr.total * 100)}%</p>
              `;
            },
            (error) => {
              resultsEl.innerHTML += `
                <p style="color: #f77">✗ Texture failed to load via THREE.TextureLoader</p>
                <p>Error: ${error.message || 'Unknown error'}</p>
              `;
            }
          );
        }).catch(err => {
          resultsEl.innerHTML += `
            <p style="color: #f77">✗ Could not import THREE.js</p>
            <p>Error: ${err.message || 'Unknown error'}</p>
          `;
        });
      } catch (e) {
        resultsEl.innerHTML += `
          <p style="color: #f77">✗ Error testing with THREE.js</p>
          <p>Error: ${e.message || 'Unknown error'}</p>
        `;
      }
    }
    
    testInShader(THREE, texture) {
      const resultsEl = document.getElementById('texture-debug-results');
      
      try {
        // Create a very simple shader material that just displays the texture
        const testMaterial = new THREE.ShaderMaterial({
          uniforms: {
            alphaMap: { value: texture }
          },
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform sampler2D alphaMap;
            varying vec2 vUv;
            void main() {
              vec4 texColor = texture2D(alphaMap, vUv);
              gl_FragColor = vec4(texColor.rgb, texColor.a);
            }
          `
        });
        
        // If we got this far, the shader compiled successfully
        resultsEl.innerHTML += `
          <p style="color: #7f7">✓ Shader compiled successfully with texture</p>
        `;
      } catch (e) {
        resultsEl.innerHTML += `
          <p style="color: #f77">✗ Error creating shader with texture</p>
          <p>Error: ${e.message || 'Unknown error'}</p>
        `;
      }
    }
    
    togglePreview() {
      const previewEl = document.getElementById('texture-preview');
      if (previewEl.style.display === 'none') {
        previewEl.style.display = 'flex';
        document.querySelector('button:nth-of-type(2)').textContent = 'Hide Preview';
      } else {
        previewEl.style.display = 'none';
        document.querySelector('button:nth-of-type(2)').textContent = 'Show Preview';
      }
    }
    
    // Call this to remove the debugger from the DOM
    destroy() {
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    }
  }
  
  // This will automatically create the debugger when the script is imported
  // const textureDebugger = new TextureDebugger();