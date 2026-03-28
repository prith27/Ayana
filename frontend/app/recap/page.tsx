'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────

type Persona = 'adventure' | 'romantic' | 'peaceful'

const SELECTED_PERSONA: Persona = 'adventure'
const YEAR = '2026'
const TOTAL_CARDS = 10

const PERSONA_CFG = {
  adventure: {
    label: 'ADVENTURER',
    tagline: 'Bold. Fearless. Unstoppable.',
    color: '#D4692A',
    colorLight: '#FF9454',
    glow: 'rgba(212,105,42,0.4)',
    glowDim: 'rgba(212,105,42,0.18)',
    bgDeep: '#1e0800',
  },
  romantic: {
    label: 'ROMANTIC',
    tagline: 'Tender. Luminous. Unforgettable.',
    color: '#C45C72',
    colorLight: '#E87D95',
    glow: 'rgba(196,92,114,0.4)',
    glowDim: 'rgba(196,92,114,0.18)',
    bgDeep: '#1a0008',
  },
  peaceful: {
    label: 'WANDERER',
    tagline: 'Calm. Curious. At one with the world.',
    color: '#22A898',
    colorLight: '#3DD9C9',
    glow: 'rgba(34,168,152,0.4)',
    glowDim: 'rgba(34,168,152,0.18)',
    bgDeep: '#001e1c',
  },
}

const PC = PERSONA_CFG[SELECTED_PERSONA]

const STOPS = [
  { id: '01', name: 'Senso-ji Temple',  area: 'Asakusa',           type: 'Heritage',       desc: "Tokyo's oldest and most sacred Buddhist temple — where ancient Japan breathes." },
  { id: '02', name: 'Shibuya Crossing', area: 'Shibuya',           type: 'Urban Icon',     desc: 'The most electric pedestrian crossing on the planet. Every signal change, a thousand stories.' },
  { id: '03', name: 'Tokyo Tower',      area: 'Shiba-koen',        type: 'Landmark',       desc: 'Iconic lattice silhouette burning orange against the city skyline.' },
  { id: '04', name: 'Fushimi Inari',    area: 'Fushimi, Kyoto',    type: 'Sacred Site',    desc: 'Thousands of vermilion torii gates weaving a path up the sacred mountain.' },
  { id: '05', name: 'Mount Fuji',       area: 'Fujinomiya',        type: 'Natural Wonder', desc: '3,776 metres of sacred silence. Japan\'s eternal crown above the clouds.' },
]

const FOOD = [
  { rank: '01', name: 'Tsukiji Outer Market', rating: 4.6, cuisine: 'Seafood Market', price: '¥¥' },
  { rank: '02', name: 'Ichiran Ramen',        rating: 4.4, cuisine: 'Japanese Ramen', price: '¥¥' },
  { rank: '03', name: 'Harajuku Crepes',      rating: 4.3, cuisine: 'Street Food',    price: '¥'  },
]

const ACTIVITIES = [
  { name: 'TeamLab Borderless',  rating: 4.8, type: 'Digital Art',       highlight: true  },
  { name: 'Meiji Shrine Walk',   rating: 4.7, type: 'Cultural',          highlight: false },
  { name: 'Shinjuku Nightlife',  rating: 4.5, type: 'Urban Exploration', highlight: false },
]

const STATS = [
  { value: 142, suffix: 'km',  label: 'DISTANCE\nCOVERED',        color: '#D4692A' },
  { value: 7,   suffix: '',    label: 'NEIGHBORHOODS\nEXPLORED',   color: '#22A898' },
  { value: 23,  suffix: '',    label: 'PLACES\nDISCOVERED',        color: '#C45C72' },
  { value: 94,  suffix: '',    label: 'EXPLORATION\nSCORE',        color: '#FFD27F' },
]

const DNA = [
  { trait: 'Cultural Explorer', pct: 82, color: '#D4692A' },
  { trait: 'Urban Adventurer',  pct: 95, color: '#FF9454' },
  { trait: 'Food Seeker',       pct: 71, color: '#C45C72' },
  { trait: 'Nature Chaser',     pct: 64, color: '#22A898' },
]

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

function useCountUp(target: number, active: boolean, duration = 1400) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) { setVal(0); return }
    let rafId: number
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - t0) / duration, 1)
      setVal(Math.round((1 - Math.pow(1 - t, 3)) * target))
      if (t < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [target, active, duration])
  return val
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-ADVANCE TIMER (Spotify Wrapped style)
// ─────────────────────────────────────────────────────────────────────────────

const CARD_DURATION_MS = 5000

function useAutoAdvance(card: number, isLast: boolean, onAdvance: () => void) {
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    setProgress(0)
    if (isLast) return
    let startTime = 0
    const tick = (now: number) => {
      if (!startTime) startTime = now
      const p = Math.min((now - startTime) / CARD_DURATION_MS, 1)
      setProgress(p)
      if (p >= 1) { onAdvance() }
      else { rafRef.current = requestAnimationFrame(tick) }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [card, isLast, onAdvance])

  return progress
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD AUDIO ENGINE  (Web Audio API – ambient soundscapes per card)
// ─────────────────────────────────────────────────────────────────────────────

type AudioCfg = { freqs: number[]; wave: OscillatorType; vol: number }

// Pentatonic-inspired ambient frequencies — tuned per card mood
const CARD_AUDIO: AudioCfg[] = [
  { freqs: [55, 110, 164.8],    wave: 'sine',     vol: 0.22 }, // C0: Hero — deep cosmos, awe
  { freqs: [110, 220, 330],     wave: 'triangle', vol: 0.20 }, // C1: Persona — bold swell
  { freqs: [440, 554, 659],     wave: 'sine',     vol: 0.16 }, // C2: Count — discovery chime
  { freqs: [82, 110, 220],      wave: 'sine',     vol: 0.20 }, // C3: Stops — contemplative hum
  { freqs: [110, 220, 440],     wave: 'sine',     vol: 0.18 }, // C4: Temple — sacred bells
  { freqs: [196, 262, 330],     wave: 'sine',     vol: 0.20 }, // C5: Food — warm & round
  { freqs: [180, 360, 540],     wave: 'sawtooth', vol: 0.10 }, // C6: Activities — electric pulse
  { freqs: [262, 392, 523],     wave: 'triangle', vol: 0.18 }, // C7: Stats — ascending data
  { freqs: [65, 98, 196],       wave: 'sine',     vol: 0.22 }, // C8: DNA — deep introspect
  { freqs: [262, 392, 523],     wave: 'sine',     vol: 0.20 }, // C9: Next — triumphant resolution
]

// Shared AudioContext ref — created on first user gesture to satisfy browser autoplay policy
const sharedAudioCtx = { ref: null as AudioContext | null }

function initAudioCtx(): AudioContext {
  if (!sharedAudioCtx.ref) {
    sharedAudioCtx.ref = new (window.AudioContext ||
      (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  if (sharedAudioCtx.ref.state === 'suspended') sharedAudioCtx.ref.resume()
  return sharedAudioCtx.ref
}

function useCardAudio(card: number, enabled: boolean) {
  const masterRef = useRef<GainNode | null>(null)
  const oscRefs   = useRef<OscillatorNode[]>([])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const ctx = sharedAudioCtx.ref
    if (!ctx) return  // not yet created — will run again after initAudioCtx() is called
    const cfg = CARD_AUDIO[card]
    if (!cfg) return

    // Fade out previous sound
    const prev = masterRef.current
    const old  = oscRefs.current.slice()
    if (prev) {
      try { prev.gain.setValueAtTime(prev.gain.value, ctx.currentTime) } catch {}
      try { prev.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4) } catch {}
      setTimeout(() => old.forEach(o => { try { o.stop() } catch {} }), 550)
    }

    // Build reverb impulse response
    const convolver = ctx.createConvolver()
    const len = Math.floor(ctx.sampleRate * 2.0)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2)
    }
    convolver.buffer = buf

    // Master gain node (controls overall fade)
    const master = ctx.createGain()
    master.gain.setValueAtTime(0, ctx.currentTime)
    masterRef.current = master

    const dryG = ctx.createGain(); dryG.gain.value = 0.6
    const wetG = ctx.createGain(); wetG.gain.value = 0.4
    master.connect(dryG);      dryG.connect(ctx.destination)
    master.connect(convolver); convolver.connect(wetG); wetG.connect(ctx.destination)

    // Create oscillator stack with LFO breathing
    const newOscs: OscillatorNode[] = []
    cfg.freqs.forEach((freq, idx) => {
      const osc     = ctx.createOscillator()
      const oscGain = ctx.createGain()
      const lfo     = ctx.createOscillator()
      const lfoGain = ctx.createGain()

      osc.type            = idx === cfg.freqs.length - 1 ? cfg.wave : 'sine'
      osc.frequency.value = freq
      osc.detune.value    = (idx - 1) * 5            // slight detuning for richness
      oscGain.gain.value  = cfg.vol * Math.pow(0.65, idx)
      lfo.frequency.value = 0.12 + idx * 0.05        // slow breathing LFO
      lfoGain.gain.value  = oscGain.gain.value * 0.15
      lfo.connect(lfoGain); lfoGain.connect(oscGain.gain)
      osc.connect(oscGain); oscGain.connect(master)
      osc.start(); lfo.start()
      newOscs.push(osc, lfo)
    })

    oscRefs.current = newOscs
    master.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.8) // fade-in

    return () => {
      try { master.gain.setValueAtTime(master.gain.value, ctx.currentTime) } catch {}
      try { master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5) } catch {}
      setTimeout(() => newOscs.forEach(o => { try { o.stop() } catch {} }), 650)
    }
  }, [card, enabled])
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,700;0,6..96,900;1,6..96,400;1,6..96,700&family=Syne:wght@400;600;700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; }

@keyframes rcIn   { from { opacity:0; transform:scale(0.94) translateY(20px) } to { opacity:1; transform:scale(1) translateY(0) } }
@keyframes rcUp   { from { opacity:0; transform:translateY(24px) }             to { opacity:1; transform:translateY(0) } }
@keyframes rcLeft { from { opacity:0; transform:translateX(-28px) }            to { opacity:1; transform:translateX(0) } }
@keyframes rcPulse{ 0%,100%{ opacity:.5 } 50%{ opacity:.15 } }
@keyframes rcBar  { from { transform:scaleX(0) } to { transform:scaleX(1) } }
@keyframes rcGlow { 0%,100%{ opacity:.6 } 50%{ opacity:1 } }
@keyframes rcShim {
  0%   { background-position:-250% center }
  100% { background-position: 250% center }
}
@keyframes rcOrbit {
  from { transform:rotate(0deg) }
  to   { transform:rotate(360deg) }
}
@keyframes rcFloat {
  0%,100%{ transform:translateY(0) }
  50%    { transform:translateY(-8px) }
}

.rc-in   { animation: rcIn   .65s cubic-bezier(.22,1,.36,1) both }
.rc-s1   { animation: rcUp .6s  .04s cubic-bezier(.22,1,.36,1) both }
.rc-s2   { animation: rcUp .6s  .14s cubic-bezier(.22,1,.36,1) both }
.rc-s3   { animation: rcUp .6s  .26s cubic-bezier(.22,1,.36,1) both }
.rc-s4   { animation: rcUp .6s  .40s cubic-bezier(.22,1,.36,1) both }
.rc-s5   { animation: rcUp .6s  .55s cubic-bezier(.22,1,.36,1) both }
.rc-s6   { animation: rcUp .6s  .70s cubic-bezier(.22,1,.36,1) both }
.rc-sl1  { animation: rcLeft .55s .06s cubic-bezier(.22,1,.36,1) both }
.rc-sl2  { animation: rcLeft .55s .18s cubic-bezier(.22,1,.36,1) both }
.rc-sl3  { animation: rcLeft .55s .30s cubic-bezier(.22,1,.36,1) both }
.rc-sl4  { animation: rcLeft .55s .42s cubic-bezier(.22,1,.36,1) both }
.rc-sl5  { animation: rcLeft .55s .54s cubic-bezier(.22,1,.36,1) both }
.rc-hint { animation: rcPulse 2.4s ease-in-out infinite }
.rc-glow { animation: rcGlow  3s   ease-in-out infinite }
.rc-bar  { transform-origin:left; animation: rcBar 1.1s cubic-bezier(.22,1,.36,1) both }
.rc-b1   { animation-delay:.25s }
.rc-b2   { animation-delay:.45s }
.rc-b3   { animation-delay:.65s }
.rc-b4   { animation-delay:.85s }
.rc-float{ animation: rcFloat 3.5s ease-in-out infinite }

.rc-shimtext {
  background: linear-gradient(90deg,
    rgba(255,255,255,.25) 0%,
    rgba(255,255,255,.85) 40%,
    rgba(255,255,255,.25) 80%
  );
  background-size:250% auto;
  -webkit-background-clip:text; background-clip:text;
  -webkit-text-fill-color:transparent;
  animation: rcShim 3.5s linear infinite;
}

.rc-btn {
  display:flex; align-items:center; justify-content:space-between;
  width:100%; padding:14px 20px;
  border-radius:3px;
  font-family:'Syne',sans-serif;
  font-size:11px; font-weight:700;
  letter-spacing:.22em; text-transform:uppercase;
  cursor:pointer;
  transition:all .2s ease;
  border:none;
}
.rc-btn:hover { filter:brightness(1.1); transform:translateY(-1px); }
.rc-btn-primary { background:${PC.color}; color:#000; }
.rc-btn-ghost   { background:rgba(255,255,255,.04); color:rgba(255,255,255,.6); border:1px solid rgba(255,255,255,.1); }
.rc-btn-ghost:hover { background:rgba(255,255,255,.08); color:rgba(255,255,255,.85); border-color:rgba(255,255,255,.2); }

.rc-stop-row {
  display:flex; align-items:flex-start; gap:18px;
  padding:17px 0;
  border-bottom:1px solid rgba(255,255,255,.055);
  transition: opacity .15s;
}
.rc-stop-row:last-child { border-bottom:none; }
.rc-stop-row:hover { opacity:.85 }

.rc-food-card {
  display:flex; align-items:center; gap:14px;
  padding:15px 18px;
  background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.07);
  border-radius:4px;
  transition: background .2s;
}
.rc-food-card:hover { background:rgba(255,255,255,.055); }

.rc-act-item {
  display:flex; align-items:center; gap:12px;
  padding:13px 16px;
  background:rgba(255,255,255,.025);
  border:1px solid rgba(255,255,255,.06);
  border-radius:3px;
  transition: background .2s;
}
.rc-act-item:hover { background:rgba(255,255,255,.05); }

.rc-stat-cell {
  padding:22px 18px;
  background:rgba(255,255,255,.025);
  border-radius:4px;
  position:relative; overflow:hidden;
}

/* dots navigation */
.rc-dot {
  height:5px; border-radius:3px;
  transition: all .35s cubic-bezier(.22,1,.36,1);
  cursor:pointer;
}
`

// ─────────────────────────────────────────────────────────────────────────────
// SHARED LAYOUT CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  position: 'absolute', inset: 0,
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  padding: '72px 48px 80px',
  overflow: 'hidden',
}

const CARD_LEFT: React.CSSProperties = { ...CARD, alignItems: 'flex-start' }

const LABEL: React.CSSProperties = {
  fontFamily: 'Syne, sans-serif',
  fontSize: '10px', fontWeight: 700,
  letterSpacing: '0.35em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.38)',
}

const TAP: React.CSSProperties = {
  position: 'absolute',
  bottom: '28px', left: '50%', transform: 'translateX(-50%)',
  fontFamily: 'Syne, sans-serif',
  fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.2)',
  whiteSpace: 'nowrap',
}

// ─────────────────────────────────────────────────────────────────────────────
// CARDS
// ─────────────────────────────────────────────────────────────────────────────

/** 0 – HERO */
function C0_Hero() {
  return (
    <div className="rc-in" style={{
      ...CARD,
      background: 'radial-gradient(ellipse 80% 65% at 50% 58%, #18083d 0%, #06020f 55%, #000 80%)',
    }}>
      {/* Concentric rings decoration */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:.05, pointerEvents:'none' }} viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice">
        <circle cx="400" cy="420" r="320" fill="none" stroke="white" strokeWidth="1"/>
        <circle cx="400" cy="420" r="240" fill="none" stroke="white" strokeWidth=".6"/>
        <circle cx="400" cy="420" r="160" fill="none" stroke="white" strokeWidth=".4"/>
        <circle cx="400" cy="420" r="80"  fill="none" stroke="white" strokeWidth=".3"/>
        <line x1="0"   y1="420" x2="800" y2="420" stroke="white" strokeWidth=".3"/>
        <line x1="400" y1="0"   x2="400" y2="800" stroke="white" strokeWidth=".3"/>
      </svg>

      <div className="rc-s1" style={{ ...LABEL, marginBottom: '52px' }}>
        A &nbsp;·&nbsp; Y &nbsp;·&nbsp; A &nbsp;·&nbsp; N &nbsp;·&nbsp; A
      </div>

      <div className="rc-s2 rc-shimtext" style={{
        fontFamily: '"Bodoni Moda", Georgia, serif',
        fontSize: 'clamp(88px, 20vw, 200px)',
        fontWeight: 900, lineHeight: .85,
        letterSpacing: '-0.02em',
        textAlign: 'center',
        // shimtext handles the color
      }}>
        TOKYO
      </div>

      <div className="rc-s3" style={{
        marginTop: '28px',
        width: '180px', height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.3), transparent)',
      }}/>

      <div className="rc-s4" style={{
        marginTop: '18px',
        fontFamily: 'Syne, sans-serif',
        fontSize: '11px', fontWeight: 600,
        letterSpacing: '0.5em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,.45)',
      }}>
        Japan &nbsp;·&nbsp; {YEAR}
      </div>

      <div className="rc-s5" style={{
        marginTop: '10px',
        fontFamily: '"Bodoni Moda", serif', fontStyle: 'italic',
        fontSize: '16px',
        color: 'rgba(255,255,255,.2)',
        letterSpacing: '.05em',
      }}>
        Your Journey Recap
      </div>

      {/* chapter count */}
      <div className="rc-s6" style={{
        marginTop: '36px',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <div style={{ width: '24px', height: '1px', background: 'rgba(255,255,255,.2)' }}/>
        <span style={{
          fontFamily: 'Syne', fontSize: '9px', letterSpacing: '0.28em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,.2)',
        }}>
          {TOTAL_CARDS} chapters
        </span>
        <div style={{ width: '24px', height: '1px', background: 'rgba(255,255,255,.2)' }}/>
      </div>

      <div className="rc-hint rc-float" style={{ ...TAP, bottom: '32px' }}>
        Tap anywhere to begin
      </div>
    </div>
  )
}

/** 1 – PERSONA */
function C1_Persona() {
  return (
    <div className="rc-in" style={{
      ...CARD_LEFT,
      background: `radial-gradient(ellipse 100% 90% at -5% 100%, ${PC.bgDeep} 0%, rgba(0,0,0,0) 58%), #000`,
    }}>
      {/* large glow blob */}
      <div className="rc-glow" style={{
        position:'absolute', bottom:'-25%', left:'-15%',
        width:'65vw', height:'65vw',
        background:`radial-gradient(circle, ${PC.glow} 0%, transparent 65%)`,
        pointerEvents:'none',
      }}/>

      <div className="rc-s1" style={{ ...LABEL, marginBottom: '14px' }}>
        This trip, you were
      </div>

      <div className="rc-s2" style={{
        fontFamily: '"Bodoni Moda", serif',
        fontSize: 'clamp(62px, 13vw, 136px)',
        fontWeight: 900, lineHeight: .88,
        color: PC.color,
        textShadow: `0 0 80px ${PC.glow}, 0 0 200px ${PC.glow}`,
        letterSpacing: '-0.01em',
      }}>
        {PC.label.split('').map((ch, i) => (
          <span key={i} style={{ display:'inline-block', animationDelay:`${.14 + i*.04}s` }}>{ch}</span>
        ))}
      </div>

      <div className="rc-s3" style={{ marginTop: '20px' }}>
        <div style={{
          fontFamily: '"Bodoni Moda", serif', fontStyle: 'italic',
          fontSize: 'clamp(16px, 3vw, 22px)',
          color: 'rgba(255,255,255,.5)',
          letterSpacing: '.02em',
        }}>
          {PC.tagline}
        </div>
      </div>

      <div className="rc-s4" style={{ marginTop: '30px' }}>
        <div style={{
          display:'inline-flex', alignItems:'center', gap:'9px',
          padding:'6px 14px',
          border:`1px solid ${PC.color}44`,
          borderRadius:'2px',
        }}>
          <div style={{ width:'5px', height:'5px', background:PC.color, transform:'rotate(45deg)', borderRadius:'1px' }}/>
          <span style={{
            fontFamily:'Syne', fontSize:'10px', letterSpacing:'.3em',
            textTransform:'uppercase', color:PC.color,
          }}>
            {SELECTED_PERSONA} persona active
          </span>
        </div>
      </div>

      <div className="rc-hint" style={TAP}>Tap to continue</div>
    </div>
  )
}

/** 2 – COUNT: 5 STOPS */
function C2_Count() {
  return (
    <div className="rc-in" style={{
      ...CARD,
      background: 'linear-gradient(160deg, #000c20 0%, #001529 45%, #000812 100%)',
    }}>
      {/* subtle dot grid */}
      <div style={{
        position:'absolute', inset:0, opacity:.04,
        backgroundImage:'radial-gradient(circle, rgba(255,255,255,.8) 1px, transparent 1px)',
        backgroundSize:'44px 44px',
        pointerEvents:'none',
      }}/>

      <div className="rc-s1" style={{ ...LABEL, marginBottom: '16px' }}>
        Your Exploration
      </div>

      <div className="rc-s2" style={{ display:'flex', alignItems:'baseline', gap:'0' }}>
        <span style={{
          fontFamily:'"Bodoni Moda", serif',
          fontSize:'clamp(130px, 30vw, 300px)',
          fontWeight:900, lineHeight:1,
          color:'#fff',
          textShadow:'0 0 120px rgba(99,179,237,.25)',
        }}>
          5
        </span>
      </div>

      <div className="rc-s3" style={{
        fontFamily:'Syne, sans-serif',
        fontSize:'clamp(16px, 3.5vw, 32px)',
        fontWeight:700, letterSpacing:'.28em',
        textTransform:'uppercase',
        color:'rgba(255,255,255,.65)',
        marginTop:'-12px',
      }}>
        Legendary Stops
      </div>

      <div className="rc-s4" style={{
        marginTop:'20px',
        fontFamily:'"Bodoni Moda", serif', fontStyle:'italic',
        fontSize:'14px', color:'rgba(255,255,255,.3)',
        textAlign:'center', letterSpacing:'.03em',
      }}>
        From ancient temples to sacred mountains
      </div>

      {/* 5 glow dots */}
      <div className="rc-s5" style={{ display:'flex', gap:'12px', marginTop:'36px' }}>
        {STOPS.map((_, i) => (
          <div key={i} style={{
            width:'9px', height:'9px', borderRadius:'50%',
            background:`rgba(99,179,237,${.25 + i*.14})`,
            boxShadow:`0 0 10px rgba(99,179,237,.4)`,
          }}/>
        ))}
      </div>

      <div className="rc-hint" style={TAP}>Tap to continue</div>
    </div>
  )
}

/** 3 – STOPS LIST */
function C3_StopsList() {
  return (
    <div className="rc-in" style={{
      ...CARD_LEFT,
      background:'linear-gradient(180deg, #090909 0%, #0d0d0d 100%)',
    }}>
      <div className="rc-s1" style={{ ...LABEL, marginBottom: '28px' }}>
        Every Place You Touched
      </div>

      <div style={{ width:'100%' }}>
        {STOPS.map((stop, i) => (
          <div key={stop.id} className={`rc-stop-row rc-sl${i+1}`}>
            <span style={{
              fontFamily:'"SF Mono","Fira Code",monospace',
              fontSize:'10px', letterSpacing:'.1em',
              color:'rgba(255,255,255,.18)',
              paddingTop:'4px', flexShrink:0,
            }}>
              {stop.id}
            </span>
            <div style={{ flex:1 }}>
              <div style={{
                fontFamily:'"Bodoni Moda",serif',
                fontSize:'clamp(17px, 3.5vw, 26px)',
                fontWeight:700, color:'#fff', lineHeight:1.1,
              }}>
                {stop.name}
              </div>
              <div style={{
                marginTop:'4px',
                fontFamily:'Syne,sans-serif',
                fontSize:'10px', letterSpacing:'.2em',
                color:'rgba(255,255,255,.3)',
                textTransform:'uppercase',
              }}>
                {stop.area}&nbsp;·&nbsp;{stop.type}
              </div>
            </div>
            <div style={{
              width:'6px', height:'6px',
              background:PC.color,
              transform:'rotate(45deg)',
              borderRadius:'1px',
              marginTop:'7px', flexShrink:0,
              opacity:.5,
            }}/>
          </div>
        ))}
      </div>

      <div className="rc-hint" style={TAP}>Tap to continue</div>
    </div>
  )
}

/** 4 – SPOTLIGHT: SENSO-JI */
function C4_Spotlight() {
  const stop = STOPS[0]
  return (
    <div className="rc-in" style={{
      ...CARD_LEFT,
      background:'radial-gradient(ellipse 75% 80% at 70% 25%, #2c1500 0%, #180c00 40%, #000 72%)',
    }}>
      {/* top-right amber glow */}
      <div className="rc-glow" style={{
        position:'absolute', top:'-20%', right:'-10%',
        width:'52vw', height:'52vw',
        background:'radial-gradient(circle, rgba(212,105,42,.28) 0%, transparent 65%)',
        pointerEvents:'none',
      }}/>

      {/* giant roman numeral watermark */}
      <div style={{
        position:'absolute', bottom:'-30px', right:'-15px',
        fontFamily:'"Bodoni Moda",serif',
        fontSize:'clamp(180px,35vw,340px)',
        fontWeight:900, lineHeight:1,
        color:'rgba(212,105,42,.04)',
        userSelect:'none', pointerEvents:'none',
      }}>
        Ⅰ
      </div>

      <div className="rc-s1" style={{ ...LABEL, marginBottom: '14px' }}>
        Your Most Iconic Stop
      </div>

      <div className="rc-s2">
        <div style={{
          display:'inline-flex', alignItems:'center', gap:'8px',
          padding:'5px 12px',
          background:'rgba(212,105,42,.12)',
          border:'1px solid rgba(212,105,42,.28)',
          borderRadius:'2px',
          marginBottom:'18px',
        }}>
          <div style={{ width:'4px', height:'4px', background:'#D4692A', transform:'rotate(45deg)' }}/>
          <span style={{
            fontFamily:'Syne', fontSize:'9px', letterSpacing:'.32em',
            textTransform:'uppercase', color:'#D4692A',
          }}>
            {stop.type}
          </span>
        </div>
      </div>

      <div className="rc-s3">
        <div style={{
          fontFamily:'"Bodoni Moda",serif',
          fontSize:'clamp(38px, 9vw, 96px)',
          fontWeight:900, lineHeight:.88,
          color:'#fff',
        }}>
          {stop.name.split(' ').map((w, i) => <div key={i}>{w}</div>)}
        </div>
      </div>

      <div className="rc-s4" style={{ marginTop:'18px' }}>
        <div style={{
          fontFamily:'Syne', fontSize:'10px',
          letterSpacing:'.28em', textTransform:'uppercase',
          color:'rgba(212,105,42,.7)',
        }}>
          {stop.area}
        </div>
      </div>

      <div className="rc-s5" style={{ marginTop:'20px', maxWidth:'360px' }}>
        <div style={{
          width:'40px', height:'1px',
          background:'rgba(212,105,42,.35)',
          marginBottom:'14px',
        }}/>
        <p style={{
          fontFamily:'"Bodoni Moda",serif', fontStyle:'italic',
          fontSize:'15px', lineHeight:1.7,
          color:'rgba(255,255,255,.38)',
        }}>
          &ldquo;{stop.desc}&rdquo;
        </p>
      </div>

      <div className="rc-hint" style={TAP}>Tap to continue</div>
    </div>
  )
}

/** 5 – FOOD */
function C5_Food() {
  return (
    <div className="rc-in" style={{
      ...CARD_LEFT,
      background:'radial-gradient(ellipse 85% 75% at 0% 100%, #280008 0%, #180005 48%, #000 75%)',
    }}>
      <div className="rc-glow" style={{
        position:'absolute', bottom:'-20%', left:'-10%',
        width:'55vw', height:'55vw',
        background:'radial-gradient(circle, rgba(196,92,114,.22) 0%, transparent 65%)',
        pointerEvents:'none',
      }}/>

      <div className="rc-s1" style={{ ...LABEL, marginBottom: '10px' }}>
        Food &amp; Drink
      </div>

      <div className="rc-s2">
        <div style={{
          fontFamily:'"Bodoni Moda",serif',
          fontSize:'clamp(32px, 7.5vw, 78px)',
          fontWeight:900, lineHeight:.9, color:'#fff',
        }}>
          Tokyo Fed<br/>Your Soul
        </div>
      </div>

      <div className="rc-s3" style={{ marginTop:'10px' }}>
        <p style={{
          fontFamily:'"Bodoni Moda",serif', fontStyle:'italic',
          fontSize:'14px', color:'rgba(255,255,255,.35)',
        }}>
          3 culinary moments worth returning for
        </p>
      </div>

      <div style={{ marginTop:'32px', width:'100%', display:'flex', flexDirection:'column', gap:'12px' }}>
        {FOOD.map((f, i) => (
          <div key={f.name} className={`rc-food-card rc-sl${i+1}`}>
            <span style={{
              fontFamily:'"SF Mono",monospace', fontSize:'10px',
              color:'#C45C72', opacity:.7, letterSpacing:'.08em', flexShrink:0,
            }}>
              {f.rank}
            </span>
            <div style={{ flex:1 }}>
              <div style={{
                fontFamily:'"Bodoni Moda",serif', fontSize:'clamp(16px,3vw,20px)',
                fontWeight:700, color:'#fff',
              }}>
                {f.name}
              </div>
              <div style={{
                fontFamily:'Syne', fontSize:'10px', letterSpacing:'.18em',
                textTransform:'uppercase', color:'rgba(255,255,255,.32)',
                marginTop:'3px',
              }}>
                {f.cuisine}&nbsp;·&nbsp;{f.price}
              </div>
            </div>
            <div style={{
              fontFamily:'Syne', fontSize:'13px', fontWeight:700,
              color:'#C45C72', flexShrink:0,
            }}>
              ★&thinsp;{f.rating}
            </div>
          </div>
        ))}
      </div>

      <div className="rc-hint" style={TAP}>Tap to continue</div>
    </div>
  )
}

/** 6 – ACTIVITIES */
function C6_Activities() {
  const top = ACTIVITIES[0]
  return (
    <div className="rc-in" style={{
      ...CARD_LEFT,
      background:'radial-gradient(ellipse 72% 65% at 85% 15%, #190030 0%, #0a0018 48%, #000 78%)',
    }}>
      <div className="rc-glow" style={{
        position:'absolute', top:'-15%', right:'-5%',
        width:'48vw', height:'48vw',
        background:'radial-gradient(circle, rgba(140,80,220,.28) 0%, transparent 65%)',
        pointerEvents:'none',
      }}/>

      <div className="rc-s1" style={{ ...LABEL, marginBottom: '14px' }}>
        Experiences Unlocked
      </div>

      <div className="rc-s2">
        <div style={{
          display:'inline-flex', alignItems:'center', gap:'8px',
          padding:'5px 12px',
          background:'rgba(140,80,220,.12)',
          border:'1px solid rgba(140,80,220,.28)',
          borderRadius:'2px',
          marginBottom:'16px',
        }}>
          <div style={{ width:'4px', height:'4px', background:'#8B50DC', transform:'rotate(45deg)' }}/>
          <span style={{
            fontFamily:'Syne', fontSize:'9px', letterSpacing:'.32em',
            textTransform:'uppercase', color:'#9B64E8',
          }}>
            {top.type}
          </span>
        </div>
      </div>

      <div className="rc-s3">
        <div style={{
          fontFamily:'"Bodoni Moda",serif',
          fontSize:'clamp(30px, 7vw, 68px)',
          fontWeight:900, lineHeight:.9, color:'#fff',
        }}>
          {top.name.split(' ').map((w, i) => <div key={i}>{w}</div>)}
        </div>
      </div>

      <div className="rc-s4" style={{ marginTop:'14px' }}>
        <div style={{
          fontFamily:'Syne', fontSize:'14px', fontWeight:700,
          color:'#9B64E8',
        }}>
          ★&thinsp;{top.rating}&ensp;·&ensp;Highest Rated Activity
        </div>
      </div>

      <div style={{ marginTop:'28px', width:'100%', display:'flex', flexDirection:'column', gap:'10px' }}>
        {ACTIVITIES.slice(1).map((a, i) => (
          <div key={a.name} className={`rc-act-item rc-sl${i+3}`}>
            <div style={{ width:'4px', height:'4px', background:'rgba(155,100,232,.55)', transform:'rotate(45deg)', flexShrink:0 }}/>
            <div style={{ flex:1, fontFamily:'"Bodoni Moda",serif', fontSize:'clamp(15px,3vw,18px)', fontWeight:700, color:'rgba(255,255,255,.75)' }}>
              {a.name}
            </div>
            <div style={{ fontFamily:'Syne', fontSize:'10px', letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(155,100,232,.6)', flexShrink:0 }}>
              {a.type}
            </div>
          </div>
        ))}
      </div>

      <div className="rc-hint" style={TAP}>Tap to continue</div>
    </div>
  )
}

/** 7 – STATS (count-up) */
function C7_Stats({ active }: { active: boolean }) {
  const v0 = useCountUp(STATS[0].value, active)
  const v1 = useCountUp(STATS[1].value, active)
  const v2 = useCountUp(STATS[2].value, active)
  const v3 = useCountUp(STATS[3].value, active)
  const vals = [v0, v1, v2, v3]

  return (
    <div className="rc-in" style={{
      ...CARD,
      background:'#070707',
    }}>
      <div className="rc-s1" style={{ ...LABEL, marginBottom:'32px' }}>
        By the Numbers
      </div>

      <div style={{
        width:'100%',
        display:'grid', gridTemplateColumns:'1fr 1fr',
        gap:'14px',
      }}>
        {STATS.map((s, i) => (
          <div key={s.label} className={`rc-stat-cell rc-s${i+2}`}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:`linear-gradient(90deg,${s.color},transparent)` }}/>
            <div style={{
              fontFamily:'"Bodoni Moda",serif',
              fontSize:'clamp(38px, 8vw, 70px)',
              fontWeight:900, lineHeight:1.05,
              color:s.color,
            }}>
              {vals[i]}{s.suffix}
            </div>
            <div style={{
              marginTop:'8px',
              fontFamily:'Syne', fontSize:'10px',
              letterSpacing:'.22em', textTransform:'uppercase',
              color:'rgba(255,255,255,.3)',
              whiteSpace:'pre-line',
            }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="rc-hint" style={TAP}>Tap to continue</div>
    </div>
  )
}

/** 8 – TRAVEL DNA */
function C8_DNA() {
  return (
    <div className="rc-in" style={{
      ...CARD_LEFT,
      background:'linear-gradient(172deg, #080014 0%, #120020 50%, #070010 100%)',
    }}>
      <div className="rc-s1" style={{ ...LABEL, marginBottom: '12px' }}>
        Your Travel DNA
      </div>

      <div className="rc-s2">
        <div style={{
          fontFamily:'"Bodoni Moda",serif',
          fontSize:'clamp(30px, 7vw, 64px)',
          fontWeight:900, lineHeight:.92, color:'#fff',
        }}>
          What Kind of<br/>Traveler<br/>Are You?
        </div>
      </div>

      <div className="rc-s3" style={{ marginTop:'10px' }}>
        <p style={{
          fontFamily:'"Bodoni Moda",serif', fontStyle:'italic',
          fontSize:'14px', color:'rgba(255,255,255,.3)',
        }}>
          Based on every place you explored
        </p>
      </div>

      <div style={{ marginTop:'36px', width:'100%', display:'flex', flexDirection:'column', gap:'22px' }}>
        {DNA.map((d, i) => (
          <div key={d.trait} className={`rc-sl${i+1}`}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
              <span style={{
                fontFamily:'Syne', fontSize:'11px', fontWeight:700,
                letterSpacing:'.15em', textTransform:'uppercase',
                color:'rgba(255,255,255,.65)',
              }}>
                {d.trait}
              </span>
              <span style={{
                fontFamily:'"Bodoni Moda",serif', fontSize:'14px', fontWeight:700,
                color:d.color,
              }}>
                {d.pct}%
              </span>
            </div>
            <div style={{
              width:'100%', height:'2px',
              background:'rgba(255,255,255,.07)',
              borderRadius:'2px', overflow:'hidden',
            }}>
              <div
                className={`rc-bar rc-b${i+1}`}
                style={{
                  height:'100%', width:`${d.pct}%`,
                  background:`linear-gradient(90deg, ${d.color}, ${d.color}66)`,
                  borderRadius:'2px',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="rc-hint" style={TAP}>Tap to continue</div>
    </div>
  )
}

/** 9 – WHAT'S NEXT */
function C9_Next() {
  return (
    <div className="rc-in" style={{
      ...CARD,
      background:`radial-gradient(ellipse 65% 55% at 50% 45%, ${PC.glowDim} 0%, #000 60%)`,
    }}>
      <div className="rc-s1" style={{ ...LABEL, marginBottom:'18px' }}>
        Ready to make it real?
      </div>

      <div className="rc-s2">
        <div style={{
          fontFamily:'"Bodoni Moda",serif',
          fontSize:'clamp(38px, 9vw, 88px)',
          fontWeight:900, lineHeight:.88,
          color:'#fff', textAlign:'center',
        }}>
          Time to Book<br/>
          <span style={{ color:PC.color }}>Tokyo</span>
        </div>
      </div>

      <div className="rc-s3" style={{ marginTop:'12px', textAlign:'center' }}>
        <p style={{
          fontFamily:'"Bodoni Moda",serif', fontStyle:'italic',
          fontSize:'14px', color:'rgba(255,255,255,.3)', letterSpacing:'.02em',
        }}>
          Your curated journey, ready to become reality
        </p>
      </div>

      {/* CTA Buttons */}
      <div className="rc-s4" style={{
        marginTop:'40px', width:'100%', display:'flex', flexDirection:'column',
        gap:'10px', maxWidth:'360px',
      }}>
        <button
          className="rc-btn rc-btn-primary"
          onClick={e => e.stopPropagation()}
          style={{ background:PC.color, color:'#000' }}
        >
          <span>Export as PDF</span>
          <span style={{ opacity:.7, fontSize:'14px' }}>↓</span>
        </button>

        <button
          className="rc-btn rc-btn-ghost"
          onClick={e => e.stopPropagation()}
        >
          <span>Browse Hotels in Tokyo</span>
          <span style={{ opacity:.5 }}>⌂</span>
        </button>

        <button
          className="rc-btn rc-btn-ghost"
          onClick={e => e.stopPropagation()}
        >
          <span>Find Flights to Tokyo</span>
          <span style={{ opacity:.5 }}>→</span>
        </button>

        <button
          className="rc-btn rc-btn-ghost"
          onClick={e => e.stopPropagation()}
        >
          <span>Share Your Journey</span>
          <span style={{ opacity:.5 }}>⤴</span>
        </button>
      </div>

      <div className="rc-s5" style={{ marginTop:'28px' }}>
        <Link
          href="/"
          onClick={e => e.stopPropagation()}
          style={{
            fontFamily:'Syne', fontSize:'9px',
            letterSpacing:'.3em', textTransform:'uppercase',
            color:'rgba(255,255,255,.18)', textDecoration:'none',
          }}
        >
          ← Back to Ayana
        </Link>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

export default function RecapPage() {
  const [card, setCard] = useState(0)
  const [fading, setFading] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const busy = useRef(false)

  const goTo = useCallback((target: number) => {
    if (busy.current || target < 0 || target >= TOTAL_CARDS) return
    busy.current = true
    setFading(true)
    setTimeout(() => {
      setCard(target)
      setFading(false)
      busy.current = false
    }, 160)
  }, [])

  const advance = useCallback(() => goTo(card + 1), [card, goTo])
  const back    = useCallback(() => goTo(card - 1), [card, goTo])

  // Hide Google Maps alpha banner
  useEffect(() => {
    const hide = () => {
      document.querySelectorAll('div').forEach(el => {
        if (el.textContent?.includes('alpha channel') && el.children.length < 5) {
          el.style.display = 'none'
        }
      })
    }
    const observer = new MutationObserver(hide)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ')  { e.preventDefault(); initAudioCtx(); setAudioEnabled(true); advance() }
      if (e.key === 'ArrowLeft')                    { e.preventDefault(); initAudioCtx(); setAudioEnabled(true); back() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [advance, back])

  // Touch swipe
  const touchX = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (touchX.current === null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    initAudioCtx(); setAudioEnabled(true)
    if (dx < -48) advance()
    if (dx >  48) back()
    touchX.current = null
  }

  const isLast = card === TOTAL_CARDS - 1

  // 5-second auto-advance (Spotify Wrapped style)
  const timerProgress = useAutoAdvance(card, isLast, advance)

  // Ambient audio per card
  useCardAudio(card, audioEnabled)

  // Enable audio + advance on interaction
  // IMPORTANT: initAudioCtx() must run synchronously inside the click/touch handler
  // so the browser counts it as a user gesture — this is required for Web Audio API
  const handleInteract = useCallback(() => {
    if (!audioEnabled) {
      initAudioCtx()   // create/resume AudioContext within user gesture ← critical
      setAudioEnabled(true)
    }
    if (!isLast) advance()
  }, [audioEnabled, isLast, advance])

  const CARDS = [
    <C0_Hero         key="c0" />,
    <C1_Persona      key="c1" />,
    <C2_Count        key="c2" />,
    <C3_StopsList    key="c3" />,
    <C4_Spotlight    key="c4" />,
    <C5_Food         key="c5" />,
    <C6_Activities   key="c6" />,
    <C7_Stats        key="c7" active={card === 7} />,
    <C8_DNA          key="c8" />,
    <C9_Next         key="c9" />,
  ]

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div
        style={{
          position:'fixed', inset:0,
          background:'#000',
          overflow:'hidden',
          cursor: isLast ? 'default' : 'pointer',
          userSelect:'none',
          fontFamily:'Syne, Inter, sans-serif',
        }}
        onClick={handleInteract}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* ── Stories-style segmented progress (Spotify Wrapped) ───── */}
        <div style={{
          position:'absolute', top:0, left:0, right:0,
          height:'2px',
          display:'flex', gap:'3px', padding:'0 0',
          zIndex:200,
        }}>
          {Array.from({ length: TOTAL_CARDS }).map((_, i) => (
            <div key={i} style={{
              flex:1, height:'100%',
              background:'rgba(255,255,255,.1)',
              overflow:'hidden',
            }}>
              <div style={{
                height:'100%',
                width: i < card  ? '100%'
                     : i === card ? (isLast ? '100%' : `${timerProgress * 100}%`)
                     : '0%',
                background: i <= card ? PC.color : 'transparent',
                boxShadow: i === card && !isLast ? `0 0 5px ${PC.glow}` : 'none',
              }}/>
            </div>
          ))}
        </div>

        {/* ── AYANA wordmark ────────────────────────────────────────── */}
        <div style={{
          position:'absolute', top:'18px', left:'20px', zIndex:200,
        }}>
          <Link href="/" onClick={e => e.stopPropagation()} style={{
            fontFamily:'Syne', fontSize:'9px',
            letterSpacing:'.35em', textTransform:'uppercase',
            color:'rgba(255,255,255,.22)', textDecoration:'none',
          }}>
            AYANA
          </Link>
        </div>

        {/* ── Card counter + audio indicator ────────────────────────── */}
        <div style={{
          position:'absolute', top:'14px', right:'16px', zIndex:200,
          display:'flex', alignItems:'center', gap:'10px',
        }}>
          {/* Audio on/off badge */}
          <div
            onClick={e => { e.stopPropagation(); setAudioEnabled(v => !v) }}
            title={audioEnabled ? 'Mute ambient sound' : 'Enable ambient sound'}
            style={{
              display:'flex', alignItems:'center', gap:'4px',
              padding:'3px 8px',
              border:`1px solid ${audioEnabled ? PC.color + '44' : 'rgba(255,255,255,.1)'}`,
              borderRadius:'20px',
              cursor:'pointer',
              transition:'all .25s ease',
              background: audioEnabled ? PC.color + '12' : 'transparent',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              {audioEnabled ? (
                <>
                  <path d="M1 3.5h2l3-2.5v9l-3-2.5H1z" fill={PC.color} opacity="0.9"/>
                  <path d="M7.5 2.5c1 .8 1.5 1.9 1.5 3s-.5 2.2-1.5 3" stroke={PC.color} strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.7"/>
                </>
              ) : (
                <>
                  <path d="M1 3.5h2l3-2.5v9l-3-2.5H1z" fill="rgba(255,255,255,0.25)"/>
                  <line x1="7" y1="3" x2="9" y2="7" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeLinecap="round"/>
                  <line x1="9" y1="3" x2="7" y2="7" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeLinecap="round"/>
                </>
              )}
            </svg>
            <span style={{
              fontFamily:'Syne', fontSize:'8px', letterSpacing:'.2em',
              textTransform:'uppercase',
              color: audioEnabled ? PC.color : 'rgba(255,255,255,.25)',
            }}>
              {audioEnabled ? 'on' : 'off'}
            </span>
          </div>

          {/* Card counter */}
          <div style={{
            fontFamily:'"SF Mono","Fira Code",monospace',
            fontSize:'10px', letterSpacing:'.1em',
            color:'rgba(255,255,255,.22)',
          }}>
            {String(card + 1).padStart(2, '0')}&thinsp;/&thinsp;{String(TOTAL_CARDS).padStart(2, '0')}
          </div>
        </div>

        {/* ── Card ─────────────────────────────────────────────────── */}
        <div
          key={card}
          style={{
            position:'absolute', inset:0,
            opacity: fading ? 0 : 1,
            transform: fading ? 'scale(0.98)' : 'scale(1)',
            transition: fading ? 'opacity .16s ease, transform .16s ease' : 'none',
          }}
        >
          {CARDS[card]}
        </div>

        {/* ── Navigation dots ───────────────────────────────────────── */}
        <div style={{
          position:'absolute', bottom:'14px', left:'50%',
          transform:'translateX(-50%)',
          display:'flex', gap:'6px', alignItems:'center',
          zIndex:200,
        }}>
          {Array.from({ length: TOTAL_CARDS }).map((_, i) => (
            <div
              key={i}
              className="rc-dot"
              onClick={e => { e.stopPropagation(); initAudioCtx(); setAudioEnabled(true); goTo(i) }}
              style={{
                width: i === card ? '20px' : '5px',
                background: i === card ? PC.color : 'rgba(255,255,255,.2)',
                boxShadow: i === card ? `0 0 7px ${PC.glow}` : 'none',
              }}
            />
          ))}
        </div>

        {/* ── Countdown hint ─────────────────────────────────────────── */}
        {!isLast && (
          <div style={{
            position:'absolute', bottom:'36px', left:'50%',
            transform:'translateX(-50%)',
            fontFamily:'Syne', fontSize:'8px',
            letterSpacing:'.22em', textTransform:'uppercase',
            color:'rgba(255,255,255,.12)',
            whiteSpace:'nowrap',
            zIndex:200,
          }}>
            {Math.ceil((1 - timerProgress) * 5)}s · tap to skip
          </div>
        )}

        {/* ── Keyboard hint (first card only) ───────────────────────── */}
        {card === 0 && (
          <div style={{
            position:'absolute', bottom:'50px', right:'20px',
            fontFamily:'Syne', fontSize:'9px',
            letterSpacing:'.22em', textTransform:'uppercase',
            color:'rgba(255,255,255,.12)',
            zIndex:200,
          }}>
            ← → arrow keys
          </div>
        )}
      </div>
    </>
  )
}
