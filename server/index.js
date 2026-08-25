import "dotenv/config";
import express from "express";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { cookieParser } from "./auth.js";
import { ensureAdminUser, syncAdminPassword } from "./db.js";
import { verifyEmailConfig } from "./email.js";
import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const port = Number(process.env.PORT || 3000);

const adminUser = process.env.ADMIN_USERNAME || "admin";
const adminPass = process.env.ADMIN_PASSWORD || "change-me-now";

if (ensureAdminUser(adminUser, adminPass)) {
  console.log(`[setup] Admin korisnik kreiran: ${adminUser}`);
} else if (syncAdminPassword(adminUser, adminPass)) {
  console.log(`[setup] Admin lozinka ažurirana za: ${adminUser}`);
}

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "onix-chief-applications" });
});

app.use("/api", publicRoutes);
app.use("/api/admin", adminRoutes);

app.use(express.static(publicDir));

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(publicDir, "admin", "index.html"));
});

app.get("/admin/*", (_req, res) => {
  res.sendFile(path.join(publicDir, "admin", "index.html"));
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, "0.0.0.0", async () => {
  console.log(`\n ONIX Chief Applications`);
  console.log(` Forma:       http://localhost:${port}/`);
  console.log(` Admin panel: http://localhost:${port}/admin`);
  console.log(` Admin login: ${adminUser} / (vidi .env ADMIN_PASSWORD)\n`);

  const email = await verifyEmailConfig();
  if (email.ok) {
    console.log(` [email] Spreman — obavijesti idu na ${email.to}`);
  } else {
    console.warn(` [email] NIJE SPREMAN: ${email.reason}`);
    console.warn(` [email] Pokreni: npm run setup-email`);
  }
});
