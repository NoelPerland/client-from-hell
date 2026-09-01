"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { ArrowLeft, Moon, Settings, Sparkles, Sun, Volume2, VolumeX } from "lucide-react";
import {
  answerScenario,
  createInitialGameState,
  getGameResult,
  scenarios,
  scoreAxisIds,
  type GameResult,
  type GameDebrief,
  type GameState,
  type ScenarioChoice,
  type ScenarioDefinition,
} from "@/lib/game";
import type { FinalWinningProposalInput } from "@/lib/proposales/types";
import { CommunityHub } from "./community-hub";

type HandoffState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "success"; message: string; url?: string; id: string; mode: string }
  | { status: "error"; message: string };

type DebriefState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; debrief: GameDebrief; source: "ai" | "fallback"; model?: string }
  | { status: "error"; message: string };

const axisLabels = {
  budget: "Budget fit",
  timeline: "Speed",
  trust: "Trust",
  morale: "Client mood",
  quality: "Proposal quality",
  scope: "Scope control",
} as const;

const axisShortLabels = {
  budget: "Budget",
  timeline: "Speed",
  trust: "Trust",
  morale: "Mood",
  quality: "Quality",
  scope: "Scope",
} as const;

const summaryMetrics = [
  { label: "Commercial", axes: ["budget", "scope"] as const },
  { label: "Client", axes: ["trust", "morale"] as const },
  { label: "Delivery", axes: ["timeline", "quality"] as const },
] as const;

const clientSprites = [
  { x: 23, y: 0 },
  { x: 24, y: 3 },
  { x: 23, y: 6 },
  { x: 24, y: 9 },
  { x: 23, y: 12 },
  { x: 24, y: 15 },
] as const;

const clientPreferenceHints: Record<string, string> = {
  "luxury-shoestring": "They want the feeling of luxury more than every luxury extra.",
  "conference-hard-cap": "They need choices they can defend to procurement.",
  "surprise-guests": "They accept added cost when the change feels fair and explicit.",
  "budget-cut": "They prefer a smart swap over a blanket discount.",
  "vip-joins": "They want VIP treatment isolated from the base package.",
  "final-approval": "They value a clear version and a clean path to yes.",
};

type DifficultyId = "easy" | "normal" | "hell";
type GameScreen = "home" | "playing";
type ThemeId = "dark" | "light";
type TransitionKind = "correct" | "okay" | "wrong";
type GameTransition = {
  phase: "answer" | "result";
  kind?: TransitionKind;
  choiceId?: string;
  scoreDelta?: number;
  previousRank?: string;
  nextRank?: string;
};

type ClientEmotion = "neutral" | "pleased" | "tense" | "furious";

const difficulties = {
  easy: {
    label: "Warm-up",
    badge: "Easy",
    description: "4 rounds. Client arrives caffeinated and briefly reasonable.",
    rounds: 4,
    sprite: { x: 25, y: 2 },
  },
  normal: {
    label: "Prime time",
    badge: "Normal",
    description: "5 rounds. Tight budgets, shifting scope, standard hotel chaos.",
    rounds: 5,
    sprite: { x: 25, y: 7 },
  },
  hell: {
    label: "No mercy",
    badge: "Hell",
    description: "All 6 rounds. Less patience, zero margin, one final surprise.",
    rounds: 6,
    sprite: { x: 25, y: 12 },
  },
} as const;

export function ClientFromHellGame() {
  const [screen, setScreen] = useState<GameScreen>("home");
  const [difficulty, setDifficulty] = useState<DifficultyId>("normal");
  const [theme, setTheme] = useState<ThemeId>("dark");
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [volume, setVolume] = useState(0.35);
  const [transition, setTransition] = useState<GameTransition | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [runId, setRunId] = useState(createRunId);
  const [state, setState] = useState<GameState>(() => createInitialGameState([]));
  const [lastChoice, setLastChoice] = useState<ScenarioChoice | null>(null);
  const [handoff, setHandoff] = useState<HandoffState>({
    status: "idle",
    message: "Win the run, then send the final proposal through the server-side adapter.",
  });
  const [debrief, setDebrief] = useState<DebriefState>({ status: "idle" });
  const musicRef = useRef<HTMLAudioElement>(null);
  const correctRef = useRef<HTMLAudioElement>(null);
  const wrongRef = useRef<HTMLAudioElement>(null);
  const selectRef = useRef<HTMLAudioElement>(null);
  const roundHeadingRef = useRef<HTMLHeadingElement>(null);
  const audioStartedRef = useRef(false);
  const transitionTimersRef = useRef<number[]>([]);

  useEffect(() => {
    if (musicRef.current) musicRef.current.volume = volume * 0.38;
  }, [volume]);

  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    const activeMusic = music;

    if (!musicEnabled) {
      music.pause();
      return;
    }

    function removeMusicUnlock() {
      window.removeEventListener("pointerdown", beginMusic);
      window.removeEventListener("keydown", beginMusic);
    }

    function beginMusic() {
      removeMusicUnlock();
      audioStartedRef.current = true;
      void activeMusic.play().catch(() => undefined);
    }

    void music.play().then(() => {
      audioStartedRef.current = true;
    }).catch(() => {
      window.addEventListener("pointerdown", beginMusic, { once: true });
      window.addEventListener("keydown", beginMusic, { once: true });
    });

    return removeMusicUnlock;
  }, [musicEnabled]);

  useEffect(
    () => () => {
      transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => window.cancelAnimationFrame(frame);
  }, [screen, state.currentScenarioId]);

  useEffect(() => {
    if (screen !== "playing" || isTransitioning) return;
    const frame = window.requestAnimationFrame(() => roundHeadingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isTransitioning, screen, state.currentScenarioId]);

  const activeScenarios = useMemo(
    () => scenarios.slice(0, difficulties[difficulty].rounds),
    [difficulty],
  );
  const result = useMemo(
    () => getGameResult(state, activeScenarios),
    [activeScenarios, state],
  );
  const currentScenario = state.currentScenarioId
    ? activeScenarios.find((scenario) => scenario.id === state.currentScenarioId)
    : null;
  const orderedChoices = useMemo(
    () =>
      currentScenario
        ? stableShuffle<ScenarioChoice>(currentScenario.choices, `${runId}:${currentScenario.id}`)
        : [],
    [currentScenario, runId],
  );
  const progress = Math.min(result.answeredCount + 1, result.scenarioCount);

  function choose(scenario: ScenarioDefinition, choice: ScenarioChoice) {
    if (isTransitioning) return;

    const nextState = answerScenario(state, scenario.id, choice.id, activeScenarios);
    const nextResult = getGameResult(nextState, activeScenarios);
    const previousRank = rankLetter(result.total);
    const nextRank = rankLetter(nextResult.total);
    const kind: TransitionKind =
      choice.outcome === "great" ? "correct" : choice.outcome === "okay" ? "okay" : "wrong";

    setIsTransitioning(true);
    setTransition({ phase: "answer", kind, choiceId: choice.id });
    setLastChoice(choice);
    playEffect(kind === "correct" ? correctRef : kind === "okay" ? selectRef : wrongRef);
    setHandoff({
      status: "idle",
      message:
        kind === "correct"
          ? "Strong move. The proposal stays commercially healthy."
          : kind === "okay"
            ? "Acceptable move. The client sees the tradeoff."
            : "Client pushback logged. Recover the deal in the next round.",
    });

    scheduleTransition(() => {
      setState(nextState);
      setLastChoice(null);
      setTransition({
        phase: "result",
        kind,
        choiceId: choice.id,
        scoreDelta: nextResult.total - result.total,
        previousRank,
        nextRank,
      });
    }, 900);

    scheduleTransition(() => {
      setTransition(null);
      setIsTransitioning(false);
    }, 2300);
  }

  function reset() {
    clearPendingTransition();
    setState(createInitialGameState(activeScenarios));
    setRunId(createRunId());
    setTransition(null);
    setIsTransitioning(false);
    setLastChoice(null);
    setDebrief({ status: "idle" });
    setHandoff({
      status: "idle",
      message: "New run ready. The inbox is quiet for approximately four seconds.",
    });
  }

  function startGame() {
    clearPendingTransition();
    startMusic();
    playEffect(selectRef);
    setState(createInitialGameState(activeScenarios));
    setRunId(createRunId());
    setTransition(null);
    setIsTransitioning(false);
    setLastChoice(null);
    setDebrief({ status: "idle" });
    setHandoff({
      status: "idle",
      message: `${difficulties[difficulty].badge} run armed. Keep the client happy and the scope contained.`,
    });
    setScreen("playing");
  }

  function openMenu() {
    clearPendingTransition();
    playEffect(selectRef);
    setScreen("home");
    setLastChoice(null);
    setTransition(null);
    setIsTransitioning(false);
    setDebrief({ status: "idle" });
  }

  function changeDifficulty(nextDifficulty: DifficultyId) {
    startMusic();
    playEffect(selectRef);
    setDifficulty(nextDifficulty);
  }

  function toggleTheme() {
    startMusic();
    playEffect(selectRef);
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  function toggleMusic() {
    audioStartedRef.current = true;
    const nextEnabled = !musicEnabled;
    setMusicEnabled(nextEnabled);

    if (nextEnabled) {
      void musicRef.current?.play().catch(() => undefined);
    } else {
      musicRef.current?.pause();
    }
  }

  function startMusic() {
    audioStartedRef.current = true;
    if (musicEnabled) void musicRef.current?.play().catch(() => undefined);
  }

  function playEffect(ref: RefObject<HTMLAudioElement | null>) {
    const sound = ref.current;
    if (!sound || volume === 0) return;
    sound.volume = volume;
    sound.currentTime = 0;
    void sound.play().catch(() => undefined);
  }

  function clearPendingTransition() {
    transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    transitionTimersRef.current = [];
  }

  function scheduleTransition(callback: () => void, delay: number) {
    const timer = window.setTimeout(() => {
      transitionTimersRef.current = transitionTimersRef.current.filter(
        (item) => item !== timer,
      );
      callback();
    }, delay);
    transitionTimersRef.current.push(timer);
  }

  const audioElements = (
    <div className="cfh-audio-assets" aria-hidden="true">
      <audio ref={musicRef} src="/audio/pixel-loop.ogg" preload="auto" loop />
      <audio ref={correctRef} src="/audio/correct.ogg" preload="auto" />
      <audio ref={wrongRef} src="/audio/wrong.ogg" preload="auto" />
      <audio ref={selectRef} src="/audio/select.ogg" preload="auto" />
    </div>
  );

  async function sendFinalProposal() {
    setHandoff({
      status: "loading",
      message: "Packaging the winning proposal for Proposales...",
    });

    try {
      const response = await fetch("/api/proposales/final-winning-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildFinalProposalPayload(state, result, runId)),
      });
      const body = (await response.json()) as {
        proposal?: { id: string; mode: string; url?: string };
        error?: string;
      };

      if (!response.ok || !body.proposal) {
        throw new Error(body.error ?? "Proposal handoff failed.");
      }

      setHandoff({
        status: "success",
        message:
          body.proposal.mode === "mock"
            ? "Mock proposal created. Add Proposales API credentials for live mode."
            : "Live proposal created in Proposales.",
        id: body.proposal.id,
        mode: body.proposal.mode,
        url: body.proposal.url,
      });
    } catch (error) {
      setHandoff({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to send the final proposal.",
      });
    }
  }

  async function generateDebrief() {
    if (state.status !== "complete") return;
    setDebrief({ status: "loading" });

    try {
      const response = await fetch("/api/ai/debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty, answers: state.answers }),
      });
      const body = (await response.json()) as {
        debrief?: GameDebrief;
        source?: "ai" | "fallback";
        model?: string;
        error?: string;
      };

      if (!response.ok || !body.debrief || !body.source) {
        throw new Error(body.error ?? "AI debrief unavailable.");
      }

      setDebrief({
        status: "success",
        debrief: body.debrief,
        source: body.source,
        model: body.model,
      });
    } catch (error) {
      setDebrief({
        status: "error",
        message: error instanceof Error ? error.message : "AI debrief unavailable.",
      });
    }
  }

  if (screen === "home") {
    return (
      <>
        {audioElements}
        <HomeScreen
          difficulty={difficulty}
          theme={theme}
          musicEnabled={musicEnabled}
          volume={volume}
          onDifficultyChange={changeDifficulty}
          onStart={startGame}
          onThemeToggle={toggleTheme}
          onMusicToggle={toggleMusic}
          onVolumeChange={setVolume}
        />
        <CommunityHub run={null} theme={theme} />
      </>
    );
  }

  const clientIndex = currentScenario
    ? Math.max(0, activeScenarios.findIndex((scenario) => scenario.id === currentScenario.id))
    : Math.max(0, result.scenarioCount - 1);
  const bossSprite = clientSprites[clientIndex % clientSprites.length];
  const clientPreferenceHint = currentScenario
    ? clientPreferenceHints[currentScenario.id]
    : "They are ready for a clear handoff.";
  const hellIntensity =
    difficulty === "hell"
      ? Math.min(
          1,
          0.12 +
            (result.answeredCount / Math.max(1, result.scenarioCount - 1)) * 0.55 +
            ((100 - result.axes.morale) / 100) * 0.33,
        )
      : 0;
  const hellLevel =
    hellIntensity >= 0.72 ? "critical" : hellIntensity >= 0.4 ? "rising" : "low";
  const clientEmotion = getClientEmotion(result, transition);
  const resultDelta = transition?.phase === "result" ? lastChoice?.delta : undefined;
  const rankChanged =
    transition?.phase === "result" &&
    transition.previousRank !== transition.nextRank;
  const rankDirection = rankChanged
    ? (transition.scoreDelta ?? 0) >= 0
      ? "up"
      : "down"
    : null;

  return (
    <>
      {audioElements}
      <main
        className={`cfh-shell cfh-theme-${theme}${difficulty === "hell" ? ` cfh-hell cfh-hell-${hellLevel}` : ""}${transition?.kind ? ` cfh-answer-${transition.kind}` : ""}`}
        style={{ "--hell-intensity": hellIntensity } as CSSProperties}
      >
      {transition ? <GameTransitionOverlay transition={transition} /> : null}
      <header className="cfh-topbar">
        <div>
          <span className="cfh-kicker">Proposales API case</span>
          <h1>Client From Hell</h1>
        </div>
        <div className="cfh-topbar-actions">
          <AudioControls
            compact
            theme={theme}
            musicEnabled={musicEnabled}
            volume={volume}
            onThemeToggle={toggleTheme}
            onMusicToggle={toggleMusic}
            onVolumeChange={setVolume}
          />
          {difficulty === "hell" ? (
            <div
              className="cfh-pressure"
              role="progressbar"
              aria-label="Hell pressure"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(hellIntensity * 100)}
            >
              <span>Hell pressure</span>
              <div><i style={{ width: `${hellIntensity * 100}%` }} /></div>
            </div>
          ) : null}
          <span className={`cfh-difficulty-chip cfh-difficulty-${difficulty}`}>
            {difficulties[difficulty].badge}
          </span>
          <div className="cfh-round" aria-label={`Round ${progress} of ${result.scenarioCount}`}>
            Round {progress}/{result.scenarioCount}
          </div>
          <button type="button" className="cfh-icon-button" onClick={openMenu} aria-label="Back to menu" title="Back to menu">
            <ArrowLeft aria-hidden="true" size={19} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <section className="cfh-playfield">
        <aside className="cfh-panel cfh-boss" aria-label="Client brief">
          <div className={`cfh-avatar-stage is-${clientEmotion}`} aria-label={`Client emotion: ${clientEmotion}`}>
            <PixelSprite key={currentScenario?.id ?? "final-client"} x={bossSprite.x} y={bossSprite.y} className="cfh-boss-sprite" />
            <button
              type="button"
              className="cfh-alert"
              aria-label="Client preference hint"
              aria-describedby="client-preference-hint"
            >
              !
            </button>
            <span id="client-preference-hint" className="cfh-client-hint" role="tooltip">
              {clientPreferenceHint}
            </span>
            <span className="cfh-emotion-label">{emotionLabel(clientEmotion)}</span>
          </div>
          {currentScenario ? (
            <div className="cfh-request">
              <span className="cfh-kicker">Guest request</span>
              <h2 ref={roundHeadingRef} tabIndex={-1}>{currentScenario.title}</h2>
              <p>{currentScenario.clientMessage}</p>
            </div>
          ) : (
            <div className="cfh-request cfh-request-complete">
              <span className="cfh-kicker">Negotiation complete</span>
              <h2 ref={roundHeadingRef} tabIndex={-1}>Client verdict locked</h2>
            </div>
          )}
        </aside>

        <section className="cfh-panel cfh-console" aria-label="Proposal decisions">
          {currentScenario ? (
            <>
              <div className="cfh-console-head">
                <span className="cfh-kicker">Choose the proposal move</span>
                <strong><b>{result.total}</b><small>/100</small></strong>
              </div>
              <div className="cfh-choice-grid">
                {orderedChoices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className={`cfh-choice cfh-tone-${choice.tone}${transition?.choiceId === choice.id && transition.kind ? ` is-${transition.kind}` : ""}`}
                    onClick={() => choose(currentScenario, choice)}
                    disabled={isTransitioning}
                  >
                    <span>{choice.tone}</span>
                    <strong>{choice.label}</strong>
                    <em>{choice.response}</em>
                    <StatPreview delta={choice.delta} />
                  </button>
                ))}
              </div>
              <div className="cfh-reaction" aria-live="polite">
                <span className="cfh-kicker">Client reaction</span>
                <p>
                  {lastChoice
                    ? reactionFor(lastChoice, result)
                    : "The client is waiting. Make the first move count."}
                </p>
              </div>
            </>
          ) : (
            <FinalScreen
              result={result}
              handoff={handoff}
              debrief={debrief}
              onReset={reset}
              onSend={sendFinalProposal}
              onDebrief={generateDebrief}
              onMenu={openMenu}
            />
          )}
        </section>

        <aside className="cfh-panel cfh-scoreboard" aria-label="Scoreboard">
          <div className={`cfh-rank${transition?.phase === "result" ? " is-updating" : ""}${rankChanged ? ` is-changing is-rank-${rankDirection}` : ""}`}>
            <span>Rank</span>
            <strong key={rankLetter(result.total)}>{rankLetter(result.total)}</strong>
          </div>
          {summaryMetrics.map((metric) => (
            <Meter
              key={metric.label}
              label={metric.label}
              value={averagePair(result.axes, metric.axes)}
              delta={resultDelta ? averagePair(resultDelta, metric.axes) : undefined}
            />
          ))}
        </aside>
      </section>
      </main>
      <CommunityHub
        theme={theme}
        run={state.status === "complete" ? { runId, difficulty, answers: state.answers } : null}
      />
    </>
  );
}

function createRunId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replaceAll("-", "")
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function HomeScreen({
  difficulty,
  theme,
  musicEnabled,
  volume,
  onDifficultyChange,
  onStart,
  onThemeToggle,
  onMusicToggle,
  onVolumeChange,
}: {
  difficulty: DifficultyId;
  theme: ThemeId;
  musicEnabled: boolean;
  volume: number;
  onDifficultyChange: (difficulty: DifficultyId) => void;
  onStart: () => void;
  onThemeToggle: () => void;
  onMusicToggle: () => void;
  onVolumeChange: (volume: number) => void;
}) {
  return (
    <main className={`cfh-home cfh-theme-${theme}`}>
      <AudioControls
        theme={theme}
        musicEnabled={musicEnabled}
        volume={volume}
        onThemeToggle={onThemeToggle}
        onMusicToggle={onMusicToggle}
        onVolumeChange={onVolumeChange}
      />
      <div className="cfh-home-scene" aria-hidden="true">
        <div className="cfh-skyline" />
        <PixelSprite x={25} y={2} className="cfh-home-client cfh-client-one" />
        <PixelSprite x={25} y={7} className="cfh-home-client cfh-client-two" />
        <PixelSprite x={25} y={12} className="cfh-home-client cfh-client-three" />
      </div>

      <section className="cfh-home-content">
        <span className="cfh-kicker">A proposal negotiation game</span>
        <h1>Client from hell</h1>
        <p className="cfh-home-copy">
          Survive impossible briefs. Protect the budget. Ship a proposal before the client changes everything again.
        </p>

        <fieldset className="cfh-difficulty-picker">
          <legend>Choose difficulty</legend>
          <div className="cfh-difficulty-grid">
            {(Object.keys(difficulties) as DifficultyId[]).map((id) => {
              const option = difficulties[id];
              const selected = difficulty === id;

              return (
                <button
                  key={id}
                  type="button"
                  className={`cfh-difficulty-card cfh-difficulty-${id}${selected ? " is-selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => onDifficultyChange(id)}
                >
                  <PixelSprite x={option.sprite.x} y={option.sprite.y} />
                  <span>{option.label}</span>
                  <strong>{option.badge}</strong>
                  <em>{option.description}</em>
                </button>
              );
            })}
          </div>
        </fieldset>

        <button type="button" className="cfh-start-button" onClick={onStart}>
          Start negotiation <span aria-hidden="true">&gt;&gt;</span>
        </button>
      </section>

      <footer className="cfh-art-credit">
        Art + audio: CC0 sources
      </footer>
    </main>
  );
}

function AudioControls({
  theme,
  musicEnabled,
  volume,
  compact = false,
  onThemeToggle,
  onMusicToggle,
  onVolumeChange,
}: {
  theme: ThemeId;
  musicEnabled: boolean;
  volume: number;
  compact?: boolean;
  onThemeToggle: () => void;
  onMusicToggle: () => void;
  onVolumeChange: (volume: number) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeSettings(event: PointerEvent) {
      const details = detailsRef.current;
      if (details?.open && !details.contains(event.target as Node)) {
        details.open = false;
      }
    }

    function closeSettingsWithKeyboard(event: KeyboardEvent) {
      const details = detailsRef.current;
      if (event.key !== "Escape" || !details?.open) return;
      event.preventDefault();
      details.open = false;
      details.querySelector<HTMLElement>("summary")?.focus();
    }

    document.addEventListener("pointerdown", closeSettings);
    document.addEventListener("keydown", closeSettingsWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeSettings);
      document.removeEventListener("keydown", closeSettingsWithKeyboard);
    };
  }, []);

  return (
    <details ref={detailsRef} className={`cfh-settings${compact ? " is-compact" : ""}`}>
      <summary aria-label="Open game settings" title="Settings">
        <Settings aria-hidden="true" size={19} strokeWidth={2.4} />
      </summary>
      <div className="cfh-settings-menu" aria-label="Game settings">
        <div className="cfh-settings-title">
          <span>Settings</span>
          <small>{theme} mode</small>
        </div>
        <button type="button" onClick={onThemeToggle} aria-label={`Use ${theme === "dark" ? "light" : "dark"} mode`}>
          {theme === "dark" ? <Sun aria-hidden="true" size={17} /> : <Moon aria-hidden="true" size={17} />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <button type="button" onClick={onMusicToggle} aria-pressed={musicEnabled}>
          {musicEnabled ? <Volume2 aria-hidden="true" size={17} /> : <VolumeX aria-hidden="true" size={17} />}
          {musicEnabled ? "Music on" : "Music off"}
        </button>
        <label>
          <span>Volume <b>{Math.round(volume * 100)}%</b></span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            aria-label="Volume"
            aria-valuetext={`${Math.round(volume * 100)} percent`}
            onInput={(event) => onVolumeChange(Number(event.currentTarget.value))}
          />
        </label>
      </div>
    </details>
  );
}

function GameTransitionOverlay({ transition }: { transition: GameTransition }) {
  if (transition.phase === "result") {
    const positive = (transition.scoreDelta ?? 0) >= 0;

    return (
      <div className={`cfh-transition-card is-result is-${transition.kind}`} role="status" aria-live="polite">
        <strong>{positive ? "+" : ""}{transition.scoreDelta} score</strong>
      </div>
    );
  }

  const label =
    transition.kind === "correct" ? "Right" : transition.kind === "okay" ? "Okay" : "Wrong";
  return (
    <div className={`cfh-answer-burst is-${transition.kind}`} role="status" aria-live="polite">
      <span className="cfh-answer-symbol" aria-hidden="true" />
      <strong>{label}</strong>
    </div>
  );
}

function StatPreview({ delta }: { delta: ScenarioChoice["delta"] }) {
  const effects = scoreAxisIds
    .map((axis) => ({ axis, value: delta[axis] ?? 0 }))
    .filter(({ value }) => value !== 0);
  const strongestPositive = effects
    .filter(({ value }) => value > 0)
    .sort((a, b) => b.value - a.value)[0];
  const strongestNegative = effects
    .filter(({ value }) => value < 0)
    .sort((a, b) => a.value - b.value)[0];
  const visibleEffects = [strongestPositive, strongestNegative].filter(
    (effect): effect is NonNullable<typeof effect> => Boolean(effect),
  );

  return (
    <div
      className="cfh-stat-preview"
      aria-label={`Predicted changes: ${visibleEffects
        .map(({ axis, value }) => `${axisLabels[axis]} ${value > 0 ? "+" : ""}${value}`)
        .join(", ")}.`}
    >
      {visibleEffects.map(({ axis, value }) => {
        return (
          <span
            key={axis}
            className={value > 0 ? "is-positive" : "is-negative"}
          >
            {axisShortLabels[axis]}
            <b>{value > 0 ? "+" : ""}{value}</b>
          </span>
        );
      })}
    </div>
  );
}

function stableShuffle<T>(items: readonly T[], seed: string): T[] {
  const shuffled = [...items];
  let state = hashString(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function averagePair(
  values: Partial<Record<(typeof scoreAxisIds)[number], number>>,
  axes: readonly [(typeof scoreAxisIds)[number], (typeof scoreAxisIds)[number]],
): number {
  return Math.round(((values[axes[0]] ?? 0) + (values[axes[1]] ?? 0)) / 2);
}

function PixelSprite({
  x,
  y,
  className = "",
}: {
  x: number;
  y: number;
  className?: string;
}) {
  return (
    <span
      className={`cfh-pixel-sprite ${className}`}
      style={{ "--sprite-x": x, "--sprite-y": y } as CSSProperties}
      aria-hidden="true"
    />
  );
}

function FinalScreen({
  result,
  handoff,
  debrief,
  onReset,
  onSend,
  onDebrief,
  onMenu,
}: {
  result: GameResult;
  handoff: HandoffState;
  debrief: DebriefState;
  onReset: () => void;
  onSend: () => void;
  onDebrief: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="cfh-final">
      <span className="cfh-kicker">Final proposal ready</span>
      <h2>{result.rank.title}</h2>
      <p>{result.rank.summary}</p>
      <div className="cfh-final-score">{result.total}/100</div>
      <section className="cfh-ai-debrief" aria-live="polite">
        <header>
          <span><Sparkles aria-hidden="true" size={17} /> AI negotiation debrief</span>
          {debrief.status === "success" ? (
            <small>{debrief.source === "ai" ? debrief.model ?? "AI generated" : "Coach fallback"}</small>
          ) : null}
        </header>
        {debrief.status === "idle" ? (
          <button type="button" onClick={onDebrief}>
            <Sparkles aria-hidden="true" size={17} /> Generate AI debrief
          </button>
        ) : null}
        {debrief.status === "loading" ? <p>Reviewing your negotiation...</p> : null}
        {debrief.status === "error" ? (
          <div>
            <p>{debrief.message}</p>
            <button type="button" onClick={onDebrief}>Try again</button>
          </div>
        ) : null}
        {debrief.status === "success" ? (
          <div className="cfh-debrief-result">
            <strong>{debrief.debrief.verdict}</strong>
            <dl>
              <div><dt>Strength</dt><dd>{debrief.debrief.strength}</dd></div>
              <div><dt>Risk</dt><dd>{debrief.debrief.risk}</dd></div>
              <div><dt>Next move</dt><dd>{debrief.debrief.nextMove}</dd></div>
            </dl>
          </div>
        ) : null}
      </section>
      <div className="cfh-actions">
        <button type="button" onClick={onMenu}>
          Menu
        </button>
        <button type="button" onClick={onReset}>
          Replay
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={handoff.status === "loading"}
        >
          {handoff.status === "loading" ? "Creating draft..." : "Create Proposales draft"}
        </button>
      </div>
    </div>
  );
}

function getClientEmotion(
  result: GameResult,
  transition: GameTransition | null,
): ClientEmotion {
  if (transition?.phase === "answer") {
    return transition.kind === "correct"
      ? "pleased"
      : transition.kind === "okay"
        ? "tense"
        : "furious";
  }

  if (result.axes.morale >= 72) return "pleased";
  if (result.axes.morale <= 35) return "furious";
  if (result.axes.morale <= 52) return "tense";
  return "neutral";
}

function emotionLabel(emotion: ClientEmotion) {
  if (emotion === "pleased") return "Client approves";
  if (emotion === "furious") return "Client furious";
  if (emotion === "tense") return "Client tense";
  return "Client watching";
}

function Meter({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta?: number;
}) {
  const tone = value >= 72 ? "good" : value >= 48 ? "warn" : "danger";

  return (
    <div className="cfh-meter">
      <div>
        <span>{label}</span>
        <span className="cfh-meter-value">
          {delta ? (
            <i className={delta > 0 ? "is-positive" : "is-negative"}>
              {delta > 0 ? "+" : ""}{delta}
            </i>
          ) : null}
          <strong key={value}>{value}</strong>
        </span>
      </div>
      <div
        className="cfh-meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span className={`cfh-meter-fill ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function buildFinalProposalPayload(
  state: GameState,
  result: GameResult,
  runId: string,
): FinalWinningProposalInput {
  const chosenMoves = state.answers.map((answer) => {
    const scenario = scenarios.find((item) => item.id === answer.scenarioId);
    const choice = scenario?.choices.find((item) => item.id === answer.choiceId);

    return {
      scenarioTitle: scenario?.title ?? answer.scenarioId,
      choiceLabel: choice?.label ?? answer.choiceId,
      response: choice?.response ?? "Decision recorded.",
    };
  });

  return {
    title: `Client From Hell - ${result.rank.title}`,
    client: {
      name: "Demo Events Client",
      company: "Hospitality RFP Simulator",
    },
    projectSummary:
      "Interactive proposal game result for a Groups, Meetings & Events negotiation scenario.",
    scope: chosenMoves.map(
      (move) => `${move.scenarioTitle}: ${move.choiceLabel} - ${move.response}`,
    ),
    lineItems: [
      {
        name: "Event package and venue experience",
        quantity: 1,
        total: { amount: Math.max(12000, result.axes.quality * 520), currency: "EUR" },
      },
      {
        name: "Room block and guest logistics",
        quantity: 1,
        total: { amount: Math.max(8000, result.axes.scope * 380), currency: "EUR" },
      },
      {
        name: "VIP negotiation and proposal versioning",
        quantity: 1,
        total: { amount: Math.max(4500, result.axes.trust * 240), currency: "EUR" },
      },
    ],
    total: {
      amount:
        Math.max(12000, result.axes.quality * 520) +
        Math.max(8000, result.axes.scope * 380) +
        Math.max(4500, result.axes.trust * 240),
      currency: "EUR",
    },
    acceptedBy: "Client From Hell",
    acceptedAt: new Date().toISOString(),
    sourceProposalId: `cfh-${runId}`,
    metadata: {
      game: "client-from-hell",
      totalScore: result.total,
      rank: result.rank.title,
      answeredCount: result.answeredCount,
    },
  };
}

function rankLetter(total: number) {
  if (total >= 85) return "S";
  if (total >= 70) return "A";
  if (total >= 55) return "B";
  if (total >= 40) return "C";
  return "D";
}

function reactionFor(choice: ScenarioChoice, result: GameResult) {
  if (choice.tone === "risky") {
    return "The client smiles, procurement opens a second tab, and your margin starts sweating.";
  }

  if (choice.tone === "generous") {
    return "They love the flexibility. The proposal quietly asks who is paying for all this kindness.";
  }

  if (result.total >= 78) {
    return "The client acts difficult, but the proposal gives them a clean path to yes.";
  }

  return "Useful move. Now keep the experience premium without letting the scope leak.";
}
