import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

const appPass =
  process.argv[2] ||
  (await ask("Gmail App Password (16 znakova, npr. abcd efgh ijkl mnop): "));

if (!appPass || appPass.length < 8) {
  console.error("App Password je obavezan.");
  process.exit(1);
}

let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

function setEnv(key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(env)) {
    env = env.replace(re, line);
  } else {
    env += `\n${line}`;
  }
}

setEnv("SMTP_HOST", "smtp.gmail.com");
setEnv("SMTP_PORT", "587");
setEnv("SMTP_SECURE", "false");
setEnv("SMTP_USER", "seid98sutovic@gmail.com");
setEnv("SMTP_PASS", appPass.replace(/\s/g, ""));
setEnv("NOTIFY_EMAIL", "seid98sutovic@gmail.com");
setEnv('EMAIL_FROM', '"ONIX Roleplay" <seid98sutovic@gmail.com>');

fs.writeFileSync(envPath, env.trim() + "\n");
console.log("✓ .env ažuriran sa Gmail SMTP podacima");
console.log("Pokreni: npm run test-email");

rl.close();
