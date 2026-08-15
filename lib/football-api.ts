import { pool } from "./db";
import type { Game } from "./types";

const known:Record<string,number>={E0:39,E1:40,SP1:140,SP2:141,D1:78,D2:79,I1:135,I2:136,F1:61,F2:62,N1:88,P1:94,B1:144,BRA:71,ARG:128,USA:253};
const countries:Record<string,string>={Brasil:"Brazil",Inglaterra:"England",Espanha:"Spain",Alemanha:"Germany",Itália:"Italy",Italia:"Italy",França:"France",Holanda:"Netherlands",Portugal:"Portugal",Bélgica:"Belgium",Belgica:"Belgium",Argentina:"Argentina","Estados Unidos":"USA",EUA:"USA"};
const clean=(x:string)=>x.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
async function call(path:string,key:string,revalidate=900){
 const r=await fetch(`https://v3.football.api-sports.io/${path}`,{headers:{"x-apisports-key":key},next:{revalidate}});
 const data=await r.json();
 const apiError=data?.errors&&Object.values(data.errors).filter(Boolean).join("; ");
 if(!r.ok||apiError)throw Error(apiError||`API-Football respondeu HTTP ${r.status}.`);
 return {data,remaining:r.headers.get("x-ratelimit-requests-remaining")};
}
function chooseSeason(seasons:any[]){
 const valid=(seasons||[]).filter(s=>Number.isInteger(Number(s?.year)));
 const current=valid.filter(s=>s.current===true).sort((a,b)=>Number(b.year)-Number(a.year))[0];
 return Number((current||valid.sort((a,b)=>Number(b.year)-Number(a.year))[0])?.year);
}
export async function syncLeague(l:any,key:string){
 const savedCode=String(l.code||"").trim().toUpperCase();
 let apiLeague=/^\d+$/.test(savedCode)?Number(savedCode):known[savedCode],found:any;
 if(apiLeague){const lookup=await call(`leagues?id=${apiLeague}`,key,21600);found=lookup.data?.response?.[0];}
 if(!found){
  const lookup=await call(`leagues?search=${encodeURIComponent(String(l.name))}`,key,21600),items=lookup.data?.response||[],country=countries[String(l.country)]||String(l.country),name=clean(String(l.name)),tokens=name.replace(/(campeonato|brasileirao|liga|league|football|futebol)/g,"");
  found=items.find((x:any)=>clean(String(x.country?.name||""))===clean(country)&&clean(String(x.league?.name||""))===name)||items.find((x:any)=>{const candidate=clean(String(x.league?.name||""));return clean(String(x.country?.name||""))===clean(country)&&(candidate.includes(name)||name.includes(candidate)||candidate.includes(tokens)||tokens.includes(candidate))});
 }
 if(!found?.league?.id)throw Error(`A API não encontrou ${l.name} (${l.country}).`);
 apiLeague=Number(found.league.id);
 const apiName=String(found.league.name||l.name),season=chooseSeason(found.seasons||[]);
 if(!Number.isInteger(season))throw Error(`A API não informou uma temporada vigente para ${apiName}.`);
 const [sr,fr]=await Promise.all([call(`standings?league=${apiLeague}&season=${season}`,key,900),call(`fixtures?league=${apiLeague}&season=${season}&status=FT`,key,900)]),groups=sr.data?.response?.[0]?.league?.standings;
 const table=Array.isArray(groups)?groups.flat().filter((row:any,index:number,all:any[])=>row?.team?.name&&all.findIndex(x=>x?.team?.id===row.team.id)===index):[];
 if(!table.length)throw Error(`A classificação ${season} ainda não está disponível para ${apiName}.`);
 const norm=(part:"all"|"home"|"away")=>table.map((r:any)=>{const x=r[part]||{};return {team:r.team?.name,logo:r.team?.logo,p:part==="all"?r.points:(x.win||0)*3+(x.draw||0),j:x.played||0,v:x.win||0,e:x.draw||0,d:x.lose||0,gp:x.goals?.for||0,gc:x.goals?.against||0,sg:(x.goals?.for||0)-(x.goals?.against||0),form:String(r.form||"").split("").slice(-5).map((f:string)=>f==="W"?"V":f==="D"?"E":"D")}}).sort((a:any,b:any)=>b.p-a.p||b.sg-a.sg||b.gp-a.gp);
 const fixtures=fr.data?.response||[],manualGames:Array<Game>=Array.isArray(l.games)?l.games:[];
 const games:Game[]=fixtures.map((x:any)=>{
  const home=x.teams?.home?.name||"",away=x.teams?.away?.name||"",date=String(x.fixture?.date||"").slice(0,10);
  const saved=manualGames.find(g=>clean(g.home)===clean(home)&&clean(g.away)===clean(away)&&(!g.date||String(g.date).slice(0,10)===date));
  return {date:x.fixture?.date,round:x.league?.round||"",referee:x.fixture?.referee||saved?.referee||"",home,away,hg:x.goals?.home??saved?.hg??0,ag:x.goals?.away??saved?.ag??0,hc:saved?.hc||0,ac:saved?.ac||0,hy:saved?.hy||0,ay:saved?.ay||0,hr:saved?.hr||0,ar:saved?.ar||0,hs:saved?.hs||0,as:saved?.as||0,hst:saved?.hst||0,ast:saved?.ast||0,hf:saved?.hf,af:saved?.af,hxg:saved?.hxg,axg:saved?.axg,hp:saved?.hp,ap:saved?.ap};
 }).filter((g:Game)=>g.home&&g.away);
 const currentRound=String(fixtures.at(-1)?.league?.round||""),updatedAt=Date.now(),remaining=Number(sr.remaining??fr.remaining),tables={TOTAL:norm("all"),HOME:norm("home"),AWAY:norm("away")};
 await pool.query("BEGIN");
 try{
  await pool.query(`INSERT INTO league_api_sync(league_id,api_league_id,season,standings,games,status,error,current_round,remaining,updated_at) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,'updated','',$6,$7,$8) ON CONFLICT(league_id) DO UPDATE SET api_league_id=EXCLUDED.api_league_id,season=EXCLUDED.season,standings=EXCLUDED.standings,games=EXCLUDED.games,status='updated',error='',current_round=EXCLUDED.current_round,remaining=EXCLUDED.remaining,updated_at=EXCLUDED.updated_at`,[l.id,apiLeague,season,JSON.stringify(tables),JSON.stringify(games),currentRound,Number.isFinite(remaining)?remaining:null,updatedAt]);
  await pool.query("UPDATE leagues SET code=$2,season=$3 WHERE id=$1",[l.id,String(apiLeague),String(season)]);
  await pool.query("COMMIT");
 }catch(e){await pool.query("ROLLBACK");throw e;}
 return {available:true,source:"API-Football",updatedAt,league:{id:apiLeague,name:apiName,season},remaining:Number.isFinite(remaining)?remaining:null,currentRound,tables,games};
}
export async function recordSyncError(leagueId:string,error:string){await pool.query(`INSERT INTO league_api_sync(league_id,status,error,updated_at) VALUES($1,'error',$2,$3) ON CONFLICT(league_id) DO UPDATE SET status='error',error=EXCLUDED.error,updated_at=EXCLUDED.updated_at`,[leagueId,error.slice(0,300),Date.now()]);}
