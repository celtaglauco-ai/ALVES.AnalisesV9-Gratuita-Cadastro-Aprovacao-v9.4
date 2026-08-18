import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {createSession,validAdmin,verifyPassword} from "@/lib/auth";
import {initDb,pool} from "@/lib/db";
import {audit,requestIp} from "@/lib/audit";

export async function POST(req:Request){
 try{
  const b=await req.json(),login=String(b.username||b.email||"").trim().toLowerCase().slice(0,160),password=String(b.password||""),remember=b.remember===true,ip=requestIp(req);await initDb();
  const cut=Date.now()-15*60*1000,{rows:attempts}=await pool.query("SELECT count(*)::int failures FROM login_attempts WHERE success=false AND created_at>$1 AND (login=$2 OR ip=$3)",[cut,login,ip]);
  if(Number(attempts[0]?.failures||0)>=8){await audit("login_blocked",null,"login",login,{reason:"Muitas tentativas"},ip);return NextResponse.json({error:"Muitas tentativas. Aguarde 15 minutos antes de tentar novamente."},{status:429})}
  const record=async(success:boolean)=>pool.query("INSERT INTO login_attempts(id,login,ip,success,created_at) VALUES($1,$2,$3,$4,$5)",[crypto.randomUUID(),login,ip,success,Date.now()]);
  if(validAdmin(login,password)){await record(true);await createSession({id:"admin",name:"Administrador",role:"admin"},remember);await audit("login_success",{id:"admin",role:"admin"},"session","admin",{},ip);return NextResponse.json({role:"admin",name:"Administrador"})}
  const {rows}=await pool.query("SELECT id,name,password_hash,status,session_version FROM users WHERE lower(email)=$1 LIMIT 1",[login]),u=rows[0];
  if(!u||!verifyPassword(password,u.password_hash)){await record(false);await audit("login_failed",u?{id:u.id,role:"user"}:null,"login",login,{},ip);return NextResponse.json({error:"E-mail ou senha incorretos."},{status:401})}
  if(u.status!=="approved"){await record(false);const errors:Record<string,string>={pending:"Seu cadastro ainda está aguardando aprovação do administrador.",rejected:"Seu cadastro não foi aprovado. Fale com o administrador.",blocked:"Seu acesso está bloqueado. Fale com o administrador."};return NextResponse.json({error:errors[u.status]||"Acesso indisponível."},{status:403})}
  await record(true);await createSession({id:u.id,name:u.name,role:"user",ver:Number(u.session_version||1)},remember);await audit("login_success",{id:u.id,role:"user"},"session",u.id,{},ip);return NextResponse.json({role:"user",name:u.name});
 }catch{return NextResponse.json({error:"Não foi possível entrar agora."},{status:400})}
}
