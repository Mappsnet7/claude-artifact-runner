import * as THREE from 'three';
import { Cell, MapSize } from '../types';
import { terrainTypes } from '../constants';

// Cache for textures
const textureCache: Record<string, THREE.Texture> = {};

/**
 * Creates or updates a 3D map model based on map data
 * @param scene THREE.js scene
 * @param mapData Map data
 * @param mapSize Map dimensions
 */
export const createMapMesh = (
  scene: THREE.Scene,
  mapData: Cell[][],
  mapSize: MapSize
): void => {
  if (!scene || !mapData.length) return;
  
  // Texture loader
  const textureLoader = new THREE.TextureLoader();
  
  // Remove old model if it exists
  const toRemove: THREE.Object3D[] = [];
  scene.traverse((object: THREE.Object3D) => {
    if (object instanceof THREE.Mesh && 
        !(object.geometry instanceof THREE.PlaneGeometry) && 
        !(object.geometry.type === 'GridHelper')) {
      toRemove.push(object);
    }
  });
  
  toRemove.forEach(object => {
    scene.remove(object);
    if ((object as THREE.Mesh).geometry) {
      (object as THREE.Mesh).geometry.dispose();
    }
    
    if ((object as THREE.Mesh).material) {
      if (Array.isArray((object as THREE.Mesh).material)) {
        ((object as THREE.Mesh).material as THREE.Material[]).forEach(material => material.dispose());
      } else {
        ((object as THREE.Mesh).material as THREE.Material).dispose();
      }
    }
  });
  
  // Группировка ячеек по типу местности для оптимизации
  const terrainGroups: Record<string, { positions: number[], heights: number[], count: number }> = {};
  
  // Подготовка данных для инстансинга
  for (let z = 0; z < mapSize.height; z++) {
    for (let x = 0; x < mapSize.width; x++) {
      const cell = mapData[z]?.[x];
      if (cell) {
        if (!terrainGroups[cell.type]) {
          terrainGroups[cell.type] = { positions: [], heights: [], count: 0 };
        }
        
        terrainGroups[cell.type].positions.push(x, 0, z);
        terrainGroups[cell.type].heights.push(cell.height);
        terrainGroups[cell.type].count++;
      }
    }
  }
  
  // Создание инстансированных мешей для каждого типа местности
  Object.entries(terrainGroups).forEach(([terrainType, group]) => {
    const terrain = terrainTypes.find(t => t.id === terrainType);
    if (!terrain || group.count === 0) return;
    
    // Получение или создание текстуры
    let texture: THREE.Texture;
    if (textureCache[terrain.id]) {
      texture = textureCache[terrain.id];
    } else {
      texture = textureLoader.load(terrain.texture);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      textureCache[terrain.id] = texture;
    }
    
    // Создание базовой геометрии для инстансинга
    const boxGeometry = new THREE.BoxGeometry(0.95, 1, 0.95);
    
    // Создание материала
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: terrain.color,
      roughness: 0.7,
      metalness: 0.1
    });
    
    // Создание инстансированного меша
    const instancedMesh = new THREE.InstancedMesh(
      boxGeometry,
      material,
      group.count
    );
    
    // Установка матриц трансформации для каждого инстанса
    const matrix = new THREE.Matrix4();
    let instanceIndex = 0;
    
    for (let i = 0; i < group.count; i++) {
      const x = group.positions[i * 3];
      const z = group.positions[i * 3 + 2];
      const height = Math.max(0.05, terrain.baseHeight * group.heights[i] / 3);
      
      matrix.makeTranslation(
        x + 0.5,
        height / 2,
        z + 0.5
      );
      
      // Масштабирование по высоте
      matrix.scale(new THREE.Vector3(1, height, 1));
      
      instancedMesh.setMatrixAt(instanceIndex, matrix);
      instanceIndex++;
    }
    
    // Обновление матриц инстансов
    instancedMesh.instanceMatrix.needsUpdate = true;
    
    // Настройка теней
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    
    // Добавление меша на сцену
    scene.add(instancedMesh);
  });
  
  // Создание базовой плоскости
  const baseGeometry = new THREE.PlaneGeometry(mapSize.width, mapSize.height);
  baseGeometry.rotateX(-Math.PI / 2);
  
  // Загрузка текстуры травы для базовой плоскости
  let grassTexture: THREE.Texture;
  if (textureCache['base']) {
    grassTexture = textureCache['base'];
  } else {
    grassTexture = textureLoader.load('/textures/grass.jpg');
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(mapSize.width / 2, mapSize.height / 2);
    textureCache['base'] = grassTexture;
  }
  
  const baseMaterial = new THREE.MeshStandardMaterial({ 
    map: grassTexture,
    color: 0x91b247,
    roughness: 0.8,
    metalness: 0.1
  });
  
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.set(mapSize.width / 2, -0.1, mapSize.height / 2);
  base.receiveShadow = true;
  scene.add(base);
  
  // Создание сетки
  const gridHelper = new THREE.GridHelper(Math.max(mapSize.width, mapSize.height), Math.max(mapSize.width, mapSize.height));
  gridHelper.position.set(mapSize.width / 2, 0, mapSize.height / 2);
  scene.add(gridHelper);
};

/**
 * Sets up a basic THREE.js scene with lighting and a base plane
 * @param container Container element to hold the renderer
 * @param mapSize Map dimensions
 * @returns Object containing scene, camera, and renderer
 */
export const setupThreeScene = (
  container: HTMLDivElement,
  mapSize: MapSize
): { scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer } => {
  // Create basic THREE.js objects
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xC9E6FF); // Light blue background - sky
  
  // Create camera
  const camera = new THREE.PerspectiveCamera(
    60, 
    container.clientWidth / container.clientHeight, 
    0.1, 
    1000
  );
  
  // Create renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  // Clear container before adding new canvas
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  
  container.appendChild(renderer.domElement);
  
  // Position camera above map
  const maxDimension = Math.max(mapSize.width, mapSize.height);
  camera.position.set(mapSize.width / 2, maxDimension * 0.5, mapSize.height + 5);
  camera.lookAt(mapSize.width / 2, 0, mapSize.height / 2);
  
  // Add main lighting
  // Bright ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  
  // Directional light as sun
  const directionalLight = new THREE.DirectionalLight(0xfffaf0, 1.0);
  directionalLight.position.set(mapSize.width, mapSize.width/2, mapSize.height);
  directionalLight.castShadow = true;
  
  // Shadow settings
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = mapSize.width * 3;
  
  const shadowSize = Math.max(mapSize.width, mapSize.height) * 1.5;
  directionalLight.shadow.camera.left = -shadowSize;
  directionalLight.shadow.camera.right = shadowSize;
  directionalLight.shadow.camera.top = shadowSize;
  directionalLight.shadow.camera.bottom = -shadowSize;
  
  scene.add(directionalLight);
  
  // Add additional light sources
  const frontLight = new THREE.DirectionalLight(0xffffff, 0.5);
  frontLight.position.set(mapSize.width / 2, mapSize.width / 4, mapSize.height * 2);
  scene.add(frontLight);
  
  const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
  backLight.position.set(mapSize.width / 2, mapSize.width / 4, -mapSize.height);
  scene.add(backLight);
  
  // Create main plane (ground)
  const baseGeometry = new THREE.PlaneGeometry(mapSize.width * 3, mapSize.height * 3);
  baseGeometry.rotateX(-Math.PI / 2);
  
  // Create grass texture for ground
  const textureLoader = new THREE.TextureLoader();
  const grassTextureUrl = terrainTypes.find(t => t.id === 'field')?.texture || '';
  const grassTexture = textureLoader.load(grassTextureUrl);
  grassTexture.wrapS = THREE.RepeatWrapping;
  grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(mapSize.width/2, mapSize.height/2);
  
  const baseMaterial = new THREE.MeshStandardMaterial({ 
    map: grassTexture,
    color: 0x91b247,
    roughness: 0.8,
    metalness: 0.1
  });
  
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.set(mapSize.width / 2, -0.1, mapSize.height / 2);
  base.receiveShadow = true;
  scene.add(base);
  
  // Create coordinate grid
  const gridHelper = new THREE.GridHelper(
    Math.max(mapSize.width, mapSize.height) * 2,
    Math.max(mapSize.width, mapSize.height) * 2,
    0x888888,
    0xcccccc
  );
  gridHelper.position.set(mapSize.width / 2, 0.01, mapSize.height / 2);
  scene.add(gridHelper);
  
  return { scene, camera, renderer };
};

/**
 * Sets up camera controls for 3D view
 * @param renderer THREE.js renderer
 * @param camera THREE.js camera
 * @param mapSize Map dimensions
 */
export const setupCameraControls = (
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  mapSize: MapSize
): void => {
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  let cameraDistance = camera.position.distanceTo(
    new THREE.Vector3(mapSize.width / 2, 0, mapSize.height / 2)
  );
  const maxDimension = Math.max(mapSize.width, mapSize.height);
  
  // Event handlers for camera rotation
  const handleMouseDown = (e: MouseEvent) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const deltaMove = {
      x: e.clientX - previousMousePosition.x,
      y: e.clientY - previousMousePosition.y
    };
    
    const center = new THREE.Vector3(mapSize.width / 2, 0, mapSize.height / 2);
    const deltaRotationQuaternion = new THREE.Quaternion()
      .setFromEuler(
        new THREE.Euler(
          deltaMove.y * 0.01,
          deltaMove.x * 0.01,
          0,
          'XYZ'
        )
      );
    
    // Calculate vector from camera to center
    const cameraToCenter = new THREE.Vector3().subVectors(camera.position, center);
    
    // Apply rotation to this vector
    cameraToCenter.applyQuaternion(deltaRotationQuaternion);
    
    // Set new camera position
    camera.position.copy(center).add(cameraToCenter);
    
    // Point camera to center
    camera.lookAt(center);
    
    previousMousePosition = { x: e.clientX, y: e.clientY };
  };
  
  const handleMouseUp = () => {
    isDragging = false;
  };
  
  // Handler for scaling
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    
    const center = new THREE.Vector3(mapSize.width / 2, 0, mapSize.height / 2);
    const cameraToCenter = new THREE.Vector3().subVectors(camera.position, center);
    
    // Change distance based on scroll direction
    cameraDistance += e.deltaY * 0.05;
    
    // Limit minimum and maximum distance
    cameraDistance = Math.max(5, Math.min(cameraDistance, maxDimension * 2));
    
    // Normalize vector and multiply by new distance
    cameraToCenter.normalize().multiplyScalar(cameraDistance);
    
    // Set new camera position
    camera.position.copy(center).add(cameraToCenter);
    
    // Point camera to center
    camera.lookAt(center);
  };
  
  // Add event handlers
  renderer.domElement.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
  
  // Return cleanup function
  (renderer as any).userData = {
    cleanupControls: () => {
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('wheel', handleWheel);
    }
  };
};

/**
 * Cleans up THREE.js resources
 * @param container Container element
 * @param scene THREE.js scene
 * @param renderer THREE.js renderer
 */
export const cleanupThreeResources = (
  container: HTMLDivElement | null,
  scene: THREE.Scene | null,
  renderer: THREE.WebGLRenderer | null
): void => {
  if (renderer && renderer.domElement) {
    if ((renderer as any).userData && (renderer as any).userData.cleanupControls) {
      (renderer as any).userData.cleanupControls();
    }
    
    // Remove canvas
    if (container) {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    }
    
    // Clear resources
    if (scene) {
      scene.traverse((object: THREE.Object3D) => {
        if ((object as THREE.Mesh).geometry) {
          (object as THREE.Mesh).geometry.dispose();
        }
        
        if ((object as THREE.Mesh).material) {
          if (Array.isArray((object as THREE.Mesh).material)) {
            ((object as THREE.Mesh).material as THREE.Material[]).forEach(material => material.dispose());
          } else {
            ((object as THREE.Mesh).material as THREE.Material).dispose();
          }
        }
      });
    }
    
    renderer.dispose();
  }
};