import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { initDb, pool } from "@/lib/db";
import type { DataQuality, Game } from "@/lib/types";
import { settlePendingAnalyses } from "@/lib/settlement";

type Payload = {
  action: "create" | "update";
  targetId?: string;
  country: string;
  name: string;
  season: string;
  code?: string;
  fileName?: string;
  games: Game[];
  quality: DataQuality;
};
const clean = (v: unknown, max = 80) =>
  String(v ?? "")
    .trim()
    .slice(0, max);
const validGames = (x: unknown): x is Game[] =>
  Array.isArray(x) &&
  x.length > 0 &&
  x.length <= 10000 &&
  x.every((g) => g && typeof g.home === "string" && typeof g.away === "string");

export async function POST(req: Request) {
  if (!(await isAdmin()))
    return NextResponse.json(
      { error: "Acesso administrativo obrigatório." },
      { status: 401 },
    );
  try {
    const x = (await req.json()) as Payload,
      country = clean(x.country),
      name = clean(x.name),
      season = clean(x.season),
      code = clean(x.code || `${country}-${name}`, 40).toUpperCase();
    if (country.length < 2 || name.length < 2 || season.length < 2)
      return NextResponse.json(
        { error: "Informe país, nome da liga e temporada." },
        { status: 400 },
      );
    if (!validGames(x.games))
      return NextResponse.json(
        { error: "CSV inválido ou sem partidas reconhecidas." },
        { status: 400 },
      );
    await initDb();
    const now = Date.now(),
      quality = x.quality || {
        goals: true,
        corners: false,
        cards: false,
        shots: false,
        shotsOnTarget: false,
      };
    if (x.action === "update") {
      if (!x.targetId)
        return NextResponse.json(
          { error: "Escolha exatamente qual liga será atualizada." },
          { status: 400 },
        );
      const result = await pool.query(
        "UPDATE leagues SET code=$1,country=$2,name=$3,season=$4,file_name=$5,games=$6::jsonb,updated_at=$7,data_quality=$8::jsonb WHERE id=$9",
        [
          code,
          country,
          name,
          season,
          clean(x.fileName, 160),
          JSON.stringify(x.games),
          now,
          JSON.stringify(quality),
          x.targetId,
        ],
      );
      if (!result.rowCount)
        return NextResponse.json(
          { error: "Liga escolhida não foi encontrada." },
          { status: 404 },
        );
      const settlement=await settlePendingAnalyses().catch(()=>({checked:0,settled:0,partial:0}));
      return NextResponse.json({ ok: true, id: x.targetId, updated: true, settlement });
    }
    const id = crypto.randomUUID();
    await pool.query(
      "INSERT INTO leagues(id,code,country,name,season,file_name,games,updated_at,data_quality) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb)",
      [
        id,
        code,
        country,
        name,
        season,
        clean(x.fileName, 160),
        JSON.stringify(x.games),
        now,
        JSON.stringify(quality),
      ],
    );
    const settlement=await settlePendingAnalyses().catch(()=>({checked:0,settled:0,partial:0}));
    return NextResponse.json({ ok: true, id, created: true, settlement });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível salvar a liga." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  if (!(await isAdmin()))
    return NextResponse.json(
      { error: "Acesso administrativo obrigatório." },
      { status: 401 },
    );
  try {
    const x = await req.json(),
      id = clean(x.id, 80),
      country = clean(x.country),
      name = clean(x.name),
      season = clean(x.season),
      code = clean(x.code, 40).toUpperCase();
    if (!id || country.length < 2 || name.length < 2 || season.length < 2)
      return NextResponse.json(
        { error: "Preencha os dados da liga." },
        { status: 400 },
      );
    await initDb();
    await pool.query(
      "UPDATE leagues SET country=$1,name=$2,season=$3,code=$4,updated_at=$5 WHERE id=$6",
      [
        country,
        name,
        season,
        code || `${country}-${name}`.toUpperCase(),
        Date.now(),
        id,
      ],
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível editar a liga." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  if (!(await isAdmin()))
    return NextResponse.json(
      { error: "Acesso administrativo obrigatório." },
      { status: 401 },
    );
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID ausente." }, { status: 400 });
  await initDb();
  await pool.query("DELETE FROM leagues WHERE id=$1", [id]);
  return NextResponse.json({ ok: true });
}
