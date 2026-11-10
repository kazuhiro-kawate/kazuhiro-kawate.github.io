/* A typed, factorized fragment of the free strict symmetric monoidal category.
   Composite boxes package existing generators; the per-object words and boundary
   permutation are the invariant. Tensor boxes optionally include ambient identity factors. */
(function(scope){
  'use strict';
  const OBJECTS=['A','B','C'],ROWS=[262,392,522],PAIRS=[[0,1],[1,2],[2,0]],MAX_CROSSINGS=64;
  const SPEC=[{id:'guide',symbol:'f',object:'A',x:900},{id:'about',symbol:'g',object:'A',x:1530},{id:'research',symbol:'h',object:'A',x:2350},{id:'projects',symbol:'i',object:'B',x:3110},{id:'notes',symbol:'j',object:'C',x:3740}];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  class DiagramModel{
    constructor(){this.reset();}
    reset(){this.boxes=clone(SPEC);this.groups=[];this.pairs=[];this.nextId=1;this.legacyPair=null;this.braid=false;this.expanded=false;this.crossings=this.makeCrossings();}
    makeCrossings(){return (this.braid?[1,0,1]:[0,1,0]).map((lane,i)=>({id:`sigma-${i}`,lane,x:[1080,1980,2800][i]}));}
    snapshot(){return clone({boxes:this.boxes,groups:this.groups,pairs:this.pairs,nextId:this.nextId,crossings:this.crossings,braid:this.braid,expanded:this.expanded,legacyPair:this.legacyPair||null});}
    restore(s){const c=clone(s);Object.assign(this,c);this.groups=c.groups||[];this.pairs=c.pairs||[];this.nextId=c.nextId||1;}
    node(id){
      const leaf=this.boxes.find(b=>b.id===id);
      if(leaf)return {...leaf,objects:[leaf.object],portObjects:[leaf.object],terms:{[leaf.object]:[leaf.symbol]},sections:[id],compound:false};
      const group=this.groups.find(g=>g.id===id);if(!group)return null;
      const children=group.children.map(id=>this.node(id));
      const terms={};
      for(const child of children)for(const [o,word] of Object.entries(child.terms))terms[o]=[...(terms[o]||[]),...word];
      const objects=OBJECTS.filter(o=>terms[o]?.length);
      return {...group,objects,portObjects:group.kind==='tensor'?(group.includeIdentities===false?objects:[...OBJECTS]):children[0].portObjects,terms,sections:children.flatMap(c=>c.sections),compound:true};
    }
    roots(){const nested=new Set(this.groups.flatMap(g=>g.children));return [...this.boxes,...this.groups].filter(n=>!nested.has(n.id)).map(n=>this.node(n.id));}
    events(){return [...this.roots().map(b=>({...b,kind:'box'})),...this.crossings.map(c=>({...c,kind:'crossing'}))].sort((a,b)=>a.x-b.x||(a.kind===b.kind?a.id.localeCompare(b.id):a.kind==='crossing'?-1:1));}
    signature(){
      const lanes=[...OBJECTS],words=Object.fromEntries(OBJECTS.map(o=>[o,[]]));
      for(const e of this.events())if(e.kind==='box'){for(const [o,word]of Object.entries(e.terms))words[o].push(...word);}else {const [a,b]=PAIRS[e.lane];[lanes[a],lanes[b]]=[lanes[b],lanes[a]];}
      return JSON.stringify({input:OBJECTS,output:lanes,words});
    }
    record(id){return this.boxes.find(b=>b.id===id)||this.groups.find(g=>g.id===id);}
    moveBox(id,x){
      const root=this.roots().find(b=>b.id===id);if(!root||!Number.isFinite(x))return;
      const forward=x>=root.x;
      this.record(id).x=clamp(x,560,24000);
      // A move can push a composite, which in turn pushes a box on another
      // wire. Propagate the precedence constraints until every edge settles.
      const roots=this.roots(),edges=[];
      for(const object of OBJECTS){const leaves=this.boxes.filter(b=>b.object===object);for(let i=1;i<leaves.length;i++){
        const f=roots.find(b=>b.sections.includes(leaves[i-1].id)),g=roots.find(b=>b.sections.includes(leaves[i].id));
        if(f.id!==g.id)edges.push([f.id,g.id]);
      }}
      if(!forward)for(let pass=0;pass<roots.length;pass++)for(const [fId,gId]of edges){const f=this.record(fId),g=this.record(gId);f.x=Math.min(f.x,g.x-20);}
      for(const n of roots)this.record(n.id).x=Math.max(560,this.record(n.id).x);
      // After a backward move reaches the left boundary, make room forward
      // for the whole dependency chain instead of oscillating at the minimum.
      for(let pass=0;pass<roots.length;pass++)for(const [fId,gId]of edges){const f=this.record(fId),g=this.record(gId);g.x=Math.max(g.x,f.x+20);}
    }
    moveCrossing(id,x){
      this.crossings.sort((a,b)=>a.x-b.x);
      const i=this.crossings.findIndex(c=>c.id===id);if(i<0||!Number.isFinite(x))return;
      const low=i?this.crossings[i-1].x+.1:560,high=i+1<this.crossings.length?this.crossings[i+1].x-.1:24000;
      this.crossings[i].x=clamp(x,low,Math.max(low,high));
    }
    word(){return [...this.crossings].sort((a,b)=>a.x-b.x).map(c=>c.lane);}
    braidIndex(){const word=this.word();return word.findIndex((a,i)=>i+2<word.length&&a===word[i+2]&&Math.abs(a-word[i+1])===1);}
    flipBraid(){
      const i=this.braidIndex();if(i<0)return false;
      const crosses=[...this.crossings].sort((a,b)=>a.x-b.x),a=crosses[i].lane,b=crosses[i+1].lane;
      [crosses[i].lane,crosses[i+1].lane,crosses[i+2].lane]=[b,a,b];this.braid=!this.braid;this.reconcilePairs();return true;
    }
    setWord(word){
      if(!Array.isArray(word)||word.some(l=>!Number.isInteger(l)||l<0||l>=PAIRS.length))return {ok:false,reason:'σ₁・σ₂・σ₃から選択してください。'};
      if(word.length>MAX_CROSSINGS)return {ok:false,reason:`交差列は${MAX_CROSSINGS}項までです。入力は変更していません。`};
      if(JSON.stringify(word)===JSON.stringify(this.word()))return {ok:true,unchanged:true};
      // Reuse the longest common prefix/suffix so an inserted pair does not
      // turn every later crossing into an unrelated new animation anchor.
      const old=[...this.crossings].sort((a,b)=>a.x-b.x);let prefix=0,suffix=0;
      while(prefix<Math.min(old.length,word.length)&&old[prefix].lane===word[prefix])prefix++;
      while(suffix<Math.min(old.length,word.length)-prefix&&old[old.length-1-suffix].lane===word[word.length-1-suffix])suffix++;
      this.crossings=word.map((lane,i)=>{
        const previous=i<prefix?old[i]:i>=word.length-suffix?old[old.length-(word.length-i)]:old.length===word.length?old[i]:null;
        return {id:previous?.id||`word-${this.nextId++}`,lane,x:1080+i*360};
      });
      this.pairs=[];this.legacyPair=null;this.expanded=false;this.braid=false;return {ok:true};
    }
    randomizeInitialBoxes(random=Math.random){
      if(this.groups.length)return {ok:false,reason:'初期配置の箱だけが対象です。'};
      for(const box of this.boxes)box.object=OBJECTS[Math.min(OBJECTS.length-1,Math.max(0,Math.floor(random()*OBJECTS.length)))];
      return {ok:true};
    }
    randomizeInitialWord(random=Math.random,previous=''){
      const pick=n=>Math.min(n-1,Math.max(0,Math.floor(random()*n)));
      const word=Array.from({length:1+pick(6)},()=>pick(PAIRS.length));
      if(JSON.stringify(word)===previous)word[0]=(word[0]+1)%PAIRS.length;
      return this.setWord(word);
    }
    reconcilePairs(){
      const ordered=[...this.crossings].sort((a,b)=>a.x-b.x);
      this.pairs=this.pairs.filter(pair=>{const i=ordered.findIndex(c=>c.pairId===pair.id);return i>=0&&ordered[i+1]?.pairId===pair.id&&ordered[i].lane===ordered[i+1].lane;});
      const valid=new Set(this.pairs.map(p=>p.id));for(const c of this.crossings)if(c.pairId&&!valid.has(c.pairId))delete c.pairId;
    }

    canCompose(kind,ids){
      if(ids.length<2)return {ok:false,reason:'2個以上の箱を選択してください。'};
      const roots=this.roots(),chosen=ids.map(id=>roots.find(n=>n.id===id));
      if(chosen.some(n=>!n)||new Set(ids).size!==ids.length)return {ok:false,reason:'独立した箱を選択してください。'};
      if(kind==='tensor'){
        const objects=chosen.flatMap(c=>c.objects);
        if(new Set(objects).size!==objects.length)return {ok:false,reason:'並列合成には、異なる対象に作用する箱を選んでください。'};
      }else{
        const type=chosen[0].portObjects.join('');
        if(chosen.some(c=>c.portObjects.join('')!==type))return {ok:false,reason:'直列合成する箱の入力・出力の型が一致していません。'};
        const sorted=[...chosen].sort((a,b)=>a.x-b.x),support=new Set(chosen.flatMap(c=>c.objects));
        if(roots.some(r=>!ids.includes(r.id)&&r.x>sorted[0].x&&r.x<sorted[sorted.length-1].x&&r.objects.some(o=>support.has(o))))return {ok:false,reason:'同じワイヤー上で間にある箱も選択してください。'};
      }
      return {ok:true};
    }
    compose(kind,ids,{includeIdentities=true}={}){
      const check=this.canCompose(kind,ids);if(!check.ok)return check;
      const before=this.snapshot(),meaning=this.signature(),chosen=this.roots().filter(n=>ids.includes(n.id)).sort((a,b)=>a.x-b.x);
      const id=`composite-${this.nextId++}`;
      this.groups.push({id,kind,includeIdentities:!!includeIdentities,children:chosen.map(c=>c.id),x:chosen.reduce((s,c)=>s+c.x,0)/chosen.length});
      this.moveBox(id,this.record(id).x);
      if(this.signature()!==meaning){this.restore(before);return {ok:false,reason:'このまとめ方では同じ射を保てません。'};}
      return {ok:true,id};
    }
    decompose(id){
      const group=this.groups.find(g=>g.id===id);if(!group||!this.roots().some(n=>n.id===id))return false;
      const children=group.children.map(id=>this.node(id));
      children.forEach((c,i)=>{this.record(c.id).x=Math.max(560,group.x+(i-(children.length-1)/2)*(group.kind==='serial'?280:30));});
      this.groups=this.groups.filter(g=>g.id!==id);for(const child of children)this.moveBox(child.id,this.record(child.id).x);return true;
    }
    logicalAt(visualX,half=106){
      const events=this.layout(half).ordered;
      for(let i=0;i<events.length;i++)if(visualX<events[i].x){
        const prev=events[i-1];if(!prev)return Math.max(560,events[0].logicalX-Math.max(20,events[0].x-visualX));
        const t=clamp((visualX-prev.x)/(events[i].x-prev.x),.02,.98);
        return prev.logicalX+t*(events[i].logicalX-prev.logicalX);
      }
      return events[events.length-1].logicalX+Math.max(180,visualX-events[events.length-1].x);
    }
    insertPair(x,lane=0){
      if(!Number.isFinite(x)||!Number.isInteger(lane)||lane<0||lane>=PAIRS.length)return {ok:false,reason:'ワイヤー上の位置を選択してください。'};
      if(this.crossings.length+2>MAX_CROSSINGS)return {ok:false,reason:`交差列は合計${MAX_CROSSINGS}項までです。σ²には2項分の空きが必要です。`};
      const events=this.events(),cut=events.findIndex(e=>e.x>=x),before=cut<0?events[events.length-1]:events[cut-1];
      const start=Math.max(560,x,before?before.x+10:560),end=start+300;
      // Open a local gap without reordering any existing event.
      if(cut>=0){const shift=Math.max(0,end+240-events[cut].x);for(const e of events.slice(cut)){
        if(e.kind==='crossing')this.crossings.find(c=>c.id===e.id).x+=shift;else this.record(e.id).x+=shift;
      }}
      const id=`pair-${this.nextId++}`;
      this.crossings.push({id:`${id}-a`,pairId:id,lane,x:start},{id:`${id}-b`,pairId:id,lane,x:end});
      this.crossings.sort((a,b)=>a.x-b.x);this.pairs.push({id});
      return {ok:true,id};
    }
    removePair(id){if(!this.pairs.some(p=>p.id===id))return false;this.crossings=this.crossings.filter(c=>c.pairId!==id);this.pairs=this.pairs.filter(p=>p.id!==id);return true;}
    togglePair(){
      if(this.expanded){this.removePair(this.legacyPair);this.expanded=false;}
      else{const result=this.insertPair(Math.max(3400,(this.crossings[this.crossings.length-1]?.x||3000)+400),1);if(result.ok){this.legacyPair=result.id;this.expanded=true;}}
    }
    expression(node,lanes){
      const factor=o=>{const word=node.terms[o]||[];return word.length?word.slice().reverse().join('∘'):`id${o}`;};
      if(node.portObjects.length===1)return factor(node.portObjects[0]);
      return lanes.filter(o=>node.portObjects.includes(o)).map(o=>{const label=factor(o);return label.includes('∘')?`(${label})`:label;}).join(' ⊗ ');
    }
    layout(half=106){
      let cursor=440;const lanes=[...OBJECTS],rows=ROWS,boxes={},crossings=[],ordered=[],points=Object.fromEntries(OBJECTS.map(o=>[o,[]]));
      for(const e of this.events()){
        const radius=e.kind==='box'?(e.compound?148:half):(e.lane===2?160:120),x=Math.max(e.x,cursor+radius+40),left=x-radius,right=x+radius;
        if(e.kind==='box'){
          const ports=e.portObjects.map(o=>({object:o,lane:lanes.indexOf(o),y:rows[lanes.indexOf(o)],identity:!e.terms[o]?.length})).sort((a,b)=>a.lane-b.lane);
          const bypassYs=e.compound?Object.fromEntries(OBJECTS.filter(o=>!e.portObjects.includes(o)).map(o=>[o,rows[lanes.indexOf(o)]])):{};
          const portYs=Object.fromEntries(ports.map(p=>[p.object,p.y])),y=(ports[0].y+ports[ports.length-1].y)/2;
          boxes[e.id]={...e,x,y,lane:ports[0].lane,ports,portYs,bypassYs,half:radius,expression:this.expression(e,lanes)};
          for(const [o,py]of Object.entries({...bypassYs,...portYs}))points[o].push([left,py,`${e.id}:in`],[right,py,`${e.id}:out`]);
        }else{
          const input=[...lanes],[a,b]=PAIRS[e.lane];
          [lanes[a],lanes[b]]=[lanes[b],lanes[a]];
          // The outer swap is drawn directly. The spectator keeps its height.
          for(const o of OBJECTS)points[o].push([left,rows[input.indexOf(o)],`${e.id}:${o}:in`],[right,rows[lanes.indexOf(o)],`${e.id}:${o}:out`,e.lane===2?'line':undefined]);
          crossings.push({...e,x,y:(rows[a]+rows[b])/2,objects:[input[a],input[b]],exchangeCount:1});
        }
        ordered.push({...e,logicalX:e.x,x,left,right});cursor=right;
      }
      const width=Math.max(3700,cursor+540),anchor=Math.min(580,ordered[0].left-30),plateau=Math.min(400,anchor-80);
      for(const [i,o]of OBJECTS.entries())points[o]=[[0,rows[i],'start'],[plateau,rows[i],'plateau'],[anchor,rows[i],'anchor'],...points[o],[width,rows[lanes.indexOf(o)],'end']];
      return {boxes,crossings,points,width,output:lanes,ordered};
    }
  }
  DiagramModel.OBJECTS=OBJECTS;DiagramModel.ROWS=ROWS;DiagramModel.PAIRS=PAIRS;DiagramModel.MAX_CROSSINGS=MAX_CROSSINGS;scope.DiagramModel=DiagramModel;
  if(typeof module!=='undefined'&&module.exports)module.exports=DiagramModel;
})(typeof globalThis!=='undefined'?globalThis:this);
