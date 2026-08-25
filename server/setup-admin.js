import "dotenv/config";
import readline from "readline";
import { ensureAdminUser } from "./db.js";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

const username = process.argv[2] || (await ask("Admin username: "));
const password = process.argv[3] || (await ask("Admin password: "));

if (!username || !password) {
  console.error("Username i password su obavezni.");
  process.exit(1);
}

const created = ensureAdminUser(username, password);
if (created) {
  console.log(`Admin korisnik "${username}" kreiran.`);
} else {
  console.log(`Korisnik "${username}" već postoji.`);
}

rl.close();
