import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { createApplication } from "../db.js";
import { QUESTIONS } from "../questions.js";
import { sendNewApplicationEmail } from "../email.js";

const router = Router();

router.get("/questions", (_req, res) => {
  res.json({ questions: QUESTIONS });
});

router.post("/submit", async (req, res) => {
  try {
    const { answers } = req.body;
    if (!answers || typeof answers !== "object") {
      return res.status(400).json({ error: "Nedostaju odgovori." });
    }

    for (const q of QUESTIONS) {
      if (!q.required) continue;
      const val = (answers[q.id] || "").trim();
      if (!val) {
        return res.status(400).json({ error: `Obavezno polje: ${q.label}` });
      }
    }

    const discordName = (answers.q1 || "").trim();
    const icName = (answers.q2 || "").trim();
    const id = uuidv4();

    const application = createApplication({
      id,
      discordName,
      icName,
      answers,
    });

    sendNewApplicationEmail(application)
      .then((result) => {
        if (!result.sent) {
          console.error(`[email] Prijava ${application.id} sačuvana, ali email nije poslan: ${result.reason}`);
        }
      })
      .catch((err) => {
        console.error(`[email] Greška pri slanju (prijava ${application.id}):`, err.message);
      });

    res.status(201).json({
      ok: true,
      id: application.id,
      message:
        "Hvala na prijavi za poziciju Chief of Police. Staff Team će pregledati tvoju prijavu i kontaktirati te ukoliko budeš prošao u naredni krug selekcije. Sretno.",
    });
  } catch (err) {
    console.error("[submit]", err);
    res.status(500).json({ error: "Greška pri slanju prijave. Pokušaj ponovo." });
  }
});

export default router;
