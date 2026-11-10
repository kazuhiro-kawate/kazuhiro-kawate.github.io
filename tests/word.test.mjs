import '../assets/diagram-model.js';
import '../assets/diagram-motion.js';
const Model=globalThis.DiagramModel,Motion=globalThis.DiagramMotion;
let assertions=0;const assert=(v,m)=>{assertions++;if(!v)throw Error(m);};
const model=new Model(),words=JSON.parse(model.signature()).words;
assert(model.boxes[0].id==='guide'&&model.boxes.map(b=>b.symbol).join('')==='fghij','Guide/order/symbol mismatch');
const permutation=word=>{const lanes=[...Model.OBJECTS];for(const i of word){const [a,b]=[[0,1],[1,2],[2,0]][i];[lanes[a],lanes[b]]=[lanes[b],lanes[a]];}return lanes;};
function validate(){
 const signature=JSON.parse(model.signature()),layout=model.layout();
 assert(JSON.stringify(signature.words)===JSON.stringify(words),'A word edit reordered generators');
 assert(JSON.stringify(signature.output)===JSON.stringify(permutation(model.word())),'Incorrect boundary permutation');
 assert(layout.ordered.every((e,i)=>!i||e.left>=layout.ordered[i-1].right+39.99),'Word overlaps events');
 assert(new Set(model.crossings.map(c=>c.id)).size===model.crossings.length,'Crossing anchors are not unique');
 for(const [o,points]of Object.entries(layout.points))assert(points.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)),o+' has nonfinite coordinates');
}
assert(model.setWord([2]).ok,'sigma3 rejected');assert(model.layout().output.join('')==='CBA','sigma3 must exchange first and third');const outer=model.layout(),outerId=outer.crossings[0].id;
assert(outer.crossings[0].exchangeCount===1,'Outer exchange was expanded into intermediate swaps');
for(const o of Model.OBJECTS){const points=outer.points[o].filter(p=>p[2].startsWith(outerId+':'));assert(points.length===2,'Unexpected intermediate waypoint in sigma3');assert(points[1][3]==='line','sigma3 must use a direct line');}
assert(outer.points.B.filter(p=>p[2].startsWith(outerId+':')).every(p=>p[1]===Model.ROWS[1]),'Middle wire bends during sigma3');

model.setWord([2,2]);assert(model.layout().output.join('')==='ABC','sigma3 squared is not identity');
for(const word of [[],[2],[2,2],[0,2,0,2],[0,1,0],[1,2,1],Array(64).fill(2)]){
 assert(model.setWord(word).ok,'Valid word rejected');assert(JSON.stringify(model.word())===JSON.stringify(word),'Word was simplified or changed');validate();
 const snapshot=model.snapshot();model.reset();model.restore(snapshot);assert(JSON.stringify(model.snapshot())===JSON.stringify(snapshot),'Word undo snapshot broken');
}
for(const invalid of [[-1],[3],[1.5],[NaN],null,Array(65).fill(0),Array(256).fill(1)]){
 const snapshot=JSON.stringify(model.snapshot());assert(!model.setWord(invalid).ok,'Invalid/excessive word accepted');assert(JSON.stringify(model.snapshot())===snapshot,'Rejected word partially mutated diagram');
}
model.setWord(Array(63).fill(0));const beforeCap=JSON.stringify(model.snapshot());assert(!model.insertPair(700,2).ok,'Pair overflow accepted');assert(JSON.stringify(model.snapshot())===beforeCap,'Pair overflow mutated diagram');
model.setWord(Array(62).fill(0));const beforePair=model.signature(),pair=model.insertPair(800,2);assert(pair.ok,'Last available pair rejected');assert(model.word().length===64,'Pair not reflected in word');assert(model.signature()===beforePair,'Pair changes represented morphism');assert(model.removePair(pair.id),'Pair removal failed');validate();
model.setWord([0,1,0,2,2]);const braidMeaning=model.signature();assert(model.flipBraid(),'Applicable braid rejected');assert(model.signature()===braidMeaning,'Braid changes meaning');assert(model.word().length===5,'Braid deleted sigma squared');
let seed=17011;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<350;i++){
 const word=Array.from({length:Math.floor(random()*65)},()=>Math.floor(random()*3));model.setWord(word);validate();
 const meaning=model.signature(),id=model.boxes[Math.floor(random()*model.boxes.length)].id;
 model.moveBox(id,560+random()*22000);assert(model.signature()===meaning,'Moving box after arbitrary word changes meaning');
 model.flipBraid();assert(model.signature()===meaning,'Arbitrary braid relation changes meaning');validate();
}
// Verify every intermediate frame, including adding/removing all crossings.
const motion=new Motion();model.reset();motion.setTarget(model.layout(),true);
for(const word of [Array.from({length:64},(_,i)=>i%3),[2,2,0,1,0],[],[2,1,2]]){
 const old=model.layout();model.setWord(word);motion.setTarget(model.layout());assert(motion.active,'Word change skipped animation');
 let frames=0;while(motion.active&&frames<200){
  const wires=motion.wires(106);for(const [id,b]of Object.entries(motion.boxes))for(const [o,y]of Object.entries(b.portYs))assert(wires[o].some(([x,py])=>x===b.x-b.half&&py===y),'Animation disconnected a box');
  motion.step(16);frames++;
 }
 assert(!motion.active,'Word animation did not settle');assert(Object.keys(motion.crossings).length===word.length,'Removed crossings leaked');
 for(const [o,points]of Object.entries(motion.wires(106)))assert(points.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)),o+' has invalid animation anchors');
}
// Initial generation is bounded separately from the editable 64-token word.
model.reset();const initialWords=JSON.parse(model.signature()).words;let previous='';
for(let i=0;i<500;i++){
 assert(model.randomizeInitialWord(random,previous).ok,'Initial word generation failed');
 const word=model.word();assert(word.length>=1&&word.length<=6,'Initial word exceeds six terms');
 assert(word.every(l=>Number.isInteger(l)&&l>=0&&l<3),'Invalid initial transposition');
 assert(JSON.stringify(word)!==previous,'Initial word immediately repeated');
 assert(JSON.stringify(JSON.parse(model.signature()).words)===JSON.stringify(initialWords),'Randomization changed boxes');
 previous=JSON.stringify(word);
}
model.randomizeInitialWord(()=>0);assert(model.word().length===1,'Minimum initial length incorrect');
model.randomizeInitialWord(()=>.999999);assert(model.word().length===6,'Maximum initial length incorrect');
assert(model.setWord(Array(64).fill(2)).ok,'Initial six-term bound leaked into manual editing');
// Random wire assignment preserves all labels and initial horizontal order.
for(let i=0;i<200;i++){
 model.reset();const initial=model.boxes.map(b=>({id:b.id,x:b.x,symbol:b.symbol}));
 assert(model.randomizeInitialBoxes(random).ok,'Initial box placement failed');
 assert(JSON.stringify(model.boxes.map(b=>({id:b.id,x:b.x,symbol:b.symbol})))===JSON.stringify(initial),'Initial horizontal order or symbols changed');
 assert(model.boxes.every(b=>Model.OBJECTS.includes(b.object)),'Invalid object assignment');
 model.randomizeInitialWord(random);const initialLayout=model.layout();assert(model.boxes.every((b,i)=>!i||initialLayout.boxes[b.id].x>initialLayout.boxes[model.boxes[i-1].id].x),'Rendered initial horizontal order changed');
 const meaning=model.signature();model.moveBox(model.boxes[Math.floor(random()*5)].id,560+random()*5000);
 assert(model.signature()===meaning,'Randomized wires broke box precedence');
 for(const kind of ['serial','tensor']){
  const roots=model.roots();model.compose(kind,[roots[0].id,roots[1].id]);assert(model.signature()===meaning,'Composition after wire randomization changed meaning');
 }
 model.randomizeInitialWord(random);const fresh=JSON.parse(model.signature()).words;
 assert(JSON.stringify(fresh)===JSON.stringify(JSON.parse(meaning).words),'Random crossing word changed randomized boxes');
}
const benchmark=[];
for(const n of [32,64,128,256]){
 const fixture=new Model();fixture.crossings=Array.from({length:n},(_,i)=>({id:'stress-'+i,lane:i%3,x:1080+i*360}));
 const times=[];let g;for(let i=0;i<20;i++){const start=performance.now();g=fixture.layout();times.push(performance.now()-start);}
 times.sort((a,b)=>a-b);benchmark.push({crossings:n,width:g.width,points:Object.values(g.points).reduce((s,p)=>s+p.length,0),medianLayoutMs:Math.round(times[10]*1000)/1000});
}
const result={passed:true,assertions,operations:350,benchmark};
if(typeof document!=='undefined')document.querySelector('pre').textContent+='\nWord: '+JSON.stringify(result);
console.log('Word tests:',result);export default result;
