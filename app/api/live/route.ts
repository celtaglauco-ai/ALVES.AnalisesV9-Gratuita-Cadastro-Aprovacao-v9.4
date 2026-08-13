import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";

export async function GET(req:Request){
  if(!(await isAuthorized()))return NextResponse.json({error:"Faça login para acessar."},{status:401});
  const key=process.env.API_FOOTBALL_KEY;if(!key)return NextResponse.json({available:false,reason:"API-Football ainda não configurada."});
  const id=new URL(req.url).searchParams.get("id"),path=id?`fixtures/statistics?fixture=${encodeURIComponent(id)}`:"fixtures?live=all";
  try{
    const response=await fetch(`https://v3.football.api-sports.io/${path}`,{headers:{"x-apisports-key":key},next:{revalidate:id?60:30}}),data=await response.json();
    if(!response.ok)return NextResponse.json({available:false,reason:"Limite ou indisponibilidade da API."});
    if(id)return NextResponse.json({available:true,statistics:data.response||[]});
    return NextResponse.json({available:true,updatedAt:Date.now(),remaining:response.headers.get("x-ratelimit-requests-remaining"),games:(data.response||[]).map((x:any)=>({id:x.fixture?.id,minute:x.fixture?.status?.elapsed,status:x.fixture?.status?.short,league:x.league?.name,country:x.league?.country,home:x.teams?.home?.name,away:x.teams?.away?.name,hg:x.goals?.home||0,ag:x.goals?.away||0}))});
  }catch{return NextResponse.json({available:false,reason:"Não foi possível consultar jogos ao vivo."});}
}
