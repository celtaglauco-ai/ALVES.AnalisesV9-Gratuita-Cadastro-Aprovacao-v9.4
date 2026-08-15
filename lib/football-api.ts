import { pool } from "./db";
import type { Game } from "./types";

const codeMap:Record<string,string>={E0:"PL",E1:"ELC",SP1:"PD",D1:"BL1",I1:"SA",F1:"FL1",N1:"DED",P1:"PPL",BRA:"BSA",BSA:"BSA",CLI:"CLI"};
const countries:Record<string,string>={Brasil:"Brazil",Inglaterra:"England",Espanha:"Spain",Alemanha:"Germany",Itália:"Italy",Italia:"Italy",França:"France",Holanda:"Netherlands",Portugal:"Portugal",Bélgica:"Belgium",Belgica:"Belgium",Argentina:"Argentina","Estados Unidos":"United States",EUA:"United States"};
const clean=(x:string)=>x.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
let competitionCache:Promise<any[]>|null=null;

async function call(path:string,token:string,revalidate=900){
 const r=await fetch(`https://api.football-data.org/v4/${path}`,{headers:{"X-Auth-Token":token},next:{revalidate}}),data=await r.json();
 if(!r.ok)throw Error(data?.message||`Football-Data.org respondeu HTTP ${r.status}.`);
 return data;
}
async function competitions(token:string){
 if(!competitionCache)competitionCache=call("competitions",token,21600).then(d=>d.competitions||[]).catch(e=>{competitionCache=null;throw e});
 return competitionCache;
}
function findCompetition(items:any[],l:any){
 const saved=String(l.code||"").trim().toUpperCase(),mapped=codeMap[saved]||saved,country=clean(countries[String(l.country)]||String(l.country)),name=clean(String(l.name)),aliases:Record<string,string[]>={brasileiraoseriea:["campeonatobrasileiroseriea","brasileirao"],premierleague:["premierleague"],primeradivision:["primeradivision","laliga"],primeiraliga:["primeiraliga"],seriea:["seriea"],ligue1:["ligue1"],bundesliga:["bundesliga"],eredivisie:["eredivisie"],championship:["championship"]};
 return items.find(x=>String(x.code||"").toUpperCase()===mapped)||items.find(x=>{const xn=clean(String(x.name||"")),xc=clean(String(x.area?.name||"")),names=[name,...(aliases[name]||[])];return (!country||xc===country)&&names.some(n=>xn===n||xn.includes(n)||n.includes(xn))});
}
function tablesFrom(standings:any[]){
 const convert=(type:"TOTAL"|"HOME"|"AWAY")=>{const block=standings.find(x=>x.type===type)||standings.find(x=>x.type==="TOTAL");return (block?.table||[]).map((r:any)=>({team:r.team?.name,logo:r.team?.crest,p:r.points||0,j:r.playedGames||0,v:r.won||0,e:r.draw||0,d:r.lost||0,gp:r.goalsFor||0,gc:r.goalsAgainst||0,sg:r.goalDifference||0,form:String(r.form||"").split(",").slice(-5).map((f:string)=>f==="W"?"V":f==="D"?"E":"D")}));};
 return {TOTAL:convert("TOTAL"),HOME:convert("HOME").sort((a:any,b:any)=>b.p-a.p||b.sg-a.sg),AWAY:convert("AWAY").sort((a:any,b:any)=>b.p-a.p||b.sg-a.sg)};
}
function venueTable(games:Game[],venue:"HOME"|"AWAY"){
 const names=[...new Set(games.flatMap(g=>[g.home,g.away]))];
 return names.map(team=>{const selected=games.filter(g=>venue==="HOME"?g.home===team:g.away===team),gf=selected.reduce((s,g)=>s+(venue==="HOME"?g.hg:g.ag),0),ga=selected.reduce((s,g)=>s+(venue==="HOME"?g.ag:g.hg),0),v=selected.filter(g=>venue==="HOME"?g.hg>g.ag:g.ag>g.hg).length,e=selected.filter(g=>g.hg===g.ag).length,d=selected.length-v-e;return {team,p:v*3+e,j:selected.length,v,e,d,gp:gf,gc:ga,sg:gf-ga,form:selected.slice(-5).map(g=>venue==="HOME"?(g.hg>g.ag?"V":g.hg===g.ag?"E":"D"):(g.ag>g.hg?"V":g.ag===g.hg?"E":"D"))};}).sort((a,b)=>b.p-a.p||b.sg-a.sg||b.gp-a.gp);
}

export async function syncLeague(l:any,token:string){
 const all=await competitions(token),competition=findCompetition(all,l);
 if(!competition)throw Error(`${l.name} não está incluída nas competições liberadas pela Football-Data.org.`);
 const code=String(competition.code),standingData=await call(`competitions/${code}/standings`,token,900);
 await new Promise(resolve=>setTimeout(resolve,7000));
 const matchData=await call(`competitions/${code}/matches?status=FINISHED`,token,900),tables=tablesFrom(standingData.standings||[]);
 if(!tables.TOTAL.length)throw Error(`A Football-Data.org não forneceu classificação para ${competition.name}.`);
 const manualGames:Game[]=Array.isArray(l.games)?l.games:[];
 const games:Game[]=(matchData.matches||[]).map((m:any)=>{const home=m.homeTeam?.name||"",away=m.awayTeam?.name||"",date=String(m.utcDate||"").slice(0,10),saved=manualGames.find(g=>clean(g.home)===clean(home)&&clean(g.away)===clean(away)&&(!g.date||String(g.date).slice(0,10)===date)),score=m.score?.fullTime||{};return {date:m.utcDate,round:m.matchday?`Rodada ${m.matchday}`:"",referee:m.referees?.[0]?.name||saved?.referee||"",home,away,hg:score.home??saved?.hg??0,ag:score.away??saved?.ag??0,hc:saved?.hc||0,ac:saved?.ac||0,hy:saved?.hy||0,ay:saved?.ay||0,hr:saved?.hr||0,ar:saved?.ar||0,hs:saved?.hs||0,as:saved?.as||0,hst:saved?.hst||0,ast:saved?.ast||0,hf:saved?.hf,af:saved?.af,hxg:saved?.hxg,axg:saved?.axg,hp:saved?.hp,ap:saved?.ap};}).filter((g:Game)=>g.home&&g.away);
 if(!(standingData.standings||[]).some((x:any)=>x.type==="HOME"))tables.HOME=venueTable(games,"HOME");
 if(!(standingData.standings||[]).some((x:any)=>x.type==="AWAY"))tables.AWAY=venueTable(games,"AWAY");
 const season=Number(String(standingData.season?.startDate||matchData.filters?.season||new Date().getFullYear()).slice(0,4)),currentRound=String(games.at(-1)?.round||""),updatedAt=Date.now(),apiId=Number(competition.id)||null;
 await pool.query("BEGIN");
 try{
  await pool.query(`INSERT INTO league_api_sync(league_id,api_league_id,season,standings,games,status,error,current_round,remaining,updated_at) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,'updated','',$6,NULL,$7) ON CONFLICT(league_id) DO UPDATE SET api_league_id=EXCLUDED.api_league_id,season=EXCLUDED.season,standings=EXCLUDED.standings,games=EXCLUDED.games,status='updated',error='',current_round=EXCLUDED.current_round,remaining=NULL,updated_at=EXCLUDED.updated_at`,[l.id,apiId,season,JSON.stringify(tables),JSON.stringify(games),currentRound,updatedAt]);
  await pool.query("UPDATE leagues SET code=$2,season=$3 WHERE id=$1",[l.id,code,String(season)]);
  await pool.query("COMMIT");
 }catch(e){await pool.query("ROLLBACK");throw e;}
 return {available:true,source:"Football-Data.org",updatedAt,league:{id:apiId,name:competition.name,season,code},remaining:null,currentRound,tables,games};
}
export async function recordSyncError(leagueId:string,error:string){await pool.query(`INSERT INTO league_api_sync(league_id,status,error,updated_at) VALUES($1,'error',$2,$3) ON CONFLICT(league_id) DO UPDATE SET status='error',error=EXCLUDED.error,updated_at=EXCLUDED.updated_at`,[leagueId,error.slice(0,300),Date.now()]);}
