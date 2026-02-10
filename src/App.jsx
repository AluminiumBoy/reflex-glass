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
    return this.on;
  }

  isOn() {
    return this.on;
  }
}

const audioEngine = new SoundEngine();

function getRandom(min, max) {
  return Math.random() * (max - min) + min;
}

function noise() {
  return (Math.random() - 0.5) * 0.4;
}

function simplexNoise(x) {
  const s = Math.sin(x * 0.7) * Math.cos(x * 1.3);
  return s + Math.sin(x * 2.1) * 0.3 + Math.cos(x * 0.5) * 0.2;
}

function makeMarketStructure() {
  const cfg = DIFFICULTY_CONFIG;
  const total = cfg.contextSize;
  const winSize = cfg.windowSize;
  const PATTERNS = [
    { name: "triangle", signal: "neut" },
    { name: "wedge", signal: "neut" },
    { name: "channel", signal: "neut" },
    { name: "headShoulders", signal: "bear" },
    { name: "invHeadShoulders", signal: "bull" },
    { name: "doubleTop", signal: "bear" },
    { name: "doubleBottom", signal: "bull" },
    { name: "flag", signal: "bull" },
    { name: "pennant", signal: "neut" },
    { name: "cup", signal: "bull" },
  ];

  const contPat = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];

  const prices = [];
  let open = 100;
  let trend = 0;
  for (let i = 0; i < total; i++) {
    if (i % 10 === 0) trend = getRandom(-0.5, 0.5);
    const n = simplexNoise(i / 4) * 2 + noise();
    open += trend + n;
    prices.push(open);
  }

  const min = Math.min(...prices);
  prices.forEach((_, i) => (prices[i] -= min - 5));

  const baseVal = prices[prices.length - 1];
  const offset = winSize;
  let winPrices = [];

  const sig = contPat.signal;
  if (contPat.name === "triangle") {
    const dir = Math.random() < 0.5 ? 1 : -1;
    winPrices = drawTriangle(offset, baseVal, dir);
  } else if (contPat.name === "wedge") {
    const dir = Math.random() < 0.5 ? 1 : -1;
    winPrices = drawWedge(offset, baseVal, dir);
  } else if (contPat.name === "channel") {
    const dir = Math.random() < 0.5 ? 1 : -1;
    winPrices = drawChannel(offset, baseVal, dir);
  } else if (contPat.name === "headShoulders") {
    winPrices = drawHeadShoulders(offset, baseVal);
  } else if (contPat.name === "invHeadShoulders") {
    winPrices = drawInvHeadShoulders(offset, baseVal);
  } else if (contPat.name === "doubleTop") {
    winPrices = drawDoubleTop(offset, baseVal);
  } else if (contPat.name === "doubleBottom") {
    winPrices = drawDoubleBottom(offset, baseVal);
  } else if (contPat.name === "flag") {
    winPrices = drawFlag(offset, baseVal);
  } else if (contPat.name === "pennant") {
    winPrices = drawPennant(offset, baseVal);
  } else if (contPat.name === "cup") {
    winPrices = drawCup(offset, baseVal);
  }

  const fullPrices = [...prices, ...winPrices];
  const cleanCount = Math.max(1, Math.floor(cfg.cleanRatio * total));
  const cleanDist = total > 1 ? total / (cleanCount + 1) : 0;
  const rawCleanIndices = [];
  for (let c = 1; c <= cleanCount; c++) {
    const idx = Math.floor(c * cleanDist);
    if (idx < total) rawCleanIndices.push(idx);
  }

  const fillerPats = ["spike", "dip", "mini-channel", "mini-wedge", "noise"];
  const contextPatterns = [];
  for (let i = 0; i < total; i++) {
    if (rawCleanIndices.includes(i)) {
      contextPatterns.push({ type: "clean", index: i });
    } else if (Math.random() < 0.6) {
      const fp = fillerPats[Math.floor(Math.random() * fillerPats.length)];
      contextPatterns.push({ type: fp, index: i });
    }
  }

  const cleanIndices = rawCleanIndices.slice();

  return {
    context: prices,
    continuation: { pattern: contPat.name, signal: sig },
    window: winPrices,
    full: fullPrices,
    cleanIndices,
    contextPatterns,
    signal: sig,
  };
}

function drawTriangle(len, base, dir) {
  const res = [];
  const slope = dir * (3 / len);
  let val = base;
  for (let i = 0; i < len; i++) {
    res.push(val + noise());
    val += slope;
  }
  return res;
}

function drawWedge(len, base, dir) {
  const res = [];
  const slope = dir * (4 / len);
  let val = base;
  for (let i = 0; i < len; i++) {
    res.push(val + noise() * 0.5);
    val += slope;
  }
  return res;
}

function drawChannel(len, base, dir) {
  const res = [];
  const slope = dir * (2 / len);
  let val = base;
  for (let i = 0; i < len; i++) {
    const wave = Math.sin((i / len) * Math.PI * 4) * 1.5;
    res.push(val + wave + noise() * 0.6);
    val += slope;
  }
  return res;
}

function drawHeadShoulders(len, base) {
  const res = [];
  const q = Math.floor(len / 4);
  let val = base;
  for (let i = 0; i < q; i++) {
    res.push(val + i * 0.3 + noise());
  }
  val = res[res.length - 1];
  for (let i = 0; i < q; i++) {
    res.push(val - i * 0.2 + noise());
  }
  val = res[res.length - 1];
  for (let i = 0; i < q; i++) {
    res.push(val + i * 0.5 + noise());
  }
  val = res[res.length - 1];
  for (let i = 0; i < q; i++) {
    res.push(val - i * 0.3 + noise());
  }
  return res;
}

function drawInvHeadShoulders(len, base) {
  const res = [];
  const q = Math.floor(len / 4);
  let val = base;
  for (let i = 0; i < q; i++) {
    res.push(val - i * 0.3 + noise());
  }
  val = res[res.length - 1];
  for (let i = 0; i < q; i++) {
    res.push(val + i * 0.2 + noise());
  }
  val = res[res.length - 1];
  for (let i = 0; i < q; i++) {
    res.push(val - i * 0.5 + noise());
  }
  val = res[res.length - 1];
  for (let i = 0; i < q; i++) {
    res.push(val + i * 0.3 + noise());
  }
  return res;
}

function drawDoubleTop(len, base) {
  const res = [];
  const half = Math.floor(len / 2);
  let val = base;
  for (let i = 0; i < half; i++) {
    const t = i / (half - 1);
    const wave = Math.sin(t * Math.PI) * 4;
    res.push(val + wave + noise());
  }
  val = res[res.length - 1];
  for (let i = 0; i < half; i++) {
    const t = i / (half - 1);
    const wave = Math.sin(t * Math.PI) * 4;
    res.push(val + wave + noise());
  }
  return res;
}

function drawDoubleBottom(len, base) {
  const res = [];
  const half = Math.floor(len / 2);
  let val = base;
  for (let i = 0; i < half; i++) {
    const t = i / (half - 1);
    const wave = -Math.sin(t * Math.PI) * 4;
    res.push(val + wave + noise());
  }
  val = res[res.length - 1];
  for (let i = 0; i < half; i++) {
    const t = i / (half - 1);
    const wave = -Math.sin(t * Math.PI) * 4;
    res.push(val + wave + noise());
  }
  return res;
}

function drawFlag(len, base) {
  const res = [];
  const mid = Math.floor(len / 2);
  let val = base;
  for (let i = 0; i < mid; i++) {
    res.push(val + i * 0.4 + noise());
  }
  val = res[res.length - 1];
  for (let i = 0; i < mid; i++) {
    res.push(val - i * 0.15 + noise() * 0.5);
  }
  return res;
}

function drawPennant(len, base) {
  const res = [];
  let val = base;
  for (let i = 0; i < len; i++) {
    const env = 1 - i / len;
    const wave = Math.sin((i / len) * Math.PI * 6) * 2 * env;
    res.push(val + wave + noise() * 0.6);
  }
  return res;
}

function drawCup(len, base) {
  const res = [];
  let val = base;
  for (let i = 0; i < len; i++) {
    const t = i / (len - 1);
    const curve = -Math.pow(2 * t - 1, 2) * 5 + 1;
    res.push(val + curve + noise());
  }
  return res;
}

function HomeScreen({ onStart, onLeaderboard, isMobile }) {
  const [playerName, setPlayerName] = useState("");

  return (
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
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(90%, 420px)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <h1
              style={{
                margin: 0,
                fontSize: isMobile ? 42 : 56,
                fontWeight: 800,
                textAlign: "center",
                background: `linear-gradient(135deg, ${C.nGreen}, ${C.nPurple})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: "-0.03em",
                textShadow: `0 0 40px ${C.nGreen}40`,
              }}
            >
              REFLEX GLASS
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: isMobile ? 13 : 15,
                fontWeight: 500,
                color: "rgba(255,255,255,0.55)",
                textAlign: "center",
                letterSpacing: "0.05em",
              }}
            >
              Context-Aware Pattern Recognition
            </p>
          </div>

          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && playerName.trim()) {
                  haptic([30]);
                  audioEngine.click();
                  onStart(playerName.trim());
                }
              }}
              style={{
                width: "100%",
                padding: "14px 18px",
                fontSize: 16,
                fontWeight: 500,
                border: `1px solid ${C.glassBr}`,
                borderRadius: 14,
                background: C.glass,
                backdropFilter: "blur(20px)",
                color: "#fff",
                outline: "none",
                boxSizing: "border-box",
                transition: "all 0.2s ease",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = C.nGreen;
                e.target.style.boxShadow = `0 0 0 3px ${C.nGreen}20`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = C.glassBr;
                e.target.style.boxShadow = "none";
              }}
            />

            <button
              onClick={() => {
                if (!playerName.trim()) return;
                haptic([30]);
                audioEngine.click();
                onStart(playerName.trim());
              }}
              disabled={!playerName.trim()}
              style={{
                width: "100%",
                padding: "16px 24px",
                fontSize: 17,
                fontWeight: 700,
                border: "none",
                borderRadius: 14,
                background: playerName.trim()
                  ? `linear-gradient(135deg, ${C.nGreen}, ${C.nPurple})`
                  : C.glass,
                color: playerName.trim() ? "#000" : "rgba(255,255,255,0.3)",
                cursor: playerName.trim() ? "pointer" : "not-allowed",
                transition: "all 0.2s ease",
                boxShadow: playerName.trim() ? `0 8px 32px ${C.nGreen}40` : "none",
                opacity: playerName.trim() ? 1 : 0.5,
              }}
              onMouseEnter={(e) => {
                if (playerName.trim()) {
                  e.target.style.transform = "scale(1.02)";
                  e.target.style.boxShadow = `0 12px 40px ${C.nGreen}60`;
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "scale(1)";
                e.target.style.boxShadow = playerName.trim() ? `0 8px 32px ${C.nGreen}40` : "none";
              }}
            >
              START TRAINING
            </button>

            <button
              onClick={() => {
                haptic([25]);
                audioEngine.click();
                onLeaderboard();
              }}
              style={{
                width: "100%",
                padding: "14px 20px",
                fontSize: 15,
                fontWeight: 600,
                border: `1px solid ${C.glassBr}`,
                borderRadius: 14,
                background: C.glass,
                backdropFilter: "blur(20px)",
                color: "rgba(255,255,255,0.75)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = C.nPurple;
                e.target.style.boxShadow = `0 0 0 3px ${C.nPurple}20`;
                e.target.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = C.glassBr;
                e.target.style.boxShadow = "none";
                e.target.style.color = "rgba(255,255,255,0.75)";
              }}
            >
              VIEW LEADERBOARD
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DecisionButtons({ onChoose, disabled }) {
  const [activeBtn, setActiveBtn] = useState(null);

  const handleClick = (dir) => {
    if (disabled) return;
    haptic([30]);
    audioEngine.click();
    setActiveBtn(dir);
    setTimeout(() => setActiveBtn(null), 200);
    onChoose(dir);
  };

  const btnStyle = (dir) => ({
    flex: 1,
    padding: "16px 20px",
    fontSize: 16,
    fontWeight: 700,
    border: `2px solid ${
      dir === "bull" ? C.bull : dir === "bear" ? C.bear : C.neut
    }`,
    borderRadius: 14,
    background:
      activeBtn === dir
        ? dir === "bull"
          ? C.bull
          : dir === "bear"
          ? C.bear
          : C.neut
        : C.glass,
    backdropFilter: "blur(20px)",
    color: activeBtn === dir ? "#000" : "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.15s ease",
    opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? "none" : "auto",
    boxShadow:
      activeBtn === dir
        ? `0 0 30px ${
            dir === "bull" ? C.bull : dir === "bear" ? C.bear : C.neut
          }80`
        : "none",
    animation: activeBtn === dir ? "buttonActivate 0.2s ease" : "none",
  });

  return (
    <div style={{ display: "flex", gap: 10, width: "100%" }}>
      <button onClick={() => handleClick("bull")} style={btnStyle("bull")}>
        BULL
      </button>
      <button onClick={() => handleClick("neut")} style={btnStyle("neut")}>
        NEUTRAL
      </button>
      <button onClick={() => handleClick("bear")} style={btnStyle("bear")}>
        BEAR
      </button>
    </div>
  );
}

function OutcomeCard({ correct, points, streak, patternName, choice, signal, onNext, context, showAnnotation, onToggleAnnotation, currentAnnotation }) {
  const bgCol = correct ? C.bull : C.bear;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "18px 20px",
        borderRadius: 16,
        background: C.glass,
        backdropFilter: "blur(20px)",
        border: `2px solid ${bgCol}`,
        boxShadow: `0 8px 32px ${bgCol}60`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: bgCol,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            {correct ? "✓" : "✗"}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
              {correct ? "Correct!" : "Wrong"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              {patternName || "N/A"}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              background: `linear-gradient(135deg, ${C.nGreen}, ${C.nPurple})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            +{points}
          </div>
          {streak > 1 && (
            <div style={{ fontSize: 11, color: C.nAmber, fontWeight: 600 }}>
              {streak}x streak
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "rgba(255,255,255,0.6)",
        }}
      >
        <span>You chose:</span>
        <span
          style={{
            fontWeight: 700,
            color:
              choice === "bull" ? C.bull : choice === "bear" ? C.bear : C.neut,
          }}
        >
          {choice.toUpperCase()}
        </span>
        <span>•</span>
        <span>Answer:</span>
        <span
          style={{
            fontWeight: 700,
            color:
              signal === "bull" ? C.bull : signal === "bear" ? C.bear : C.neut,
          }}
        >
          {signal.toUpperCase()}
        </span>
      </div>

      <button
        onClick={() => {
          haptic([25]);
          audioEngine.click();
          onToggleAnnotation();
        }}
        style={{
          padding: "10px 16px",
          fontSize: 13,
          fontWeight: 600,
          border: `1px solid ${C.glassBr}`,
          borderRadius: 10,
          background: showAnnotation ? C.glassHi : C.glass,
          backdropFilter: "blur(20px)",
          color: "rgba(255,255,255,0.8)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        {showAnnotation ? "Hide" : "Show"} Pattern Details
      </button>

      {showAnnotation && currentAnnotation && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(0,0,0,0.3)",
            fontSize: 12,
            color: "rgba(255,255,255,0.7)",
            lineHeight: "1.5",
          }}
        >
          {currentAnnotation}
        </div>
      )}

      <button
        onClick={() => {
          haptic([30]);
          audioEngine.click();
          onNext();
        }}
        style={{
          width: "100%",
          padding: "14px 20px",
          fontSize: 16,
          fontWeight: 700,
          border: "none",
          borderRadius: 12,
          background: `linear-gradient(135deg, ${C.nGreen}, ${C.nPurple})`,
          color: "#000",
          cursor: "pointer",
          transition: "all 0.2s ease",
          boxShadow: `0 6px 24px ${C.nGreen}40`,
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = "scale(1.02)";
          e.target.style.boxShadow = `0 8px 32px ${C.nGreen}60`;
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = "scale(1)";
          e.target.style.boxShadow = `0 6px 24px ${C.nGreen}40`;
        }}
      >
        NEXT ROUND
      </button>
    </div>
  );
}

function FinalVerdict({ stats, onRestart, onLeaderboard, playerName }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const saveScore = async () => {
    if (!db || !playerName || saved || saving) return;

    setSaving(true);
    setError(null);

    try {
      await addDoc(collection(db, "leaderboard"), {
        playerName,
        score: stats.total,
        accuracy: stats.accuracy,
        timestamp: new Date().toISOString(),
      });
      setSaved(true);
      setTimeout(() => {
        onLeaderboard();
      }, 1000);
    } catch (err) {
      console.error("Error saving score:", err);
      setError("Failed to save score");
      setSaving(false);
    }
  };

  useEffect(() => {
    saveScore();
  }, []);

  const grade =
    stats.accuracy >= 80
      ? "MASTER"
      : stats.accuracy >= 60
      ? "EXPERT"
      : stats.accuracy >= 40
      ? "INTERMEDIATE"
      : "BEGINNER";

  const gradeCol =
    grade === "MASTER"
      ? C.nGreen
      : grade === "EXPERT"
      ? C.nBlue
      : grade === "INTERMEDIATE"
      ? C.nAmber
      : C.nPink;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 22,
        padding: "24px 22px",
        borderRadius: 20,
        background: C.glass,
        backdropFilter: "blur(20px)",
        border: `2px solid ${C.glassBr}`,
        boxShadow: `0 12px 48px rgba(0,0,0,0.4)`,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h2
          style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 800,
            background: `linear-gradient(135deg, ${gradeCol}, ${C.nPurple})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 8,
          }}
        >
          {grade}
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
          Training Complete
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: "18px 20px",
          borderRadius: 14,
          background: "rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, color: "rgba(255,255,255,0.6)" }}>Total Score</span>
          <span
            style={{
              fontSize: 28,
              fontWeight: 800,
              background: `linear-gradient(135deg, ${C.nGreen}, ${C.nPurple})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {stats.total}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, color: "rgba(255,255,255,0.6)" }}>Accuracy</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: gradeCol }}>
            {stats.accuracy}%
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, color: "rgba(255,255,255,0.6)" }}>Best Streak</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: C.nAmber }}>
            {stats.maxStreak}x
          </span>
        </div>
      </div>

      {saving && (
        <div style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
          Saving to leaderboard...
        </div>
      )}

      {saved && (
        <div style={{ textAlign: "center", fontSize: 13, color: C.nGreen, fontWeight: 600 }}>
          ✓ Score saved!
        </div>
      )}

      {error && (
        <div style={{ textAlign: "center", fontSize: 13, color: C.bear }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={() => {
            haptic([30]);
            audioEngine.click();
            onLeaderboard();
          }}
          style={{
            width: "100%",
            padding: "14px 20px",
            fontSize: 16,
            fontWeight: 700,
            border: "none",
            borderRadius: 12,
            background: `linear-gradient(135deg, ${C.nGreen}, ${C.nPurple})`,
            color: "#000",
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxShadow: `0 6px 24px ${C.nGreen}40`,
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = "scale(1.02)";
            e.target.style.boxShadow = `0 8px 32px ${C.nGreen}60`;
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "scale(1)";
            e.target.style.boxShadow = `0 6px 24px ${C.nGreen}40`;
          }}
        >
          VIEW LEADERBOARD
        </button>

        <button
          onClick={() => {
            haptic([30]);
            audioEngine.click();
            onRestart();
          }}
          style={{
            width: "100%",
            padding: "14px 20px",
            fontSize: 15,
            fontWeight: 600,
            border: `1px solid ${C.glassBr}`,
            borderRadius: 12,
            background: C.glass,
            backdropFilter: "blur(20px)",
            color: "rgba(255,255,255,0.75)",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = C.nPurple;
            e.target.style.boxShadow = `0 0 0 3px ${C.nPurple}20`;
            e.target.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = C.glassBr;
            e.target.style.boxShadow = "none";
            e.target.style.color = "rgba(255,255,255,0.75)";
          }}
        >
          TRAIN AGAIN
        </button>
      </div>
    </div>
  );
}

function Leaderboard({ onBack, currentPlayerName }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScores = async () => {
      if (!db) {
        setLoading(false);
        return;
      }

      try {
        const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(10));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setScores(data);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchScores();
  }, []);

  return (
    <div
      style={{
        maxWidth: 500,
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          padding: "24px 22px",
          borderRadius: 20,
          background: C.glass,
          backdropFilter: "blur(20px)",
          border: `2px solid ${C.glassBr}`,
          boxShadow: `0 12px 48px rgba(0,0,0,0.4)`,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h2
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              background: `linear-gradient(135deg, ${C.nGreen}, ${C.nPurple})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: 6,
            }}
          >
            LEADERBOARD
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
            Top 10 Traders
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.5)" }}>
            Loading...
          </div>
        ) : scores.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.5)" }}>
            No scores yet. Be the first!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {scores.map((entry, idx) => {
              const isCurrentPlayer = entry.playerName === currentPlayerName;
              const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;

              return (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: isCurrentPlayer ? "rgba(0,255,170,0.1)" : "rgba(0,0,0,0.3)",
                    border: isCurrentPlayer ? `1px solid ${C.nGreen}` : "1px solid transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.4)",
                        minWidth: 28,
                      }}
                    >
                      {medal || `#${idx + 1}`}
                    </span>
                    <div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: isCurrentPlayer ? C.nGreen : "#fff",
                        }}
                      >
                        {entry.playerName}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                        {entry.accuracy}% accuracy
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      background: `linear-gradient(135deg, ${C.nGreen}, ${C.nPurple})`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {entry.score}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => {
            haptic([30]);
            audioEngine.click();
            onBack();
          }}
          style={{
            width: "100%",
            padding: "14px 20px",
            fontSize: 15,
            fontWeight: 600,
            border: `1px solid ${C.glassBr}`,
            borderRadius: 12,
            background: C.glass,
            backdropFilter: "blur(20px)",
            color: "rgba(255,255,255,0.75)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            marginTop: 10,
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = C.nPurple;
            e.target.style.boxShadow = `0 0 0 3px ${C.nPurple}20`;
            e.target.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = C.glassBr;
            e.target.style.boxShadow = "none";
            e.target.style.color = "rgba(255,255,255,0.75)";
          }}
        >
          BACK
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("home");
  const [structure, setStructure] = useState(null);
  const [round, setRound] = useState(0);
  const [choice, setChoice] = useState(null);
  const [scores, setScores] = useState([]);
  const [roundStats, setRoundStats] = useState([]);
  const [streak, setStreak] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [playerName, setPlayerName] = useState("");
  const [showAnnotation, setShowAnnotation] = useState(false);

  const canvasRef = useRef(null);
  const swipeOffsetX = useRef(0);
  const swipeOffsetY = useRef(0);
  const velocity = useRef(0);
  const verticalVelocity = useRef(0);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const lastTouchX = useRef(null);
  const lastTouchY = useRef(null);
  const lastTouchTime = useRef(null);
  const swipeRafId = useRef(null);
  const renderRafId = useRef(null);

  const [buildProgress, setBuildProgress] = useState(0);
  const buildIntervalRef = useRef(null);

  const [isMobile, setIsMobile] = useState(false);
  const isFirstRoundRef = useRef(true);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const currentAnnotation = useMemo(() => {
    if (!structure) return "";
    const pname = structure.continuation.pattern;
    const sig = structure.signal;

    const annotations = {
      triangle: `Triangle pattern forming with converging trendlines. ${sig === "bull" ? "Bullish" : sig === "bear" ? "Bearish" : "Neutral"} breakout expected.`,
      wedge: `Wedge pattern showing ${sig === "bull" ? "rising" : sig === "bear" ? "falling" : "consolidating"} price action within converging lines.`,
      channel: `Price moving in a ${sig === "bull" ? "ascending" : sig === "bear" ? "descending" : "horizontal"} channel with parallel support and resistance.`,
      headShoulders: `Classic Head & Shoulders pattern - bearish reversal signal with three peaks, middle one highest.`,
      invHeadShoulders: `Inverse Head & Shoulders - bullish reversal with three troughs, middle one lowest.`,
      doubleTop: `Double Top pattern at resistance - bearish reversal signal with two similar peaks.`,
      doubleBottom: `Double Bottom at support - bullish reversal with two similar troughs indicating buying pressure.`,
      flag: `Bull Flag pattern - brief consolidation after strong uptrend, typically continues higher.`,
      pennant: `Pennant pattern - symmetrical triangle following strong move, ${sig === "bull" ? "bullish" : sig === "bear" ? "bearish" : "neutral"} continuation.`,
      cup: `Cup pattern forming - bullish rounded bottom showing gradual shift from selling to buying.`,
    };

    return annotations[pname] || "";
  }, [structure]);

  const handleChoice = (dir) => {
    if (screen === "building") {
      clearInterval(buildIntervalRef.current);
      setBuildProgress(DIFFICULTY_CONFIG.windowSize);
      setScreen("playing");
      return;
    }

    if (screen !== "playing") return;
    setChoice(dir);
    setScreen("revealing");

    setTimeout(() => {
      const correct = dir === structure.signal;
      let pts = BASE_SCORE;
      let newStreak = streak;

      if (correct) {
        newStreak++;
        const mult = STREAK_MULT[Math.min(newStreak - 1, STREAK_MULT.length - 1)];
        pts = Math.round(BASE_SCORE * mult);
        audioEngine.correct();
        haptic([50, 100, 50]);
      } else {
        newStreak = 0;
        pts = 0;
        audioEngine.wrong();
        haptic([100]);
      }

      setStreak(newStreak);
      setScores([...scores, pts]);
      setRoundStats([...roundStats, { correct, points: pts }]);
      setScreen("outcome");
    }, 800);
  };

  const advanceRound = () => {
    setShowAnnotation(false);
    if (round + 1 >= ROUNDS) {
      setScreen("verdict");
    } else {
      setRound(round + 1);
      setChoice(null);
      swipeOffsetX.current = 0;
      swipeOffsetY.current = 0;
      velocity.current = 0;
      verticalVelocity.current = 0;
      setCountdown(3);
      setScreen("building");
      setBuildProgress(0);

      const newStruct = makeMarketStructure();
      setStructure(newStruct);

      let ticks = 0;
      const totalTicks = DIFFICULTY_CONFIG.windowSize;
      buildIntervalRef.current = setInterval(() => {
        ticks++;
        setBuildProgress(ticks);
        audioEngine.buildTick(ticks / totalTicks);

        if (ticks >= totalTicks) {
          clearInterval(buildIntervalRef.current);
          setScreen("playing");
        }
      }, 80);
    }
  };

  const computeStats = () => {
    const total = scores.reduce((a, b) => a + b, 0);
    const corrects = roundStats.filter((r) => r.correct).length;
    const accuracy = ROUNDS > 0 ? Math.round((corrects / ROUNDS) * 100) : 0;
    const maxStreak = Math.max(...roundStats.map((_, i) => {
      let s = 0;
      for (let j = i; j < roundStats.length; j++) {
        if (roundStats[j].correct) s++;
        else break;
      }
      return s;
    }), 0);
    return { total, accuracy, maxStreak };
  };

  const startGame = (name) => {
    setPlayerName(name);
    setRound(0);
    setScores([]);
    setRoundStats([]);
    setStreak(0);
    setChoice(null);
    setCountdown(3);
    setScreen("building");
    setBuildProgress(0);
    swipeOffsetX.current = 0;
    swipeOffsetY.current = 0;
    velocity.current = 0;
    verticalVelocity.current = 0;
    isFirstRoundRef.current = true;

    const newStruct = makeMarketStructure();
    setStructure(newStruct);

    let ticks = 0;
    const totalTicks = DIFFICULTY_CONFIG.windowSize;
    buildIntervalRef.current = setInterval(() => {
      ticks++;
      setBuildProgress(ticks);
      audioEngine.buildTick(ticks / totalTicks);

      if (ticks >= totalTicks) {
        clearInterval(buildIntervalRef.current);
        setScreen("playing");
        isFirstRoundRef.current = false;
      }
    }, 80);
  };

  useEffect(() => {
    if (screen !== "playing" || !structure) return;
    if (isFirstRoundRef.current) return;

    const timer = setTimeout(() => {
      if (countdown > 1) {
        audioEngine.tick(countdown);
        haptic([30]);
        setCountdown(countdown - 1);
      } else {
        audioEngine.tick(1);
        haptic([50, 50]);
        handleChoice("neut");
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, screen, structure]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !structure) return;

    const renderChart = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = c.getBoundingClientRect();
      c.width = rect.width * dpr;
      c.height = rect.height * dpr;

      const ctx = c.getContext("2d");
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      const pad = 20;

      ctx.clearRect(0, 0, w, h);

      const allPrices =
        screen === "outcome"
          ? structure.full
          : screen === "building"
          ? [...structure.context, ...structure.window.slice(0, buildProgress)]
          : structure.context;

      if (allPrices.length < 2) return;

      const min = Math.min(...allPrices);
      const max = Math.max(...allPrices);
      const range = max - min || 1;

      const visibleStart = Math.max(0, allPrices.length - DIFFICULTY_CONFIG.windowSize);
      const offsetX = swipeOffsetX.current;
      const offsetY = swipeOffsetY.current;

      const xStep = (w - 2 * pad) / (DIFFICULTY_CONFIG.windowSize - 1);

      const toY = (price) => h - pad - ((price - min) / range) * (h - 2 * pad) + offsetY;

      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        const y = pad + ((h - 2 * pad) / 4) * i + offsetY;
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(w - pad, y);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(56,189,248,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      let first = true;
      for (let i = visibleStart; i < allPrices.length; i++) {
        const x = pad + (i - visibleStart) * xStep + offsetX;
        const y = toY(allPrices[i]);
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      ctx.fillStyle = "rgba(56,189,248,0.7)";
      for (let i = visibleStart; i < allPrices.length; i++) {
        const x = pad + (i - visibleStart) * xStep + offsetX;
        const y = toY(allPrices[i]);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (screen === "outcome") {
        ctx.strokeStyle = "rgba(251,191,36,0.6)";
        ctx.lineWidth = 3;
        const windowStartIndex = structure.context.length;
        ctx.beginPath();
        first = true;
        for (let i = windowStartIndex; i < structure.full.length; i++) {
          const x = pad + (i - visibleStart) * xStep + offsetX;
          const y = toY(structure.full[i]);
          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        ctx.fillStyle = "rgba(251,191,36,0.9)";
        for (let i = windowStartIndex; i < structure.full.length; i++) {
          const x = pad + (i - visibleStart) * xStep + offsetX;
          const y = toY(structure.full[i]);
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      renderRafId.current = requestAnimationFrame(renderChart);
    };

    renderChart();

    return () => {
      if (renderRafId.current) cancelAnimationFrame(renderRafId.current);
    };
  }, [structure, screen, buildProgress, swipeOffsetX.current, swipeOffsetY.current]);

  useEffect(() => {
    const decay = () => {
      if (Math.abs(velocity.current) > 0.1) {
        swipeOffsetX.current += velocity.current;
        velocity.current *= 0.92;
      } else {
        velocity.current = 0;
      }

      if (Math.abs(verticalVelocity.current) > 0.1) {
        swipeOffsetY.current += verticalVelocity.current;
        verticalVelocity.current *= 0.92;
      } else {
        verticalVelocity.current = 0;
      }

      swipeRafId.current = requestAnimationFrame(decay);
    };

    decay();

    return () => {
      if (swipeRafId.current) cancelAnimationFrame(swipeRafId.current);
    };
  }, []);

  const renderHome = () => (
    <HomeScreen
      onStart={startGame}
      onLeaderboard={() => setScreen("leaderboard")}
      isMobile={isMobile}
    />
  );

  const renderPlaying = () => {
    if (!structure) return null;

    return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100vw",
        height: "100dvh",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          padding: isMobile ? "10px 10px 8px 10px" : "12px 0 10px 0",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            borderRadius: 12,
            background: C.glass,
            backdropFilter: "blur(20px)",
            border: `1px solid ${C.glassBr}`,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>
            Round {round + 1}/{ROUNDS}
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              background: `linear-gradient(135deg, ${C.nGreen}, ${C.nPurple})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {scores.reduce((a, b) => a + b, 0)}
          </div>
          {(screen === "playing" || screen === "building") && countdown <= 3 && countdown >= 1 && (
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: countdown === 1 ? C.bear : C.nAmber,
                animation: countdown === 1 ? "pulse 0.5s ease-in-out" : "none",
              }}
            >
              {countdown}
            </div>
          )}
          {streak > 0 && (
            <div style={{ fontSize: 12, fontWeight: 600, color: C.nAmber }}>
              {streak}x
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          minHeight: 0,
          margin: isMobile ? "0 10px" : "0",
          borderRadius: 16,
          background: C.glass,
          backdropFilter: "blur(20px)",
          border: `1px solid ${C.glassBr}`,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            touchAction: "none",
          }}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            touchStartX.current = touch.clientX;
            touchStartY.current = touch.clientY;
            lastTouchX.current = touch.clientX;
            lastTouchY.current = touch.clientY;
            lastTouchTime.current = Date.now();
            velocity.current = 0;
            verticalVelocity.current = 0;
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            if (touchStartX.current === null || touchStartY.current === null) return;

            const touch = e.touches[0];
            const now = Date.now();
            const dt = now - lastTouchTime.current;

            if (dt > 0) {
              const dx = touch.clientX - lastTouchX.current;
              const dy = touch.clientY - lastTouchY.current;
              velocity.current = dx / dt * 16;
              verticalVelocity.current = dy / dt * 16;
            }

            swipeOffsetX.current += touch.clientX - lastTouchX.current;
            swipeOffsetY.current += touch.clientY - lastTouchY.current;

            lastTouchX.current = touch.clientX;
            lastTouchY.current = touch.clientY;
            lastTouchTime.current = now;
          }}
          onTouchEnd={() => {
            touchStartX.current = null;
            touchStartY.current = null;
            velocity.current = 0;
            verticalVelocity.current = 0;
          }}
          onMouseDown={(e) => {
            touchStartX.current = e.clientX;
            touchStartY.current = e.clientY;
            lastTouchX.current = e.clientX;
            lastTouchY.current = e.clientY;
            lastTouchTime.current = Date.now();
            velocity.current = 0;
            verticalVelocity.current = 0;
          }}
          onMouseMove={(e) => {
            if (touchStartX.current === null || touchStartY.current === null) return;

            const now = Date.now();
            const dt = now - lastTouchTime.current;

            if (dt > 0) {
              const dx = e.clientX - lastTouchX.current;
              const dy = e.clientY - lastTouchY.current;
              velocity.current = dx / dt * 16;
              verticalVelocity.current = dy / dt * 16;
            }

            swipeOffsetX.current += e.clientX - lastTouchX.current;
            swipeOffsetY.current += e.clientY - lastTouchY.current;

            lastTouchX.current = e.clientX;
            lastTouchY.current = e.clientY;
            lastTouchTime.current = now;
          }}
          onMouseUp={() => {
            touchStartX.current = null;
            touchStartY.current = null;
            velocity.current = 0;
            verticalVelocity.current = 0;
          }}
          onMouseLeave={() => {
            
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
          position: "fixed",
          inset: 0,
          boxSizing: "border-box",
        }}
      >
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
              padding: "16px",
              overflowY: "auto",
              overflowX: "hidden",
              boxSizing: "border-box",
            }}>
              <Leaderboard onBack={() => setScreen("verdict")} currentPlayerName={playerName} />
            </div>
          )}
        </div>

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