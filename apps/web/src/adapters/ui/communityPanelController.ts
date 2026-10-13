// The town's public works archive. Browsing is fully anonymous: no Physics Lab
// account or other login is required to read the catalogue.
import { townApiFetch } from '../../core/townApi';
const fetch = townApiFetch;
async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) throw new Error(`The public archive returned an empty response (${response.status}).`);
  try { return JSON.parse(text) as T; }
  catch { throw new Error(`The public archive returned invalid JSON (${response.status}).`); }
}

interface PublicWork {
  id: string;
  title: string;
  author: string;
  role: string;
  year: string;
  category: string;
  tags?: string[];
  abstract: string;
  status: string;
}

interface LiveWork {
  id: string;
  title: string;
  author: string;
  verification?: string;
  role: string;
  year: string;
  category: string;
  visits: number;
  stars: number;
  comments: number;
  remixes: number;
  abstract: string;
  status: string;
  tags?: string[];
  createdAt: string | number | Date;
}

interface WorksQueryOverride {
  title?: string;
  Take?: number;
  Skip?: number;
  From?: string | null;
}

export interface CommunityPanelControllerOptions {
  setPhoneOpen: (open: boolean) => void;
  showUnlockToast: (message: string) => void;
}

export function createCommunityPanelController(_options: CommunityPanelControllerOptions) {
  let worksContext: string = 'knowledgebase';
  let worksTitleOverride = '';
  let liveWorks: LiveWork[] = [];
  let worksLoading = false;
  let worksHasMore = false;
  let worksError = '';
  let worksQuery: WorksQueryOverride | null = null;
  let worksObserver: IntersectionObserver | null = null;
  const worksRequests = new Map<string, Promise<{ works?: LiveWork[] }>>();

  function openWorksPanel(context: string, queryOverride: WorksQueryOverride | null = null) {
    worksContext = context;
    worksTitleOverride = queryOverride?.title || '';
    worksQuery = queryOverride;
    worksObserver?.disconnect();
    document.getElementById('worksPanel')?.classList.add('open');
    loadWorks(context, queryOverride);
  }
  function closeWorksPanel() { worksObserver?.disconnect(); document.getElementById('worksPanel')?.classList.remove('open'); }
  async function loadWorks(context: string, queryOverride: WorksQueryOverride | null = null, append = false) {
    if (worksLoading) return;
    worksLoading = true; worksError = '';
    if (!append) { liveWorks = []; worksHasMore = false; }
    renderWorksPanel();
    const scope = ['senate', 'all', 'discussion', 'featured'].includes(context) ? context : 'knowledge';
    try {
      const { title: _title, ...configuredQuery } = queryOverride || {};
      const take = Number(configuredQuery.Take) || 24;
      const query: Record<string, unknown> = { ...configuredQuery };
      if (queryOverride) {
        query.Skip = (Number(configuredQuery.Skip) || 0) + liveWorks.length;
        query.From = append && liveWorks.length ? liveWorks[liveWorks.length - 1]!.id : (configuredQuery.From ?? null);
      }
      const request = queryOverride ? fetch('/town-api/works/query', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }) }) : fetch(`/town-api/works?scope=${scope}`);
      const requestKey = `${context}:${JSON.stringify(query)}`;
      if (!worksRequests.has(requestKey)) worksRequests.set(requestKey, request.then(async (response) => {
        if (!response.ok) throw new Error('The public archive is temporarily unavailable.');
        return readJson<{ works?: LiveWork[] }>(response);
      }).finally(() => worksRequests.delete(requestKey)));
      const payload = await worksRequests.get(requestKey);
      if (context !== worksContext) return;
      const page = ((payload?.works) || []).map((work) => ({
        ...work, role: work.verification || 'Resident', year: new Date(work.createdAt).getFullYear().toString(),
        abstract: `${work.visits} views · ${work.stars} stars · ${work.comments} comments · ${work.remixes} remixes`,
        status: work.verification || 'Public',
      }));
      const known = new Set(liveWorks.map((work) => work.id));
      liveWorks.push(...page.filter((work) => !known.has(work.id)));
      worksHasMore = Boolean(queryOverride) && page.length >= take;
    } catch (error) {
      if (context !== worksContext) return;
      worksError = error instanceof Error ? error.message : 'The public archive is temporarily unavailable.';
    } finally {
      if (context === worksContext) { worksLoading = false; renderWorksPanel(); }
    }
  }
  function renderWorksPanel() {
    const isSenate = worksContext === 'senate';
    // Do not fall back to the static English placeholder catalog on failure:
    // showing mock entries as if they were live archive records misleads users
    // into thinking the archive only contains English works.
    const filtered: LiveWork[] = liveWorks.length ? liveWorks : [];
    const viewCopy: Record<string, [string, string, string]> = { discussion: ['BLACK HOLE · DISCUSSIONS', 'Community discussions', 'Questions, stories and debates from the discussion district.'], featured: ['REVIEW DESK · SELECTED', 'Selected works', 'Featured experiments chosen by the community.'] };
    const copy = viewCopy[worksContext];
    document.getElementById('worksKicker')!.textContent = copy?.[0] || (isSenate ? 'UPPER HOUSE · CONTRIBUTIONS' : worksContext === 'all' ? 'CITY FEED · NEW WORKS' : 'KNOWLEDGE BASE · CATALOGUE');
    document.getElementById('worksTitle')!.textContent = worksTitleOverride || copy?.[1] || (isSenate ? 'Volunteer works' : worksContext === 'all' ? 'All public works' : 'The city knowledge base');
    const list = document.getElementById('worksList')!;
    if (worksLoading && !liveWorks.length) { list.innerHTML = '<div class="works-loading"><i></i><span>Retrieving public works</span></div>'; return; }
    list.replaceChildren(...filtered.map((work) => {
      const article = document.createElement('article'); article.className = 'work-record'; article.dataset.workId = work.id || '';
      const content = document.createElement('div'); content.className = 'work-content';
      const meta = document.createElement('div'); meta.className = 'work-meta';
      const category = document.createElement('span'); category.textContent = work.category;
      const year = document.createElement('span'); year.textContent = work.year;
      const status = document.createElement('b'); status.textContent = work.status;
      meta.append(category, year, status);
      const title = document.createElement('h3'); title.textContent = work.title;
      const byline = document.createElement('p'); byline.className = 'work-byline'; byline.textContent = `${work.author} · ${work.role}`;
      const abstract = document.createElement('p'); abstract.className = 'work-abstract'; abstract.textContent = work.abstract;
      const tags = document.createElement('div'); tags.className = 'work-tags';
      (work.tags || []).forEach((tag) => { const span = document.createElement('span'); span.textContent = tag; tags.appendChild(span); });
      content.append(meta, title, byline, abstract, tags);
      article.appendChild(content);
      return article;
    }));
    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'works-empty';
      if (worksError) { empty.textContent = `${worksError} Try again in a moment.`; empty.style.color = 'var(--accent,#c98a3b)'; }
      else empty.textContent = 'No matching records.';
      list.appendChild(empty);
    }
    if (worksHasMore || worksLoading) {
      const sentinel = document.createElement('div'); sentinel.className = 'works-sentinel';
      if (worksLoading) sentinel.innerHTML = '<div class="works-loading"><i></i><span>Retrieving public works</span></div>';
      list.appendChild(sentinel);
      worksObserver?.disconnect();
      worksObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting) && worksHasMore && !worksLoading) loadWorks(worksContext, worksQuery, true);
      }, { root: list, rootMargin: '30%', threshold: 0 });
      worksObserver.observe(sentinel);
    } else worksObserver?.disconnect();
  }

  return { openWorksPanel, closeWorksPanel };
}
