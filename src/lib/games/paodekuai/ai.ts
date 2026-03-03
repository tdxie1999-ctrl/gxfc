import { type PaodekuaiCard } from '@/lib/games/paodekuai/cards';
import { createPaodekuaiEngine, type PaodekuaiGameState } from '@/lib/games/paodekuai/engine';
import { CardPattern, getCardPattern } from '@/lib/games/paodekuai/rules';

export type PaodekuaiAILevel = 'easy' | 'normal' | 'controlled';

export interface PaodekuaiRiggedMove {
  type: 'play' | 'pass';
  cardIds?: number[];
}

export interface PaodekuaiDecision {
  type: 'play' | 'pass';
  cardIds: number[];
}

export class PaodekuaiAI {
  level: PaodekuaiAILevel;

  riggedMoves: PaodekuaiRiggedMove[];

  constructor(level: PaodekuaiAILevel = 'normal', riggedMoves: PaodekuaiRiggedMove[] = []) {
    this.level = level;
    this.riggedMoves = [...riggedMoves];
  }

  decideMove(playerIndex: number, gameState: PaodekuaiGameState): PaodekuaiDecision {
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

    const engine = createPaodekuaiEngine(gameState.config);
    engine.players = gameState.players.map((item) => ({ ...item, hand: [...item.hand] }));
    engine.lastPlay = gameState.lastPlay;
    engine.currentPlayerIndex = gameState.currentPlayerIndex;
    engine.passCount = gameState.passCount;
    engine.gamePhase = gameState.gamePhase;
    engine.deckRemainder = [...gameState.deckRemainder];
    engine.lastAction = gameState.lastAction;
    engine.winnerIndex = gameState.winnerIndex;
    engine.settlement = gameState.settlement;

    const candidates = engine.getPlayableHands(playerIndex);

    if (candidates.length === 0) {
      return { type: 'pass', cardIds: [] };
    }

    if (this.level === 'easy') {
      const randomPick = candidates[Math.floor(Math.random() * candidates.length)] ?? [];
      return { type: 'play', cardIds: randomPick.map((card) => card.id) };
    }

    const threatened = gameState.players.some(
      (item, index) => index !== playerIndex && item.hand.length > 0 && item.hand.length <= 2,
    );

    const scored = candidates.map((cards) => {
      const pattern = getCardPattern(cards);
      const isBombLike =
        pattern?.type === CardPattern.BOMB || pattern?.type === CardPattern.ROCKET;

      let score = cards.length * 20 + (pattern?.rank ?? 0);
      if (isBombLike) {
        score += threatened ? 10 : 1000;
      }

      return { cards, score };
    });

    scored.sort((left, right) => left.score - right.score);
    return { type: 'play', cardIds: scored[0]?.cards.map((card) => card.id) ?? [] };
  }
}

export function decidePaodekuaiMove(
  playerIndex: number,
  gameState: PaodekuaiGameState,
): PaodekuaiDecision {
  const ai = new PaodekuaiAI('normal');
  return ai.decideMove(playerIndex, gameState);
}

export function mapCardIdsToCards(hand: PaodekuaiCard[], cardIds: number[]): PaodekuaiCard[] {
  return hand.filter((card) => cardIds.includes(card.id));
}
