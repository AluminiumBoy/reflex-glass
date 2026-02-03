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
  
   /* =====================
   SOUND ENGINE
   (Web Audio API — lazy-inited on first user tap)
   ===================== */
class SoundEngine {
  constructor() { 
    this.ctx = null; 
    this.on = true; 
  }

  // ── init / resume audio context ──
  _ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this.ctx;
  }

  // ── call this on user gesture to unlock audio
  unlock() {
    if (!this.on) return;
    const ctx = this._ensure();
    if (ctx.state === "suspended") ctx.resume();
  }

  // ── internal tone player ──
  _tone(freq, dur, type = "sine", vol = 0.13, startDelay = 0) {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime + startDelay;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); 
    g.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.start(now); 
    osc.stop(now + dur);
  }

  // ── simple effects ──
  click()     { this._tone(420, 0.07, "sine", 0.11); }
  tick(n)     { n === 1 ? this._tone(1100, 0.11, "square", 0.18) : this._tone(680, 0.07, "triangle", 0.13); }
  correct()   { [523,659,784].forEach((f,i) => this._tone(f, 0.14, "sine", 0.16, i*0.09)); }
  wrong()     { this._tone(280, 0.18, "sawtooth", 0.16); this._tone(220, 0.22, "sawtooth", 0.12, 0.1); }
  godBurst()  { [440,554,659,880,1046].forEach((f,i) => this._tone(f, 0.22, "sine", 0.2, i*0.08)); }
  reveal()    { this._tone(900, 0.06, "sine", 0.08); }

  // ── verdict + tips ──
  whoosh() { 
    if (!this.on) return;
    const ctx = this._ensure(), now = ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(55, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.24);
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc.start(now); osc.stop(now + 0.34);
  }

  tipTap() { 
    if (!this.on) return;
    const ctx = this._ensure(), now = ctx.currentTime;
    [1900, 2600].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine";
      const t = now + i * 0.045;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o.start(t); o.stop(t + 0.13);
    });
  }

  tickerPing() { this._tone(1500, 0.035, "sine", 0.035); }
}

// ── singleton instance ──
const SND = new SoundEngine();


/* ═══════════════════════════════════════════════════════════════
    4  PROCEDURAL CHART PATTERN LIBRARY  (40+ patterns)
      Each factory returns:
        { candles: OHLC[22], continuation: OHLC[10],
          signal: 'buy'|'sell'|'hold', name: string, cat: string }
   ═══════════════════════════════════════════════════════════════ */

// ── micro-helpers ────────────────────────────────────────────
const R  = (a,b) => a + Math.random()*(b-a);          // random float [a,b)
const RI = (a,b) => Math.floor(R(a, b+1));            // random int   [a,b]
const CL = (v,a,b) => Math.max(a, Math.min(b, v));   // clamp

// Build one OHLC candle.  wU / wD = extra wick beyond body.
function K(o, c, wU=0, wD=0) {
  return { o:+o.toFixed(2), c:+c.toFixed(2),
           h:+(Math.max(o,c)+Math.abs(wU)).toFixed(2),
           l:+(Math.min(o,c)-Math.abs(wD)).toFixed(2) };
}

// Trending run: n candles from `start`, per-bar drift `slope ± vol`
function TR(start, n, slope, vol=2) {
  const a=[]; let p=start;
  for(let i=0;i<n;i++){
    const o=p; p+=slope+R(-vol,vol);
    a.push(K(o, p, R(0,vol*.45), R(0,vol*.45)));
  }
  return a;
}

// Consolidation block around `base`
function CO(base, n, rng=4) {
  const a=[]; let p=base;
  for(let i=0;i<n;i++){
    const o=p+R(-rng*.25,rng*.25), c=o+R(-rng*.35,rng*.35);
    p=c; a.push(K(o,c,R(.3,rng*.3),R(.3,rng*.3)));
  }
  return a;
}

// Pad / trim to exactly `n`
function PAD(arr, n) {
  const a=[...arr];
  while(a.length<n) a.push({...a[a.length-1]});
  return a.slice(0,n);
}

// ── 40+ PATTERN FACTORIES ─────────────────────────────────────
// Bullish Continuation ─────
function bullFlag() {
  const pole=TR(100,6,3.8,1.1), top=pole[pole.length-1].c;
  const flag=[]; let fp=top;
  for(let i=0;i<8;i++){ fp+=R(-.55,.12); flag.push(K(fp+R(-.25,.25),fp,R(.2,.7),R(.2,.7))); }
  return { candles:PAD([...pole,...flag,...CO(flag[flag.length-1].c,8,1.8)],22),
           continuation:TR(top-.8,10,3.1,1.5), signal:'buy', name:'Bull Flag', cat:'Continuation' };
}
function highTightFlag() {
  const spike=TR(100,4,5.2,.7), top=spike[spike.length-1].c;
  const tight=CO(top-.6,7,1.1);
  return { candles:PAD([...spike,...tight,...CO(tight[tight.length-1].c,11,1.4)],22),
           continuation:TR(top,10,3.9,1.1), signal:'buy', name:'High Tight Flag', cat:'Continuation' };
}
function ascTriangle() {
  const lead=TR(96,4,1,1.4); let sup=100; const res=108, tri=[];
  for(let i=0;i<10;i++){ sup+=.44; const m=sup+(res-sup)*R(.2,.7);
    tri.push(K(m+R(-1,1),m+R(-1,1),CL(res-m,.2,2.4),R(.2,1.1))); }
  return { candles:PAD([...lead,...tri,...CO(tri[tri.length-1].c,8,1.7)],22),
           continuation:TR(res+.6,10,2.5,1.4), signal:'buy', name:'Ascending Triangle', cat:'Continuation' };
}
function cupHandle() {
  const rim=108, left=TR(rim,3,-2.6,.8), cup=[];
  for(let i=0;i<8;i++){ const d=6*(1-Math.sin((i/7)*Math.PI)); cup.push(K(rim-d+R(-.5,.5),rim-d+R(-.5,.5),R(.2,.8),R(.2,.8))); }
  const hdl=[]; let hp=rim-1.7;
  for(let i=0;i<5;i++){ hp+=R(-.4,.08); hdl.push(K(hp+R(-.18,.18),hp,R(.1,.4),R(.1,.4))); }
  return { candles:PAD([...left,...cup,...hdl,...CO(hdl[hdl.length-1].c,6,1.1)],22),
           continuation:TR(rim+.4,10,2.8,1.3), signal:'buy', name:'Cup & Handle', cat:'Continuation' };
}
function powerOf3() {
  const drop=TR(108,3,-2.1,1), rng=CO(102,8,3.4);
  const spring=[K(101,99.4,.2,1.1),K(99.1,101.6,.3,.4),K(101.6,103.2,.2,.3)];
  return { candles:PAD([...drop,...rng,...spring,...CO(103.2,8,1.9)],22),
           continuation:TR(104,10,3,1.4), signal:'buy', name:'Power of 3 Accum', cat:'Continuation' };
}
function wyckoffSpring() {
  const setup=TR(106,4,-1.4,1), rng=CO(102,6,3.2);
  const spr=[K(100.3,98.6,.2,.7),K(98.3,97.9,.4,.9),K(97.7,101.3,.15,.25)];
  return { candles:PAD([...setup,...rng,...spr,...CO(101.3,9,1.9)],22),
           continuation:TR(103,10,3.1,1.3), signal:'buy', name:'Wyckoff Spring', cat:'Continuation' };
}
function bullRect() {
  const lead=TR(96,4,2.1,1.1), rect=CO(104,10,3.1);
  return { candles:PAD([...lead,...rect,...CO(rect[rect.length-1].c,8,1.4)],22),
           continuation:TR(107.2,10,2.7,1.4), signal:'buy', name:'Bullish Rectangle', cat:'Continuation' };
}

// Bearish Continuation ─────
function bearFlag() {
  const pole=TR(112,6,-3.8,1.1), bot=pole[pole.length-1].c;
  const flag=[]; let fp=bot;
  for(let i=0;i<8;i++){ fp+=R(-.12,.55); flag.push(K(fp+R(-.25,.25),fp,R(.2,.7),R(.2,.7))); }
  return { candles:PAD([...pole,...flag,...CO(flag[flag.length-1].c,8,1.8)],22),
           continuation:TR(bot+.8,10,-3.1,1.5), signal:'sell', name:'Bear Flag', cat:'Continuation' };
}
function descTriangle() {
  const lead=TR(112,4,-1,1.4); let res=109; const sup=100, tri=[];
  for(let i=0;i<10;i++){ res-=.42; const m=sup+(res-sup)*R(.2,.7);
    tri.push(K(m+R(-1,1),m+R(-1,1),R(.2,1.1),CL(m-sup,.2,2.4))); }
  return { candles:PAD([...lead,...tri,...CO(tri[tri.length-1].c,8,1.7)],22),
           continuation:TR(sup-.6,10,-2.5,1.4), signal:'sell', name:'Descending Triangle', cat:'Continuation' };
}
function bearRect() {
  const lead=TR(112,4,-2.1,1.1), rect=CO(104,10,3.1);
  return { candles:PAD([...lead,...rect,...CO(rect[rect.length-1].c,8,1.4)],22),
           continuation:TR(100,10,-2.7,1.4), signal:'sell', name:'Bearish Rectangle', cat:'Continuation' };
}
function wyckoffUpthrust() {
  const rise=TR(100,4,1.7,1), rng=CO(106,6,3.4);
  const ut=[K(107.3,109.8,.25,.35),K(109.6,109.5,.7,.25),K(109.4,106.2,.15,.4)];
  return { candles:PAD([...rise,...rng,...ut,...CO(106,9,1.9)],22),
           continuation:TR(104,10,-2.9,1.3), signal:'sell', name:'Wyckoff Upthrust', cat:'Continuation' };
}

// Bullish Reversals ────────
function invHS() {
  const pre=TR(108,3,-1.7,.9);
  const ls=[K(105,102.3,.7,1.4),K(102.6,104,.35,.5)];
  const hd=[K(104,100.2,.3,1.6),K(100,99.4,.5,.9),K(99.1,102.6,.25,.7)];
  const rs=[K(102.8,101.5,.5,.7),K(101.3,102.3,.3,1.4),K(102.5,103.6,.2,.35)];
  return { candles:PAD([...pre,...ls,...hd,...rs,...CO(103.6,7,1.4)],22),
           continuation:TR(105,10,2.7,1.3), signal:'buy', name:'Inv. Head & Shoulders', cat:'Reversal' };
}
function adamEve() {
  const pre=TR(110,3,-2,.9);
  const adam=[K(104,100.8,.4,.9),K(100.5,99.8,.7,.5),K(99.6,103.3,.2,.6)];
  const mid=TR(103.3,3,.4,.9);
  const eve=[]; for(let i=0;i<4;i++){ const p=100+2.2*(1-Math.cos((i/3)*Math.PI*.8)); eve.push(K(p+R(-.3,.3),p+R(-.3,.3),R(.15,.5),R(.15,.5))); }
  return { candles:PAD([...pre,...adam,...mid,...eve,...CO(101.5,8,1.4)],22),
           continuation:TR(104,10,2.5,1.4), signal:'buy', name:'Adam & Eve Double Bottom', cat:'Reversal' };
}
function dblBottom() {
  const pre=TR(110,3,-1.9,.9), b1=TR(104,3,-1.7,.8), r1=TR(100.5,3,1.9,.8);
  const b2=TR(103.4,3,-1.5,.8), rec=TR(100.5,4,1.7,.8);
  return { candles:PAD([...pre,...b1,...r1,...b2,...rec,...CO(rec[rec.length-1].c,5,1.4)],22),
           continuation:TR(104,10,2.4,1.5), signal:'buy', name:'Double Bottom', cat:'Reversal' };
}
function tripleBottom() {
  const pre=[K(107,105,.5,.7)];
  const b1=TR(105,2,-2.1,.6), r1=TR(102,2,1.9,.6);
  const b2=TR(104,2,-2.3,.6), r2=TR(101.4,2,2.1,.6);
  const b3=TR(104,2,-1.9,.6), r3=TR(102,3,1.7,.6);
  return { candles:PAD([...pre,...b1,...r1,...b2,...r2,...b3,...r3,...CO(r3[r3.length-1].c,4,1.1)],22),
           continuation:TR(105,10,2.7,1.3), signal:'buy', name:'Triple Bottom', cat:'Reversal' };
}
function roundBottom() {
  const a=[]; for(let i=0;i<16;i++){ const p=100+7*(1-Math.cos((i/15)*Math.PI))/2; a.push(K(p+R(-.6,.6),p+R(-.6,.6),R(.2,.8),R(.2,.8))); }
  return { candles:PAD([...a,...CO(a[a.length-1].c,6,1.1)],22),
           continuation:TR(106.5,10,2.1,1.4), signal:'buy', name:'Rounding Bottom', cat:'Reversal' };
}
function morningStar() {
  const pre=TR(108,5,-1.1,.9);
  const star=[K(103,100.2,.7,1),K(99.9,99.5,.7,.5),K(99.3,102.8,.4,.8)];
  return { candles:PAD([...pre,...star,...TR(102.8,6,.7,.9),...CO(106,6,1.4)],22),
           continuation:TR(106,10,2.4,1.4), signal:'buy', name:'Morning Star', cat:'Reversal' };
}
function bullEngulf() {
  const pre=TR(108,11,-0.9,1.1), last=pre[pre.length-1];
  const eng=[K(last.c,last.c-1.9,.4,.7),K(last.c-2.2,last.c+1.4,.2,.4)];
  return { candles:PAD([...pre,...eng,...CO(eng[eng.length-1].c,9,1.3)],22),
           continuation:TR(eng[eng.length-1].c,10,2.1,1.4), signal:'buy', name:'Bullish Engulfing', cat:'Reversal' };
}
function liquiditySweepBull() {
  const pre=TR(104,6,-0.6,1), sup=101;
  // sweep below support then violent snap
  const sweep=[K(101.2,100.4,.3,.7),K(100.2,99.5,.4,1.1),K(99.2,103.2,.15,.25)];
  return { candles:PAD([...pre,...sweep,...CO(103.2,13,1.8)],22),
           continuation:TR(104,10,2.8,1.3), signal:'buy', name:'Liquidity Sweep ↑', cat:'Reversal' };
}
function islandRevBull() {
  const pre=TR(108,5,-1.3,1);
  // gap-down island then gap-up escape
  const gapDn=TR(103,4,-.4,.9);
  const gapUp=TR(105.5,4,1.1,.9);
  return { candles:PAD([...pre,...gapDn,...gapUp,...CO(gapUp[gapUp.length-1].c,9,1.5)],22),
           continuation:TR(107,10,2.4,1.3), signal:'buy', name:'Island Reversal ↑', cat:'Reversal' };
}

// Bearish Reversals ────────
function hs() {
  const pre=TR(100,3,1.6,.9);
  const ls=[K(103,104.8,.4,.8),K(104.6,103.2,.6,.4)];
  const hd=[K(104,107.8,.25,.6),K(107.6,106.8,.4,1.3),K(107,103.8,.2,.4)];
  const rs=[K(104,104.9,.6,.7),K(104.7,103,0.4,.6)];
  return { candles:PAD([...pre,...ls,...hd,...rs,...CO(103,8,1.4)],22),
           continuation:TR(101.5,10,-2.7,1.3), signal:'sell', name:'Head & Shoulders', cat:'Reversal' };
}
function dblTop() {
  const pre=TR(98,3,1.9,.9), t1=TR(104,3,1.4,.8), d1=TR(107,3,-1.9,.8);
  const t2=TR(104,3,1.6,.8), drp=TR(107,4,-1.1,.9);
  return { candles:PAD([...pre,...t1,...d1,...t2,...drp,...CO(drp[drp.length-1].c,5,1.4)],22),
           continuation:TR(103.5,10,-2.3,1.5), signal:'sell', name:'Double Top', cat:'Reversal' };
}
function tripleTop() {
  const pre=[K(104,106,.4,.8)];
  const t1=TR(106,2,.7,.6), d1=TR(107,2,-1.9,.6);
  const t2=TR(104.5,2,1.4,.6), d2=TR(107,2,-1.9,.6);
  const t3=TR(104.5,2,1.1,.6), d3=TR(107,3,-1.4,.6);
  return { candles:PAD([...pre,...t1,...d1,...t2,...d2,...t3,...d3,...CO(d3[d3.length-1].c,4,1.1)],22),
           continuation:TR(103,10,-2.5,1.3), signal:'sell', name:'Triple Top', cat:'Reversal' };
}
function roundTop() {
  const a=[]; for(let i=0;i<16;i++){ const p=108-7*(1-Math.cos((i/15)*Math.PI))/2; a.push(K(p+R(-.6,.6),p+R(-.6,.6),R(.2,.8),R(.2,.8))); }
  return { candles:PAD([...a,...CO(a[a.length-1].c,6,1.1)],22),
           continuation:TR(101.5,10,-2.1,1.4), signal:'sell', name:'Rounding Top', cat:'Reversal' };
}
function eveningStar() {
  const pre=TR(100,5,1,.9);
  const star=[K(105.8,107.6,.4,.7),K(107.8,107.6,.5,.35),K(107.5,105,0.4,.8)];
  return { candles:PAD([...pre,...star,...TR(105,6,-.7,.9),...CO(101.5,6,1.4)],22),
           continuation:TR(101,10,-2.3,1.4), signal:'sell', name:'Evening Star', cat:'Reversal' };
}
function shootingStar() {
  const pre=TR(100,13,.55,1), top=pre[pre.length-1].c;
  const ss=K(top,top-.6,4.8,.25); // massive upper wick
  return { candles:PAD([...pre,ss,...TR(top-.8,8,-.7,.9)],22),
           continuation:TR(top-1,10,-2,1.7), signal:'sell', name:'Shooting Star', cat:'Reversal' };
}
function shootingStarCluster() {
  const pre=TR(100,10,.6,1), top=pre[pre.length-1].c;
  const cluster=[K(top,top-.5,4.2,.2),K(top-.4,top-.9,3.8,.3),K(top-.7,top-1.1,4,.2)];
  return { candles:PAD([...pre,...cluster,...TR(top-1.5,9,-.8,.9)],22),
           continuation:TR(top-2,10,-2.3,1.6), signal:'sell', name:'Shooting Star Cluster', cat:'Reversal' };
}
function bearEngulf() {
  const pre=TR(98,11,.85,1.1), last=pre[pre.length-1];
  const eng=[K(last.c,last.c+1.8,.6,.5),K(last.c+2.1,last.c-1.3,.35,.2)];
  return { candles:PAD([...pre,...eng,...CO(eng[eng.length-1].c,9,1.3)],22),
           continuation:TR(eng[eng.length-1].c,10,-2,1.4), signal:'sell', name:'Bearish Engulfing', cat:'Reversal' };
}
function liquiditySweepBear() {
  const pre=TR(104,6,.55,1), res=107;
  const sweep=[K(106.8,107.5,.6,.25),K(107.7,108.2,.3,.8),K(108.4,104.8,.2,.18)];
  return { candles:PAD([...pre,...sweep,...CO(104.8,13,1.8)],22),
           continuation:TR(103.5,10,-2.7,1.3), signal:'sell', name:'Liquidity Sweep ↓', cat:'Reversal' };
}

// Neutral / Ambiguous ──────
function symTriangle() {
  const a=[]; const bull=Math.random()>.5;
  for(let i=0;i<16;i++){ const sq=1-i/19, mid=104, rng=5.5*sq;
    a.push(K(mid+R(-rng,rng),mid+R(-rng,rng),R(.3,rng*.4),R(.3,rng*.4))); }
  return { candles:PAD([...a,...CO(104,6,1.2)],22),
           continuation:TR(104,10,bull?2.4:-2.4,1.7), signal:bull?'buy':'sell', name:'Symmetrical Triangle', cat:'Neutral' };
}
function broadeningFmt() {
  const a=[];
  for(let i=0;i<16;i++){ const ex=1+i/9, mid=104, rng=2.4*ex;
    a.push(K(mid+R(-rng,rng),mid+R(-rng,rng),R(.4,rng*.38),R(.4,rng*.38))); }
  return { candles:PAD([...a,...CO(104,6,2.1)],22),
           continuation:CO(104,10,3.2), signal:'hold', name:'Broadening Formation', cat:'Neutral' };
}
function deadCatBounce() {
  const crash=TR(116,5,-3.4,1), bounce=TR(98,4,2.1,.9), resume=TR(106,5,-1.4,.9);
  return { candles:PAD([...crash,...bounce,...resume,...CO(resume[resume.length-1].c,8,1.7)],22),
           continuation:TR(resume[resume.length-1].c,10,-2.6,1.4), signal:'sell', name:'Dead Cat Bounce', cat:'Neutral' };
}
function fakeoutTrap() {
  const consol=CO(104,10,2.8);
  // fake breakout up, violent rejection
  const fake=[K(106,108.5,.3,.6),K(108.3,107.8,.4,.25),K(107.6,104.2,.2,.4)];
  return { candles:PAD([...consol,...fake,...TR(104,9,-.7,.9)],22),
           continuation:TR(103,10,-2.2,1.6), signal:'sell', name:'Fakeout + Trap', cat:'Neutral' };
}
function wickRejection() {
  const pre=TR(100,11,.5,1), top=pre[pre.length-1].c;
  const wick=K(top,top-.7,4.6,.22); // enormous upper wick doji
  return { candles:PAD([...pre,wick,...TR(top-.9,10,-.65,.9)],22),
           continuation:TR(top-1.2,10,-1.9,1.6), signal:'sell', name:'Strong Wick Rejection', cat:'Neutral' };
}
function dojiSandwich() {
  const pre=TR(100,9,.9,1.1), last=pre[pre.length-1];
  const sand=[K(last.c,last.c+1.4,.4,.4),K(last.c+1.4,last.c+1.4,1.8,1.8),K(last.c+1.4,last.c+2.8,.3,.35)];
  return { candles:PAD([...pre,...sand,...CO(sand[sand.length-1].c,10,1.4)],22),
           continuation:TR(sand[sand.length-1].c,10,2,1.4), signal:'buy', name:'Doji Sandwich', cat:'Neutral' };
}
function channelUp() {
  const a=[]; for(let i=0;i<16;i++){ const m=100+i*.72; a.push(K(m+R(-1.8,1.8),m+R(-1.8,1.8),R(.4,1.3),R(.4,1.3))); }
  return { candles:PAD([...a,...CO(a[a.length-1].c,6,1.4)],22),
           continuation:TR(a[a.length-1].c,10,1.6,1.3), signal:'buy', name:'Channel Up', cat:'Neutral' };
}
function channelDown() {
  const a=[]; for(let i=0;i<16;i++){ const m=114-i*.72; a.push(K(m+R(-1.8,1.8),m+R(-1.8,1.8),R(.4,1.3),R(.4,1.3))); }
  return { candles:PAD([...a,...CO(a[a.length-1].c,6,1.4)],22),
           continuation:TR(a[a.length-1].c,10,-1.6,1.3), signal:'sell', name:'Channel Down', cat:'Neutral' };
}
function haramiBullish() {
  const pre=TR(108,10,-.75,1.1), last=pre[pre.length-1];
  const har=[K(last.c+1.6,last.c-.8,.6,.4),K(last.c-.6,last.c+.6,.25,.25)]; // small body inside big bearish
  return { candles:PAD([...pre,...har,...CO(har[har.length-1].c,10,1.5)],22),
           continuation:TR(har[har.length-1].c,10,2,1.3), signal:'buy', name:'Bullish Harami', cat:'Reversal' };
}
function haramiBearish() {
  const pre=TR(100,10,.75,1.1), last=pre[pre.length-1];
  const har=[K(last.c-1.6,last.c+.8,.4,.5),K(last.c+.5,last.c-.5,.22,.22)];
  return { candles:PAD([...pre,...har,...CO(har[har.length-1].c,10,1.5)],22),
           continuation:TR(har[har.length-1].c,10,-2,1.3), signal:'sell', name:'Bearish Harami', cat:'Reversal' };
}
function piercingLine() {
  const pre=TR(108,10,-.8,1.1), last=pre[pre.length-1];
  const pierce=[K(last.c-.4,last.c-2.2,.3,.6),K(last.c-2.6,last.c+.8,.2,.35)];
  return { candles:PAD([...pre,...pierce,...CO(pierce[pierce.length-1].c,10,1.5)],22),
           continuation:TR(pierce[pierce.length-1].c,10,2.1,1.3), signal:'buy', name:'Piercing Line', cat:'Reversal' };
}
function darkCloudCover() {
  const pre=TR(100,10,.8,1.1), last=pre[pre.length-1];
  const dcc=[K(last.c+.3,last.c+2.1,.5,.55),K(last.c+2.5,last.c-.7,.3,.2)];
  return { candles:PAD([...pre,...dcc,...CO(dcc[dcc.length-1].c,10,1.5)],22),
           continuation:TR(dcc[dcc.length-1].c,10,-2.1,1.3), signal:'sell', name:'Dark Cloud Cover', cat:'Reversal' };
}
function risingWedge() {
  // rising wedge = bearish reversal when price breaks below
  const a=[]; for(let i=0;i<14;i++){ const sup=100+i*.85, res=112-i*.55, mid=(sup+res)/2, rng=(res-sup)*.38;
    a.push(K(mid+R(-rng,rng),mid+R(-rng,rng),R(.4,1.8),R(.4,1.8))); }
  return { candles:PAD([...a,...CO(a[a.length-1].c,8,1.5)],22),
           continuation:TR(a[a.length-1].c,10,-2.4,1.6), signal:'sell', name:'Rising Wedge', cat:'Reversal' };
}
function fallingWedge() {
  // falling wedge = bullish reversal
  const a=[]; for(let i=0;i<14;i++){ const res=112-i*.72, sup=100+i*.22, mid=(sup+res)/2, rng=(res-sup)*.36;
    a.push(K(mid+R(-rng,rng),mid+R(-rng,rng),R(.4,1.8),R(.4,1.8))); }
  return { candles:PAD([...a,...CO(a[a.length-1].c,8,1.4)],22),
           continuation:TR(a[a.length-1].c,10,2.5,1.5), signal:'buy', name:'Falling Wedge', cat:'Reversal' };
}

// ── MASTER REGISTRY ──────────────────────────────────────────
const ALL_PATTERNS = [
  bullFlag, highTightFlag, ascTriangle, cupHandle, powerOf3, wyckoffSpring, bullRect,
  bearFlag, descTriangle, bearRect, wyckoffUpthrust,
  invHS, adamEve, dblBottom, tripleBottom, roundBottom, morningStar, bullEngulf, liquiditySweepBull, islandRevBull,
  hs, dblTop, tripleTop, roundTop, eveningStar, shootingStar, shootingStarCluster, bearEngulf, liquiditySweepBear,
  symTriangle, broadeningFmt, deadCatBounce, fakeoutTrap, wickRejection, dojiSandwich,
  channelUp, channelDown, haramiBullish, haramiBearish, piercingLine, darkCloudCover,
  risingWedge, fallingWedge,
];

function getRandomPattern() {
  return ALL_PATTERNS[RI(0, ALL_PATTERNS.length - 1)]();
}



/* ═══════════════════════════════════════════════════════════════
    6  TRADER ARCHETYPES  (final verdict engine)
   ═══════════════════════════════════════════════════════════════ */
const ARCHETYPES = [
  { name:"Impulse Ape",        emoji:"🐒", cond: r => r.buyCount > 4,
    roast:"Bro you BUY everything with a heartbeat. Your wallet is just Binance with extra steps and a prayer. You once bought a rug because it \"looked promising.\"" },
  { name:"Paper Hands Ghost",  emoji:"👻", cond: r => r.sellCount > 4,
    roast:"You sold BTC at $6k, ETH at $1k, and your last shred of self-respect at 2am on a Tuesday. Congratulations, you've single-handedly funded every whale's yacht." },
  { name:"Zen Diamond Holder", emoji:"💎", cond: r => r.holdCount > 3 && r.correct > 4,
    roast:"You held through 3 bear markets, 2 divorces, and a 99% drawdown — and somehow you're STILL not broke. Suspicious. Either enlightened or your wallet app is literally just broken." },
  { name:"Panic Seller",       emoji:"😰", cond: r => r.sellCount > 2 && r.correct < 3,
    roast:"Your strategy: chart goes red → you SELL → it pumps 300% → you cry into instant noodles → repeat. You are the liquidity. You ARE the exit. Whale food, but make it artisanal." },
  { name:"Scalp King",         emoji:"⚡", cond: r => r.avgSpeed < 1800 && r.correct > 4,
    roast:"Sub-2-second reflexes. Either you're a legit trader or you've been IV-dripping Monster since 2019. Your fingers are so fast they've filed for workers comp." },
  { name:"The Analyst",        emoji:"📊", cond: r => r.correct >= 6,
    roast:"6+ correct reads. OK so either you ACTUALLY studied charts — or — and hear me out — you've been selling trading courses to degens this whole time. Which is it? Don't answer." },
  { name:"Whale Watcher",      emoji:"🐋", cond: r => r.holdCount >= 2 && r.correct >= 4,
    roast:"You can smell a whale order block from 3 chains away. You lurk in whale wallets like a stalker in a Discord. Respect. Also, yes, that IS creepy. No we won't elaborate." },
  { name:"Degen",              emoji:"🎰", cond: () => true,  // fallback
    roast:"Your portfolio: 47 memecoins, a shitcoin called TOILET, and a single leveraged position held together by copium and prayers to Satoshi. Degen isn't your lifestyle. It's a clinical diagnosis." },
];

function getArchetype(stats) {
  return ARCHETYPES.find(a => a.cond(stats)) || ARCHETYPES[ARCHETYPES.length - 1];
}

/* ═══════════════════════════════════════════════════════════════
    7  CANVAS CHART RENDERER  (DPR-aware, 60fps animated reveal)
   ═══════════════════════════════════════════════════════════════ */
function drawChart(canvas, candles, revealCount, continuationCount, contCandles, godMode) {
  if (!canvas) return;
  const ctx    = canvas.getContext("2d");
  const dpr    = window.devicePixelRatio || 1;
  const W      = canvas.clientWidth;
  const H      = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height= H * dpr;
  ctx.scale(dpr, dpr);

  // ── background ──
  const grd = ctx.createLinearGradient(0,0,0,H);
  grd.addColorStop(0, "#0d0d1a");
  grd.addColorStop(1, "#06060c");
  ctx.fillStyle = grd;
  ctx.fillRect(0,0,W,H);

  // ── grid lines ──
  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth   = 1;
  for(let y=0;y<H;y+=H/6){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  for(let x=0;x<W;x+=W/8){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }

  // ── god-mode ambient glow ──
  if(godMode) {
    ctx.save();
    const pulse = 0.15 + 0.08*Math.sin(Date.now()*0.006);
    ctx.shadowColor = C.nGreen; ctx.shadowBlur = 40;
    ctx.strokeStyle = `rgba(0,255,170,${pulse})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(4,4,W-8,H-8);
    ctx.restore();
  }

  // Visible candles = initial reveal (animated in) + continuation (animated in)
  const totalVisible = revealCount + continuationCount;
  const allCandles   = [...candles.slice(0, revealCount), ...(contCandles||[]).slice(0, continuationCount)];
  if(allCandles.length === 0) return;

  // ── price scale  ──
  let lo = Infinity, hi = -Infinity;
  // Use ALL candles (initial + full continuation) for a stable scale
  const scaleCandles = [...candles, ...(contCandles||[])];
  scaleCandles.forEach(c => { if(c.l<lo) lo=c.l; if(c.h>hi) hi=c.h; });
  const pad  = (hi - lo) * 0.12;
  lo -= pad; hi += pad;
  const priceH = hi - lo || 1;

  const totalSlots = candles.length + (contCandles?.length || 0);
  const slotW      = W / totalSlots;
  const bodyW      = slotW * 0.55;
  const offX       = (slotW - bodyW) / 2;

  const toY = p => H - ((p - lo) / priceH) * H;

  // ── price label (right axis) for last visible candle ──
  const lastC = allCandles[allCandles.length - 1];
  const lblY  = toY(lastC.c);
  ctx.save();
  const lblColor = lastC.c >= lastC.o ? C.bull : C.bear;
  ctx.fillStyle = lblColor + "33";
  ctx.fillRect(W - 48, lblY - 9, 48, 18);
  ctx.fillStyle = lblColor;
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "right";
  ctx.fillText(lastC.c.toFixed(2), W - 4, lblY + 3.5);
  ctx.restore();

  // ── draw candles ──
  allCandles.forEach((c, i) => {
    const x = i * slotW;
    const bull = c.c >= c.o;

    // wave-reveal fade for continuation candles
    let alpha = 1;
    if (i >= revealCount) {
      const ci = i - revealCount;
      // continuationCount is the *current* animated count (0 → 10)
      // each candle fades in as continuationCount passes it
      alpha = CL(continuationCount - ci, 0, 1);
    }

    const bodyColor = bull ? C.bull : C.bear;
    const wickColor = bull ? "#00b85a" : "#e01030";

    ctx.globalAlpha = alpha;
    ctx.save();

    // wick
    ctx.strokeStyle = wickColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + slotW/2, toY(c.h));
    ctx.lineTo(x + slotW/2, toY(c.l));
    ctx.stroke();

    // body
    const bodyTop    = toY(Math.max(c.o, c.c));
    const bodyBottom = toY(Math.min(c.o, c.c));
    const bodyHeight = Math.max(bodyBottom - bodyTop, 1);

    // glass-style body gradient
    const bg = ctx.createLinearGradient(x+offX, bodyTop, x+offX+bodyW, bodyTop);
    bg.addColorStop(0, bodyColor);
    bg.addColorStop(0.4, bull ? "#00ff9d" : "#ff4466");
    bg.addColorStop(1, bodyColor);
    ctx.fillStyle = bg;
    ctx.fillRect(x + offX, bodyTop, bodyW, bodyHeight);

    // subtle border
    ctx.strokeStyle = bull ? "#00ff9d55" : "#ff446655";
    ctx.lineWidth = 0.7;
    ctx.strokeRect(x + offX, bodyTop, bodyW, bodyHeight);

    ctx.restore();
    ctx.globalAlpha = 1;
  });
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
    11  COUNTDOWN OVERLAY  (3-2-1 glass shatter)
   ═══════════════════════════════════════════════════════════════ */
function Countdown({ onDone }) {
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
      <GlassButton onClick={()=>onChoose("hold")} color={C.nAmber} disabled={disabled} style={{ flex:1, padding:"16px 8px" }}>
        <div style={{ fontSize:11, opacity:0.7, marginBottom:2 }}>NEUTRAL</div>
        <div style={{ fontSize:18 }}>⏸ HOLD</div>
      </GlassButton>
      <GlassButton onClick={()=>onChoose("buy")} color={C.bull} disabled={disabled} style={{ flex:1, padding:"16px 8px" }}>
        <div style={{ fontSize:11, opacity:0.7, marginBottom:2 }}>BULLISH</div>
        <div style={{ fontSize:18 }}>📈 BUY</div>
      </GlassButton>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
    14  OUTCOME CARD  (shown after continuation animates in)
   ═══════════════════════════════════════════════════════════════ */
function OutcomeCard({ correct, points, streak, patternName, choice, signal, onNext, godMode }) {
  return (
    <GlassPanel style={{ padding:28, textAlign:"center", maxWidth:360, margin:"0 auto", position:"relative", overflow:"hidden" }}>
      {/* glow accent */}
      <div style={{ position:"absolute", top:-30, left:"50%", transform:"translateX(-50%)",
        width:160, height:160, borderRadius:"50%",
        background: correct ? `radial-gradient(circle, ${C.nGreen}22 0%, transparent 70%)` : `radial-gradient(circle, ${C.nPink}22 0%, transparent 70%)`,
        pointerEvents:"none" }} />

      <div style={{ fontSize:44, marginBottom:4 }}>{correct ? (godMode ? "🌟" : "✅") : "❌"}</div>
      <div style={{ fontSize:20, fontWeight:800, color: correct ? C.nGreen : C.nPink,
        fontFamily:"'SF Mono','Fira Code',monospace", textShadow:`0 0 16px ${correct?C.nGreen:C.nPink}` }}>
        {correct ? "CORRECT" : "WRONG"}
      </div>
      <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)", marginTop:4, fontFamily:"monospace" }}>
        Pattern: <span style={{ color:"rgba(255,255,255,0.72)", fontWeight:600 }}>{patternName}</span>
      </div>
      <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:2, fontFamily:"monospace" }}>
        Signal: <span style={{ color: signal==="buy"?C.bull:signal==="sell"?C.bear:C.nAmber, fontWeight:700 }}>{signal.toUpperCase()}</span>
        {"  ·  "}You chose: <span style={{ color: choice==="buy"?C.bull:choice==="sell"?C.bear:C.nAmber, fontWeight:700 }}>{choice.toUpperCase()}</span>
      </div>

      {/* points */}
      <div style={{ margin:"18px 0 4px", display:"flex", alignItems:"baseline", justifyContent:"center", gap:8 }}>
        <span style={{ fontSize:32, fontWeight:800, fontFamily:"'SF Mono','Fira Code',monospace", color:correct?C.nGreen:"rgba(255,255,255,0.35)" }}>
          {correct ? `+${points}` : "+0"}
        </span>
        {streak > 1 && correct && (
          <span style={{ fontSize:13, color:C.nPurple, fontWeight:700, background:`${C.nPurple}18`, padding:"2px 8px", borderRadius:10, border:`1px solid ${C.nPurple}30` }}>
            🔥 ×{STREAK_MULT[Math.min(streak, STREAK_MULT.length-1)].toFixed(1)}
          </span>
        )}
      </div>

      <GlassButton onClick={onNext} color={C.nGreen} style={{ marginTop:16, width:"100%", justifyContent:"center" }}>
        Next Round →
      </GlassButton>
    </GlassPanel>
  );
}

/* ═══════════════════════════════════════════════════════════════
    15  FINAL VERDICT SCREEN
   ═══════════════════════════════════════════════════════════════ */
function FinalVerdict({ stats, onRestart, onLeaderboard, onShare }) {
  const arch = getArchetype(stats);
  const stars = Math.round((stats.correct / ROUNDS) * 5);

  // dramatic whoosh on verdict entrance
  useEffect(() => { SND.whoosh(); }, []);

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:18, padding:"20px 16px", maxWidth:420, margin:"0 auto" }}>
      <GlassPanel style={{ padding:30, textAlign:"center", width:"100%", position:"relative", overflow:"hidden" }}>
        {/* animated top accent */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:3,
          background:`linear-gradient(90deg, transparent, ${C.nGreen}, ${C.nPurple}, ${C.nPink}, transparent)` }} />

        <div style={{ fontSize:56, marginBottom:2 }}>{arch.emoji}</div>
        <div style={{ fontSize:22, fontWeight:800, fontFamily:"'SF Mono','Fira Code',monospace",
          background:`linear-gradient(135deg, ${C.nGreen}, ${C.nPurple})`,
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          {arch.name}
        </div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.42)", marginTop:6, lineHeight:1.5, maxWidth:300, margin:"8px auto 0", fontFamily:"monospace" }}>
          "{arch.roast}"
        </div>

        {/* stars */}
        <div style={{ display:"flex", justifyContent:"center", gap:4, margin:"16px 0 4px" }}>
          {Array.from({length:5}, (_,i) => (
            <span key={i} style={{ fontSize:22, filter: i<stars ? `drop-shadow(0 0 6px ${C.nAmber})` : "none" }}>
              {i < stars ? "⭐" : "☆"}
            </span>
          ))}
        </div>

        {/* stats row */}
        <div style={{ display:"flex", justifyContent:"center", gap:24, marginTop:12 }}>
          {[
            { label:"Score", val: stats.totalScore, color:C.nGreen },
            { label:"Correct", val:`${stats.correct}/${ROUNDS}`, color:C.nBlue },
            { label:"Streak", val:`${stats.maxStreak}`, color:C.nPurple },
            { label:"Avg ms", val:`${stats.avgSpeed}`, color:C.nAmber },
          ].map(s => (
            <div key={s.label} style={{ textAlign:"center" }}>
              <div style={{ fontSize:18, fontWeight:800, fontFamily:"monospace", color:s.color }}>{s.val}</div>
              <div style={{ fontSize:9, color:"rgba(255,255,255,0.38)", textTransform:"uppercase", letterSpacing:"0.08em" }}>{s.label}</div>
            </div>
          ))}
        </div>
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
  const blob = new Blob([svg], {type:"image/svg+xml"});
  const url  = URL.createObjectURL(blob);

  // Try Web Share API first (mobile)
  if(navigator.share) {
    navigator.share({
      title: "Reflex Glass",
      text:  `I scored ${stats.totalScore} — ${getArchetype(stats).name} 🔥`,
      url:   window.location.href,
    }).catch(()=>{});
  } else {
    // fallback: open in new tab
    window.open(url, "_blank");
  }
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
      SND.tipSent();
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
      // ── STATE ──
      const [screen, setScreen] = useState(loadName() ? "home" : "name");
      const [pattern, setPattern] = useState(null);
      const [contProgress, setContProgress] = useState(0);
      const [choice, setChoice] = useState(null);
      const [decisionEnabled, setDecisionEnabled] = useState(false);

      // refs
      const chartRef = useRef(null);
      const contAnimRef = useRef(null);
      const rafChartRef = useRef(null);
      const choiceTimeRef = useRef(null);

      // ── CHART RAF LOOP ──
      useEffect(() => {
        if (!pattern) return;
        let running = true;

        function loop() {
          if (!running) return;
          drawChart(
            chartRef.current,
            pattern.candles,
            22, // initial candles always fully visible
            contProgress,
            pattern.continuation,
            godMode
          );
          rafChartRef.current = requestAnimationFrame(loop);
        }

        loop();
        return () => { running = false; cancelAnimationFrame(rafChartRef.current); };
      }, [pattern, contProgress, godMode]);

      // ── START NEW ROUND ──
      const startPlaying = useCallback(() => {
        const p = getRandomPattern();
        setPattern(p);              // chart adat előbb
        setContProgress(0);
        setChoice(null);
        setScreen("playing");       // screen váltás csak utána
        choiceTimeRef.current = null;
        setDecisionEnabled(false);  // decision gombok tiltva

        // animáció időablak (pl. 1s), utána a user dönthet
        const animDuration = 1000;
        setTimeout(() => setDecisionEnabled(true), animDuration);
      }, []);

      // ── CONTINUATION ANIMATION ──
      useEffect(() => {
        if (screen !== "playing" || !pattern) return;
        const startTime = Date.now();
        const duration = 900; // ms az animációra
        function animate() {
          const elapsed = Date.now() - startTime;
          const pct = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - pct, 3); // ease-out cubic
          setContProgress(eased * 10);

          if (pct < 1) {
            contAnimRef.current = requestAnimationFrame(animate);
          } else {
            setContProgress(10);
          }
        }
        contAnimRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(contAnimRef.current);
      }, [screen, pattern]);

      // ── HANDLE USER CHOICE ──
      const handleChoice = useCallback((ch) => {
        if (!decisionEnabled || choice !== null) return; // még nem engedélyezett vagy már választott
        choiceTimeRef.current = choiceTimeRef.current || Date.now();
        setChoice(ch);

        const speedMs = Date.now() - choiceTimeRef.current;
        const correct = ch === pattern.signal;
        haptic(correct ? [30,20,30] : [80]);

        if (correct) {
          SND.correct();
          const mult = STREAK_MULT[Math.min(streak + 1, STREAK_MULT.length - 1)];
          const speedBonus = Math.round((1 - (speedMs / DECISION_MS)) * BASE_SCORE * 0.5);
          const pts = Math.round((BASE_SCORE + speedBonus) * mult);
          setScores(prev => [...prev, pts]);
          setRoundStats(prev => [...prev, { correct:true, speedMs, choice:ch, signal:pattern.signal }]);
          setStreak(streak + 1);
          setParticleBurst(true);
          setTimeout(() => setParticleBurst(false), 600);
        } else {
          SND.wrong();
          setScores(prev => [...prev, 0]);
          setRoundStats(prev => [...prev, { correct:false, speedMs, choice:ch, signal:pattern.signal }]);
          setStreak(0);
        }

        // után outcome
        setScreen("outcome");
      }, [decisionEnabled, choice, pattern, streak]);


    // ── GAME ACTIONS ──

    // 1️⃣ játék indítás → pattern ELŐRE létrejön
    const startGame = useCallback(() => {
      const p = getRandomPattern();   // 👈 ELŐRE
      setPattern(p);

      setRound(0);
      setScores([]);
      setRoundStats([]);
      setStreak(0);
      setGodMode(false);
      setChoice(null);
      setContProgress(0);

      setScreen("countdown");         // 👈 chart már alatta él
    }, []);



  

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
    } [choice, pattern, streak, godMode]


    // 4️⃣ következő kör
    const advanceRound = useCallback(() => {
      const nextRound = round + 1;

      if (nextRound >= ROUNDS) {
        const stats = computeStats();
        addToLeaderboard(playerName, stats);
        setScreen("verdict");
      } else {
        const p = getRandomPattern();   // 👈 ÚJ PATTERN ELŐRE
        setPattern(p);

        setRound(nextRound);
        setChoice(null);
        setContProgress(0);

        setScreen("countdown");         // 👈 megint előrender
      }
    }, [round, playerName]);


    // 5️⃣ statisztika (változatlan)
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
        {screen === "countdown"   && <Countdown onDone={startPlaying} />}
        {(screen==="playing" || screen==="revealing" || screen==="outcome") && renderPlaying()}
        {screen === "verdict"     && renderVerdict()}
        {screen === "leaderboard" && (
          <div style={{ paddingTop:20 }}>
            <Leaderboard onClose={()=>setScreen(round>=ROUNDS?"verdict":"home")} currentName={playerName} />
          </div>
        )}
      </div>
    </div>
  );
