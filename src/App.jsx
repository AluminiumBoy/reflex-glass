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
 *  REFLEX GLASS — Context-Aware Chart Pattern Reflex Trainer
 *  REDESIGNED 2026 — Realistic Market Structure Edition
 *
 *  Focus: Pattern recognition in context, not pattern memorization
 *  Core: Multi-pattern environments, windowed view, patience training
 * ═══════════════════════════════════════════════════════════════
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════
    1  CONSTANTS & COLOR TOKENS
   ═══════════════════════════════════════════════════════════════ */

const ROUNDS = 7;
const DECISION_MS = 5000; // Increased to 5s for context analysis
const BASE_SCORE = 1000;
const STREAK_MULT = [1, 1.3, 1.6, 2.0, 2.5, 3.0, 3.5, 4.0];

// Difficulty affects window size and pattern complexity
const DIFFICULTY_CONFIG = {
  easy: { windowSize: 35, contextSize: 50, cleanRatio: 0.6 },
  medium: { windowSize: 28, contextSize: 65, cleanRatio: 0.4 },
  hard: { windowSize: 22, contextSize: 80, cleanRatio: 0.25 },
};

const C = {
  nGreen: "#00ffaa",
  nPink: "#ff4d94",
  nPurple: "#a855f7",
  nBlue: "#38bdf8",
  nAmber: "#fbbf24",
  bull: "#00e676",
  bear: "#ff1744",
  neut: "#fbbf24",
  bg1: "#06060c",
  bg2: "#0f0f1a",
  glass: "rgba(14,14,26,0.52)",
  glassBr: "rgba(255,255,255,0.07)",
  glassHi: "rgba(255,255,255,0.13)",
};

/* ═══════════════════════════════════════════════════════════════
    2  HAPTIC HELPER
   ═══════════════════════════════════════════════════════════════ */
function haptic(pattern = [30]) {
  try {
    navigator?.vibrate?.(pattern);
  } catch (_) {}
}

/* ═══════════════════════════════════════════════════════════════
    3  SOUND ENGINE
   ═══════════════════════════════════════════════════════════════ */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.on = true;
    this.masterGain = null;
    this.compressor = null;
  }

  _ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.7;
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -20;
      this.compressor.knee.value = 10;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  unlock() {
    if (!this.on) return;
    const ctx = this._ensure();
    if (ctx.state === "suspended") ctx.resume();
  }

  click() {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.frequency.setValueAtTime(2800, now);
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.02);
    osc1.type = "sine";
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc1.start(now);
    osc1.stop(now + 0.06);
  }

  tick(n) {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime;
    const freq = n === 1 ? 1400 : 880;
    const vol = n === 1 ? 0.25 : 0.18;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq * 1.5, now);
    filter.Q.value = 8;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  correct() {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.15, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.3);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.35);
    });
  }

  wrong() {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.3);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  toggle() {
    this.on = !this.on;
  }
}

const sound = new SoundEngine();

/* ═══════════════════════════════════════════════════════════════
    4  MARKET STRUCTURE GENERATOR
    
    This is the CORE of the redesign. Instead of generating isolated
    patterns, we create realistic market structures with:
    - Long context (40-80 candles)
    - Multiple overlapping patterns
    - Trend transitions
    - Failed patterns and traps
    - Natural decision points
   ═══════════════════════════════════════════════════════════════ */

class MarketStructureGenerator {
  constructor(difficulty = "medium") {
    this.difficulty = difficulty;
    this.config = DIFFICULTY_CONFIG[difficulty];
    this.rng = Math.random;
  }

  // Seed for reproducibility (optional)
  seed(s) {
    let seed = s;
    this.rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  // Generate complete market structure with context
  // Focus: INFERABLE DIRECTION, not confusion
  generate() {
    const { contextSize } = this.config;

    // Determine setup type and signal FIRST (outcome-driven)
    const setupType = this._pickSetupType();
    const signal = setupType.signal; // BUY, SELL, or HOLD

    // Build context that supports (or contradicts for traps) this signal
    const context = this._buildContext(setupType, contextSize);

    // Build the actual setup candles
    const setupCandles = this._buildSetup(setupType, context);

    // Combine: context + setup
    const candles = [...context.candles, ...setupCandles];
    const decisionIndex = candles.length - 1;

    // Generate continuation based on signal
    const continuation = this._generateContinuation(signal, setupType, candles);

    return {
      candles,
      decisionIndex,
      continuation,
      signal,
      context: {
        trendBias: context.bias,
        priorStructure: context.priorPattern,
        momentum: setupType.momentum,
        quality: setupType.quality,
      },
      pattern: setupType.name,
      regime: context.regime,
    };
  }

  _pickSetupType() {
    const r = this.rng();
    const { cleanRatio } = this.config;

    // Distribution: 50% directional, 30% trap, 20% HOLD
    if (r < 0.25) {
      // Clean bullish continuation (12.5% each)
      return {
        type: "bullish_continuation",
        signal: "BUY",
        name: this.rng() < 0.5 ? "Bull Flag" : "Ascending Triangle",
        momentum: "strong",
        quality: "clean",
        willSucceed: true,
      };
    } else if (r < 0.5) {
      // Clean bearish continuation
      return {
        type: "bearish_continuation",
        signal: "SELL",
        name: this.rng() < 0.5 ? "Bear Flag" : "Descending Triangle",
        momentum: "strong",
        quality: "clean",
        willSucceed: true,
      };
    } else if (r < 0.65) {
      // Bullish reversal
      return {
        type: "bullish_reversal",
        signal: "BUY",
        name: this.rng() < 0.5 ? "Double Bottom" : "Inverse H&S",
        momentum: "building",
        quality: "good",
        willSucceed: true,
      };
    } else if (r < 0.8) {
      // Bearish reversal
      return {
        type: "bearish_reversal",
        signal: "SELL",
        name: this.rng() < 0.5 ? "Double Top" : "Head & Shoulders",
        momentum: "building",
        quality: "good",
        willSucceed: true,
      };
    } else if (r < 0.9) {
      // Trap - looks bullish but fails
      return {
        type: "bull_trap",
        signal: "HOLD",
        name: "Bull Trap",
        momentum: "weak",
        quality: "poor",
        willSucceed: false,
      };
    } else if (r < 0.95) {
      // Trap - looks bearish but fails
      return {
        type: "bear_trap",
        signal: "HOLD",
        name: "Bear Trap",
        momentum: "weak",
        quality: "poor",
        willSucceed: false,
      };
    } else {
      // True HOLD - no clear structure
      return {
        type: "consolidation",
        signal: "HOLD",
        name: "Consolidation",
        momentum: "neutral",
        quality: "incomplete",
        willSucceed: false,
      };
    }
  }

  _buildContext(setupType, contextSize) {
    const candles = [];
    let price = 1000 + this.rng() * 500;

    // Determine context regime based on setup type
    let regime, bias;
    if (setupType.type === "bullish_continuation") {
      regime = "uptrend";
      bias = "Bullish";
    } else if (setupType.type === "bearish_continuation") {
      regime = "downtrend";
      bias = "Bearish";
    } else if (setupType.type === "bullish_reversal") {
      regime = "downtrend_exhausting";
      bias = "Turning Bullish";
    } else if (setupType.type === "bearish_reversal") {
      regime = "uptrend_exhausting";
      bias = "Turning Bearish";
    } else {
      regime = "range";
      bias = "Neutral";
    }

    // Phase 1: Establish dominant trend/range (60% of context)
    const phase1Length = Math.floor(contextSize * 0.6);
    if (regime === "uptrend") {
      candles.push(...this._trendCandles(price, phase1Length, 0.003, 0.012, 0.7));
    } else if (regime === "downtrend" || regime === "downtrend_exhausting") {
      candles.push(...this._trendCandles(price, phase1Length, -0.003, 0.015, 0.3));
    } else if (regime === "uptrend_exhausting") {
      candles.push(...this._trendCandles(price, phase1Length, 0.0025, 0.012, 0.65));
    } else {
      candles.push(...this._rangeCandles(price, phase1Length, 0.01));
    }

    price = candles[candles.length - 1].close;

    // Phase 2: Add prior structure (failed attempt or pullback) (25% of context)
    const phase2Length = Math.floor(contextSize * 0.25);
    let priorPattern = "None";

    if (setupType.type.includes("continuation")) {
      // Add pullback before continuation
      const pullbackDir = setupType.type === "bullish_continuation" ? -0.0015 : 0.0015;
      candles.push(...this._trendCandles(price, phase2Length, pullbackDir, 0.01, 0.45));
      priorPattern = "Pullback";
    } else if (setupType.type.includes("reversal")) {
      // Add failed bounce/rejection
      if (setupType.type === "bullish_reversal") {
        candles.push(...this._failedRally(price, phase2Length));
        priorPattern = "Failed Rally";
      } else {
        candles.push(...this._failedDip(price, phase2Length));
        priorPattern = "Failed Dip";
      }
    } else if (setupType.type.includes("trap")) {
      // Add deceptive move
      candles.push(...this._rangeCandles(price, phase2Length, 0.008));
      priorPattern = "Choppy Range";
    } else {
      candles.push(...this._rangeCandles(price, phase2Length, 0.008));
      priorPattern = "Consolidation";
    }

    price = candles[candles.length - 1].close;

    // Phase 3: Compression (15% of context) - sets up the decision
    const phase3Length = Math.floor(contextSize * 0.15);
    candles.push(...this._compressionCandles(price, phase3Length, 0.006));

    return {
      candles,
      regime,
      bias,
      priorPattern,
    };
  }

  // Realistic trend candles - standard OHLC behavior
  _trendCandles(startPrice, count, drift, volatility, bullRatio) {
    const candles = [];
    let price = startPrice;

    for (let i = 0; i < count; i++) {
      const isBull = this.rng() < bullRatio;
      const bodyPercent = 0.4 + this.rng() * 0.4; // 40-80% of range
      const range = price * volatility;

      const open = price;
      price = price * (1 + drift + (this.rng() - 0.5) * volatility * 0.3);
      const close = isBull ? open + range * bodyPercent : open - range * bodyPercent;

      const high = Math.max(open, close) + range * (0.2 + this.rng() * 0.3);
      const low = Math.min(open, close) - range * (0.2 + this.rng() * 0.3);

      candles.push({ open, high, low, close });
      price = close;
    }

    return candles;
  }

  // Range-bound candles
  _rangeCandles(centerPrice, count, rangeSize) {
    const candles = [];
    const high = centerPrice * (1 + rangeSize);
    const low = centerPrice * (1 - rangeSize);
    let price = centerPrice;

    for (let i = 0; i < count; i++) {
      // Mean reversion
      if (price > high * 0.95) price *= 0.998;
      if (price < low * 1.05) price *= 1.002;

      const isBull = this.rng() < 0.5;
      const bodySize = price * rangeSize * (0.3 + this.rng() * 0.4);
      const wickSize = bodySize * (0.4 + this.rng() * 0.6);

      const open = price;
      const close = isBull ? open + bodySize : open - bodySize;
      const candleHigh = Math.max(open, close) + wickSize * this.rng();
      const candleLow = Math.min(open, close) - wickSize * this.rng();

      candles.push({
        open,
        high: Math.min(candleHigh, high),
        low: Math.max(candleLow, low),
        close,
      });

      price = close + (this.rng() - 0.5) * bodySize * 0.3;
    }

    return candles;
  }

  // Compression candles - decreasing range
  _compressionCandles(startPrice, count, baseVol) {
    const candles = [];
    let price = startPrice;

    for (let i = 0; i < count; i++) {
      const compressionFactor = 1 - (i / count) * 0.5; // Range decreases
      const isBull = this.rng() < 0.5;
      const bodySize = price * baseVol * compressionFactor * (0.3 + this.rng() * 0.4);
      const wickSize = bodySize * (0.4 + this.rng() * 0.6);

      const open = price;
      const close = isBull ? open + bodySize : open - bodySize;
      const high = Math.max(open, close) + wickSize * this.rng();
      const low = Math.min(open, close) - wickSize * this.rng();

      candles.push({ open, high, low, close });
      price = close + (this.rng() - 0.5) * bodySize * 0.2;
    }

    return candles;
  }

  // Failed rally (for bearish reversal context)
  _failedRally(startPrice, count) {
    const candles = [];
    let price = startPrice;

    // Rally up
    for (let i = 0; i < Math.floor(count * 0.6); i++) {
      const isBull = this.rng() < 0.65;
      const bodySize = price * 0.012 * (0.4 + this.rng() * 0.4);
      const wickSize = bodySize * (0.3 + this.rng() * 0.5);

      const open = price;
      price *= 1.002;
      const close = isBull ? open + bodySize : open - bodySize;
      const high = Math.max(open, close) + wickSize * this.rng();
      const low = Math.min(open, close) - wickSize * this.rng();

      candles.push({ open, high, low, close });
      price = close;
    }

    // Rejection
    for (let i = 0; i < Math.floor(count * 0.4); i++) {
      const isBull = this.rng() < 0.3;
      const bodySize = price * 0.012 * (0.4 + this.rng() * 0.5);
      const wickSize = bodySize * (0.4 + this.rng() * 0.7);

      const open = price;
      price *= 0.998;
      const close = isBull ? open + bodySize : open - bodySize;
      const high = Math.max(open, close) + wickSize * this.rng();
      const low = Math.min(open, close) - wickSize * this.rng();

      candles.push({ open, high, low, close });
      price = close;
    }

    return candles;
  }

  // Failed dip (for bullish reversal context)
  _failedDip(startPrice, count) {
    const candles = [];
    let price = startPrice;

    // Dip down
    for (let i = 0; i < Math.floor(count * 0.6); i++) {
      const isBull = this.rng() < 0.35;
      const bodySize = price * 0.012 * (0.4 + this.rng() * 0.4);
      const wickSize = bodySize * (0.3 + this.rng() * 0.5);

      const open = price;
      price *= 0.998;
      const close = isBull ? open + bodySize : open - bodySize;
      const high = Math.max(open, close) + wickSize * this.rng();
      const low = Math.min(open, close) - wickSize * this.rng();

      candles.push({ open, high, low, close });
      price = close;
    }

    // Bounce
    for (let i = 0; i < Math.floor(count * 0.4); i++) {
      const isBull = this.rng() < 0.7;
      const bodySize = price * 0.012 * (0.4 + this.rng() * 0.5);
      const wickSize = bodySize * (0.4 + this.rng() * 0.7);

      const open = price;
      price *= 1.002;
      const close = isBull ? open + bodySize : open - bodySize;
      const high = Math.max(open, close) + wickSize * this.rng();
      const low = Math.min(open, close) - wickSize * this.rng();

      candles.push({ open, high, low, close });
      price = close;
    }

    return candles;
  }

  _buildSetup(setupType, context) {
    const startPrice = context.candles[context.candles.length - 1].close;
    const candles = [];
    const setupLength = 8 + Math.floor(this.rng() * 6);

    if (setupType.type === "bullish_continuation") {
      // Bull flag: tight consolidation after context uptrend
      for (let i = 0; i < setupLength; i++) {
        const drift = -0.0003; // Slight drift down
        const vol = 0.006 * (1 - i / setupLength * 0.3); // Tightening
        const price = startPrice * (1 + drift * i);
        const isBull = this.rng() < 0.48;
        const bodySize = price * vol * (0.4 + this.rng() * 0.3);
        const wickSize = bodySize * (0.3 + this.rng() * 0.5);

        const open = price;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();

        candles.push({ open, high, low, close });
      }
    } else if (setupType.type === "bearish_continuation") {
      // Bear flag: tight consolidation after context downtrend
      for (let i = 0; i < setupLength; i++) {
        const drift = 0.0003; // Slight drift up
        const vol = 0.006 * (1 - i / setupLength * 0.3);
        const price = startPrice * (1 + drift * i);
        const isBull = this.rng() < 0.52;
        const bodySize = price * vol * (0.4 + this.rng() * 0.3);
        const wickSize = bodySize * (0.3 + this.rng() * 0.5);

        const open = price;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();

        candles.push({ open, high, low, close });
      }
    } else if (setupType.type === "bullish_reversal") {
      // Double bottom or inverted H&S
      let price = startPrice;
      // First bottom
      for (let i = 0; i < Math.floor(setupLength * 0.35); i++) {
        const isBull = this.rng() < 0.35;
        const bodySize = price * 0.01 * (0.4 + this.rng() * 0.4);
        const wickSize = bodySize * (0.4 + this.rng() * 0.6);
        const open = price;
        price *= 0.998;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();
        candles.push({ open, high, low, close });
        price = close;
      }
      // Bounce
      for (let i = 0; i < Math.floor(setupLength * 0.3); i++) {
        const isBull = this.rng() < 0.65;
        const bodySize = price * 0.01 * (0.4 + this.rng() * 0.4);
        const wickSize = bodySize * (0.3 + this.rng() * 0.5);
        const open = price;
        price *= 1.002;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();
        candles.push({ open, high, low, close });
        price = close;
      }
      // Second test
      for (let i = 0; i < Math.floor(setupLength * 0.35); i++) {
        const isBull = this.rng() < 0.5;
        const bodySize = price * 0.008 * (0.4 + this.rng() * 0.3);
        const wickSize = bodySize * (0.4 + this.rng() * 0.6);
        const open = price;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();
        candles.push({ open, high, low, close });
        price = close + (this.rng() - 0.5) * bodySize * 0.2;
      }
    } else if (setupType.type === "bearish_reversal") {
      // Double top or H&S
      let price = startPrice;
      // First top
      for (let i = 0; i < Math.floor(setupLength * 0.35); i++) {
        const isBull = this.rng() < 0.65;
        const bodySize = price * 0.01 * (0.4 + this.rng() * 0.4);
        const wickSize = bodySize * (0.4 + this.rng() * 0.6);
        const open = price;
        price *= 1.002;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();
        candles.push({ open, high, low, close });
        price = close;
      }
      // Dip
      for (let i = 0; i < Math.floor(setupLength * 0.3); i++) {
        const isBull = this.rng() < 0.35;
        const bodySize = price * 0.01 * (0.4 + this.rng() * 0.4);
        const wickSize = bodySize * (0.3 + this.rng() * 0.5);
        const open = price;
        price *= 0.998;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();
        candles.push({ open, high, low, close });
        price = close;
      }
      // Second top
      for (let i = 0; i < Math.floor(setupLength * 0.35); i++) {
        const isBull = this.rng() < 0.5;
        const bodySize = price * 0.008 * (0.4 + this.rng() * 0.3);
        const wickSize = bodySize * (0.4 + this.rng() * 0.6);
        const open = price;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();
        candles.push({ open, high, low, close });
        price = close + (this.rng() - 0.5) * bodySize * 0.2;
      }
    } else if (setupType.type.includes("trap") || setupType.type === "consolidation") {
      // Looks like a pattern but lacks conviction
      let price = startPrice;
      for (let i = 0; i < setupLength; i++) {
        const isBull = this.rng() < 0.5;
        const bodySize = price * 0.008 * (0.5 + this.rng() * 0.5);
        const wickSize = bodySize * (0.5 + this.rng() * 0.8); // Larger wicks = indecision
        const open = price;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();
        candles.push({ open, high, low, close });
        price = close + (this.rng() - 0.5) * bodySize * 0.4;
      }
    }

    return candles;
  }

  _generateContinuation(signal, setupType, allCandles) {
    const lastPrice = allCandles[allCandles.length - 1].close;
    const candles = [];
    const length = 10 + Math.floor(this.rng() * 4);
    let price = lastPrice;

    if (signal === "BUY" && setupType.willSucceed) {
      // Strong bullish continuation
      for (let i = 0; i < length; i++) {
        const drift = 0.004 + this.rng() * 0.002;
        const vol = 0.012;
        const isBull = this.rng() < 0.75;
        const bodySize = price * vol * (0.5 + this.rng() * 0.4);
        const wickSize = bodySize * (0.2 + this.rng() * 0.4);

        const open = price;
        price *= 1 + drift;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();

        candles.push({ open, high, low, close });
        price = close;
      }
    } else if (signal === "SELL" && setupType.willSucceed) {
      // Strong bearish continuation
      for (let i = 0; i < length; i++) {
        const drift = -0.004 - this.rng() * 0.002;
        const vol = 0.012;
        const isBull = this.rng() < 0.25;
        const bodySize = price * vol * (0.5 + this.rng() * 0.4);
        const wickSize = bodySize * (0.2 + this.rng() * 0.4);

        const open = price;
        price *= 1 + drift;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();

        candles.push({ open, high, low, close });
        price = close;
      }
    } else {
      // HOLD / failed pattern - choppy or weak continuation
      for (let i = 0; i < length; i++) {
        const drift = (this.rng() - 0.5) * 0.002;
        const vol = 0.01;
        const isBull = this.rng() < 0.5;
        const bodySize = price * vol * (0.3 + this.rng() * 0.4);
        const wickSize = bodySize * (0.4 + this.rng() * 0.7);

        const open = price;
        price *= 1 + drift;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();

        candles.push({ open, high, low, close });
        price = close;
      }
    }

    return {
      candles,
      signal,
      pattern: setupType.name,
      succeeded: setupType.willSucceed,
    };
  }


}

    /* ═══════════════════════════════════════════════════════════════
      5. CHART RENDERER

      Mobile-first, structure-preserving chart renderer – improved for mobile
      2025–2026 finomhangolás: jobb olvashatóság, több gyertya mobilon
      ═══════════════════════════════════════════════════════════════ */

    class ChartRenderer {
      constructor(canvas, config) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.config = config;
      }

      isMobile(width) {
        return width < 520;
      }

      setDimensions(width) {
        const dpr = window.devicePixelRatio || 1;
        const mobile = this.isMobile(width);

        // taller canvas on mobile
        const height = mobile
          ? Math.floor(window.innerHeight * 0.65)
          : 440;

        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        this.ctx = this.canvas.getContext("2d");
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      renderAll(allCandles) {
        const ctx = this.ctx;
        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;

        ctx.clearRect(0, 0, width, height);
        if (!allCandles || allCandles.length === 0) return;

        /* ───────── PLATFORM LOGIC ───────── */
        const mobile = this.isMobile(width);
        const MAX_VISIBLE = mobile ? 32 : 36;           // több gyertya mobilon

        const startIdx = Math.max(0, allCandles.length - MAX_VISIBLE);
        const visible = allCandles.slice(startIdx);

        /* ───────── Y SCALE (STABLE, VISIBLE ONLY) ───────── */
        let minPrice = Infinity;
        let maxPrice = -Infinity;

        const SCALE_LOOKBACK = mobile ? 16 : 6;         // hosszabb lookback mobilon → nyugodtabb skála
        const scaleSource = allCandles.slice(
          Math.max(0, startIdx - SCALE_LOOKBACK),
          startIdx + visible.length
        );

        scaleSource.forEach(c => {
          minPrice = Math.min(minPrice, c.low);
          maxPrice = Math.max(maxPrice, c.high);
        });

        let range = maxPrice - minPrice || 1;

        // prevent micro-compression on mobile
        const MIN_RANGE = mobile ? 4 : 3;
        if (range < MIN_RANGE) {
          const pad = (MIN_RANGE - range) / 2;
          minPrice -= pad;
          maxPrice += pad;
          range = maxPrice - minPrice;
        }

        const pad = mobile ? 0.08 : 0.06;
        minPrice -= range * pad;
        maxPrice += range * pad;

        const toY = price =>
          height - 50 - ((price - minPrice) / (maxPrice - minPrice)) * (height - 90);

        /* ───────── LAYOUT ───────── */
        const gap = mobile ? 2 : 2;
        const leftPadding  = mobile ? 16 : 30;
        const rightPadding = mobile ? 80 : 30;          // hely a price pill-nek

        const bodyWidth = mobile
          ? Math.max(6, Math.floor((width - leftPadding - rightPadding) / MAX_VISIBLE) - gap)
          : 8;

        const slotWidth = bodyWidth + gap;

        /* ───────── GRID ───────── */
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const y = 50 + (i / 4) * (height - 100);
          ctx.beginPath();
          ctx.moveTo(leftPadding, y);
          ctx.lineTo(width - rightPadding + 10, y);
          ctx.stroke();
        }

        /* ───────── PRICE LABELS ───────── */
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.font = mobile
          ? "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          : "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        for (let i = 0; i < 5; i++) {
          const price = minPrice + (i / 4) * (maxPrice - minPrice);
          ctx.fillText(price.toFixed(0), width - rightPadding + 10, toY(price));
        }

        /* ───────── LAST PRICE PILL ───────── */
        const last = visible.at(-1);
        if (last) {
          const y = toY(last.close);
          const col = last.close >= last.open ? C.bull : C.bear;

          const w = mobile ? 64 : 62;
          const h = mobile ? 30 : 28;

          ctx.save();
          ctx.fillStyle = "rgba(10,10,18,0.95)";
          ctx.beginPath();
          ctx.roundRect(width - w - 8, y - h / 2, w, h, 14);
          ctx.fill();

          ctx.strokeStyle = col + "30";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = col;
          ctx.font = mobile
            ? "600 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            : "600 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
          ctx.fillText(last.close.toFixed(2), width - 18, y + 5);
          ctx.restore();
        }

        /* ───────── CANDLES ───────── */
        visible.forEach((c, i) => {
          const x = leftPadding + i * slotWidth + gap / 2;
          const bull = c.close >= c.open;
          const col = bull ? C.bull : C.bear;

          ctx.save();

          // Wick
          ctx.strokeStyle = col;
          ctx.lineWidth = mobile ? 1.8 : 1.5;           // vékonyabb wick mobilon
          ctx.beginPath();
          ctx.moveTo(x + bodyWidth / 2, toY(c.high));
          ctx.lineTo(x + bodyWidth / 2, toY(c.low));
          ctx.stroke();

          // Body
          const top = toY(Math.max(c.open, c.close));
          const bot = toY(Math.min(c.open, c.close));
          const h = Math.max(bot - top, mobile ? 4 : 2);

          const grad = ctx.createLinearGradient(x, top, x, top + h);
          grad.addColorStop(0, col + "f0");
          grad.addColorStop(1, col + "b8");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, top, bodyWidth, h, mobile ? 2 : 1.5);
          ctx.fill();

          ctx.strokeStyle = col;
          ctx.lineWidth = mobile ? 1.5 : 1;             // vékonyabb body outline
          ctx.stroke();

          ctx.restore();
        });

        /* ───────── AMBIENT LIGHT ───────── */
        const glow = ctx.createRadialGradient(
          width * 0.5, height * 0.3, 0,
          width * 0.5, height * 0.3, width * 0.6
        );
        glow.addColorStop(0, "rgba(0,255,170,0.02)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

        /* ───────── DEBUG INFO ───────── */
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#fff";
        ctx.font = "10px monospace";
        ctx.fillText(
          `${visible.length}/${allCandles.length} candles`,
          10,
          height - 10
        );
        ctx.globalAlpha = 1;
      }

      // Backward compatibility
      render(allCandles, windowStart, windowSize) {
        this.renderAll(allCandles.slice(windowStart, windowStart + windowSize));
      }

      renderContinuation(allCandles, windowStart, windowSize, continuation, progress) {
        const count = Math.floor(progress * continuation.length);
        this.renderAll([...allCandles, ...continuation.slice(0, count)]);
      }
    }
/* ═══════════════════════════════════════════════════════════════
    6  UI COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

const GlassPanel = ({ children, style, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: C.glass,
      border: `1px solid ${C.glassBr}`,
      borderRadius: 18,
      backdropFilter: "blur(20px)",
      padding: "12px 16px",
      ...style,
    }}
  >
    {children}
  </div>
);

const GlassButton = ({ children, onClick, color, disabled, style }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      background: disabled ? C.glass : `linear-gradient(135deg, ${color}22, ${color}11)`,
      border: `1.5px solid ${disabled ? C.glassBr : color}55`,
      borderRadius: 16,
      padding: "12px 24px",
      color: disabled ? "rgba(255,255,255,0.3)" : "#fff",
      fontSize: 14,
      fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      backdropFilter: "blur(16px)",
      transition: "all 0.2s",
      ...style,
    }}
    onMouseEnter={(e) => {
      if (!disabled) {
        e.target.style.transform = "translateY(-1px)";
        e.target.style.boxShadow = `0 6px 20px ${color}33`;
      }
    }}
    onMouseLeave={(e) => {
      if (!disabled) {
        e.target.style.transform = "translateY(0)";
        e.target.style.boxShadow = "none";
      }
    }}
  >
    {children}
  </button>
);

const TimerBar = ({ timeLeft, totalTime }) => {
  const pct = (timeLeft / totalTime) * 100;
  const isLow = pct < 30;
  return (
    <div
      style={{
        height: 6,
        background: C.glass,
        borderRadius: 8,
        overflow: "hidden",
        border: `1px solid ${C.glassBr}`,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: isLow
            ? `linear-gradient(90deg, ${C.nPink}, ${C.bear})`
            : `linear-gradient(90deg, ${C.nGreen}, ${C.nBlue})`,
          transition: "width 0.1s linear",
          boxShadow: isLow ? `0 0 12px ${C.nPink}88` : `0 0 12px ${C.nGreen}55`,
        }}
      />
    </div>
  );
};

const DecisionButtons = ({ onChoose, disabled }) => (
  <div style={{ display: "flex", gap: 10 }}>
    <GlassButton
      onClick={() => onChoose("BUY")}
      disabled={disabled}
      color={C.bull}
      style={{ flex: 1, fontSize: 16, padding: "16px 0" }}
    >
      📈 BUY
    </GlassButton>
    <GlassButton
      onClick={() => onChoose("HOLD")}
      disabled={disabled}
      color={C.neut}
      style={{ flex: 1, fontSize: 16, padding: "16px 0" }}
    >
      ⏸️ HOLD
    </GlassButton>
    <GlassButton
      onClick={() => onChoose("SELL")}
      disabled={disabled}
      color={C.bear}
      style={{ flex: 1, fontSize: 16, padding: "16px 0" }}
    >
      📉 SELL
    </GlassButton>
  </div>
);

const OutcomeCard = ({ correct, points, streak, patternName, choice, signal, onNext, context }) => (
  <GlassPanel style={{ padding: "16px 20px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
      <div
        style={{
          fontSize: 32,
          width: 50,
          height: 50,
          borderRadius: "50%",
          background: correct
            ? `radial-gradient(circle, ${C.nGreen}33, transparent)`
            : `radial-gradient(circle, ${C.nPink}33, transparent)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {correct ? "✓" : "✗"}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: correct ? C.nGreen : C.nPink,
            marginBottom: 2,
          }}
        >
          {correct ? "Correct!" : "Incorrect"}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>
          You chose {choice} • Signal was {signal}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", color: C.nGreen }}>
          +{points}
        </div>
        {streak > 0 && (
          <div style={{ fontSize: 11, color: C.nPurple }}>🔥 {streak} streak</div>
        )}
      </div>
    </div>

    {/* Context explanation */}
    {context && (
      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.6)",
          marginBottom: 12,
          padding: "10px 12px",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 10,
          borderLeft: `3px solid ${correct ? C.nGreen : C.nPink}55`,
        }}
      >
        <div style={{ marginBottom: 6, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>
          {correct ? "Why it worked:" : "Why it failed:"}
        </div>
        {correct ? (
          <div>
            • Pattern confirmed with strong follow-through
            <br />• {context.trendBias} trend bias supported the move
            <br />• {context.volatility} volatility allowed clean development
          </div>
        ) : (
          <div>
            {signal === "HOLD" ? (
              <>
                • Pattern lacked confirmation or clear direction
                <br />• Patience rewarded - no clear edge to trade
                <br />• Context suggested waiting for better setup
              </>
            ) : (
              <>
                • Pattern failed to follow through as expected
                <br />• Context ({context.trendBias} bias) conflicted with setup
                <br />• Better to avoid low-quality setups
              </>
            )}
          </div>
        )}
      </div>
    )}

    <GlassButton onClick={onNext} color={C.nBlue} style={{ width: "100%", padding: "14px 0" }}>
      Next Round →
    </GlassButton>
  </GlassPanel>
);

const FinalVerdict = ({ stats, onRestart, onLeaderboard }) => (
  <GlassPanel style={{ padding: "24px 20px", textAlign: "center" }}>
    <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Game Complete!</div>
    <div
      style={{
        fontSize: 48,
        fontWeight: 900,
        fontFamily: "monospace",
        background: `linear-gradient(135deg, ${C.nGreen}, ${C.nPurple})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        marginBottom: 20,
      }}
    >
      {stats.totalScore.toLocaleString()}
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
          ACCURACY
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.nGreen }}>
          {stats.accuracy}%
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
          CORRECT
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.nBlue }}>
          {stats.correct}/{stats.total}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
          BEST STREAK
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.nPurple }}>
          {stats.bestStreak}
        </div>
      </div>
    </div>

    <div style={{ display: "flex", gap: 10 }}>
      <GlassButton onClick={onRestart} color={C.nGreen} style={{ flex: 1, padding: "14px 0" }}>
        Play Again
      </GlassButton>
      <GlassButton onClick={onLeaderboard} color={C.nBlue} style={{ flex: 1, padding: "14px 0" }}>
        Leaderboard
      </GlassButton>
    </div>
  </GlassPanel>
);

/* ═══════════════════════════════════════════════════════════════
    7  MAIN APP COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function App() {
  // ── State ──
  const [screen, setScreen] = useState("home");
  const [difficulty, setDifficulty] = useState("medium");
  const [round, setRound] = useState(0);
  const [scores, setScores] = useState([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [roundStats, setRoundStats] = useState([]);
  const [timeLeft, setTimeLeft] = useState(DECISION_MS);
  const [choice, setChoice] = useState(null);
  const [structure, setStructure] = useState(null);
  const [windowStart, setWindowStart] = useState(0);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownNum, setCountdownNum] = useState(3);
  const [revealProgress, setRevealProgress] = useState(0);

  // ── Refs ──
  const chartRef = useRef(null);
  const rendererRef = useRef(null);
  const timerRef = useRef(null);
  const animFrameRef = useRef(null);

  // ── Initialize renderer ──
  useEffect(() => {
    if (chartRef.current) {
      rendererRef.current = new ChartRenderer(
        chartRef.current,
        DIFFICULTY_CONFIG[difficulty]
      );
      const updateSize = () => {
        const rect = chartRef.current.getBoundingClientRect();
        rendererRef.current.setDimensions(rect.width, rect.height);
      };
      updateSize();
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }
  }, [difficulty]);

  // ── Initialize round ──
  const initializeRound = useCallback(
    (roundNum) => {
      const generator = new MarketStructureGenerator(difficulty);
      generator.seed(Date.now() + roundNum * 12345);
      const newStructure = generator.generate();

      setStructure(newStructure);
      setRound(roundNum);
      setChoice(null);
      setTimeLeft(DECISION_MS);
      setScreen("building");
      setRevealProgress(0);

      // Smooth scrolling reveal animation
      let progress = 0;
      const duration = 2500; // 2.5 seconds to build full context
      const startTime = Date.now();

      const animateScroll = () => {
        const elapsed = Date.now() - startTime;
        progress = Math.min(1, elapsed / duration);
        
        // Ease out curve for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentCandle = Math.floor(eased * newStructure.decisionIndex);
        setWindowStart(currentCandle);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animateScroll);
        } else {
          // Scrolling complete - pause at decision point
          setScreen("playing");

          // Start decision timer
          const timerStart = Date.now();
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            const timerElapsed = Date.now() - timerStart;
            const remaining = Math.max(0, DECISION_MS - timerElapsed);
            setTimeLeft(remaining);

            if (remaining === 0) {
              clearInterval(timerRef.current);
              // Call handleChoice directly - will be available in scope
              handleChoice("TIMEOUT");
            }
          }, 50);
        }
      };

      animateScroll();
    },
    [difficulty] // Don't include handleChoice - causes circular dependency
  );

  // ── Start new game ──
  const startGame = useCallback(() => {
    sound.unlock();
    
    // Cleanup any running timers/animations
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    
    // Reset all game state
    setRound(0);
    setScores([]);
    setStreak(0);
    setBestStreak(0);
    setRoundStats([]);
    setChoice(null);
    setStructure(null);
    setWindowStart(0);
    setRevealProgress(0);
    
    // Start countdown
    setShowCountdown(true);
    setCountdownNum(3);

    let count = 3;
    const countInterval = setInterval(() => {
      if (count === 1) {
        clearInterval(countInterval);
        sound.tick(1);
        setTimeout(() => {
          setShowCountdown(false);
          initializeRound(0);
        }, 300);
      } else {
        sound.tick(count);
        count--;
        setCountdownNum(count);
      }
    }, 1000);
  }, [initializeRound]);

  // ── Handle user choice ──
  const handleChoice = useCallback(
    (userChoice) => {
      if (timerRef.current) clearInterval(timerRef.current);
      haptic([30, 20, 30]);
      sound.click();

      setChoice(userChoice);
      setScreen("revealing");

      // Animate continuation reveal
      let progress = 0;
      const animate = () => {
        progress += 0.02;
        setRevealProgress(progress);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Reveal complete - show outcome
          const correct =
            userChoice === structure.signal || (userChoice === "TIMEOUT" && structure.signal === "HOLD");
          const newStreak = correct ? streak + 1 : 0;
          const multiplier = STREAK_MULT[Math.min(newStreak, STREAK_MULT.length - 1)];
          const points = correct ? Math.round(BASE_SCORE * multiplier) : 0;

          setStreak(newStreak);
          setBestStreak(Math.max(bestStreak, newStreak));
          setScores([...scores, points]);
          setRoundStats([...roundStats, { correct, choice: userChoice }]);

          if (correct) sound.correct();
          else sound.wrong();

          setScreen("outcome");
        }
      };
      animate();
    },
    [structure, streak, bestStreak, scores, roundStats]
  );

  // ── Advance to next round ──
  const advanceRound = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (round + 1 >= ROUNDS) {
      setScreen("verdict");
    } else {
      initializeRound(round + 1);
    }
  }, [round, initializeRound]);

    // Throttle segédfüggvény (lodash nélkül, egyszerű implementáció)
    const throttle = (func, limit) => {
      let inThrottle;
      return function (...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => (inThrottle = false), limit);
        }
      };
    };

    // ── Render chart ──
    useEffect(() => {
      if (!chartRef.current || !structure) return;

      // Ensure renderer is initialized
      if (!rendererRef.current) {
        rendererRef.current = new ChartRenderer(
          chartRef.current,
          DIFFICULTY_CONFIG[difficulty]
        );
        const rect = chartRef.current.getBoundingClientRect();
        rendererRef.current.setDimensions(rect.width, rect.height);
      }

      const isMobile = window.innerWidth < 520;
      const throttleDelay = isMobile ? 800 : 120;  // mobilon 400 ms → kb. 2.5 fps

      const throttledRender = throttle((candles) => {
        if (rendererRef.current) {
          rendererRef.current.renderAll(candles);
        }
      }, throttleDelay);

      if (screen === "building" || screen === "playing") {
        const visibleCandles = structure.candles.slice(0, windowStart + 1);
        throttledRender(visibleCandles);
      } else if (screen === "revealing" || screen === "outcome") {
        const baseCandles = structure.candles.slice(0, structure.decisionIndex + 1);
        const contCount = Math.floor(revealProgress * structure.continuation.candles.length);
        const allCandles = [...baseCandles, ...structure.continuation.candles.slice(0, contCount)];
        throttledRender(allCandles);
      }

    }, [structure, windowStart, difficulty, screen, revealProgress]);

  // ── Compute stats ──
  const computeStats = useCallback(() => {
    const totalScore = scores.reduce((a, b) => a + b, 0);
    const correct = roundStats.filter((r) => r.correct).length;
    const total = roundStats.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    return { totalScore, correct, total, accuracy, bestStreak };
  }, [scores, roundStats, bestStreak]);

  // ── Home screen ──
  const renderHome = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100dvh - 80px)",
        padding: "20px",
        gap: 20,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            background: `linear-gradient(135deg, ${C.nGreen}, ${C.nPurple}, ${C.nPink})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 8,
            lineHeight: 1,
          }}
        >
          REFLEX GLASS
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em" }}>
          Context-Aware Pattern Trainer
        </div>
      </div>

      <GlassPanel style={{ padding: "20px", maxWidth: 380 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
          Master pattern recognition in realistic market conditions. Learn when to trade and when
          to wait. Focus on context, not memorization.
        </div>
      </GlassPanel>

      {/* Difficulty selector */}
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Select Difficulty
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["easy", "medium", "hard"].map((d) => (
            <GlassButton
              key={d}
              onClick={() => setDifficulty(d)}
              color={difficulty === d ? C.nGreen : C.glassBr}
              style={{
                flex: 1,
                padding: "12px 0",
                background:
                  difficulty === d
                    ? `linear-gradient(135deg, ${C.nGreen}33, ${C.nGreen}11)`
                    : C.glass,
                border: `1.5px solid ${difficulty === d ? C.nGreen : C.glassBr}`,
              }}
            >
              {d.toUpperCase()}
            </GlassButton>
          ))}
        </div>
      </div>

      <GlassButton
        onClick={startGame}
        color={C.nGreen}
        style={{ padding: "18px 56px", fontSize: 18, position: "relative", overflow: "hidden" }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
            backgroundSize: "200% 100%",
            animation: "shimmer 2.2s linear infinite",
            pointerEvents: "none",
          }}
        />
        Start Training
      </GlassButton>

      <div
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.22)",
          fontFamily: "monospace",
          textAlign: "center",
          maxWidth: 300,
        }}
      >
        Learn when NOT to trade • {ROUNDS} rounds • Context matters
      </div>
    </div>
  );

  // ── Playing screen ──
  const renderPlaying = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: 8,
        padding: "8px 10px",
      }}
    >
      {/* Header - more compact on mobile */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <GlassPanel style={{ padding: "5px 12px", borderRadius: 14 }}>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }}>
            Round{" "}
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "monospace", color: C.nGreen }}>
            {round + 1}
            <span style={{ color: "rgba(255,255,255,0.28)", fontWeight: 400 }}>/{ROUNDS}</span>
          </span>
        </GlassPanel>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {screen === "building" && (
            <GlassPanel style={{ padding: "4px 10px", borderRadius: 14, border: `1px solid ${C.nBlue}35` }}>
              <span style={{ fontSize: 11, fontFamily: "monospace", color: C.nBlue }}>
                📊 Building...
              </span>
            </GlassPanel>
          )}
          {streak > 0 && screen !== "building" && (
            <GlassPanel style={{ padding: "4px 10px", borderRadius: 14, border: `1px solid ${C.nPurple}35` }}>
              <span style={{ fontSize: 11, fontFamily: "monospace", color: C.nPurple }}>
                🔥 ×{STREAK_MULT[Math.min(streak, STREAK_MULT.length - 1)].toFixed(1)}
              </span>
            </GlassPanel>
          )}
        </div>
      </div>

      {/* Timer - only show when playing, more compact */}
      {screen === "playing" && (
        <div style={{ flexShrink: 0 }}>
          <TimerBar timeLeft={timeLeft} totalTime={DECISION_MS} />
        </div>
      )}

      {/* Chart - MUCH BIGGER on mobile */}
      <div style={{ 
        flex: 1, 
        minHeight: 0, 
        position: "relative",
        minHeight: "50vh" // Force minimum height for mobile
      }}>
        <canvas
          ref={chartRef}
          style={{ width: "100%", height: "100%", borderRadius: 16, display: "block" }}
        />
        {screen === "outcome" && structure && (
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 12,
              fontSize: 9,
              fontFamily: "monospace",
              color: "rgba(255,255,255,0.18)",
              background: "rgba(6,6,12,0.6)",
              padding: "3px 7px",
              borderRadius: 6,
              backdropFilter: "blur(8px)",
            }}
          >
            {structure.continuation.pattern}
          </div>
        )}
      </div>

      {/* Decision / Outcome - compact */}
      <div style={{ paddingBottom: 6, flexShrink: 0 }}>
        {screen === "building" && (
          <div style={{ textAlign: "center", padding: "12px", color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
            Watching market develop...
          </div>
        )}
        {screen === "playing" && <DecisionButtons onChoose={handleChoice} disabled={false} />}
        {screen === "outcome" && (
          <OutcomeCard
            correct={roundStats[roundStats.length - 1]?.correct}
            points={scores[scores.length - 1]}
            streak={streak}
            patternName={structure?.continuation.pattern}
            choice={choice}
            signal={structure?.signal}
            onNext={advanceRound}
            context={structure?.context}
          />
        )}
      </div>
    </div>
  );

  // ── Verdict screen ──
  const renderVerdict = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        padding: 16,
        gap: 14,
      }}
    >
      <FinalVerdict
        stats={computeStats()}
        onRestart={startGame}
        onLeaderboard={() => setScreen("leaderboard")}
      />
    </div>
  );

  // ── Countdown overlay ──
  const renderCountdown = () => (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: `radial-gradient(ellipse at 50% 50%, ${C.bg2}dd 0%, ${C.bg1}f5 100%)`,
        backdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.nGreen}25 0%, transparent 70%)`,
          filter: "blur(80px)",
          animation: "pulse 1s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 280,
          height: 280,
          borderRadius: "50%",
          border: `6px solid ${C.nGreen}50`,
          animation: "ringPulse 1s ease-out infinite",
        }}
      />
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
          lineHeight: 1,
        }}
      >
        {countdownNum}
      </div>
    </div>
  );

  // ── Main render ──
  return (
    <div
      style={{
        width: "100vw",
        height: "100dvh",
        overflowY: "auto",
        overflowX: "hidden",
        background: `radial-gradient(ellipse at 30% 20%, #0f1a2e 0%, ${C.bg1} 55%, ${C.bg2} 100%)`,
        position: "relative",
      }}
    >
      {/* Ambient orbs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "15%",
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${C.nGreen}0a 0%, transparent 70%)`,
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "60%",
            right: "10%",
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${C.nPurple}0d 0%, transparent 70%)`,
            filter: "blur(36px)",
          }}
        />
      </div>

      {/* Main content */}
      <div style={{ position: "relative", zIndex: 1, minHeight: "100dvh" }}>
        {screen === "home" && renderHome()}
        {(screen === "building" || screen === "playing" || screen === "revealing" || screen === "outcome") &&
          renderPlaying()}
        {screen === "verdict" && renderVerdict()}
      </div>

      {/* Countdown overlay */}
      {showCountdown && renderCountdown()}

      {/* Animations */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        @keyframes ringPulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.15); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
