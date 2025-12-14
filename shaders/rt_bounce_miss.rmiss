#version 460
#extension GL_EXT_ray_tracing : require

// Bounce ray payload (from closest hit bounce rays)
layout(location = 2) rayPayloadInEXT vec3 bounceResult;

void main() {
    // Bounce rays that miss return the void color
    vec3 direction = normalize(gl_WorldRayDirectionEXT);

    // Moody gradient with subtle color variation
    float t = 0.5 * (direction.y + 1.0);

    // Deep void colors - same as primary miss
    vec3 bottomColor = vec3(0.005, 0.005, 0.015);
    vec3 topColor = vec3(0.02, 0.015, 0.03);

    // Depth fog
    float fog = pow(1.0 - abs(direction.y), 3.0) * 0.02;
    vec3 fogColor = vec3(0.1, 0.08, 0.06);

    bounceResult = mix(bottomColor, topColor, t) + fogColor * fog;
}
