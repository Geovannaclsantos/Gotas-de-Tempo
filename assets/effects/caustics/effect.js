import { shader, color } from "../fx.js";

const params = {
  scale: {
    default: 5,
    min: 1.5,
    max: 8,
    step: .1
  },
  sharpness: {
    default: 3,
    min: 1,
    max: 8,
    step: .1
  },
  speed: {
    default: .15,
    min: 0,
    max: 1,
    step: .01
  },
  intensity: {
    default: .75,
    min: 0,
    max: 1.2,
    step: .01
  },
  distortion: {
    default: .62,
    min: 0,
    max: 1,
    step: .01
  },
  depth: {
    default: .6,
    min: 0,
    max: 1,
    step: .01
  },
  calm: {
    default: .5,
    min: 0,
    max: 1,
    step: .01
  },
  calmX: {
    default: .25,
    min: 0,
    max: 1,
    step: .01
  },
  calmY: {
    default: .7,
    min: 0,
    max: 1,
    step: .01
  }
};

const frag = `\n\n#if __VERSION__ >= 300\n\nvec2 cellRand(vec2 id) {\n  uvec2 c = uvec2(ivec2(id) + ivec2(8192));\n  uint h = fx_u32((c.x * 1597334677u) ^ (c.y * 3812015801u) ^ (uint(u_seed) * 2654435769u));\n  return vec2(float(h & 65535u), float(h >> 16u)) * (1.0 / 65535.0);\n}\n#else\nvec2 cellRand(vec2 id) { return fx_hash2(id); }\n#endif\nvec2 cpt(vec2 id, float t) {\n  vec2 h = cellRand(id);\n  return 0.5 + 0.36 * vec2(sin(t * (0.7 + 0.6 * h.x) + FX_TAU * h.y), cos(t * (0.6 + 0.6 * h.y) + FX_TAU * h.x));\n}\n\nvec2 edgeDist(vec2 p, float t) {\n  vec2 i = floor(p), f = fract(p);\n  float f1 = 9.0, f2 = 9.0, f3 = 9.0;\n  for (int yy = -1; yy <= 1; yy++) {\n    for (int xx = -1; xx <= 1; xx++) {\n      vec2 g = vec2(float(xx), float(yy));\n      vec2 o = g + cpt(i + g, t) - f;\n      float d = dot(o, o);\n      if (d < f1) { f3 = f2; f2 = f1; f1 = d; }\n      else if (d < f2) { f3 = f2; f2 = d; }\n      else if (d < f3) { f3 = d; }\n    }\n  }\n  float s1 = sqrt(f1);\n  return vec2(sqrt(f2) - s1, sqrt(f3) - s1);\n}\n\nfloat calmMask(vec2 uv) {\n  vec2 d = (uv - vec2(u_calmX, u_calmY)) * vec2(u_res.x / u_res.y, 1.0);\n  vec2 R = vec2(0.34 + 0.4 * u_calm, 0.15 + 0.14 * u_calm);\n  return 1.0 - smoothstep(0.8, 1.35, length(d / R));\n}\n\nvoid main() {\n  vec2 uv = fx_uv();\n  vec2 P = vec2(uv.x * u_res.x / u_res.y, uv.y);\n  float t = u_time * u_speed + u_seed * 0.173;\n\n  vec2 q = P * u_scale + u_seed * 0.0131;\n  vec2 w1 = vec2(fx_noise(q * 0.33 + vec2(t * 0.2, 1.7)), fx_noise(q * 0.33 + vec2(4.1, -t * 0.18)));\n  vec2 w2 = vec2(fx_noise(q * 0.8 + vec2(-t * 0.27, 8.3)), fx_noise(q * 0.8 + vec2(2.9, t * 0.25)));\n  q += (w1 + 0.75 * w2) * u_distortion * 1.4;\n  vec2 e = edgeDist(q, t * 1.2);\n\n  float F = smoothstep(-0.35, 0.4, fx_fbm(P * 1.25 + vec2(t * 0.05, -t * 0.04) + 7.0));\n  float jn = 1.0 - smoothstep(0.0, 0.32, e.y);\n  float pxc = u_scale / u_res.y;\n\n  float wc = max(mix(0.004, 0.03, F) * (1.0 + 1.2 * jn * F), 1.2 * pxc);\n  float core = pow(1.0 - smoothstep(0.0, wc, e.x), 0.35 * u_sharpness + 0.6) * smoothstep(0.15, 0.7, F);\n  float sw = mix(0.06, 0.025, F);\n  float soft = exp(-e.x * e.x / (sw * sw)) * mix(0.2, 0.42, F);\n  float tail = pow(wc / (e.x + wc), 1.5) * 0.3 * F;\n  float rim = exp(-e.x * 3.5) * 0.08;\n  float I = core + soft + tail + rim;\n  I *= 1.0 + 0.8 * jn * F;\n\n  float patchy = smoothstep(-0.5, 0.5, fx_fbm(P * 0.55 + vec2(-t * 0.03, t * 0.022) + 3.0));\n  I *= mix(1.0 - 0.85 * u_depth, 1.0, patchy);\n  float cm = calmMask(uv) * smoothstep(0.0, 0.35, u_calm);\n  I *= (1.0 - 0.97 * cm) * u_intensity;\n\n  vec3 ground = mix(u_deep, u_shallow, mix(0.5, patchy, u_depth));\n  ground = mix(ground, u_shallow, cm * 0.8);\n  vec3 col = mix(ground, u_light, clamp(I, 0.0, 1.0));\n  col.x += fx_grain(gl_FragCoord.xy, floor(u_time * 24.0)) * 0.006;\n  fxColor = vec4(fx_dither(fx_rgb(col)), 1.0);\n}\n`;

const violet = h => h >= 262 && h <= 338;

export function tones(P) {
  const {bg: bg, ink: ink, accent: accent} = P;
  const [Lb, Cb, hb] = color.lch(bg);
  const [, Ca, ha] = color.lch(accent);
  const useAcc = Ca > .04 && !violet(ha);
  if (Lb < .6) {
    const cool = useAcc && ha >= 150 && ha < 262 && Cb < .07;
    const water = cool ? color.fromLch([ Lb + .02, Math.max(Cb, .035), ha ]) : color.lighten(bg, .012);
    const [Lw, Cw, hw] = color.lch(water);
    const pale = color.fromLch([ .9, Math.min(.05, Cw * .6 + .01), hw ]);
    return {
      deep: color.fromLch([ Math.max(0, Lw - .025), Cw, hw ]),
      shallow: color.fromLch([ Lw + .045, Cw * 1.1, hw ]),
      light: useAcc && (Cb < .07 || color.hueDistance(bg, accent) < 50) ? color.mix(pale, color.withLightness(accent, .9), cool ? .25 : .3) : color.mix(pale, ink, .15)
    };
  }
  return {
    deep: color.fromLch([ Lb - .065, Cb * 1.05, hb ]),
    shallow: color.fromLch([ Lb - .012, Cb, hb ]),
    light: color.fromLch([ Math.min(.998, Lb + .1), Cb * .45, hb ])
  };
}

function uniforms({palette: palette}) {
  const k = tones(palette);
  return {
    u_deep: color.labVec(k.deep),
    u_shallow: color.labVec(k.shallow),
    u_light: color.labVec(k.light)
  };
}

export default {
  id: "caustics",
  name: "Water caustics",
  family: "light",
  params: params,
  mount(el, {palette: palette, params: given, seed: seed}) {
    return shader(el, {
      frag: frag,
      schema: params,
      params: given,
      palette: palette,
      seed: seed,
      uniforms: uniforms,
      still: 5,
      maxDpr: 1.5,
      fallback: ({palette: P}) => {
        const k = tones(P);
        return `radial-gradient(60% 50% at 72% 28%, ${color.mix(k.shallow, k.light, .3)}, transparent 75%), radial-gradient(50% 40% at 30% 80%, ${k.shallow}, transparent 70%), ${k.deep}`;
      }
    });
  }
};