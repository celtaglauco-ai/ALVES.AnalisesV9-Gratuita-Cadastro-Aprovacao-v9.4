import {pool} from "./db";
import type {DataQuality,Game} from "./types";

type Component={market:string;status:"hit"|"miss"|"unavailable";actual?:number;reason:string};
const norm=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const gameTime=(value?:string)=>{if(!value)return 0;const direct=Date.parse(value);if(Number.isFinite(direct))return direct;const m=value.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);if(!m)return 0;const year=Number(m[3])<100?2000+Number(m[3]):Number(m[3]);return new Date(year,Number(m[2])-1,Number(m[1]),12).getTime()};
const split=(market:string)=>String(market||"").split(/\s*\+\s*/).map(x=>x.trim()).filter(Boolean);
function evaluate(market:string,game:Game,quality:DataQuality):Component{
 const lineMatch=market.match(/(\d+(?:[,.]\d+)?)/),line=lineMatch?Number(lineMatch[1].replace(",",".")):NaN,direction=/^mais\s/i.test(market)?"over":/^menos\s/i.test(market)?"under":"";
 let actual:number|undefined,covered=false;
 if(/gol/i.test(market)){actual=Number(game.hg)+Number(game.ag);covered=quality.goals!==false}
 else if(/escanteio|canto/i.test(market)){actual=Number(game.hc)+Number(game.ac);covered=!!quality.corners}
 else if(/cart/i.test(market)){actual=Number(game.hy)+Number(game.ay)+Number(game.hr)+Number(game.ar);covered=!!quality.cards}
 if(!covered||actual===undefined||!Number.isFinite(actual))return {market,status:"unavailable",reason:"O resultado existe, mas este mercado não possui cobertura confirmada."};
 if(!direction||!Number.isFinite(line))return {market,status:"unavailable",actual,reason:"Linha não reconhecida automaticamente."};
 const hit=direction==="over"?actual>line:actual<line;
 return {market,status:hit?"hit":"miss",actual,reason:`Resultado real: ${actual} • linha ${direction==="over"?"mais":"menos"} de ${String(line).replace(".",",")}.`};
}

export async function settlePendingAnalyses(){
 const [{rows:analyses},{rows:leagues}]=await Promise.all([
  pool.query("SELECT id,home,away,market,created_at FROM analysis_history WHERE result_status='pending' ORDER BY created_at"),
  pool.query("SELECT l.id,l.name,l.games,l.data_quality,s.games api_games FROM leagues l LEFT JOIN league_api_sync s ON s.league_id=l.id"),
 ]);
 let settled=0,partial=0;
 for(const analysis of analyses){
  const candidates:{game:Game;quality:DataQuality;league:string;time:number;source:string}[]=[];
  for(const league of leagues){
   for(const game of (league.games||[]) as Game[]){const time=gameTime(game.date);if(time&&time>=Number(analysis.created_at)-86400000&&time<=Date.now()+86400000&&norm(game.home)===norm(analysis.home)&&norm(game.away)===norm(analysis.away))candidates.push({game,quality:league.data_quality||{goals:true,corners:false,cards:false,shots:false,shotsOnTarget:false},league:league.name,time,source:"CSV"})}
   for(const game of (league.api_games||[]) as Game[]){const time=gameTime(game.date);if(time&&time>=Number(analysis.created_at)-86400000&&time<=Date.now()+86400000&&norm(game.home)===norm(analysis.home)&&norm(game.away)===norm(analysis.away))candidates.push({game,quality:{goals:true,corners:false,cards:false,shots:false,shotsOnTarget:false},league:league.name,time,source:"API gratuita"})}
  }
  const match=candidates.sort((a,b)=>b.time-a.time||Number(b.source==="CSV")-Number(a.source==="CSV"))[0];if(!match)continue;
  const components=split(analysis.market).map(m=>evaluate(m,match.game,match.quality)),hasMiss=components.some(x=>x.status==="miss"),allResolved=components.length>0&&components.every(x=>x.status!=="unavailable"),status=hasMiss?"miss":allResolved?"hit":"pending",componentSummary=components.map(x=>`${x.status==="hit"?"✓":x.status==="miss"?"×":"?"} ${x.market}${x.actual===undefined?"":` (real: ${x.actual})`}`).join(" | ");
  await pool.query("UPDATE analysis_history SET component_results=$1::jsonb,matched_game=$2::jsonb,resolution_source=$3,result_status=$4,resolved_at=$5,result_note=$6 WHERE id=$7 AND result_status='pending'",[JSON.stringify(components),JSON.stringify({league:match.league,date:match.game.date,home:match.game.home,away:match.game.away,hg:match.game.hg,ag:match.game.ag,hc:match.game.hc,ac:match.game.ac,cards:Number(match.game.hy)+Number(match.game.ay)+Number(match.game.hr)+Number(match.game.ar)}),match.source,status,status==="pending"?0:Date.now(),`${status==="pending"?"Conferência parcial":"Conferência automática"} via ${match.source}: ${componentSummary}`.slice(0,300),analysis.id]);
  if(status==="pending")partial++;else settled++;
 }
 return {checked:analyses.length,settled,partial};
}
