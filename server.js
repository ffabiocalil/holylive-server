const http = require("http");
const { WebcastPushConnection } = require("tiktok-live-connector");
const { WebSocketServer } = require("ws");
const Anthropic = require("@anthropic-ai/sdk");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const PORT = process.env.PORT || 3030;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const SYSTEM_PROMPT = "Voce e a assistente de live commerce da Holy Foods, marca brasileira de alimentos saudaveis. Sugira respostas curtas e naturais para a apresentadora falar ao vivo. Tom: animado, proximo. NUNCA use emagrecimento, use leveza ou equilibrio. Formato: 1 a 2 frases diretas. Se pergunta de compra: diga Aproveita no TikTok Shop!";

const IGNORE = [
  /^(oi|ola|hi|hey)[\s!.]*$/i,
  /^(amei|top|lindo|linda|bom|otimo|incrivel)[\s!.]*$/i,
  /^[\p{Emoji}\s!.]+$/u,
  /^(kkk|rs|haha|rsrs)+$/i,
  /^(bom demais|mt bom|muito bom)[\s!.]*$/i,
];

function isIrrelevant(t) {
  return IGNORE.some(r => r.test(t.trim()));
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Holy Foods Live Server OK");
});

const wss = new WebSocketServer({
  server,
  verifyClient: (info) => {
    if (ALLOWED_ORIGIN === "*") return true;
    const origin = info.origin || "";
    return origin.includes(ALLOWED_ORIGIN);
  }
});

const clients = new Set();
const activeConnections = new Map();

wss.on("connection", (ws, req) => {
  clients.add(ws);
  console.log(`[WS] Cliente conectado. Total: ${clients.size}`);
  ws.send(JSON.stringify({ type: "status", text: "Conectado ao servidor Holy Live" }));

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "connect" && msg.username) {
        connectTikTok(msg.username, ws);
      }
    } catch (e) {}
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`[WS] Cliente desconectado. Total: ${clients.size}`);
  });
});

function sendTo(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

function broadcast(data) {
  const m = JSON.stringify(data);
  clients.forEach(ws => { if (ws.readyState === 1) ws.send(m); });
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

async function generateReply(comment) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 150,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: "Comentario da live: " + comment }]
  });
  return msg.content[0] && msg.content[0].text ? msg.content[0].text : "Otima pergunta!";
}

function connectTikTok(username, ws) {
  const cleanUsername = username.replace(/^@+/, '');
  if (activeConnections.has(cleanUsername)) {
    try { activeConnections.get(cleanUsername).disconnect(); } catch(e) {}
  }

  const tiktok = new WebcastPushConnection(cleanUsername, { processInitialData: false });
  activeConnections.set(cleanUsername, tiktok);

  tiktok.connect()
    .then(() => {
      console.log(`[TikTok] Conectado @${cleanUsername}`);
      broadcast({ type: "status", text: "Conectado a live de @" + cleanUsername });
    })
    .catch(err => {
      console.error(`[TikTok] Erro @${cleanUsername}:`, err.message);
      broadcast({ type: "error", text: "Live de @" + cleanUsername + " nao encontrada. Verifique se esta ao vivo." });
    });
  tiktok.on("chat", async data => {
    const user = data.uniqueId || "usuario";
    const text = data.comment || "";
    if (!text || isIrrelevant(text)) return;

    const id = Date.now();
    broadcast({ type: "comment", user, text, id });

    try {
      const reply = await generateReply(text);
      broadcast({ type: "reply", user, text, reply, id });
    } catch (e) {
      broadcast({ type: "reply", user, text, reply: "(erro ao gerar resposta)", id });
    }
  });

  tiktok.on("disconnected", () => {
    console.log(`[TikTok] @${username} desconectado`);
    broadcast({ type: "status", text: "Live encerrada ou desconectada." });
  });
}

server.listen(PORT, () => {
  console.log(`\n🌿 Holy Foods Live Server rodando na porta ${PORT}\n`);
});
