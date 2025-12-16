// Gizmo shader - Simple unlit rendering for transform handles

struct Uniforms {
    viewProjection: mat4x4<f32>,
    gizmoPosition: vec3<f32>,
    gizmoScale: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec4<f32>,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) color: vec4<f32>,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    // Scale and translate gizmo geometry
    let worldPos = in.position * uniforms.gizmoScale + uniforms.gizmoPosition;

    out.clip_position = uniforms.viewProjection * vec4<f32>(worldPos, 1.0);

    // Strong depth bias to render on top of geometry
    // WebGPU: z range is [0, 1] where 0 is near, 1 is far
    // Multiply by a smaller factor to bring gizmo closer to camera
    out.clip_position.z = out.clip_position.z * 0.9;

    out.color = in.color;

    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Simple unlit rendering - no emission boost needed
    return vec4<f32>(in.color.rgb, in.color.a);
}

// Wireframe shader variant for selection bounds
struct WireframeUniforms {
    viewProjection: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    color: vec4<f32>,
}

// Use binding 0 for wireframe shader (separate from gizmo shader's binding 0)
@group(0) @binding(0) var<uniform> wireUniforms: WireframeUniforms;

struct WireframeVertexInput {
    @location(0) position: vec3<f32>,
}

struct WireframeVertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) color: vec4<f32>,
}

@vertex
fn vs_wireframe(in: WireframeVertexInput) -> WireframeVertexOutput {
    var out: WireframeVertexOutput;

    let worldPos = wireUniforms.modelMatrix * vec4<f32>(in.position, 1.0);
    out.clip_position = wireUniforms.viewProjection * worldPos;

    // Depth bias
    out.clip_position.z = out.clip_position.z * 0.998;

    out.color = wireUniforms.color;

    return out;
}

@fragment
fn fs_wireframe(in: WireframeVertexOutput) -> @location(0) vec4<f32> {
    return in.color;
}
