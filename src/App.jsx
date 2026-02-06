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

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════
    1  CONSTANTS & COLOR TOKENS
   ═══════════════════════════════════════════════════════════════ */

const ROUNDS = 7;
const DECISION_MS = 5000; // Increased to 5s for context analysis
const BASE_SCORE = 1000;
const STREAK_MULT = [1, 1.3, 1.6, 2.0, 2.5, 3.0, 3.5, 4.0];

// Single difficulty mode
const DIFFICULTY_CONFIG = { windowSize: 28, contextSize: 65, cleanRatio: 0.4 };

const C = {
  nGreen: "#00ff88",
  nPink: "#ff3366",
  nPurple: "#8b5cf6",
  nBlue: "#0ea5e9",
  nAmber: "#f59e0b",
  bull: "#10b981",
  bear: "#ef4444",
  neut: "#f59e0b",
  bg1: "#000000",
  bg2: "#0a0a0a",
  bg3: "#111111",
  glass: "rgba(20,20,20,0.8)",
  glassBr: "rgba(255,255,255,0.1)",
  glassHi: "rgba(255,255,255,0.15)",
  text: "#ffffff",
  textSecondary: "#a1a1a1",
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
    
    // Different sounds for countdown: 3, 2, 1
    let freq, vol;
    if (n === 3) {
      freq = 660;
      vol = 0.15;
    } else if (n === 2) {
      freq = 880;
      vol = 0.18;
    } else {
      freq = 1320;
      vol = 0.25;
    }
    
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

  // Soft mechanical tick for each candle built
  buildTick(progress) {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime;
    
    // Create a soft mechanical click/tick sound
    // Uses noise burst + resonant filter for realistic mechanical sound
    
    // Noise component (very short burst)
    const bufferSize = ctx.sampleRate * 0.015; // 15ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    // Bandpass filter for mechanical resonance
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800 + (progress * 300), now); // Subtle pitch variation
    filter.Q.value = 12; // High Q for mechanical resonance
    
    const gain = ctx.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    // Sharp attack, quick decay
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    
    noise.start(now);
    noise.stop(now + 0.03);
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
    4  PATTERN ANNOTATION GENERATOR
    Pontosabb, érthetőbb annotációk minden pattern-hez
   ═══════════════════════════════════════════════════════════════ */

function generateAnnotation(structure) {
  const { pattern, signal, candles, decisionIndex } = structure;

  // Normalizáljuk a pattern nevet
  const p = pattern.toLowerCase().trim().replace(/&/g, 'and').replace(/\s+/g, '_');

  const highlights = [];
  let explanation = '';

  const isBullish = signal === 'BUY';
  
  // Biztonságos index hozzáférés
  const safeIdx = (offset) => Math.max(0, Math.min(candles.length - 1, decisionIndex + offset));
  const getHigh  = (o) => candles[safeIdx(o)]?.high  ?? candles[decisionIndex].high;
  const getLow   = (o) => candles[safeIdx(o)]?.low   ?? candles[decisionIndex].low;
  const getOpen  = (o) => candles[safeIdx(o)]?.open  ?? candles[decisionIndex].open;
  const getClose = (o) => candles[safeIdx(o)]?.close ?? candles[decisionIndex].close;

  // Találjuk meg a pattern kezdetét dinamikusan
  const findPatternStart = () => {
    // Keressünk visszafelé egy jelentős fordulópontot
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    let startIdx = Math.max(0, decisionIndex - 25);
    
    for (let i = decisionIndex; i >= startIdx; i--) {
      if (candles[i].high > highestHigh) highestHigh = candles[i].high;
      if (candles[i].low < lowestLow) lowestLow = candles[i].low;
    }
    
    return startIdx;
  };

  switch (p) {
    case 'bull_flag':
      explanation = 'Bull Flag: Erős impulzív emelkedés (flagpole) → Szűkülő konszolidáció (flag) → Felfelé kitörés';
      {
        const poleStart = safeIdx(-20);
        const poleEnd = safeIdx(-10);
        const flagStart = safeIdx(-10);
        const flagEnd = safeIdx(-1);
        
        // Flagpole jelzése
        highlights.push(
          { type: 'line', startIdx: poleStart, startPrice: getLow(-20), endIdx: poleEnd, endPrice: getHigh(-10), 
            label: 'Impulse Move (Pole)', color: C.bull, width: 3 }
        );
        
        // Flag pattern téglalap
        highlights.push(
          { type: 'rect', startIdx: flagStart, endIdx: flagEnd, 
            priceTop: getHigh(-8), priceBot: getLow(-8), 
            label: 'Flag Consolidation', color: C.nGreen }
        );
        
        // Breakout pont
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 8, direction: 'up', 
            label: 'Breakout ↑', color: C.bull, size: 20 }
        );
        
        // Support vonal a flag alatt
        highlights.push(
          { type: 'line', startIdx: flagStart, startPrice: getLow(-9), endIdx: flagEnd, endPrice: getLow(-2), 
            label: 'Flag Support', color: C.nGreen, dashed: true }
        );
      }
      break;

    case 'bear_flag':
      explanation = 'Bear Flag: Erős impulzív esés (flagpole) → Szűkülő konszolidáció (flag) → Lefelé kitörés';
      {
        const poleStart = safeIdx(-20);
        const poleEnd = safeIdx(-10);
        const flagStart = safeIdx(-10);
        const flagEnd = safeIdx(-1);
        
        // Flagpole jelzése
        highlights.push(
          { type: 'line', startIdx: poleStart, startPrice: getHigh(-20), endIdx: poleEnd, endPrice: getLow(-10), 
            label: 'Impulse Drop (Pole)', color: C.bear, width: 3 }
        );
        
        // Flag pattern téglalap
        highlights.push(
          { type: 'rect', startIdx: flagStart, endIdx: flagEnd, 
            priceTop: getHigh(-8), priceBot: getLow(-8), 
            label: 'Flag Consolidation', color: C.nPink }
        );
        
        // Breakdown pont
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 8, direction: 'down', 
            label: 'Breakdown ↓', color: C.bear, size: 20 }
        );
        
        // Resistance vonal a flag felett
        highlights.push(
          { type: 'line', startIdx: flagStart, startPrice: getHigh(-9), endIdx: flagEnd, endPrice: getHigh(-2), 
            label: 'Flag Resistance', color: C.nPink, dashed: true }
        );
      }
      break;

    case 'ascending_triangle':
      explanation = 'Ascending Triangle: Emelkedő aljak (vevői nyomás) + Lapos ellenállás → Bullish kitörés';
      {
        const start = safeIdx(-18);
        const end = safeIdx(0);
        
        // Alsó trendvonal (emelkedő aljak)
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getLow(-18), endIdx: safeIdx(-2), endPrice: getLow(-2), 
            label: 'Rising Lows (Demand)', color: C.bull, width: 2.5 }
        );
        
        // Felső ellenállás (lapos)
        const resistancePrice = Math.max(getHigh(-15), getHigh(-10), getHigh(-5));
        highlights.push(
          { type: 'line', startIdx: start, startPrice: resistancePrice, endIdx: end, endPrice: resistancePrice, 
            label: 'Flat Resistance', color: C.neut, dashed: true, width: 2.5 }
        );
        
        // Érintési pontok jelölése
        highlights.push(
          { type: 'circle', idx: safeIdx(-18), price: getLow(-18), label: '1', radius: 10, color: C.bull }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-10), price: getLow(-10), label: '2', radius: 10, color: C.bull }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-3), price: getLow(-3), label: '3', radius: 10, color: C.bull }
        );
        
        // Breakout
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 10, direction: 'up', 
            label: 'Breakout ↑', color: C.bull, size: 22 }
        );
      }
      break;

    case 'descending_triangle':
      explanation = 'Descending Triangle: Csökkenő tetők (eladói nyomás) + Lapos támasz → Bearish kitörés';
      {
        const start = safeIdx(-18);
        const end = safeIdx(0);
        
        // Felső trendvonal (csökkenő tetők)
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getHigh(-18), endIdx: safeIdx(-2), endPrice: getHigh(-2), 
            label: 'Falling Highs (Supply)', color: C.bear, width: 2.5 }
        );
        
        // Alsó támasz (lapos)
        const supportPrice = Math.min(getLow(-15), getLow(-10), getLow(-5));
        highlights.push(
          { type: 'line', startIdx: start, startPrice: supportPrice, endIdx: end, endPrice: supportPrice, 
            label: 'Flat Support', color: C.neut, dashed: true, width: 2.5 }
        );
        
        // Érintési pontok
        highlights.push(
          { type: 'circle', idx: safeIdx(-18), price: getHigh(-18), label: '1', radius: 10, color: C.bear }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-10), price: getHigh(-10), label: '2', radius: 10, color: C.bear }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-3), price: getHigh(-3), label: '3', radius: 10, color: C.bear }
        );
        
        // Breakdown
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 10, direction: 'down', 
            label: 'Breakdown ↓', color: C.bear, size: 22 }
        );
      }
      break;

    case 'double_bottom':
      explanation = 'Double Bottom (W-Pattern): Két mélypont azonos szinten → Neckline feletti kitörés → Bullish reversal';
      {
        // Bal mélypont
        const leftIdx = safeIdx(-18);
        const leftPrice = getLow(-18);
        highlights.push(
          { type: 'circle', idx: leftIdx, price: leftPrice, 
            label: 'Left Bottom', radius: 15, color: C.bull }
        );
        
        // Jobb mélypont
        const rightIdx = safeIdx(-6);
        const rightPrice = getLow(-6);
        highlights.push(
          { type: 'circle', idx: rightIdx, price: rightPrice, 
            label: 'Right Bottom', radius: 15, color: C.bull }
        );
        
        // Középső csúcs (neckline)
        const middleIdx = safeIdx(-12);
        const necklinePrice = getHigh(-12);
        highlights.push(
          { type: 'circle', idx: middleIdx, price: necklinePrice, 
            label: 'Peak', radius: 12, color: C.nAmber }
        );
        
        // Neckline
        highlights.push(
          { type: 'line', startIdx: safeIdx(-20), startPrice: necklinePrice, 
            endIdx: safeIdx(2), endPrice: necklinePrice, 
            label: 'Neckline (Resistance)', color: C.nAmber, dashed: true, width: 2.5 }
        );
        
        // Support level a bottomoknál
        highlights.push(
          { type: 'line', startIdx: leftIdx, startPrice: leftPrice, 
            endIdx: rightIdx, endPrice: rightPrice, 
            label: 'Support Level', color: C.bull, dashed: true }
        );
        
        // Breakout
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 12, direction: 'up', 
            label: 'Neckline Breakout ↑', color: C.bull, size: 24 }
        );
      }
      break;

    case 'double_top':
      explanation = 'Double Top (M-Pattern): Két csúcs azonos szinten → Neckline alatti kitörés → Bearish reversal';
      {
        // Bal csúcs
        const leftIdx = safeIdx(-18);
        const leftPrice = getHigh(-18);
        highlights.push(
          { type: 'circle', idx: leftIdx, price: leftPrice, 
            label: 'Left Top', radius: 15, color: C.bear }
        );
        
        // Jobb csúcs
        const rightIdx = safeIdx(-6);
        const rightPrice = getHigh(-6);
        highlights.push(
          { type: 'circle', idx: rightIdx, price: rightPrice, 
            label: 'Right Top', radius: 15, color: C.bear }
        );
        
        // Középső mélypont (neckline)
        const middleIdx = safeIdx(-12);
        const necklinePrice = getLow(-12);
        highlights.push(
          { type: 'circle', idx: middleIdx, price: necklinePrice, 
            label: 'Valley', radius: 12, color: C.nAmber }
        );
        
        // Neckline
        highlights.push(
          { type: 'line', startIdx: safeIdx(-20), startPrice: necklinePrice, 
            endIdx: safeIdx(2), endPrice: necklinePrice, 
            label: 'Neckline (Support)', color: C.nAmber, dashed: true, width: 2.5 }
        );
        
        // Resistance level a topoknál
        highlights.push(
          { type: 'line', startIdx: leftIdx, startPrice: leftPrice, 
            endIdx: rightIdx, endPrice: rightPrice, 
            label: 'Resistance Level', color: C.bear, dashed: true }
        );
        
        // Breakdown
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 12, direction: 'down', 
            label: 'Neckline Breakdown ↓', color: C.bear, size: 24 }
        );
      }
      break;

    case 'head_and_shoulders':
    case 'head_shoulders':
      explanation = 'Head & Shoulders: Bal váll < Fej > Jobb váll → Neckline breakdown → Bearish reversal';
      {
        // Bal váll
        const leftShoulderIdx = safeIdx(-20);
        const leftShoulderPrice = getHigh(-20);
        highlights.push(
          { type: 'circle', idx: leftShoulderIdx, price: leftShoulderPrice, 
            label: 'Left Shoulder', radius: 14, color: C.nPurple }
        );
        
        // Fej (legmagasabb pont)
        const headIdx = safeIdx(-12);
        const headPrice = getHigh(-12);
        highlights.push(
          { type: 'circle', idx: headIdx, price: headPrice, 
            label: 'Head', radius: 20, color: C.bear }
        );
        
        // Jobb váll
        const rightShoulderIdx = safeIdx(-4);
        const rightShoulderPrice = getHigh(-4);
        highlights.push(
          { type: 'circle', idx: rightShoulderIdx, price: rightShoulderPrice, 
            label: 'Right Shoulder', radius: 14, color: C.nPurple }
        );
        
        // Neckline (a két völgy összekötése)
        const leftValleyPrice = getLow(-16);
        const rightValleyPrice = getLow(-8);
        highlights.push(
          { type: 'line', startIdx: safeIdx(-24), startPrice: leftValleyPrice, 
            endIdx: safeIdx(2), endPrice: rightValleyPrice, 
            label: 'Neckline (Support)', color: C.nAmber, dashed: true, width: 3 }
        );
        
        // Völgyek jelölése
        highlights.push(
          { type: 'circle', idx: safeIdx(-16), price: leftValleyPrice, 
            label: 'V1', radius: 10, color: C.nAmber }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-8), price: rightValleyPrice, 
            label: 'V2', radius: 10, color: C.nAmber }
        );
        
        // Breakdown
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 14, direction: 'down', 
            label: 'Neckline Break → SELL', color: C.bear, size: 26 }
        );
      }
      break;

    case 'inverse_head_and_shoulders':
    case 'inverse_h_and_s':
    case 'inverse_hands':
    case 'inverse_h&s':
      explanation = 'Inverse Head & Shoulders: Bal váll > Fej < Jobb váll → Neckline breakout → Bullish reversal';
      {
        // Bal váll
        const leftShoulderIdx = safeIdx(-20);
        const leftShoulderPrice = getLow(-20);
        highlights.push(
          { type: 'circle', idx: leftShoulderIdx, price: leftShoulderPrice, 
            label: 'Left Shoulder', radius: 14, color: C.nPurple }
        );
        
        // Fej (legmélyebb pont)
        const headIdx = safeIdx(-12);
        const headPrice = getLow(-12);
        highlights.push(
          { type: 'circle', idx: headIdx, price: headPrice, 
            label: 'Head', radius: 20, color: C.bull }
        );
        
        // Jobb váll
        const rightShoulderIdx = safeIdx(-4);
        const rightShoulderPrice = getLow(-4);
        highlights.push(
          { type: 'circle', idx: rightShoulderIdx, price: rightShoulderPrice, 
            label: 'Right Shoulder', radius: 14, color: C.nPurple }
        );
        
        // Neckline (a két csúcs összekötése)
        const leftPeakPrice = getHigh(-16);
        const rightPeakPrice = getHigh(-8);
        highlights.push(
          { type: 'line', startIdx: safeIdx(-24), startPrice: leftPeakPrice, 
            endIdx: safeIdx(2), endPrice: rightPeakPrice, 
            label: 'Neckline (Resistance)', color: C.nAmber, dashed: true, width: 3 }
        );
        
        // Csúcsok jelölése
        highlights.push(
          { type: 'circle', idx: safeIdx(-16), price: leftPeakPrice, 
            label: 'P1', radius: 10, color: C.nAmber }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-8), price: rightPeakPrice, 
            label: 'P2', radius: 10, color: C.nAmber }
        );
        
        // Breakout
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 14, direction: 'up', 
            label: 'Neckline Break → BUY', color: C.bull, size: 26 }
        );
      }
      break;

    default:
      explanation = `${pattern}: Pattern felismerhető, de részletes breakdown még nem elérhető.`;
      // Általános jelzés
      highlights.push(
        { type: 'rect', startIdx: safeIdx(-15), endIdx: safeIdx(0), 
          priceTop: getHigh(-5), priceBot: getLow(-5), 
          label: pattern, color: isBullish ? C.nGreen : C.nPink }
      );
      highlights.push(
        { type: 'arrow', idx: safeIdx(0), price: getClose(0) + (isBullish ? 12 : -12), 
          direction: isBullish ? 'up' : 'down', label: signal, 
          color: isBullish ? C.bull : C.bear, size: 20 }
      );
  }

  return { pattern, explanation, highlights };
}
/* ═══════════════════════════════════════════════════════════════
    5  MARKET STRUCTURE GENERATOR
    
    This is the CORE of the redesign. Instead of generating isolated
    patterns, we create realistic market structures with:
    - Long context (40-80 candles)
    - Multiple overlapping patterns
    - Trend transitions
    - Failed patterns and traps
    - Natural decision points
   ═══════════════════════════════════════════════════════════════ */

class MarketStructureGenerator {
  constructor() {
    this.config = DIFFICULTY_CONFIG;
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
    const signal = setupType.signal; // BUY or SELL

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

    // Distribution: 50% BUY, 50% SELL - no HOLD
    if (r < 0.25) {
      // Clean bullish continuation
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
    } else if (r < 0.75) {
      // Bullish reversal
      return {
        type: "bullish_reversal",
        signal: "BUY",
        name: this.rng() < 0.5 ? "Double Bottom" : "Inverse H&S",
        momentum: "building",
        quality: "good",
        willSucceed: true,
      };
    } else {
      // Bearish reversal
      return {
        type: "bearish_reversal",
        signal: "SELL",
        name: this.rng() < 0.5 ? "Double Top" : "Head & Shoulders",
        momentum: "building",
        quality: "good",
        willSucceed: true,
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

    if (signal === "BUY") {
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
    } else if (signal === "SELL") {
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
      5. CHART RENDERER - Stabil kanóc javítás

      Javítva:
      - Stabil kanóc 6–10 gyertyánál
      - Wick width limit
      - Minimum wick magasság
      - Dinamikus SCALE_LOOKBACK
      - Animáció progress-szel
      ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
    5. CHART RENDERER - Profi verzió, stabil kanóc, arányos wick

    Javítva:
    - Kanóc mindig arányos a high-low különbséggel
    - Wick max magasság limit
    - Body minimum magasság
    - Price label-ek eltávolítva
    - Animáció progress-szel
    - Grid és ambient light megmarad
    - Mobil és desktop optimalizálva
    - drawAnnotations teljesen kompatibilis a generateAnnotation ár-alapú struktúrájával
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
    const height = mobile ? Math.floor(window.innerHeight * 0.65) : 440;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx = this.canvas.getContext("2d");
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  renderAll(allCandles, scrollOffset = 0, totalCandleCountOverride = null, annotation = null) {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;

    ctx.clearRect(0, 0, width, height);
    if (!allCandles || allCandles.length === 0) return;

    const mobile = this.isMobile(width);

    const gap = mobile ? 3 : 2;
    const leftPadding = mobile ? 10 : 30;
    const rightPadding = mobile ? 15 : 30;
    const availableWidth = width - leftPadding - rightPadding;

    const MIN_BODY_WIDTH = mobile ? 6 : 8;
    const MAX_BODY_WIDTH = mobile ? 20 : 28;

    // CRITICAL: Use override if provided (for reveal animation stability)
    const totalCandleCount = totalCandleCountOverride !== null ? totalCandleCountOverride : allCandles.length;

    let slotWidth = availableWidth / totalCandleCount;
    let bodyWidth = slotWidth - gap;

    if (bodyWidth < MIN_BODY_WIDTH) {
      bodyWidth = MIN_BODY_WIDTH;
      slotWidth = bodyWidth + gap;
    } else if (bodyWidth > MAX_BODY_WIDTH) {
      bodyWidth = MAX_BODY_WIDTH;
      slotWidth = bodyWidth + gap;
    }

    const MAX_VISIBLE = Math.min(totalCandleCount, Math.floor(availableWidth / slotWidth));

    const wickWidth = mobile ? Math.min(2, bodyWidth * 0.35) : 1.5;

    const offsetCandles = Math.floor(scrollOffset / slotWidth);
    const maxStartIdx = Math.max(0, allCandles.length - MAX_VISIBLE);
    const rawStartIdx = maxStartIdx - offsetCandles;
    const startIdx = Math.max(0, Math.min(maxStartIdx, rawStartIdx));

    const endIdx = Math.min(startIdx + MAX_VISIBLE, allCandles.length);
    const visible = allCandles.slice(startIdx, endIdx);

    if (visible.length === 0) return;

    // Y skála
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    const SCALE_LOOKBACK = Math.max(visible.length, mobile ? 16 : 6);
    const scaleSource = allCandles.slice(
      Math.max(0, startIdx - SCALE_LOOKBACK),
      startIdx + visible.length
    );

    scaleSource.forEach(c => {
      minPrice = Math.min(minPrice, c.low);
      maxPrice = Math.max(maxPrice, c.high);
    });

    let range = maxPrice - minPrice || 1;

    if (visible.length < 12) {
      const pad = 5;
      minPrice -= pad;
      maxPrice += pad;
      range = maxPrice - minPrice;
    }

    const pad = mobile ? 0.08 : 0.06;
    minPrice -= range * pad;
    maxPrice += range * pad;

    const toY = price => height - 50 - ((price - minPrice) / (maxPrice - minPrice)) * (height - 90);

    const minBodyHeight = mobile ? 5 : 3;
    const maxWickHeight = mobile ? 25 : 20;

    // Grid - ultra finom, alig látható
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
      const y = 50 + (i / 4) * (height - 100);
      ctx.beginPath();
      ctx.moveTo(leftPadding, y);
      ctx.lineTo(width - rightPadding + 10, y);
      ctx.stroke();
    }

    // Gyertyák - wicks first (batched)
    ctx.lineWidth = wickWidth;

    visible.forEach((c, i) => {
      const x = leftPadding + i * slotWidth + (slotWidth - bodyWidth) / 2;
      const bull = c.close >= c.open;
      const col = bull ? C.bull : C.bear;

      const top = toY(Math.max(c.open, c.close));
      const bot = toY(Math.min(c.open, c.close));
      const centerX = Math.round(x + bodyWidth / 2);
      const highY = toY(c.high);
      const lowY = toY(c.low);

      ctx.strokeStyle = col;
      ctx.beginPath();
      if (highY < top) {
        ctx.moveTo(centerX, highY);
        ctx.lineTo(centerX, top);
      }
      if (lowY > bot) {
        ctx.moveTo(centerX, bot);
        ctx.lineTo(centerX, lowY);
      }
      ctx.stroke();
    });

    // Bodies batched by color
    const bullCandles = [];
    const bearCandles = [];

    visible.forEach((c, i) => {
      const x = leftPadding + i * slotWidth + (slotWidth - bodyWidth) / 2;
      const bull = c.close >= c.open;
      const top = toY(Math.max(c.open, c.close));
      const bot = toY(Math.min(c.open, c.close));
      const bodyHeight = Math.max(bot - top, minBodyHeight);

      const candleData = { x, top, bodyWidth, bodyHeight };
      if (bull) bullCandles.push(candleData);
      else bearCandles.push(candleData);
    });

    if (bullCandles.length > 0) {
      ctx.fillStyle = C.bull;
      ctx.strokeStyle = C.bull;
      ctx.lineWidth = 0; // Nincs border - tisztább
      bullCandles.forEach(cd => {
        ctx.beginPath();
        ctx.roundRect(cd.x, cd.top, cd.bodyWidth, cd.bodyHeight, mobile ? 4 : 3);
        ctx.fill();
      });
    }

    if (bearCandles.length > 0) {
      ctx.fillStyle = C.bear;
      ctx.strokeStyle = C.bear;
      ctx.lineWidth = 0; // Nincs border - tisztább
      bearCandles.forEach(cd => {
        ctx.beginPath();
        ctx.roundRect(cd.x, cd.top, cd.bodyWidth, cd.bodyHeight, mobile ? 4 : 3);
        ctx.fill();
      });
    }

    // Annotations
    if (annotation && annotation.highlights) {
      this.drawAnnotations(annotation, visible, startIdx, toY, leftPadding, slotWidth, bodyWidth);
    }

    // Price label-ek kikapcsolva
  }

  render(allCandles, windowStart, windowSize) {
    this.renderAll(allCandles.slice(windowStart, windowStart + windowSize));
  }

  renderContinuation(allCandles, windowStart, windowSize, continuation, progress) {
    const count = Math.floor(progress * continuation.length);
    this.renderAll([...allCandles, ...continuation.slice(0, count)]);
  }

  drawAnnotations(annotations, visibleCandles, startIdx, toY, leftPadding, slotWidth, bodyWidth) {
    if (!annotations || !annotations.highlights) return;

    const { highlights } = annotations;
    const ctx = this.ctx;
    const endIdx = startIdx + visibleCandles.length - 1;
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Csoportosítjuk a label-eket Y pozíció szerint, hogy elkerüljük az ütközést
    const labelPositions = [];

    // X koordináta segédfüggvény - csak a látható tartományban
    const getX = idx => {
      if (idx < startIdx || idx > endIdx) return null;
      return leftPadding + (idx - startIdx) * slotWidth + slotWidth / 2;
    };

    // Label pozíció igazítás - most jobbra helyezve
    const adjustLabelPosition = (targetX, targetY, label, minSpacing = 60) => {
      // Labelek a jobb oldalra kerülnek, több távolságra
      const labelX = width - 200; // Még távolabb a széltől
      let adjustedY = targetY;
      let attempts = 0;
      const maxAttempts = 25;
      
      while (attempts < maxAttempts) {
        let hasCollision = false;
        
        for (const pos of labelPositions) {
          const dy = Math.abs(pos.y - adjustedY);
          
          // Ha túl közel vannak egymáshoz Y koordinátában
          if (dy < minSpacing) {
            hasCollision = true;
            adjustedY += minSpacing * 1.5; // Még nagyobb lépésekkel toljuk lefelé
            break;
          }
        }
        
        if (!hasCollision) {
          labelPositions.push({ x: labelX, y: adjustedY, label, targetX, targetY });
          return { x: labelX, y: adjustedY };
        }
        
        attempts++;
      }
      
      labelPositions.push({ x: labelX, y: adjustedY, label, targetX, targetY });
      return { x: labelX, y: adjustedY };
    };

    // Rajzoljuk meg az összetevőket (körök, vonalak, stb.)
    highlights.forEach(h => {
      if (!h || !h.type) return;
      ctx.save();

      switch (h.type) {
        case 'circle': {
          const x = getX(h.idx);
          if (x === null) break;
          const y = toY(h.price);

          // Egyszerű kör - nincs fill
          ctx.strokeStyle = h.color || C.nGreen;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(x, y, h.radius || 12, 0, Math.PI * 2);
          ctx.stroke();

          if (h.label) {
            const labelPos = adjustLabelPosition(x, y, h.label, 50);
            
            // Tiszta, minimal label
            ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            const metrics = ctx.measureText(h.label);
            const padding = 12;
            const bgWidth = metrics.width + padding * 2;
            const bgHeight = 24;
            
            // Sötét háttér éles szélekkel
            ctx.fillStyle = C.bg3;
            ctx.fillRect(labelPos.x - bgWidth/2, labelPos.y - bgHeight/2, bgWidth, bgHeight);
            
            // Vékony szegély
            ctx.strokeStyle = h.color || C.nGreen;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(labelPos.x - bgWidth/2, labelPos.y - bgHeight/2, bgWidth, bgHeight);
            
            // Fehér szöveg
            ctx.fillStyle = C.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(h.label, labelPos.x, labelPos.y);
            
            // Egyszerű összekötő vonal
            ctx.strokeStyle = h.color || C.nGreen;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.5;
            
            const startX = labelPos.x - bgWidth/2 - 5;
            const endX = x + (h.radius || 12) + 3;
            
            ctx.beginPath();
            ctx.moveTo(startX, labelPos.y);
            ctx.lineTo(endX, y);
            ctx.stroke();
            
            ctx.globalAlpha = 1;
          }
          break;
        }

        case 'line': {
          const x1 = getX(h.startIdx);
          const x2 = getX(h.endIdx);
          if (x1 === null || x2 === null) break;
          
          const y1 = toY(h.startPrice);
          const y2 = toY(h.endPrice);

          ctx.strokeStyle = h.color || C.neut;
          ctx.lineWidth = h.width || 2.5;

          if (h.dashed || h.style === 'dashed') {
            ctx.setLineDash([5, 5]);
          }

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.setLineDash([]);

          if (h.label) {
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const labelPos = adjustLabelPosition(midX, midY, h.label, 50);
            
            // Minimal label
            ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            const metrics = ctx.measureText(h.label);
            const padding = 12;
            const bgWidth = metrics.width + padding * 2;
            const bgHeight = 24;
            
            ctx.fillStyle = C.bg3;
            ctx.fillRect(labelPos.x - bgWidth/2, labelPos.y - bgHeight/2, bgWidth, bgHeight);
            
            ctx.strokeStyle = h.color || C.neut;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(labelPos.x - bgWidth/2, labelPos.y - bgHeight/2, bgWidth, bgHeight);
            
            ctx.fillStyle = C.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(h.label, labelPos.x, labelPos.y);
            
            // Egyszerű összekötő vonal
            ctx.strokeStyle = h.color || C.neut;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.5;
            
            const startX = labelPos.x - bgWidth/2 - 5;
            
            ctx.beginPath();
            ctx.moveTo(startX, labelPos.y);
            ctx.lineTo(midX, midY);
            ctx.stroke();
            
            ctx.globalAlpha = 1;
          }
          break;
        }

        case 'rect': {
          // Ellenőrizzük, hogy a rect látható-e
          if (h.endIdx < startIdx || h.startIdx > endIdx) break;
          
          const x1 = leftPadding + Math.max(0, (h.startIdx - startIdx)) * slotWidth;
          const x2 = leftPadding + Math.min(visibleCandles.length, (h.endIdx - startIdx + 1)) * slotWidth;
          const yTop = toY(h.priceTop);
          const yBot = toY(h.priceBot);

          ctx.fillStyle = (h.color || C.nAmber) + '15';
          ctx.fillRect(x1, yTop, x2 - x1, yBot - yTop);

          ctx.strokeStyle = h.color || C.nAmber;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(x1, yTop, x2 - x1, yBot - yTop);
          ctx.setLineDash([]);

          if (h.label) {
            const midX = (x1 + x2) / 2;
            const midY = (yTop + yBot) / 2;
            const labelPos = adjustLabelPosition(midX, midY, h.label, 50);
            
            // Minimal label
            ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            const metrics = ctx.measureText(h.label);
            const padding = 12;
            const bgWidth = metrics.width + padding * 2;
            const bgHeight = 24;
            
            ctx.fillStyle = C.bg3;
            ctx.fillRect(labelPos.x - bgWidth/2, labelPos.y - bgHeight/2, bgWidth, bgHeight);
            
            ctx.strokeStyle = h.color || C.nAmber;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(labelPos.x - bgWidth/2, labelPos.y - bgHeight/2, bgWidth, bgHeight);
            
            ctx.fillStyle = C.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(h.label, labelPos.x, labelPos.y);
            
            // Egyszerű összekötő vonal
            ctx.strokeStyle = h.color || C.nAmber;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.5;
            
            const startX = labelPos.x - bgWidth/2 - 5;
            const targetX = x2;
            
            ctx.beginPath();
            ctx.moveTo(startX, labelPos.y);
            ctx.lineTo(targetX, midY);
            ctx.stroke();
            
            ctx.globalAlpha = 1;
          }
          break;
        }

        case 'arrow': {
          const x = getX(h.idx);
          if (x === null) break;
          
          const yBase = toY(h.price);
          const dirUp = h.direction === 'up';
          const color = h.color || (dirUp ? C.bull : C.bear);
          const size = h.size || 20;

          ctx.strokeStyle = color;
          ctx.fillStyle = color;
          ctx.lineWidth = 3;

          // Szár
          ctx.beginPath();
          ctx.moveTo(x, yBase);
          ctx.lineTo(x, dirUp ? yBase - size * 1.2 : yBase + size * 1.2);
          ctx.stroke();

          // Nyílhegy
          ctx.beginPath();
          if (dirUp) {
            ctx.moveTo(x - size / 2, yBase - size * 0.6);
            ctx.lineTo(x, yBase - size * 1.2);
            ctx.lineTo(x + size / 2, yBase - size * 0.6);
          } else {
            ctx.moveTo(x - size / 2, yBase + size * 0.6);
            ctx.lineTo(x, yBase + size * 1.2);
            ctx.lineTo(x + size / 2, yBase + size * 0.6);
          }
          ctx.closePath();
          ctx.fill();

          if (h.label) {
            const arrowTipY = dirUp ? yBase - size * 1.2 : yBase + size * 1.2;
            const labelPos = adjustLabelPosition(x, arrowTipY, h.label, 35);
            
            // Minimal label
            ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            const metrics = ctx.measureText(h.label);
            const padding = 12;
            const bgWidth = metrics.width + padding * 2;
            const bgHeight = 24;
            
            ctx.fillStyle = C.bg3;
            ctx.fillRect(labelPos.x - bgWidth/2, labelPos.y - bgHeight/2, bgWidth, bgHeight);
            
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(labelPos.x - bgWidth/2, labelPos.y - bgHeight/2, bgWidth, bgHeight);
            
            ctx.fillStyle = C.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(h.label, labelPos.x, labelPos.y);
            
            // Egyszerű összekötő vonal
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.5;
            
            const startX = labelPos.x - bgWidth/2 - 5;
            
            ctx.beginPath();
            ctx.moveTo(startX, labelPos.y);
            ctx.lineTo(x, arrowTipY);
            ctx.stroke();
            
            ctx.globalAlpha = 1;
          }
          break;
        }

        case 'text': {
          const x = getX(h.idx);
          if (x === null) break;
          
          const y = toY(h.price);
          const labelPos = adjustLabelPosition(x, y, h.label, 35);

          // Minimal label
          ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          const metrics = ctx.measureText(h.label);
          const padding = 12;
          const bgWidth = metrics.width + padding * 2;
          const bgHeight = 24;
          
          ctx.fillStyle = C.bg3;
          ctx.fillRect(labelPos.x - bgWidth/2, labelPos.y - bgHeight/2, bgWidth, bgHeight);
          
          ctx.strokeStyle = h.color || C.text;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(labelPos.x - bgWidth/2, labelPos.y - bgHeight/2, bgWidth, bgHeight);
          
          ctx.fillStyle = C.text;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(h.label, labelPos.x, labelPos.y);
          
          // Egyszerű összekötő vonal
          ctx.strokeStyle = h.color || C.text;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.5;
          
          const startX = labelPos.x - bgWidth/2 - 5;
          
          ctx.beginPath();
          ctx.moveTo(startX, labelPos.y);
          ctx.lineTo(x, y);
          ctx.stroke();
          
          ctx.globalAlpha = 1;
          break;
        }

        default:
          console.warn('Ismeretlen annotation típus:', h.type);
      }

      ctx.restore();
    });
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

const GlassButton = React.memo(({ children, onClick, color, disabled, style }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const handleMouseEnter = useCallback(() => {
    if (!disabled) setIsHovered(true);
  }, [disabled]);
  
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);
  
  const buttonStyle = useMemo(() => ({
    background: disabled ? `${C.glass}` : `linear-gradient(135deg, ${color}22, ${color}11)`,
    border: `1.5px solid ${disabled ? `${color}25` : color}55`,
    borderRadius: 16,
    padding: "12px 24px",
    color: disabled ? "rgba(255,255,255,0.5)" : "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "wait" : "pointer",
    backdropFilter: "blur(16px)",
    transform: !disabled && isHovered ? "translateY(-1px)" : "translateY(0)",
    boxShadow: !disabled && isHovered ? `0 6px 20px ${color}33` : (disabled ? "none" : `0 0 0 ${color}00`),
    transition: "all 0.2s ease",
    willChange: "transform, box-shadow",
    opacity: disabled ? 0.6 : 1,
    animation: disabled ? "none" : "buttonActivate 0.3s ease-out",
    ...style,
  }), [disabled, color, isHovered, style]);
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={buttonStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </button>
  );
});

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

const DecisionButtons = React.memo(({ onChoose, disabled }) => {
  const handleBuy = useCallback(() => onChoose("BUY"), [onChoose]);
  const handleSell = useCallback(() => onChoose("SELL"), [onChoose]);

  return (
    <div style={{ display: "flex", gap: 10, willChange: "opacity" }}>
      <GlassButton
        onClick={handleBuy}
        disabled={disabled}
        color={C.bull}
        style={{ flex: 1, fontSize: 16, padding: "16px 0" }}
      >
        📈 BUY
      </GlassButton>
      <GlassButton
        onClick={handleSell}
        disabled={disabled}
        color={C.bear}
        style={{ flex: 1, fontSize: 16, padding: "16px 0" }}
      >
        📉 SELL
      </GlassButton>
    </div>
  );
});

const OutcomeCard = ({ correct, points, streak, patternName, choice, signal, onNext, context, showAnnotation, onToggleAnnotation, currentAnnotation }) => (
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

    {/* Annotation explanation */}
    {showAnnotation && currentAnnotation && (
      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.85)",
          marginBottom: 12,
          padding: "12px",
          background: "rgba(0,0,0,0.3)",
          borderRadius: 10,
          border: "1px solid rgba(245,158,11,0.5)",
          lineHeight: 1.5,
        }}
      >
        {currentAnnotation.explanation}
      </div>
    )}

    {/* Context explanation */}
    {context && !showAnnotation && (
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
            • Pattern failed to follow through as expected
            <br />• Context ({context.trendBias} bias) conflicted with setup
            <br />• Better to avoid low-quality setups
          </div>
        )}
      </div>
    )}

    <div style={{ display: "flex", gap: 10 }}>
      <GlassButton 
        onClick={onToggleAnnotation} 
        color={showAnnotation ? C.nAmber : "#374151"} 
        style={{ flex: 1, padding: "12px 0", fontSize: 13 }}
      >
        {showAnnotation ? "📊 Hide Breakdown" : "🔍 Show Breakdown"}
      </GlassButton>
      
      <GlassButton 
        onClick={onNext} 
        color={C.nBlue} 
        style={{ flex: 1, padding: "12px 0" }}
      >
        Next Round →
      </GlassButton>
    </div>
  </GlassPanel>
);

const FinalVerdict = ({ stats, onRestart, onLeaderboard, playerName }) => {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const saveScore = async () => {
      if (!playerName || saved) return;
      
      try {
        const timestamp = Date.now();
        const scoreData = {
          name: playerName,
          score: stats.totalScore,
          streak: stats.bestStreak,
          accuracy: stats.accuracy,
          timestamp
        };
        
        // Get existing scores
        const existingScores = JSON.parse(localStorage.getItem("reflexGlassScores") || "[]");
        
        // Add new score
        existingScores.push(scoreData);
        
        // Save back
        localStorage.setItem("reflexGlassScores", JSON.stringify(existingScores));
        
        setSaved(true);
        haptic([50, 30, 50]);
      } catch (err) {
        console.error("Failed to save score:", err);
      }
    };
    
    saveScore();
  }, [playerName, stats, saved]);

  return (
    <GlassPanel style={{ padding: "24px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Game Complete!</div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 12 }}>
        {playerName}
      </div>
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

      {saved && (
        <div style={{ 
          padding: "10px", 
          marginBottom: 16,
          background: `${C.nGreen}20`,
          border: `1px solid ${C.nGreen}60`,
          borderRadius: 12,
          color: C.nGreen,
          fontSize: 13,
          fontWeight: 600
        }}>
          ✓ Score saved to leaderboard!
        </div>
      )}

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
};

/* ═══════════════════════════════════════════════════════════════
    6.5  LEADERBOARD COMPONENT
   ═══════════════════════════════════════════════════════════════ */

const Leaderboard = ({ onBack }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      
      // Get all scores from localStorage
      const scores = JSON.parse(localStorage.getItem("reflexGlassScores") || "[]");
      
      if (scores.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }
      
      // Aggregate by player name
      const aggregated = {};
      
      scores.forEach(score => {
        if (!aggregated[score.name]) {
          aggregated[score.name] = {
            name: score.name,
            totalScore: 0,
            games: 0,
            bestScore: 0,
            bestStreak: 0
          };
        }
        aggregated[score.name].totalScore += score.score;
        aggregated[score.name].games += 1;
        aggregated[score.name].bestScore = Math.max(aggregated[score.name].bestScore, score.score);
        aggregated[score.name].bestStreak = Math.max(aggregated[score.name].bestStreak, score.streak);
      });
      
      // Convert to array and sort by total score
      const leaderboard = Object.values(aggregated)
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 10); // Top 10
      
      setEntries(leaderboard);
    } catch (err) {
      console.error("Error loading leaderboard:", err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      gap: 16, 
      maxWidth: 480, 
      margin: "0 auto",
      padding: 16 
    }}>
      <div style={{ 
        textAlign: "center", 
        fontSize: 32, 
        fontWeight: 800,
        background: `linear-gradient(135deg, ${C.nGreen} 0%, ${C.nPurple} 100%)`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        marginBottom: 8
      }}>
        🏆 Leaderboard
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: C.neut, padding: 40 }}>
          Loading...
        </div>
      ) : entries.length === 0 ? (
        <div style={{ 
          textAlign: "center", 
          color: "rgba(255,255,255,0.5)", 
          padding: 40,
          fontSize: 14
        }}>
          No scores yet. Be the first!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {entries.map((entry, idx) => (
            <div
              key={entry.name + idx}
              style={{
                background: C.glass,
                border: `1px solid ${idx === 0 ? C.nGreen : C.glassBr}`,
                borderRadius: 12,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                backdropFilter: "blur(20px)",
                boxShadow: idx === 0 ? `0 0 20px ${C.nGreen}40` : "none"
              }}
            >
              <div style={{ 
                fontSize: 20, 
                fontWeight: 700,
                minWidth: 32,
                color: idx === 0 ? C.nGreen : idx === 1 ? C.nPurple : idx === 2 ? C.nBlue : "rgba(255,255,255,0.6)"
              }}>
                {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: 16, 
                  fontWeight: 600,
                  color: "#fff",
                  marginBottom: 2
                }}>
                  {entry.name}
                </div>
                <div style={{ 
                  fontSize: 11, 
                  color: "rgba(255,255,255,0.5)",
                  fontFamily: "monospace"
                }}>
                  {entry.games} game{entry.games !== 1 ? "s" : ""} • Best: {entry.bestScore.toLocaleString()}
                </div>
              </div>
              <div style={{ 
                textAlign: "right",
                display: "flex",
                flexDirection: "column",
                gap: 2
              }}>
                <div style={{ 
                  fontSize: 18, 
                  fontWeight: 700,
                  color: C.nGreen
                }}>
                  {entry.totalScore.toLocaleString()}
                </div>
                <div style={{ 
                  fontSize: 10, 
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "monospace"
                }}>
                  🔥 {entry.bestStreak}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <GlassButton 
        onClick={onBack} 
        color={C.nPurple} 
        style={{ marginTop: 8 }}
      >
        Back
      </GlassButton>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
    7  MAIN APP COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function App() {
  // ── State ──
  const [screen, setScreen] = useState("home");
  const [round, setRound] = useState(0);
  const [scores, setScores] = useState([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [roundStats, setRoundStats] = useState([]);
  const [timeLeft, setTimeLeft] = useState(DECISION_MS);
  const [choice, setChoice] = useState(null);
  const [structure, setStructure] = useState(null);
  const [windowStart, setWindowStart] = useState(0);
  const [revealProgress, setRevealProgress] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [isEditingName, setIsEditingName] = useState(true);
  const [tempName, setTempName] = useState("");

  // ── Annotation states ──
  const [showAnnotation, setShowAnnotation] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState(null);

  // ── Refs ──
  const chartRef = useRef(null);
  const rendererRef = useRef(null);
  const timerRef = useRef(null);
  const animFrameRef = useRef(null);
  const touchStartX = useRef(null);
  const touchStartOffset = useRef(0);
  const swipeRafId = useRef(null);
  const lastTouchX = useRef(null);
  const lastTouchTime = useRef(null);
  const velocity = useRef(0);
  const renderRafId = useRef(null);
  const lastRenderTime = useRef(0);
  const buildAnimationProgress = useRef(0);
  const cachedCandles = useRef([]);
  const lastCandleCount = useRef(0);

  // ── Initialize renderer ──
  useEffect(() => {
    if (chartRef.current) {
      rendererRef.current = new ChartRenderer(
        chartRef.current,
        DIFFICULTY_CONFIG
      );
      const updateSize = () => {
        const rect = chartRef.current.getBoundingClientRect();
        rendererRef.current.setDimensions(rect.width, rect.height);
      };
      updateSize();
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }
  }, []);

  // ── Load saved player name ──
  useEffect(() => {
    const loadPlayerName = async () => {
      try {
        const savedName = localStorage.getItem("reflexGlassPlayerName");
        if (savedName) {
          setPlayerName(savedName);
          setTempName(savedName);
          setIsEditingName(false);
        }
      } catch (err) {
        console.log("No saved name");
      }
    };
    loadPlayerName();
  }, []);

  // ── Initialize round ──
  const initializeRound = useCallback(
    (roundNum) => {
      const generator = new MarketStructureGenerator();
      generator.seed(Date.now() + roundNum * 12345);
      const newStructure = generator.generate();

      setStructure(newStructure);
      setRound(roundNum);
      setChoice(null);
      setTimeLeft(DECISION_MS);
      setScreen("building");
      setRevealProgress(0);
      setWindowStart(0); // Start from 0
      buildAnimationProgress.current = 0;
      lastCandleCount.current = 0; // Reset candle count for tick sounds

      // Smooth scrolling reveal animation
      const duration = 6500; // Gyorsabb, pörgősebb ritmus
      const startTime = Date.now();

      const animateScroll = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        
        // Smoother easing - linear with slight ease at start
        // Avoids the "sticking" feeling at the end
        const eased = progress < 0.1 
          ? progress * 5 // Ease in first 10%
          : 0.1 * 5 + (progress - 0.1) * (0.9 / 0.9); // Linear for rest
        
        buildAnimationProgress.current = Math.min(1, eased);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animateScroll);
        } else {
          // Scrolling complete - set final state immediately
          buildAnimationProgress.current = 1;
          setWindowStart(newStructure.decisionIndex);
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
              // Timeout - counts as incorrect (random choice for display)
              handleChoice(Math.random() < 0.5 ? "BUY" : "SELL");
            }
          }, 50);
        }
      };

      animateScroll();
    },
    [] // Don't include handleChoice - causes circular dependency
  );

  // ── Start new game ──
  const startGame = useCallback(() => {
    sound.unlock();
    
    // Cleanup any running timers/animations
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (renderRafId.current) cancelAnimationFrame(renderRafId.current);
    
    // Force cleanup of renderer
    if (rendererRef.current) {
      rendererRef.current = null;
    }
    
    // Reset all game state
    setScreen("game"); // Reset screen to prevent verdict from showing
    setRound(0);
    setScores([]);
    setStreak(0);
    setBestStreak(0);
    setRoundStats([]);
    setChoice(null);
    setStructure(null);
    setWindowStart(0);
    setRevealProgress(0);
    setSwipeOffset(0);
    buildAnimationProgress.current = 0;
    lastCandleCount.current = 0;
    cachedCandles.current = [];
    
    // Initialize game directly without countdown
    if (chartRef.current && !rendererRef.current) {
      rendererRef.current = new ChartRenderer(chartRef.current, DIFFICULTY_CONFIG);
      const rect = chartRef.current.getBoundingClientRect();
      rendererRef.current.setDimensions(rect.width, rect.height);
    }
    
    initializeRound(0);
  }, [initializeRound]);

  // ── Handle user choice ──
  const handleChoice = useCallback(
    (userChoice) => {
      // Stop any running animations (building or other)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      
      // If still in building phase, complete it immediately
      if (screen === "building") {
        buildAnimationProgress.current = 1;
        setWindowStart(structure.decisionIndex);
      }
      
      haptic([30, 20, 30]);
      sound.click();

      setChoice(userChoice);
      setScreen("revealing");

      // Animate continuation reveal (faster animation)
      let progress = 0;
      const animate = () => {
        progress += 0.03; // Faster increment
        setRevealProgress(progress);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Reveal complete - show outcome
          const correct = userChoice === structure.signal;
          const newStreak = correct ? streak + 1 : 0;
          const multiplier = STREAK_MULT[Math.min(newStreak, STREAK_MULT.length - 1)];
          const points = correct ? Math.round(BASE_SCORE * multiplier) : 0;

          setStreak(newStreak);
          setBestStreak(Math.max(bestStreak, newStreak));
          setScores([...scores, points]);
          setRoundStats([...roundStats, { correct, choice: userChoice }]);

          // Generate and auto-show annotation
          const annotation = generateAnnotation(structure);
          setCurrentAnnotation(annotation);
          setShowAnnotation(true);

          if (correct) sound.correct();
          else sound.wrong();

          setScreen("outcome");
        }
      };
      animate();
    },
    [structure, streak, bestStreak, scores, roundStats, screen]
  );

  // ── Advance to next round ──
  const advanceRound = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setSwipeOffset(0); // Reset scroll position
    setShowAnnotation(false); // Reset annotation
    setCurrentAnnotation(null);
    if (round + 1 >= ROUNDS) {
      setScreen("verdict");
    } else {
      initializeRound(round + 1);
    }
  }, [round, initializeRound]);

    // ── Render chart with RAF ──
    useEffect(() => {
      if (!chartRef.current || !structure) return;

      if (!rendererRef.current) {
        rendererRef.current = new ChartRenderer(chartRef.current, DIFFICULTY_CONFIG);
        const rect = chartRef.current.getBoundingClientRect();
        rendererRef.current.setDimensions(rect.width, rect.height);
      }

      const isMobile = window.innerWidth < 520;

      let targetFps = 60;
      if (screen === "building") {
        targetFps = isMobile ? 24 : 40;        // még film-szerűbbé tettem
      } else if (screen === "playing") {
        targetFps = 24;
      } else {
        targetFps = isMobile ? 40 : 60;
      }

      const minFrameTime = 1000 / targetFps;

      const render = (timestamp) => {
        if (timestamp - lastRenderTime.current < minFrameTime) {
          renderRafId.current = requestAnimationFrame(render);
          return;
        }
        lastRenderTime.current = timestamp;

        let currentCandles = [];
        let currentOffset = 0;

        if (screen === "building") {
          // ── ÚJ: Progress-alapú lassú építés + partial candle ──
          const targetIndex = buildAnimationProgress.current * structure.decisionIndex;
          const displayedIndex = Math.floor(targetIndex);
          const partialProgress = targetIndex - displayedIndex;   // 0.0 → 1.0

          // Play tick sound when a new candle is completed
          if (displayedIndex > lastCandleCount.current) {
            sound.buildTick(displayedIndex / structure.decisionIndex);
            lastCandleCount.current = displayedIndex;
          }

          // Teljes gyertyák az utolsó előttiig
          currentCandles = structure.candles.slice(0, displayedIndex);

          // Az utolsó gyertya részlegesen "épül"
          if (displayedIndex < structure.candles.length) {
            const nextCandle = structure.candles[displayedIndex];

            const partialCandle = {
              ...nextCandle,                    // time, volume, stb. marad
              open: nextCandle.open,
              high: nextCandle.open + (nextCandle.high - nextCandle.open) * partialProgress,
              low:  nextCandle.open + (nextCandle.low  - nextCandle.open) * partialProgress,
              close: nextCandle.open + (nextCandle.close - nextCandle.open) * partialProgress,
            };

            currentCandles = [...currentCandles, partialCandle];
          }
        } 
        else if (screen === "playing") {
          currentCandles = structure.candles.slice(0, structure.decisionIndex + 1);
        } 
        else if (screen === "revealing" || screen === "outcome") {
          const baseCandles = structure.candles.slice(0, structure.decisionIndex + 1);
          const continuationCandles = structure.continuation?.candles || [];
          const contCount = Math.floor(revealProgress * continuationCandles.length);
          currentCandles = [...baseCandles, ...continuationCandles.slice(0, contCount)];
          currentOffset = screen === "outcome" ? swipeOffset : 0;
        }

        if (rendererRef.current && currentCandles.length > 0) {
          // Calculate total expected candles for stable rendering
          // CRITICAL: This must be STABLE throughout the reveal animation to prevent jumping
          // Use the FINAL expected count, not the current visible count
          const continuationLength = structure.continuation?.candles?.length || 0;
          const totalExpectedCandles = screen === "revealing" || screen === "outcome"
            ? (structure.decisionIndex + 1) + continuationLength
            : currentCandles.length;
          
          // Pass annotation only on outcome screen when enabled
          const annotationData = (screen === "outcome" && showAnnotation) ? currentAnnotation : null;
          
          rendererRef.current.renderAll(currentCandles, currentOffset, totalExpectedCandles, annotationData);
        }

        renderRafId.current = requestAnimationFrame(render);
      };

      renderRafId.current = requestAnimationFrame(render);

      return () => {
        if (renderRafId.current) cancelAnimationFrame(renderRafId.current);
      };
    }, [structure, screen, revealProgress, swipeOffset, windowStart, showAnnotation, currentAnnotation]);

  // ── Compute stats ──
  const computeStats = useCallback(() => {
    const totalScore = scores.reduce((a, b) => a + b, 0);
    const correct = roundStats.filter((r) => r.correct).length;
    const total = roundStats.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    return { totalScore, correct, total, accuracy, bestStreak };
  }, [scores, roundStats, bestStreak]);

  // ── Home screen ──
  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    
    try {
      localStorage.setItem("reflexGlassPlayerName", tempName.trim());
      setPlayerName(tempName.trim());
      setIsEditingName(false);
      haptic([30, 20, 30]);
    } catch (err) {
      console.error("Failed to save name:", err);
    }
  };

  const handleCancelEdit = () => {
    setTempName(playerName);
    setIsEditingName(false);
  };

  const handleStartGame = () => {
    if (!playerName.trim()) return;
    startGame();
  };

  const renderHome = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100dvh - 80px)",
        padding: "20px 16px",
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

      <GlassPanel style={{ padding: "20px 16px", maxWidth: 380, width: "100%" }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: 16 }}>
          Master pattern recognition in realistic market conditions. Learn when to trade and when
          to wait. Focus on context, not memorization.
        </div>
        
        <div style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="Enter your name"
            value={isEditingName ? tempName : playerName}
            onChange={(e) => isEditingName && setTempName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                if (isEditingName) {
                  handleSaveName();
                } else {
                  handleStartGame();
                }
              }
            }}
            maxLength={20}
            disabled={!isEditingName}
            style={{
              width: "100%",
              padding: "12px 48px 12px 16px",
              fontSize: 16,
              fontWeight: 600,
              background: C.glass,
              border: `1px solid ${isEditingName ? C.nGreen : C.glassBr}`,
              borderRadius: 12,
              color: "#fff",
              textAlign: "center",
              outline: "none",
              backdropFilter: "blur(20px)",
              cursor: isEditingName ? "text" : "default",
              opacity: isEditingName ? 1 : 0.9,
              boxSizing: "border-box"
            }}
          />
          {isEditingName ? (
            <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 4 }}>
              <button
                onClick={handleSaveName}
                disabled={!tempName.trim()}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "none",
                  background: tempName.trim() ? C.nGreen : "rgba(255,255,255,0.1)",
                  color: "#fff",
                  cursor: tempName.trim() ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 700,
                  opacity: tempName.trim() ? 1 : 0.4,
                  transition: "all 0.2s"
                }}
              >
                ✓
              </button>
              {playerName && (
                <button
                  onClick={handleCancelEdit}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: "none",
                    background: "rgba(255,77,148,0.3)",
                    color: C.nPink,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 700,
                    transition: "all 0.2s"
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            playerName && (
              <button
                onClick={() => {
                  setTempName(playerName);
                  setIsEditingName(true);
                }}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "none",
                  background: "rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  transition: "all 0.2s"
                }}
              >
                ✎
              </button>
            )
          )}
        </div>
      </GlassPanel>

      <GlassButton
        onClick={handleStartGame}
        color={C.nGreen}
        disabled={!playerName.trim()}
        style={{ 
          padding: "18px 56px", 
          fontSize: 18, 
          position: "relative", 
          overflow: "hidden",
          opacity: !playerName.trim() ? 0.5 : 1,
          cursor: !playerName.trim() ? "not-allowed" : "pointer"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
            backgroundSize: "200% 100%",
            animation: playerName.trim() ? "shimmer 2.2s linear infinite" : "none",
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
  const renderPlaying = () => {
    const isMobile = window.innerWidth < 520;
    return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: 8,
        padding: isMobile ? "8px 0" : "8px 10px",
      }}
    >
      {/* Header - more compact on mobile */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        flexShrink: 0,
        padding: isMobile ? "0 10px" : "0"
      }}>
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
        <div style={{ flexShrink: 0, padding: isMobile ? "0 10px" : "0" }}>
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
          style={{ 
            width: "100%", 
            height: "100%", 
            borderRadius: 16, 
            display: "block",
            touchAction: screen === "outcome" ? "none" : "auto"
          }}
          onTouchStart={(e) => {
            if (screen === "outcome" && structure && structure.candles && structure.candles.length > 0) {
              touchStartX.current = e.touches[0].clientX;
              touchStartOffset.current = swipeOffset;
              lastTouchX.current = e.touches[0].clientX;
              lastTouchTime.current = Date.now();
              velocity.current = 0;
              if (swipeRafId.current) cancelAnimationFrame(swipeRafId.current);
            }
          }}
          onTouchMove={(e) => {
            if (screen === "outcome" && touchStartX.current !== null && structure && structure.candles && structure.candles.length > 0) {
              e.preventDefault();
              
              const currentX = e.touches[0].clientX;
              const currentTime = Date.now();
              const deltaX = touchStartX.current - currentX;
              const timeDelta = currentTime - lastTouchTime.current;
              
              // Calculate velocity for momentum
              if (timeDelta > 0) {
                velocity.current = (lastTouchX.current - currentX) / timeDelta;
              }
              
              lastTouchX.current = currentX;
              lastTouchTime.current = currentTime;
              
              const newOffset = touchStartOffset.current + deltaX;
              
              // Get current canvas dimensions
              const canvasWidth = chartRef.current ? chartRef.current.getBoundingClientRect().width : 400;
              
              // Calculate dynamic limits based on total candles
              const totalCandles = structure.candles.length + (structure.continuation?.candles?.length || 0);
              const mobile = canvasWidth < 520;
              const gap = mobile ? 3 : 2;
              const MIN_BODY_WIDTH = mobile ? 6 : 8;
              const MAX_BODY_WIDTH = mobile ? 20 : 28;
              const leftPadding = mobile ? 10 : 30;
              const rightPadding = mobile ? 15 : 30;
              const availableWidth = canvasWidth - leftPadding - rightPadding;
              
              let slotWidth = availableWidth / totalCandles;
              let bodyWidth = slotWidth - gap;
              if (bodyWidth < MIN_BODY_WIDTH) {
                bodyWidth = MIN_BODY_WIDTH;
                slotWidth = bodyWidth + gap;
              } else if (bodyWidth > MAX_BODY_WIDTH) {
                bodyWidth = MAX_BODY_WIDTH;
                slotWidth = bodyWidth + gap;
              }
              
              const MAX_VISIBLE = Math.min(totalCandles, Math.floor(availableWidth / slotWidth));
              const scrollableCandles = Math.max(0, totalCandles - MAX_VISIBLE);
              
              // Dynamic limits
              const maxOffset = scrollableCandles * slotWidth;
              const minOffset = -50; // Small negative allowance for bounce
              let limitedOffset;
              
              if (newOffset > maxOffset) {
                const excess = newOffset - maxOffset;
                limitedOffset = maxOffset + excess * 0.3;
              } else if (newOffset < minOffset) {
                const excess = minOffset - newOffset;
                limitedOffset = minOffset - excess * 0.3;
              } else {
                limitedOffset = newOffset;
              }
              
              // Use RAF to prevent lag
              if (swipeRafId.current) cancelAnimationFrame(swipeRafId.current);
              swipeRafId.current = requestAnimationFrame(() => {
                setSwipeOffset(limitedOffset);
              });
            }
          }}
          onTouchEnd={() => {
            if (screen === "outcome" && touchStartX.current !== null && structure && structure.candles && structure.candles.length > 0) {
              // Get current canvas dimensions
              const canvasWidth = chartRef.current ? chartRef.current.getBoundingClientRect().width : 400;
              
              // Calculate dynamic limits based on total candles
              const totalCandles = structure.candles.length + (structure.continuation?.candles?.length || 0);
              const mobile = canvasWidth < 520;
              const gap = mobile ? 3 : 2;
              const MIN_BODY_WIDTH = mobile ? 6 : 8;
              const MAX_BODY_WIDTH = mobile ? 20 : 28;
              const leftPadding = mobile ? 10 : 30;
              const rightPadding = mobile ? 15 : 30;
              const availableWidth = canvasWidth - leftPadding - rightPadding;
              
              let slotWidth = availableWidth / totalCandles;
              let bodyWidth = slotWidth - gap;
              if (bodyWidth < MIN_BODY_WIDTH) {
                bodyWidth = MIN_BODY_WIDTH;
                slotWidth = bodyWidth + gap;
              } else if (bodyWidth > MAX_BODY_WIDTH) {
                bodyWidth = MAX_BODY_WIDTH;
                slotWidth = bodyWidth + gap;
              }
              
              const MAX_VISIBLE = Math.min(totalCandles, Math.floor(availableWidth / slotWidth));
              const scrollableCandles = Math.max(0, totalCandles - MAX_VISIBLE);
              
              // Apply momentum with smooth animation
              const momentum = velocity.current * 100;
              let finalOffset = swipeOffset + momentum;
              
              // Dynamic limits
              const maxOffset = scrollableCandles * slotWidth;
              const minOffset = 0;
              finalOffset = Math.max(minOffset, Math.min(maxOffset, finalOffset));
              
              // Smooth snap animation
              const startOffset = swipeOffset;
              const startTime = Date.now();
              const duration = 300;
              
              const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
                
                const offset = startOffset + (finalOffset - startOffset) * eased;
                setSwipeOffset(offset);
                
                if (progress < 1) {
                  swipeRafId.current = requestAnimationFrame(animate);
                }
              };
              
              animate();
            }
            
            touchStartX.current = null;
            velocity.current = 0;
          }}
        />
        {screen === "outcome" && structure && (
          <>
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
            <div
              style={{
                position: "absolute",
                bottom: 10,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 10,
                fontFamily: "monospace",
                color: "rgba(255,255,255,0.25)",
                background: "rgba(6,6,12,0.7)",
                padding: "4px 10px",
                borderRadius: 8,
                backdropFilter: "blur(8px)",
                pointerEvents: "none",
              }}
            >
              ← Swipe to explore →
            </div>
          </>
        )}
      </div>

      {/* Decision / Outcome - compact */}
      <div style={{ paddingBottom: 6, flexShrink: 0, padding: isMobile ? "0 10px 6px 10px" : "0 0 6px 0", minHeight: 64 }}>
        <div style={{ 
          display: screen === "outcome" ? "none" : "block",
          opacity: screen === "home" ? 0 : 1,
          pointerEvents: (screen === "playing" || screen === "building") ? "auto" : "none",
          transition: "none",
          transform: "translateZ(0)",
        }}>
          <DecisionButtons onChoose={handleChoice} disabled={screen !== "playing" && screen !== "building"} />
        </div>
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
            showAnnotation={showAnnotation}
            onToggleAnnotation={() => setShowAnnotation(!showAnnotation)}
            currentAnnotation={currentAnnotation}
          />
        )}
      </div>
    </div>
    );
  };

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
        playerName={playerName}
      />
    </div>
  );

  // ── Countdown overlay ──

  // ── Cleanup RAF on unmount ──
  useEffect(() => {
    return () => {
      if (swipeRafId.current) cancelAnimationFrame(swipeRafId.current);
      if (renderRafId.current) cancelAnimationFrame(renderRafId.current);
    };
  }, []);

  // ── Main render ──
  return (
    <div
      style={{
        width: "100vw",
        height: "100dvh",
        overflowY: "auto",
        overflowX: "hidden",
        background: C.bg1,
        position: "relative",
      }}
    >
      {/* Main content */}
      <div style={{ position: "relative", zIndex: 1, minHeight: "100dvh" }}>
        {screen === "home" && renderHome()}
        {(screen === "building" || screen === "playing" || screen === "revealing" || screen === "outcome") &&
          renderPlaying()}
        {screen === "verdict" && renderVerdict()}
        {screen === "leaderboard" && (
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            minHeight: "100dvh",
            padding: 16 
          }}>
            <Leaderboard onBack={() => setScreen("verdict")} />
          </div>
        )}
      </div>

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
        @keyframes buttonActivate {
          0% { opacity: 0.6; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1.02); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}