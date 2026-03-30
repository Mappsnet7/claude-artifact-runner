import { useState, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { HexData, TerrainType } from './types'

const UNIT_SCALE = 0.8

interface Use3DPreviewProps {
  hexMap: HexData[]
  mapRadius: number
  terrainTypes: TerrainType[]
  showUnits: boolean
}

export function use3DPreview({ hexMap, mapRadius, terrainTypes, showUnits }: Use3DPreviewProps) {
  const [show3DPreview, setShow3DPreview] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!show3DPreview || !containerRef.current) return
    const container = containerRef.current
    const width = container.clientWidth || 800
    const height = 400

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb)

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
    camera.position.set(5, 12, 15)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2

    while (container.firstChild) container.removeChild(container.firstChild)
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.15
    controls.screenSpacePanning = false
    controls.maxPolarAngle = Math.PI / 2
    controls.minDistance = 5
    controls.maxDistance = 50

    // Lighting
    const sunLight = new THREE.DirectionalLight(0xffffcc, 1)
    sunLight.position.set(5, 10, 7)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.set(2048, 2048)
    sunLight.shadow.camera.near = 0.5
    sunLight.shadow.camera.far = 50
    sunLight.shadow.bias = -0.001
    const d = 20
    sunLight.shadow.camera.left = -d
    sunLight.shadow.camera.right = d
    sunLight.shadow.camera.top = d
    sunLight.shadow.camera.bottom = -d
    scene.add(sunLight)
    const fillLight = new THREE.DirectionalLight(0xaaccff, 0.5)
    fillLight.position.set(-5, 8, -5)
    scene.add(fillLight)
    scene.add(new THREE.AmbientLight(0x555555))
    scene.add(new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5))

    // Textures
    const textures: Record<string, THREE.Texture> = {}
    const createTextureCanvas = (terrainType: string): HTMLCanvasElement => {
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 128
      const ctx = canvas.getContext('2d')
      if (!ctx) return canvas
      const terrain = terrainTypes.find(t => t.id === terrainType)
      if (!terrain) return canvas
      ctx.fillStyle = terrain.color
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      switch (terrainType) {
        case 'field':
          ctx.strokeStyle = '#3da142'; ctx.lineWidth = 1; ctx.beginPath()
          for (let i = 0; i < 10; i++) { const x = Math.random() * 128; const y = Math.random() * 128; ctx.moveTo(x, y); ctx.lineTo(x + 5, y - 10) }
          ctx.stroke(); break
        case 'hills':
          ctx.strokeStyle = '#e59a14'; ctx.lineWidth = 3; ctx.beginPath()
          ctx.moveTo(0, 100); ctx.quadraticCurveTo(30, 50, 60, 100); ctx.quadraticCurveTo(90, 50, 128, 100); ctx.stroke(); break
        case 'forest':
          ctx.fillStyle = '#2c5518'
          for (let i = 0; i < 5; i++) { const x = 20 + i * 20; ctx.fillRect(x - 2, 80, 4, 20); ctx.beginPath(); ctx.moveTo(x - 15, 80); ctx.lineTo(x, 50); ctx.lineTo(x + 15, 80); ctx.fill() }
          break
        case 'swamp':
          ctx.fillStyle = '#6c9e71'
          for (let i = 0; i < 20; i++) { ctx.beginPath(); ctx.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 5, 0, Math.PI * 2); ctx.fill() }
          break
        case 'buildings':
          ctx.fillStyle = '#555555'
          for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) ctx.fillRect(10 + i * 40, 10 + j * 40, 30, 30)
          break
        case 'water':
          ctx.strokeStyle = '#1976D2'; ctx.lineWidth = 2
          for (let i = 0; i < 5; i++) { const y = 20 + i * 20; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(30, y - 10, 60, y + 10, 128, y - 5); ctx.stroke() }
          break
      }
      return canvas
    }
    terrainTypes.forEach(t => {
      if (t.id !== 'empty') textures[t.id] = new THREE.CanvasTexture(createTextureCanvas(t.id))
    })

    // Grid and ground plane
    const gridHelper = new THREE.GridHelper(mapRadius * 4, mapRadius * 2)
    gridHelper.position.y = -0.05;
    (gridHelper.material as THREE.Material).opacity = 0.2;
    (gridHelper.material as THREE.Material).transparent = true
    scene.add(gridHelper)

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(mapRadius * 6, mapRadius * 6),
      new THREE.MeshStandardMaterial({ color: 0x336699, metalness: 0.1, roughness: 0.8, side: THREE.DoubleSide })
    )
    plane.rotation.x = -Math.PI / 2
    plane.position.y = -0.1
    plane.receiveShadow = true
    scene.add(plane)

    scene.fog = new THREE.FogExp2(0x87ceeb, 0.01)

    // Add hexes in batches
    const maxHexes = 500
    const hexesToRender = hexMap.length > maxHexes ? hexMap.slice(0, maxHexes) : hexMap
    let batchIndex = 0
    const addNextBatch = () => {
      const end = Math.min(batchIndex + 50, hexesToRender.length)
      for (let i = batchIndex; i < end; i++) {
        const hex = hexesToRender[i]
        if (hex.terrainType === 'empty') continue

        const hexShape = new THREE.Shape()
        for (let j = 0; j < 6; j++) {
          const angle = (Math.PI / 3) * j
          const x = Math.cos(angle), y = Math.sin(angle)
          if (j === 0) hexShape.moveTo(x, y)
          else hexShape.lineTo(x, y)
        }
        hexShape.closePath()

        const terrainHeight = hex.height > 0 ? hex.height : 0.1
        const extrudeSettings = { depth: terrainHeight, bevelEnabled: false }
        const geometry = new THREE.ExtrudeGeometry(hexShape, extrudeSettings)

        const terrain = terrainTypes.find(t => t.id === hex.terrainType)
        const mat = new THREE.MeshLambertMaterial({
          color: terrain?.color ?? '#888888',
          map: textures[hex.terrainType] ?? null,
        })
        const mesh = new THREE.Mesh(geometry, mat)
        mesh.castShadow = true
        mesh.receiveShadow = true

        const x3 = 40 * 1.5 * hex.q / 40
        const z = 40 * Math.sqrt(3) * (hex.r + hex.q / 2) / 40
        mesh.position.x = x3
        mesh.position.z = z
        mesh.rotation.x = -Math.PI / 2
        scene.add(mesh)

        if (hex.unit && showUnits) {
          const terrainH = hex.height > 0 ? hex.height : 0.1
          const unitMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3 * UNIT_SCALE, 0.3 * UNIT_SCALE, 0.4, 16),
            new THREE.MeshLambertMaterial({ color: hex.unit.color, emissive: new THREE.Color(hex.unit.color).multiplyScalar(0.2) })
          )
          unitMesh.castShadow = true
          unitMesh.position.set(mesh.position.x, terrainH + 0.2, mesh.position.z)

          const platformMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35 * UNIT_SCALE, 0.35 * UNIT_SCALE, 0.05, 16),
            new THREE.MeshLambertMaterial({ color: 0x333333, emissive: 0x111111 })
          )
          platformMesh.castShadow = true
          platformMesh.position.set(mesh.position.x, terrainH, mesh.position.z)

          scene.add(platformMesh)
          scene.add(unitMesh)
        }
      }
      batchIndex = end
      if (batchIndex < hexesToRender.length) {
        setTimeout(() => requestAnimationFrame(addNextBatch), 0)
      }
    }
    requestAnimationFrame(addNextBatch)

    let animationFrameId: number
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      camera.aspect = w / 400
      camera.updateProjectionMatrix()
      renderer.setSize(w, 400)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      if (containerRef.current) {
        while (containerRef.current.firstChild) containerRef.current.removeChild(containerRef.current.firstChild)
      }
    }
  }, [show3DPreview, hexMap, mapRadius, showUnits, terrainTypes])

  return { show3DPreview, setShow3DPreview, containerRef }
}
