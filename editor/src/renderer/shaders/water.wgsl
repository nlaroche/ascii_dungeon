// Water surface shader with reflections and ripples

struct Uniforms {
  viewProj: mat4x4f,
  lightViewProj: mat4x4f,
  cameraPos: vec4f,        // xyz = position, w = time
  mainLightDir: vec4f,     // xyz = direction, w = intensity
  mainLightColor: vec4f,   // xyz = color, w = unused
  fillLightDir: vec4f,     // xyz = direction, w = intensity
  fillLightColor: vec4f,   // xyz = color, w = unused
  ambientSky: vec4f,       // hemisphere ambient - sky color
  ambientGround: vec4f,    // hemisphere ambient - ground color
}

struct WaterInstance {
  transform: mat4x4f,
  color: vec4f,
  emission: f32,
  flags: f32,  // Stored as float
  _pad0: f32,
  _pad1: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> instances: array<WaterInstance>;
@group(0) @binding(2) var reflectionTex: texture_2d<f32>;
@group(0) @binding(3) var reflectionSampler: sampler;

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
  @location(3) screenUV: vec2f,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let instance = instances[input.instanceIdx];
  let worldPos = (instance.transform * vec4f(input.position, 1.0)).xyz;

  output.clipPos = uniforms.viewProj * vec4f(worldPos, 1.0);
  output.worldPos = worldPos;
  output.normal = vec3f(0.0, 1.0, 0.0); // Water is always flat
  output.color = instance.color;

  // Screen UV for reflection sampling
  let ndcPos = output.clipPos.xy / output.clipPos.w;
  output.screenUV = ndcPos * 0.5 + 0.5;
  output.screenUV.y = 1.0 - output.screenUV.y; // Flip Y

  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let time = uniforms.cameraPos.w;
  let V = normalize(uniforms.cameraPos.xyz - input.worldPos);

  // Animated ripple distortion
  let rippleScale = 8.0;
  let rippleSpeed = 1.5;
  let rippleStrength = 0.02;

  let ripple1 = sin(input.worldPos.x * rippleScale + time * rippleSpeed) *
                cos(input.worldPos.z * rippleScale * 0.7 + time * rippleSpeed * 0.8);
  let ripple2 = sin(input.worldPos.x * rippleScale * 1.3 - time * rippleSpeed * 0.6) *
                cos(input.worldPos.z * rippleScale * 1.1 + time * rippleSpeed * 1.2);

  let distortion = (ripple1 + ripple2 * 0.5) * rippleStrength;

  // Perturb normal based on ripples
  let normalPerturbX = ripple1 * 0.1;
  let normalPerturbZ = ripple2 * 0.1;
  let N = normalize(vec3f(normalPerturbX, 1.0, normalPerturbZ));

  // Sample reflection with distortion
  let reflectUV = input.screenUV + vec2f(distortion, distortion * 0.5);
  let reflection = textureSample(reflectionTex, reflectionSampler, reflectUV);

  // Fresnel effect - more reflection at grazing angles (reference uses 0.6)
  let fresnel = pow(1.0 - max(dot(V, N), 0.0), 3.0);
  let reflectAmount = mix(0.15, 0.8, fresnel); // 0.15 base reflectivity matching reference

  // Water base color with hemisphere ambient
  let ambientBlend = N.y * 0.5 + 0.5;
  let ambientColor = mix(uniforms.ambientGround.rgb, uniforms.ambientSky.rgb, ambientBlend);
  let waterColor = input.color.rgb * ambientColor * 0.5;

  // Blend reflection with water color
  var finalColor = mix(waterColor, reflection.rgb, reflectAmount);

  // Main light specular highlight
  let mainL = normalize(-uniforms.mainLightDir.xyz);
  let mainH = normalize(V + mainL);
  let mainSpec = pow(max(dot(N, mainH), 0.0), 128.0);
  finalColor += uniforms.mainLightColor.rgb * mainSpec * uniforms.mainLightDir.w * 0.8;

  // Fill light subtle specular
  let fillL = normalize(-uniforms.fillLightDir.xyz);
  let fillH = normalize(V + fillL);
  let fillSpec = pow(max(dot(N, fillH), 0.0), 64.0);
  finalColor += uniforms.fillLightColor.rgb * fillSpec * uniforms.fillLightDir.w * 0.2;

  // Sky reflection tint
  finalColor += uniforms.ambientSky.rgb * fresnel * 0.1;

  // ACES tone mapping
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  finalColor = clamp((finalColor * (a * finalColor + b)) / (finalColor * (c * finalColor + d) + e), vec3f(0.0), vec3f(1.0));

  // Gamma correction
  finalColor = pow(finalColor, vec3f(1.0 / 2.2));

  return vec4f(finalColor, 0.85); // Slightly transparent
}
