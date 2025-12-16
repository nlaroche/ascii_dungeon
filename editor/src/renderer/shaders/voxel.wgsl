// Voxel rendering shader with instancing, shadows, and enhanced lighting

struct Uniforms {
  viewProj: mat4x4f,
  lightViewProj: mat4x4f,
  cameraPos: vec4f,        // xyz = position, w = time
  mainLightDir: vec4f,     // xyz = direction, w = intensity
  mainLightColor: vec4f,   // xyz = color, w = shadowEnabled (0.0 or 1.0)
  fillLightDir: vec4f,     // xyz = direction, w = intensity
  fillLightColor: vec4f,   // xyz = color, w = unused
  ambientSky: vec4f,       // hemisphere ambient - sky color
  ambientGround: vec4f,    // hemisphere ambient - ground color
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

  // Pass raw light-space clip coordinates - do UV conversion in fragment shader
  output.shadowCoord = uniforms.lightViewProj * vec4f(worldPos, 1.0);

  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let N = normalize(input.normal);
  let V = normalize(uniforms.cameraPos.xyz - input.worldPos);

  // Main directional light
  let mainL = normalize(-uniforms.mainLightDir.xyz);
  let mainNdotL = max(dot(N, mainL), 0.0);
  let mainIntensity = uniforms.mainLightDir.w;

  // Shadow calculation - check if shadows are enabled
  var shadow = 1.0; // Default: fully lit (no shadow)
  let shadowEnabled = uniforms.mainLightColor.w;

  if (shadowEnabled > 0.5) {
    // Convert from clip space to NDC
    let shadowNDC = input.shadowCoord.xyz / input.shadowCoord.w;

    // Convert from NDC [-1,1] to texture UV [0,1]
    let shadowUV = vec2f(
      shadowNDC.x * 0.5 + 0.5,
      shadowNDC.y * -0.5 + 0.5
    );
    let shadowDepth = shadowNDC.z;

    // Bias to prevent self-shadowing (add bias since depth is inverted)
    let bias = 0.003;

    // 'greater' comparison: ref > stored → 1.0 (lit when further from light than shadow caster)
    let shadowSample = textureSampleCompare(shadowMap, shadowSampler, shadowUV, shadowDepth + bias);

    // Only apply shadow to surfaces facing the light (avoid back-face self-shadowing)
    shadow = select(1.0, shadowSample, mainNdotL > 0.001);
  }

  // Fill light (no shadows, softer)
  let fillL = normalize(-uniforms.fillLightDir.xyz);
  let fillNdotL = max(dot(N, fillL), 0.0);
  let fillIntensity = uniforms.fillLightDir.w;

  // Hemisphere ambient lighting - blend between ground and sky based on normal.y
  let ambientBlend = N.y * 0.5 + 0.5; // Map [-1,1] to [0,1]
  let ambientColor = mix(uniforms.ambientGround.rgb, uniforms.ambientSky.rgb, ambientBlend);

  // Main light contribution (with shadows)
  let mainDiffuse = mainNdotL * shadow * mainIntensity;
  let mainContrib = input.color.rgb * uniforms.mainLightColor.rgb * mainDiffuse;

  // Fill light contribution (heavily reduced in shadow)
  let shadowedFill = mix(0.1, 1.0, shadow);  // Fill is 10% in full shadow
  let fillDiffuse = fillNdotL * fillIntensity * shadowedFill;
  let fillContrib = input.color.rgb * uniforms.fillLightColor.rgb * fillDiffuse;

  // Ambient contribution (reduced in shadow for dramatic effect)
  let shadowedAmbient = mix(0.2, 1.0, shadow);  // Ambient is 20% in full shadow
  let ambientContrib = input.color.rgb * ambientColor * 0.4 * shadowedAmbient;

  // Fresnel rim lighting
  let fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  let rimContrib = uniforms.ambientSky.rgb * fresnel * 0.3;

  // Combine lighting
  var finalColor = mainContrib + fillContrib + ambientContrib + rimContrib;

  // Apply shadow darkening directly to final color for more dramatic effect
  if (shadowEnabled > 0.5) {
    let shadowDarkening = mix(0.15, 1.0, shadow);  // In full shadow, darken to 15%
    finalColor *= shadowDarkening;
  }

  // Add emission glow
  if (input.emission > 0.0) {
    let emissionColor = input.color.rgb * input.emission * 2.0;
    finalColor = finalColor + emissionColor;
  }

  // Subtle ambient occlusion - darken bottom-facing and occluded surfaces
  let aoFactor = 0.7 + 0.3 * max(N.y, 0.0);
  finalColor *= aoFactor;

  // ACES-inspired tone mapping for better contrast
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  finalColor = clamp((finalColor * (a * finalColor + b)) / (finalColor * (c * finalColor + d) + e), vec3f(0.0), vec3f(1.0));

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
