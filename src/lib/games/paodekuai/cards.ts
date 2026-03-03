export type PokerSuit = 'spade' | 'heart' | 'diamond' | 'club' | 'joker';
export type PokerRank =
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A'
  | '2'
  | 'SJ'
  | 'BJ';

export interface PaodekuaiCard {
  id: number;
  suit: PokerSuit;
  rank: PokerRank;
  value: number;
  label: string;
}

const SUITS: Exclude<PokerSuit, 'joker'>[] = ['spade', 'heart', 'diamond', 'club'];
const RANKS: Exclude<PokerRank, 'SJ' | 'BJ'>[] = [
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
  '2',
];

export const RANK_VALUE_MAP: Record<PokerRank, number> = {
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  '2': 15,
  SJ: 16,
  BJ: 17,
};

export function getSuitSymbol(suit: PokerSuit): string {
  switch (suit) {
    case 'spade':
      return '♠';
    case 'heart':
      return '♥';
    case 'diamond':
      return '♦';
    case 'club':
      return '♣';
    default:
      return 'J';
  }
}

export function getCardLabel(card: Pick<PaodekuaiCard, 'rank' | 'suit'>): string {
  if (card.suit === 'joker') {
    return card.rank === 'BJ' ? '大王' : '小王';
  }

  return `${card.rank}${getSuitSymbol(card.suit)}`;
}

export function createStandardDeck(): PaodekuaiCard[] {
  let nextId = 1;
  const deck: PaodekuaiCard[] = [];

  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({
        id: nextId,
        suit,
        rank,
        value: RANK_VALUE_MAP[rank],
        label: getCardLabel({ rank, suit }),
      });
      nextId += 1;
    }
  }

  deck.push({
    id: nextId,
    suit: 'joker',
    rank: 'SJ',
    value: RANK_VALUE_MAP.SJ,
    label: getCardLabel({ rank: 'SJ', suit: 'joker' }),
  });
  nextId += 1;
  deck.push({
    id: nextId,
    suit: 'joker',
    rank: 'BJ',
    value: RANK_VALUE_MAP.BJ,
    label: getCardLabel({ rank: 'BJ', suit: 'joker' }),
  });

  return deck;
}

export function shuffleDeck(cards: PaodekuaiCard[], random = Math.random): PaodekuaiCard[] {
  const deck = [...cards];

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}

export function sortCards(cards: PaodekuaiCard[]): PaodekuaiCard[] {
  return [...cards].sort((left, right) => {
    if (left.value !== right.value) {
      return left.value - right.value;
    }

    const suitWeight = ['club', 'diamond', 'heart', 'spade', 'joker'];
    return suitWeight.indexOf(left.suit) - suitWeight.indexOf(right.suit);
  });
}

export function buildPaodekuaiDeck(config: {
  playerCount: number;
  cardCount: number;
}): { deck: PaodekuaiCard[]; leftovers: PaodekuaiCard[] } {
  const { playerCount, cardCount } = config;
  const shuffled = shuffleDeck(createStandardDeck());
  const takeCount = playerCount * cardCount;
  const deck = shuffled.slice(0, takeCount);
  const leftovers = shuffled.slice(takeCount);

  return { deck, leftovers };
}

export function cloneCard(card: PaodekuaiCard): PaodekuaiCard {
  return { ...card };
}
