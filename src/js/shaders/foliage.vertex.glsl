uniform float u_effectBlend;
uniform float u_inflate;
uniform float u_scale;
uniform float u_windSpeed;
uniform float u_windTime;

// Helper function to interpolate between values
float inverseLerp(float v, float minValue, float maxValue) {
  return (v - minValue) / (maxValue - minValue);
}

// Helper function to remap a value from one range to another
float remap(float v, float inMin, float inMax, float outMin, float outMax) {
  float t = inverseLerp(v, inMin, inMax);
  return mix(outMin, outMax, t);
}

// Rotation matrix for the wind effect
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

// Apply the wind effect
vec4 applyWind(vec4 v) {
  // Use the y component of the normal to determine how much wind affects the vertex
  float boundedYNormal = remap(normal.y, -1.0, 1.0, 0.0, 1.0);
  
  // Create some variation based on position
  float posXZ = position.x + position.z;
  float power = u_windSpeed / 5.0 * -0.5;

  // Calculate different wind strengths for top and bottom facing parts
  float topFacing = remap(sin(u_windTime + posXZ), -1.0, 1.0, 0.0, power);
  float bottomFacing = remap(cos(u_windTime + posXZ), -1.0, 1.0, 0.0, 0.05);
  
  // Mix between the two based on normal direction
  float radians = mix(bottomFacing, topFacing, boundedYNormal);

  // Apply rotation
  return rotateZ(radians) * v;
}

// Calculate the initial offset based on UV coordinates
vec2 calcInitialOffsetFromUVs() {
  // Remap UVs from [0,1] to [-1,1]
  vec2 offset = vec2(
    remap(uv.x, 0.0, 1.0, -1.0, 1.0),
    remap(uv.y, 0.0, 1.0, -1.0, 1.0)
  );

  // Invert the x offset so it's positioned towards the camera
  offset *= vec2(-1.0, 1.0);
  
  // Normalize and scale
  offset = normalize(offset) * u_scale;

  return offset;
}

// Add inflation along normals for volume
vec3 inflateOffset(vec3 offset) {
  return offset + normal.xyz * u_inflate;
}

void main() {
  // Calculate offset based on UVs
  vec2 vertexOffset = calcInitialOffsetFromUVs();

  // Add inflation along normals
  vec3 inflatedVertexOffset = inflateOffset(vec3(vertexOffset, 0.0));

  // Transform vertex to view space
  vec4 worldViewPosition = modelViewMatrix * vec4(position, 1.0);

  // Apply the offset with blend factor
  worldViewPosition += vec4(mix(vec3(0.0), inflatedVertexOffset, u_effectBlend), 0.0);

  // Apply wind animation
  worldViewPosition = applyWind(worldViewPosition);

  // Set the final position
  gl_Position = projectionMatrix * worldViewPosition;
}