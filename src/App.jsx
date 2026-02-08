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
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* ═══════════════════════════════════════════════════════════════
    FIREBASE CONFIGURATION
   ═══════════════════════════════════════════════════════════════ */

// Firebase config - Using environment variables for security
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY_HERE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase
let app, db;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
  // Fallback to localStorage if Firebase fails
  db = null;
}

/* ═══════════════════════════════════════════════════════════════
    1  CONSTANTS & COLOR TOKENS
   ═══════════════════════════════════════════════════════════════ */

const ROUNDS = 7;
const DECISION_MS = 5000; // Increased to 5s for context analysis
const BASE_SCORE = 1000;
const STREAK_MULT = [1, 1.3, 1.6, 2.0, 2.5, 3.0, 3.5, 4.0];

// Developer support wallet address (Base network)
const DEVELOPER_WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"; // Replace with actual wallet

// Single difficulty mode
const DIFFICULTY_CONFIG = { windowSize: 28, contextSize: 65, cleanRatio: 0.4 };

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
    ROAST GENERATOR - Crypto Bro Style
   ═══════════════════════════════════════════════════════════════ */

function generateRoast(stats) {
  const { accuracy } = stats;
  
const roasts = {
  legendary: [
    "Fucking mooned, you absolute chad",
    "Bears got fucked, king shit",
    "100x degen god, holy fuck",
    "Aura so big it broke my screen",
    "You printed while I cried",
  ],

  pro: [
    "Clean pump, you sexy bastard",
    "Rizz on point, damn son",
    "Wagmi you glorious fuck",
    "Brrr motherfucker, respect",
    "Cooking harder than my ex's tears",
  ],

  decent: [
    "Mid as fuck but breathing",
    "Not rekt… yet, you lucky prick",
    "Sideways like my love life",
    "Ape energy: meh but cute",
    "Surviving, barely, lol",
  ],

  struggling: [
    "John Weak vibes, ouch",
    "Dip got you good huh",
    "Rekt a little, we’ve all been there",
    "Panic hands moment, happens",
    "Rough ride bro, hang in",
  ],

  ngmi: [
    "Rekt city population: you",
    "Zeroed... tough day king",
    "NGMI energy, but tomorrow’s another chart",
    "Rug pulled, that stings",
    "Bags looking sleepy, rip",
  ]
};

  if (accuracy >= 90) return roasts.legendary[Math.floor(Math.random() * roasts.legendary.length)];
  if (accuracy >= 75) return roasts.pro[Math.floor(Math.random() * roasts.pro.length)];
  if (accuracy >= 60) return roasts.decent[Math.floor(Math.random() * roasts.decent.length)];
  if (accuracy >= 40) return roasts.struggling[Math.floor(Math.random() * roasts.struggling.length)];
  return roasts.ngmi[Math.floor(Math.random() * roasts.ngmi.length)];
}

function getMemeForScore(accuracy) {
  if (accuracy >= 90) return "🚀🌕";
  if (accuracy >= 75) return "💎🙌";
  if (accuracy >= 60) return "📈🤝";
  if (accuracy >= 40) return "📉😅";
  return "💀🤡";
}


/* ═══════════════════════════════════════════════════════════════
    SHARE FUNCTIONS - Base + Twitter with Logos & Card Generation
   ═══════════════════════════════════════════════════════════════ */

function shareToTwitter(stats, roast) {
  const { accuracy, correct, total, totalScore } = stats;
  const meme = getMemeForScore(accuracy);
  
  const tweetText = encodeURIComponent(
    `Just scored ${accuracy.toFixed(1)}% on Reflex Glass! ${meme}\n\n` +
    `${correct}/${total} correct • ${totalScore.toLocaleString()} pts\n\n` +
    `${roast}\n\n` +
    `Think you can beat my score? 👇`
  );
  
  const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(window.location.href)}`;
  window.open(tweetUrl, '_blank');
}

async function shareToBase(stats, roast) {
  const { accuracy, correct, total, totalScore } = stats;
  const meme = getMemeForScore(accuracy);
  
  // Generate share card
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 418; // Twitter card ratio
  const ctx = canvas.getContext('2d');
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 800, 418);
  gradient.addColorStop(0, '#0f1a2e');
  gradient.addColorStop(0.5, '#06060c');
  gradient.addColorStop(1, '#0f0f1a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 800, 418);
  
  // Add glow orbs
  const glowGradient1 = ctx.createRadialGradient(150, 100, 0, 150, 100, 200);
  glowGradient1.addColorStop(0, 'rgba(0, 255, 170, 0.1)');
  glowGradient1.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGradient1;
  ctx.fillRect(0, 0, 800, 418);
  
  const glowGradient2 = ctx.createRadialGradient(650, 318, 0, 650, 318, 180);
  glowGradient2.addColorStop(0, 'rgba(168, 85, 247, 0.15)');
  glowGradient2.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGradient2;
  ctx.fillRect(0, 0, 800, 418);
  
  // Title
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('REFLEX GLASS', 400, 80);
  
  // Meme emoji
  ctx.font = '72px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(meme, 400, 170);
  
  // Score
  const scoreGradient = ctx.createLinearGradient(250, 200, 550, 200);
  scoreGradient.addColorStop(0, '#00ffaa');
  scoreGradient.addColorStop(1, '#a855f7');
  ctx.fillStyle = scoreGradient;
  ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, "Segoe UI", monospace';
  ctx.fillText(`${accuracy.toFixed(1)}%`, 400, 250);
  
  // Stats
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(`${correct}/${total} correct • ${totalScore.toLocaleString()} pts`, 400, 290);
  
  // Roast (wrapped)
  ctx.font = 'italic 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  
  // Word wrap roast
  const maxWidth = 700;
  const words = roast.split(' ');
  let line = '';
  let y = 340;
  
  for (let word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line, 400, y);
      line = word + ' ';
      y += 25;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 400, y);
  
  // Try to use Base mini app share if available, otherwise copy to clipboard
  try {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    
    // Check if we're in Base mini app
    if (window.ethereum && window.ethereum.isBase) {
      // Use Base mini app share
      const shareData = {
        text: `Just scored ${accuracy.toFixed(1)}% on Reflex Glass! ${meme}\n\n${roast}`,
        url: window.location.href,
        files: [new File([blob], 'reflex-glass-score.png', { type: 'image/png' })]
      };
      
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return true;
      }
    }
    
    // Fallback: copy link to clipboard
    const shareText = 
      `Just scored ${accuracy.toFixed(1)}% on Reflex Glass! ${meme}\n\n` +
      `${correct}/${total} correct • ${totalScore.toLocaleString()} pts\n\n` +
      `${roast}`;
    
    await navigator.clipboard.writeText(shareText + `\n\n${window.location.href}`);
    return false; // Indicates clipboard copy, not native share
  } catch (err) {
    console.error('Share failed:', err);
    return false;
  }
}

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

  switch (p) {
    case 'bull_flag':
      explanation = isBullish ? 'Equal highs + neckline break → bullish continuation' : 'Pattern detected';
      {
        // Csak a flag alsó és felső vonala - NINCS label
        const flagStart = safeIdx(-10);
        const flagEnd = safeIdx(-1);
        
        highlights.push(
          { type: 'line', startIdx: flagStart, startPrice: getHigh(-9), endIdx: flagEnd, endPrice: getHigh(-2), 
            color: '#ef4444', width: 1.5, dashed: false }
        );
        
        highlights.push(
          { type: 'line', startIdx: flagStart, startPrice: getLow(-9), endIdx: flagEnd, endPrice: getLow(-2), 
            color: '#10b981', width: 1.5, dashed: false }
        );

        // Egyetlen felfelé nyíl a kitörésnél - NINCS label
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 8, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'bear_flag':
      explanation = isBullish ? 'Pattern detected' : 'Equal lows + neckline break → bearish continuation';
      {
        const flagStart = safeIdx(-10);
        const flagEnd = safeIdx(-1);
        
        highlights.push(
          { type: 'line', startIdx: flagStart, startPrice: getHigh(-9), endIdx: flagEnd, endPrice: getHigh(-2), 
            color: '#ef4444', width: 1.5, dashed: false }
        );
        
        highlights.push(
          { type: 'line', startIdx: flagStart, startPrice: getLow(-9), endIdx: flagEnd, endPrice: getLow(-2), 
            color: '#10b981', width: 1.5, dashed: false }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 8, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'ascending_triangle':
      explanation = isBullish ? 'Rising lows + flat resistance → bullish breakout' : 'Pattern detected';
      {
        const start = safeIdx(-18);
        const end = safeIdx(0);
        
        // Emelkedő alsó vonal
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getLow(-18), endIdx: safeIdx(-2), endPrice: getLow(-2), 
            color: '#10b981', width: 1.5 }
        );
        
        // Lapos felső ellenállás
        const resistancePrice = Math.max(getHigh(-15), getHigh(-10), getHigh(-5));
        highlights.push(
          { type: 'line', startIdx: start, startPrice: resistancePrice, endIdx: end, endPrice: resistancePrice, 
            color: '#ef4444', dashed: true, width: 1.5 }
        );

        // Felfelé nyíl
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 10, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'descending_triangle':
      explanation = isBullish ? 'Pattern detected' : 'Falling highs + flat support → bearish breakdown';
      {
        const start = safeIdx(-18);
        const end = safeIdx(0);
        
        // Csökkenő felső vonal
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getHigh(-18), endIdx: safeIdx(-2), endPrice: getHigh(-2), 
            color: '#ef4444', width: 1.5 }
        );
        
        // Lapos alsó támasz
        const supportPrice = Math.min(getLow(-15), getLow(-10), getLow(-5));
        highlights.push(
          { type: 'line', startIdx: start, startPrice: supportPrice, endIdx: end, endPrice: supportPrice, 
            color: '#10b981', dashed: true, width: 1.5 }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 10, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'double_bottom':
      explanation = isBullish ? 'Equal lows + neckline break → bullish reversal' : 'Pattern detected';
      {
        // Két pulzáló pont a mélypontokon - NINCS label
        const leftIdx = safeIdx(-18);
        const leftPrice = getLow(-18);
        highlights.push(
          { type: 'circle', idx: leftIdx, price: leftPrice, 
            radius: 6, color: '#10b981', pulse: true }
        );
        
        const rightIdx = safeIdx(-6);
        const rightPrice = getLow(-6);
        highlights.push(
          { type: 'circle', idx: rightIdx, price: rightPrice, 
            radius: 6, color: '#10b981', pulse: true }
        );
        
        // Vékony neckline - NINCS label
        const necklinePrice = getHigh(-12);
        highlights.push(
          { type: 'line', startIdx: safeIdx(-20), startPrice: necklinePrice, 
            endIdx: safeIdx(2), endPrice: necklinePrice, 
            color: '#fbbf24', dashed: false, width: 1.5 }
        );

        // Egyetlen felfelé nyíl
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 12, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'double_top':
      explanation = isBullish ? 'Pattern detected' : 'Equal highs + neckline break → bearish reversal';
      {
        // Két pulzáló pont a csúcsokon - NINCS label
        const leftIdx = safeIdx(-18);
        const leftPrice = getHigh(-18);
        highlights.push(
          { type: 'circle', idx: leftIdx, price: leftPrice, 
            radius: 6, color: '#ef4444', pulse: true }
        );
        
        const rightIdx = safeIdx(-6);
        const rightPrice = getHigh(-6);
        highlights.push(
          { type: 'circle', idx: rightIdx, price: rightPrice, 
            radius: 6, color: '#ef4444', pulse: true }
        );
        
        // Vékony neckline - NINCS label
        const necklinePrice = getLow(-12);
        highlights.push(
          { type: 'line', startIdx: safeIdx(-20), startPrice: necklinePrice, 
            endIdx: safeIdx(2), endPrice: necklinePrice, 
            color: '#fbbf24', dashed: false, width: 1.5 }
        );

        // Egyetlen lefelé nyíl
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 12, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'head_and_shoulders':
    case 'head_shoulders':
      explanation = isBullish ? 'Pattern detected' : 'Left shoulder < Head > Right shoulder → neckline break → bearish reversal';
      {
        // Három pulzáló pont - NINCS label, csak kis és nagy különbség jelzi a fejet
        const leftShoulderIdx = safeIdx(-20);
        const leftShoulderPrice = getHigh(-20);
        highlights.push(
          { type: 'circle', idx: leftShoulderIdx, price: leftShoulderPrice, 
            radius: 5, color: '#ef4444', pulse: true }
        );
        
        const headIdx = safeIdx(-12);
        const headPrice = getHigh(-12);
        highlights.push(
          { type: 'circle', idx: headIdx, price: headPrice, 
            radius: 7, color: '#ef4444', pulse: true }
        );
        
        const rightShoulderIdx = safeIdx(-4);
        const rightShoulderPrice = getHigh(-4);
        highlights.push(
          { type: 'circle', idx: rightShoulderIdx, price: rightShoulderPrice, 
            radius: 5, color: '#ef4444', pulse: true }
        );
        
        // Vékony neckline
        const leftValleyPrice = getLow(-16);
        const rightValleyPrice = getLow(-8);
        highlights.push(
          { type: 'line', startIdx: safeIdx(-24), startPrice: leftValleyPrice, 
            endIdx: safeIdx(2), endPrice: rightValleyPrice, 
            color: '#fbbf24', dashed: false, width: 1.5 }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 14, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'inverse_head_and_shoulders':
    case 'inverse_h_and_s':
    case 'inverse_hands':
    case 'inverse_h&s':
      explanation = isBullish ? 'Left shoulder > Head < Right shoulder → neckline break → bullish reversal' : 'Pattern detected';
      {
        const leftShoulderIdx = safeIdx(-20);
        const leftShoulderPrice = getLow(-20);
        highlights.push(
          { type: 'circle', idx: leftShoulderIdx, price: leftShoulderPrice, 
            radius: 5, color: '#10b981', pulse: true }
        );
        
        const headIdx = safeIdx(-12);
        const headPrice = getLow(-12);
        highlights.push(
          { type: 'circle', idx: headIdx, price: headPrice, 
            radius: 7, color: '#10b981', pulse: true }
        );
        
        const rightShoulderIdx = safeIdx(-4);
        const rightShoulderPrice = getLow(-4);
        highlights.push(
          { type: 'circle', idx: rightShoulderIdx, price: rightShoulderPrice, 
            radius: 5, color: '#10b981', pulse: true }
        );
        
        const leftPeakPrice = getHigh(-16);
        const rightPeakPrice = getHigh(-8);
        highlights.push(
          { type: 'line', startIdx: safeIdx(-24), startPrice: leftPeakPrice, 
            endIdx: safeIdx(2), endPrice: rightPeakPrice, 
            color: '#fbbf24', dashed: false, width: 1.5 }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 14, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'bull_pennant':
      explanation = isBullish ? 'Converging trendlines + breakout → bullish continuation' : 'Pattern detected';
      {
        const start = safeIdx(-12);
        const mid = safeIdx(-6);
        const end = safeIdx(-1);
        
        // Upper converging line
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getHigh(-12), 
            endIdx: end, endPrice: getHigh(-2), 
            color: '#ef4444', width: 1.5, dashed: false }
        );
        
        // Lower converging line
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getLow(-12), 
            endIdx: end, endPrice: getLow(-2), 
            color: '#10b981', width: 1.5, dashed: false }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 10, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'bear_pennant':
      explanation = isBullish ? 'Pattern detected' : 'Converging trendlines + breakdown → bearish continuation';
      {
        const start = safeIdx(-12);
        const end = safeIdx(-1);
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getHigh(-12), 
            endIdx: end, endPrice: getHigh(-2), 
            color: '#ef4444', width: 1.5, dashed: false }
        );
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getLow(-12), 
            endIdx: end, endPrice: getLow(-2), 
            color: '#10b981', width: 1.5, dashed: false }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 10, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'rising_wedge_(continuation)':
    case 'rising_wedge_continuation':
      explanation = isBullish ? 'Narrowing upward channel → breakout → bullish continuation' : 'Pattern detected';
      {
        const start = safeIdx(-16);
        const end = safeIdx(-1);
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getHigh(-16), 
            endIdx: end, endPrice: getHigh(-1), 
            color: '#ef4444', width: 1.5 }
        );
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getLow(-16), 
            endIdx: end, endPrice: getLow(-1) + (getHigh(-1) - getLow(-1)) * 0.3, 
            color: '#10b981', width: 1.5 }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 12, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'falling_wedge_(continuation)':
    case 'falling_wedge_continuation':
      explanation = isBullish ? 'Pattern detected' : 'Narrowing downward channel → breakdown → bearish continuation';
      {
        const start = safeIdx(-16);
        const end = safeIdx(-1);
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getHigh(-16), 
            endIdx: end, endPrice: getHigh(-1) - (getHigh(-1) - getLow(-1)) * 0.3, 
            color: '#ef4444', width: 1.5 }
        );
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getLow(-16), 
            endIdx: end, endPrice: getLow(-1), 
            color: '#10b981', width: 1.5 }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 12, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'ascending_channel':
      explanation = isBullish ? 'Parallel rising trendlines → channel breakout → bullish move' : 'Pattern detected';
      {
        const start = safeIdx(-20);
        const end = safeIdx(-1);
        
        const slope = (getHigh(-1) - getHigh(-20)) / 19;
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getHigh(-20), 
            endIdx: end, endPrice: getHigh(-1), 
            color: '#ef4444', width: 1.5, dashed: true }
        );
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getLow(-20), 
            endIdx: end, endPrice: getLow(-1), 
            color: '#10b981', width: 1.5, dashed: true }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 10, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'descending_channel':
      explanation = isBullish ? 'Pattern detected' : 'Parallel falling trendlines → channel breakdown → bearish move';
      {
        const start = safeIdx(-20);
        const end = safeIdx(-1);
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getHigh(-20), 
            endIdx: end, endPrice: getHigh(-1), 
            color: '#ef4444', width: 1.5, dashed: true }
        );
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getLow(-20), 
            endIdx: end, endPrice: getLow(-1), 
            color: '#10b981', width: 1.5, dashed: true }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 10, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'cup_and_handle':
    case 'cup_&_handle':
      explanation = isBullish ? 'Rounded bottom + handle consolidation → breakout → bullish reversal' : 'Pattern detected';
      {
        // Mark the cup bottom
        const cupBottomIdx = safeIdx(-15);
        highlights.push(
          { type: 'circle', idx: cupBottomIdx, price: getLow(-15), 
            radius: 6, color: '#10b981', pulse: true }
        );
        
        // Handle range
        const handleStart = safeIdx(-8);
        const handleEnd = safeIdx(-1);
        highlights.push(
          { type: 'line', startIdx: handleStart, startPrice: getHigh(-8), 
            endIdx: handleEnd, endPrice: getHigh(-2), 
            color: '#fbbf24', width: 1.5, dashed: true }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 12, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'inverse_cup_and_handle':
    case 'inverse_cup_&_handle':
      explanation = isBullish ? 'Pattern detected' : 'Rounded top + handle consolidation → breakdown → bearish reversal';
      {
        const cupTopIdx = safeIdx(-15);
        highlights.push(
          { type: 'circle', idx: cupTopIdx, price: getHigh(-15), 
            radius: 6, color: '#ef4444', pulse: true }
        );
        
        const handleStart = safeIdx(-8);
        const handleEnd = safeIdx(-1);
        highlights.push(
          { type: 'line', startIdx: handleStart, startPrice: getLow(-8), 
            endIdx: handleEnd, endPrice: getLow(-2), 
            color: '#fbbf24', width: 1.5, dashed: true }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 12, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'falling_wedge_(reversal)':
    case 'falling_wedge_reversal':
      explanation = isBullish ? 'Narrowing downward wedge → bullish breakout → reversal' : 'Pattern detected';
      {
        const start = safeIdx(-18);
        const end = safeIdx(-1);
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getHigh(-18), 
            endIdx: end, endPrice: getHigh(-1), 
            color: '#ef4444', width: 1.5 }
        );
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getLow(-18), 
            endIdx: end, endPrice: getLow(-1), 
            color: '#10b981', width: 1.5 }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 14, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'rising_wedge_(reversal)':
    case 'rising_wedge_reversal':
      explanation = isBullish ? 'Pattern detected' : 'Narrowing upward wedge → bearish breakdown → reversal';
      {
        const start = safeIdx(-18);
        const end = safeIdx(-1);
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getHigh(-18), 
            endIdx: end, endPrice: getHigh(-1), 
            color: '#ef4444', width: 1.5 }
        );
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getLow(-18), 
            endIdx: end, endPrice: getLow(-1), 
            color: '#10b981', width: 1.5 }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 14, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'triple_bottom':
      explanation = isBullish ? 'Three equal lows + neckline break → strong bullish reversal' : 'Pattern detected';
      {
        const leftIdx = safeIdx(-22);
        highlights.push(
          { type: 'circle', idx: leftIdx, price: getLow(-22), 
            radius: 5, color: '#10b981', pulse: true }
        );
        
        const midIdx = safeIdx(-14);
        highlights.push(
          { type: 'circle', idx: midIdx, price: getLow(-14), 
            radius: 5, color: '#10b981', pulse: true }
        );
        
        const rightIdx = safeIdx(-6);
        highlights.push(
          { type: 'circle', idx: rightIdx, price: getLow(-6), 
            radius: 5, color: '#10b981', pulse: true }
        );
        
        const necklinePrice = Math.max(getHigh(-18), getHigh(-10));
        highlights.push(
          { type: 'line', startIdx: safeIdx(-24), startPrice: necklinePrice, 
            endIdx: safeIdx(2), endPrice: necklinePrice, 
            color: '#fbbf24', dashed: false, width: 1.5 }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 14, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'triple_top':
      explanation = isBullish ? 'Pattern detected' : 'Three equal highs + neckline break → strong bearish reversal';
      {
        const leftIdx = safeIdx(-22);
        highlights.push(
          { type: 'circle', idx: leftIdx, price: getHigh(-22), 
            radius: 5, color: '#ef4444', pulse: true }
        );
        
        const midIdx = safeIdx(-14);
        highlights.push(
          { type: 'circle', idx: midIdx, price: getHigh(-14), 
            radius: 5, color: '#ef4444', pulse: true }
        );
        
        const rightIdx = safeIdx(-6);
        highlights.push(
          { type: 'circle', idx: rightIdx, price: getHigh(-6), 
            radius: 5, color: '#ef4444', pulse: true }
        );
        
        const necklinePrice = Math.min(getLow(-18), getLow(-10));
        highlights.push(
          { type: 'line', startIdx: safeIdx(-24), startPrice: necklinePrice, 
            endIdx: safeIdx(2), endPrice: necklinePrice, 
            color: '#fbbf24', dashed: false, width: 1.5 }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 14, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'rounding_bottom':
      explanation = isBullish ? 'Smooth U-shaped recovery → bullish reversal' : 'Pattern detected';
      {
        const bottomIdx = safeIdx(-12);
        highlights.push(
          { type: 'circle', idx: bottomIdx, price: getLow(-12), 
            radius: 7, color: '#10b981', pulse: true }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 12, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'rounding_top':
      explanation = isBullish ? 'Pattern detected' : 'Smooth inverted U → bearish reversal';
      {
        const topIdx = safeIdx(-12);
        highlights.push(
          { type: 'circle', idx: topIdx, price: getHigh(-12), 
            radius: 7, color: '#ef4444', pulse: true }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 12, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'v-bottom':
    case 'v_bottom':
      explanation = isBullish ? 'Sharp reversal from low → strong bullish momentum' : 'Pattern detected';
      {
        const vBottomIdx = safeIdx(-5);
        highlights.push(
          { type: 'circle', idx: vBottomIdx, price: getLow(-5), 
            radius: 6, color: '#10b981', pulse: true }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 14, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'v-top':
    case 'v_top':
      explanation = isBullish ? 'Pattern detected' : 'Sharp reversal from high → strong bearish momentum';
      {
        const vTopIdx = safeIdx(-5);
        highlights.push(
          { type: 'circle', idx: vTopIdx, price: getHigh(-5), 
            radius: 6, color: '#ef4444', pulse: true }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 14, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'bullish_engulfing_pattern':
      explanation = isBullish ? 'Large bullish candle engulfs prior bearish → reversal signal' : 'Pattern detected';
      {
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 10, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'bearish_engulfing_pattern':
      explanation = isBullish ? 'Pattern detected' : 'Large bearish candle engulfs prior bullish → reversal signal';
      {
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 10, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'bull_flag_tight':
      explanation = isBullish ? 'Tight consolidation + volume surge → breakout imminent' : 'Pattern detected';
      {
        const flagStart = safeIdx(-8);
        const flagEnd = safeIdx(-1);
        
        highlights.push(
          { type: 'line', startIdx: flagStart, startPrice: getHigh(-7), 
            endIdx: flagEnd, endPrice: getHigh(-2), 
            color: '#ef4444', width: 1.5 }
        );
        
        highlights.push(
          { type: 'line', startIdx: flagStart, startPrice: getLow(-7), 
            endIdx: flagEnd, endPrice: getLow(-2), 
            color: '#10b981', width: 1.5 }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 8, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'bear_flag_tight':
      explanation = isBullish ? 'Pattern detected' : 'Tight consolidation + volume surge → breakdown imminent';
      {
        const flagStart = safeIdx(-8);
        const flagEnd = safeIdx(-1);
        
        highlights.push(
          { type: 'line', startIdx: flagStart, startPrice: getHigh(-7), 
            endIdx: flagEnd, endPrice: getHigh(-2), 
            color: '#ef4444', width: 1.5 }
        );
        
        highlights.push(
          { type: 'line', startIdx: flagStart, startPrice: getLow(-7), 
            endIdx: flagEnd, endPrice: getLow(-2), 
            color: '#10b981', width: 1.5 }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 8, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'flat_base_breakout':
      explanation = isBullish ? 'Extended flat consolidation → volume breakout → bullish move' : 'Pattern detected';
      {
        const baseStart = safeIdx(-16);
        const baseEnd = safeIdx(-1);
        const basePrice = (getHigh(-8) + getLow(-8)) / 2;
        
        highlights.push(
          { type: 'line', startIdx: baseStart, startPrice: basePrice + basePrice * 0.01, 
            endIdx: baseEnd, endPrice: basePrice + basePrice * 0.01, 
            color: '#ef4444', width: 1.5, dashed: true }
        );
        
        highlights.push(
          { type: 'line', startIdx: baseStart, startPrice: basePrice - basePrice * 0.01, 
            endIdx: baseEnd, endPrice: basePrice - basePrice * 0.01, 
            color: '#10b981', width: 1.5, dashed: true }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 10, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'distribution_pattern':
      explanation = isBullish ? 'Pattern detected' : 'Extended topping + volume decrease → bearish breakdown';
      {
        const distStart = safeIdx(-16);
        const distEnd = safeIdx(-1);
        const distPrice = (getHigh(-8) + getLow(-8)) / 2;
        
        highlights.push(
          { type: 'line', startIdx: distStart, startPrice: distPrice + distPrice * 0.015, 
            endIdx: distEnd, endPrice: distPrice + distPrice * 0.01, 
            color: '#ef4444', width: 1.5, dashed: true }
        );
        
        highlights.push(
          { type: 'line', startIdx: distStart, startPrice: distPrice - distPrice * 0.01, 
            endIdx: distEnd, endPrice: distPrice - distPrice * 0.015, 
            color: '#10b981', width: 1.5, dashed: true }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 10, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    // Classic Candlestick Patterns
    case 'three_white_soldiers':
      explanation = isBullish ? 'Three consecutive strong bullish candles → powerful uptrend' : 'Pattern detected';
      {
        highlights.push(
          { type: 'circle', idx: safeIdx(-2), price: getClose(-2), radius: 4, color: '#10b981', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-1), price: getClose(-1), radius: 4, color: '#10b981', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(0), price: getClose(0), radius: 4, color: '#10b981', pulse: true }
        );
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 12, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'three_black_crows':
      explanation = isBullish ? 'Pattern detected' : 'Three consecutive strong bearish candles → powerful downtrend';
      {
        highlights.push(
          { type: 'circle', idx: safeIdx(-2), price: getClose(-2), radius: 4, color: '#ef4444', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-1), price: getClose(-1), radius: 4, color: '#ef4444', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(0), price: getClose(0), radius: 4, color: '#ef4444', pulse: true }
        );
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 12, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'bullish_harami':
      explanation = isBullish ? 'Small candle inside large bearish → potential bullish reversal' : 'Pattern detected';
      {
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 10, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'bearish_harami':
      explanation = isBullish ? 'Pattern detected' : 'Small candle inside large bullish → potential bearish reversal';
      {
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 10, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'morning_star':
      explanation = isBullish ? 'Bearish → small doji → bullish → strong reversal signal' : 'Pattern detected';
      {
        highlights.push(
          { type: 'circle', idx: safeIdx(-1), price: getClose(-1), radius: 5, color: '#fbbf24', pulse: true }
        );
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 12, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'evening_star':
      explanation = isBullish ? 'Pattern detected' : 'Bullish → small doji → bearish → strong reversal signal';
      {
        highlights.push(
          { type: 'circle', idx: safeIdx(-1), price: getClose(-1), radius: 5, color: '#fbbf24', pulse: true }
        );
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 12, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'piercing_pattern':
      explanation = isBullish ? 'Bullish candle pierces midpoint of prior bearish → reversal' : 'Pattern detected';
      {
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 10, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'dark_cloud_cover':
      explanation = isBullish ? 'Pattern detected' : 'Bearish candle covers midpoint of prior bullish → reversal';
      {
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 10, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'shooting_star':
      explanation = isBullish ? 'Pattern detected' : 'Long upper wick after uptrend → bearish reversal signal';
      {
        highlights.push(
          { type: 'circle', idx: safeIdx(0), price: getHigh(0), radius: 5, color: '#ef4444', pulse: true }
        );
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 12, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'hanging_man':
      explanation = isBullish ? 'Pattern detected' : 'Long lower wick after uptrend → potential bearish reversal';
      {
        highlights.push(
          { type: 'circle', idx: safeIdx(0), price: getLow(0), radius: 5, color: '#ef4444', pulse: true }
        );
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 10, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    // Modern Technical Patterns
    case 'darvas_box':
      explanation = isBullish ? 'Consolidation box + volume breakout → bullish continuation' : 'Pattern detected';
      {
        const boxStart = safeIdx(-12);
        const boxEnd = safeIdx(-1);
        const boxHigh = Math.max(...candles.slice(Math.max(0, decisionIndex - 12), decisionIndex).map(c => c.high));
        const boxLow = Math.min(...candles.slice(Math.max(0, decisionIndex - 12), decisionIndex).map(c => c.low));
        
        highlights.push(
          { type: 'line', startIdx: boxStart, startPrice: boxHigh, 
            endIdx: boxEnd, endPrice: boxHigh, 
            color: '#ef4444', width: 2, dashed: false }
        );
        
        highlights.push(
          { type: 'line', startIdx: boxStart, startPrice: boxLow, 
            endIdx: boxEnd, endPrice: boxLow, 
            color: '#10b981', width: 2, dashed: false }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 12, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'high_tight_flag':
      explanation = isBullish ? 'Steep rally + tight pullback → explosive breakout potential' : 'Pattern detected';
      {
        const flagStart = safeIdx(-6);
        const flagEnd = safeIdx(-1);
        
        highlights.push(
          { type: 'line', startIdx: flagStart, startPrice: getHigh(-5), 
            endIdx: flagEnd, endPrice: getHigh(-1), 
            color: '#ef4444', width: 1.5 }
        );
        
        highlights.push(
          { type: 'line', startIdx: flagStart, startPrice: getLow(-5), 
            endIdx: flagEnd, endPrice: getLow(-1), 
            color: '#10b981', width: 1.5 }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 14, direction: 'up', 
            color: '#10b981', size: 20 }
        );
      }
      break;

    case 'pocket_pivot':
      explanation = isBullish ? 'Volume surge above avg on up-day → institutional buying' : 'Pattern detected';
      {
        highlights.push(
          { type: 'circle', idx: safeIdx(0), price: getClose(0), radius: 7, color: '#10b981', pulse: true }
        );
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 12, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'vcp_(volatility_contraction)':
    case 'vcp_volatility_contraction':
      explanation = isBullish ? 'Multiple tightening bases → coiling spring → breakout imminent' : 'Pattern detected';
      {
        highlights.push(
          { type: 'line', startIdx: safeIdx(-16), startPrice: getHigh(-16), 
            endIdx: safeIdx(-1), endPrice: getHigh(-1), 
            color: '#ef4444', width: 1.5, dashed: true }
        );
        
        highlights.push(
          { type: 'line', startIdx: safeIdx(-16), startPrice: getLow(-16), 
            endIdx: safeIdx(-1), endPrice: getLow(-1), 
            color: '#10b981', width: 1.5, dashed: true }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 14, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'bullish_rectangle':
      explanation = isBullish ? 'Horizontal consolidation + breakout → continuation' : 'Pattern detected';
      {
        const rectStart = safeIdx(-14);
        const rectEnd = safeIdx(-1);
        const rectHigh = Math.max(...candles.slice(Math.max(0, decisionIndex - 14), decisionIndex).map(c => c.high));
        const rectLow = Math.min(...candles.slice(Math.max(0, decisionIndex - 14), decisionIndex).map(c => c.low));
        
        highlights.push(
          { type: 'line', startIdx: rectStart, startPrice: rectHigh, 
            endIdx: rectEnd, endPrice: rectHigh, 
            color: '#ef4444', width: 1.5, dashed: true }
        );
        
        highlights.push(
          { type: 'line', startIdx: rectStart, startPrice: rectLow, 
            endIdx: rectEnd, endPrice: rectLow, 
            color: '#10b981', width: 1.5, dashed: true }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 10, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'bearish_rectangle':
      explanation = isBullish ? 'Pattern detected' : 'Horizontal consolidation + breakdown → continuation';
      {
        const rectStart = safeIdx(-14);
        const rectEnd = safeIdx(-1);
        const rectHigh = Math.max(...candles.slice(Math.max(0, decisionIndex - 14), decisionIndex).map(c => c.high));
        const rectLow = Math.min(...candles.slice(Math.max(0, decisionIndex - 14), decisionIndex).map(c => c.low));
        
        highlights.push(
          { type: 'line', startIdx: rectStart, startPrice: rectHigh, 
            endIdx: rectEnd, endPrice: rectHigh, 
            color: '#ef4444', width: 1.5, dashed: true }
        );
        
        highlights.push(
          { type: 'line', startIdx: rectStart, startPrice: rectLow, 
            endIdx: rectEnd, endPrice: rectLow, 
            color: '#10b981', width: 1.5, dashed: true }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 10, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'broadening_formation':
      explanation = isBullish ? 'Pattern detected' : 'Expanding volatility → megaphone top → bearish breakdown';
      {
        const start = safeIdx(-18);
        const end = safeIdx(-1);
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getHigh(-18), 
            endIdx: end, endPrice: getHigh(-1), 
            color: '#ef4444', width: 1.5 }
        );
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getLow(-18), 
            endIdx: end, endPrice: getLow(-1), 
            color: '#10b981', width: 1.5 }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 12, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'death_cross_setup':
      explanation = isBullish ? 'Pattern detected' : 'Short MA crosses below long MA → bearish momentum';
      {
        highlights.push(
          { type: 'circle', idx: safeIdx(-3), price: getClose(-3), radius: 6, color: '#ef4444', pulse: true }
        );
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 12, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    // Harmonic Patterns - Bullish
    case 'gartley_bullish':
      explanation = isBullish ? 'Fibonacci ratios align: XA→AB→BC→CD → bullish reversal zone' : 'Pattern detected';
      {
        const points = [
          { idx: safeIdx(-20), price: getHigh(-20), label: 'X' },
          { idx: safeIdx(-15), price: getLow(-15), label: 'A' },
          { idx: safeIdx(-10), price: getHigh(-10), label: 'B' },
          { idx: safeIdx(-5), price: getLow(-5), label: 'C' },
          { idx: safeIdx(0), price: getLow(0), label: 'D' }
        ];
        
        points.forEach(p => {
          highlights.push(
            { type: 'circle', idx: p.idx, price: p.price, radius: 5, color: '#fbbf24', pulse: true }
          );
        });
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 14, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'bat_pattern_bullish':
      explanation = isBullish ? 'Bat harmonic: precise Fib retracement → high-probability reversal' : 'Pattern detected';
      {
        highlights.push(
          { type: 'circle', idx: safeIdx(-18), price: getHigh(-18), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-12), price: getLow(-12), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-6), price: getHigh(-6), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(0), price: getLow(0), radius: 6, color: '#10b981', pulse: true }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 14, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'crab_pattern_bullish':
      explanation = isBullish ? 'Crab harmonic: extreme extension → powerful reversal zone' : 'Pattern detected';
      {
        highlights.push(
          { type: 'circle', idx: safeIdx(-20), price: getHigh(-20), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-14), price: getLow(-14), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-7), price: getHigh(-7), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(0), price: getLow(0), radius: 6, color: '#10b981', pulse: true }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 16, direction: 'up', 
            color: '#10b981', size: 20 }
        );
      }
      break;

    case 'butterfly_pattern_bullish':
      explanation = isBullish ? 'Butterfly harmonic: 127.2% extension → reversal imminent' : 'Pattern detected';
      {
        highlights.push(
          { type: 'circle', idx: safeIdx(-18), price: getHigh(-18), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-12), price: getLow(-12), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-6), price: getHigh(-6), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(0), price: getLow(0), radius: 6, color: '#10b981', pulse: true }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 14, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    // Harmonic Patterns - Bearish
    case 'gartley_bearish':
      explanation = isBullish ? 'Pattern detected' : 'Fibonacci ratios align: XA→AB→BC→CD → bearish reversal zone';
      {
        const points = [
          { idx: safeIdx(-20), price: getLow(-20) },
          { idx: safeIdx(-15), price: getHigh(-15) },
          { idx: safeIdx(-10), price: getLow(-10) },
          { idx: safeIdx(-5), price: getHigh(-5) },
          { idx: safeIdx(0), price: getHigh(0) }
        ];
        
        points.forEach(p => {
          highlights.push(
            { type: 'circle', idx: p.idx, price: p.price, radius: 5, color: '#9b7618', pulse: true }
          );
        });
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 14, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'bat_pattern_bearish':
      explanation = isBullish ? 'Pattern detected' : 'Bat harmonic: precise Fib retracement → high-probability reversal';
      {
        highlights.push(
          { type: 'circle', idx: safeIdx(-18), price: getLow(-18), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-12), price: getHigh(-12), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-6), price: getLow(-6), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(0), price: getHigh(0), radius: 6, color: '#ef4444', pulse: true }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 14, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'crab_pattern_bearish':
      explanation = isBullish ? 'Pattern detected' : 'Crab harmonic: extreme extension → powerful reversal zone';
      {
        highlights.push(
          { type: 'circle', idx: safeIdx(-20), price: getLow(-20), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-14), price: getHigh(-14), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-7), price: getLow(-7), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(0), price: getHigh(0), radius: 6, color: '#ef4444', pulse: true }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 16, direction: 'down', 
            color: '#ef4444', size: 20 }
        );
      }
      break;

    case 'butterfly_pattern_bearish':
      explanation = isBullish ? 'Pattern detected' : 'Butterfly harmonic: 127.2% extension → reversal imminent';
      {
        highlights.push(
          { type: 'circle', idx: safeIdx(-18), price: getLow(-18), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-12), price: getHigh(-12), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(-6), price: getLow(-6), radius: 5, color: '#9b7618', pulse: true }
        );
        highlights.push(
          { type: 'circle', idx: safeIdx(0), price: getHigh(0), radius: 6, color: '#ef4444', pulse: true }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 14, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    // Wyckoff Patterns
    case 'wyckoff_spring':
      explanation = isBullish ? 'False breakdown below support → smart money accumulation → bullish reversal' : 'Pattern detected';
      {
        const supportLevel = getLow(-8);
        
        highlights.push(
          { type: 'line', startIdx: safeIdx(-16), startPrice: supportLevel, 
            endIdx: safeIdx(2), endPrice: supportLevel, 
            color: '#10b981', width: 2, dashed: true }
        );
        
        highlights.push(
          { type: 'circle', idx: safeIdx(-2), price: getLow(-2), radius: 7, color: '#10b981', pulse: true }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 14, direction: 'up', 
            color: '#10b981', size: 20 }
        );
      }
      break;

    case 'wyckoff_upthrust':
      explanation = isBullish ? 'Pattern detected' : 'False breakout above resistance → smart money distribution → bearish reversal';
      {
        const resistanceLevel = getHigh(-8);
        
        highlights.push(
          { type: 'line', startIdx: safeIdx(-16), startPrice: resistanceLevel, 
            endIdx: safeIdx(2), endPrice: resistanceLevel, 
            color: '#ef4444', width: 2, dashed: true }
        );
        
        highlights.push(
          { type: 'circle', idx: safeIdx(-2), price: getHigh(-2), radius: 7, color: '#ef4444', pulse: true }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 14, direction: 'down', 
            color: '#ef4444', size: 20 }
        );
      }
      break;

    // Elliott Wave Patterns
    case 'elliott_wave_5_complete':
      explanation = isBullish ? 'Wave 5 exhaustion → ABC correction begins → bullish opportunity ahead' : 'Pattern detected';
      {
        const waves = [
          { idx: safeIdx(-20), price: getLow(-20) },
          { idx: safeIdx(-16), price: getHigh(-16) },
          { idx: safeIdx(-12), price: getLow(-12) },
          { idx: safeIdx(-6), price: getHigh(-6) },
          { idx: safeIdx(0), price: getLow(0) }
        ];
        
        waves.forEach((w, i) => {
          highlights.push(
            { type: 'circle', idx: w.idx, price: w.price, 
              radius: i === waves.length - 1 ? 7 : 4, 
              color: '#38bdf8', pulse: i === waves.length - 1 }
          );
        });
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 14, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'elliott_wave_c_complete':
      explanation = isBullish ? 'Pattern detected' : 'Wave C exhaustion → new trend begins → bearish opportunity ahead';
      {
        const waves = [
          { idx: safeIdx(-20), price: getHigh(-20) },
          { idx: safeIdx(-16), price: getLow(-16) },
          { idx: safeIdx(-12), price: getHigh(-12) },
          { idx: safeIdx(-6), price: getLow(-6) },
          { idx: safeIdx(0), price: getHigh(0) }
        ];
        
        waves.forEach((w, i) => {
          highlights.push(
            { type: 'circle', idx: w.idx, price: w.price, 
              radius: i === waves.length - 1 ? 7 : 4, 
              color: '#38bdf8', pulse: i === waves.length - 1 }
          );
        });
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 14, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    // Advanced Broadening Wedges
    case 'descending_broadening_wedge':
      explanation = isBullish ? 'Expanding range with downward bias → breakout → bullish reversal' : 'Pattern detected';
      {
        const start = safeIdx(-18);
        const mid = safeIdx(-9);
        const end = safeIdx(-1);
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getHigh(-18), 
            endIdx: end, endPrice: getHigh(-1) + (getHigh(-1) - getHigh(-18)) * 0.3, 
            color: '#ef4444', width: 1.5 }
        );
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getLow(-18), 
            endIdx: end, endPrice: getLow(-1) - (getLow(-18) - getLow(-1)) * 0.3, 
            color: '#10b981', width: 1.5 }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 14, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'ascending_broadening_wedge':
      explanation = isBullish ? 'Pattern detected' : 'Expanding range with upward bias → breakdown → bearish reversal';
      {
        const start = safeIdx(-18);
        const end = safeIdx(-1);
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getHigh(-18), 
            endIdx: end, endPrice: getHigh(-1) + (getHigh(-1) - getHigh(-18)) * 0.3, 
            color: '#ef4444', width: 1.5 }
        );
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getLow(-18), 
            endIdx: end, endPrice: getLow(-1) - (getLow(-18) - getLow(-1)) * 0.3, 
            color: '#10b981', width: 1.5 }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 14, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    // Scallop Patterns
    case 'inverse_scallop':
      explanation = isBullish ? 'J-shaped recovery → accelerating momentum → bullish continuation' : 'Pattern detected';
      {
        highlights.push(
          { type: 'circle', idx: safeIdx(-10), price: getLow(-10), radius: 6, color: '#10b981', pulse: true }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 12, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'scallop_top':
      explanation = isBullish ? 'Pattern detected' : 'Inverted J-shape → decelerating momentum → bearish reversal';
      {
        highlights.push(
          { type: 'circle', idx: safeIdx(-10), price: getHigh(-10), radius: 6, color: '#ef4444', pulse: true }
        );
        
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 12, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    default:
      explanation = isBullish ? 'Bullish pattern detected' : 'Bearish pattern detected';
      highlights.push(
        { type: 'arrow', idx: safeIdx(0), price: getClose(0) + (isBullish ? 12 : -12), 
          direction: isBullish ? 'up' : 'down',
          color: isBullish ? '#10b981' : '#ef4444', size: 18 }
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
  // CRITICAL: Only generate setups with CLEAR ex-ante edge
  // "Obvious in hindsight" rule: if you can't see it BEFORE, it's not a valid question
  generate() {
    const { contextSize } = this.config;
    
    let attempts = 0;
    let structure = null;
    
    // Keep generating until we get a HIGH-QUALITY setup with clear edge
    while (attempts < 50) {
      attempts++;
      
      // Determine setup type and signal FIRST (outcome-driven)
      const setupType = this._pickSetupType();
      const signal = setupType.signal; // BUY or SELL

      // Build context that STRONGLY supports this signal
      const context = this._buildContext(setupType, contextSize);

      // Build the actual setup candles with CLEAR structural evidence
      const setupCandles = this._buildSetup(setupType, context);

      // Combine: context + setup
      const candles = [...context.candles, ...setupCandles];
      const decisionIndex = candles.length - 1;

      // CRITICAL: Validate edge quality BEFORE accepting
      const edgeScore = this._validateEdge(candles, decisionIndex, setupType, context);
      
      // Minimum 2/5 edge indicators required (from checklist)
      if (edgeScore >= 2) {
        // Generate continuation based on signal
        const continuation = this._generateContinuation(signal, setupType, candles);
        
        structure = {
          candles,
          decisionIndex,
          continuation,
          signal,
          context: {
            trendBias: context.bias,
            priorStructure: context.priorPattern,
            momentum: setupType.momentum,
            quality: setupType.quality,
            edgeScore, // Expose edge quality
          },
          pattern: setupType.name,
          regime: context.regime,
        };
        break;
      }
    }
    
    // Fallback: if somehow failed after 50 attempts, generate guaranteed clean setup
    if (!structure) {
      return this._generateGuaranteedCleanSetup();
    }
    
    return structure;
  }
  
  // NEW: Validate edge quality using the checklist
  // Returns score 0-5 based on how many edge indicators are present
  _validateEdge(candles, decisionIndex, setupType, context) {
    let score = 0;
    const lookback = 15;
    const recentCandles = candles.slice(Math.max(0, decisionIndex - lookback), decisionIndex + 1);
    
    if (recentCandles.length < 5) return 0;
    
    // 1. Higher highs / higher lows (for bullish) OR Lower highs / lower lows (for bearish)
    const hasStructuralTrend = this._checkStructuralTrend(recentCandles, setupType.signal);
    if (hasStructuralTrend) score++;
    
    // 2. Clear range hold (support/resistance respected)
    const hasRangeHold = this._checkRangeHold(recentCandles, setupType.signal);
    if (hasRangeHold) score++;
    
    // 3. Momentum expansion on decision candle
    const hasMomentum = this._checkMomentumExpansion(candles, decisionIndex);
    if (hasMomentum) score++;
    
    // 4. Context alignment (HTF trend matches signal)
    const contextAligned = (
      (setupType.signal === "BUY" && (context.regime === "uptrend" || context.regime === "downtrend_exhausting")) ||
      (setupType.signal === "SELL" && (context.regime === "downtrend" || context.regime === "uptrend_exhausting"))
    );
    if (contextAligned) score++;
    
    // 5. Fakeout / rejection clearly visible
    const hasRejection = this._checkRejection(recentCandles, setupType.signal);
    if (hasRejection) score++;
    
    return score;
  }
  
  _checkStructuralTrend(candles, signal) {
    if (candles.length < 6) return false;
    
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    
    if (signal === "BUY") {
      // Check for higher lows
      let higherLows = 0;
      for (let i = 3; i < lows.length; i++) {
        const recentLow = Math.min(...lows.slice(i - 3, i));
        if (lows[i] > recentLow * 1.001) higherLows++;
      }
      return higherLows >= 2;
    } else {
      // Check for lower highs
      let lowerHighs = 0;
      for (let i = 3; i < highs.length; i++) {
        const recentHigh = Math.max(...highs.slice(i - 3, i));
        if (highs[i] < recentHigh * 0.999) lowerHighs++;
      }
      return lowerHighs >= 2;
    }
  }
  
  _checkRangeHold(candles, signal) {
    if (candles.length < 8) return false;
    
    const lows = candles.map(c => c.low);
    const highs = candles.map(c => c.high);
    
    if (signal === "BUY") {
      // Support level held multiple times
      const supportLevel = Math.min(...lows);
      const touches = lows.filter(l => Math.abs(l - supportLevel) / supportLevel < 0.015).length;
      return touches >= 2;
    } else {
      // Resistance level held multiple times
      const resistanceLevel = Math.max(...highs);
      const touches = highs.filter(h => Math.abs(h - resistanceLevel) / resistanceLevel < 0.015).length;
      return touches >= 2;
    }
  }
  
  _checkMomentumExpansion(candles, decisionIndex) {
    if (decisionIndex < 3) return false;
    
    const current = candles[decisionIndex];
    const currentRange = current.high - current.low;
    
    // Compare to recent average range
    const recentRanges = [];
    for (let i = Math.max(0, decisionIndex - 5); i < decisionIndex; i++) {
      recentRanges.push(candles[i].high - candles[i].low);
    }
    const avgRange = recentRanges.reduce((a, b) => a + b, 0) / recentRanges.length;
    
    // Decision candle should show expansion (20% larger)
    return currentRange > avgRange * 1.2;
  }
  
  _checkRejection(candles, signal) {
    if (candles.length < 4) return false;
    
    // Look for rejection wicks in recent candles
    for (let i = Math.max(0, candles.length - 4); i < candles.length; i++) {
      const c = candles[i];
      const bodySize = Math.abs(c.close - c.open);
      const totalRange = c.high - c.low;
      
      if (signal === "BUY") {
        // Look for lower wick rejection (bullish)
        const lowerWick = Math.min(c.open, c.close) - c.low;
        if (lowerWick > bodySize * 1.5 && lowerWick / totalRange > 0.4) {
          return true;
        }
      } else {
        // Look for upper wick rejection (bearish)
        const upperWick = c.high - Math.max(c.open, c.close);
        if (upperWick > bodySize * 1.5 && upperWick / totalRange > 0.4) {
          return true;
        }
      }
    }
    return false;
  }
  
  // NEW: Guaranteed clean setup (fallback if validation fails)
  _generateGuaranteedCleanSetup() {
    const signal = this.rng() < 0.5 ? "BUY" : "SELL";
    const candles = [];
    let price = 1000;
    
    // Phase 1: Strong trend (30 candles)
    const trendDir = signal === "BUY" ? 1 : -1;
    for (let i = 0; i < 30; i++) {
      const isBull = signal === "BUY" ? this.rng() < 0.7 : this.rng() < 0.3;
      const bodySize = price * 0.015;
      const open = price;
      price *= 1 + trendDir * 0.003;
      const close = isBull ? open + bodySize : open - bodySize;
      const high = Math.max(open, close) + bodySize * 0.3;
      const low = Math.min(open, close) - bodySize * 0.3;
      candles.push({ open, high, low, close });
      price = close;
    }
    
    // Phase 2: Clean pullback (8 candles)
    for (let i = 0; i < 8; i++) {
      const isBull = signal === "BUY" ? this.rng() < 0.4 : this.rng() < 0.6;
      const bodySize = price * 0.008;
      const open = price;
      price *= 1 - trendDir * 0.001;
      const close = isBull ? open + bodySize : open - bodySize;
      const high = Math.max(open, close) + bodySize * 0.2;
      const low = Math.min(open, close) - bodySize * 0.2;
      candles.push({ open, high, low, close });
      price = close;
    }
    
    // Phase 3: Breakout candle
    const bodySize = price * 0.02;
    const open = price;
    const close = signal === "BUY" ? open + bodySize : open - bodySize;
    const high = signal === "BUY" ? close + bodySize * 0.2 : Math.max(open, close) + bodySize * 0.1;
    const low = signal === "BUY" ? Math.min(open, close) - bodySize * 0.1 : close - bodySize * 0.2;
    candles.push({ open, high, low, close });
    
    const decisionIndex = candles.length - 1;
    
    // Generate continuation
    const continuation = this._generateContinuation(signal, {
      type: signal === "BUY" ? "bullish_continuation" : "bearish_continuation",
      name: signal === "BUY" ? "Bull Flag" : "Bear Flag",
      willSucceed: true
    }, candles);
    
    return {
      candles,
      decisionIndex,
      continuation,
      signal,
      context: {
        trendBias: signal === "BUY" ? "Bullish" : "Bearish",
        priorStructure: "Clean Trend",
        momentum: "strong",
        quality: "guaranteed",
        edgeScore: 5,
      },
      pattern: signal === "BUY" ? "Bull Flag" : "Bear Flag",
      regime: signal === "BUY" ? "uptrend" : "downtrend",
    };
  }

  _pickSetupType() {
    const r = this.rng();
    const { cleanRatio } = this.config;

    // Distribution: 50% BUY, 50% SELL - no HOLD
    // Massively expanded pattern library with classic and modern patterns
    if (r < 0.0625) {
      // Bullish continuation - Classic flags and pennants
      const patterns = ["Bull Flag", "Bull Pennant", "Ascending Triangle", "Rising Wedge (Continuation)"];
      return {
        type: "bullish_continuation",
        signal: "BUY",
        name: patterns[Math.floor(this.rng() * patterns.length)],
        momentum: "strong",
        quality: "clean",
        willSucceed: true,
      };
    } else if (r < 0.125) {
      // Bullish continuation - Channels and breakouts
      const patterns = ["Ascending Channel", "Bull Flag Tight", "Flat Base Breakout", "Darvas Box"];
      return {
        type: "bullish_continuation",
        signal: "BUY",
        name: patterns[Math.floor(this.rng() * patterns.length)],
        momentum: "strong",
        quality: "clean",
        willSucceed: true,
      };
    } else if (r < 0.1875) {
      // Bullish continuation - Modern patterns
      const patterns = ["Bullish Rectangle", "High Tight Flag", "Pocket Pivot", "VCP (Volatility Contraction)"];
      return {
        type: "bullish_continuation",
        signal: "BUY",
        name: patterns[Math.floor(this.rng() * patterns.length)],
        momentum: "strong",
        quality: "clean",
        willSucceed: true,
      };
    } else if (r < 0.25) {
      // Bullish continuation - Advanced patterns
      const patterns = ["Three White Soldiers", "Bullish Harami", "Morning Star", "Piercing Pattern"];
      return {
        type: "bullish_continuation",
        signal: "BUY",
        name: patterns[Math.floor(this.rng() * patterns.length)],
        momentum: "strong",
        quality: "clean",
        willSucceed: true,
      };
    } else if (r < 0.3125) {
      // Bearish continuation - Classic flags and pennants
      const patterns = ["Bear Flag", "Bear Pennant", "Descending Triangle", "Falling Wedge (Continuation)"];
      return {
        type: "bearish_continuation",
        signal: "SELL",
        name: patterns[Math.floor(this.rng() * patterns.length)],
        momentum: "strong",
        quality: "clean",
        willSucceed: true,
      };
    } else if (r < 0.375) {
      // Bearish continuation - Channels and breakdowns
      const patterns = ["Descending Channel", "Bear Flag Tight", "Distribution Pattern", "Broadening Formation"];
      return {
        type: "bearish_continuation",
        signal: "SELL",
        name: patterns[Math.floor(this.rng() * patterns.length)],
        momentum: "strong",
        quality: "clean",
        willSucceed: true,
      };
    } else if (r < 0.4375) {
      // Bearish continuation - Modern patterns
      const patterns = ["Bearish Rectangle", "Death Cross Setup", "Dark Cloud Cover", "Evening Star"];
      return {
        type: "bearish_continuation",
        signal: "SELL",
        name: patterns[Math.floor(this.rng() * patterns.length)],
        momentum: "strong",
        quality: "clean",
        willSucceed: true,
      };
    } else if (r < 0.5) {
      // Bearish continuation - Advanced patterns
      const patterns = ["Three Black Crows", "Bearish Harami", "Shooting Star", "Hanging Man"];
      return {
        type: "bearish_continuation",
        signal: "SELL",
        name: patterns[Math.floor(this.rng() * patterns.length)],
        momentum: "strong",
        quality: "clean",
        willSucceed: true,
      };
    } else if (r < 0.5625) {
      // Bullish reversal - Classic patterns
      const patterns = ["Double Bottom", "Inverse H&S", "Falling Wedge (Reversal)", "Cup & Handle"];
      return {
        type: "bullish_reversal",
        signal: "BUY",
        name: patterns[Math.floor(this.rng() * patterns.length)],
        momentum: "building",
        quality: "good",
        willSucceed: true,
      };
    } else if (r < 0.625) {
      // Bullish reversal - Advanced classic patterns
      const patterns = ["Triple Bottom", "Rounding Bottom", "V-Bottom", "Bullish Engulfing Pattern"];
      return {
        type: "bullish_reversal",
        signal: "BUY",
        name: patterns[Math.floor(this.rng() * patterns.length)],
        momentum: "building",
        quality: "good",
        willSucceed: true,
      };
    } else if (r < 0.6875) {
      // Bullish reversal - Harmonic patterns
      const patterns = ["Gartley Bullish", "Bat Pattern Bullish", "Crab Pattern Bullish", "Butterfly Pattern Bullish"];
      return {
        type: "bullish_reversal",
        signal: "BUY",
        name: patterns[Math.floor(this.rng() * patterns.length)],
        momentum: "building",
        quality: "good",
        willSucceed: true,
      };
    } else if (r < 0.75) {
      // Bullish reversal - Wyckoff & Elliott Wave
      const patterns = ["Wyckoff Spring", "Elliott Wave 5 Complete", "Descending Broadening Wedge", "Inverse Scallop"];
      return {
        type: "bullish_reversal",
        signal: "BUY",
        name: patterns[Math.floor(this.rng() * patterns.length)],
        momentum: "building",
        quality: "good",
        willSucceed: true,
      };
    } else if (r < 0.8125) {
      // Bearish reversal - Classic patterns
      const patterns = ["Double Top", "Head & Shoulders", "Rising Wedge (Reversal)", "Inverse Cup & Handle"];
      return {
        type: "bearish_reversal",
        signal: "SELL",
        name: patterns[Math.floor(this.rng() * patterns.length)],
        momentum: "building",
        quality: "good",
        willSucceed: true,
      };
    } else if (r < 0.875) {
      // Bearish reversal - Advanced classic patterns
      const patterns = ["Triple Top", "Rounding Top", "V-Top", "Bearish Engulfing Pattern"];
      return {
        type: "bearish_reversal",
        signal: "SELL",
        name: patterns[Math.floor(this.rng() * patterns.length)],
        momentum: "building",
        quality: "good",
        willSucceed: true,
      };
    } else if (r < 0.9375) {
      // Bearish reversal - Harmonic patterns
      const patterns = ["Gartley Bearish", "Bat Pattern Bearish", "Crab Pattern Bearish", "Butterfly Pattern Bearish"];
      return {
        type: "bearish_reversal",
        signal: "SELL",
        name: patterns[Math.floor(this.rng() * patterns.length)],
        momentum: "building",
        quality: "good",
        willSucceed: true,
      };
    } else {
      // Bearish reversal - Wyckoff & Elliott Wave
      const patterns = ["Wyckoff Upthrust", "Elliott Wave C Complete", "Ascending Broadening Wedge", "Scallop Top"];
      return {
        type: "bearish_reversal",
        signal: "SELL",
        name: patterns[Math.floor(this.rng() * patterns.length)],
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
    return width < 150;
  }

  setDimensions(width, height) {
    const dpr = window.devicePixelRatio || 1;
    const mobile = this.isMobile(width);
    
    // Use provided height, fallback to calculated if not provided
    const actualHeight = height || (mobile ? Math.floor(window.innerHeight * 0.65) : 440);

    this.canvas.width = width * dpr;
    this.canvas.height = actualHeight * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${actualHeight}px`;

    this.ctx = this.canvas.getContext("2d");
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  renderAll(allCandles, scrollOffset = 0, totalCandleCountOverride = null, annotation = null, verticalOffset = 0) {
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

    const toY = price => height - 50 - ((price - minPrice) / (maxPrice - minPrice)) * (height - 90) + verticalOffset;

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

          // Pulzáló kör - NINCS LABEL
          const isPulsing = h.pulse === true;
          const pulseScale = isPulsing ? 1 + Math.sin(Date.now() / 300) * 0.15 : 1;
          const radius = (h.radius || 6) * pulseScale;
          
          ctx.strokeStyle = h.color || C.nGreen;
          ctx.lineWidth = 2;
          ctx.globalAlpha = isPulsing ? 0.8 + Math.sin(Date.now() / 300) * 0.2 : 1;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }

        case 'line': {
          const x1 = getX(h.startIdx);
          const x2 = getX(h.endIdx);
          if (x1 === null || x2 === null) break;
          
          const y1 = toY(h.startPrice);
          const y2 = toY(h.endPrice);

          ctx.strokeStyle = h.color || C.neut;
          ctx.lineWidth = h.width || 1.5;

          if (h.dashed || h.style === 'dashed') {
            ctx.setLineDash([5, 5]);
          }

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.setLineDash([]);
          break;
        }

        case 'rect': {
          // Ellenőrizzük, hogy a rect látható-e
          if (h.endIdx < startIdx || h.startIdx > endIdx) break;
          
          const x1 = leftPadding + Math.max(0, (h.startIdx - startIdx)) * slotWidth;
          const x2 = leftPadding + Math.min(visibleCandles.length, (h.endIdx - startIdx + 1)) * slotWidth;
          const yTop = toY(h.priceTop);
          const yBot = toY(h.priceBot);

          ctx.fillStyle = (h.color || C.nAmber) + '10';
          ctx.fillRect(x1, yTop, x2 - x1, yBot - yTop);

          ctx.strokeStyle = h.color || C.nAmber;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(x1, yTop, x2 - x1, yBot - yTop);
          ctx.setLineDash([]);
          break;
        }

        case 'arrow': {
          const x = getX(h.idx);
          if (x === null) break;
          
          const yBase = toY(h.price);
          const dirUp = h.direction === 'up';
          const color = h.color || (dirUp ? C.bull : C.bear);
          const size = h.size || 18;

          ctx.strokeStyle = color;
          ctx.fillStyle = color;
          ctx.lineWidth = 2.5;

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
    5.5  DEVELOPER SUPPORT COMPONENT (CRYPTO BRO EDITION 🚀)
   ═══════════════════════════════════════════════════════════════ */

function DeveloperSupport({ onClose, onSupport }) {
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const predefinedAmounts = [
    { value: 0.0005, label: '0.0005 ETH', emoji: '☕' },
    { value: 0.001, label: '0.001 ETH', emoji: '🍕' },
    { value: 0.003, label: '0.003 ETH', emoji: '🍔' },
  ];

  const handleSupport = async () => {
    const amount = selectedAmount === 'custom' ? parseFloat(customAmount) : selectedAmount;
    
    if (!amount || amount <= 0) {
      alert('Enter a valid amount');
      return;
    }

    setIsProcessing(true);
    haptic([30, 50, 30]);

    try {
      // Check if ethereum object is available (MetaMask or similar)
      if (typeof window.ethereum === 'undefined') {
        alert('Use base app ');
        setIsProcessing(false);
        return;
      }

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Check if we're on Base network (chainId: 8453)
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      if (chainId !== '0x2105') { // 8453 in hex
        // Try to switch to Base network
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }],
          });
        } catch (switchError) {
          // If Base network is not added, add it
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x2105',
                chainName: 'Base',
                nativeCurrency: {
                  name: 'Ethereum',
                  symbol: 'ETH',
                  decimals: 18
                },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org']
              }]
            });
          } else {
            throw switchError;
          }
        }
      }

      // Send transaction
      const transactionParameters = {
        from: accounts[0],
        to: DEVELOPER_WALLET,
        value: '0x' + (amount * 1e18).toString(16), // Convert ETH to Wei
      };

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [transactionParameters],
      });

      setShowSuccess(true);
      haptic([50, 100, 50, 100]);
      sound.correct();
      
      setTimeout(() => {
        onSupport(amount);
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Transaction error:', error);
      alert('RIP transaction failed  ' + error.message);
      setIsProcessing(false);
    }
  };

  if (showSuccess) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6,6,12,0.95)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20,
        }}
      >
        <div
          style={{
            background: C.glass,
            border: `1px solid ${C.glassBr}`,
            borderRadius: 20,
            padding: 32,
            maxWidth: 400,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🙌</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.nGreen, marginBottom: 8 }}>
            LETS GOOOO!!! 
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
            U a real one ! Dev gonna eat big big mac 
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6,6,12,0.95)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.glass,
          border: `1px solid ${C.glassBr}`,
          borderRadius: 20,
          padding: 24,
          maxWidth: 440,
          width: '100%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
             SUPP THE DEV 
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              fontSize: 24,
              cursor: 'pointer',
              padding: 0,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 24, lineHeight: 1.6 }}>
            This whole thing is held together by hope and bad decisions
            If it somehow works for you... congrats, you're as delusional as I am
            Send ETH to keep the delusion alive 
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {predefinedAmounts.map((amt) => (
            <button
              key={amt.value}
              onClick={() => {
                setSelectedAmount(amt.value);
                setCustomAmount('');
                haptic([20]);
                sound.click();
              }}
              style={{
                background: selectedAmount === amt.value ? C.nGreen + '20' : C.bg2,
                border: `2px solid ${selectedAmount === amt.value ? C.nGreen : C.glassBr}`,
                borderRadius: 12,
                padding: '16px 20px',
                color: '#fff',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{amt.emoji}</span>
                <span>{amt.label}</span>
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{amt.usd}</span>
            </button>
          ))}

          <div
            style={{
              background: selectedAmount === 'custom' ? C.nBlue + '20' : C.bg2,
              border: `2px solid ${selectedAmount === 'custom' ? C.nBlue : C.glassBr}`,
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <label style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>
                🎰 YOLO Custom Amount
              </label>
              <input
                type="checkbox"
                checked={selectedAmount === 'custom'}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedAmount('custom');
                    haptic([20]);
                    sound.click();
                  }
                }}
                style={{ width: 20, height: 20, cursor: 'pointer' }}
              />
            </div>
            <input
              type="number"
              step="0.0001"
              min="0.0001"
              placeholder="Enter custom ETH amount"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedAmount('custom');
              }}
              onFocus={() => setSelectedAmount('custom')}
              disabled={selectedAmount !== 'custom'}
              style={{
                background: C.bg1,
                border: `1px solid ${C.glassBr}`,
                borderRadius: 8,
                padding: '12px 16px',
                color: '#fff',
                fontSize: 16,
                fontFamily: 'monospace',
                width: '100%',
                boxSizing: 'border-box',
                opacity: selectedAmount === 'custom' ? 1 : 0.5,
              }}
            />
          </div>
        </div>

        <button
          onClick={handleSupport}
          disabled={isProcessing || (!selectedAmount && !customAmount)}
          style={{
            width: '100%',
            background: isProcessing 
              ? 'rgba(255,255,255,0.1)' 
              : `linear-gradient(135deg, ${C.nGreen}, ${C.nBlue})`,
            border: 'none',
            borderRadius: 12,
            padding: '16px 24px',
            color: '#fff',
            fontSize: 18,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            opacity: (!selectedAmount && !customAmount) ? 0.5 : 1,
            transition: 'all 0.2s',
          }}
        >
          {isProcessing ? '⏳ SENDIN...' : '   SEND IT   '}
        </button>

        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: C.bg1,
            borderRadius: 8,
            fontSize: 11,
            color: 'rgba(255,255,255,0.5)',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          Built with love, caffeine, & unopened therapy bills 
          <br />
          No sign up, no sus stuff, just vibes 
        </div>
      </div>
    </div>
  );
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
          {correct ? "BASED! ✅" : "Incorrect"}
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
            <br />• Setup quality: {context.edgeScore || 0}/5 edge indicators
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
  const [showSupport, setShowSupport] = useState(false);
  const [copied, setCopied] = useState(false);

  const roast = useMemo(() => generateRoast(stats), [stats]);
  const meme = useMemo(() => getMemeForScore(stats.accuracy), [stats.accuracy]);

  const handleTwitterShare = useCallback(() => {
    shareToTwitter(stats, roast);
    sound.click();
    haptic([20]);
  }, [stats, roast]);

  const handleBaseShare = useCallback(async () => {
    sound.click();
    haptic([20]);
    const shared = await shareToBase(stats, roast);
    if (!shared) {
      // Clipboard copy happened
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [stats, roast]);

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
        
        if (db) {
          // Save to Firebase Firestore
          await addDoc(collection(db, "scores"), scoreData);
          console.log("Score saved to Firebase!");
        } else {
          // Fallback to localStorage if Firebase not available
          const existingScores = JSON.parse(localStorage.getItem("reflexGlassScores") || "[]");
          existingScores.push(scoreData);
          localStorage.setItem("reflexGlassScores", JSON.stringify(existingScores));
          console.log("Score saved to localStorage (Firebase unavailable)");
        }
        
        setSaved(true);
        haptic([50, 30, 50]);
      } catch (err) {
        console.error("Failed to save score:", err);
        // Try localStorage as fallback
        try {
          const scoreData = {
            name: playerName,
            score: stats.totalScore,
            streak: stats.bestStreak,
            accuracy: stats.accuracy,
            timestamp: Date.now()
          };
          const existingScores = JSON.parse(localStorage.getItem("reflexGlassScores") || "[]");
          existingScores.push(scoreData);
          localStorage.setItem("reflexGlassScores", JSON.stringify(existingScores));
          setSaved(true);
        } catch (fallbackErr) {
          console.error("Fallback save also failed:", fallbackErr);
        }
      }
    };
    
    saveScore();
  }, [playerName, stats, saved]);

  // Determine grade
  let grade, gradeColor;
  if (stats.accuracy >= 90) {
    grade = "LEGENDARY 🐐";
    gradeColor = "#ffd700";
  } else if (stats.accuracy >= 75) {
    grade = "DEGEN PRO 💎";
    gradeColor = C.nGreen;
  } else if (stats.accuracy >= 60) {
    grade = "SOLID APE 🦍";
    gradeColor = C.nBlue;
  } else if (stats.accuracy >= 40) {
    grade = "PAPER HANDS 📄";
    gradeColor = C.nAmber;
  } else {
    grade = "NGMI 💀";
    gradeColor = C.bear;
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, height: '100vh', width: '100%' }}>
      {/* Score display - positioned in the holographic frame */}
      <div style={{ 
        textAlign: "center", 
        position: 'relative', 
        zIndex: 2,
        marginBottom: 16,
      }}>
        
        {/* Score - fits in frame */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 900,
            fontFamily: "monospace",
            color: "rgba(150, 200, 255, 0.95)",
            marginTop: 0,
            marginBottom: 20,
            textShadow: "0 0 25px rgba(100, 180, 255, 0.7), 0 0 50px rgba(100, 180, 255, 0.3), 0 3px 6px rgba(0,0,0,0.4)",
            letterSpacing: '3px'
          }}
        >
          {stats.totalScore.toLocaleString()}
        </div>

        {/* Player name instead of grade - blue color */}
        <div style={{ 
          fontSize: 13, 
          fontWeight: 700, 
          marginBottom: 18, 
          color: "rgba(100, 200, 230, 0.9)", 
          textShadow: "0 0 15px rgba(100, 200, 230, 0.6), 0 0 30px rgba(100, 200, 230, 0.3)",
          letterSpacing: '2.5px',
          textTransform: 'uppercase'
        }}>
          {playerName}
        </div>

        {/* Roast Section - compact */}
        <div style={{
          padding: "0 20px",
          marginBottom: 18,
        }}>
          <div style={{ 
            fontSize: 11, 
            fontStyle: "italic", 
            color: "rgba(200, 220, 240, 0.65)", 
            lineHeight: 1.4, 
            textShadow: "0 2px 6px rgba(0,0,0,0.6)",
            fontWeight: 300
          }}>
            "{roast}"
          </div>
        </div>

        {/* Stats Grid - compact and tighter */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 14,
            padding: "0 12px"
          }}
        >
          <div>
            <div style={{ 
              fontSize: 8, 
              color: "rgba(150, 180, 200, 0.45)", 
              marginBottom: 4, 
              textShadow: "0 1px 3px rgba(0,0,0,0.7)",
              letterSpacing: '1px',
              fontWeight: 600
            }}>
              ACCURACY
            </div>
            <div style={{ 
              fontSize: 18, 
              fontWeight: 800, 
              color: "rgba(100, 230, 180, 0.9)", 
              textShadow: `0 0 12px rgba(100, 230, 180, 0.5), 0 2px 4px rgba(0,0,0,0.4)`,
              fontFamily: 'monospace'
            }}>
              {stats.accuracy}%
            </div>
          </div>
          <div>
            <div style={{ 
              fontSize: 8, 
              color: "rgba(150, 180, 200, 0.45)", 
              marginBottom: 4, 
              textShadow: "0 1px 3px rgba(0,0,0,0.7)",
              letterSpacing: '1px',
              fontWeight: 600
            }}>
              CORRECT
            </div>
            <div style={{ 
              fontSize: 18, 
              fontWeight: 800, 
              color: "rgba(100, 200, 255, 0.9)", 
              textShadow: `0 0 12px rgba(100, 200, 255, 0.5), 0 2px 4px rgba(0,0,0,0.4)`,
              fontFamily: 'monospace'
            }}>
              {stats.correct}/{stats.total}
            </div>
          </div>
          <div>
            <div style={{ 
              fontSize: 8, 
              color: "rgba(150, 180, 200, 0.45)", 
              marginBottom: 4, 
              textShadow: "0 1px 3px rgba(0,0,0,0.7)",
              letterSpacing: '1px',
              fontWeight: 600
            }}>
              STREAK
            </div>
            <div style={{ 
              fontSize: 18, 
              fontWeight: 800, 
              color: "rgba(255, 100, 80, 0.9)", 
              textShadow: `0 0 12px rgba(255, 100, 80, 0.5), 0 2px 4px rgba(0,0,0,0.4)`,
              fontFamily: 'monospace'
            }}>
              {stats.bestStreak}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons - almost fully transparent and at bottom */}
      <div style={{ 
        position: "absolute",
        bottom: 10,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(85%, 450px)",
        padding: "10px", 
        background: 'rgba(12, 20, 35, 0.08)',
        backdropFilter: 'blur(6px)',
        borderRadius: '14px',
        border: '1px solid rgba(100, 180, 230, 0.05)',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(100, 180, 230, 0.03)'
      }}>
        {saved && (
          <div style={{ 
            padding: "7px", 
            marginBottom: 8,
            background: `rgba(80, 230, 180, 0.1)`,
            border: `1px solid rgba(80, 230, 180, 0.25)`,
            borderRadius: 10,
            color: "rgba(100, 255, 200, 0.85)",
            fontSize: 10,
            fontWeight: 600,
            textAlign: 'center',
            textShadow: '0 0 8px rgba(80, 230, 180, 0.4)'
          }}>
            ✓ Score saved to leaderboard!
          </div>
        )}

        {/* Share Buttons - smaller and more transparent */}
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            onClick={handleTwitterShare}
            style={{
              flex: 1,
              padding: "10px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.85)",
              background: "rgba(0, 0, 0, 0.5)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 10,
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backdropFilter: 'blur(8px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-1px)";
              e.target.style.boxShadow = "0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)";
              e.target.style.background = "rgba(15, 15, 15, 0.6)";
              e.target.style.borderColor = "rgba(255,255,255,0.25)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.08)";
              e.target.style.background = "rgba(0, 0, 0, 0.5)";
              e.target.style.borderColor = "rgba(255,255,255,0.15)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Share on X
          </button>
          
          <button
            onClick={handleBaseShare}
            style={{
              flex: 1,
              padding: "10px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.9)",
              background: copied ? "rgba(0, 230, 118, 0.7)" : "linear-gradient(135deg, rgba(30, 100, 255, 0.6) 0%, rgba(50, 180, 255, 0.6) 100%)",
              border: copied ? "1px solid rgba(0, 230, 118, 0.5)" : "1px solid rgba(100, 180, 255, 0.3)",
              borderRadius: 10,
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backdropFilter: 'blur(8px)',
              boxShadow: copied ? '0 0 16px rgba(0, 230, 118, 0.3)' : 'inset 0 1px 0 rgba(255,255,255,0.15)'
            }}
            onMouseEnter={(e) => {
              if (!copied) {
                e.target.style.transform = "translateY(-1px)";
                e.target.style.boxShadow = "0 4px 20px rgba(50, 180, 255, 0.4), inset 0 1px 0 rgba(255,255,255,0.25)";
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = copied ? '0 0 16px rgba(0, 230, 118, 0.3)' : 'inset 0 1px 0 rgba(255,255,255,0.15)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 111 111" fill="currentColor" style={{ opacity: copied ? 0 : 1 }}>
              <path d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6318 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H3.9565e-07C2.35281 87.8625 26.0432 110.034 54.921 110.034Z" />
            </svg>
            {copied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Copied!
              </>
            ) : (
              "Share Base"
            )}
          </button>
        </div>

        {/* Action buttons - compact */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <GlassButton onClick={onRestart} color="rgba(80, 230, 180, 1)" style={{ flex: 1, padding: "10px 0", fontSize: 12, fontWeight: 600 }}>
              Play Again
            </GlassButton>
            <GlassButton onClick={onLeaderboard} color="rgba(100, 180, 255, 1)" style={{ flex: 1, padding: "10px 0", fontSize: 12, fontWeight: 600 }}>
              Leaderboard
            </GlassButton>
          </div>
          
          <GlassButton 
            onClick={() => {
              haptic([30]);
              sound.click();
              setShowSupport(true);
            }} 
            color="rgba(160, 100, 230, 1)" 
            style={{ 
              padding: "10px 0", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              gap: 5,
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              opacity: 0.9
            }}
          >
            <span>SUPP THE DEV 🙌</span>
          </GlassButton>
        </div>
      </div>

      {showSupport && (
        <DeveloperSupport
          onClose={() => setShowSupport(false)}
          onSupport={(amount) => {
            console.log(`LFG! Received ${amount} ETH support from giga chad`);
          }}
        />
      )}
    </div>
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
      
      let scores = [];
      
      if (db) {
        // Load from Firebase Firestore
        const scoresQuery = query(
          collection(db, "scores"),
          orderBy("timestamp", "desc"),
          limit(100) // Get last 100 scores
        );
        
        const querySnapshot = await getDocs(scoresQuery);
        scores = querySnapshot.docs.map(doc => doc.data());
        console.log(`Loaded ${scores.length} scores from Firebase`);
      } else {
        // Fallback to localStorage
        scores = JSON.parse(localStorage.getItem("reflexGlassScores") || "[]");
        console.log(`Loaded ${scores.length} scores from localStorage (Firebase unavailable)`);
      }
      
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
      // Try localStorage as fallback
      try {
        const scores = JSON.parse(localStorage.getItem("reflexGlassScores") || "[]");
        if (scores.length > 0) {
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
          const leaderboard = Object.values(aggregated)
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, 10);
          setEntries(leaderboard);
        } else {
          setEntries([]);
        }
      } catch (fallbackErr) {
        console.error("Fallback load also failed:", fallbackErr);
        setEntries([]);
      }
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
  const [verticalOffset, setVerticalOffset] = useState(0);
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
  const touchStartY = useRef(null);
  const touchStartOffset = useRef(0);
  const touchStartVerticalOffset = useRef(0);
  const swipeRafId = useRef(null);
  const lastTouchX = useRef(null);
  const lastTouchY = useRef(null);
  const lastTouchTime = useRef(null);
  const velocity = useRef(0);
  const verticalVelocity = useRef(0);
  const renderRafId = useRef(null);
  const lastRenderTime = useRef(0);
  const buildAnimationProgress = useRef(0);
  const cachedCandles = useRef([]);
  const lastCandleCount = useRef(0);

  // ── Setup viewport and disable zoom ──
  useEffect(() => {
    // Set viewport meta tag
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      document.head.appendChild(viewportMeta);
    }
    viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    
    // Prevent pinch zoom on touch devices
    const preventZoom = (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };
    
    // Prevent double-tap zoom
    let lastTouchEnd = 0;
    const preventDoubleTapZoom = (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };
    
    document.addEventListener('touchstart', preventZoom, { passive: false });
    document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    
    return () => {
      document.removeEventListener('touchstart', preventZoom);
      document.removeEventListener('touchend', preventDoubleTapZoom);
      document.removeEventListener('gesturestart', (e) => e.preventDefault());
    };
  }, []);

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
              timerRef.current = null;
              
              // Timeout - handle directly instead of calling handleChoice
              // to avoid stale closure issues
              const userChoice = Math.random() < 0.5 ? "BUY" : "SELL";
              
              haptic([30, 20, 30]);
              sound.click();

              setChoice(userChoice);
              setScreen("revealing");

              // Animate continuation reveal
              let progress = 0;
              const animate = () => {
                progress += 0.03;
                setRevealProgress(progress);

                if (progress < 1) {
                  animFrameRef.current = requestAnimationFrame(animate);
                } else {
                  // Reveal complete - show outcome
                  setScreen((currentScreen) => {
                    // Use functional update to get fresh state
                    return "outcome";
                  });
                  
                  // Update stats with functional updates to ensure fresh state
                  const correct = userChoice === newStructure.signal;
                  
                  setStreak((prevStreak) => {
                    const newStreak = correct ? prevStreak + 1 : 0;
                    const multiplier = STREAK_MULT[Math.min(newStreak, STREAK_MULT.length - 1)];
                    const points = correct ? Math.round(BASE_SCORE * multiplier) : 0;
                    
                    setBestStreak((prevBest) => Math.max(prevBest, newStreak));
                    setScores((prevScores) => [...prevScores, points]);
                    
                    return newStreak;
                  });
                  
                  setRoundStats((prevStats) => [...prevStats, { correct, choice: userChoice }]);
                  
                  // Generate and set annotation
                  const annotation = generateAnnotation(newStructure);
                  setCurrentAnnotation(annotation);
                  setShowAnnotation(true);
                  
                  if (correct) sound.correct();
                  else sound.wrong();
                }
              };
              animate();
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
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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
    setVerticalOffset(0);
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
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
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
          currentOffset = swipeOffset;
        } 
        else if (screen === "playing") {
          currentCandles = structure.candles.slice(0, structure.decisionIndex + 1);
          currentOffset = swipeOffset;
        } 
        else if (screen === "revealing" || screen === "outcome") {
          const baseCandles = structure.candles.slice(0, structure.decisionIndex + 1);
          const continuationCandles = structure.continuation?.candles || [];
          const contCount = Math.floor(revealProgress * continuationCandles.length);
          currentCandles = [...baseCandles, ...continuationCandles.slice(0, contCount)];
          currentOffset = swipeOffset;
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
          
          rendererRef.current.renderAll(currentCandles, currentOffset, totalExpectedCandles, annotationData, verticalOffset);
        }

        renderRafId.current = requestAnimationFrame(render);
      };

      renderRafId.current = requestAnimationFrame(render);

      return () => {
        if (renderRafId.current) cancelAnimationFrame(renderRafId.current);
      };
    }, [structure, screen, revealProgress, swipeOffset, verticalOffset, windowStart, showAnnotation, currentAnnotation]);

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
    
    // Ellenőrizzük hogy a név már használatban van-e
    if (db) {
      try {
        const scoresRef = collection(db, "scores");
        const q = query(scoresRef);
        const snapshot = await getDocs(q);
        
        const existingNames = snapshot.docs.map(doc => doc.data().name.toLowerCase());
        if (existingNames.includes(tempName.trim().toLowerCase())) {
          alert("This name is already in use! Choose a different name.");
          return;
        }
      } catch (error) {
        console.error("Error checking name availability:", error);
        // Folytatjuk akkor is, ha a Firebase ellenőrzés sikertelen
      }
    }
    
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
        justifyContent: "flex-start",
        height: "100dvh",
        overflowY: "auto",
        overflowX: "hidden",
        padding: "20px 16px",
        gap: 20,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <img 
          src="title.png" 
          alt="REFLEX GLASS" 
          style={{ 
            maxWidth: 800,
            width: "100%",
            height: "auto",
            marginBottom: 8
          }} 
        />
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em" }}>
          Context-Aware Pattern Trainer
        </div>
      </div>

      <GlassPanel style={{ padding: "20px 16px", maxWidth: 380, width: "100%" }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: 16 }}>
        Master pattern recognition in realistic market conditions.  
        Learn when to trade and when to wait.  
        Focus on context, not memorization.
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
        Most people fuck it up spectacularly even with real money.  
        This? Just a sandbox to mess around in.  
        Real trading education takes time — use this to make the mistakes for free.
      </div>

      {/* Logo display */}
      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        marginTop: "auto",
        paddingBottom: 40
      }}>
        <img 
          src="logo.png" 
          alt="Logo" 
          style={{ 
            maxWidth: 200, 
            maxHeight: 80,
            objectFit: "contain",
            opacity: 0.7
          }} 
        />
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
        height: "100dvh",
        overflow: "hidden",
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
                 Building...
              </span>
            </GlassPanel>
          )}
          {screen === "playing" && structure && structure.context && structure.context.edgeScore >= 0 && (
            <GlassPanel style={{ 
              padding: "4px 10px", 
              borderRadius: 14, 
              border: `1px solid ${structure.context.edgeScore >= 4 ? C.nGreen : structure.context.edgeScore >= 3 ? C.nAmber : C.nPink}35` 
            }}>
              <span style={{ 
                fontSize: 11, 
                fontFamily: "monospace", 
                color: structure.context.edgeScore >= 4 ? C.nGreen : structure.context.edgeScore >= 3 ? C.nAmber : C.nPink
              }}>
                ⚡ {structure.context.edgeScore}/5
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
            touchAction: "none"
          }}
          onTouchStart={(e) => {
            if (structure && structure.candles && structure.candles.length > 0) {
              touchStartX.current = e.touches[0].clientX;
              touchStartY.current = e.touches[0].clientY;
              touchStartOffset.current = swipeOffset;
              touchStartVerticalOffset.current = verticalOffset;
              lastTouchX.current = e.touches[0].clientX;
              lastTouchY.current = e.touches[0].clientY;
              lastTouchTime.current = Date.now();
              velocity.current = 0;
              verticalVelocity.current = 0;
              if (swipeRafId.current) cancelAnimationFrame(swipeRafId.current);
            }
          }}
          onTouchMove={(e) => {
            if (touchStartX.current !== null && structure && structure.candles && structure.candles.length > 0) {
              e.preventDefault();
              
              const currentX = e.touches[0].clientX;
              const currentY = e.touches[0].clientY;
              const currentTime = Date.now();
              const deltaX = touchStartX.current - currentX;
              const deltaY = touchStartY.current - currentY;
              const timeDelta = currentTime - lastTouchTime.current;
              
              // Calculate velocity for momentum (both horizontal and vertical)
              if (timeDelta > 0) {
                velocity.current = (lastTouchX.current - currentX) / timeDelta;
                verticalVelocity.current = (lastTouchY.current - currentY) / timeDelta;
              }
              
              lastTouchX.current = currentX;
              lastTouchY.current = currentY;
              lastTouchTime.current = currentTime;
              
              const newHorizontalOffset = touchStartOffset.current + deltaX;
              const newVerticalOffset = touchStartVerticalOffset.current + deltaY;
              
              // Get current canvas dimensions
              const canvasWidth = chartRef.current ? chartRef.current.getBoundingClientRect().width : 400;
              const canvasHeight = chartRef.current ? chartRef.current.getBoundingClientRect().height : 300;
              
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
              
              // Horizontal limits
              const maxHorizontalOffset = scrollableCandles * slotWidth;
              const minHorizontalOffset = -50;
              let limitedHorizontalOffset;
              
              if (newHorizontalOffset > maxHorizontalOffset) {
                const excess = newHorizontalOffset - maxHorizontalOffset;
                limitedHorizontalOffset = maxHorizontalOffset + excess * 0.3;
              } else if (newHorizontalOffset < minHorizontalOffset) {
                const excess = minHorizontalOffset - newHorizontalOffset;
                limitedHorizontalOffset = minHorizontalOffset - excess * 0.3;
              } else {
                limitedHorizontalOffset = newHorizontalOffset;
              }
              
              // Vertical limits (allow some panning, with rubber band effect)
              const maxVerticalOffset = canvasHeight * 0.3;
              const minVerticalOffset = -canvasHeight * 0.3;
              let limitedVerticalOffset;
              
              if (newVerticalOffset > maxVerticalOffset) {
                const excess = newVerticalOffset - maxVerticalOffset;
                limitedVerticalOffset = maxVerticalOffset + excess * 0.3;
              } else if (newVerticalOffset < minVerticalOffset) {
                const excess = minVerticalOffset - newVerticalOffset;
                limitedVerticalOffset = minVerticalOffset - excess * 0.3;
              } else {
                limitedVerticalOffset = newVerticalOffset;
              }
              
              // Use RAF to prevent lag
              if (swipeRafId.current) cancelAnimationFrame(swipeRafId.current);
              swipeRafId.current = requestAnimationFrame(() => {
                setSwipeOffset(limitedHorizontalOffset);
                setVerticalOffset(limitedVerticalOffset);
              });
            }
          }}
          onTouchEnd={() => {
            if (touchStartX.current !== null && structure && structure.candles && structure.candles.length > 0) {
              // Get current canvas dimensions
              const canvasWidth = chartRef.current ? chartRef.current.getBoundingClientRect().width : 400;
              const canvasHeight = chartRef.current ? chartRef.current.getBoundingClientRect().height : 300;
              
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
              
              // Apply momentum with smooth animation (horizontal)
              const horizontalMomentum = velocity.current * 100;
              let finalHorizontalOffset = swipeOffset + horizontalMomentum;
              
              // Horizontal limits
              const maxHorizontalOffset = scrollableCandles * slotWidth;
              const minHorizontalOffset = 0;
              finalHorizontalOffset = Math.max(minHorizontalOffset, Math.min(maxHorizontalOffset, finalHorizontalOffset));
              
              // Apply momentum with smooth animation (vertical)
              const verticalMomentum = verticalVelocity.current * 100;
              let finalVerticalOffset = verticalOffset + verticalMomentum;
              
              // Vertical limits - snap back to 0
              const maxVerticalOffset = 0;
              const minVerticalOffset = 0;
              finalVerticalOffset = 0; // Always snap back to center vertically
              
              // Smooth snap animation
              const startHorizontalOffset = swipeOffset;
              const startVerticalOffset = verticalOffset;
              const startTime = Date.now();
              const duration = 300;
              
              const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
                
                const horizontalOffset = startHorizontalOffset + (finalHorizontalOffset - startHorizontalOffset) * eased;
                const verticalOffsetValue = startVerticalOffset + (finalVerticalOffset - startVerticalOffset) * eased;
                
                setSwipeOffset(horizontalOffset);
                setVerticalOffset(verticalOffsetValue);
                
                if (progress < 1) {
                  swipeRafId.current = requestAnimationFrame(animate);
                }
              };
              
              animate();
            }
            
            touchStartX.current = null;
            touchStartY.current = null;
            velocity.current = 0;
            verticalVelocity.current = 0;
          }}
        />
        {structure && (
          <>
            {screen === "outcome" && (
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
            {(screen === "playing" || screen === "building" || screen === "outcome") && (
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
            )}
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
        position: "relative",
        height: "100dvh",
        width: "100vw",
        overflow: "hidden",
        backgroundImage: "url('./background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Score container - fixed position in the holographic frame */}
      <div style={{
        position: "absolute",
        top: "20%",
        left: "50%",
        transform: "translate(-50%, 0)",
        width: "min(85%, 450px)",
        pointerEvents: "none",
      }}>
        <div style={{
          pointerEvents: "auto",
        }}>
          <FinalVerdict
            stats={computeStats()}
            onRestart={() => setScreen("home")}
            onLeaderboard={() => setScreen("leaderboard")}
            playerName={playerName}
          />
        </div>
      </div>
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
        overflow: "hidden",
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
      <div style={{ position: "relative", zIndex: 1, height: "100dvh", overflow: "hidden" }}>
        {screen === "home" && renderHome()}
        {(screen === "building" || screen === "playing" || screen === "revealing" || screen === "outcome") &&
          renderPlaying()}
        {screen === "verdict" && renderVerdict()}
        {screen === "leaderboard" && (
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            height: "100dvh",
            overflowY: "auto",
            overflowX: "hidden",
            padding: 16 
          }}>
            <Leaderboard onBack={() => setScreen("verdict")} />
          </div>
        )}
      </div>

      {/* Animations */}
      <style>{`
        * {
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: transparent;
        }
        
        html, body {
          touch-action: pan-x pan-y;
          -ms-touch-action: pan-x pan-y;
          overscroll-behavior: none;
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
        }
        
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