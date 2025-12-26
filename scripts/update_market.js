#!/usr/bin/env node
const fs=require("fs"),path=require("path"),https=require("https"),zlib=require("zlib");

const root=path.resolve(__dirname,"..");
const cfgPath=path.join(root,"data","blockpilot.json");
const outPath=path.join(root,"data","market.json");

function readCfg(){
  try{return JSON.parse(fs.readFileSync(cfgPath,"utf8"));}catch{return {};}
}

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

function httpGet(url, headers={}, redirectsLeft=3){
  return new Promise((resolve,reject)=>{
    const req=https.request(url,{method:"GET",headers:{accept:"application/json","accept-encoding":"gzip,deflate",...headers}},res=>{
      const sc=res.statusCode||0;
      const loc=res.headers.location;

      if ([301,302,303,307,308].includes(sc) && loc && redirectsLeft>0) {
        res.resume();
        return resolve(httpGet(loc, headers, redirectsLeft-1));
      }

      const chunks=[];
      res.on("data",d=>chunks.push(d));
      res.on("end",()=>{
        const buf=Buffer.concat(chunks);
        const enc=String(res.headers["content-encoding"]||"").toLowerCase();
        const done=(b)=>resolve({status:sc, headers:res.headers, body:b});
        if (enc.includes("gzip")) zlib.gunzip(buf,(e,b)=>e?reject(e):done(b));
        else if (enc.includes("deflate")) zlib.inflate(buf,(e,b)=>e?reject(e):done(b));
        else done(buf);
      });
    });
    req.on("error",reject);
    req.end();
  });
}

async function getJSON(url, headers={}, retries=4){
  let lastErr=null;
  for (let i=0;i<=retries;i++){
    try{
      const r=await httpGet(url, headers);
      if (r.status===429){
        const wait=800*Math.pow(2,i);
        await sleep(wait);
        continue;
      }
      if (r.status<200 || r.status>=300) throw new Error(`HTTP ${r.status} ${url}`);
      const txt=r.body.toString("utf8");
      return JSON.parse(txt);
    } catch(e){
      lastErr=e;
      await sleep(300*Math.pow(2,i));
    }
  }
  throw lastErr||new Error("getJSON failed");
}

const DAY=24*60*60*1000;
const dayTs=(ts)=>Math.floor(Number(ts)/DAY)*DAY;

function normalizeSeriesDaily(series){
  if (!Array.isArray(series)) return [];
  const m=new Map();
  for (const p of series){
    const t=dayTs(p?.[0]);
    const v=Number(p?.[1]);
    if (!isFinite(t)||!isFinite(v)) continue;
    m.set(t,v);
  }
  return [...m.entries()].sort((a,b)=>a[0]-b[0]);
}

function computeTotalEqualWeighted(btc,eth,bnb){
  const b=normalizeSeriesDaily(btc), e=normalizeSeriesDaily(eth), n=normalizeSeriesDaily(bnb);
  if (!b.length||!e.length||!n.length) return [];
  const m1=new Map(b.map(p=>[p[0],p[1]]));
  const m2=new Map(e.map(p=>[p[0],p[1]]));
  const m3=new Map(n.map(p=>[p[0],p[1]]));
  const ts=[...m1.keys()].filter(t=>m2.has(t)&&m3.has(t)).sort((a,b)=>a-b);
  if (ts.length<50) return [];
  const t0=ts[0];
  const b0=m1.get(t0), e0=m2.get(t0), n0=m3.get(t0);
  if (!b0||!e0||!n0) return [];
  const out=[];
  for (const t of ts){
    const bv=m1.get(t), ev=m2.get(t), nv=m3.get(t);
    if (!bv||!ev||!nv) continue;
    out.push([t, 100*((bv/b0)+(ev/e0)+(nv/n0))/3]);
  }
  return out;
}

(async()=>{
  const cfg=readCfg();
  const vs=String(cfg.currency||"USD").toLowerCase();
  const ids={btc:"bitcoin",eth:"ethereum",bnb:"binancecoin"};

  const apiKey=process.env.COINGECKO_API_KEY || process.env.CG_PRO_API_KEY || "";
  const headers=apiKey ? {"x-cg-pro-api-key":apiKey} : {};

  async function series(id){
    const url=`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=${vs}&days=1825&interval=daily`;
    const j=await getJSON(url, headers, 5);
    return normalizeSeriesDaily((j.prices||[]).map(p=>[Number(p[0]),Number(p[1])]));
  }

  const out={meta:{source:"CoinGecko",vs,updatedAt:new Date().toISOString()},btc:[],eth:[],bnb:[],total:[]};

  for (const [sym,id] of Object.entries(ids)) out[sym]=await series(id);
  out.total=computeTotalEqualWeighted(out.btc,out.eth,out.bnb);

  fs.writeFileSync(outPath, JSON.stringify(out));
  console.log("updated data/market.json");
})().catch(e=>{console.error(e);process.exit(1);});
