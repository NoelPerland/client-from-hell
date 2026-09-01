"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import type { GameDifficulty, ScenarioAnswer } from "@/lib/game";

type Player = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
};

type LeaderboardEntry = {
  id: string;
  position: number;
  playerName: string;
  score: number;
  difficulty: GameDifficulty;
  rank: string;
  achievedAt: string;
};

type SavedScore = {
  _id?: string;
  id?: string;
  score: number;
  difficulty: GameDifficulty;
  rank: string;
  createdAt: string;
};

export type CompletedRun = {
  runId: string;
  difficulty: GameDifficulty;
  answers: readonly ScenarioAnswer[];
};

type Dialog = "closed" | "auth" | "leaderboard" | "account";
type AuthMode = "login" | "signup";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body.error === "string" ? body.error : "Request failed";
    throw new Error(message);
  }
  return body as T;
}

export function CommunityHub({
  run,
  theme,
  inline = false,
}: {
  run: CompletedRun | null;
  theme: "dark" | "light";
  inline?: boolean;
}) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [dialog, setDialog] = useState<Dialog>("closed");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [difficulty, setDifficulty] = useState<GameDifficulty>(run?.difficulty ?? "normal");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myScores, setMyScores] = useState<SavedScore[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [savedRunId, setSavedRunId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    void api<{ user: Player }>("/api/v1/auth/me")
      .then(({ user }) => setPlayer(user))
      .catch(() => setPlayer(null))
      .finally(() => setSessionReady(true));
  }, []);

  useEffect(() => {
    if (dialog === "closed") return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const root = dialogRef.current;
    root?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDialog("closed");
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [dialog]);

  const loadLeaderboard = useCallback(async (nextDifficulty: GameDifficulty) => {
    setBusy(true);
    setMessage("");
    try {
      const data = await api<{ entries: LeaderboardEntry[] }>(
        `/api/v1/scores/leaderboard?difficulty=${nextDifficulty}&limit=20`,
      );
      setEntries(data.entries);
    } catch (error) {
      setEntries([]);
      setMessage(error instanceof Error ? error.message : "Leaderboard unavailable");
    } finally {
      setBusy(false);
    }
  }, []);

  async function openLeaderboard() {
    const selected = run?.difficulty ?? difficulty;
    setDifficulty(selected);
    setDialog("leaderboard");
    await loadLeaderboard(selected);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (new TextEncoder().encode(password).length > 72) {
      setMessage("Password must be 10-72 UTF-8 bytes.");
      return;
    }
    setBusy(true);
    const payload = {
      email: String(form.get("email") ?? ""),
      password,
      ...(authMode === "signup"
        ? { displayName: String(form.get("displayName") ?? "") }
        : {}),
    };

    try {
      const { user } = await api<{ user: Player }>(`/api/v1/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setPlayer(user);
      setDialog("closed");
      if (run && savedRunId !== run.runId) {
        await saveRun(user);
      } else {
        setMessage("");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveRun(activePlayer: Player | null = player) {
    if (!run) return;
    if (!activePlayer) {
      setAuthMode("login");
      setMessage("Log in, then save this run.");
      setDialog("auth");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const { score } = await api<{ score: SavedScore }>("/api/v1/scores", {
        method: "POST",
        body: JSON.stringify({
          runId: run.runId,
          difficulty: run.difficulty,
          answers: run.answers,
        }),
      });
      setSavedRunId(run.runId);
      setMessage(`Saved ${score.score} points. Rank ${score.rank}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save score");
    } finally {
      setBusy(false);
    }
  }

  async function openAccount() {
    setDialog("account");
    setMessage("");
    try {
      const data = await api<{ scores: SavedScore[] }>("/api/v1/scores/mine?limit=10");
      setMyScores(data.scores);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load scores");
    }
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = String(new FormData(event.currentTarget).get("displayName") ?? "");
    setBusy(true);
    try {
      const { user } = await api<{ user: Player }>("/api/v1/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ displayName }),
      });
      setPlayer(user);
      setMessage("Player name updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api<null>("/api/v1/auth/logout", { method: "POST" }).catch(() => null);
    setPlayer(null);
    setDialog("closed");
    setMessage("");
  }

  async function deleteAccount() {
    if (!window.confirm("Delete your account and every saved score?")) return;
    setBusy(true);
    try {
      await api<null>("/api/v1/auth/account", { method: "DELETE" });
      setPlayer(null);
      setDialog("closed");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteScore(scoreId: string) {
    setBusy(true);
    try {
      await api<null>(`/api/v1/scores/${scoreId}`, { method: "DELETE" });
      setMyScores((scores) => scores.filter((score) => (score.id ?? score._id) !== scoreId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`cfh-community-root cfh-theme-${theme}${inline ? " is-inline" : ""}`}>
      <div className="cfh-community-bar" aria-label="Player and leaderboard">
        <button type="button" onClick={() => void openLeaderboard()}>Top scores</button>
        {sessionReady ? (
          player ? (
            <button type="button" onClick={() => void openAccount()}>{player.displayName}</button>
          ) : (
            <button type="button" onClick={() => { setMessage(""); setDialog("auth"); }}>Log in</button>
          )
        ) : null}
        {sessionReady && !player && run ? <span>Log in to add a high score</span> : null}
        {run ? (
          <button
            type="button"
            className="is-save cfh-bar-save"
            data-save-score
            disabled={busy || savedRunId === run.runId}
            onClick={() => void saveRun()}
          >
            {savedRunId === run.runId ? "Score saved" : "Save score"}
          </button>
        ) : null}
      </div>

      {message && dialog === "closed" ? <div className="cfh-community-toast" role="status">{message}</div> : null}

      {dialog !== "closed" ? (
        <div className="cfh-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDialog("closed");
        }}>
          <section ref={dialogRef} tabIndex={-1} className="cfh-community-dialog" role="dialog" aria-modal="true" aria-labelledby="community-title">
            <button className="cfh-dialog-close" type="button" aria-label="Close" onClick={() => setDialog("closed")}>x</button>

            {dialog === "auth" ? (
              <>
                <h2 id="community-title">Player access</h2>
                <div className="cfh-auth-tabs" aria-label="Account action">
                  <button type="button" aria-pressed={authMode === "login"} onClick={() => { setAuthMode("login"); setMessage(""); }}>Log in</button>
                  <button type="button" aria-pressed={authMode === "signup"} onClick={() => { setAuthMode("signup"); setMessage(""); }}>Sign up</button>
                </div>
                <form className="cfh-auth-form" onSubmit={submitAuth}>
                  {authMode === "signup" ? <label>Player name<input name="displayName" minLength={2} maxLength={32} required autoComplete="nickname" /></label> : null}
                  <label>Email<input name="email" type="email" maxLength={254} required autoComplete="email" /></label>
                  <label>Password<input name="password" type="password" minLength={10} maxLength={72} required autoComplete={authMode === "login" ? "current-password" : "new-password"} /></label>
                  <button type="submit" disabled={busy}>{busy ? "Working..." : authMode === "login" ? "Log in" : "Create player"}</button>
                </form>
              </>
            ) : null}

            {dialog === "leaderboard" ? (
              <>
                <h2 id="community-title">Leaderboard</h2>
                <div className="cfh-board-filters" aria-label="Difficulty filter">
                  {(["easy", "normal", "hell"] as const).map((item) => (
                    <button key={item} type="button" aria-pressed={difficulty === item} onClick={() => { setDifficulty(item); void loadLeaderboard(item); }}>{item}</button>
                  ))}
                </div>
                <div className="cfh-board-wrap">
                  <table>
                    <thead><tr><th>#</th><th>Player</th><th>Score</th><th>Rank</th></tr></thead>
                    <tbody>
                      {entries.map((entry) => <tr key={entry.id}><td>{entry.position}</td><td>{entry.playerName}</td><td>{entry.score}</td><td>{entry.rank}</td></tr>)}
                    </tbody>
                  </table>
                  {!busy && entries.length === 0 && !message ? <p>No scores yet. Take first place.</p> : null}
                </div>
              </>
            ) : null}

            {dialog === "account" && player ? (
              <>
                <h2 id="community-title">Player profile</h2>
                <p className="cfh-account-email">{player.email}</p>
                <form className="cfh-auth-form is-inline" onSubmit={updateProfile}>
                  <label>Player name<input name="displayName" minLength={2} maxLength={32} defaultValue={player.displayName} required /></label>
                  <button type="submit" disabled={busy}>Update</button>
                </form>
                <h3>Recent scores</h3>
                <ul className="cfh-score-history">
                  {myScores.map((score) => {
                    const id = score.id ?? score._id ?? "";
                    return <li key={id}><span>{score.difficulty} / {score.score} / {score.rank}</span><button type="button" aria-label={`Delete ${score.score} point score`} onClick={() => void deleteScore(id)}>x</button></li>;
                  })}
                  {myScores.length === 0 ? <li>No saved runs.</li> : null}
                </ul>
                <div className="cfh-account-actions">
                  <button type="button" onClick={() => void logout()}>Log out</button>
                  <button type="button" className="is-danger" disabled={busy} onClick={() => void deleteAccount()}>Delete account</button>
                </div>
              </>
            ) : null}

            {message ? <p className="cfh-community-message" role="status">{message}</p> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
