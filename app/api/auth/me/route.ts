import {NextResponse} from "next/server";import {getSession,isAuthorized} from "@/lib/auth";
export async function GET(){const s=await getSession(),authorized=await isAuthorized();return NextResponse.json({authenticated:authorized,admin:authorized&&s?.role==="admin",role:authorized?s?.role:null,name:authorized?s?.name:null})}
