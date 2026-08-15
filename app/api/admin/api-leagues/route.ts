import {NextResponse} from "next/server";
import {isAdmin} from "@/lib/auth";
const clean=(x:string)=>x.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export async function GET(req:Request){
 if(!await isAdmin())return NextResponse.json({error:"Acesso administrativo obrigatório."},{status:401});
 const token=process.env.FOOTBALL_DATA_TOKEN,q=new URL(req.url).searchParams.get("q")?.trim();
 if(!token)return NextResponse.json({error:"Football-Data.org não configurada."},{status:503});
 if(!q||q.length<2)return NextResponse.json({leagues:[]});
 try{
  const r=await fetch("https://api.football-data.org/v4/competitions",{headers:{"X-Auth-Token":token},next:{revalidate:21600}}),d=await r.json();
  if(!r.ok)return NextResponse.json({error:d?.message||"Não foi possível buscar competições."},{status:r.status});
  const needle=clean(q),items=(d.competitions||[]).filter((x:any)=>clean(`${x.name} ${x.area?.name} ${x.code}`).includes(needle)).slice(0,30);
  return NextResponse.json({leagues:items.map((x:any)=>({id:x.code,name:x.name,country:x.area?.name,season:Number(String(x.currentSeason?.startDate||"").slice(0,4))||new Date().getFullYear(),logo:x.emblem}))});
 }catch{return NextResponse.json({error:"Não foi possível buscar competições."},{status:502})}
}
