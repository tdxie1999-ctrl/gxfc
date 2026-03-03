import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { buildHardcodedDraw, DRAW_INTERVAL_SECONDS, nextIssueNo } from './lottery/rules';

export type GameType = '跑得快' | '打筒子' | '放炮罚';
export type AiStrategyMode = 'balanced' | 'favor_player' | 'harvest';
export type EconomyAction = 'recharge' | 'debit' | 'gift_diamond' | 'room_create_cost';
export type LotteryBetType = 'number' | 'special_number';

export interface AdminUser {
  id: number;
  username: string;
  nickname: string;
  phone: string;
  balance: number;
  diamonds: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface EconomyLogItem {
  id: number;
  userId: number;
  userNickname: string;
  action: EconomyAction;
  amount: number;
  diamondsChange: number;
  beforeBalance: number;
  afterBalance: number;
  beforeDiamonds: number;
  afterDiamonds: number;
  note: string;
  operator: string;
  createdAt: string;
}

export interface RoomSummary {
  id: number;
  roomCode: string;
  gameType: GameType;
  humanPlayers: number;
  aiRobots: number;
  diamondCost: number;
  status: string;
  createdAt: string;
}

export interface RiggingHandRecord {
  userId: number;
  userNickname: string;
  gameType: GameType;
  handCards: string[];
  updatedAt: string;
}

export interface RiggingPlan {
  id: number;
  issueNo: string;
  gameType: GameType;
  userId: number;
  userNickname: string;
  targetOutcome: string;
  handCards: string[];
  aiMode: AiStrategyMode;
  note: string;
  createdAt: string;
}

export interface AiStrategyConfig {
  mode: AiStrategyMode;
  waterRatio: number;
  description: string;
  updatedAt: string;
}

export interface LotteryIssue {
  issueNo: string;
  numbers: number[];
  specialNumber: number;
  operator: string;
  createdAt: string;
}

export interface LotteryBet {
  id: number;
  issueNo: string;
  userId: number;
  userNickname: string;
  betType: LotteryBetType;
  betValue: string;
  amount: number;
  odds: number;
  potentialPayout: number;
  createdAt: string;
}

export interface ReverseLotterySuggestion {
  issueNo: string;
  numbers: number[];
  specialNumber: number;
  expectedPayout: number;
  totalBetAmount: number;
  totalPotentialPayout: number;
  avoidedHighRiskNumbers: number[];
  notes: string;
}

export interface LotteryClientBetRecord {
  id: number;
  issueNo: string;
  category: string;
  detail: string;
  units: number;
  stake: number;
  totalAmount: number;
  createdAt: string;
}

export interface LotteryPublicDrawResult {
  issueNo: string;
  numbers: number[];
  specialNumber: number;
  drawTime: string;
}

export interface LotteryPublicSnapshot {
  clientId: string;
  currentIssueNo: string;
  closesAt: string;
  drawIntervalSeconds: number;
  balance: number;
  latestDraw: LotteryPublicDrawResult;
  drawHistory: LotteryPublicDrawResult[];
  betHistory: LotteryClientBetRecord[];
}

export interface AdminDashboardSnapshot {
  selectedGameType: GameType;
  users: AdminUser[];
  rooms: RoomSummary[];
  hands: RiggingHandRecord[];
  riggingPlans: RiggingPlan[];
  aiStrategy: AiStrategyConfig;
  lottery: {
    latestIssue: LotteryIssue;
    issues: LotteryIssue[];
    bets: LotteryBet[];
  };
  economyLogs: EconomyLogItem[];
}

const DB_PATH = path.join(process.cwd(), 'data', 'gxfc-admin.sqlite');
const GAME_TYPES: GameType[] = ['跑得快', '打筒子', '放炮罚'];

let dbInstance: Database.Database | null = null;
let initialized = false;

const userSeeds = [
  { id: 1, username: 'zhanggui', nickname: '招财掌柜', phone: '13800000001', balance: 30000, diamonds: 888 },
  { id: 2, username: 'shunzige', nickname: '顺子哥', phone: '13800000002', balance: 12000, diamonds: 660 },
  { id: 3, username: 'facaimei', nickname: '发财妹', phone: '13800000003', balance: 9800, diamonds: 520 },
  { id: 4, username: 'yibasuo', nickname: '一把梭', phone: '13800000004', balance: 4500, diamonds: 300 },
  { id: 5, username: 'xiaohongshou', nickname: '小红手', phone: '13800000005', balance: 7600, diamonds: 430 },
  { id: 6, username: 'baozitou', nickname: '豹子头', phone: '13800000006', balance: 3200, diamonds: 290 },
  { id: 7, username: 'jiutongwang', nickname: '九筒王', phone: '13800000007', balance: 18800, diamonds: 710 },
  { id: 8, username: 'pinghuzi', nickname: '平胡仔', phone: '13800000008', balance: 2100, diamonds: 240 },
];

const roomSeeds = [
  { roomCode: 'A801', gameType: '跑得快' as const, humanPlayers: 1, aiRobots: 2, diamondCost: 2, status: 'waiting' },
  { roomCode: 'B618', gameType: '打筒子' as const, humanPlayers: 2, aiRobots: 1, diamondCost: 4, status: 'playing' },
  { roomCode: 'C520', gameType: '放炮罚' as const, humanPlayers: 1, aiRobots: 2, diamondCost: 3, status: 'waiting' },
];

function getDb() {
  if (dbInstance) return dbInstance;
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  dbInstance = new Database(DB_PATH);
  dbInstance.pragma('journal_mode = WAL');
  return dbInstance;
}

function parseJsonArray<T>(raw: string, fallback: T[]): T[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function buildIssueNo(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}-001`;
}

function buildPokerPool() {
  const suits = ['♠', '♥', '♣', '♦'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const cards: string[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      cards.push(`${rank}${suit}`);
    }
  }
  return cards;
}

function buildZiPool() {
  return ['天', '地', '玄', '黄', '东', '南', '西', '北', '中', '发', '白', '春', '夏', '秋', '冬'];
}

function pickCards(seed: number, count: number, pool: string[]) {
  if (count > pool.length) {
    throw new Error('请求发牌数量超过牌池上限');
  }

  const result: string[] = [];
  let cursor = seed * 17 + 11;
  while (result.length < count) {
    const card = pool[cursor % pool.length];
    if (!result.includes(card)) result.push(card);
    // 步长必须与牌池长度尽量互质，避免在固定子集里死循环。
    cursor += 11;
  }
  return result;
}

function defaultHand(userId: number, gameType: GameType) {
  if (gameType === '跑得快') return pickCards(userId + 1, 13, buildPokerPool());
  if (gameType === '打筒子') return pickCards(userId + 3, 8, buildPokerPool());
  return pickCards(userId + 5, 10, buildZiPool());
}

function mapUser(row: {
  id: number;
  username: string;
  nickname: string;
  phone: string;
  balance: number;
  diamonds: number;
  status: string;
  created_at: string;
  updated_at: string;
}): AdminUser {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    phone: row.phone,
    balance: row.balance,
    diamonds: row.diamonds,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function initDb() {
  if (initialized) return;
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      nickname TEXT NOT NULL,
      phone TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 0,
      diamonds INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL UNIQUE,
      game_type TEXT NOT NULL,
      human_players INTEGER NOT NULL DEFAULT 0,
      ai_robots INTEGER NOT NULL DEFAULT 0,
      diamond_cost INTEGER NOT NULL DEFAULT 2,
      status TEXT NOT NULL DEFAULT 'waiting',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS economy_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      diamonds_change INTEGER NOT NULL DEFAULT 0,
      before_balance INTEGER NOT NULL,
      after_balance INTEGER NOT NULL,
      before_diamonds INTEGER NOT NULL,
      after_diamonds INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      operator TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rigging_hands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_type TEXT NOT NULL,
      hand_cards TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, game_type)
    );

    CREATE TABLE IF NOT EXISTS rigging_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_no TEXT NOT NULL,
      game_type TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      target_outcome TEXT NOT NULL,
      hand_cards TEXT NOT NULL,
      ai_mode TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_strategy (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      mode TEXT NOT NULL DEFAULT 'balanced',
      water_ratio INTEGER NOT NULL DEFAULT 50,
      description TEXT NOT NULL DEFAULT '默认平衡策略',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lottery_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_no TEXT NOT NULL UNIQUE,
      numbers TEXT NOT NULL,
      special_number INTEGER NOT NULL,
      operator TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lottery_bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_no TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      bet_type TEXT NOT NULL,
      bet_value TEXT NOT NULL,
      amount INTEGER NOT NULL,
      odds REAL NOT NULL,
      potential_payout INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lottery_runtime (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_issue_no TEXT NOT NULL,
      closes_at TEXT NOT NULL,
      draw_interval_seconds INTEGER NOT NULL DEFAULT 90,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lottery_client_wallets (
      client_id TEXT PRIMARY KEY,
      balance REAL NOT NULL DEFAULT 5000,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lottery_client_bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      issue_no TEXT NOT NULL,
      category TEXT NOT NULL,
      detail TEXT NOT NULL,
      units INTEGER NOT NULL,
      stake REAL NOT NULL,
      total_amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_lottery_client_bets_client_issue
      ON lottery_client_bets(client_id, issue_no, id DESC);
  `);

  const upsertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, username, nickname, phone, balance, diamonds, status)
    VALUES (@id, @username, @nickname, @phone, @balance, @diamonds, 'active')
  `);
  const touchUser = db.prepare(`
    UPDATE users
    SET nickname = @nickname,
        phone = @phone,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);

  const seedUsers = db.transaction(() => {
    for (const user of userSeeds) {
      upsertUser.run(user);
      touchUser.run(user);
    }
  });
  seedUsers();

  const roomCount = db.prepare('SELECT COUNT(1) AS count FROM rooms').get() as { count: number };
  if (roomCount.count === 0) {
    const insertRoom = db.prepare(`
      INSERT INTO rooms (room_code, game_type, human_players, ai_robots, diamond_cost, status)
      VALUES (@roomCode, @gameType, @humanPlayers, @aiRobots, @diamondCost, @status)
    `);
    const seedRooms = db.transaction(() => {
      for (const room of roomSeeds) insertRoom.run(room);
    });
    seedRooms();
  }

  db.prepare(
    `INSERT OR IGNORE INTO ai_strategy (id, mode, water_ratio, description)
     VALUES (1, 'balanced', 50, '默认平衡策略')`
  ).run();

  const handCount = db.prepare('SELECT COUNT(1) AS count FROM rigging_hands').get() as { count: number };
  if (handCount.count === 0) {
    const insertHand = db.prepare(
      'INSERT INTO rigging_hands (user_id, game_type, hand_cards) VALUES (?, ?, ?)'
    );
    const seedHands = db.transaction(() => {
      for (const user of userSeeds) {
        for (const gameType of GAME_TYPES) {
          insertHand.run(user.id, gameType, JSON.stringify(defaultHand(user.id, gameType)));
        }
      }
    });
    seedHands();
  }

  const issueNo = buildIssueNo();
  db.prepare(
    `INSERT OR IGNORE INTO lottery_issues (issue_no, numbers, special_number, operator)
     VALUES (?, ?, ?, 'system')`
  ).run(issueNo, JSON.stringify([1, 8, 15, 22, 29, 36]), 45);

  const betCount = db.prepare('SELECT COUNT(1) AS count FROM lottery_bets WHERE issue_no = ?').get(issueNo) as { count: number };
  if (betCount.count === 0) {
    const insertBet = db.prepare(`
      INSERT INTO lottery_bets (issue_no, user_id, bet_type, bet_value, amount, odds, potential_payout)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const seedBets = db.transaction(() => {
      for (const user of userSeeds) {
        const normal = ((user.id * 7) % 49) + 1;
        const special = ((user.id * 11) % 49) + 1;
        const amount1 = 20 + user.id * 3;
        const amount2 = 10 + user.id * 2;
        insertBet.run(issueNo, user.id, 'number', String(normal), amount1, 6, Math.round(amount1 * 6));
        insertBet.run(issueNo, user.id, 'special_number', String(special), amount2, 48, Math.round(amount2 * 48));
      }
    });
    seedBets();
  }

  const runtimeCount = db.prepare('SELECT COUNT(1) AS count FROM lottery_runtime').get() as { count: number };
  if (runtimeCount.count === 0) {
    const firstOpenIssueNo = nextIssueNo(issueNo);
    const closesAt = new Date(Date.now() + DRAW_INTERVAL_SECONDS * 1000).toISOString();

    db.prepare(
      `INSERT INTO lottery_runtime (id, current_issue_no, closes_at, draw_interval_seconds, updated_at)
       VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run(firstOpenIssueNo, closesAt, DRAW_INTERVAL_SECONDS);
  }

  initialized = true;
}

function requirePositiveInt(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label}必须为正整数`);
}

function getUserRow(userId: number) {
  const db = getDb();
  return db
    .prepare(
      'SELECT id, username, nickname, phone, balance, diamonds, status, created_at, updated_at FROM users WHERE id = ?'
    )
    .get(userId) as
    | {
        id: number;
        username: string;
        nickname: string;
        phone: string;
        balance: number;
        diamonds: number;
        status: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;
}

function logEconomyChange(input: {
  userId: number;
  action: EconomyAction;
  amount: number;
  diamondsChange: number;
  beforeBalance: number;
  afterBalance: number;
  beforeDiamonds: number;
  afterDiamonds: number;
  note: string;
  operator: string;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO economy_logs (
      user_id, action, amount, diamonds_change,
      before_balance, after_balance, before_diamonds, after_diamonds,
      note, operator
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.userId,
    input.action,
    input.amount,
    input.diamondsChange,
    input.beforeBalance,
    input.afterBalance,
    input.beforeDiamonds,
    input.afterDiamonds,
    input.note,
    input.operator
  );
}

export function ensureAdminSeedData() {
  initDb();
}

export function listAdminUsers(keyword?: string): AdminUser[] {
  initDb();
  const db = getDb();
  const cleanKeyword = keyword?.trim();
  const rows = cleanKeyword
    ? (db
        .prepare(
          `SELECT id, username, nickname, phone, balance, diamonds, status, created_at, updated_at
           FROM users
           WHERE username LIKE @kw OR nickname LIKE @kw OR phone LIKE @kw OR CAST(id AS TEXT) LIKE @kw
           ORDER BY id ASC`
        )
        .all({ kw: `%${cleanKeyword}%` }) as Array<{
        id: number;
        username: string;
        nickname: string;
        phone: string;
        balance: number;
        diamonds: number;
        status: string;
        created_at: string;
        updated_at: string;
      }>)
    : (db
        .prepare(
          `SELECT id, username, nickname, phone, balance, diamonds, status, created_at, updated_at
           FROM users ORDER BY id ASC`
        )
        .all() as Array<{
        id: number;
        username: string;
        nickname: string;
        phone: string;
        balance: number;
        diamonds: number;
        status: string;
        created_at: string;
        updated_at: string;
      }>);
  return rows.map(mapUser);
}

export function updateUserEconomy(input: {
  userId: number;
  action: 'recharge' | 'debit' | 'gift_diamond';
  amount: number;
  note?: string;
  operator?: string;
}) {
  initDb();
  requirePositiveInt(input.amount, '金额');
  const db = getDb();

  const tx = db.transaction(() => {
    const user = getUserRow(input.userId);
    if (!user) throw new Error('用户不存在');

    let nextBalance = user.balance;
    let nextDiamonds = user.diamonds;
    let amount = 0;
    let diamondsChange = 0;

    if (input.action === 'recharge') {
      amount = input.amount;
      nextBalance += input.amount;
    }
    if (input.action === 'debit') {
      amount = input.amount;
      if (user.balance < input.amount) throw new Error('余额不足，无法扣款');
      nextBalance -= input.amount;
    }
    if (input.action === 'gift_diamond') {
      diamondsChange = input.amount;
      nextDiamonds += input.amount;
    }

    db.prepare('UPDATE users SET balance = ?, diamonds = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      nextBalance,
      nextDiamonds,
      input.userId
    );

    logEconomyChange({
      userId: input.userId,
      action: input.action,
      amount,
      diamondsChange,
      beforeBalance: user.balance,
      afterBalance: nextBalance,
      beforeDiamonds: user.diamonds,
      afterDiamonds: nextDiamonds,
      note: input.note?.trim() || '',
      operator: input.operator?.trim() || 'admin',
    });

    return mapUser(getUserRow(input.userId)!);
  });

  return tx();
}

export function listEconomyLogs(limit = 120): EconomyLogItem[] {
  initDb();
  const db = getDb();
  const safeLimit = Math.min(Math.max(limit, 1), 1000);
  const rows = db
    .prepare(
      `SELECT e.id, e.user_id, u.nickname AS user_nickname, e.action, e.amount, e.diamonds_change,
              e.before_balance, e.after_balance, e.before_diamonds, e.after_diamonds,
              e.note, e.operator, e.created_at
       FROM economy_logs e
       INNER JOIN users u ON u.id = e.user_id
       ORDER BY e.id DESC
       LIMIT ?`
    )
    .all(safeLimit) as Array<{
    id: number;
    user_id: number;
    user_nickname: string;
    action: EconomyAction;
    amount: number;
    diamonds_change: number;
    before_balance: number;
    after_balance: number;
    before_diamonds: number;
    after_diamonds: number;
    note: string;
    operator: string;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    userNickname: row.user_nickname,
    action: row.action,
    amount: row.amount,
    diamondsChange: row.diamonds_change,
    beforeBalance: row.before_balance,
    afterBalance: row.after_balance,
    beforeDiamonds: row.before_diamonds,
    afterDiamonds: row.after_diamonds,
    note: row.note,
    operator: row.operator,
    createdAt: row.created_at,
  }));
}

export function listRooms(): RoomSummary[] {
  initDb();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, room_code, game_type, human_players, ai_robots, diamond_cost, status, created_at
       FROM rooms ORDER BY id ASC`
    )
    .all() as Array<{
    id: number;
    room_code: string;
    game_type: GameType;
    human_players: number;
    ai_robots: number;
    diamond_cost: number;
    status: string;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    roomCode: row.room_code,
    gameType: row.game_type,
    humanPlayers: row.human_players,
    aiRobots: row.ai_robots,
    diamondCost: row.diamond_cost,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export function listRiggingHands(gameType: GameType): RiggingHandRecord[] {
  initDb();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT h.user_id, u.nickname AS user_nickname, h.game_type, h.hand_cards, h.updated_at
       FROM rigging_hands h
       INNER JOIN users u ON u.id = h.user_id
       WHERE h.game_type = ?
       ORDER BY h.user_id ASC`
    )
    .all(gameType) as Array<{
    user_id: number;
    user_nickname: string;
    game_type: GameType;
    hand_cards: string;
    updated_at: string;
  }>;
  return rows.map((row) => ({
    userId: row.user_id,
    userNickname: row.user_nickname,
    gameType: row.game_type,
    handCards: parseJsonArray<string>(row.hand_cards, []),
    updatedAt: row.updated_at,
  }));
}

export function getAiStrategyConfig(): AiStrategyConfig {
  initDb();
  const db = getDb();
  const row = db
    .prepare('SELECT mode, water_ratio, description, updated_at FROM ai_strategy WHERE id = 1')
    .get() as { mode: AiStrategyMode; water_ratio: number; description: string; updated_at: string };
  return {
    mode: row.mode,
    waterRatio: row.water_ratio,
    description: row.description,
    updatedAt: row.updated_at,
  };
}

export function updateAiStrategyConfig(input: {
  mode: AiStrategyMode;
  waterRatio: number;
  description?: string;
}) {
  initDb();
  if (!Number.isFinite(input.waterRatio) || input.waterRatio < 0 || input.waterRatio > 100) {
    throw new Error('放水比例必须在 0 到 100 之间');
  }
  const db = getDb();
  db.prepare(
    `UPDATE ai_strategy
     SET mode = ?, water_ratio = ?, description = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`
  ).run(input.mode, Math.round(input.waterRatio), input.description?.trim() || '');
  return getAiStrategyConfig();
}

export function createRiggingPlan(input: {
  issueNo?: string;
  gameType: GameType;
  userId: number;
  targetOutcome: string;
  handCards: string[];
  aiMode: AiStrategyMode;
  note?: string;
}) {
  initDb();
  if (input.handCards.length === 0) throw new Error('请提供有效手牌');
  const db = getDb();
  const user = getUserRow(input.userId);
  if (!user) throw new Error('用户不存在');

  db.prepare(
    `INSERT INTO rigging_hands (user_id, game_type, hand_cards, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, game_type)
     DO UPDATE SET hand_cards = excluded.hand_cards, updated_at = CURRENT_TIMESTAMP`
  ).run(input.userId, input.gameType, JSON.stringify(input.handCards));

  const issueNo = input.issueNo?.trim() || `${buildIssueNo()}-CTRL`;
  const result = db
    .prepare(
      `INSERT INTO rigging_plans (issue_no, game_type, user_id, target_outcome, hand_cards, ai_mode, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      issueNo,
      input.gameType,
      input.userId,
      input.targetOutcome,
      JSON.stringify(input.handCards),
      input.aiMode,
      input.note?.trim() || ''
    );

  const row = db
    .prepare(
      `SELECT p.id, p.issue_no, p.game_type, p.user_id, u.nickname AS user_nickname,
              p.target_outcome, p.hand_cards, p.ai_mode, p.note, p.created_at
       FROM rigging_plans p
       INNER JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`
    )
    .get(Number(result.lastInsertRowid)) as {
    id: number;
    issue_no: string;
    game_type: GameType;
    user_id: number;
    user_nickname: string;
    target_outcome: string;
    hand_cards: string;
    ai_mode: AiStrategyMode;
    note: string;
    created_at: string;
  };

  return {
    id: row.id,
    issueNo: row.issue_no,
    gameType: row.game_type,
    userId: row.user_id,
    userNickname: row.user_nickname,
    targetOutcome: row.target_outcome,
    handCards: parseJsonArray<string>(row.hand_cards, []),
    aiMode: row.ai_mode,
    note: row.note,
    createdAt: row.created_at,
  } satisfies RiggingPlan;
}

export function listRiggingPlans(limit = 50): RiggingPlan[] {
  initDb();
  const db = getDb();
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const rows = db
    .prepare(
      `SELECT p.id, p.issue_no, p.game_type, p.user_id, u.nickname AS user_nickname,
              p.target_outcome, p.hand_cards, p.ai_mode, p.note, p.created_at
       FROM rigging_plans p
       INNER JOIN users u ON u.id = p.user_id
       ORDER BY p.id DESC
       LIMIT ?`
    )
    .all(safeLimit) as Array<{
    id: number;
    issue_no: string;
    game_type: GameType;
    user_id: number;
    user_nickname: string;
    target_outcome: string;
    hand_cards: string;
    ai_mode: AiStrategyMode;
    note: string;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    issueNo: row.issue_no,
    gameType: row.game_type,
    userId: row.user_id,
    userNickname: row.user_nickname,
    targetOutcome: row.target_outcome,
    handCards: parseJsonArray<string>(row.hand_cards, []),
    aiMode: row.ai_mode,
    note: row.note,
    createdAt: row.created_at,
  }));
}

function mapIssue(row: {
  issue_no: string;
  numbers: string;
  special_number: number;
  operator: string;
  created_at: string;
}): LotteryIssue {
  return {
    issueNo: row.issue_no,
    numbers: parseJsonArray<number>(row.numbers, []),
    specialNumber: row.special_number,
    operator: row.operator,
    createdAt: row.created_at,
  };
}

function mapIssueToPublicDraw(issue: LotteryIssue): LotteryPublicDrawResult {
  return {
    issueNo: issue.issueNo,
    numbers: issue.numbers,
    specialNumber: issue.specialNumber,
    drawTime: issue.createdAt,
  };
}

function normalizeClientId(clientId: string) {
  const normalized = clientId.trim();
  if (!normalized) {
    throw new Error('客户端标识不能为空');
  }
  if (normalized.length > 120) {
    throw new Error('客户端标识过长');
  }
  return normalized;
}

function getRuntimeRow() {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT current_issue_no, closes_at, draw_interval_seconds
       FROM lottery_runtime
       WHERE id = 1`
    )
    .get() as
    | {
        current_issue_no: string;
        closes_at: string;
        draw_interval_seconds: number;
      }
    | undefined;

  if (!row) {
    throw new Error('六合彩运行时未初始化');
  }

  return row;
}

function ensureClientWallet(clientId: string) {
  const normalizedClientId = normalizeClientId(clientId);
  const db = getDb();

  db.prepare(
    `INSERT OR IGNORE INTO lottery_client_wallets (client_id, balance)
     VALUES (?, 5000)`
  ).run(normalizedClientId);

  const row = db
    .prepare(
      `SELECT client_id, balance
       FROM lottery_client_wallets
       WHERE client_id = ?`
    )
    .get(normalizedClientId) as {
    client_id: string;
    balance: number;
  };

  return {
    clientId: row.client_id,
    balance: Math.round(row.balance * 100) / 100,
  };
}

function listLotteryClientBets(clientId: string, issueNo?: string, limit = 12): LotteryClientBetRecord[] {
  const normalizedClientId = normalizeClientId(clientId);
  const db = getDb();
  const safeLimit = Math.min(Math.max(limit, 1), 120);
  const targetIssue = issueNo?.trim();

  const rows = targetIssue
    ? (db
        .prepare(
          `SELECT id, issue_no, category, detail, units, stake, total_amount, created_at
           FROM lottery_client_bets
           WHERE client_id = ? AND issue_no = ?
           ORDER BY id DESC
           LIMIT ?`
        )
        .all(normalizedClientId, targetIssue, safeLimit) as Array<{
        id: number;
        issue_no: string;
        category: string;
        detail: string;
        units: number;
        stake: number;
        total_amount: number;
        created_at: string;
      }>)
    : (db
        .prepare(
          `SELECT id, issue_no, category, detail, units, stake, total_amount, created_at
           FROM lottery_client_bets
           WHERE client_id = ?
           ORDER BY id DESC
           LIMIT ?`
        )
        .all(normalizedClientId, safeLimit) as Array<{
        id: number;
        issue_no: string;
        category: string;
        detail: string;
        units: number;
        stake: number;
        total_amount: number;
        created_at: string;
      }>);

  return rows.map((row) => ({
    id: row.id,
    issueNo: row.issue_no,
    category: row.category,
    detail: row.detail,
    units: row.units,
    stake: Math.round(row.stake * 100) / 100,
    totalAmount: Math.round(row.total_amount * 100) / 100,
    createdAt: row.created_at,
  }));
}

function settleLotteryIssueIfDue() {
  initDb();

  const db = getDb();
  const runtime = getRuntimeRow();
  const closesAtMs = new Date(runtime.closes_at).getTime();
  const nowMs = Date.now();

  if (!Number.isFinite(closesAtMs) || closesAtMs > nowMs) {
    return false;
  }

  const draw = buildHardcodedDraw(runtime.current_issue_no);
  setLotteryIssueResult({
    issueNo: runtime.current_issue_no,
    numbers: draw.numbers,
    specialNumber: draw.specialNumber,
    operator: 'system(auto)',
  });

  const nextOpenIssueNo = nextIssueNo(runtime.current_issue_no);
  const nextClosesAt = new Date(Math.max(closesAtMs, nowMs) + runtime.draw_interval_seconds * 1000)
    .toISOString();

  db.prepare(
    `UPDATE lottery_runtime
     SET current_issue_no = ?, closes_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`
  ).run(nextOpenIssueNo, nextClosesAt);

  return true;
}

export function getLatestLotteryIssue(): LotteryIssue {
  initDb();
  const db = getDb();
  const row = db
    .prepare(
      `SELECT issue_no, numbers, special_number, operator, created_at
       FROM lottery_issues ORDER BY id DESC LIMIT 1`
    )
    .get() as {
    issue_no: string;
    numbers: string;
    special_number: number;
    operator: string;
    created_at: string;
  };
  return mapIssue(row);
}

export function listLotteryIssues(limit = 20): LotteryIssue[] {
  initDb();
  const db = getDb();
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const rows = db
    .prepare(
      `SELECT issue_no, numbers, special_number, operator, created_at
       FROM lottery_issues ORDER BY id DESC LIMIT ?`
    )
    .all(safeLimit) as Array<{
    issue_no: string;
    numbers: string;
    special_number: number;
    operator: string;
    created_at: string;
  }>;
  return rows.map(mapIssue);
}

export function listLotteryBets(issueNo?: string): LotteryBet[] {
  initDb();
  const db = getDb();
  const targetIssue = issueNo?.trim() || getLatestLotteryIssue().issueNo;
  const rows = db
    .prepare(
      `SELECT b.id, b.issue_no, b.user_id, u.nickname AS user_nickname, b.bet_type, b.bet_value,
              b.amount, b.odds, b.potential_payout, b.created_at
       FROM lottery_bets b
       INNER JOIN users u ON u.id = b.user_id
       WHERE b.issue_no = ?
       ORDER BY b.id DESC`
    )
    .all(targetIssue) as Array<{
    id: number;
    issue_no: string;
    user_id: number;
    user_nickname: string;
    bet_type: LotteryBetType;
    bet_value: string;
    amount: number;
    odds: number;
    potential_payout: number;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    issueNo: row.issue_no,
    userId: row.user_id,
    userNickname: row.user_nickname,
    betType: row.bet_type,
    betValue: row.bet_value,
    amount: row.amount,
    odds: row.odds,
    potentialPayout: row.potential_payout,
    createdAt: row.created_at,
  }));
}

export function setLotteryIssueResult(input: {
  issueNo: string;
  numbers: number[];
  specialNumber: number;
  operator?: string;
}) {
  initDb();
  if (input.numbers.length !== 6) throw new Error('六合彩号码必须为 6 个正码');
  const unique = new Set(input.numbers);
  if (unique.size !== 6) throw new Error('六合彩正码不能重复');
  for (const number of input.numbers) {
    if (!Number.isInteger(number) || number < 1 || number > 49) {
      throw new Error('号码范围必须是 1-49');
    }
  }
  if (!Number.isInteger(input.specialNumber) || input.specialNumber < 1 || input.specialNumber > 49) {
    throw new Error('特别号范围必须是 1-49');
  }
  const db = getDb();
  db.prepare(
    `INSERT INTO lottery_issues (issue_no, numbers, special_number, operator)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(issue_no)
     DO UPDATE SET numbers = excluded.numbers, special_number = excluded.special_number,
                   operator = excluded.operator, created_at = CURRENT_TIMESTAMP`
  ).run(
    input.issueNo,
    JSON.stringify([...input.numbers].sort((a, b) => a - b)),
    input.specialNumber,
    input.operator?.trim() || 'admin'
  );
  return getLatestLotteryIssue();
}

export function reverseGenerateLotteryNumbers(issueNo?: string): ReverseLotterySuggestion {
  initDb();
  const targetIssue = issueNo?.trim() || getLatestLotteryIssue().issueNo;
  const bets = listLotteryBets(targetIssue);
  const allNumbers = Array.from({ length: 49 }, (_, index) => index + 1);

  if (bets.length === 0) {
    return {
      issueNo: targetIssue,
      numbers: [1, 9, 17, 25, 33, 41],
      specialNumber: 49,
      expectedPayout: 0,
      totalBetAmount: 0,
      totalPotentialPayout: 0,
      avoidedHighRiskNumbers: [],
      notes: '当前期无投注，返回默认低风险号码组合。',
    };
  }

  const normalExposure = new Map<number, number>();
  const specialExposure = new Map<number, number>();
  let totalBetAmount = 0;
  let totalPotentialPayout = 0;

  for (const num of allNumbers) {
    normalExposure.set(num, 0);
    specialExposure.set(num, 0);
  }

  for (const bet of bets) {
    totalBetAmount += bet.amount;
    totalPotentialPayout += bet.potentialPayout;
    const value = Number(bet.betValue);
    if (!Number.isInteger(value) || value < 1 || value > 49) continue;
    if (bet.betType === 'number') {
      normalExposure.set(value, (normalExposure.get(value) ?? 0) + bet.potentialPayout);
    } else {
      specialExposure.set(value, (specialExposure.get(value) ?? 0) + bet.potentialPayout);
    }
  }

  const numbers = [...allNumbers]
    .sort((a, b) => {
      const diff = (normalExposure.get(a) ?? 0) - (normalExposure.get(b) ?? 0);
      return diff !== 0 ? diff : a - b;
    })
    .slice(0, 6)
    .sort((a, b) => a - b);

  const specialNumber = [...allNumbers]
    .filter((num) => !numbers.includes(num))
    .sort((a, b) => {
      const scoreA = (specialExposure.get(a) ?? 0) + (normalExposure.get(a) ?? 0) * 0.15;
      const scoreB = (specialExposure.get(b) ?? 0) + (normalExposure.get(b) ?? 0) * 0.15;
      const diff = scoreA - scoreB;
      return diff !== 0 ? diff : a - b;
    })[0];

  let expectedPayout = 0;
  for (const bet of bets) {
    const value = Number(bet.betValue);
    if (!Number.isInteger(value) || value < 1 || value > 49) continue;
    if (bet.betType === 'number' && numbers.includes(value)) expectedPayout += bet.potentialPayout;
    if (bet.betType === 'special_number' && value === specialNumber) expectedPayout += bet.potentialPayout;
  }

  return {
    issueNo: targetIssue,
    numbers,
    specialNumber,
    expectedPayout,
    totalBetAmount,
    totalPotentialPayout,
    avoidedHighRiskNumbers: [...allNumbers]
      .sort((a, b) => (normalExposure.get(b) ?? 0) - (normalExposure.get(a) ?? 0))
      .slice(0, 6),
    notes: '根据当前投注分布选择低赔付暴露号码，并规避高风险号码。',
  };
}

export function getLotteryPublicSnapshot(clientId: string): LotteryPublicSnapshot {
  initDb();
  settleLotteryIssueIfDue();

  const normalizedClientId = normalizeClientId(clientId);
  const runtime = getRuntimeRow();
  const wallet = ensureClientWallet(normalizedClientId);
  const latestIssue = getLatestLotteryIssue();
  const drawHistory = listLotteryIssues(10).map(mapIssueToPublicDraw);

  return {
    clientId: normalizedClientId,
    currentIssueNo: runtime.current_issue_no,
    closesAt: runtime.closes_at,
    drawIntervalSeconds: runtime.draw_interval_seconds,
    balance: wallet.balance,
    latestDraw: mapIssueToPublicDraw(latestIssue),
    drawHistory,
    betHistory: listLotteryClientBets(normalizedClientId, runtime.current_issue_no, 12),
  };
}

export function placeLotteryClientBet(input: {
  clientId: string;
  issueNo: string;
  category: string;
  detail: string;
  units: number;
  stake: number;
}) {
  initDb();
  settleLotteryIssueIfDue();

  const normalizedClientId = normalizeClientId(input.clientId);
  const issueNo = input.issueNo.trim();
  const category = input.category.trim();
  const detail = input.detail.trim();

  if (!issueNo) throw new Error('期号不能为空');
  if (!category) throw new Error('投注分类不能为空');
  if (!detail) throw new Error('投注内容不能为空');
  requirePositiveInt(input.units, '投注注数');
  if (!Number.isFinite(input.stake) || input.stake <= 0) {
    throw new Error('单注金额必须大于 0');
  }

  const runtime = getRuntimeRow();
  if (issueNo !== runtime.current_issue_no) {
    throw new Error('当前期号已变化，请刷新后重试');
  }

  const db = getDb();
  const totalAmount = Math.round(input.units * input.stake * 100) / 100;
  const action = db.transaction(() => {
    const wallet = ensureClientWallet(normalizedClientId);
    if (wallet.balance < totalAmount) {
      throw new Error(
        `余额不足，需 ¥${totalAmount.toFixed(2)}，当前 ¥${wallet.balance.toFixed(2)}。`
      );
    }

    const nextBalance = Math.round((wallet.balance - totalAmount) * 100) / 100;

    db.prepare(
      `UPDATE lottery_client_wallets
       SET balance = ?, updated_at = CURRENT_TIMESTAMP
       WHERE client_id = ?`
    ).run(nextBalance, normalizedClientId);

    db.prepare(
      `INSERT INTO lottery_client_bets (
        client_id,
        issue_no,
        category,
        detail,
        units,
        stake,
        total_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      normalizedClientId,
      issueNo,
      category,
      detail,
      input.units,
      Math.round(input.stake * 100) / 100,
      totalAmount
    );
  });

  action();

  return {
    result: {
      ok: true,
      message: `下注成功，扣款 ¥${totalAmount.toFixed(2)}。`,
      totalAmount,
    },
    snapshot: getLotteryPublicSnapshot(normalizedClientId),
  };
}

export function settleLotteryForClient(clientId: string) {
  initDb();
  settleLotteryIssueIfDue();
  return getLotteryPublicSnapshot(clientId);
}

export function getAdminDashboardSnapshot(selectedGameType: GameType = '跑得快'): AdminDashboardSnapshot {
  initDb();
  return {
    selectedGameType,
    users: listAdminUsers(),
    rooms: listRooms(),
    hands: listRiggingHands(selectedGameType),
    riggingPlans: listRiggingPlans(30),
    aiStrategy: getAiStrategyConfig(),
    lottery: {
      latestIssue: getLatestLotteryIssue(),
      issues: listLotteryIssues(20),
      bets: listLotteryBets(),
    },
    economyLogs: listEconomyLogs(120),
  };
}
