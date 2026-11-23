import { useState, useCallback } from 'react';
import { setStorageUser, adoptLegacyData } from './utils/userStorage';

/**
 * Local accounts for Studia.
 *
 * Accounts live on this device (localStorage). Passwords are never stored in
 * plain text: each account keeps a random salt and a SHA-256 hash of salt+password.
 */

export const ACCOUNTS_KEY = 'studia_accounts_v1';
export const SESSION_KEY = 'studia_session_v1';

export const AUTH_LIMITS = {
  usernameMin: 3,
  usernameMax: 24,
  emailMax: 254,
  passwordMin: 8,
  passwordMax: 64,
  identifierMax: 254,
} as const;

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface StoredAccount {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
  lastLoginAt?: number;
}

export interface Account {
  id: string;
  username: string;
  email: string;
  createdAt: number;
}

/** Error codes map to `auth.errors.<code>` translations. */
export type AuthErrorCode =
  | 'usernameRequired'
  | 'usernameShort'
  | 'usernameLong'
  | 'usernameChars'
  | 'emailRequired'
  | 'emailInvalid'
  | 'emailLong'
  | 'passwordRequired'
  | 'passwordShort'
  | 'passwordLong'
  | 'passwordWeak'
  | 'passwordMismatch'
  | 'identifierRequired'
  | 'usernameTaken'
  | 'emailTaken'
  | 'invalidCredentials'
  | 'storage';

export class AuthError extends Error {
  constructor(public code: AuthErrorCode) {
    super(code);
  }
}

export function validateUsername(raw: string): AuthErrorCode | null {
  const v = raw.trim();
  if (!v) return 'usernameRequired';
  if (v.length < AUTH_LIMITS.usernameMin) return 'usernameShort';
  if (v.length > AUTH_LIMITS.usernameMax) return 'usernameLong';
  if (!USERNAME_PATTERN.test(v)) return 'usernameChars';
  return null;
}

export function validateEmail(raw: string): AuthErrorCode | null {
  const v = raw.trim();
  if (!v) return 'emailRequired';
  if (v.length > AUTH_LIMITS.emailMax) return 'emailLong';
  if (!EMAIL_PATTERN.test(v)) return 'emailInvalid';
  return null;
}

export function validatePassword(pw: string): AuthErrorCode | null {
  if (!pw) return 'passwordRequired';
  if (pw.length < AUTH_LIMITS.passwordMin) return 'passwordShort';
  if (pw.length > AUTH_LIMITS.passwordMax) return 'passwordLong';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'passwordWeak';
  return null;
}

/** 0–4 score used by the strength meter. */
export function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= AUTH_LIMITS.passwordMin) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

function readAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: StoredAccount[]) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    throw new AuthError('storage');
  }
}

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  return toHex(await crypto.subtle.digest('SHA-256', data));
}

function toPublic(a: StoredAccount): Account {
  return { id: a.id, username: a.username, email: a.email, createdAt: a.createdAt };
}

function readSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSession(id: string | null, remember: boolean) {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (id) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, id);
  } catch {
    // ignore: the session simply won't persist
  }
}

function restoreSession(): Account | null {
  const id = readSessionId();
  if (!id) return null;
  const found = readAccounts().find(a => a.id === id);
  if (!found) return null;
  setStorageUser(found.id);
  return toPublic(found);
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  remember: boolean;
}

export interface LoginInput {
  identifier: string;
  password: string;
  remember: boolean;
}

export function useAuth() {
  const [account, setAccount] = useState<Account | null>(restoreSession);

  const register = useCallback(async ({ username, email, password, remember }: RegisterInput) => {
    const u = username.trim();
    const e = email.trim().toLowerCase();
    const err = validateUsername(u) || validateEmail(e) || validatePassword(password);
    if (err) throw new AuthError(err);

    const accounts = readAccounts();
    if (accounts.some(a => a.username.toLowerCase() === u.toLowerCase())) throw new AuthError('usernameTaken');
    if (accounts.some(a => a.email === e)) throw new AuthError('emailTaken');

    const salt = randomSalt();
    const now = Date.now();
    const stored: StoredAccount = {
      id: crypto.randomUUID(),
      username: u,
      email: e,
      salt,
      passwordHash: await hashPassword(password, salt),
      createdAt: now,
      lastLoginAt: now,
    };
    writeAccounts([...accounts, stored]);
    if (accounts.length === 0) adoptLegacyData(stored.id);

    writeSession(stored.id, remember);
    setStorageUser(stored.id);
    return toPublic(stored);
  }, []);

  const login = useCallback(async ({ identifier, password, remember }: LoginInput) => {
    const id = identifier.trim().toLowerCase();
    if (!id) throw new AuthError('identifierRequired');
    if (!password) throw new AuthError('passwordRequired');

    const accounts = readAccounts();
    const found = accounts.find(a => a.email === id || a.username.toLowerCase() === id);
    if (!found || (await hashPassword(password, found.salt)) !== found.passwordHash) {
      throw new AuthError('invalidCredentials');
    }

    found.lastLoginAt = Date.now();
    writeAccounts(accounts);
    writeSession(found.id, remember);
    setStorageUser(found.id);
    return toPublic(found);
  }, []);

  /** Opens the app for an account returned by `login`/`register` (lets the UI finish its success animation first). */
  const enter = useCallback((acc: Account) => setAccount(acc), []);

  const logout = useCallback(() => {
    writeSession(null, false);
    setStorageUser(null);
    setAccount(null);
  }, []);

  return { account, register, login, enter, logout };
}
