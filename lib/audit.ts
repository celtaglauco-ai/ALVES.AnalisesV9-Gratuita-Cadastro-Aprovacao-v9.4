import crypto from "node:crypto";
import {pool} from "./db";
export async function audit(action:string,actor:{id?:string;role?:string}|null,targetType="",targetId="",details:Record<string,unknown>={},ip=""){
 try{await pool.query("INSERT INTO audit_logs(id,actor_id,actor_role,action,target_type,target_id,details,ip,created_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)",[crypto.randomUUID(),actor?.id||"system",actor?.role||"system",action.slice(0,80),targetType.slice(0,50),targetId.slice(0,100),JSON.stringify(details),ip.slice(0,100),Date.now()])}catch{}
}
export const requestIp=(req:Request)=>String(req.headers.get("x-forwarded-for")?.split(",")[0]||req.headers.get("x-real-ip")||"local").trim().slice(0,100);
