const formEl = document.getElementById("application-form");
const alertEl = document.getElementById("alert");
const formView = document.getElementById("form-view");
const successView = document.getElementById("success-view");
const successMessage = document.getElementById("success-message");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");
const submitBtn = document.getElementById("submit-btn");

let questions = [];

function showAlert(msg) {
  alertEl.textContent = msg;
  alertEl.classList.remove("hidden");
  alertEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideAlert() {
  alertEl.classList.add("hidden");
}

function updateProgress() {
  const inputs = formEl.querySelectorAll("[data-qid]");
  let filled = 0;
  inputs.forEach((el) => {
    if ((el.value || "").trim()) filled++;
  });
  const total = questions.length;
  const pct = total ? Math.round((filled / total) * 100) : 0;
  progressFill.style.width = `${pct}%`;
  progressText.textContent = `${filled} / ${total} pitanja popunjeno`;
}

function renderForm() {
  const sections = [...new Set(questions.map((q) => q.section))];
  formEl.innerHTML = "";

  sections.forEach((section, idx) => {
    const sectionQs = questions.filter((q) => q.section === section);
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <h2 class="section-title">
        <span class="section-num">${idx + 1}</span>
        ${section}
      </h2>
      <p class="section-desc">${getSectionDesc(section)}</p>
    `;

    sectionQs.forEach((q) => {
      const field = document.createElement("div");
      field.className = "field";

      const label = document.createElement("label");
      label.htmlFor = q.id;
      label.innerHTML = `${q.label}${q.required ? '<span class="req">*</span>' : ""}`;

      let input;
      if (q.type === "long") {
        input = document.createElement("textarea");
        input.rows = 5;
      } else {
        input = document.createElement("input");
        input.type = "text";
      }

      input.id = q.id;
      input.name = q.id;
      input.dataset.qid = q.id;
      input.placeholder = q.placeholder || "";
      if (q.required) input.required = true;
      input.addEventListener("input", updateProgress);

      field.appendChild(label);
      field.appendChild(input);
      card.appendChild(field);
    });

    formEl.appendChild(card);
  });

  updateProgress();
}

function getSectionDesc(section) {
  const descs = {
    "Osnovni podaci": "Osnovne informacije za identifikaciju kandidata.",
    "Iskustvo i aktivnost": "Procjena tvog iskustva, aktivnosti i dostupnosti na serveru.",
    Motivacija: "Zašto želiš poziciju Chiefa i šta ONIX dobija tvojim dolaskom.",
    "Plan rada": "Konkretan plan vođenja PD-a — prva sedmica i mjesec dana.",
    "Organizacija PD-a": "Hijerarhija, smjene, obuke, disciplina i promocije.",
    "Situaciona pitanja": "Odgovori kao Chief — donošenje odluka pod pritiskom.",
    "RP standard": "Razumijevanje kvalitetnog Police RP-a i odgovornosti.",
  };
  return descs[section] || "";
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();
  submitBtn.disabled = true;
  submitBtn.textContent = "Slanje...";

  const answers = {};
  formEl.querySelectorAll("[data-qid]").forEach((el) => {
    answers[el.dataset.qid] = el.value.trim();
  });

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const data = await res.json();

    if (!res.ok) {
      showAlert(data.error || "Greška pri slanju prijave.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Pošalji prijavu";
      return;
    }

    formView.classList.add("hidden");
    successView.classList.remove("hidden");
    successMessage.textContent = data.message;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch {
    showAlert("Mrežna greška. Provjeri konekciju i pokušaj ponovo.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Pošalji prijavu";
  }
});

async function init() {
  try {
    const res = await fetch("/api/questions");
    const data = await res.json();
    questions = data.questions;
    renderForm();
  } catch {
    showAlert("Nije moguće učitati formu. Osvježi stranicu.");
  }
}

init();
