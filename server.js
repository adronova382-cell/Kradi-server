const http=require('http');
const {WebSocketServer}=require('ws');
const P=new Map(), BASES={}, BST={};
let LOTS=[], lotId=1, FORCED={}, SKIP=null;
const EV_PERIOD=1800000, EV_LEN=300000, EV_CH=.20;
const hash01=k=>{const x=Math.sin(k*12.9898)*43758.5453;return x-Math.floor(x)};
const slotStart=()=>Math.floor(Date.now()/EV_PERIOD)*EV_PERIOD;
function events(){
  const out=[], st=slotStart(), k=Math.floor(st/EV_PERIOD), r=hash01(k), now=Date.now();
  if(now-st<EV_LEN&&SKIP!==k){
    if(r<EV_CH)out.push({id:'rainbow',until:st+EV_LEN,src:'slot'});
    else if(r<EV_CH*2)out.push({id:'crab',until:st+EV_LEN,src:'slot'});
    else if(r<EV_CH*2+.05)out.push({id:'space',until:st+EV_LEN,src:'slot'});
  }
  Object.keys(FORCED).forEach(id=>{
    if(FORCED[id]>now){
      const e=out.find(x=>x.id===id);
      if(e)e.until=Math.max(e.until,FORCED[id]); else out.push({id,until:FORCED[id],src:'admin'});
    }
  });
  return out;
}
const s=http.createServer((q,r)=>{r.writeHead(200);r.end('online: '+P.size)});
const w=new WebSocketServer({server:s});
const all=o=>{const m=JSON.stringify(o);w.clients.forEach(c=>{if(c.readyState===1)c.send(m)})};
const sendMarket=()=>all({t:'market',lots:LOTS});
const sendBases=()=>all({t:'bases',bases:BASES});
const sendState=()=>all({t:'basestate',state:BST});
const sendEvents=()=>all({t:'events',list:events()});
w.on('connection',c=>{
  let n=null;
  c.send(JSON.stringify({t:'market',lots:LOTS}));
  c.send(JSON.stringify({t:'bases',bases:BASES}));
  c.send(JSON.stringify({t:'basestate',state:BST}));
  c.send(JSON.stringify({t:'events',list:events()}));
  c.on('message',d=>{
    let m;try{m=JSON.parse(d)}catch(e){return}
    if(m.t==='hello'){n=String(m.nick||'игрок').slice(0,14);P.set(n,{nick:n,x:0,z:0,yaw:0,it:null,seen:Date.now(),ws:c});return}
    if(!n)return;
    const p=P.get(n);if(!p)return;
    p.seen=Date.now();
    if(m.t==='pos'){p.x=+m.x||0;p.z=+m.z||0;p.yaw=+m.yaw||0;p.it=m.it||null}
    else if(m.t==='say')all({t:'say',nick:n,text:String(m.text||'').slice(0,120)});
    else if(m.t==='claim'){
      const b=+m.base;
      if(!(b>=0&&b<6))return;
      if(BASES[b]&&BASES[b]!==n){c.send(JSON.stringify({t:'claimfail',bases:BASES}));return}
      Object.keys(BASES).forEach(k=>{if(BASES[k]===n)delete BASES[k]});
      BASES[b]=n;sendBases();
    }
    else if(m.t==='base'){
      const b=+m.base;
      if(BASES[b]!==n)return;
      BST[b]=Array.isArray(m.slots)?m.slots.slice(0,12):[];
      sendState();
    }
    else if(m.t==='steal'){
      const b=+m.base, i=+m.idx;
      if(!BST[b]||!BST[b][i])return;
      const part=BST[b][i];
      BST[b][i]=null;
      c.send(JSON.stringify({t:'stolen',part}));
      const vic=P.get(BASES[b]);
      if(vic&&vic.ws&&vic.ws.readyState===1)
        vic.ws.send(JSON.stringify({t:'robbed',who:n,name:(part&&part.n)||'схема'}));
      sendState();
    }
    else if(m.t==='forceev'){FORCED[String(m.id)]=Date.now()+EV_LEN;sendEvents()}
    else if(m.t==='clearev'){FORCED={};SKIP=Math.floor(slotStart()/EV_PERIOD);sendEvents()}
    else if(m.t==='sell'){
      const price=Math.max(1,Math.floor(+m.price||0));
      if(!m.part||LOTS.length>200)return;
      LOTS.push({id:lotId++,seller:n,part:m.part,price});
      sendMarket();
    }
    else if(m.t==='buy'){
      const i=LOTS.findIndex(l=>l.id===m.id);
      if(i<0)return;
      const lot=LOTS[i];
      if(lot.seller===n)return;
      LOTS.splice(i,1);
      c.send(JSON.stringify({t:'bought',part:lot.part,price:lot.price}));
      const sel=P.get(lot.seller);
      if(sel&&sel.ws&&sel.ws.readyState===1)
        sel.ws.send(JSON.stringify({t:'sold',price:lot.price,buyer:n,name:(lot.part&&lot.part.n)||'схема'}));
      sendMarket();
    }
  });
  c.on('close',()=>{if(n&&P.get(n)&&P.get(n).ws===c)P.delete(n)});
});
setInterval(()=>{
  const t=Date.now();
  P.forEach((p,k)=>{if(t-p.seen>6000)P.delete(k)});
  if(P.size)all({t:'state',players:[...P.values()].map(p=>({nick:p.nick,x:p.x,z:p.z,yaw:p.yaw,it:p.it}))});
},80);
setInterval(sendEvents,5000);
s.listen(process.env.PORT||8080,()=>console.log('server up'));
