import {NextResponse} from "next/server";import {destroySession,getSession} from "@/lib/auth";import {initDb,pool} from "@/lib/db";
export async function POST(){const s=await getSession();if(s?.role==="user"){await initDb();await pool.query("UPDATE users SET last_seen=0 WHERE id=$1",[s.id]);}await destroySession();return NextResponse.json({ok:true})}
