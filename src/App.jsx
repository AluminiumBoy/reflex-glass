
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY_HERE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

let app, db;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
  db = null;
}


const ROUNDS = 5;
const DECISION_MS = 3000; 
const BASE_SCORE = 1000;
const STREAK_MULT = [1, 1.3, 1.6, 2.0, 2.5, 3.0, 3.5, 4.0];

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

function haptic(pattern = [30]) {
  try {
    navigator?.vibrate?.(pattern);
  } catch (_) {}
}

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

  buildTick(progress) {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime;
    
    
    const bufferSize = ctx.sampleRate * 0.015; 
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800 + (progress * 300), now); 
    filter.Q.value = 12; 
    
    const gain = ctx.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
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
    "Brrr mf, respect",
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

async function genericShare(stats, roast) {
  const { accuracy, correct, total, totalScore, bestStreak } = stats;
  const meme = getMemeForScore(accuracy);
  
  const canvas = document.createElement('canvas');
  canvas.width = 1400;  
  canvas.height = 1920; 
  const ctx = canvas.getContext('2d');
  
  try {
    const bgImage = new Image();
    bgImage.crossOrigin = 'anonymous';
    
    await new Promise((resolve, reject) => {
      bgImage.onload = resolve;
      bgImage.onerror = reject;
      bgImage.src = './background.png';
    });
    
    ctx.drawImage(bgImage, 0, 0, 1400, 1920);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, 1400, 1920);
    
  } catch (err) {
    console.log('Background image failed to load, using gradient fallback');
    const gradient = ctx.createLinearGradient(0, 0, 1400, 1920);
    gradient.addColorStop(0, '#0f1a2e');
    gradient.addColorStop(0.5, '#06060c');
    gradient.addColorStop(1, '#0f0f1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1400, 1920);
  }
  
  
  const centerY = 600; 
  const centerX = 700; 
  const appWidth = 450; 
  const scale = 1400 / 450; 
  const contentWidth = 450 * scale; 
  const contentX = centerX; 
  
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${65 * scale}px monospace`; 
  ctx.shadowColor = 'rgba(100, 180, 255, 0.7)';
  ctx.shadowBlur = 60;
  ctx.fillStyle = 'rgba(150, 200, 255, 0.95)';
  ctx.fillText(totalScore.toLocaleString(), contentX, centerY);
  ctx.shadowBlur = 0;
  
  ctx.font = `bold ${17 * scale}px sans-serif`; 
  ctx.fillStyle = 'rgba(100, 200, 230, 0.9)';
  ctx.shadowColor = 'rgba(100, 200, 230, 0.6)';
  ctx.shadowBlur = 30;
  const playerName = window.currentPlayerName || 'PLAYER';
  ctx.fillText(playerName.toUpperCase(), contentX, centerY + (130 * scale / 3.11)); 
  ctx.shadowBlur = 0;
  
  ctx.font = `italic ${11 * scale}px sans-serif`;
  ctx.fillStyle = 'rgba(200, 220, 240, 0.65)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 15;
  
  const maxWidth = contentWidth * 0.85;
  const words = roast.split(' ');
  let line = '';
  let y = centerY + 210;
  const lineHeight = 40;
  
  for (let word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(`"${line.trim()}"`, contentX, y);
      line = word + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line.trim()) {
    ctx.fillText(`"${line.trim()}"`, contentX, y);
  }
  ctx.shadowBlur = 0;
  
  const statsY = y + 120;
  const gridWidth = contentWidth * 1.3; 
  const columnWidth = gridWidth / 5.4;
  const gridStartX = contentX - gridWidth / 5.3;
  
  const drawStat = (label, value, color, columnIndex, y) => {
    const x = gridStartX + (columnIndex * columnWidth) + (12 * scale); 
    
    ctx.textAlign = 'middle';
    ctx.font = `bold ${8.7 * scale}px sans-serif`; 
    ctx.fillStyle = 'rgba(150, 180, 200, 0.45)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 8;
    ctx.fillText(label, x, y);
    
    ctx.font = `bold ${25 * scale}px monospace`; 
    ctx.fillStyle = color;
    ctx.shadowColor = color.replace('0.9)', '0.5)');
    ctx.shadowBlur = 30;
    ctx.fillText(value, x, y + (22 * scale)); 
    ctx.shadowBlur = 0;
  };
  
  drawStat('ACCURACY', `${accuracy}%`, 'rgba(100, 230, 180, 0.9)', 0, statsY);
  drawStat('CORRECT', `${correct}/${total}`, 'rgba(100, 200, 255, 0.9)', 1, statsY);
  drawStat('STREAK', `${bestStreak}`, 'rgba(255, 100, 80, 0.9)', 2, statsY);
  
  const shareText = 
    `Just scored ${totalScore.toLocaleString()} on Reflex Glass! ${meme}\n\n` +
    `${accuracy}% accuracy • ${correct}/${total} correct\n\n` +
    `${roast}`;
  
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  
  if (navigator.share && navigator.canShare) {
    const shareData = {
      text: shareText,
      url: window.location.href,
      files: [new File([blob], 'reflex-glass-score.png', { type: 'image/png' })]
    };
    
    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return true;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    }
  }
  
  try {
    await navigator.clipboard.writeText(shareText + `\n\n${window.location.href}`);
    return false; 
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
}


function generateAnnotation(structure) {
  const { pattern, signal, candles, decisionIndex } = structure;

  const p = pattern.toLowerCase().trim().replace(/&/g, 'and').replace(/\s+/g, '_');

  const highlights = [];
  let explanation = '';

  const isBullish = signal === 'BUY';
  
  const safeIdx = (offset) => Math.max(0, Math.min(candles.length - 1, decisionIndex + offset));
  const getHigh  = (o) => candles[safeIdx(o)]?.high  ?? candles[decisionIndex].high;
  const getLow   = (o) => candles[safeIdx(o)]?.low   ?? candles[decisionIndex].low;
  const getOpen  = (o) => candles[safeIdx(o)]?.open  ?? candles[decisionIndex].open;
  const getClose = (o) => candles[safeIdx(o)]?.close ?? candles[decisionIndex].close;

  switch (p) {
    case 'bull_flag':
      explanation = isBullish ? 
        'Parallel consolidation channel after uptrend → Controlled pullback maintains structure → Breakout above resistance confirms bullish continuation with volume' : 
        'Bull flag detected but context suggests caution';
      {
        const flagStart = safeIdx(-12);
        const flagEnd = safeIdx(-1);
        
        let channelHigh = -Infinity;
        let channelLow = Infinity;
        
        for (let i = -12; i <= -1; i++) {
          const idx = safeIdx(i);
          if (candles[idx]) {
            channelHigh = Math.max(channelHigh, candles[idx].high);
            channelLow = Math.min(channelLow, candles[idx].low);
          }
        }
        
        highlights.push(
          { type: 'line', startIdx: flagStart, startPrice: channelHigh, 
            endIdx: flagEnd, endPrice: channelHigh, 
            color: '#ef4444', width: 2, dashed: false }
        );
        
        highlights.push(
          { type: 'line', startIdx: flagStart, startPrice: channelLow, 
            endIdx: flagEnd, endPrice: channelLow, 
            color: '#10b981', width: 2, dashed: false }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: channelHigh + 10, 
            direction: 'up', color: '#10b981', size: 22 }
        );
      }
      break;

    case 'bear_flag':
      explanation = isBullish ? 
        'Bear flag detected but bullish context may invalidate' : 
        'Parallel channel consolidation after downtrend → Brief counter-rally lacks momentum → Breakdown below support confirms bearish continuation';
      {
        const flagStart = safeIdx(-12);
        const flagEnd = safeIdx(-1);
        
        let channelHigh = -Infinity;
        let channelLow = Infinity;
        
        for (let i = -12; i <= -1; i++) {
          const idx = safeIdx(i);
          if (candles[idx]) {
            channelHigh = Math.max(channelHigh, candles[idx].high);
            channelLow = Math.min(channelLow, candles[idx].low);
          }
        }
        
        highlights.push(
          { type: 'line', startIdx: flagStart, startPrice: channelHigh, 
            endIdx: flagEnd, endPrice: channelHigh, 
            color: '#ef4444', width: 2, dashed: false }
        );
        
        highlights.push(
          { type: 'line', startIdx: flagStart, startPrice: channelLow, 
            endIdx: flagEnd, endPrice: channelLow, 
            color: '#10b981', width: 2, dashed: false }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: channelLow - 10, 
            direction: 'down', color: '#ef4444', size: 22 }
        );
      }
      break;

    case 'ascending_triangle':
      explanation = isBullish ? 
        'Rising lows show increasing demand → Flat resistance level tested multiple times → Breakout above resistance signals strong bullish momentum with price target = triangle height' : 
        'Ascending triangle detected but context suggests caution';
      {
        const start = safeIdx(-18);
        const end = safeIdx(0);
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getLow(-18), endIdx: safeIdx(-2), endPrice: getLow(-2), 
            color: '#10b981', width: 1.5 }
        );
        
        const resistancePrice = Math.max(getHigh(-15), getHigh(-10), getHigh(-5));
        highlights.push(
          { type: 'line', startIdx: start, startPrice: resistancePrice, endIdx: end, endPrice: resistancePrice, 
            color: '#ef4444', dashed: true, width: 1.5 }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 10, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'descending_triangle':
      explanation = isBullish ? 
        'Descending triangle detected but bullish context may invalidate' : 
        'Falling highs show weakening supply → Flat support tested multiple times → Breakdown below support triggers bearish continuation with price target = triangle height';
      {
        const start = safeIdx(-18);
        const end = safeIdx(0);
        
        highlights.push(
          { type: 'line', startIdx: start, startPrice: getHigh(-18), endIdx: safeIdx(-2), endPrice: getHigh(-2), 
            color: '#ef4444', width: 1.5 }
        );
        
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
      explanation = isBullish ? 
        'Two equal lows test same support level → "W" formation shows strong demand → Neckline breakout confirms reversal → Price target = pattern height projected upward' : 
        'Double bottom detected but bearish context may invalidate';
      {
        let leftLowIdx = safeIdx(-15);
        let leftLowPrice = Infinity;
        
        for (let i = -20; i <= -11; i++) {
          const idx = safeIdx(i);
          if (candles[idx] && candles[idx].low < leftLowPrice) {
            leftLowPrice = candles[idx].low;
            leftLowIdx = idx;
          }
        }
        
        let rightLowIdx = safeIdx(-5);
        let rightLowPrice = Infinity;
        
        for (let i = -10; i <= -1; i++) {
          const idx = safeIdx(i);
          if (candles[idx] && candles[idx].low < rightLowPrice) {
            rightLowPrice = candles[idx].low;
            rightLowIdx = idx;
          }
        }
        
        highlights.push(
          { type: 'circle', idx: leftLowIdx, price: leftLowPrice, 
            radius: 8, color: '#10b981', pulse: true }
        );
        
        highlights.push(
          { type: 'circle', idx: rightLowIdx, price: rightLowPrice, 
            radius: 8, color: '#10b981', pulse: true }
        );
        
        let necklinePrice = -Infinity;
        for (let i = -18; i <= -8; i++) {
          const idx = safeIdx(i);
          if (candles[idx]) {
            necklinePrice = Math.max(necklinePrice, candles[idx].high);
          }
        }
        
        highlights.push(
          { type: 'line', startIdx: safeIdx(-22), startPrice: necklinePrice, 
            endIdx: safeIdx(2), endPrice: necklinePrice, 
            color: '#fbbf24', dashed: false, width: 2.5 }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: necklinePrice + 14, 
            direction: 'up', color: '#10b981', size: 22 }
        );
      }
      break;

    case 'double_top':
      explanation = isBullish ? 
        'Double top detected but bullish context may invalidate' : 
        'Two equal highs test same resistance level → "M" formation shows supply rejection → Neckline breakdown confirms reversal → Price target = pattern height projected downward';
      {
        let leftHighIdx = safeIdx(-15);
        let leftHighPrice = -Infinity;
        
        for (let i = -20; i <= -11; i++) {
          const idx = safeIdx(i);
          if (candles[idx] && candles[idx].high > leftHighPrice) {
            leftHighPrice = candles[idx].high;
            leftHighIdx = idx;
          }
        }
        
        let rightHighIdx = safeIdx(-5);
        let rightHighPrice = -Infinity;
        
        for (let i = -10; i <= -1; i++) {
          const idx = safeIdx(i);
          if (candles[idx] && candles[idx].high > rightHighPrice) {
            rightHighPrice = candles[idx].high;
            rightHighIdx = idx;
          }
        }
        
        highlights.push(
          { type: 'circle', idx: leftHighIdx, price: leftHighPrice, 
            radius: 8, color: '#ef4444', pulse: true }
        );
        
        highlights.push(
          { type: 'circle', idx: rightHighIdx, price: rightHighPrice, 
            radius: 8, color: '#ef4444', pulse: true }
        );
        
        let necklinePrice = Infinity;
        for (let i = -18; i <= -8; i++) {
          const idx = safeIdx(i);
          if (candles[idx]) {
            necklinePrice = Math.min(necklinePrice, candles[idx].low);
          }
        }
        
        highlights.push(
          { type: 'line', startIdx: safeIdx(-22), startPrice: necklinePrice, 
            endIdx: safeIdx(2), endPrice: necklinePrice, 
            color: '#fbbf24', dashed: false, width: 2.5 }
        );

        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: necklinePrice - 14, 
            direction: 'down', color: '#ef4444', size: 22 }
        );
      }
      break;

    case 'head_and_shoulders':
    case 'head_shoulders':
      explanation = isBullish ? 
        'Head and shoulders detected but bullish context may invalidate' : 
        'Left shoulder: Initial peak and pullback → Head: Higher peak shows weakening momentum → Right shoulder: Lower peak confirms distribution → Neckline break triggers reversal → Target = head-to-neckline distance';
      {
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
      explanation = isBullish ? 
        'Left shoulder: Initial low and bounce → Head: Lower low tests support → Right shoulder: Higher low shows accumulation → Neckline break confirms bullish reversal → Target = head-to-neckline distance' : 
        'Inverse head and shoulders detected but bearish context may invalidate';
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
      explanation = isBullish ? 
        'Strong upward move (flagpole) → Converging symmetrical trendlines show consolidation → Price coiling for next move → Breakout continues bullish momentum → Target = flagpole height added to breakout' : 
        'Bull pennant detected but context suggests caution';
      {
        const start = safeIdx(-12);
        const mid = safeIdx(-6);
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
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 10, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'bear_pennant':
      explanation = isBullish ? 
        'Bear pennant detected but bullish context may invalidate' : 
        'Strong downward move (flagpole) → Converging symmetrical trendlines show pause → Temporary consolidation before continuation → Breakdown extends bearish momentum → Target = flagpole height subtracted from breakdown';
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
      explanation = isBullish ? 
        'Narrowing upward channel within uptrend → Higher lows and higher highs converge → Temporary consolidation → Breakout above upper trendline confirms bullish continuation → Volume expansion on breakout validates move' : 
        'Rising wedge continuation detected but context suggests caution';
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
      explanation = isBullish ? 
        'Falling wedge continuation detected but context suggests caution' : 
        'Narrowing downward channel within downtrend → Lower highs and lower lows converge → Controlled selling pressure → Breakdown below lower trendline extends bearish move → Declining volume shows weakening conviction';
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
      explanation = isBullish ? 
        'Parallel rising trendlines create upward channel → Price bounces between support and resistance → Each swing high and low progressively higher → Breakout above resistance accelerates uptrend → Target = channel width added to breakout' : 
        'Ascending channel detected but context suggests caution';
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
      explanation = isBullish ? 
        'Descending channel detected but bullish context may invalidate' : 
        'Parallel falling trendlines create downward channel → Price oscillates between declining support and resistance → Each bounce weaker than previous → Breakdown below support extends downtrend → Target = channel width subtracted from breakdown';
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
      explanation = isBullish ? 
        'U-shaped recovery forms "cup" base → Gradual consolidation shows accumulation → Small pullback forms "handle" → Breakout above handle rim confirms bullish reversal → Target = cup depth added to rim' : 
        'Cup and handle detected but bearish context may invalidate';
      {
        const cupBottomIdx = safeIdx(-15);
        highlights.push(
          { type: 'circle', idx: cupBottomIdx, price: getLow(-15), 
            radius: 6, color: '#10b981', pulse: true }
        );
        
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
      explanation = isBullish ? 
        'Inverse cup and handle detected but bullish context may invalidate' : 
        'Inverted U-shaped top forms distribution → Gradual topping shows selling pressure → Small rally forms "handle" → Breakdown below handle confirms bearish reversal → Target = cup height subtracted from breakdown';
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
      explanation = isBullish ? 
        'Narrowing downward wedge after downtrend → Lower highs and lows converge → Selling pressure exhausting → Breakout above upper trendline confirms bullish reversal → Volume spike validates breakout' : 
        'Falling wedge reversal detected but bearish context may invalidate';
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
      explanation = isBullish ? 
        'Rising wedge reversal detected but bullish context may invalidate' : 
        'Narrowing upward wedge after uptrend → Higher lows and highs converge → Buyers losing momentum despite rising prices → Breakdown below lower trendline confirms bearish reversal → Declining volume shows weakness';
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
      explanation = isBullish ? 
        'Three equal lows test same support level → Strong base formation shows consistent demand → Multiple failed attempts to break lower → Neckline breakout confirms powerful bullish reversal → Higher conviction than double bottom' : 
        'Triple bottom detected but bearish context may invalidate';
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
      explanation = isBullish ? 
        'Triple top detected but bullish context may invalidate' : 
        'Three equal highs test same resistance level → Strong ceiling formation shows consistent supply rejection → Multiple failed breakout attempts → Neckline breakdown confirms powerful bearish reversal → More reliable than double top';
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
      explanation = isBullish ? 
        'Smooth U-shaped recovery pattern → Gradual shift from selling to buying pressure → No sharp angles - organic accumulation phase → Rounded base shows healthy reversal → Volume increases as price rises from bottom' : 
        'Rounding bottom detected but bearish context may invalidate';
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
      explanation = isBullish ? 
        'Rounding top detected but bullish context may invalidate' : 
        'Smooth inverted U-shaped distribution → Gradual shift from buying to selling pressure → No sharp angles - organic distribution phase → Rounded peak shows weakness building → Volume decreases during formation then surges on breakdown';
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
      explanation = isBullish ? 
        'Sharp V-shaped reversal from bottom → Panic selling exhausts → Rapid reversal with strong volume → No base formation - immediate momentum shift → High-risk pattern but powerful when validated' : 
        'V-bottom detected but bearish context may invalidate';
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
      explanation = isBullish ? 
        'V-top detected but bullish context may invalidate' : 
        'Sharp inverted V-shaped reversal from peak → Buying climax exhausts → Rapid reversal with heavy selling → No distribution phase - immediate momentum shift → High conviction bearish pattern';
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
      explanation = isBullish ? 
        'Large bullish candle completely engulfs prior bearish body → Shift in sentiment from bears to bulls → Strong buying overwhelms sellers → Best at support levels → Confirms reversal when volume increases' : 
        'Bullish engulfing detected but bearish context may invalidate';
      {
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 10, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'bearish_engulfing_pattern':
      explanation = isBullish ? 
        'Bearish engulfing detected but bullish context may invalidate' : 
        'Large bearish candle completely engulfs prior bullish body → Shift from bulls to bears → Strong selling overwhelms buyers → Most effective at resistance levels → Confirms reversal when volume spikes';
      {
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 10, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'bull_flag_tight':
      explanation = isBullish ? 
        'Extremely tight consolidation after uptrend → Compressed volatility → Volume drying up before surge → Coiled spring ready to release → Breakout typically explosive with high volume confirmation' : 
        'Bull flag tight detected but context suggests caution';
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
      explanation = isBullish ? 
        'Bear flag tight detected but bullish context may invalidate' : 
        'Extremely tight consolidation after downtrend → Compressed range → Volume contraction before breakdown → Energy building for next leg down → Breakdown typically sharp with volume spike';
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
      explanation = isBullish ? 
        'Extended flat base consolidation → Range-bound accumulation → Volume decreases during base → Breakout on volume surge confirms continuation → Often precedes strong moves' : 
        'Flat base breakout detected but context suggests caution';
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
      explanation = isBullish ? 
        'Distribution pattern detected but bullish context may invalidate' : 
        'Extended top formation shows distribution → Volume decreases during topping → Sellers gaining control → Breakdown confirms trend reversal → Measured move target applies';
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

    case 'three_white_soldiers':
      explanation = isBullish ? 
        'Three consecutive strong bullish candles → Each closing near high → Progressive higher closes show conviction → Powerful bullish momentum → Best after downtrend or consolidation' : 
        'Three white soldiers detected but context suggests caution';
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
      explanation = isBullish ? 
        'Three black crows detected but bullish context may invalidate' : 
        'Three consecutive strong bearish candles → Each closing near low → Progressive lower closes confirm selling → Powerful bearish pressure → Most effective after uptrend';
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
      explanation = isBullish ? 
        'Small candle contained within prior large bearish candle → Indecision after selling → Potential reversal signal → Confirmation needed on next candle → Volume spike validates reversal' : 
        'Bullish harami detected but context suggests caution';
      {
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 10, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'bearish_harami':
      explanation = isBullish ? 
        'Bearish harami detected but bullish context may invalidate' : 
        'Small candle contained within prior large bullish candle → Indecision after buying → Potential distribution → Confirmation needed on next candle → Best at resistance';
      {
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 10, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'morning_star':
      explanation = isBullish ? 
        'Bearish candle → Small indecision doji/candle → Large bullish candle → Three-candle reversal pattern → Gap down then gap up shows shift → Strong bullish reversal signal' : 
        'Morning star detected but context suggests caution';
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
      explanation = isBullish ? 
        'Evening star detected but bullish context may invalidate' : 
        'Bullish candle → Small star/doji at top → Large bearish candle → Three-candle reversal at peak → Gaps show momentum shift → Reliable bearish signal';
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
      explanation = isBullish ? 
        'Bullish candle pierces above midpoint of prior bearish candle → Strong buying pressure → Reversal from downtrend → Best at support levels → Volume confirmation important' : 
        'Piercing pattern detected but context suggests caution';
      {
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) + 10, direction: 'up', 
            color: '#10b981', size: 18 }
        );
      }
      break;

    case 'dark_cloud_cover':
      explanation = isBullish ? 
        'Dark cloud cover detected but bullish context may invalidate' : 
        'Bearish candle opens above prior close and closes below midpoint → Selling pressure overtakes → Distribution signal → Most effective at resistance → Volume validates move';
      {
        highlights.push(
          { type: 'arrow', idx: safeIdx(0), price: getClose(0) - 10, direction: 'down', 
            color: '#ef4444', size: 18 }
        );
      }
      break;

    case 'shooting_star':
      explanation = isBullish ? 
        'Shooting star detected but bullish context may invalidate' : 
        'Long upper wick shows rejection at highs → Small body near low → Failed breakout attempt → Bearish reversal signal after uptrend → Confirmation on next candle';
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
      explanation = isBullish ? 
        'Hanging man detected but bullish context may invalidate' : 
        'Long lower wick after uptrend tests support → Small body near high → Buyers defended but sellers aggressive → Potential bearish reversal → Needs confirmation';
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

    case 'darvas_box':
      explanation = isBullish ? 
        'Consolidation within rectangular box → Price oscillates in defined range → Volume contracts during consolidation → Breakout above resistance on volume surge → Continuation pattern shows strength' : 
        'Darvas box detected but context suggests caution';
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
      explanation = isBullish ? 
        'Steep powerful rally creates flagpole → Very tight consolidation lasting 5-15 periods → Minimal pullback shows strong hands → Explosive breakout potential → One of strongest continuation patterns' : 
        'High tight flag detected but context suggests caution';
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
      explanation = isBullish ? 
        'Volume surge significantly above average on up-day → Institutional buying likely → Price breaks key resistance → Strong momentum signal → Often precedes sustained moves' : 
        'Pocket pivot detected but context suggests caution';
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
      explanation = isBullish ? 
        'Multiple increasingly tight consolidation ranges → Volatility contracting with each base → Coiled spring effect building → Breakout typically violent → High probability setup' : 
        'VCP detected but context suggests caution';
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
      explanation = isBullish ? 
        'Horizontal consolidation with flat resistance → Repeated tests weaken resistance → Price coiling under key level → Breakout confirms continuation → Target = rectangle height added to breakout' : 
        'Bullish rectangle detected but context suggests caution';
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
      explanation = isBullish ? 
        'Bearish rectangle detected but bullish context may invalidate' : 
        'Horizontal consolidation with flat support → Multiple support tests show weakness → Price coiling above key level → Breakdown confirms continuation → Target = rectangle height subtracted';
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
      explanation = isBullish ? 
        'Broadening formation detected but bullish context may invalidate' : 
        'Expanding volatility creates widening range → Higher highs and lower lows → Increasing uncertainty and volatility → Breakdown from megaphone confirms bearish → Classic distribution pattern';
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
      explanation = isBullish ? 
        'Death cross detected but bullish context may invalidate' : 
        'Short-term MA crosses below long-term MA → Momentum shifting bearish → Trend reversal signal → Lagging indicator but confirms weakness → Works best in trending markets';
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

    case 'gartley_bullish':
      explanation = isBullish ? 
        'Fibonacci ratios align: XA→AB→BC→CD → Harmonic pattern completion → 61.8% XA retracement → 127.2% BC extension → High-probability bullish reversal zone' : 
        'Gartley bullish detected but context suggests caution';
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
      explanation = isBullish ? 
        'Bat harmonic pattern → Precise Fibonacci retracements → 88.6% XA retracement critical → Tight stop-loss placement → High win-rate reversal setup' : 
        'Bat pattern bullish detected but context suggests caution';
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
      explanation = isBullish ? 
        'Crab harmonic with extreme 161.8% XA extension → Deepest retracement pattern → Powerful reversal potential → Tight PRZ (Potential Reversal Zone) → Best risk-reward ratio' : 
        'Crab pattern bullish detected but context suggests caution';
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
      explanation = isBullish ? 
        'Butterfly harmonic → 127.2% XA extension target → Wider PRZ than other patterns → Strong reversal signal → Best with volume confirmation' : 
        'Butterfly pattern bullish detected but context suggests caution';
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

    case 'gartley_bearish':
      explanation = isBullish ? 
        'Gartley bearish detected but bullish context may invalidate' : 
        'Fibonacci ratios align: XA→AB→BC→CD → Harmonic pattern completion at resistance → 61.8% XA retracement → 127.2% BC extension → High-probability bearish reversal zone';
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
      explanation = isBullish ? 
        'Bat pattern bearish detected but bullish context may invalidate' : 
        'Bat harmonic pattern bearish → Precise Fibonacci levels → 88.6% XA retracement at resistance → Tight stop above X → High win-rate distribution setup';
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
      explanation = isBullish ? 
        'Crab pattern bearish detected but bullish context may invalidate' : 
        'Crab harmonic bearish with extreme extension → 161.8% XA target → Deepest retracement shows exhaustion → Powerful reversal from highs → Excellent risk-reward';
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
      explanation = isBullish ? 
        'Butterfly pattern bearish detected but bullish context may invalidate' : 
        'Butterfly harmonic bearish → 127.2% XA extension complete → Wider PRZ signals distribution → Strong sell signal → Volume spike confirms';
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

    case 'wyckoff_spring':
      explanation = isBullish ? 
        'False breakdown below support → Stop-loss hunters triggered → Smart money accumulation at lows → Rapid reversal with volume → Bullish continuation confirmed' : 
        'Wyckoff spring detected but context suggests caution';
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
      explanation = isBullish ? 
        'Wyckoff upthrust detected but bullish context may invalidate' : 
        'False breakout above resistance → Retail trapped at highs → Smart money distribution → Rapid reversal with selling pressure → Bearish continuation confirmed';
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

    case 'elliott_wave_5_complete':
      explanation = isBullish ? 
        'Elliott Wave 5 exhaustion → Corrective ABC wave begins → Wave C completion signals opportunity → New impulse wave forming → Bullish trend resumption ahead' : 
        'Elliott wave 5 complete detected but context suggests caution';
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
      explanation = isBullish ? 
        'Elliott wave C complete detected but bullish context may invalidate' : 
        'Elliott Wave C exhaustion at resistance → Impulse wave complete → Five-wave correction finished → New downtrend beginning → Bearish opportunity confirmed';
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

    case 'descending_broadening_wedge':
      explanation = isBullish ? 
        'Expanding range with downward bias → Increasing volatility → Lower lows and highs widen → Breakout above upper boundary → Bullish reversal pattern' : 
        'Descending broadening wedge detected but context suggests caution';
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
      explanation = isBullish ? 
        'Ascending broadening wedge detected but bullish context may invalidate' : 
        'Expanding range with upward bias → Widening price action → Higher highs and lows diverge → Breakdown below support → Bearish reversal confirmed';
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

    case 'inverse_scallop':
      explanation = isBullish ? 
        'J-shaped gradual recovery → Accelerating upward momentum → Volume increasing with price → Smooth curved accumulation → Bullish continuation pattern' : 
        'Inverse scallop detected but context suggests caution';
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
      explanation = isBullish ? 
        'Scallop top detected but bullish context may invalidate' : 
        'Inverted J-shape at top → Decelerating momentum → Volume decreasing into rollover → Smooth curved distribution → Bearish reversal pattern';
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

class MarketStructureGenerator {
  constructor() {
    this.config = DIFFICULTY_CONFIG;
    this.rng = Math.random;
  }

  seed(s) {
    let seed = s;
    this.rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  generate() {
    const { contextSize } = this.config;
    
    let attempts = 0;
    let structure = null;
    
    while (attempts < 50) {
      attempts++;
      
      const setupType = this._pickSetupType();
      const signal = setupType.signal;

      const context = this._buildContext(setupType, contextSize);

      const setupCandles = this._buildSetup(setupType, context);

      const candles = [...context.candles, ...setupCandles];
      const decisionIndex = candles.length - 1;

      const edgeScore = this._validateEdge(candles, decisionIndex, setupType, context);
      
      if (edgeScore >= 2) {
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
            edgeScore, 
          },
          pattern: setupType.name,
          regime: context.regime,
        };
        break;
      }
    }
    
    if (!structure) {
      return this._generateGuaranteedCleanSetup();
    }
    
    return structure;
  }
  
  _validateEdge(candles, decisionIndex, setupType, context) {
    let score = 0;
    const lookback = 15;
    const recentCandles = candles.slice(Math.max(0, decisionIndex - lookback), decisionIndex + 1);
    
    if (recentCandles.length < 5) return 0;
    
    const hasStructuralTrend = this._checkStructuralTrend(recentCandles, setupType.signal);
    if (hasStructuralTrend) score++;
    
    const hasRangeHold = this._checkRangeHold(recentCandles, setupType.signal);
    if (hasRangeHold) score++;
    
    const hasMomentum = this._checkMomentumExpansion(candles, decisionIndex);
    if (hasMomentum) score++;
    
    const contextAligned = (
      (setupType.signal === "BUY" && (context.regime === "uptrend" || context.regime === "downtrend_exhausting")) ||
      (setupType.signal === "SELL" && (context.regime === "downtrend" || context.regime === "uptrend_exhausting"))
    );
    if (contextAligned) score++;
    
    const hasRejection = this._checkRejection(recentCandles, setupType.signal);
    if (hasRejection) score++;
    
    return score;
  }
  
  _checkStructuralTrend(candles, signal) {
    if (candles.length < 6) return false;
    
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    
    if (signal === "BUY") {
      let higherLows = 0;
      for (let i = 3; i < lows.length; i++) {
        const recentLow = Math.min(...lows.slice(i - 3, i));
        if (lows[i] > recentLow * 1.001) higherLows++;
      }
      return higherLows >= 2;
    } else {
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
      const supportLevel = Math.min(...lows);
      const touches = lows.filter(l => Math.abs(l - supportLevel) / supportLevel < 0.015).length;
      return touches >= 2;
    } else {
      const resistanceLevel = Math.max(...highs);
      const touches = highs.filter(h => Math.abs(h - resistanceLevel) / resistanceLevel < 0.015).length;
      return touches >= 2;
    }
  }
  
  _checkMomentumExpansion(candles, decisionIndex) {
    if (decisionIndex < 3) return false;
    
    const current = candles[decisionIndex];
    const currentRange = current.high - current.low;
    
    const recentRanges = [];
    for (let i = Math.max(0, decisionIndex - 5); i < decisionIndex; i++) {
      recentRanges.push(candles[i].high - candles[i].low);
    }
    const avgRange = recentRanges.reduce((a, b) => a + b, 0) / recentRanges.length;
    
    return currentRange > avgRange * 1.2;
  }
  
  _checkRejection(candles, signal) {
    if (candles.length < 4) return false;
    
    for (let i = Math.max(0, candles.length - 4); i < candles.length; i++) {
      const c = candles[i];
      const bodySize = Math.abs(c.close - c.open);
      const totalRange = c.high - c.low;
      
      if (signal === "BUY") {
        const lowerWick = Math.min(c.open, c.close) - c.low;
        if (lowerWick > bodySize * 1.5 && lowerWick / totalRange > 0.4) {
          return true;
        }
      } else {
        const upperWick = c.high - Math.max(c.open, c.close);
        if (upperWick > bodySize * 1.5 && upperWick / totalRange > 0.4) {
          return true;
        }
      }
    }
    return false;
  }
  
  _generateGuaranteedCleanSetup() {
    const signal = this.rng() < 0.5 ? "BUY" : "SELL";
    const candles = [];
    let price = 1000;
    
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
    
    const bodySize = price * 0.02;
    const open = price;
    const close = signal === "BUY" ? open + bodySize : open - bodySize;
    const high = signal === "BUY" ? close + bodySize * 0.2 : Math.max(open, close) + bodySize * 0.1;
    const low = signal === "BUY" ? Math.min(open, close) - bodySize * 0.1 : close - bodySize * 0.2;
    candles.push({ open, high, low, close });
    
    const decisionIndex = candles.length - 1;
    
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

    if (r < 0.0625) {
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

    const phase2Length = Math.floor(contextSize * 0.25);
    let priorPattern = "None";

    if (setupType.type.includes("continuation")) {
      const pullbackDir = setupType.type === "bullish_continuation" ? -0.0015 : 0.0015;
      candles.push(...this._trendCandles(price, phase2Length, pullbackDir, 0.01, 0.45));
      priorPattern = "Pullback";
    } else if (setupType.type.includes("reversal")) {
      if (setupType.type === "bullish_reversal") {
        candles.push(...this._failedRally(price, phase2Length));
        priorPattern = "Failed Rally";
      } else {
        candles.push(...this._failedDip(price, phase2Length));
        priorPattern = "Failed Dip";
      }
    } else if (setupType.type.includes("trap")) {
      candles.push(...this._rangeCandles(price, phase2Length, 0.008));
      priorPattern = "Choppy Range";
    } else {
      candles.push(...this._rangeCandles(price, phase2Length, 0.008));
      priorPattern = "Consolidation";
    }

    price = candles[candles.length - 1].close;

    const phase3Length = Math.floor(contextSize * 0.15);
    candles.push(...this._compressionCandles(price, phase3Length, 0.006));

    return {
      candles,
      regime,
      bias,
      priorPattern,
    };
  }

  _trendCandles(startPrice, count, drift, volatility, bullRatio) {
    const candles = [];
    let price = startPrice;

    for (let i = 0; i < count; i++) {
      const isBull = this.rng() < bullRatio;
      const bodyPercent = 0.4 + this.rng() * 0.4; 
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

  _rangeCandles(centerPrice, count, rangeSize) {
    const candles = [];
    const high = centerPrice * (1 + rangeSize);
    const low = centerPrice * (1 - rangeSize);
    let price = centerPrice;

    for (let i = 0; i < count; i++) {
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

  _compressionCandles(startPrice, count, baseVol) {
    const candles = [];
    let price = startPrice;

    for (let i = 0; i < count; i++) {
      const compressionFactor = 1 - (i / count) * 0.5; 
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

  _failedRally(startPrice, count) {
    const candles = [];
    let price = startPrice;

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

  _failedDip(startPrice, count) {
    const candles = [];
    let price = startPrice;

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
      const channelTop = startPrice * 1.008;
      const channelBottom = startPrice * 0.992;
      const channelMid = (channelTop + channelBottom) / 2;
      const channelHeight = channelTop - channelBottom;
      
      for (let i = 0; i < setupLength; i++) {
        const progress = i / setupLength;
        
        const priceTarget = channelMid - (channelHeight * 0.15 * progress);
        
        const oscillation = Math.sin(i * 0.8) * channelHeight * 0.25;
        let price = priceTarget + oscillation;
        
        const vol = 0.004 * (1 - progress * 0.3); 
        const isBull = this.rng() < 0.48;
        const bodySize = price * vol * (0.3 + this.rng() * 0.2);
        const wickSize = bodySize * (0.5 + this.rng() * 0.4);

        const open = price;
        const close = isBull ? open + bodySize : open - bodySize;
        
        const high = Math.min(Math.max(open, close) + wickSize, channelTop);
        const low = Math.max(Math.min(open, close) - wickSize, channelBottom);

        candles.push({ open, high, low, close });
      }
    } else if (setupType.type === "bearish_continuation") {
      const channelTop = startPrice * 1.008;
      const channelBottom = startPrice * 0.992;
      const channelMid = (channelTop + channelBottom) / 2;
      const channelHeight = channelTop - channelBottom;
      
      for (let i = 0; i < setupLength; i++) {
        const progress = i / setupLength;
        
        const priceTarget = channelMid + (channelHeight * 0.15 * progress);
        
        const oscillation = Math.sin(i * 0.8) * channelHeight * 0.25;
        let price = priceTarget + oscillation;
        
        const vol = 0.004 * (1 - progress * 0.3); 
        const isBull = this.rng() < 0.52;
        const bodySize = price * vol * (0.3 + this.rng() * 0.2);
        const wickSize = bodySize * (0.5 + this.rng() * 0.4);

        const open = price;
        const close = isBull ? open + bodySize : open - bodySize;
        
        const high = Math.min(Math.max(open, close) + wickSize, channelTop);
        const low = Math.max(Math.min(open, close) - wickSize, channelBottom);

        candles.push({ open, high, low, close });
      }
    } else if (setupType.type === "bullish_reversal") {
      let price = startPrice;
      const bottomPrice = startPrice * 0.985; 
      const peakPrice = startPrice * 1.005; 
      
      const firstBottomLength = Math.floor(setupLength * 0.3);
      for (let i = 0; i < firstBottomLength; i++) {
        const progress = i / firstBottomLength;
        const targetPrice = startPrice - (startPrice - bottomPrice) * progress;
        
        const isBull = this.rng() < 0.3;
        const bodySize = price * 0.008 * (0.4 + this.rng() * 0.3);
        const wickSize = bodySize * (0.6 + this.rng() * 0.6);
        
        const open = targetPrice;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize;
        const low = Math.min(open, close) - wickSize;
        
        candles.push({ open, high, low, close });
        price = close;
      }
      
      const rallyLength = Math.floor(setupLength * 0.35);
      for (let i = 0; i < rallyLength; i++) {
        const progress = i / rallyLength;
        const targetPrice = bottomPrice + (peakPrice - bottomPrice) * progress;
        
        const isBull = this.rng() < 0.7;
        const bodySize = price * 0.008 * (0.4 + this.rng() * 0.3);
        const wickSize = bodySize * (0.4 + this.rng() * 0.4);
        
        const open = targetPrice;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize;
        const low = Math.min(open, close) - wickSize;
        
        candles.push({ open, high, low, close });
        price = close;
      }
      
      const secondBottomLength = Math.floor(setupLength * 0.35);
      for (let i = 0; i < secondBottomLength; i++) {
        const progress = i / secondBottomLength;
        const targetPrice = peakPrice - (peakPrice - bottomPrice) * progress;
        
        const isBull = this.rng() < 0.45;
        const bodySize = price * 0.008 * (0.4 + this.rng() * 0.3);
        const wickSize = bodySize * (0.5 + this.rng() * 0.5);
        
        const open = targetPrice;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize;
        const low = Math.min(open, close) - wickSize;
        
        candles.push({ open, high, low, close });
        price = close;
      }
    } else if (setupType.type === "bearish_reversal") {
      let price = startPrice;
      const topPrice = startPrice * 1.015; 
      const troughPrice = startPrice * 0.995; 
      
      const firstTopLength = Math.floor(setupLength * 0.3);
      for (let i = 0; i < firstTopLength; i++) {
        const progress = i / firstTopLength;
        const targetPrice = startPrice + (topPrice - startPrice) * progress;
        
        const isBull = this.rng() < 0.7;
        const bodySize = price * 0.008 * (0.4 + this.rng() * 0.3);
        const wickSize = bodySize * (0.6 + this.rng() * 0.6);
        
        const open = targetPrice;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize;
        const low = Math.min(open, close) - wickSize;
        
        candles.push({ open, high, low, close });
        price = close;
      }
      
      const dipLength = Math.floor(setupLength * 0.35);
      for (let i = 0; i < dipLength; i++) {
        const progress = i / dipLength;
        const targetPrice = topPrice - (topPrice - troughPrice) * progress;
        
        const isBull = this.rng() < 0.3;
        const bodySize = price * 0.008 * (0.4 + this.rng() * 0.3);
        const wickSize = bodySize * (0.4 + this.rng() * 0.4);
        
        const open = targetPrice;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize;
        const low = Math.min(open, close) - wickSize;
        
        candles.push({ open, high, low, close });
        price = close;
      }
      
      const secondTopLength = Math.floor(setupLength * 0.35);
      for (let i = 0; i < secondTopLength; i++) {
        const progress = i / secondTopLength;
        const targetPrice = troughPrice + (topPrice - troughPrice) * progress;
        
        const isBull = this.rng() < 0.55;
        const bodySize = price * 0.008 * (0.4 + this.rng() * 0.3);
        const wickSize = bodySize * (0.5 + this.rng() * 0.5);
        
        const open = targetPrice;
        const close = isBull ? open + bodySize : open - bodySize;
        const high = Math.max(open, close) + wickSize;
        const low = Math.min(open, close) - wickSize;
        
        candles.push({ open, high, low, close });
        price = close;
      }
    } else if (setupType.type.includes("trap") || setupType.type === "consolidation") {
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
      5. CHART RENDERER 
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

    const bottomPadding = mobile ? 150 : 150;
    const topPadding = 50;
    const chartHeight = height - bottomPadding - topPadding;
    const toY = price => topPadding + (1 - ((price - minPrice) / (maxPrice - minPrice))) * chartHeight + verticalOffset;

    const minBodyHeight = mobile ? 5 : 3;
    const maxWickHeight = mobile ? 25 : 20;

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
      const y = topPadding + (i / 4) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(leftPadding, y);
      ctx.lineTo(width - rightPadding + 10, y);
      ctx.stroke();
    }

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
      ctx.lineWidth = 0; 
      bullCandles.forEach(cd => {
        ctx.beginPath();
        ctx.roundRect(cd.x, cd.top, cd.bodyWidth, cd.bodyHeight, mobile ? 4 : 3);
        ctx.fill();
      });
    }

    if (bearCandles.length > 0) {
      ctx.fillStyle = C.bear;
      ctx.strokeStyle = C.bear;
      ctx.lineWidth = 0; 
      bearCandles.forEach(cd => {
        ctx.beginPath();
        ctx.roundRect(cd.x, cd.top, cd.bodyWidth, cd.bodyHeight, mobile ? 4 : 3);
        ctx.fill();
      });
    }

    if (annotation && annotation.highlights) {
      this.drawAnnotations(annotation, visible, startIdx, toY, leftPadding, slotWidth, bodyWidth);
    }

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

    const labelPositions = [];

    const getX = idx => {
      if (idx < startIdx || idx > endIdx) return null;
      return leftPadding + (idx - startIdx) * slotWidth + slotWidth / 2;
    };

    const adjustLabelPosition = (targetX, targetY, label, minSpacing = 60) => {
      const labelX = width - 200; 
      let adjustedY = targetY;
      let attempts = 0;
      const maxAttempts = 25;
      
      while (attempts < maxAttempts) {
        let hasCollision = false;
        
        for (const pos of labelPositions) {
          const dy = Math.abs(pos.y - adjustedY);
          
          if (dy < minSpacing) {
            hasCollision = true;
            adjustedY += minSpacing * 1.5; 
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

    highlights.forEach(h => {
      if (!h || !h.type) return;
      ctx.save();

      switch (h.type) {
        case 'circle': {
          const x = getX(h.idx);
          if (x === null) break;
          const y = toY(h.price);

          const isPulsing = h.pulse === true;
          const pulseScale = isPulsing ? 1 + Math.sin(Date.now() / 300) * 0.15 : 1;
          const radius = (h.radius || 6) * pulseScale;
          
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          const color = h.color || C.nGreen;
          
          if (isPulsing) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = isPulsing ? 0.85 + Math.sin(Date.now() / 300) * 0.15 : 1;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.fillStyle = color + '20';
          ctx.fill();
          
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(x - radius * 0.2, y - radius * 0.2, radius * 0.3, 0, Math.PI * 2);
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

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          const color = h.color || C.neut;
          
          ctx.strokeStyle = color;
          ctx.lineWidth = (h.width || 1.5) + 2;
          ctx.globalAlpha = 0.2;
          
          if (h.dashed || h.style === 'dashed') {
            ctx.setLineDash([6, 6]);
          }
          
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          ctx.strokeStyle = color;
          ctx.lineWidth = h.width || 2;
          ctx.globalAlpha = 1;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          break;
        }

        case 'rect': {
          if (h.endIdx < startIdx || h.startIdx > endIdx) break;
          
          const x1 = leftPadding + Math.max(0, (h.startIdx - startIdx)) * slotWidth;
          const x2 = leftPadding + Math.min(visibleCandles.length, (h.endIdx - startIdx + 1)) * slotWidth;
          const yTop = toY(h.priceTop);
          const yBot = toY(h.priceBot);

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          const color = h.color || C.nAmber;

          const gradient = ctx.createLinearGradient(x1, yTop, x1, yBot);
          gradient.addColorStop(0, color + '18');
          gradient.addColorStop(0.5, color + '10');
          gradient.addColorStop(1, color + '18');
          ctx.fillStyle = gradient;
          ctx.fillRect(x1, yTop, x2 - x1, yBot - yTop);

          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.15;
          ctx.setLineDash([8, 5]);
          ctx.strokeRect(x1, yTop, x2 - x1, yBot - yTop);

          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 1;
          ctx.setLineDash([8, 5]);
          ctx.lineCap = 'round';
          ctx.strokeRect(x1, yTop, x2 - x1, yBot - yTop);
          
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          break;
        }

        case 'arrow': {
          const x = getX(h.idx);
          if (x === null) break;
          
          const yBase = toY(h.price);
          const dirUp = h.direction === 'up';
          const color = h.color || (dirUp ? C.bull : C.bear);
          const size = h.size || 18;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          ctx.strokeStyle = color;
          ctx.fillStyle = color;
          ctx.lineWidth = 4;
          ctx.globalAlpha = 0.2;
          
          ctx.beginPath();
          ctx.moveTo(x, yBase);
          ctx.lineTo(x, dirUp ? yBase - size * 1.3 : yBase + size * 1.3);
          ctx.stroke();

          ctx.strokeStyle = color;
          ctx.lineWidth = 2.8;
          ctx.globalAlpha = 1;

          ctx.beginPath();
          ctx.moveTo(x, yBase);
          ctx.lineTo(x, dirUp ? yBase - size * 1.3 : yBase + size * 1.3);
          ctx.stroke();

          ctx.fillStyle = color;
          ctx.globalAlpha = 1;
          
          ctx.beginPath();
          if (dirUp) {
            ctx.moveTo(x, yBase - size * 1.3);
            ctx.lineTo(x - size * 0.55, yBase - size * 0.7);
            ctx.lineTo(x + size * 0.55, yBase - size * 0.7);
          } else {
            ctx.moveTo(x, yBase + size * 1.3);
            ctx.lineTo(x - size * 0.55, yBase + size * 0.7);
            ctx.lineTo(x + size * 0.55, yBase + size * 0.7);
          }
          ctx.closePath();
          ctx.fill();
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.globalAlpha = 0.6;
          
          ctx.beginPath();
          if (dirUp) {
            ctx.moveTo(x, yBase - size * 1.3);
            ctx.lineTo(x - size * 0.3, yBase - size * 0.85);
            ctx.lineTo(x + size * 0.3, yBase - size * 0.85);
          } else {
            ctx.moveTo(x, yBase + size * 1.3);
            ctx.lineTo(x - size * 0.3, yBase + size * 0.85);
            ctx.lineTo(x + size * 0.3, yBase + size * 0.85);
          }
          ctx.closePath();
          ctx.fill();
          
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
    background: disabled ? `rgba(12, 20, 35, 0.15)` : `rgba(0, 0, 0, 0.2)`,
    border: `1.5px solid rgba(255, 255, 255, 0.1)`,
    borderRadius: 16,
    padding: "12px 24px",
    color: disabled ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "wait" : "pointer",
    backdropFilter: "blur(10px)",
    transform: !disabled && isHovered ? "translateY(-1px)" : "translateY(0)",
    boxShadow: !disabled && isHovered ? `0 4px 16px rgba(0, 0, 0, 0.3)` : "none",
    transition: "all 0.2s ease",
    willChange: "transform, box-shadow",
    opacity: disabled ? 0.6 : 0.9,
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
          {correct ? "BASED" : "Incorrect"}
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
  const [copied, setCopied] = useState(false);

  const roast = useMemo(() => generateRoast(stats), [stats]);
  const meme = useMemo(() => getMemeForScore(stats.accuracy), [stats.accuracy]);

  const handleTwitterShare = useCallback(() => {
    shareToTwitter(stats, roast);
    sound.click();
    haptic([20]);
  }, [stats, roast]);

  const handleGenericShare = useCallback(async () => {
    sound.click();
    haptic([20]);
    window.currentPlayerName = playerName;
    const shared = await genericShare(stats, roast);
    if (!shared) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [stats, roast, playerName]);

  const [scorePlayerName] = useState(playerName);

  useEffect(() => {
    const saveScore = async () => {
      if (!scorePlayerName || !scorePlayerName.trim() || saved) return;
      
      try {
        const timestamp = Date.now();
        const scoreData = {
          name: scorePlayerName.trim(), 
          score: stats.totalScore,
          streak: stats.bestStreak,
          accuracy: stats.accuracy,
          timestamp
        };
        
        if (db) {
          await addDoc(collection(db, "scores"), scoreData);
          console.log("Score saved to Firebase!");
        } else {
          const existingScores = JSON.parse(localStorage.getItem("reflexGlassScores") || "[]");
          existingScores.push(scoreData);
          localStorage.setItem("reflexGlassScores", JSON.stringify(existingScores));
          console.log("Score saved to localStorage (Firebase unavailable)");
        }
        
        setSaved(true);
        haptic([50, 30, 50]);
      } catch (err) {
        console.error("Failed to save score:", err);
        try {
          const scoreData = {
            name: scorePlayerName.trim(), 
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
  }, [stats, saved, scorePlayerName]); 

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
            fontWeight: 800,
            fontFamily: "monospace",
            color: "rgba(150, 200, 255, 0.95)",
            marginTop: 30,
            marginBottom: 20,
            textShadow: "0 0 25px rgba(100, 180, 255, 0.7), 0 0 50px rgba(100, 180, 255, 0.3), 0 3px 6px rgba(0,0,0,0.4)",
            letterSpacing: '3px'
          }}
        >
          {stats.totalScore.toLocaleString()}
        </div>

        {/* Player name instead of grade - blue color */}
        <div style={{ 
          fontSize: 15, 
          fontWeight: 700,
          marginTop: -24.5, 
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
            fontSize: 13, 
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
            gap: 10,
            padding: "10 20px",
            marginTop: 30
          }}
        >
          <div>
            <div style={{ 
              fontSize: 8, 
              color: "rgba(150, 180, 200, 0.45)", 
              marginBottom: 4, 
              textShadow: "0 1px 3px rgba(0,0,0,0.7)",
              letterSpacing: '1px',
              fontWeight: 1600
            }}>
              ACCURACY
            </div>
            <div style={{ 
              fontSize: 22, 
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
              fontSize: 22, 
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
              fontSize: 22, 
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

      {/* Action buttons - transparent, no background */}
      <div style={{ 
        position: "absolute",
        bottom: 140,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(85%, 450px)",
        padding: "10px"
      }}>
        {saved && (
          <div style={{ 
            display: "none"
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
              background: "rgba(0, 0, 0, 0.2)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backdropFilter: 'blur(6px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-1px)";
              e.target.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)";
              e.target.style.background = "rgba(15, 15, 15, 0.3)";
              e.target.style.borderColor = "rgba(255,255,255,0.2)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.05)";
              e.target.style.background = "rgba(0, 0, 0, 0.2)";
              e.target.style.borderColor = "rgba(255,255,255,0.1)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Share on X
          </button>
          
          <button
            onClick={handleGenericShare}
            style={{
              flex: 1,
              padding: "10px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.9)",
              background: copied ? "rgba(0, 230, 118, 0.3)" : "linear-gradient(135deg, rgba(30, 100, 255, 0.25) 0%, rgba(50, 180, 255, 0.25) 100%)",
              border: copied ? "1px solid rgba(0, 230, 118, 0.3)" : "1px solid rgba(100, 180, 255, 0.2)",
              borderRadius: 10,
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backdropFilter: 'blur(6px)',
              boxShadow: copied ? '0 0 12px rgba(0, 230, 118, 0.2)' : 'inset 0 1px 0 rgba(255,255,255,0.08)'
            }}
            onMouseEnter={(e) => {
              if (!copied) {
                e.target.style.transform = "translateY(-1px)";
                e.target.style.boxShadow = "0 4px 16px rgba(50, 180, 255, 0.25), inset 0 1px 0 rgba(255,255,255,0.15)";
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = copied ? '0 0 12px rgba(0, 230, 118, 0.2)' : 'inset 0 1px 0 rgba(255,255,255,0.08)';
            }}
          >
            {copied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
                Share
              </>
            )}
          </button>
        </div>

        {/* Action buttons - compact */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <GlassButton onClick={onRestart} color="rgba(80, 230, 180, 1)" style={{ 
              flex: 1, 
              padding: "10px 0", 
              fontSize: 12, 
              fontWeight: 600,
              background: "linear-gradient(135deg, rgba(80, 230, 180, 0.25), rgba(80, 230, 180, 0.15))",
              border: "1.5px solid rgba(80, 230, 180, 0.4)",
              color: "rgba(255, 255, 255, 0.95)"
            }}>
              Play Again
            </GlassButton>
            <GlassButton onClick={onLeaderboard} color="rgba(100, 180, 255, 1)" style={{ 
              flex: 1, 
              padding: "10px 0", 
              fontSize: 12, 
              fontWeight: 600,
              background: "linear-gradient(135deg, rgba(100, 180, 255, 0.25), rgba(100, 180, 255, 0.15))",
              border: "1.5px solid rgba(100, 180, 255, 0.4)",
              color: "rgba(255, 255, 255, 0.95)"
            }}>
              Leaderboard
            </GlassButton>
          </div>
          
          {/* Support the Dev */}
          <SupportDevButton />
        </div>
      </div>
    </div>
  );
};


const SupportDevButton = () => {
  const [showOptions, setShowOptions] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [txStatus, setTxStatus] = useState(null); 
  const [txHash, setTxHash] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const RECIPIENT_ADDRESS = "0xa800F14C07935e850e9e20221956d99920E9a498";
  const BASE_CHAIN_ID = "0x2105"; 

  const handleDonate = async (amount) => {
    try {
      setIsConnecting(true);
      setTxStatus(null);
      setErrorMessage("");
      setTxHash("");

      if (!window.ethereum) {
        setTxStatus('error');
        setErrorMessage("Please install MetaMask or another Web3 wallet to donate! 🦊");
        setIsConnecting(false);
        return;
      }

      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });

      const chainId = await window.ethereum.request({ 
        method: 'eth_chainId' 
      });

      if (chainId !== BASE_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_CHAIN_ID }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: BASE_CHAIN_ID,
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
            } catch (addError) {
              console.error("Error adding Base network:", addError);
              setTxStatus('error');
              setErrorMessage("Failed, try again");
              setIsConnecting(false);
              return;
            }
          } else {
            console.error("Error switching to Base network:", switchError);
            setTxStatus('error');
            setErrorMessage("Failed, try again");
            setIsConnecting(false);
            return;
          }
        }
      }

      const amountInWei = '0x' + Math.floor(amount * 1e18).toString(16);

      const transactionHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: accounts[0],
          to: RECIPIENT_ADDRESS,
          value: amountInWei,
        }],
      });

      console.log("Transaction sent:", transactionHash);
      setTxHash(transactionHash);
      setTxStatus('success');
      
      setTimeout(() => {
        setShowOptions(false);
        setShowCustomInput(false);
        setCustomAmount("");
        setTxStatus(null);
        setTxHash("");
      }, 5000);
      
    } catch (error) {
      console.error("Donation error:", error);
      setTxStatus('error');
      
      if (error.code === 4001) {
        setErrorMessage("Transaction cancelled by user.");
      } else {
        setErrorMessage("Failed, try again");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCustomDonate = () => {
    const amount = parseFloat(customAmount);
    if (amount && amount > 0) {
      handleDonate(amount);
    } else {
      setTxStatus('error');
      setErrorMessage("Please enter a valid amount.");
    }
  };

  if (showOptions) {
    if (txStatus === 'success') {
      return (
        <div style={{
          background: "linear-gradient(135deg, rgba(0, 230, 118, 0.2), rgba(0, 200, 100, 0.15))",
          border: "1.5px solid rgba(0, 230, 118, 0.4)",
          borderRadius: 12,
          padding: "16px",
          backdropFilter: "blur(12px)",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: 32,
            marginBottom: 8,
          }}>
            🎉
          </div>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: "rgba(0, 230, 118, 1)",
            marginBottom: 8,
          }}>
            Thank you for your support!
          </div>
          <div style={{
            fontSize: 11,
            color: "rgba(255, 255, 255, 0.8)",
            marginBottom: 12,
            lineHeight: 1.5,
          }}>
            You are amazing. I truly appreciate your generosity!
          </div>
          {txHash && (
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                fontSize: 10,
                color: "rgba(100, 200, 255, 0.9)",
                textDecoration: "none",
                padding: "6px 12px",
                background: "rgba(0, 122, 255, 0.15)",
                border: "1px solid rgba(100, 200, 255, 0.3)",
                borderRadius: 8,
                marginBottom: 12,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "rgba(0, 122, 255, 0.25)";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(0, 122, 255, 0.15)";
              }}
            >
              View on BaseScan →
            </a>
          )}
          <div style={{
            fontSize: 9,
            color: "rgba(255, 255, 255, 0.5)",
            marginTop: 8,
          }}>
            Closing in 5 seconds...
          </div>
        </div>
      );
    }

    if (txStatus === 'error') {
      return (
        <div style={{
          background: "linear-gradient(135deg, rgba(255, 77, 77, 0.15), rgba(255, 50, 50, 0.1))",
          border: "1.5px solid rgba(255, 77, 77, 0.35)",
          borderRadius: 12,
          padding: "16px",
          backdropFilter: "blur(12px)",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: 32,
            marginBottom: 8,
          }}>
            ⚠️
          </div>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: "rgba(255, 100, 100, 1)",
            marginBottom: 8,
          }}>
            Transaction Failed
          </div>
          <div style={{
            fontSize: 11,
            color: "rgba(255, 255, 255, 0.8)",
            marginBottom: 12,
            lineHeight: 1.5,
          }}>
            {errorMessage}
          </div>
          <button
            onClick={() => {
              setTxStatus(null);
              setErrorMessage("");
              setShowOptions(false);
              setShowCustomInput(false);
              setCustomAmount("");
            }}
            style={{
              width: "100%",
              padding: "8px",
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.9)",
              background: "rgba(255, 77, 77, 0.2)",
              border: "1px solid rgba(255, 77, 77, 0.3)",
              borderRadius: 8,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "rgba(255, 77, 77, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "rgba(255, 77, 77, 0.2)";
            }}
          >
            Close
          </button>
        </div>
      );
    }

    return (
      <div style={{
        background: "linear-gradient(135deg, rgba(0, 82, 255, 0.15), rgba(0, 122, 255, 0.1))",
        border: "1.5px solid rgba(0, 122, 255, 0.35)",
        borderRadius: 12,
        padding: "12px",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: "rgba(100, 200, 255, 0.95)",
          marginBottom: 10,
          textAlign: "center",
          letterSpacing: "0.5px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6
        }}>
          <svg width="14" height="14" viewBox="0 0 111 111" fill="currentColor">
            <path d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6318 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H3.9565e-07C2.35281 87.8625 26.0432 110.034 54.921 110.034Z" />
          </svg>
          Support via Base Network
        </div>
        
        {!showCustomInput ? (
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <button
              onClick={() => handleDonate(0.0005)}
              disabled={isConnecting}
              style={{
                flex: 1,
                padding: "8px",
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
                background: isConnecting ? "rgba(100, 100, 100, 0.2)" : "rgba(0, 122, 255, 0.2)",
                border: "1px solid rgba(0, 122, 255, 0.3)",
                borderRadius: 8,
                cursor: isConnecting ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                opacity: isConnecting ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isConnecting) {
                  e.target.style.background = "rgba(0, 122, 255, 0.3)";
                  e.target.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(0, 122, 255, 0.2)";
                e.target.style.transform = "translateY(0)";
              }}
            >
              0.0005 ETH
            </button>
            
            <button
              onClick={() => handleDonate(0.001)}
              disabled={isConnecting}
              style={{
                flex: 1,
                padding: "8px",
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
                background: isConnecting ? "rgba(100, 100, 100, 0.2)" : "rgba(0, 122, 255, 0.2)",
                border: "1px solid rgba(0, 122, 255, 0.3)",
                borderRadius: 8,
                cursor: isConnecting ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                opacity: isConnecting ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isConnecting) {
                  e.target.style.background = "rgba(0, 122, 255, 0.3)";
                  e.target.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(0, 122, 255, 0.2)";
                e.target.style.transform = "translateY(0)";
              }}
            >
              0.001 ETH
            </button>
            
            <button
              onClick={() => setShowCustomInput(true)}
              disabled={isConnecting}
              style={{
                flex: 1,
                padding: "8px",
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
                background: isConnecting ? "rgba(100, 100, 100, 0.25)" : "rgba(0, 82, 255, 0.25)",
                border: "1px solid rgba(0, 82, 255, 0.4)",
                borderRadius: 8,
                cursor: isConnecting ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                opacity: isConnecting ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isConnecting) {
                  e.target.style.background = "rgba(0, 82, 255, 0.35)";
                  e.target.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(0, 82, 255, 0.25)";
                e.target.style.transform = "translateY(0)";
              }}
            >
              Custom
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input
              type="number"
              step="0.0001"
              min="0"
              placeholder="Amount in ETH"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              disabled={isConnecting}
              style={{
                flex: 1,
                padding: "8px",
                fontSize: 11,
                fontWeight: 500,
                color: "rgba(255,255,255,0.9)",
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(0, 122, 255, 0.3)",
                borderRadius: 8,
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.border = "1px solid rgba(0, 122, 255, 0.5)";
              }}
              onBlur={(e) => {
                e.target.style.border = "1px solid rgba(0, 122, 255, 0.3)";
              }}
            />
            <button
              onClick={handleCustomDonate}
              disabled={isConnecting}
              style={{
                padding: "8px 16px",
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
                background: isConnecting ? "rgba(100, 100, 100, 0.3)" : "rgba(0, 82, 255, 0.3)",
                border: "1px solid rgba(0, 82, 255, 0.4)",
                borderRadius: 8,
                cursor: isConnecting ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                opacity: isConnecting ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isConnecting) {
                  e.target.style.background = "rgba(0, 82, 255, 0.4)";
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(0, 82, 255, 0.3)";
              }}
            >
              {isConnecting ? "..." : "✓"}
            </button>
          </div>
        )}
        
        {isConnecting && (
          <div style={{
            fontSize: 10,
            color: "rgba(100, 200, 255, 0.8)",
            textAlign: "center",
            marginBottom: 8,
            fontWeight: 500
          }}>
            Connecting to wallet...
          </div>
        )}
        
        <button
          onClick={() => {
            setShowOptions(false);
            setShowCustomInput(false);
            setCustomAmount("");
          }}
          disabled={isConnecting}
          style={{
            width: "100%",
            padding: "6px",
            fontSize: 10,
            fontWeight: 600,
            color: "rgba(255,255,255,0.6)",
            background: "rgba(0, 0, 0, 0.2)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            cursor: isConnecting ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            opacity: isConnecting ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isConnecting) {
              e.target.style.color = "rgba(255,255,255,0.8)";
              e.target.style.background = "rgba(0, 0, 0, 0.3)";
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.color = "rgba(255,255,255,0.6)";
            e.target.style.background = "rgba(0, 0, 0, 0.2)";
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowOptions(true)}
      style={{
        width: "100%",
        padding: "10px 0",
        fontSize: 12,
        fontWeight: 600,
        color: "rgba(100, 200, 255, 0.95)",
        background: "linear-gradient(135deg, rgba(0, 82, 255, 0.15), rgba(0, 122, 255, 0.1))",
        border: "1.5px solid rgba(0, 122, 255, 0.35)",
        borderRadius: 10,
        cursor: "pointer",
        transition: "all 0.2s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backdropFilter: "blur(8px)",
      }}
      onMouseEnter={(e) => {
        e.target.style.transform = "translateY(-1px)";
        e.target.style.background = "linear-gradient(135deg, rgba(0, 82, 255, 0.25), rgba(0, 122, 255, 0.15))";
        e.target.style.borderColor = "rgba(0, 122, 255, 0.5)";
        e.target.style.boxShadow = "0 4px 16px rgba(0, 122, 255, 0.2)";
      }}
      onMouseLeave={(e) => {
        e.target.style.transform = "translateY(0)";
        e.target.style.background = "linear-gradient(135deg, rgba(0, 82, 255, 0.15), rgba(0, 122, 255, 0.1))";
        e.target.style.borderColor = "rgba(0, 122, 255, 0.35)";
        e.target.style.boxShadow = "none";
      }}
    >
      <svg width="16" height="16" viewBox="0 0 111 111" fill="currentColor">
        <path d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6318 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H3.9565e-07C2.35281 87.8625 26.0432 110.034 54.921 110.034Z" />
      </svg>
      Support the Dev
    </button>
  );
};


const Leaderboard = ({ onBack, currentPlayerName }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playerStats, setPlayerStats] = useState(null);
  const [playerRank, setPlayerRank] = useState(null);

  useEffect(() => {
    loadLeaderboard();
  }, [currentPlayerName]);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      
      let scores = [];
      
      if (db) {
        const scoresQuery = query(
          collection(db, "scores"),
          orderBy("timestamp", "desc")
        );
        
        const querySnapshot = await getDocs(scoresQuery);
        scores = querySnapshot.docs.map(doc => doc.data());
        console.log(`Loaded ${scores.length} scores from Firebase`);
      } else {
        scores = JSON.parse(localStorage.getItem("reflexGlassScores") || "[]");
        console.log(`Loaded ${scores.length} scores from localStorage (Firebase unavailable)`);
      }
      
      if (scores.length === 0) {
        setEntries([]);
        setPlayerStats(null);
        setPlayerRank(null);
        setLoading(false);
        return;
      }
      
      const aggregated = {};
      
      scores.forEach(score => {
        if (!score.name || !score.name.trim()) return;
        
        const playerName = score.name.trim();
        
        if (!aggregated[playerName]) {
          aggregated[playerName] = {
            name: playerName,
            totalScore: 0,
            games: 0,
            bestScore: 0,
            bestStreak: 0
          };
        }
        aggregated[playerName].totalScore += score.score || 0;
        aggregated[playerName].games += 1;
        aggregated[playerName].bestScore = Math.max(aggregated[playerName].bestScore, score.score || 0);
        aggregated[playerName].bestStreak = Math.max(aggregated[playerName].bestStreak, score.streak || 0);
      });
      
      const allEntries = Object.values(aggregated)
        .sort((a, b) => b.totalScore - a.totalScore);
      
      if (currentPlayerName && currentPlayerName.trim()) {
        const playerIndex = allEntries.findIndex(e => e.name === currentPlayerName.trim());
        if (playerIndex !== -1) {
          setPlayerStats(allEntries[playerIndex]);
          setPlayerRank(playerIndex + 1);
        } else {
          setPlayerStats(null);
          setPlayerRank(null);
        }
      }
      
      setEntries(allEntries.slice(0, 10));
    } catch (err) {
      console.error("Error loading leaderboard:", err);
      try {
        const scores = JSON.parse(localStorage.getItem("reflexGlassScores") || "[]");
        if (scores.length > 0) {
          const aggregated = {};
          scores.forEach(score => {
            if (!score.name || !score.name.trim()) return;
            
            const playerName = score.name.trim();
            
            if (!aggregated[playerName]) {
              aggregated[playerName] = {
                name: playerName,
                totalScore: 0,
                games: 0,
                bestScore: 0,
                bestStreak: 0
              };
            }
            aggregated[playerName].totalScore += score.score || 0;
            aggregated[playerName].games += 1;
            aggregated[playerName].bestScore = Math.max(aggregated[playerName].bestScore, score.score || 0);
            aggregated[playerName].bestStreak = Math.max(aggregated[playerName].bestStreak, score.streak || 0);
          });
          const allEntries = Object.values(aggregated)
            .sort((a, b) => b.totalScore - a.totalScore);
          
          if (currentPlayerName && currentPlayerName.trim()) {
            const playerIndex = allEntries.findIndex(e => e.name === currentPlayerName.trim());
            if (playerIndex !== -1) {
              setPlayerStats(allEntries[playerIndex]);
              setPlayerRank(playerIndex + 1);
            }
          }
          
          setEntries(allEntries.slice(0, 10));
        } else {
          setEntries([]);
          setPlayerStats(null);
          setPlayerRank(null);
        }
      } catch (fallbackErr) {
        console.error("Fallback load also failed:", fallbackErr);
        setEntries([]);
        setPlayerStats(null);
        setPlayerRank(null);
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
      padding: 16,
      maxHeight: "100dvh",
      overflow: "hidden"
    }}>
      <div style={{ 
        textAlign: "center", 
        fontSize: 32, 
        fontWeight: 800,
        background: `linear-gradient(135deg, ${C.nGreen} 0%, ${C.nPurple} 100%)`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        marginBottom: 8,
        flexShrink: 0
      }}>
        🏆 Leaderboard
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: C.neut, padding: 40 }}>
          Loading...
        </div>
      ) : (
        <div style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          paddingRight: 4,
          display: "flex",
          flexDirection: "column",
          gap: 16
        }}>
          {/* Current Player Stats - Show at top if player exists */}
          {playerStats && (
            <div style={{ flexShrink: 0 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.nBlue,
                marginBottom: 8,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                textAlign: "center"
              }}>
                Your Stats
              </div>
              <div
                style={{
                  background: `linear-gradient(135deg, ${C.nBlue}20 0%, ${C.nBlue}08 100%)`,
                  border: `2px solid ${C.nBlue}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  backdropFilter: "blur(20px)",
                  boxShadow: `0 0 25px ${C.nBlue}30`,
                }}
              >
                <div style={{ 
                  fontSize: 22, 
                  fontWeight: 700,
                  minWidth: 40,
                  color: C.nBlue,
                  textAlign: "center"
                }}>
                  #{playerRank}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: 17, 
                    fontWeight: 700,
                    color: "#fff",
                    marginBottom: 3
                  }}>
                    {playerStats.name}
                  </div>
                  <div style={{ 
                    fontSize: 11, 
                    color: "rgba(255,255,255,0.5)",
                    fontFamily: "monospace"
                  }}>
                    {playerStats.games} game{playerStats.games !== 1 ? "s" : ""} • Best: {playerStats.bestScore.toLocaleString()}
                  </div>
                </div>
                <div style={{ 
                  textAlign: "right",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2
                }}>
                  <div style={{ 
                    fontSize: 20, 
                    fontWeight: 700,
                    color: C.nGreen
                  }}>
                    {playerStats.totalScore.toLocaleString()}
                  </div>
                  <div style={{ 
                    fontSize: 10, 
                    color: "rgba(255,255,255,0.4)",
                    fontFamily: "monospace"
                  }}>
                    🔥 {playerStats.bestStreak}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top 10 Section */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.nGreen,
              marginBottom: 8,
              marginTop: playerStats ? 4 : 0,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              textAlign: "center"
            }}>
              Top 10
            </div>

            {entries.length === 0 ? (
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
          </div>
        </div>
      )}

      <GlassButton 
        onClick={onBack} 
        color={C.nPurple} 
        style={{ marginTop: 8, flexShrink: 0 }}
      >
        Back
      </GlassButton>
    </div>
  );
};


export default function App() {
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

  const [showAnnotation, setShowAnnotation] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState(null);

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

  useEffect(() => {
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      document.head.appendChild(viewportMeta);
    }
    viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    
    const preventZoom = (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };
    
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

  useEffect(() => {
    const loadPlayerName = async () => {
      try {
        const savedName = localStorage.getItem("reflexGlassPlayerName");
        if (savedName) {
          setPlayerName(savedName);
          setTempName(savedName);
          setIsEditingName(false);
          return;
        }
        
        let detectedName = null;
        
        try {
          if (typeof window !== 'undefined' && window.farcaster) {
            if (window.farcaster.user && window.farcaster.user.username) {
              detectedName = window.farcaster.user.username;
            } else if (window.farcaster.user && window.farcaster.user.displayName) {
              detectedName = window.farcaster.user.displayName;
            }
          }
        } catch (farcasterError) {
          console.log("Could not detect Farcaster name:", farcasterError);
        }
        
        if (!detectedName && typeof window !== 'undefined' && window.ethereum) {
          try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' }).catch(() => null);
            if (accounts && accounts.length > 0) {
              const address = accounts[0];
              
              if (window.baseName && typeof window.baseName === 'string') {
                detectedName = window.baseName;
              } else if (address && typeof address === 'string') {
                detectedName = `${address.slice(0, 6)}...${address.slice(-4)}`;
              }
            }
          } catch (baseError) {
            console.log("Could not detect Base name:", baseError);
          }
        }
        
        try {
          if (typeof window !== 'undefined' && window.location) {
            const urlParams = new URLSearchParams(window.location.search);
            const urlUsername = urlParams.get('username') || urlParams.get('name');
            if (!detectedName && urlUsername && urlUsername.trim()) {
              detectedName = urlUsername.trim();
            }
          }
        } catch (urlError) {
          console.log("Could not check URL parameters:", urlError);
        }
        
        if (detectedName && detectedName.trim()) {
          const trimmedName = detectedName.trim();
          setTempName(trimmedName);
          setPlayerName(trimmedName);
          setIsEditingName(false);
          localStorage.setItem("reflexGlassPlayerName", trimmedName);
          console.log(`Auto-detected username: ${trimmedName}`);
        } else {
          setIsEditingName(true);
        }
      } catch (err) {
        console.log("Error loading player name:", err);
        setIsEditingName(true);
      }
    };
    
    loadPlayerName();
  }, []);

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
      setWindowStart(0); 
      buildAnimationProgress.current = 0;
      lastCandleCount.current = 0; 

      const duration = 4200; 
      const startTime = Date.now();

      const animateScroll = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        
        const eased = progress;
        
        buildAnimationProgress.current = Math.min(1, eased);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animateScroll);
        } else {
          buildAnimationProgress.current = 1;
          setWindowStart(newStructure.decisionIndex);
          setScreen("playing");
          
          const timerStart = Date.now();
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            const timerElapsed = Date.now() - timerStart;
            const remaining = Math.max(0, DECISION_MS - timerElapsed);
            setTimeLeft(remaining);

            if (remaining === 0) {
              clearInterval(timerRef.current);
              timerRef.current = null;
              
              const userChoice = Math.random() < 0.5 ? "BUY" : "SELL";
              
              haptic([30, 20, 30]);
              sound.click();

              setChoice(userChoice);
              setScreen("revealing");

              let progress = 0;
              const animate = () => {
                progress += 0.03;
                setRevealProgress(progress);

                if (progress < 1) {
                  animFrameRef.current = requestAnimationFrame(animate);
                } else {
                  setScreen("outcome");
                  
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
    [] 
  );

  const startGame = useCallback(() => {
    sound.unlock();
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (renderRafId.current) cancelAnimationFrame(renderRafId.current);
    
    if (rendererRef.current) {
      rendererRef.current = null;
    }
    
    setScreen("game"); 
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
    
    if (chartRef.current && !rendererRef.current) {
      rendererRef.current = new ChartRenderer(chartRef.current, DIFFICULTY_CONFIG);
      const rect = chartRef.current.getBoundingClientRect();
      rendererRef.current.setDimensions(rect.width, rect.height);
    }
    
    initializeRound(0);
  }, [initializeRound]);

  const handleChoice = useCallback(
    (userChoice) => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (screen === "building") {
        buildAnimationProgress.current = 1;
        setWindowStart(structure.decisionIndex);
      }
      
      haptic([30, 20, 30]);
      sound.click();

      setChoice(userChoice);
      setScreen("revealing");

      let progress = 0;
      const animate = () => {
        progress += 0.03; 
        setRevealProgress(progress);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          const correct = userChoice === structure.signal;
          const newStreak = correct ? streak + 1 : 0;
          const multiplier = STREAK_MULT[Math.min(newStreak, STREAK_MULT.length - 1)];
          const points = correct ? Math.round(BASE_SCORE * multiplier) : 0;

          setStreak(newStreak);
          setBestStreak(Math.max(bestStreak, newStreak));
          setScores([...scores, points]);
          setRoundStats([...roundStats, { correct, choice: userChoice }]);

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

  const advanceRound = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setSwipeOffset(0); 
    setShowAnnotation(false); 
    setCurrentAnnotation(null);
    if (round + 1 >= ROUNDS) {
      setScreen("verdict");
    } else {
      initializeRound(round + 1);
    }
  }, [round, initializeRound]);

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
        targetFps = isMobile ? 24 : 40;        
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
          const targetIndex = buildAnimationProgress.current * structure.decisionIndex;
          const displayedIndex = Math.floor(targetIndex);
          const partialProgress = targetIndex - displayedIndex;   

          if (displayedIndex > lastCandleCount.current) {
            sound.buildTick(displayedIndex / structure.decisionIndex);
            lastCandleCount.current = displayedIndex;
          }

          currentCandles = structure.candles.slice(0, displayedIndex);

          if (displayedIndex < structure.candles.length) {
            const nextCandle = structure.candles[displayedIndex];

            const partialCandle = {
              ...nextCandle,                    
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
          const continuationLength = structure.continuation?.candles?.length || 0;
          const totalExpectedCandles = screen === "revealing" || screen === "outcome"
            ? (structure.decisionIndex + 1) + continuationLength
            : currentCandles.length;
          
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

  const computeStats = useCallback(() => {
    const totalScore = scores.reduce((a, b) => a + b, 0);
    const correct = roundStats.filter((r) => r.correct).length;
    const total = roundStats.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    return { totalScore, correct, total, accuracy, bestStreak };
  }, [scores, roundStats, bestStreak]);

  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    
    const previousName = localStorage.getItem("reflexGlassPlayerName");
    
    if (tempName.trim().toLowerCase() !== (previousName || "").toLowerCase()) {
      try {
        let scores = [];
        
        if (db) {
          const scoresQuery = query(
            collection(db, "scores"),
            orderBy("timestamp", "desc")
          );
          const querySnapshot = await getDocs(scoresQuery);
          scores = querySnapshot.docs.map(doc => doc.data());
        } else {
          scores = JSON.parse(localStorage.getItem("reflexGlassScores") || "[]");
        }
        
        const normalizedNewName = tempName.trim().toLowerCase();
        const existingNames = scores
          .filter(s => s.name && s.name.trim())
          .map(s => s.name.trim().toLowerCase());
        
        if (existingNames.includes(normalizedNewName)) {
          alert("Taken, choose another name");
          return;
        }
      } catch (err) {
        console.error("Error checking username:", err);
      }
    }
    
    if (previousName && previousName !== tempName.trim()) {
      try {
        const existingScores = JSON.parse(localStorage.getItem("reflexGlassScores") || "[]");
        
        const filteredScores = existingScores.filter(score => score.name !== previousName);
        
        localStorage.setItem("reflexGlassScores", JSON.stringify(filteredScores));
        
        console.log(`Deleted all scores for previous name: ${previousName}`);
        console.log(`Removed ${existingScores.length - filteredScores.length} score(s)`);
        
      } catch (error) {
        console.error("Error clearing previous scores:", error);
      }
    } else if (previousName && previousName === tempName.trim()) {
      setIsEditingName(false);
      return;
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

      <GlassPanel style={{ padding: "20px 16px", maxWidth: 380, width: "90%" }}>
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
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (isEditingName) {
                  handleSaveName();
                } else {
                  handleStartGame();
                }
              }
            }}
            maxLength={20}
            readOnly={!isEditingName}
            inputMode="text"
            autoComplete="username"
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
              boxSizing: "border-box",
              WebkitAppearance: "none",
              touchAction: "manipulation"
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
                  transition: "all 0.2s",
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation"
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
                    transition: "all 0.2s",
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "manipulation"
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            playerName && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setTempName(playerName);
                  setIsEditingName(true);
                  setTimeout(() => {
                    const input = document.querySelector('input[type="text"]');
                    if (input) input.focus();
                  }, 100);
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
                  transition: "all 0.2s",
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation"
                }}
              >
                ✎
              </button>
            )
          )}
        </div>
        {isEditingName && playerName && (
          <div style={{
            fontSize: 10,
            color: "rgba(255, 180, 100, 0.8)",
            textAlign: "center",
            marginTop: 12,
            lineHeight: 1.4,
            padding: "8px 12px",
            background: "rgba(255, 180, 100, 0.1)",
            borderRadius: 8,
            border: "1px solid rgba(255, 180, 100, 0.2)"
          }}>
            ⚠️ Changing your name will delete all your previous statistics
          </div>
        )}
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
              
              if (timeDelta > 0) {
                velocity.current = (lastTouchX.current - currentX) / timeDelta;
                verticalVelocity.current = (lastTouchY.current - currentY) / timeDelta;
              }
              
              lastTouchX.current = currentX;
              lastTouchY.current = currentY;
              lastTouchTime.current = currentTime;
              
              const newHorizontalOffset = touchStartOffset.current + deltaX;
              const newVerticalOffset = touchStartVerticalOffset.current + deltaY;
              
              const canvasWidth = chartRef.current ? chartRef.current.getBoundingClientRect().width : 400;
              const canvasHeight = chartRef.current ? chartRef.current.getBoundingClientRect().height : 300;
              
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
              
              if (swipeRafId.current) cancelAnimationFrame(swipeRafId.current);
              swipeRafId.current = requestAnimationFrame(() => {
                setSwipeOffset(limitedHorizontalOffset);
                setVerticalOffset(limitedVerticalOffset);
              });
            }
          }}
          onTouchEnd={() => {
            if (touchStartX.current !== null && structure && structure.candles && structure.candles.length > 0) {
              const canvasWidth = chartRef.current ? chartRef.current.getBoundingClientRect().width : 400;
              const canvasHeight = chartRef.current ? chartRef.current.getBoundingClientRect().height : 300;
              
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
              
              const horizontalMomentum = velocity.current * 100;
              let finalHorizontalOffset = swipeOffset + horizontalMomentum;
              
              const maxHorizontalOffset = scrollableCandles * slotWidth;
              const minHorizontalOffset = 0;
              finalHorizontalOffset = Math.max(minHorizontalOffset, Math.min(maxHorizontalOffset, finalHorizontalOffset));
              
              const verticalMomentum = verticalVelocity.current * 100;
              let finalVerticalOffset = verticalOffset + verticalMomentum;
              
              const maxVerticalOffset = 0;
              const minVerticalOffset = 0;
              finalVerticalOffset = 0; // Always snap back to center vertically
              
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
                  top: 10,
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
      <div style={{ paddingTop: 12, paddingBottom: 6, flexShrink: 0, padding: isMobile ? "12px 10px 6px 10px" : "12px 0 6px 0", minHeight: 64 }}>
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

  useEffect(() => {
    return () => {
      if (swipeRafId.current) cancelAnimationFrame(swipeRafId.current);
      if (renderRafId.current) cancelAnimationFrame(renderRafId.current);
    };
  }, []);

    return (
      <div
        style={{
          width: "100vw",
          height: "100dvh",
          margin: 0,
          padding: 0,
          overflow: "hidden",
          background: `radial-gradient(ellipse at 30% 20%, #0f1a2e 0%, ${C.bg1} 55%, ${C.bg2} 100%)`,
          position: "fixed",          // fixed jobb, mint relative – teljes képernyőt fed
          inset: 0,
          boxSizing: "border-box",
        }}
      >
        {/* Ambient orbs – maradhatnak, de most fixed inset-0 kell legyen */}
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

        {/* Main content – teljes képernyős, nincs center, nincs padding */}
        <div 
          style={{ 
            position: "relative", 
            zIndex: 1, 
            width: "100vw",
            height: "100dvh",
            margin: 0,
            padding: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {screen === "home" && renderHome()}
          {(screen === "building" || screen === "playing" || screen === "revealing" || screen === "outcome") &&
            renderPlaying()}
          {screen === "verdict" && renderVerdict()}
          {screen === "leaderboard" && (
            <div style={{ 
              width: "100vw",
              height: "100dvh",
              margin: 0,
              padding: "16px",                  // csak minimális belső padding, ha kell
              overflowY: "auto",
              overflowX: "hidden",
              boxSizing: "border-box",
            }}>
              <Leaderboard onBack={() => setScreen("verdict")} currentPlayerName={playerName} />
            </div>
          )}
        </div>

        {/* Animations – marad */}
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
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100dvh;
            overflow: hidden;
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