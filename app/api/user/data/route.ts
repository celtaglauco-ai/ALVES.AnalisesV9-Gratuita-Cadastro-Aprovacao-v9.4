import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb, pool } from "@/lib/db";
import {audit,requestIp} from "@/lib/audit";

export async function GET() {
  const s=await getSession(); if(!s) return NextResponse.json({error:"Acesso autenticado obrigatório."},{status:401});
  await initDb();
  const [profile,history]=await Promise.all([
    pool.query("SELECT settings,updated_at FROM user_profiles WHERE user_id=$1",[s.id]),
    pool.query("SELECT id,mode,league_id,home,away,snapshot,created_at,market,confidence,result_status,result_note,resolved_at,component_results,resolution_source,matched_game FROM analysis_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",[s.id]),
  ]);
  const items=history.rows,total=items.length,hits=items.filter(x=>x.result_status==='hit').length,misses=items.filter(x=>x.result_status==='miss').length,pending=items.filter(x=>x.result_status==='pending').length,resolved=hits+misses,pct=(h:number,m:number)=>h+m?Math.round(h/(h+m)*100):0;
  const groups=(entries:{name:string;status:string}[])=>Object.values(entries.reduce((acc:Record<string,{name:string;total:number;hits:number;misses:number}>,x)=>{acc[x.name]||={name:x.name,total:0,hits:0,misses:0};acc[x.name].total++;if(x.status==='hit')acc[x.name].hits++;if(x.status==='miss')acc[x.name].misses++;return acc},{})).map(x=>({...x,resolved:x.hits+x.misses,accuracy:pct(x.hits,x.misses)})).sort((a,b)=>b.accuracy-a.accuracy||b.resolved-a.resolved),
    markets=items.flatMap(x=>String(x.market||"Análise geral").split(/\s*\+\s*/).map((m:string)=>({name:/gol/i.test(m)?"Gols":/escanteio|canto/i.test(m)?"Escanteios":/cart/i.test(m)?"Cartões":m,status:x.result_status}))),
    directions=items.flatMap(x=>String(x.market||"").split(/\s*\+\s*/).map((m:string)=>({name:/^mais/i.test(m)?"Mais (Over)":/^menos/i.test(m)?"Menos (Under)":"Outros",status:x.result_status}))),
    options=items.filter(x=>x.snapshot?.preBot?.option).map(x=>({name:String(x.snapshot.preBot.option),status:x.result_status})),
    byMarket=groups(markets),byDirection=groups(directions),byOption=groups(options),eligible=byMarket.filter(x=>x.resolved>=10),best=eligible[0],worst=[...eligible].sort((a,b)=>a.accuracy-b.accuracy)[0],insights:string[]=[];
  if(resolved<10)insights.push(`Confirme mais ${10-resolved} resultado(s) para liberar conclusões pessoais mais confiáveis.`);else{if(best)insights.push(`${best.name} é seu melhor mercado elegível: ${best.accuracy}% em ${best.resolved} confirmações.`);if(worst&&worst.name!==best?.name)insights.push(`${worst.name} merece revisão: ${worst.accuracy}% em ${worst.resolved} confirmações.`)}if(pending)insights.push(`${pending} previsão(ões) aguardam sua confirmação.`);
  return NextResponse.json({settings:profile.rows[0]?.settings||{},history:items,performance:{total,hits,misses,pending,accuracy:pct(hits,misses),byMarket,byDirection,byOption,insights}});
}
export async function POST(req:Request){
  const s=await getSession(); if(!s) return NextResponse.json({error:"Acesso autenticado obrigatório."},{status:401});
  const b=await req.json(); await initDb();
  if(b.type==="settings"){
    await pool.query("INSERT INTO user_profiles(user_id,settings,updated_at) VALUES($1,$2::jsonb,$3) ON CONFLICT(user_id) DO UPDATE SET settings=EXCLUDED.settings,updated_at=EXCLUDED.updated_at",[s.id,JSON.stringify(b.settings||{}),Date.now()]);
    return NextResponse.json({ok:true});
  }
  if(b.type==="history"){
    const home=String(b.home||"").slice(0,100),away=String(b.away||"").slice(0,100); if(!home||!away)return NextResponse.json({error:"Times ausentes."},{status:400});
    const probabilities=b.snapshot?.probabilities||{},markets=[{name:"Gols",value:Number(probabilities.goals||0)},{name:"Escanteios",value:Number(probabilities.corners||0)},{name:"Cartões",value:Number(probabilities.cards||0)}].sort((a,c)=>c.value-a.value),requestedMarket=String(b.market||"").trim().slice(0,100),primary=requestedMarket?{name:requestedMarket,value:Number(b.confidence||0)}:markets[0]||{name:"Análise geral",value:0};
    const createdAt=Date.now(),leagueId=String(b.leagueId||"").slice(0,100),scheduledDate=String(b.snapshot?.scheduledDate||"").slice(0,30),fixtureKey=[leagueId,scheduledDate,home,away].map(x=>x.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"")).join("|");
    await pool.query("INSERT INTO analysis_history(id,user_id,mode,league_id,home,away,snapshot,created_at,market,confidence,result_status,fixture_key) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,'pending',$11)",[crypto.randomUUID(),s.id,String(b.mode||"pre").slice(0,20),leagueId,home,away,JSON.stringify(b.snapshot||{}),createdAt,primary.name,Math.max(0,Math.min(100,Number(b.confidence||primary.value||0))),fixtureKey]);
    return NextResponse.json({ok:true});
  }
  return NextResponse.json({error:"Operação inválida."},{status:400});
}
export async function PATCH(req:Request){
  const s=await getSession(); if(!s||s.role!=="user") return NextResponse.json({error:"Acesso de usuário obrigatório."},{status:401});
  const b=await req.json(),id=String(b.id||""),status=String(b.status||"");
  if(!id)return NextResponse.json({error:"Previsão não informada."},{status:400});
  if(!["pending","hit","miss"].includes(status))return NextResponse.json({error:"Resultado inválido."},{status:400});
  await initDb();
  const result=await pool.query("UPDATE analysis_history SET result_status=$1,result_note=$2,resolved_at=$3 WHERE id=$4 AND user_id=$5",[status,String(b.note||"").trim().slice(0,300),status==="pending"?0:Date.now(),id,s.id]);
  if(!result.rowCount)return NextResponse.json({error:"Previsão não encontrada no seu histórico."},{status:404});
  await audit("prediction_result_changed",s,"analysis",id,{status,note:String(b.note||"").trim().slice(0,300)},requestIp(req));
  return NextResponse.json({ok:true,updated:result.rowCount});
}
export async function DELETE(req:Request){
  const s=await getSession(); if(!s||s.role!=="user") return NextResponse.json({error:"Acesso de usuário obrigatório."},{status:401});
  const id=new URL(req.url).searchParams.get("id")||""; if(!id)return NextResponse.json({error:"Análise não informada."},{status:400});
  await initDb(); const result=await pool.query("DELETE FROM analysis_history WHERE id=$1 AND user_id=$2",[id,s.id]);
  return NextResponse.json({ok:true,deleted:result.rowCount||0});
}
