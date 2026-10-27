// 社区富文本清洗器（设计 docs/year-towns-design.md §7.3）——生成期与运行期
// 同一实现的唯一事实源：生成器 scripts/generate_town_buildings.mjs 经 esbuild
// 打包导入本模块，把清洗结果烘焙进 gen-* 生成数据；面板侧一律 textContent
// 渲染（结构性免疫 XSS），不再二次清洗。
//
// 规则（§7.3）：
//  1. 标签剥离（大小写不敏感）：color/size/b/i/u/a 及闭合删标签留内文；
//     <discussion=ID>…</discussion> 删标签留内文（内文空或纯 ID 则整段删）；
//     <user=ID> 删。
//  2. 平铺回复前缀：「回复<user=ID>@昵称<」→ 先删 <user=…>，再吃掉 @短名< 的
//     孤悬 `<`（每条文本一次）。
//  3. 未知标签 <[a-zA-Z/][^>]{0,64}> 删；其余字面 <> 保留。
//  4. label-safe：再剥净残余 <> 与控制字符，题名超长截断加 …。
//  5. 控制字符：删 U+200B–200D、U+FEFF、U+FFFC、C0（\n\t 除外）；\r\n→\n。
//     内部空格不折叠（VIP 字体类作品依赖空格排版）。
//  6. 作者名兜底：清洗后空/全空白 → 「无名氏」。

const PAIRED_TAGS = /<\/?(?:color|size|b|i|u|a)(?:=[^<>]{0,128})?>/gi;
const USER_TAGS = /<\/?user(?:=[^<>]{0,128})?>/gi;
const DISCUSSION_PAIR = /<discussion=([^<>]{1,64})>([\s\S]*?)<\/discussion>/gi;
const UNKNOWN_TAG = /<[a-zA-Z/][^>]{0,64}>/g;
const REPLY_DANGLING = /@([^\s<:：，。]{1,24})</;
const CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF\uFFFC]/g;
/** label-safe 额外剥净的字符（含 7.3 规则 4 的残余尖括号与双向控制符）。 */
const LABEL_UNSAFE = /[<>\u202A-\u202E\u2066-\u2069]/g;

function stripControls(value: string): string {
  return value.replace(CONTROLS, '');
}

/** 判断 discussion 内文是否「为空或纯 ID」——是则整段删。 */
function discussionInnerIsDroppable(inner: string, id: string): boolean {
  const text = inner.trim();
  if (!text) return true;
  return text === id || text.replace(/[\s<>/]/g, '') === id;
}

/** 社区文本清洗（正文、评论、作者昵称、题名共用）。 */
export function sanitizeCommunityText(raw: string): string {
  if (!raw) return '';
  let text = raw.replace(/\r\n?/g, '\n');
  // <discussion=ID>…</discussion>：留内文（空/纯 ID 整段删）。先于其它规则，
  // 内文中的嵌套标记交给后续步骤继续剥。
  text = text.replace(DISCUSSION_PAIR, (_match, id: string, inner: string) =>
    discussionInnerIsDroppable(inner, id) ? '' : (inner as string));
  // <user=ID> 与 </user>：整删。
  text = text.replace(USER_TAGS, '');
  // color/size/b/i/u/a：删标签留内文。
  text = text.replace(PAIRED_TAGS, '');
  // 平铺回复前缀的孤悬 `<`：@短名< → @短名（每条一次）。
  text = text.replace(REPLY_DANGLING, '@$1');
  // 未知标签：删。
  text = text.replace(UNKNOWN_TAG, '');
  // 控制字符（保留 \n \t）。
  text = stripControls(text);
  return text;
}

/** label-safe 变体（建筑 label / 检索键 / num）：再剥净 <> 与方向控制符。 */
export function labelSafeText(raw: string, maxLength = 24): string {
  const cleaned = sanitizeCommunityText(raw).replace(LABEL_UNSAFE, '').trim();
  const chars = Array.from(cleaned);
  if (chars.length <= maxLength) return cleaned;
  return `${chars.slice(0, maxLength).join('')}…`;
}

/** 作者昵称清洗：空/全空白兜底「无名氏」（检索匹配用原始名，另存原字段）。 */
export function sanitizeAuthorNickname(raw: string): string {
  const cleaned = sanitizeCommunityText(raw ?? '').trim();
  return cleaned.length > 0 ? cleaned : '无名氏';
}

/** 摘要：清洗后折叠空白为单空格并截断（P 级 ≤120 字）。 */
export function abstractOf(raw: string, maxLength = 120): string {
  const flattened = sanitizeCommunityText(raw).replace(/\s+/g, ' ').trim();
  const chars = Array.from(flattened);
  if (chars.length <= maxLength) return flattened;
  return `${chars.slice(0, maxLength).join('')}…`;
}

/** 代码点安全的截断（中文/emoji 均按 1 字符口径，对齐 Python len() 语义）。 */
export function truncateByCodePoints(raw: string, maxLength: number): string {
  const chars = Array.from(raw);
  return chars.length <= maxLength ? raw : `${chars.slice(0, maxLength).join('')}…`;
}
