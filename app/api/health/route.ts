import {NextResponse} from "next/server";import {initDb,pool} from "@/lib/db";
export async function GET(){try{await initDb();await pool.query("SELECT 1");return NextResponse.json({status:"ok"})}catch{return NextResponse.json({status:"database_error"},{status:503})}}
