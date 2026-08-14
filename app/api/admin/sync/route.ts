import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { initDb, pool } from "@/lib/db";
import { recordSyncError, syncLeague } from "@/lib/football-api";

const cronAllowed=(req:Request)=>{const secret=process.env.CRON_SECRET;return !!secret&&req.headers.get("authorization")===`Bearer ${secret}`};
export async function POST(req:Request){
 if(!cronAllowed(req)&&!(await isAdmin()))return NextResponse.json({error:"Acesso administrativo obrigatório."},{status:401});
 const key=process.env.API_FOOTBALL_KEY;if(!key)return NextResponse.json({error:"API-Football não configurada."},{status:503});
 await initDb();const id=new URL(req.url).searchParams.get("leagueId"),{rows}=await pool.query(`SELECT id,code,country,name,season FROM leagues ${id?"WHERE id=$1":""} ORDER BY country,name`,id?[id]:[]),results:any[]=[];
 for(let i=0;i<rows.length;i++){const l=rows[i];try{const d=await syncLeague(l,key);results.push({id:l.id,name:l.name,ok:true,updatedAt:d.updatedAt,round:d.currentRound,games:d.games.length,remaining:d.remaining});}catch(e){const error=e instanceof Error?e.message:"Falha na atualização";await recordSyncError(l.id,error);results.push({id:l.id,name:l.name,ok:false,error});}if(i<rows.length-1)await new Promise(resolve=>setTimeout(resolve,12500));}
 return NextResponse.json({ok:true,updated:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length,results});
}
