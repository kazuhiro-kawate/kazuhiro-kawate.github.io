/* Finite visual interpolation between equal typed diagrams. Intermediate frames
   illustrate the coherence move; they are not additional categorical equations. */
(function(scope){
  'use strict';
  const copy=p=>({x:p[0],y:p[1]});
  function sample(points,x){
    const sorted=[...points].sort((a,b)=>a.x-b.x);
    for(let i=1;i<sorted.length;i++)if(sorted[i].x>=x){const a=sorted[i-1],b=sorted[i];return a.y+(b.y-a.y)*Math.max(0,Math.min(1,(x-a.x)/Math.max(.001,b.x-a.x)));}
    return sorted[sorted.length-1]?.y||262;
  }
  class DiagramMotion{
    constructor(){this.boxes={};this.crossings={};this.points={};this.target=null;this.active=false;}
    setTarget(g,immediate=false){
      this.target=g;
      const first=!Object.keys(this.boxes).length;
      if(Object.keys(this.boxes).sort().join('|')!==Object.keys(g.boxes).sort().join('|'))immediate=true;
      for(const [id,b] of Object.entries(g.boxes))if(!this.boxes[id]||immediate)this.boxes[id]={x:b.x,y:b.y,half:b.half||106,portYs:{...b.bypassYs,...b.portYs}};
      for(const c of g.crossings)if(!this.crossings[c.id])this.crossings[c.id]={x:c.x,y:c.y,opacity:first||immediate?1:0};
      for(const [object,points] of Object.entries(g.points)){
        const state=this.points[object]||(this.points[object]=new Map());
        const previous=[...state.values()];
        for(const p of points)if(!state.has(p[2]))state.set(p[2],first||immediate?copy(p):{x:p[0],y:sample(previous,p[0])});
        if(immediate){state.clear();points.forEach(p=>state.set(p[2],copy(p)));}
      }
      if(immediate||first){
        this.boxes=Object.fromEntries(Object.entries(g.boxes).map(([id,b])=>[id,{x:b.x,y:b.y,half:b.half||106,portYs:{...b.bypassYs,...b.portYs}}]));
        this.crossings=Object.fromEntries(g.crossings.map(c=>[c.id,{x:c.x,y:c.y,opacity:1}]));
        this.active=false;
      }else this.active=true;
    }
    step(dt){
      if(!this.active)return false;
      const amount=1-Math.exp(-Math.min(64,dt)/85);
      let error=0;
      function toward(p,target){for(const key of Object.keys(target)){const d=target[key]-p[key];error=Math.max(error,Math.abs(d));p[key]+=d*amount;}}
      for(const [id,b] of Object.entries(this.target.boxes)){const state=this.boxes[id];toward(state,{x:b.x,y:b.y,half:b.half||106});for(const [o,y]of Object.entries({...b.bypassYs,...b.portYs})){if(state.portYs[o]===undefined)state.portYs[o]=state.y;const d=y-state.portYs[o];error=Math.max(error,Math.abs(d));state.portYs[o]+=d*amount;}}
      for(const [id,c] of Object.entries(this.crossings)){
        const target=this.target.crossings.find(t=>t.id===id);
        toward(c,target?{x:target.x,y:target.y,opacity:1}:{x:c.x,y:c.y,opacity:0});
      }
      for(const [object,state] of Object.entries(this.points)){
        const target=new Map(this.target.points[object].map(p=>[p[2],copy(p)]));
        for(const [key,p] of state)toward(p,target.get(key)||{x:p.x,y:sample([...target.values()],p.x)});
      }
      if(error<.12){this.setTarget(this.target,true);return false;}
      return true;
    }
    wires(half){
      const result={};
      for(const [object,state] of Object.entries(this.points)){
        const boxes=Object.entries(this.target.boxes).filter(([,b])=>b.portYs?.[object]!==undefined||b.bypassYs?.[object]!==undefined||b.object===object).map(([id])=>this.boxes[id]);
        const boxIds=new Set(Object.keys(this.target.boxes));
        const modes=new Map(this.target.points[object].map(p=>[p[2],p[3]]));
        const anchors=[...state].filter(([key,p])=>!boxIds.has(key.split(':')[0])&&!boxes.some(b=>p.x>=b.x-(b.half||half)&&p.x<=b.x+(b.half||half))).map(([key,p])=>[p.x,p.y,modes.get(key)]);
        for(const b of boxes){const radius=b.half||half,y=b.portYs?.[object]??b.y;anchors.push([b.x-radius,y],[b.x+radius,y]);}
        result[object]=anchors.sort((a,b)=>a[0]-b[0]);
      }
      return result;
    }
  }
  scope.DiagramMotion=DiagramMotion;
  if(typeof module!=='undefined'&&module.exports)module.exports=DiagramMotion;
})(typeof globalThis!=='undefined'?globalThis:this);
