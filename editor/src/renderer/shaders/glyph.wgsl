// Glyph rendering shader - renders smooth extruded polygon meshes
// Uses per-vertex color/emission instead of instanced data

struct Uniforms {
  viewProj: mat4x4f,
  lightViewProj: mat4x4f,
  cameraPos: vec4f,      // xyz = position, w = time
  lightDir: vec4f,       // xyz = direction, w = ambient strength
  lightColor: vec4f,     // xyz = color, w = unused
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var shadowMap: texture_depth_2d;
@group(0) @binding(2) var shadowSampler: sampler_comparison;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) color: vec4f,
  @location(3) emission: f32,
}

struct VertexOutput {
  @builtin(position) clipPos: vec4f,
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
  @location(2) color: vec4f,
  @location(3) shadowCoord: vec4f,
  @location(4) emission: f32,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  // Position is already in world space (pre-transformed in Scene.ts)
  let worldPos = input.position;
  let worldNormal = normalize(input.normal);

  output.clipPos = uniforms.viewProj * vec4f(worldPos, 1.0);
  output.worldPos = worldPos;
  output.normal = worldNormal;
  output.color = input.color;
  output.emission = input.emission;

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
  let shadowUV = input.shadowCoord.xy;
  let shadowZ = input.shadowCoord.z / input.shadowCoord.w - 0.005;

  let texelSize = 1.0 / 1024.0;
  for (var x = -1; x <= 1; x++) {
    for (var y = -1; y <= 1; y++) {
      let offset = vec2f(f32(x), f32(y)) * texelSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, shadowUV + offset, shadowZ);
    }
  }
  shadow /= 9.0;

  // Lighting calculation
  let ambient = uniforms.lightDir.w;
  let diffuse = NdotL * shadow;
  let lighting = ambient + diffuse * (1.0 - ambient);

  // Base color with lighting
  var finalColor = input.color.rgb * lighting * uniforms.lightColor.rgb;

  // Add emission glow
  if (input.emission > 0.0) {
    let emissionColor = input.color.rgb * input.emission;
    finalColor = mix(finalColor, emissionColor + finalColor, input.emission * 0.5);
  }

  // Ambient occlusion (darken bottom faces slightly)
  if (N.y < -0.5) {
    finalColor *= 0.85;
  }

  // Simple tone mapping
  finalColor = finalColor / (finalColor + vec3f(1.0));

  // Gamma correction
  finalColor = pow(finalColor, vec3f(1.0 / 2.2));

  return vec4f(finalColor, input.color.a);
}
