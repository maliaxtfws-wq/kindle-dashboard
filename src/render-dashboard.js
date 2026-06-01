import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const WIDTH = Number(process.env.KINDLE_DASH_WIDTH || 758);
const HEIGHT = Number(process.env.KINDLE_DASH_HEIGHT || 1024);
const TZ = process.env.KINDLE_DASH_TZ || "Asia/Shanghai";
const CITY = process.env.KINDLE_DASH_CITY || "Chongqing";
const CITY_LABEL = process.env.KINDLE_DASH_CITY_LABEL || "重庆";
const TITLE = process.env.KINDLE_DASH_TITLE || "客厅";
const OUT_DIR = path.resolve("dist");

const zhWeekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function partsFor(now) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  const dateForWeek = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  const weekdayIndex = new Date(`${dateForWeek}T00:00:00Z`).getUTCDay();
  return {
    time: `${get("hour")}:${get("minute")}`,
    date: `${get("year")}年${Number(get("month"))}月${Number(get("day"))}日 ${zhWeekdays[weekdayIndex]}`
  };
}

async function loadTodos() {
  try {
    const raw = await readFile("data/todos.txt", "utf8");
    return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 6);
  } catch {
    return ["Kindle Dash 已上线", "编辑 data/todos.txt 更新这里", "保持 Kindle 连接 Wi-Fi"];
  }
}

const weatherNames = {
  113: "晴",
  116: "多云",
  119: "阴",
  122: "阴",
  143: "雾",
  176: "阵雨",
  179: "雨夹雪",
  182: "雨夹雪",
  185: "雨夹雪",
  200: "雷雨",
  263: "小阵雨",
  266: "小雨",
  293: "小雨",
  296: "小雨",
  299: "中雨",
  302: "中雨",
  305: "大雨",
  308: "大雨",
  353: "阵雨",
  356: "大阵雨",
  359: "暴雨",
  386: "雷阵雨",
  389: "雷雨"
};

async function fetchWeather() {
  const url = `https://wttr.in/${encodeURIComponent(CITY)}?format=j1&lang=zh`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "kindle-dashboard-pages/0.1" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const current = json.current_condition?.[0] || {};
    const today = json.weather?.[0] || {};
    const desc = weatherNames[current.weatherCode] || current.lang_zh?.[0]?.value || current.weatherDesc?.[0]?.value || "未知";
    return {
      city: CITY_LABEL,
      temp: `${current.temp_C ?? "--"}°`,
      desc,
      feels: `${current.FeelsLikeC ?? "--"}°`,
      humidity: `${current.humidity ?? "--"}%`,
      wind: `${current.windspeedKmph ?? "--"} km/h`,
      hiLo: `${today.mintempC ?? "--"}° / ${today.maxtempC ?? "--"}°`
    };
  } catch {
    return {
      city: CITY_LABEL,
      temp: "--°",
      desc: "天气暂不可用",
      feels: "--°",
      humidity: "--%",
      wind: "--",
      hiLo: "-- / --"
    };
  } finally {
    clearTimeout(timeout);
  }
}

function wrapText(text, maxChars = 21) {
  const lines = [];
  let current = "";
  for (const ch of String(text)) {
    current += ch;
    if (current.length >= maxChars) {
      lines.push(current);
      current = "";
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function section(x, y, w, h, title, body) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#111" stroke-width="3"/>
    <text x="${x + 24}" y="${y + 46}" class="label">${esc(title)}</text>
    ${body}
  `;
}

async function renderSvg() {
  const now = new Date();
  const { time, date } = partsFor(now);
  const weather = await fetchWeather();
  const todos = await loadTodos();
  const todoRows = todos.map((todo, idx) => {
    const y = 641 + idx * 48;
    const lines = wrapText(todo);
    return `
      <circle cx="80" cy="${y - 8}" r="7" fill="#111"/>
      <text x="104" y="${y}" class="todo">${esc(lines[0])}</text>
      ${lines[1] ? `<text x="104" y="${y + 30}" class="todo small">${esc(lines[1])}</text>` : ""}
    `;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <style>
    text { font-family: "Noto Sans CJK SC", "Noto Sans CJK", "Microsoft YaHei", "Noto Sans", Arial, sans-serif; fill: #111; letter-spacing: 0; }
    .kicker { font-size: 26px; font-weight: 700; }
    .label { font-size: 28px; font-weight: 700; }
    .time { font-size: 166px; font-weight: 800; }
    .date { font-size: 36px; font-weight: 700; }
    .weather-temp { font-size: 92px; font-weight: 800; }
    .weather-desc { font-size: 34px; font-weight: 800; }
    .metric { font-size: 24px; font-weight: 650; }
    .todo { font-size: 28px; font-weight: 700; }
    .todo.small { font-size: 22px; font-weight: 500; }
    .footer { font-size: 21px; font-weight: 500; }
  </style>
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#fff"/>
  <text x="52" y="66" class="kicker">${esc(TITLE)} · KINDLE DASH</text>
  <line x1="52" y1="92" x2="706" y2="92" stroke="#111" stroke-width="4"/>
  <text x="44" y="260" class="time">${esc(time)}</text>
  <text x="58" y="322" class="date">${esc(date)}</text>
  ${section(50, 372, 658, 170, "天气", `
    <text x="76" y="501" class="weather-temp">${esc(weather.temp)}</text>
    <text x="264" y="462" class="weather-desc">${esc(weather.city)} · ${esc(weather.desc)}</text>
    <text x="264" y="503" class="metric">体感 ${esc(weather.feels)}  湿度 ${esc(weather.humidity)}</text>
    <text x="264" y="535" class="metric">风速 ${esc(weather.wind)}  低/高 ${esc(weather.hiLo)}</text>
  `)}
  ${section(50, 574, 658, 310, "今天", todoRows)}
  <line x1="52" y1="928" x2="706" y2="928" stroke="#111" stroke-width="3"/>
  <text x="52" y="967" class="footer">GitHub Pages 云端生成 · 约每 10 分钟刷新</text>
</svg>`;
}

async function build() {
  await mkdir(OUT_DIR, { recursive: true });
  const svg = await renderSvg();
  const png = await sharp(Buffer.from(svg)).resize(WIDTH, HEIGHT, { fit: "fill" }).grayscale().png({ compressionLevel: 9 }).toBuffer();
  await writeFile(path.join(OUT_DIR, "dashboard.svg"), svg);
  await writeFile(path.join(OUT_DIR, "dashboard.png"), png);
  await writeFile(path.join(OUT_DIR, "latest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), timezone: TZ, city: CITY_LABEL, size: [WIDTH, HEIGHT] }, null, 2));
  await writeFile(path.join(OUT_DIR, ".nojekyll"), "");
  await writeFile(path.join(OUT_DIR, "index.html"), `<!doctype html>
<meta charset="utf-8">
<title>Kindle Dashboard</title>
<style>body{margin:0;background:#ddd;font-family:sans-serif}.wrap{max-width:${WIDTH}px;margin:0 auto;padding:16px}img{width:100%;height:auto;border:1px solid #999;background:white}</style>
<div class="wrap"><p>Kindle Dashboard · <a href="dashboard.png">dashboard.png</a></p><img src="dashboard.png"></div>`);
  console.log(`Wrote ${path.join(OUT_DIR, "dashboard.png")} (${png.length} bytes)`);
}

await build();
