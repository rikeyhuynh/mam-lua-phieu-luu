/*
 * MamMi full-color GLB viewer — self-contained WebGL2 (file:// compatible).
 * Supports all GLB meshes, per-node transforms, embedded baseColor / normal
 * textures, material tint, two-sided geometry, rotation and zoom.
 * Model binary is embedded by DONG_GOI_MAMMI.py for offline mode.
 */
function createMamMiViewer(host) {
  const canvas=document.createElement('canvas');
  canvas.className='mammi-model-canvas';
  canvas.setAttribute('aria-label','Mô hình Mầm Mí 3D có đầy đủ texture màu. Kéo để xoay, cuộn để thu phóng.');
  host.appendChild(canvas);
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'high-performance',premultipliedAlpha:false});
  if(!gl)throw new Error('Trình duyệt hoặc thiết bị chưa hỗ trợ WebGL2');
  const vert=`#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPosition;
  layout(location=1) in vec3 aNormal;
  layout(location=2) in vec2 aUV;
  uniform mat4 uPerspective;
  uniform mat3 uRotation;
  uniform vec3 uCenter;
  uniform float uScale;
  uniform float uDistance;
  out vec3 vNormal;
  out vec3 vPoint;
  out vec3 vEye;
  out vec2 vUV;
  void main(){
    vec3 p=uRotation*((aPosition-uCenter)*uScale);
    vNormal=normalize(uRotation*aNormal);
    vPoint=p;
    vEye=normalize(vec3(-p.x,-p.y,uDistance-p.z));
    vUV=aUV;
    gl_Position=uPerspective*vec4(p.xy,p.z-uDistance,1.0);
  }`;
  const frag=`#version 300 es
  precision highp float;
  in vec3 vNormal;
  in vec3 vPoint;
  in vec3 vEye;
  in vec2 vUV;
  uniform sampler2D uColorMap;
  uniform sampler2D uNormalMap;
  uniform bool uUseColorMap;
  uniform bool uUseNormalMap;
  uniform vec4 uBaseColor;
  out vec4 outColor;
  void main(){
    vec4 texColor=uUseColorMap?texture(uColorMap,vUV):vec4(1.0);
    vec4 albedo=texColor*uBaseColor;
    // GLB contains cutout hair/leaf surfaces; discard transparent pixels.
    if(albedo.a < 0.32)discard;
    vec3 n=normalize(vNormal);
    if(!gl_FrontFacing)n=-n;
    if(uUseNormalMap){
      vec3 dp1=dFdx(vPoint),dp2=dFdy(vPoint);
      vec2 duv1=dFdx(vUV),duv2=dFdy(vUV);
      vec3 t=dp1*duv2.y-dp2*duv1.y;
      if(dot(t,t)>0.00000001){
        t=normalize(t-n*dot(n,t));
        vec3 b=normalize(cross(n,t))*((duv1.x*duv2.y-duv1.y*duv2.x)<0.0?-1.0:1.0);
        vec3 m=texture(uNormalMap,vUV).xyz*2.0-1.0;
        n=normalize(mix(n,mat3(t,b,n)*normalize(m),0.58));
      }
    }
    vec3 light=normalize(vec3(-0.55,0.80,1.00));
    vec3 fill=normalize(vec3(0.85,0.20,-0.65));
    float diff=max(0.0,dot(n,light));
    float back=max(0.0,dot(n,fill));
    float hemi=0.65+0.12*n.y;
    float rim=pow(1.0-max(0.0,dot(n,normalize(vEye))),3.0);
    vec3 color=albedo.rgb*(hemi+0.55*diff+0.14*back)+vec3(0.045,0.045,0.028)*rim;
    // SRGB texture sampling yields linear RGB. Encode back for the canvas.
    outColor=vec4(pow(clamp(color,0.0,1.0),vec3(1.0/2.2)),1.0);
  }`;
  function compile(type,source){
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'Shader error');
    return shader;
  }
  const program=gl.createProgram();
  gl.attachShader(program,compile(gl.VERTEX_SHADER,vert));
  gl.attachShader(program,compile(gl.FRAGMENT_SHADER,frag));
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'WebGL link error');
  const U=Object.fromEntries(['uPerspective','uRotation','uCenter','uScale','uDistance','uColorMap','uNormalMap','uUseColorMap','uUseNormalMap','uBaseColor'].map(k=>[k,gl.getUniformLocation(program,k)]));
  let meshes=[],loaded=false,visible=false,dirty=true;
  let center=[0,0,0],scale=1,spin=0,tilt=0,distance=6.6,w=1,h=1;
  let drag=null,lastPinch=null;
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const observer=new ResizeObserver(resize);observer.observe(host);
  function perspective(){
    const f=1/Math.tan(35*Math.PI/360),a=w/Math.max(1,h),near=.04,far=90;
    return new Float32Array([f/a,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
  }
  function rotation(){
    const c=Math.cos(spin),s=Math.sin(spin),p=Math.cos(tilt),q=Math.sin(tilt);
    return new Float32Array([c,q*s,-p*s,0,p,q,s,-q*c,p*c]);
  }
  function resize(){
    let cw=Math.max(1,host.clientWidth),ch=Math.max(1,host.clientHeight);
    const dpr=Math.min(1.8,window.devicePixelRatio||1);
    const tw=Math.round(cw*dpr),th=Math.round(ch*dpr);
    if(tw!==w||th!==h){w=tw;h=th;canvas.width=w;canvas.height=h;canvas.style.width='100%';canvas.style.height='100%';gl.viewport(0,0,w,h);dirty=true;}
  }
  function frame(){
    requestAnimationFrame(frame);if(!visible||!loaded)return;
    resize();if(!dirty)return;dirty=false;
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.useProgram(program);
    gl.uniformMatrix4fv(U.uPerspective,false,perspective());
    gl.uniformMatrix3fv(U.uRotation,false,rotation());
    gl.uniform3fv(U.uCenter,center);
    gl.uniform1f(U.uScale,scale);gl.uniform1f(U.uDistance,distance);
    gl.uniform1i(U.uColorMap,0);gl.uniform1i(U.uNormalMap,1);
    for(const mesh of meshes){
      gl.uniform4fv(U.uBaseColor,mesh.color);
      gl.uniform1i(U.uUseColorMap,!!mesh.colorMap?1:0);
      gl.uniform1i(U.uUseNormalMap,!!mesh.normalMap?1:0);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,mesh.colorMap||null);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,mesh.normalMap||null);
      gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES,mesh.count,mesh.indexType,0);
    }
    gl.bindVertexArray(null);
  }
  requestAnimationFrame(frame);
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY};});
  canvas.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    spin+=(e.clientX-drag.x)*.012;
    tilt=clamp(tilt+(e.clientY-drag.y)*.008,-.8,.8);
    drag.x=e.clientX;drag.y=e.clientY;dirty=true;
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(k=>canvas.addEventListener(k,e=>{if(drag?.id===e.pointerId)drag=null;}));
  canvas.addEventListener('wheel',e=>{e.preventDefault();distance=clamp(distance+e.deltaY*.009,3.2,14);dirty=true;},{passive:false});
  canvas.addEventListener('touchmove',e=>{
    if(e.touches.length!==2)return;
    const a=e.touches[0],b=e.touches[1],d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
    if(lastPinch!==null)distance=clamp(distance*lastPinch/d,3.2,14);
    lastPinch=d;dirty=true;
  },{passive:true});
  canvas.addEventListener('touchend',()=>lastPinch=null);

  // Preserve direct index.html opening: model is embedded as a classic JS variable.
  function readEmbedded(){
    const encoded=window.MAMMI_GLB_BASE64;
    if(!encoded)throw new Error('Chưa tìm thấy dữ liệu 3D MamMi-data.js');
    const chunkSize=524288;
    const n=encoded.length/4*3-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0);
    const dst=new Uint8Array(n);let at=0;
    for(let i=0;i<encoded.length;i+=chunkSize){
      const piece=atob(encoded.slice(i,i+chunkSize));
      for(let p=0;p<piece.length;p++)dst[at++]=piece.charCodeAt(p);
    }
    return dst.buffer;
  }
  function unpack(buffer){
    const dv=new DataView(buffer);
    if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2)throw new Error('GLB không hợp lệ');
    let json=null,binBase=-1;
    for(let pos=12;pos+8<=buffer.byteLength;){
      const len=dv.getUint32(pos,true),type=dv.getUint32(pos+4,true),start=pos+8;
      if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,start,len)));
      if(type===0x004e4942)binBase=start;
      pos=start+len;
    }
    if(!json||binBase<0)throw new Error('GLB thiếu JSON hoặc binary');
    const getView=(id)=>{
      const v=json.bufferViews[id];return new Uint8Array(buffer,binBase+(v.byteOffset||0),v.byteLength);
    };
    const accessor=(id)=>{
      const a=json.accessors[id],v=json.bufferViews[a.bufferView];
      const comps=({SCALAR:1,VEC2:2,VEC3:3,VEC4:4})[a.type];
      const ctor=({5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array})[a.componentType];
      if(!ctor||!comps)throw new Error('GLB có kiểu dữ liệu đỉnh không hỗ trợ');
      const bytes=ctor.BYTES_PER_ELEMENT,offset=binBase+(v.byteOffset||0)+(a.byteOffset||0);
      if(!v.byteStride||v.byteStride===comps*bytes){
        if(offset%bytes===0)return new ctor(buffer,offset,a.count*comps);
        return new ctor(new Uint8Array(buffer,offset,a.count*comps*bytes).slice().buffer);
      }
      const out=new ctor(a.count*comps);
      for(let i=0;i<a.count;i++){
        const base=offset+i*v.byteStride;
        const read=new DataView(buffer,base,comps*bytes);
        for(let k=0;k<comps;k++)out[i*comps+k]=a.componentType===5126?read.getFloat32(k*bytes,true):a.componentType===5125?read.getUint32(k*bytes,true):a.componentType===5123?read.getUint16(k*bytes,true):read.getUint8(k);
      }
      return out;
    };
    return {json,getView,accessor};
  }
  const qrotate=(v,q)=>{
    const [x,y,z,w]=q;
    const t=[2*(y*v[2]-z*v[1]),2*(z*v[0]-x*v[2]),2*(x*v[1]-y*v[0])];
    return [v[0]+w*t[0]+y*t[2]-z*t[1],v[1]+w*t[1]+z*t[0]-x*t[2],v[2]+w*t[2]+x*t[1]-y*t[0]];
  };
  function bufferData(target,array){const buf=gl.createBuffer();gl.bindBuffer(target,buf);gl.bufferData(target,array,gl.STATIC_DRAW);return buf;}
  async function load(url){
    let binary;
    if(location.protocol==='file:'&&window.MAMMI_GLB_BASE64)binary=readEmbedded();
    else{
      try{
        const response=await fetch(url,{cache:'no-cache'});
        if(!response.ok)throw new Error('HTTP '+response.status);
        binary=await response.arrayBuffer();
      }catch(e){if(!window.MAMMI_GLB_BASE64)throw e;binary=readEmbedded();}
    }
    const {json,getView,accessor}=unpack(binary);
    const textures=[];
    // Decode embedded PNGs via Blob; no network / local-file fetching required.
    async function glTexture(textureIndex,srgb){
      if(textureIndex===undefined||textureIndex===null)return null;
      const key=textureIndex+':'+srgb;
      if(textures[key])return textures[key];
      const texInfo=json.textures?.[textureIndex];if(!texInfo)return null;
      const source=json.images?.[texInfo.source];if(source?.bufferView===undefined)return null;
      const bytes=getView(source.bufferView);
      const blob=new Blob([bytes],{type:source.mimeType||'image/png'});
      const bitmap=await createImageBitmap(blob,{premultiplyAlpha:'none',colorSpaceConversion:'none'});
      const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,srgb?gl.SRGB8_ALPHA8:gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      bitmap.close?.();textures[key]=tex;
      return tex;
    }
    const boundsMin=[Infinity,Infinity,Infinity],boundsMax=[-Infinity,-Infinity,-Infinity];
    const entries=[];
    // Nodes reference distinct meshes, some with rotation and translation.
    for(const node of json.nodes||[]){
      if(node.mesh===undefined)continue;
      const q=node.rotation||[0,0,0,1],tr=node.translation||[0,0,0],factor=node.scale||[1,1,1];
      for(const primitive of json.meshes[node.mesh].primitives){
        const pos=accessor(primitive.attributes.POSITION);
        const normals=primitive.attributes.NORMAL===undefined?null:accessor(primitive.attributes.NORMAL);
        const uv=primitive.attributes.TEXCOORD_0===undefined?new Float32Array(pos.length/3*2):accessor(primitive.attributes.TEXCOORD_0);
        const faces=accessor(primitive.indices);
        if(!normals)throw new Error('Mô hình thiếu NORMAL ở một mesh');
        const outPos=new Float32Array(pos.length),outNormal=new Float32Array(normals.length);
        for(let i=0;i<pos.length;i+=3){
          const p=qrotate([pos[i]*factor[0],pos[i+1]*factor[1],pos[i+2]*factor[2]],q);
          for(let k=0;k<3;k++){const n=p[k]+tr[k];outPos[i+k]=n;boundsMin[k]=Math.min(boundsMin[k],n);boundsMax[k]=Math.max(boundsMax[k],n);}
          const n=qrotate([normals[i]/factor[0],normals[i+1]/factor[1],normals[i+2]/factor[2]],q);
          const mag=Math.hypot(...n)||1;
          for(let k=0;k<3;k++)outNormal[i+k]=n[k]/mag;
        }
        entries.push({pos:outPos,normals:outNormal,uv,faces,material:json.materials?.[primitive.material]||{}});
      }
    }
    if(!entries.length)throw new Error('Không tìm được mesh nào trong GLB');
    for(const entry of meshes){gl.deleteVertexArray(entry.vao);for(const b of entry.buffers)gl.deleteBuffer(b);}
    meshes=[];
    for(const entry of entries){
      const vao=gl.createVertexArray();gl.bindVertexArray(vao);
      const bp=bufferData(gl.ARRAY_BUFFER,entry.pos);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
      const bn=bufferData(gl.ARRAY_BUFFER,entry.normals);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);
      const bt=bufferData(gl.ARRAY_BUFFER,entry.uv);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.FLOAT,false,0,0);
      const bi=bufferData(gl.ELEMENT_ARRAY_BUFFER,entry.faces);
      gl.bindVertexArray(null);
      const mat=entry.material,pbr=mat.pbrMetallicRoughness||{};
      const colorMap=await glTexture(pbr.baseColorTexture?.index,true);
      const normalMap=await glTexture(mat.normalTexture?.index,false);
      meshes.push({vao,buffers:[bp,bn,bt,bi],count:entry.faces.length,indexType:entry.faces instanceof Uint32Array?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,color:pbr.baseColorFactor||[1,1,1,1],colorMap,normalMap});
    }
    center=boundsMin.map((v,i)=>(v+boundsMax[i])/2);
    const extent=Math.max(...boundsMax.map((v,i)=>v-boundsMin[i]));
    scale=3.40/Math.max(extent,0.001);
    loaded=true;setView(0);dirty=true;
  }
  function setView(view){spin=[0,Math.PI,-Math.PI/2,Math.PI/2][view]||0;tilt=0;dirty=true;}
  function show(){host.hidden=false;visible=true;resize();dirty=true;}
  function hide(){visible=false;host.hidden=true;}
  return {load,setView,show,hide};
}
window.createMamMiViewer=createMamMiViewer;
