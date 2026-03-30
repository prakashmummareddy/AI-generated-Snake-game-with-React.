import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, RefreshCw } from 'lucide-react';

// --- Constants ---
const GRID_SIZE = 30;
const CELL_SIZE = 20;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;
const INITIAL_SNAKE = [{ x: 15, y: 15 }, { x: 15, y: 16 }, { x: 15, y: 17 }];
const INITIAL_DIRECTION = { x: 0, y: -1 };
const MOVE_INTERVAL = 100; // ms per move

const TRACKS = [
  {
    id: 1,
    title: 'Neon Drive (AI Generated)',
    artist: 'Cyber Synth',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    id: 2,
    title: 'Digital Dreams (AI Generated)',
    artist: 'Neural Network',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    id: 3,
    title: 'Cyber City (AI Generated)',
    artist: 'Algorithm Audio',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
];

// --- Types ---
type Point = { x: number; y: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number };

export default function App() {
  // --- React State for HUD ---
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'paused' | 'gameover'>('start');
  
  // --- Music Player State ---
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Mutable Game State (Refs for rAF) ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snake = useRef<Point[]>([...INITIAL_SNAKE]);
  const direction = useRef<Point>({ ...INITIAL_DIRECTION });
  const nextDirection = useRef<Point>({ ...INITIAL_DIRECTION });
  const food = useRef<Point>({ x: 10, y: 10 });
  const particles = useRef<Particle[]>([]);
  const shake = useRef<number>(0);
  
  // Loop timing
  const lastTime = useRef<number>(0);
  const moveAccumulator = useRef<number>(0);
  const requestRef = useRef<number>(0);

  // --- Game Logic ---
  const spawnFood = useCallback(() => {
    let newFood: Point = { x: 0, y: 0 };
    let valid = false;
    while (!valid) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      valid = !snake.current.some(s => s.x === newFood.x && s.y === newFood.y);
    }
    food.current = newFood;
  }, []);

  const createParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 15; i++) {
      particles.current.push({
        x: x * CELL_SIZE + CELL_SIZE / 2,
        y: y * CELL_SIZE + CELL_SIZE / 2,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0,
        maxLife: Math.random() * 0.5 + 0.5,
        color,
        size: Math.random() * 4 + 2
      });
    }
  };

  const resetGame = useCallback(() => {
    snake.current = [...INITIAL_SNAKE];
    direction.current = { ...INITIAL_DIRECTION };
    nextDirection.current = { ...INITIAL_DIRECTION };
    particles.current = [];
    shake.current = 0;
    setScore(0);
    spawnFood();
    setGameState('playing');
    lastTime.current = performance.now();
    moveAccumulator.current = 0;
  }, [spawnFood]);

  // --- Main Game Loop ---
  const update = useCallback((dt: number) => {
    if (gameState !== 'playing') return;

    moveAccumulator.current += dt;

    // Update particles (runs every frame for smoothness)
    particles.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= dt / 1000;
    });
    particles.current = particles.current.filter(p => p.life > 0);

    // Update snake (runs on fixed interval)
    if (moveAccumulator.current >= MOVE_INTERVAL) {
      moveAccumulator.current -= MOVE_INTERVAL;

      direction.current = nextDirection.current;
      const head = snake.current[0];
      const newHead = {
        x: head.x + direction.current.x,
        y: head.y + direction.current.y,
      };

      // Wall collision
      if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
        setGameState('gameover');
        shake.current = 20; // Big shake on death
        createParticles(head.x, head.y, '#ef4444'); // Red particles
        return;
      }

      // Self collision
      if (snake.current.some(s => s.x === newHead.x && s.y === newHead.y)) {
        setGameState('gameover');
        shake.current = 20;
        createParticles(head.x, head.y, '#ef4444');
        return;
      }

      snake.current.unshift(newHead);

      // Food collision
      if (newHead.x === food.current.x && newHead.y === food.current.y) {
        setScore(s => {
          const newScore = s + 10;
          setHighScore(prev => Math.max(prev, newScore));
          return newScore;
        });
        shake.current = 5; // Small shake on eat
        createParticles(food.current.x, food.current.y, '#d946ef'); // Fuchsia particles
        spawnFood();
      } else {
        snake.current.pop();
      }
    }
  }, [gameState, spawnFood]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.save();

    // Apply Screen Shake
    if (shake.current > 0) {
      const dx = (Math.random() - 0.5) * shake.current;
      const dy = (Math.random() - 0.5) * shake.current;
      ctx.translate(dx, dy);
      shake.current *= 0.9; // Decay
      if (shake.current < 0.5) shake.current = 0;
    }

    // Draw Grid
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL_SIZE, 0); ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL_SIZE); ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE); ctx.stroke();
    }

    // Draw Food
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#d946ef';
    ctx.fillStyle = '#d946ef';
    ctx.fillRect(food.current.x * CELL_SIZE + 2, food.current.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);

    // Draw Particles
    particles.current.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;

    // Draw Snake
    snake.current.forEach((segment, i) => {
      const isHead = i === 0;
      ctx.shadowBlur = isHead ? 20 : 10;
      ctx.shadowColor = isHead ? '#67e8f9' : '#22d3ee';
      ctx.fillStyle = isHead ? '#67e8f9' : 'rgba(34, 211, 238, 0.8)';
      
      // Slightly smaller tail segments
      const shrink = i === snake.current.length - 1 ? 4 : 2;
      ctx.fillRect(segment.x * CELL_SIZE + shrink/2, segment.y * CELL_SIZE + shrink/2, CELL_SIZE - shrink, CELL_SIZE - shrink);
    });

    ctx.restore();
  }, []);

  const gameLoop = useCallback((time: number) => {
    if (!lastTime.current) lastTime.current = time;
    const dt = time - lastTime.current;
    lastTime.current = time;

    update(dt);
    
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) draw(ctx);
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [update, draw]);

  // --- Effects ---
  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameLoop]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === ' ' && gameState !== 'gameover') {
        setGameState(prev => prev === 'playing' ? 'paused' : 'playing');
        if (gameState === 'start') resetGame();
        return;
      }

      if (gameState !== 'playing') return;

      const currentDir = direction.current;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          if (currentDir.y !== 1) nextDirection.current = { x: 0, y: -1 };
          break;
        case 'ArrowDown': case 's': case 'S':
          if (currentDir.y !== -1) nextDirection.current = { x: 0, y: 1 };
          break;
        case 'ArrowLeft': case 'a': case 'A':
          if (currentDir.x !== 1) nextDirection.current = { x: -1, y: 0 };
          break;
        case 'ArrowRight': case 'd': case 'D':
          if (currentDir.x !== -1) nextDirection.current = { x: 1, y: 0 };
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, resetGame]);

  // --- Music Player Logic ---
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch((err) => console.error("Audio play error:", err));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrackIndex]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const playNext = () => { setCurrentTrackIndex((prev) => (prev + 1) % TRACKS.length); setIsPlaying(true); };
  const playPrev = () => { setCurrentTrackIndex((prev) => (prev - 1 + TRACKS.length) % TRACKS.length); setIsPlaying(true); };

  const currentTrack = TRACKS[currentTrackIndex];

  return (
    <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center p-4 overflow-hidden selection:bg-fuchsia-500/30">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-20">
        <div className="w-[800px] h-[800px] bg-fuchsia-600 rounded-full blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute w-[600px] h-[600px] bg-cyan-500 rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '7s' }}></div>
      </div>

      {/* Immersive Game Container - Scales to fit */}
      <div className="relative z-10 w-full max-w-[1200px] aspect-video max-h-[90dvh] flex gap-6">
        
        {/* Left HUD */}
        <div className="hidden md:flex flex-col justify-between w-64 py-4">
          <div className="border border-fuchsia-500/30 bg-black/60 backdrop-blur-md p-6 rounded-xl shadow-[0_0_15px_rgba(217,70,239,0.2)]">
            <h1 className="text-3xl font-bold tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
              NEON<br/>SNAKE
            </h1>
            <p className="text-xs text-fuchsia-300/70 uppercase tracking-widest mb-6">v2.0.0 // SYS.CANVAS</p>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-cyan-400/70 uppercase tracking-wider mb-1">Current Score</p>
                <p className="text-4xl font-digital text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">{score}</p>
              </div>
              <div>
                <p className="text-xs text-fuchsia-400/70 uppercase tracking-wider mb-1">High Score</p>
                <p className="text-2xl font-digital text-fuchsia-300 drop-shadow-[0_0_8px_rgba(217,70,239,0.5)]">{highScore}</p>
              </div>
            </div>
          </div>

          <div className="border border-cyan-500/30 bg-black/60 backdrop-blur-md p-4 rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.1)] text-xs text-cyan-100/60 space-y-2">
            <p className="uppercase tracking-wider text-cyan-400/80 mb-2 border-b border-cyan-500/30 pb-1">Controls</p>
            <p><span className="text-cyan-300 inline-block w-16">WASD</span> Move</p>
            <p><span className="text-cyan-300 inline-block w-16">Arrows</span> Move</p>
            <p><span className="text-cyan-300 inline-block w-16">Space</span> Start/Pause</p>
          </div>
        </div>

        {/* Center Canvas Area */}
        <div className="flex-1 relative flex items-center justify-center border border-cyan-500/40 rounded-xl bg-black/80 shadow-[0_0_30px_rgba(34,211,238,0.15)] overflow-hidden">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="w-full h-full object-contain max-w-full max-h-full"
            style={{ imageRendering: 'pixelated' }}
          />

          {/* Overlays */}
          {gameState === 'start' && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
              <h2 className="text-4xl font-digital text-cyan-400 mb-6 tracking-widest drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse">PRESS SPACE TO START</h2>
            </div>
          )}

          {gameState === 'paused' && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
              <h2 className="text-4xl font-digital text-cyan-400 tracking-widest drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse">PAUSED</h2>
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-20">
              <h2 className="text-5xl font-bold text-red-500 mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">SYSTEM FAILURE</h2>
              <p 
                className="text-4xl font-digital text-cyan-300 mb-8 glitch-effect tracking-widest uppercase drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                data-text={`FINAL SCORE: ${score}`}
              >
                FINAL SCORE: {score}
              </p>
              <button 
                onClick={resetGame}
                className="flex items-center gap-2 px-8 py-4 bg-transparent border-2 border-cyan-500 text-cyan-400 hover:bg-cyan-500/20 hover:shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-all rounded uppercase tracking-widest text-sm cursor-pointer"
              >
                <RefreshCw size={18} /> Reboot System
              </button>
            </div>
          )}
        </div>

        {/* Right HUD: Music Player */}
        <div className="hidden md:flex flex-col w-64 py-4">
          <div className="border border-purple-500/30 bg-black/60 backdrop-blur-md p-5 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.2)] flex flex-col h-full">
            <div className="flex items-center justify-between mb-6 border-b border-purple-500/30 pb-3">
              <h2 className="text-sm font-bold text-purple-300 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                Audio Stream
              </h2>
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>

            {/* Now Playing Info */}
            <div className="flex-1 flex flex-col justify-center mb-6">
              <div className="relative w-full aspect-square max-w-[160px] mx-auto mb-4 rounded-lg overflow-hidden border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.15)] group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 to-black z-10"></div>
                {/* Visualizer bars simulation */}
                <div className="absolute inset-0 flex items-end justify-center gap-1 p-4 z-20 opacity-80">
                  {[...Array(8)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-2 bg-purple-400 rounded-t-sm ${isPlaying ? 'animate-pulse' : ''}`}
                      style={{ 
                        height: isPlaying ? `${Math.random() * 60 + 20}%` : '10%',
                        transition: 'height 0.2s ease',
                        animationDuration: `${Math.random() * 0.5 + 0.5}s`
                      }}
                    ></div>
                  ))}
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-purple-200 truncate drop-shadow-[0_0_5px_rgba(216,180,254,0.5)]">{currentTrack.title}</h3>
                <p className="text-xs text-purple-400/70 uppercase tracking-wider mt-1">{currentTrack.artist}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 mt-auto">
              <button 
                onClick={playPrev}
                className="p-2 text-purple-400 hover:text-purple-200 hover:bg-purple-500/20 rounded-full transition-all cursor-pointer"
              >
                <SkipBack size={20} />
              </button>
              <button 
                onClick={togglePlay}
                className="p-4 bg-purple-500/20 border border-purple-500/50 text-purple-300 hover:bg-purple-500/40 hover:shadow-[0_0_15px_rgba(168,85,247,0.6)] rounded-full transition-all cursor-pointer flex items-center justify-center"
              >
                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
              </button>
              <button 
                onClick={playNext}
                className="p-2 text-purple-400 hover:text-purple-200 hover:bg-purple-500/20 rounded-full transition-all cursor-pointer"
              >
                <SkipForward size={20} />
              </button>
            </div>

            {/* Hidden Audio Element */}
            <audio 
              ref={audioRef} 
              src={currentTrack.url} 
              onEnded={playNext}
              preload="auto"
            />
          </div>
        </div>

      </div>
      
      {/* Mobile HUD (Visible only on small screens) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-black/90 border-t border-cyan-500/30 backdrop-blur-md flex justify-between items-center z-50">
         <div className="flex flex-col">
            <span className="text-xs text-cyan-500 uppercase">Score</span>
            <span className="text-xl font-digital text-cyan-300">{score}</span>
         </div>
         <div className="flex gap-4">
            <button onClick={togglePlay} className="p-3 bg-purple-500/20 rounded-full text-purple-300">
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button onClick={() => setGameState(prev => prev === 'playing' ? 'paused' : 'playing')} className="p-3 bg-cyan-500/20 rounded-full text-cyan-300">
              {gameState === 'playing' ? <Pause size={20} /> : <Play size={20} />}
            </button>
         </div>
      </div>
    </div>
  );
}
