import {
  DatongziPatternType,
  findDatongziPlayableHands,
  getDatongziPattern,
} from '@/lib/games/datongzi/rules';
import { type DatongziGameState } from '@/lib/games/datongzi/engine';

export type DatongziAILevel = 'easy' | 'normal' | 'controlled';

export interface DatongziRiggedMove {
  type: 'play' | 'pass';
  cardIds?: number[];
}

export interface DatongziDecision {
  type: 'play' | 'pass';
  cardIds: number[];
}

interface ScoredMove {
  cardIds: number[];
  score: number;
}

export class DatongziAI {
  level: DatongziAILevel;

  riggedMoves: DatongziRiggedMove[];

  constructor(level: DatongziAILevel = 'normal', riggedMoves: DatongziRiggedMove[] = []) {
    this.level = level;
    this.riggedMoves = [...riggedMoves];
  }

  decideMove(playerIndex: number, gameState: DatongziGameState): DatongziDecision {
    const player = gameState.players[playerIndex];

    if (!player) {
      return { type: 'pass', cardIds: [] };
    }

    if (this.level === 'controlled') {
      const scripted = this.riggedMoves.shift();

      if (scripted) {
        return { type: scripted.type, cardIds: scripted.cardIds ?? [] };
      }
    }

    const previous =
      gameState.lastPlay && gameState.lastPlay.playerIndex !== playerIndex ? gameState.lastPlay : null;
    const candidates = findDatongziPlayableHands(player.hand, previous);

    if (candidates.length === 0) {
      return { type: 'pass', cardIds: [] };
    }

    if (this.level === 'easy') {
      const randomPick = candidates[Math.floor(Math.random() * candidates.length)] ?? [];
      return { type: 'play', cardIds: randomPick.map((card) => card.id) };
    }

    const underPressure = gameState.players.some(
      (item, index) => index !== playerIndex && item.hand.length > 0 && item.hand.length <= 4,
    );

    const scoredMoves: ScoredMove[] = candidates.map((cards) => {
      const pattern = getDatongziPattern(cards);
      const patternWeight =
        pattern?.type === DatongziPatternType.TONGZI
          ? 100
          : pattern?.type === DatongziPatternType.STRAIGHT
            ? 40 + cards.length
            : cards.length * 10;

      let score = patternWeight + (pattern?.rank ?? 0);

      if (underPressure) {
        score = -score;
      }

      return {
        cardIds: cards.map((card) => card.id),
        score,
      };
    });

    scoredMoves.sort((left, right) => left.score - right.score);
    return { type: 'play', cardIds: scoredMoves[0]?.cardIds ?? [] };
  }
}

export function decideDatongziMove(
  playerIndex: number,
  gameState: DatongziGameState,
): DatongziDecision {
  const ai = new DatongziAI('normal');
  return ai.decideMove(playerIndex, gameState);
}
