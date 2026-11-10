import '../assets/diagram-model.js';
import '../assets/diagram-motion.js';
const Model=globalThis.DiagramModel,Motion=globalThis.DiagramMotion;
const model=new Model(),motion=new Motion();
let assertions=0;
function assert(c,m){assertions++;if(!c)throw new Error(m);}
const first=model.layout();motion.setTarget(first,true);
model.moveBox('guide',1500);const target=model.layout();motion.setTarget(target);
const y=motion.boxes.guide.y;motion.step(16);
assert(motion.boxes.guide.y>y&&motion.boxes.guide.y<target.boxes.guide.y,'Crossing y jumped instead of interpolating');
assert(motion.boxes.guide.x>first.boxes.guide.x&&motion.boxes.guide.x<target.boxes.guide.x,'Crossing x jumped');
for(let frame=0;frame<180;frame++){
  for(const [id,b] of Object.entries(motion.boxes)){
    const object=target.boxes[id].object,wires=motion.wires(106)[object];
    assert(wires.some(([x,y])=>x===b.x-106&&y===b.y),'Animated input disconnected');
    assert(wires.some(([x,y])=>x===b.x+106&&y===b.y),'Animated output disconnected');
  }
  for(const points of Object.values(motion.wires(106)))assert(points.every((p,i)=>!i||p[0]>=points[i-1][0]),'Animation backtracks');
  if(!motion.step(16))break;
}
assert(!motion.active,'Animation did not stop');
assert(motion.boxes.guide.y===target.boxes.guide.y,'Did not settle on the correct wire');
model.togglePair();motion.setTarget(model.layout());for(let i=0;i<180&&motion.active;i++)motion.step(16);
assert(!motion.active,'Pair expansion did not settle');
model.togglePair();motion.setTarget(model.layout());for(let i=0;i<180&&motion.active;i++)motion.step(16);
assert(!motion.active,'Pair contraction did not settle');
assert(Object.keys(motion.crossings).length===3,'Retired crossings leaked');
model.flipBraid();const immediate=model.layout();motion.setTarget(immediate,true);
assert(!motion.active,'Reduced motion starts an animation');
assert(motion.boxes.guide.y===immediate.boxes.guide.y,'Reduced motion leaves stale position');
const result={passed:true,assertions};
if(typeof document!=='undefined')document.querySelector('pre').textContent+='\nMotion: '+JSON.stringify(result);
console.log('Motion tests passed:',assertions,'assertions');
export default result;
