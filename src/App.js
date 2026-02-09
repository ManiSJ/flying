import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

export default function FarmFlying() {
  const mountRef = useRef(null)
  const [altitude, setAltitude] = useState(1000)
  const [speed] = useState(50)

  useEffect(() => {
    if (!mountRef.current) return

    // ================= SCENE =================
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb)
    scene.fog = new THREE.Fog(0x87ceeb, 200, 900)

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    )

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.shadowMap.enabled = true
    mountRef.current.appendChild(renderer.domElement)

    // ================= LIGHT =================
    scene.add(new THREE.AmbientLight(0xffffff, 0.7))

    const sun = new THREE.DirectionalLight(0xffffff, 1)
    sun.position.set(200, 300, 100)
    sun.castShadow = true
    scene.add(sun)

    // ================= AIRCRAFT =================
    const aircraft = createFlightAvatar('plane'); // options: 'plane', 'bird', 'kite'
    scene.add(aircraft);

    // ================= GROUND =================
    const tileSize = 200
    const tilesPerSide = 4
    const farmTiles = []

    for (let x = -tilesPerSide; x <= tilesPerSide; x++) {
      for (let z = -tilesPerSide; z <= tilesPerSide; z++) {
        const color = new THREE.Color(0x2e8b57)
        color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1)

        const tile = new THREE.Mesh(
          new THREE.PlaneGeometry(tileSize, tileSize),
          new THREE.MeshStandardMaterial({ color })
        )

        tile.rotation.x = -Math.PI / 2
        tile.position.set(x * tileSize, 0, z * tileSize)
        tile.receiveShadow = true
        scene.add(tile)
        farmTiles.push(tile)
      }
    }

    // ================= CATTLE =================
    const cattle = [];
    for (let i = 0; i < 40; i++) {
      cattle.push(createCattle(scene));
    }

    // ================= CLOUDS =================
    // CLOUDS - updated
    const clouds = []
    const cloudCount = 40  // more clouds

    for (let i = 0; i < cloudCount; i++) {
      const cloud = new THREE.Group()
      for (let j = 0; j < 5; j++) {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(Math.random() * 4 + 3, 8, 8),
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9
          })
        )
        puff.position.set(
          Math.random() * 8 - 4,
          Math.random() * 3,
          Math.random() * 8 - 4
        )
        cloud.add(puff)
      }
      cloud.position.set(
        Math.random() * 600 - 300,
        Math.random() * 60 + 40,
        Math.random() * 600 - 300
      )
      cloud.userData = { speedX: Math.random() * 0.1 - 0.05, speedZ: Math.random() * 0.1 - 0.05 } // drift
      scene.add(cloud)
      clouds.push(cloud)
    }

    // ================= CONTROLS =================
    const keys = {}

    const handleKeyDown = e => {
      if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        keys[e.key] = true
      }
    }

    const handleKeyUp = e => {
      if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        keys[e.key] = false
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // ================= FLIGHT STATE =================
    let heading = 0
    let altitudeFt = 1000
    let bank = 0
    const position = new THREE.Vector3(0, altitudeFt / 300, 0)

    // ================= ANIMATE =================
    const animate = () => {
      requestAnimationFrame(animate)

      // TURN (FIXED DIRECTION)
      if (keys.ArrowLeft) heading -= 0.04
      if (keys.ArrowRight) heading += 0.04

      // BANK
      let targetBank = 0
      if (keys.ArrowLeft) targetBank = 0.5
      if (keys.ArrowRight) targetBank = -0.5
      bank += (targetBank - bank) * 0.1

      // ALTITUDE
      if (keys.ArrowUp) altitudeFt = Math.min(altitudeFt + 25, 2000)
      if (keys.ArrowDown) altitudeFt = Math.max(altitudeFt - 25, 2)

      // FORWARD MOTION
      position.x += Math.sin(heading) * speed * 0.02
      position.z -= Math.cos(heading) * speed * 0.02
      position.y = 10 + altitudeFt / 50

      // AIRCRAFT
      aircraft.position.copy(position)
      aircraft.rotation.set(Math.PI / 2, heading, bank)

      // CAMERA (VISIBLE TURNING)
      const follow = 30
      const side = Math.sin(bank) * 6

      camera.position.set(
        position.x - Math.sin(heading) * follow + Math.cos(heading) * side,
        position.y + 10,
        position.z + Math.cos(heading) * follow + Math.sin(heading) * side
      )
      camera.lookAt(position)

      // MOVE GROUND
      const gx = Math.floor(position.x / tileSize)
      const gz = Math.floor(position.z / tileSize)

      farmTiles.forEach(tile => {
        const t = performance.now() * 0.001
        farmTiles.forEach(tile => animateGrass(tile, t))

        const tx = Math.floor(tile.position.x / tileSize)
        const tz = Math.floor(tile.position.z / tileSize)

        if (tx - gx > tilesPerSide)
          tile.position.x -= tileSize * (tilesPerSide * 2 + 1)
        if (tx - gx < -tilesPerSide)
          tile.position.x += tileSize * (tilesPerSide * 2 + 1)
        if (tz - gz > tilesPerSide)
          tile.position.z -= tileSize * (tilesPerSide * 2 + 1)
        if (tz - gz < -tilesPerSide)
          tile.position.z += tileSize * (tilesPerSide * 2 + 1)
      })

      // RESPAWN CATTLE
      cattle.forEach(cow => {
        if (cow.position.distanceTo(position) > 600) {
          cow.position.x = position.x + Math.random() * 400 - 200
          cow.position.z = position.z + Math.random() * 400 - 200
        }
      })

      // RESPAWN CLOUDS
      // clouds drift update
      clouds.forEach(cloud => {
        cloud.position.x += cloud.userData.speedX
        cloud.position.z += cloud.userData.speedZ
        if (cloud.position.distanceTo(position) > 900) {
          cloud.position.x = position.x + Math.random() * 600 - 300
          cloud.position.z = position.z + Math.random() * 600 - 300
        }
      })

      setAltitude(Math.round(altitudeFt))
      renderer.render(scene, camera)
    }

    animate()

    // ================= RESIZE =================
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    // ================= CLEANUP =================
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('resize', handleResize)

      if (renderer.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

 // NEW FUNCTION: Create flight avatar
  function createFlightAvatar(type = 'plane') {
    let avatar;

    if (type === 'bird') {
      avatar = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffaa00 })
      );
      avatar.add(body);

      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.1, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xffaa00 })
      );
      wing.position.y = 0;
      avatar.add(wing);

    } else if (type === 'kite') {
      avatar = new THREE.Mesh(
        new THREE.ConeGeometry(1, 2, 4),
        new THREE.MeshStandardMaterial({ color: 0xff00ff })
      );
    } else { // default plane
      avatar = new THREE.Mesh(
        new THREE.ConeGeometry(1, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0xff3333 })
      );
      avatar.rotation.x = Math.PI / 2;
    }

    return avatar;
  }

  function animateGrass(tile, time) {
    const pos = tile.geometry.attributes.position;
    const initialPos = tile.geometry.userData.initialPositions;
    
    // Store initial positions on first call
    if (!initialPos) {
      tile.geometry.userData.initialPositions = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        tile.geometry.userData.initialPositions[i * 3] = pos.getX(i);
        tile.geometry.userData.initialPositions[i * 3 + 1] = pos.getY(i);
        tile.geometry.userData.initialPositions[i * 3 + 2] = pos.getZ(i);
      }
    }
    
    const count = pos.count;
    for (let i = 0; i < count; i++) {
      const x = initialPos ? initialPos[i * 3] : pos.getX(i);
      const z = initialPos ? initialPos[i * 3 + 2] : pos.getZ(i);
      
      // Gentle wave like wind blowing through grass
      const wave1 = Math.sin(x * 0.3 + time * 0.5) * 0.15;
      const wave2 = Math.cos(z * 0.2 + time * 0.3) * 0.1;
      const randomSway = Math.sin((x + z) * 0.5 + time * 0.4) * 0.08;
      
      const newY = (initialPos ? initialPos[i * 3 + 1] : 0) + wave1 + wave2 + randomSway;
      pos.setY(i, newY);
    }
    pos.needsUpdate = true;
  }

  // Realistic cattle
  function createCattle(scene) {
    const cattle = new THREE.Group();
    
    // Body - larger and more realistic proportions
    const bodyGeo = new THREE.BoxGeometry(2, 1.8, 3.5);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x5C4033 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.5;
    cattle.add(body);
    
    // Head - proper cattle head shape
    const headGeo = new THREE.BoxGeometry(1.2, 1.4, 1.8);
    const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0x6B4423 }));
    head.position.set(0, 1.8, 2.3);
    cattle.add(head);
    
    // Snout
    const snoutGeo = new THREE.BoxGeometry(1, 0.6, 0.8);
    const snout = new THREE.Mesh(snoutGeo, new THREE.MeshStandardMaterial({ color: 0xFFB6C1 }));
    snout.position.set(0, 1.5, 3.2);
    cattle.add(snout);
    
    // Ears
    const earGeo = new THREE.BoxGeometry(0.6, 0.4, 0.2);
    const earMat = new THREE.MeshStandardMaterial({ color: 0x6B4423 });
    const leftEar = new THREE.Mesh(earGeo, earMat);
    const rightEar = new THREE.Mesh(earGeo, earMat);
    leftEar.position.set(-0.7, 2.3, 2.5);
    rightEar.position.set(0.7, 2.3, 2.5);
    leftEar.rotation.z = 0.5;
    rightEar.rotation.z = -0.5;
    cattle.add(leftEar);
    cattle.add(rightEar);
    
    // Horns
    const hornGeo = new THREE.ConeGeometry(0.15, 0.8, 8);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xFFF8DC });
    const leftHorn = new THREE.Mesh(hornGeo, hornMat);
    const rightHorn = new THREE.Mesh(hornGeo, hornMat);
    leftHorn.position.set(-0.5, 2.6, 2.3);
    rightHorn.position.set(0.5, 2.6, 2.3);
    leftHorn.rotation.z = -0.3;
    rightHorn.rotation.z = 0.3;
    cattle.add(leftHorn);
    cattle.add(rightHorn);
    
    // Legs - proper proportions
    const legGeo = new THREE.CylinderGeometry(0.25, 0.22, 1.8, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
    const legPositions = [
      [-0.7, 0.9, -1.2],  // back left
      [0.7, 0.9, -1.2],   // back right
      [-0.7, 0.9, 1],     // front left
      [0.7, 0.9, 1]       // front right
    ];
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(...pos);
      cattle.add(leg);
    });
    
    // Tail
    const tailGeo = new THREE.CylinderGeometry(0.08, 0.05, 1.5, 6);
    const tail = new THREE.Mesh(tailGeo, new THREE.MeshStandardMaterial({ color: 0x654321 }));
    tail.position.set(0, 1.5, -2);
    tail.rotation.x = 0.5;
    cattle.add(tail);
    
    // Udder (for realism)
    const udderGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const udder = new THREE.Mesh(udderGeo, new THREE.MeshStandardMaterial({ color: 0xFFB6C1 }));
    udder.position.set(0, 0.7, -0.5);
    udder.scale.set(1, 0.7, 0.8);
    cattle.add(udder);
    
    cattle.position.set(Math.random() * 400 - 200, 0, Math.random() * 400 - 200);
    cattle.rotation.y = Math.random() * Math.PI * 2;
    cattle.castShadow = true;
    scene.add(cattle);
    return cattle;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div ref={mountRef} />
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          color: 'white',
          background: 'rgba(0,0,0,0.5)',
          padding: 12,
          borderRadius: 8,
          fontFamily: 'monospace'
        }}
      >
        <div>🛩 ALTITUDE: {altitude} ft</div>
        <div>⚡ SPEED: {speed} kt</div>
        <div style={{ marginTop: 8, fontSize: 13 }}>
          ⬆️ climb ⬇️ descend ⬅️ left ➡️ right
        </div>
      </div>
    </div>
  )
}
