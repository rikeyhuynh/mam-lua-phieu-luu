/*
 * True realtime MamMi model viewer.
 * This module loads ONLY when a recognized model exists and the user selects 3D.
 * Three.js r160 + format loaders are fetched from jsDelivr using the import map in index.html.
 * Static-site friendly: no build step and no server API necessary.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { TDSLoader } from 'three/addons/loaders/TDSLoader.js';

export function createMamMiViewer(host) {
  const scene=new THREE.Scene();
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  renderer.domElement.setAttribute('aria-label','Mô hình MamMi 3D — kéo để xoay, cuộn để phóng to');
  host.appendChild(renderer.domElement);

  const camera=new THREE.PerspectiveCamera(35,1,.01,250);
  camera.position.set(0,1,6.4);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;
  controls.dampingFactor=.07;
  controls.minDistance=2;
  controls.maxDistance=12;
  controls.maxPolarAngle=Math.PI*.88;
  controls.target.set(0,0,0);
  controls.update();
  scene.add(new THREE.HemisphereLight(0xffffff,0x78916a,2.05));
  const keyLight=new THREE.DirectionalLight(0xfff7de,2.35);
  keyLight.position.set(-3,5,7);scene.add(keyLight);
  const rimLight=new THREE.DirectionalLight(0xcde9ff,1.35);
  rimLight.position.set(4,2,-6);scene.add(rimLight);

  const clock=new THREE.Clock();
  let subject=null,mixer=null,visible=false,lastWidth=0,lastHeight=0;
  function resize(){
    const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
    if(width===lastWidth&&height===lastHeight)return;
    lastWidth=width;lastHeight=height;
    camera.aspect=width/height;camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
  }
  const resizer=new ResizeObserver(resize);resizer.observe(host);
  function frame(){
    requestAnimationFrame(frame);
    const dt=Math.min(.04,clock.getDelta());
    if(!visible)return;
    resize();
    mixer?.update(dt);
    controls.update();
    renderer.render(scene,camera);
  }
  requestAnimationFrame(frame);

  async function getModel(url){
    const extension=url.split('.').pop().toLowerCase();
    let object,animations=[];
    switch(extension){
      case 'glb':case 'gltf': {
        const loader=new GLTFLoader();
        const result=await loader.loadAsync(url);
        object=result.scene;
        animations=result.animations||[];
        break;
      }
      case 'fbx': {
        const result=await new FBXLoader().loadAsync(url);
        object=result;animations=result.animations||[];
        break;
      }
      case 'obj': {
        const loader=new OBJLoader();
        const materialPath=url.replace(/\.obj$/i,'.mtl');
        try{
          const response=await fetch(materialPath,{method:'HEAD'});
          if(response.ok&&!(response.headers.get('content-type')||'').includes('text/html')){
            const materials=await new MTLLoader().loadAsync(materialPath);
            materials.preload();loader.setMaterials(materials);
          }
        }catch(error){/* The OBJ can still be displayed without its optional MTL. */}
        object=await loader.loadAsync(url);
        break;
      }
      case 'stl':case 'ply': {
        const geometry=extension==='stl'
          ?await new STLLoader().loadAsync(url)
          :await new PLYLoader().loadAsync(url);
        if(!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
        const hasColors=geometry.hasAttribute('color');
        const material=new THREE.MeshStandardMaterial({color:0xf3e5bf,vertexColors:hasColors,roughness:.85,metalness:0,side:THREE.DoubleSide});
        object=new THREE.Mesh(geometry,material);
        break;
      }
      case 'dae': {
        object=(await new ColladaLoader().loadAsync(url)).scene;
        break;
      }
      case '3ds': {
        object=await new TDSLoader().loadAsync(url);
        break;
      }
      default:throw new Error(`Định dạng không hỗ trợ: ${extension}`);
    }
    return {object,animations};
  }
  async function load(url){
    const {object,animations}=await getModel(url);
    if(!object)throw new Error('Mô hình không có dữ liệu hình học.');
    if(subject){scene.remove(subject);subject.traverse(child=>{
      if(child.geometry)child.geometry.dispose();
      // Avoid disposing shared built-in materials unnecessarily.
    });}
    subject=object;
    subject.traverse(node=>{
      if(node.isMesh){
        node.castShadow=false;node.receiveShadow=false;
        if(!node.material)node.material=new THREE.MeshStandardMaterial({color:0xe8dcc4,side:THREE.DoubleSide});
      }
    });
    const initialBounds=new THREE.Box3().setFromObject(subject);
    if(initialBounds.isEmpty())throw new Error('Không đọc được hình học của mô hình.');
    const size=initialBounds.getSize(new THREE.Vector3());
    const maxSize=Math.max(size.x,size.y,size.z);
    if(!Number.isFinite(maxSize)||maxSize<=0)throw new Error('Kích thước mô hình không hợp lệ.');
    subject.scale.multiplyScalar(3.3/maxSize);
    const box=new THREE.Box3().setFromObject(subject);
    subject.position.sub(box.getCenter(new THREE.Vector3()));
    scene.add(subject);
    mixer=null;
    if(animations.length){
      mixer=new THREE.AnimationMixer(subject);
      const run=animations.find(clip=>/run|idle|walk/i.test(clip.name))||animations[0];
      if(run)mixer.clipAction(run).play();
    }
    setView(0);
  }
  function setView(view){
    const angle=[0,Math.PI,-Math.PI/2,Math.PI/2][view]||0;
    const distance=6.4;
    camera.position.set(Math.sin(angle)*distance,1.05,Math.cos(angle)*distance);
    controls.target.set(0,0,0);
    controls.update();
  }
  function show(){host.hidden=false;visible=true;resize();}
  function hide(){visible=false;host.hidden=true;}
  return {load,setView,show,hide};
}
