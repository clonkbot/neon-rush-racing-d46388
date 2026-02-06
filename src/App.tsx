import { Suspense, useState, useRef, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Text, Float, useTexture, Environment } from '@react-three/drei'
import * as THREE from 'three'

// Game state management
interface GameState {
  speed: number
  score: number
  lane: number
  gameOver: boolean
  started: boolean
  highScore: number
}

// Neon material helper
function NeonMaterial({ color, intensity = 2 }: { color: string; intensity?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={intensity}
      metalness={0.9}
      roughness={0.1}
    />
  )
}

// Synthwave grid floor
function SynthwaveGrid({ speed }: { speed: number }) {
  const gridRef = useRef<THREE.Mesh>(null!)
  const offsetRef = useRef(0)

  useFrame((_, delta) => {
    offsetRef.current += delta * speed * 0.5
    if (gridRef.current) {
      gridRef.current.position.z = (offsetRef.current % 10)
    }
  })

  return (
    <group>
      {/* Main ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[50, 200]} />
        <meshStandardMaterial color="#0a0015" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Grid lines */}
      <mesh ref={gridRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.49, 0]}>
        <planeGeometry args={[50, 200, 50, 200]} />
        <meshBasicMaterial color="#ff00ff" wireframe transparent opacity={0.15} />
      </mesh>

      {/* Road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]}>
        <planeGeometry args={[12, 200]} />
        <meshStandardMaterial color="#1a0030" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Lane dividers */}
      {[-2, 2].map((x, i) => (
        <RoadStripes key={i} x={x} speed={speed} />
      ))}

      {/* Road edge glow */}
      {[-6, 6].map((x, i) => (
        <mesh key={i} position={[x, -0.4, 0]}>
          <boxGeometry args={[0.1, 0.1, 200]} />
          <NeonMaterial color="#00ffff" intensity={3} />
        </mesh>
      ))}
    </group>
  )
}

function RoadStripes({ x, speed }: { x: number; speed: number }) {
  const stripesRef = useRef<THREE.Group>(null!)
  const offsetRef = useRef(0)

  useFrame((_, delta) => {
    offsetRef.current += delta * speed
    if (stripesRef.current) {
      stripesRef.current.children.forEach((stripe, i) => {
        stripe.position.z = ((i * 4 + offsetRef.current) % 80) - 40
      })
    }
  })

  return (
    <group ref={stripesRef}>
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh key={i} position={[x, -0.45, i * 4 - 40]}>
          <boxGeometry args={[0.15, 0.05, 2]} />
          <NeonMaterial color="#ff00ff" intensity={1.5} />
        </mesh>
      ))}
    </group>
  )
}

// Player car
function PlayerCar({ lane, onCollision }: { lane: number; onCollision: () => void }) {
  const carRef = useRef<THREE.Group>(null!)
  const targetX = useRef(lane * 4)

  useEffect(() => {
    targetX.current = lane * 4
  }, [lane])

  useFrame((_, delta) => {
    if (carRef.current) {
      carRef.current.position.x = THREE.MathUtils.lerp(
        carRef.current.position.x,
        targetX.current,
        delta * 10
      )
      // Slight wobble
      carRef.current.rotation.z = Math.sin(Date.now() * 0.01) * 0.02
    }
  })

  return (
    <group ref={carRef} position={[lane * 4, 0, 0]}>
      {/* Car body */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[1.6, 0.5, 3]} />
        <meshStandardMaterial color="#ff0066" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Car top */}
      <mesh position={[0, 0.65, -0.2]}>
        <boxGeometry args={[1.4, 0.4, 1.5]} />
        <meshStandardMaterial color="#ff0066" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Windshield */}
      <mesh position={[0, 0.65, 0.5]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[1.3, 0.35, 0.1]} />
        <meshStandardMaterial color="#00ffff" transparent opacity={0.7} metalness={1} roughness={0} />
      </mesh>

      {/* Headlights */}
      {[-0.5, 0.5].map((x, i) => (
        <mesh key={i} position={[x, 0.25, 1.51]}>
          <boxGeometry args={[0.3, 0.15, 0.05]} />
          <NeonMaterial color="#ffffff" intensity={5} />
        </mesh>
      ))}

      {/* Tail lights */}
      {[-0.6, 0.6].map((x, i) => (
        <mesh key={i} position={[x, 0.3, -1.51]}>
          <boxGeometry args={[0.25, 0.1, 0.05]} />
          <NeonMaterial color="#ff0000" intensity={4} />
        </mesh>
      ))}

      {/* Wheels */}
      {[
        [-0.8, 0.15, 1],
        [0.8, 0.15, 1],
        [-0.8, 0.15, -1],
        [0.8, 0.15, -1],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.25, 0.25, 0.2, 16]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}

      {/* Neon underglow */}
      <pointLight color="#ff00ff" intensity={2} distance={5} position={[0, -0.2, 0]} />
    </group>
  )
}

// Traffic cars
interface TrafficCar {
  id: number
  lane: number
  z: number
  color: string
}

function TrafficCars({
  cars,
  playerLane,
  speed,
  onCollision
}: {
  cars: TrafficCar[]
  playerLane: number
  speed: number
  onCollision: () => void
}) {
  return (
    <group>
      {cars.map(car => (
        <TrafficCarMesh
          key={car.id}
          car={car}
          playerLane={playerLane}
          speed={speed}
          onCollision={onCollision}
        />
      ))}
    </group>
  )
}

function TrafficCarMesh({
  car,
  playerLane,
  speed,
  onCollision
}: {
  car: TrafficCar
  playerLane: number
  speed: number
  onCollision: () => void
}) {
  const meshRef = useRef<THREE.Group>(null!)
  const hasCollided = useRef(false)

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.position.z += delta * (speed * 0.3)

      // Check collision
      if (!hasCollided.current &&
          car.lane === playerLane &&
          meshRef.current.position.z > -3 &&
          meshRef.current.position.z < 3) {
        hasCollided.current = true
        onCollision()
      }
    }
  })

  return (
    <group ref={meshRef} position={[car.lane * 4, 0, car.z]}>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[1.4, 0.5, 2.5]} />
        <meshStandardMaterial color={car.color} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.6, -0.1]}>
        <boxGeometry args={[1.2, 0.35, 1.2]} />
        <meshStandardMaterial color={car.color} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Tail lights */}
      {[-0.5, 0.5].map((x, i) => (
        <mesh key={i} position={[x, 0.3, 1.26]}>
          <boxGeometry args={[0.2, 0.1, 0.05]} />
          <NeonMaterial color="#ff3333" intensity={3} />
        </mesh>
      ))}
    </group>
  )
}

// Mountains/buildings in background
function CityScape() {
  return (
    <group position={[0, 0, -50]}>
      {/* Left side buildings */}
      {Array.from({ length: 15 }).map((_, i) => {
        const height = 5 + Math.random() * 20
        return (
          <mesh key={`l${i}`} position={[-25 - Math.random() * 20, height / 2 - 0.5, -i * 15]}>
            <boxGeometry args={[3 + Math.random() * 5, height, 3 + Math.random() * 5]} />
            <meshStandardMaterial
              color="#0a0020"
              emissive="#1a0040"
              emissiveIntensity={0.3}
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
        )
      })}
      {/* Right side buildings */}
      {Array.from({ length: 15 }).map((_, i) => {
        const height = 5 + Math.random() * 20
        return (
          <mesh key={`r${i}`} position={[25 + Math.random() * 20, height / 2 - 0.5, -i * 15]}>
            <boxGeometry args={[3 + Math.random() * 5, height, 3 + Math.random() * 5]} />
            <meshStandardMaterial
              color="#0a0020"
              emissive="#1a0040"
              emissiveIntensity={0.3}
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
        )
      })}
    </group>
  )
}

// Synthwave sun
function SynthwaveSun() {
  return (
    <group position={[0, 15, -80]}>
      {/* Main sun */}
      <mesh>
        <circleGeometry args={[20, 64]} />
        <meshBasicMaterial color="#ff6600" />
      </mesh>
      {/* Sun stripes (cutout effect simulated with overlays) */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[0, -3 - i * 2.2, 0.1]}>
          <planeGeometry args={[50, 1.5]} />
          <meshBasicMaterial color="#0f0018" />
        </mesh>
      ))}
      {/* Glow */}
      <pointLight color="#ff6600" intensity={50} distance={200} />
    </group>
  )
}

// Main game scene
function GameScene({ gameState, setGameState }: {
  gameState: GameState
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
}) {
  const [trafficCars, setTrafficCars] = useState<TrafficCar[]>([])
  const carIdRef = useRef(0)
  const { camera } = useThree()

  const trafficColors = ['#00ffff', '#ffff00', '#00ff00', '#ff8800', '#8800ff']

  // Spawn traffic
  useFrame((_, delta) => {
    if (!gameState.started || gameState.gameOver) return

    // Update score
    setGameState(prev => ({
      ...prev,
      score: prev.score + delta * prev.speed,
      speed: Math.min(prev.speed + delta * 0.5, 80)
    }))

    // Spawn new traffic
    if (Math.random() < delta * (0.5 + gameState.speed * 0.02)) {
      const newCar: TrafficCar = {
        id: carIdRef.current++,
        lane: Math.floor(Math.random() * 3) - 1,
        z: -60 - Math.random() * 20,
        color: trafficColors[Math.floor(Math.random() * trafficColors.length)]
      }
      setTrafficCars(prev => [...prev, newCar])
    }

    // Remove cars that passed
    setTrafficCars(prev => prev.filter(car => car.z < 20))
  })

  // Move traffic
  useFrame((_, delta) => {
    if (!gameState.started || gameState.gameOver) return
    setTrafficCars(prev => prev.map(car => ({
      ...car,
      z: car.z + delta * gameState.speed * 0.8
    })))
  })

  const handleCollision = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      gameOver: true,
      highScore: Math.max(prev.highScore, Math.floor(prev.score))
    }))
  }, [setGameState])

  // Camera setup
  useEffect(() => {
    camera.position.set(0, 5, 10)
    camera.lookAt(0, 0, -10)
  }, [camera])

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.2} />
      <directionalLight position={[5, 10, 5]} intensity={0.5} color="#ff66aa" />
      <pointLight position={[0, 20, -30]} intensity={1} color="#ff6600" distance={100} />

      {/* Stars */}
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

      {/* Synthwave elements */}
      <SynthwaveSun />
      <CityScape />
      <SynthwaveGrid speed={gameState.started && !gameState.gameOver ? gameState.speed : 0} />

      {/* Player */}
      <PlayerCar lane={gameState.lane} onCollision={handleCollision} />

      {/* Traffic */}
      <TrafficCars
        cars={trafficCars}
        playerLane={gameState.lane}
        speed={gameState.speed}
        onCollision={handleCollision}
      />

      {/* Fog for depth */}
      <fog attach="fog" args={['#0f0018', 30, 100]} />
    </>
  )
}

// Game UI Component
function GameUI({ gameState, setGameState, onStart, onRestart }: {
  gameState: GameState
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
  onStart: () => void
  onRestart: () => void
}) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* HUD */}
      {gameState.started && !gameState.gameOver && (
        <div className="absolute top-4 left-0 right-0 flex justify-between px-4 md:px-8">
          <div className="bg-black/60 backdrop-blur-sm border border-cyan-500/50 px-4 py-2 md:px-6 md:py-3 rounded-lg">
            <div className="text-cyan-400 text-xs md:text-sm font-rajdhani uppercase tracking-wider">Score</div>
            <div className="text-white text-xl md:text-3xl font-orbitron font-bold">{Math.floor(gameState.score)}</div>
          </div>
          <div className="bg-black/60 backdrop-blur-sm border border-pink-500/50 px-4 py-2 md:px-6 md:py-3 rounded-lg">
            <div className="text-pink-400 text-xs md:text-sm font-rajdhani uppercase tracking-wider">Speed</div>
            <div className="text-white text-xl md:text-3xl font-orbitron font-bold">{Math.floor(gameState.speed)} mph</div>
          </div>
        </div>
      )}

      {/* Start Screen */}
      {!gameState.started && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-transparent via-black/50 to-black/80 pointer-events-auto">
          <div className="text-center px-4">
            <h1 className="text-4xl md:text-7xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 mb-2 animate-pulse">
              NEON RUSH
            </h1>
            <p className="text-pink-300 text-lg md:text-xl font-rajdhani mb-8">Outrun the night</p>

            <button
              onClick={onStart}
              className="group relative px-8 md:px-12 py-4 md:py-5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg font-orbitron text-lg md:text-xl text-white uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(255,0,255,0.5)] active:scale-95"
            >
              <span className="relative z-10">Start Race</span>
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-pink-400 rounded-lg opacity-0 group-hover:opacity-100 blur-xl transition-opacity" />
            </button>

            <div className="mt-8 text-cyan-300/70 font-rajdhani text-sm md:text-base">
              <p className="mb-2">Controls:</p>
              <p>← → Arrow Keys or A/D to steer</p>
              <p className="mt-1 text-pink-300/70">Swipe left/right on mobile</p>
            </div>

            {gameState.highScore > 0 && (
              <div className="mt-6 text-yellow-400 font-orbitron">
                High Score: {gameState.highScore}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState.gameOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
          <div className="text-center px-4">
            <h2 className="text-3xl md:text-5xl font-orbitron font-bold text-red-500 mb-4 animate-pulse">
              CRASHED!
            </h2>
            <div className="text-xl md:text-2xl text-cyan-400 font-rajdhani mb-2">Final Score</div>
            <div className="text-4xl md:text-6xl font-orbitron font-bold text-white mb-4">
              {Math.floor(gameState.score)}
            </div>
            {Math.floor(gameState.score) >= gameState.highScore && (
              <div className="text-yellow-400 font-orbitron text-lg md:text-xl mb-4 animate-bounce">
                🏆 NEW HIGH SCORE! 🏆
              </div>
            )}
            <button
              onClick={onRestart}
              className="px-8 md:px-10 py-3 md:py-4 bg-gradient-to-r from-cyan-600 to-purple-600 rounded-lg font-orbitron text-base md:text-lg text-white uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(0,255,255,0.5)] active:scale-95"
            >
              Race Again
            </button>
          </div>
        </div>
      )}

      {/* Mobile Controls */}
      {gameState.started && !gameState.gameOver && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-8 md:hidden pointer-events-auto">
          <button
            onTouchStart={() => setGameState(prev => ({ ...prev, lane: Math.max(prev.lane - 1, -1) }))}
            className="w-20 h-20 rounded-full bg-pink-500/30 border-2 border-pink-500 flex items-center justify-center active:bg-pink-500/60 transition-colors"
          >
            <span className="text-3xl text-white">←</span>
          </button>
          <button
            onTouchStart={() => setGameState(prev => ({ ...prev, lane: Math.min(prev.lane + 1, 1) }))}
            className="w-20 h-20 rounded-full bg-cyan-500/30 border-2 border-cyan-500 flex items-center justify-center active:bg-cyan-500/60 transition-colors"
          >
            <span className="text-3xl text-white">→</span>
          </button>
        </div>
      )}
    </div>
  )
}

// Main App
export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    speed: 20,
    score: 0,
    lane: 0,
    gameOver: false,
    started: false,
    highScore: 0
  })

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameState.started || gameState.gameOver) return

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setGameState(prev => ({ ...prev, lane: Math.max(prev.lane - 1, -1) }))
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setGameState(prev => ({ ...prev, lane: Math.min(prev.lane + 1, 1) }))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameState.started, gameState.gameOver])

  // Touch/swipe controls
  useEffect(() => {
    let touchStartX = 0

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!gameState.started || gameState.gameOver) return

      const touchEndX = e.changedTouches[0].clientX
      const diff = touchEndX - touchStartX

      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          setGameState(prev => ({ ...prev, lane: Math.min(prev.lane + 1, 1) }))
        } else {
          setGameState(prev => ({ ...prev, lane: Math.max(prev.lane - 1, -1) }))
        }
      }
    }

    window.addEventListener('touchstart', handleTouchStart)
    window.addEventListener('touchend', handleTouchEnd)
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [gameState.started, gameState.gameOver])

  const handleStart = () => {
    setGameState(prev => ({
      ...prev,
      started: true,
      speed: 20,
      score: 0,
      lane: 0,
      gameOver: false
    }))
  }

  const handleRestart = () => {
    setGameState(prev => ({
      ...prev,
      started: true,
      speed: 20,
      score: 0,
      lane: 0,
      gameOver: false
    }))
  }

  return (
    <div className="w-screen h-screen bg-[#0f0018] overflow-hidden relative">
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 255, 0.3) 2px, rgba(0, 255, 255, 0.3) 4px)'
        }}
      />

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 5, 10], fov: 60 }}
        style={{ background: 'linear-gradient(to bottom, #0f0018 0%, #1a0030 50%, #0f0018 100%)' }}
      >
        <Suspense fallback={null}>
          <GameScene gameState={gameState} setGameState={setGameState} />
        </Suspense>
      </Canvas>

      {/* UI Overlay */}
      <GameUI
        gameState={gameState}
        setGameState={setGameState}
        onStart={handleStart}
        onRestart={handleRestart}
      />

      {/* Footer */}
      <footer className="absolute bottom-3 left-0 right-0 text-center pointer-events-none z-20">
        <p className="text-[10px] md:text-xs text-purple-400/40 font-rajdhani tracking-wide">
          Requested by <span className="text-pink-400/50">@itslowkeyxp</span> · Built by <span className="text-cyan-400/50">@clonkbot</span>
        </p>
      </footer>
    </div>
  )
}
