// ═══════════════════════════════════════════════════════════════════════════
// ZzFX Audio System - Procedural Sound Effects & Music
// Zero-asset audio for retro/chiptune games
// Uses ZzFX by Frank Force: https://github.com/KilledByAPixel/ZzFX
// Uses ZzFXM by Keith Clark: https://github.com/keithclark/ZzFXM
// ═══════════════════════════════════════════════════════════════════════════

import { zzfx, ZZFX } from 'zzfx'

// ─────────────────────────────────────────────────────────────────────────────
// ZzFX Sound Parameters Type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ZzFX sound parameters (20 parameters)
 * @see https://killedbyapixel.github.io/ZzFX/
 */
export type ZzFXParams = [
  volume?: number,      // 0: Volume (0-1)
  randomness?: number,  // 1: Randomness (0-1)
  frequency?: number,   // 2: Frequency in Hz
  attack?: number,      // 3: Attack time in seconds
  sustain?: number,     // 4: Sustain time in seconds
  release?: number,     // 5: Release time in seconds
  shape?: number,       // 6: Wave shape (0=sin, 1=tri, 2=saw, 3=tan, 4=noise)
  shapeCurve?: number,  // 7: Shape curve
  slide?: number,       // 8: Frequency slide
  deltaSlide?: number,  // 9: Delta slide
  pitchJump?: number,   // 10: Pitch jump
  pitchJumpTime?: number, // 11: Pitch jump time
  repeatTime?: number,  // 12: Repeat time
  noise?: number,       // 13: Noise amount
  modulation?: number,  // 14: Modulation
  bitCrush?: number,    // 15: Bit crush
  delay?: number,       // 16: Delay
  sustainVolume?: number, // 17: Sustain volume
  decay?: number,       // 18: Decay
  tremolo?: number,     // 19: Tremolo
]

// ─────────────────────────────────────────────────────────────────────────────
// Preset Sound Effects
// ─────────────────────────────────────────────────────────────────────────────

export const SFX_PRESETS: Record<string, ZzFXParams> = {
  // UI Sounds
  'click': [1,,1500,,.02,.01,1,1.5,,,,,,,,,.02],
  'hover': [.3,,800,,.01,.01,1,2],
  'confirm': [1,,500,.05,.1,.1,1,1,,,200,.05],
  'cancel': [1,,200,.05,.05,.1,1,1,,,-50,.05],
  'error': [1,.2,200,.02,.1,.2,3,2,,,,-0.1],
  'success': [1,,600,.02,.1,.2,1,1,,,300,.1],

  // Game Actions
  'jump': [1,,250,.02,.05,.1,1,2,20],
  'land': [.5,,100,.01,.02,.1,4,1],
  'walk': [.2,,50,,.01,.02,4,1],
  'run': [.3,,80,,.01,.01,4,1],

  // Combat
  'hit': [1,.1,200,.01,.02,.1,4,2,,-50],
  'punch': [.8,,300,.01,.01,.1,4,2,,,-100],
  'slash': [.7,,400,.01,.05,.1,2,2,50],
  'block': [.6,,150,.01,.05,.2,4,1],
  'death': [1,.2,100,.1,.3,.5,4,2,,,-200,.2],

  // Projectiles
  'shoot': [.5,,500,.01,.02,.05,1,2,50],
  'laser': [.5,,800,.01,.1,.1,2,2,,,200,.1],
  'missile': [.6,,200,.05,.2,.3,3,2,50,,,,.1],
  'explosion': [1,.2,100,.05,.2,.5,4,2,,,,-0.1,,,.2],
  'smallExplosion': [.5,.2,200,.02,.1,.2,4,2],

  // Pickups & Items
  'coin': [1,,1000,.02,.05,.1,1,2,,,500,.05],
  'gem': [1,,1200,.02,.1,.2,1,2,,,400,.1],
  'powerup': [1,,400,.05,.2,.3,1,2,,,200,.1],
  'heal': [.8,,600,.05,.15,.2,1,1,,,100,.1],

  // Environment
  'door': [.4,,200,.05,.1,.2,4,1],
  'switch': [.5,,300,.01,.05,.1,1,1,,,100],
  'splash': [.5,.2,200,.02,.1,.3,4,1],
  'wind': [.3,.3,100,.1,.3,.5,4,0],

  // Magic/Special
  'magic': [.6,,400,.05,.2,.3,1,2,,,300,.1,,,.1],
  'spell': [.7,,600,.1,.3,.4,1,2,50,,200,.2],
  'teleport': [.6,,800,.1,.2,.3,2,2,,,,-0.2],
  'charge': [.5,,200,.2,.3,.1,1,2,100],

  // Retro/Chiptune specific
  'blip': [.3,,800,,.01,,1,2],
  'bloop': [.3,,400,,.02,.02,1,2],
  'beep': [.4,,600,,.02,.02,1,1],
  'boop': [.4,,300,,.02,.02,1,1],
  'zap': [.5,,1000,.01,.02,.05,2,2,200],
  'warp': [.5,,400,.05,.1,.2,2,2,,,,-0.2],
}

// ─────────────────────────────────────────────────────────────────────────────
// Sound Effect Generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate random sound effect parameters
 */
export function generateRandomSFX(type: 'hit' | 'jump' | 'coin' | 'shoot' | 'explosion' | 'powerup' | 'blip'): ZzFXParams {
  const r = () => Math.random()
  const rr = (min: number, max: number) => min + r() * (max - min)

  switch (type) {
    case 'hit':
      return [rr(.5, 1), r() * .2, rr(100, 400), r() * .02, rr(.01, .05), rr(.05, .2), 4, rr(1, 3), , rr(-100, 0)]
    case 'jump':
      return [rr(.7, 1), , rr(200, 400), r() * .03, rr(.03, .08), rr(.05, .15), 1, rr(1, 3), rr(10, 30)]
    case 'coin':
      return [rr(.8, 1), , rr(800, 1200), r() * .03, rr(.03, .08), rr(.05, .15), 1, rr(1, 3), , , rr(300, 600), rr(.03, .08)]
    case 'shoot':
      return [rr(.4, .7), , rr(300, 700), r() * .02, rr(.01, .04), rr(.02, .08), rr(1, 3), rr(1, 3), rr(20, 80)]
    case 'explosion':
      return [rr(.8, 1), rr(.1, .3), rr(50, 150), rr(.03, .08), rr(.1, .3), rr(.3, .6), 4, rr(1, 3), , , , rr(-.2, -.05), , , rr(.1, .3)]
    case 'powerup':
      return [rr(.7, 1), , rr(300, 600), rr(.03, .08), rr(.1, .25), rr(.2, .4), 1, rr(1, 3), , , rr(100, 300), rr(.05, .15)]
    case 'blip':
    default:
      return [rr(.2, .5), , rr(400, 1200), , rr(.01, .03), , 1, rr(1, 3)]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ZzFX Audio Manager
// ─────────────────────────────────────────────────────────────────────────────

export class ZzFXAudioManager {
  private static instance: ZzFXAudioManager
  private volume: number = 1
  private muted: boolean = false
  private soundCache: Map<string, ZzFXParams> = new Map()
  private playingSounds: Set<AudioBufferSourceNode> = new Set()

  // Music state
  private currentMusic: AudioBufferSourceNode | null = null
  private musicVolume: number = 0.5
  private musicMuted: boolean = false

  static getInstance(): ZzFXAudioManager {
    if (!ZzFXAudioManager.instance) {
      ZzFXAudioManager.instance = new ZzFXAudioManager()
    }
    return ZzFXAudioManager.instance
  }

  constructor() {
    // Pre-cache all preset sounds
    for (const [name, params] of Object.entries(SFX_PRESETS)) {
      this.soundCache.set(name, params)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Volume Control
  // ─────────────────────────────────────────────────────────────────────────

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    ZZFX.volume = this.volume
  }

  getVolume(): number {
    return this.volume
  }

  setMuted(muted: boolean): void {
    this.muted = muted
  }

  isMuted(): boolean {
    return this.muted
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume))
  }

  getMusicVolume(): number {
    return this.musicVolume
  }

  setMusicMuted(muted: boolean): void {
    this.musicMuted = muted
  }

  isMusicMuted(): boolean {
    return this.musicMuted
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sound Effects
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Play a preset sound effect by name
   */
  playPreset(name: string, volumeMultiplier: number = 1): AudioBufferSourceNode | null {
    if (this.muted) return null

    const params = this.soundCache.get(name) || SFX_PRESETS[name]
    if (!params) {
      console.warn(`[ZzFX] Unknown preset: ${name}`)
      return null
    }

    return this.play(params, volumeMultiplier)
  }

  /**
   * Play a sound with custom parameters
   */
  play(params: ZzFXParams, volumeMultiplier: number = 1): AudioBufferSourceNode | null {
    if (this.muted) return null

    // Apply volume multiplier to first parameter
    const adjustedParams = [...params] as ZzFXParams
    adjustedParams[0] = (adjustedParams[0] ?? 1) * volumeMultiplier * this.volume

    try {
      const node = zzfx(...adjustedParams)
      if (node) {
        this.playingSounds.add(node)
        node.onended = () => this.playingSounds.delete(node)
      }
      return node
    } catch (e) {
      console.error('[ZzFX] Play error:', e)
      return null
    }
  }

  /**
   * Play a randomly generated sound effect
   */
  playRandom(type: 'hit' | 'jump' | 'coin' | 'shoot' | 'explosion' | 'powerup' | 'blip', volumeMultiplier: number = 1): AudioBufferSourceNode | null {
    const params = generateRandomSFX(type)
    return this.play(params, volumeMultiplier)
  }

  /**
   * Register a custom sound effect
   */
  registerSound(name: string, params: ZzFXParams): void {
    this.soundCache.set(name, params)
  }

  /**
   * Get parameters for a registered sound
   */
  getSoundParams(name: string): ZzFXParams | undefined {
    return this.soundCache.get(name)
  }

  /**
   * Stop all playing sounds
   */
  stopAll(): void {
    for (const node of this.playingSounds) {
      try {
        node.stop()
      } catch (e) {
        // Already stopped
      }
    }
    this.playingSounds.clear()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sound Design Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a sound with pitch variation (useful for footsteps, etc.)
   */
  playWithPitchVariation(params: ZzFXParams, variation: number = 0.1, volumeMultiplier: number = 1): AudioBufferSourceNode | null {
    const adjusted = [...params] as ZzFXParams
    const basePitch = adjusted[2] ?? 440
    adjusted[2] = basePitch * (1 + (Math.random() - 0.5) * 2 * variation)
    return this.play(adjusted, volumeMultiplier)
  }

  /**
   * Get all available preset names
   */
  getPresetNames(): string[] {
    return Object.keys(SFX_PRESETS)
  }

  /**
   * Get presets by category
   */
  getPresetsByCategory(): Record<string, string[]> {
    return {
      ui: ['click', 'hover', 'confirm', 'cancel', 'error', 'success'],
      movement: ['jump', 'land', 'walk', 'run'],
      combat: ['hit', 'punch', 'slash', 'block', 'death'],
      projectiles: ['shoot', 'laser', 'missile', 'explosion', 'smallExplosion'],
      items: ['coin', 'gem', 'powerup', 'heal'],
      environment: ['door', 'switch', 'splash', 'wind'],
      magic: ['magic', 'spell', 'teleport', 'charge'],
      retro: ['blip', 'bloop', 'beep', 'boop', 'zap', 'warp'],
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Instance
// ─────────────────────────────────────────────────────────────────────────────

export const Audio = ZzFXAudioManager.getInstance()

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

/** Play a preset sound */
export const playSFX = (name: string, volume?: number) => Audio.playPreset(name, volume)

/** Play custom sound parameters */
export const playSound = (params: ZzFXParams, volume?: number) => Audio.play(params, volume)

/** Play a random variation of a sound type */
export const playRandomSFX = (type: Parameters<typeof generateRandomSFX>[0], volume?: number) => Audio.playRandom(type, volume)
