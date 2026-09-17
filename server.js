const http=require('http');
const {WebSocketServer}=require('ws');
const P=new Map(), BASES={}, BST={}, GUARD={}, SAFE={}, FLOORS={};
let LOTS=[], lotId=1, FORCED={}, SKIP=null, BELT=[], sid=1;
const EV_PERIOD=1800000, EV_LEN=300000, EV_CH=.20;
const NIGHT_EVERY=3600000, NIGHT_LEN=600000;
const hash01=k=>{const x=Math.sin(k*12.9898)*43758.5453;return x-Math.floor(x)};
const slotStart=()=>Math.floor(Date.now()/EV_PERIOD)*EV_PERIOD;
const RAR_CH=[60,25,10.5,3.4,1,.4,.1];
const PARTS=[[0,2,130],[0,3,175],[0,5,265],[0,7,355],[1,12,580],[1,18,850],[1,24,1120],[1,30,1390],[2,48,2200],[2,62,2830],[2,80,3640],[3,900,80000],[3,1500,140000],[3,2200,200000],[4,3200,300000],[4,4500,420000],[4,5400,500000],[5,7000,620000],[5,9200,780000],[6,13000,1000000]];
const NAMES=['Переходник Type-C','Резисторы 1 кОм','LED-лента 1 м','USB-хаб','Реле 5 В','OLED-дисплей','Bluetooth-модуль','Шаговый мотор','Arduino Nano','Wi-Fi модуль ESP','Блок питания 12 В','Raspberry Pi','Тепловизор-модуль','FPGA-плата','Серверный GPU','Квантовый чип','Нейроускоритель','Ядро Демиурга','Плата Творца','Чёрный ящик ???'];
const KIND=['dongle','chip','strip','dongle','chip','screen','board','motor','board','board','brick','board','screen','board','brick','chip','brick','divine','divine','secret'];
const COL=[0xb9c2d6,0xc0a080,0x36e0a0,0x8fa0c0,0x4fa3ff,0x2ad4ff,0x2f7fe0,0xd0d6e2,0x2fbfa0,0x9ad6ff,0x7a86a8,0x59d97a,0xff8a3d,0xf0c05a,0xff5d8f,0xc07dff,0xff2f6d,0xfff0a0,0xa0ffe0,0x00ffc8];
const DD=['','','','','','','','','','','','','','','','','','core','rings',''];
function evs(){
  const out=[], st=slotStart(), k=Math.floor(st/EV_PERIOD), r=hash01(k), now=Date.now();
  if(now-st<EV_LEN&&SKIP!==k){
    if(r<EV_CH)out.push({id:'rainbow',until:st+EV_LEN,src:'slot'});
    else if(r<EV_CH*2)out.push({id:'crab',until:st+EV_LEN,src:'slot'});
    else if(r<EV_CH*2+.05)out.push({id:'space',until:st+EV_LEN,src:'slot'});
  }
  const hs=Math.floor(now/NIGHT_EVERY)*NIGHT_EVERY;
  if(now-hs<NIGHT_LEN)out.push({id:'night',until:hs+NIGHT_LEN,src:'slot'});
  Object.keys(FORCED).forEach(id=>{
    if(FORCED[id]>now){
      const e=out.find(x=>x.id===id);
      if(e)e.until=Math.max(e.until,FORCED[id]); else out.push({id,until:FORCED[id],src:'admin'});
    }
  });
  return out;
}
function pick(){
  let roll=Math.random()*RAR_CH.reduce((a,b)=>a+b,0), tier=0;
  for(let i=0;i<RAR_CH.length;i++){roll-=RAR_CH[i];if(roll<=0){tier=i;break}}
  const idx=PARTS.map((p,i)=>i).filter(i=>PARTS[i][0]===tier);
  const i=idx[Math.floor(Math.random()*idx.length)];
  const m=[], ev=evs().map(e=>e.id);
  if(ev.includes('rainbow')&&Math.random()<.25)m.push('rainbow');
  if(ev.includes('space')&&Math.random()<.10)m.push('space');
  if(Math.random()<.03)m.push('diamond');
  if(Math.random()<.15)m.push('gold');
  const o={n:NAMES[i],r:PARTS[i][0],i:PARTS[i][1],p:PARTS[i][2],k:KIND[i],c:COL[i],m:m.length?m:null};
  if(DD[i])o.d=DD[i];
  return o;
}
const s=http.createServer((q,r)=>{r.writeHead(200);r.end('online: '+P.size)});
const w=new WebSocketServer({server:s});
const all=o=>{const m=JSON.stringify(o);w.clients.forEach(c=>{if(c.readyState===1)c.send(m)})};
w.on('connection',c=>{
  let n=null;
  c.send(JSON.stringify({t:'market',lots:LOTS}));
  c.send(JSON.stringify({t:'bases',bases:BASES}));
  c.send(JSON.stringify({t:'basestate',state:BST}));
  c.send(JSON.stringify({t:'guards',guard:GUARD,safe:SAFE,fl:FLOORS}));
  c.send(JSON.stringify({t:'events',list:evs()}));
  c.on('message',d=>{
    let m;try{m=JSON.parse(d)}catch(e){return}
    if(m.t==='hello'){n=String(m.nick||'игрок').slice(0,14);P.set(n,{nick:n,x:0,z:0,yaw:0,it:null,ad:false,cr:0,seen:Date.now(),ws:c});return}
    if(!n)return;
    const p=P.get(n);if(!p)return;
    p.seen=Date.now();
    if(m.t==='pos'){p.x=+m.x||0;p.z=+m.z||0;p.yaw=+m.yaw||0;p.it=m.it||null;p.ad=!!m.ad;p.cr=+m.cr||0}
    else if(m.t==='say')all({t:'say',nick:n,text:String(m.text||'').slice(0,120)});
    else if(m.t==='stealing')all({t:'stealing',base:+m.base,idx:+m.idx,on:m.on?1:0,who:n});
    else if(m.t==='release'){
      Object.keys(BASES).forEach(k=>{
        if(BASES[k]===n){delete BASES[k];delete BST[k];delete GUARD[k];delete SAFE[k];delete FLOORS[k]}
      });
      all({t:'bases',bases:BASES});
      all({t:'basestate',state:BST});
      all({t:'guards',guard:GUARD,safe:SAFE,fl:FLOORS});
    }
    else if(m.t==='grant'){
      const to=P.get(String(m.to||''));
      if(to&&to.ws&&to.ws.readyState===1)
        to.ws.send(JSON.stringify({t:'granted',item:String(m.item||''),until:+m.until||0,from:n}));
    }
    else if(m.t==='jam'){
      const to=P.get(String(m.to||''));
      if(to&&to.ws&&to.ws.readyState===1)to.ws.send(JSON.stringify({t:'jam'}));
    }
    else if(m.t==='hit'){
      const to=P.get(String(m.to||''));
      if(to&&to.ws&&to.ws.readyState===1)to.ws.send(JSON.stringify({t:'hit',by:n}));
    }
    else if(m.t==='lasers')all({t:'lasers',base:+m.base});
    else if(m.t==='return'){
      const b=+m.base;
      if(!BST[b]||!m.part)return;
      const free=BST[b].findIndex(x=>!x);
      if(free>=0)BST[b][free]=m.part;
      all({t:'basestate',state:BST});
    }
    else if(m.t==='claim'){
      const b=+m.base;
      if(!(b>=0&&b<6))return;
      if(BASES[b]&&BASES[b]!==n){c.send(JSON.stringify({t:'claimfail',bases:BASES}));return}
      Object.keys(BASES).forEach(k=>{if(BASES[k]===n)delete BASES[k]});
      BASES[b]=n;all({t:'bases',bases:BASES});
    }
    else if(m.t==='base'){
      const b=+m.base;
      if(BASES[b]!==n)return;
      BST[b]=Array.isArray(m.slots)?m.slots.slice(0,24):[];
      GUARD[b]=!!m.guard;
      FLOORS[b]=Math.max(1,Math.min(3,+m.fl||1));
      if(+m.safe>=0)SAFE[b]=+m.safe; else delete SAFE[b];
      all({t:'basestate',state:BST});
      all({t:'guards',guard:GUARD,safe:SAFE,fl:FLOORS});
    }
    else if(m.t==='steal'){
      const b=+m.base, i=+m.idx;
      all({t:'stealing',base:b,idx:i,on:0,who:n});
      if(!BST[b]||!BST[b][i])return;
      if(SAFE[b]===i)return;
      const part=BST[b][i];BST[b][i]=null;
      c.send(JSON.stringify({t:'stolen',part,base:b}));
      const vic=P.get(BASES[b]);
      if(vic&&vic.ws&&vic.ws.readyState===1)
        vic.ws.send(JSON.stringify({t:'robbed',who:m.anon?'неизвестный':n,name:(part&&part.n)||'схема'}));
      all({t:'basestate',state:BST});
    }
    else if(m.t==='take'){
      const i=BELT.findIndex(x=>x.sid===m.sid);
      if(i<0)return;
      BELT.splice(i,1);
      all({t:'took',sid:m.sid,by:n});
    }
    else if(m.t==='aspawn'&&m.part){
      const it={sid:sid++,part:m.part};
      BELT.push(it);all({t:'spawn',sid:it.sid,part:it.part});
    }
    else if(m.t==='forceev'){FORCED[String(m.id)]=Date.now()+EV_LEN;all({t:'events',list:evs()})}
    else if(m.t==='clearev'){FORCED={};SKIP=Math.floor(slotStart()/EV_PERIOD);all({t:'events',list:evs()})}
    else if(m.t==='sell'){
      const price=Math.max(1,Math.floor(+m.price||0));
      if(!m.part||LOTS.length>200)return;
      LOTS.push({id:lotId++,seller:n,part:m.part,price});
      all({t:'market',lots:LOTS});
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
      all({t:'market',lots:LOTS});
    }
  });
  c.on('close',()=>{if(n&&P.get(n)&&P.get(n).ws===c)P.delete(n)});
});
setInterval(()=>{
  const t=Date.now();
  P.forEach((p,k)=>{if(t-p.seen>6000)P.delete(k)});
  if(P.size)all({t:'state',players:[...P.values()].map(p=>({nick:p.nick,x:p.x,z:p.z,yaw:p.yaw,it:p.it,ad:p.ad,cr:p.cr||0}))});
},80);
setInterval(()=>{
  if(!P.size)return;
  if(BELT.length>24)BELT.shift();
  const it={sid:sid++,part:pick()};
  BELT.push(it);all({t:'spawn',sid:it.sid,part:it.part});
},3600);
setInterval(()=>all({t:'events',list:evs()}),5000);
s.listen(process.env.PORT||8080,()=>console.log('server up'));
