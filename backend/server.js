import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { all, get, run } from './db.js';

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_secret';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://127.0.0.1:5500';

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : null
};

const mailer = smtpConfig.host && smtpConfig.auth
  ? nodemailer.createTransport(smtpConfig)
  : null;

function walletHasMember(walletRow, user) {
  if (!walletRow || !user) return false;
  if (walletRow.owner_id === user.id || walletRow.ownerId === user.id) return true;
  const membersRaw = walletRow.members || '';
  const members = membersRaw.split('|').filter(Boolean);
  const identity = [user.email, user.name].filter(Boolean).map(value => String(value).toLowerCase());
  return members.some(member => identity.includes(String(member).toLowerCase()));
}

function buildInviteEmail(invite) {
  const acceptUrl = `${APP_BASE_URL}/shared/index.html?invite=${invite.id}`;
  return {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: invite.email,
    subject: 'Family Budget Invite',
    text: `Hi ${invite.name},\n\nYou have been invited to join a shared Family Budget in Money Tracker.\n\nOpen this link to view: ${acceptUrl}\n\nThanks!`,
    html: `
      <p>Hi ${invite.name},</p>
      <p>You have been invited to join a shared <strong>Family Budget</strong> in Money Tracker.</p>
      <p><a href="${acceptUrl}">Open the invite</a></p>
      <p>Thanks!</p>
    `
  };
}

async function sendInviteEmail(invite) {
  if (!mailer) {
    throw new Error('SMTP is not configured.');
  }
  await mailer.sendMail(buildInviteEmail(invite));
}

app.use(cors({ origin: true }));
app.use(express.json());

function createToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized' });
  }
}

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields.' });

  const existing = await get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (existing) return res.status(409).json({ message: 'Email already registered.' });

  const passwordHash = await bcrypt.hash(password, 10);
  const createdAt = Date.now();
  const result = await run(
    'INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
    [name.trim(), email.trim().toLowerCase(), passwordHash, createdAt]
  );
  const user = { id: result.lastID, email: email.trim().toLowerCase() };
  const token = createToken(user);
  res.json({ token });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Missing fields.' });

  const user = await get('SELECT id, email, password_hash FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (!user) return res.status(401).json({ message: 'Invalid credentials.' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials.' });

  const token = createToken(user);
  res.json({ token });
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const user = await get('SELECT id, name, email, avatar, monthly_income, current_balance, onboarding_completed FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json(user);
});

app.post('/api/onboarding', authMiddleware, async (req, res) => {
  const { name, monthlyIncome, currentBalance } = req.body || {};
  if (!name || monthlyIncome === undefined || currentBalance === undefined) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }
  
  await run(
    'UPDATE users SET name = ?, monthly_income = ?, current_balance = ?, onboarding_completed = 1 WHERE id = ?',
    [name.trim(), monthlyIncome, currentBalance, req.userId]
  );
  
  res.json({ ok: true });
});

app.post('/api/reset-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    
    // Delete all user's wallets
    await run('DELETE FROM wallets WHERE owner_id = ?', [userId]);
    
    // Delete all user's friends
    await run('DELETE FROM friends WHERE owner_id = ?', [userId]);
    
    // Delete all user's invites
    await run('DELETE FROM invites WHERE owner_id = ?', [userId]);
    
    // Keep monthly_income and current_balance, reset onboarding if needed
    // Expenses are handled on frontend (localStorage), so they're already cleared
    
    res.json({ ok: true, message: 'All data has been reset.' });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ message: 'Failed to reset data.' });
  }
});

app.get('/api/friend-limit', authMiddleware, async (req, res) => {
  const user = await get('SELECT email FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const friend = await get(
    'SELECT limit_amount as limitAmount, owner_id FROM friends WHERE email = ? ORDER BY created_at DESC LIMIT 1',
    [user.email]
  );

  if (!friend) return res.json({ limitAmount: null });
  res.json({ limitAmount: friend.limitAmount, ownerId: friend.owner_id });
});

app.patch('/api/me/avatar', authMiddleware, async (req, res) => {
  const { avatar } = req.body || {};
  if (!avatar || typeof avatar !== 'string') {
    return res.status(400).json({ message: 'Invalid avatar.' });
  }
  await run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, req.userId]);
  res.json({ ok: true });
});

app.get('/api/invites', authMiddleware, async (req, res) => {
  const rows = await all('SELECT id, name, email, status, created_at FROM invites WHERE owner_id = ? ORDER BY created_at DESC', [req.userId]);
  res.json(rows);
});

app.post('/api/invites', authMiddleware, async (req, res) => {
  const { name, email } = req.body || {};
  if (!name || !email) return res.status(400).json({ message: 'Missing fields.' });
  try {
    const createdAt = Date.now();
    const result = await run(
      'INSERT INTO invites (owner_id, name, email, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [req.userId, name.trim(), email.trim().toLowerCase(), 'pending', createdAt]
    );
    const invite = { id: result.lastID, name: name.trim(), email: email.trim().toLowerCase(), status: 'pending', created_at: createdAt };
    await sendInviteEmail(invite);
    res.status(201).json(invite);
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) {
      return res.status(409).json({ message: 'Invite for this email already exists.' });
    }
    if (String(error.message || '').includes('SMTP')) {
      return res.status(500).json({ message: 'SMTP is not configured. Add Gmail credentials.' });
    }
    res.status(500).json({ message: 'Failed to create invite.' });
  }
});

app.post('/api/invites/:id/resend', authMiddleware, async (req, res) => {
  const invite = await get('SELECT id, name, email FROM invites WHERE id = ? AND owner_id = ?', [req.params.id, req.userId]);
  if (!invite) return res.status(404).json({ message: 'Invite not found.' });
  try {
    await sendInviteEmail(invite);
    res.json({ ok: true });
  } catch (error) {
    if (String(error.message || '').includes('SMTP')) {
      return res.status(500).json({ message: 'SMTP is not configured. Add Gmail credentials.' });
    }
    res.status(500).json({ message: 'Failed to send invite.' });
  }
});

app.post('/api/invites/:id/accept', authMiddleware, async (req, res) => {
  const invite = await get('SELECT id, name, email FROM invites WHERE id = ? AND owner_id = ?', [req.params.id, req.userId]);
  if (!invite) return res.status(404).json({ message: 'Invite not found.' });

  await run('UPDATE invites SET status = ? WHERE id = ?', ['accepted', invite.id]);
  const existingFriend = await get('SELECT id FROM friends WHERE owner_id = ? AND email = ?', [req.userId, invite.email]);
  if (!existingFriend) {
    await run(
      'INSERT INTO friends (owner_id, invite_id, name, email, limit_amount, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [req.userId, invite.id, invite.name, invite.email, 0, Date.now()]
    );
  }
  res.json({ ok: true });
});

app.get('/api/friends', authMiddleware, async (req, res) => {
  const rows = await all(
    'SELECT id, name, email, limit_amount as limitAmount, created_at FROM friends WHERE owner_id = ? ORDER BY created_at DESC',
    [req.userId]
  );
  res.json(rows);
});

app.patch('/api/friends/:id', authMiddleware, async (req, res) => {
  const limit = Number(req.body?.limit || 0);
  await run('UPDATE friends SET limit_amount = ? WHERE id = ? AND owner_id = ?', [limit, req.params.id, req.userId]);
  res.json({ ok: true });
});

app.get('/api/wallets', authMiddleware, async (req, res) => {
  const user = await get('SELECT id, name, email FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const rows = await all(
    'SELECT id, owner_id as ownerId, name, amount, notes, goal_amount as goalAmount, cap_amount as capAmount, deadline, members, categories, created_at FROM wallets ORDER BY created_at DESC'
  );
  const filtered = rows.filter(row => walletHasMember(row, user));
  const mapped = filtered.map(row => ({
    ...row,
    members: row.members ? row.members.split('|').filter(Boolean) : [],
    categories: row.categories ? row.categories.split('|').filter(Boolean) : []
  }));
  res.json(mapped);
});

app.post('/api/wallets', authMiddleware, async (req, res) => {
  const { name, amount = 0, notes = '', goalAmount, capAmount, deadline, members = [], categories = [] } = req.body || {};
  if (!name) return res.status(400).json({ message: 'Missing fields.' });
  const createdAt = Date.now();
  const memberString = Array.isArray(members) ? members.join('|') : '';
  const categoryString = Array.isArray(categories) ? categories.join('|') : '';
  const goalValue = Number(goalAmount);
  const capValue = Number(capAmount);
  const result = await run(
    'INSERT INTO wallets (owner_id, name, amount, notes, goal_amount, cap_amount, deadline, members, categories, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      req.userId,
      name.trim(),
      Number(amount) || 0,
      notes.trim(),
      Number.isFinite(goalValue) ? goalValue : null,
      Number.isFinite(capValue) ? capValue : null,
      deadline || null,
      memberString,
      categoryString,
      createdAt
    ]
  );
  res.status(201).json({
    id: result.lastID,
    ownerId: req.userId,
    name: name.trim(),
    amount: Number(amount) || 0,
    notes: notes.trim(),
    goalAmount: Number.isFinite(goalValue) ? goalValue : null,
    capAmount: Number.isFinite(capValue) ? capValue : null,
    deadline: deadline || null,
    members: Array.isArray(members) ? members : [],
    categories: Array.isArray(categories) ? categories : [],
    created_at: createdAt
  });
});

app.patch('/api/wallets/:id', authMiddleware, async (req, res) => {
  const wallet = await get('SELECT id, owner_id FROM wallets WHERE id = ?', [req.params.id]);
  if (!wallet) return res.status(404).json({ message: 'Wallet not found.' });
  if (wallet.owner_id !== req.userId) return res.status(403).json({ message: 'Forbidden.' });

  const { name, amount = 0, notes = '', goalAmount, capAmount, deadline, members = [], categories = [] } = req.body || {};
  if (!name) return res.status(400).json({ message: 'Missing fields.' });

  const memberString = Array.isArray(members) ? members.join('|') : '';
  const categoryString = Array.isArray(categories) ? categories.join('|') : '';
  const goalValue = Number(goalAmount);
  const capValue = Number(capAmount);

  await run(
    'UPDATE wallets SET name = ?, amount = ?, notes = ?, goal_amount = ?, cap_amount = ?, deadline = ?, members = ?, categories = ? WHERE id = ?',
    [
      name.trim(),
      Number(amount) || 0,
      notes.trim(),
      Number.isFinite(goalValue) ? goalValue : null,
      Number.isFinite(capValue) ? capValue : null,
      deadline || null,
      memberString,
      categoryString,
      wallet.id
    ]
  );

  res.json({
    id: wallet.id,
    ownerId: req.userId,
    name: name.trim(),
    amount: Number(amount) || 0,
    notes: notes.trim(),
    goalAmount: Number.isFinite(goalValue) ? goalValue : null,
    capAmount: Number.isFinite(capValue) ? capValue : null,
    deadline: deadline || null,
    members: Array.isArray(members) ? members : [],
    categories: Array.isArray(categories) ? categories : []
  });
});

app.delete('/api/wallets/:id', authMiddleware, async (req, res) => {
  const wallet = await get('SELECT id, owner_id FROM wallets WHERE id = ?', [req.params.id]);
  if (!wallet) return res.status(404).json({ message: 'Wallet not found.' });
  if (wallet.owner_id !== req.userId) return res.status(403).json({ message: 'Forbidden.' });

  await run('DELETE FROM wallet_transactions WHERE wallet_id = ?', [wallet.id]);
  await run('DELETE FROM wallets WHERE id = ?', [wallet.id]);
  res.json({ ok: true });
});

app.post('/api/wallets/:id/leave', authMiddleware, async (req, res) => {
  const wallet = await get('SELECT id, owner_id, members FROM wallets WHERE id = ?', [req.params.id]);
  if (!wallet) return res.status(404).json({ message: 'Wallet not found.' });
  if (wallet.owner_id === req.userId) return res.status(403).json({ message: 'Owner cannot leave.' });

  const user = await get('SELECT name, email FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const members = wallet.members ? wallet.members.split('|').filter(Boolean) : [];
  const filtered = members.filter(member => member !== user.email && member !== user.name);
  await run('UPDATE wallets SET members = ? WHERE id = ?', [filtered.join('|'), wallet.id]);
  res.json({ ok: true, members: filtered });
});

app.get('/api/wallets/:id/transactions', authMiddleware, async (req, res) => {
  const user = await get('SELECT id, name, email FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const wallet = await get('SELECT id, owner_id as ownerId, members FROM wallets WHERE id = ?', [req.params.id]);
  if (!wallet || !walletHasMember(wallet, user)) return res.status(404).json({ message: 'Wallet not found.' });
  const rows = await all(
    'SELECT id, wallet_id as walletId, member, amount, category, note, created_at FROM wallet_transactions WHERE wallet_id = ? ORDER BY created_at DESC',
    [wallet.id]
  );
  res.json(rows);
});

app.post('/api/wallets/:id/transactions', authMiddleware, async (req, res) => {
  const { member, amount, category, note = '' } = req.body || {};
  if (!member || !category || !amount) return res.status(400).json({ message: 'Missing fields.' });
  const user = await get('SELECT id, name, email FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const wallet = await get('SELECT id, owner_id as ownerId, members FROM wallets WHERE id = ?', [req.params.id]);
  if (!wallet || !walletHasMember(wallet, user)) return res.status(404).json({ message: 'Wallet not found.' });
  const createdAt = Date.now();
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ message: 'Invalid amount.' });
  const result = await run(
    'INSERT INTO wallet_transactions (wallet_id, member, amount, category, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [wallet.id, member.trim(), value, category.trim(), note.trim(), createdAt]
  );
  res.status(201).json({
    id: result.lastID,
    walletId: wallet.id,
    member: member.trim(),
    amount: value,
    category: category.trim(),
    note: note.trim(),
    created_at: createdAt
  });
});

app.get('/api/splits', authMiddleware, async (req, res) => {
  const rows = await all('SELECT id, name, amount, members, member_amounts, created_at FROM splits WHERE owner_id = ? ORDER BY created_at DESC', [req.userId]);
  const mapped = rows.map(row => {
    const members = row.members ? row.members.split('|').filter(Boolean) : [];
    const memberAmounts = row.member_amounts ? JSON.parse(row.member_amounts) : {};
    return {
      ...row,
      members,
      memberAmounts
    };
  });
  res.json(mapped);
});

app.post('/api/splits', authMiddleware, async (req, res) => {
  const { name, amount = 0, members = [], memberAmounts = {} } = req.body || {};
  if (!name) return res.status(400).json({ message: 'Missing fields.' });
  const createdAt = Date.now();
  const memberString = Array.isArray(members) ? members.join('|') : '';
  const memberAmountsString = JSON.stringify(memberAmounts);
  const result = await run(
    'INSERT INTO splits (owner_id, name, amount, members, member_amounts, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [req.userId, name.trim(), Number(amount) || 0, memberString, memberAmountsString, createdAt]
  );
  res.status(201).json({ 
    id: result.lastID, 
    name: name.trim(), 
    amount: Number(amount) || 0, 
    members, 
    memberAmounts,
    created_at: createdAt 
  });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
