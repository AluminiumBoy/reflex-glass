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
  generate() {
    const { contextSize } = this.config;
    const totalCandles = contextSize + 15; // Extra for continuation

    // Choose overall market regime
    const regime = this._pickRegime();

    // Build the structure in phases
    const phases = this._buildPhases(regime, totalCandles);

    // Generate candles from phases
    const candles = this._generateCandles(phases);

    // Identify decision point
    const decisionIndex = this._findDecisionPoint(candles, phases);

    // Determine correct answer based on what happens next
    const continuation = this._generateContinuation(candles, phases, decisionIndex);

    // Package everything
    return {
      candles,
      decisionIndex,
      continuation,
      signal: continuation.signal,
      context: this._analyzeContext(candles, decisionIndex, phases),
      pattern: continuation.pattern,
      regime,
    };
  }

  _pickRegime() {
    const r = this.rng();
    if (r < 0.25) return "uptrend";
    if (r < 0.5) return "downtrend";
    if (r < 0.75) return "range";
    return "transition";
  }

  _buildPhases(regime, totalCandles) {
    const phases = [];
    let currentIndex = 0;

    // Build context phases
    if (regime === "uptrend") {
      phases.push({
        type: "trend",
        direction: "up",
        start: currentIndex,
        length: Math.floor(20 + this.rng() * 15),
        volatility: 0.015 + this.rng() * 0.01,
      });
      currentIndex += phases[phases.length - 1].length;

      // Add pullback or consolidation
      if (this.rng() < 0.7) {
        phases.push({
          type: "pullback",
          direction: "down",
          start: currentIndex,
          length: Math.floor(8 + this.rng() * 10),
          volatility: 0.012 + this.rng() * 0.008,
        });
        currentIndex += phases[phases.length - 1].length;
      }

      // Setup phase (where decision happens)
      phases.push({
        type: "setup",
        subtype: this._pickSetupType("bullish"),
        start: currentIndex,
        length: Math.floor(12 + this.rng() * 8),
        volatility: 0.01 + this.rng() * 0.008,
      });
    } else if (regime === "downtrend") {
      phases.push({
        type: "trend",
        direction: "down",
        start: currentIndex,
        length: Math.floor(20 + this.rng() * 15),
        volatility: 0.018 + this.rng() * 0.012,
      });
      currentIndex += phases[phases.length - 1].length;

      // Rally
      if (this.rng() < 0.7) {
        phases.push({
          type: "rally",
          direction: "up",
          start: currentIndex,
          length: Math.floor(8 + this.rng() * 10),
          volatility: 0.015 + this.rng() * 0.01,
        });
        currentIndex += phases[phases.length - 1].length;
      }

      // Setup phase
      phases.push({
        type: "setup",
        subtype: this._pickSetupType("bearish"),
        start: currentIndex,
        length: Math.floor(12 + this.rng() * 8),
        volatility: 0.012 + this.rng() * 0.01,
      });
    } else if (regime === "range") {
      // Establish range
      phases.push({
        type: "range",
        start: currentIndex,
        length: Math.floor(25 + this.rng() * 20),
        volatility: 0.01 + this.rng() * 0.008,
      });
      currentIndex += phases[phases.length - 1].length;

      // Setup near edge
      phases.push({
        type: "setup",
        subtype: this._pickSetupType("neutral"),
        start: currentIndex,
        length: Math.floor(10 + this.rng() * 8),
        volatility: 0.008 + this.rng() * 0.006,
      });
    } else {
      // Transition: trend → opposite trend
      const initialDir = this.rng() < 0.5 ? "up" : "down";
      phases.push({
        type: "trend",
        direction: initialDir,
        start: currentIndex,
        length: Math.floor(15 + this.rng() * 12),
        volatility: 0.015 + this.rng() * 0.01,
      });
      currentIndex += phases[phases.length - 1].length;

      // Transition zone
      phases.push({
        type: "transition",
        start: currentIndex,
        length: Math.floor(12 + this.rng() * 10),
        volatility: 0.01 + this.rng() * 0.008,
      });
      currentIndex += phases[phases.length - 1].length;

      // New trend hint
      phases.push({
        type: "setup",
        subtype: this._pickSetupType(initialDir === "up" ? "bearish" : "bullish"),
        start: currentIndex,
        length: Math.floor(10 + this.rng() * 8),
        volatility: 0.012 + this.rng() * 0.01,
      });
    }

    return phases;
  }

  _pickSetupType(bias) {
    const { cleanRatio } = this.config;
    const isClean = this.rng() < cleanRatio;

    const bullishSetups = [
      "bull_flag",
      "ascending_triangle",
      "double_bottom",
      "inverse_head_shoulders",
      "cup_handle",
    ];
    const bearishSetups = [
      "bear_flag",
      "descending_triangle",
      "double_top",
      "head_shoulders",
      "rising_wedge",
    ];
    const neutralSetups = ["symmetrical_triangle", "range_compression", "coil"];
    const failedSetups = [
      "failed_breakout",
      "bull_trap",
      "bear_trap",
      "exhaustion",
      "false_reversal",
    ];

    let pool = [];
    if (bias === "bullish") {
      pool = isClean ? bullishSetups : [...bullishSetups, ...failedSetups];
    } else if (bias === "bearish") {
      pool = isClean ? bearishSetups : [...bearishSetups, ...failedSetups];
    } else {
      pool = isClean
        ? neutralSetups
        : [...neutralSetups, ...failedSetups, ...bullishSetups, ...bearishSetups];
    }

    return pool[Math.floor(this.rng() * pool.length)];
  }

  _generateCandles(phases) {
    const candles = [];
    let currentPrice = 10000 + this.rng() * 5000; // Start somewhere in middle

    for (const phase of phases) {
      const phaseCandles = this._generatePhaseCandles(
        phase,
        currentPrice,
        phase.length
      );
      candles.push(...phaseCandles);
      currentPrice = phaseCandles[phaseCandles.length - 1].close;
    }

    return candles;
  }

  _generatePhaseCandles(phase, startPrice, count) {
    const candles = [];
    let price = startPrice;
    const vol = phase.volatility;

    if (phase.type === "trend") {
      const drift = phase.direction === "up" ? 0.003 : -0.003;
      for (let i = 0; i < count; i++) {
        const bodySize = vol * price * (0.3 + this.rng() * 0.7);
        const wickSize = bodySize * (0.2 + this.rng() * 0.8);
        const isGreen = this.rng() < (phase.direction === "up" ? 0.65 : 0.35);

        price *= 1 + drift + (this.rng() - 0.5) * vol * 0.5;

        const open = price;
        const close = isGreen ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();

        candles.push({ open, high, low, close });
      }
    } else if (phase.type === "pullback" || phase.type === "rally") {
      const drift = phase.direction === "up" ? 0.0015 : -0.0015;
      for (let i = 0; i < count; i++) {
        const bodySize = vol * price * (0.4 + this.rng() * 0.6);
        const wickSize = bodySize * (0.3 + this.rng() * 0.7);
        const isGreen = this.rng() < (phase.direction === "up" ? 0.55 : 0.45);

        price *= 1 + drift + (this.rng() - 0.5) * vol;

        const open = price;
        const close = isGreen ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();

        candles.push({ open, high, low, close });
      }
    } else if (phase.type === "range") {
      const rangeHigh = price * (1 + vol * 3);
      const rangeLow = price * (1 - vol * 3);
      for (let i = 0; i < count; i++) {
        // Mean reversion
        if (price > rangeHigh * 0.95) price *= 0.998;
        if (price < rangeLow * 1.05) price *= 1.002;

        const bodySize = vol * price * (0.3 + this.rng() * 0.5);
        const wickSize = bodySize * (0.4 + this.rng() * 0.8);
        const isGreen = this.rng() < 0.5;

        price += (this.rng() - 0.5) * vol * price * 0.3;
        price = Math.max(rangeLow, Math.min(rangeHigh, price));

        const open = price;
        const close = isGreen ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();

        candles.push({ open, high, low, close });
      }
    } else if (phase.type === "setup") {
      // Pattern-specific generation
      const patternCandles = this._generatePatternCandles(
        phase.subtype,
        price,
        count,
        vol
      );
      candles.push(...patternCandles);
    } else if (phase.type === "transition") {
      // Choppy, uncertain
      for (let i = 0; i < count; i++) {
        const bodySize = vol * price * (0.5 + this.rng() * 0.8);
        const wickSize = bodySize * (0.5 + this.rng() * 1.0);
        const isGreen = this.rng() < 0.5;

        price += (this.rng() - 0.5) * vol * price * 2;

        const open = price;
        const close = isGreen ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();

        candles.push({ open, high, low, close });
      }
    }

    return candles;
  }

  _generatePatternCandles(subtype, startPrice, count, vol) {
    const candles = [];
    let price = startPrice;

    // Simplified pattern generation (can be expanded)
    if (subtype === "bull_flag") {
      // Strong move up, then tight consolidation
      for (let i = 0; i < count; i++) {
        const isEarly = i < count * 0.4;
        const drift = isEarly ? 0.004 : -0.0005;
        const localVol = isEarly ? vol : vol * 0.6;

        const bodySize = localVol * price * (0.3 + this.rng() * 0.5);
        const wickSize = bodySize * (0.2 + this.rng() * 0.6);
        const isGreen = this.rng() < (isEarly ? 0.7 : 0.45);

        price *= 1 + drift + (this.rng() - 0.5) * localVol * 0.5;

        const open = price;
        const close = isGreen ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();

        candles.push({ open, high, low, close });
      }
    } else if (subtype === "bear_flag") {
      // Strong move down, then tight consolidation
      for (let i = 0; i < count; i++) {
        const isEarly = i < count * 0.4;
        const drift = isEarly ? -0.004 : 0.0005;
        const localVol = isEarly ? vol : vol * 0.6;

        const bodySize = localVol * price * (0.3 + this.rng() * 0.5);
        const wickSize = bodySize * (0.2 + this.rng() * 0.6);
        const isGreen = this.rng() < (isEarly ? 0.3 : 0.55);

        price *= 1 + drift + (this.rng() - 0.5) * localVol * 0.5;

        const open = price;
        const close = isGreen ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();

        candles.push({ open, high, low, close });
      }
    } else if (subtype === "double_bottom") {
      // Two similar lows
      for (let i = 0; i < count; i++) {
        const phase = i / count;
        let drift = 0;
        if (phase < 0.3) drift = -0.002;
        else if (phase < 0.5) drift = 0.002;
        else if (phase < 0.75) drift = -0.002;
        else drift = 0.001;

        const bodySize = vol * price * (0.3 + this.rng() * 0.5);
        const wickSize = bodySize * (0.3 + this.rng() * 0.7);
        const isGreen = this.rng() < 0.5;

        price *= 1 + drift + (this.rng() - 0.5) * vol * 0.5;

        const open = price;
        const close = isGreen ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();

        candles.push({ open, high, low, close });
      }
    } else if (subtype === "failed_breakout") {
      // Looks like breakout, but fails
      for (let i = 0; i < count; i++) {
        const phase = i / count;
        let drift = phase < 0.7 ? 0.002 : -0.003;

        const bodySize = vol * price * (0.4 + this.rng() * 0.6);
        const wickSize = bodySize * (0.3 + this.rng() * 0.8);
        const isGreen = this.rng() < (phase < 0.7 ? 0.6 : 0.3);

        price *= 1 + drift + (this.rng() - 0.5) * vol;

        const open = price;
        const close = isGreen ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();

        candles.push({ open, high, low, close });
      }
    } else {
      // Generic compression/coil
      for (let i = 0; i < count; i++) {
        const bodySize = vol * price * (0.3 + this.rng() * 0.4) * (1 - i / count * 0.5);
        const wickSize = bodySize * (0.4 + this.rng() * 0.6);
        const isGreen = this.rng() < 0.5;

        price += (this.rng() - 0.5) * vol * price * 0.3;

        const open = price;
        const close = isGreen ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();

        candles.push({ open, high, low, close });
      }
    }

    return candles;
  }

  _findDecisionPoint(candles, phases) {
    // Decision point is near the end of the last (setup) phase
    const setupPhase = phases[phases.length - 1];
    const setupEnd = setupPhase.start + setupPhase.length;
    
    // Pause 2-5 candles before the end
    const offset = Math.floor(2 + this.rng() * 3);
    return Math.max(setupPhase.start + 5, setupEnd - offset);
  }

  _generateContinuation(candles, phases, decisionIndex) {
    const setupPhase = phases[phases.length - 1];
    const subtype = setupPhase.subtype;

    // Determine if pattern succeeds or fails
    const shouldSucceed = this._shouldPatternSucceed(subtype);

    const lastCandle = candles[decisionIndex];
    const continuationCandles = [];
    let price = lastCandle.close;
    const vol = setupPhase.volatility;

    // Generate 8-12 continuation candles
    const contLength = Math.floor(8 + this.rng() * 4);

    let signal = "HOLD";
    let patternName = this._getPatternName(subtype);

    if (shouldSucceed) {
      if (
        subtype.includes("bull") ||
        subtype === "double_bottom" ||
        subtype === "inverse_head_shoulders" ||
        subtype === "cup_handle" ||
        subtype === "ascending_triangle"
      ) {
        signal = "BUY";
        // Strong upward continuation
        for (let i = 0; i < contLength; i++) {
          const drift = 0.004 + this.rng() * 0.002;
          const bodySize = vol * price * (0.5 + this.rng() * 0.6);
          const wickSize = bodySize * (0.2 + this.rng() * 0.4);
          const isGreen = this.rng() < 0.75;

          price *= 1 + drift + (this.rng() - 0.5) * vol * 0.3;

          const open = price;
          const close = isGreen ? open + bodySize : open - bodySize;
          const high = Math.max(open, close) + wickSize * this.rng();
          const low = Math.min(open, close) - wickSize * this.rng();

          continuationCandles.push({ open, high, low, close });
        }
      } else if (
        subtype.includes("bear") ||
        subtype === "double_top" ||
        subtype === "head_shoulders" ||
        subtype === "rising_wedge" ||
        subtype === "descending_triangle"
      ) {
        signal = "SELL";
        // Strong downward continuation
        for (let i = 0; i < contLength; i++) {
          const drift = -0.004 - this.rng() * 0.002;
          const bodySize = vol * price * (0.5 + this.rng() * 0.6);
          const wickSize = bodySize * (0.2 + this.rng() * 0.4);
          const isGreen = this.rng() < 0.25;

          price *= 1 + drift + (this.rng() - 0.5) * vol * 0.3;

          const open = price;
          const close = isGreen ? open + bodySize : open - bodySize;
          const high = Math.max(open, close) + wickSize * this.rng();
          const low = Math.min(open, close) - wickSize * this.rng();

          continuationCandles.push({ open, high, low, close });
        }
      } else {
        // Neutral patterns - no clear direction (HOLD is correct)
        signal = "HOLD";
        for (let i = 0; i < contLength; i++) {
          const bodySize = vol * price * (0.3 + this.rng() * 0.4);
          const wickSize = bodySize * (0.4 + this.rng() * 0.6);
          const isGreen = this.rng() < 0.5;

          price += (this.rng() - 0.5) * vol * price * 0.5;

          const open = price;
          const close = isGreen ? open + bodySize : open - bodySize;
          const high = Math.max(open, close) + wickSize * this.rng();
          const low = Math.min(open, close) - wickSize * this.rng();

          continuationCandles.push({ open, high, low, close });
        }
      }
    } else {
      // Pattern fails - HOLD or opposite signal
      signal = "HOLD";
      patternName = "Failed " + patternName;

      // Weak or opposite continuation
      for (let i = 0; i < contLength; i++) {
        const bodySize = vol * price * (0.3 + this.rng() * 0.5);
        const wickSize = bodySize * (0.4 + this.rng() * 0.8);
        const isGreen = this.rng() < 0.5;

        price += (this.rng() - 0.5) * vol * price;

        const open = price;
        const close = isGreen ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize * this.rng();
        const low = Math.min(open, close) - wickSize * this.rng();

        continuationCandles.push({ open, high, low, close });
      }
    }

    return {
      candles: continuationCandles,
      signal,
      pattern: patternName,
      succeeded: shouldSucceed,
    };
  }

  _shouldPatternSucceed(subtype) {
    const { cleanRatio } = this.config;
    
    // Failed patterns always fail
    if (
      subtype.includes("failed") ||
      subtype.includes("trap") ||
      subtype === "exhaustion"
    ) {
      return false;
    }

    // Clean patterns have higher success rate
    return this.rng() < cleanRatio + 0.2;
  }

  _getPatternName(subtype) {
    const names = {
      bull_flag: "Bull Flag",
      bear_flag: "Bear Flag",
      ascending_triangle: "Ascending Triangle",
      descending_triangle: "Descending Triangle",
      double_bottom: "Double Bottom",
      double_top: "Double Top",
      inverse_head_shoulders: "Inverse Head & Shoulders",
      head_shoulders: "Head & Shoulders",
      cup_handle: "Cup & Handle",
      rising_wedge: "Rising Wedge",
      symmetrical_triangle: "Symmetrical Triangle",
      range_compression: "Range Compression",
      coil: "Coil",
      failed_breakout: "Failed Breakout",
      bull_trap: "Bull Trap",
      bear_trap: "Bear Trap",
      exhaustion: "Exhaustion Move",
      false_reversal: "False Reversal",
    };
    return names[subtype] || "Pattern";
  }

  _analyzeContext(candles, decisionIndex, phases) {
    const recentCandles = candles.slice(Math.max(0, decisionIndex - 20), decisionIndex);
    const setupPhase = phases[phases.length - 1];

    // Simple trend analysis
    const firstPrice = recentCandles[0]?.close || candles[0].close;
    const lastPrice = recentCandles[recentCandles.length - 1]?.close || candles[decisionIndex].close;
    const pctChange = ((lastPrice - firstPrice) / firstPrice) * 100;

    let trendBias = "Neutral";
    if (pctChange > 2) trendBias = "Bullish";
    else if (pctChange < -2) trendBias = "Bearish";

    // Volatility
    let totalRange = 0;
    recentCandles.forEach((c) => {
      totalRange += (c.high - c.low) / c.close;
    });
    const avgRange = totalRange / recentCandles.length;
    const volatility = avgRange > 0.015 ? "High" : avgRange > 0.008 ? "Medium" : "Low";

    return {
      trendBias,
      volatility,
      regime: phases[0]?.type || "unknown",
      patternType: setupPhase.subtype,
    };
  }
}

/* ═══════════════════════════════════════════════════════════════
    5  CHART RENDERER
    
    Handles windowed view, auto-scaling, and smooth scrolling
   ═══════════════════════════════════════════════════════════════ */

class ChartRenderer {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.config = config;
    this.windowStart = 0;
    this.animationProgress = 0;
  }

  setDimensions(width, height) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    // Reset context and scale
    this.ctx = this.canvas.getContext("2d");
    this.ctx.scale(dpr, dpr);
  }

  // Render all candles (no windowing)
  renderAll(allCandles) {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    if (allCandles.length === 0) return;

    // Auto-scale Y-axis to ALL candles
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    allCandles.forEach((c) => {
      minPrice = Math.min(minPrice, c.low);
      maxPrice = Math.max(maxPrice, c.high);
    });

    const priceRange = maxPrice - minPrice;
    const padding = priceRange * 0.1;
    minPrice -= padding;
    maxPrice += padding;

    // Calculate candle width based on number of candles
    const chartWidth = width - 60;
    const candleWidth = Math.min(12, chartWidth / allCandles.length);
    const bodyWidth = Math.max(1.5, candleWidth * 0.7);
    const wickWidth = Math.max(0.5, bodyWidth * 0.2);

    // Draw candles
    allCandles.forEach((candle, i) => {
      const x = 30 + i * candleWidth + candleWidth / 2;
      const yHigh = height - 30 - ((candle.high - minPrice) / (maxPrice - minPrice)) * (height - 60);
      const yLow = height - 30 - ((candle.low - minPrice) / (maxPrice - minPrice)) * (height - 60);
      const yOpen = height - 30 - ((candle.open - minPrice) / (maxPrice - minPrice)) * (height - 60);
      const yClose = height - 30 - ((candle.close - minPrice) / (maxPrice - minPrice)) * (height - 60);

      const isGreen = candle.close >= candle.open;
      const color = isGreen ? C.bull : C.bear;

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = wickWidth;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Body
      ctx.fillStyle = color;
      const bodyHeight = Math.abs(yClose - yOpen);
      const bodyY = Math.min(yOpen, yClose);
      ctx.fillRect(x - bodyWidth / 2, bodyY, bodyWidth, Math.max(0.5, bodyHeight));
    });

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = 30 + (i / 4) * (height - 60);
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(width - 30, y);
      ctx.stroke();
    }

    // Price labels (right side)
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 5; i++) {
      const price = minPrice + (i / 4) * (maxPrice - minPrice);
      const y = height - 30 - (i / 4) * (height - 60);
      ctx.fillText(price.toFixed(0), width - 5, y);
    }

    // Candle count label (bottom left)
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${allCandles.length} candles`, 5, height - 5);
  }

  // Render candles with windowed view (DEPRECATED - keeping for compatibility)
  render(allCandles, windowStart, windowSize, isAnimating = false) {
    this.renderAll(allCandles.slice(windowStart, windowStart + windowSize));
  }

  // Animate continuation reveal (DEPRECATED - now using renderAll)
  renderContinuation(allCandles, windowStart, windowSize, continuationCandles, progress) {
    const totalCandles = [...allCandles, ...continuationCandles.slice(0, Math.floor(progress * continuationCandles.length))];
    this.renderAll(totalCandles);
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

  // ── Start new game ──
  const startGame = useCallback(() => {
    sound.unlock();
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
  }, [difficulty]);

  // ── Initialize round ──
  const initializeRound = useCallback(
    (roundNum) => {
      const generator = new MarketStructureGenerator(difficulty);
      generator.seed(Date.now() + roundNum * 12345); // Deterministic variety
      const newStructure = generator.generate();

      setStructure(newStructure);
      setRound(roundNum);
      setChoice(null);
      setTimeLeft(DECISION_MS);
      setScreen("building");
      setRevealProgress(0);
      setWindowStart(0);

      // Animate the market structure building up
      let currentCandle = 0;
      const buildInterval = setInterval(() => {
        currentCandle++;
        setWindowStart(currentCandle);

        // When we reach the decision point, pause and start timer
        if (currentCandle >= newStructure.decisionIndex) {
          clearInterval(buildInterval);
          setScreen("playing");

          // Start decision timer
          const startTime = Date.now();
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, DECISION_MS - elapsed);
            setTimeLeft(remaining);

            if (remaining === 0) {
              clearInterval(timerRef.current);
              handleChoice("TIMEOUT");
            }
          }, 50);
        }
      }, 50); // Show 1 candle every 50ms = ~20 candles/second
    },
    [difficulty]
  );

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

    if (screen === "building" || screen === "playing") {
      // Show all candles up to current point (building animation or at decision)
      const visibleCandles = structure.candles.slice(0, windowStart + 1);
      rendererRef.current.renderAll(visibleCandles);
    } else if (screen === "revealing" || screen === "outcome") {
      // Show decision point + continuation
      const baseCandles = structure.candles.slice(0, structure.decisionIndex + 1);
      const contCount = Math.floor(revealProgress * structure.continuation.candles.length);
      const allCandles = [...baseCandles, ...structure.continuation.candles.slice(0, contCount)];
      rendererRef.current.renderAll(allCandles);
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
        gap: 10,
        padding: "10px 12px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <GlassPanel style={{ padding: "6px 14px", borderRadius: 16 }}>
          <span style={{ fontSize: 12, fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }}>
            Round{" "}
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", color: C.nGreen }}>
            {round + 1}
            <span style={{ color: "rgba(255,255,255,0.28)", fontWeight: 400 }}>/{ROUNDS}</span>
          </span>
        </GlassPanel>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {screen === "building" && (
            <GlassPanel style={{ padding: "5px 11px", borderRadius: 16, border: `1px solid ${C.nBlue}35` }}>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: C.nBlue }}>
                📊 Building context...
              </span>
            </GlassPanel>
          )}
          {streak > 0 && screen !== "building" && (
            <GlassPanel style={{ padding: "5px 11px", borderRadius: 16, border: `1px solid ${C.nPurple}35` }}>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: C.nPurple }}>
                🔥 ×{STREAK_MULT[Math.min(streak, STREAK_MULT.length - 1)].toFixed(1)}
              </span>
            </GlassPanel>
          )}
        </div>
      </div>

      {/* Timer - only show when playing */}
      {screen === "playing" && <TimerBar timeLeft={timeLeft} totalTime={DECISION_MS} />}

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <canvas
          ref={chartRef}
          style={{ width: "100%", height: "100%", borderRadius: 20, display: "block" }}
        />
        {screen === "outcome" && structure && (
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 14,
              fontSize: 10,
              fontFamily: "monospace",
              color: "rgba(255,255,255,0.18)",
              background: "rgba(6,6,12,0.6)",
              padding: "3px 8px",
              borderRadius: 8,
              backdropFilter: "blur(8px)",
            }}
          >
            {structure.continuation.pattern}
          </div>
        )}
      </div>

      {/* Decision / Outcome */}
      <div style={{ paddingBottom: 8 }}>
        {screen === "building" && (
          <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
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
