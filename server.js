const http=require('http');
const {WebSocketServer}=require('ws');
const P=new Map();
const s=http.createServer((q,r)=>{r.writeHead(200);r.end('online: '+P.size)});
const w=new WebSocketServer({server:s});
const all=o=>{const m=JSON.stringify(o);w.clients.forEach(c=>{if(c.readyState===1)c.send(m)})};
w.on('connection',c=>{
  let n=null;
  c.on('message',d=>{
    let m;try{m=JSON.parse(d)}catch(e){return}
    if(m.t==='hello'){n=String(m.nick||'игрок').slice(0,14);P.set(n,{nick:n,x:0,z:0,yaw:0,seen:Date.now()});return}
    if(!n)return;
    const p=P.get(n);if(!p)return;
    p.seen=Date.now();
    if(m.t==='pos'){p.x=+m.x||0;p.z=+m.z||0;p.yaw=+m.yaw||0}
    else if(m.t==='say')all({t:'say',nick:n,text:String(m.text||'').slice(0,120)});
  });
  c.on('close',()=>{if(n)P.delete(n)});
});
setInterval(()=>{
  const t=Date.now();
  P.forEach((p,k)=>{if(t-p.seen>15000)P.delete(k)});
  if(P.size)all({t:'state',players:[...P.values()].map(p=>({nick:p.nick,x:p.x,z:p.z,yaw:p.yaw}))});
},80);
s.listen(process.env.PORT||8080,()=>console.log('server up'));
