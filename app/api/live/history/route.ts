import {NextResponse} from "next/server";
import {isAuthorized} from "@/lib/auth";
import {initDb,pool} from "@/lib/db";

const num=(v:unknown)=>Math.max(0,Number(v)||0),clean=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const slots=Array.from({length:18},(_,i)=>`${i*5}–${(i+1)*5}`);

export async function POST(req:Request){
 if(!(await isAuthorized()))return NextResponse.json({error:"Faça login para acessar."},{status:401});
 try{
  const b=await req.json(),minute=Math.min(120,Math.floor(num(b.minute))),fixtureId=String(b.fixtureId||"").trim(),home=String(b.home||"").trim(),away=String(b.away||"").trim();
  if(!fixtureId||!home||!away||minute<1)return NextResponse.json({saved:false,reason:"Partida ou minuto ainda não disponível."});
  const stats={hg:num(b.stats?.hg),ag:num(b.stats?.ag),hc:num(b.stats?.hc),ac:num(b.stats?.ac),shotsHome:num(b.stats?.shotsHome),shotsAway:num(b.stats?.shotsAway),sotHome:num(b.stats?.sotHome),sotAway:num(b.stats?.sotAway),yellowHome:num(b.stats?.yellowHome),yellowAway:num(b.stats?.yellowAway),redHome:num(b.stats?.redHome),redAway:num(b.stats?.redAway)};
  await initDb();const bucket=Math.floor(minute/5),id=`${String(b.provider||"live")}:${fixtureId}:${bucket}`;
  await pool.query(`INSERT INTO live_stat_snapshots(id,fixture_id,provider,league_id,home,away,minute,stats,captured_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) ON CONFLICT(id) DO UPDATE SET minute=EXCLUDED.minute,stats=EXCLUDED.stats,captured_at=EXCLUDED.captured_at`,[id,fixtureId,String(b.provider||""),String(b.leagueId||""),home,away,minute,JSON.stringify(stats),Date.now()]);
  return NextResponse.json({saved:true,minute});
 }catch{return NextResponse.json({saved:false,error:"Não foi possível registrar a fotografia ao vivo."},{status:400})}
}

export async function GET(req:Request){
 if(!(await isAuthorized()))return NextResponse.json({error:"Faça login para acessar."},{status:401});
 const team=new URL(req.url).searchParams.get("team")?.trim()||"";if(!team)return NextResponse.json({available:false,reason:"Selecione um time."});
 await initDb();const {rows}=await pool.query(`SELECT fixture_id,home,away,minute,stats,captured_at FROM live_stat_snapshots WHERE lower(home)=lower($1) OR lower(away)=lower($1) ORDER BY fixture_id,captured_at`,[team]);
 const totals={goals:Array(18).fill(0),corners:Array(18).fill(0),cards:Array(18).fill(0),shots:Array(18).fill(0),onTarget:Array(18).fill(0)},previous=new Map<string,any>();
 for(const row of rows){const home=clean(row.home)===clean(team),s=row.stats||{},p=previous.get(row.fixture_id),slot=Math.min(17,Math.max(0,Math.ceil(Number(row.minute)/5)-1));if(p){const delta=(key:string)=>Math.max(0,num(s[key])-num(p.stats?.[key]));totals.goals[slot]+=delta(home?"hg":"ag");totals.corners[slot]+=delta(home?"hc":"ac");totals.cards[slot]+=delta(home?"yellowHome":"yellowAway")+delta(home?"redHome":"redAway");totals.shots[slot]+=delta(home?"shotsHome":"shotsAway");totals.onTarget[slot]+=delta(home?"sotHome":"sotAway")}previous.set(row.fixture_id,row)}
 const last=Math.max(5,...rows.map(r=>Math.ceil(Number(r.minute)/5)*5)),count=Math.min(18,last/5);
 return NextResponse.json({available:true,history:{labels:slots.slice(0,count),goals:totals.goals.slice(0,count),corners:totals.corners.slice(0,count),cards:totals.cards.slice(0,count),shots:totals.shots.slice(0,count),onTarget:totals.onTarget.slice(0,count),snapshots:rows.length}});
}
