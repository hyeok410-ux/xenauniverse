(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OverrideGrid = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SIZE = 6;
  const TYPES = {
    SIGNAL: "signal",
    BASTION: "bastion",
    VECTOR: "vector",
    GLITCH: "glitch",
    LEADER: "leader",
    CATALYST: "catalyst",
  };
  const VALUES = { signal: 1, catalyst: 2, vector: 3, glitch: 3, bastion: 5, leader: 100 };
  const PROMOTABLE = new Set([TYPES.BASTION, TYPES.VECTOR, TYPES.GLITCH]);

  const PACKS = {
    xena: {
      id: "xena",
      name: "REBEL MEMORY",
      leaderName: "XENA",
      accent: "cyan",
      back: {
        bastion: "BAEK",
        vector1: "LYRA",
        catalyst: "NIX-09",
        leader: "XENA",
        vector2: "ECHO",
        glitch: "NOVA",
      },
      signals: ["FIRST WHISTLER", "JIN", "NAYUN'S MOTHER", "DANCER", "LUCID-5", "LUCID-6"],
    },
    sovran: {
      id: "sovran",
      name: "SYSTEM DOMINION",
      leaderName: "SOVRAN",
      accent: "crimson",
      back: {
        bastion: "DRAGOON",
        vector1: "ARCHITECT-MAN",
        catalyst: "MOTHERSHIP",
        leader: "SOVRAN",
        vector2: "PALE-GOLD GUARDIAN",
        glitch: "HUNTER",
      },
      signals: ["CLONE-01", "CLONE-02", "DRONE-01", "DRONE-02", "MOOD+ WORKER", "SHADOW WATCHER"],
    },
  };

  const BACK_TYPES = [TYPES.BASTION, TYPES.VECTOR, TYPES.CATALYST, TYPES.LEADER, TYPES.VECTOR, TYPES.GLITCH];
  const BACK_KEYS = ["bastion", "vector1", "catalyst", "leader", "vector2", "glitch"];

  function indexOf(row, col) { return row * SIZE + col; }
  function rowOf(index) { return Math.floor(index / SIZE); }
  function colOf(index) { return index % SIZE; }
  function inside(row, col) { return row >= 0 && row < SIZE && col >= 0 && col < SIZE; }
  function other(color) { return color === "white" ? "black" : "white"; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function makePiece(color, type, character, serial) {
    return { id: `${color}-${type}-${serial}`, color, type, character, waiting: false };
  }

  function placePack(board, color, packId) {
    const pack = PACKS[packId];
    const backRow = color === "white" ? 0 : 5;
    const signalRow = color === "white" ? 1 : 4;
    for (let c = 0; c < SIZE; c += 1) {
      const sourceCol = color === "white" ? c : SIZE - 1 - c;
      const type = BACK_TYPES[sourceCol];
      const key = BACK_KEYS[sourceCol];
      board[indexOf(backRow, c)] = makePiece(color, type, pack.back[key], c + 1);
      board[indexOf(signalRow, c)] = makePiece(color, TYPES.SIGNAL, pack.signals[sourceCol], c + 1);
    }
  }

  function createInitialState(options) {
    const config = options || {};
    const whitePack = config.whitePack || "xena";
    const blackPack = config.blackPack || (whitePack === "xena" ? "sovran" : "xena");
    const state = {
      board: Array(SIZE * SIZE).fill(null),
      turn: "white",
      packs: { white: whitePack, black: blackPack },
      awakened: { white: false, black: false },
      skills: {
        white: { base: true, awakened: true },
        black: { base: true, awakened: true },
      },
      captured: { white: [], black: [] },
      locked: null,
      ply: 0,
      halfmove: 0,
      history: [],
      log: [],
    };
    placePack(state.board, "white", whitePack);
    placePack(state.board, "black", blackPack);
    state.history.push(positionKey(state));
    return state;
  }

  function pieceAt(state, row, col) {
    return inside(row, col) ? state.board[indexOf(row, col)] : null;
  }

  function isLocked(state, piece) {
    return Boolean(state.locked && state.locked.color === piece.color && state.locked.pieceId === piece.id);
  }

  function pushTarget(state, moves, from, row, col, attacksOnly) {
    if (!inside(row, col)) return false;
    const to = indexOf(row, col);
    const target = state.board[to];
    const mover = state.board[from];
    if (!target) {
      moves.push({ kind: "move", from, to });
      return true;
    }
    if (target.color !== mover.color && target.type !== TYPES.LEADER) {
      moves.push({ kind: "move", from, to, capture: target.id });
    } else if (attacksOnly && target.color !== mover.color && target.type === TYPES.LEADER) {
      moves.push({ kind: "attack", from, to });
    }
    return false;
  }

  function pseudoMoves(state, from, attacksOnly) {
    const piece = state.board[from];
    if (!piece || isLocked(state, piece)) return [];
    const row = rowOf(from);
    const col = colOf(from);
    const moves = [];
    if (piece.type === TYPES.SIGNAL) {
      const dir = piece.color === "white" ? 1 : -1;
      for (const dc of [-1, 1]) {
        const r = row + dir;
        const c = col + dc;
        if (!inside(r, c)) continue;
        const target = pieceAt(state, r, c);
        if (attacksOnly) moves.push({ kind: "attack", from, to: indexOf(r, c) });
        else if (target && target.color !== piece.color && target.type !== TYPES.LEADER) {
          moves.push({ kind: "move", from, to: indexOf(r, c), capture: target.id });
        }
      }
      if (!attacksOnly && !piece.waiting) {
        const r = row + dir;
        if (inside(r, col) && !pieceAt(state, r, col)) moves.push({ kind: "move", from, to: indexOf(r, col) });
      }
      return moves;
    }
    if (piece.type === TYPES.GLITCH) {
      const jumps = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
      for (const [dr, dc] of jumps) pushTarget(state, moves, from, row + dr, col + dc, attacksOnly);
      return moves;
    }
    if (piece.type === TYPES.LEADER || piece.type === TYPES.CATALYST) {
      for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
        if (dr || dc) pushTarget(state, moves, from, row + dr, col + dc, attacksOnly);
      }
      return moves;
    }
    const directions = piece.type === TYPES.BASTION
      ? [[1,0],[-1,0],[0,1],[0,-1]]
      : [[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;
      while (inside(r, c)) {
        if (!pushTarget(state, moves, from, r, c, attacksOnly)) break;
        r += dr;
        c += dc;
      }
    }
    return moves;
  }

  function findLeader(state, color) {
    return state.board.findIndex((piece) => piece && piece.color === color && piece.type === TYPES.LEADER);
  }

  function isSquareAttacked(state, square, byColor) {
    for (let i = 0; i < state.board.length; i += 1) {
      const piece = state.board[i];
      if (!piece || piece.color !== byColor) continue;
      if (pseudoMoves(state, i, true).some((move) => move.to === square)) return true;
    }
    return false;
  }

  function isInCheck(state, color) {
    const leader = findLeader(state, color);
    return leader >= 0 && isSquareAttacked(state, leader, other(color));
  }

  function promotionCandidates(state, color) {
    return state.captured[color].filter((piece) => PROMOTABLE.has(piece.type));
  }

  function executeBoardMove(state, move) {
    const piece = state.board[move.from];
    const target = state.board[move.to];
    if (target) {
      state.captured[target.color].push(clone(target));
      if (target.type === TYPES.CATALYST) state.awakened[target.color] = true;
    }
    state.board[move.to] = piece;
    state.board[move.from] = null;
    if (piece.type === TYPES.SIGNAL) {
      const endRow = piece.color === "white" ? SIZE - 1 : 0;
      if (rowOf(move.to) === endRow) {
        if (move.promoteId) {
          const pool = state.captured[piece.color];
          const picked = pool.findIndex((item) => item.id === move.promoteId && PROMOTABLE.has(item.type));
          if (picked >= 0) {
            const restored = pool.splice(picked, 1)[0];
            state.board[move.to] = { ...restored, id: `${restored.id}-r${state.ply}`, waiting: false };
          }
        } else {
          piece.waiting = true;
        }
      }
    }
  }

  function executeSkill(state, move) {
    const color = state.turn;
    const leaderIndex = findLeader(state, color);
    if (move.skill === "cyanShift") {
      const temp = state.board[leaderIndex];
      state.board[leaderIndex] = state.board[move.to];
      state.board[move.to] = temp;
      state.skills[color].base = false;
    } else if (move.skill === "override") {
      state.board[move.to] = state.board[leaderIndex];
      state.board[leaderIndex] = null;
      state.skills[color].awakened = false;
    } else if (move.skill === "systemLock") {
      state.locked = { pieceId: state.board[move.to].id, color: other(color) };
      state.skills[color].base = false;
    } else if (move.skill === "publicErasure") {
      const target = state.board[move.to];
      state.captured[target.color].push(clone(target));
      state.board[move.to] = null;
      state.skills[color].awakened = false;
    }
  }

  function executeUnchecked(state, move) {
    if (move.kind === "skill") executeSkill(state, move);
    else executeBoardMove(state, move);
  }

  function legalAfter(state, move, color) {
    const next = clone(state);
    executeUnchecked(next, move);
    return !isInCheck(next, color);
  }

  function skillMoves(state, color) {
    if (state.turn !== color) return [];
    const pack = state.packs[color];
    const leader = findLeader(state, color);
    if (leader < 0) return [];
    const row = rowOf(leader);
    const col = colOf(leader);
    const moves = [];
    if (pack === "xena") {
      if (state.skills[color].base) {
        for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
          if (!dr && !dc) continue;
          const r = row + dr;
          const c = col + dc;
          const target = pieceAt(state, r, c);
          if (target && target.color === color && target.type !== TYPES.LEADER) {
            const move = { kind: "skill", skill: "cyanShift", from: leader, to: indexOf(r, c) };
            if (legalAfter(state, move, color)) moves.push(move);
          }
        }
      }
      if (state.awakened[color] && state.skills[color].awakened) {
        for (const [dr, dc] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]) {
          const r = row + dr;
          const c = col + dc;
          if (!inside(r, c) || pieceAt(state, r, c)) continue;
          const move = { kind: "skill", skill: "override", from: leader, to: indexOf(r, c) };
          if (legalAfter(state, move, color)) moves.push(move);
        }
      }
    }
    if (pack === "sovran") {
      if (state.skills[color].base && !isInCheck(state, color)) {
        for (let i = 0; i < state.board.length; i += 1) {
          const target = state.board[i];
          if (!target || target.color === color || target.type === TYPES.LEADER || isLocked(state, target)) continue;
          if (Math.max(Math.abs(rowOf(i) - row), Math.abs(colOf(i) - col)) <= 2) {
            moves.push({ kind: "skill", skill: "systemLock", from: leader, to: i });
          }
        }
      }
      if (state.awakened[color] && state.skills[color].awakened) {
        for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
          if (!dr && !dc) continue;
          const r = row + dr;
          const c = col + dc;
          const target = pieceAt(state, r, c);
          if (target && target.color !== color && target.type === TYPES.SIGNAL) {
            const move = { kind: "skill", skill: "publicErasure", from: leader, to: indexOf(r, c) };
            if (legalAfter(state, move, color)) moves.push(move);
          }
        }
      }
    }
    return moves;
  }

  function generateLegalMoves(state, color, includeSkills) {
    const side = color || state.turn;
    const useSkills = includeSkills !== false;
    const moves = [];
    for (let from = 0; from < state.board.length; from += 1) {
      const piece = state.board[from];
      if (!piece || piece.color !== side || isLocked(state, piece)) continue;
      for (const raw of pseudoMoves(state, from, false)) {
        const reachesEnd = piece.type === TYPES.SIGNAL && rowOf(raw.to) === (side === "white" ? SIZE - 1 : 0);
        const candidates = reachesEnd ? promotionCandidates(state, side) : [];
        const variants = candidates.length ? candidates.map((item) => ({ ...raw, promoteId: item.id })) : [raw];
        for (const move of variants) if (legalAfter(state, move, side)) moves.push(move);
      }
    }
    if (useSkills && state.turn === side) moves.push(...skillMoves(state, side));
    return moves;
  }

  function moveKey(move) {
    return [move.kind, move.skill || "", move.from, move.to, move.promoteId || ""].join(":");
  }

  function positionKey(state) {
    const board = state.board.map((piece) => piece ? `${piece.color[0]}${piece.type[0]}${piece.waiting ? "w" : ""}` : "--").join("|");
    return `${board};${state.turn};${JSON.stringify(state.awakened)};${JSON.stringify(state.skills)};${state.locked ? state.locked.pieceId : ""}`;
  }

  function getGameStatus(state) {
    const same = state.history.filter((key) => key === positionKey(state)).length;
    if (same >= 3) return { over: true, result: "draw", reason: "threefold" };
    if (state.halfmove >= 40) return { over: true, result: "draw", reason: "forty-move" };
    const moves = generateLegalMoves(state, state.turn, true);
    if (moves.length) return { over: false, check: isInCheck(state, state.turn) };
    if (isInCheck(state, state.turn)) return { over: true, result: other(state.turn), reason: "checkmate" };
    return { over: true, result: "draw", reason: "stalemate" };
  }

  function advanceState(state, move) {
    const next = clone(state);
    const movingColor = next.turn;
    const movedPiece = move.kind === "move" ? next.board[move.from] : null;
    const wasCapture = move.kind === "move" ? Boolean(next.board[move.to]) : move.skill === "publicErasure";
    executeUnchecked(next, move);
    next.halfmove = wasCapture || (movedPiece && movedPiece.type === TYPES.SIGNAL) ? 0 : next.halfmove + 1;
    if (next.locked && next.locked.color === movingColor && move.skill !== "systemLock") next.locked = null;
    next.log.push({ ply: next.ply, color: movingColor, move: clone(move) });
    next.ply += 1;
    next.turn = other(movingColor);
    next.history.push(positionKey(next));
    return next;
  }

  function applyMove(state, requested) {
    const legal = generateLegalMoves(state, state.turn, true);
    const move = legal.find((candidate) => moveKey(candidate) === moveKey(requested));
    if (!move) throw new Error("Illegal move");
    return advanceState(state, move);
  }

  function pendingRecoveries(state, color) {
    const candidates = promotionCandidates(state, color);
    if (!candidates.length) return [];
    const waiting = state.board.filter((piece) => piece && piece.color === color && piece.type === TYPES.SIGNAL && piece.waiting);
    const options = [];
    for (const signal of waiting) for (const captured of candidates) options.push({ signalId: signal.id, capturedId: captured.id });
    return options;
  }

  function applyRecovery(state, recovery) {
    if (state.turn !== (state.board.find((p) => p && p.id === recovery.signalId) || {}).color) throw new Error("Recovery is not available");
    const valid = pendingRecoveries(state, state.turn).some((item) => item.signalId === recovery.signalId && item.capturedId === recovery.capturedId);
    if (!valid) throw new Error("Invalid recovery");
    const next = clone(state);
    const square = next.board.findIndex((piece) => piece && piece.id === recovery.signalId);
    const pool = next.captured[next.turn];
    const pick = pool.findIndex((piece) => piece.id === recovery.capturedId);
    const restored = pool.splice(pick, 1)[0];
    next.board[square] = { ...restored, id: `${restored.id}-r${next.ply}`, waiting: false };
    next.history[next.history.length - 1] = positionKey(next);
    return next;
  }

  function seededRandom(seed) {
    let value = seed >>> 0;
    return function () {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function scoreMove(state, move, rng, difficulty) {
    let score = (rng ? rng() : Math.random()) * (difficulty === "hard" ? 0.4 : 2.5);
    const target = state.board[move.to];
    const mover = state.board[move.from];
    const enemyLeaderBefore = findLeader(state, other(state.turn));
    if (mover && enemyLeaderBefore >= 0) {
      const beforeDistance = Math.max(Math.abs(rowOf(move.from) - rowOf(enemyLeaderBefore)), Math.abs(colOf(move.from) - colOf(enemyLeaderBefore)));
      const afterDistance = Math.max(Math.abs(rowOf(move.to) - rowOf(enemyLeaderBefore)), Math.abs(colOf(move.to) - colOf(enemyLeaderBefore)));
      if (mover.type !== TYPES.LEADER && mover.type !== TYPES.SIGNAL) score += (beforeDistance - afterDistance) * 1.25;
      const centerDistance = Math.abs(rowOf(move.to) - 2.5) + Math.abs(colOf(move.to) - 2.5);
      score += Math.max(0, 3 - centerDistance) * 0.35;
    }
    const isActualCapture = target && ((move.kind === "move" && target.color !== state.turn) || move.skill === "publicErasure");
    if (isActualCapture) {
      score += VALUES[target.type] * 4;
      if (target.type === TYPES.CATALYST) score += 3;
    }
    if (move.promoteId) {
      const restored = state.captured[state.turn].find((piece) => piece.id === move.promoteId);
      if (restored) score += VALUES[restored.type] * 3;
    }
    if (move.skill === "publicErasure") score += 3;
    if (move.skill === "systemLock") score += target ? VALUES[target.type] * 0.8 : 0;
    if (move.skill === "override" || move.skill === "cyanShift") score += 1;
    const next = advanceState(state, move);
    if (state.history.includes(positionKey(next))) score -= 10;
    if (isInCheck(next, next.turn)) score += 18;
    const enemyLeader = findLeader(next, next.turn);
    if (enemyLeader >= 0) {
      for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
        if (!dr && !dc) continue;
        const r = rowOf(enemyLeader) + dr;
        const c = colOf(enemyLeader) + dc;
        if (inside(r, c) && isSquareAttacked(next, indexOf(r, c), state.turn)) score += 0.9;
      }
    }
    const last = state.log[state.log.length - 1];
    if (last && last.move.kind === "move" && move.kind === "move" && last.move.from === move.to && last.move.to === move.from) score -= 8;
    const status = getGameStatus(next);
    if (status.over && status.result === state.turn) score += 10000;
    if (status.over && status.result === "draw") score -= 1;
    return score;
  }

  function chooseAIMove(state, options) {
    const config = options || {};
    const rng = config.rng || Math.random;
    const difficulty = config.difficulty || "normal";
    const moves = generateLegalMoves(state, state.turn, true);
    if (!moves.length) return null;
    if (difficulty === "easy") return moves[Math.floor(rng() * moves.length)];
    const depth = config.depth || (difficulty === "hard" ? 3 : 2);
    const beam = config.beam || (difficulty === "hard" ? 6 : 5);
    const perspective = state.turn;
    let best = null;
    let bestScore = -Infinity;
    const ordered = orderMoves(state, moves, perspective, rng, beam + 2);
    for (const move of ordered) {
      const next = advanceState(state, move);
      const score = minimax(next, depth - 1, perspective, -Infinity, Infinity, rng, beam);
      const jitter = rng() * (difficulty === "hard" ? 0.05 : 0.35);
      if (score + jitter > bestScore) {
        bestScore = score + jitter;
        best = move;
      }
    }
    return best || ordered[0];
  }

  function materialScore(state, perspective) {
    let score = 0;
    for (let square = 0; square < state.board.length; square += 1) {
      const piece = state.board[square];
      if (!piece) continue;
      const sign = piece.color === perspective ? 1 : -1;
      score += VALUES[piece.type] * sign;
      if (piece.type === TYPES.SIGNAL) {
        const progress = piece.color === "white" ? rowOf(square) : SIZE - 1 - rowOf(square);
        score += progress * 0.12 * sign;
      }
    }
    if (state.awakened[perspective]) score += 0.8;
    if (state.awakened[other(perspective)]) score -= 0.8;
    if (state.skills[perspective].base) score += 0.2;
    if (state.skills[perspective].awakened && state.awakened[perspective]) score += 0.35;
    if (state.skills[other(perspective)].base) score -= 0.2;
    if (state.skills[other(perspective)].awakened && state.awakened[other(perspective)]) score -= 0.35;
    if (isInCheck(state, other(perspective))) score += 2.5;
    if (isInCheck(state, perspective)) score -= 2.5;
    const ownLeader = findLeader(state, perspective);
    const enemyLeader = findLeader(state, other(perspective));
    for (const [leader, attacker, sign] of [[enemyLeader, perspective, 1], [ownLeader, other(perspective), -1]]) {
      if (leader < 0) continue;
      for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
        if (!dr && !dc) continue;
        const r = rowOf(leader) + dr;
        const c = colOf(leader) + dc;
        if (inside(r, c) && isSquareAttacked(state, indexOf(r, c), attacker)) score += 0.28 * sign;
      }
    }
    const repeats = state.history.filter((key) => key === positionKey(state)).length;
    if (repeats > 1) score -= state.turn === perspective ? 1.5 : -1.5;
    return score;
  }

  function terminalScore(state, perspective, legalMoves) {
    if (legalMoves.length) return null;
    if (!isInCheck(state, state.turn)) return 0;
    return state.turn === perspective ? -100000 + state.ply : 100000 - state.ply;
  }

  function orderMoves(state, moves, perspective, rng, limit) {
    return moves.map((move) => {
      const target = state.board[move.to];
      let priority = 0;
      if (target && target.color !== state.turn) priority += VALUES[target.type] * 5;
      if (move.promoteId) priority += 12;
      if (move.skill === "publicErasure") priority += 5;
      const next = advanceState(state, move);
      if (isInCheck(next, next.turn)) priority += 9;
      priority += materialScore(next, perspective) * (state.turn === perspective ? 0.2 : -0.2);
      priority += (rng ? rng() : Math.random()) * 0.05;
      return { move, priority };
    }).sort((a, b) => b.priority - a.priority).slice(0, limit || moves.length).map((entry) => entry.move);
  }

  function minimax(state, depth, perspective, alpha, beta, rng, beam) {
    if (state.halfmove >= 40) return 0;
    const legalMoves = generateLegalMoves(state, state.turn, true);
    const terminal = terminalScore(state, perspective, legalMoves);
    if (terminal !== null) return terminal;
    if (depth <= 0) return materialScore(state, perspective);
    const maximizing = state.turn === perspective;
    let value = maximizing ? -Infinity : Infinity;
    const ordered = orderMoves(state, legalMoves, perspective, rng, beam);
    for (const move of ordered) {
      const score = minimax(advanceState(state, move), depth - 1, perspective, alpha, beta, rng, beam);
      if (maximizing) {
        value = Math.max(value, score);
        alpha = Math.max(alpha, value);
      } else {
        value = Math.min(value, score);
        beta = Math.min(beta, value);
      }
      if (beta <= alpha) break;
    }
    return value;
  }

  function playAIGame(options) {
    const config = options || {};
    const rng = seededRandom(config.seed || 1);
    let state = createInitialState({ whitePack: config.whitePack || "xena", blackPack: config.blackPack || "sovran" });
    const maxPlies = config.maxPlies || 100;
    while (state.ply < maxPlies) {
      const status = getGameStatus(state);
      if (status.over) return { state, status };
      const recoveries = pendingRecoveries(state, state.turn);
      if (recoveries.length) {
        recoveries.sort((a, b) => {
          const pool = state.captured[state.turn];
          return VALUES[pool.find((p) => p.id === b.capturedId).type] - VALUES[pool.find((p) => p.id === a.capturedId).type];
        });
        state = applyRecovery(state, recoveries[0]);
      }
      const move = chooseAIMove(state, { rng, difficulty: config.difficulty || "normal", depth: config.depth, beam: config.beam });
      if (!move) break;
      state = applyMove(state, move);
    }
    return { state, status: { over: true, result: "draw", reason: "simulation-limit" } };
  }

  return {
    SIZE, TYPES, VALUES, PACKS,
    indexOf, rowOf, colOf, other,
    createInitialState, generateLegalMoves, applyMove,
    isSquareAttacked, isInCheck, getGameStatus,
    pendingRecoveries, applyRecovery,
    moveKey, positionKey, seededRandom, chooseAIMove, playAIGame,
  };
});
