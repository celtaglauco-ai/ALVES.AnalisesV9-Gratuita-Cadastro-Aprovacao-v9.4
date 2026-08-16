import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb, pool } from "@/lib/db";

export async function GET() {
  const s=await getSession(); if(!s||s.role!=="user") return NextResponse.json({error:"Acesso de usuário obrigatório."},{status:401});
  await initDb();
  const [profile,history]=await Promise.all([
    pool.query("SELECT settings,updated_at FROM user_profiles WHERE user_id=$1",[s.id]),
    pool.query("SELECT id,mode,league_id,home,away,snapshot,created_at,market,confidence,result_status,result_note,resolved_at FROM analysis_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",[s.id]),
  ]);
  const items=history.rows,total=items.length,hits=items.filter(x=>x.result_status==='hit').length,misses=items.filter(x=>x.result_status==='miss').length,pending=items.filter(x=>x.result_status==='pending').length,resolved=hits+misses;
  return NextResponse.json({settings:profile.rows[0]?.settings||{},history:items,performance:{total,hits,misses,pending,accuracy:resolved?Math.round(hits/resolved*100):0}});
}
export async function POST(req:Request){
  const s=await getSession(); if(!s||s.role!=="user") return NextResponse.json({error:"Acesso de usuário obrigatório."},{status:401});
  const b=await req.json(); await initDb();
  if(b.type==="settings"){
    await pool.query("INSERT INTO user_profiles(user_id,settings,updated_at) VALUES($1,$2::jsonb,$3) ON CONFLICT(user_id) DO UPDATE SET settings=EXCLUDED.settings,updated_at=EXCLUDED.updated_at",[s.id,JSON.stringify(b.settings||{}),Date.now()]);
    return NextResponse.json({ok:true});
  }
  if(b.type==="history"){
    const home=String(b.home||"").slice(0,100),away=String(b.away||"").slice(0,100); if(!home||!away)return NextResponse.json({error:"Times ausentes."},{status:400});
    const probabilities=b.snapshot?.probabilities||{},markets=[{name:"Gols",value:Number(probabilities.goals||0)},{name:"Escanteios",value:Number(probabilities.corners||0)},{name:"Cartões",value:Number(probabilities.cards||0)}].sort((a,c)=>c.value-a.value),primary=markets[0]||{name:"Análise geral",value:0};
    await pool.query("INSERT INTO analysis_history(id,user_id,mode,league_id,home,away,snapshot,created_at,market,confidence,result_status) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,'pending')",[crypto.randomUUID(),s.id,String(b.mode||"pre").slice(0,20),String(b.leagueId||"").slice(0,100),home,away,JSON.stringify(b.snapshot||{}),Date.now(),primary.name,Math.max(0,Math.min(100,Number(b.confidence||primary.value||0)))]);
    return NextResponse.json({ok:true});
  }
  return NextResponse.json({error:"Operação inválida."},{status:400});
}
export async function DELETE(req:Request){
  const s=await getSession(); if(!s||s.role!=="user") return NextResponse.json({error:"Acesso de usuário obrigatório."},{status:401});
  const id=new URL(req.url).searchParams.get("id")||""; if(!id)return NextResponse.json({error:"Análise não informada."},{status:400});
  await initDb(); const result=await pool.query("DELETE FROM analysis_history WHERE id=$1 AND user_id=$2",[id,s.id]);
  return NextResponse.json({ok:true,deleted:result.rowCount||0});
}
