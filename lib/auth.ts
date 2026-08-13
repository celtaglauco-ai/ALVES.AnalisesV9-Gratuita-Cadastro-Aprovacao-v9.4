import crypto from "node:crypto";
import {cookies} from "next/headers";
import {initDb,pool} from "./db";
const ADMIN_USER="admin.alves",ADMIN_HASH="4ceeaa60a8f2924fff4d3bdfa6212d1d:c968e0c1dbfefaf4cbf3ea456afd1ec5b75453b90e9714e6d7e833a72a7d4a846cb36e0ecb5b216ccf616f8f6ce7f941dc8e787c3253269012df69e1e4ce95dd",COOKIE="alves_session";
export type Session={id:string;name:string;role:"admin"|"user";exp:number};
const secret=()=>process.env.SESSION_SECRET||"development-only-change-me",sign=(data:string)=>crypto.createHmac("sha256",secret()).update(data).digest("base64url");
export function hashPassword(password:string){const salt=crypto.randomBytes(16).toString("hex");return `${salt}:${crypto.scryptSync(password,salt,64).toString("hex")}`}
export function verifyPassword(password:string,stored:string){try{const [salt,hash]=stored.split(":"),got=crypto.scryptSync(password,salt,64),expected=Buffer.from(hash,"hex");return got.length===expected.length&&crypto.timingSafeEqual(got,expected)}catch{return false}}
export function validAdmin(user:string,password:string){return user===ADMIN_USER&&verifyPassword(password,ADMIN_HASH)}
export async function createSession(data:{id:string;name:string;role:"admin"|"user"}){const payload=Buffer.from(JSON.stringify({...data,exp:Date.now()+8*60*60*1000})).toString("base64url");(await cookies()).set(COOKIE,`${payload}.${sign(payload)}`,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:28800})}
export async function destroySession(){(await cookies()).set(COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0})}
export async function getSession():Promise<Session|null>{const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;const [data,sig]=token.split("."),expected=data?sign(data):"";if(!data||!sig||sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;try{const p=JSON.parse(Buffer.from(data,"base64url").toString()) as Session;return p.exp>Date.now()&&(p.role==="admin"||p.role==="user")?p:null}catch{return null}}
export async function isAdmin(){return (await getSession())?.role==="admin"}
export async function isAuthorized(){const s=await getSession();if(!s)return false;if(s.role==="admin")return true;try{await initDb();const {rows}=await pool.query("SELECT status FROM users WHERE id=$1 LIMIT 1",[s.id]);return rows[0]?.status==="approved"}catch{return false}}
