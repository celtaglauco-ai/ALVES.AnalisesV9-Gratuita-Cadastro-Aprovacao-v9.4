import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {isAdmin} from "@/lib/auth";
import {initDb,pool} from "@/lib/db";

const clean=(v:unknown,max=100)=>String(v??"").trim().slice(0,max);
const num=(v:unknown,min=0,max=10000)=>Math.min(max,Math.max(min,Number(v)||0));
export async function POST(req:Request){
  if(!await isAdmin()) return NextResponse.json({error:"Acesso administrativo obrigatório."},{status:401});
  try{
    const x=await req.json();
    if(Array.isArray(x.referees)){
      const items=x.referees.slice(0,500).map((item:Record<string,unknown>)=>({...item,name:clean(item.name)})).filter((item:Record<string,unknown>)=>String(item.name).length>=3);
      if(!items.length)return NextResponse.json({error:"Nenhum árbitro válido foi recebido."},{status:400});
      await initDb();const client=await pool.connect();try{const names=items.map((item:Record<string,unknown>)=>String(item.name).toLowerCase()),existingResult=await client.query("SELECT lower(name) AS name FROM referees WHERE lower(name)=ANY($1::text[])",[names]),existing=new Set(existingResult.rows.map(r=>r.name));await client.query("BEGIN");for(const item of items){await client.query(`INSERT INTO referees(id,name,country,league_id,games,fouls_per_game,yellow_per_game,red_per_game,home_yellow,away_yellow,over35,over45,over55,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT ((lower(name))) DO UPDATE SET country=EXCLUDED.country,league_id=EXCLUDED.league_id,games=EXCLUDED.games,fouls_per_game=EXCLUDED.fouls_per_game,yellow_per_game=EXCLUDED.yellow_per_game,red_per_game=EXCLUDED.red_per_game,home_yellow=EXCLUDED.home_yellow,away_yellow=EXCLUDED.away_yellow,over35=EXCLUDED.over35,over45=EXCLUDED.over45,over55=EXCLUDED.over55,updated_at=EXCLUDED.updated_at`,[crypto.randomUUID(),item.name,clean(item.country,60),clean(item.leagueId,80),Math.round(num(item.games)),num(item.foulsPerGame),num(item.yellowPerGame),num(item.redPerGame),num(item.homeYellow),num(item.awayYellow),num(item.over35,0,100),num(item.over45,0,100),num(item.over55,0,100),Date.now()])}await client.query("COMMIT");const updated=items.filter((item:Record<string,unknown>)=>existing.has(String(item.name).toLowerCase())).length;return NextResponse.json({ok:true,total:items.length,created:items.length-updated,updated})}catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
    }
    const name=clean(x.name),id=clean(x.id)||crypto.randomUUID();
    if(name.length<3)return NextResponse.json({error:"Informe o nome completo do árbitro."},{status:400});
    await initDb();
    await pool.query(`INSERT INTO referees(id,name,country,league_id,games,fouls_per_game,yellow_per_game,red_per_game,home_yellow,away_yellow,over35,over45,over55,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT ((lower(name))) DO UPDATE SET country=EXCLUDED.country,league_id=EXCLUDED.league_id,games=EXCLUDED.games,fouls_per_game=EXCLUDED.fouls_per_game,yellow_per_game=EXCLUDED.yellow_per_game,red_per_game=EXCLUDED.red_per_game,home_yellow=EXCLUDED.home_yellow,away_yellow=EXCLUDED.away_yellow,over35=EXCLUDED.over35,over45=EXCLUDED.over45,over55=EXCLUDED.over55,updated_at=EXCLUDED.updated_at`,
      [id,name,clean(x.country,60),clean(x.leagueId,80),Math.round(num(x.games)),num(x.foulsPerGame),num(x.yellowPerGame),num(x.redPerGame),num(x.homeYellow),num(x.awayYellow),num(x.over35,0,100),num(x.over45,0,100),num(x.over55,0,100),Date.now()]);
    return NextResponse.json({ok:true});
  }catch{return NextResponse.json({error:"Não foi possível salvar o árbitro."},{status:500})}
}
export async function DELETE(req:Request){
  if(!await isAdmin()) return NextResponse.json({error:"Acesso administrativo obrigatório."},{status:401});
  const id=new URL(req.url).searchParams.get("id");if(!id)return NextResponse.json({error:"ID ausente."},{status:400});
  await initDb();await pool.query("DELETE FROM referees WHERE id=$1",[id]);return NextResponse.json({ok:true});
}
