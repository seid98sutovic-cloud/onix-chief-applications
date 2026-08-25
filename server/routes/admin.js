import { Router } from "express";
import {
  verifyAdmin,
  listApplications,
  getApplicationById,
  updateApplicationStatus,
  getStats,
} from "../db.js";
import { authMiddleware, signToken, setAuthCookie, clearAuthCookie } from "../auth.js";
import { STATUS_LABELS, QUESTIONS } from "../questions.js";

const router = Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Unesite korisničko ime i lozinku." });
  }

  const admin = verifyAdmin(username, password);
  if (!admin) {
    return res.status(401).json({ error: "Pogrešno korisničko ime ili lozinka." });
  }

  const token = signToken(admin);
  setAuthCookie(res, token);
  res.json({ ok: true, username: admin.username });
});

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get("/me", authMiddleware, (req, res) => {
  res.json({ username: req.admin.username });
});

router.get("/stats", authMiddleware, (_req, res) => {
  res.json(getStats());
});

router.get("/applications", authMiddleware, (req, res) => {
  const { search = "", status = "" } = req.query;
  const apps = listApplications({ search, status });
  res.json({
    applications: apps.map((a) => ({
      id: a.id,
      status: a.status,
      statusLabel: STATUS_LABELS[a.status] || a.status,
      discordName: a.discordName,
      icName: a.icName,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
  });
});

router.get("/applications/:id", authMiddleware, (req, res) => {
  const app = getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: "Prijava nije pronađena." });

  const labeledAnswers = QUESTIONS.map((q) => ({
    id: q.id,
    section: q.section,
    label: q.label,
    value: app.answers[q.id] || "",
  }));

  res.json({
    application: {
      ...app,
      statusLabel: STATUS_LABELS[app.status] || app.status,
      labeledAnswers,
    },
    statuses: STATUS_LABELS,
    questions: QUESTIONS,
  });
});

router.patch("/applications/:id/status", authMiddleware, (req, res) => {
  const { status } = req.body || {};
  if (!STATUS_LABELS[status]) {
    return res.status(400).json({ error: "Nevažeći status." });
  }

  const updated = updateApplicationStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: "Prijava nije pronađena." });

  res.json({
    application: {
      ...updated,
      statusLabel: STATUS_LABELS[updated.status],
    },
  });
});

export default router;
