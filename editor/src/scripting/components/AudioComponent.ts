// ═══════════════════════════════════════════════════════════════════════════
// Audio Component - Procedural sound effects using ZzFX
// Zero-asset audio for retro/chiptune games
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, select, action, signal, lifecycle } from '../decorators'
import {
  Audio,
  SFX_PRESETS,
  ZzFXParams,
  playSFX,
  playSound,
  generateRandomSFX,
} from '../../lib/audio/ZzFXAudio'

/** Sound effect categories for the visual editor */
export type SFXCategory = 'ui' | 'movement' | 'combat' | 'projectiles' | 'items' | 'environment' | 'magic' | 'retro'

/** Event emitted when a sound finishes playing */
export interface SoundEndEvent {
  soundName: string
  componentId: string
  nodeId?: string
  timestamp: number
}

// Global sound event listeners
const soundEndListeners: Set<(event: SoundEndEvent) => void> = new Set()

/** Subscribe to sound end events globally */
export function onSoundEnd(callback: (event: SoundEndEvent) => void): () => void {
  soundEndListeners.add(callback)
  return () => soundEndListeners.delete(callback)
}

/** Emit a sound end event to all listeners */
function emitSoundEnd(event: SoundEndEvent): void {
  for (const listener of soundEndListeners) {
    listener(event)
  }
}

@component({
  name: 'Audio',
  icon: '♪',
  description: 'Procedural sound effects using ZzFX'
})
export class AudioComponent extends Component {
  // ─────────────────────────────────────────────────────────────────────────
  // Properties
  // ─────────────────────────────────────────────────────────────────────────

  @property({
    type: 'number',
    label: 'Master Volume',
    group: 'Volume',
    min: 0,
    max: 1,
    step: 0.05,
    tooltip: 'Overall volume multiplier for all sounds'
  })
  masterVolume: number = 1

  @property({
    type: 'number',
    label: 'SFX Volume',
    group: 'Volume',
    min: 0,
    max: 1,
    step: 0.05,
    tooltip: 'Volume multiplier for sound effects'
  })
  sfxVolume: number = 1

  @property({
    type: 'number',
    label: 'Music Volume',
    group: 'Volume',
    min: 0,
    max: 1,
    step: 0.05,
    tooltip: 'Volume multiplier for music'
  })
  musicVolume: number = 0.5

  @property({
    type: 'boolean',
    label: 'Muted',
    group: 'State',
    tooltip: 'Mute all audio'
  })
  muted: boolean = false

  @property({
    type: 'number',
    label: 'Pitch Variation',
    group: 'Variation',
    min: 0,
    max: 0.5,
    step: 0.05,
    tooltip: 'Random pitch variation (0 = none, 0.5 = +/- 50%)'
  })
  pitchVariation: number = 0

  @property({
    type: 'number',
    label: 'Volume Variation',
    group: 'Variation',
    min: 0,
    max: 0.5,
    step: 0.05,
    tooltip: 'Random volume variation (0 = none, 0.5 = +/- 50%)'
  })
  volumeVariation: number = 0

  // ─────────────────────────────────────────────────────────────────────────
  // Signals
  // ─────────────────────────────────────────────────────────────────────────

  @signal({ displayName: 'On Sound End', description: 'Fired when a sound finishes playing' })
  onSoundEnd: ((event: SoundEndEvent) => void) | null = null

  @signal({ displayName: 'On Sound Play', description: 'Fired when a sound starts playing' })
  onSoundPlay: ((soundName: string) => void) | null = null

  // ─────────────────────────────────────────────────────────────────────────
  // Internal State
  // ─────────────────────────────────────────────────────────────────────────

  private playingSounds: Map<string, AudioBufferSourceNode> = new Map()
  private soundCounter: number = 0
  private customSounds: Map<string, ZzFXParams> = new Map()

  // ─────────────────────────────────────────────────────────────────────────
  // Actions - Preset Sounds
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Play a preset sound effect by name
   */
  @action({
    displayName: 'Play Preset',
    category: 'Playback',
    description: 'Play a preset sound effect (click, jump, coin, etc.)'
  })
  playPreset(name: string): void {
    if (this.muted) return

    const volume = this.calculateVolume()
    const node = this.pitchVariation > 0
      ? Audio.playWithPitchVariation(SFX_PRESETS[name] || this.customSounds.get(name) || SFX_PRESETS['blip'], this.pitchVariation, volume)
      : Audio.playPreset(name, volume)

    if (node) {
      this.trackSound(name, node)
      this.onSoundPlay?.(name)
    }
  }

  /**
   * Play a UI sound
   */
  @action({ displayName: 'Play Click', category: 'UI', description: 'Play a click sound' })
  playClick(): void { this.playPreset('click') }

  @action({ displayName: 'Play Hover', category: 'UI', description: 'Play a hover sound' })
  playHover(): void { this.playPreset('hover') }

  @action({ displayName: 'Play Confirm', category: 'UI', description: 'Play a confirm sound' })
  playConfirm(): void { this.playPreset('confirm') }

  @action({ displayName: 'Play Cancel', category: 'UI', description: 'Play a cancel sound' })
  playCancel(): void { this.playPreset('cancel') }

  @action({ displayName: 'Play Error', category: 'UI', description: 'Play an error sound' })
  playError(): void { this.playPreset('error') }

  @action({ displayName: 'Play Success', category: 'UI', description: 'Play a success sound' })
  playSuccess(): void { this.playPreset('success') }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions - Movement Sounds
  // ─────────────────────────────────────────────────────────────────────────

  @action({ displayName: 'Play Jump', category: 'Movement', description: 'Play a jump sound' })
  playJump(): void { this.playPreset('jump') }

  @action({ displayName: 'Play Land', category: 'Movement', description: 'Play a landing sound' })
  playLand(): void { this.playPreset('land') }

  @action({ displayName: 'Play Walk', category: 'Movement', description: 'Play a walk footstep' })
  playWalk(): void { this.playPreset('walk') }

  @action({ displayName: 'Play Run', category: 'Movement', description: 'Play a run footstep' })
  playRun(): void { this.playPreset('run') }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions - Combat Sounds
  // ─────────────────────────────────────────────────────────────────────────

  @action({ displayName: 'Play Hit', category: 'Combat', description: 'Play a hit impact sound' })
  playHit(): void { this.playPreset('hit') }

  @action({ displayName: 'Play Punch', category: 'Combat', description: 'Play a punch sound' })
  playPunch(): void { this.playPreset('punch') }

  @action({ displayName: 'Play Slash', category: 'Combat', description: 'Play a slash sound' })
  playSlash(): void { this.playPreset('slash') }

  @action({ displayName: 'Play Block', category: 'Combat', description: 'Play a block sound' })
  playBlock(): void { this.playPreset('block') }

  @action({ displayName: 'Play Death', category: 'Combat', description: 'Play a death sound' })
  playDeath(): void { this.playPreset('death') }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions - Projectile Sounds
  // ─────────────────────────────────────────────────────────────────────────

  @action({ displayName: 'Play Shoot', category: 'Projectiles', description: 'Play a shoot sound' })
  playShoot(): void { this.playPreset('shoot') }

  @action({ displayName: 'Play Laser', category: 'Projectiles', description: 'Play a laser sound' })
  playLaser(): void { this.playPreset('laser') }

  @action({ displayName: 'Play Missile', category: 'Projectiles', description: 'Play a missile sound' })
  playMissile(): void { this.playPreset('missile') }

  @action({ displayName: 'Play Explosion', category: 'Projectiles', description: 'Play an explosion sound' })
  playExplosion(): void { this.playPreset('explosion') }

  @action({ displayName: 'Play Small Explosion', category: 'Projectiles', description: 'Play a small explosion' })
  playSmallExplosion(): void { this.playPreset('smallExplosion') }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions - Item Sounds
  // ─────────────────────────────────────────────────────────────────────────

  @action({ displayName: 'Play Coin', category: 'Items', description: 'Play a coin pickup sound' })
  playCoin(): void { this.playPreset('coin') }

  @action({ displayName: 'Play Gem', category: 'Items', description: 'Play a gem pickup sound' })
  playGem(): void { this.playPreset('gem') }

  @action({ displayName: 'Play Powerup', category: 'Items', description: 'Play a powerup sound' })
  playPowerup(): void { this.playPreset('powerup') }

  @action({ displayName: 'Play Heal', category: 'Items', description: 'Play a heal sound' })
  playHeal(): void { this.playPreset('heal') }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions - Environment Sounds
  // ─────────────────────────────────────────────────────────────────────────

  @action({ displayName: 'Play Door', category: 'Environment', description: 'Play a door sound' })
  playDoor(): void { this.playPreset('door') }

  @action({ displayName: 'Play Switch', category: 'Environment', description: 'Play a switch sound' })
  playSwitch(): void { this.playPreset('switch') }

  @action({ displayName: 'Play Splash', category: 'Environment', description: 'Play a splash sound' })
  playSplash(): void { this.playPreset('splash') }

  @action({ displayName: 'Play Wind', category: 'Environment', description: 'Play a wind sound' })
  playWind(): void { this.playPreset('wind') }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions - Magic Sounds
  // ─────────────────────────────────────────────────────────────────────────

  @action({ displayName: 'Play Magic', category: 'Magic', description: 'Play a magic sound' })
  playMagic(): void { this.playPreset('magic') }

  @action({ displayName: 'Play Spell', category: 'Magic', description: 'Play a spell sound' })
  playSpell(): void { this.playPreset('spell') }

  @action({ displayName: 'Play Teleport', category: 'Magic', description: 'Play a teleport sound' })
  playTeleport(): void { this.playPreset('teleport') }

  @action({ displayName: 'Play Charge', category: 'Magic', description: 'Play a charge-up sound' })
  playCharge(): void { this.playPreset('charge') }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions - Retro Sounds
  // ─────────────────────────────────────────────────────────────────────────

  @action({ displayName: 'Play Blip', category: 'Retro', description: 'Play a blip sound' })
  playBlip(): void { this.playPreset('blip') }

  @action({ displayName: 'Play Bloop', category: 'Retro', description: 'Play a bloop sound' })
  playBloop(): void { this.playPreset('bloop') }

  @action({ displayName: 'Play Beep', category: 'Retro', description: 'Play a beep sound' })
  playBeep(): void { this.playPreset('beep') }

  @action({ displayName: 'Play Boop', category: 'Retro', description: 'Play a boop sound' })
  playBoop(): void { this.playPreset('boop') }

  @action({ displayName: 'Play Zap', category: 'Retro', description: 'Play a zap sound' })
  playZap(): void { this.playPreset('zap') }

  @action({ displayName: 'Play Warp', category: 'Retro', description: 'Play a warp sound' })
  playWarp(): void { this.playPreset('warp') }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions - Random/Procedural Sounds
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Play a procedurally generated random sound
   */
  @action({
    displayName: 'Play Random',
    category: 'Procedural',
    description: 'Play a randomly generated sound of a given type'
  })
  playRandom(type: 'hit' | 'jump' | 'coin' | 'shoot' | 'explosion' | 'powerup' | 'blip'): void {
    if (this.muted) return

    const params = generateRandomSFX(type)
    const volume = this.calculateVolume()
    const node = playSound(params, volume)

    if (node) {
      this.trackSound(`random:${type}`, node)
      this.onSoundPlay?.(`random:${type}`)
    }
  }

  @action({ displayName: 'Play Random Hit', category: 'Procedural', description: 'Play a random hit sound' })
  playRandomHit(): void { this.playRandom('hit') }

  @action({ displayName: 'Play Random Jump', category: 'Procedural', description: 'Play a random jump sound' })
  playRandomJump(): void { this.playRandom('jump') }

  @action({ displayName: 'Play Random Coin', category: 'Procedural', description: 'Play a random coin sound' })
  playRandomCoin(): void { this.playRandom('coin') }

  @action({ displayName: 'Play Random Shoot', category: 'Procedural', description: 'Play a random shoot sound' })
  playRandomShoot(): void { this.playRandom('shoot') }

  @action({ displayName: 'Play Random Explosion', category: 'Procedural', description: 'Play a random explosion' })
  playRandomExplosion(): void { this.playRandom('explosion') }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions - Custom Sound Parameters
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Play a sound with custom ZzFX parameters
   */
  @action({
    displayName: 'Play Custom',
    category: 'Advanced',
    description: 'Play a sound with custom ZzFX parameters array'
  })
  playCustom(params: ZzFXParams): void {
    if (this.muted) return

    const volume = this.calculateVolume()
    const node = playSound(params, volume)

    if (node) {
      this.trackSound('custom', node)
      this.onSoundPlay?.('custom')
    }
  }

  /**
   * Register a custom sound for later use
   */
  @action({
    displayName: 'Register Sound',
    category: 'Advanced',
    description: 'Register a custom sound with a name'
  })
  registerSound(name: string, params: ZzFXParams): void {
    this.customSounds.set(name, params)
    Audio.registerSound(name, params)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions - Volume Control
  // ─────────────────────────────────────────────────────────────────────────

  @action({ displayName: 'Set Master Volume', category: 'Volume', description: 'Set the master volume (0-1)' })
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume))
    Audio.setVolume(this.masterVolume)
  }

  @action({ displayName: 'Set SFX Volume', category: 'Volume', description: 'Set the SFX volume (0-1)' })
  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume))
  }

  @action({ displayName: 'Set Music Volume', category: 'Volume', description: 'Set the music volume (0-1)' })
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume))
    Audio.setMusicVolume(this.musicVolume)
  }

  @action({ displayName: 'Mute', category: 'Volume', description: 'Mute all audio' })
  mute(): void {
    this.muted = true
    Audio.setMuted(true)
  }

  @action({ displayName: 'Unmute', category: 'Volume', description: 'Unmute all audio' })
  unmute(): void {
    this.muted = false
    Audio.setMuted(false)
  }

  @action({ displayName: 'Toggle Mute', category: 'Volume', description: 'Toggle mute state' })
  toggleMute(): void {
    this.muted = !this.muted
    Audio.setMuted(this.muted)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions - Playback Control
  // ─────────────────────────────────────────────────────────────────────────

  @action({ displayName: 'Stop All', category: 'Control', description: 'Stop all playing sounds' })
  stopAll(): void {
    for (const node of this.playingSounds.values()) {
      try {
        node.stop()
      } catch (e) {
        // Already stopped
      }
    }
    this.playingSounds.clear()
    Audio.stopAll()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @lifecycle('Execute:Init')
  onInit(): void {
    // Sync volume settings to global audio manager
    Audio.setVolume(this.masterVolume)
    Audio.setMusicVolume(this.musicVolume)
    Audio.setMuted(this.muted)
  }

  @lifecycle('Execute:Dispose')
  onDispose(): void {
    this.stopAll()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal Methods
  // ─────────────────────────────────────────────────────────────────────────

  private calculateVolume(): number {
    let volume = this.masterVolume * this.sfxVolume

    // Apply volume variation
    if (this.volumeVariation > 0) {
      const variation = (Math.random() - 0.5) * 2 * this.volumeVariation
      volume *= (1 + variation)
    }

    return Math.max(0, Math.min(1, volume))
  }

  private trackSound(name: string, node: AudioBufferSourceNode): void {
    const id = `${name}:${this.soundCounter++}`
    this.playingSounds.set(id, node)

    node.onended = () => {
      this.playingSounds.delete(id)

      const event: SoundEndEvent = {
        soundName: name,
        componentId: this.id,
        nodeId: this.node?.id,
        timestamp: Date.now(),
      }

      emitSoundEnd(event)
      this.onSoundEnd?.(event)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public Getters
  // ─────────────────────────────────────────────────────────────────────────

  /** Get number of currently playing sounds */
  getPlayingCount(): number {
    return this.playingSounds.size
  }

  /** Check if any sounds are playing */
  isPlaying(): boolean {
    return this.playingSounds.size > 0
  }

  /** Get all available preset names */
  getPresetNames(): string[] {
    return [...Object.keys(SFX_PRESETS), ...this.customSounds.keys()]
  }

  /** Get presets organized by category */
  getPresetsByCategory(): Record<SFXCategory, string[]> {
    return Audio.getPresetsByCategory() as Record<SFXCategory, string[]>
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Audio Functions (convenience exports)
// ─────────────────────────────────────────────────────────────────────────────

const globalAudio = new AudioComponent()

/** Global audio convenience object */
export const GameAudio = {
  // Preset sounds
  play: (name: string) => globalAudio.playPreset(name),

  // UI
  click: () => globalAudio.playClick(),
  hover: () => globalAudio.playHover(),
  confirm: () => globalAudio.playConfirm(),
  cancel: () => globalAudio.playCancel(),
  error: () => globalAudio.playError(),
  success: () => globalAudio.playSuccess(),

  // Movement
  jump: () => globalAudio.playJump(),
  land: () => globalAudio.playLand(),
  walk: () => globalAudio.playWalk(),
  run: () => globalAudio.playRun(),

  // Combat
  hit: () => globalAudio.playHit(),
  punch: () => globalAudio.playPunch(),
  slash: () => globalAudio.playSlash(),
  block: () => globalAudio.playBlock(),
  death: () => globalAudio.playDeath(),

  // Projectiles
  shoot: () => globalAudio.playShoot(),
  laser: () => globalAudio.playLaser(),
  explosion: () => globalAudio.playExplosion(),

  // Items
  coin: () => globalAudio.playCoin(),
  gem: () => globalAudio.playGem(),
  powerup: () => globalAudio.playPowerup(),
  heal: () => globalAudio.playHeal(),

  // Magic
  magic: () => globalAudio.playMagic(),
  spell: () => globalAudio.playSpell(),
  teleport: () => globalAudio.playTeleport(),

  // Retro
  blip: () => globalAudio.playBlip(),
  bloop: () => globalAudio.playBloop(),
  beep: () => globalAudio.playBeep(),
  boop: () => globalAudio.playBoop(),
  zap: () => globalAudio.playZap(),
  warp: () => globalAudio.playWarp(),

  // Random
  randomHit: () => globalAudio.playRandomHit(),
  randomJump: () => globalAudio.playRandomJump(),
  randomCoin: () => globalAudio.playRandomCoin(),
  randomShoot: () => globalAudio.playRandomShoot(),
  randomExplosion: () => globalAudio.playRandomExplosion(),

  // Control
  mute: () => globalAudio.mute(),
  unmute: () => globalAudio.unmute(),
  toggleMute: () => globalAudio.toggleMute(),
  stopAll: () => globalAudio.stopAll(),
  setVolume: (v: number) => globalAudio.setMasterVolume(v),
}
