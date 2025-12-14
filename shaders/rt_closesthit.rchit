#version 460
#extension GL_EXT_ray_tracing : require
#extension GL_EXT_nonuniform_qualifier : require

layout(binding = 0, set = 0) uniform accelerationStructureEXT topLevelAS;

// Instance data
struct GlyphInstance {
    vec4 color;     // rgb = color, a = roughness
    vec4 emission;  // rgb = emission, a = power
};

layout(binding = 2, set = 0) buffer InstanceData {
    GlyphInstance instances[];
};

// Light data
struct Light {
    vec4 position;  // xyz = pos, w = radius
    vec4 color;     // rgb = color, a = power
};

layout(binding = 3, set = 0) buffer LightData {
    Light lights[];
};

layout(push_constant) uniform PushConstants {
    mat4 viewInverse;
    mat4 projInverse;
    vec4 cameraPos;  // xyz = position, w = time
} camera;

// Ray payloads
layout(location = 0) rayPayloadInEXT vec3 hitValue;
layout(location = 1) rayPayloadEXT bool isShadowed;

hitAttributeEXT vec2 attribs;

const float PI = 3.14159265359;

// Hash function for noise
uint hash(uint x) {
    x += (x << 10u);
    x ^= (x >> 6u);
    x += (x << 3u);
    x ^= (x >> 11u);
    x += (x << 15u);
    return x;
}

uint hash(uvec3 v) { return hash(v.x ^ hash(v.y ^ hash(v.z))); }

float random(inout uint seed) {
    seed = hash(seed);
    return float(seed) / float(0xffffffffu);
}

// Compute normal for a cube face
vec3 computeNormal(vec3 localPos) {
    vec3 absPos = abs(localPos);
    float maxComp = max(max(absPos.x, absPos.y), absPos.z);

    if (absPos.x >= maxComp - 0.001) return vec3(sign(localPos.x), 0.0, 0.0);
    if (absPos.y >= maxComp - 0.001) return vec3(0.0, sign(localPos.y), 0.0);
    return vec3(0.0, 0.0, sign(localPos.z));
}

// Fresnel-Schlick
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// GGX Distribution
float distributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    return a2 / max(denom, 0.0001);
}

// Smith's geometry function
float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx1 = NdotV / (NdotV * (1.0 - k) + k);
    float ggx2 = NdotL / (NdotL * (1.0 - k) + k);
    return ggx1 * ggx2;
}

void main() {
    // Get instance data
    uint instanceId = gl_InstanceCustomIndexEXT;
    GlyphInstance inst = instances[instanceId];
    vec3 albedo = inst.color.rgb;
    float roughness = max(inst.color.a, 0.05);
    vec3 emission = inst.emission.rgb;
    float emissionPower = inst.emission.a;

    // Boost color saturation (Minecraft shader style)
    vec3 saturatedAlbedo = mix(vec3(dot(albedo, vec3(0.299, 0.587, 0.114))), albedo, 1.4);
    saturatedAlbedo = clamp(saturatedAlbedo, 0.0, 1.0);

    // Material properties - reduce metallic so colors show through better
    float metallic = clamp(1.0 - roughness * 1.5, 0.0, 0.4);

    // Compute hit position in world space
    vec3 worldPos = gl_WorldRayOriginEXT + gl_WorldRayDirectionEXT * gl_HitTEXT;

    // Get transforms
    mat4x3 objectToWorld = gl_ObjectToWorldEXT;
    mat4x3 worldToObject = gl_WorldToObjectEXT;

    // Compute normal
    vec3 localPos = worldToObject * vec4(worldPos, 1.0);
    vec3 localNormal = computeNormal(localPos);
    vec3 N = normalize(mat3(objectToWorld) * localNormal);
    vec3 V = normalize(camera.cameraPos.xyz - worldPos);

    // Base reflectivity
    vec3 F0 = mix(vec3(0.04), saturatedAlbedo, metallic);

    // Random seed for noise
    uvec3 seedInput = uvec3(
        floatBitsToUint(worldPos.x * 1000.0),
        floatBitsToUint(worldPos.y * 1000.0),
        floatBitsToUint(camera.cameraPos.w * 100.0)
    );
    uint seed = hash(seedInput);

    // ============================================
    // EMISSIVE GLOW (Minecraft shader bloom effect)
    // ============================================
    vec3 Lo = vec3(0.0);

    if (emissionPower > 0.0) {
        // Strong bloom-like glow for emissive surfaces
        vec3 glowColor = emission * emissionPower * 5.0;
        // Add some color bleeding/bloom
        float glowSpread = 1.0 + emissionPower * 0.5;
        Lo += glowColor * glowSpread;
    }

    // ============================================
    // DIRECT LIGHTING WITH CRISP SHADOWS
    // ============================================
    vec3 totalLight = vec3(0.0);
    vec3 volumetricLight = vec3(0.0);

    for (int i = 0; i < 64; i++) {
        Light light = lights[i];
        if (light.color.a <= 0.0) break;

        vec3 lightPos = light.position.xyz;
        float lightRadius = light.position.w;
        vec3 lightColor = light.color.rgb;
        float lightPower = light.color.a;

        vec3 toLight = lightPos - worldPos;
        float lightDist = length(toLight);
        vec3 L = toLight / lightDist;

        if (lightDist > lightRadius * 2.0) continue;

        // More dramatic attenuation with sharp falloff near edge
        float normalizedDist = lightDist / lightRadius;
        float attenuation = lightPower * pow(1.0 - clamp(normalizedDist, 0.0, 1.0), 2.0);
        attenuation /= (1.0 + lightDist * lightDist * 0.03);

        // Shadow ray - use tighter bias for sharper shadows
        float shadowBias = 0.01;
        isShadowed = true;

        traceRayEXT(
            topLevelAS,
            gl_RayFlagsTerminateOnFirstHitEXT | gl_RayFlagsSkipClosestHitShaderEXT,
            0xFF,
            0, 0, 1,
            worldPos + N * shadowBias,
            0.001,
            L,
            lightDist - shadowBias * 2.0,
            1
        );

        float shadowFactor = isShadowed ? 0.0 : 1.0;

        // Stronger NdotL for more dramatic shading
        float NdotL = max(dot(N, L), 0.0);

        // Emphasize facing angle for more 3D look
        float facingFactor = pow(NdotL, 0.8);

        if (shadowFactor > 0.0) {
            vec3 H = normalize(V + L);

            // Cook-Torrance BRDF
            float NDF = distributionGGX(N, H, roughness);
            float G = geometrySmith(N, V, L, roughness);
            vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

            vec3 kS = F;
            vec3 kD = (vec3(1.0) - kS) * (1.0 - metallic);

            vec3 numerator = NDF * G * F;
            float denominator = 4.0 * max(dot(N, V), 0.0) * NdotL + 0.0001;
            vec3 specular = numerator / denominator;

            // Subtle specular (reduced to preserve surface colors)
            specular *= 1.0;

            vec3 radiance = lightColor * attenuation;

            // Main lighting with enhanced facing factor
            vec3 directLight = (kD * saturatedAlbedo / PI + specular) * radiance * facingFactor;
            totalLight += directLight * shadowFactor;
        }

        // Subtle rim light effect on shadow terminator
        float rimLight = pow(1.0 - abs(NdotL), 4.0) * attenuation * 0.1;
        if (NdotL > 0.0 && NdotL < 0.3) {
            totalLight += lightColor * rimLight * saturatedAlbedo;
        }

        // ============================================
        // VOLUMETRIC LIGHT (enhanced god rays)
        // ============================================
        float viewDotLight = max(dot(-V, L), 0.0);
        float volumetric = pow(viewDotLight, 6.0) * attenuation * 0.2;
        volumetricLight += lightColor * volumetric;
    }

    Lo += totalLight;

    // ============================================
    // AMBIENT OCCLUSION & INDIRECT LIGHTING
    // ============================================
    // Height-based AO (darker in corners/low areas)
    float heightAO = smoothstep(-1.0, 3.0, worldPos.y);
    // Normal-based AO - upward facing surfaces brighter
    float normalAO = 0.4 + 0.6 * max(dot(N, vec3(0.0, 1.0, 0.0)), 0.0);
    // Edge darkening (surfaces facing away from viewer)
    float edgeAO = pow(max(dot(N, V), 0.0), 0.3);
    float ao = mix(0.15, 1.0, heightAO * normalAO * edgeAO);

    // Indirect lighting from nearby lights (color bleeding)
    vec3 indirectLight = vec3(0.0);
    for (int i = 0; i < 64; i++) {
        Light light = lights[i];
        if (light.color.a <= 0.0) break;

        vec3 toLight = light.position.xyz - worldPos;
        float dist = length(toLight);
        float influence = light.color.a / (1.0 + dist * dist * 0.2);
        influence *= (0.3 + 0.7 * max(dot(N, normalize(toLight)), 0.0));

        // Warm color bleeding - more saturated
        indirectLight += light.color.rgb * influence * 0.08;
    }
    Lo += indirectLight * saturatedAlbedo * ao * (1.0 - metallic * 0.5);

    // Base ambient (very dark for dramatic contrast)
    vec3 ambientColor = vec3(0.015, 0.01, 0.02);  // Deep purple-blue tint
    Lo += saturatedAlbedo * ambientColor * ao;

    // ============================================
    // SPECULAR HIGHLIGHTS (shiny reflections) - reduced for better color preservation
    // ============================================
    if (roughness < 0.25) {  // Only very smooth surfaces get extra specular
        vec3 reflectDir = reflect(gl_WorldRayDirectionEXT, N);
        vec3 specHighlight = vec3(0.0);

        for (int i = 0; i < 64; i++) {
            Light light = lights[i];
            if (light.color.a <= 0.0) break;

            vec3 toLight = light.position.xyz - worldPos;
            float dist = length(toLight);
            vec3 lightDir = toLight / dist;

            // Sharp specular highlights
            float specPower = mix(64.0, 16.0, roughness);
            float spec = pow(max(dot(reflectDir, lightDir), 0.0), specPower);
            float atten = light.color.a / (1.0 + dist * dist * 0.05);

            specHighlight += light.color.rgb * spec * atten * 0.3;  // Reduced from 0.8
        }

        vec3 F = fresnelSchlick(max(dot(N, V), 0.0), F0);
        float reflectStrength = (1.0 - roughness) * 0.15;  // Reduced from 0.4
        Lo += specHighlight * F * reflectStrength;
    }

    // Add volumetric light
    Lo += volumetricLight;

    // ============================================
    // SAFETY CLAMPING (prevent NaN/Inf crashes)
    // ============================================
    // Clamp to reasonable HDR range before tone mapping
    Lo = clamp(Lo, vec3(0.0), vec3(100.0));

    // Check for NaN and replace with ambient
    if (any(isnan(Lo)) || any(isinf(Lo))) {
        Lo = saturatedAlbedo * vec3(0.1);
    }

    // ============================================
    // POST-PROCESSING (Cinematic look)
    // ============================================

    // Exposure - brighter for visibility but preserving contrast
    Lo *= 1.5;

    // ACES-style filmic tone mapping for better highlight rolloff
    vec3 x = Lo;
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    vec3 toneMapped = clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);

    // S-curve contrast for more punch
    toneMapped = toneMapped * toneMapped * (3.0 - 2.0 * toneMapped);

    // Neutral color grading - no warm/cool tint
    vec3 colorGraded = toneMapped;

    // Moderate saturation boost to make colors pop
    float gray = dot(colorGraded, vec3(0.299, 0.587, 0.114));
    colorGraded = mix(vec3(gray), colorGraded, 1.15);

    // Subtle vignette effect (darken edges)
    vec2 screenUV = gl_LaunchIDEXT.xy / vec2(gl_LaunchSizeEXT.xy);
    float vignette = 1.0 - smoothstep(0.4, 1.4, length(screenUV - 0.5) * 1.5);
    colorGraded *= mix(0.7, 1.0, vignette);

    // Final clamp and gamma correction
    colorGraded = clamp(colorGraded, 0.0, 1.0);
    hitValue = pow(colorGraded, vec3(1.0 / 2.2));
}
