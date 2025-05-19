import React, { useState, useEffect, useRef } from "react";

// Choices and Emojis
const choices = [
  { name: "rock", emoji: "✊" },
  { name: "paper", emoji: "📄" },
  { name: "scissors", emoji: "✂️" },
];
const clickSoundUrl = "/sounds/rock.wav";    // or whichever sound you want for click
const winSoundUrl = "/sounds/paper.wav";     // or pick any sound for win
const loseSoundUrl = "/sounds/scissor.wav";  // pick a sound for lose
const drawSoundUrl = "/sounds/rock.wav";     // pick any sound for draw

const playSound = (url) => {
  const sound = new Audio(url);
  sound.volume = 0.4;
  sound.play();
};

// Determine winner for a single round
const getResult = (p1, p2) => {
  if (p1 === p2) return "draw";
  if (
    (p1 === "rock" && p2 === "scissors") ||
    (p1 === "paper" && p2 === "rock") ||
    (p1 === "scissors" && p2 === "paper")
  )
    return "win";
  return "lose";
};

// AI difficulty move generation
const getAIMove = (difficulty, playerHistory, computerHistory) => {
  // difficulty: "easy" | "medium" | "hard"
  // easy: random
  if (difficulty === "easy") {
    return choices[Math.floor(Math.random() * choices.length)].name;
  }
  // medium: basic counter to player's last move
  if (difficulty === "medium") {
    if (playerHistory.length === 0) return choices[Math.floor(Math.random() * 3)].name;
    const lastPlayerMove = playerHistory[playerHistory.length - 1];
    // AI tries to counter last player move
    if (lastPlayerMove === "rock") return "paper";
    if (lastPlayerMove === "paper") return "scissors";
    if (lastPlayerMove === "scissors") return "rock";
  }
  // hard: tries to predict based on player's frequency
  if (difficulty === "hard") {
    if (playerHistory.length === 0) return choices[Math.floor(Math.random() * 3)].name;
    const freq = { rock: 0, paper: 0, scissors: 0 };
    playerHistory.forEach((move) => freq[move]++);
    // find most frequent move by player
    const maxMove = Object.entries(freq).reduce((a, b) =>
      a[1] > b[1] ? a : b
    )[0];
    // AI counters that move
    if (maxMove === "rock") return "paper";
    if (maxMove === "paper") return "scissors";
    if (maxMove === "scissors") return "rock";
  }
  // fallback
  return choices[Math.floor(Math.random() * choices.length)].name;
};

// Theme styles
const themes = {
  light: {
    background: "#fefefe",
    textColor: "#222",
    buttonBg: "#764ba2",
    buttonColor: "#fff",
    resultWin: "#4ade80",
    resultLose: "#f87171",
    resultDraw: "#fbbf24",
  },
  dark: {
    background: "#1a1a2e",
    textColor: "#eee",
    buttonBg: "#764ba2",
    buttonColor: "#fff",
    resultWin: "#4ade80",
    resultLose: "#f87171",
    resultDraw: "#fbbf24",
  },
};

const MAX_ROUNDS = 5;
const MOVE_TIME_LIMIT = 7; // seconds per move

export default function App() {
  // === STATES ===
  const [theme, setTheme] = useState(() => localStorage.getItem("rpsTheme") || "dark");

  const [mode, setMode] = useState("single"); // single | multi
  const [aiDifficulty, setAIDifficulty] = useState("medium"); // easy | medium | hard

  const [round, setRound] = useState(1);
  const [player1Choice, setPlayer1Choice] = useState(null);
  const [player2Choice, setPlayer2Choice] = useState(null);
  const [result, setResult] = useState(null); // win/lose/draw for player1
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem("rpsHistory") || "[]"));

  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);

  const [isThinking, setIsThinking] = useState(false);
  const [timer, setTimer] = useState(MOVE_TIME_LIMIT);
  const timerId = useRef(null);

  const [paused, setPaused] = useState(false);

  // Separate move history for AI purposes
  const player1History = history.map((h) => h.player1);
  const player2History = history.map((h) => h.player2);

  // Leaderboard stored as {player: n, computer: n, draws: n}
  const [leaderboard, setLeaderboard] = useState(() => JSON.parse(localStorage.getItem("rpsLeaderboard") || "{}"));

  // === EFFECTS ===
  useEffect(() => {
    localStorage.setItem("rpsTheme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("rpsHistory", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem("rpsLeaderboard", JSON.stringify(leaderboard));
  }, [leaderboard]);

  // Timer for moves
  useEffect(() => {
    if (paused) {
      clearInterval(timerId.current);
      return;
    }
    if (player1Choice && (mode === "multi" ? player2Choice : true)) {
      clearInterval(timerId.current);
      return;
    }
    if (round > MAX_ROUNDS) {
      clearInterval(timerId.current);
      return;
    }
    setTimer(MOVE_TIME_LIMIT);
    clearInterval(timerId.current);
    timerId.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerId.current);
          onTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerId.current);
  }, [player1Choice, player2Choice, round, mode, paused]);

  // === FUNCTIONS ===

  // When time runs out for a move
  const onTimeout = () => {
    if (paused) return;
    playSound(clickSoundUrl);

    if (!player1Choice) {
      // auto pick for player1
      const randomMove = choices[Math.floor(Math.random() * choices.length)].name;
      selectMove(1, randomMove);
    } else if (mode === "multi" && !player2Choice) {
      // auto pick for player2
      const randomMove = choices[Math.floor(Math.random() * choices.length)].name;
      selectMove(2, randomMove);
    } else if (mode === "single" && player1Choice && !player2Choice) {
      // AI pick move with difficulty
      aiPlay();
    }
  };

  // Player selects a move
  const selectMove = (playerNumber, move) => {
    if (paused || isThinking) return;
    playSound(clickSoundUrl);
  
    if (playerNumber === 1 && !player1Choice) {
      setPlayer1Choice(move);
      if (mode === "single") {
        aiPlay(); // trigger AI immediately after player move
      }
    }
    if (playerNumber === 2 && mode === "multi" && !player2Choice) {
      setPlayer2Choice(move);
    }
  };
  
  // AI plays (single player mode)
  const aiPlay = () => {
    setIsThinking(true);
    setTimeout(() => {
      const aiMove = getAIMove(aiDifficulty, player1History, player2History);
      setPlayer2Choice(aiMove);
      setIsThinking(false);
    }, 1500);
  };

  // Compute result and advance round
  useEffect(() => {
    if (!player1Choice) return;
    if (mode === "multi" && !player2Choice) return;
    if (mode === "single" && !player2Choice) return;

    // Calculate result
    const roundResult = getResult(player1Choice, player2Choice);

    setResult(roundResult);

    // Play result sound
    if (roundResult === "win") playSound(winSoundUrl);
    else if (roundResult === "lose") playSound(loseSoundUrl);
    else playSound(drawSoundUrl);

    // Update scores
    if (roundResult === "win") setPlayer1Score((s) => s + 1);
    if (roundResult === "lose") setPlayer2Score((s) => s + 1);

    // Update history
    setHistory((h) => [
      ...h,
      { round, player1: player1Choice, player2: player2Choice, result: roundResult },
    ]);
  }, [player2Choice]);

  // Prepare next round when result changes
  useEffect(() => {
    if (!result) return;

    if (round >= MAX_ROUNDS) {
      // Update leaderboard
      const winner =
        player1Score > player2Score
          ? "player"
          : player1Score < player2Score
          ? mode === "single"
            ? "computer"
            : "player2"
          : "draw";
      const newBoard = { ...leaderboard };
      if (winner === "player") newBoard.player = (newBoard.player || 0) + 1;
      else if (winner === "computer") newBoard.computer = (newBoard.computer || 0) + 1;
      else if (winner === "player2") newBoard.player2 = (newBoard.player2 || 0) + 1;
      else newBoard.draws = (newBoard.draws || 0) + 1;

      setLeaderboard(newBoard);
      return;
    }

    // Reset moves for next round after a pause
    const nextRoundTimeout = setTimeout(() => {
      setRound((r) => r + 1);
      setPlayer1Choice(null);
      setPlayer2Choice(null);
      setResult(null);
      setTimer(MOVE_TIME_LIMIT);
    }, 2500);

    return () => clearTimeout(nextRoundTimeout);
  }, [result]);

  // Undo last round
  const undoLastRound = () => {
    if (isThinking || paused) return;
    if (history.length === 0) return;

    // Remove last round
    const lastRound = history[history.length - 1];
    setHistory((h) => h.slice(0, h.length - 1));
    setRound(lastRound.round);
    setPlayer1Choice(null);
    setPlayer2Choice(null);
    setResult(null);

    // Recalculate scores
    let p1Score = 0,
      p2Score = 0;
   


for (let i = 0; i < history.length - 1; i++) {
if (history[i].result === "win") p1Score++;
else if (history[i].result === "lose") p2Score++;
}
setPlayer1Score(p1Score);
setPlayer2Score(p2Score);
};

// Reset entire game
const resetGame = () => {
setRound(1);
setPlayer1Choice(null);
setPlayer2Choice(null);
setResult(null);
setPlayer1Score(0);
setPlayer2Score(0);
setHistory([]);
setTimer(MOVE_TIME_LIMIT);
setPaused(false);
};

// Toggle pause/resume
const togglePause = () => {
setPaused((p) => !p);
};

// Switch theme
const toggleTheme = () => {
setTheme(theme === "dark" ? "light" : "dark");
};

// Switch mode
const toggleMode = () => {
resetGame();
setMode(mode === "single" ? "multi" : "single");
};

// Handle difficulty change
const onDifficultyChange = (e) => {
resetGame();
setAIDifficulty(e.target.value);
};

// Display result color
const getResultColor = () => {
if (result === "win") return themes[theme].resultWin;
if (result === "lose") return themes[theme].resultLose;
if (result === "draw") return themes[theme].resultDraw;
return themes[theme].textColor;
};

// Render buttons for choices
const renderChoiceButtons = (playerNum) => (
<div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 12 }}>
{choices.map((c) => (
<button
key={c.name}
onClick={() => selectMove(playerNum, c.name)}
disabled={
(playerNum === 1 && player1Choice) ||
(playerNum === 2 && player2Choice) ||
paused ||
isThinking
}
style={{
fontSize: 32,
padding: "12px 20px",
cursor: "pointer",
borderRadius: 12,
backgroundColor: themes[theme].buttonBg,
color: themes[theme].buttonColor,
border: "none",
userSelect: "none",
boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
}}
title={c.name.charAt(0).toUpperCase() + c.name.slice(1)}

>
{c.emoji}
</button>
))}
</div>
);

// Show choice or waiting message
const showChoice = (choice) =>
choice ? choices.find((c) => c.name === choice).emoji : "❓";

return (
<div
style={{
minHeight: "100vh",
backgroundColor: themes[theme].background,
color: themes[theme].textColor,
fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
padding: 20,
display: "flex",
flexDirection: "column",
alignItems: "center",
userSelect: "none",
}}
>
<h1>Rock-Paper-Scissors</h1>

javascript
Copy
Edit
  {/* Settings */}
  <div style={{ marginBottom: 20, display: "flex", gap: 16 }}>
    <button onClick={toggleTheme} style={{ cursor: "pointer" }}>
      Switch to {theme === "dark" ? "Light" : "Dark"} Mode
    </button>
    <button onClick={toggleMode} style={{ cursor: "pointer" }}>
      Switch to {mode === "single" ? "Multiplayer" : "Single Player"}
    </button>
    {mode === "single" && (
      <select
        value={aiDifficulty}
        onChange={onDifficultyChange}
        style={{ cursor: "pointer" }}
      >
        <option value="easy">AI Easy</option>
        <option value="medium">AI Medium</option>
        <option value="hard">AI Hard</option>
      </select>
    )}
  </div>

  {/* Round info and timer */}
  <div style={{ marginBottom: 12 }}>
    <strong>Round {round} / {MAX_ROUNDS}</strong>{" "}
    {!paused && !result && (
      <span style={{ marginLeft: 20 }}>
        Time left: <strong>{timer}s</strong>
      </span>
    )}
  </div>

  {/* Pause/Resume */}
  <button
    onClick={togglePause}
    style={{
      cursor: "pointer",
      padding: "6px 14px",
      marginBottom: 10,
      borderRadius: 8,
      border: "none",
      backgroundColor: paused ? "#4ade80" : "#f87171",
      color: "#fff",
      fontWeight: "bold",
    }}
  >
    {paused ? "Resume" : "Pause"}
  </button>

  {/* Player choices display */}
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      gap: 80,
      marginBottom: 12,
      fontSize: 60,
      minHeight: 90,
      alignItems: "center",
    }}
  >
    <div style={{ textAlign: "center" }}>
      <div>Player 1</div>
      <div
        style={{
          fontSize: 80,
          opacity: player1Choice ? 1 : 0.4,
          transition: "opacity 0.3s",
        }}
      >
        {showChoice(player1Choice)}
      </div>
    </div>

    <div style={{ textAlign: "center" }}>
      <div>{mode === "single" ? "Computer" : "Player 2"}</div>
      <div
        style={{
          fontSize: 80,
          opacity: player2Choice ? 1 : isThinking ? 0.6 : 0.4,
          transition: "opacity 0.3s",
        }}
      >
        {isThinking ? "🤔" : showChoice(player2Choice)}
      </div>
    </div>
  </div>

  {/* Player choices buttons */}
  <div style={{ display: "flex", justifyContent: "center", gap: 40, marginBottom: 10 }}>
    {renderChoiceButtons(1)}
    {mode === "multi" && renderChoiceButtons(2)}
  </div>

  {/* Result display */}
  {result && (
    <div
      style={{
        marginTop: 12,
        fontWeight: "700",
        fontSize: 28,
        color: getResultColor(),
        textTransform: "capitalize",
      }}
    >
      Round Result: {result}
    </div>
  )}

  {/* Scores */}
  <div
    style={{
      marginTop: 24,
      fontSize: 22,
      fontWeight: "600",
      display: "flex",
      justifyContent: "center",
      gap: 60,
    }}
  >
    <div>
      Player 1 Score <br />
      <strong>{player1Score}</strong>
    </div>
    <div>
      {mode === "single" ? "Computer" : "Player 2"} Score <br />
      <strong>{player2Score}</strong>
    </div>
  </div>

  {/* History */}
  {history.length > 0 && (
    <div
      style={{
        marginTop: 30,
        width: "100%",
        maxWidth: 480,
        backgroundColor: "rgba(0,0,0,0.1)",
        borderRadius: 12,
        padding: 12,
        color: themes[theme].textColor,
      }}
    >
      <h3>Round History</h3>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          textAlign: "center",
        }}
      >
        <thead>
          <tr>
            <th>Round</th>
            <th>Player 1</th>
            <th>{mode === "single" ? "Computer" : "Player 2"}</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {history.map(({ round, player1, player2, result }) => (
            <tr key={round}>
              <td>{round}</td>
              <td>{choices.find((c) => c.name === player1)?.emoji}</td>
              <td>{choices.find((c) => c.name === player2)?.emoji}</td>
              <td
                style={{
                  color:
                    result === "win"
                      ? themes[theme].resultWin
                      : result === "lose"
                      ? themes[theme].resultLose
                      : themes[theme].resultDraw,
                  fontWeight: "700",
                }}
              >
                {result}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}

  {/* Undo & Reset buttons */}
  <div style={{ marginTop: 30, display: "flex", gap: 20 }}>
    <button
      onClick={undoLastRound}
      disabled={history.length === 0 || paused || isThinking}
      style={{
        cursor: history.length === 0 || paused || isThinking ? "not-allowed" : "pointer",
        padding: "8px 16px",
        borderRadius: 12,
        border: "none",
        backgroundColor: "#fbbf24",
        fontWeight: "600",
        color: "#000",
      }}
      title="Undo last round"
    >
      Undo Last Round
    </button>
    <button
      onClick={resetGame}
      style={{
        cursor: "pointer",
        padding: "8px 16px",
        borderRadius: 12,
        border: "none",
        backgroundColor: "#f87171",
        fontWeight: "600",
        color: "#fff",
      }}
      title="Reset entire game"
    >
      Reset Game
    </button>
  </div>

  {/* Leaderboard */}
  <div
    style={{
      marginTop: 50,
      maxWidth: 400,
      width: "100%",
      backgroundColor: "rgba(0,0,0,0.15)",
      borderRadius: 15,
      padding: 20,
      color: themes[theme].textColor,
      fontWeight: "600",
      fontSize: "1.1rem",
      userSelect: "none",
      textAlign: "center",
    }}
  >
    <h3>Leaderboard (Match Wins)</h3>
    <div
      style={{
        display: "flex",
        justifyContent: "space-around",
        marginTop: 15,
        fontSize: 20,
      }}
    >
      <div>
        Player 1 <br />
        <span style={{ color: "#4ade80" }}>{leaderboard.player || 0}</span>
      </div>
      <div>
        {mode === "single" ? "Computer" : "Player 2"} <br />
        <span style={{ color: "#f87171" }}>
          {mode === "single" ? leaderboard.computer || 0 : leaderboard.player2 || 0}
        </span>
      </div>
      <div>
        Draws <br />
        <span style={{ color: "#fbbf24" }}>{leaderboard.draws || 0}</span>
      </div>
    </div>
  </div>
</div>
);
}