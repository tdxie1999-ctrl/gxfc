import { type Meld, type Tile } from '@/lib/games/fangpaofa/rules';
import { getBaseRank } from '@/lib/games/fangpaofa/tiles';

export type FangpaofaAILevel = 'easy' | 'normal' | 'controlled';

export interface RiggedAction {
  type: 'discard' | 'action';
  value: number | string;
}

export class FangpaofaAI {
  level: FangpaofaAILevel;
  riggedActions: RiggedAction[];

  constructor(level: FangpaofaAILevel = 'normal', riggedActions: RiggedAction[] = []) {
    this.level = level;
    this.riggedActions = [...riggedActions];
  }

  decideTile(hand: Tile[], melds: Meld[], gameState: unknown): number | null {
    void melds;
    void gameState;

    if (hand.length === 0) {
      return null;
    }

    if (this.level === 'controlled') {
      const scripted = this.consumeScript('discard');

      if (typeof scripted === 'number') {
        const exactTile = hand.find((tile) => tile.id === scripted);

        if (exactTile) {
          return exactTile.id;
        }

        const byValue = hand.find((tile) => tile.value === scripted);

        if (byValue) {
          return byValue.id;
        }
      }
    }

    if (this.level === 'easy') {
      const randomIndex = Math.floor(Math.random() * hand.length);
      return hand[randomIndex]?.id ?? null;
    }

    const counts = new Map<number, number>();

    for (const tile of hand) {
      counts.set(tile.value, (counts.get(tile.value) ?? 0) + 1);
    }

    const scored = hand.map((tile) => {
      const baseRank = getBaseRank(tile.value);
      let synergy = 0;

      for (const candidate of hand) {
        if (candidate.id === tile.id || candidate.isSmall !== tile.isSmall) {
          continue;
        }

        const diff = Math.abs(getBaseRank(candidate.value) - baseRank);

        if (diff === 0) {
          synergy += 5;
        } else if (diff <= 2) {
          synergy += 2;
        }
      }

      const duplicateWeight = (counts.get(tile.value) ?? 0) * 4;
      const redPenalty = tile.isRed ? 1 : 0;
      const keepScore = duplicateWeight + synergy - redPenalty;

      return { tile, keepScore };
    });

    scored.sort((left, right) => {
      if (left.keepScore !== right.keepScore) {
        return left.keepScore - right.keepScore;
      }

      if (left.tile.isRed !== right.tile.isRed) {
        return left.tile.isRed ? 1 : -1;
      }

      return right.tile.value - left.tile.value;
    });

    return scored[0]?.tile.id ?? hand[0].id;
  }

  decideAction(availableActions: string[], gameState: unknown): string {
    void gameState;

    if (availableActions.length === 0) {
      return 'pass';
    }

    if (this.level === 'controlled') {
      const scripted = this.consumeScript('action');

      if (typeof scripted === 'string' && availableActions.includes(scripted)) {
        return scripted;
      }
    }

    const priority = ['hu', 'ti', 'pao', 'peng', 'wei', 'chi', 'pass'];
    const matched = priority.find((action) => availableActions.includes(action));

    return matched ?? availableActions[0];
  }

  private consumeScript(type: RiggedAction['type']): RiggedAction['value'] | null {
    const index = this.riggedActions.findIndex((action) => action.type === type);

    if (index === -1) {
      return null;
    }

    const [action] = this.riggedActions.splice(index, 1);
    return action.value;
  }
}

export function decideFangpaofaMove(hand: Tile[], melds: Meld[], gameState: unknown): number | null {
  const ai = new FangpaofaAI('normal');
  return ai.decideTile(hand, melds, gameState);
}
