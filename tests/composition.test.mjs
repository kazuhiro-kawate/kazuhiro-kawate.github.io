import '../assets/diagram-model.js';
import '../assets/diagram-motion.js';
const Model=globalThis.DiagramModel,Motion=globalThis.DiagramMotion;
let assertions=0;const assert=(c,m)=>{assertions++;if(!c)throw new Error(m);};
const model=new Model(),meaning=model.signature();
const valid=()=>{
  assert(model.signature()===meaning,'Composition changed the represented morphism');
  for(const half of [95,106]){
    const g=model.layout(half);
    assert(g.ordered.every((e,i)=>!i||e.left>=g.ordered[i-1].right+39.99),'Events overlap');
    for(const [id,b]of Object.entries(g.boxes))for(const p of b.ports){
      assert(g.points[p.object].some(([x,y])=>x===b.x-b.half&&y===p.y),'Missing composite input');
      assert(g.points[p.object].some(([x,y])=>x===b.x+b.half&&y===p.y),'Missing composite output');
    }
  }
};
let result=model.compose('serial',['about','research']);assert(result.ok,'f and g must compose');
assert(model.layout().boxes[result.id].expression==='h∘g','Wrong order of serial expression');
model.moveBox(result.id,3500);valid();assert(model.decompose(result.id),'Cannot expand serial composition');valid();
model.reset();result=model.compose('tensor',['projects','notes']);assert(result.ok,'h and k must tensor');
const tensor=result.id;
assert(model.layout().boxes[tensor].ports.length===3,'Ambient identity port missing');
assert(model.layout().boxes[tensor].ports.find(p=>p.object==='A').identity,'Spectator A is not the identity');
model.moveBox(tensor,600);valid();model.moveBox(tensor,4000);valid();model.flipBraid();valid();
const motion=new Motion();motion.setTarget(model.layout(),true);model.moveBox(tensor,900);motion.setTarget(model.layout());
for(let i=0;i<160;i++){
  for(const [id,box]of Object.entries(motion.boxes))for(const [o,y]of Object.entries(box.portYs)){
    assert(motion.wires(106)[o].some(([x,py])=>x===box.x-box.half&&py===y),'Moving multiport input disconnected');
    assert(motion.wires(106)[o].some(([x,py])=>x===box.x+box.half&&py===y),'Moving multiport output disconnected');
  }
  if(!motion.step(16))break;
}
assert(!motion.active,'Multiport motion never stops');
// Identity omission changes the box type, never the surrounding morphism.
model.reset();result=model.compose('tensor',['projects','notes'],{includeIdentities:false});
assert(result.ok,'Tensor without identities rejected');
const unpadded=result.id;
assert(model.node(unpadded).portObjects.join('')==='BC','Omitted identity remains in type');
for(const x of [600,1400,2600,4000]){
 model.moveBox(unpadded,x);valid();const box=model.layout().boxes[unpadded];
 assert(box.ports.length===2&&!box.ports.some(p=>p.identity),'Unexpected identity port');
 assert(!box.expression.includes('id'),'Unexpected identity in expression');
 assert(box.bypassYs.A!==undefined,'Spectator channel missing');
 const flow=new Motion();flow.setTarget(model.layout(),true);model.moveBox(unpadded,x+600);flow.setTarget(model.layout());
 for(let i=0;i<160;i++){for(const [o,y]of Object.entries(flow.boxes[unpadded].portYs))assert(flow.wires(106)[o].some(([wx,wy])=>wx===flow.boxes[unpadded].x-148&&wy===y),'Spectator or factor disconnected in motion');if(!flow.step(16))break;}
 assert(!flow.active,'Unpadded motion never stops');
}
const unpaddedSnapshot=model.snapshot();model.reset();model.restore(unpaddedSnapshot);
assert(model.node(unpadded).portObjects.length===2,'Identity choice lost on restore');
assert(model.decompose(unpadded),'Unpadded tensor cannot expand');valid();
model.reset();const two=model.compose('tensor',['projects','notes'],{includeIdentities:false});
result=model.compose('tensor',[two.id,'about'],{includeIdentities:false});assert(result.ok,'Nested unpadded tensor rejected');valid();
assert(model.node(result.id).portObjects.length===3,'Nested selected factor lost');
model.reset();const serial=model.compose('serial',['about','research']);result=model.compose('tensor',[serial.id,'projects','notes']);assert(result.ok,'Nested tensor rejected');valid();
assert(model.decompose(result.id),'Nested tensor does not expand');assert(model.decompose(serial.id),'Nested serial does not expand');valid();
assert(!model.compose('serial',['about','projects']).ok,'Accepted mismatched serial types');
assert(!model.compose('tensor',['about','research']).ok,'Accepted overlapping tensor factors');
assert(!model.compose('serial',['about','about']).ok,'Duplicate operand accepted');
for(let i=0;i<10;i++){const pair=model.insertPair(700+i*170,i%2);assert(pair.ok,'Interior pair rejected');valid();model.flipBraid();valid();}
for(const p of [...model.pairs]){assert(model.removePair(p.id),'Pair cannot be removed');valid();}
model.reset();const first=model.insertPair(650,0),second=model.insertPair(1800,1);assert(first.ok&&second.ok,'Pair insertion failed');
assert(model.crossings.find(c=>c.pairId===first.id).x<model.crossings.find(c=>c.id==='sigma-0').x,'Pair was fixed to the end');valid();
const snapshot=model.snapshot();model.reset();model.restore(snapshot);assert(JSON.stringify(model.snapshot())===JSON.stringify(snapshot),'Groups/pairs not restored');valid();
// The three A-generators must retain f,g,h even when a tensor moves them.
model.reset();const shared=model.compose('tensor',['about','notes']);
assert(shared.ok,'Cross-wire group rejected');model.moveBox('guide',5000);valid();
assert(model.node(shared.id).x<model.node('research').x,'Cross-wire push reversed g,h');
model.moveBox('research',600);valid();
assert(model.node('guide').x<model.node(shared.id).x,'Backward push reversed f,g');
model.reset();model.insertPair(650,0);model.insertPair(1800,1);
let seed=4093;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<500;i++){
 const roots=model.roots(),op=Math.floor(random()*6);
 if(op===0)model.moveBox(roots[Math.floor(random()*roots.length)].id,560+random()*6000);
 if(op===1)model.flipBraid();
 if(op===2&&model.pairs.length<5)model.insertPair(650+random()*6000,Math.floor(random()*2));
 if(op===3&&model.pairs.length)model.removePair(model.pairs[Math.floor(random()*model.pairs.length)].id);
 if(op===4&&roots.length>1){const a=Math.floor(random()*roots.length),b=(a+1)%roots.length;model.compose(random()<.5?'serial':'tensor',[roots[a].id,roots[b].id],{includeIdentities:random()<.5});}
 if(op===5){const compounds=roots.filter(r=>r.compound);if(compounds.length)model.decompose(compounds[0].id);}
 valid();
}
const output={passed:true,assertions,operations:500};
if(typeof document!=='undefined')document.querySelector('pre').textContent+='\nComposition: '+JSON.stringify(output);
console.log('Composition tests passed:',assertions);export default output;
