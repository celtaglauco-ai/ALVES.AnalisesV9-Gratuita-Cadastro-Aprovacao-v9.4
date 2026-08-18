import {NextResponse} from "next/server";
import {isAdmin} from "@/lib/auth";
import {initDb,pool} from "@/lib/db";
import {settlePendingAnalyses} from "@/lib/settlement";

type Row={id:string;mode:string;league_id?:string;home:string;away:string;market:string;confidence:number;result_status:"pending"|"hit"|"miss";result_note:string;created_at:number;user_name:string;league_name?:string};
type GroupBase={name:string;total:number;hits:number;misses:number};
const pct=(h:number,m:number)=>h+m?Math.round(h/(h+m)*100):0;
const splitMarkets=(market:string)=>String(market||"Análise geral").split(/\s*\+\s*/).map(x=>x.trim()).filter(Boolean);
const direction=(market:string)=>/^mais\s/i.test(market)?"Mais (Over)":/^menos\s/i.test(market)?"Menos (Under)":"Outros";
const marketFamily=(market:string)=>/gol/i.test(market)?"Gols":/escanteio|canto/i.test(market)?"Escanteios":/cart/i.test(market)?"Cartões":market;
const lineName=(market:string)=>{const n=market.match(/\d+(?:[,.]\d+)?/);return n?`${marketFamily(market)} • ${direction(market).replace(/ \(.+\)/,'')} ${n[0].replace('.',',')}`:marketFamily(market)};
const groupValues=(entries:{name:string;status:string}[])=>Object.values(entries.reduce((acc:Record<string,GroupBase>,x)=>{const name=x.name||"Não informado";acc[name]||={name,total:0,hits:0,misses:0};acc[name].total++;if(x.status==='hit')acc[name].hits++;if(x.status==='miss')acc[name].misses++;return acc},{})).map(x=>({...x,resolved:x.hits+x.misses,accuracy:pct(x.hits,x.misses)})).sort((a,b)=>b.accuracy-a.accuracy||b.resolved-a.resolved||b.total-a.total);

export async function GET(){
 if(!await isAdmin())return NextResponse.json({error:"Acesso administrativo obrigatório."},{status:401});
 await initDb();
 const {rows:raw}=await pool.query(`SELECT h.id,h.mode,h.league_id,h.home,h.away,h.market,h.confidence,h.result_status,h.result_note,h.component_results,h.resolution_source,h.matched_game,h.created_at,h.resolved_at,u.name user_name,u.email,l.name league_name
  FROM analysis_history h JOIN users u ON u.id=h.user_id LEFT JOIN leagues l ON l.id=h.league_id ORDER BY h.created_at DESC LIMIT 1000`);
 const rows=raw as Row[],total=rows.length,hits=rows.filter(x=>x.result_status==='hit').length,misses=rows.filter(x=>x.result_status==='miss').length,pending=rows.filter(x=>x.result_status==='pending').length,resolved=hits+misses;
 const recent=(days:number)=>{const cut=Date.now()-days*86400000,list=rows.filter(x=>Number(x.created_at)>=cut),h=list.filter(x=>x.result_status==='hit').length,m=list.filter(x=>x.result_status==='miss').length;return {total:list.length,hits:h,misses:m,accuracy:pct(h,m)}};
 const byLeague=groupValues(rows.map(x=>({name:x.league_name||"Liga não informada",status:x.result_status})));
 const marketEntries=rows.flatMap(x=>splitMarkets(x.market).map(name=>({name:marketFamily(name),status:x.result_status})));
 const lineEntries=rows.flatMap(x=>splitMarkets(x.market).map(name=>({name:lineName(name),status:x.result_status})));
 const directionEntries=rows.flatMap(x=>splitMarkets(x.market).map(name=>({name:direction(name),status:x.result_status})));
 const byMode=groupValues(rows.map(x=>({name:x.mode==='prebot'?"Bot Pré-Live":x.mode==='live'?"Ao Vivo":"Pré-jogo",status:x.result_status})));
 const byMarket=groupValues(marketEntries),byLine=groupValues(lineEntries),byDirection=groupValues(directionEntries);
 const now=new Date(),monthKeys=Array.from({length:12},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-11+i,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`});
 const monthly=monthKeys.map(key=>{const list=rows.filter(x=>{const d=new Date(Number(x.created_at));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`===key}),h=list.filter(x=>x.result_status==='hit').length,m=list.filter(x=>x.result_status==='miss').length;return {key,label:new Date(`${key}-02T12:00:00`).toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}),total:list.length,hits:h,misses:m,pending:list.filter(x=>x.result_status==='pending').length,accuracy:pct(h,m)}});
 let balance=0;const cumulative=rows.filter(x=>x.result_status!=='pending').sort((a,b)=>Number(a.created_at)-Number(b.created_at)).map((x,i)=>{balance+=x.result_status==='hit'?1:-1;return {index:i+1,value:balance,status:x.result_status}});
 const MIN_SAMPLE=10,eligible=(list:ReturnType<typeof groupValues>)=>list.filter(x=>x.resolved>=MIN_SAMPLE);
 const bestMarket=eligible(byMarket)[0],worstMarket=[...eligible(byMarket)].sort((a,b)=>a.accuracy-b.accuracy||b.resolved-a.resolved)[0],bestLeague=eligible(byLeague)[0],bestLine=eligible(byLine)[0],bestDirection=eligible(byDirection)[0];
 const insights:string[]=[];
 if(resolved<MIN_SAMPLE)insights.push(`Amostra inicial: confirme pelo menos ${MIN_SAMPLE-resolved} resultado(s) para liberar conclusões mais confiáveis.`);
 else{
  if(bestMarket)insights.push(`${bestMarket.name} é o mercado mais consistente: ${bestMarket.accuracy}% em ${bestMarket.resolved} resultados confirmados.`);
  if(bestLine)insights.push(`A linha com melhor histórico mínimo é ${bestLine.name}: ${bestLine.accuracy}% em ${bestLine.resolved} confirmações.`);
  if(bestDirection)insights.push(`${bestDirection.name} apresenta o melhor desempenho entre Mais/Menos: ${bestDirection.accuracy}%.`);
  if(worstMarket&&worstMarket.accuracy<50)insights.push(`Atenção com ${worstMarket.name}: somente ${worstMarket.accuracy}% em ${worstMarket.resolved} resultados. Revise os critérios antes de novas entradas.`);
 }
 if(pending)insights.push(`${pending} previsão(ões) ainda aguardam conferência e não entram na taxa real.`);
 return NextResponse.json({summary:{total,hits,misses,pending,accuracy:pct(hits,misses),resolved,minSample:MIN_SAMPLE,sampleReady:resolved>=MIN_SAMPLE},trend:{days7:recent(7),days30:recent(30)},monthly,cumulative,byLeague,byMarket,byLine,byDirection,byMode,highlights:{bestLeague,bestMarket,worstMarket,bestLine,bestDirection},insights,items:rows});
}

export async function POST(){
 if(!await isAdmin())return NextResponse.json({error:"Acesso administrativo obrigatório."},{status:401});
 await initDb();return NextResponse.json({ok:true,...await settlePendingAnalyses()});
}

export async function PATCH(req:Request){
 if(!await isAdmin())return NextResponse.json({error:"Acesso administrativo obrigatório."},{status:401});
 const b=await req.json(),status=String(b.status||"");if(!['pending','hit','miss'].includes(status))return NextResponse.json({error:"Resultado inválido."},{status:400});
 await initDb();const result=await pool.query("UPDATE analysis_history SET result_status=$1,result_note=$2,resolved_at=$3 WHERE id=$4",[status,String(b.note||"").slice(0,300),status==='pending'?0:Date.now(),String(b.id||"")]);
 return NextResponse.json({ok:true,updated:result.rowCount||0});
}

export async function DELETE(req:Request){
 if(!await isAdmin())return NextResponse.json({error:"Acesso administrativo obrigatório."},{status:401});
 await initDb();const id=new URL(req.url).searchParams.get('id')||'',result=await pool.query("DELETE FROM analysis_history WHERE id=$1",[id]);return NextResponse.json({ok:true,deleted:result.rowCount||0});
}
