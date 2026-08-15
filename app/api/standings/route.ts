import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { initDb, pool } from "@/lib/db";
import { recordSyncError, syncLeague } from "@/lib/football-api";

export async function GET(req:Request){
 if(!(await isAuthorized()))return NextResponse.json({error:"Faça login para acessar."},{status:401});
 const url=new URL(req.url),id=url.searchParams.get("leagueId")||"",force=url.searchParams.get("refresh")==="1",key=process.env.API_FOOTBALL_KEY;
 if(!key)return NextResponse.json({available:false,reason:"API-Football ainda não configurada."});
 await initDb();const {rows}=await pool.query("SELECT id,code,country,name,season,games FROM leagues WHERE id=$1 LIMIT 1",[id]),l=rows[0];
 if(!l)return NextResponse.json({available:false,reason:"Liga cadastrada não encontrada."});
 const cached=await pool.query("SELECT * FROM league_api_sync WHERE league_id=$1",[id]),c=cached.rows[0];
 if(!force&&c?.status==="updated"&&Date.now()-Number(c.updated_at)<6*60*60*1000)return NextResponse.json({available:true,source:"API-Football • cache automático",updatedAt:Number(c.updated_at),league:{id:c.api_league_id,name:l.name,season:c.season},remaining:c.remaining,currentRound:c.current_round,tables:c.standings,games:c.games||[],cached:true});
 try{return NextResponse.json(await syncLeague(l,key));}
 catch(e){const reason=e instanceof Error?e.message:"Não foi possível consultar a classificação atual.";await recordSyncError(id,reason);if(c?.standings&&Object.keys(c.standings).length)return NextResponse.json({available:true,source:"Última atualização válida",updatedAt:Number(c.updated_at),league:{id:c.api_league_id,name:l.name,season:c.season},remaining:c.remaining,currentRound:c.current_round,tables:c.standings,games:c.games||[],stale:true,warning:reason});return NextResponse.json({available:false,reason});}
}
