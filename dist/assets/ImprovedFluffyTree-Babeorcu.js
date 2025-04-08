import{C as c,T as p,a as f,L as h,A as w,S as M,D as m,M as y,G as x,b,B as S,c as V,d as L,e as C}from"./index-BwfWob-B.js";class _{constructor(){this.material=null,this.uniforms={u_effectBlend:{value:1},u_inflate:{value:.2},u_scale:{value:1.5},u_windSpeed:{value:1},u_windTime:{value:0},diffuse:{value:new c(4353314)},opacity:{value:1},alphaMap:{value:null},ambientLightColor:{value:new c(4210752)},directionalLights:{value:[]},pointLights:{value:[]}},this.vertexShader=`
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
    `,this.fragmentShader=`
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
    `}async create(e){return new Promise((t,o)=>{const s=new p;console.log("Loading texture from:",e),s.load(e,a=>{console.log("Alpha texture loaded successfully"),a.wrapS=f,a.wrapT=f,a.minFilter=h,a.magFilter=h,a.needsUpdate=!0,this.uniforms.alphaMap.value=a;try{const n=new w(4210752,.6);this.uniforms.ambientLightColor.value=n.color.multiplyScalar(n.intensity)}catch{console.warn("Could not get scene lighting, using defaults")}const l=new M({uniforms:this.uniforms,vertexShader:this.vertexShader,fragmentShader:this.fragmentShader,side:m,transparent:!1,alphaTest:.5,depthWrite:!0});this.material=l,console.log("Shader material created successfully with texture and lighting"),t(this.material)},a=>{console.log(`Texture ${Math.round(a.loaded/a.total*100)}% loaded`)},a=>{console.error("Failed to load alpha texture:",a);const l=new y({color:4156705,side:m});this.material=l,console.warn("Using fallback material due to texture loading error"),t(this.material)})})}update(e){this.material&&this.material.uniforms&&this.material.uniforms.u_windTime&&(this.material.uniforms.u_windTime.value+=this.material.uniforms.u_windSpeed.value*e)}}class F{constructor(){this.loader=new x,this.foliageMaterial=new _,this.group=new b,this.shadowMesh=null,this.debug=!1}debugTreeModel(e){if(!this.debug)return;console.log("==== Tree Model Debug ===="),console.log("Number of children:",e.children.length);let t=0;e.traverse(o=>{o.isMesh&&(t++,console.log(`Mesh #${t}:`,{name:o.name,vertexCount:o.geometry.attributes.position.count,hasUvs:!!o.geometry.attributes.uv,position:o.position,material:o.material?o.material.type:"None"}))}),console.log("Total meshes found:",t),console.log("========================")}addDefaultUVs(e){console.log("Adding default UVs to geometry");const t=e.attributes.position,o=t.count,s=new Float32Array(o*2);for(let a=0;a<o;a++){const l=t.getX(a),n=t.getY(a);s[a*2]=(l+1)/2,s[a*2+1]=(n+1)/2}e.setAttribute("uv",new S(s,2)),console.log("Default UVs added to geometry")}async load(e,t,o=[0,0,0],s=[1,1,1],a=[0,0,0]){console.log(`Loading tree model from ${e} with texture ${t}`);const l=await this.foliageMaterial.create(t);return this.debug&&console.log("Foliage material created:",l),new Promise((n,v)=>{this.loader.load(e,u=>{const d=u.scene;this.debugTreeModel(d),this.group.position.set(...o),this.group.scale.set(...s),this.group.rotation.set(...a),d.traverse(i=>{if(i.isMesh)if(i.geometry.attributes.uv||(console.warn(`Mesh ${i.name} has no UVs, adding default UVs`),this.addDefaultUVs(i.geometry)),i.name.includes("trunk")||i.name==="trunk")i.material=new V({color:"#53523c",roughness:.9}),i.castShadow=!0,i.receiveShadow=!0,this.group.add(i.clone()),console.log("Added trunk to scene");else if(i.name.includes("foliage")||i.name==="foliage"){const r=i.clone();r.material=l,r.castShadow=!0,r.receiveShadow=!0,this.group.add(r),console.log("Added foliage mesh to scene with custom material"),this.createShadowMesh(i)}else{const r=i.clone();r.castShadow=!0,r.receiveShadow=!0,this.group.add(r)}}),console.log("Tree model loaded successfully"),n(this.group)},u=>{this.debug&&console.log(`Model ${Math.round(u.loaded/u.total*100)}% loaded`)},u=>{console.error("Error loading tree model:",u),v(u)})})}createShadowMesh(e){const t=e.geometry.clone(),o=new L({color:0,opacity:.6,transparent:!0});this.shadowMesh=new C(t,o),this.shadowMesh.castShadow=!0,this.shadowMesh.receiveShadow=!1,this.shadowMesh.position.copy(e.position),this.shadowMesh.rotation.copy(e.rotation),this.shadowMesh.scale.copy(e.scale),this.group.add(this.shadowMesh),console.log("Shadow mesh added")}update(e){this.foliageMaterial.update(e)}}export{F as ImprovedFluffyTree};
