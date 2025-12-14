#version 460
#extension GL_EXT_ray_tracing : require

// Primary ray payload (from raygen)
layout(location = 0) rayPayloadInEXT vec3 hitValue;

void main() {
    // Atmospheric dungeon void
    vec3 direction = normalize(gl_WorldRayDirectionEXT);

    // Moody gradient with subtle color variation
    float t = 0.5 * (direction.y + 1.0);

    // Deep void colors
    vec3 bottomColor = vec3(0.005, 0.005, 0.015);  // Near black with blue tint
    vec3 topColor = vec3(0.02, 0.015, 0.03);        // Dark purple-ish

    // Add some depth fog effect based on ray direction
    float fog = pow(1.0 - abs(direction.y), 3.0) * 0.02;
    vec3 fogColor = vec3(0.1, 0.08, 0.06);  // Warm torch-lit fog

    hitValue = mix(bottomColor, topColor, t) + fogColor * fog;
}
