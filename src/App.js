import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader";

export default function Flying() {
  const mountRef = useRef(null)
  const houseTemplateRef = useRef(null);
  const planeTemplateRef = useRef(null);
  const cattleTemplateRef = useRef(null);
  const cloudTemplateRef = useRef(null);
  const [altitude, setAltitude] = useState(1000)
  const [speed] = useState(50)

  useEffect(() => {
    if (!mountRef.current) return

    let cattles = [];
    let houses = [];
    let clouds = [];

    // ================= SCENE =================
    const scene = createScene()
    addAxisHelper(scene)
    const camera = createCamera()
    const clock = new THREE.Clock()
    const weather = initWeather(scene, camera)
    // start music if allowed
    //weather.music.play().catch(()=>{})
    const renderer = createRenderer()
    mountRef.current.appendChild(renderer.domElement)

    addLighting(scene)
    const aircraft = addFlightAvatar(scene)

    const groundData = createGround(scene)
    const { tileSize, tilesPerSide, farmTiles } = groundData

    createCattles(scene, cattles);
    createHouses(scene, houses);
    createClouds(scene, clouds);

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

      const dt = clock.getDelta()
      updateRain(weather.rain, position, dt)
      weather.update(dt, position)

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
      if (keys.ArrowDown) altitudeFt = Math.max(altitudeFt - 25, 20)

      // FORWARD MOTION
      position.x += Math.sin(heading) * speed * 0.02
      position.z -= Math.cos(heading) * speed * 0.02
      position.y = 10 + altitudeFt / 50

      // AIRCRAFT
      aircraft.position.copy(position)
      aircraft.rotation.set(-Math.PI / 2, heading, bank)  

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

      // Animate grass ONCE per frame
      const t = performance.now() * 0.001
      farmTiles.forEach(tile => {
        animateGrass(tile, t)
      })

      // Then update tile positions
      farmTiles.forEach(tile => {
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

      respawnCattle(cattles, position)
      respawnHouses(houses, position)
      respawnClouds(clouds, position)

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

  function addAxisHelper(scene) {
    
    /* Red line = X axis (left-right)
    Green line = Y axis (up-down)
    Blue line = Z axis (forward-backward)  */

    // Create axis lines
    const axisLength = 100;
    
    // X axis (red)
    const xGeometry = new THREE.BufferGeometry();
    xGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, axisLength, 0, 0]), 3
    ));
    const xLine = new THREE.Line(
      xGeometry,
      new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 })
    );
    scene.add(xLine);
    
    // Y axis (green)
    const yGeometry = new THREE.BufferGeometry();
    yGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, 0, axisLength, 0]), 3
    ));
    const yLine = new THREE.Line(
      yGeometry,
      new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 })
    );
    scene.add(yLine);
    
    // Z axis (blue)
    const zGeometry = new THREE.BufferGeometry();
    zGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, 0, 0, axisLength]), 3
    ));
    const zLine = new THREE.Line(
      zGeometry,
      new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 3 })
    );
    scene.add(zLine);
    
    // Add labels (optional, using sprites or just text)
    addAxisLabel(scene, axisLength, 0, 0, 'X', 0xff0000);
    addAxisLabel(scene, 0, axisLength, 0, 'Y', 0x00ff00);
    addAxisLabel(scene, 0, 0, axisLength, 'Z', 0x0000ff);
  }

  function addAxisLabel(scene, x, y, z, label, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.font = 'bold 48px Arial';
    ctx.fillText(label, 16, 48);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x * 1.1, y * 1.1, z * 1.1);
    sprite.scale.set(10, 10, 1);
    scene.add(sprite);
  }

  function createScene(){
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb)
    scene.fog = new THREE.Fog(0x87ceeb, 200, 900)
    return scene
  }

  function createCamera(){
     return new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    )
  }

  function createRenderer(){
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.shadowMap.enabled = true
    return renderer
  }

  function addLighting(scene){
    // ================= LIGHT =================
    scene.add(new THREE.AmbientLight(0xffffff, 0.7))

    const sun = new THREE.DirectionalLight(0xffffff, 1)
    sun.position.set(200, 300, 100)
    sun.castShadow = true
    scene.add(sun)
  }

  function addFlightAvatar(scene){
    // Create an empty Group to hold the loaded plane
    const aircraftGroup = new THREE.Group();
    scene.add(aircraftGroup);

    // Load and add plane when ready
    loadA380Plane(() => {
      if (!planeTemplateRef.current) return;
      const a380 = planeTemplateRef.current.clone(true);
      a380.scale.set(0.001, 0.001, 0.001);  // adjust scale as needed
      a380.position.set(0, 0, 0);        // Ensure it's at origin
      aircraftGroup.add(a380);
      // Fix inverted plane - rotate 180° on X axis
      //a380.rotation.x = Math.PI;  // Flip upside right
      addAircraftAxisHelper(aircraftGroup);
      console.log("✓ Plane loaded and added to scene");
    });

    return aircraftGroup;  // Always return the group
  }

  function addAircraftAxisHelper(aircraft) {
    const axisLength = 50;
    
    // X axis (red)
    const xGeometry = new THREE.BufferGeometry();
    xGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, axisLength, 0, 0]), 3
    ));
    const xLine = new THREE.Line(
      xGeometry,
      new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 })
    );
    aircraft.add(xLine);
    
    // Y axis (green)
    const yGeometry = new THREE.BufferGeometry();
    yGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, 0, axisLength, 0]), 3
    ));
    const yLine = new THREE.Line(
      yGeometry,
      new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 })
    );
    aircraft.add(yLine);
    
    // Z axis (blue)
    const zGeometry = new THREE.BufferGeometry();
    zGeometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, 0, 0, axisLength]), 3
    ));
    const zLine = new THREE.Line(
      zGeometry,
      new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 2 })
    );
    aircraft.add(zLine);
  }

  function createGround(scene){
    // ================= GROUND =================
    const tileSize = 200
    const tilesPerSide = 4
    const farmTiles = []

    // Create a simple grass texture
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#1a4d2e'
    ctx.fillRect(0, 0, 256, 256)

    // Add grass blade details
    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * 256
      const y = Math.random() * 256
      const h = Math.random() * 8 + 4
      ctx.strokeStyle = `rgba(34, 87, 50, ${Math.random() * 0.6 + 0.4})`
      ctx.lineWidth = Math.random() * 0.5 + 0.3
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.random() * 2 - 1, y + h)
      ctx.stroke()
    }

    const grassTexture = new THREE.CanvasTexture(canvas)
    grassTexture.magFilter = THREE.NearestFilter
    grassTexture.minFilter = THREE.LinearMipmapLinearFilter
    grassTexture.repeat.set(4, 4)
    grassTexture.wrapS = THREE.RepeatWrapping
    grassTexture.wrapT = THREE.RepeatWrapping

    for (let x = -tilesPerSide; x <= tilesPerSide; x++) {
      for (let z = -tilesPerSide; z <= tilesPerSide; z++) {
        const tile = new THREE.Mesh(
          new THREE.PlaneGeometry(tileSize, tileSize, 16, 16),
          new THREE.MeshStandardMaterial({ 
            map: grassTexture,
            roughness: 0.8,
            metalness: 0
          })
        )

        tile.rotation.x = -Math.PI / 2
        tile.position.set(x * tileSize, 0, z * tileSize)
        tile.receiveShadow = true
        tile.castShadow = true
        scene.add(tile)
        farmTiles.push(tile)
      }
    }

    return { tileSize, tilesPerSide, farmTiles }
  }

  function createCattles(scene, cattles){
    // ================= CATTLE =================
    cattleTemplateRef.current = createCattle();

    for (let i = 0; i < 40; i++) {
      const cow = cattleTemplateRef.current.clone(true);
      cow.position.set(Math.random() * 400 - 200, 0, Math.random() * 400 - 200);
      cow.rotation.y = Math.random() * Math.PI * 2;
      scene.add(cow);
      cattles.push(cow);
    }
  }

  function createHouses(scene, houses){
     loadHouse(() => {
      for (let i = 0; i < 5; i++) {
        spawnHouse(scene, houses);
      }
    });
  }

  function createClouds(scene, clouds){
    // ================= CLOUDS =================
    const cloudCount = 20  // more clouds
    cloudTemplateRef.current = createCloud();

    for (let i = 0; i < cloudCount; i++) {
      const cloud = cloudTemplateRef.current.clone(true);
      cloud.position.set(
        Math.random() * 600 - 300,
        Math.random() * 60 + 40,
        Math.random() * 600 - 300
      )
      cloud.userData = { speedX: Math.random() * 0.1 - 0.05, speedZ: Math.random() * 0.1 - 0.05 }
      scene.add(cloud)
      clouds.push(cloud)
    }
  }

  // Weather: rain particles + thunder flashes + audio
  function createRain(scene, count = 1800, spread = 600) {
    // create a small vertical streak texture for raindrops
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
    grad.addColorStop(0, 'rgba(255,255,255,0.95)')
    grad.addColorStop(0.7, 'rgba(200,220,255,0.6)')
    grad.addColorStop(1, 'rgba(200,220,255,0)')
    ctx.fillStyle = grad
    // draw narrow streak in center
    ctx.fillRect(3, 0, 2, canvas.height)

    const dropTex = new THREE.CanvasTexture(canvas)
    dropTex.minFilter = THREE.LinearFilter
    dropTex.magFilter = THREE.LinearFilter
    dropTex.needsUpdate = true

    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * spread
      positions[i * 3 + 1] = Math.random() * 200 + 20
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread
      velocities[i] = 150 + Math.random() * 200
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = new THREE.PointsMaterial({
      map: dropTex,
      color: 0xbfdfff,
      size: 6,               // <- increase this to make drops larger (try 6..12)
      sizeAttenuation: true, // set false to keep constant screen size
      transparent: true,
      opacity: 0.75,
      depthWrite: false
    })

    const points = new THREE.Points(geometry, material)
    points.userData = { velocities, spread }
    scene.add(points)
    return points
  }

  function updateRain(rainPoints, cameraPos, dt) {
    if (!rainPoints) return
    const pos = rainPoints.geometry.attributes.position.array
    const vel = rainPoints.userData.velocities
    const spread = rainPoints.userData.spread
    const count = vel.length

    for (let i = 0; i < count; i++) {
      const idx = i * 3 + 1
      pos[idx] -= vel[i] * dt
      // if below ground or far below camera, respawn above the camera
      if (pos[idx] < 0 || pos[idx] < cameraPos.y - 60) {
        pos[i * 3] = cameraPos.x + (Math.random() - 0.5) * spread
        pos[idx] = cameraPos.y + 80 + Math.random() * 80
        pos[i * 3 + 2] = cameraPos.z + (Math.random() - 0.5) * spread
        vel[i] = 120 + Math.random() * 220
      }
    }
    rainPoints.geometry.attributes.position.needsUpdate = true
  }

  function initWeather(scene, camera) {
    // rain
    const rain = createRain(scene, 3600, 1200)

    // thunder light (off by default)
    const thunderLight = new THREE.DirectionalLight(0xffffff, 0)
    thunderLight.position.set(300, 400, 100)
    thunderLight.castShadow = false
    scene.add(thunderLight)

    // audio (use relative paths in /public or /assets)
    const music = new Audio('/assets/sounds/ambient_rain_loop.mp3')
    music.loop = true
    music.volume = 0.45

    const thunderSound = new Audio('/assets/sounds/soundreality-thunder-sound-375727l.mp3')
    thunderSound.volume = 0.9

    // autoplay policies: start on user gesture if needed
    const tryStartAudio = () => {
      if (music.paused) music.play().catch(()=>{})
    }
    window.addEventListener('pointerdown', tryStartAudio, { once: true })

    // thunder timing state
    let thunderTimer = Math.random() * 8 + 5
    let flashTime = 0

    function update(dt, cameraPos) {
      // rain
      updateRain(rain, cameraPos, dt)

      // thunder scheduling
      thunderTimer -= dt
      if (thunderTimer <= 0) {
        // stronger, longer flash
        flashTime = 0.3 + Math.random() * 0.6          // longer visible flash
        thunderLight.intensity = 12 + Math.random() * 12 // much brighter than before
        thunderSound.currentTime = 0
        thunderSound.play().catch(()=>{})
        thunderTimer = Math.random() * 12 + 6
      }

      if (flashTime > 0) {
        // slower decay so intensity remains higher briefly
        const decayRate = 3.0  // smaller = slower decay; increase to reduce speed
        thunderLight.intensity *= Math.max(0.1, 1 - dt * decayRate)
        flashTime -= dt
        if (flashTime <= 0) thunderLight.intensity = 0
      }
    }

    return { rain, thunderLight, music, thunderSound, update }
  }

  function respawnCattle(cattles, position){
    // RESPAWN CATTLE
    cattles.forEach(cow => {
      if (cow.position.distanceTo(position) > 350) {
        cow.position.x = position.x + Math.random() * 400 - 200
        cow.position.z = position.z + Math.random() * 400 - 200
        cow.position.y = 0
        cow.rotation.y = Math.random() * Math.PI * 2
      }
    })
  }

  function respawnHouses(houses, position){
    // RESPAWN HOUSE
    if (houses.length > 0){
      houses.forEach(house => {
        if (house.position.distanceTo(position) > 350) {
          house.position.x = position.x + Math.random() * 400 - 300
          house.position.z = position.z + Math.random() * 400 - 300
          house.position.y = 0
          house.scale.set(2, 2, 2);
          // freeze if static
          house.updateMatrix();
          house.matrixAutoUpdate = false;
        }
      })
    } 
  }

  function respawnClouds(clouds, position){
     // RESPAWN CLOUDS
    // clouds drift update
    clouds.forEach(cloud => {
      cloud.position.x += cloud.userData.speedX
      cloud.position.z += cloud.userData.speedZ
      if (cloud.position.distanceTo(position) > 500) {
        cloud.position.x = position.x + Math.random() * 600 - 300
        cloud.position.z = position.z + Math.random() * 600 - 300
      }
    })
  }

  function createFlightAvatar(scene, type = 'plane') {
    let avatar;

    if (type === 'bird') {
      avatar = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xffaa00 })
      );
      body.scale.z = 3;
      avatar.add(body);

      const beak = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.4, 6),
        new THREE.MeshStandardMaterial({ color: 0xff6600 })
      );
      beak.rotation.x = Math.PI / 2;
      beak.position.z = 0.9;
      avatar.add(beak);

      const leftWingPivot = new THREE.Group();
      leftWingPivot.position.set(-0.5, 0, 0);
      avatar.add(leftWingPivot);

      const leftWing = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.05, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xffaa00 })
      );
      leftWing.position.x = -0.6; // extend outward
      leftWingPivot.add(leftWing);
      
      const rightWingPivot = new THREE.Group();
      rightWingPivot.position.set(0.5, 0, 0);
      avatar.add(rightWingPivot);

      const rightWing = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.05, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xffaa00 })
      );
      rightWing.position.x = 0.6;
      rightWingPivot.add(rightWing);

      const tail = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.6, 6),
        new THREE.MeshStandardMaterial({ color: 0xff8800 })
      );
      tail.rotation.x = -Math.PI / 2;
      tail.position.z = -0.9;
      avatar.add(tail);      
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
    // Simplified - just update material UVs for wind effect
    if (tile.material.map) {
      tile.material.map.offset.x += 0.0001
    }
  }

  function createCloud() {
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
    return cloud
  }

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
    
    /* cattle.position.set(Math.random() * 400 - 200, 0, Math.random() * 400 - 200);
    cattle.rotation.y = Math.random() * Math.PI * 2; */
    cattle.castShadow = true;
    //scene.add(cattle);
    return cattle;
  }

  function loadHouse(onReady) {
    const mtlLoader = new MTLLoader();
    mtlLoader.setPath("/assets/Wooden-Watch-Tower/");

    mtlLoader.load("wooden watch tower2.mtl", (materials) => {
      materials.preload();

      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.setPath("/assets/Wooden-Watch-Tower/");

      objLoader.load("wooden watch tower2.obj", (obj) => {
        obj.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.material.side = THREE.DoubleSide;
          }
        });

        houseTemplateRef.current = obj;
        onReady();
      });
    });
  }

  function loadA380Plane(onReady){
    const mtlLoader = new MTLLoader();
    mtlLoader.setPath("/assets/A380/");

    mtlLoader.load("A380.mtl", (materials) => {
      console.log("✓ A380 MTL loaded");
      materials.preload();

      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.setPath("/assets/A380/");

      objLoader.load("A380.obj", (obj) => {
        console.log("✓ A380 OBJ loaded");
        obj.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.material.side = THREE.DoubleSide;
          }
        });

        planeTemplateRef.current = obj;
        onReady();
      },
      (progress) => {
        console.log("OBJ loading...", Math.round(progress.loaded / progress.total * 100) + "%");
      },
      (error) => {
        console.error("✗ Failed to load A380.obj:", error);
      });
    });
  }

  function spawnHouse(scene, houses) {
    if (!houseTemplateRef.current) return;

    const house = houseTemplateRef.current.clone(true);

    house.position.set(
      Math.random() * 400 - 300,
      0,
      Math.random() * 400 - 300
    );

    house.rotation.y = Math.random() * Math.PI * 2;
    house.scale.set(2, 2, 2);

    // freeze if static
    house.updateMatrix();
    house.matrixAutoUpdate = false;

    scene.add(house);
    houses.push(house);
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
