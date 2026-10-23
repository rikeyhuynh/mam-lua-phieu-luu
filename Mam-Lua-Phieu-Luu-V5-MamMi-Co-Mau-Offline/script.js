(() => {
  'use strict';
  const $ = (selector, scope=document) => scope.querySelector(selector);
  const $$ = (selector, scope=document) => [...scope.querySelectorAll(selector)];
  const byId = id => document.getElementById(id);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Page navigation and motion-safe reveals
  const header = byId('siteHeader');
  const bar = byId('progressBar');
  const onScroll = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    bar.style.width = `${Math.min(100, scrollY / max * 100)}%`;
    header.classList.toggle('scrolled', scrollY > 42);
  };
  document.addEventListener('scroll', onScroll, {passive:true}); onScroll();
  const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {if (entry.isIntersecting) {entry.target.classList.add('in-view'); revealObserver.unobserve(entry.target);}});
  }, {threshold:.08, rootMargin:'0px 0px 40px 0px'}) : null;
  $$('.reveal').forEach(el => revealObserver ? revealObserver.observe(el) : el.classList.add('in-view'));
  const sectionObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => { if(entry.isIntersecting) { const id = entry.target.id; $$('.main-nav a').forEach(a=>a.classList.toggle('active', a.getAttribute('href')===`#${id}`)); }});
  }, {rootMargin:'-20% 0px -65% 0px'}) : null;
  $$('main section[id]').forEach(s => sectionObserver?.observe(s));
  const nav = byId('mainNav'), menuButton = byId('mobileToggle');
  menuButton.addEventListener('click', () => {
    const opening = !nav.classList.contains('open');
    nav.classList.toggle('open', opening);
    menuButton.setAttribute('aria-expanded', String(opening));
    menuButton.setAttribute('aria-label', opening ? 'Đóng menu' : 'Mở menu');
  });
  $$('#mainNav a').forEach(a=>a.addEventListener('click',()=> {nav.classList.remove('open');menuButton.setAttribute('aria-expanded','false');}));
  window.addEventListener('resize',()=>{if(innerWidth>920) {nav.classList.remove('open');menuButton.setAttribute('aria-expanded','false');}});
  if (!reduced && matchMedia('(pointer:fine)').matches) {
    const bg=byId('heroBg');
    let px=0,py=0,raf=0;
    $('.hero').addEventListener('pointermove', e=>{
      const rect=e.currentTarget.getBoundingClientRect();
      px=(e.clientX-rect.left-rect.width/2)/rect.width;
      py=(e.clientY-rect.top-rect.height/2)/rect.height;
      if (!raf) raf=requestAnimationFrame(()=>{bg.style.transform=`scale(1.055) translate(${(-px*9).toFixed(1)}px,${(-py*7).toFixed(1)}px)`;raf=0;});
    }, {passive:true});
  }

  // Actual project environments, not fabricated playable game scenes.
  const scenes = [
    {title:'Con đường phía trước',description:'Góc nhìn chính diện, đặt tuyến đường chạy làm trục thị giác giữa ruộng đồng.',src:'assets/scene-center.webp',alt:'Đường chạy và cây cối nhìn trực diện'},
    {title:'Vùng ruộng nước',description:'Góc chéo thứ nhất thể hiện đường đất, bờ ruộng và mảng nước xanh.',src:'assets/scene-left.webp',alt:'Phối cảnh chéo bờ ruộng nước'},
    {title:'Lối đi giữa đồng',description:'Góc chéo thứ hai tập trung vào tán cây, bờ đường và chiều sâu của cảnh quan.',src:'assets/scene-right.webp',alt:'Phối cảnh chéo qua tán cây bên ruộng'}
  ];
  let sceneIndex=0, sceneToken=0;
  function setScene(index){
    sceneIndex=(index+scenes.length)%scenes.length;
    const data=scenes[sceneIndex],img=byId('sceneImage'),token=++sceneToken;
    img.classList.add('changing');
    const prefetch=new Image();prefetch.onload=()=>{
      if (token!==sceneToken) return;
      img.src=data.src;img.alt=data.alt;
      requestAnimationFrame(()=>img.classList.remove('changing'));
    };prefetch.onerror=()=>{if(token===sceneToken){img.src=data.src;img.classList.remove('changing');}};
    prefetch.src=data.src;
    byId('sceneCounter').textContent=`0${sceneIndex+1} / 03`;
    byId('sceneTitle').textContent=data.title;
    byId('sceneDesc').textContent=data.description;
    $$('.scene-btn').forEach((button,i)=>{const active=i===sceneIndex;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  }
  $$('.scene-btn').forEach(button=>button.addEventListener('click',()=>setScene(Number(button.dataset.scene))));
  byId('prevScene').addEventListener('click',()=>setScene(sceneIndex-1));
  byId('nextScene').addEventListener('click',()=>setScene(sceneIndex+1));
  $('.scene-viewer').addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();setScene(sceneIndex+(event.key==='ArrowRight'?1:-1));}
  });

  // Rendered images are available even without a 3D source. Models can be dropped
  // into Assets/MamMi.glb (or any of the supported common formats listed below).
  const viewList=[
    {name:'CHÍNH DIỆN',key:'front'},
    {name:'PHÍA SAU',key:'back'},
    {name:'NGHIÊNG TRÁI',key:'side-left'},
    {name:'NGHIÊNG PHẢI',key:'side-right'}
  ];
  let currentModel='2d', currentView=0,viewToken=0,modelToken=0;
  const charStage=byId('characterStage'),modelHost=byId('model3dHost');
  const modelNotice=byId('model3dNotice');
  let active3DViewer=null,modelFilePromise=null,loaded3DPath=null;
  const supported3D=['glb','gltf','fbx','obj','stl','ply','dae','3ds'];
  const modelCandidates=['Assets','assets'].flatMap(folder=>supported3D.map(ext=>`${folder}/MamMi.${ext}`));
  const noticeModel=(message)=>{modelNotice.hidden=!message;modelNotice.textContent=message;};
  async function find3DFile(){
    // Offline fallback is bundled as classic JS so index.html works directly.
    if(location.protocol==='file:' && window.MAMMI_GLB_BASE64)return 'Assets/MamMi.glb';
    // The browser cannot list a static server directory. Probe exact filename and extensions.
    for(const path of modelCandidates){
      try{
        const resp=await fetch(path,{method:'HEAD',cache:'no-store'});
        const ct=(resp.headers.get('content-type')||'').toLowerCase();
        if(resp.ok&&!ct.includes('text/html')) return path;
      }catch(err){/* file:// or network restrictions; keep the image fallback */}
    }
    return null;
  }
  async function enter3D(token){
    const previousNotice='ĐANG TÌM MÔ HÌNH MamMi TRONG Assets/…';
    noticeModel(previousNotice);
    if(!modelFilePromise) modelFilePromise=find3DFile();
    const path=await modelFilePromise;
    if(token!==modelToken||currentModel!=='3d')return;
    if(!path){
      noticeModel('Không tìm thấy MamMi. Vui lòng giữ nguyên thư mục Assets khi giải nén ZIP; hoặc tải lại bản website đầy đủ.');
      return;
    }
    noticeModel(`ĐANG NẠP MÔ HÌNH ${path.split('/').pop()}…`);
    try{
      let buildViewer;
      if(path.toLowerCase().endsWith('.glb')){
        buildViewer=window.createMamMiViewer;
        if(typeof buildViewer!=='function')throw new Error('Thiếu viewer3d-local.js');
      }else{
        if(location.protocol==='file:')throw new Error('Để dùng định dạng này, hãy chuyển model sang GLB hoặc mở website qua máy chủ.');
        const mod=await import('./viewer3d.js');
        buildViewer=mod.createMamMiViewer;
      }
      if(token!==modelToken||currentModel!=='3d')return;
      if(!active3DViewer)active3DViewer=buildViewer(modelHost);
      if(loaded3DPath!==path){
        await active3DViewer.load(path);
        loaded3DPath=path;
      }
      if(token!==modelToken||currentModel!=='3d')return;
      modelHost.hidden=false;
      charStage.classList.add('real-model-active');
      active3DViewer.show();
      active3DViewer.setView(currentView);
      noticeModel('');
      byId('characterSourceText').textContent='REAL-TIME 3D / '+path.split('/').pop();
      byId('characterGesture').textContent='KÉO ĐỂ XOAY · CUỘN ĐỂ THU PHÓNG';
      byId('characterHint').textContent='XOAY MÔ HÌNH 3D';
    }catch(err){
      console.error('Không tải được MamMi 3D:',err);
      if(token!==modelToken)return;
      active3DViewer?.hide();
      modelHost.hidden=true;
      charStage.classList.remove('real-model-active');
      noticeModel('Không thể hiển thị mô hình 3D: '+(err?.message||'Lỗi không xác định')+'. Hãy mở bằng Chrome/Edge và đảm bảo đã bật tăng tốc đồ họa.');
    }
  }
  function changeCharacter(model=currentModel,idx=currentView){
    currentModel=model;currentView=(idx+4)%4;
    const img=byId('characterView'),stage=charStage;
    const source=`assets/mammmi-${model==='3d'?'3d-':''}${viewList[currentView].key}.webp`;
    const token=++viewToken;
    img.classList.add('changing');
    const prefetch=new Image();prefetch.onload=()=>{
      if(token!==viewToken)return;
      img.src=source;img.alt=`Mầm Mí ${model.toUpperCase()} — ${viewList[currentView].name.toLowerCase()}`;
      stage.classList.toggle('is-3d',model==='3d');
      requestAnimationFrame(()=>img.classList.remove('changing'));
    };prefetch.onerror=()=>{if(token===viewToken)img.classList.remove('changing');};prefetch.src=source;
    byId('viewName').textContent=viewList[currentView].name;
    $$('[data-model]').forEach(b=>{const active=b.dataset.model===model;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    $$('[data-view]').forEach(b=>{const active=Number(b.dataset.view)===currentView;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    if(model==='3d'){
      if(active3DViewer&&loaded3DPath){active3DViewer.setView(currentView); active3DViewer.show();modelHost.hidden=false; stage.classList.add('real-model-active'); noticeModel('');}
      else enter3D(++modelToken);
    }else{
      ++modelToken;
      stage.classList.remove('real-model-active');
      modelHost.hidden=true;
      active3DViewer?.hide();
      noticeModel('');
      byId('characterSourceText').textContent='ORIGINAL CHARACTER DESIGN';
      byId('characterGesture').textContent='VUỐT / ← → ĐỂ ĐỔI GÓC';
      byId('characterHint').textContent='ĐỔI GÓC NHÌN';
    }
  }
  $$('[data-model]').forEach(btn=>btn.addEventListener('click',()=>changeCharacter(btn.dataset.model)));
  $$('[data-view]').forEach(btn=>btn.addEventListener('click',()=>changeCharacter(currentModel,Number(btn.dataset.view))));
  charStage.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
      e.preventDefault();changeCharacter(currentModel,currentView+(e.key==='ArrowRight'?1:-1));
    }
  });
  let dragX=null;
  charStage.addEventListener('pointerdown',e=>{if(e.target.closest('button')||charStage.classList.contains('real-model-active'))return;dragX=e.clientX;});
  charStage.addEventListener('pointerup',e=>{if(dragX!==null){let diff=e.clientX-dragX;if(Math.abs(diff)>30)changeCharacter(currentModel,currentView+(diff<0?1:-1));dragX=null;}});
  charStage.addEventListener('pointercancel',()=>dragX=null);

  // Infinite runner: keep a persistent lane and replay a movement only once.
  // Lane index 0=left, 1=center, 2=right. Never reset lane after an action.
  const motionFrames={run:4,left:3,right:3,jump:5};
  const laneNames=['LÀN TRÁI','LÀN GIỮA','LÀN PHẢI'];
  let lane=1,activeAction='run',motionFrame=0,actionTimeout=null;
  const motionCanvas=byId('motionCanvas'),motionTrack=byId('motionTrack');
  const motionPlayer=byId('motionPlayer'),motionImage=byId('motionImage');
  const runnerStatus=byId('runnerStatus');
  function updateLaneUI(){
    motionPlayer.dataset.lane=String(lane);
    byId('laneName').textContent=laneNames[lane];
    byId('motionCanvasLane').textContent=laneNames[lane];
    $$('.lane-indicator span').forEach((indicator,i)=>indicator.classList.toggle('active',i===lane));
    byId('runLeft').disabled=lane===0;
    byId('runRight').disabled=lane===2;
  }
  function renderMotion(){
    motionImage.src=`assets/${activeAction}-${motionFrame+1}.webp`;
    byId('frameLabel').textContent=`${activeAction.toUpperCase()} / ${String(motionFrame+1).padStart(2,'0')}`;
    motionImage.alt=`Mầm Mí ${activeAction==='run'?'đang chạy':activeAction==='jump'?'đang nhảy':`đang chuyển ${activeAction==='left'?'trái':'phải'}`} ở ${laneNames[lane].toLowerCase()}`;
  }
  function finishAction(){
    activeAction='run'; motionFrame=0;
    motionPlayer.classList.remove('is-jumping');
    runnerStatus.textContent='ĐANG CHẠY LIÊN TỤC';
    renderMotion();
  }
  function doAction(action){
    if(activeAction!=='run')return;
    if(action==='left'&&lane===0)return;
    if(action==='right'&&lane===2)return;
    activeAction=action;
    motionFrame=0;
    if(action==='left')lane--;
    if(action==='right')lane++;
    updateLaneUI();
    // Restart jump arc for each discrete jump, without changing lanes.
    if(action==='jump'){
      motionPlayer.classList.remove('is-jumping');
      void motionPlayer.offsetWidth;
      motionPlayer.classList.add('is-jumping');
    }
    const message=action==='jump'?'ĐANG NHẢY':action==='left'?'ĐANG SANG TRÁI':'ĐANG SANG PHẢI';
    runnerStatus.textContent=message;
    renderMotion();
    clearTimeout(actionTimeout);
    actionTimeout=setTimeout(finishAction,action==='jump'?820:560);
  }
  $$('[data-run-action]').forEach(btn=>btn.addEventListener('click',()=>doAction(btn.dataset.runAction)));
  updateLaneUI();
  setInterval(()=>{
    if(document.hidden)return;
    motionFrame=(motionFrame+1)%motionFrames[activeAction];
    renderMotion();
  },165);

  // Animate original supplied vertical running-track artwork in a seamless scroll loop.
  // A full repeat is exactly the displayed image height (1080 × 1920 source).
  let trackY=0,lastFrame=0;
  function scrollTrack(time){
    const delta=lastFrame?Math.min(75,time-lastFrame):0; lastFrame=time;
    if(!reduced&&!document.hidden){
      const tileHeight=motionTrack.clientWidth*(1920/1080);
      trackY=(trackY+delta*.115)%Math.max(1,tileHeight);
      motionTrack.style.backgroundPosition=`center ${trackY.toFixed(2)}px`;
    }
    requestAnimationFrame(scrollTrack);
  }
  requestAnimationFrame(scrollTrack);
  motionCanvas.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='ArrowUp'){
      e.preventDefault();e.stopPropagation();
      doAction(e.key==='ArrowLeft'?'left':e.key==='ArrowRight'?'right':'jump');
    }
  });
  document.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp'].includes(e.key))return;
    if(e.altKey||e.ctrlKey||e.metaKey||e.repeat)return;
    if(e.target.closest('input,textarea,select,dialog,[contenteditable],#characterStage,.scene-viewer'))return;
    const box=motionCanvas.getBoundingClientRect();
    if(box.top>innerHeight*.7||box.bottom<innerHeight*.25)return;
    e.preventDefault();doAction(e.key==='ArrowLeft'?'left':e.key==='ArrowRight'?'right':'jump');
  });
  let startX=0,startY=0;
  motionCanvas.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;
    startX=e.touches[0].clientX;startY=e.touches[0].clientY;
  },{passive:true});
  motionCanvas.addEventListener('touchend',e=>{
    if(e.changedTouches.length!==1)return;
    const dx=e.changedTouches[0].clientX-startX,dy=e.changedTouches[0].clientY-startY;
    if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))doAction(dx<0?'left':'right');
    else if(dy< -45&&Math.abs(dy)>Math.abs(dx))doAction('jump');
  },{passive:true});

  // Gallery categories and full-size accessible dialog.
  const artworks=[
    {title:'Nhân vật Mầm Mí',category:'CHARACTER / 2D',group:'character',src:'assets/mammmi-front.webp',description:'Thiết kế hoàn thiện của Mầm Mí ở góc nhìn chính diện.'},
    {title:'Environment Explorer',category:'ENVIRONMENT / 3D',group:'environment',src:'assets/scene-center.webp',description:'Đường chạy chính trong không gian đồng ruộng.'},
    {title:'Character Turnaround',category:'CHARACTER / 2D',group:'character',src:'assets/character-sheet.webp',description:'Các góc nhìn của nhân vật giúp khóa thống nhất tạo hình.'},
    {title:'Biểu cảm Mầm Mí',category:'ANIMATION / 2D',group:'character',src:'assets/emotion-1.webp',description:'Nghiên cứu cử chỉ và sắc thái biểu cảm của nhân vật.'},
    {title:'Modeling & Topology',category:'3D / WORKFLOW',group:'3d',src:'assets/poly-studies.webp',description:'Đối chiếu các phương án dựng hình, bao gồm high poly, wireframe và low poly.'},
    {title:'Phối cảnh đồng quê',category:'ENVIRONMENT / ART',group:'environment',src:'assets/scene-left.webp',description:'Một trong các góc nhìn môi trường dành cho tuyến đường chạy.'},
    {title:'Đồ họa vật phẩm',category:'3D / ASSETS',group:'3d',src:'assets/collectibles-3d.webp',description:'Bộ vật phẩm thu thập và chướng ngại như rào, giọt nước, mặt trời, bông lúa, thùng gỗ.'},
    {title:'UI Game World',category:'UI / BRANDING',group:'design',src:'assets/ui-board.webp',description:'Hệ giao diện trò chơi gồm màn hình chọn cấp độ, vật phẩm và thông báo.'},
    {title:'3D Character Development',category:'3D / CHARACTER',group:'3d',src:'assets/character-studies-3d.webp',description:'Tiến trình phát triển mẫu nhân vật từ dạng thử đến hình ảnh hoàn thiện.'},
    {title:'Visual Moodboard',category:'ART DIRECTION',group:'design',src:'assets/moodboard.webp',description:'Tổng hợp nguồn cảm hứng về sắc màu và chất liệu nông nghiệp Việt Nam.'},
    {title:'UV Mapping',category:'3D / TEXTURING',group:'3d',src:'assets/uv-mapping.webp',description:'Nghiên cứu và bố trí UV cho vật liệu nhân vật.'},
    {title:'Bảng màu của thế giới Mầm Lúa',category:'VISUAL IDENTITY',group:'design',src:'assets/palette.webp',description:'Bảng màu định hướng: xanh lá, vàng lúa, nâu đất, xanh nước và kem gạo.'},
    {title:'Hệ thống chuyển động 3D',category:'3D / ANIMATION',group:'3d',src:'assets/animation-3d.webp',description:'Bộ tư thế hành động của nhân vật 3D phục vụ nghiên cứu hoạt ảnh.'},
    {title:'Environment Design',category:'ENVIRONMENT / STUDY',group:'environment',src:'assets/environment-3d.webp',description:'Các góc phối cảnh 3D của môi trường trò chơi.'},
    {title:'Run Cycle',category:'ANIMATION / 2D',group:'character',src:'assets/run-2.webp',description:'Một key frame từ chuỗi chuyển động chạy nhìn từ phía sau.'}
  ];
  const grid=byId('galleryGrid');let filter='all';let visibleArt=[];let lightboxIndex=0;
  const dialog=byId('lightbox');
  function galleryHTML(item,index){return `<article class="gallery-card" tabindex="0" role="button" aria-label="Xem ${item.title}" data-art="${index}"><div class="gallery-card-image"><span class="gallery-badge">${item.category}</span><img src="${item.src}" loading="lazy" alt="${item.title}"><span class="gallery-open" aria-hidden="true">↗</span></div><div class="gallery-card-caption"><div><h3>${item.title}</h3><span>ARTBOOK / MẦM LÚA PHIÊU LƯU</span></div><span aria-hidden="true">↗</span></div></article>`;}
  function paintGallery(){
    visibleArt=artworks.filter(item=>filter==='all'||item.group===filter);
    grid.innerHTML=visibleArt.map(galleryHTML).join('');
    byId('galleryCount').textContent=`${String(visibleArt.length).padStart(2,'0')} TÁC PHẨM`;
  }
  $$('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{
    filter=btn.dataset.filter;
    $$('[data-filter]').forEach(b=>{const selected=b===btn;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
    paintGallery();
  }));
  function updateLightbox(){
    const artwork=visibleArt[lightboxIndex];if(!artwork)return;
    byId('lightboxImage').src=artwork.src;byId('lightboxImage').alt=artwork.title;
    byId('lightboxCategory').textContent=artwork.category;
    byId('lightboxTitle').textContent=artwork.title;
    byId('lightboxDescription').textContent=artwork.description;
  }
  function openArtwork(index){lightboxIndex=index;updateLightbox();dialog.showModal();document.body.classList.add('dialog-open');}
  function moveArtwork(delta){lightboxIndex=(lightboxIndex+delta+visibleArt.length)%visibleArt.length;updateLightbox();}
  grid.addEventListener('click',e=>{const card=e.target.closest('[data-art]');if(card)openArtwork(Number(card.dataset.art));});
  grid.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const card=e.target.closest('[data-art]');if(card){e.preventDefault();openArtwork(Number(card.dataset.art));}});
  byId('closeLightbox').addEventListener('click',()=>dialog.close());
  byId('prevGallery').addEventListener('click',()=>moveArtwork(-1));
  byId('nextGallery').addEventListener('click',()=>moveArtwork(1));
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>document.body.classList.remove('dialog-open'));
  dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();moveArtwork(-1);}else if(e.key==='ArrowRight'){e.preventDefault();moveArtwork(1);}});
  paintGallery();
})();
