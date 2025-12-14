// Voxel rendering shader with instancing, shadows, and wind animation

struct Uniforms {
  viewProj: mat4x4f,
  lightViewProj: mat4x4f,
  cameraPos: vec4f,      // xyz = position, w = time
  lightDir: vec4f,       // xyz = direction, w = ambient strength
  lightColor: vec4f,     // xyz = color, w = unused
}

struct InstanceData {
  transform: mat4x4f,
  color: vec4f,
  emission: f32,
  flags: f32,  // Stored as float, cast to u32 when needed
  _pad0: f32,
  _pad1: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> instances: array<InstanceData>;
@group(0) @binding(2) var shadowMap: texture_depth_2d;
@group(0) @binding(3) var shadowSampler: sampler_comparison;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @builtin(instance_index) instanceIdx: u32,
}

struct VertexOutput {
  @builtin(position) clipPos: vec4f,
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
  @location(2) color: vec4f,
  @location(3) shadowCoord: vec4f,
  @location(4) emission: f32,
}

// Flags
const FLAG_WATER: u32 = 1u;
const FLAG_FOLIAGE: u32 = 2u;
const FLAG_CLOUD: u32 = 4u;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let instance = instances[input.instanceIdx];
  var localPos = input.position;
  let flags = u32(instance.flags);

  // Wind animation for foliage
  if ((flags & FLAG_FOLIAGE) != 0u) {
    // Get world position for wind variation
    let worldBase = instance.transform[3].xyz;
    let time = uniforms.cameraPos.w;
    let windPhase = worldBase.x * 0.5 + worldBase.z * 0.3 + time * 2.0;
    let windStrength = 0.1 * (localPos.y + 0.5); // Stronger at top
    localPos.x += sin(windPhase) * windStrength;
    localPos.z += cos(windPhase * 0.7) * windStrength * 0.5;
  }

  // Cloud gentle bobbing
  if ((flags & FLAG_CLOUD) != 0u) {
    let time = uniforms.cameraPos.w;
    let cloudPhase = time * 0.5 + instance.transform[3].x * 0.2;
    localPos.y += sin(cloudPhase) * 0.05;
  }

  let worldPos = (instance.transform * vec4f(localPos, 1.0)).xyz;
  let worldNormal = normalize((instance.transform * vec4f(input.normal, 0.0)).xyz);

  output.clipPos = uniforms.viewProj * vec4f(worldPos, 1.0);
  output.worldPos = worldPos;
  output.normal = worldNormal;
  output.color = instance.color;
  output.emission = instance.emission;

  // Shadow coordinates
  let shadowClip = uniforms.lightViewProj * vec4f(worldPos, 1.0);
  output.shadowCoord = vec4f(
    shadowClip.xy * vec2f(0.5, -0.5) + vec2f(0.5),
    shadowClip.z,
    shadowClip.w
  );

  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let N = normalize(input.normal);
  let L = normalize(-uniforms.lightDir.xyz);

  // Diffuse lighting
  let NdotL = max(dot(N, L), 0.0);

  // Soft shadow sampling (PCF 3x3)
  var shadow = 0.0;
  let shadowCoord = input.shadowCoord.xyz / input.shadowCoord.w;
  let texelSize = 1.0 / 1024.0; // Shadow map resolution

  for (var x = -1; x <= 1; x++) {
    for (var y = -1; y <= 1; y++) {
      let offset = vec2f(f32(x), f32(y)) * texelSize;
      shadow += textureSampleCompare(
        shadowMap,
        shadowSampler,
        shadowCoord.xy + offset,
        shadowCoord.z - 0.005 // Bias
      );
    }
  }
  shadow /= 9.0;

  // Ambient + diffuse with shadow
  let ambient = uniforms.lightDir.w;  // ambient strength stored in lightDir.w
  let diffuse = NdotL * shadow;
  let lighting = ambient + diffuse * (1.0 - ambient);

  // Base color with lighting
  var finalColor = input.color.rgb * uniforms.lightColor.rgb * lighting;

  // Add emission glow
  if (input.emission > 0.0) {
    finalColor += input.color.rgb * input.emission;
  }

  // Simple ambient occlusion - darken bottom-facing surfaces
  let aoFactor = 0.5 + 0.5 * max(N.y, 0.0);
  finalColor *= aoFactor;

  // Tone mapping (simple Reinhard)
  finalColor = finalColor / (finalColor + vec3f(1.0));

  // Gamma correction
  finalColor = pow(finalColor, vec3f(1.0 / 2.2));

  return vec4f(finalColor, input.color.a);
}

// Shadow pass vertex shader
@vertex
fn vs_shadow(input: VertexInput) -> @builtin(position) vec4f {
  let instance = instances[input.instanceIdx];
  var localPos = input.position;
  let flags = u32(instance.flags);

  // Apply same wind animation for consistent shadows
  if ((flags & FLAG_FOLIAGE) != 0u) {
    let worldBase = instance.transform[3].xyz;
    let time = uniforms.cameraPos.w;
    let windPhase = worldBase.x * 0.5 + worldBase.z * 0.3 + time * 2.0;
    let windStrength = 0.1 * (localPos.y + 0.5);
    localPos.x += sin(windPhase) * windStrength;
    localPos.z += cos(windPhase * 0.7) * windStrength * 0.5;
  }

  let worldPos = (instance.transform * vec4f(localPos, 1.0)).xyz;
  return uniforms.lightViewProj * vec4f(worldPos, 1.0);
}
