import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { initDb, pool } from "@/lib/db";

const ids:Record<string,number>={E0:39,E1:40,SP1:140,SP2:141,D1:78,D2:79,I1:135,I2:136,F1:61,F2:62,N1:88,P1:94,B1:144,BRA:71,ARG:128,USA:253};
const seasonOf=(value:string)=>Number((value.match(/20\d{2}/)||[String(new Date().getFullYear())])[0]);

export async function GET(req:Request){
  if(!(await isAuthorized()))return NextResponse.json({error:"Faça login para acessar."},{status:401});
  const leagueId=new URL(req.url).searchParams.get("leagueId")||"",key=process.env.API_FOOTBALL_KEY;
  if(!key)return NextResponse.json({available:false,reason:"API-Football ainda não configurada."});
  await initDb();const {rows}=await pool.query("SELECT code,season FROM leagues WHERE id=$1 LIMIT 1",[leagueId]);
  const apiLeague=ids[String(rows[0]?.code||"").toUpperCase()],season=seasonOf(String(rows[0]?.season||""));
  if(!apiLeague)return NextResponse.json({available:false,reason:"Informe um código reconhecido na liga para conectá-la à API."});
  try{
    const response=await fetch(`https://v3.football.api-sports.io/standings?league=${apiLeague}&season=${season}`,{headers:{"x-apisports-key":key},next:{revalidate:900}}),data=await response.json();
    const table=data?.response?.[0]?.league?.standings?.[0];
    if(!response.ok||!Array.isArray(table))return NextResponse.json({available:false,reason:(data?.errors&&Object.values(data.errors)[0])||"Classificação indisponível; usando o CSV."});
    const normalize=(part:"all"|"home"|"away")=>table.map((r:any)=>{const x=r[part]||{};return {team:r.team?.name,p:part==="all"?r.points:(x.win||0)*3+(x.draw||0),j:x.played||0,v:x.win||0,e:x.draw||0,d:x.lose||0,gp:x.goals?.for||0,gc:x.goals?.against||0,sg:(x.goals?.for||0)-(x.goals?.against||0),form:String(r.form||"").split("").slice(-5).map((f:string)=>f==="W"?"V":f==="D"?"E":"D")}}).sort((a:any,b:any)=>b.p-a.p||b.sg-a.sg||b.gp-a.gp);
    return NextResponse.json({available:true,source:"API-Football",updatedAt:Date.now(),league:{id:apiLeague,season},tables:{TOTAL:normalize("all"),HOME:normalize("home"),AWAY:normalize("away")}});
  }catch{return NextResponse.json({available:false,reason:"API indisponível; usando o CSV."});}
}
