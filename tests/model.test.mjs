import '../assets/diagram-model.js';
const Model=globalThis.DiagramModel;
let assertions=0;
function assert(condition,message){assertions++;if(!condition)throw new Error(message);}
function validate(model,signature){
  assert(model.signature()===signature,'Semantic signature changed');
  for(const half of [95,106]){
    const layout=model.layout(half);
    for(const object of Model.OBJECTS){
      const points=layout.points[object];
      assert(points.every((p,i)=>!i||p[0]>=points[i-1][0]),'Wire runs backwards');
      assert(points.slice(0,3).every(p=>p[1]===Model.ROWS[Model.OBJECTS.indexOf(object)]),'Incoming wire bends');
      assert(points[points.length-1][1]===Model.ROWS[layout.output.indexOf(object)],'Wrong output port');
    }
    for(const box of Object.values(layout.boxes)){
      assert(layout.points[box.object].some(([x,y])=>x===box.x-half&&y===box.y),'Missing input connection');
      assert(layout.points[box.object].some(([x,y])=>x===box.x+half&&y===box.y),'Missing output connection');
    }
    assert(layout.ordered.every((e,i)=>!i||e.left>=layout.ordered[i-1].right+39.99),'Overlapping boxes/crossings');
  }
}
const model=new Model(),signature=model.signature();
assert(JSON.parse(signature).output.join('')==='CBA','Wrong braid boundary');
model.moveBox('about',1400);
assert(model.layout().boxes.about.lane===1,'f did not cross the first symmetry');
validate(model,signature);
model.moveBox('about',3400);
assert(model.layout().boxes.about.lane===2,'f did not follow A through all crossings');
assert(model.node('research').x>model.node('about').x,'f and g order reversed');
validate(model,signature);
model.moveBox('research',700);
assert(model.node('guide').x<model.node('about').x&&model.node('about').x<model.node('research').x,'Pushing f backwards reversed order');
validate(model,signature);
model.moveBox('projects',600);
assert(model.events().findIndex(e=>e.id==='projects')<model.events().findIndex(e=>e.id==='about'),'Independent boxes did not interchange');
validate(model,signature);
model.flipBraid();validate(model,signature);
model.togglePair();validate(model,signature);
model.togglePair();validate(model,signature);
const saved=model.snapshot();model.reset();model.restore(saved);
assert(JSON.stringify(model.snapshot())===JSON.stringify(saved),'Snapshot roundtrip failed');
model.moveBox('research',560);validate(model,signature);
assert(model.node('guide').x<model.node('about').x&&model.node('about').x<model.node('research').x,'Three-box chain collapsed at left boundary');
// Reproducible property checks over long moves, reflow, both braid words,
// cancellation pairs, and crossing slides. No external test framework.
let seed=1931;
const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<1200;i++){
  const op=Math.floor(random()*5);
  if(op<2)model.moveBox(model.boxes[Math.floor(random()*model.boxes.length)].id,500+random()*5000);
  else if(op===2)model.flipBraid();
  else if(op===3)model.togglePair();
  else{const c=model.crossings[Math.floor(random()*model.crossings.length)];model.moveCrossing(c.id,500+random()*5000);}
  validate(model,signature);
}
const result={passed:true,assertions,operations:1200,signature};
globalThis.diagramTestResult=result;
if(typeof document!=='undefined'){
  const output=document.querySelector('pre');if(output)output.textContent=JSON.stringify(result,null,2);
}
console.log('Diagram model tests passed:',assertions,'assertions');
export default result;
