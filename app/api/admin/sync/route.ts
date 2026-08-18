import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { initDb, pool } from "@/lib/db";
import { recordSyncError, syncLeague } from "@/lib/football-api";
import {settlePendingAnalyses} from "@/lib/settlement";

const cronAllowed=(req:Request)=>{const secret=process.env.CRON_SECRET?.trim(),authorization=req.headers.get("authorization")||"",headerToken=authorization.replace(/^Bearer\s+/i,"").trim(),queryToken=new URL(req.url).searchParams.get("cron")?.trim()||"";return !!secret&&(headerToken===secret||queryToken===secret)};
export async function POST(req:Request){
 if(!cronAllowed(req)&&!(await isAdmin()))return NextResponse.json({error:"Acesso administrativo obrigatório."},{status:401});
 const key=process.env.FOOTBALL_DATA_TOKEN;if(!key)return NextResponse.json({error:"FOOTBALL_DATA_TOKEN não configurado."},{status:503});
 await initDb();const id=new URL(req.url).searchParams.get("leagueId"),{rows}=await pool.query(`SELECT id,code,country,name,season,games FROM leagues ${id?"WHERE id=$1":""} ORDER BY country,name`,id?[id]:[]),results:any[]=[];
 for(let i=0;i<rows.length;i++){const l=rows[i];try{const d=await syncLeague(l,key);results.push({id:l.id,name:l.name,ok:true,updatedAt:d.updatedAt,round:d.currentRound,games:d.games.length,remaining:d.remaining});if(i<rows.length-1)await new Promise(resolve=>setTimeout(resolve,7000));}catch(e){const error=e instanceof Error?e.message:"Falha na atualização";await recordSyncError(l.id,error);results.push({id:l.id,name:l.name,ok:false,error});}}
 const updated=results.filter(x=>x.ok).length,failed=results.filter(x=>!x.ok).length,settlement=await settlePendingAnalyses().catch(()=>({checked:0,settled:0,partial:0}));
 return NextResponse.json({ok:updated>0,updated,failed,results,settlement},{status:updated>0?200:502});
}
