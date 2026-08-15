"use client";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { DataQuality, Game, League } from "@/lib/types";
type Tab = "pre" | "standings" | "live" | "ai" | "admin";
type Msg = { role: "user" | "assistant"; content: string };
type UserRow = {
  id: string;
  name: string;
  email: string;
  status: "pending" | "approved" | "rejected" | "blocked";
  createdAt: number;
  lastSeen?: number;
  online?: boolean;
};
type TableMode = "TOTAL" | "HOME" | "AWAY";
type StandingRow = { team:string; logo?:string; p:number; j:number; v:number; e:number; d:number; gp:number; gc:number; sg:number; form:("V"|"E"|"D")[] };
type LiveApiGame={provider:"api-football"|"football-data";id:number;date:string;minute:number;status:string;statusLong:string;leagueId:number;registeredLeagueId:string;registeredLeagueName:string;league:string;country:string;home:string;away:string;homeLogo?:string;awayLogo?:string;hg:number;ag:number};
type ApiLeagueOption={id:number|string;name:string;country:string;season:number;logo?:string};
type ManualReferee={id:string;name:string;country:string;leagueId:string;games:number;foulsPerGame:number;yellowPerGame:number;redPerGame:number;homeYellow:number;awayYellow:number;over35:number;over45:number;over55:number;updatedAt:number};
type PreChartMetric="goals"|"conceded"|"corners"|"cards"|"shots"|"onTarget";
type LineSeries={name:string;color:string;values:number[];dashed?:boolean;icon?:string};
const emptyReferee={id:"",name:"",country:"",leagueId:"",games:0,foulsPerGame:0,yellowPerGame:0,redPerGame:0,homeYellow:0,awayYellow:0,over35:0,over45:0,over55:0};
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
  minuteList=(v:unknown)=>String(v??"").split(/[|;/ ]+/).map(x=>Number(x.replace(/\D/g,""))).filter(x=>x>0&&x<=130),
  avg = (a: number[]) =>
    a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0,
  pct = <T,>(a: T[], f: (x: T) => boolean) =>
    a.length ? (a.filter(f).length / a.length) * 100 : 0;
function row(s: string, delimiter = ",") {
  const a: string[] = [],
    q = { v: false };
  let c = "";
  for (const x of s) {
    if (x === '"') q.v = !q.v;
    else if (x === delimiter && !q.v) {
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
    delimiter =
      (r[0].match(/;/g) || []).length > (r[0].match(/,/g) || []).length
        ? ";"
        : ",",
    h = row(r[0] || "", delimiter).map((x) =>
      x.toLowerCase().replace(/[ _-]/g, ""),
    );
  if (r.length < 2) throw Error("O CSV precisa conter cabeçalho e jogos.");
  const get = (x: string[], ...k: string[]) => {
    const i = k
      .map((y) => h.indexOf(y.toLowerCase().replace(/[ _-]/g, "")))
      .find((y) => y >= 0);
    return i === undefined ? "" : x[i];
  };
  if (
    !get(h, "HomeTeam", "Home", "Mandante", "home_team") &&
    !h.includes("hometeam") &&
    !h.includes("home")
  )
    throw Error("Colunas HomeTeam/AwayTeam ou Home/Away não encontradas.");
  const games = r
    .slice(1)
    .map((x) => row(x, delimiter))
    .filter((x) => get(x, "HomeTeam", "Home", "Mandante", "home_team"))
    .map((x) => ({
      date: get(x, "Date", "Data"),
      round: get(x, "Round", "Rodada", "Matchday"),
      referee: get(x, "Referee", "Arbitro", "Árbitro"),
      home: get(x, "HomeTeam", "Home", "Mandante", "home_team"),
      away: get(x, "AwayTeam", "Away", "Visitante", "away_team"),
      hg: n(get(x, "FTHG", "HG", "home_score")),
      ag: n(get(x, "FTAG", "AG", "away_score")),
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
      hf: n(get(x, "HF", "HomeFouls")),
      af: n(get(x, "AF", "AwayFouls")),
      hxg: n(get(x, "HxG", "HomeXG", "xGHome")),
      axg: n(get(x, "AxG", "AwayXG", "xGAway")),
      hp: n(get(x, "HP", "HomePossession", "PossessionHome")),
      ap: n(get(x, "AP", "AwayPossession", "PossessionAway")),
      homeGoalMinutes: minuteList(get(x,"HomeGoalMinutes","HGMinutes","MinutosGolsCasa")),
      awayGoalMinutes: minuteList(get(x,"AwayGoalMinutes","AGMinutes","MinutosGolsFora")),
      homeCornerMinutes: minuteList(get(x,"HomeCornerMinutes","HCMinutes","MinutosCantosCasa")),
      awayCornerMinutes: minuteList(get(x,"AwayCornerMinutes","ACMinutes","MinutosCantosFora")),
    }));
  if (!games.length) throw Error("Nenhuma partida válida encontrada.");
  const first = row(r[1], delimiter),
    has = (...x: string[]) =>
      x.some((k) => h.includes(k.toLowerCase().replace(/[ _-]/g, ""))),
    quality: DataQuality = {
      goals: has("FTHG", "HG", "home_score") && has("FTAG", "AG", "away_score"),
      corners: has("HC") && has("AC"),
      cards: has("HY") && has("AY"),
      shots: has("HS") && has("AS"),
      shotsOnTarget: has("HST") && has("AST"),
      referees: has("Referee", "Arbitro", "Árbitro"),
      xg: has("HxG", "HomeXG", "xGHome") && has("AxG", "AwayXG", "xGAway"),
      possession: has("HP", "HomePossession", "PossessionHome") && has("AP", "AwayPossession", "PossessionAway"),
    };
  return {
    games,
    quality,
    meta: {
      country: get(first, "Country", "Pais", "País"),
      name: get(first, "League", "Liga", "Competition"),
      season: get(first, "Season", "Temporada"),
    },
  };
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
function resultFor(g: Game, team: string): "V"|"E"|"D" {
  const own = g.home === team ? g.hg : g.ag, other = g.home === team ? g.ag : g.hg;
  return own > other ? "V" : own < other ? "D" : "E";
}
function buildTable(games: Game[], mode: TableMode): StandingRow[] {
  const teams=[...new Set(games.flatMap(g=>[g.home,g.away]))], map=new Map<string,StandingRow>();
  teams.forEach(team=>map.set(team,{team,p:0,j:0,v:0,e:0,d:0,gp:0,gc:0,sg:0,form:[]}));
  games.forEach(g=>{
    const participants=mode==="HOME"?[g.home]:mode==="AWAY"?[g.away]:[g.home,g.away];
    participants.forEach(team=>{const r=map.get(team)!;const home=g.home===team,own=home?g.hg:g.ag,other=home?g.ag:g.hg;r.j++;r.gp+=own;r.gc+=other;if(own>other){r.v++;r.p+=3}else if(own===other){r.e++;r.p++}else r.d++;r.form.push(resultFor(g,team));});
  });
  return [...map.values()].map(r=>({...r,sg:r.gp-r.gc,form:r.form.slice(-5)})).sort((a,b)=>b.p-a.p||b.sg-a.sg||b.gp-a.gp||a.team.localeCompare(b.team));
}
function TrendLineChart({series,labels}:{series:LineSeries[];labels:string[]}) {
  const width=760,height=285,left=43,right=18,top=20,bottom=42,
    plotW=width-left-right,plotH=height-top-bottom,
    all=series.flatMap(s=>s.values).filter(Number.isFinite),max=Math.max(1,...all),
    ceiling=Math.max(1,Math.ceil(max)),steps=4,
    x=(i:number,count:number)=>left+(count<=1?plotW/2:i*plotW/(count-1)),
    y=(v:number)=>top+plotH-(v/ceiling)*plotH,
    points=(values:number[])=>values.map((v,i)=>`${x(i,values.length)},${y(v)}`).join(" ");
  return <div className="trend-chart-wrap">
    <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de evolução dos últimos jogos">
      <defs>
        <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#36df91" stopOpacity=".18"/><stop offset="1" stopColor="#36df91" stopOpacity="0"/></linearGradient>
        <filter id="trendGlow"><feGaussianBlur stdDeviation="2.4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      {Array.from({length:steps+1},(_,i)=>{const value=ceiling-(ceiling/steps)*i,py=top+(plotH/steps)*i;return <g key={i}><line x1={left} x2={width-right} y1={py} y2={py} className="trend-grid-line"/><text x={left-10} y={py+4} className="trend-axis-y">{value%1?value.toFixed(1):value}</text></g>})}
      {labels.map((label,i)=><g key={`${label}-${i}`}><line x1={x(i,labels.length)} x2={x(i,labels.length)} y1={top} y2={top+plotH} className="trend-grid-vertical"/><text x={x(i,labels.length)} y={height-14} className="trend-axis-x">{label}</text></g>)}
      {series.map((s,si)=>s.values.length?<g key={s.name} className="trend-series">
        {si===0&&s.values.length>1&&<polygon points={`${left},${top+plotH} ${points(s.values)} ${x(s.values.length-1,s.values.length)},${top+plotH}`} fill="url(#trendArea)"/>}
        <polyline points={points(s.values)} fill="none" stroke={s.color} strokeWidth={s.dashed?2.5:4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dashed?"9 8":undefined} filter={s.dashed?undefined:"url(#trendGlow)"}/>
        {!s.dashed&&s.values.map((v,i)=><g key={i}><circle cx={x(i,s.values.length)} cy={y(v)} r="6" fill="#0b1728" stroke={s.color} strokeWidth="3"><title>{s.name}: {v.toFixed(1)} no ponto {i+1}</title></circle>{s.icon&&<text x={x(i,s.values.length)} y={y(v)-14} className="trend-point-icon">{s.icon}</text>}<text x={x(i,s.values.length)} y={y(v)+(s.icon?-25:-11)} className="trend-value" style={{fill:s.color}}>{v.toFixed(1)}</text></g>)}
      </g>:null)}
    </svg>
  </div>;
}
export default function Home() {
  const [tab, setTab] = useState<Tab>("pre"),
    [leagues, setLeagues] = useState<League[]>([]),
    [manualReferees,setManualReferees]=useState<ManualReferee[]>([]),
    [refereeForm,setRefereeForm]=useState({...emptyReferee}),
    [leagueId, setLeagueId] = useState(""),
    [awayLeagueId, setAwayLeagueId] = useState(""),
    [home, setHome] = useState(""),
    [away, setAway] = useState(""),
    [admin, setAdmin] = useState(false),
    [authenticated, setAuthenticated] = useState(false),
    [authReady, setAuthReady] = useState(false),
    [authMode, setAuthMode] = useState<"login" | "register">("login"),
    [login, setLogin] = useState(false),
    [credentials, setCredentials] = useState({ username: "", password: "" }),
    [rememberLogin,setRememberLogin]=useState(true),
    [register, setRegister] = useState({
      name: "",
      email: "",
      password: "",
      confirm: "",
    }),
    [notice, setNotice] = useState(""),
    [csv, setCsv] = useState(""),
    [fileName, setFileName] = useState(""),
    [leagueMeta, setLeagueMeta] = useState({
      country: "",
      name: "",
      season: "",
      code: "",
    }),
    [importMode, setImportMode] = useState<"create" | "update">("create"),
    [updateTarget, setUpdateTarget] = useState(""),
    [editingLeague, setEditingLeague] = useState<League | null>(null),
    [apiLeagueQuery,setApiLeagueQuery]=useState(""),
    [apiLeagueOptions,setApiLeagueOptions]=useState<ApiLeagueOption[]>([]),
    [apiLeagueLoading,setApiLeagueLoading]=useState(false),
    [analyzed, setAnalyzed] = useState(false),
    [preChartMetric,setPreChartMetric]=useState<PreChartMetric>("goals"),
    [xrayLeagueId,setXrayLeagueId]=useState(""),
    [xrayTeam,setXrayTeam]=useState(""),
    [xrayMinuteHistory,setXrayMinuteHistory]=useState<{labels:string[];goals:number[];corners:number[];cards:number[];shots:number[];onTarget:number[];snapshots:number}>({labels:[],goals:[],corners:[],cards:[],shots:[],onTarget:[],snapshots:0}),
    [tableMode, setTableMode] = useState<TableMode>("TOTAL"),
    [teamSearch, setTeamSearch] = useState(""),
    [leagueSearch,setLeagueSearch]=useState(""),
    [selectedReferee, setSelectedReferee] = useState(""),
    [apiInfo, setApiInfo] = useState("Selecione uma liga para consultar a temporada atual na API"),
    [apiStandings, setApiStandings] = useState<Partial<Record<TableMode,StandingRow[]>>>({}),
    [apiGames,setApiGames]=useState<Game[]>([]),
    [apiMeta,setApiMeta]=useState({updatedAt:0,round:"",remaining:null as number|null,stale:false}),
    [syncLoading,setSyncLoading]=useState(false),
    [apiChecked, setApiChecked] = useState(false),
    [liveApiGames, setLiveApiGames] = useState<LiveApiGame[]>([]),
    [liveApiInfo, setLiveApiInfo] = useState("Clique para consultar os jogos ao vivo"),
    [liveApiLoading, setLiveApiLoading] = useState(false),
    [liveAutoLoaded,setLiveAutoLoaded]=useState(false),
    [selectedLiveId,setSelectedLiveId]=useState<number|null>(null),
    [liveAiAnalysis,setLiveAiAnalysis]=useState(""),
    [liveCompetition,setLiveCompetition]=useState("ALL"),
    [liveStatusFilter,setLiveStatusFilter]=useState("ALL"),
    [liveTeamFilter,setLiveTeamFilter]=useState(""),
    [liveHistoryOnly,setLiveHistoryOnly]=useState(false),
    [live, setLive] = useState({
      minute: 0,
      hg: 0,
      ag: 0,
      hc: 0,
      ac: 0,
      shots: 0,
      sot: 0,
      yellow: 0,
      red: 0,
      attacksHome: 0,
      attacksAway: 0,
      dangerHome: 0,
      dangerAway: 0,
      shotsHome: 0,
      shotsAway: 0,
      sotHome: 0,
      sotAway: 0,
      yellowHome: 0,
      yellowAway: 0,
      redHome: 0,
      redAway: 0,
      possessionHome: 0,
      possessionAway: 0,
      pressureHome: 0,
      pressureAway: 0,
      xgHome: 0,
      xgAway: 0,
      savesHome: 0,
      savesAway: 0,
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
    const [r,rr]=await Promise.all([fetch("/api/leagues",{cache:"no-store"}),fetch("/api/referees",{cache:"no-store"})]),[d,rd]=await Promise.all([r.json(),rr.json()]);
    if(r.ok)setLeagues(d.leagues);if(rr.ok)setManualReferees(rd.referees||[]);
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
  useEffect(()=>{if(!authenticated||admin)return;const ping=()=>fetch("/api/auth/presence",{method:"POST"}).catch(()=>{});ping();const timer=setInterval(ping,45000);return()=>clearInterval(timer)},[authenticated,admin]);
  const coveredLeagues=leagues.filter(x=>x.apiSync?.status==="updated");
  const league = leagues.find((x) => x.id === leagueId),
    awayLeague = leagues.find((x) => x.id === awayLeagueId),
    teams = useMemo(
      () =>
        league
          ? [...new Set(league.games.flatMap((g) => [g.home, g.away]))].sort()
          : [],
      [league],
    ),
    awayTeams = useMemo(
      () =>
        awayLeague
          ? [
              ...new Set(awayLeague.games.flatMap((g) => [g.home, g.away])),
            ].sort()
          : [],
      [awayLeague],
    );
  useEffect(() => {
    setHome("");
  }, [leagueId]);
  useEffect(() => {
    setAway("");
  }, [awayLeagueId]);
  useEffect(()=>{setXrayTeam("")},[xrayLeagueId]);
  useEffect(()=>{if(!xrayTeam){setXrayMinuteHistory({labels:[],goals:[],corners:[],cards:[],shots:[],onTarget:[],snapshots:0});return}fetch(`/api/live/history?team=${encodeURIComponent(xrayTeam)}`,{cache:"no-store"}).then(r=>r.json()).then(d=>{if(d.available)setXrayMinuteHistory(d.history)}).catch(()=>{})},[xrayTeam]);
  const stats = (
    source: League | undefined,
    team: string,
    venue: "home" | "away",
  ) => {
    if (!source) return null;
    const g = source.games
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
      scored: avg(g.map((x) => (venue === "home" ? x.hg : x.ag))),
      conceded: avg(g.map((x) => (venue === "home" ? x.ag : x.hg))),
      xg: avg(g.map((x) => venue === "home" ? (x.hxg || 0) : (x.axg || 0))),
      possession: avg(g.map((x) => venue === "home" ? (x.hp || 0) : (x.ap || 0))),
      over25: pct(go, (x) => x >= 3),
      btts: pct(g, (x) => x.hg > 0 && x.ag > 0),
      overCorners: pct(co, (x) => x >= 9),
      overCards: pct(ca, (x) => x >= 5),
    };
  };
  const a = home ? stats(league, home, "home") : null,
    b = away ? stats(awayLeague, away, "away") : null,
    ready = !!(
      league &&
      awayLeague &&
      home &&
      away &&
      home !== away &&
      a &&
      b &&
      a.games &&
      b.games
    ),
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
              base.goals * 0.4 +
                (live.sot + live.sotHome + live.sotAway) * 5 +
                (live.shots + live.shotsHome + live.shotsAway) * 1.2 +
                (live.xgHome + live.xgAway) * 10 +
                (live.dangerHome + live.dangerAway) * 0.18,
            ),
            corners: Math.min(
              96,
              base.corners * 0.4 +
                (live.hc + live.ac) * 6 +
                (live.dangerHome + live.dangerAway) * 0.25,
            ),
            cards: Math.min(
              96,
              base.cards * 0.4 +
                (live.yellow +
                  live.yellowHome +
                  live.yellowAway +
                  (live.red + live.redHome + live.redAway) * 2) *
                  8,
            ),
          }
        : base,
    livePressureHome =
      live.dangerHome * 1.4 +
      live.sotHome * 5 +
      live.pressureHome * 0.8 +
      live.xgHome * 12,
    livePressureAway =
      live.dangerAway * 1.4 +
      live.sotAway * 5 +
      live.pressureAway * 0.8 +
      live.xgAway * 12,
    pressureLeader =
      livePressureHome > livePressureAway * 1.15
        ? "time da casa"
        : livePressureAway > livePressureHome * 1.15
          ? "time visitante"
          : "equilibrada",
    liveConfidence = Math.round(
      Math.min(
        92,
        45 +
          (a?.games || 0) +
          (b?.games || 0) +
          Math.min(
            25,
            (live.shotsHome +
              live.shotsAway +
              live.dangerHome +
              live.dangerAway) /
              8,
          ),
      ),
    );
  const standings=apiStandings[tableMode]||[],
    visibleStandings=standings.filter(x=>x.team.toLowerCase().includes(teamSearch.toLowerCase())),
    selectedStandingTeam=standings.find(x=>x.team.toLowerCase()===teamSearch.trim().toLowerCase())?.team||"",
    selectedTeamGames=selectedStandingTeam?apiGames.filter(g=>tableMode==="HOME"?g.home===selectedStandingTeam:tableMode==="AWAY"?g.away===selectedStandingTeam:g.home===selectedStandingTeam||g.away===selectedStandingTeam).slice(-5).reverse():[],
    selectedAllGames=selectedStandingTeam?apiGames.filter(g=>g.home===selectedStandingTeam||g.away===selectedStandingTeam):[],
    selectedHomeGames=selectedAllGames.filter(g=>g.home===selectedStandingTeam),selectedAwayGames=selectedAllGames.filter(g=>g.away===selectedStandingTeam),
    venueSummary=(games:Game[])=>({games:games.length,wins:games.filter(g=>resultFor(g,selectedStandingTeam)==="V").length,draws:games.filter(g=>resultFor(g,selectedStandingTeam)==="E").length,losses:games.filter(g=>resultFor(g,selectedStandingTeam)==="D").length,points:games.reduce((s,g)=>s+(resultFor(g,selectedStandingTeam)==="V"?3:resultFor(g,selectedStandingTeam)==="E"?1:0),0),scored:avg(games.map(g=>g.home===selectedStandingTeam?g.hg:g.ag)),conceded:avg(games.map(g=>g.home===selectedStandingTeam?g.ag:g.hg))}),
    homeSummary=venueSummary(selectedHomeGames),awaySummary=venueSummary(selectedAwayGames),currentSummary=venueSummary(tableMode==="HOME"?selectedHomeGames:tableMode==="AWAY"?selectedAwayGames:selectedAllGames),
    chartGames=[...selectedTeamGames].reverse(),chartMaxGoals=Math.max(1,...chartGames.map(g=>g.hg+g.ag)),
    homeVenueTable=league?buildTable(league.games,"HOME"):[], awayVenueTable=awayLeague?buildTable(awayLeague.games,"AWAY"):[],
    homeStanding=homeVenueTable.find(x=>x.team===home), awayStanding=awayVenueTable.find(x=>x.team===away),
    referees=useMemo(()=>[...new Set([...manualReferees.map(r=>r.name),...leagues.flatMap(l=>l.games.map(g=>g.referee)).filter((x):x is string=>!!x)])].sort(),[leagues,manualReferees]),
    refName=selectedReferee||referees[0]||"Média geral da arbitragem da liga",
    manualReferee=manualReferees.find(r=>r.name===refName),
    refereeGames=manualReferee?[]:referees.length?leagues.flatMap(l=>l.games).filter(g=>g.referee===refName):(league?.games||[]),
    leagueCards=league?avg(league.games.map(g=>g.hy+g.ay+g.hr+g.ar)):0,
    refereeStats=manualReferee?{games:manualReferee.games,yellow:manualReferee.yellowPerGame,red:manualReferee.redPerGame,cards:manualReferee.yellowPerGame+manualReferee.redPerGame,fouls:manualReferee.foulsPerGame,homeYellow:manualReferee.homeYellow,awayYellow:manualReferee.awayYellow,homeCards:manualReferee.homeYellow,awayCards:manualReferee.awayYellow,over35:manualReferee.over35,over45:manualReferee.over45,over55:manualReferee.over55,recent:[] as number[]}:refereeGames.length?{
      games:refereeGames.length,
      yellow:avg(refereeGames.map(g=>g.hy+g.ay)),
      red:avg(refereeGames.map(g=>g.hr+g.ar)),
      cards:avg(refereeGames.map(g=>g.hy+g.ay+g.hr+g.ar)),
      fouls:avg(refereeGames.map(g=>(g.hf||0)+(g.af||0))),
      homeYellow:avg(refereeGames.map(g=>g.hy)),
      awayYellow:avg(refereeGames.map(g=>g.ay)),
      homeCards:avg(refereeGames.map(g=>g.hy+g.hr)),
      awayCards:avg(refereeGames.map(g=>g.ay+g.ar)),
      over35:pct(refereeGames,g=>g.hy+g.ay+g.hr+g.ar>=4),
      over45:pct(refereeGames,g=>g.hy+g.ay+g.hr+g.ar>=5),
      over55:pct(refereeGames,g=>g.hy+g.ay+g.hr+g.ar>=6),
      recent:refereeGames.slice(-5).map(g=>g.hy+g.ay+g.hr+g.ar),
    }:null,
    homeDiscipline=league&&home?league.games.filter(g=>g.home===home).slice(-12):[],
    awayDiscipline=awayLeague&&away?awayLeague.games.filter(g=>g.away===away).slice(-12):[],
    expectedHomeCards=avg(homeDiscipline.map(g=>g.hy+g.hr)),
    expectedAwayCards=avg(awayDiscipline.map(g=>g.ay+g.ar)),
    teamExpectedCards=expectedHomeCards+expectedAwayCards,
    projectedCards=refereeStats?teamExpectedCards*.55+refereeStats.cards*.45:teamExpectedCards,
    disciplineConfidence=Math.min(92,Math.round(40+Math.min(24,homeDiscipline.length+awayDiscipline.length)+(referees.length&&refereeStats?18:0))),
    projectedOver35=refereeStats?refereeStats.over35*.55+pct([...homeDiscipline,...awayDiscipline],g=>g.hy+g.ay+g.hr+g.ar>=4)*.45:pct([...homeDiscipline,...awayDiscipline],g=>g.hy+g.ay+g.hr+g.ar>=4),
    projectedOver45=refereeStats?refereeStats.over45*.55+pct([...homeDiscipline,...awayDiscipline],g=>g.hy+g.ay+g.hr+g.ar>=5)*.45:pct([...homeDiscipline,...awayDiscipline],g=>g.hy+g.ay+g.hr+g.ar>=5),
    projectedOver55=refereeStats?refereeStats.over55*.55+pct([...homeDiscipline,...awayDiscipline],g=>g.hy+g.ay+g.hr+g.ar>=6)*.45:pct([...homeDiscipline,...awayDiscipline],g=>g.hy+g.ay+g.hr+g.ar>=6),
    redRisk=refereeStats?Math.min(80,refereeStats.red*100):pct([...homeDiscipline,...awayDiscipline],g=>g.hr+g.ar>0),
    h2h=league&&league.id===awayLeague?.id?league.games.filter(g=>(g.home===home&&g.away===away)||(g.home===away&&g.away===home)).slice(-5):[],
    homeChartGames=league&&home?league.games.filter(g=>g.home===home).slice(-8):[],
    awayChartGames=awayLeague&&away?awayLeague.games.filter(g=>g.away===away).slice(-8):[],
    chartMetricValue=(g:Game,venue:"home"|"away",metric:PreChartMetric)=>metric==="goals"?(venue==="home"?g.hg:g.ag):metric==="conceded"?(venue==="home"?g.ag:g.hg):metric==="corners"?(venue==="home"?g.hc:g.ac):metric==="cards"?(venue==="home"?g.hy+g.hr:g.ay+g.ar):metric==="shots"?(venue==="home"?g.hs:g.as):(venue==="home"?g.hst:g.ast),
    homeChartValues=homeChartGames.map(g=>chartMetricValue(g,"home",preChartMetric)),
    awayChartValues=awayChartGames.map(g=>chartMetricValue(g,"away",preChartMetric)),
    preChartCount=Math.max(homeChartValues.length,awayChartValues.length),
    chartReference=Array.from({length:preChartCount},(_,i)=>avg([homeChartValues[i],awayChartValues[i]].filter((v):v is number=>Number.isFinite(v)))),
    xrayLeague=leagues.find(l=>l.id===xrayLeagueId),
    xrayTeams=xrayLeague?[...new Set(xrayLeague.games.flatMap(g=>[g.home,g.away]))].sort():[],
    xrayGames=xrayLeague&&xrayTeam?xrayLeague.games.filter(g=>g.home===xrayTeam||g.away===xrayTeam).slice(-10):[],
    xrayGoals=xrayGames.map(g=>g.home===xrayTeam?g.hg:g.ag),
    xrayCorners=xrayGames.map(g=>g.home===xrayTeam?g.hc:g.ac),
    periodLabels=["0–15","16–30","31–45+","46–60","61–75","76–90+"],
    periodIndex=(minute:number)=>minute<=15?0:minute<=30?1:minute<=45?2:minute<=60?3:minute<=75?4:5,
    xrayGoalPeriods=xrayGames.reduce((values,g)=>{const minutes=g.home===xrayTeam?g.homeGoalMinutes:g.awayGoalMinutes;(minutes||[]).forEach(m=>values[periodIndex(m)]++);return values},[0,0,0,0,0,0]),
    xrayCornerPeriods=xrayGames.reduce((values,g)=>{const minutes=g.home===xrayTeam?g.homeCornerMinutes:g.awayCornerMinutes;(minutes||[]).forEach(m=>values[periodIndex(m)]++);return values},[0,0,0,0,0,0]),
    xrayHasGoalMinutes=xrayGames.some(g=>(g.home===xrayTeam?g.homeGoalMinutes:g.awayGoalMinutes)?.length),
    xrayHasCornerMinutes=xrayGames.some(g=>(g.home===xrayTeam?g.homeCornerMinutes:g.awayCornerMinutes)?.length),
    selectedLiveGame=liveApiGames.find(g=>g.id===selectedLiveId),
    liveCompetitions=[...new Set(liveApiGames.map(g=>g.league))].sort(),
    visibleLiveGames=liveApiGames.filter(g=>{
      const statusLive=["1H","2H","HT","ET","BT","P","LIVE"].includes(g.status),statusFinished=["FT","AET","PEN"].includes(g.status),statusOk=liveStatusFilter==="ALL"||(liveStatusFilter==="LIVE"&&statusLive)||(liveStatusFilter==="SCHEDULED"&&g.status==="NS")||(liveStatusFilter==="FINISHED"&&statusFinished),team=`${g.home} ${g.away}`.toLowerCase();
      return (liveCompetition==="ALL"||g.league===liveCompetition)&&statusOk&&team.includes(liveTeamFilter.toLowerCase())&&(!liveHistoryOnly||!!g.registeredLeagueId);
    });
  const checkFreeApi=async(force=false)=>{
    if(!league)return;
    setApiInfo("Consultando API gratuita...");
    const r=await fetch(`/api/standings?leagueId=${encodeURIComponent(league.id)}${force?"&refresh=1":""}`,{cache:"no-store"}),d=await r.json();
    if(d.available){setApiStandings(d.tables||{});setApiGames(d.games||[]);setApiMeta({updatedAt:d.updatedAt||0,round:d.currentRound||"",remaining:d.remaining??null,stale:!!d.stale});setApiInfo(`${d.league?.name||league.name} • temporada ${d.league?.season}${d.currentRound?` • ${d.currentRound}`:""} • ${d.stale?"última atualização válida":"atualizada"} em ${new Date(d.updatedAt).toLocaleString("pt-BR")}${d.remaining!=null?` • cota restante: ${d.remaining}`:""}${d.warning?` • ${d.warning}`:""}`)}else{setApiStandings({});setApiGames([]);setApiMeta({updatedAt:0,round:"",remaining:null,stale:false});setApiInfo(d.reason||"Sem cobertura confirmada para a temporada atual.")}setApiChecked(true)
  };
  const clearPreAnalysis=()=>{setHome("");setAway("");setAnalyzed(false);setNotice("")};
  const clearStandingTeam=()=>setTeamSearch("");
  const clearAi=()=>{setAsk("");setChat([{role:"assistant",content:"Selecione uma partida e pergunte sobre gols, escanteios, cartões, finalizações ou tendências estatísticas."}])};
  const syncAll=async()=>{setSyncLoading(true);setNotice("Atualizando as competições com cobertura...");try{const r=await fetch("/api/admin/sync",{method:"POST"}),d=await r.json();setNotice(r.ok?`✓ ${d.updated} competições atualizadas; ${d.failed} sem cobertura ou com erro.`:d.error||"Falha na atualização.");await load();if(leagueId)await checkFreeApi()}finally{setSyncLoading(false)}};
  const clearLiveAnalysis=()=>{setSelectedLiveId(null);setLiveAiAnalysis("");setAnalyzed(false);setLive({minute:0,hg:0,ag:0,hc:0,ac:0,shots:0,sot:0,yellow:0,red:0,attacksHome:0,attacksAway:0,dangerHome:0,dangerAway:0,shotsHome:0,shotsAway:0,sotHome:0,sotAway:0,yellowHome:0,yellowAway:0,redHome:0,redAway:0,possessionHome:0,possessionAway:0,pressureHome:0,pressureAway:0,xgHome:0,xgAway:0,savesHome:0,savesAway:0})};
  const fetchLiveGames=async()=>{clearLiveAnalysis();setLiveApiLoading(true);setLiveApiInfo("Consultando jogos de hoje e partidas ao vivo...");try{const r=await fetch(`/api/live?refresh=${Date.now()}`,{cache:"no-store"}),d=await r.json();if(d.available){setLiveApiGames(d.games||[]);setLiveApiInfo(d.games?.length?`${d.games.length} partidas encontradas em ${d.source||"consulta atual"} • cota restante: ${d.remaining||"—"}`:(d.reason||"Nenhum jogo foi encontrado nas ligas cadastradas."))}else setLiveApiInfo(`API: ${d.reason||"indisponível"}${d.remaining?` • cota restante: ${d.remaining}`:""}`)}catch{setLiveApiInfo("Falha ao consultar a API. Atualize a página e tente novamente.")}finally{setLiveApiLoading(false)}};
  const loadLiveStats=async(g:LiveApiGame)=>{setLiveApiLoading(true);try{const r=await fetch(`/api/live?id=${g.id}`,{cache:"no-store"}),d=await r.json(),teams=d.statistics||[];const values=(index:number)=>Object.fromEntries((teams[index]?.statistics||[]).map((x:{type:string;value:string|number|null})=>[x.type,x.value]));const h=values(0),a=values(1),val=(o:Record<string,unknown>,k:string)=>n(String(o[k]??0).replace("%",""));setLive(x=>({...x,minute:g.minute||x.minute,hg:g.hg,ag:g.ag,hc:val(h,"Corner Kicks"),ac:val(a,"Corner Kicks"),shotsHome:val(h,"Total Shots"),shotsAway:val(a,"Total Shots"),sotHome:val(h,"Shots on Goal"),sotAway:val(a,"Shots on Goal"),yellowHome:val(h,"Yellow Cards"),yellowAway:val(a,"Yellow Cards"),redHome:val(h,"Red Cards"),redAway:val(a,"Red Cards"),possessionHome:val(h,"Ball Possession"),possessionAway:val(a,"Ball Possession"),savesHome:val(h,"Goalkeeper Saves"),savesAway:val(a,"Goalkeeper Saves")}));setAnalyzed(false);setLiveApiInfo(`${g.home} × ${g.away}: dados carregados. Você ainda pode editar manualmente.`)}finally{setLiveApiLoading(false)}};
  const saveLiveSnapshot=async()=>{if(!selectedLiveGame)return;const minute=live.minute||selectedLiveGame.minute;if(!minute)return;await fetch("/api/live/history",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fixtureId:selectedLiveGame.id,provider:selectedLiveGame.provider,leagueId:selectedLiveGame.registeredLeagueId,home:selectedLiveGame.home,away:selectedLiveGame.away,minute,stats:{hg:live.hg||selectedLiveGame.hg,ag:live.ag||selectedLiveGame.ag,hc:live.hc,ac:live.ac,shotsHome:live.shotsHome,shotsAway:live.shotsAway,sotHome:live.sotHome,sotAway:live.sotAway,yellowHome:live.yellowHome,yellowAway:live.yellowAway,redHome:live.redHome,redAway:live.redAway}})}).catch(()=>{})};
  useEffect(()=>{if(!selectedLiveGame)return;saveLiveSnapshot();const timer=setInterval(saveLiveSnapshot,5*60*1000);return()=>clearInterval(timer)},[selectedLiveId,live.minute,live.hg,live.ag,live.hc,live.ac,live.shotsHome,live.shotsAway,live.sotHome,live.sotAway,live.yellowHome,live.yellowAway,live.redHome,live.redAway]);
  const analyzeLiveGame=async(g:LiveApiGame)=>{const src=leagues.find(l=>l.id===g.registeredLeagueId),norm=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,""),findTeam=(name:string)=>src?[...new Set(src.games.flatMap(x=>[x.home,x.away]))].find(t=>norm(t).includes(norm(name))||norm(name).includes(norm(t))):undefined,homeName=findTeam(g.home),awayName=findTeam(g.away),recent=(team?:string)=>team&&src?src.games.filter(x=>x.home===team||x.away===team).slice(-5):[],hr=recent(homeName),ar=recent(awayName),teamGoals=(games:Game[],team?:string)=>avg(games.map(x=>x.home===team?x.hg:x.ag)),teamConceded=(games:Game[],team?:string)=>avg(games.map(x=>x.home===team?x.ag:x.hg)),historyText=hr.length||ar.length?`Histórico CSV: ${homeName||g.home} marcou média ${teamGoals(hr,homeName).toFixed(2)} e sofreu ${teamConceded(hr,homeName).toFixed(2)} nos últimos ${hr.length} jogos; ${awayName||g.away} marcou ${teamGoals(ar,awayName).toFixed(2)} e sofreu ${teamConceded(ar,awayName).toFixed(2)} nos últimos ${ar.length}.`:`Não existe histórico CSV compatível para este confronto.`,localAnalysis=`ANÁLISE ESTATÍSTICA DISPONÍVEL\n${g.home} ${g.hg} × ${g.ag} ${g.away}\nSituação informada: ${g.statusLong}${g.minute?` aos ${g.minute} minutos`:""}.\n${historyText}\nLeitura: ${g.hg===g.ag?"o placar está equilibrado":g.hg>g.ag?`${g.home} aparece em vantagem`:`${g.away} aparece em vantagem`}. Sem chutes, escanteios ou cartões confirmados, não é seguro indicar pressão nem projetar esses mercados.`;setSelectedLiveId(g.id);setLiveAiAnalysis(localAnalysis);setLiveApiLoading(true);try{const statsResponse=await fetch(`/api/live?id=${g.id}&provider=${g.provider}`,{cache:"no-store"}),statsData=await statsResponse.json(),teams=statsData.statistics||[],values=(index:number)=>Object.fromEntries((teams[index]?.statistics||[]).map((x:{type:string;value:string|number|null})=>[x.type,x.value])),h=values(0),aStats=values(1),val=(o:Record<string,unknown>,k:string)=>n(String(o[k]??0).replace("%","")),snapshot={minute:g.minute||0,hg:g.hg,ag:g.ag,hc:val(h,"Corner Kicks"),ac:val(aStats,"Corner Kicks"),shotsHome:val(h,"Total Shots"),shotsAway:val(aStats,"Total Shots"),sotHome:val(h,"Shots on Goal"),sotAway:val(aStats,"Shots on Goal"),yellowHome:val(h,"Yellow Cards"),yellowAway:val(aStats,"Yellow Cards"),redHome:val(h,"Red Cards"),redAway:val(aStats,"Red Cards"),possessionHome:val(h,"Ball Possession"),possessionAway:val(aStats,"Ball Possession"),savesHome:val(h,"Goalkeeper Saves"),savesAway:val(aStats,"Goalkeeper Saves")};setLive(x=>({...x,...snapshot,shots:snapshot.shotsHome+snapshot.shotsAway,sot:snapshot.sotHome+snapshot.sotAway,yellow:snapshot.yellowHome+snapshot.yellowAway,red:snapshot.redHome+snapshot.redAway}));if(g.registeredLeagueId){setLeagueId(g.registeredLeagueId);setAwayLeagueId(g.registeredLeagueId)}setHome(homeName||g.home);setAway(awayName||g.away);setLiveApiInfo(`${g.home} × ${g.away}: ${statsData.limited?"placar e histórico carregados; detalhes ao vivo não existem no plano gratuito.":"estatísticas carregadas."}`);const aiResponse=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:"Faça uma análise objetiva usando somente os dados fornecidos e o histórico. Não invente estatísticas ausentes. Mostre cenário, tendência de gols e limitações.",history:[],context:{mode:"live",provider:g.provider,league:g.league,country:g.country,home:g.home,away:g.away,status:g.statusLong,history:{home:hr,away:ar},dataLimitation:statsData.limited?statsData.reason:null,live:snapshot}})}),aiData=await aiResponse.json();if(aiResponse.ok&&aiData.answer)setLiveAiAnalysis(`${localAnalysis}\n\nANÁLISE COMPLEMENTAR DA IA\n${aiData.answer}`);else setLiveAiAnalysis(`${localAnalysis}\n\nA IA externa está indisponível agora; a análise estatística local acima continua válida.`)}catch{setLiveAiAnalysis(`${localAnalysis}\n\nNão foi possível consultar a IA externa; a análise estatística local acima continua disponível.`)}finally{setLiveApiLoading(false)}};
  useEffect(()=>{if(tab==="live"&&authenticated&&leagues.length&&!liveAutoLoaded){setLiveAutoLoaded(true);fetchLiveGames()}},[tab,authenticated,leagues.length,liveAutoLoaded]);
  const savePrivateHistory=async(mode:"pre"|"live")=>{if(admin||!ready)return;await fetch("/api/user/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"history",mode,leagueId,home,away,snapshot:{homeStats:a,awayStats:b,probabilities:prob,live:mode==="live"?live:null}})});setNotice("Análise salva somente no seu histórico privado.")};
  useEffect(()=>{setApiStandings({});setApiGames([]);setTeamSearch("");setApiChecked(false);setApiInfo("Consultando a temporada atual na API...");if(leagueId)checkFreeApi()},[leagueId]);
  useEffect(()=>{if(!authenticated||!leagueId)return;const timer=setInterval(checkFreeApi,15*60*1000);return()=>clearInterval(timer)},[authenticated,leagueId]);
  const doLogin = async () => {
    const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({...credentials,remember:rememberLogin}),
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
    r.onload = () => {
      const text = String(r.result || "");
      setCsv(text);
      try {
        const p = parse(text);
        setLeagueMeta((m) => ({
          country: p.meta.country || m.country,
          name: p.meta.name || m.name,
          season: p.meta.season || m.season,
          code:
            m.code ||
            `${p.meta.country}-${p.meta.name}`
              .replace(/[^a-z0-9]+/gi, "-")
              .toUpperCase(),
        }));
        setNotice(
          `${p.games.length} partidas reconhecidas. Confira o nome da liga.`,
        );
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "CSV inválido.");
      }
    };
    r.readAsText(f);
  };
  const save = async () => {
    try {
      const parsed = parse(csv);
      if (!leagueMeta.country || !leagueMeta.name || !leagueMeta.season)
        throw Error("Informe país, nome da liga e temporada.");
      if (importMode === "update" && !updateTarget)
        throw Error("Escolha a liga que será atualizada.");
      if (
        importMode === "update" &&
        !confirm("Substituir somente o CSV da liga escolhida?")
      )
        return;
      const r = await fetch("/api/admin/leagues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: importMode,
            targetId: updateTarget,
            ...leagueMeta,
            fileName,
            games: parsed.games,
            quality: parsed.quality,
          }),
        }),
        d = await r.json();
      if (r.status === 401) {
        setAdmin(false);
        setLogin(true);
        throw Error("Sua sessão expirou.");
      }
      if (!r.ok) throw Error(d.error);
      setNotice(
        importMode === "create"
          ? `✓ ${leagueMeta.name} cadastrada sem substituir outras ligas.`
          : `✓ ${leagueMeta.name} atualizada.`,
      );
      setCsv("");
      setFileName("");
      setLeagueMeta({ country: "", name: "", season: "", code: "" });
      setUpdateTarget("");
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao importar CSV.");
    }
  };
  const editLeague = async () => {
    if (!editingLeague) return;
    const r = await fetch("/api/admin/leagues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingLeague),
      }),
      d = await r.json();
    if (!r.ok) return setNotice(d.error);
    setEditingLeague(null);
    setNotice("Liga editada sem perder os jogos.");
    await load();
  };
  const searchApiLeagues=async()=>{if(apiLeagueQuery.trim().length<2)return;setApiLeagueLoading(true);const r=await fetch(`/api/admin/api-leagues?q=${encodeURIComponent(apiLeagueQuery.trim())}`,{cache:"no-store"}),d=await r.json();setApiLeagueOptions(r.ok?d.leagues||[]:[]);if(!r.ok)setNotice(d.error||"Não foi possível buscar ligas na API.");setApiLeagueLoading(false)};
  const del = async (id: string) => {
    if (!confirm("Excluir esta liga do banco?")) return;
    const r = await fetch(`/api/admin/leagues?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (r.ok) await load();
    else setNotice("Não foi possível excluir.");
  };
  const saveReferee=async()=>{const r=await fetch("/api/admin/referees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(refereeForm)}),d=await r.json();if(!r.ok)return setNotice(d.error||"Não foi possível salvar o árbitro.");setRefereeForm({...emptyReferee});setNotice("Árbitro salvo e liberado no seletor de análises.");await load()};
  const editReferee=(r:ManualReferee)=>{setRefereeForm({id:r.id,name:r.name,country:r.country,leagueId:r.leagueId,games:r.games,foulsPerGame:r.foulsPerGame,yellowPerGame:r.yellowPerGame,redPerGame:r.redPerGame,homeYellow:r.homeYellow,awayYellow:r.awayYellow,over35:r.over35,over45:r.over45,over55:r.over55});document.getElementById("referee-admin")?.scrollIntoView({behavior:"smooth"})};
  const deleteReferee=async(id:string)=>{if(!confirm("Excluir este árbitro do cadastro manual?"))return;const r=await fetch(`/api/admin/referees?id=${encodeURIComponent(id)}`,{method:"DELETE"});if(r.ok){if(refereeForm.id===id)setRefereeForm({...emptyReferee});await load()}else setNotice("Não foi possível excluir o árbitro.")};
  const askAI = async (q = ask) => {
    q = q.trim();
    if (!q || loading) return;
    setChat((x) => [...x, { role: "user", content: q }]);
    setAsk("");
    setLoading(true);
    try {
      const context = ready
          ? {
              homeLeague: league?.name,
              awayLeague: awayLeague?.name,
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
            ALVES.<b>AnalisesV11</b>
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
            ALVES.<b>AnalisesV11</b>
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
              <label className="remember-login"><input type="checkbox" checked={rememberLogin} onChange={e=>setRememberLogin(e.target.checked)}/><span><b>Manter conectado neste dispositivo</b><small>Não será necessário informar o login novamente por até 30 dias.</small></span></label>
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
              ALVES.<b>AnalisesV11</b>
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
            on={tab === "standings"}
            icon="🏆"
            title="Classificações"
            click={() => publicTab("standings")}
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
                      : tab === "standings"
                        ? "CAMPEONATOS E TEMPORADAS"
                      : tab === "live"
                        ? "ANÁLISE AO VIVO"
                        : "INTELIGÊNCIA ESTATÍSTICA"}
                  </span>
                  <h2>
                    {tab === "standings"
                      ? "Classificações"
                      : tab === "ai"
                      ? "Análise de jogos por IA"
                      : "Central de análises"}
                  </h2>
                  <p>
                    {tab === "standings"
                      ? "Selecione uma competição para acompanhar sua tabela oficial atualizada."
                      : tab === "ai"
                      ? "Faça perguntas somente sobre os números da partida."
                      : tab==="live"?"Escolha um jogo do dia para receber a análise automática.":"Selecione a competição e as equipes para calcular tendências."}
                  </p>
                </div>
              </div>
              {(tab==="pre"||tab==="ai")&&<section className="panel">
                <div className="panel-head">
                  <i className="green">⌄</i>
                  <div>
                    <h3>Selecione a partida</h3>
                    <p>As setas abrem a lista de ligas e times</p>
                  </div>
                  {(home||away)&&<button className="clear-context" onClick={clearPreAnalysis}>× Limpar seleção</button>}
                </div>
                <div className="cross-grid">
                  <Select
                    label="Liga da casa"
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
                    label="Liga do visitante"
                    value={awayLeagueId}
                    set={setAwayLeagueId}
                    placeholder="Selecionar liga visitante..."
                    options={leagues.map((l) => [
                      l.id,
                      `${l.country} — ${l.name} (${l.season})`,
                    ])}
                  />
                  <Select
                    label="Fora"
                    value={away}
                    set={setAway}
                    placeholder="Selecionar time visitante..."
                    options={awayTeams.map((t) => [t, t])}
                    disabled={!awayLeague}
                  />
                </div>
              </section>}
              {tab==="pre"&&<section className="panel team-focus-panel">
                <div className="panel-head"><i className="blue">⌁</i><div><h3>Raio-X de um time específico</h3><p>Selecione uma equipe para visualizar sua produção nos últimos jogos e por períodos da partida</p></div>{xrayTeam&&<button className="clear-context" onClick={()=>setXrayTeam("")}>× Limpar time</button>}</div>
                <div className="team-focus-selectors"><Select label="Competição" value={xrayLeagueId} set={setXrayLeagueId} placeholder="Selecionar liga..." options={leagues.map(l=>[l.id,`${l.country} — ${l.name} (${l.season})`])}/><Select label="Time para o Raio-X" value={xrayTeam} set={setXrayTeam} placeholder="Selecionar time..." options={xrayTeams.map(t=>[t,t])} disabled={!xrayLeague}/></div>
                {!xrayTeam?<div className="team-focus-empty"><span>⚽</span><b>Escolha uma liga e um time</b><small>Os gráficos serão montados automaticamente somente com os dados reais disponíveis.</small></div>:<div className="team-focus-content">
                  <header><div><small>TIME SELECIONADO</small><h3>{xrayTeam}</h3><p>{xrayLeague?.name} • {xrayGames.length} jogos recentes encontrados</p></div><div className="focus-kpis"><span><i>⚽</i><b>{avg(xrayGoals).toFixed(2)}</b><small>gols/jogo</small></span><span><i>🚩</i><b>{avg(xrayCorners).toFixed(2)}</b><small>cantos/jogo</small></span></div></header>
                  <div className="team-focus-charts">
                    <article><div className="focus-chart-title"><span>📈</span><div><h4>Evolução nos últimos jogos</h4><p>Produção do time, do jogo mais antigo ao mais recente</p></div></div><TrendLineChart labels={xrayGames.map((_,i)=>`J${i+1}`)} series={[{name:"Gols",color:"#36df91",values:xrayGoals,icon:"⚽"},{name:"Escanteios",color:"#f0c75e",values:xrayCorners,icon:"🚩"}]}/><div className="focus-chart-legend"><span><i style={{background:"#36df91"}}/>⚽ Gols</span><span><i style={{background:"#f0c75e"}}/>🚩 Escanteios</span></div></article>
                    <article><div className="focus-chart-title"><span>⏱</span><div><h4>Momentos de maior ocorrência</h4><p>{xrayMinuteHistory.snapshots>=2?`${xrayMinuteHistory.snapshots} fotografias reais • intervalos de 5 minutos`:"Histórico por períodos da partida"}</p></div></div>{xrayMinuteHistory.snapshots>=2?<><TrendLineChart labels={xrayMinuteHistory.labels} series={[{name:"Gols",color:"#36df91",values:xrayMinuteHistory.goals,icon:"⚽"},{name:"Escanteios",color:"#f0c75e",values:xrayMinuteHistory.corners,icon:"🚩"},{name:"Cartões",color:"#ff7188",values:xrayMinuteHistory.cards,icon:"🟨"},{name:"Chutes",color:"#a77cff",values:xrayMinuteHistory.shots,icon:"➤"},{name:"No gol",color:"#4a8fff",values:xrayMinuteHistory.onTarget,icon:"🎯"}]}/><div className="focus-chart-legend"><span>⚽ Gols</span><span>🚩 Escanteios</span><span>🟨 Cartões</span><span>➤ Chutes</span><span>🎯 No gol</span></div></>:xrayHasGoalMinutes||xrayHasCornerMinutes?<><TrendLineChart labels={periodLabels} series={[...(xrayHasGoalMinutes?[{name:"Gols",color:"#36df91",values:xrayGoalPeriods,icon:"⚽"}]:[]),...(xrayHasCornerMinutes?[{name:"Escanteios",color:"#f0c75e",values:xrayCornerPeriods,icon:"🚩"}]:[])]}/><div className="focus-chart-legend"><span>⚽ Gols</span><span>🚩 Escanteios</span></div></>:<div className="timeline-unavailable"><span>⏱</span><b>Histórico por minutos em formação</b><p>O sistema agora registra fotografias reais a cada 5 minutos das partidas acompanhadas ao vivo. Este gráfico aparecerá quando houver pelo menos duas coletas com estatísticas confirmadas; nenhum valor é estimado ou inventado.</p></div>}</article>
                  </div>
                  <footer>Fonte: histórico cadastrado da competição • gols e escanteios são mostrados somente quando existem nas colunas do arquivo.</footer>
                </div>}
              </section>}
            </>
          )}
          {tab === "standings" && (
            <>
              <section className="panel league-library">
                <div className="standings-library-head"><div><h3>🏆 Competições com classificação confirmada</h3><p>Somente ligas da temporada vigente e atualizadas com sucesso aparecem aqui.</p></div><input value={leagueSearch} onChange={e=>setLeagueSearch(e.target.value)} placeholder="Buscar liga ou país..."/></div>
                <div className="league-cards">{coveredLeagues.filter(l=>`${l.name} ${l.country} ${l.season}`.toLowerCase().includes(leagueSearch.toLowerCase())).map(l=><button key={l.id} className={leagueId===l.id?"selected":""} onClick={()=>{setLeagueId(l.id);setTableMode("TOTAL");setTeamSearch("")}}><i>🏆</i><span><b>{l.name}</b><small>{l.country} • temporada {l.season}</small></span><em className="api-ok">● Atualizada pela API</em></button>)}</div>
                {!coveredLeagues.length&&<p className="nodata">Ainda não existe uma competição com classificação confirmada. O administrador pode executar a atualização automática.</p>}
              </section>
              {league&&league.apiSync?.status==="updated"&&<section className="panel standings-panel standings-full-page">
                <div className="standings-head"><div><h3>🏆 {league.name}</h3><p>{league.country} • temporada cadastrada {league.season}<br/>{apiInfo}</p></div><div className="standings-tools"><input list="standing-teams" value={teamSearch} onChange={e=>setTeamSearch(e.target.value)} placeholder="Buscar e selecionar time..."/><datalist id="standing-teams">{standings.map(x=><option key={x.team} value={x.team}/>)}</datalist>{teamSearch&&<button onClick={clearStandingTeam}>× Limpar</button>}<button disabled={!league||apiInfo.includes("Consultando")} onClick={()=>checkFreeApi(true)}>↻ Atualizar classificação</button></div></div>
                <div className="standing-tabs">{(["TOTAL","HOME","AWAY"] as TableMode[]).map(m=><button key={m} className={tableMode===m?"selected":""} onClick={()=>setTableMode(m)}>{m==="TOTAL"?"GERAL":m==="HOME"?"MANDANTE":"VISITANTE"}</button>)}</div>
                <div className="standing-table"><div className="standing-row standing-th"><span>#</span><span>CLUBE</span><span>PTS</span><span>PJ</span><span>VIT</span><span>E</span><span>DER</span><span>GM</span><span>GC</span><span>SG</span><span>ÚLTIMAS 5</span></div>{visibleStandings.map(r=><button className="standing-row standing-team-button" key={r.team} onClick={()=>setTeamSearch(r.team)}><span className="position">{standings.findIndex(x=>x.team===r.team)+1}</span><b>{r.team}</b><strong>{r.p}</strong><span>{r.j}</span><span>{r.v}</span><span>{r.e}</span><span>{r.d}</span><span>{r.gp}</span><span>{r.gc}</span><span className={r.sg>=0?"positive":"negative"}>{r.sg>0?"+":""}{r.sg}</span><Form values={r.form}/></button>)}{!visibleStandings.length&&<div className="api-standing-empty">{apiChecked?(apiInfo||"Esta competição não possui classificação disponível na API para a temporada cadastrada."):"Selecione uma competição para consultar a classificação."}</div>}</div>
                {selectedStandingTeam&&<section className="team-xray"><header><div><small>RAIO-X DA EQUIPE</small><h3>{selectedStandingTeam} • {tableMode==="TOTAL"?"Geral":tableMode==="HOME"?"Mandante":"Visitante"}</h3></div><div><a href={`/api/team-csv?leagueId=${encodeURIComponent(league.id)}&team=${encodeURIComponent(selectedStandingTeam)}&mode=${tableMode}`}>⇩ Baixar CSV atualizado</a><button onClick={clearStandingTeam}>× Limpar</button></div></header><div className="xray-summary"><article><small>Jogos analisados</small><b>{currentSummary.games}</b></article><article><small>Aproveitamento</small><b>{currentSummary.games?((currentSummary.points/(currentSummary.games*3))*100).toFixed(0):0}%</b></article><article><small>Vitórias / empates / derrotas</small><b>{currentSummary.wins} / {currentSummary.draws} / {currentSummary.losses}</b></article><article><small>Gols marcados</small><b>{currentSummary.scored.toFixed(2)}/jogo</b></article><article><small>Gols sofridos</small><b>{currentSummary.conceded.toFixed(2)}/jogo</b></article><article><small>Melhor condição</small><b>{!homeSummary.games||!awaySummary.games?"Amostra insuficiente":homeSummary.points/homeSummary.games>awaySummary.points/awaySummary.games?"Mandante":awaySummary.points/awaySummary.games>homeSummary.points/awaySummary.games?"Visitante":"Equilibrado"}</b></article></div><div className="venue-compare"><article><b>MANDANTE</b><span>{homeSummary.games} jogos • {homeSummary.games?((homeSummary.points/(homeSummary.games*3))*100).toFixed(0):0}% aproveitamento</span><i style={{width:`${homeSummary.games?homeSummary.points/(homeSummary.games*3)*100:0}%`}}/></article><article><b>VISITANTE</b><span>{awaySummary.games} jogos • {awaySummary.games?((awaySummary.points/(awaySummary.games*3))*100).toFixed(0):0}% aproveitamento</span><i style={{width:`${awaySummary.games?awaySummary.points/(awaySummary.games*3)*100:0}%`}}/></article></div><div className="xray-charts"><article><h4>Evolução recente</h4><div className="form-chart">{chartGames.map((g,i)=>{const result=resultFor(g,selectedStandingTeam),points=result==="V"?3:result==="E"?1:0;return <span key={`${g.date}-${i}`} title={`${g.home} ${g.hg} x ${g.ag} ${g.away}`}><i className={`bar-${result.toLowerCase()}`} style={{height:`${20+points*20}%`}}/><small>J{i+1}</small></span>})}</div><footer>Altura: pontos conquistados • verde vitória • amarelo empate • vermelho derrota</footer></article><article><h4>Gols marcados × sofridos</h4><div className="goals-chart">{chartGames.map((g,i)=>{const scored=g.home===selectedStandingTeam?g.hg:g.ag,conceded=g.home===selectedStandingTeam?g.ag:g.hg;return <span key={`${g.date}-${i}`}><i className="scored" style={{height:`${Math.max(4,scored/chartMaxGoals*100)}%`}} title={`${scored} marcado(s)`}/><i className="conceded" style={{height:`${Math.max(4,conceded/chartMaxGoals*100)}%`}} title={`${conceded} sofrido(s)`}/><small>J{i+1}</small></span>})}</div><footer><b>Verde</b> marcados • <em>Vermelho</em> sofridos</footer></article></div><div className="recent-team-games"><h4>Últimos jogos — {tableMode==="TOTAL"?"geral":tableMode==="HOME"?"como mandante":"como visitante"}</h4>{selectedTeamGames.length?selectedTeamGames.map((g,i)=><article key={`${g.date}-${g.home}-${i}`}><time>{g.date?new Date(g.date).toLocaleDateString("pt-BR"):"—"}</time><span>{g.home} <b>{g.hg} × {g.ag}</b> {g.away}</span><em className={`result-${resultFor(g,selectedStandingTeam).toLowerCase()}`}>{resultFor(g,selectedStandingTeam)}</em><small>{g.round||"Rodada não informada"}</small></article>):<p>Não existem partidas encerradas disponíveis nesta condição.</p>}</div><footer>Fonte: Football-Data.org + CSV associado • {currentSummary.games<5?"Amostra baixa":currentSummary.games<10?"Amostra média":"Amostra alta"} • atualizado em {apiMeta.updatedAt?new Date(apiMeta.updatedAt).toLocaleString("pt-BR"):"—"}</footer></section>}
              </section>}
            </>
          )}
          {tab === "pre" && league && (!apiChecked || standings.length>0) && (
            <section className="panel standings-panel">
              <div className="standings-head">
                <div><h3>🏆 Classificação</h3><p>{apiInfo}</p></div>
                <div className="standings-tools">
                  <input value={teamSearch} onChange={e=>setTeamSearch(e.target.value)} placeholder="Buscar time..." />
                  {teamSearch&&<button onClick={clearStandingTeam}>× Limpar</button>}
                  <button onClick={()=>checkFreeApi(true)}>↻ Atualizar Football-Data.org</button>
                </div>
              </div>
              <div className="standing-tabs">
                {(["TOTAL","HOME","AWAY"] as TableMode[]).map(m=><button key={m} className={tableMode===m?"selected":""} onClick={()=>setTableMode(m)}>{m==="TOTAL"?"GERAL":m==="HOME"?"MANDANTE":"VISITANTE"}</button>)}
              </div>
              <div className="standing-table">
                <div className="standing-row standing-th"><span>#</span><span>TIME</span><span>P</span><span>J</span><span>V</span><span>E</span><span>D</span><span>GP</span><span>GC</span><span>SG</span><span>FORMA</span></div>
                {visibleStandings.map(r=><div className="standing-row" key={r.team}>
                  <span className="position">{standings.findIndex(x=>x.team===r.team)+1}</span><b>{r.team}</b><strong>{r.p}</strong><span>{r.j}</span><span>{r.v}</span><span>{r.e}</span><span>{r.d}</span><span>{r.gp}</span><span>{r.gc}</span><span className={r.sg>=0?"positive":"negative"}>{r.sg>0?"+":""}{r.sg}</span><Form values={r.form}/>
                </div>)}
                {!visibleStandings.length&&<div className="api-standing-empty">Aguardando a classificação atual da API. Os resultados do CSV não são usados nesta tabela.</div>}
              </div>
            </section>
          )}
          {tab === "live" && (
            <>
            <section className="panel live-api-panel">
              <div className="panel-head"><i className="green">●</i><div><h3>Central de jogos de hoje</h3><p>{liveApiInfo}</p></div><button disabled={liveApiLoading} onClick={fetchLiveGames}>↻ Atualizar jogos</button></div>
              <div className="live-filters"><label>Competição<select value={liveCompetition} onChange={e=>setLiveCompetition(e.target.value)}><option value="ALL">Todas as competições</option>{liveCompetitions.map(x=><option key={x} value={x}>{x}</option>)}</select></label><label>Status<select value={liveStatusFilter} onChange={e=>setLiveStatusFilter(e.target.value)}><option value="ALL">Todos</option><option value="LIVE">Ao vivo</option><option value="SCHEDULED">Agendados</option><option value="FINISHED">Encerrados</option></select></label><label>Buscar time<input value={liveTeamFilter} onChange={e=>setLiveTeamFilter(e.target.value)} placeholder="Nome do time..."/></label><label className="history-toggle"><input type="checkbox" checked={liveHistoryOnly} onChange={e=>setLiveHistoryOnly(e.target.checked)}/> Somente com histórico CSV</label></div>
              {liveApiLoading&&!liveApiGames.length&&<p className="nodata">Carregando jogos e escudos...</p>}
              {visibleLiveGames.length?<div className="live-match-icons">{visibleLiveGames.map(g=><button key={g.id} className={selectedLiveId===g.id?"selected":""} disabled={liveApiLoading} onClick={()=>analyzeLiveGame(g)} title={`Analisar ${g.home} x ${g.away}`}><small>{g.league}</small><div><span>{g.homeLogo?<img src={g.homeLogo} alt={g.home}/>:"⚽"}<em>{g.home}</em></span><strong>{g.hg} × {g.ag}</strong><span>{g.awayLogo?<img src={g.awayLogo} alt={g.away}/>:"⚽"}<em>{g.away}</em></span></div><b>{["1H","2H","HT","ET","BT","P","LIVE"].includes(g.status)?`${g.minute||0}' • AO VIVO`:g.status==="NS"?new Date(g.date).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):g.statusLong}</b></button>)}</div>:!liveApiLoading&&<p className="nodata">Nenhum jogo corresponde aos filtros selecionados.</p>}
              {(selectedLiveGame||liveAiAnalysis)&&<div className="instant-live-ai"><header><span>✦ CENTRAL DO JOGO • {selectedLiveGame?.home} × {selectedLiveGame?.away}</span><div>{liveApiLoading&&<small>Atualizando a análise...</small>}<button className="clear-live-analysis" onClick={clearLiveAnalysis}>× Limpar análise</button></div></header>{liveAiAnalysis&&<p>{liveAiAnalysis}</p>}</div>}
            </section>
            <details className="panel live-manual-details">
              <summary>+ Complementar estatísticas</summary>
              <div className="manual-details-body">
              <div className="panel-head">
                <i className="red">●</i>
                <div>
                  <h3>Complementar dados não fornecidos pela API</h3>
                  <p>
                    Use somente números reais que você estiver acompanhando na transmissão
                  </p>
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
                  attacksHome: "Ataques casa",
                  attacksAway: "Ataques fora",
                  dangerHome: "Perigosos casa",
                  dangerAway: "Perigosos fora",
                  shotsHome: "Chutes casa",
                  shotsAway: "Chutes fora",
                  sotHome: "No gol casa",
                  sotAway: "No gol fora",
                  yellowHome: "Amarelos casa",
                  yellowAway: "Amarelos fora",
                  redHome: "Vermelhos casa",
                  redAway: "Vermelhos fora",
                  possessionHome: "Posse casa %",
                  possessionAway: "Posse fora %",
                  pressureHome: "Pressão casa",
                  pressureAway: "Pressão fora",
                  xgHome: "xG casa",
                  xgAway: "xG fora",
                  savesHome: "Defesas goleiro casa",
                  savesAway: "Defesas goleiro fora",
                }).map(([k, v]) => (
                  <label key={k}>
                    {v}
                    <input
                      type="number"
                      min="0"
                      value={live[k as keyof typeof live]}
                      onChange={(e) => {
                        setLive({ ...live, [k]: n(e.target.value) });
                        setAnalyzed(false);
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="analysis-actions">
                <button
                  className="primary"
                  disabled={!selectedLiveGame}
                  onClick={() => {if(!selectedLiveGame)return;const shots=live.shotsHome+live.shotsAway||live.shots,sot=live.sotHome+live.sotAway||live.sot,corners=live.hc+live.ac,cards=live.yellowHome+live.yellowAway+live.redHome+live.redAway||live.yellow+live.red;setLiveAiAnalysis(`ANÁLISE ATUALIZADA COM DADOS MANUAIS\n${selectedLiveGame.home} ${live.hg} × ${live.ag} ${selectedLiveGame.away}\nMinuto informado: ${live.minute||"não informado"}.\nVolume: ${shots} finalizações, ${sot} no gol, ${corners} escanteios e ${cards} cartões.\nLeitura: ${sot>=6?"há volume relevante de chutes no gol":sot>=3?"o volume ofensivo é moderado":"há poucos chutes no gol confirmados"}. ${corners>=7?"O número de escanteios já é elevado.":"Os escanteios ainda não indicam pressão elevada por si só."} ${cards>=5?"A partida apresenta intensidade disciplinar alta.":"Os cartões não indicam intensidade disciplinar alta neste momento."}\nEsta análise considera os números informados manualmente pelo usuário.`)} }
                >
                  Recalcular análise
                </button>
                <button
                  onClick={() => {
                    setAnalyzed(false);
                    setLive({
                      ...live,
                      minute: 0,
                      hg: 0,
                      ag: 0,
                      hc: 0,
                      ac: 0,
                      shots: 0,
                      sot: 0,
                      yellow: 0,
                      red: 0,
                      attacksHome: 0,
                      attacksAway: 0,
                      dangerHome: 0,
                      dangerAway: 0,
                      shotsHome: 0,
                      shotsAway: 0,
                      sotHome: 0,
                      sotAway: 0,
                      yellowHome: 0,
                      yellowAway: 0,
                      redHome: 0,
                      redAway: 0,
                      possessionHome: 0,
                      possessionAway: 0,
                      pressureHome: 0,
                      pressureAway: 0,
                      xgHome: 0,
                      xgAway: 0,
                      savesHome: 0,
                      savesAway: 0,
                    });
                  }}
                >
                  Limpar dados
                </button>
              </div>
              </div>
            </details>
            </>
          )}
          {(tab === "pre" || (tab === "live" && analyzed)) &&
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
                <section className="comparison-panel">
                  <div className="comparison-title"><div><h3>Comparativo pré-jogo</h3><span>Casa como mandante × visitante como visitante</span></div>{!admin&&<button onClick={()=>savePrivateHistory(tab==="live"?"live":"pre")}>Salvar no meu histórico</button>}</div>
                  <div className="team-form-grid">
                    <article><small>{home} • posição em casa</small><strong>#{homeVenueTable.findIndex(x=>x.team===home)+1}</strong><Form values={homeStanding?.form||[]}/></article>
                    <article><small>{away} • posição fora</small><strong>#{awayVenueTable.findIndex(x=>x.team===away)+1}</strong><Form values={awayStanding?.form||[]}/></article>
                  </div>
                  <div className="compare-grid">
                    <Compare label="Média de gols marcados" left={a!.scored} right={b!.scored}/>
                    <Compare label="Média de gols sofridos" left={a!.conceded} right={b!.conceded}/>
                    <Compare label="Expectativa de gol (xG)" left={a!.xg} right={b!.xg} unavailable={!league?.quality?.xg||!awayLeague?.quality?.xg}/>
                    <Compare label="Posse de bola média" left={a!.possession} right={b!.possession} suffix="%" unavailable={!league?.quality?.possession||!awayLeague?.quality?.possession}/>
                    <Compare label="Finalizações" left={a!.shots} right={b!.shots}/>
                    <Compare label="Chutes no gol" left={a!.onTarget} right={b!.onTarget}/>
                    <Compare label="Escanteios totais" left={a!.corners} right={b!.corners}/>
                    <Compare label="Cartões totais" left={a!.cards} right={b!.cards}/>
                  </div>
                  <div className="pre-trend-panel">
                    <header>
                      <div><small>EVOLUÇÃO PARTIDA A PARTIDA</small><h3>Gráfico de desempenho recente</h3><p>Últimos jogos do mandante em casa × últimos jogos do visitante fora</p></div>
                      <div className="trend-legend"><span><i style={{background:"#36df91"}}/>{home}</span><span><i style={{background:"#4a8fff"}}/>{away}</span><span><i className="reference"/>Média</span></div>
                    </header>
                    <div className="trend-metric-tabs">
                      {([['goals','⚽ Gols marcados'],['conceded','🥅 Gols sofridos'],['corners','🚩 Escanteios'],['cards','▰ Cartões'],['shots','➤ Finalizações'],['onTarget','🎯 Chutes no gol']] as [PreChartMetric,string][]).map(([key,label])=><button key={key} className={preChartMetric===key?"selected":""} onClick={()=>setPreChartMetric(key)}>{label}</button>)}
                    </div>
                    <TrendLineChart labels={Array.from({length:preChartCount},(_,i)=>`J${i+1}`)} series={[{name:home,color:"#36df91",values:homeChartValues,icon:preChartMetric==="goals"||preChartMetric==="conceded"?"⚽":preChartMetric==="corners"?"🚩":preChartMetric==="cards"?"🟨":preChartMetric==="onTarget"?"🎯":"➤"},{name:away,color:"#4a8fff",values:awayChartValues,icon:preChartMetric==="goals"||preChartMetric==="conceded"?"⚽":preChartMetric==="corners"?"🚩":preChartMetric==="cards"?"🟨":preChartMetric==="onTarget"?"🎯":"➤"},{name:"Média de referência",color:"#f0c75e",values:chartReference,dashed:true}]}/>
                    <footer><span>← mais antigo</span><b>Passe o mouse sobre os pontos para ver os valores</b><span>mais recente →</span></footer>
                  </div>
                </section>
                {h2h.length>0&&<section className="panel compact-panel"><div className="panel-head"><i className="blue">↔</i><div><h3>Últimos confrontos diretos</h3><p>Resultados encontrados na liga selecionada</p></div></div><div className="h2h-list">{h2h.map((g,i)=><div key={i}><small>{g.date||g.round||`Jogo ${i+1}`}</small><b>{g.home} {g.hg} × {g.ag} {g.away}</b></div>)}</div></section>}
                <section className="panel compact-panel referee-panel">
                  <div className="panel-head"><i className="orange">▰</i><div><h3>Análise completa da arbitragem</h3><p>Histórico disciplinar, faltas, linhas de cartões e perfil de rigor</p></div></div>
                  {referees.length?<Select label="Selecionar árbitro" value={refName} set={setSelectedReferee} placeholder="Selecionar árbitro" options={referees.map(x=>[x,x])}/>:<div className="ref-average-note"><b>Média geral da arbitragem da liga</b><span>O CSV não identifica os árbitros; os números abaixo consideram todos os jogos importados.</span></div>}
                  {refereeStats&&<><div className="ref-profile"><div><small>PERFIL</small><strong>{refereeStats.cards>=leagueCards*1.15?"Rigoroso":refereeStats.cards<=leagueCards*.85?"Pouco rigoroso":"Moderado"}</strong></div><div><small>COMPARAÇÃO COM A LIGA</small><strong className={refereeStats.cards>=leagueCards?"positive":""}>{refereeStats.cards>=leagueCards?"+":""}{(refereeStats.cards-leagueCards).toFixed(2)} cartão/jogo</strong></div><div><small>ÚLTIMOS 5 JOGOS</small><span className="recent-cards">{refereeStats.recent.map((x,i)=><i key={i}>{x}</i>)}</span></div></div><div className="ref-stats"><article><small>Jogos apitados</small><b>{refereeStats.games}</b></article><article><small>Faltas/jogo</small><b>{refereeStats.fouls?refereeStats.fouls.toFixed(1):"—"}</b></article><article><small>Amarelos/jogo</small><b>{refereeStats.yellow.toFixed(2)}</b></article><article><small>Vermelhos/jogo</small><b>{refereeStats.red.toFixed(2)}</b></article><article><small>Cartões/jogo</small><b>{refereeStats.cards.toFixed(2)}</b></article><article><small>Cartões mandante</small><b>{refereeStats.homeCards.toFixed(2)}</b></article><article><small>Cartões visitante</small><b>{refereeStats.awayCards.toFixed(2)}</b></article><article><small>Amarelos casa/fora</small><b>{refereeStats.homeYellow.toFixed(1)} / {refereeStats.awayYellow.toFixed(1)}</b></article><article><small>Over 3,5 cartões</small><b>{refereeStats.over35.toFixed(0)}%</b></article><article><small>Over 4,5 cartões</small><b>{refereeStats.over45.toFixed(0)}%</b></article><article><small>Over 5,5 cartões</small><b>{refereeStats.over55.toFixed(0)}%</b></article></div></>}
                  <div className="match-discipline"><header><div><small>PROJEÇÃO DISCIPLINAR DA PARTIDA</small><h3>O que pode acontecer em {home} × {away}</h3></div><strong>{disciplineConfidence}% <small>confiança</small></strong></header><div className="discipline-grid"><article><small>Faixa provável</small><b>{Math.max(0,Math.floor(projectedCards-1))} a {Math.ceil(projectedCards+1)} cartões</b></article><article><small>{home}</small><b>{expectedHomeCards.toFixed(1)} cartões</b></article><article><small>{away}</small><b>{expectedAwayCards.toFixed(1)} cartões</b></article><article><small>Risco de vermelho</small><b>{redRisk.toFixed(0)}%</b></article><article><small>Over 3,5</small><b>{projectedOver35.toFixed(0)}%</b></article><article><small>Over 4,5</small><b>{projectedOver45.toFixed(0)}%</b></article><article><small>Over 5,5</small><b>{projectedOver55.toFixed(0)}%</b></article><article><small>Mais exposto</small><b>{expectedHomeCards>expectedAwayCards*1.1?home:expectedAwayCards>expectedHomeCards*1.1?away:"Equilibrado"}</b></article></div><p>Projeção baseada no comportamento recente dos times {referees.length?`e no histórico de ${refName}`:"e na média disciplinar da liga"}. É uma tendência estatística, não uma garantia.</p></div>
                </section>
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
                {tab === "live" && (
                  <section className="live-diagnosis">
                    <div>
                      <span>DIAGNÓSTICO AO VIVO</span>
                      <strong>
                        {liveConfidence}% <small>confiança</small>
                      </strong>
                    </div>
                    <h3>Pressão {pressureLeader}</h3>
                    <p>
                      O jogo apresenta{" "}
                      {prob.goals >= 70
                        ? "tendência favorável"
                        : prob.goals >= 55
                          ? "possibilidade moderada"
                          : "tendência baixa"}{" "}
                      para outro gol.{" "}
                      {prob.corners >= 68
                        ? "O volume ofensivo favorece novos escanteios."
                        : "Os números de escanteios ainda pedem cautela."}{" "}
                      {prob.cards >= 65
                        ? "A intensidade e a disciplina indicam possibilidade de novos cartões."
                        : "Não há força suficiente para um sinal de cartões."}
                    </p>
                    <button
                      onClick={() => {
                        setTab("ai");
                        setTimeout(
                          () =>
                            askAI(
                              "Explique o diagnóstico ao vivo atual, destacando gols, escanteios, cartões, riscos e confiança.",
                            ),
                          0,
                        );
                      }}
                    >
                      ✦ Consultar IA sobre o diagnóstico
                    </button>
                  </section>
                )}
              </>
            ))}
          {tab === "ai" && (
            <section className="ai-workspace">
              <div className="ai-title-actions"><div className="ai-badge">✦ MODO IA ESTATÍSTICA</div>{(ask||chat.length>1)&&<button onClick={clearAi}>× Limpar análise</button>}</div>
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
                  <b>{leagues.reduce((s, l) => s + l.games.length+(l.apiSync?.games.length||0), 0)}</b>
                  <small>CSV + histórico automático</small>
                </article>
                <article>
                  <span>Acesso</span>
                  <b>Privado</b>
                  <small>somente aprovados</small>
                </article>
              </div>
              <section className="panel api-control-panel"><div className="panel-head"><i className="green">↻</i><div><h3>Atualização automática e cobertura</h3><p>Classificações e partidas encerradas da temporada cadastrada</p></div><button disabled={syncLoading} onClick={syncAll}>{syncLoading?"Atualizando...":"Atualizar todas agora"}</button></div><div className="api-status-list">{leagues.map(l=><article key={l.id}><span><b>{l.name}</b><small>{l.country} • {l.season}{l.apiSync?.round?` • ${l.apiSync.round}`:""}</small></span><em className={l.apiSync?.status==="updated"?"api-ok":"api-off"}>{l.apiSync?.status==="updated"?"● Atualizada":l.apiSync?.error?"● Erro / sem cobertura":"● Aguardando primeira atualização"}</em><span><b>{l.apiSync?.games.length||0}</b><small>jogos automáticos</small></span><span><small>{l.apiSync?.updatedAt?new Date(l.apiSync.updatedAt).toLocaleString("pt-BR"):"Nunca atualizada"}</small>{l.apiSync?.error&&<small title={l.apiSync.error}>{l.apiSync.error}</small>}</span></article>)}</div></section>
              <UserAdmin />
              <section className="panel">
                <div className="panel-head">
                  <i className="blue">⇧</i>
                  <div>
                    <h3>Importar CSV com segurança</h3>
                    <p>Uma nova liga nunca substitui outra automaticamente</p>
                  </div>
                </div>
                <div className="import-mode">
                  <button
                    className={importMode === "create" ? "selected" : ""}
                    onClick={() => {
                      setImportMode("create");
                      setUpdateTarget("");
                    }}
                  >
                    ＋ Cadastrar nova liga
                  </button>
                  <button
                    className={importMode === "update" ? "selected" : ""}
                    onClick={() => setImportMode("update")}
                  >
                    ↻ Atualizar liga existente
                  </button>
                </div>
                {importMode === "update" && (
                  <Select
                    label="Escolha exatamente qual liga atualizar"
                    value={updateTarget}
                    set={(v) => {
                      setUpdateTarget(v);
                      const l = leagues.find((x) => x.id === v);
                      if (l)
                        setLeagueMeta({
                          country: l.country,
                          name: l.name,
                          season: l.season,
                          code: l.code,
                        });
                    }}
                    placeholder="Selecionar liga existente..."
                    options={leagues.map((l) => [
                      l.id,
                      `${l.country} — ${l.name} (${l.season})`,
                    ])}
                  />
                )}
                <div className="meta-grid">
                  <label>
                    País
                    <input
                      value={leagueMeta.country}
                      onChange={(e) =>
                        setLeagueMeta({
                          ...leagueMeta,
                          country: e.target.value,
                        })
                      }
                      placeholder="Ex.: México"
                    />
                  </label>
                  <label>
                    Nome da liga
                    <input
                      value={leagueMeta.name}
                      onChange={(e) =>
                        setLeagueMeta({ ...leagueMeta, name: e.target.value })
                      }
                      placeholder="Ex.: Liga MX"
                    />
                  </label>
                  <label>
                    Temporada
                    <input
                      value={leagueMeta.season}
                      onChange={(e) =>
                        setLeagueMeta({ ...leagueMeta, season: e.target.value })
                      }
                      placeholder="Ex.: 2026/27"
                    />
                  </label>
                  <label>
                    Código da Football-Data.org
                    <input
                      value={leagueMeta.code}
                      onChange={(e) =>
                        setLeagueMeta({ ...leagueMeta, code: e.target.value })
                      }
                      placeholder="Ex.: D1 ou ID numérico"
                    />
                  </label>
                </div>
                <div className="upload-grid">
                  <label className="drop">
                    <input type="file" accept=".csv,.txt" onChange={choose} />
                    <b>{fileName || "Selecionar arquivo CSV"}</b>
                    <span>Aceita HomeTeam/AwayTeam ou Home/Away</span>
                  </label>
                  <div className="safe-note">
                    🔒 O nome do arquivo não controla substituições.
                  </div>
                </div>
                <textarea
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                  placeholder="Ou cole o conteúdo completo do CSV..."
                />
                <div className="actions">
                  <button className="primary" disabled={!csv} onClick={save}>
                    {importMode === "create"
                      ? "Cadastrar nova liga"
                      : "Atualizar liga escolhida"}
                  </button>
                  <button
                    onClick={() => {
                      setCsv("");
                      setFileName("");
                      setLeagueMeta({
                        country: "",
                        name: "",
                        season: "",
                        code: "",
                      });
                      setUpdateTarget("");
                    }}
                  >
                    Limpar
                  </button>
                  <span>{notice}</span>
                </div>
              </section>
              <section className="panel" id="referee-admin">
                <div className="panel-head"><i className="orange">⚖</i><div><h3>Cadastro manual de árbitros</h3><p>Cadastre ou atualize o histórico disciplinar usado nas projeções pré-jogo</p></div></div>
                <div className="referee-admin-grid">
                  <label>Nome completo<input value={refereeForm.name} onChange={e=>setRefereeForm({...refereeForm,name:e.target.value})} placeholder="Ex.: Raphael Claus"/></label>
                  <label>País<input value={refereeForm.country} onChange={e=>setRefereeForm({...refereeForm,country:e.target.value})} placeholder="Ex.: Brasil"/></label>
                  <label>Liga associada<select value={refereeForm.leagueId} onChange={e=>setRefereeForm({...refereeForm,leagueId:e.target.value})}><option value="">Todas / sem liga específica</option>{leagues.map(l=><option key={l.id} value={l.id}>{l.country} — {l.name} ({l.season})</option>)}</select></label>
                  {([['games','Jogos apitados'],['foulsPerGame','Faltas/jogo'],['yellowPerGame','Amarelos/jogo'],['redPerGame','Vermelhos/jogo'],['homeYellow','Amarelos mandante/jogo'],['awayYellow','Amarelos visitante/jogo'],['over35','Over 3,5 cartões (%)'],['over45','Over 4,5 cartões (%)'],['over55','Over 5,5 cartões (%)']] as const).map(([key,label])=><label key={key}>{label}<input type="number" min="0" max={key.startsWith('over')?100:undefined} step={key==='games'?1:.01} value={refereeForm[key]} onChange={e=>setRefereeForm({...refereeForm,[key]:n(e.target.value)})}/></label>)}
                </div>
                <div className="actions"><button className="primary" disabled={refereeForm.name.trim().length<3} onClick={saveReferee}>{refereeForm.id?"Salvar alterações do árbitro":"＋ Adicionar árbitro"}</button>{refereeForm.id&&<button onClick={()=>setRefereeForm({...emptyReferee})}>Cancelar edição</button>}<span>{notice}</span></div>
                <div className="referee-admin-list">{manualReferees.map(r=><article key={r.id}><span><b>{r.name}</b><small>{r.country||"País não informado"}{r.leagueId?` • ${leagues.find(l=>l.id===r.leagueId)?.name||"Liga associada"}`:""}</small></span><span>{r.games} jogos • {(r.yellowPerGame+r.redPerGame).toFixed(2)} cartões/jogo</span><div><button onClick={()=>editReferee(r)}>Editar</button><button className="danger" onClick={()=>deleteReferee(r.id)}>Excluir</button></div></article>)}</div>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <i className="green">▤</i>
                  <div>
                    <h3>Ligas no banco</h3>
                    <p>Edite os dados sem perder as partidas</p>
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
                        <button onClick={() => setEditingLeague(l)}>
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            setImportMode("update");
                            setUpdateTarget(l.id);
                            setLeagueMeta({
                              country: l.country,
                              name: l.name,
                              season: l.season,
                              code: l.code,
                            });
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          Atualizar CSV
                        </button>
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
      {editingLeague && (
        <div className="modal" onMouseDown={() => setEditingLeague(null)}>
          <div className="modal-box" onMouseDown={(e) => e.stopPropagation()}>
            <i>✎</i>
            <h2>Editar liga</h2>
            <p>Os {editingLeague.games.length} jogos serão preservados.</p>
            {(
              [
                ["country", "País"],
                ["name", "Nome da liga"],
                ["season", "Temporada"],
                ["code", "Código da Football-Data.org"],
              ] as const
            ).map(([k, label]) => (
              <label key={k}>
                {label}
                <input
                  value={editingLeague[k]}
                  onChange={(e) =>
                    setEditingLeague({ ...editingLeague, [k]: e.target.value })
                  }
                />
              </label>
            ))}
            <div className="api-league-linker">
              <b>Associar à classificação da API</b>
              <small>Pesquise a competição e escolha o resultado correto.</small>
              <div><input value={apiLeagueQuery} onChange={e=>setApiLeagueQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchApiLeagues()} placeholder="Ex.: Bundesliga, Serie C..."/><button disabled={apiLeagueLoading||apiLeagueQuery.trim().length<2} onClick={searchApiLeagues}>{apiLeagueLoading?"Buscando...":"Buscar"}</button></div>
              {apiLeagueOptions.length>0&&<div className="api-league-results">{apiLeagueOptions.map(x=><button key={x.id} onClick={()=>{setEditingLeague({...editingLeague,code:String(x.id)});setApiLeagueOptions([]);setApiLeagueQuery(`${x.name} — ${x.country}`)}}><span>{x.name}<small>{x.country} • temporada {x.season}</small></span><strong>ID {x.id}</strong></button>)}</div>}
              <em>ID associado atualmente: {editingLeague.code||"nenhum"}</em>
            </div>
            <button className="primary" onClick={editLeague}>
              Salvar alterações
            </button>
            <button onClick={() => setEditingLeague(null)}>Cancelar</button>
          </div>
        </div>
      )}
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
            <label className="remember-login"><input type="checkbox" checked={rememberLogin} onChange={e=>setRememberLogin(e.target.checked)}/><span><b>Manter conectado neste dispositivo</b><small>Use somente em computador ou celular particular.</small></span></label>
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

function Form({values}:{values:("V"|"E"|"D")[]}){return <span className="form-badges">{values.length?values.map((x,i)=><i key={i} className={`form-${x.toLowerCase()}`}>{x}</i>):<em>Sem jogos</em>}</span>}
function Compare({label,left,right,suffix="",unavailable=false}:{label:string;left:number;right:number;suffix?:string;unavailable?:boolean}){const max=Math.max(left,right,1),lp=left/max*100,rp=right/max*100;return <article className="compare-card"><h4>{label}</h4>{unavailable?<p className="no-stat">Não disponível neste CSV</p>:<><div className="compare-values"><b>{left.toFixed(2)}{suffix}</b><b>{right.toFixed(2)}{suffix}</b></div><div className="dual-bar"><i style={{width:`${lp/2}%`}}/><i style={{width:`${rp/2}%`}}/></div></>}</article>}

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
    const timer=setInterval(loadUsers,30000);return()=>clearInterval(timer);
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
                <b><span className={`presence-dot ${u.online?"online":"offline"}`}/>{u.name}</b>
                <small>{u.email}</small>
                <small>{u.online?"Online agora":u.lastSeen?`Offline • visto ${new Date(u.lastSeen).toLocaleString("pt-BR")}`:"Offline"}</small>
              </p>
              <em className={`status-${u.status}`}>{label[u.status]}</em>
              <div className="user-actions">
                {u.status !== "approved" && (
                  <button
                    className="approve"
                    onClick={() => update(u.id, "approved")}
                  >
                    Aceitar
                  </button>
                )}
                {u.status !== "rejected" && (
                  <button onClick={() => update(u.id, "rejected")}>
                    Recusar
                  </button>
                )}
                {u.status === "approved" && (
                  <button
                    className="danger"
                    onClick={() => update(u.id, "blocked")}
                  >
                    Bloquear
                  </button>
                )}
                <button className="danger" onClick={() => remove(u.id)}>
                  Excluir
                </button>
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
