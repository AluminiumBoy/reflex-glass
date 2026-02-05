/*
 * ██████╗ ███████╗ ██████╗ ██╗    ██╗██╗     ███████╗ █████╗
 * ██╔══██╗██╔════╝██╔═══██╗██║    ██║██║     ██╔════╝██╔══██╗
 * ██████╔╝█████╗  ██║   ██║██║    ██║██║     █████╗  ███████║
 * ██╔══██╗██╔══╝  ██║   ██║╚██╗  ██╔╝██║     ██╔══╝  ██╔══██║
 * ██║  ██║███████╗╚██████╔╝ ╚████╔╝ ███████╗███████╗██║  ██║
 * ╚═╝  ╚═╝╚══════╝ ╚═════╝   ╚═══╝  ╚══════╝╚══════╝╚═╝  ╚═╝
 *
 *   ██████╗ ██╗     █████╗ ███████╗███████╗
 *   ██╔═══██╗██║    ██╔══██╗██╔════╝██╔════╝
 *   ██║   ██║██║    ███████║███████╗███████╗
 *   ██║   ██║██║    ██╔══██║╚════██║╚════██║
 *   ╚██████╔╝███████╗██║  ██║███████║███████║
 *    ╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝
 *
 *  REFLEX GLASS — Ultra-Addictive Chart Pattern Reflex Trainer
 *  Base Mini App + Farcaster Frame · 2026 Liquid Glass Design
 *
 *  Single-file React 19 app. No external UI deps besides React.
 *  Canvas chart · Web Audio · requestAnimationFrame at 60fps.
 *  Drop into a Vite + React project, wire up OnchainKit/MiniKit
 *  at the provider level outside this component (see README).
 * ═══════════════════════════════════════════════════════════════
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════
    1  CONSTANTS & COLOR TOKENS
   ═══════════════════════════════════════════════════════════════ */

const ROUNDS       = 7;
const DECISION_MS  = 4000;
const BASE_SCORE   = 1000;
// streak multiplier table, index = consecutive correct (0-based)
const STREAK_MULT  = [1, 1.3, 1.6, 2.0, 2.5, 3.0, 3.5, 4.0];

const C = {                         // colour palette
  nGreen  : "#00ffaa",
  nPink   : "#ff4d94",
  nPurple : "#a855f7",
  nBlue   : "#38bdf8",
  nAmber  : "#fbbf24",
  bull    : "#00e676",
  bear    : "#ff1744",
  neut    : "#fbbf24",
  bg1     : "#06060c",
  bg2     : "#0f0f1a",
  glass   : "rgba(14,14,26,0.52)",
  glassBr : "rgba(255,255,255,0.07)",
  glassHi : "rgba(255,255,255,0.13)",
};

/* ═══════════════════════════════════════════════════════════════
    2  HAPTIC HELPER
   ═══════════════════════════════════════════════════════════════ */
function haptic(pattern = [30]) {
  try { navigator?.vibrate?.(pattern); } catch(_) {}
}

/* ═══════════════════════════════════════════════════════════════
    3  SOUND ENGINE  (Web Audio API — lazy-inited on first user tap)
   ═══════════════════════════════════════════════════════════════ */
  
   /* ═══════════════════════════════════════════════════════════════
   PREMIUM SOUND ENGINE - Professional Audio Design
   Web Audio API with advanced synthesis, filters, and reverb
   ═══════════════════════════════════════════════════════════════ */
class SoundEngine {
  constructor() { 
    this.ctx = null; 
    this.on = true;
    this.masterGain = null;
    this.compressor = null;
  }

  // ── init / resume audio context with master chain ──
  _ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Master gain for volume control
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.7;
      
      // Compressor for professional sound (prevents clipping)
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -20;
      this.compressor.knee.value = 10;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;
      
      // Chain: masterGain → compressor → destination
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  // ── call this on user gesture to unlock audio
  unlock() {
    if (!this.on) return;
    const ctx = this._ensure();
    if (ctx.state === "suspended") ctx.resume();
  }

  // ── Advanced tone with filter and envelope ──
  _advancedTone(freq, dur, type = "sine", vol = 0.15, startDelay = 0, filterFreq = null, detune = 0) {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime + startDelay;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    // Optional filter for richer sound
    if (filterFreq) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      filter.Q.value = 1;
      osc.connect(filter);
      filter.connect(gainNode);
    } else {
      osc.connect(gainNode);
    }
    
    gainNode.connect(this.masterGain);
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.detune.value = detune;
    
    // ADSR envelope
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(vol, now + 0.01); // Attack
    gainNode.gain.exponentialRampToValueAtTime(vol * 0.7, now + dur * 0.3); // Decay
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur); // Release
    
    osc.start(now);
    osc.stop(now + dur);
  }

  // ── Premium UI click (glass tap sound) ──
  click() {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime;
    
    // High frequency tap
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    
    osc1.frequency.setValueAtTime(2800, now);
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.02);
    osc1.type = 'sine';
    
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    
    osc1.start(now);
    osc1.stop(now + 0.06);
    
    // Low body thump
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    
    osc2.frequency.setValueAtTime(180, now);
    osc2.type = 'sine';
    
    gain2.gain.setValueAtTime(0.08, now);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    
    osc2.start(now);
    osc2.stop(now + 0.1);
  }

  // ── Countdown tick (3, 2, 1) ──
  tick(n) {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime;
    
    const freq = n === 1 ? 1400 : 880;
    const vol = n === 1 ? 0.25 : 0.18;
    
    // Bright metallic hit
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.5, now);
    filter.Q.value = 8;
    
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    
    osc.start(now);
    osc.stop(now + 0.16);
    
    // Harmonic overtone for richness
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);
    gain2.gain.setValueAtTime(vol * 0.3, now);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    
    osc2.start(now);
    osc2.stop(now + 0.11);
  }

  // ── Correct answer (uplifting chord progression) ──
  correct() {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime;
    
    // Major chord: C-E-G with rich harmonics
    const chord = [
      { freq: 523.25, delay: 0,    vol: 0.15 },  // C5
      { freq: 659.25, delay: 0.04, vol: 0.13 },  // E5
      { freq: 783.99, delay: 0.08, vol: 0.12 },  // G5
      { freq: 1046.5, delay: 0.12, vol: 0.10 }   // C6 (octave)
    ];
    
    chord.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      
      const t = now + note.delay;
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, t);
      
      // Warm lowpass filter
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(note.freq * 3, t);
      filter.Q.value = 1;
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(note.vol, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      
      osc.start(t);
      osc.stop(t + 0.42);
    });
  }

  // ── Wrong answer (dissonant descending) ──
  wrong() {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime;
    
    // Dissonant descending notes
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const filter1 = ctx.createBiquadFilter();
    
    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(this.masterGain);
    
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(330, now);
    osc1.frequency.exponentialRampToValueAtTime(220, now + 0.2);
    
    filter1.type = 'lowpass';
    filter1.frequency.setValueAtTime(800, now);
    filter1.Q.value = 2;
    
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    
    osc1.start(now);
    osc1.stop(now + 0.32);
    
    // Dissonant harmony
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(315, now + 0.05); // Slightly detuned
    osc2.frequency.exponentialRampToValueAtTime(210, now + 0.25);
    
    gain2.gain.setValueAtTime(0.14, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    
    osc2.start(now + 0.05);
    osc2.stop(now + 0.37);
  }

  // ── God mode burst (epic ascending arpeggio) ──
  godBurst() {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime;
    
    // Epic ascending arpeggio with harmonics
    const notes = [
      { freq: 523.25, delay: 0     },  // C5
      { freq: 659.25, delay: 0.05  },  // E5
      { freq: 783.99, delay: 0.10  },  // G5
      { freq: 987.77, delay: 0.15  },  // B5
      { freq: 1046.5, delay: 0.20  },  // C6
      { freq: 1318.5, delay: 0.25  },  // E6
      { freq: 1568,   delay: 0.30  }   // G6
    ];
    
    notes.forEach((note, i) => {
      const vol = 0.15 - (i * 0.015);
      
      // Main note
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      
      const t = now + note.delay;
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, t);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(note.freq * 4, t);
      filter.frequency.exponentialRampToValueAtTime(note.freq * 2, t + 0.3);
      filter.Q.value = 1.5;
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      
      osc.start(t);
      osc.stop(t + 0.36);
      
      // Harmonic shimmer
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(note.freq * 2, t);
      gain2.gain.setValueAtTime(vol * 0.3, t);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      
      osc2.start(t);
      osc2.stop(t + 0.26);
    });
  }

  // ── Reveal candle (subtle pop) ──
  reveal() {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.03);
    
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(400, now);
    filter.Q.value = 0.5;
    
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // ── Candle animate pop (glass crystallization sound) ──
  candlePop() {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime;
    
    // High frequency crystallization
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const filter1 = ctx.createBiquadFilter();
    
    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(this.masterGain);
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1600, now);
    osc1.frequency.exponentialRampToValueAtTime(1100, now + 0.04);
    
    filter1.type = 'bandpass';
    filter1.frequency.setValueAtTime(1400, now);
    filter1.Q.value = 4;
    
    gain1.gain.setValueAtTime(0.06, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    
    osc1.start(now);
    osc1.stop(now + 0.09);
    
    // Low glass resonance
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(280, now);
    
    gain2.gain.setValueAtTime(0.04, now);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    
    osc2.start(now);
    osc2.stop(now + 0.13);
  }

  // ── Whoosh (screen transition) ──
  whoosh() { 
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.28);
    
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.28);
    filter.Q.value = 3;
    
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.linearRampToValueAtTime(0.20, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    
    osc.start(now);
    osc.stop(now + 0.37);
  }

  // ── Tip tap (UI interaction) ──
  tipTap() { 
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime;
    
    [2200, 2900].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      const t = now + i * 0.04;
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      
      osc.start(t);
      osc.stop(t + 0.13);
    });
  }

  // ── Ticker ping (subtle notification) ──
  tickerPing() {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    
    osc.start(now);
    osc.stop(now + 0.05);
  }
}

// ── singleton instance ──
const SND = new SoundEngine();


/* ═══════════════════════════════════════════════════════════════
    4  REALISTIC PATTERN LIBRARY - 3 PHASE STRUCTURE
      Each pattern returns:
        { 
          context: OHLC[25-35],      // Market context before pattern
          setup: OHLC[18-25],        // The actual pattern to recognize  
          continuation: OHLC[15-25], // What happens after decision
          signal: 'buy'|'sell'|'hold', 
          name: string, 
          cat: string,
          difficulty: 1-5,           // Pattern clarity
          trap: boolean              // Is this a fake/failed pattern?
        }
   ═══════════════════════════════════════════════════════════════ */

// ── MICRO-HELPERS ────────────────────────────────────────────
const R  = (a,b) => a + Math.random()*(b-a);          
const RI = (a,b) => Math.floor(R(a, b+1));            
const CL = (v,a,b) => Math.max(a, Math.min(b, v));   

function K(o, c, wU=0, wD=0) {
  return { o:+o.toFixed(2), c:+c.toFixed(2),
           h:+(Math.max(o,c)+Math.abs(wU)).toFixed(2),
           l:+(Math.min(o,c)-Math.abs(wD)).toFixed(2) };
}

// Trend: upward or downward movement
function TREND(start, bars, slope, vol=2) {
  const candles = []; 
  let p = start;
  for(let i=0; i<bars; i++) {
    const o = p;
    p += slope + R(-vol, vol);
    candles.push(K(o, p, R(0, vol*0.5), R(0, vol*0.5)));
  }
  return candles;
}

// Range: sideways consolidation
function RANGE(center, bars, width=4) {
  const candles = []; 
  let p = center;
  for(let i=0; i<bars; i++) {
    const o = p + R(-width*0.3, width*0.3);
    const c = o + R(-width*0.4, width*0.4);
    p = c;
    candles.push(K(o, c, R(0.2, width*0.3), R(0.2, width*0.3)));
  }
  return candles;
}

// Compression: tightening range
function COMPRESSION(start, bars, initialWidth, finalWidth) {
  const candles = [];
  let p = start;
  for(let i=0; i<bars; i++) {
    const pct = i / (bars - 1);
    const width = initialWidth + (finalWidth - initialWidth) * pct;
    const o = p + R(-width*0.3, width*0.3);
    const c = o + R(-width*0.4, width*0.4);
    p = c;
    candles.push(K(o, c, R(0.1, width*0.25), R(0.1, width*0.25)));
  }
  return candles;
}

// ═══════════════════════════════════════════════════════════════
// PATTERN FACTORIES - REALISTIC 3-PHASE STRUCTURE
// ═══════════════════════════════════════════════════════════════

// ── CLEAN BULLISH PATTERNS ──────────────────────────────────

function bullFlag_clean() {
  const context = [
    ...RANGE(100, 12, 3),
    ...TREND(100, 8, 3.5, 1.2)  // Strong uptrend
  ];
  const poleTop = context[context.length-1].c;
  
  const setup = TREND(poleTop, 20, -0.3, 0.8);  // Tight pullback
  const setupEnd = setup[setup.length-1].c;
  
  const continuation = TREND(setupEnd, 20, 3.2, 1.5);  // Breakout up
  
  return { 
    context, setup, continuation,
    signal: 'buy', 
    name: 'Bull Flag',
    cat: 'Continuation',
    difficulty: 1,
    trap: false
  };
}

function ascTriangle_clean() {
  const resistance = 110;
  const context = [
    ...TREND(95, 15, 0.8, 1.5),  // Mild uptrend
    ...RANGE(105, 12, 4)
  ];
  
  let support = 102;
  const setup = [];
  for(let i=0; i<20; i++) {
    support += 0.35;  // Rising lows
    const mid = support + (resistance - support) * R(0.3, 0.8);
    const wickUp = Math.max(0, resistance - mid - R(0, 1.5));
    setup.push(K(mid + R(-0.8, 0.8), mid + R(-0.8, 0.8), wickUp, R(0.2, 1)));
  }
  
  const continuation = TREND(resistance + 1, 18, 2.8, 1.4);
  
  return {
    context, setup, continuation,
    signal: 'buy',
    name: 'Ascending Triangle',
    cat: 'Continuation',
    difficulty: 2,
    trap: false
  };
}

function cupHandle_clean() {
  const rim = 108;
  const context = [
    ...TREND(100, 10, 0.6, 1.2),
    ...TREND(106, 8, 0.2, 0.8)
  ];
  
  // Cup formation
  const cupDepth = 8;
  const cup = [];
  for(let i=0; i<15; i++) {
    const angle = (i / 14) * Math.PI;
    const depth = cupDepth * Math.sin(angle);
    const price = rim - depth;
    cup.push(K(price + R(-0.6, 0.6), price + R(-0.6, 0.6), R(0.3, 1), R(0.3, 1)));
  }
  
  // Handle pullback
  const handle = TREND(rim - 1, 8, -0.25, 0.6);
  
  const setup = [...cup, ...handle];
  const continuation = TREND(rim + 0.5, 18, 2.5, 1.3);
  
  return {
    context, setup, continuation,
    signal: 'buy',
    name: 'Cup & Handle',
    cat: 'Reversal',
    difficulty: 2,
    trap: false
  };
}

// ── CLEAN BEARISH PATTERNS ──────────────────────────────────

function bearFlag_clean() {
  const context = [
    ...RANGE(110, 12, 3),
    ...TREND(110, 8, -3.5, 1.2)  // Strong downtrend
  ];
  const poleBot = context[context.length-1].c;
  
  const setup = TREND(poleBot, 20, 0.3, 0.8);  // Tight bounce
  const setupEnd = setup[setup.length-1].c;
  
  const continuation = TREND(setupEnd, 20, -3.2, 1.5);  // Breakdown
  
  return {
    context, setup, continuation,
    signal: 'sell',
    name: 'Bear Flag',
    cat: 'Continuation',
    difficulty: 1,
    trap: false
  };
}

function descTriangle_clean() {
  const support = 100;
  const context = [
    ...TREND(115, 15, -0.8, 1.5),
    ...RANGE(105, 12, 4)
  ];
  
  let resistance = 108;
  const setup = [];
  for(let i=0; i<20; i++) {
    resistance -= 0.35;  // Falling highs
    const mid = support + (resistance - support) * R(0.3, 0.8);
    const wickDown = Math.max(0, mid - support - R(0, 1.5));
    setup.push(K(mid + R(-0.8, 0.8), mid + R(-0.8, 0.8), R(0.2, 1), wickDown));
  }
  
  const continuation = TREND(support - 1, 18, -2.8, 1.4);
  
  return {
    context, setup, continuation,
    signal: 'sell',
    name: 'Descending Triangle',
    cat: 'Continuation',
    difficulty: 2,
    trap: false
  };
}

function headShoulders_clean() {
  const neckline = 100;
  const context = TREND(95, 25, 0.4, 1.2);
  
  const setup = [];
  // Left shoulder
  setup.push(...TREND(100, 4, 1.5, 0.8));
  setup.push(...TREND(106, 4, -1.5, 0.8));
  // Head
  setup.push(...TREND(103, 5, 2.2, 1));
  setup.push(...TREND(111, 5, -2.2, 1));
  // Right shoulder
  setup.push(...TREND(101, 4, 1.4, 0.8));
  setup.push(...TREND(106, 4, -1.4, 0.8));
  
  const continuation = TREND(neckline - 1, 20, -2.5, 1.5);
  
  return {
    context, setup, continuation,
    signal: 'sell',
    name: 'Head & Shoulders',
    cat: 'Reversal',
    difficulty: 2,
    trap: false
  };
}

// ── TRAP/FAILED PATTERNS ────────────────────────────────────

function bullFlag_trap() {
  const context = [
    ...RANGE(100, 12, 3),
    ...TREND(100, 8, 3.5, 1.2)
  ];
  const poleTop = context[context.length-1].c;
  
  const setup = TREND(poleTop, 20, -0.3, 0.8);
  const setupEnd = setup[setup.length-1].c;
  
  // FAILS: breaks down instead
  const continuation = TREND(setupEnd, 20, -2.5, 1.5);
  
  return {
    context, setup, continuation,
    signal: 'hold',  // Should NOT buy - it's a trap!
    name: 'Failed Bull Flag',
    cat: 'Trap',
    difficulty: 3,
    trap: true
  };
}

function fakeBreakout_bull() {
  const resistance = 110;
  const context = [
    ...TREND(95, 15, 0.8, 1.5),
    ...RANGE(105, 15, 4)
  ];
  
  const setup = [];
  // Looks like it's breaking up
  setup.push(...TREND(108, 8, 1.2, 1));
  setup.push(K(resistance + 0.5, resistance + 1.2, 0.3, 0.2));  // Fake breakout
  setup.push(K(resistance + 0.8, resistance - 0.5, 0.2, 0.4));  // Rejection
  setup.push(...RANGE(resistance - 2, 8, 2));
  
  const continuation = TREND(105, 18, -2.2, 1.5);  // Falls back
  
  return {
    context, setup, continuation,
    signal: 'hold',
    name: 'False Breakout',
    cat: 'Trap',
    difficulty: 4,
    trap: true
  };
}

function weakFollowthrough_bull() {
  const context = [
    ...RANGE(100, 15, 3),
    ...TREND(100, 10, 2.5, 1.2)
  ];
  
  const setup = TREND(108, 20, -0.25, 0.7);
  const setupEnd = setup[setup.length-1].c;
  
  // Breaks up but weak - chop instead of rally
  const continuation = RANGE(setupEnd + 2, 20, 3);
  
  return {
    context, setup, continuation,
    signal: 'hold',  // Not strong enough
    name: 'Weak Breakout',
    cat: 'Trap',
    difficulty: 3,
    trap: true
  };
}

// ── AMBIGUOUS / HOLD PATTERNS ───────────────────────────────

function range_consolidation() {
  const context = TREND(95, 25, 0.3, 1.5);
  const setup = RANGE(105, 22, 5);
  const continuation = RANGE(105, 20, 5);  // Stays in range
  
  return {
    context, setup, continuation,
    signal: 'hold',
    name: 'Consolidation Range',
    cat: 'Neutral',
    difficulty: 2,
    trap: false
  };
}

function choppy_mess() {
  const context = RANGE(100, 20, 4);
  
  const setup = [];
  let p = 102;
  for(let i=0; i<20; i++) {
    p += R(-2, 2);
    setup.push(K(p + R(-1.5, 1.5), p + R(-1.5, 1.5), R(0.5, 2), R(0.5, 2)));
  }
  
  const continuation = [];
  for(let i=0; i<18; i++) {
    p += R(-2, 2);
    continuation.push(K(p + R(-1.5, 1.5), p + R(-1.5, 1.5), R(0.5, 2), R(0.5, 2)));
  }
  
  return {
    context, setup, continuation,
    signal: 'hold',
    name: 'Choppy Market',
    cat: 'Neutral',
    difficulty: 1,
    trap: false
  };
}

// ── MORE BULLISH PATTERNS ───────────────────────────────────

function doubleBottom_clean() {
  const support = 98;
  const context = TREND(105, 20, -0.3, 1.2);
  
  const setup = [];
  // First bottom
  setup.push(...TREND(102, 5, -0.8, 0.6));
  setup.push(K(support + 0.2, support, 0.3, 0.8));
  setup.push(...TREND(support, 4, 1.2, 0.8));
  // Rally
  setup.push(...TREND(103, 4, 0.3, 0.8));
  // Second bottom
  setup.push(...TREND(105, 5, -1, 0.6));
  setup.push(K(support + 0.3, support + 0.1, 0.2, 0.7));
  setup.push(...TREND(support + 0.5, 4, 1.5, 0.9));
  
  const continuation = TREND(104, 18, 2.5, 1.4);
  
  return {
    context, setup, continuation,
    signal: 'buy',
    name: 'Double Bottom',
    cat: 'Reversal',
    difficulty: 2,
    trap: false
  };
}

function breakoutRetest_bull() {
  const resistance = 108;
  const context = [
    ...TREND(95, 12, 0.5, 1.2),
    ...RANGE(105, 15, 3.5)
  ];
  
  const setup = [];
  // Breakout
  setup.push(...TREND(resistance - 1, 5, 1.4, 0.8));
  setup.push(K(resistance + 0.5, resistance + 1.5, 0.4, 0.2));
  // Pullback to retest
  setup.push(...TREND(resistance + 1.5, 8, -0.5, 0.7));
  setup.push(K(resistance + 0.2, resistance + 0.5, 0.3, 0.8));
  // Bounce
  setup.push(...TREND(resistance + 0.6, 5, 0.8, 0.6));
  
  const continuation = TREND(resistance + 3, 18, 2.2, 1.3);
  
  return {
    context, setup, continuation,
    signal: 'buy',
    name: 'Breakout Retest',
    cat: 'Continuation',
    difficulty: 3,
    trap: false
  };
}

function inversHeadShoulders() {
  const neckline = 108;
  const context = TREND(115, 25, -0.4, 1.2);
  
  const setup = [];
  // Left shoulder
  setup.push(...TREND(108, 4, -1.5, 0.8));
  setup.push(...TREND(102, 4, 1.5, 0.8));
  // Head
  setup.push(...TREND(105, 5, -2.2, 1));
  setup.push(...TREND(97, 5, 2.2, 1));
  // Right shoulder
  setup.push(...TREND(107, 4, -1.4, 0.8));
  setup.push(...TREND(102, 4, 1.4, 0.8));
  
  const continuation = TREND(neckline + 1, 20, 2.5, 1.5);
  
  return {
    context, setup, continuation,
    signal: 'buy',
    name: 'Inverse Head & Shoulders',
    cat: 'Reversal',
    difficulty: 3,
    trap: false
  };
}

// ── MORE BEARISH PATTERNS ────────────────────────────────────

function doubleTop_clean() {
  const resistance = 112;
  const context = TREND(105, 20, 0.3, 1.2);
  
  const setup = [];
  // First top
  setup.push(...TREND(108, 5, 0.8, 0.6));
  setup.push(K(resistance - 0.2, resistance, 0.8, 0.3));
  setup.push(...TREND(resistance, 4, -1.2, 0.8));
  // Dip
  setup.push(...TREND(107, 4, -0.3, 0.8));
  // Second top
  setup.push(...TREND(105, 5, 1, 0.6));
  setup.push(K(resistance - 0.3, resistance - 0.1, 0.7, 0.2));
  setup.push(...TREND(resistance - 0.5, 4, -1.5, 0.9));
  
  const continuation = TREND(106, 18, -2.5, 1.4);
  
  return {
    context, setup, continuation,
    signal: 'sell',
    name: 'Double Top',
    cat: 'Reversal',
    difficulty: 2,
    trap: false
  };
}

function breakdownRetest_bear() {
  const support = 102;
  const context = [
    ...TREND(115, 12, -0.5, 1.2),
    ...RANGE(105, 15, 3.5)
  ];
  
  const setup = [];
  // Breakdown
  setup.push(...TREND(support + 1, 5, -1.4, 0.8));
  setup.push(K(support - 0.5, support - 1.5, 0.2, 0.4));
  // Rally to retest
  setup.push(...TREND(support - 1.5, 8, 0.5, 0.7));
  setup.push(K(support - 0.2, support - 0.5, 0.8, 0.3));
  // Rejection
  setup.push(...TREND(support - 0.6, 5, -0.8, 0.6));
  
  const continuation = TREND(support - 3, 18, -2.2, 1.3);
  
  return {
    context, setup, continuation,
    signal: 'sell',
    name: 'Breakdown Retest',
    cat: 'Continuation',
    difficulty: 3,
    trap: false
  };
}

// ── MORE TRAP PATTERNS ───────────────────────────────────────

function bearTrap() {
  const support = 100;
  const context = [
    ...TREND(110, 15, -0.4, 1.3),
    ...RANGE(103, 12, 3)
  ];
  
  const setup = [];
  // Looks like breakdown
  setup.push(...TREND(102, 6, -1.2, 0.8));
  setup.push(K(support - 0.5, support - 1.5, 0.2, 0.6));  // Fakeout
  setup.push(K(support - 1.2, support + 0.5, 0.3, 0.2));  // Sharp reversal
  setup.push(...TREND(support + 1, 8, 1.5, 1));
  
  const continuation = TREND(106, 18, 2.8, 1.5);  // Rallies instead
  
  return {
    context, setup, continuation,
    signal: 'hold',  // Don't short the breakdown - it's a trap!
    name: 'Bear Trap',
    cat: 'Trap',
    difficulty: 4,
    trap: true
  };
}

function bullTrap() {
  const resistance = 110;
  const context = [
    ...TREND(100, 15, 0.4, 1.3),
    ...RANGE(107, 12, 3)
  ];
  
  const setup = [];
  // Looks like breakout
  setup.push(...TREND(108, 6, 1.2, 0.8));
  setup.push(K(resistance + 0.5, resistance + 1.5, 0.6, 0.2));  // Fakeout
  setup.push(K(resistance + 1.2, resistance - 0.5, 0.2, 0.3));  // Sharp rejection
  setup.push(...TREND(resistance - 1, 8, -1.5, 1));
  
  const continuation = TREND(104, 18, -2.8, 1.5);  // Falls instead
  
  return {
    context, setup, continuation,
    signal: 'hold',  // Don't buy the breakout - it's a trap!
    name: 'Bull Trap',
    cat: 'Trap',
    difficulty: 4,
    trap: true
  };
}

function lateEntry_bull() {
  const context = [
    ...RANGE(100, 15, 3),
    ...TREND(100, 8, 3, 1.1)
  ];
  
  // Already extended, late to the party
  const setup = TREND(115, 20, 1.8, 1.5);
  
  // Small continuation then reversal
  const continuation = [
    ...TREND(125, 6, 0.8, 1.2),
    ...TREND(128, 12, -2, 1.5)
  ];
  
  return {
    context, setup, continuation,
    signal: 'hold',  // Too late, already extended
    name: 'Late Entry',
    cat: 'Trap',
    difficulty: 3,
    trap: true
  };
}

// ── PATTERN POOL ────────────────────────────────────────────

const PATTERN_POOL = [
  // Clean bullish (easy-medium)
  { fn: bullFlag_clean, weight: 3 },
  { fn: ascTriangle_clean, weight: 2 },
  { fn: cupHandle_clean, weight: 2 },
  { fn: doubleBottom_clean, weight: 2 },
  { fn: breakoutRetest_bull, weight: 2 },
  { fn: inversHeadShoulders, weight: 1 },
  
  // Clean bearish (easy-medium)
  { fn: bearFlag_clean, weight: 3 },
  { fn: descTriangle_clean, weight: 2 },
  { fn: headShoulders_clean, weight: 2 },
  { fn: doubleTop_clean, weight: 2 },
  { fn: breakdownRetest_bear, weight: 2 },
  
  // Traps (medium-hard)
  { fn: bullFlag_trap, weight: 2 },
  { fn: fakeBreakout_bull, weight: 2 },
  { fn: weakFollowthrough_bull, weight: 2 },
  { fn: bearTrap, weight: 2 },
  { fn: bullTrap, weight: 2 },
  { fn: lateEntry_bull, weight: 1 },
  
  // Hold patterns (medium)
  { fn: range_consolidation, weight: 2 },
  { fn: choppy_mess, weight: 1 }
];

function getRandomPattern() {
  const totalWeight = PATTERN_POOL.reduce((sum, p) => sum + p.weight, 0);
  let rand = Math.random() * totalWeight;
  
  for(const p of PATTERN_POOL) {
    if(rand < p.weight) return p.fn();
    rand -= p.weight;
  }
  
  return PATTERN_POOL[0].fn();
}

// ── 40+ PATTERN FACTORIES ─────────────────────────────────────
// Bullish Continuation ─────
function drawChart(canvas, candles, revealCount, continuationCount, contCandles, godMode) {
  if (!canvas) return;
  const ctx    = canvas.getContext("2d");
  const dpr    = window.devicePixelRatio || 1;
  const W      = canvas.clientWidth;
  const H      = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height= H * dpr;
  ctx.scale(dpr, dpr);

  // ═══════════════════════════════════════════════════════════════
  // ULTRA-MODERN MINIMALIST BACKGROUND
  // ═══════════════════════════════════════════════════════════════
  
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0a12");
  bg.addColorStop(1, "#050508");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Minimal grid
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for(let i=1; i<5; i++) {
    const y = (H / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  if(godMode) {
    ctx.save();
    const pulse = 0.6 + 0.4*Math.sin(Date.now()*0.003);
    ctx.shadowColor = C.nGreen;
    ctx.shadowBlur = 40;
    ctx.strokeStyle = `rgba(0,255,170,${0.3 * pulse})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, W-8, H-8);
    ctx.restore();
  }

  if (!candles || candles.length === 0 || revealCount === 0) return;

  // ═══════════════════════════════════════════════════════════════
  // SLIDING WINDOW RENDERING (show last 28 candles only)
  // ═══════════════════════════════════════════════════════════════
  
  const allCandles = [...candles, ...(contCandles||[])];
  if(allCandles.length === 0) return;

  // Calculate visible candles (last 28 only for realistic trading view)
  const maxVisible = 28;
  const numVisible = Math.min(allCandles.length, maxVisible);
  const startIdx = Math.max(0, allCandles.length - maxVisible);
  
  // Only calculate scale based on VISIBLE candles
  const visibleCandles = allCandles.slice(startIdx);
  let lo = Infinity, hi = -Infinity;
  visibleCandles.forEach(c => { 
    if(c.l < lo) lo = c.l; 
    if(c.h > hi) hi = c.h; 
  });
  
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const priceH = hi - lo || 1;

  const slotW = W / numVisible;
  const bodyW = slotW * 0.75;
  const gap = slotW * 0.12;

  const toY = p => H - ((p - lo) / priceH) * H;

  // ── Price label (only for last visible candle) ──
  let lastVisibleIdx = -1;
  for(let i = allCandles.length - 1; i >= startIdx; i--) {
    let alpha = 0;
    if (i < candles.length) {
      alpha = Math.max(0, Math.min(1, revealCount - i));
    } else {
      const ci = i - candles.length;
      alpha = Math.max(0, Math.min(1, continuationCount - ci));
    }
    if (alpha > 0.01) {
      lastVisibleIdx = i;
      break;
    }
  }
  
  if (lastVisibleIdx >= startIdx) {
    const lastC = allCandles[lastVisibleIdx];
    const lblY = toY(lastC.c);
    const lblColor = lastC.c >= lastC.o ? C.bull : C.bear;
    
    ctx.save();
    const lblW = 62, lblH = 28;
    ctx.fillStyle = "rgba(10,10,18,0.95)";
    ctx.beginPath();
    ctx.roundRect(W - lblW - 8, lblY - lblH/2, lblW, lblH, 14);
    ctx.fill();
    
    ctx.strokeStyle = lblColor + "30";
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.fillStyle = lblColor;
    ctx.font = "600 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(lastC.c.toFixed(2), W - 18, lblY + 4.5);
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER VISIBLE CANDLES ONLY (sliding window)
  // ═══════════════════════════════════════════════════════════════
  
  visibleCandles.forEach((c, localIdx) => {
    const globalIdx = startIdx + localIdx;
    const x = localIdx * slotW + gap/2;
    const bull = c.c >= c.o;

    // Calculate alpha
    let alpha = 0;
    if (globalIdx < candles.length) {
      alpha = Math.max(0, Math.min(1, revealCount - globalIdx));
    } else {
      const ci = globalIdx - candles.length;
      alpha = Math.max(0, Math.min(1, continuationCount - ci));
    }
    
    if (alpha <= 0.02) return;

    const bodyColor = bull ? C.bull : C.bear;
    
    // Subtle emphasis on recent candles
    const isRecent = localIdx >= numVisible - 5;
    const depthBoost = isRecent ? 0.15 : 0;
    const finalAlpha = alpha * (0.85 + depthBoost);
    
    const currentBodyW = bodyW - gap;

    ctx.save();
    ctx.globalAlpha = finalAlpha;

    // Wick
    const wickTop = toY(c.h);
    const wickBot = toY(c.l);
    
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + currentBodyW/2, wickTop);
    ctx.lineTo(x + currentBodyW/2, wickBot);
    ctx.stroke();

    // Body
    const bodyTop = toY(Math.max(c.o, c.c));
    const bodyBottom = toY(Math.min(c.o, c.c));
    const bodyHeight = Math.max(bodyBottom - bodyTop, 2);

    const bodyGrad = ctx.createLinearGradient(x, bodyTop, x, bodyTop + bodyHeight);
    bodyGrad.addColorStop(0, bodyColor + "f0");
    bodyGrad.addColorStop(1, bodyColor + "b8");
    ctx.fillStyle = bodyGrad;
    
    ctx.beginPath();
    ctx.roundRect(x, bodyTop, currentBodyW, bodyHeight, 1.5);
    ctx.fill();

    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Top highlight
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(x + 2, bodyTop + 1, currentBodyW - 4, 1);

    // Recent candle glow
    if (isRecent && alpha > 0.9) {
      ctx.shadowColor = bodyColor;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = bodyColor + "80";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  });

  // Subtle ambient
  const ambientLight = ctx.createRadialGradient(W*0.5, H*0.3, 0, W*0.5, H*0.3, W*0.6);
  ambientLight.addColorStop(0, "rgba(0,255,170,0.02)");
  ambientLight.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ambientLight;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = 1;
}

/* ═══════════════════════════════════════════════════════════════
    8  PARTICLE BURST  (perfect round / god mode)
   ═══════════════════════════════════════════════════════════════ */
function ParticleCanvas({ active, godMode }) {
  const canvasRef = useRef(null);
  const pRef      = useRef([]);
  const rafRef    = useRef(null);

  const spawn = useCallback((count, colors) => {
    const cx = window.innerWidth/2, cy = window.innerHeight/2;
    for(let i=0;i<count;i++) {
      const angle = (Math.PI*2/count)*i + R(-0.3,0.3);
      const speed = R(80,220);
      pRef.current.push({
        x:cx, y:cy,
        vx: Math.cos(angle)*speed,
        vy: Math.sin(angle)*speed,
        life: 1,
        decay: R(0.012, 0.028),
        size: R(3,7),
        color: colors[RI(0,colors.length-1)],
        rot: R(0,Math.PI*2),
        rotV: R(-4,4),
      });
    }
  }, []);

  useEffect(() => {
    if(active) {
      const cols = godMode
        ? [C.nGreen, C.nBlue, "#fff", C.nPurple, C.nPink]
        : [C.nGreen, C.nBlue, "#fff"];
      spawn(godMode ? 80 : 48, cols);
    }
  }, [active, godMode, spawn]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext("2d");
    let running = true;

    function loop() {
      if(!running) return;
      canvas.width  = window.innerWidth  * (window.devicePixelRatio||1);
      canvas.height = window.innerHeight * (window.devicePixelRatio||1);
      ctx.scale(window.devicePixelRatio||1, window.devicePixelRatio||1);
      ctx.clearRect(0,0,window.innerWidth, window.innerHeight);

      pRef.current = pRef.current.filter(p => p.life > 0);
      pRef.current.forEach(p => {
        p.x += p.vx * 0.016;
        p.y += p.vy * 0.016;
        p.vy += 60; // gravity
        p.vx *= 0.99;
        p.life -= p.decay;
        p.rot += p.rotV * 0.016;

        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6);
        ctx.restore();
      });
      rafRef.current = requestAnimationFrame(loop);
    }
    loop();
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, []);

  return <canvas ref={canvasRef} style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:200, width:"100vw", height:"100vh" }} />;
}

/* ═══════════════════════════════════════════════════════════════
    9  GLASS UI PRIMITIVES
   ═══════════════════════════════════════════════════════════════ */

// Specular highlight that follows pointer
function useSpecular() {
  const [pos, setPos] = useState({ x:50, y:0 });
  useEffect(() => {
    const onMove = e => {
      const t = e.touches?.[0] || e;
      setPos({ x: (t.clientX / window.innerWidth)*100, y: (t.clientY / window.innerHeight)*100 });
    };
    window.addEventListener("mousemove", onMove, { passive:true });
    window.addEventListener("touchmove", onMove, { passive:true });
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("touchmove", onMove); };
  }, []);
  return pos;
}

function GlassPanel({ children, style={}, className="" }) {
  return (
    <div className={className} style={{
      background: "linear-gradient(135deg, rgba(20,20,38,0.62) 0%, rgba(14,14,26,0.78) 100%)",
      backdropFilter: "blur(48px) saturate(1.8)",
      WebkitBackdropFilter: "blur(48px) saturate(1.8)",
      border: `1px solid ${C.glassBr}`,
      borderRadius: 28,
      boxShadow: "0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 60px rgba(0,255,170,0.04)",
      ...style
    }}>
      {children}
    </div>
  );
}

function GlassButton({ children, onClick, color=C.nGreen, disabled=false, style={} }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onMouseDown={()=>setPressed(true)} onMouseUp={()=>setPressed(false)}
      onTouchStart={e=>{e.preventDefault();setPressed(true);}}
      onTouchEnd={e=>{e.preventDefault();setPressed(false);onClick?.();}}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${color}40`,
        borderRadius: 20,
        color: color,
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        fontWeight: 700,
        fontSize: 15,
        letterSpacing: "0.04em",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transform: pressed ? "scale(0.94)" : "scale(1)",
        transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease",
        boxShadow: pressed
          ? `0 2px 12px ${color}30, inset 0 1px 0 ${color}22`
          : `0 4px 24px ${color}18, inset 0 1px 0 ${color}25`,
        padding: "14px 28px",
        outline: "none",
        ...style
      }}
    >
      {children}
    </button>
  );
}


/* ═══════════════════════════════════════════════════════════════
    11  COUNTDOWN OVERLAY  (3-2-1 glass shatter) - CHART ANIMATES BEHIND
   ═══════════════════════════════════════════════════════════════ */
function Countdown({ onDone, initialRevealProgress }) {
  const [num, setNum]       = useState(3);
  const [shatter, setShatter] = useState(false);
  const [exit, setExit]     = useState(false);

  useEffect(() => {
    SND.tick(3);
    haptic([25]);
    if(num > 1) {
      const t = setTimeout(() => { SND.tick(num-1); haptic([25]); setNum(n=>n-1); }, 900);
      return () => clearTimeout(t);
    } else {
      // after "1" show briefly then shatter
      const t1 = setTimeout(() => setShatter(true), 600);
      const t2 = setTimeout(() => { setExit(true); }, 900);
      const t3 = setTimeout(onDone, 1050);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [num, onDone]);

  // shatter fragments (CSS)
  const frags = useMemo(() => Array.from({length:12}, (_,i) => ({
    id:i, angle: (i/12)*360, dist: R(40,160), delay: i*30
  })), []);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:250, display:"flex", alignItems:"center", justifyContent:"center",
      background:"rgba(6,6,12,0.72)", backdropFilter:"blur(12px)" }}>
      {!shatter ? (
        <div style={{ position:"relative" }}>
          {/* outer glass ring */}
          <div style={{ width:140, height:140, borderRadius:"50%",
            background:"linear-gradient(135deg, rgba(20,20,40,0.7), rgba(14,14,26,0.9))",
            border:`2px solid ${C.nGreen}50`,
            boxShadow:`0 0 40px ${C.nGreen}25, inset 0 0 30px rgba(0,255,170,0.06)`,
            display:"flex", alignItems:"center", justifyContent:"center",
            animation:"ringPulse 0.9s ease-out" }}>
            <span style={{ fontSize: 72, fontWeight:800, fontFamily:"'SF Mono','Fira Code',monospace",
              color: num===1 ? C.nPink : C.nGreen,
              textShadow: `0 0 30px ${num===1?C.nPink:C.nGreen}`,
              animation:"numPop 0.35s cubic-bezier(0.34,1.56,0.64,1)" }}>
              {num}
            </span>
          </div>
        </div>
      ) : (
        // shatter fragments
        <div style={{ position:"relative", width:140, height:140 }}>
          {frags.map(f => (
            <div key={f.id} style={{
              position:"absolute", left:"50%", top:"50%",
              width: R(15,40), height: R(10,28),
              background:`linear-gradient(${f.angle}deg, ${C.nGreen}44, ${C.nPurple}22)`,
              border: `1px solid ${C.nGreen}30`,
              borderRadius: R(2,6),
              transform: exit
                ? `translate(${Math.cos(f.angle*Math.PI/180)*f.dist}px, ${Math.sin(f.angle*Math.PI/180)*f.dist}px) rotate(${f.angle}deg) scale(0)`
                : "translate(-50%,-50%) scale(1)",
              opacity: exit ? 0 : 1,
              transition: `transform 0.35s cubic-bezier(0.55,0,1,1) ${f.delay}ms, opacity 0.3s ease ${f.delay+100}ms`,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
    12  TIMER BAR  (liquid progress, pulse when low)
   ═══════════════════════════════════════════════════════════════ */
function TimerBar({ timeLeft, totalTime }) {
  const pct    = (timeLeft / totalTime) * 100;
  const isLow  = timeLeft < 1200;
  const color  = isLow ? C.nPink : timeLeft < 2200 ? C.nAmber : C.nGreen;

  return (
    <div style={{ width:"100%", height:5, background:"rgba(255,255,255,0.07)", borderRadius:3, overflow:"hidden",
      boxShadow: isLow ? `0 0 12px ${C.nPink}60` : "none", transition:"box-shadow 0.3s" }}>
      <div style={{
        width:`${pct}%`, height:"100%", borderRadius:3,
        background:`linear-gradient(90deg, ${color}, ${color}bb)`,
        boxShadow:`0 0 8px ${color}50`,
        transition: "width 0.08s linear, background 0.4s ease",
      }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
    13  DECISION BUTTONS
   ═══════════════════════════════════════════════════════════════ */
function DecisionButtons({ onChoose, disabled }) {
  return (
    <div style={{ display:"flex", gap:12, width:"100%", maxWidth:380, margin:"0 auto" }}>
      <GlassButton onClick={()=>onChoose("sell")} color={C.bear} disabled={disabled} style={{ flex:1, padding:"16px 8px" }}>
        <div style={{ fontSize:11, opacity:0.7, marginBottom:2 }}>BEARISH</div>
        <div style={{ fontSize:18 }}>📉 SELL</div>
      </GlassButton>
      <GlassButton onClick={()=>onChoose("hold")} color={C.neut} disabled={disabled} style={{ flex:1, padding:"16px 8px" }}>
        <div style={{ fontSize:11, opacity:0.7, marginBottom:2 }}>NEUTRAL</div>
        <div style={{ fontSize:18 }}>⏸️ HOLD</div>
      </GlassButton>
      <GlassButton onClick={()=>onChoose("buy")} color={C.bull} disabled={disabled} style={{ flex:1, padding:"16px 8px" }}>
        <div style={{ fontSize:11, opacity:0.7, marginBottom:2 }}>BULLISH</div>
        <div style={{ fontSize:18 }}>📈 BUY</div>
      </GlassButton>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
    14  OUTCOME CARD  (per-round feedback)
   ═══════════════════════════════════════════════════════════════ */
function OutcomeCard({ correct, points, streak, patternName, choice, signal, onNext, godMode }) {
  const labelMap = { buy:"📈 BUY", sell:"📉 SELL", hold:"⏸️ HOLD" };
  return (
    <GlassPanel style={{ padding:18, textAlign:"center", position:"relative", overflow:"hidden" }}>
      {/* top accent bar */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:3,
        background: correct ? `linear-gradient(90deg, ${C.nGreen}, ${C.nBlue})` : `linear-gradient(90deg, ${C.nPink}, ${C.nPurple})` }} />

      <div style={{ fontSize:36, marginBottom:4 }}>{correct ? "✅" : "❌"}</div>
      <div style={{ fontSize:15, fontWeight:700, fontFamily:"monospace", color: correct ? C.nGreen : C.nPink }}>
        {correct ? `+${points} pts` : "No points"}
      </div>

      {/* pattern + signals */}
      <div style={{ marginTop:10, fontSize:12, color:"rgba(255,255,255,0.55)", fontFamily:"monospace" }}>
        Pattern: <span style={{ color:"#fff" }}>{patternName}</span>
      </div>
      <div style={{ display:"flex", justifyContent:"center", gap:16, marginTop:6, fontSize:12, fontFamily:"monospace" }}>
        <span>You: <span style={{ color: choice==="buy" ? C.bull : choice==="sell" ? C.bear : C.neut }}>{labelMap[choice] || "⏱ Timeout"}</span></span>
        <span>Correct: <span style={{ color: signal==="buy" ? C.bull : signal==="sell" ? C.bear : C.neut }}>{labelMap[signal]}</span></span>
      </div>

      {streak > 1 && correct && (
        <div style={{ marginTop:8, fontSize:13, color:C.nPurple, fontFamily:"monospace" }}>🔥 {streak} streak! ×{STREAK_MULT[Math.min(streak, STREAK_MULT.length-1)].toFixed(1)}</div>
      )}

      {godMode && correct && (
        <div style={{ marginTop:4, fontSize:11, color:C.nGreen, fontFamily:"monospace", animation:"pulse 0.8s infinite" }}>⚡ GOD MODE ACTIVE</div>
      )}

      <GlassButton onClick={onNext} color={C.nGreen} style={{ marginTop:14, width:"100%", justifyContent:"center" }}>
        Next Round →
      </GlassButton>
    </GlassPanel>
  );
}

/* ═══════════════════════════════════════════════════════════════
    15  FINAL VERDICT  (end-of-game stats + archetype reveal)
   ═══════════════════════════════════════════════════════════════ */
function FinalVerdict({ stats, onRestart, onLeaderboard, onShare }) {
  const arch = getArchetype(stats);
  const stars = "⭐".repeat(Math.round((stats.correct/ROUNDS)*5)) + "☆".repeat(5 - Math.round((stats.correct/ROUNDS)*5));

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:"0 16px", maxWidth:420, margin:"0 auto" }}>
      {/* archetype card */}
      <GlassPanel style={{ padding:"28px 24px", width:"100%", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:3,
          background:`linear-gradient(90deg, ${C.nGreen}, ${C.nPurple}, ${C.nPink})` }} />
        <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.18em", color:"rgba(255,255,255,0.35)", fontFamily:"monospace", marginBottom:6 }}>Your Trading Archetype</div>
        <div style={{ fontSize:48 }}>{arch.emoji}</div>
        <div style={{ fontSize:22, fontWeight:800, fontFamily:"'SF Mono','Fira Code',monospace", color:"#fff", marginTop:4 }}>{arch.name}</div>
        <div style={{ fontSize:18, marginTop:6 }}>{stars}</div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", fontFamily:"monospace", fontStyle:"italic", marginTop:10, lineHeight:1.5, maxWidth:300, margin:"10px auto 0" }}>
          "{arch.roast}"
        </div>
      </GlassPanel>

      {/* stats row */}
      <GlassPanel style={{ padding:"16px 20px", width:"100%", display:"flex", justifyContent:"space-around" }}>
        {[
          { value:stats.totalScore, label:"Score", color:C.nGreen },
          { value:`${stats.correct}/${ROUNDS}`, label:"Correct", color:C.nBlue },
          { value:`${stats.avgSpeed}ms`, label:"Avg Speed", color:C.nPurple },
          { value:`×${stats.maxStreak}`, label:"Best Streak", color:C.nPink },
        ].map(s => (
          <div key={s.label} style={{ textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:800, fontFamily:"monospace", color:s.color }}>{s.value}</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.38)", textTransform:"uppercase", letterSpacing:"0.08em" }}>{s.label}</div>
          </div>
        ))}
      </GlassPanel>

      {/* action buttons */}
      <div style={{ display:"flex", gap:10, width:"100%", maxWidth:380 }}>
        <GlassButton onClick={onRestart} color={C.nGreen} style={{ flex:2, justifyContent:"center" }}>🔄 Play Again</GlassButton>
        <GlassButton onClick={onShare}   color={C.nPurple} style={{ flex:1, justifyContent:"center" }}>📤 Share</GlassButton>
      </div>
      <GlassButton onClick={onLeaderboard} color={C.nBlue} style={{ width:"100%", maxWidth:380, justifyContent:"center" }}>
        🏆 Leaderboard
      </GlassButton>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
    16  LEADERBOARD  (localStorage)
   ═══════════════════════════════════════════════════════════════ */
const LB_KEY = "reflexglass_lb_v2";
function loadLB() { try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; } catch(_){ return []; } }
function saveLB(arr) { try { localStorage.setItem(LB_KEY, JSON.stringify(arr.slice(0,50))); } catch(_){} }

function addToLeaderboard(name, stats) {
  const lb = loadLB();
  const arch = getArchetype(stats);
  lb.push({ name, score:stats.totalScore, avgSpeed:stats.avgSpeed, correct:stats.correct,
            archetype:arch.name, emoji:arch.emoji, ts:Date.now() });
  lb.sort((a,b) => b.score - a.score);
  saveLB(lb);
  return lb;
}

function Leaderboard({ onClose, currentName }) {
  const lb = useMemo(() => loadLB(), []);
  return (
    <div style={{ maxWidth:420, margin:"0 auto", padding:"0 16px" }}>
      <GlassPanel style={{ padding:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div style={{ fontSize:18, fontWeight:800, fontFamily:"monospace", color:C.nGreen }}>🏆 Leaderboard</div>
          <GlassButton onClick={onClose} color="rgba(255,255,255,0.5)" style={{ padding:"6px 14px", fontSize:12 }}>✕</GlassButton>
        </div>
        {lb.length === 0 ? (
          <div style={{ textAlign:"center", color:"rgba(255,255,255,0.3)", fontSize:13, fontFamily:"monospace", padding:24 }}>
            No entries yet. Play a round!
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {lb.slice(0,15).map((e,i) => {
              const medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":"";
              const isMe  = e.name === currentName;
              return (
                <div key={i} style={{
                  display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:14,
                  background: isMe ? `${C.nGreen}12` : "rgba(255,255,255,0.03)",
                  border: isMe ? `1px solid ${C.nGreen}28` : "1px solid rgba(255,255,255,0.05)",
                }}>
                  <span style={{ width:24, textAlign:"center", fontSize:14 }}>{medal || `${i+1}.`}</span>
                  <span style={{ fontSize:15 }}>{e.emoji}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"rgba(255,255,255,0.85)", fontFamily:"monospace", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {e.name} <span style={{ fontSize:10, color:"rgba(255,255,255,0.3)", fontWeight:400 }}>{e.archetype}</span>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:15, fontWeight:800, fontFamily:"monospace", color:C.nGreen }}>{e.score}</div>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)" }}>{e.avgSpeed}ms avg</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
    17  SHARE CARD  (SVG rendered to data-URL → open share sheet)
   ═══════════════════════════════════════════════════════════════ */
function generateShareSVG(stats) {
  const arch = getArchetype(stats);
  const stars = "⭐".repeat(Math.round((stats.correct/ROUNDS)*5)) + "☆".repeat(5 - Math.round((stats.correct/ROUNDS)*5));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="280" viewBox="0 0 480 280">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0f0f1a"/><stop offset="100%" stop-color="#06060c"/></linearGradient>
      <linearGradient id="glass" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="rgba(20,20,40,0.7)"/><stop offset="100%" stop-color="rgba(14,14,26,0.9)"/></linearGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="8"/></filter>
      <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="480" height="280" fill="url(#bg)"/>
    <!-- ambient orbs -->
    <circle cx="80"  cy="60"  r="90"  fill="#00ffaa" opacity="0.06" filter="url(#blur)"/>
    <circle cx="420" cy="220" r="70"  fill="#a855f7" opacity="0.07" filter="url(#blur)"/>
    <circle cx="350" cy="40"  r="50"  fill="#ff4d94" opacity="0.05" filter="url(#blur)"/>
    <!-- glass card -->
    <rect x="24" y="24" width="432" height="232" rx="24" fill="url(#glass)" stroke="rgba(255,255,255,0.08)" stroke-width="1" opacity="0.9"/>
    <!-- top accent line -->
    <rect x="24" y="24" width="432" height="3" rx="2" fill="url(#topAccent)"/>
    <defs><linearGradient id="topAccent" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#00ffaa"/><stop offset="50%" stop-color="#a855f7"/><stop offset="100%" stop-color="#ff4d94"/></linearGradient></defs>
    <!-- title -->
    <text x="240" y="58" text-anchor="middle" fill="#00ffaa" font-family="monospace" font-size="11" font-weight="700" letter-spacing="3" filter="url(#glow)">REFLEX GLASS</text>
    <!-- archetype -->
    <text x="240" y="100" text-anchor="middle" fill="white" font-family="monospace" font-size="26" font-weight="800">${arch.emoji} ${arch.name}</text>
    <!-- stars -->
    <text x="240" y="132" text-anchor="middle" font-size="18">${stars}</text>
    <!-- stats -->
    <text x="80"  y="180" text-anchor="middle" fill="#00ffaa" font-family="monospace" font-size="22" font-weight="800">${stats.totalScore}</text>
    <text x="80"  y="198" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="monospace" font-size="9">SCORE</text>
    <text x="200" y="180" text-anchor="middle" fill="#38bdf8" font-family="monospace" font-size="22" font-weight="800">${stats.correct}/${ROUNDS}</text>
    <text x="200" y="198" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="monospace" font-size="9">CORRECT</text>
    <text x="320" y="180" text-anchor="middle" fill="#a855f7" font-family="monospace" font-size="22" font-weight="800">${stats.avgSpeed}ms</text>
    <text x="320" y="198" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="monospace" font-size="9">AVG SPEED</text>
    <!-- roast -->
    <text x="240" y="238" text-anchor="middle" fill="rgba(255,255,255,0.32)" font-family="monospace" font-size="9" font-style="italic">"${arch.roast.slice(0,62)}…"</text>
  </svg>`;
}

function triggerShare(stats, playerName) {
  const svg  = generateShareSVG(stats);
  
  // Create a canvas to render the SVG
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 280;
  const ctx = canvas.getContext('2d');
  
  // Create an image from SVG
  const img = new Image();
  const svgBlob = new Blob([svg], {type:"image/svg+xml;charset=utf-8"});
  const url = URL.createObjectURL(svgBlob);
  
  img.onload = function() {
    // Draw the SVG onto canvas
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    
    // Convert canvas to blob
    canvas.toBlob(async function(blob) {
      if (!blob) return;
      
      const file = new File([blob], "reflex-glass-score.png", { type: "image/png" });
      
      // Try Web Share API with the image
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: "Reflex Glass",
            text: `I scored ${stats.totalScore} — ${getArchetype(stats).name} 🔥`,
            files: [file]
          });
        } catch(err) {
          // If share fails, download the image
          downloadImage(blob);
        }
      } else {
        // Fallback: download the image
        downloadImage(blob);
      }
    }, 'image/png');
  };
  
  img.src = url;
}

function downloadImage(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'reflex-glass-score.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════════════
    18  NAME INPUT (first-time / before leaderboard)
   ═══════════════════════════════════════════════════════════════ */
const NAME_KEY = "reflexglass_name_v2";
function loadName() { try { return localStorage.getItem(NAME_KEY) || ""; } catch(_){ return ""; } }

function NameInput({ onSubmit }) {
  const [val, setVal] = useState(loadName());
  const save = () => {
    const n = val.trim() || "Anonymous";
    try { localStorage.setItem(NAME_KEY, n); } catch(_){}
    onSubmit(n);
  };
  return (
    <GlassPanel style={{ padding:28, maxWidth:340, margin:"0 auto", textAlign:"center" }}>
      <div style={{ fontSize:14, color:"rgba(255,255,255,0.55)", fontFamily:"monospace", marginBottom:12 }}>Enter your trader name</div>
      <input value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()} maxLength={22}
        placeholder="e.g. SatoshiGains"
        style={{ width:"100%", padding:"12px 16px", borderRadius:16, border:`1px solid ${C.glassBr}`,
          background:"rgba(255,255,255,0.06)", color:"#fff", fontSize:15, fontFamily:"monospace",
          outline:"none", textAlign:"center", boxSizing:"border-box" }} />
      <GlassButton onClick={save} color={C.nGreen} style={{ marginTop:14, width:"100%", justifyContent:"center" }}>Continue →</GlassButton>
    </GlassPanel>
  );
}

/* ═══════════════════════════════════════════════════════════════
    20  TIP / DONATION PANEL  (USDC on Base via sendTransaction)
        Uses raw ERC-20 transfer calldata — no wagmi contract hooks needed.
        Caller must supply sendTransaction (wagmi useWriteContract or
        equivalent) via the global hook wired in main.jsx / provider.
   ═══════════════════════════════════════════════════════════════ */

// ── config ──────────────────────────────────────────────────────
const DONATION_ADDRESS = "0xa800F14C07935e850e9e20221956d99920E9a498";           // ← replace with your Base address
const USDC_BASE        = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base mainnet USDC
const TIPS = [
  { amount: 0.5, label: "☕ 0.5 USDC" },
  { amount: 1,   label: "🍔 1 USDC"   },
  { amount: 5,   label: "🚀 5 USDC"   },
];

// parseUnits for USDC (6 decimals) — inline, no viem dep required here
function parseUSDC(usdAmount) {
  return BigInt(Math.round(usdAmount * 1e6));
}

// Build raw ERC-20 transfer(address,uint256) calldata
function buildTransferData(to, amount) {
  const selector = "0xa9059cbb";                            // transfer(address,uint256)
  const addr     = to.slice(2).toLowerCase().padStart(64, "0");
  const amt      = amount.toString(16).padStart(64, "0");
  return selector + addr + amt;
}

function TipPanel() {
  const [status, setStatus] = useState("idle");             // idle | loading | success | error
  const [errMsg, setErrMsg] = useState("");

  const sendTip = async (usdAmount) => {
    setStatus("loading");
    SND.tipTap();
    haptic([30]);
    try {
      // Try wagmi's sendTransaction if available on window (injected by provider)
      // Fallback: open MetaMask / Coinbase wallet via window.ethereum directly
      const amount = parseUSDC(usdAmount);
      const data   = buildTransferData(DONATION_ADDRESS, amount);

      if (window.__reflexSendTx) {
        // If the host app injected a sendTransaction helper (recommended)
        await window.__reflexSendTx({ to: USDC_BASE, data });
      } else if (window.ethereum) {
        // Direct provider fallback
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [{ from: accounts[0], to: USDC_BASE, data }],
        });
      } else {
        throw new Error("No wallet connected");
      }
      setStatus("success");
      SND.tipTap();
      haptic([40, 20, 60]);
      setTimeout(() => setStatus("idle"), 3200);
    } catch (e) {
      setErrMsg(e.message || "Transaction failed");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2800);
    }
  };

  return (
    <GlassPanel style={{ padding:"18px 20px", maxWidth:380, width:"100%", margin:"0 auto", position:"relative", overflow:"hidden" }}>
      {/* subtle gradient top accent */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2,
        background:`linear-gradient(90deg, transparent, ${C.nAmber}, ${C.nPink}, transparent)` }} />

      {/* header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <span style={{ fontSize:18 }}>💛</span>
        <div>
          <div style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color:"rgba(255,255,255,0.82)" }}>Support the dev</div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", fontFamily:"monospace" }}>Buy me a coffee · or a yacht · who's counting</div>
        </div>
      </div>

      {/* tip buttons */}
      {status === "idle" && (
        <div style={{ display:"flex", gap:8 }}>
          {TIPS.map(t => (
            <GlassButton key={t.amount} onClick={() => sendTip(t.amount)} color={C.nAmber}
              style={{ flex:1, justifyContent:"center", padding:"10px 6px", fontSize:13 }}>
              {t.label}
            </GlassButton>
          ))}
        </div>
      )}

      {/* loading state */}
      {status === "loading" && (
        <div style={{ textAlign:"center", padding:"12px 0" }}>
          <div style={{ fontSize:22, animation:"pulse 0.7s ease infinite" }}>⏳</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", fontFamily:"monospace", marginTop:4 }}>Confirm in wallet…</div>
        </div>
      )}

      {/* success */}
      {status === "success" && (
        <div style={{ textAlign:"center", padding:"10px 0" }}>
          <div style={{ fontSize:28 }}>🎉</div>
          <div style={{ fontSize:13, fontWeight:700, color:C.nGreen, fontFamily:"monospace", marginTop:2 }}>Thank you, legend!</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", fontFamily:"monospace", marginTop:2 }}>You just made the dev's day</div>
        </div>
      )}

      {/* error */}
      {status === "error" && (
        <div style={{ textAlign:"center", padding:"10px 0" }}>
          <div style={{ fontSize:22 }}>⚠️</div>
          <div style={{ fontSize:11, color:C.nPink, fontFamily:"monospace", marginTop:3 }}>{errMsg}</div>
          <GlassButton onClick={() => setStatus("idle")} color="rgba(255,255,255,0.4)" style={{ marginTop:6, padding:"5px 16px", fontSize:11 }}>Retry</GlassButton>
        </div>
      )}

      {/* USDC badge */}
      <div style={{ marginTop:10, textAlign:"center" }}>
        <span style={{ fontSize:9, color:"rgba(255,255,255,0.2)", fontFamily:"monospace" }}>
          USDC on Base · {DONATION_ADDRESS.slice(0,6)}…{DONATION_ADDRESS.slice(-4)}
        </span>
      </div>
    </GlassPanel>
  );
}

/* ═══════════════════════════════════════════════════════════════
    19  ROOT APP  —  STATE MACHINE + GAME LOOP
        States: "name" | "home" | "countdown" | "playing" | "revealing" | "outcome" | "verdict" | "leaderboard"
   ═══════════════════════════════════════════════════════════════ */
export default function App() {
  // ── state ──
  const [screen, setScreen]               = useState(loadName() ? "home" : "name");
  const [playerName, setPlayerName]       = useState(loadName());
  const [round, setRound]                 = useState(0);        // 0-based
  const [pattern, setPattern]             = useState(null);     // current pattern object
  const [timeLeft, setTimeLeft]           = useState(DECISION_MS);
  const [choice, setChoice]               = useState(null);
  const [streak, setStreak]               = useState(0);
  const [scores, setScores]               = useState([]);       // per-round score
  const [roundStats, setRoundStats]       = useState([]);       // {correct, speedMs, choice, signal}
  const [contProgress, setContProgress]   = useState(0);        // 0 → 10 (animated candle count)
  const [initialRevealProgress, setInitialRevealProgress] = useState(0); // 0 → 22 (initial candles animation)
  const [particleBurst, setParticleBurst] = useState(false);
  const [godMode, setGodMode]             = useState(false);
  const [screenPulse, setScreenPulse]     = useState(false);    // low-time shake
  const [showCountdown, setShowCountdown] = useState(false);    // countdown 3-2-1 indítása előtt
  const [countdownNum, setCountdownNum]   = useState(3);        // countdown szám
  const [usedPatterns, setUsedPatterns]   = useState([]);       // használt pattern-ek nevei

  // refs
  const chartRef      = useRef(null);
  const timerRef      = useRef(null);
  const contAnimRef   = useRef(null);
  const initialAnimRef = useRef(null);
  const rafChartRef   = useRef(null);
  const choiceTimeRef = useRef(null);       // ms when choice was made

  // ── derived ──
  const isPlaying = screen === "playing";

  // ── Initial candles reveal animation during countdown ──
  useEffect(() => {
    if (screen !== "playing" || !pattern || showCountdown) {
      cancelAnimationFrame(initialAnimRef.current);
      return;
    }
    
    setInitialRevealProgress(0);
    const startTime = Date.now();
    const totalCandles = pattern.candles?.length || 45; // context + setup
    const duration = 2700; // 2.7 seconds
    let lastSoundedCandle = -1;
    
    function animate() {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - pct, 3);
      const newProgress = eased * totalCandles;
      setInitialRevealProgress(newProgress);
      
      // Sound every 4th candle (since we have more candles now)
      const currentCandle = Math.floor(newProgress);
      if (currentCandle > lastSoundedCandle && currentCandle < totalCandles) {
        lastSoundedCandle = currentCandle;
        if (currentCandle % 4 === 0) {
          SND.candlePop();
        }
      }
      
      if (pct < 1) {
        initialAnimRef.current = requestAnimationFrame(animate);
      } else {
        setInitialRevealProgress(totalCandles);
      }
    }
    
    initialAnimRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(initialAnimRef.current);
  }, [screen, pattern, showCountdown]);

  // ── chart RAF loop (redraws every frame for smooth candle reveal) ──
  useEffect(() => {
    if (!pattern || !chartRef.current) return;
    
    let running = true;

    function loop() {
      if (!running) return;

      // Draw during countdown (with initial animation), playing, revealing, or outcome
      if (screen === "playing" || screen === "revealing" || screen === "outcome") {
        const revealCount = initialRevealProgress ;
        const contCount = screen === "revealing" || screen === "outcome" ? contProgress : 0;
        
        drawChart(
          chartRef.current,
          pattern.candles,
          revealCount,
          contCount,
          pattern.continuation,
          godMode
        );
      }

      rafChartRef.current = requestAnimationFrame(loop);
    }

    loop();

    return () => {
      running = false;
      cancelAnimationFrame(rafChartRef.current);
    };
  }, [pattern, screen, contProgress, initialRevealProgress, godMode]);

  // ── low-time haptic pulse ──
  useEffect(() => {
    if(isPlaying && timeLeft <= 500 && timeLeft > 0) {
      haptic([40, 30, 40]);
      setScreenPulse(true);
    } else {
      setScreenPulse(false);
    }
  }, [isPlaying, timeLeft]);

  // ── countdown timer (3-2-1 before playing state) ──
  useEffect(() => {
    if(!showCountdown) return;
    
    setCountdownNum(3);
    SND.tick(3);
    haptic([30]);
    
    const timer1 = setTimeout(() => {
      setCountdownNum(2);
      SND.tick(2);
      haptic([30]);
    }, 1000);
    
    const timer2 = setTimeout(() => {
      setCountdownNum(1);
      SND.tick(1);
      haptic([30]);
    }, 2000);
    
    const timer3 = setTimeout(() => {
      setShowCountdown(false);
      setScreen("playing");
    }, 3000);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [showCountdown]);

  // ── countdown timer (playing state) ──
  useEffect(() => {
    if(!isPlaying) { clearInterval(timerRef.current); return; }
    setTimeLeft(DECISION_MS);
    choiceTimeRef.current = Date.now();
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const rem = DECISION_MS - (Date.now() - start);
      if(rem <= 0) {
        clearInterval(timerRef.current);
        setTimeLeft(0);
        // timeout = wrong answer
        handleChoice(null);
      } else {
        setTimeLeft(rem);
      }
    }, 60);
    return () => clearInterval(timerRef.current);
  }, [isPlaying]); // eslint-disable-line

  // ── continuation candle wave-reveal animation ──
  useEffect(() => {
    if(screen !== "revealing") { cancelAnimationFrame(contAnimRef.current); return; }
    setContProgress(0);
    const startTime = Date.now();
    const totalCont = pattern?.continuation?.length || 18;
    const duration  = 900; // ms for all continuation candles
    let lastSoundedContCandle = -1;
    
    function animate() {
      const elapsed = Date.now() - startTime;
      const pct     = Math.min(elapsed / duration, 1);
      const eased   = 1 - Math.pow(1 - pct, 3);
      const newProgress = eased * totalCont;
      setContProgress(newProgress);
      
      // Sound every 3rd candle
      const currentContCandle = Math.floor(newProgress);
      if (currentContCandle > lastSoundedContCandle && currentContCandle < totalCont) {
        lastSoundedContCandle = currentContCandle;
        if (currentContCandle % 3 === 0) {
          SND.candlePop();
        }
      }
      
      if(pct < 1) {
        contAnimRef.current = requestAnimationFrame(animate);
      } else {
        setContProgress(totalCont);
        setTimeout(() => setScreen("outcome"), 200);
      }
    }
    contAnimRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(contAnimRef.current);
  }, [screen, pattern]);

  // ── GAME ACTIONS ──

  // 1️⃣ játék indítás → pattern ELŐRE létrejön
  const startGame = useCallback(() => {
    // Generate pattern with 3-phase structure
    const p = getRandomPattern();
    
    // Combine context + setup for initial display
    // User sees: context (auto-plays) + setup (where they decide)
    const combinedCandles = [...p.context, ...p.setup];
    
    // Store pattern with proper structure
    setPattern({
      candles: combinedCandles,           // context + setup combined
      continuation: p.continuation,       // what happens after
      signal: p.signal,
      name: p.name,
      cat: p.cat,
      difficulty: p.difficulty || 2,
      trap: p.trap || false,
      contextLength: p.context.length,    // track where setup starts
      setupLength: p.setup.length
    });
    
    setUsedPatterns([p.name]);

    setRound(0);
    setScores([]);
    setRoundStats([]);
    setStreak(0);
    setGodMode(false);
    setChoice(null);
    setContProgress(0);
    setInitialRevealProgress(0);

    // Start countdown
    setShowCountdown(true);
  }, []);




  // 3️⃣ választás kezelése
  const handleChoice = useCallback((ch) => {
    if (choice !== null) return;

    clearInterval(timerRef.current);

    const speedMs =
      choiceTimeRef.current
        ? Date.now() - choiceTimeRef.current
        : DECISION_MS;

    choiceTimeRef.current = null;
    setChoice(ch);

    const correct = ch === pattern.signal;
    haptic(correct ? [30, 20, 30] : [80]);

    if (correct) {
      SND.correct();

      const mult = STREAK_MULT[Math.min(streak + 1, STREAK_MULT.length - 1)];
      const speedBonus = Math.round(
        (1 - speedMs / DECISION_MS) * BASE_SCORE * 0.5
      );
      const pts = Math.round((BASE_SCORE + speedBonus) * mult);

      setScores(p => [...p, pts]);
      setRoundStats(p => [
        ...p,
        { correct: true, speedMs, choice: ch, signal: pattern.signal }
      ]);

      const newStreak = streak + 1;
      setStreak(newStreak);

      setParticleBurst(true);
      setTimeout(() => setParticleBurst(false), 600);

      if (newStreak >= 6 && !godMode) {
        setGodMode(true);
        SND.godBurst();
        haptic([50, 30, 50, 30, 50]);
      }
    } else {
      SND.wrong();
      setScores(p => [...p, 0]);
      setRoundStats(p => [
        ...p,
        { correct: false, speedMs, choice: ch, signal: pattern.signal }
      ]);
      setStreak(0);
    }

    setScreen("revealing");
  }, [choice, pattern, streak, godMode]);


  // 4️⃣ következő kör
  const advanceRound = useCallback(() => {
    const nextRound = round + 1;

    if (nextRound >= ROUNDS) {
      const stats = computeStats();
      addToLeaderboard(playerName, stats);
      setScreen("verdict");
    } else {
      // Generate new pattern that hasn't been used
      let p = getRandomPattern();
      let attempts = 0;
      while (usedPatterns.includes(p.name) && attempts < 50) {
        p = getRandomPattern();
        attempts++;
      }
      
      // Combine context + setup for display
      const combinedCandles = [...p.context, ...p.setup];
      
      setPattern({
        candles: combinedCandles,
        continuation: p.continuation,
        signal: p.signal,
        name: p.name,
        cat: p.cat,
        difficulty: p.difficulty || 2,
        trap: p.trap || false,
        contextLength: p.context.length,
        setupLength: p.setup.length
      });
      
      setUsedPatterns(prev => [...prev, p.name]);

      setRound(nextRound);
      setChoice(null);
      setContProgress(0);
      setInitialRevealProgress(0);

      // No countdown between rounds
      setScreen("playing");
    }
  }, [round, playerName, usedPatterns]);


  // 5️⃣ statisztika
  function computeStats() {
    const totalScore = scores.reduce((a, b) => a + b, 0);
    const correct = roundStats.filter(r => r.correct).length;
    const buyCount = roundStats.filter(r => r.choice === "buy").length;
    const sellCount = roundStats.filter(r => r.choice === "sell").length;
    const holdCount = roundStats.filter(r => r.choice === "hold").length;

    const speeds = roundStats.map(r => r.speedMs);
    const avgSpeed = speeds.length
      ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length)
      : 0;

    let maxStreak = 0, cur = 0;
    roundStats.forEach(r => {
      if (r.correct) {
        cur++;
        maxStreak = Math.max(maxStreak, cur);
      } else {
        cur = 0;
      }
    });

    return { totalScore, correct, buyCount, sellCount, holdCount, avgSpeed, maxStreak };
  }

  // ── RENDER ──

  // global styles injected once
  useEffect(() => {
    const tag = document.createElement("style");
    tag.textContent = `
      * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
      html, body { margin:0; padding:0; height:100%; overflow:hidden; }
      body { background:${C.bg1}; color:#fff; font-family:"SF Pro","Helvetica Neue",sans-serif; }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      @keyframes ringPulse { 0%{transform:scale(0.6);opacity:0} 100%{transform:scale(1);opacity:1} }
      @keyframes numPop { 0%{transform:scale(0.5);opacity:0} 100%{transform:scale(1);opacity:1} }
      @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      input::placeholder { color:rgba(255,255,255,0.28); }
      input:focus { box-shadow: 0 0 0 2px ${C.nGreen}40 !important; }
      ::-webkit-scrollbar { width:4px; }
      ::-webkit-scrollbar-track { background:transparent; }
      ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:2px; }
    `;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  // ── SCREEN RENDERERS ──

  const renderHome = () => (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100%", gap:24, padding:24 }}>
      {/* logo */}
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48, fontWeight:900, fontFamily:"'SF Mono','Fira Code',monospace", letterSpacing:"-1px",
          background:`linear-gradient(135deg, ${C.nGreen} 0%, ${C.nPurple} 50%, ${C.nPink} 100%)`,
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          textShadow:"none", filter:"drop-shadow(0 0 24px rgba(0,255,170,0.3))" }}>
          REFLEX
        </div>
        <div style={{ fontSize:48, fontWeight:900, fontFamily:"'SF Mono','Fira Code',monospace", letterSpacing:"-1px",
          background:`linear-gradient(135deg, ${C.nPurple} 0%, ${C.nPink} 100%)`,
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          filter:"drop-shadow(0 0 18px rgba(168,85,247,0.35))", marginTop:-8 }}>
          GLASS
        </div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", letterSpacing:"0.24em", textTransform:"uppercase", marginTop:4, fontFamily:"monospace" }}>
          Chart Pattern Reflex Trainer
        </div>
      </div>

      {/* info card */}
      <GlassPanel style={{ padding:20, maxWidth:340, width:"100%", textAlign:"center" }}>
        <div style={{ display:"flex", justifyContent:"center", gap:20 }}>
          {[
            { icon:"📊", label:"40+", sub:"Patterns" },
            { icon:"⚡", label:"4s", sub:"Decision" },
            { icon:"🔥", label:"×4", sub:"Max Streak" },
          ].map(item => (
            <div key={item.label} style={{ flex:1, textAlign:"center" }}>
              <div style={{ fontSize:20 }}>{item.icon}</div>
              <div style={{ fontSize:16, fontWeight:800, fontFamily:"monospace", color:C.nGreen }}>{item.label}</div>
              <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.06em" }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* CTA */}
      <GlassButton onClick={startGame} color={C.nGreen} style={{ padding:"18px 56px", fontSize:18, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
          backgroundSize:"200% 100%", animation:"shimmer 2.2s linear infinite", pointerEvents:"none" }} />
        Start Trading
      </GlassButton>

      {/* leaderboard link */}
      <GlassButton onClick={()=>setScreen("leaderboard")} color={C.nBlue} style={{ padding:"10px 24px", fontSize:13 }}>
        🏆 Leaderboard
      </GlassButton>

      <div style={{ fontSize:10, color:"rgba(255,255,255,0.22)", fontFamily:"monospace", textAlign:"center", maxWidth:300 }}>
        Base Mini App · Works in Warpcast · {playerName && `Playing as ${playerName}`}
      </div>
    </div>
  );





  const renderPlaying = () => (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", gap:10, padding:"10px 12px" }}>
      {/* header row */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:2 }}>
        <GlassPanel style={{ padding:"6px 14px", borderRadius:16 }}>
          <span style={{ fontSize:12, fontFamily:"monospace", color:"rgba(255,255,255,0.5)" }}>Round </span>
          <span style={{ fontSize:14, fontWeight:800, fontFamily:"monospace", color:C.nGreen }}>{round+1}<span style={{ color:"rgba(255,255,255,0.28)", fontWeight:400 }}>/{ROUNDS}</span></span>
        </GlassPanel>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {streak > 0 && (
            <GlassPanel style={{ padding:"5px 11px", borderRadius:16, border:`1px solid ${C.nPurple}35` }}>
              <span style={{ fontSize:12, fontFamily:"monospace", color:C.nPurple }}>🔥 ×{STREAK_MULT[Math.min(streak+1, STREAK_MULT.length-1)].toFixed(1)}</span>
            </GlassPanel>
          )}
          {godMode && (
            <GlassPanel style={{ padding:"5px 11px", borderRadius:16, border:`1px solid ${C.nGreen}45`,
              background:`linear-gradient(135deg, ${C.nGreen}15, ${C.nBlue}10)` }}>
              <span style={{ fontSize:12, fontFamily:"monospace", color:C.nGreen }}>⚡ GOD MODE</span>
            </GlassPanel>
          )}
        </div>
      </div>

      {/* timer */}
      <TimerBar timeLeft={timeLeft} totalTime={DECISION_MS} />

      {/* chart */}
      <div style={{ flex:1, minHeight:0, position:"relative" }}>
        <canvas ref={chartRef} style={{ width:"100%", height:"100%", borderRadius:20, display:"block" }} />
        {/* pattern name watermark */}
        {screen === "outcome" && pattern && (
          <div style={{ position:"absolute", top:12, right:14, fontSize:10, fontFamily:"monospace",
            color:"rgba(255,255,255,0.18)", background:"rgba(6,6,12,0.6)", padding:"3px 8px", borderRadius:8,
            backdropFilter:"blur(8px)" }}>
            {pattern.name}
          </div>
        )}
      </div>

      {/* decision / outcome */}
      <div style={{ paddingBottom:8 }}>
        {screen === "playing" && <DecisionButtons onChoose={handleChoice} disabled={false} />}
        {screen === "outcome" && (
          <OutcomeCard
            correct={roundStats[roundStats.length-1]?.correct}
            points={scores[scores.length-1]}
            streak={streak}
            patternName={pattern?.name}
            choice={choice}
            signal={pattern?.signal}
            onNext={advanceRound}
            godMode={godMode}
          />
        )}
      </div>
    </div>
  );

  const renderVerdict = () => (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", justifyContent:"center", padding:16, gap:14 }}>
      <FinalVerdict
        stats={computeStats()}
        onRestart={startGame}
        onLeaderboard={()=>setScreen("leaderboard")}
        onShare={()=>triggerShare(computeStats(), playerName)}
      />
      <TipPanel />
    </div>
  );

  const renderCountdown = () => (
    <div style={{ 
      position: "fixed",
      inset: 0,
      zIndex: 300,
      background: `radial-gradient(ellipse at 50% 50%, ${C.bg2}dd 0%, ${C.bg1}f5 100%)`,
      backdropFilter: "blur(20px)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center"
    }}>
      {/* Ambient glow behind number */}
      <div style={{
        position: "absolute",
        width: 400,
        height: 400,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${C.nGreen}25 0%, transparent 70%)`,
        filter: "blur(80px)",
        animation: "pulse 1s ease-in-out infinite"
      }} />
      
      {/* Pulsing ring - synchronized with number */}
      <div style={{
        position: "absolute",
        width: 280,
        height: 280,
        borderRadius: "50%",
        border: `6px solid ${C.nGreen}50`,
        animation: "ringPulse 1s ease-out infinite"
      }} />
      
      {/* The number - now also pulsing */}
      <div 
        key={countdownNum}
        style={{ 
          fontSize: 200, 
          fontWeight: 900, 
          fontFamily: "'SF Mono','Fira Code',monospace",
          background: `linear-gradient(135deg, ${C.nGreen} 0%, ${C.nPurple} 50%, ${C.nPink} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          filter: "drop-shadow(0 0 60px rgba(0,255,170,0.6))",
          animation: "ringPulse 1s ease-out infinite",
          position: "relative",
          zIndex: 1,
          lineHeight: 1
        }}>
        {countdownNum}
      </div>
      
      {/* Small text below */}
      <div style={{
        fontSize: 14,
        color: "rgba(255,255,255,0.4)",
        fontFamily: "monospace",
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        marginTop: 40,
        position: "relative",
        zIndex: 1
      }}>
    
      </div>
    </div>
  );

  // ── MAIN RETURN ──
  return (
    <div style={{ width:"100vw", height:"100dvh", overflowY:"auto", overflowX:"hidden",
      background:`radial-gradient(ellipse at 30% 20%, #0f1a2e 0%, ${C.bg1} 55%, ${C.bg2} 100%)`,
      position:"relative" }}>

      {/* ambient orbs (background atmosphere) */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", top:"10%",  left:"15%", width:220, height:220, borderRadius:"50%", background:`radial-gradient(circle, ${C.nGreen}0a 0%, transparent 70%)`, filter:"blur(40px)" }} />
        <div style={{ position:"absolute", top:"60%", right:"10%", width:180, height:180, borderRadius:"50%", background:`radial-gradient(circle, ${C.nPurple}0d 0%, transparent 70%)`, filter:"blur(36px)" }} />
        <div style={{ position:"absolute", bottom:"15%", left:"40%", width:140, height:140, borderRadius:"50%", background:`radial-gradient(circle, ${C.nPink}09 0%, transparent 70%)`, filter:"blur(30px)" }} />
      </div>


      {/* particle layer */}
      <ParticleCanvas active={particleBurst} godMode={godMode} />

      {/* screen pulse overlay (low time warning) */}
      {screenPulse && (
        <div style={{ position:"fixed", inset:0, zIndex:198, pointerEvents:"none",
          boxShadow:`inset 0 0 60px ${C.nPink}55`, borderRadius:0, transition:"opacity 0.15s" }} />
      )}

      {/* main content (below ticker) */}
      <div style={{ position:"relative", zIndex:1, paddingTop:34, minHeight:"calc(100dvh - 34px)",
        display:"flex", flexDirection:"column" }}>

        {screen === "name"        && <NameInput onSubmit={n=>{ setPlayerName(n); setScreen("home"); }} />}
        {screen === "home"        && renderHome()}
        {(screen==="playing" || screen==="revealing" || screen==="outcome") && renderPlaying()}
        {screen === "verdict"     && renderVerdict()}
        {screen === "leaderboard" && (
          <div style={{ paddingTop:20 }}>
            <Leaderboard onClose={()=>setScreen(round>=ROUNDS?"verdict":"home")} currentName={playerName} />
          </div>
        )}
      </div>
      
      {/* Countdown overlay - appears above everything */}
      {showCountdown && renderCountdown()}
    </div>
  );
}