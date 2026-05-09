let busyCount = 0;

const api = async (path, opts = {}, loadingText = "Working…") => {
  const root = document.getElementById("global-loading");
  const lab = document.getElementById("global-loading-text");
  if (root) {
    busyCount += 1;
    root.style.display = "flex";
    if (lab && loadingText) lab.textContent = loadingText;
  }
  try {
    const r = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      ...opts,
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(t || r.statusText);
    }
    if (r.status === 204) return null;
    return r.json();
  } finally {
    if (root) {
      busyCount = Math.max(0, busyCount - 1);
      if (busyCount === 0) root.style.display = "none";
    }
  }
};

let templates = [];
let sessions = [];
let activeTemplateId = null;
let activeSessionId = null;

let roleCards = [];
let activeRoleId = null;
let evaluations = [];

const LEVEL_OPTS = [
  ["expert", "Expert"],
  ["proficient", "Proficient"],
  ["familiar", "Familiar"],
  ["basic", "Basic"],
];

const $ = (id) => document.getElementById(id);

function toast(message, type = "info", meta = "") {
  const root = $("toast-root");
  if (!root) {
    alert(message);
    return;
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<div>${escapeHtml(String(message))}</div>${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ""}`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 180ms ease";
    setTimeout(() => el.remove(), 220);
  }, type === "error" ? 5500 : 2400);
}

function renderMetrics(m) {
  if (!m) return "";
  const ph = (m.placeholder_names || []).join(", ") || "none";
  return `
    <div class="metric"><strong>${m.char_count}</strong><span>chars</span></div>
    <div class="metric"><strong>${m.line_count}</strong><span>lines</span></div>
    <div class="metric"><strong>${m.estimated_tokens}</strong><span>est. tokens</span></div>
    <div class="metric"><strong>${m.placeholder_names?.length || 0}</strong><span>placeholders</span></div>
    <div class="metric" style="grid-column: 1 / -1"><strong style="font-size:0.85rem;font-weight:500">${ph}</strong><span>names</span></div>
  `;
}

function syncEditorMetrics() {
  const body = $("tpl-body").value;
  const char_count = body.length;
  const line_count = body ? body.split(/\r\n|\r|\n/).length : 0;
  const estimated_tokens = char_count ? Math.max(1, Math.floor(char_count / 4)) : 0;
  const names = [];
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(body))) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  $("tpl-metrics").innerHTML = renderMetrics({
    char_count,
    line_count,
    estimated_tokens,
    placeholder_names: names,
  });
  buildVarInputs(names);
}

function buildVarInputs(names) {
  const root = $("var-inputs");
  root.innerHTML = "";
  names.forEach((n) => {
    const lab = document.createElement("label");
    lab.style.display = "block";
    lab.style.marginBottom = "0.35rem";
    lab.style.fontSize = "0.8rem";
    lab.style.color = "var(--muted)";
    lab.textContent = `{{${n}}}`;
    const inp = document.createElement("input");
    inp.className = "field";
    inp.dataset.key = n;
    inp.placeholder = `Value for ${n}`;
    root.appendChild(lab);
    root.appendChild(inp);
  });
}

function collectVars() {
  const map = {};
  document.querySelectorAll("#var-inputs input[data-key]").forEach((el) => {
    map[el.dataset.key] = el.value;
  });
  return map;
}

async function loadTemplates() {
  templates = await api("/api/templates", {}, "Loading templates…");
  fillAiTemplateSelect();
  fillProjAgentTemplateSelect();
  const list = $("template-list");
  list.innerHTML = "";
  templates.forEach((t) => {
    const div = document.createElement("div");
    div.className = "list-item" + (t.id === activeTemplateId ? " active" : "");
    div.textContent = t.name;
    div.onclick = () => selectTemplate(t.id);
    list.appendChild(div);
  });
  if (activeTemplateId && !templates.find((x) => x.id === activeTemplateId)) {
    activeTemplateId = null;
  }
  if (!templates.length) {
    $("no-template").style.display = "block";
    $("editor").style.display = "none";
    return;
  }
  if (!activeTemplateId && templates[0]) selectTemplate(templates[0].id);
  else if (activeTemplateId) fillEditor(templates.find((x) => x.id === activeTemplateId));
}

function selectTemplate(id) {
  activeTemplateId = id;
  const t = templates.find((x) => x.id === id);
  document.querySelectorAll("#template-list .list-item").forEach((el, i) => {
    el.classList.toggle("active", templates[i]?.id === id);
  });
  if (!t) {
    $("no-template").style.display = "block";
    $("editor").style.display = "none";
    return;
  }
  $("no-template").style.display = "none";
  $("editor").style.display = "block";
  fillEditor(t);
}

function fillEditor(t) {
  $("tpl-name").value = t.name;
  $("tpl-desc").value = t.description || "";
  $("tpl-body").value = t.body;
  $("tpl-metrics").innerHTML = renderMetrics(t.metrics);
  buildVarInputs(t.metrics?.placeholder_names || []);
  $("render-preview").textContent = "";
}

async function loadSessions() {
  sessions = await api("/api/sessions", {}, "Loading sessions…");
  const list = $("session-list");
  list.innerHTML = "";
  sessions.forEach((s) => {
    const div = document.createElement("div");
    div.className = "list-item" + (s.id === activeSessionId ? " active" : "");
    div.textContent = `#${s.id} ${s.title}`;
    div.onclick = () => selectSession(s.id);
    list.appendChild(div);
  });
}

async function selectSession(id) {
  activeSessionId = id;
  document.querySelectorAll("#session-list .list-item").forEach((el, i) => {
    el.classList.toggle("active", sessions[i]?.id === id);
  });
  const s = await api(`/api/sessions/${id}`);
  $("session-detail").style.display = "block";
  const msgRoot = $("messages");
  msgRoot.innerHTML = "";
  (s.messages || []).forEach((m) => {
    const d = document.createElement("div");
    d.className = `msg ${m.role}`;
    d.innerHTML = `<small>${m.role} · ${new Date(m.created_at).toLocaleString()}</small>${escapeHtml(m.content)}`;
    msgRoot.appendChild(d);
  });
  const fbRoot = $("feedbacks");
  fbRoot.innerHTML = "";
  (s.feedbacks || []).forEach((f) => {
    const d = document.createElement("div");
    d.className = "feedback-item";
    const stars = f.rating ? "★".repeat(f.rating) + "☆".repeat(5 - f.rating) : "no rating";
    d.innerHTML = `<div class="stars">${stars}</div>${escapeHtml(f.comment || "")}<div style="color:var(--muted);font-size:0.72rem;margin-top:0.25rem">${new Date(
      f.created_at
    ).toLocaleString()}</div>`;
    fbRoot.appendChild(d);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function saveTemplate() {
  const payload = {
    name: $("tpl-name").value.trim() || "Untitled template",
    description: $("tpl-desc").value.trim() || null,
    body: $("tpl-body").value,
  };
  if (activeTemplateId) {
    await api(`/api/templates/${activeTemplateId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }, "Saving template…");
  } else {
    const created = await api("/api/templates", { method: "POST", body: JSON.stringify(payload) }, "Creating template…");
    activeTemplateId = created.id;
  }
  await loadTemplates();
  await loadSessions();
  toast("Template saved.", "success");
}

async function deleteTemplate() {
  if (!activeTemplateId) return;
  if (!confirm("Delete this template? Sessions stay but lose template_id reference.")) return;
  await api(`/api/templates/${activeTemplateId}`, { method: "DELETE" }, "Deleting template…");
  activeTemplateId = null;
  await loadTemplates();
  toast("Template deleted.", "success");
}

async function previewRender() {
  const body = $("tpl-body").value;
  const variables = collectVars();
  const res = await api("/api/render-preview", {
    method: "POST",
    body: JSON.stringify({ body, variables }),
  }, "Rendering preview…");
  $("render-preview").textContent = res.rendered;
}

async function newTemplate() {
  activeTemplateId = null;
  $("no-template").style.display = "none";
  $("editor").style.display = "block";
  $("tpl-name").value = "New template";
  $("tpl-desc").value = "";
  $("tpl-body").value = "Write a standardized prompt. Use {{variable_name}} for placeholders.\n";
  syncEditorMetrics();
}

async function newSession() {
  if (!activeTemplateId) {
    toast("Select or save a template first.", "error");
    return;
  }
  const s = await api("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ template_id: activeTemplateId, title: `Session ${new Date().toLocaleString()}` }),
  }, "Creating session…");
  await loadSessions();
  await selectSession(s.id);
  toast("Session created.", "success");
}

async function addMessage() {
  if (!activeSessionId) return;
  const role = $("msg-role").value;
  const content = $("msg-content").value;
  if (!content.trim()) return;
  await api(`/api/sessions/${activeSessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ role, content }),
  }, "Writing message…");
  $("msg-content").value = "";
  await selectSession(activeSessionId);
  toast("Message appended.", "success");
}

async function addFeedback() {
  if (!activeSessionId) return;
  const ratingRaw = $("fb-rating").value;
  const rating = ratingRaw ? parseInt(ratingRaw, 10) : null;
  const comment = $("fb-comment").value.trim() || null;
  await api(`/api/sessions/${activeSessionId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ rating, comment }),
  }, "Submitting feedback…");
  $("fb-rating").value = "";
  $("fb-comment").value = "";
  await selectSession(activeSessionId);
  toast("Feedback submitted.", "success");
}

$("tpl-body").addEventListener("input", syncEditorMetrics);
$("btn-save-template").onclick = () => saveTemplate().catch((e) => toast(e.message, "error"));
$("btn-delete-template").onclick = () => deleteTemplate().catch((e) => toast(e.message, "error"));
$("btn-preview").onclick = () => previewRender().catch((e) => toast(e.message, "error"));
$("btn-new-template").onclick = () => newTemplate();
$("btn-new-session").onclick = () => newSession().catch((e) => toast(e.message, "error"));
$("btn-add-msg").onclick = () => addMessage().catch((e) => toast(e.message, "error"));
$("btn-add-feedback").onclick = () => addFeedback().catch((e) => toast(e.message, "error"));
$("btn-refresh").onclick = async () => {
  try {
    await loadTemplates();
    await loadSessions();
    await loadRoleEngine();
    await loadRoleCards();
    fillProjMemberRoleSelect();
    await loadEvaluations();
    await loadProjects();
    await loadAiProviders();
    await loadAiSessions();
    toast("Refreshed.", "success");
  } catch (e) {
    toast(e.message, "error");
  }
};

let projects = [];
let activeProjectId = null;
let activeAiSessionId = null;

function fillProjMemberRoleSelect() {
  const sel = $("proj-member-role");
  if (!sel) return;
  sel.innerHTML = "";
  roleCards.forEach((r) => {
    const o = document.createElement("option");
    o.value = r.id;
    o.textContent = r.display_name;
    sel.appendChild(o);
  });
}

function fillAiTemplateSelect() {
  const sel = $("ai-template");
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">(no agent / template)</option>';
  templates.forEach((t) => {
    const o = document.createElement("option");
    o.value = t.id;
    o.textContent = t.name;
    sel.appendChild(o);
  });
  if (cur) sel.value = cur;
}

function fillProjAgentTemplateSelect() {
  const sel = $("proj-agent-template");
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Select agent template…</option>';
  templates.forEach((t) => {
    const o = document.createElement("option");
    o.value = String(t.id);
    o.textContent = t.name;
    sel.appendChild(o);
  });
  if (cur && templates.find((x) => String(x.id) === cur)) sel.value = cur;
}

function fillAiProjectSelect() {
  const sel = $("ai-project");
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">(no project link)</option>';
  projects.forEach((p) => {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.name;
    sel.appendChild(o);
  });
  if (cur) sel.value = cur;
}

async function loadProjects() {
  try {
    projects = await api("/api/projects", {}, "Loading projects…");
  } catch {
    projects = [];
  }
  const list = $("project-list");
  if (!list) return;
  list.innerHTML = "";
  projects.forEach((p) => {
    const div = document.createElement("div");
    div.className = "list-item" + (p.id === activeProjectId ? " active" : "");
    div.textContent = p.name;
    div.onclick = () => selectProject(p.id);
    list.appendChild(div);
  });
  fillAiProjectSelect();
  if (activeProjectId && !projects.find((x) => x.id === activeProjectId)) activeProjectId = null;
  if (!projects.length) {
    if ($("proj-empty")) $("proj-empty").style.display = "block";
    if ($("proj-editor")) $("proj-editor").style.display = "none";
    return;
  }
  if (!activeProjectId && projects[0]) await selectProject(projects[0].id);
  else if (activeProjectId) {
    const p = projects.find((x) => x.id === activeProjectId);
    if (p) await selectProject(activeProjectId);
  }
}

async function selectProject(id) {
  activeProjectId = id;
  document.querySelectorAll("#project-list .list-item").forEach((el, i) => {
    el.classList.toggle("active", projects[i]?.id === id);
  });
  const p = projects.find((x) => x.id === id);
  if (!p) {
    $("proj-empty").style.display = "block";
    $("proj-editor").style.display = "none";
    return;
  }
  $("proj-empty").style.display = "none";
  $("proj-editor").style.display = "block";
  fillProjectEditor(p);
  await loadProjectMembers();
  const matchOut = $("proj-task-match-out");
  if (matchOut) matchOut.style.display = "none";
  await loadProjectTasks();
  await loadProjectAgents();
  await loadProjectKb();
  await loadProjectMarkdownDocs();
}

let mdDocs = [];
let activeMdDocId = null;

function renderMdPreview(markdown) {
  const el = $("md-render");
  const raw = $("md-raw");
  if (raw) raw.value = markdown || "";
  if (!el) return;
  if (typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {
    el.innerHTML = DOMPurify.sanitize(marked.parse(markdown || ""));
  } else {
    el.textContent = markdown || "";
  }
}

function fillAiLinkedMdSelect() {
  const sel = $("ai-linked-md");
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">(no linked Markdown document)</option>';
  mdDocs.forEach((d) => {
    const o = document.createElement("option");
    o.value = d.id;
    o.textContent = d.title || d.id;
    sel.appendChild(o);
  });
  if (cur && mdDocs.find((x) => x.id === cur)) sel.value = cur;
}

async function loadProjectMarkdownDocs() {
  if (!activeProjectId) return;
  let rows = [];
  try {
    rows = await api(`/api/projects/${activeProjectId}/documents`);
  } catch {
    rows = [];
  }
  mdDocs = rows;
  const list = $("md-doc-list");
  if (!list) return;
  list.innerHTML = "";
  rows.forEach((d) => {
    const div = document.createElement("div");
    div.className = "list-item" + (d.id === activeMdDocId ? " active" : "");
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.gap = "0.5rem";
    const label = document.createElement("span");
    label.textContent = d.title || d.id;
    label.style.cursor = "pointer";
    label.style.flex = "1";
    label.onclick = () => openMdDoc(d.id);
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "secondary";
    rm.textContent = "Delete";
    rm.onclick = async (e) => {
      e.stopPropagation();
      if (!activeProjectId) return;
      if (!confirm("Delete this document and all versions?")) return;
      await api(`/api/projects/${activeProjectId}/documents/${d.id}`, { method: "DELETE" }, "Deleting…").catch((err) =>
        toast(err.message, "error")
      );
      if (activeMdDocId === d.id) {
        activeMdDocId = null;
        const panel = $("md-doc-panel");
        if (panel) panel.style.display = "none";
      }
      await loadProjectMarkdownDocs();
      fillAiLinkedMdSelect();
      toast("Document deleted.", "success");
    };
    div.appendChild(label);
    div.appendChild(rm);
    list.appendChild(div);
  });
  fillAiLinkedMdSelect();
  if (activeMdDocId && !rows.find((x) => x.id === activeMdDocId)) {
    activeMdDocId = null;
    $("md-doc-panel").style.display = "none";
  } else if (activeMdDocId) await refreshMdDocView();
  else $("md-doc-panel").style.display = "none";
}

async function openMdDoc(docId) {
  activeMdDocId = docId;
  $("md-doc-panel").style.display = "block";
  await loadProjectMarkdownDocs();
  await refreshMdDocView();
}

async function refreshMdDocView() {
  if (!activeProjectId || !activeMdDocId) return;
  const vsel = $("md-version-sel");
  const verQ = vsel && vsel.value ? `?version=${encodeURIComponent(vsel.value)}` : "";
  const data = await api(`/api/projects/${activeProjectId}/documents/${activeMdDocId}${verQ}`).catch(() => null);
  if (!data) return;
  const meta = (data.versions || []).slice().sort((a, b) => (a.version || 0) - (b.version || 0));
  if (vsel) {
    const keep = vsel.value;
    vsel.innerHTML = "";
    meta.forEach((v) => {
      const o = document.createElement("option");
      o.value = String(v.version);
      o.textContent = `v${v.version}`;
      vsel.appendChild(o);
    });
    if (keep && meta.find((x) => String(x.version) === keep)) vsel.value = keep;
    else if (data.version != null) vsel.value = String(data.version);
  }
  const titleInp = $("md-doc-title");
  if (titleInp && data.document) titleInp.value = data.document.title || "";
  renderMdPreview(data.content || "");
}

if ($("md-version-sel")) $("md-version-sel").onchange = () => refreshMdDocView().catch((e) => toast(e.message, "error"));
$("btn-md-refresh").onclick = () => refreshMdDocView().catch((e) => toast(e.message, "error"));

$("btn-md-save-version").onclick = async () => {
  if (!activeProjectId || !activeMdDocId) return;
  const raw = $("md-raw");
  const content = (raw && raw.value) || "";
  const noteEl = $("md-version-note");
  const note = (noteEl && noteEl.value.trim()) || null;
  const res = await api(
    `/api/projects/${activeProjectId}/documents/${activeMdDocId}/versions`,
    {
      method: "POST",
      body: JSON.stringify({ content, note, source: "manual" }),
    },
    "Saving new version…"
  ).catch((e) => {
    toast(e.message, "error");
    return null;
  });
  if (!res) return;
  if (noteEl) noteEl.value = "";
  const vsel = $("md-version-sel");
  if (vsel && res.version != null) vsel.value = String(res.version);
  await refreshMdDocView();
  await loadProjectMarkdownDocs();
  toast(`Saved as v${res.version}.`, "success");
};

$("btn-md-save-title").onclick = async () => {
  if (!activeProjectId || !activeMdDocId) return;
  const title = ($("md-doc-title") && $("md-doc-title").value.trim()) || "";
  if (!title) {
    toast("Title required.", "error");
    return;
  }
  await api(
    `/api/projects/${activeProjectId}/documents/${activeMdDocId}`,
    { method: "PUT", body: JSON.stringify({ title }) },
    "Saving title…"
  ).catch((e) => toast(e.message, "error"));
  await loadProjectMarkdownDocs();
  if (activeMdDocId) await refreshMdDocView();
  toast("Title saved.", "success");
};

$("btn-md-delete-doc").onclick = async () => {
  if (!activeProjectId || !activeMdDocId) return;
  if (!confirm("Delete this document and all version history?")) return;
  const id = activeMdDocId;
  await api(`/api/projects/${activeProjectId}/documents/${id}`, { method: "DELETE" }, "Deleting…").catch((e) =>
    toast(e.message, "error")
  );
  activeMdDocId = null;
  const panel = $("md-doc-panel");
  if (panel) panel.style.display = "none";
  await loadProjectMarkdownDocs();
  fillAiLinkedMdSelect();
  toast("Document deleted.", "success");
};

const _mdRawEl = $("md-raw");
if (_mdRawEl) {
  _mdRawEl.addEventListener("input", () => renderMdPreview(_mdRawEl.value));
}

$("btn-md-create").onclick = async () => {
  if (!activeProjectId) return;
  const title = $("md-new-title").value.trim();
  if (!title) return;
  await api(`/api/projects/${activeProjectId}/documents`, {
    method: "POST",
    body: JSON.stringify({ title, initial_markdown: "" }),
  }, "Creating document…").catch((e) => toast(e.message, "error"));
  $("md-new-title").value = "";
  await loadProjectMarkdownDocs();
  toast("Document created.", "success");
};

$("btn-md-from-strategy").onclick = async () => {
  if (!activeProjectId) return;
  const txt = ($("strat-output").textContent || "").trim();
  if (!txt) {
    toast("Generate a strategy first.", "error");
    return;
  }
  const title = prompt("Document title?", "Strategy plan") || "Strategy plan";
  await api(`/api/projects/${activeProjectId}/documents`, {
    method: "POST",
    body: JSON.stringify({ title, initial_markdown: txt }),
  }, "Creating document…").catch((e) => toast(e.message, "error"));
  await loadProjectMarkdownDocs();
  toast("Document created from strategy.", "success");
};

function fillProjectEditor(p) {
  $("proj-name").value = p.name || "";
  $("proj-desc").value = p.description || "";
  $("proj-goals").value = p.goals_text || "";
  $("proj-purpose").value = p.purpose_text || "";
  $("proj-details").value = p.working_details_text || "";
  $("strat-output").style.display = p.strategy_preview ? "block" : "none";
  $("strat-output").textContent = p.strategy_preview || "";
}

async function loadProjectMembers() {
  if (!activeProjectId) return;
  const rows = await api(`/api/projects/${activeProjectId}/members`, {}, "Loading members…").catch(() => []);
  const root = $("proj-members-list");
  root.innerHTML = "";
  rows.forEach((m) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `<div><strong>${escapeHtml(m.role_display_name || "role")}</strong> · ${escapeHtml(
      m.coordination_role
    )}</div><div style="font-size:0.8rem;color:var(--muted)">${escapeHtml(m.notes || "")}</div>`;
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "secondary";
    rm.textContent = "Remove";
    rm.onclick = () =>
      api(`/api/projects/${activeProjectId}/members/${m.id}`, { method: "DELETE" })
        .then(() => loadProjectMembers())
        .catch((e) => toast(e.message, "error"));
    div.appendChild(rm);
    root.appendChild(div);
  });
}

async function loadProjectTasks() {
  if (!activeProjectId) return;
  const rows = await api(`/api/projects/${activeProjectId}/tasks`, {}, "Loading tasks…").catch(() => []);
  const root = $("proj-task-list");
  if (!root) return;
  root.innerHTML = "";
  (rows || []).forEach((t) => {
    const div = document.createElement("div");
    div.className = "list-item";
    const skills = (t.required_skills || []).join(", ");
    div.innerHTML = `<div><strong>${escapeHtml(t.title)}</strong></div><div style="font-size:0.85rem;color:var(--muted)">${escapeHtml(
      skills || "—"
    )}</div>`;
    const btns = document.createElement("div");
    btns.className = "row";
    btns.style.marginTop = "0.35rem";
    const matchBtn = document.createElement("button");
    matchBtn.type = "button";
    matchBtn.className = "secondary";
    matchBtn.textContent = "Match to team";
    matchBtn.onclick = async () => {
      const res = await api(
        `/api/projects/${activeProjectId}/tasks/${t.id}/match`,
        { method: "POST", body: JSON.stringify({}) },
        "Matching…"
      ).catch((e) => {
        toast(e.message, "error");
        return null;
      });
      if (res && res.result) {
        const pre = $("proj-task-match-out");
        if (pre) {
          pre.style.display = "block";
          pre.textContent = res.result.formatted_summary || JSON.stringify(res.result, null, 2);
        }
      }
    };
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "danger secondary";
    delBtn.textContent = "Remove";
    delBtn.onclick = async () => {
      if (!confirm("Remove this task?")) return;
      await api(`/api/projects/${activeProjectId}/tasks/${t.id}`, { method: "DELETE" }, "Removing…").catch((e) =>
        toast(e.message, "error")
      );
      const pre = $("proj-task-match-out");
      if (pre) pre.style.display = "none";
      await loadProjectTasks();
    };
    btns.appendChild(matchBtn);
    btns.appendChild(delBtn);
    div.appendChild(btns);
    root.appendChild(div);
  });
}

async function loadProjectAgents() {
  if (!activeProjectId) return;
  const rows = await api(`/api/projects/${activeProjectId}/agents`, {}, "Loading agent links…").catch(() => []);
  const root = $("proj-agent-list");
  if (!root) return;
  root.innerHTML = "";
  (rows || []).forEach((a) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `<div><strong>${escapeHtml(a.template_name || "Agent #" + a.template_id)}</strong></div>`;
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "secondary";
    rm.textContent = "Unlink";
    rm.onclick = async () => {
      await api(`/api/projects/${activeProjectId}/agents/${a.id}`, { method: "DELETE" }, "Unlinking…").catch((e) =>
        toast(e.message, "error")
      );
      await loadProjectAgents();
    };
    div.appendChild(rm);
    root.appendChild(div);
  });
}

async function loadProjectKb() {
  if (!activeProjectId) return;
  let rows = [];
  try {
    rows = await api(`/api/projects/${activeProjectId}/kb`, {}, "Loading KB…");
  } catch {
    rows = [];
  }
  const root = $("proj-kb-list");
  root.innerHTML = "";
  rows.forEach((k) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `<strong>${escapeHtml(k.title)}</strong>`;
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "secondary";
    rm.textContent = "Delete";
    rm.onclick = () =>
      api(`/api/projects/${activeProjectId}/kb/${k.id}`, { method: "DELETE" })
        .then(() => loadProjectKb())
        .catch((e) => toast(e.message, "error"));
    div.appendChild(rm);
    root.appendChild(div);
  });
}

$("btn-proj-new").onclick = async () => {
  const created = await api(
    "/api/projects",
    {
      method: "POST",
      body: JSON.stringify({ name: "New project", description: "" }),
    },
    "Creating project…"
  ).catch((e) => toast(e.message, "error"));
  if (!created) return;
  activeProjectId = created.id;
  await loadProjects();
  toast("Project created.", "success");
};

$("btn-proj-save").onclick = async () => {
  if (!activeProjectId) return;
  await api(
    `/api/projects/${activeProjectId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        name: $("proj-name").value.trim() || "Untitled",
        description: $("proj-desc").value.trim() || null,
        goals_text: $("proj-goals").value || null,
        purpose_text: $("proj-purpose").value || null,
        working_details_text: $("proj-details").value || null,
      }),
    },
    "Saving project…"
  ).catch((e) => toast(e.message, "error"));
  await loadProjects();
  toast("Project saved.", "success");
};

$("btn-proj-delete").onclick = async () => {
  if (!activeProjectId) return;
  if (!confirm("Delete this project?")) return;
  await api(`/api/projects/${activeProjectId}`, { method: "DELETE" }, "Deleting project…").catch((e) =>
    toast(e.message, "error")
  );
  activeProjectId = null;
  await loadProjects();
  toast("Project deleted.", "success");
};

$("btn-proj-member-add").onclick = async () => {
  if (!activeProjectId) return;
  const roleId = parseInt($("proj-member-role").value, 10);
  await api(
    `/api/projects/${activeProjectId}/members`,
    {
      method: "POST",
      body: JSON.stringify({
        role_card_id: roleId,
        coordination_role: $("proj-member-coord").value,
        notes: null,
      }),
    },
    "Adding member…"
  ).catch((e) => toast(e.message, "error"));
  await loadProjectMembers();
  toast("Member added.", "success");
};

$("btn-kb-add").onclick = async () => {
  if (!activeProjectId) return;
  const title = $("kb-title").value.trim();
  const content = $("kb-content").value;
  if (!title) return;
  await api(
    `/api/projects/${activeProjectId}/kb`,
    {
      method: "POST",
      body: JSON.stringify({ title, content }),
    },
    "Saving KB entry…"
  ).catch((e) => toast(e.message, "error"));
  $("kb-title").value = "";
  $("kb-content").value = "";
  await loadProjectKb();
  toast("KB entry saved.", "success");
};

$("btn-strat-gen").onclick = async () => {
  if (!activeProjectId) return;
  const prov = $("strat-provider").value;
  const res = await api(
    `/api/projects/${activeProjectId}/generate-strategy`,
    {
      method: "POST",
      body: JSON.stringify({ provider: prov }),
    },
    "Generating strategy…"
  ).catch((e) => toast(e.message, "error"));
  if (!res) return;
  $("strat-output").style.display = "block";
  $("strat-output").textContent = res.content || "";
  await loadProjects();
  if (activeProjectId) await selectProject(activeProjectId);
  toast("Strategy generated.", "success");
};

$("btn-proj-task-add").onclick = async () => {
  if (!activeProjectId) return;
  const title = ($("proj-task-title") && $("proj-task-title").value.trim()) || "";
  if (!title) {
    toast("Task title required.", "error");
    return;
  }
  const raw = ($("proj-task-skills") && $("proj-task-skills").value) || "";
  const required_skills = raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  await api(
    `/api/projects/${activeProjectId}/tasks`,
    {
      method: "POST",
      body: JSON.stringify({ title, description: null, required_skills }),
    },
    "Adding task…"
  ).catch((e) => toast(e.message, "error"));
  if ($("proj-task-title")) $("proj-task-title").value = "";
  if ($("proj-task-skills")) $("proj-task-skills").value = "";
  await loadProjectTasks();
  toast("Task added.", "success");
};

$("btn-proj-agent-add").onclick = async () => {
  if (!activeProjectId) return;
  const sel = $("proj-agent-template");
  const tid = sel && sel.value ? parseInt(sel.value, 10) : NaN;
  if (!tid) {
    toast("Choose an agent template.", "error");
    return;
  }
  await api(
    `/api/projects/${activeProjectId}/agents`,
    { method: "POST", body: JSON.stringify({ template_id: tid }) },
    "Linking agent…"
  ).catch((e) => toast(e.message, "error"));
  await loadProjectAgents();
  toast("Agent linked.", "success");
};

async function loadAiProviders() {
  try {
    const r = await api("/api/ai/providers", {}, "Checking providers…");
    const map = {};
    (r.providers || []).forEach((p) => {
      map[p.id] = p.configured;
    });
    ["ai-provider", "strat-provider"].forEach((id) => {
      const sel = $(id);
      if (!sel) return;
      Array.from(sel.options).forEach((o) => {
        o.disabled = map[o.value] === false;
      });
    });
  } catch {
    /* mongo down */
  }
}

function renderAiChatFromSession(doc) {
  const log = $("ai-chat-log");
  log.innerHTML = "";
  (doc.messages || []).forEach((m) => {
    const d = document.createElement("div");
    d.className = `chat-bubble ${m.role}`;
    if (m.role === "assistant" && typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {
      d.innerHTML = `<small>${m.role}</small>` + DOMPurify.sanitize(marked.parse(m.content || ""));
    } else {
      d.innerHTML = `<small>${m.role}</small>${escapeHtml(m.content)}`;
    }
    log.appendChild(d);
  });
  log.scrollTop = log.scrollHeight;
}

function appendAiUserBubble(text) {
  const log = $("ai-chat-log");
  const d = document.createElement("div");
  d.className = "chat-bubble user";
  d.innerHTML = `<small>user</small>${escapeHtml(text)}`;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
}

function extractMarkdownFence(text) {
  const re = /```(?:markdown|md)?\s*([\s\S]*?)```/i;
  const m = text.match(re);
  return m ? m[1].trim() : text.trim();
}

function setAiRequestPreview(obj) {
  const el = $("ai-request-preview");
  if (!el) return;
  if (!obj) {
    el.textContent = "";
    return;
  }
  try {
    el.textContent = JSON.stringify(obj, null, 2);
  } catch {
    el.textContent = String(obj);
  }
}

async function maybeSaveMdVersion(assistantText) {
  if (!$("ai-doc-update-mode").checked) return;
  const docId = $("ai-linked-md") && $("ai-linked-md").value;
  const proj = $("ai-project") && $("ai-project").value;
  if (!docId || !proj) return;
  if (!confirm("Save this assistant reply as a new version of the linked Markdown document? (Cancel if you were only chatting.)")) return;
  const body = extractMarkdownFence(assistantText);
  await api(`/api/projects/${proj}/documents/${docId}/versions`, {
    method: "POST",
    body: JSON.stringify({
      content: body,
      note: "chat revision",
      source: "chat",
      ai_session_id: activeAiSessionId,
    }),
  }, "Saving Markdown version…").catch((e) => toast(e.message, "error"));
  if (activeProjectId === parseInt(proj, 10) && activeMdDocId === docId) await refreshMdDocView();
  toast("Markdown version saved.", "success");
}

async function streamAiChat(body) {
  const loadingRoot = document.getElementById("global-loading");
  const loadingLab = document.getElementById("global-loading-text");
  if (loadingRoot) {
    busyCount += 1;
    loadingRoot.style.display = "flex";
    if (loadingLab) loadingLab.textContent = "Streaming…";
  }
  const res = await fetch("/api/ai/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text();
    if (loadingRoot) {
      busyCount = Math.max(0, busyCount - 1);
      if (busyCount === 0) loadingRoot.style.display = "none";
    }
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let carry = "";
  let assistant = "";
  const log = $("ai-chat-log");
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble assistant typing-cursor";
  bubble.innerHTML = '<small>assistant (streaming)</small><div class="stream-md"></div>';
  log.appendChild(bubble);
  const inner = bubble.querySelector(".stream-md");
  if (inner) inner.textContent = "";
  const handleLine = (line) => {
    if (!line.startsWith("data:")) return;
    const raw = line.replace(/^data:\s*/, "").trim();
    if (!raw || raw === "[DONE]") return;
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (data.error) throw new Error(data.error);
    if (data.request_preview) {
      setAiRequestPreview(data.request_preview);
    }
    if (data.delta) {
      assistant += data.delta;
      if (inner) inner.textContent = assistant;
      log.scrollTop = log.scrollHeight;
    }
    if (data.done) {
      bubble.classList.remove("typing-cursor");
      if (typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {
        inner.innerHTML = DOMPurify.sanitize(marked.parse(assistant));
      } else {
        inner.textContent = assistant;
      }
      activeAiSessionId = data.session_id;
      return true;
    }
    return false;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      carry += dec.decode(value, { stream: true });
      const lines = carry.split("\n");
      carry = lines.pop() || "";
      for (const line of lines) {
        if (handleLine(line)) {
          await maybeSaveMdVersion(assistant);
          await loadAiSessions();
          return;
        }
      }
    }
    if (carry.trim()) {
      for (const line of carry.split("\n")) {
        if (handleLine(line)) {
          await maybeSaveMdVersion(assistant);
          await loadAiSessions();
          return;
        }
      }
    }
    bubble.classList.remove("typing-cursor");
  } finally {
    if (loadingRoot) {
      busyCount = Math.max(0, busyCount - 1);
      if (busyCount === 0) loadingRoot.style.display = "none";
    }
  }
}

async function loadAiSessions() {
  let rows = [];
  const pid = $("ai-project") && $("ai-project").value;
  try {
    const q = pid ? `?project_id=${encodeURIComponent(pid)}` : "";
    rows = await api(`/api/ai/sessions${q}`, {}, "Loading AI sessions…");
  } catch {
    rows = [];
  }
  const list = $("ai-session-list");
  list.innerHTML = "";
  rows.forEach((s) => {
    const wrap = document.createElement("div");
    wrap.className = "list-item" + (s.id === activeAiSessionId ? " active" : "");
    wrap.style.display = "flex";
    wrap.style.justifyContent = "space-between";
    wrap.style.alignItems = "center";
    wrap.style.gap = "0.35rem";
    const t = (s.messages && s.messages[0] && s.messages[0].content) || s.provider;
    const head = String(t).slice(0, 52);
    const lab = document.createElement("span");
    lab.style.flex = "1";
    lab.style.cursor = "pointer";
    lab.textContent = `${s.provider} · ${head}`;
    lab.onclick = async () => {
      activeAiSessionId = s.id;
      const doc = await api(`/api/ai/sessions/${s.id}`).catch(() => null);
      if (doc) renderAiChatFromSession(doc);
      await loadAiSessions();
    };
    const del = document.createElement("button");
    del.type = "button";
    del.className = "secondary";
    del.textContent = "Del";
    del.onclick = async (ev) => {
      ev.stopPropagation();
      if (!confirm("Delete this AI session?")) return;
      await api(`/api/ai/sessions/${s.id}`, { method: "DELETE" }, "Deleting AI session…").catch((e) =>
        toast(e.message, "error")
      );
      if (activeAiSessionId === s.id) {
        activeAiSessionId = null;
        $("ai-chat-log").innerHTML = "";
      }
      await loadAiSessions();
      toast("AI session deleted.", "success");
    };
    wrap.appendChild(lab);
    wrap.appendChild(del);
    list.appendChild(wrap);
  });
}

$("ai-project").onchange = () => {
  loadAiSessions().catch(() => {});
  fillAiLinkedMdSelect();
  // If a project is selected and has Markdown docs, auto-link the first doc.
  const pid = $("ai-project").value;
  if (pid && mdDocs && mdDocs.length) {
    $("ai-linked-md").value = mdDocs[0].id;
  }
};

$("btn-ai-new").onclick = () => {
  activeAiSessionId = null;
  $("ai-chat-log").innerHTML = "";
  $("ai-input").value = "";
  setAiRequestPreview(null);
  if ($("ai-linked-md")) $("ai-linked-md").value = "";
};

$("btn-ai-del-session").onclick = async () => {
  if (!activeAiSessionId) return;
  if (!confirm("Delete the active AI session?")) return;
  await api(`/api/ai/sessions/${activeAiSessionId}`, { method: "DELETE" }, "Deleting AI session…").catch((e) =>
    toast(e.message, "error")
  );
  activeAiSessionId = null;
  $("ai-chat-log").innerHTML = "";
  await loadAiSessions();
  toast("AI session deleted.", "success");
};

$("btn-ai-send").onclick = async () => {
  const text = $("ai-input").value.trim();
  if (!text) return;
  const provider = $("ai-provider").value;
  const tpl = $("ai-template").value;
  const proj = $("ai-project").value;
  const modelOv = $("ai-model-override").value.trim();
  const linked = $("ai-linked-md") && $("ai-linked-md").value;
  const body = {
    provider,
    message: text,
    session_id: activeAiSessionId || null,
    project_id: proj ? parseInt(proj, 10) : null,
    template_id: tpl ? parseInt(tpl, 10) : null,
    template_variables: {},
    model_override: modelOv || null,
    linked_markdown_document_id: linked || null,
  };
  appendAiUserBubble(text);
  $("ai-input").value = "";
  setAiRequestPreview({ status: "sending..." });
  try {
    if ($("ai-use-stream").checked) {
      await streamAiChat(body);
    } else {
      const res = await api("/api/ai/chat", { method: "POST", body: JSON.stringify(body) }, "Sending…");
      activeAiSessionId = res.session_id;
      renderAiChatFromSession(res.session);
      if (res.request_preview) setAiRequestPreview(res.request_preview);
      await maybeSaveMdVersion(res.assistant || "");
      await loadAiSessions();
      toast("Reply received.", "success");
    }
  } catch (e) {
    toast(e.message, "error");
  }
};

function showSettingsDrawer(open) {
  const d = $("settings-drawer");
  if (!d) return;
  d.style.display = open ? "block" : "none";
}

if ($("btn-open-settings")) $("btn-open-settings").onclick = () => showSettingsDrawer(true);
if ($("btn-close-settings")) $("btn-close-settings").onclick = () => showSettingsDrawer(false);
if ($("settings-drawer"))
  $("settings-drawer").addEventListener("click", (e) => {
    if (e.target && e.target.id === "settings-drawer") showSettingsDrawer(false);
  });

document.querySelectorAll("#settings-tabs .tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const name = btn.dataset.settingsTab;
    document.querySelectorAll("#settings-tabs .tab").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".settings-panel").forEach((p) =>
      p.classList.toggle("active", p.id === `settings-${name}`)
    );
  });
});

async function loadRoleEngine() {
  const s = await api("/api/role-engine/settings", {}, "Loading engine settings…");
  $("re-enabled").checked = !!s.enabled;
  $("re-principles").value = s.allocation_principles || "";
  const lp = $("re-load-penalty");
  if (lp) lp.value = s.load_penalty_per_unit != null ? String(s.load_penalty_per_unit) : "3";
}

$("btn-re-save").onclick = () =>
  api(
    "/api/role-engine/settings",
    {
      method: "PUT",
      body: JSON.stringify({
        enabled: $("re-enabled").checked,
        allocation_principles: $("re-principles").value,
        load_penalty_per_unit: parseFloat(($("re-load-penalty") && $("re-load-penalty").value) || "3") || 0,
      }),
    },
    "Saving engine settings…"
  )
    .then(() => toast("Engine settings saved.", "success"))
    .catch((e) => toast(e.message, "error"));

function renderSkillRows(skills) {
  const root = $("skill-rows");
  root.innerHTML = "";
  const list = skills?.length ? skills : [{ skill_name: "", level: "familiar" }];
  list.forEach((sk, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "skill-row";
    const inp = document.createElement("input");
    inp.className = "field";
    inp.placeholder = "Skill name, e.g. React";
    inp.value = sk.skill_name || "";
    inp.dataset.skillIdx = String(idx);
    const sel = document.createElement("select");
    sel.className = "field";
    LEVEL_OPTS.forEach(([v, lab]) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = lab;
      if ((sk.level || "familiar") === v) o.selected = true;
      sel.appendChild(o);
    });
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "secondary";
    rm.textContent = "Remove";
    rm.onclick = () => {
      wrap.remove();
      if (!$("skill-rows").children.length) renderSkillRows([]);
    };
    wrap.appendChild(inp);
    wrap.appendChild(sel);
    wrap.appendChild(rm);
    root.appendChild(wrap);
  });
}

function collectSkillsFromDom() {
  const out = [];
  document.querySelectorAll("#skill-rows .skill-row").forEach((row) => {
    const inp = row.querySelector("input");
    const sel = row.querySelector("select");
    const name = (inp && inp.value.trim()) || "";
    if (!name) return;
    out.push({ skill_name: name, level: sel ? sel.value : "familiar" });
  });
  return out;
}

async function loadRoleCards() {
  roleCards = await api("/api/role-cards", {}, "Loading persons…");
  fillProjMemberRoleSelect();
  const list = $("role-list");
  list.innerHTML = "";
  roleCards.forEach((r) => {
    const div = document.createElement("div");
    div.className = "list-item" + (r.id === activeRoleId ? " active" : "");
    div.textContent = r.display_name;
    div.onclick = () => selectRole(r.id);
    list.appendChild(div);
  });
  if (activeRoleId && !roleCards.find((x) => x.id === activeRoleId)) activeRoleId = null;
  if (!roleCards.length) {
    $("rc-empty").style.display = "block";
    $("rc-editor").style.display = "none";
    return;
  }
  if (!activeRoleId) selectRole(roleCards[0].id);
  else fillRoleEditor(roleCards.find((x) => x.id === activeRoleId));
}

function selectRole(id) {
  activeRoleId = id;
  document.querySelectorAll("#role-list .list-item").forEach((el, i) => {
    el.classList.toggle("active", roleCards[i]?.id === id);
  });
  const r = roleCards.find((x) => x.id === id);
  if (!r) {
    $("rc-empty").style.display = "block";
    $("rc-editor").style.display = "none";
    return;
  }
  $("rc-empty").style.display = "none";
  $("rc-editor").style.display = "block";
  fillRoleEditor(r);
}

function fillRoleEditor(r) {
  $("rc-name").value = r.display_name || "";
  const job = $("rc-job");
  if (job) job.value = r.job_title || "";
  const team = $("rc-team");
  if (team) team.value = r.team_name || "";
  const load = $("rc-load");
  if (load) load.value = r.current_load != null ? String(r.current_load) : "0";
  $("rc-notes").value = r.notes || "";
  renderSkillRows(r.skills || []);
}

$("btn-skill-add").onclick = () => {
  const root = $("skill-rows");
  const wrap = document.createElement("div");
  wrap.className = "skill-row";
  const inp = document.createElement("input");
  inp.className = "field";
  inp.placeholder = "Skill name";
  const sel = document.createElement("select");
  sel.className = "field";
  LEVEL_OPTS.forEach(([v, lab]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = lab;
    sel.appendChild(o);
  });
  sel.value = "familiar";
  const rm = document.createElement("button");
  rm.type = "button";
  rm.className = "secondary";
  rm.textContent = "Remove";
  rm.onclick = () => {
    wrap.remove();
    if (!$("skill-rows").children.length) renderSkillRows([]);
  };
  wrap.appendChild(inp);
  wrap.appendChild(sel);
  wrap.appendChild(rm);
  root.appendChild(wrap);
};

$("btn-rc-new").onclick = async () => {
  const created = await api(
    "/api/role-cards",
    {
      method: "POST",
      body: JSON.stringify({
        display_name: "New person",
        notes: "",
        job_title: null,
        team_name: null,
        current_load: 0,
        skills: [],
      }),
    },
    "Creating person…"
  ).catch((e) => toast(e.message, "error"));
  if (!created) return;
  activeRoleId = created.id;
  await loadRoleCards();
  toast("Person created.", "success");
};

$("btn-rc-save").onclick = async () => {
  if (!activeRoleId) return;
  const loadEl = $("rc-load");
  const loadVal = loadEl ? parseInt(loadEl.value, 10) : 0;
  const payload = {
    display_name: $("rc-name").value.trim() || "Unnamed",
    notes: $("rc-notes").value.trim() || null,
    job_title: ($("rc-job") && $("rc-job").value.trim()) || null,
    team_name: ($("rc-team") && $("rc-team").value.trim()) || null,
    current_load: Number.isFinite(loadVal) ? loadVal : 0,
    skills: collectSkillsFromDom(),
  };
  await api(`/api/role-cards/${activeRoleId}`, { method: "PUT", body: JSON.stringify(payload) }, "Saving person…").catch(
    (e) => toast(e.message, "error")
  );
  await loadRoleCards();
  toast("Person saved.", "success");
};

$("btn-rc-delete").onclick = async () => {
  if (!activeRoleId) return;
  if (!confirm("Delete this person?")) return;
  await api(`/api/role-cards/${activeRoleId}`, { method: "DELETE" }, "Deleting person…").catch((e) =>
    toast(e.message, "error")
  );
  activeRoleId = null;
  await loadRoleCards();
  toast("Person deleted.", "success");
};

function renderEvaluations() {
  const root = $("eval-list");
  root.innerHTML = "";
  evaluations.forEach((ev) => {
    const div = document.createElement("div");
    div.className = "list-item";
    const head = ev.goal_text.length > 80 ? ev.goal_text.slice(0, 80) + "…" : ev.goal_text;
    div.innerHTML = `<div style="font-size:0.8rem;color:var(--muted)">#${ev.id} · ${new Date(
      ev.created_at
    ).toLocaleString()}</div><div>${escapeHtml(head)}</div>`;
    div.onclick = () => showEvalDetail(ev);
    root.appendChild(div);
  });
}

function showEvalDetail(ev) {
  const r = ev.result;
  $("task-goal").value = ev.goal_text;
  $("task-summary").style.display = "block";
  $("task-summary").textContent = r.formatted_summary || "";
  renderTaskTable(r);
}

async function loadEvaluations() {
  evaluations = await api("/api/role-engine/evaluations?limit=50", {}, "Loading evaluations…");
  renderEvaluations();
}

function renderTaskTable(result) {
  const wrap = $("task-table-wrap");
  if (!result || !result.roles?.length) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "block";
  const rows = result.roles
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.display_name)}</td><td>${row.match_percent}%</td><td>${escapeHtml(
          row.skill_tree.map((s) => `${s.skill} (${s.label ?? "?"})`).join("; ") || "-"
        )}</td><td>${escapeHtml(row.rationale || "")}</td></tr>`
    )
    .join("");
  wrap.innerHTML = `<table class="table-mini"><thead><tr><th>Role</th><th>Match</th><th>Skill tree</th><th>Hits</th></tr></thead><tbody>${rows}</tbody></table>`;
}

$("btn-task-eval").onclick = async () => {
  const goal = $("task-goal").value.trim();
  if (!goal) return;
  const body = {
    goal,
    persist: $("task-persist").checked,
    force_engine: $("task-force").checked ? true : null,
  };
  const res = await api("/api/role-engine/evaluate", { method: "POST", body: JSON.stringify(body) }, "Evaluating…").catch(
    (e) => toast(e.message, "error")
  );
  if (!res) return;
  $("task-summary").style.display = "block";
  $("task-summary").textContent = res.result.formatted_summary || "";
  renderTaskTable(res.result);
  await loadEvaluations();
  toast("Evaluation complete.", "success");
};

loadTemplates()
  .then(() => loadSessions())
  .then(() => loadRoleEngine())
  .then(() => loadRoleCards())
  .then(() => loadEvaluations())
  .then(() => loadProjects())
  .then(() => loadAiProviders())
  .then(() => loadAiSessions())
  .catch((e) => toast(e.message, "error"));
