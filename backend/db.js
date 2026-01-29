import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('data.sqlite');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  db.run('ALTER TABLE users ADD COLUMN avatar TEXT', () => {});
  db.run('ALTER TABLE users ADD COLUMN monthly_income REAL', () => {});
  db.run('ALTER TABLE users ADD COLUMN current_balance REAL', () => {});
  db.run('ALTER TABLE users ADD COLUMN onboarding_completed INTEGER DEFAULT 0', () => {});

  db.run(`
    CREATE TABLE IF NOT EXISTS invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      UNIQUE(owner_id, email)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      invite_id INTEGER,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      limit_amount REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  db.run('ALTER TABLE wallets ADD COLUMN goal_amount REAL', () => {});
  db.run('ALTER TABLE wallets ADD COLUMN cap_amount REAL', () => {});
  db.run('ALTER TABLE wallets ADD COLUMN deadline TEXT', () => {});
  db.run('ALTER TABLE wallets ADD COLUMN members TEXT', () => {});
  db.run('ALTER TABLE wallets ADD COLUMN categories TEXT', () => {});

  db.run(`
    CREATE TABLE IF NOT EXISTS splits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      members TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  db.run('ALTER TABLE splits ADD COLUMN member_amounts TEXT', () => {});
  db.run('ALTER TABLE splits ADD COLUMN member_percentages TEXT', () => {});
  db.run('ALTER TABLE splits ADD COLUMN is_recurring INTEGER DEFAULT 0', () => {});
  db.run('ALTER TABLE splits ADD COLUMN monthly_amount REAL', () => {});
  db.run('ALTER TABLE splits ADD COLUMN friend_ids TEXT', () => {});

  db.run(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_id INTEGER NOT NULL,
      member TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL
    )
  `);
});

export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function handle(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
