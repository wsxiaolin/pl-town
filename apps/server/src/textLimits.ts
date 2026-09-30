export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 40;
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const CHAT_MAX_LENGTH = 500;
export const HOUSE_NAME_MAX_LENGTH = 24;

export const NICKNAME_PATTERN = /^[\p{L}\p{N}]{2,40}$/u;
const HOUSE_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ·._'\-]*$/u;
const DISALLOWED_CONTROLS = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\uFEFF]/;
const DISALLOWED_CONTROLS_GLOBAL = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export function hasDisallowedControls(value: string): boolean {
  return DISALLOWED_CONTROLS.test(value);
}

export function stripDisallowedControls(value: string): string {
  return value.replace(DISALLOWED_CONTROLS_GLOBAL, '');
}

export function validateNickname(nickname: string): string | null {
  if (!nickname || nickname.length < NICKNAME_MIN_LENGTH) return '昵称至少需要两个字符';
  if (nickname.length > NICKNAME_MAX_LENGTH) return '昵称最多 40 个字符';
  if (!NICKNAME_PATTERN.test(nickname)) return '昵称只能包含字母和数字';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return '请输入密码';
  if (hasDisallowedControls(password)) return '密码包含无效字符';
  if (password.length > PASSWORD_MAX_LENGTH) return '密码过长';
  return null;
}

export function sanitizeChatText(text: string): string | null {
  if (text.length > CHAT_MAX_LENGTH) return null;
  const cleaned = stripDisallowedControls(text).trim();
  return cleaned || null;
}

export function sanitizeHouseName(name: string): string | null {
  const cleaned = stripDisallowedControls(name).normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!cleaned || cleaned.length > HOUSE_NAME_MAX_LENGTH) return null;
  if (!HOUSE_NAME_PATTERN.test(cleaned)) return null;
  return cleaned;
}
