import * as THREE from 'three';

/**
 * SONAR Shader - WebGL GLSL Shaders for Radar + Pulse Animation
 * Combines rotating radar sweep with expanding sonar pulses
 * Uses aquatic color palette for WCAG-compliant visuals
 */

export const vertexShader = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

export const fragmentShader = `
  #define PI 3.14159265359
  #define TWO_PI 6.28318530718

  precision highp float;

  uniform vec2 resolution;
  uniform float time;
  uniform float sweepAngle;      // Current radar sweep angle
  uniform float pulseFrequency;  // How often pulses emit (seconds)
  uniform vec3 colorSignal;      // sonar-signal color
  uniform vec3 colorHighlight;   // sonar-highlight color
  uniform vec3 colorDeep;        // sonar-deep background
  uniform float intensity;       // Overall animation intensity

  // Convert UV to polar coordinates
  vec2 toPolar(vec2 uv) {
    float r = length(uv);
    float theta = atan(uv.y, uv.x);
    return vec2(r, theta);
  }

  // Smooth pulse ring
  float pulseRing(float dist, float radius, float width) {
    return smoothstep(width, 0.0, abs(dist - radius));
  }

  // Radar sweep with angular fade trail
  float radarSweep(float angle, float sweepPos, float trailLength) {
    // Normalize angles to [0, TWO_PI]
    float normalizedAngle = mod(angle + PI, TWO_PI);
    float normalizedSweep = mod(sweepPos + PI, TWO_PI);

    // Calculate angular distance with wrap-around
    float angleDiff = normalizedAngle - normalizedSweep;
    if (angleDiff < -PI) angleDiff += TWO_PI;
    if (angleDiff > PI) angleDiff -= TWO_PI;

    // Fade trail behind sweep
    float trail = smoothstep(trailLength, 0.0, -angleDiff);
    return trail;
  }

  // Polar grid overlay
  float polarGrid(vec2 polar, float rings, float spokes) {
    // Radial rings
    float radialGrid = fract(polar.x * rings);
    radialGrid = smoothstep(0.95, 1.0, radialGrid);

    // Angular spokes
    float angularGrid = fract(polar.y / TWO_PI * spokes);
    angularGrid = smoothstep(0.98, 1.0, angularGrid);

    return max(radialGrid, angularGrid);
  }

  // Center crosshair
  float crosshair(vec2 uv, float size) {
    float horizontal = smoothstep(size, size * 0.5, abs(uv.y));
    float vertical = smoothstep(size, size * 0.5, abs(uv.x));
    float cross = max(horizontal, vertical);

    // Only show near center
    float centerMask = smoothstep(0.15, 0.0, length(uv));
    return cross * centerMask;
  }

  void main() {
    // Normalize coordinates to [-1, 1] with aspect ratio correction
    vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);

    // Convert to polar coordinates
    vec2 polar = toPolar(uv);
    float dist = polar.x;
    float angle = polar.y;

    // Initialize color with deep background
    vec3 color = colorDeep * 0.3;

    // === EXPANDING SONAR PULSES ===
    float pulseTime = time * 0.3;

    // Create 5 staggered pulse rings
    for (int i = 0; i < 5; i++) {
      float offset = float(i) * 0.2; // Stagger pulses
      float pulseT = mod(pulseTime + offset, pulseFrequency);
      float radius = pulseT / pulseFrequency * 2.0; // Expand to edge

      // Pulse opacity fades as it expands
      float opacity = 1.0 - (radius / 2.0);
      opacity = pow(opacity, 2.0); // Exponential fade

      // Draw pulse ring
      float pulse = pulseRing(dist, radius, 0.02);
      color += colorSignal * pulse * opacity * intensity * 0.5;
    }

    // === ROTATING RADAR SWEEP ===
    float sweepSpeed = time * 0.5; // Rotation speed
    float sweep = radarSweep(angle, sweepSpeed, PI * 0.3); // 30% trail

    // Sweep reveals detection grid
    color += colorHighlight * sweep * intensity * 0.3;

    // Brighten sweep edge
    float sweepEdge = radarSweep(angle, sweepSpeed, PI * 0.05);
    color += colorHighlight * sweepEdge * intensity * 0.8;

    // === POLAR GRID OVERLAY ===
    float grid = polarGrid(polar, 8.0, 32.0); // 8 rings, 32 spokes
    color += colorSignal * grid * 0.15;

    // === CENTER CROSSHAIR ===
    float cross = crosshair(uv, 0.02);
    color += colorHighlight * cross * 0.6;

    // === VIGNETTE FADE ===
    float vignette = smoothstep(1.2, 0.3, dist);
    color *= vignette;

    // Output final color
    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Shader uniforms configuration
 * Uses CSS custom properties for dynamic theming
 */
export interface SonarUniforms {
  time: { type: 'f'; value: number };
  resolution: { type: 'v2'; value: THREE.Vector2 };
  sweepAngle: { type: 'f'; value: number };
  pulseFrequency: { type: 'f'; value: number };
  colorSignal: { type: 'v3'; value: THREE.Vector3 };
  colorHighlight: { type: 'v3'; value: THREE.Vector3 };
  colorDeep: { type: 'v3'; value: THREE.Vector3 };
  intensity: { type: 'f'; value: number };
}

/**
 * Create default shader uniforms with aquatic color palette
 */
export function createSonarUniforms(): SonarUniforms {
  return {
    time: { type: 'f', value: 0 },
    resolution: { type: 'v2', value: new THREE.Vector2() },
    sweepAngle: { type: 'f', value: 0 },
    pulseFrequency: { type: 'f', value: 3.0 }, // Pulse every 3 seconds
    // sonar-signal: #1AA4D9 (26, 164, 217) -> normalized [0.102, 0.643, 0.851]
    colorSignal: { type: 'v3', value: new THREE.Vector3(0.102, 0.643, 0.851) },
    // sonar-highlight: #74E4FF (116, 228, 255) -> normalized [0.455, 0.894, 1.0]
    colorHighlight: { type: 'v3', value: new THREE.Vector3(0.455, 0.894, 1.0) },
    // sonar-deep: #092E4D (9, 46, 77) -> normalized [0.035, 0.180, 0.302]
    colorDeep: { type: 'v3', value: new THREE.Vector3(0.035, 0.180, 0.302) },
    intensity: { type: 'f', value: 1.0 },
  };
}

/**
 * Parse CSS color to Three.js Vector3 (normalized RGB)
 */
export function parseCSSColor(cssColor: string): THREE.Vector3 {
  // Create temporary element to parse CSS color
  const temp = document.createElement('div');
  temp.style.color = cssColor;
  document.body.appendChild(temp);
  const computed = window.getComputedStyle(temp).color;
  document.body.removeChild(temp);

  // Extract RGB values from computed style (format: "rgb(r, g, b)")
  const match = computed.match(/\d+/g);
  if (match && match.length >= 3) {
    return new THREE.Vector3(
      parseInt(match[0]) / 255,
      parseInt(match[1]) / 255,
      parseInt(match[2]) / 255
    );
  }

  // Fallback to signal color
  return new THREE.Vector3(0.102, 0.643, 0.851);
}
