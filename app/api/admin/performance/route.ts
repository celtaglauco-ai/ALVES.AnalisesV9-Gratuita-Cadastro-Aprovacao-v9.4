import {NextResponse} from "next/server";
import {isAdmin} from "@/lib/auth";
import {initDb,pool} from "@/lib/db";

export async function GET(){
 if(!await isAdmin())return NextResponse.json({error:"Acesso administrativo obrigatório."},{status:401});
 await initDb();
 const {rows}=await pool.query(`SELECT h.id,h.mode,h.league_id,h.home,h.away,h.market,h.confidence,h.result_status,h.result_note,h.created_at,h.resolved_at,u.name user_name,u.email,l.name league_name
  FROM analysis_history h JOIN users u ON u.id=h.user_id LEFT JOIN leagues l ON l.id=h.league_id ORDER BY h.created_at DESC LIMIT 500`);
 const total=rows.length,hits=rows.filter(x=>x.result_status==='hit').length,misses=rows.filter(x=>x.result_status==='miss').length,pending=rows.filter(x=>x.result_status==='pending').length,resolved=hits+misses,recent=(days:number)=>{const cut=Date.now()-days*86400000,list=rows.filter(x=>Number(x.created_at)>=cut),h=list.filter(x=>x.result_status==='hit').length,m=list.filter(x=>x.result_status==='miss').length;return {total:list.length,hits:h,misses:m,accuracy:h+m?Math.round(h/(h+m)*100):0}};
 const group=(key:string)=>Object.values(rows.reduce((acc:Record<string,{name:string;total:number;hits:number;misses:number}>,x:any)=>{const name=String(x[key]||"Não informado");acc[name]||={name,total:0,hits:0,misses:0};acc[name].total++;if(x.result_status==='hit')acc[name].hits++;if(x.result_status==='miss')acc[name].misses++;return acc},{})).map(x=>({...x,accuracy:x.hits+x.misses?Math.round(x.hits/(x.hits+x.misses)*100):0})).sort((a,b)=>b.accuracy-a.accuracy||b.total-a.total);
 return NextResponse.json({summary:{total,hits,misses,pending,accuracy:resolved?Math.round(hits/resolved*100):0},trend:{days7:recent(7),days30:recent(30)},byLeague:group('league_name'),byMarket:group('market'),items:rows});
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
