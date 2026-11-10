/* A finite, event-driven SVG scene. Wheel input scrolls a native horizontal viewport. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 760px)');
  const coarse = matchMedia('(pointer: coarse)');
  let quiet = reduce.matches;
  let preference = null;
  try { preference = localStorage.getItem('diagram-quiet'); } catch { /* Storage is optional. */ }
  if (preference === 'true') quiet = true;
  // A system request to reduce motion always takes precedence over a stored "false".
  root.classList.add('enhanced');
  root.classList.toggle('quiet', quiet);

  // Details remain ordinary links when JS or <dialog> is unavailable.
  for (const link of document.querySelectorAll('[data-panel]')) {
    link.addEventListener('click', event => {
      const dialog = document.getElementById(`panel-${link.dataset.panel}`);
      if (!dialog?.showModal || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if(journey)stopScroll();
      const previous = link.closest('dialog');
      if(previous && previous !== dialog) previous.close();
      dialog.showModal();
      dialog.scrollTop = 0;
    });
  }
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  }

  for (const section of document.querySelectorAll('.experiment')) {
    const toggle = section.querySelector('.symmetry-toggle');
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const identity = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', String(identity));
      section.querySelector('.double-cross').toggleAttribute('hidden', identity);
      section.querySelector('.identity-wires').toggleAttribute('hidden', !identity);
      section.querySelector('.symmetry-diagram').setAttribute('aria-label', identity ? 'AとBの恒等射。対象の並びは変わりません' : 'AとBの2回の対称性。始点と終点で対象の並びは変わりません');
      toggle.textContent = identity ? '2回の対称性に戻す ↔' : '恒等射に切り替える ↔';
    });
  }

  const journey=document.querySelector('.journey');
  if(!journey || !window.DiagramModel) return;
  const model=new DiagramModel();model.randomizeInitialBoxes();let previousInitial='';
  try{previousInitial=sessionStorage.getItem('diagram-initial-word')||'';}catch{}
  model.randomizeInitialWord(Math.random,previousInitial);
  try{sessionStorage.setItem('diagram-initial-word',JSON.stringify(model.word()));}catch{}
  const initialState=model.snapshot();let invariant=model.signature();
  const viewport=journey.querySelector('.diagram-viewport');
  const world=journey.querySelector('.diagram-world');
  const svg=journey.querySelector('.strings');
  const intro=journey.querySelector('.intro');
  const cameraContainers=[document.querySelector('main'),journey,journey.querySelector('.scene')];
  function lockCanvas(){for(const el of cameraContainers){if(el.scrollTop)el.scrollTop=0;if(el.scrollLeft)el.scrollLeft=0;}}
  document.addEventListener('scroll',event=>{if(cameraContainers.includes(event.target))lockCanvas();},true);
  const status=document.getElementById('diagram-status');
  const staticInput=document.getElementById('static-mode');
  const tabs=[...journey.querySelectorAll('[data-travel]')];
  const nodes=new Map([...journey.querySelectorAll('[data-node]')].map(el=>[el.dataset.node,el]));
  const handles=new Map(),pairBadges=new Map();
  const selected=new Set();
  let composeMode=false,pairPlacement=false,pairCandidate=null,wordMode=false,pairReturnWord=false;
  let wordDraft=[],wordKey=null,wordCursor=null,wordDrag=null,wordDragFrame=0,wordSuppressClickUntil=0;
  let svgStart=0,svgEnd=2400;
  const leafOrder=tabs.map(tab=>tab.dataset.travel);
  const undo=[],redo=[];
  let geometry,offset=0,width=3700,maxTravel=0,frame=0,scrollFrame=0,panFrame=0;
  let dragging=null,keyboard=null,hover=null,hoverTarget=null;
  let hoverFrame=0,sFrame=0,scrollTarget=0,scrollTime=0;
  const motion=new DiagramMotion();
  let motionFrame=0,lastMotionTime=0,motionFrames=0;
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  const mobileFirst=()=>clamp(innerHeight*.57,334,375);
  const scale=()=>mobile.matches ? (innerHeight<=750?clamp((innerHeight-128-mobileFirst())/(DiagramModel.ROWS[DiagramModel.ROWS.length-1]-DiagramModel.ROWS[0]),.4,.8):.75) : (innerHeight<=800?clamp((innerHeight-280)/522,.25,1):1);
  const announce=message=>{status.textContent=message;};
  for(const el of journey.querySelectorAll('[hidden]')) el.hidden=false;
  document.querySelector('.motion-setting').hidden=false;
  journey.querySelector('.word-dock').hidden=true;journey.querySelector('.composition-dock').hidden=true;journey.querySelector('.placement-hint').hidden=true;world.querySelector('.pair-preview').hidden=true;
  staticInput.checked=quiet;

  function historyUI() {
    journey.querySelector('[data-action="undo"]').disabled=!undo.length;
    journey.querySelector('[data-action="redo"]').disabled=!redo.length;
    journey.querySelector('[data-action=word]').setAttribute('aria-pressed',String(wordMode));
    journey.querySelector('[data-word-braid]').disabled=model.braidIndex()<0||JSON.stringify(wordDraft)!==wordKey;
    const pair=journey.querySelector('[data-action="pair"]');
    pair.setAttribute('aria-pressed',String(pairPlacement));pair.disabled=model.crossings.length+2>DiagramModel.MAX_CROSSINGS;
    pair.textContent='σ² を置く';
    journey.querySelector('[data-action=compose]').setAttribute('aria-pressed',String(composeMode));
    updateSelection();
  }
  function commit(before,message,changesMeaning=false) {
    if(!changesMeaning&&model.signature()!==invariant) {
      model.restore(before); render();
      announce('接続の整合性を保つため、この操作を取り消しました。');
      return;
    }
    if(JSON.stringify(before)!==JSON.stringify(model.snapshot())) {
      undo.push(before);if(undo.length>40)undo.shift();redo.length=0;
    }
    invariant=model.signature();historyUI();announce(message);
  }
  function restoreHistory(from,to) {
    if(!from.length || dragging)return;
    keyboard=null;to.push(model.snapshot());model.restore(from.pop());invariant=model.signature();render();historyUI();
    announce(from===undo?'操作をひとつ戻しました。':'操作をやり直しました。');
  }
  function path(points) {
    // Only rasterize a viewport-sized SVG. Long words extend the HTML canvas,
    // never the filtered tube bitmap to the full tens-of-thousands-pixel width.
    const sample=x=>{for(let i=1;i<points.length;i++)if(points[i][0]>=x){const a=points[i-1],b=points[i],t=clamp((x-a[0])/Math.max(.001,b[0]-a[0]),0,1);return [x,a[1]+(b[1]-a[1])*t,b[2]];}return [x,points[points.length-1][1]];};
    const clipped=[sample(svgStart),...points.filter(p=>p[0]>svgStart&&p[0]<svgEnd),sample(svgEnd)];
    const mapped=clipped.map(([x,y,mode])=>[x-svgStart,y*scale(),mode]);
    const rounds=new Map();
    for(let i=2;i<mapped.length-1;i++){
      const a=mapped[i-1],p=mapped[i],dx=p[0]-a[0],dy=p[1]-a[1];
      if(p[2]!=='line'||dx<=0||Math.abs(dy)<.000001)continue;
      const entry=Math.min(26,Math.max(0,(a[0]-mapped[i-2][0])*.45),dx*.2),exit=Math.min(26,Math.max(0,(mapped[i+1][0]-p[0])*.45),dx*.2);
      if(entry||exit)rounds.set(i,{entry,exit,slope:dy/dx,start:[a[0]-entry,a[1]]});
    }
    let d=`M${mapped[0][0]} ${mapped[0][1]}`,cursor=mapped[0];
    for(let i=1;i<mapped.length;i++){
      const p=mapped[i],a=mapped[i-1],round=rounds.get(i);
      if(round){
        const {entry,exit,slope}=round;
        d+=` Q${a[0]} ${a[1]} ${a[0]+entry} ${a[1]+slope*entry} L${p[0]-exit} ${p[1]-slope*exit} Q${p[0]} ${p[1]} ${p[0]+exit} ${p[1]}`;
        cursor=[p[0]+exit,p[1]];
      }else{
        const target=rounds.get(i+1)?.start||p,mid=(cursor[0]+target[0])/2;
        d+=p[2]==='line'?` L${target[0]} ${target[1]}`:` C${mid} ${cursor[1]} ${mid} ${target[1]} ${target[0]} ${target[1]}`;
        cursor=target;
      }
    }
    return d;
  }

  function soften(points) {
    if(!hover || quiet || dragging)return points;
    for(let i=0;i<points.length-1;i++) {
      const [a,b]=[points[i],points[i+1]];
      if(b[2]!=='line' && a[0]>=geometry.ordered[0].right && b[0]<=geometry.ordered[geometry.ordered.length-1].left && b[0]-a[0]>300 && a[1]===b[1] && hover.x>a[0]+90 && hover.x<b[0]-90 && Math.abs(hover.y-a[1])<100) {
        const y=a[1]+clamp((hover.y-a[1])*.65,-24,24)*(hover.strength||0);
        return [...points.slice(0,i+1),[hover.x-90,a[1]],[hover.x,y],[hover.x+90,a[1]],...points.slice(i+1)];
      }
    }
    return points;
  }
  function render() {
    frame=0;
    geometry=model.layout(mobile.matches?95:106);
    syncNodes();
    width=Math.max(width,geometry.width-offset);
    world.style.width=`${width}px`;
    maxTravel=Math.max(0,width-viewport.clientWidth);
    for(const points of Object.values(geometry.points)) {
      points[points.length-1][0]=width+offset;
      if(mobile.matches) {
        const room=Math.max(40,geometry.ordered[0].left-offset);
        points[0][0]=offset;
        points[1][0]=offset+Math.min(50,room*.25);
        points[2][0]=offset+Math.min(180,room*.8);
      }
    }
    world.dataset.signature=model.signature();
    motion.setTarget(geometry,quiet||!motion.target);
    paint();
    startMotion();
    for(const cross of geometry.crossings) {
      if(!handles.has(cross.id)) {
        const el=document.createElement('button');el.type='button';el.className='crossing-handle';
        el.dataset.crossing=cross.id;world.append(el);handles.set(cross.id,el);
        bindDrag(el,{kind:'crossing',id:cross.id});bindKeys(el,{kind:'crossing',id:cross.id});
      }
      const el=handles.get(cross.id);

      el.textContent=`σ${cross.lane+1}`;
      el.setAttribute('aria-label',`${cross.objects.join('と')}の対称性を移動`);
      el.dataset.lane=String(cross.lane);
    }
    paint();
    const endNote=world.querySelector('.end-note'),endWidth=mobile.matches?viewport.clientWidth-44:330;endNote.style.width=`${endWidth}px`;endNote.style.left=`${width-endWidth-(mobile.matches?22:32)}px`;endNote.style.top=mobile.matches?`${172-world.getBoundingClientRect().top}px`:'62px';
    const symbols=model.word().map(l=>['σ₁','σ₂','σ₃'][l]);
    world.querySelector('.crossing-note span:first-child').textContent=symbols.length?symbols.slice(0,8).join(' ')+(symbols.length>8?` … (${symbols.length})`:''):'id';
    world.querySelector('.crossing-note span+span').textContent=DiagramModel.OBJECTS.join(' ⊗ ')+' → '+geometry.output.join(' ⊗ ');
    syncWord();
    renderScroll();
  }
  function paint() {
    lockCanvas();viewport.scrollTop=0;
    for(const [id,box] of Object.entries(motion.boxes)) {
      const el=nodes.get(id),target=geometry.boxes[id];
      el.style.left=`${box.x-offset}px`;el.style.top=`${box.y*scale()}px`;
      el.dataset.object=target.objects.join('⊗');el.dataset.lane=String(target.lane);
      el.dataset.logicalX=String(model.node(id).x);
      if(target.compound)paintComposite(el,target,box);
      else{
        el.querySelector('.node-index').textContent=`${String(leafOrder.indexOf(id)+1).padStart(2,'0')} / ${target.object} → ${target.object}`;
        el.style.setProperty('--node-color',{A:'var(--red)',B:'var(--teal)',C:'var(--violet)'}[target.object]);
      }
      el.dataset.visualX=String(box.x);el.dataset.visualY=String(box.y);
    }
    const pad=440,svgLeft=Math.max(0,viewport.scrollLeft-pad),svgWidth=viewport.clientWidth+pad*2;
    svgStart=svgLeft+offset;svgEnd=svgStart+svgWidth;
    svg.style.left=`${svgLeft}px`;svg.style.width=`${svgWidth}px`;svg.setAttribute('viewBox',`0 0 ${svgWidth} 720`);
    const wires=motion.wires(mobile.matches?95:106);
    for(const object of DiagramModel.OBJECTS){const key=object.toLowerCase(),d=path(soften(wires[object]));svg.querySelector(`.wire-${key}`).setAttribute('d',d);svg.querySelector(`.wire-gap-${key}`)?.setAttribute('d',d);}
    for(const [i,o]of DiagramModel.OBJECTS.entries()){
      const input=svg.querySelector(`[data-input="${o}"]`),output=svg.querySelector(`[data-output="${o}"]`);
      input.setAttribute('x',(mobile.matches?24:340)+offset-svgStart);input.setAttribute('y',DiagramModel.ROWS[i]*scale()-20);
      output.setAttribute('x',width-170+offset-svgStart);output.setAttribute('y',DiagramModel.ROWS[geometry.output.indexOf(o)]*scale()-20);
    }
    for(const [id,el] of handles){
      const p=motion.crossings[id];
      if(!p){el.remove();handles.delete(id);continue;}
      el.disabled=!geometry.crossings.some(c=>c.id===id);
      el.style.left=`${p.x-offset}px`;el.style.top=`${p.y*scale()}px`;el.style.opacity=String(p.opacity);
    }
    paintPairs();
    const first=geometry.crossings.length?motion.crossings[geometry.crossings[0].id]:null;
    world.querySelector('.crossing-note').style.left=`${(first?.x||1300)-offset-80}px`;
    world.dataset.animating=String(motion.active);
    world.dataset.motionFrames=String(motionFrames);
  }
  function startMotion(){
    if(!motion.active||motionFrame)return;
    lastMotionTime=performance.now();motionFrame=requestAnimationFrame(tickMotion);
  }
  function tickMotion(now){
    motionFrame=0;motionFrames++;
    const active=motion.step(now-lastMotionTime);lastMotionTime=now;paint();
    if(active)motionFrame=requestAnimationFrame(tickMotion);
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(render);}
  function renderScroll() {
    scrollFrame=0;
    lockCanvas();viewport.scrollTop=0;
    const travel=viewport.scrollLeft;paint();
    journey.querySelector('.progress-track span').style.transform=`scaleX(${maxTravel?travel/maxTravel:0})`;
    if(!quiet) {
      intro.style.visibility='';intro.style.transform=`translate3d(${-travel*.65}px,0,0)`;
      intro.style.opacity=String(clamp(1-travel/530,0,1));
    } else {intro.style.transform='';intro.style.opacity='';intro.style.visibility=travel>100?'hidden':'';}
    const center=travel+viewport.clientWidth/2;
    const closest=Object.values(geometry.boxes).reduce((a,b)=>Math.abs(a.x-offset-center)<Math.abs(b.x-offset-center)?a:b);
    tabs.forEach(tab=>{const active=closest.sections.includes(tab.dataset.travel);tab.classList.toggle('is-active',active);if(active)tab.setAttribute('aria-current','step');else tab.removeAttribute('aria-current');});
    journey.querySelector('.journey-count').textContent=`0${leafOrder.indexOf(closest.sections[0])+1} — ${String(leafOrder.length).padStart(2,'0')}`;
  }
  function layout(){if(quiet){stopScroll();cancelAnimationFrame(hoverFrame);hoverFrame=0;hover=null;hoverTarget=null;}world.style.top=mobile.matches&&innerHeight<=750?`${mobileFirst()-DiagramModel.ROWS[0]*scale()}px`:'';offset=mobile.matches?900-Math.min(320,viewport.clientWidth-110):0;root.classList.toggle('touch-layout',mobile.matches||coarse.matches);root.classList.toggle('quiet',quiet);geometry=model.layout(mobile.matches?95:106);motion.setTarget(geometry,true);render();}
  function stopScroll(){cancelAnimationFrame(sFrame);sFrame=0;scrollTarget=viewport.scrollLeft;}
  function goTo(left){
    scrollTarget=clamp(left,0,maxTravel);
    if(quiet||dragging){viewport.scrollLeft=scrollTarget;if(dragging)dragMove();return;}
    if(!sFrame){scrollTime=performance.now();sFrame=requestAnimationFrame(scrollTick);}
  }
  function scrollTick(now){
    sFrame=0;
    const difference=scrollTarget-viewport.scrollLeft;
    const amount=1-Math.exp(-Math.min(64,now-scrollTime)/85);scrollTime=now;
    if(Math.abs(difference)<.6){viewport.scrollLeft=scrollTarget;return;}
    viewport.scrollLeft+=difference*amount;
    sFrame=requestAnimationFrame(scrollTick);
  }
  function hoverTick(){
    hoverFrame=0;
    if(quiet||dragging){hover=null;hoverTarget=null;paint();return;}
    if(!hover&&hoverTarget)hover={...hoverTarget,strength:0};
    if(!hover)return;
    const target=hoverTarget||hover;
    hover.x+=(target.x-hover.x)*.23;hover.y+=(target.y-hover.y)*.23;
    hover.strength+=((hoverTarget?1:0)-hover.strength)*.18;
    paint();
    if(Math.abs(target.x-hover.x)+Math.abs(target.y-hover.y)>.1||Math.abs((hoverTarget?1:0)-hover.strength)>.003)hoverFrame=requestAnimationFrame(hoverTick);
    else if(!hoverTarget)hover=null;
  }
  function followPointer(target){hoverTarget=target;if(!hoverFrame)hoverFrame=requestAnimationFrame(hoverTick);}
  function item(target){return target.kind==='box'?model.roots().find(b=>b.id===target.id):model.crossings.find(c=>c.id===target.id);}
  function move(target,x){if(target.kind==='box')model.moveBox(target.id,x);else model.moveCrossing(target.id,x);}
  function dragMove() {
    if(!dragging?.active)return;
    const x=dragging.x+(dragging.clientX-dragging.startX)+(viewport.scrollLeft-dragging.scroll);
    move(dragging.target,x);schedule();
  }
  function autoPan() {
    panFrame=0;
    if(!dragging?.active||!dragging.panAllowed)return;
    const rect=viewport.getBoundingClientRect(),x=dragging.clientX;
    const speed=x<rect.left+64?-clamp((rect.left+64-x)/4,0,18):x>rect.right-64?clamp((x-rect.right+64)/4,0,18):0;
    if(speed) {
      viewport.scrollLeft=clamp(viewport.scrollLeft+speed,0,maxTravel);
      dragMove();panFrame=requestAnimationFrame(autoPan);
    }
  }
  function bindDrag(el,target,card=false) {
    el.draggable=false;
    el.addEventListener('click',event=>{if(el.dataset.suppressClick==='true'){delete el.dataset.suppressClick;event.preventDefault();event.stopImmediatePropagation();}},true);
    el.addEventListener('pointerdown',event=>{
      if(pairPlacement || !item(target) || event.button!==0 || dragging || event.metaKey || event.ctrlKey || event.altKey)return;
      event.preventDefault();
      stopScroll();cancelAnimationFrame(hoverFrame);hoverFrame=0;hoverTarget=null;
      keyboard=null;hover=null;delete el.dataset.suppressClick;
      dragging={target,el,before:model.snapshot(),x:item(target).x,startX:event.clientX,clientX:event.clientX,scroll:viewport.scrollLeft,pointer:event.pointerId,active:!card,panAllowed:event.shiftKey,lane:target.kind==='box'?geometry.boxes[target.id].lane:null};
      el.setPointerCapture(event.pointerId);
      if(dragging.active)el.classList.add('is-moving');
    });
    el.addEventListener('pointermove',event=>{
      if(!dragging || dragging.el!==el || event.pointerId!==dragging.pointer)return;
      dragging.clientX=event.clientX;dragging.panAllowed=event.shiftKey;
      if(!dragging.active && Math.abs(event.clientX-dragging.startX)<5)return;
      dragging.active=true;el.classList.add('is-moving');
      dragMove();if(!panFrame)panFrame=requestAnimationFrame(autoPan);
    });
    function end(event,cancel=false) {
      if(!dragging || dragging.el!==el || event.pointerId!==dragging.pointer)return;
      const previous=dragging;dragging=null;cancelAnimationFrame(panFrame);panFrame=0;el.classList.remove('is-moving');
      if(!previous.active)return;
      if(card&&!cancel)el.dataset.suppressClick='true';
      if(cancel){model.restore(previous.before);render();announce('移動を取り消しました。');return;}
      move(target,Math.round(item(target).x/20)*20);render();
      commit(previous.before,target.kind==='box'?'箱を移動しました。接続と合成順序を保持しています。':'対称性を移動しました。ワイヤーのつながりと箱の順序を保持しています。');
    }
    el.addEventListener('pointerup',e=>end(e));el.addEventListener('pointercancel',e=>end(e,true));el.addEventListener('lostpointercapture',e=>end(e,true));
  }
  function bindKeys(el,target) {
    el.addEventListener('keydown',event=>{
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
        event.preventDefault();
        if(event.key==='ArrowUp'||event.key==='ArrowDown'){announce('箱はワイヤーに沿って移動します。左右キーを使ってください。');return;}
        if(!keyboard)keyboard={el,before:model.snapshot()};
        move(target,item(target).x+(event.key==='ArrowRight'?1:-1)*(event.shiftKey?120:30));render();
        const b=geometry.boxes[target.id];announce(b?`${b.expression}、上から${b.lane+1}本目。`:'対称性を移動しました。');
      } else if((event.key==='Enter'||event.key===' ') && keyboard?.el===el) {
        event.preventDefault();const before=keyboard.before;keyboard=null;commit(before,'移動を確定しました。');
      } else if(event.key==='Escape'&&keyboard?.el===el) {
        event.preventDefault();model.restore(keyboard.before);keyboard=null;render();announce('移動を取り消しました。');
      }
    });
    el.addEventListener('blur',()=>{if(keyboard?.el===el){const before=keyboard.before;keyboard=null;commit(before,'移動を確定しました。');}});
  }
  for(const [id,el] of nodes) {
    const target={kind:'box',id};
    bindDrag(el.querySelector('.node-card'),target,true);
    const handle=el.querySelector('.drag-handle');bindDrag(handle,target);bindKeys(handle,target);
  }
  for(const button of journey.querySelectorAll('[data-action]'))button.addEventListener('click',()=>{
    if(dragging)return;
    if(button.dataset.action==='undo'){restoreHistory(undo,redo);return;}
    if(button.dataset.action==='redo'){restoreHistory(redo,undo);return;}
    if(button.dataset.action==='word'){setWordMode(!wordMode);return;}
    if(button.dataset.action==='compose'){setComposeMode(!composeMode);return;}
    if(button.dataset.action==='pair'){setPairPlacement(!pairPlacement);return;}

  });
  journey.querySelector('.reset-diagram').addEventListener('click',()=>{const before=model.snapshot();selected.clear();setComposeMode(false);setPairPlacement(false);setWordMode(false);model.restore(initialState);invariant=model.signature();width=3700;render();commit(before,'図式を初期状態に戻しました。Undoで戻せます。');});
  viewport.addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(renderScroll);},{passive:true});
  document.body.addEventListener('wheel',event=>{
    if(event.ctrlKey || document.querySelector('dialog[open]') || event.target.closest('.word-dock'))return;
    const delta=Math.abs(event.deltaY)>=Math.abs(event.deltaX)?event.deltaY:event.deltaX;
    const current=sFrame?scrollTarget:viewport.scrollLeft;
    const next=clamp(current+delta*(event.deltaMode===1?16:event.deltaMode===2?viewport.clientWidth:1),0,maxTravel);
    if(Math.abs(next-current)>.01){event.preventDefault();goTo(next);}
  },{passive:false});
  viewport.addEventListener('keydown',event=>{
    if(pairPlacement){pairKeys(event);return;}
    if(event.target!==viewport || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();stopScroll();viewport.scrollTo({left:event.key==='Home'?0:event.key==='End'?maxTravel:clamp(viewport.scrollLeft+(event.key==='ArrowRight'?120:-120),0,maxTravel),behavior:'instant'});
  });
  document.body.addEventListener('keydown',event=>{
    if(!(event.metaKey||event.ctrlKey)||event.key.toLowerCase()!=='z'||document.querySelector('dialog[open]'))return;
    event.preventDefault();restoreHistory(event.shiftKey?redo:undo,event.shiftKey?undo:redo);
  });
  tabs.forEach(tab=>tab.addEventListener('click',()=>{const root=model.roots().find(n=>n.sections.includes(tab.dataset.travel));goTo(geometry.boxes[root.id].x-offset-viewport.clientWidth/2);}));
  journey.querySelector('.return-start').addEventListener('click',()=>goTo(0));
  staticInput.addEventListener('change',()=>{quiet=staticInput.checked||reduce.matches;staticInput.checked=quiet;try{localStorage.setItem('diagram-quiet',String(quiet));}catch{}layout();});
  reduce.addEventListener('change',e=>{quiet=e.matches||staticInput.checked;staticInput.checked=quiet;layout();});
  viewport.addEventListener('pointermove',event=>{if(pairPlacement){candidateFromPointer(event);return;}if(quiet||dragging||event.pointerType!=='mouse')return;const rect=world.getBoundingClientRect();followPointer({x:event.clientX-rect.left+offset,y:(event.clientY-rect.top)/scale()});
    const card=event.target.closest('.node-card');
    if(card){const b=card.getBoundingClientRect();card.style.setProperty('--light-x',`${(event.clientX-b.left)/b.width*100}%`);card.style.setProperty('--light-y',`${(event.clientY-b.top)/b.height*100}%`);}},{passive:true});
  viewport.addEventListener('pointerleave',()=>followPointer(null));
  viewport.addEventListener('pointerdown',()=>stopScroll(),{passive:true});
  window.addEventListener('resize',layout,{passive:true});

  for(const [id,el]of nodes)addSelectButton(id,el);

  function addSelectButton(id,el){
    const button=document.createElement('button');button.type='button';button.className='node-select';button.textContent='+';
    button.setAttribute('aria-label',`${el.querySelector('.node-title').textContent}を合成対象に選択`);button.setAttribute('aria-pressed','false');
    button.addEventListener('click',event=>{event.stopPropagation();toggleSelection(id);});el.append(button);
  }
  function toggleSelection(id){if(selected.has(id))selected.delete(id);else selected.add(id);updateSelection();}
  function updateSelection(){
    const roots=new Set(model.roots().map(n=>n.id));for(const id of selected)if(!roots.has(id))selected.delete(id);
    for(const [id,el]of nodes){el.classList.toggle('selected',selected.has(id));const b=el.querySelector('.node-select');if(b){b.hidden=!composeMode;b.setAttribute('aria-pressed',String(selected.has(id)));b.textContent=selected.has(id)?'✓':'+';}}
    const ids=[...selected],summary=journey.querySelector('.selection-summary');
    summary.textContent=ids.length?ids.map(id=>geometry?.boxes[id]?.expression||model.node(id)?.symbol||'合成').join(' / '):'箱の＋を押して合成対象を選択';
    for(const kind of ['serial','tensor'])journey.querySelector(`[data-combine=${kind}]`).disabled=!model.canCompose(kind,ids).ok;
    journey.querySelector('[data-combine=split]').disabled=ids.length!==1||!model.node(ids[0])?.compound;
  }
  function setComposeMode(value){
    if(value){if(pairPlacement)setPairPlacement(false);setWordMode(false);}composeMode=value;journey.classList.toggle('compose-mode',value);
    journey.querySelector('.composition-dock').hidden=!value;if(!value)selected.clear();historyUI();
  }
  function syncNodes(){
    const roots=model.roots(),active=new Set(roots.map(n=>n.id));
    for(const root of roots)if(!nodes.has(root.id)){
      const el=document.createElement('div');el.className='diagram-node composite-node';el.dataset.node=root.id;
      el.innerHTML='<span class="node-index"></span><a href="#" class="node-card"><span class="node-symbol"></span><span class="node-title">合成<span></span></span><span class="node-arrow" aria-hidden="true">↗</span></a><span class="port-layer" aria-hidden="true"></span><button type="button" class="drag-handle" aria-describedby="drag-help">⠿ GRAB & SLIDE ↔</button>';
      const card=el.querySelector('.node-card');card.setAttribute('aria-label','合成した箱の詳細を開く');
      const handle=el.querySelector('.drag-handle');handle.setAttribute('aria-label','合成した箱を移動');
      nodes.set(root.id,el);world.append(el);addSelectButton(root.id,el);const target={kind:'box',id:root.id};bindDrag(card,target,true);bindDrag(handle,target);bindKeys(handle,target);
      card.addEventListener('click',event=>{event.preventDefault();if(!composeMode)openComposite(root.id);});
      for(const object of DiagramModel.OBJECTS){for(const output of [false,true]){const dot=document.createElement('span');dot.className=`composite-port${output?' output':''}`;dot.dataset.port=object;el.querySelector('.port-layer').append(dot);}const label=document.createElement('span');label.className='composite-port-label';label.dataset.portLabel=object;el.querySelector('.port-layer').append(label);}
    }
    for(const [id,el]of nodes){el.hidden=!active.has(id);if(id.startsWith('composite-')&&!model.groups.some(g=>g.id===id)){el.remove();nodes.delete(id);}}
    updateSelection();
  }
  function paintComposite(el,target,visual){
    const values=target.ports.map(p=>visual.portYs[p.object]),base=mobile.matches?(innerHeight<=750?64:100):(innerHeight<=650?72:112);
    const height=Math.max(...values)-Math.min(...values),h=base+height*scale();
    el.style.height=`${h}px`;el.querySelector('.node-card').style.height=`${h}px`;el.querySelector('.drag-handle').style.top=`${h+14}px`;
    el.querySelector('.node-card').setAttribute('aria-label',`${target.expression}の詳細を開く`);
    el.querySelector('.drag-handle').setAttribute('aria-label',`${target.expression}の箱を移動`);
    el.querySelector('.node-select').setAttribute('aria-label',`${target.expression}を合成対象に選択`);
    el.querySelector('.node-title').firstChild.textContent=model.node(target.id).kind==='serial'?'直列合成':'並列合成';
    el.querySelector('.node-symbol').textContent=target.expression;el.querySelector('.node-symbol').style.fontSize=target.expression.length>19?'21px':'';
    el.querySelector('.node-index').textContent=target.ports.map(p=>p.object).join('⊗')+' → '+target.ports.map(p=>p.object).join('⊗');
    // A factorized box can skip a spectator wire. Keep an open channel in
    // the enclosure instead of suggesting an unselected identity port.
    const narrow=target.portObjects.length>1&&target.portObjects.length<DiagramModel.OBJECTS.length;
    el.classList.toggle('omits-identities',narrow);
    const card=el.querySelector('.node-card'),position=y=>(y-visual.y)*scale()+h/2;
    const gaps=Object.entries(target.bypassYs||{}).map(([o])=>position(visual.portYs[o])).filter(y=>y>0&&y<h);
    const stops=['#000 0px'];for(const y of gaps.sort((a,b)=>a-b))stops.push(`#000 ${y-18}px`,`transparent ${y-18}px`,`transparent ${y+18}px`,`#000 ${y+18}px`);stops.push('#000 100%');
    card.style.maskImage=gaps.length?`linear-gradient(to bottom,${stops.join(',')})`:'';
    if(narrow){el.style.setProperty('--formula-y',`${position(values[0])}px`);el.style.setProperty('--caption-y',`${position(values[values.length-1])}px`);}
    el.querySelector('.node-title>span').textContent=target.sections.map(id=>document.querySelector(`[data-node="${id}"] .node-title`).firstChild.textContent).join(' / ');
    const colors={A:'var(--red)',B:'var(--teal)',C:'var(--violet)'};
    for(const object of DiagramModel.OBJECTS){const p=target.ports.find(p=>p.object===object),y=p?(visual.portYs[object]-visual.y)*scale()+h/2:0;
      for(const dot of el.querySelectorAll(`[data-port="${object}"]`)){dot.hidden=!p;dot.style.top=`${y}px`;dot.style.setProperty('--port-color',colors[object]);dot.classList.toggle('is-identity',!!p?.identity);}
      const label=el.querySelector(`[data-port-label="${object}"]`);label.hidden=!p;label.style.top=`${y}px`;label.textContent=p?.identity?'id'+object:object;
    }
  }
  function openComposite(id){
    const node=model.node(id),box=geometry.boxes[id],dialog=document.getElementById('panel-composite');if(!node||!box)return;
    stopScroll();dialog.querySelector('h1').textContent=box.expression;
    dialog.querySelector('.composite-type').textContent=box.ports.map(p=>p.object).join(' ⊗ ')+' → '+box.ports.map(p=>p.object).join(' ⊗ ');
    const contents=dialog.querySelector('.composite-contents');contents.replaceChildren();
    const text=document.createElement('p');text.textContent='合成に含まれるセクション。各項目から本文を開けます。';contents.append(text);
    const links=document.createElement('div');links.className='composite-links';
    for(const section of node.sections){const button=document.createElement('button');button.type='button';button.textContent=document.querySelector(`[data-node="${section}"] .node-title`).firstChild.textContent;button.addEventListener('click',()=>{dialog.close();document.getElementById(`panel-${section}`).showModal();});links.append(button);}
    contents.append(links);dialog.showModal();dialog.scrollTop=0;
  }
  journey.querySelectorAll('[data-combine]').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.combine==='done'){setComposeMode(false);return;}
    const before=model.snapshot();let result;
    if(button.dataset.combine==='split'){result={ok:model.decompose([...selected][0])};selected.clear();}
    else{result=model.compose(button.dataset.combine,[...selected],{includeIdentities:journey.querySelector('#include-identities').checked});if(result.ok){selected.clear();selected.add(result.id);}}
    const feedback=journey.querySelector('.composition-feedback');
    if(!result.ok){feedback.textContent=result.reason||'この箱は展開できません。';return;}
    render();feedback.textContent='';commit(before,button.dataset.combine==='split'?'合成した箱を展開しました。':'箱を合成しました。元のセクションは合成箱から開けます。');
  }));
  function setPairPlacement(value){
    if(value){pairReturnWord=wordMode;if(composeMode)setComposeMode(false);setWordMode(false);}pairPlacement=value;journey.classList.toggle('pair-mode',value);
    journey.querySelector('.placement-hint').hidden=!value;world.querySelector('.pair-preview').hidden=!value;
    if(value){stopScroll();pairCandidate={x:viewport.scrollLeft+offset+viewport.clientWidth*.55,lane:0};drawCandidate();viewport.focus({preventScroll:true});}else pairCandidate=null;
    historyUI();
  }
  function drawCandidate(){
    if(!pairCandidate)return;const el=world.querySelector('.pair-preview'),[a,b]=DiagramModel.PAIRS[pairCandidate.lane];
    el.style.left=`${pairCandidate.x-offset}px`;el.style.top=`${((DiagramModel.ROWS[a]+DiagramModel.ROWS[b])/2)*scale()}px`;
    el.querySelector('span').textContent=['σ₁²','σ₂²','σ₃²'][pairCandidate.lane];
    if(pairCandidate.lane===2){
      el.querySelector('svg').innerHTML='<path d="M0 10L72 73Q80 80 88 73L160 10"/><path d="M0 45H160"/><path d="M0 80L72 17Q80 10 88 17L160 80"/>';
    }else el.querySelector('svg').innerHTML='<path d="M0 15H20C55 15 45 75 80 75S105 15 140 15H160"/><path d="M0 75H20C55 75 45 15 80 15S105 75 140 75H160"/>';
  }
  function candidateFromPointer(event){const rect=world.getBoundingClientRect(),y=(event.clientY-rect.top)/scale();pairCandidate={x:event.clientX-rect.left+offset,lane:y<359.5?0:y>424.5?1:2};drawCandidate();}
  function placePair(){
    if(!pairCandidate)return;const before=model.snapshot(),x=model.logicalAt(pairCandidate.x,mobile.matches?95:106),result=model.insertPair(x,pairCandidate.lane);
    if(!result.ok){announce(result.reason);return;}
    const reopenWord=pairReturnWord;setPairPlacement(false);render();commit(before,'選んだ位置に対称性の往復を作成しました。σ²の印から除去できます。');if(reopenWord)setWordMode(true);pairReturnWord=false;
  }
  function pairKeys(event){
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','Escape'].includes(event.key))return;event.preventDefault();
    if(event.key==='Escape'){setPairPlacement(false);return;}if(event.key==='Enter'){placePair();return;}
    if(event.key==='ArrowLeft')pairCandidate.x=Math.max(offset+20,pairCandidate.x-80);if(event.key==='ArrowRight')pairCandidate.x=Math.min(width+offset-40,pairCandidate.x+80);
    if(event.key==='ArrowUp')pairCandidate.lane=Math.max(0,pairCandidate.lane-1);if(event.key==='ArrowDown')pairCandidate.lane=Math.min(2,pairCandidate.lane+1);drawCandidate();
  }
  function paintPairs(){
    for(const pair of model.pairs){const crosses=geometry.crossings.filter(c=>c.pairId===pair.id);if(crosses.length!==2)continue;
      if(!pairBadges.has(pair.id)){const button=document.createElement('button');button.type='button';button.className='pair-remove';button.textContent='σ² ×';button.setAttribute('aria-label',`${pair.id}のσ²を取り除く`);button.addEventListener('click',event=>{event.stopPropagation();const before=model.snapshot();model.removePair(pair.id);render();commit(before,'対称性の往復を取り除きました。');});world.append(button);pairBadges.set(pair.id,button);}
      const a=motion.crossings[crosses[0].id],b=motion.crossings[crosses[1].id];if(!a||!b)continue;const el=pairBadges.get(pair.id);el.style.left=`${(a.x+b.x)/2-offset}px`;el.style.top=`${(a.y+b.y)/2*scale()-65}px`;
    }
    for(const [id,el]of pairBadges)if(!model.pairs.some(p=>p.id===id)){el.remove();pairBadges.delete(id);}
    drawCandidate();
  }
  viewport.addEventListener('click',event=>{
    if(pairPlacement){event.preventDefault();event.stopImmediatePropagation();if(event.target.closest('.node-card')){announce('箱の外のワイヤー部分を選択してください。');return;}candidateFromPointer(event);placePair();return;}
    if(composeMode){const card=event.target.closest('.node-card');if(!card)return;event.preventDefault();event.stopImmediatePropagation();if(card.dataset.suppressClick==='true'){delete card.dataset.suppressClick;return;}toggleSelection(card.closest('[data-node]').dataset.node);}
  },true);
  document.body.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]')){if(pairPlacement)setPairPlacement(false);else if(composeMode)setComposeMode(false);else if(wordMode)setWordMode(false);}});

  function setWordMode(value){
    if(value){if(composeMode)setComposeMode(false);if(pairPlacement)setPairPlacement(false);}
    if(!value)cancelWordDrag();wordMode=value;journey.querySelector('.word-dock').hidden=!value;journey.classList.toggle('word-mode',value);
    if(value){wordKey=null;syncWord();}historyUI();
  }
  function syncWord(){
    const word=model.word(),key=JSON.stringify(word);
    world.dataset.word=key;world.dataset.crossingCount=String(word.length);
    if(key===wordKey)return;
    wordKey=key;wordDraft=[...word];wordCursor=null;paintWordDraft();
    journey.querySelector('.word-status').textContent='図式と同期しています。';
  }
  function paintWordDraft(focusIndex=null){
    cancelWordDrag();const list=journey.querySelector('.word-tokens');list.replaceChildren();
    wordDraft.forEach((lane,i)=>{
      const li=document.createElement('li'),button=document.createElement('button');
      button.type='button';button.className='word-token';button.dataset.wordIndex=String(i);button.textContent=['σ₁','σ₂','σ₃'][lane];
      button.setAttribute('aria-label',`${i+1}番目の交差 ${button.textContent}`);button.setAttribute('aria-pressed',String(wordCursor===i));
      button.addEventListener('click',event=>{if(performance.now()<wordSuppressClickUntil){event.preventDefault();return;}wordCursor=i;paintWordDraft(i);});
      bindWordDrag(button,i);
      button.addEventListener('keydown',event=>{if(event.shiftKey&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopPropagation();moveWordToken(i,i+(event.key==='ArrowRight'?1:-1));return;}if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();wordCursor=event.key==='End'?null:event.key==='Home'?0:clamp(i+(event.key==='ArrowRight'?1:-1),0,wordDraft.length-1);paintWordDraft(wordCursor);});
      li.append(button);list.append(li);
    });
    if(focusIndex!==null){const target=list.querySelectorAll('.word-token')[focusIndex];if(target){target.focus({preventScroll:true});const a=target.getBoundingClientRect(),b=list.getBoundingClientRect();if(a.top<b.top)list.scrollTop-=b.top-a.top;else if(a.bottom>b.bottom)list.scrollTop+=a.bottom-b.bottom;}}wordFeedback();
  }
  function wordFeedback(){
    journey.querySelector('[data-word-braid]').disabled=model.braidIndex()<0||JSON.stringify(wordDraft)!==wordKey;
    const n=wordDraft.length;for(const button of journey.querySelectorAll('[data-sigma]'))button.disabled=wordCursor===null&&n>=DiagramModel.MAX_CROSSINGS;
    journey.querySelector('[data-word-left]').disabled=wordCursor===null||wordCursor===0;journey.querySelector('[data-word-right]').disabled=wordCursor===null||wordCursor===n-1;
    journey.querySelector('[data-word-delete]').disabled=!n;journey.querySelector('[data-word-end]').disabled=wordCursor===null;
    journey.querySelector('.word-target').textContent=wordCursor===null?'末尾に追加':`${wordCursor+1}番目を編集`;
    journey.querySelector('.word-limit').textContent=`${n} / ${DiagramModel.MAX_CROSSINGS} 項`+(n>=32?' · 長い列は横へ探索してください。':'');
    journey.querySelector('.word-status').textContent=JSON.stringify(wordDraft)===wordKey?'図式と同期しています。':'未実行の変更があります。実行で図式に反映します。';
  }
  function cancelWordDrag(){
    if(!wordDrag)return;const drag=wordDrag;wordDrag=null;cancelAnimationFrame(wordDragFrame);wordDragFrame=0;drag.preview?.remove();drag.button.classList.remove('word-grabbed');
    for(const target of journey.querySelectorAll('.word-drop-target'))target.classList.remove('word-drop-target');
    if(drag.active)wordSuppressClickUntil=performance.now()+250;
    if(drag.button.hasPointerCapture(drag.pointer))drag.button.releasePointerCapture(drag.pointer);
  }
  function moveWordToken(from,to){
    if(from<0||to<0||from>=wordDraft.length||to>=wordDraft.length||from===to)return;
    const [term]=wordDraft.splice(from,1);wordDraft.splice(to,0,term);wordCursor=to;paintWordDraft(to);
    journey.querySelector('.word-status').textContent=`${from+1}番目の交差を${to+1}番目へ移動しました。実行で反映します。`;
  }
  function wordDragTarget(){
    if(!wordDrag?.active)return;
    const list=journey.querySelector('.word-tokens'),r=list.getBoundingClientRect(),{x,y}=wordDrag;
    wordDrag.preview.style.left=`${x}px`;wordDrag.preview.style.top=`${y}px`;
    let closest=null,distance=Infinity;
    if(x>=r.left-15&&x<=r.right+15&&y>=r.top-30&&y<=r.bottom+30)for(const button of list.querySelectorAll('.word-token')){
      const b=button.getBoundingClientRect();if(b.bottom<r.top||b.top>r.bottom)continue;
      const d=(x-(b.left+b.right)/2)**2+(y-(b.top+b.bottom)/2)**2;if(d<distance){closest=button;distance=d;}
    }
    wordDrag.to=closest?Number(closest.dataset.wordIndex):null;
    for(const button of list.querySelectorAll('.word-token'))button.classList.toggle('word-drop-target',button===closest);
  }
  function wordDragScroll(){
    wordDragFrame=0;if(!wordDrag?.active)return;
    const list=journey.querySelector('.word-tokens'),r=list.getBoundingClientRect(),y=wordDrag.y;
    const speed=y<r.top+22?-7:y>r.bottom-22?7:0;
    if(speed){list.scrollTop+=speed;wordDragTarget();wordDragFrame=requestAnimationFrame(wordDragScroll);}
  }
  function bindWordDrag(button,index){
    button.draggable=false;
    button.addEventListener('pointerdown',event=>{
      if(event.button!==0||wordDrag)return;
      button.setPointerCapture(event.pointerId);wordDrag={from:index,to:index,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,pointer:event.pointerId,button,active:false};
    });
    button.addEventListener('pointermove',event=>{
      if(!wordDrag||wordDrag.button!==button||wordDrag.pointer!==event.pointerId)return;
      wordDrag.x=event.clientX;wordDrag.y=event.clientY;
      if(!wordDrag.active){if(Math.hypot(event.clientX-wordDrag.startX,event.clientY-wordDrag.startY)<6)return;
        wordDrag.active=true;button.classList.add('word-grabbed');
        const preview=document.createElement('span');preview.className='word-drag-preview';preview.textContent=button.textContent;preview.setAttribute('aria-hidden','true');document.body.append(preview);wordDrag.preview=preview;
      }
      event.preventDefault();wordDragTarget();if(!wordDragFrame)wordDragFrame=requestAnimationFrame(wordDragScroll);
    });
    function finish(event,cancel=false){
      if(!wordDrag||wordDrag.button!==button||wordDrag.pointer!==event.pointerId)return;
      const drag=wordDrag;wordDrag=null;cancelAnimationFrame(wordDragFrame);wordDragFrame=0;
      drag.preview?.remove();button.classList.remove('word-grabbed');for(const target of journey.querySelectorAll('.word-drop-target'))target.classList.remove('word-drop-target');
      if(!drag.active)return;
      event.preventDefault();wordSuppressClickUntil=performance.now()+250;
      if(!cancel&&drag.to!==null)moveWordToken(drag.from,drag.to);
    }
    button.addEventListener('pointerup',e=>finish(e));button.addEventListener('pointercancel',e=>finish(e,true));button.addEventListener('lostpointercapture',e=>finish(e,true));
  }
  function inputSigma(lane){
    if(wordCursor===null){if(wordDraft.length>=DiagramModel.MAX_CROSSINGS)return;wordDraft.push(lane);}
    else wordDraft[wordCursor]=lane;
    paintWordDraft();if(wordCursor===null){const list=journey.querySelector('.word-tokens');list.scrollTop=list.scrollHeight;}
  }
  function deleteWord(){if(!wordDraft.length)return;const i=wordCursor??wordDraft.length-1;wordDraft.splice(i,1);if(wordCursor!==null)wordCursor=wordDraft.length?Math.min(i,wordDraft.length-1):null;paintWordDraft();}
  world.querySelector('.crossing-note').addEventListener('click',()=>setWordMode(!wordMode));
  journey.querySelector('[data-word-close]').addEventListener('click',()=>setWordMode(false));
  journey.querySelectorAll('[data-sigma]').forEach(button=>button.addEventListener('click',()=>inputSigma(Number(button.dataset.sigma))));
  journey.querySelector('[data-word-delete]').addEventListener('click',deleteWord);
  journey.querySelector('[data-word-left]').addEventListener('click',()=>{if(wordCursor!==null)moveWordToken(wordCursor,wordCursor-1);});
  journey.querySelector('[data-word-right]').addEventListener('click',()=>{if(wordCursor!==null)moveWordToken(wordCursor,wordCursor+1);});
  journey.querySelector('[data-word-end]').addEventListener('click',()=>{wordCursor=null;paintWordDraft();});
  journey.querySelector('[data-word-clear]').addEventListener('click',()=>{wordDraft=[];wordCursor=null;paintWordDraft();});
  journey.querySelector('.word-dock').addEventListener('keydown',event=>{if(event.metaKey||event.ctrlKey||event.altKey)return;if(['1','2','3'].includes(event.key)){event.preventDefault();inputSigma(Number(event.key)-1);}else if(['Backspace','Delete'].includes(event.key)){event.preventDefault();deleteWord();}});
  journey.querySelector('[data-word-reload]').addEventListener('click',()=>{wordKey=null;syncWord();});
  journey.querySelector('[data-word-apply]').addEventListener('click',()=>{
    const before=model.snapshot(),result=model.setWord(wordDraft);
    if(!result.ok){journey.querySelector('.word-status').textContent=result.reason;return;}
    render();commit(before,'交差列を実行しました。出力は'+geometry.output.join(' ⊗ ')+'です。',true);
    journey.querySelector('.word-status').textContent='実行済み。σ²も省略せず保持しています。';
  });
  journey.querySelector('[data-word-braid]').addEventListener('click',()=>{const before=model.snapshot();if(!model.flipBraid())return;render();commit(before,'編み替えました。同じ射を表します。');});

  layout();historyUI();
})();
