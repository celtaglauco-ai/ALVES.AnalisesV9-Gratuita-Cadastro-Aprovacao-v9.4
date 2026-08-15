import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { initDb, pool } from "@/lib/db";

const esc=(v:unknown)=>`"${String(v??"").replaceAll('"','""')}"`;
export async function GET(req:Request){
 if(!(await isAuthorized()))return NextResponse.json({error:"Faça login para acessar."},{status:401});
 const u=new URL(req.url),leagueId=u.searchParams.get("leagueId")||"",team=u.searchParams.get("team")||"",mode=u.searchParams.get("mode")||"TOTAL";await initDb();
 const {rows}=await pool.query("SELECT l.name,l.season,s.games FROM leagues l JOIN league_api_sync s ON s.league_id=l.id WHERE l.id=$1",[leagueId]);if(!rows[0])return NextResponse.json({error:"Histórico automático não encontrado."},{status:404});
 const games=(rows[0].games||[]).filter((g:any)=>!team||(mode==="HOME"?g.home===team:mode==="AWAY"?g.away===team:g.home===team||g.away===team));
 const head="Date,Round,HomeTeam,AwayTeam,FTHG,FTAG,HC,AC,HY,AY,HR,AR,HS,AS,HST,AST,HF,AF,HxG,AxG,HP,AP,Referee,Source",body=games.map((g:any)=>[g.date,g.round,g.home,g.away,g.hg,g.ag,g.hc,g.ac,g.hy,g.ay,g.hr,g.ar,g.hs,g.as,g.hst,g.ast,g.hf,g.af,g.hxg,g.axg,g.hp,g.ap,g.referee,"Football-Data.org + CSV associado"].map(esc).join(","));
 const filename=`${String(team||rows[0].name).replace(/[^a-z0-9]+/gi,"-")}-${mode.toLowerCase()}-${rows[0].season}.csv`;
 return new NextResponse(`\uFEFF${[head,...body].join("\n")}`,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${filename}"`}});
}
