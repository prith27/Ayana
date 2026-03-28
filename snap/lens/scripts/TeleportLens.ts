/**
 * TeleportLens.ts — Ayana Teleport Me Lens
 *
 * HOW IT WORKS:
 *  - 3 stations per city, each a sphere with its own cubemap baked in.
 *  - DeviceTracking rotates the active sphere so gyroscope = look-around.
 *  - Left/right tap zones let the user "walk" between stations.
 *  - A fade-to-black transition plays between stations (0.25s out + 0.25s in).
 *  - Location dots at the bottom show which station you're on.
 *  - Front camera shows the user's face layered in front of the environment.
 *
 * LENS STUDIO SCENE HIERARCHY:
 *
 *   [Camera — Front] ← default, shows user face
 *   AyanaController  ← this script lives here
 *   Stations         ← parent object
 *     Station_0      ← sphere mesh, cubemap material s0, DeviceTracking
 *     Station_1      ← sphere mesh, cubemap material s1, DeviceTracking (disabled)
 *     Station_2      ← sphere mesh, cubemap material s2, DeviceTracking (disabled)
 *   UI [ScreenCanvas]
 *     BrandingOverlay
 *       CityNameText
 *       CountryText
 *       TaglineText
 *     NavOverlay
 *       TapLeft        ← invisible touch zone, left 30% of screen
 *       TapRight       ← invisible touch zone, right 30% of screen
 *       Dot_0          ← location indicator dot
 *       Dot_1
 *       Dot_2
 *       StationLabel   ← e.g. "Trocadéro · Classic full view"
 *     FadeOverlay      ← full-screen black quad, alpha tweened during transitions
 *     ShareHintText
 *
 * See LENS_SETUP.md for step-by-step wiring instructions.
 */

import { ACTIVE_CITY } from './CityConfig'

// ─────────────────────────────────────────────────────────────────────────────

@component
export class TeleportLens extends BaseScriptComponent {

  // ── Inspector inputs — wire all of these in Lens Studio ──────────────────

  /** Parent SceneObject containing Station_0, Station_1, Station_2 as children */
  @input
  stationsParent!: SceneObject

  /** Full-screen black quad for fade transitions (Image component, alpha = 0 at start) */
  @input
  fadeOverlay!: SceneObject

  /** Branding container — animated in on load */
  @input
  brandingOverlay!: SceneObject

  @input('Component.Text')
  cityNameText!: Text

  @input('Component.Text')
  countryText!: Text

  @input('Component.Text')
  taglineText!: Text

  /** Bottom label showing current station name + sublabel */
  @input('Component.Text')
  stationLabelText!: Text

  /** Hint text that cycles through messages */
  @input('Component.Text')
  shareHintText!: Text

  /** Left-tap zone SceneObject (has a TouchComponent) */
  @input
  tapLeft!: SceneObject

  /** Right-tap zone SceneObject (has a TouchComponent) */
  @input
  tapRight!: SceneObject

  /** Location dots — must be exactly 3, one per station */
  @input
  dot0!: SceneObject

  @input
  dot1!: SceneObject

  @input
  dot2!: SceneObject

  // ── State ─────────────────────────────────────────────────────────────────

  private stations: SceneObject[] = []
  private dots: SceneObject[] = []
  private currentStation = 0
  private isTransitioning = false
  private fadePass: Pass | null = null

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onAwake(): void {
    this.collectChildren()
    this.setupUI()
    this.setupNavTaps()
    this.activateStation(0, false)
    this.scheduleHints()

    print(`[AyanaLens] ${ACTIVE_CITY.displayName} — ${ACTIVE_CITY.stations.length} stations ready`)
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  private collectChildren(): void {
    if (!this.stationsParent) {
      print('[AyanaLens] ERROR: stationsParent not wired')
      return
    }

    // Collect Station_0 … Station_N as ordered children
    const count = this.stationsParent.getChildrenCount()
    for (let i = 0; i < count; i++) {
      this.stations.push(this.stationsParent.getChild(i))
    }

    this.dots = [this.dot0, this.dot1, this.dot2].filter(Boolean)

    // Grab the fade overlay's material pass for alpha tweening
    if (this.fadeOverlay) {
      const img = this.fadeOverlay.getComponent('Component.Image') as Image | null
      if (img) {
        this.fadePass = img.getMaterial(0)?.getPass(0) ?? null
        this.setFadeAlpha(0)
      }
    }
  }

  private setupUI(): void {
    if (this.cityNameText)  this.cityNameText.text  = ACTIVE_CITY.displayName.toUpperCase()
    if (this.countryText)   this.countryText.text   = ACTIVE_CITY.country
    if (this.taglineText)   this.taglineText.text   = ACTIVE_CITY.tagline
    if (this.shareHintText) this.shareHintText.text = 'Rotate your phone to look around'

    // Animate branding in after 1.2s
    if (this.brandingOverlay) {
      this.brandingOverlay.enabled = false
      const delay = this.createEvent('DelayedCallbackEvent')
      delay.bind(() => { if (this.brandingOverlay) this.brandingOverlay.enabled = true })
      delay.reset(1.2)
    }
  }

  private setupNavTaps(): void {
    this.bindTap(this.tapLeft,  () => this.walk(-1))
    this.bindTap(this.tapRight, () => this.walk(+1))
  }

  private bindTap(obj: SceneObject, callback: () => void): void {
    if (!obj) return
    const touch = obj.getComponent('Component.TouchComponent') as TouchComponent | null
    if (!touch) {
      print(`[AyanaLens] No TouchComponent on ${obj.name} — add one in Inspector`)
      return
    }
    touch.addTapCallback(callback)
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  private walk(direction: -1 | 1): void {
    if (this.isTransitioning || this.stations.length === 0) return

    const next = (this.currentStation + direction + this.stations.length) % this.stations.length
    if (next === this.currentStation) return

    this.isTransitioning = true
    this.crossFade(next)
  }

  /**
   * Fade out → switch station → fade in.
   * Total duration: FADE_OUT_SECS + FADE_IN_SECS
   */
  private crossFade(nextIndex: number): void {
    const FADE_OUT = 0.25
    const FADE_IN  = 0.25

    this.tween(0, 1, FADE_OUT, (alpha) => {
      this.setFadeAlpha(alpha)
    }, () => {
      // Midpoint: swap active station while screen is black
      this.activateStation(nextIndex, false)

      this.tween(1, 0, FADE_IN, (alpha) => {
        this.setFadeAlpha(alpha)
      }, () => {
        this.isTransitioning = false
      })
    })
  }

  private activateStation(index: number, animate: boolean): void {
    this.currentStation = index

    this.stations.forEach((s, i) => {
      s.enabled = (i === index)

      // Each station sphere has its own DeviceTracking — enable only the active one
      const tracking = s.getComponent('Component.DeviceTracking') as DeviceTracking | null
      if (tracking) {
        if (i === index) {
          tracking.requestDeviceTrackingMode(DeviceTrackingMode.Rotation)
        }
      }
    })

    this.updateDots(index)
    this.updateStationLabel(index)
  }

  // ── UI updates ────────────────────────────────────────────────────────────

  private updateDots(activeIndex: number): void {
    this.dots.forEach((dot, i) => {
      if (!dot) return
      // Swap material or scale to show active vs inactive state.
      // Convention: active dot is scaled 1.4×, inactive 1.0×
      const t = dot.getTransform()
      if (i === activeIndex) {
        t.setLocalScale(new vec3(1.4, 1.4, 1.4))
      } else {
        t.setLocalScale(new vec3(1.0, 1.0, 1.0))
      }
    })
  }

  private updateStationLabel(index: number): void {
    if (!this.stationLabelText) return
    const station = ACTIVE_CITY.stations[index]
    if (!station) return
    this.stationLabelText.text = `${station.label}  ·  ${station.sublabel}`
  }

  // ── Hints ─────────────────────────────────────────────────────────────────

  private scheduleHints(): void {
    const hints = [
      { delay: 3.5,  text: 'Rotate your phone to look around' },
      { delay: 8.0,  text: 'Tap sides to walk to next spot →' },
      { delay: 14.0, text: 'Hold to snap your moment'         },
      { delay: 20.0, text: ''                                  },
    ]
    hints.forEach(({ delay, text }) => {
      const ev = this.createEvent('DelayedCallbackEvent')
      ev.bind(() => { if (this.shareHintText) this.shareHintText.text = text })
      ev.reset(delay)
    })
  }

  // ── Tween utility ─────────────────────────────────────────────────────────

  /**
   * Linear tween from `from` to `to` over `duration` seconds.
   * Calls `onUpdate(value)` each frame and `onComplete()` when done.
   */
  private tween(
    from: number,
    to: number,
    duration: number,
    onUpdate: (v: number) => void,
    onComplete: () => void
  ): void {
    const start = getTime()
    const update = this.createEvent('UpdateEvent')
    update.bind(() => {
      const t = Math.min((getTime() - start) / duration, 1.0)
      onUpdate(from + (to - from) * t)
      if (t >= 1.0) {
        this.removeEvent(update)
        onComplete()
      }
    })
  }

  // ── Fade overlay ──────────────────────────────────────────────────────────

  private setFadeAlpha(alpha: number): void {
    if (!this.fadePass) return
    this.fadePass.baseColor = new vec4(0, 0, 0, alpha)
  }
}
