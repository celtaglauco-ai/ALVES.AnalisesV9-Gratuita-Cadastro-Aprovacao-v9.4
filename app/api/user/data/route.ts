import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { initDb, pool } from "@/lib/db";

export async function GET() {
  const s=await getSession(); if(!s||s.role!=="user") return NextResponse.json({error:"Acesso de usuário obrigatório."},{status:401});
  await initDb();
  const [profile,history]=await Promise.all([
    pool.query("SELECT settings,updated_at FROM user_profiles WHERE user_id=$1",[s.id]),
    pool.query("SELECT id,mode,league_id,home,away,snapshot,created_at FROM analysis_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",[s.id]),
  ]);
  return NextResponse.json({settings:profile.rows[0]?.settings||{},history:history.rows});
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
    await pool.query("INSERT INTO analysis_history(id,user_id,mode,league_id,home,away,snapshot,created_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)",[crypto.randomUUID(),s.id,String(b.mode||"pre").slice(0,20),String(b.leagueId||"").slice(0,100),home,away,JSON.stringify(b.snapshot||{}),Date.now()]);
    return NextResponse.json({ok:true});
  }
  return NextResponse.json({error:"Operação inválida."},{status:400});
}
