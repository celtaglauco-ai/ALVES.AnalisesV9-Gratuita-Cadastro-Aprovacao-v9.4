import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { initDb, pool } from "@/lib/db";

export async function GET(req:Request){
  if(!(await isAuthorized()))return NextResponse.json({error:"Faça login para acessar."},{status:401});
  const key=process.env.API_FOOTBALL_KEY;if(!key)return NextResponse.json({available:false,reason:"API-Football ainda não configurada."});
  const id=new URL(req.url).searchParams.get("id");
  try{
    let registered=new Map<number,{id:string;name:string}>();
    if(!id){await initDb();const {rows}=await pool.query("SELECT id,name,code FROM leagues");registered=new Map(rows.filter(x=>/^\d+$/.test(String(x.code||"").trim())).map(x=>[Number(x.code),{id:String(x.id),name:String(x.name)}]));if(!registered.size)return NextResponse.json({available:true,updatedAt:Date.now(),games:[],reason:"Associe as ligas aos IDs da API no painel administrativo."});}
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),path=id?`fixtures/statistics?fixture=${encodeURIComponent(id)}`:`fixtures?date=${today}&timezone=${encodeURIComponent("America/Sao_Paulo")}`;
    const response=await fetch(`https://v3.football.api-sports.io/${path}`,{headers:{"x-apisports-key":key},next:{revalidate:id?45:60}}),data=await response.json();
    if(!response.ok)return NextResponse.json({available:false,reason:"Limite ou indisponibilidade da API."});
    if(id)return NextResponse.json({available:true,statistics:data.response||[]});
    const games=(data.response||[]).filter((x:any)=>registered.has(Number(x.league?.id))).map((x:any)=>({id:x.fixture?.id,date:x.fixture?.date,minute:x.fixture?.status?.elapsed,status:x.fixture?.status?.short,statusLong:x.fixture?.status?.long,leagueId:x.league?.id,registeredLeagueId:registered.get(Number(x.league?.id))?.id,registeredLeagueName:registered.get(Number(x.league?.id))?.name,league:x.league?.name,country:x.league?.country,home:x.teams?.home?.name,away:x.teams?.away?.name,homeLogo:x.teams?.home?.logo,awayLogo:x.teams?.away?.logo,hg:x.goals?.home??0,ag:x.goals?.away??0})).sort((a:any,b:any)=>String(a.date).localeCompare(String(b.date)));
    return NextResponse.json({available:true,updatedAt:Date.now(),date:today,remaining:response.headers.get("x-ratelimit-requests-remaining"),games});
  }catch{return NextResponse.json({available:false,reason:"Não foi possível consultar jogos ao vivo."});}
}
