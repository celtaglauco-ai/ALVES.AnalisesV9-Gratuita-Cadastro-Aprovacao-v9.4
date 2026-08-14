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
    let response=await fetch(`https://v3.football.api-sports.io/${path}`,{headers:{"x-apisports-key":key},next:{revalidate:id?45:30}}),data=await response.json();
    const apiError=data?.errors&&Object.keys(data.errors).length?String(Object.values(data.errors)[0]):"";
    if(!response.ok||apiError)return NextResponse.json({available:false,reason:apiError||"Limite ou indisponibilidade da API.",remaining:response.headers.get("x-ratelimit-requests-remaining")});
    if(id)return NextResponse.json({available:true,statistics:data.response||[]});
    let fixtures=data.response||[],source="jogos do dia",matched=fixtures.filter((x:any)=>registered.has(Number(x.league?.id)));
    if(!matched.length){const liveResponse=await fetch("https://v3.football.api-sports.io/fixtures?live=all",{headers:{"x-apisports-key":key},next:{revalidate:15}}),liveData=await liveResponse.json(),liveError=liveData?.errors&&Object.keys(liveData.errors).length?String(Object.values(liveData.errors)[0]):"";if(liveResponse.ok&&!liveError){fixtures=liveData.response||[];matched=fixtures.filter((x:any)=>registered.has(Number(x.league?.id)));response=liveResponse;source="jogos ao vivo";}else if(liveError)return NextResponse.json({available:false,reason:liveError,remaining:liveResponse.headers.get("x-ratelimit-requests-remaining")});}
    const games=matched.map((x:any)=>({id:x.fixture?.id,date:x.fixture?.date,minute:x.fixture?.status?.elapsed,status:x.fixture?.status?.short,statusLong:x.fixture?.status?.long,leagueId:x.league?.id,registeredLeagueId:registered.get(Number(x.league?.id))?.id,registeredLeagueName:registered.get(Number(x.league?.id))?.name,league:x.league?.name,country:x.league?.country,home:x.teams?.home?.name,away:x.teams?.away?.name,homeLogo:x.teams?.home?.logo,awayLogo:x.teams?.away?.logo,hg:x.goals?.home??0,ag:x.goals?.away??0})).sort((a:any,b:any)=>String(a.date).localeCompare(String(b.date)));
    const ids=[...registered.keys()].join(", "),reason=games.length?"":fixtures.length?`A API retornou ${fixtures.length} jogos, mas nenhum pertence aos IDs cadastrados (${ids}).`:`A API não retornou jogos para ${today} nem partidas ao vivo. Verifique a cota e a cobertura da competição.`;
    return NextResponse.json({available:true,updatedAt:Date.now(),date:today,source,remaining:response.headers.get("x-ratelimit-requests-remaining"),games,reason});
  }catch{return NextResponse.json({available:false,reason:"Não foi possível consultar jogos ao vivo."});}
}
