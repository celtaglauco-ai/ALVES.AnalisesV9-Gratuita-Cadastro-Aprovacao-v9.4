import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { initDb, pool } from "@/lib/db";

const clean=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/sul-americana|sul americana/g,"sudamericana").replace(/conmebol|\b20\d{2}\b/g,"").replace(/[^a-z0-9]/g,"");
const statusMap:Record<string,{short:string;long:string}>={IN_PLAY:{short:"LIVE",long:"Ao vivo"},PAUSED:{short:"HT",long:"Intervalo"},TIMED:{short:"NS",long:"Agendado"},SCHEDULED:{short:"NS",long:"Agendado"},FINISHED:{short:"FT",long:"Encerrado"},POSTPONED:{short:"PST",long:"Adiado"},CANCELLED:{short:"CANC",long:"Cancelado"}};

export async function GET(req:Request){
 if(!(await isAuthorized()))return NextResponse.json({error:"Faça login para acessar."},{status:401});
 const url=new URL(req.url),id=url.searchParams.get("id"),token=process.env.FOOTBALL_DATA_TOKEN;
 if(id)return NextResponse.json({available:true,statistics:[],limited:true,reason:"O plano gratuito da Football-Data.org fornece placar, classificação e partidas, mas não fornece estatísticas detalhadas ao vivo."});
 if(!token)return NextResponse.json({available:false,games:[],reason:"FOOTBALL_DATA_TOKEN não configurado."});
 await initDb();
 const {rows}=await pool.query("SELECT id,name,code,country FROM leagues"),registered=rows.map(x=>({id:String(x.id),name:String(x.name),code:String(x.code||"").trim().toUpperCase(),country:String(x.country||"")}));
 if(!registered.length)return NextResponse.json({available:true,games:[],reason:"Nenhuma liga foi cadastrada."});
 const localDate=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}),today=localDate.format(new Date()),tomorrow=new Date(new Date(`${today}T12:00:00Z`).getTime()+86400000).toISOString().slice(0,10);
 try{
  const r=await fetch(`https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${tomorrow}`,{headers:{"X-Auth-Token":token},next:{revalidate:45}}),data=await r.json();
  if(!r.ok)return NextResponse.json({available:false,games:[],reason:data?.message||"Football-Data.org indisponível."});
  const matches=(data.matches||[]).filter((m:any)=>m.utcDate&&localDate.format(new Date(m.utcDate))===today),findLeague=(m:any)=>registered.find(x=>x.code===String(m.competition?.code||"").toUpperCase())||registered.find(x=>{const a=clean(x.name),b=clean(String(m.competition?.name||""));return a===b||a.includes(b)||b.includes(a)});
  const games=matches.map((m:any)=>{const reg=findLeague(m);if(!reg)return null;const st=statusMap[m.status]||{short:m.status,long:m.status};return {provider:"football-data",id:m.id,date:m.utcDate,minute:0,status:st.short,statusLong:st.long,leagueId:m.competition?.id,registeredLeagueId:reg.id,registeredLeagueName:reg.name,league:m.competition?.name,country:m.area?.name||reg.country,home:m.homeTeam?.name,away:m.awayTeam?.name,homeLogo:m.homeTeam?.crest,awayLogo:m.awayTeam?.crest,hg:m.score?.fullTime?.home??m.score?.halfTime?.home??0,ag:m.score?.fullTime?.away??m.score?.halfTime?.away??0};}).filter(Boolean).sort((a:any,b:any)=>Number(!["LIVE","HT"].includes(a.status))-Number(!["LIVE","HT"].includes(b.status))||String(a.date).localeCompare(String(b.date)));
  return NextResponse.json({available:true,source:"Football-Data.org gratuito",updatedAt:Date.now(),games,reason:games.length?"":"Nenhum jogo das competições cobertas foi encontrado hoje."});
 }catch{return NextResponse.json({available:false,games:[],reason:"Não foi possível consultar a Football-Data.org."});}
}
