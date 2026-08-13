"use client";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { Game, League } from "@/lib/types";
type Tab = "pre" | "live" | "ai" | "admin";
type Msg = { role: "user" | "assistant"; content: string };
type UserRow = {
  id: string;
  name: string;
  email: string;
  status: "pending" | "approved" | "rejected" | "blocked";
  createdAt: number;
};
const codes: Record<string, [string, string]> = {
  E0: ["Inglaterra", "Premier League"],
  E1: ["Inglaterra", "Championship"],
  SP1: ["Espanha", "La Liga"],
  SP2: ["Espanha", "La Liga 2"],
  D1: ["Alemanha", "Bundesliga"],
  D2: ["Alemanha", "2. Bundesliga"],
  I1: ["Itália", "Serie A"],
  I2: ["Itália", "Serie B"],
  F1: ["França", "Ligue 1"],
  F2: ["França", "Ligue 2"],
  N1: ["Holanda", "Eredivisie"],
  P1: ["Portugal", "Primeira Liga"],
  B1: ["Bélgica", "Pro League"],
  BRA: ["Brasil", "Brasileirão"],
  ARG: ["Argentina", "Liga Profesional"],
  USA: ["Estados Unidos", "MLS"],
};
const n = (v: unknown) => Number(String(v ?? "").replace(",", ".")) || 0,
  avg = (a: number[]) =>
    a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0,
  pct = <T,>(a: T[], f: (x: T) => boolean) =>
    a.length ? (a.filter(f).length / a.length) * 100 : 0;
function row(s: string) {
  const a: string[] = [],
    q = { v: false };
  let c = "";
  for (const x of s) {
    if (x === '"') q.v = !q.v;
    else if (x === "," && !q.v) {
      a.push(c);
      c = "";
    } else c += x;
  }
  a.push(c);
  return a.map((x) => x.trim().replace(/^"|"$/g, ""));
}
function parse(text: string) {
  const r = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter(Boolean),
    h = row(r[0] || "").map((x) => x.toLowerCase());
  if (r.length < 2) throw Error("O CSV precisa conter cabeçalho e jogos.");
  const get = (x: string[], ...k: string[]) => {
    const i = k.map((y) => h.indexOf(y.toLowerCase())).find((y) => y >= 0);
    return i === undefined ? "" : x[i];
  };
  return r
    .slice(1)
    .map(row)
    .filter((x) => get(x, "HomeTeam", "Mandante"))
    .map((x) => ({
      home: get(x, "HomeTeam", "Mandante"),
      away: get(x, "AwayTeam", "Visitante"),
      hg: n(get(x, "FTHG")),
      ag: n(get(x, "FTAG")),
      hc: n(get(x, "HC")),
      ac: n(get(x, "AC")),
      hy: n(get(x, "HY")),
      ay: n(get(x, "AY")),
      hr: n(get(x, "HR")),
      ar: n(get(x, "AR")),
      hs: n(get(x, "HS")),
      as: n(get(x, "AS")),
      hst: n(get(x, "HST")),
      ast: n(get(x, "AST")),
    }));
}
function ident(file: string): [string, string, string] {
  const u = file.toUpperCase(),
    k = Object.keys(codes).find((x) =>
      new RegExp(`(^|[^A-Z0-9])${x}([^A-Z0-9]|$)`).test(u),
    );
  return k
    ? [k, ...codes[k]]
    : ["CUSTOM", "País personalizado", "Liga personalizada"];
}
export default function Home() {
  const [tab, setTab] = useState<Tab>("pre"),
    [leagues, setLeagues] = useState<League[]>([]),
    [leagueId, setLeagueId] = useState(""),
    [home, setHome] = useState(""),
    [away, setAway] = useState(""),
    [admin, setAdmin] = useState(false),
    [authenticated, setAuthenticated] = useState(false),
    [authReady, setAuthReady] = useState(false),
    [authMode, setAuthMode] = useState<"login" | "register">("login"),
    [login, setLogin] = useState(false),
    [credentials, setCredentials] = useState({ username: "", password: "" }),
    [register, setRegister] = useState({
      name: "",
      email: "",
      password: "",
      confirm: "",
    }),
    [notice, setNotice] = useState(""),
    [csv, setCsv] = useState(""),
    [fileName, setFileName] = useState(""),
    [season, setSeason] = useState(""),
    [live, setLive] = useState({
      minute: 35,
      hg: 0,
      ag: 0,
      hc: 2,
      ac: 1,
      shots: 8,
      sot: 3,
      yellow: 2,
      red: 0,
    }),
    [ask, setAsk] = useState(""),
    [loading, setLoading] = useState(false),
    [chat, setChat] = useState<Msg[]>([
      {
        role: "assistant",
        content:
          "Selecione uma partida e pergunte sobre gols, escanteios, cartões, finalizações ou tendências estatísticas.",
      },
    ]);
  const load = async () => {
    const r = await fetch("/api/leagues", { cache: "no-store" }),
      d = await r.json();
    if (r.ok) setLeagues(d.leagues);
  };
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setAuthenticated(!!d.authenticated);
        setAdmin(!!d.admin);
        if (d.authenticated) load();
      })
      .finally(() => setAuthReady(true));
  }, []);
  const league = leagues.find((x) => x.id === leagueId),
    teams = useMemo(
      () =>
        league
          ? [...new Set(league.games.flatMap((g) => [g.home, g.away]))].sort()
          : [],
      [league],
    );
  useEffect(() => {
    setHome("");
    setAway("");
  }, [leagueId]);
  const stats = (team: string, venue: "home" | "away") => {
    if (!league) return null;
    const g = league.games
        .filter((x) => (venue === "home" ? x.home === team : x.away === team))
        .slice(-12),
      go = g.map((x) => x.hg + x.ag),
      co = g.map((x) => x.hc + x.ac),
      ca = g.map((x) => x.hy + x.ay + x.hr + x.ar);
    return {
      games: g.length,
      goals: avg(go),
      corners: avg(co),
      cards: avg(ca),
      shots: avg(g.map((x) => (venue === "home" ? x.hs : x.as))),
      onTarget: avg(g.map((x) => (venue === "home" ? x.hst : x.ast))),
      over25: pct(go, (x) => x >= 3),
      btts: pct(g, (x) => x.hg > 0 && x.ag > 0),
      overCorners: pct(co, (x) => x >= 9),
      overCards: pct(ca, (x) => x >= 5),
    };
  };
  const a = home ? stats(home, "home") : null,
    b = away ? stats(away, "away") : null,
    ready = !!(league && home && away && home !== away && a && b),
    base = ready
      ? {
          goals: (a!.over25 + b!.over25) / 2,
          btts: (a!.btts + b!.btts) / 2,
          corners: (a!.overCorners + b!.overCorners) / 2,
          cards: (a!.overCards + b!.overCards) / 2,
        }
      : { goals: 0, btts: 0, corners: 0, cards: 0 },
    prob =
      tab === "live"
        ? {
            ...base,
            goals: Math.min(
              96,
              base.goals * 0.55 + live.sot * 5 + live.shots * 1.2,
            ),
            corners: Math.min(
              96,
              base.corners * 0.55 + (live.hc + live.ac) * 6,
            ),
            cards: Math.min(
              96,
              base.cards * 0.55 + (live.yellow + live.red * 2) * 8,
            ),
          }
        : base;
  const doLogin = async () => {
    const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      }),
      d = await r.json();
    if (!r.ok) return setNotice(d.error);
    setAuthenticated(true);
    setAdmin(d.role === "admin");
    setLogin(false);
    setTab(d.role === "admin" ? "admin" : "pre");
    setNotice("");
    setCredentials({ username: "", password: "" });
    await load();
  };
  const doRegister = async () => {
    if (register.password !== register.confirm)
      return setNotice("As senhas não são iguais.");
    const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(register),
      }),
      d = await r.json();
    setNotice(d.message || d.error);
    if (r.ok) {
      setRegister({ name: "", email: "", password: "", confirm: "" });
      setAuthMode("login");
    }
  };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAdmin(false);
    setAuthenticated(false);
    setLeagues([]);
    setTab("pre");
  };
  const choose = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const r = new FileReader();
    r.onload = () => setCsv(String(r.result || ""));
    r.readAsText(f);
  };
  const save = async () => {
    try {
      const games = parse(csv),
        [code, country, name] = ident(fileName),
        id = (
          code === "CUSTOM" ? `${name}-${season || "atual"}` : code
        ).toLowerCase(),
        item: League = {
          id,
          code,
          country,
          name,
          season: season || "Atual",
          fileName,
          games,
          updatedAt: Date.now(),
        };
      const r = await fetch("/api/admin/leagues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        }),
        d = await r.json();
      if (r.status === 401) {
        setAdmin(false);
        setLogin(true);
        throw Error("Sua sessão expirou.");
      }
      if (!r.ok) throw Error(d.error);
      setNotice(`✓ ${name} salva com ${games.length} jogos.`);
      setCsv("");
      setFileName("");
      setSeason("");
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao importar CSV.");
    }
  };
  const del = async (id: string) => {
    if (!confirm("Excluir esta liga do banco?")) return;
    const r = await fetch(`/api/admin/leagues?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (r.ok) await load();
    else setNotice("Não foi possível excluir.");
  };
  const askAI = async (q = ask) => {
    q = q.trim();
    if (!q || loading) return;
    setChat((x) => [...x, { role: "user", content: q }]);
    setAsk("");
    setLoading(true);
    try {
      const context = ready
          ? {
              league: league?.name,
              country: league?.country,
              season: league?.season,
              mode: tab,
              home,
              away,
              homeStats: a,
              awayStats: b,
              probabilities: prob,
              live: tab === "live" ? live : null,
            }
          : null,
        r = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q, history: chat, context }),
        }),
        d = await r.json();
      setChat((x) => [
        ...x,
        { role: "assistant", content: r.ok ? d.answer : d.error },
      ]);
    } finally {
      setLoading(false);
    }
  };
  const publicTab = (x: Tab) => {
    if (x === "admin" && !admin) {
      setLogin(true);
      return;
    }
    setTab(x);
  };
  if (!authReady)
    return (
      <div className="access-page">
        <div className="access-card">
          <div className="access-logo">⚽</div>
          <h1>
            ALVES.<b>AnalisesV9</b>
          </h1>
          <p>Verificando acesso seguro...</p>
        </div>
      </div>
    );
  if (!authenticated)
    return (
      <div className="access-page">
        <div className="access-card">
          <div className="access-logo">⚽</div>
          <h1>
            ALVES.<b>AnalisesV9</b>
          </h1>
          <p>Pré-jogo, ao vivo e inteligência estatística.</p>
          <div className="access-tabs">
            <button
              className={authMode === "login" ? "on" : ""}
              onClick={() => {
                setAuthMode("login");
                setNotice("");
              }}
            >
              Entrar
            </button>
            <button
              className={authMode === "register" ? "on" : ""}
              onClick={() => {
                setAuthMode("register");
                setNotice("");
              }}
            >
              Criar cadastro
            </button>
          </div>
          {authMode === "login" ? (
            <div className="access-form">
              <label>
                E-mail ou usuário administrativo
                <input
                  autoFocus
                  value={credentials.username}
                  onChange={(e) =>
                    setCredentials({ ...credentials, username: e.target.value })
                  }
                  placeholder="seu@email.com"
                />
              </label>
              <label>
                Senha
                <input
                  type="password"
                  value={credentials.password}
                  onChange={(e) =>
                    setCredentials({ ...credentials, password: e.target.value })
                  }
                  onKeyDown={(e) => e.key === "Enter" && doLogin()}
                />
              </label>
              <button className="primary" onClick={doLogin}>
                Entrar no sistema
              </button>
              <small>
                Cadastros novos precisam ser aprovados pelo administrador.
              </small>
            </div>
          ) : (
            <div className="access-form">
              <label>
                Nome completo
                <input
                  value={register.name}
                  onChange={(e) =>
                    setRegister({ ...register, name: e.target.value })
                  }
                />
              </label>
              <label>
                E-mail
                <input
                  type="email"
                  value={register.email}
                  onChange={(e) =>
                    setRegister({ ...register, email: e.target.value })
                  }
                />
              </label>
              <label>
                Senha (mínimo 8 caracteres)
                <input
                  type="password"
                  value={register.password}
                  onChange={(e) =>
                    setRegister({ ...register, password: e.target.value })
                  }
                />
              </label>
              <label>
                Confirmar senha
                <input
                  type="password"
                  value={register.confirm}
                  onChange={(e) =>
                    setRegister({ ...register, confirm: e.target.value })
                  }
                />
              </label>
              <button className="primary" onClick={doRegister}>
                Enviar para aprovação
              </button>
              <small>
                Você só poderá entrar depois que o administrador aceitar.
              </small>
            </div>
          )}
          {notice && <div className="access-notice">{notice}</div>}
          <footer>🔒 Acesso controlado pelo proprietário</footer>
        </div>
      </div>
    );
  return (
    <div className="app">
      <header>
        <div className="brand">
          <span>⚽</span>
          <div>
            <h1>
              ALVES.<b>AnalisesV9</b>
            </h1>
            <p>Estatísticas profissionais de futebol</p>
          </div>
        </div>
        <div className="online">
          <i /> Sistema operacional
        </div>
      </header>
      <div className="layout">
        <aside>
          <small>MENU</small>
          <Nav
            on={tab === "pre"}
            icon="◷"
            title="Pré-jogo"
            click={() => publicTab("pre")}
          />
          <Nav
            on={tab === "live"}
            icon="●"
            title="Ao vivo"
            click={() => publicTab("live")}
          />
          <Nav
            on={tab === "ai"}
            icon="✦"
            title="Análise por IA"
            click={() => publicTab("ai")}
          />
          {admin && (
            <>
              <small className="restricted">ÁREA RESTRITA</small>
              <Nav
                on={tab === "admin"}
                icon="⚙"
                title="Painel Admin"
                click={() => publicTab("admin")}
              />
            </>
          )}
          <div className="db-card">
            <b>Competições</b>
            <strong>{leagues.length}</strong>
            <span>disponíveis para análise</span>
          </div>
          <footer>
            <button
              className="admin-link"
              onClick={() => (admin ? setTab("admin") : setLogin(true))}
            >
              {admin ? "Painel do proprietário" : "Acesso administrativo"}
            </button>
          </footer>
        </aside>
        <main>
          {tab !== "admin" && (
            <>
              <div className="page-head">
                <div>
                  <span>
                    {tab === "pre"
                      ? "ANÁLISE PRÉ-JOGO"
                      : tab === "live"
                        ? "ANÁLISE AO VIVO"
                        : "INTELIGÊNCIA ESTATÍSTICA"}
                  </span>
                  <h2>
                    {tab === "ai"
                      ? "Análise de jogos por IA"
                      : "Central de análises"}
                  </h2>
                  <p>
                    {tab === "ai"
                      ? "Faça perguntas somente sobre os números da partida."
                      : "Selecione a competição e as equipes para calcular tendências."}
                  </p>
                </div>
              </div>
              <section className="panel">
                <div className="panel-head">
                  <i className="green">⌄</i>
                  <div>
                    <h3>Selecione a partida</h3>
                    <p>As setas abrem a lista de ligas e times</p>
                  </div>
                </div>
                <div className="form-grid">
                  <Select
                    label="Liga"
                    value={leagueId}
                    set={setLeagueId}
                    placeholder="Selecionar liga..."
                    options={leagues.map((l) => [
                      l.id,
                      `${l.country} — ${l.name} (${l.season})`,
                    ])}
                  />
                  <Select
                    label="Casa"
                    value={home}
                    set={setHome}
                    placeholder="Selecionar time da casa..."
                    options={teams.map((t) => [t, t])}
                    disabled={!league}
                  />
                  <Select
                    label="Fora"
                    value={away}
                    set={setAway}
                    placeholder="Selecionar time visitante..."
                    options={teams.map((t) => [t, t])}
                    disabled={!league}
                  />
                </div>
              </section>
            </>
          )}
          {tab === "live" && (
            <section className="panel">
              <div className="panel-head">
                <i className="red">●</i>
                <div>
                  <h3>Dados ao vivo</h3>
                  <p>Atualize o placar e as estatísticas atuais</p>
                </div>
              </div>
              <div className="live-grid">
                {Object.entries({
                  minute: "Minuto",
                  hg: "Gols casa",
                  ag: "Gols fora",
                  hc: "Cantos casa",
                  ac: "Cantos fora",
                  shots: "Finalizações",
                  sot: "No gol",
                  yellow: "Amarelos",
                  red: "Vermelhos",
                }).map(([k, v]) => (
                  <label key={k}>
                    {v}
                    <input
                      type="number"
                      min="0"
                      value={live[k as keyof typeof live]}
                      onChange={(e) =>
                        setLive({ ...live, [k]: n(e.target.value) })
                      }
                    />
                  </label>
                ))}
              </div>
            </section>
          )}
          {(tab === "pre" || tab === "live") &&
            (!ready ? (
              <Empty has={leagues.length > 0} />
            ) : (
              <>
                <div className="match">
                  <div>
                    <small>CASA</small>
                    <b>{home}</b>
                  </div>
                  <strong>×</strong>
                  <div>
                    <small>FORA</small>
                    <b>{away}</b>
                  </div>
                </div>
                <div className="markets">
                  <Market
                    icon="⚽"
                    title="Gols"
                    value={prob.goals}
                    text={`Over 2.5 • Ambas marcam ${prob.btts.toFixed(0)}%`}
                  />
                  <Market
                    icon="🚩"
                    title="Escanteios"
                    value={prob.corners}
                    text={`9+ cantos • média ${avg([a!.corners, b!.corners]).toFixed(1)}`}
                  />
                  <Market
                    icon="▰"
                    title="Cartões"
                    value={prob.cards}
                    text={`5+ cartões • média ${avg([a!.cards, b!.cards]).toFixed(1)}`}
                  />
                </div>
              </>
            ))}
          {tab === "ai" && (
            <section className="ai-workspace">
              <div className="ai-badge">✦ MODO IA ESTATÍSTICA</div>
              <div className="ai-chat">
                {chat.map((m, i) => (
                  <div key={i} className={`bubble ${m.role}`}>
                    {m.content}
                  </div>
                ))}
                {loading && (
                  <div className="bubble assistant">
                    Analisando os números...
                  </div>
                )}
              </div>
              <div className="quick">
                <button
                  disabled={!ready}
                  onClick={() =>
                    askAI("Faça um resumo estatístico completo desta partida.")
                  }
                >
                  Resumo estatístico
                </button>
                <button
                  disabled={!ready}
                  onClick={() =>
                    askAI("Analise a tendência de gols desta partida.")
                  }
                >
                  Gols
                </button>
                <button
                  disabled={!ready}
                  onClick={() =>
                    askAI("Analise escanteios e cartões desta partida.")
                  }
                >
                  Cantos e cartões
                </button>
              </div>
              <div className="ai-search">
                <span>＋</span>
                <input
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") askAI();
                  }}
                  placeholder="Pergunte sobre as estatísticas do jogo"
                />
                <button
                  disabled={!ready || loading || !ask.trim()}
                  onClick={() => askAI()}
                >
                  ✦ Modo IA
                </button>
              </div>
              <small>
                A IA interpreta apenas os dados cadastrados e não garante
                resultados.
              </small>
            </section>
          )}
          {tab === "admin" && admin && (
            <>
              <div className="page-head">
                <div>
                  <span>ACESSO EXCLUSIVO DO PROPRIETÁRIO</span>
                  <h2>Painel administrativo</h2>
                  <p>
                    Aprove cadastros e gerencie CSVs em uma área invisível aos
                    visitantes.
                  </p>
                </div>
                <button className="danger" onClick={logout}>
                  Sair com segurança
                </button>
              </div>
              <div className="stats">
                <article>
                  <span>Ligas</span>
                  <b>{leagues.length}</b>
                  <small>cadastradas</small>
                </article>
                <article>
                  <span>Partidas</span>
                  <b>{leagues.reduce((s, l) => s + l.games.length, 0)}</b>
                  <small>no PostgreSQL</small>
                </article>
                <article>
                  <span>Acesso</span>
                  <b>Privado</b>
                  <small>somente aprovados</small>
                </article>
              </div>
              <UserAdmin />
              <section className="panel">
                <div className="panel-head">
                  <i className="blue">⇧</i>
                  <div>
                    <h3>Importar ou atualizar CSV</h3>
                    <p>
                      Somente uma sessão administrativa autenticada consegue
                      salvar dados
                    </p>
                  </div>
                </div>
                <div className="upload-grid">
                  <label className="drop">
                    <input type="file" accept=".csv,.txt" onChange={choose} />
                    <b>{fileName || "Selecionar arquivo CSV"}</b>
                    <span>Football-Data ou estrutura compatível</span>
                  </label>
                  <label>
                    Temporada
                    <input
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                      placeholder="Ex.: 2026/27"
                    />
                  </label>
                </div>
                <textarea
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                  placeholder="Ou cole o conteúdo completo do CSV..."
                />
                <div className="actions">
                  <button className="primary" disabled={!csv} onClick={save}>
                    Processar e salvar
                  </button>
                  <button
                    onClick={() => {
                      setCsv("");
                      setFileName("");
                    }}
                  >
                    Limpar
                  </button>
                  <span>{notice}</span>
                </div>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <i className="green">▤</i>
                  <div>
                    <h3>Ligas no banco</h3>
                    <p>
                      Atualizar o mesmo código substitui somente aquela liga
                    </p>
                  </div>
                </div>
                <div className="table">
                  <div className="tr th">
                    <span>COMPETIÇÃO</span>
                    <span>TEMPORADA</span>
                    <span>JOGOS</span>
                    <span>ATUALIZAÇÃO</span>
                    <span>AÇÃO</span>
                  </div>
                  {leagues.map((l) => (
                    <div className="tr" key={l.id}>
                      <span>
                        <b>{l.name}</b>
                        <small>{l.country}</small>
                      </span>
                      <span>{l.season}</span>
                      <span>{l.games.length}</span>
                      <span>
                        {new Date(l.updatedAt).toLocaleString("pt-BR")}
                      </span>
                      <span>
                        <button className="danger" onClick={() => del(l.id)}>
                          Excluir
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
      {login && (
        <div className="modal" onMouseDown={() => setLogin(false)}>
          <div className="modal-box" onMouseDown={(e) => e.stopPropagation()}>
            <i>◆</i>
            <h2>Área administrativa</h2>
            <p>Acesso exclusivo do proprietário</p>
            <label>
              Usuário
              <input
                autoFocus
                value={credentials.username}
                onChange={(e) =>
                  setCredentials({ ...credentials, username: e.target.value })
                }
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                value={credentials.password}
                onChange={(e) =>
                  setCredentials({ ...credentials, password: e.target.value })
                }
                onKeyDown={(e) => e.key === "Enter" && doLogin()}
              />
            </label>
            {notice && <div className="error">{notice}</div>}
            <button className="primary" onClick={doLogin}>
              Entrar com segurança
            </button>
            <button onClick={() => setLogin(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
function Nav({
  on,
  icon,
  title,
  click,
}: {
  on: boolean;
  icon: string;
  title: string;
  click: () => void;
}) {
  return (
    <button className={on ? "active" : ""} onClick={click}>
      <span>{icon}</span>
      <div>{title}</div>
    </button>
  );
}
function Select({
  label,
  value,
  set,
  placeholder,
  options,
  disabled,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  placeholder: string;
  options: string[][];
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => set(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((x) => (
          <option key={x[0]} value={x[0]}>
            {x[1]}
          </option>
        ))}
      </select>
    </label>
  );
}
function Market({
  icon,
  title,
  value,
  text,
}: {
  icon: string;
  title: string;
  value: number;
  text: string;
}) {
  return (
    <article className="market">
      <div>
        <span>{icon}</span>
        <p>
          <small>MERCADO</small>
          <b>{title}</b>
        </p>
        <strong>{value.toFixed(0)}%</strong>
      </div>
      <p>{text}</p>
      <figure>
        <i style={{ width: `${value}%` }} />
      </figure>
      <footer>
        {value >= 75
          ? "Tendência forte"
          : value >= 60
            ? "Tendência moderada"
            : "Atenção"}
      </footer>
    </article>
  );
}
function Empty({ has }: { has: boolean }) {
  return (
    <div className="empty">
      <span>⌁</span>
      <h3>{has ? "Selecione a partida" : "Aguardando dados"}</h3>
      <p>
        {has
          ? "Use as setas acima para escolher liga e times."
          : "O administrador ainda não cadastrou uma liga."}
      </p>
    </div>
  );
}

function UserAdmin() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [message, setMessage] = useState("");
  const loadUsers = async () => {
    const r = await fetch("/api/admin/users", { cache: "no-store" });
    const d = await r.json();
    if (r.ok) setUsers(d.users);
  };
  useEffect(() => {
    loadUsers();
  }, []);
  const update = async (id: string, status: UserRow["status"]) => {
    const r = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setMessage(r.ok ? "Acesso atualizado." : "Não foi possível atualizar.");
    if (r.ok) await loadUsers();
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir definitivamente este cadastro?")) return;
    const r = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (r.ok) await loadUsers();
  };
  const label: Record<UserRow["status"], string> = {
    pending: "Aguardando",
    approved: "Aprovado",
    rejected: "Recusado",
    blocked: "Bloqueado",
  };
  return (
    <section className="panel users-panel">
      <div className="panel-head">
        <i className="purple">♙</i>
        <div>
          <h3>Solicitações e usuários</h3>
          <p>Somente pessoas aprovadas conseguem abrir as análises</p>
        </div>
        <strong className="pending-count">
          {users.filter((u) => u.status === "pending").length} pendentes
        </strong>
      </div>
      {message && <div className="admin-message">{message}</div>}
      <div className="user-list">
        {users.length ? (
          users.map((u) => (
            <div className="user-row" key={u.id}>
              <i>{u.name.charAt(0).toUpperCase()}</i>
              <p>
                <b>{u.name}</b>
                <small>{u.email}</small>
              </p>
              <em className={`status-${u.status}`}>{label[u.status]}</em>
              <div className="user-actions">
                {u.status !== "approved" && (
                  <button className="approve" onClick={() => update(u.id, "approved")}>Aceitar</button>
                )}
                {u.status !== "rejected" && (
                  <button onClick={() => update(u.id, "rejected")}>Recusar</button>
                )}
                {u.status === "approved" && (
                  <button className="danger" onClick={() => update(u.id, "blocked")}>Bloquear</button>
                )}
                <button className="danger" onClick={() => remove(u.id)}>Excluir</button>
              </div>
            </div>
          ))
        ) : (
          <div className="nodata">Nenhum cadastro recebido.</div>
        )}
      </div>
    </section>
  );
}
