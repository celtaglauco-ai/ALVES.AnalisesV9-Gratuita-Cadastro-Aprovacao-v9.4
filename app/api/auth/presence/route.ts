import { NextResponse } from "next/server";
import { getSession,isAuthorized } from "@/lib/auth";
import { initDb,pool } from "@/lib/db";
export async function POST(){const s=await getSession();if(!s||!await isAuthorized())return NextResponse.json({ok:false},{status:401});if(s.role==="user"){await initDb();await pool.query("UPDATE users SET last_seen=$1 WHERE id=$2",[Date.now(),s.id]);}return NextResponse.json({ok:true});}
export async function DELETE(){const s=await getSession();if(s?.role==="user"){await initDb();await pool.query("UPDATE users SET last_seen=0 WHERE id=$1",[s.id]);}return NextResponse.json({ok:true});}
