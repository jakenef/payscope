import { useState, useEffect } from "react";
import { analyzeCSV } from "./api/analyze";
import UploadZone from "./components/UploadZone";
import AuditScoreHero from "./components/AuditScoreHero";
import InfoPanel from "./components/InfoPanel";
import UnderpaymentTable from "./components/UnderpaymentTable";
import PayerChart from "./components/PayerChart";
import NarrativePanel from "./components/NarrativePanel";
import ChatPanel from "./components/ChatPanel";
import LandingContent from "./components/LandingContent";
import Hero from "./components/Hero";
import UserMenu from "./components/UserMenu";
import BenchmarkPanel from "./components/BenchmarkPanel";
import ContractsPanel from "./components/ContractsPanel";
import Footer from "./components/Footer";
import AuthModal from "./auth/AuthModal";
import { useAuth } from "./auth/AuthContext";
import { loadContracts } from "./contracts/store";

export default function App() {
  const { isAuthed, user } = useAuth();
  const [status, setStatus] = useState("idle");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [page, setPage] = useState("landing");

  useEffect(() => {
    if (isAuthed) setPage("app");
    else setPage("landing");
  }, [isAuthed]);

  const openAuth = (mode = "signin") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const goToApp = () => setPage("app");
  const goToLanding = () => setPage("landing");

  const handleUpload = async (file) => {
    setStatus("loading");
    setError(null);
    try {
      const result = await analyzeCSV(file, {
        specialty: user?.specialty,
        state: user?.state,
        contracts: loadContracts(user?.id),
      });
      setData(result);
      setStatus("done");
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  };

  const handleBack = () => {
    setStatus("idle");
    setData(null);
    setError(null);
  };

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* ── Header ──────────────────────────────── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "var(--bg-panel)",
          borderBottom: "1px solid var(--border)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "52px",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "baseline", gap: "12px", cursor: isAuthed ? "pointer" : "default" }}
          onClick={isAuthed ? goToLanding : undefined}
        >
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.35rem",
              color: "var(--text-bright)",
              letterSpacing: "0.01em",
            }}
          >
            Payscope
          </span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.65rem",
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--primary)",
            }}
          >
            Revenue Integrity
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {isAuthed && page === "landing" && (
            <button className="btn" onClick={goToApp}>
              Open App →
            </button>
          )}
          {isAuthed && page === "app" && (status === "done" || status === "error") && (
            <button className="btn" onClick={handleBack}>
              ← New Analysis
            </button>
          )}
          {isAuthed && page === "app" && <StatusBadge status={status} />}
          <UserMenu onSignInClick={() => openAuth("signin")} />
        </div>
      </header>

      {/* ── Landing page (accessible to all) ───── */}
      {page === "landing" && (
        <main
          style={{
            flex: 1,
            width: "100%",
            maxWidth: "1480px",
            margin: "0 auto",
            padding: "0 24px 48px",
          }}
        >
          <div
            className="fade-up"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Hero
              onPrimaryCta={isAuthed ? goToApp : () => openAuth("signup")}
              onSecondaryCta={isAuthed ? goToApp : () => openAuth("signin")}
            />
            <LandingContent onPlanCta={isAuthed ? goToApp : () => openAuth("signup")} />
          </div>
        </main>
      )}

      {/* ── App (authed) ────────────────────────── */}
      {isAuthed && page === "app" && (
        <main
          style={{
            flex: 1,
            width: "100%",
            maxWidth: "1480px",
            margin: "0 auto",
            padding: "28px 24px 48px",
          }}
        >
          {(status === "idle" || status === "error") && (
            <div
              className="fade-up"
              style={{
                paddingTop: "40px",
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "20px",
                maxWidth: "1080px",
                margin: "0 auto",
                alignItems: "start",
              }}
            >
              <div>
                <div className="panel">
                  <div className="panel-header">
                    Claims Analysis
                    <span className="panel-tag">Upload to begin</span>
                  </div>
                  <div style={{ padding: "24px 22px 22px" }}>
                    <p
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                        lineHeight: 1.6,
                        marginBottom: "20px",
                      }}
                    >
                      Upload a CSV or Excel file of submitted claims. Columns are
                      auto-detected, and underpayments and downcoding are
                      flagged using patterns in your own data.
                    </p>
                    <UploadZone onUpload={handleUpload} />
                  </div>
                </div>

                {status === "error" && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "10px 14px",
                      background: "var(--red-bg)",
                      border: "1px solid var(--red)",
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.78rem",
                      color: "var(--red)",
                    }}
                  >
                    {error}
                  </div>
                )}

                <div
                  style={{
                    marginTop: "20px",
                    display: "flex",
                    gap: "12px",
                    flexWrap: "wrap",
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.62rem",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-dim)",
                  }}
                >
                  <span>Self-Referential Analysis</span>
                  <span>·</span>
                  <span>GPT-4o Analysis</span>
                  <span>·</span>
                  <span>No data retained</span>
                </div>
              </div>

              <ContractsPanel />
            </div>
          )}

          {status === "loading" && (
            <div
              className="fade-up"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "calc(100vh - 160px)",
                gap: "16px",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.5rem",
                  color: "var(--text-bright)",
                  letterSpacing: "0.01em",
                }}
              >
                Analyzing claims data
                <span className="blink-cursor" />
              </div>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Detecting patterns and inconsistencies in your data
              </div>
            </div>
          )}

          {status === "done" && data && (
            <div
              className="fade-up"
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <AuditScoreHero summary={data.summary} />
              <div
                style={{
                  display: "flex",
                  gap: "20px",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ position: "sticky", top: "72px", alignSelf: "flex-start" }}>
                  <InfoPanel summary={data.summary} />
                </div>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                  }}
                >
                  {data.ai_narrative && (
                    <NarrativePanel narrative={data.ai_narrative} />
                  )}
                  <BenchmarkPanel benchmarks={data.benchmarks} />
                  {data.underpayment_table.length > 0 ? (
                    <UnderpaymentTable rows={data.underpayment_table} />
                  ) : (
                    <div className="panel">
                      <div className="panel-header">Audit Result</div>
                      <div
                        style={{
                          padding: "16px",
                          fontFamily: "var(--font-sans)",
                          fontSize: "0.82rem",
                          color: "var(--green)",
                        }}
                      >
                        No flagged claims — all payments at or above threshold.
                      </div>
                    </div>
                  )}
                  {data.payer_breakdown.length > 0 && (
                    <PayerChart payers={data.payer_breakdown} />
                  )}
                </div>
                <div style={{ position: "sticky", top: "72px", alignSelf: "flex-start" }}>
                  <ChatPanel analysis={data} />
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      <Footer />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    idle: { color: "var(--text-muted)", dot: "#4a8898", label: "Ready" },
    loading: { color: "var(--amber)", dot: "#f0a050", label: "Processing" },
    done: { color: "var(--green)", dot: "#52b788", label: "Complete" },
    error: { color: "var(--red)", dot: "#e05252", label: "Error" },
  };
  const { color, dot, label } = map[status] || map.idle;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: dot,
          display: "inline-block",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.7rem",
          fontWeight: 500,
          color,
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
    </div>
  );
}
