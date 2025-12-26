#!/usr/bin/env node
const fs=require("fs"), path=require("path");
const root=path.resolve(__dirname,"..");
const cfg=JSON.parse(fs.readFileSync(path.join(root,"data","blockpilot.json"),"utf8"));
const vs=String(cfg.currency||"USD").toLowerCase();

const ids={btc:"bitcoin",eth:"ethereum",bnb:"binancecoin"};

async function series(id){
  const url=`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=${vs}&days=1825&interval=daily`;
  const r=await fetch(url,{headers:{accept:"application/json"}});
  if(!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  const j=await r.json();
  return (j.prices||[]).map(p=>[Number(p[0]),Number(p[1])]).filter(p=>isFinite(p[0])&&isFinite(p[1]));
}

(async()=>{
  const out={meta:{source:"CoinGecko",vs,updatedAt:new Date().toISOString()},btc:[],eth:[],bnb:[],total:[]};
  for(const [sym,id] of Object.entries(ids)) out[sym]=await series(id);
  fs.writeFileSync(path.join(root,"data","market.json"), JSON.stringify(out));
  console.log("updated data/market.json");
})().catch(e=>{console.error(e);process.exit(1);});
