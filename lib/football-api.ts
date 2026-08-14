import { pool } from "./db";
import type { Game } from "./types";

const known:Record<string,number>={E0:39,E1:40,SP1:140,SP2:141,D1:78,D2:79,I1:135,I2:136,F1:61,F2:62,N1:88,P1:94,B1:144,BRA:71,ARG:128,USA:253};
const countries:Record<string,string>={Brasil:"Brazil",Inglaterra:"England",Espanha:"Spain",Alemanha:"Germany",Itália:"Italy",Italia:"Italy",França:"France",Holanda:"Netherlands",Portugal:"Portugal",Bélgica:"Belgium",Belgica:"Belgium",Argentina:"Argentina","Estados Unidos":"USA"};
const clean=(x:string)=>x.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
async function call(path:string,key:string,revalidate=900){const r=await fetch(`https://v3.football.api-sports.io/${path}`,{headers:{"x-apisports-key":key},next:{revalidate}}),data=await r.json();return {ok:r.ok,data,remaining:r.headers.get("x-ratelimit-requests-remaining")};}

export async function syncLeague(l:any,key:string){
 const savedCode=String(l.code||"").trim().toUpperCase(),seasonText=String(l.season||""),seasonMatch=seasonText.match(/(?:19|20)\d{2}/),season=seasonMatch?Number(seasonMatch[0]):NaN;let apiLeague=/^\d+$/.test(savedCode)?Number(savedCode):known[savedCode],apiName=String(l.name),found:any;
 if(!Number.isInteger(season))throw Error(`A temporada ${seasonText||"vazia"} não possui um ano válido.`);
 if(apiLeague)found={league:{id:apiLeague,name:l.name},country:{name:countries[String(l.country)]||l.country},seasons:[{year:season}]};
 if(!found){const current=await call(`leagues?search=${encodeURIComponent(String(l.name))}`,key,21600),items=current.data?.response||[],country=countries[String(l.country)]||String(l.country),name=clean(String(l.name)),tokens=name.replace(/(campeonato|brasileirao|liga|league|football|futebol)/g,"");found=items.find((x:any)=>clean(String(x.country?.name||""))===clean(country)&&clean(String(x.league?.name||""))===name)||items.find((x:any)=>{const candidate=clean(String(x.league?.name||""));return clean(String(x.country?.name||""))===clean(country)&&(candidate.includes(name)||name.includes(candidate)||candidate.includes(tokens)||tokens.includes(candidate))});}
 if(found){apiLeague=found.league?.id;apiName=found.league?.name||apiName;}
 if(!apiLeague||!found)throw Error(`A API não encontrou ${l.name} (${l.country}).`);
 if(Array.isArray(found.seasons)&&!found.seasons.some((s:any)=>Number(s.year)===season))throw Error(`A temporada ${seasonText} não está disponível para ${apiName}.`);
 const [sr,fr]=await Promise.all([call(`standings?league=${apiLeague}&season=${season}`,key,900),call(`fixtures?league=${apiLeague}&season=${season}&status=FT`,key,900)]),table=sr.data?.response?.[0]?.league?.standings?.[0];
 if(!sr.ok||!Array.isArray(table))throw Error((sr.data?.errors&&String(Object.values(sr.data.errors)[0]))||"Classificação ainda indisponível.");
 const norm=(part:"all"|"home"|"away")=>table.map((r:any)=>{const x=r[part]||{};return {team:r.team?.name,logo:r.team?.logo,p:part==="all"?r.points:(x.win||0)*3+(x.draw||0),j:x.played||0,v:x.win||0,e:x.draw||0,d:x.lose||0,gp:x.goals?.for||0,gc:x.goals?.against||0,sg:(x.goals?.for||0)-(x.goals?.against||0),form:String(r.form||"").split("").slice(-5).map((f:string)=>f==="W"?"V":f==="D"?"E":"D")}}).sort((a:any,b:any)=>b.p-a.p||b.sg-a.sg||b.gp-a.gp);
 const fixtures=fr.ok?(fr.data?.response||[]):[],games:Game[]=fixtures.map((x:any)=>({date:x.fixture?.date,round:x.league?.round||"",referee:x.fixture?.referee||"",home:x.teams?.home?.name||"",away:x.teams?.away?.name||"",hg:x.goals?.home??0,ag:x.goals?.away??0,hc:0,ac:0,hy:0,ay:0,hr:0,ar:0,hs:0,as:0,hst:0,ast:0})).filter((g:Game)=>g.home&&g.away);
 const currentRound=String(fixtures.at(-1)?.league?.round||"");const updatedAt=Date.now(),remaining=Number(sr.remaining??fr.remaining);
 const tables={TOTAL:norm("all"),HOME:norm("home"),AWAY:norm("away")};
 await pool.query(`INSERT INTO league_api_sync(league_id,api_league_id,season,standings,games,status,error,current_round,remaining,updated_at) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,'updated','',$6,$7,$8) ON CONFLICT(league_id) DO UPDATE SET api_league_id=EXCLUDED.api_league_id,season=EXCLUDED.season,standings=EXCLUDED.standings,games=EXCLUDED.games,status='updated',error='',current_round=EXCLUDED.current_round,remaining=EXCLUDED.remaining,updated_at=EXCLUDED.updated_at`,[l.id,apiLeague,season,JSON.stringify(tables),JSON.stringify(games),currentRound,Number.isFinite(remaining)?remaining:null,updatedAt]);
 return {available:true,source:"API-Football",updatedAt,league:{id:apiLeague,name:apiName,season},remaining:Number.isFinite(remaining)?remaining:null,currentRound,tables,games};
}

export async function recordSyncError(leagueId:string,error:string){await pool.query(`INSERT INTO league_api_sync(league_id,status,error,updated_at) VALUES($1,'error',$2,$3) ON CONFLICT(league_id) DO UPDATE SET status='error',error=EXCLUDED.error,updated_at=EXCLUDED.updated_at`,[leagueId,error.slice(0,300),Date.now()]);}
