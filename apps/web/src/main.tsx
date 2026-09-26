import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import type { CaseRecord, Category } from "@civicresolve/contracts";
import "./styles.css";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
type Submission = {
  case: CaseRecord;
  statusToken: string;
  explanation: string;
  mode: string;
};
type Tab = "report" | "status" | "workspace" | "taxonomy";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "Request failed");
  return value as T;
}

type Auth = {
  isAuthenticated: boolean;
  getToken: () => Promise<string>;
  login: () => void;
  logout: () => void;
};

function App({ auth }: { auth?: Auth }) {
  const [tab, setTab] = useState<Tab>("report");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [submission, setSubmission] = useState<Submission | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("civicresolve-case") ?? "null");
    } catch {
      return null;
    }
  });
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<CaseRecord | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const showAdmin = demoMode || !!auth?.isAuthenticated;

  async function adminHeaders(): Promise<Record<string, string>> {
    return demoMode
      ? { "X-Demo-Role": "organization_owner" }
      : auth?.isAuthenticated
        ? { Authorization: `Bearer ${await auth.getToken()}` }
        : {};
  }

  useEffect(() => {
    call<{ mode: string }>("/api/health")
      .then((result) => setDemoMode(result.mode === "demo/offline"))
      .catch(() => {});
    call<{ categories: Category[] }>("/api/taxonomy")
      .then((result) => setCategories(result.categories))
      .catch(() => {});
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await call<Submission>("/api/cases", {
        method: "POST",
        headers: await adminHeaders(),
        body: JSON.stringify({
          description,
          location,
          contactEmail: email || undefined,
        }),
      });
      setSubmission(result);
      sessionStorage.setItem("civicresolve-case", JSON.stringify(result));
      setTab("status");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshStatus() {
    if (!submission) return;
    setError("");
    try {
      const result = await call<{ case: CaseRecord }>(
        `/api/cases/${submission.case.id}`,
        { headers: { "X-Case-Token": submission.statusToken } },
      );
      const next = { ...submission, case: result.case };
      setSubmission(next);
      sessionStorage.setItem("civicresolve-case", JSON.stringify(next));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function loadCases() {
    setError("");
    try {
      const result = await call<{ cases: CaseRecord[] }>("/api/admin/cases", {
        headers: await adminHeaders(),
      });
      setCases(result.cases);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  useEffect(() => {
    if (tab === "workspace" && showAdmin) void loadCases();
  }, [tab, showAdmin]);

  async function transition(next: CaseRecord["status"]) {
    if (!selected) return;
    setError("");
    setBusy(true);
    try {
      const result = await call<{ case: CaseRecord }>(
        `/api/admin/cases/${selected.id}/transition`,
        {
          method: "POST",
          headers: await adminHeaders(),
          body: JSON.stringify({
            status: next,
            expectedVersion: selected.version,
          }),
        },
      );
      setSelected(result.case);
      await loadCases();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const nextStatuses: Record<string, CaseRecord["status"][]> = {
    needs_review: ["assigned"],
    assigned: ["acknowledged"],
    acknowledged: ["in_progress"],
    in_progress: ["waiting_on_resident", "resolved"],
    waiting_on_resident: ["in_progress", "resolved"],
    resolved: ["reopened", "closed"],
    reopened: ["assigned", "in_progress"],
  };
  const unresolved = cases.filter(
    (item) => !["resolved", "closed"].includes(item.status),
  ).length;
  const review = cases.filter((item) => item.status === "needs_review").length;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setTab("report")}>
          <span className="brandmark">✳</span>
          <span>
            Civic<span className="brandaccent">Resolve</span>
          </span>
        </button>
        <div className="topright">
          {demoMode && (
            <span className="mode">
              <span className="mode-dot" /> DEMO / OFFLINE
            </span>
          )}
          {auth && (
            <button
              className="auth-button"
              onClick={auth.isAuthenticated ? auth.logout : auth.login}
            >
              {auth.isAuthenticated ? "Log out" : "Staff log in"}
            </button>
          )}
          <span className="top-divider" />
          <span className="municipality">Northwind Services</span>
        </div>
      </header>
      <div className="layout">
        <aside className="sidebar">
          <div className="navlabel">RESIDENT SERVICES</div>
          <button
            className={tab === "report" ? "nav active" : "nav"}
            onClick={() => setTab("report")}
          >
            <span>＋</span> Report an issue
          </button>
          <button
            className={tab === "status" ? "nav active" : "nav"}
            onClick={() => setTab("status")}
          >
            <span>◫</span> My case status
          </button>
          {showAdmin && (
            <>
              <div className="navlabel staff-label">STAFF WORKSPACE</div>
              <button
                className={tab === "workspace" ? "nav active" : "nav"}
                onClick={() => setTab("workspace")}
              >
                <span>▦</span> Case queue <span className="beta">DEMO</span>
              </button>
              <button
                className={tab === "taxonomy" ? "nav active" : "nav"}
                onClick={() => setTab("taxonomy")}
              >
                <span>◇</span> Taxonomy
              </button>
            </>
          )}
          <div className="sidebar-foot">
            <span className="help-icon">?</span>
            <div>
              <strong>Need urgent help?</strong>
              <small>For emergencies, call local emergency services.</small>
            </div>
          </div>
        </aside>
        <main className="main">
          {tab === "report" && (
            <div className="page narrow">
              <div className="eyebrow">
                COMMUNITY REPORTING <span className="eyebrow-line" />
              </div>
              <h1>
                Tell us what’s happening
                <br />
                <em>in your neighborhood.</em>
              </h1>
              <p className="lead">
                Share the details in your own words. We’ll make sure your report
                reaches the right team and keep you informed along the way.
              </p>
              <div className="steps">
                <span className="step current">
                  <b>01</b> Describe issue
                </span>
                <span className="step-line" />
                <span className="step">
                  <b>02</b> Review & submit
                </span>
                <span className="step-line" />
                <span className="step">
                  <b>03</b> Track progress
                </span>
              </div>
              <form className="form-card" onSubmit={submit}>
                <div className="card-heading">
                  <span className="card-icon">✎</span>
                  <div>
                    <h2>What would you like to report?</h2>
                    <p>Be as specific as you can. We’ll guide it from here.</p>
                  </div>
                </div>
                <label htmlFor="description">
                  Describe the issue <span>*</span>
                </label>
                <textarea
                  id="description"
                  minLength={15}
                  maxLength={4000}
                  required
                  placeholder="For example: A large section of the sidewalk near the library is lifted, and someone could trip..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
                <div className="form-row">
                  <div>
                    <label htmlFor="location">
                      Where is it happening? <span>*</span>
                    </label>
                    <input
                      id="location"
                      required
                      minLength={3}
                      placeholder="Street address or nearby landmark"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="email">
                      Email for updates <small>(optional)</small>
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                </div>
                <div className="form-footer">
                  <span>
                    ⌁ &nbsp;Your report is reviewed before any action is taken.
                  </span>
                  <button className="primary" disabled={busy}>
                    {busy ? "Submitting…" : "Submit report"} <span>→</span>
                  </button>
                </div>
              </form>
              <div className="trust-row">
                <span>◈ &nbsp;Secure reporting</span>
                <span>◎ &nbsp;Human oversight</span>
                <span>↗ &nbsp;Trackable updates</span>
              </div>
            </div>
          )}
          {tab === "status" && (
            <div className="page narrow">
              <div className="eyebrow">
                CASE TRACKING <span className="eyebrow-line" />
              </div>
              <h1>
                Stay in the <em>loop.</em>
              </h1>
              <p className="lead">
                Your report has a clear path forward. Check its current status
                here.
              </p>
              {submission ? (
                <div className="status-card">
                  <div className="status-top">
                    <div>
                      <span className="overline">YOUR CASE NUMBER</span>
                      <h2>{submission.case.id}</h2>
                    </div>
                    <span className="status-pill">
                      {submission.case.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="status-body">
                    <div className="detail-row">
                      <span>Issue</span>
                      <strong>{submission.case.description}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Location</span>
                      <strong>{submission.case.location}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Assigned team</span>
                      <strong>
                        {submission.case.department ?? "Pending staff review"}
                      </strong>
                    </div>
                    <div className="detail-row">
                      <span>Next step</span>
                      <strong>{submission.explanation}</strong>
                    </div>
                  </div>
                  <div className="status-footer">
                    <span>
                      Submitted{" "}
                      {new Date(submission.case.createdAt).toLocaleString()}
                    </span>
                    <button className="secondary" onClick={refreshStatus}>
                      ↻ &nbsp;Refresh status
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty">
                  <span>◫</span>
                  <h2>No case in this session yet</h2>
                  <p>
                    Submit a report to receive a case number and see its
                    progress.
                  </p>
                  <button className="primary" onClick={() => setTab("report")}>
                    Report an issue →
                  </button>
                </div>
              )}
            </div>
          )}
          {tab === "workspace" && (
            <div className="page workspace">
              <div className="workspace-heading">
                <div>
                  <div className="eyebrow">
                    STAFF WORKSPACE <span className="eyebrow-line" />
                  </div>
                  <h1>
                    Case <em>overview.</em>
                  </h1>
                  <p className="lead">
                    Review incoming reports and move each case toward
                    resolution.
                  </p>
                </div>
                <button className="secondary" onClick={loadCases}>
                  ↻ &nbsp;Refresh queue
                </button>
              </div>
              <div className="metric-grid">
                <div className="metric">
                  <span>TOTAL CASES</span>
                  <strong>{cases.length}</strong>
                  <small>Submitted reports</small>
                </div>
                <div className="metric">
                  <span>OPEN BACKLOG</span>
                  <strong>{unresolved}</strong>
                  <small>Awaiting resolution</small>
                </div>
                <div className="metric">
                  <span>NEEDS REVIEW</span>
                  <strong>{review}</strong>
                  <small>Human classification check</small>
                </div>
                <div className="metric">
                  <span>ACTIVE CATEGORIES</span>
                  <strong>{categories.length}</strong>
                  <small>Taxonomy v{categories[0]?.version ?? 1}</small>
                </div>
              </div>
              <div className="queue">
                <div className="queue-title">
                  <h2>Recent cases</h2>
                  <span>{cases.length} records</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>CASE</th>
                        <th>ISSUE</th>
                        <th>DEPARTMENT</th>
                        <th>STATUS</th>
                        <th>CREATED</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cases.map((item) => (
                        <tr key={item.id} onClick={() => setSelected(item)}>
                          <td className="case-id">{item.id}</td>
                          <td className="issue">{item.description}</td>
                          <td>{item.department ?? "Unassigned"}</td>
                          <td>
                            <span className={`table-status ${item.status}`}>
                              {item.status.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {cases.length === 0 && (
                    <div className="table-empty">
                      No cases yet. Submit a resident report to populate the
                      queue.
                    </div>
                  )}
                </div>
              </div>
              {selected && (
                <div
                  className="drawer-backdrop"
                  onClick={() => setSelected(null)}
                >
                  <div
                    className="drawer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button className="close" onClick={() => setSelected(null)}>
                      ×
                    </button>
                    <div className="eyebrow">CASE DETAIL</div>
                    <h2>{selected.id}</h2>
                    <span className={`table-status ${selected.status}`}>
                      {selected.status.replaceAll("_", " ")}
                    </span>
                    <h3>Resident report</h3>
                    <p>{selected.description}</p>
                    <div className="detail-row">
                      <span>Location</span>
                      <strong>{selected.location}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Category</span>
                      <strong>
                        {categories.find(
                          (item) => item.id === selected.categoryId,
                        )?.name ?? "Pending"}
                      </strong>
                    </div>
                    <div className="detail-row">
                      <span>Department</span>
                      <strong>{selected.department ?? "Unassigned"}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Confidence</span>
                      <strong>
                        {selected.confidence === null
                          ? "—"
                          : `${Math.round(selected.confidence * 100)}%`}
                      </strong>
                    </div>
                    <h3>Next action</h3>
                    <div className="actions">
                      {(nextStatuses[selected.status] ?? []).map((status) => (
                        <button
                          key={status}
                          className="primary"
                          disabled={busy}
                          onClick={() => transition(status)}
                        >
                          {status.replaceAll("_", " ")} →
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === "taxonomy" && (
            <TaxonomyView
              categories={categories}
              adminHeaders={adminHeaders}
              onPublished={async () => {
                const result = await call<{ categories: Category[] }>(
                  "/api/taxonomy",
                );
                setCategories(result.categories);
              }}
            />
          )}
          {error && (
            <div className="toast" role="alert">
              {error}
              <button onClick={() => setError("")}>×</button>
            </div>
          )}
        </main>
      </div>
      <footer className="bottom">
        CivicResolve <span>·</span> A clearer path from report to resolution{" "}
        <span className="bottom-right">Built for communities, with care.</span>
      </footer>
    </div>
  );
}

function TaxonomyView({
  categories,
  adminHeaders,
  onPublished,
}: {
  categories: Category[];
  adminHeaders: () => Promise<Record<string, string>>;
  onPublished: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [routingTeam, setRoutingTeam] = useState("Roads");
  const [examples, setExamples] = useState("");
  const [publicExplanation, setPublicExplanation] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    expectedVersion: number;
    proposedVersion: number;
    evaluatedCases: number;
    changedCases: number;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function createDraft(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const result = await call<{ id: string }>("/api/admin/taxonomy/drafts", {
        method: "POST",
        headers: await adminHeaders(),
        body: JSON.stringify({
          name,
          description,
          routingTeam,
          publicExplanation,
          examples: examples
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
          exclusions: [],
          requiredFields: ["location"],
        }),
      });
      setDraftId(result.id);
      setPreview(null);
      setMessage(
        "Draft saved. Simulate it against recent cases before publishing.",
      );
    } catch (cause) {
      setMessage((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function simulate() {
    if (!draftId) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await call<typeof preview>(
        "/api/admin/taxonomy/simulate",
        {
          method: "POST",
          headers: await adminHeaders(),
          body: JSON.stringify({ draftId }),
        },
      );
      setPreview(result);
    } catch (cause) {
      setMessage((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!draftId || !preview) return;
    setBusy(true);
    setMessage("");
    try {
      await call("/api/admin/taxonomy/publish", {
        method: "POST",
        headers: await adminHeaders(),
        body: JSON.stringify({
          draftId,
          expectedVersion: preview.expectedVersion,
        }),
      });
      await onPublished();
      setDraftId(null);
      setPreview(null);
      setName("");
      setDescription("");
      setExamples("");
      setPublicExplanation("");
      setMessage(
        `Taxonomy version ${preview.proposedVersion} published. New reports use the updated definitions.`,
      );
    } catch (cause) {
      setMessage((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page workspace taxonomy-page">
      <div className="eyebrow">
        STAFF WORKSPACE <span className="eyebrow-line" />
      </div>
      <h1>
        Category <em>definitions.</em>
      </h1>
      <p className="lead">
        Published categories determine how new reports are assigned. Draft
        changes can be tested before they go live.
      </p>
      <div className="taxonomy-layout">
        <section className="queue taxonomy-list">
          <div className="queue-title">
            <h2>Published taxonomy</h2>
            <span>Version {categories[0]?.version ?? 1}</span>
          </div>
          {categories.map((item) => (
            <div className="category-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p>{item.description}</p>
              </div>
              <span>{item.routingTeam}</span>
            </div>
          ))}
        </section>
        <section className="form-card taxonomy-form">
          <div className="card-heading">
            <span className="card-icon">◇</span>
            <div>
              <h2>Draft a category</h2>
              <p>Describe the issue and who should receive it.</p>
            </div>
          </div>
          <form onSubmit={createDraft}>
            <label htmlFor="category-name">Category name</label>
            <input
              id="category-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Crosswalk signal"
            />
            <label htmlFor="category-description">Description</label>
            <textarea
              id="category-description"
              required
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Pedestrian crossing beacon malfunction"
            />
            <label htmlFor="category-examples">Examples, one per line</label>
            <textarea
              id="category-examples"
              value={examples}
              onChange={(event) => setExamples(event.target.value)}
              placeholder="Crosswalk signal is dark"
            />
            <label htmlFor="routing-team">Routing team</label>
            <input
              id="routing-team"
              required
              value={routingTeam}
              onChange={(event) => setRoutingTeam(event.target.value)}
            />
            <label htmlFor="public-explanation">Resident explanation</label>
            <input
              id="public-explanation"
              required
              value={publicExplanation}
              onChange={(event) => setPublicExplanation(event.target.value)}
              placeholder="Electrical will review this report."
            />
            <button className="primary" disabled={busy}>
              Save draft →
            </button>
          </form>
          {draftId && (
            <div className="draft-actions">
              <button className="secondary" disabled={busy} onClick={simulate}>
                Simulate on recent cases
              </button>
              {preview && (
                <div className="preview-card">
                  <strong>
                    Impact preview · version {preview.proposedVersion}
                  </strong>
                  <p>
                    {preview.changedCases} of {preview.evaluatedCases} recent
                    cases would change category.
                  </p>
                  <button className="primary" disabled={busy} onClick={publish}>
                    Publish version {preview.proposedVersion} →
                  </button>
                </div>
              )}
            </div>
          )}
          {message && (
            <p className="form-message" role="status">
              {message}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function AuthApp() {
  const { isAuthenticated, getAccessTokenSilently, loginWithRedirect, logout } =
    useAuth0();
  return (
    <App
      auth={{
        isAuthenticated,
        getToken: async () => {
          const token = await getAccessTokenSilently();
          if (!token) throw new Error("Authentication token unavailable");
          return token;
        },
        login: () => {
          void loginWithRedirect();
        },
        logout: () => {
          void logout({ logoutParams: { returnTo: window.location.origin } });
        },
      }}
    />
  );
}

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {domain && clientId && audience ? (
      <Auth0Provider
        domain={domain}
        clientId={clientId}
        authorizationParams={{ redirect_uri: window.location.origin, audience }}
      >
        <AuthApp />
      </Auth0Provider>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
