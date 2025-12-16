// Variance Shadow Map shader
// Outputs depth and depth² for soft shadow calculation

struct Uniforms {
  lightViewProj: mat4x4f,
}

struct Instance {
  transform: mat4x4f,
  color: vec4f,
  emission: vec4f,
  nodeId: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> instances: array<Instance>;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) depth: f32,
}

@vertex
fn vs_main(input: VertexInput, @builtin(instance_index) instanceIdx: u32) -> VertexOutput {
  let instance = instances[instanceIdx];
  let worldPos = instance.transform * vec4f(input.position, 1.0);
  let clipPos = uniforms.lightViewProj * worldPos;

  var output: VertexOutput;
  output.position = clipPos;
  // Linear depth in [0,1] range
  output.depth = clipPos.z / clipPos.w;
  return output;
}

struct FragmentOutput {
  @location(0) moments: vec4f,  // rg = (depth, depth²), ba unused
}

@fragment
fn fs_main(input: VertexOutput) -> FragmentOutput {
  let depth = input.depth;

  var output: FragmentOutput;
  // Store depth and depth² as moments for variance calculation
  output.moments = vec4f(depth, depth * depth, 0.0, 1.0);
  return output;
}
