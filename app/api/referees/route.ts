import {NextResponse} from "next/server";
import {isAuthorized} from "@/lib/auth";
import {initDb,pool} from "@/lib/db";

export async function GET(){
  if(!await isAuthorized()) return NextResponse.json({error:"Faça login para acessar os árbitros."},{status:401});
  try{
    await initDb();
    const {rows}=await pool.query("SELECT id,name,country,league_id,games,fouls_per_game,yellow_per_game,red_per_game,home_yellow,away_yellow,over35,over45,over55,updated_at FROM referees ORDER BY name");
    return NextResponse.json({referees:rows.map(r=>({id:r.id,name:r.name,country:r.country,leagueId:r.league_id,games:Number(r.games),foulsPerGame:Number(r.fouls_per_game),yellowPerGame:Number(r.yellow_per_game),redPerGame:Number(r.red_per_game),homeYellow:Number(r.home_yellow),awayYellow:Number(r.away_yellow),over35:Number(r.over35),over45:Number(r.over45),over55:Number(r.over55),updatedAt:Number(r.updated_at)}))});
  }catch{return NextResponse.json({error:"Banco de árbitros indisponível."},{status:503})}
}
