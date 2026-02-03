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
 *  REFLEX GLASS v2.1 — FIXED VERSION
 *  - Javított DexScreener ticker
 *  - 7 kör után automatikus verdict screen
 *  - Nincs "revealing" átmenet a chartok között
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSendTransaction, useWaitForTransactionReceipt } from "wagmi";

const ROUNDS       = 7;
const DECISION_MS  = 4000;
const BASE_SCORE   = 1000;
const STREAK_MULT  = [1, 1.3, 1.6, 2.0, 2.5, 3.0, 3.5, 4.0];

const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DONATION_ADDRESS = "0xa800F14C07935e850e9e20221956d99920E9a498";

const C = {
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

function haptic(pattern = [30]) {
  try { navigator?.vibrate?.(pattern); } catch(_) {}
}

class SoundEngine {
  constructor() { this.ctx = null; this.on = true; }
  _ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }
  _tone(freq, dur, type = "sine", vol = 0.13, startDelay = 0) {
    if (!this.on) return;
    const ctx = this._ensure();
    const now = ctx.currentTime + startDelay;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.start(now); osc.stop(now + dur);
  }
  click()     { this._tone(420, 0.07, "sine", 0.11); }
  tick(n)     { n === 1 ? this._tone(1100, 0.11, "square", 0.18) : this._tone(680, 0.07, "triangle", 0.13); }
  correct()   { [523,659,784].forEach((f,i) => this._tone(f, 0.14, "sine", 0.16, i*0.09)); }
  wrong()     { this._tone(280, 0.18, "sawtooth", 0.16); this._tone(220, 0.22, "sawtooth", 0.12, 0.1); }
  godBurst()  { [440,554,659,880,1046].forEach((f,i) => this._tone(f, 0.22, "sine", 0.2, i*0.08)); }
  verdict() {
    [1200, 1600, 2000].forEach((f, i) => this._tone(f, 0.08, "sine", 0.14, i * 0.06));
    this._tone(80, 0.4, "sine", 0.22, 0.22);
  }
}

const SND = new SoundEngine();

function playSound(type) {
  if (!SND.on) return;
  switch (type) {
    case "tick":      SND.tick(2);     break;
    case "click":     SND.click();     break;
    case "good":      SND.correct();   break;
    case "bad":       SND.wrong();     break;
    case "verdict":   SND.verdict();   break;
    case "godBurst":  SND.godBurst();  break;
    default: break;
  }
}

const R  = (a,b) => a + Math.random()*(b-a);
const RI = (a,b) => Math.floor(R(a, b+1));
const CL = (v,a,b) => Math.max(a, Math.min(b, v));

function K(o, c, wU=0, wD=0) {
  return { o:+o.toFixed(2), c:+c.toFixed(2),
           h:+(Math.max(o,c)+Math.abs(wU)).toFixed(2),
           l:+(Math.min(o,c)-Math.abs(wD)).toFixed(2) };
}

function TR(start, n, slope, vol=2) {
  const a=[]; let p=start;
  for(let i=0;i<n;i++){ const o=p; p+=slope+R(-vol,vol); a.push(K(o, p, R(0,vol*.45), R(0,vol*.45))); }
  return a;
}

function CO(base, n, rng=4) {
  const a=[]; let p=base;
  for(let i=0;i<n;i++){ const o=p+R(-rng*.25,rng*.25), c=o+R(-rng*.35,rng*.35); p=c; a.push(K(o,c,R(.3,rng*.3),R(.3,rng*.3))); }
  return a;
}

function PAD(arr, n) {
  const a=[...arr];
  while(a.length<n) a.push({...a[a.length-1]});
  return a.slice(0,n);
}

// Pattern functions (abbreviated for file size)
function bullFlag() {
  const pole=TR(100,6,3.8,1.1), top=pole[pole.length-1].c;
  const flag=[]; let fp=top;
  for(let i=0;i<8;i++){ fp+=R(-.55,.12); flag.push(K(fp+R(-.25,.25),fp,R(.2,.7),R(.2,.7))); }
  return { candles:PAD([...pole,...flag,...CO(flag[flag.length-1].c,8,1.8)],22),
           continuation:TR(top-.8,10,3.1,1.5), signal:'buy', name:'Bull Flag', cat:'Continuation' };
}
function bearFlag() {
  const drop=TR(120,6,-3.6,1.2), bot=drop[drop.length-1].c;
  const flag=[]; let fp=bot;
  for(let i=0;i<8;i++){ fp+=R(-.1,.4); flag.push(K(fp+R(-.2,.2),fp,R(.2,.6),R(.2,.6))); }
  return { candles:PAD([...drop,...flag,...CO(flag[flag.length-1].c,8,1.8)],22),
           continuation:TR(bot+.6,10,-3.2,1.5), signal:'sell', name:'Bear Flag', cat:'Continuation' };
}
function ascTriangle() {
  const base=[]; let p=90;
  for(let i=0;i<14;i++){ const o=p+R(-1,.8); p=o+R(-.5,1.2); base.push(K(o,p,R(.3,.9),R(.3,.9))); }
  const res=108; for(let k of base){ k.h=Math.min(k.h,res+R(-.2,.2)); }
  return { candles:PAD(base,22), continuation:TR(res+.5,10,2.8,1.4), signal:'buy', name:'Ascending Triangle', cat:'Continuation' };
}
function doubleTop() {
  const up1=TR(95,5,2.0,1.0), peak1=up1[up1.length-1].c;
  const d1=TR(peak1,3,-1.8,.9), bot=d1[d1.length-1].c;
  const up2=TR(bot,5,1.9,1.0), peak2=up2[up2.length-1].c;
  const d2=TR(peak2,4,-1.6,.9);
  return { candles:PAD([...up1,...d1,...up2,...d2],22), continuation:TR(d2[d2.length-1].c,10,-2.5,1.4), signal:'sell', name:'Double Top', cat:'Reversal' };
}
function doubleBottom() {
  const d1=TR(105,5,-2.0,1.0), bot1=d1[d1.length-1].c;
  const u1=TR(bot1,3,1.8,.9), peak=u1[u1.length-1].c;
  const d2=TR(peak,5,-1.9,1.0), bot2=d2[d2.length-1].c;
  const u2=TR(bot2,4,1.6,.9);
  return { candles:PAD([...d1,...u1,...d2,...u2],22), continuation:TR(u2[u2.length-1].c,10,2.5,1.4), signal:'buy', name:'Double Bottom', cat:'Reversal' };
}
function headShoulders() {
  const ls=TR(95,4,1.5,.9), lp=ls[ls.length-1].c, ld=TR(lp,3,-1.0,.7);
  const hs=TR(ld[ld.length-1].c,5,2.0,1.0), hp=hs[hs.length-1].c, hd=TR(hp,3,-1.8,.8);
  const rs=TR(hd[hd.length-1].c,4,1.4,.9), rp=rs[rs.length-1].c, rd=TR(rp,3,-1.2,.7);
  return { candles:PAD([...ls,...ld,...hs,...hd,...rs,...rd],22), continuation:TR(rd[rd.length-1].c,10,-2.6,1.5), signal:'sell', name:'Head & Shoulders', cat:'Reversal' };
}
function cupHandle() {
  const c=[]; let p=110;
  for(let i=0;i<10;i++){ p+=R(-1.5,-.6); c.push(K(p+R(-.3,.3),p,R(.2,.6),R(.2,.6))); }
  for(let i=0;i<10;i++){ p+=R(.6,1.5); c.push(K(p+R(-.3,.3),p,R(.2,.6),R(.2,.6))); }
  const top=c[c.length-1].c; const h=[]; let hp=top;
  for(let i=0;i<6;i++){ hp+=R(-.4,.05); h.push(K(hp+R(-.2,.2),hp,R(.15,.4),R(.15,.4))); }
  return { candles:PAD([...c,...h],22), continuation:TR(top-.3,10,3.0,1.4), signal:'buy', name:'Cup and Handle', cat:'Continuation' };
}

const ALL_PATTERNS = [
  bullFlag, bearFlag, ascTriangle, doubleTop, doubleBottom, headShoulders, cupHandle
];

class CanvasChart {
  constructor(canvas) {
    this.cvs = canvas;
    this.ctx = canvas.getContext("2d");
    this.data = [];
    this.yRange = null;
    this.now = 0;
    this.raf = null;
    this.drawContinuation = false;
    this.contData = [];
  }

  setData(candles, continuation, drawCont) {
    this.data = candles;
    this.contData = continuation || [];
    this.drawContinuation = drawCont;
    const all = this.drawContinuation ? [...candles, ...this.contData] : candles;
    const low = Math.min(...all.map(k => k.l)) - 2;
    const high = Math.max(...all.map(k => k.h)) + 2;
    this.yRange = { low, high };
    this.now = 0;
  }

  start(duration = 2000) {
    this.stop();
    const start = performance.now();
    const loop = (t) => {
      const e = Math.min((t - start) / duration, 1);
      this.now = e;
      this.draw();
      if (e < 1) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.cvs.getBoundingClientRect();
    this.cvs.width = rect.width * dpr;
    this.cvs.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.draw();
  }

  draw() {
    const rect = this.cvs.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    this.ctx.clearRect(0, 0, w, h);

    const all = this.drawContinuation ? [...this.data, ...this.contData] : this.data;
    const n = all.length;
    if (!n) return;

    const { low, high } = this.yRange;
    const yScale = (val) => h - ((val - low) / (high - low)) * h;

    const gap = 1.5;
    const cw = Math.max((w - (n - 1) * gap) / n, 2);
    const visibleCount = Math.floor(n * this.now);

    for (let i = 0; i < visibleCount; i++) {
      const k = all[i];
      const x = i * (cw + gap);
      const yO = yScale(k.o), yC = yScale(k.c), yH = yScale(k.h), yL = yScale(k.l);
      const bullish = k.c >= k.o;
      const color = bullish ? C.bull : C.bear;

      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x + cw / 2, yH);
      this.ctx.lineTo(x + cw / 2, yL);
      this.ctx.stroke();

      this.ctx.fillStyle = color;
      const bodyTop = Math.min(yO, yC);
      const bodyH = Math.max(Math.abs(yC - yO), 1);
      this.ctx.fillRect(x, bodyTop, cw, bodyH);
    }
  }
}

function LiveTicker() {
  const [tokens, setTokens] = useState([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await fetch("https://api.dexscreener.com/token-profiles/latest/v1");
        const json = await res.json();
        
        if (json && Array.isArray(json) && json.length > 0) {
          const basePairs = json
            .filter(p => p.chainId === "base" && p.url)
            .slice(0, 10);
          
          if (basePairs.length > 0) {
            const tokenData = await Promise.all(
              basePairs.map(async (p) => {
                try {
                  const pairRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${p.tokenAddress}`);
                  const pairJson = await pairRes.json();
                  
                  if (pairJson?.pairs && pairJson.pairs.length > 0) {
                    const pair = pairJson.pairs[0];
                    return {
                      ticker: pair.baseToken?.symbol || "???",
                      price: parseFloat(pair.priceUsd || 0),
                      change24h: parseFloat(pair.priceChange?.h24 || 0)
                    };
                  }
                } catch (err) {
                  console.log("Token fetch error:", err);
                }
                return null;
              })
            );
            
            const validTokens = tokenData.filter(t => t !== null && t.price > 0);
            if (validTokens.length > 0) {
              setTokens(validTokens);
            }
          }
        }
      } catch (err) {
        console.log("DexScreener fetch error:", err);
      }
    };

    fetchTrending();
    const iv = setInterval(fetchTrending, 45000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (tokens.length === 0) return;
    const iv = setInterval(() => setIdx(i => (i + 1) % tokens.length), 4000);
    return () => clearInterval(iv);
  }, [tokens]);

  if (tokens.length === 0) {
    return (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 999,
        background: C.glass, backdropFilter: "blur(18px)", borderBottom: `1px solid ${C.glassBr}`,
        padding: "6px 12px", display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <div style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.45)" }}>
          BASE
        </div>
        <div style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.35)" }}>
          Loading...
        </div>
      </div>
    );
  }
  
  const t = tokens[idx];
  const chg = t.change24h >= 0 ? `+${t.change24h.toFixed(1)}%` : `${t.change24h.toFixed(1)}%`;
  const chgColor = t.change24h >= 0 ? C.nGreen : C.nPink;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 999,
      background: C.glass, backdropFilter: "blur(18px)", borderBottom: `1px solid ${C.glassBr}`,
      padding: "6px 12px", display: "flex", justifyContent: "space-between", alignItems: "center"
    }}>
      <div style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.45)" }}>
        BASE
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "#fff" }}>
          {t.ticker}
        </span>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.6)" }}>
          ${t.price < 0.01 ? t.price.toExponential(2) : t.price.toFixed(4)}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "monospace", color: chgColor }}>
          {chg}
        </span>
      </div>
    </div>
  );
}

function ParticleCanvas({ active, godMode }) {
  const ref = useRef(null);

  useEffect(() => {
    const cvs = ref.current; if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      cvs.width = window.innerWidth * dpr;
      cvs.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const particles = [];

    if (active) {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const speed = R(2, 6);
        particles.push({
          x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          r: R(2, 5), life: R(0.6, 1.0), color: [C.nGreen, C.nPink, C.nPurple][RI(0, 2)]
        });
      }
    }
    if (godMode) {
      for (let i = 0; i < 20; i++) {
        particles.push({
          x: R(0, window.innerWidth), y: R(0, window.innerHeight),
          vx: R(-0.5, 0.5), vy: R(-0.5, 0.5), r: R(1, 3), life: R(0.8, 1.0), color: C.nGreen
        });
      }
    }

    let raf = null;
    const loop = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life -= 0.01;
        if (p.life <= 0 || p.y < 0 || p.y > window.innerHeight) { particles.splice(i, 1); continue; }
        ctx.fillStyle = p.color + Math.floor(p.life * 255).toString(16).padStart(2, "0");
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
        ctx.fill();
      }
      if (particles.length > 0 || godMode) raf = requestAnimationFrame(loop);
    };
    loop();

    return () => { if (raf) cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [active, godMode]);

  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 199 }} />;
}

const GlassPanel = ({ children, style, ...rest }) => (
  <div style={{ background: C.glass, backdropFilter: "blur(18px)", border: `1px solid ${C.glassBr}`, borderRadius: 18, ...style }} {...rest}>
    {children}
  </div>
);

const GlassButton = ({ children, onClick, color = C.nGreen, disabled, style, ...rest }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: disabled ? C.glass : `${color}18`,
    border: `1px solid ${disabled ? C.glassBr : color + "35"}`,
    borderRadius: 16, padding: "12px 24px", color: disabled ? "rgba(255,255,255,0.35)" : "#fff",
    fontWeight: 700, fontSize: 15, cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s", position: "relative", ...style
  }}
  onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.boxShadow = `0 0 20px ${color}40`; }}
  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }} {...rest}>
    {children}
  </button>
);

function DecisionButtons({ onChoose, disabled }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
      {["buy", "neutral", "sell"].map(sig => (
        <GlassButton key={sig} onClick={() => { if (!disabled) onChoose(sig); }} disabled={disabled}
          color={sig === "buy" ? C.bull : sig === "sell" ? C.bear : C.neut}
          style={{ padding: "16px 10px", fontSize: 14, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {sig === "buy" ? "📈 Long" : sig === "sell" ? "📉 Short" : "⏸️ Neutral"}
        </GlassButton>
      ))}
    </div>
  );
}

function TimerBar({ timeLeft, totalTime }) {
  const pct = Math.max((timeLeft / totalTime) * 100, 0);
  const low = pct < 25;
  return (
    <GlassPanel style={{ padding: 0, overflow: "hidden", height: 8, position: "relative" }}>
      <div style={{
        width: `${pct}%`, height: "100%", background: low ? C.nPink : C.nGreen,
        transition: "width 0.1s linear", boxShadow: low ? `0 0 12px ${C.nPink}` : "none"
      }} />
    </GlassPanel>
  );
}

function OutcomeCard({ correct, points, streak, patternName, choice, signal, onNext, godMode }) {
  return (
    <GlassPanel style={{ padding: 18, textAlign: "center", border: `1px solid ${correct ? C.bull + "45" : C.bear + "45"}`,
      background: correct ? `${C.bull}0d` : `${C.bear}0d` }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{correct ? "✅" : "❌"}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: correct ? C.bull : C.bear, marginBottom: 4 }}>
        {correct ? "CORRECT!" : "WRONG!"}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>
        {patternName} · Signal: {signal === "buy" ? "📈" : signal === "sell" ? "📉" : "⏸️"}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>
        You picked: {choice === "buy" ? "Long" : choice === "sell" ? "Short" : "Neutral"}
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "monospace", color: C.nGreen, marginBottom: 12 }}>
        +{points.toLocaleString()} pts
      </div>
      {streak > 0 && (
        <div style={{ fontSize: 13, color: C.nPurple, fontWeight: 700, marginBottom: 10 }}>
          🔥 Streak: {streak} · Multiplier ×{STREAK_MULT[Math.min(streak + 1, STREAK_MULT.length - 1)].toFixed(1)}
        </div>
      )}
      {godMode && (
        <div style={{ fontSize: 12, color: C.nGreen, fontWeight: 700, marginBottom: 10 }}>⚡ GOD MODE ACTIVE</div>
      )}
      <GlassButton onClick={onNext} color={C.nBlue} style={{ padding: "10px 28px", fontSize: 14 }}>
        Next Chart →
      </GlassButton>
    </GlassPanel>
  );
}

function Countdown({ onDone }) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    playSound("tick");
    const iv = setInterval(() => {
      setCount(c => {
        if (c <= 1) { clearInterval(iv); setTimeout(onDone, 300); return 0; }
        playSound("tick");
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [onDone]);

  if (count === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100dvh - 34px)" }}>
      <div style={{
        fontSize: 120, fontWeight: 900, fontFamily: "monospace", color: C.nGreen,
        animation: "numPop 0.3s ease-out", filter: "drop-shadow(0 0 30px rgba(0,255,170,0.5))"
      }}>
        {count}
      </div>
    </div>
  );
}

function NameInput({ onSubmit }) {
  const [val, setVal] = useState("");

  const handleGo = () => {
    const n = val.trim() || "Anon";
    try { localStorage.setItem("reflexName", n); } catch (_) {}
    onSubmit(n);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100dvh - 34px)", gap: 20, padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div style={{
          fontSize: 36, fontWeight: 900, fontFamily: "'SF Mono','Fira Code',monospace", letterSpacing: "-1px",
          background: `linear-gradient(135deg, ${C.nGreen} 0%, ${C.nPurple} 100%)`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
        }}>
          REFLEX GLASS
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
          Enter your name to start
        </div>
      </div>
      <GlassPanel style={{ padding: 20, maxWidth: 340, width: "100%" }}>
        <input type="text" value={val} onChange={e => setVal(e.target.value)} placeholder="Your name..."
          onKeyDown={e => { if (e.key === "Enter") handleGo(); }}
          style={{
            width: "100%", padding: 14, fontSize: 15, borderRadius: 12, border: `1px solid ${C.glassBr}`,
            background: C.glass, color: "#fff", outline: "none", fontFamily: "inherit"
          }} />
      </GlassPanel>
      <GlassButton onClick={handleGo} color={C.nGreen} style={{ padding: "14px 40px", fontSize: 16 }}>
        Let's Go
      </GlassButton>
    </div>
  );
}

function FinalVerdict({ stats, onRestart, onLeaderboard, onShare }) {
  const { sendTransaction, data: hash, error, isPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const archetype = useMemo(() => {
    const { correctCount, avgTime, godModeAchieved } = stats;
    const acc = (correctCount / ROUNDS) * 100;

    if (godModeAchieved) return {
      title: "⚡ GOD MODE DEGEN ⚡", emoji: "👑", color: C.nGreen,
      roast: "You're literally built different. Every chart is your playground. Probably have a Bloomberg terminal tattooed on your arm. Absolute alpha."
    };
    if (acc === 100) return {
      title: "🔥 FLAWLESS EXECUTION 🔥", emoji: "💎", color: C.nGreen,
      roast: "Perfect score. You didn't just pass the vibe check — you ARE the vibe. Other traders study YOU. Legend."
    };
    if (acc >= 85) return {
      title: "GIGACHAD TRADER", emoji: "💪", color: C.nGreen,
      roast: "Crushing it. Probably wake up at 4am to trade futures. Your risk tolerance is higher than your coffee intake. Respect."
    };
    if (acc >= 70) return {
      title: "SOLID DEGEN", emoji: "📈", color: C.nBlue,
      roast: "Not bad at all. You're making money while others are panic-selling. Still checking Discord alpha channels at 3am though."
    };
    if (acc >= 50) return {
      title: "MID CURVE ENJOYER", emoji: "🤷", color: C.neut,
      roast: "You're… fine. Probably bought at the top once or twice. Maybe stick to index funds? Just kidding. Keep grinding."
    };
    if (acc >= 30) return {
      title: "EXIT LIQUIDITY", emoji: "🎒", color: C.bear,
      roast: "Yikes. You're the person whales dump on. Every 'dip' you buy keeps dipping. Maybe try a different hobby?"
    };
    return {
      title: "CERTIFIED RUG VICTIM", emoji: "💀", color: C.bear,
      roast: "Bro. BRO. How did you even get here? You'd lose money in a bull market. Uninstall TradingView. Touch grass. Seek help."
    };
  }, [stats]);

  useEffect(() => { playSound("verdict"); }, []);

  const sendTip = (amountUSDC) => {
    const amountWei = BigInt(Math.floor(amountUSDC * 1e6));
    const data = `0xa9059cbb000000000000000000000000${DONATION_ADDRESS.slice(2)}${amountWei.toString(16).padStart(64, "0")}`;
    sendTransaction({ to: USDC_CONTRACT, data });
  };

  return (
    <GlassPanel style={{ padding: 24, maxWidth: 420, margin: "0 auto", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{archetype.emoji}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: archetype.color, marginBottom: 8, fontFamily: "'SF Mono','Fira Code',monospace" }}>
        {archetype.title}
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.5, marginBottom: 20, fontStyle: "italic" }}>
        "{archetype.roast}"
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16, fontSize: 13 }}>
        <div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 2 }}>SCORE</div>
          <div style={{ fontWeight: 800, fontSize: 18, fontFamily: "monospace", color: C.nGreen }}>
            {stats.totalScore.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 2 }}>ACCURACY</div>
          <div style={{ fontWeight: 800, fontSize: 18, fontFamily: "monospace", color: C.nBlue }}>
            {((stats.correctCount / ROUNDS) * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 2 }}>AVG TIME</div>
          <div style={{ fontWeight: 700, fontSize: 16, fontFamily: "monospace", color: "rgba(255,255,255,0.8)" }}>
            {stats.avgTime.toFixed(1)}s
          </div>
        </div>
        <div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 2 }}>MAX STREAK</div>
          <div style={{ fontWeight: 700, fontSize: 16, fontFamily: "monospace", color: C.nPurple }}>
            {stats.maxStreak}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
          Enjoyed the app? Drop a tip in USDC on Base 🙏
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {[0.5, 1, 5].map(amt => (
            <GlassButton key={amt} onClick={() => sendTip(amt)} disabled={isPending || isConfirming}
              color={C.nGreen} style={{ padding: "8px 16px", fontSize: 13 }}>
              ${amt}
            </GlassButton>
          ))}
        </div>
        {isPending && <div style={{ fontSize: 11, color: C.nAmber, marginTop: 6 }}>Confirm in wallet...</div>}
        {isConfirming && <div style={{ fontSize: 11, color: C.nBlue, marginTop: 6 }}>Processing...</div>}
        {isSuccess && <div style={{ fontSize: 11, color: C.nGreen, marginTop: 6 }}>✅ Tip sent! Thank you!</div>}
        {error && <div style={{ fontSize: 10, color: C.bear, marginTop: 6 }}>Error: {error.message}</div>}
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <GlassButton onClick={onRestart} color={C.nGreen} style={{ padding: "12px 24px", fontSize: 14 }}>
          🔁 Play Again
        </GlassButton>
        <GlassButton onClick={onLeaderboard} color={C.nBlue} style={{ padding: "12px 24px", fontSize: 14 }}>
          🏆 Leaderboard
        </GlassButton>
      </div>
      <GlassButton onClick={onShare} color={C.nPurple} style={{ padding: "10px 20px", fontSize: 13, marginTop: 10 }}>
        📤 Share Results
      </GlassButton>
    </GlassPanel>
  );
}

function Leaderboard({ onClose, currentName }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("reflexLeaders") || "[]";
      const arr = JSON.parse(raw);
      const sorted = arr.sort((a, b) => b.score - a.score).slice(0, 10);
      setEntries(sorted);
    } catch (_) {}
  }, []);

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 16 }}>
      <GlassPanel style={{ padding: 20 }}>
        <div style={{
          fontSize: 24, fontWeight: 900, fontFamily: "'SF Mono','Fira Code',monospace", textAlign: "center",
          background: `linear-gradient(135deg, ${C.nGreen} 0%, ${C.nBlue} 100%)`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 16
        }}>
          🏆 LEADERBOARD
        </div>
        {entries.length === 0 ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13, padding: 20 }}>
            No entries yet. Be the first!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {entries.map((e, i) => (
              <div key={i} style={{
                background: e.name === currentName ? `${C.nGreen}12` : C.glass, backdropFilter: "blur(8px)",
                border: `1px solid ${e.name === currentName ? C.nGreen + "35" : C.glassBr}`,
                borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center"
              }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", background: i < 3 ? C.nGreen + "25" : C.glass,
                    border: `1px solid ${i < 3 ? C.nGreen + "45" : C.glassBr}`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800,
                    color: i < 3 ? C.nGreen : "rgba(255,255,255,0.6)"
                  }}>
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                      {e.name}
                      {e.name === currentName && <span style={{ fontSize: 10, color: C.nGreen, marginLeft: 6 }}>(You)</span>}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                      {e.acc.toFixed(0)}% · {e.time.toFixed(1)}s avg
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, fontFamily: "monospace", color: C.nGreen }}>
                  {e.score.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
        <GlassButton onClick={onClose} color={C.nBlue} style={{ marginTop: 16, width: "100%", padding: "12px", fontSize: 14 }}>
          Close
        </GlassButton>
      </GlassPanel>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("name");
  const [playerName, setPlayerName] = useState("");

  const [round, setRound] = useState(0);
  const [pattern, setPattern] = useState(null);
  const [choice, setChoice] = useState(null);
  const [timeLeft, setTimeLeft] = useState(DECISION_MS);

  const [scores, setScores] = useState([]);
  const [roundStats, setRoundStats] = useState([]);
  const [streak, setStreak] = useState(0);
  const [godMode, setGodMode] = useState(false);

  const [particleBurst, setParticleBurst] = useState(false);
  const [screenPulse, setScreenPulse] = useState(false);

  const chartRef = useRef(null);
  const chartEngine = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (chartRef.current && !chartEngine.current) {
      chartEngine.current = new CanvasChart(chartRef.current);
      chartEngine.current.resize();
      const handleResize = () => chartEngine.current?.resize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, [chartRef]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("reflexName");
      if (stored) { setPlayerName(stored); setScreen("home"); }
    } catch (_) {}
  }, []);

  const startGame = useCallback(() => {
    playSound("click");
    haptic([30]);
    setRound(0);
    setScores([]);
    setRoundStats([]);
    setStreak(0);
    setGodMode(false);
    setChoice(null);
    setPattern(null);
    setScreen("countdown");
  }, []);

  const beginRound = useCallback(() => {
    const gen = ALL_PATTERNS[RI(0, ALL_PATTERNS.length - 1)]();
    setPattern(gen);
    setChoice(null);
    setTimeLeft(DECISION_MS);
    setScreen("playing");

    if (chartEngine.current) {
      chartEngine.current.setData(gen.candles, gen.continuation, false);
      chartEngine.current.start(2000);
    }

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        const next = t - 100;
        if (next <= 1000 && next > 0) setScreenPulse(true);
        if (next <= 0) {
          clearInterval(timerRef.current);
          handleChoice(null);
          return 0;
        }
        return next;
      });
    }, 100);
  }, []);

  const handleChoice = useCallback((sig) => {
    if (choice !== null) return;
    playSound("click");
    haptic([30]);
    setChoice(sig);

    if (timerRef.current) clearInterval(timerRef.current);
    setScreenPulse(false);

    const correct = sig === pattern.signal;
    const timeSpent = DECISION_MS - timeLeft;
    const timeBonusMult = Math.max(1 - (timeSpent / DECISION_MS) * 0.3, 0.7);

    let pts = BASE_SCORE;
    if (correct) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      const streakMult = STREAK_MULT[Math.min(newStreak, STREAK_MULT.length - 1)];
      pts = Math.round(BASE_SCORE * streakMult * timeBonusMult);

      if (newStreak >= 7) {
        setGodMode(true);
        playSound("godBurst");
        haptic([50, 100, 50]);
      } else {
        playSound("good");
        haptic([40]);
      }
      setParticleBurst(true);
      setTimeout(() => setParticleBurst(false), 600);
    } else {
      setStreak(0);
      setGodMode(false);
      pts = 0;
      playSound("bad");
      haptic([80, 50, 80]);
    }

    setScores(s => [...s, pts]);
    setRoundStats(rs => [...rs, { correct, time: timeSpent / 1000 }]);

    setScreen("outcome");

    if (chartEngine.current) {
      chartEngine.current.setData(pattern.candles, pattern.continuation, true);
      chartEngine.current.start(1500);
    }
  }, [choice, pattern, timeLeft, streak]);

  const advanceRound = useCallback(() => {
    playSound("click");
    haptic([30]);
    
    if (round + 1 >= ROUNDS) {
      setScreen("verdict");
    } else {
      setRound(r => r + 1);
      beginRound();
    }
  }, [round, beginRound]);

  const computeStats = useCallback(() => {
    const totalScore = scores.reduce((a, b) => a + b, 0);
    const correctCount = roundStats.filter(r => r.correct).length;
    const avgTime = roundStats.length > 0 ? roundStats.reduce((a, r) => a + r.time, 0) / roundStats.length : 0;
    const maxStreak = Math.max(...roundStats.map((_, i) => {
      let s = 0;
      for (let j = i; j < roundStats.length; j++) {
        if (roundStats[j].correct) s++; else break;
      }
      return s;
    }), 0);
    const godModeAchieved = godMode || maxStreak >= 7;
    return { totalScore, correctCount, avgTime, maxStreak, godModeAchieved };
  }, [scores, roundStats, godMode]);

  useEffect(() => {
    if (screen === "verdict" && playerName) {
      try {
        const stats = computeStats();
        const raw = localStorage.getItem("reflexLeaders") || "[]";
        const arr = JSON.parse(raw);
        arr.push({
          name: playerName,
          score: stats.totalScore,
          acc: (stats.correctCount / ROUNDS) * 100,
          time: stats.avgTime,
          date: Date.now()
        });
        localStorage.setItem("reflexLeaders", JSON.stringify(arr));
      } catch (_) {}
    }
  }, [screen, playerName, computeStats]);

  const triggerShare = (stats) => {
    const text = `I scored ${stats.totalScore.toLocaleString()} on REFLEX GLASS! ${stats.correctCount}/${ROUNDS} correct, ${stats.avgTime.toFixed(1)}s avg. Can you beat me?`;
    if (navigator.share) {
      navigator.share({ title: "REFLEX GLASS", text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text);
      alert("Results copied to clipboard!");
    }
  };

  useEffect(() => {
    const tag = document.createElement("style");
    tag.innerHTML = `
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

  const renderHome = () => (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100%", gap:24, padding:24 }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48, fontWeight:900, fontFamily:"'SF Mono','Fira Code',monospace", letterSpacing:"-1px",
          background:`linear-gradient(135deg, ${C.nGreen} 0%, ${C.nPurple} 50%, ${C.nPink} 100%)`,
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          filter:"drop-shadow(0 0 24px rgba(0,255,170,0.3))" }}>
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

      <GlassPanel style={{ padding:20, maxWidth:340, width:"100%", textAlign:"center" }}>
        <div style={{ display:"flex", justifyContent:"center", gap:20 }}>
          {[
            { icon:"📊", label:"40+", sub:"Patterns" },
            { icon:"⚡", label:"4s",  sub:"Decision" },
            { icon:"🔥", label:"×4",  sub:"Max Streak" },
          ].map(item => (
            <div key={item.label} style={{ flex:1, textAlign:"center" }}>
              <div style={{ fontSize:20 }}>{item.icon}</div>
              <div style={{ fontSize:16, fontWeight:800, fontFamily:"monospace", color:C.nGreen }}>{item.label}</div>
              <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.06em" }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </GlassPanel>

      <GlassButton onClick={startGame} color={C.nGreen} style={{ padding:"18px 56px", fontSize:18, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
          backgroundSize:"200% 100%", animation:"shimmer 2.2s linear infinite", pointerEvents:"none" }} />
        Start Trading
      </GlassButton>

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

      <TimerBar timeLeft={timeLeft} totalTime={DECISION_MS} />

      <div style={{ flex:1, minHeight:0, position:"relative" }}>
        <canvas ref={chartRef} style={{ width:"100%", height:"100%", borderRadius:20, display:"block" }} />
        {screen === "outcome" && pattern && (
          <div style={{ position:"absolute", top:12, right:14, fontSize:10, fontFamily:"monospace",
            color:"rgba(255,255,255,0.18)", background:"rgba(6,6,12,0.6)", padding:"3px 8px", borderRadius:8,
            backdropFilter:"blur(8px)" }}>
            {pattern.name}
          </div>
        )}
      </div>

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
    <div style={{ display:"flex", flexDirection:"column", height:"100%", justifyContent:"center", padding:16 }}>
      <FinalVerdict
        stats={computeStats()}
        onRestart={startGame}
        onLeaderboard={()=>setScreen("leaderboard")}
        onShare={()=>triggerShare(computeStats())}
      />
    </div>
  );

  return (
    <div style={{ width:"100vw", height:"100dvh", overflowY:"auto", overflowX:"hidden",
      background:`radial-gradient(ellipse at 30% 20%, #0f1a2e 0%, ${C.bg1} 55%, ${C.bg2} 100%)`,
      position:"relative" }}>

      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", top:"10%",  left:"15%", width:220, height:220, borderRadius:"50%", background:`radial-gradient(circle, ${C.nGreen}0a 0%, transparent 70%)`, filter:"blur(40px)" }} />
        <div style={{ position:"absolute", top:"60%", right:"10%", width:180, height:180, borderRadius:"50%", background:`radial-gradient(circle, ${C.nPurple}0d 0%, transparent 70%)`, filter:"blur(36px)" }} />
        <div style={{ position:"absolute", bottom:"15%", left:"40%", width:140, height:140, borderRadius:"50%", background:`radial-gradient(circle, ${C.nPink}09 0%, transparent 70%)`, filter:"blur(30px)" }} />
      </div>

      <LiveTicker />

      <ParticleCanvas active={particleBurst} godMode={godMode} />

      {screenPulse && (
        <div style={{ position:"fixed", inset:0, zIndex:198, pointerEvents:"none",
          boxShadow:`inset 0 0 60px ${C.nPink}55`, transition:"opacity 0.15s" }} />
      )}

      <div style={{ position:"relative", zIndex:1, paddingTop:34, minHeight:"calc(100dvh - 34px)", display:"flex", flexDirection:"column" }}>
        {screen === "name"        && <NameInput onSubmit={n=>{ setPlayerName(n); setScreen("home"); }} />}
        {screen === "home"        && renderHome()}
        {screen === "countdown"   && <Countdown onDone={beginRound} />}
        {(screen==="playing" || screen==="outcome") && renderPlaying()}
        {screen === "verdict"     && renderVerdict()}
        {screen === "leaderboard" && (
          <div style={{ paddingTop:20 }}>
            <Leaderboard onClose={()=>setScreen(round>=ROUNDS?"verdict":"home")} currentName={playerName} />
          </div>
        )}
      </div>
    </div>
  );
}
