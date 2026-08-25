const loginView = document.getElementById("login-view");
const adminView = document.getElementById("admin-view");
const loginForm = document.getElementById("login-form");
const loginAlert = document.getElementById("login-alert");
const listPage = document.getElementById("list-page");
const detailPage = document.getElementById("detail-page");
const statsGrid = document.getElementById("stats-grid");
const tbody = document.getElementById("applications-tbody");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
const adminUser = document.getElementById("admin-user");
const backBtn = document.getElementById("back-btn");
const statusSelect = document.getElementById("status-select");
const detailMeta = document.getElementById("detail-meta");
const detailAnswers = document.getElementById("detail-answers");
const detailTitle = document.getElementById("detail-title");
const logoutBtn = document.getElementById("logout-btn");

let currentAppId = null;
let searchTimeout = null;

const STATUS_LABELS = {
  novo: "Novo",
  u_razmatranju: "U razmatranju",
  prihvacen: "Prihvaćen",
  odbijen: "Odbijen",
};

async function api(path, opts = {}) {
  const res = await fetch(`/api/admin${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (res.status === 401) {
    showLogin();
    throw new Error("unauthorized");
  }
  if (!res.ok) throw new Error(data?.error || "Greška");
  return data;
}

function showLogin() {
  loginView.classList.remove("hidden");
  adminView.classList.add("hidden");
}

function showAdmin() {
  loginView.classList.add("hidden");
  adminView.classList.remove("hidden");
}

function showList() {
  listPage.classList.remove("hidden");
  detailPage.classList.add("hidden");
  currentAppId = null;
  location.hash = "#/";
}

function showDetail(id) {
  listPage.classList.add("hidden");
  detailPage.classList.remove("hidden");
  currentAppId = id;
  location.hash = `#/application/${id}`;
  loadDetail(id);
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  return d.toLocaleString("bs-BA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function badge(status) {
  return `<span class="badge badge-${status}">${STATUS_LABELS[status] || status}</span>`;
}

async function loadStats() {
  const stats = await api("/stats");
  statsGrid.innerHTML = `
    <div class="stat-card"><div class="label">Ukupno</div><div class="value">${stats.total}</div></div>
    <div class="stat-card novo"><div class="label">Novo</div><div class="value">${stats.novo || 0}</div></div>
    <div class="stat-card u_razmatranju"><div class="label">U razmatranju</div><div class="value">${stats.u_razmatranju || 0}</div></div>
    <div class="stat-card prihvacen"><div class="label">Prihvaćen</div><div class="value">${stats.prihvacen || 0}</div></div>
    <div class="stat-card odbijen"><div class="label">Odbijen</div><div class="value">${stats.odbijen || 0}</div></div>
  `;
}

async function loadApplications() {
  const search = searchInput.value.trim();
  const status = statusFilter.value;
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status) params.set("status", status);

  const data = await api(`/applications?${params}`);
  const apps = data.applications;

  if (!apps.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Nema prijava${search || status ? " za ovaj filter" : ""}.</td></tr>`;
    return;
  }

  tbody.innerHTML = apps
    .map(
      (a) => `
    <tr>
      <td>${formatDate(a.createdAt)}</td>
      <td>${escapeHtml(a.discordName)}</td>
      <td>${escapeHtml(a.icName)}</td>
      <td>${badge(a.status)}</td>
      <td><button type="button" class="btn btn-ghost row-link" data-id="${a.id}">Otvori →</button></td>
    </tr>
  `
    )
    .join("");

  tbody.querySelectorAll("[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => showDetail(btn.dataset.id));
  });
}

async function loadDetail(id) {
  const data = await api(`/applications/${id}`);
  const app = data.application;

  detailTitle.textContent = `${app.icName} — Chief PD Prijava`;
  detailMeta.innerHTML = `
    <div class="meta-item"><div class="label">Discord</div><div>${escapeHtml(app.discordName)}</div></div>
    <div class="meta-item"><div class="label">IC Ime</div><div>${escapeHtml(app.icName)}</div></div>
    <div class="meta-item"><div class="label">Datum prijave</div><div>${formatDate(app.createdAt)}</div></div>
    <div class="meta-item"><div class="label">ID prijave</div><div style="font-size:12px;word-break:break-all;">${app.id}</div></div>
  `;

  statusSelect.innerHTML = Object.entries(STATUS_LABELS)
    .map(([k, v]) => `<option value="${k}" ${app.status === k ? "selected" : ""}>${v}</option>`)
    .join("");

  let lastSection = "";
  detailAnswers.innerHTML = app.labeledAnswers
    .map((item, i) => {
      let sectionHeader = "";
      if (item.section !== lastSection) {
        lastSection = item.section;
        sectionHeader = `<h3 style="margin:24px 0 12px;color:var(--accent);font-size:16px;">${item.section}</h3>`;
      }
      return `
        ${sectionHeader}
        <div class="answer-block">
          <div class="q-label">Pitanje ${i + 1}</div>
          <div class="q-text">${escapeHtml(item.label)}</div>
          <div class="q-answer">${escapeHtml(item.value) || "<em class='muted'>—</em>"}</div>
        </div>
      `;
    })
    .join("");
}

statusSelect.addEventListener("change", async () => {
  if (!currentAppId) return;
  try {
    await api(`/applications/${currentAppId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: statusSelect.value }),
    });
    await loadStats();
  } catch (err) {
    alert(err.message);
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginAlert.classList.add("hidden");
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    await api("/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    await initAdmin();
  } catch (err) {
    loginAlert.textContent = err.message || "Pogrešna prijava.";
    loginAlert.classList.remove("hidden");
  }
});

logoutBtn.addEventListener("click", async () => {
  await api("/logout", { method: "POST" });
  showLogin();
});

backBtn.addEventListener("click", () => {
  showList();
  loadApplications();
});

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadApplications, 300);
});

statusFilter.addEventListener("change", loadApplications);

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function initAdmin() {
  const me = await api("/me");
  adminUser.textContent = me.username;
  showAdmin();
  await loadStats();
  await loadApplications();

  const hash = location.hash;
  const match = hash.match(/#\/application\/([a-f0-9-]+)/i);
  if (match) showDetail(match[1]);
  else showList();
}

async function boot() {
  try {
    await api("/me");
    await initAdmin();
  } catch {
    showLogin();
  }
}

window.addEventListener("hashchange", () => {
  const match = location.hash.match(/#\/application\/([a-f0-9-]+)/i);
  if (match && !adminView.classList.contains("hidden")) {
    showDetail(match[1]);
  } else if (location.hash === "#/" || !location.hash) {
    if (!adminView.classList.contains("hidden")) showList();
  }
});

boot();
