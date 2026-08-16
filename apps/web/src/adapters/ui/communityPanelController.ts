// Physics Lab community API and panel state.
// @ts-nocheck
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
export function createCommunityPanelController(options) {
  const { setPhoneOpen, showUnlockToast } = options;
  let phoneNotificationsRequest = 0;
  let phoneNotificationsSkip = 0;
  let phoneNotificationsLoading = false;
  let phoneNotificationsHasMore = true;
  let phoneNotificationsObserver = null;
  let phoneNotificationTemplates = [];

  function openPhoneApp(tab,kind){
    setPhoneOpen(true);
    const button=document.querySelector(`[data-online-tab="${tab}"]`); button?.click();
    if(tab==='social'&&kind)loadPhoneSocial(kind);
  }
  
  function updatePhoneBindingState(){
    const bound=Boolean(localStorage.getItem('plSession'));
    document.getElementById('phoneNotificationBind')?.toggleAttribute('hidden',bound);
    document.getElementById('phoneSocialBind')?.toggleAttribute('hidden',bound);
    document.getElementById('phoneSocialTools')?.toggleAttribute('hidden',!bound);
    document.getElementById('phoneNotifications')?.classList.toggle('bound',bound);
    if(!bound){
      const form=document.getElementById('phoneBindForm');
      if(form)form.hidden=false;
    }
  }
  function handlePhysicsSessionExpired(){
    if(!localStorage.getItem('plSession')) return;
    localStorage.removeItem('plSession');
    localStorage.removeItem('plUser');
    updatePhoneBindingState();
    setPhoneOpen(true);
    document.querySelector('[data-online-tab="notifications"]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    const form=document.getElementById('phoneBindForm');
    if(form) form.hidden=false;
    const submit=form?.querySelector('button[type="submit"]');
    if(submit) submit.textContent='重新登录';
    const prompt=document.getElementById('phoneNotificationBind');
    prompt?.classList.add('expanded');
    prompt?.classList.add('session-expired');
    const title=prompt?.querySelector('strong');
    const description=prompt?.querySelector('p');
    if(title) title.textContent='重新连接 Physics Lab';
    if(description) description.textContent='登录状态已过期。重新登录后，即可继续访问社区资料与作品。';
    document.getElementById('phoneBindEmail')?.focus();
    showUnlockToast('请在手机内重新登录 Physics Lab');
  }
  function openPhoneBinding(){
    setPhoneOpen(true);
    document.querySelector('[data-online-tab="notifications"]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    const form=document.getElementById('phoneBindForm');if(form)form.hidden=false;
    document.getElementById('phoneNotificationBind')?.classList.add('expanded');
    const error=document.getElementById('phoneBindError');if(error)error.textContent='';
    document.getElementById('phoneBindEmail')?.focus();
  }
  async function bindPhysicsLabAccount(event){
    event.preventDefault();
    const email=document.getElementById('phoneBindEmail').value.trim();const password=document.getElementById('phoneBindPassword').value;const error=document.getElementById('phoneBindError');const submit=event.currentTarget.querySelector('button[type="submit"]');
    if(!email||!password){error.textContent='请输入邮箱或手机号，以及密码';return;} submit.disabled=true;submit.textContent='正在验证…';error.textContent='';
    try{const response=await fetch('/town-api/pl/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({login:email,password})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Physics Lab 登录失败');localStorage.setItem('plSession',payload.session);localStorage.setItem('plUser',JSON.stringify(payload.user||{}));document.getElementById('phoneBindForm').hidden=true;document.getElementById('phoneNotificationBind')?.classList.remove('session-expired');updatePhoneBindingState();showUnlockToast('Physics Lab 账号已连接');loadPhoneMessages();}catch(caught){error.textContent=caught.message||'绑定失败';}finally{submit.disabled=false;submit.textContent='确认连接';}
  }
  
  async function loadPhoneMessages(append=false){
    if(phoneNotificationsLoading)return;
    const feed=document.getElementById('phoneNotifications'); if(!feed)return;
    let results=feed.querySelector('.phone-feed-results');
    if(!results){results=document.createElement('div');results.className='phone-feed-results';feed.appendChild(results);}
    const session=localStorage.getItem('plSession');
    if(!session){
      results.remove();
      updatePhoneBindingState();
      document.getElementById('phoneNotificationBind')?.classList.add('expanded');
      return;
    }
    if(!append){phoneNotificationsSkip=0;phoneNotificationsHasMore=true;phoneNotificationTemplates=[];results.replaceChildren();}
    phoneNotificationsLoading=true;
    const requestId=++phoneNotificationsRequest;
    const bindPrompt=document.getElementById('phoneNotificationBind');
    bindPrompt?.remove();
    if(!append)results.innerHTML='<div class="phone-feed-loading">正在同步通知…</div>';
    try{
      const response=await fetch(`/town-api/pl/notifications?skip=${phoneNotificationsSkip}&take=20`,{headers:{'x-town-pl-session':session},signal:AbortSignal.timeout(20_000)});
      if(response.status===401){
        if(requestId===phoneNotificationsRequest){
          phoneNotificationsRequest++;
          phoneNotificationsLoading=false;
          if(bindPrompt)feed.replaceChildren(bindPrompt);
          handlePhysicsSessionExpired();
        }
        return;
      }
      if(!response.ok)throw new Error('通知暂时无法同步');
      const payload=await response.json(); const items=Array.isArray(payload.data)?payload.data:Array.isArray(payload.data?.$values)?payload.data.$values:[]; const templates=Array.isArray(payload.templates)?payload.templates:[];
      const knownTemplates=new Map(phoneNotificationTemplates.map(template=>[String(template.ID),template]));
      templates.forEach(template=>knownTemplates.set(String(template.ID),template));
      phoneNotificationTemplates=[...knownTemplates.values()];
      if(requestId!==phoneNotificationsRequest)return;
      const rows=items.map(item=>{const template=phoneNotificationTemplates.find(entry=>String(entry.ID)===String(item.TemplateID));const row=document.createElement('div');row.className='chat-line';const author=document.createElement('b');author.textContent=formatNotificationText(template?.Subject?.Chinese||item.Title||item.Category||'系统',item);const content=document.createElement('span');content.textContent=formatNotificationText(template?.Content?.Chinese||item.Content||item.Fields?.Content||'',item);row.append(author,content);return row;});
      if(!append)results.replaceChildren();
      results.append(...rows); phoneNotificationsSkip+=items.length; phoneNotificationsHasMore=Boolean(payload.hasMore)&&items.length>0;
    }catch(error){if(requestId===phoneNotificationsRequest)results.innerHTML=`<div class="phone-feed-empty">${esc(error.message)||'通知暂时无法同步'}</div>`;}
    finally{phoneNotificationsLoading=false;}
    phoneNotificationsObserver?.disconnect();
    if(phoneNotificationsHasMore){const sentinel=document.createElement('div');sentinel.className='works-sentinel';results.appendChild(sentinel);const scrollRoot=feed.parentElement||feed;phoneNotificationsObserver=new IntersectionObserver(e=>{if(e.some(x=>x.isIntersecting)&&!phoneNotificationsLoading)loadPhoneMessages(true);},{root:scrollRoot,rootMargin:'30%'});phoneNotificationsObserver.observe(sentinel);}
    if(bindPrompt&&!feed.contains(bindPrompt))feed.prepend(bindPrompt);
    updatePhoneBindingState();
  }
  
  function formatNotificationText(template,item){
    const fields=item.Fields||{};
    const users=(item.UserNames||[]).join(' ');
    const work=fields.Discussion||fields.Experiment||'';
    return String(template||'')
      .replace(/{Users}/g,users)
      .replace(/{Experiment}/g,work)
      .replace(/{\$Content}/g,fields.Content||'')
      .replace(/{\$TargetName}/g,fields.TargetName||'')
      .replace(/{\$Until}/g,fields.Until||'')
      .replace(/{\$Editor}/g,fields.Editor||'')
      .replace(/{\$Gold}/g,String(item.Numbers?.Gold??''))
      .replace(/undefined/g,'')
      .trim();
  }
  
  async function loadPhoneSocial(kind){
    const target=document.getElementById('phoneSocialResults'); if(!target)return;
    const session=localStorage.getItem('plSession');
    if(!session){target.innerHTML='<p>请先使用 Physics Lab 账号登录。</p>';return;}
    target.innerHTML='<p>正在同步社区数据…</p>';
    try{
      const response=await fetch(`/town-api/pl/social?kind=${kind}`,{headers:{'x-town-pl-session':session}}); const payload=await response.json();
      if(response.status===401){handlePhysicsSessionExpired();return;}
      if(!response.ok)throw new Error(payload.error||'社区数据暂时不可用');
      if(kind==='profile'){
        const user=payload.data?.User||{}; const stats=payload.data?.Statistic||{};
        target.innerHTML='<article class="social-profile"><strong></strong><span></span><div><b></b><b></b><b></b></div></article>';
        target.querySelector('strong').textContent=user.Nickname||'Physics Lab user'; target.querySelector('span').textContent=user.Verification||`Level ${user.Level||0}`;
        const figures=target.querySelectorAll('b'); figures[0].textContent=`${stats.ExperimentCount||0} 作品`;figures[1].textContent=`${stats.FollowerCount||0} 粉丝`;figures[2].textContent=`${stats.FollowingCount||0} 关注`; return;
      }
      const items=payload.data?.$values||[];
      target.replaceChildren(...(items.length?items.slice(0,12).map(item=>{const row=document.createElement('article');row.className='social-row';const user=item.User||item;row.innerHTML='<div><b></b><small></small></div><span></span>';row.querySelector('b').textContent=item.Subject||user.Nickname||'Untitled';row.querySelector('small').textContent=item.Subject?(user.Nickname||'Anonymous'):(user.Signature||user.Verification||'Resident');row.querySelector('span').textContent=item.Subject?`${item.Stars||0} ★`:(user.Verification||'');return row;}):[Object.assign(document.createElement('p'),{textContent:'这里还没有内容。'})]));
      if(!['mine','favorites'].includes(kind)) target.querySelectorAll('.social-row').forEach((row,index)=>{const user=items[index]?.User||items[index];if(!user?.ID)return;const button=document.createElement('button');button.type='button';button.className='social-follow';button.textContent=kind==='following'?'取消关注':'关注';button.addEventListener('click',event=>{event.stopPropagation();toggleSocialFollow(user.ID,kind!=='following',button);});row.appendChild(button);});
    }catch(error){target.innerHTML=`<p>${esc(error.message)||'社区数据暂时不可用'}</p>`;}
  }
  
  async function toggleSocialFollow(targetId,follow,button){
    const session=localStorage.getItem('plSession');if(!session)return;button.disabled=true;
    try{const response=await fetch('/town-api/pl/social/follow',{method:'POST',headers:{'content-type':'application/json','x-town-pl-session':session},body:JSON.stringify({targetId,action:follow?1:0})});const payload=await response.json();if(!response.ok)throw new Error(payload.error);button.textContent=follow?'已关注':'已取消';}catch(error){showUnlockToast(error.message||'Unable to update follow.');}finally{button.disabled=false;}
  }
  
  const PUBLIC_WORKS = [
    { id:'field-guide', title:'New Resident Field Guide', author:'TurtleSim', role:'Steward', year:'2026', category:'Guides', tags:['onboarding','city'], abstract:'A practical route through the city for first-time residents.', status:'Updated' },
    { id:'building-atlas', title:'Architecture Atlas: Main District', author:'Greybox', role:'Volunteer', year:'2026', category:'Research', tags:['architecture','map'], abstract:'Measured notes and visual records for the civic buildings.', status:'Featured' },
    { id:'oral-history', title:'Voices from the Plaza', author:'Stardust Press', role:'Volunteer', year:'2025', category:'Stories', tags:['oral history','residents'], abstract:'Short conversations collected around the central plaza.', status:'Archive' },
    { id:'mutual-aid', title:'Mutual Aid Handbook', author:'Commons Group', role:'Contributor', year:'2026', category:'Guides', tags:['community','help'], abstract:'Requests, responses and repeatable ways to help a neighbour.', status:'Updated' },
    { id:'night-survey', title:'After Dark: A Lighting Survey', author:'Aster', role:'Volunteer', year:'2025', category:'Research', tags:['night','infrastructure'], abstract:'A walkability study of lamps, crossings and public space.', status:'Archive' },
    { id:'city-code', title:'Open City Protocol', author:'Senate Working Group', role:'Steward', year:'2026', category:'Civic', tags:['governance','proposal'], abstract:'A living proposal for transparent decisions and public records.', status:'In review' },
    { id:'garden-notes', title:'Conservatory Growing Notes', author:'Lin', role:'Contributor', year:'2026', category:'Stories', tags:['plants','care'], abstract:'Seasonal observations from the glasshouse and its keepers.', status:'New' }
  ];
  let worksContext='knowledgebase';
  let worksTitleOverride='';
  let worksCategory='All';
  let liveWorks=[];
  let worksLoading=false;
  let worksHasMore=false;
  let worksError='';
  let worksQuery=null;
  let worksObserver=null;
  let activeWorkId='';
  let activeWorkCategory='Experiment';
  let activeWorkStarred=false;
  const worksRequests=new Map();
  
  function openWorkDetail(work){
    activeWorkId=work.id||'';
    activeWorkCategory=work.category==='Discussion'?'Discussion':'Experiment';
    activeWorkStarred=false; document.getElementById('workStar').textContent='☆ 收藏/点赞';
    document.getElementById('workDetailTitle').textContent=work.title;
    document.getElementById('workDetailByline').textContent=`${work.author} · ${work.role||'Resident'}`;
    document.getElementById('workDetailStats').textContent=`${work.visits||0} views  ·  ${work.stars||0} stars  ·  ${work.comments||0} comments  ·  ${work.remixes||0} remixes`;
    document.getElementById('workDetailSummary').textContent=work.abstract||'Loading the published summary…';
    document.getElementById('workComments').innerHTML='<p class="work-comments-empty">Open comments to load the discussion.</p>';
    document.getElementById('workDetailPanel')?.classList.add('open');
    loadWorkSummary(activeWorkId);
  }
  function closeWorkDetail(){document.getElementById('workDetailPanel')?.classList.remove('open');activeWorkId='';activeWorkCategory='Experiment';}
  async function loadWorkSummary(id){
    const session=localStorage.getItem('plSession'); if(!session)return;
    try{const response=await fetch(`/town-api/pl/work/${id}`,{headers:{'x-town-pl-session':session,'x-town-work-category':activeWorkCategory}});if(!response.ok)return;const payload=await response.json();const data=payload.data||{};const text=data.Summary||data.Description?.[0]||data.LocalizedDescription||'';if(text&&id===activeWorkId)document.getElementById('workDetailSummary').textContent=text;}catch{}
  }
  async function loadWorkComments(){
    const box=document.getElementById('workComments'); if(!activeWorkId)return; const session=localStorage.getItem('plSession');
    if(!session){box.innerHTML='<p class="work-comments-empty">Sign in with Physics Lab to load comments.</p>';return;}
    box.innerHTML='<p class="work-comments-empty">Loading comments…</p>';
    try{const response=await fetch(`/town-api/pl/work/${activeWorkId}/comments`,{headers:{'x-town-pl-session':session,'x-town-work-category':activeWorkCategory}});const payload=await response.json();if(!response.ok)throw new Error(payload.error);const comments=payload.data?.Comments?.$values||payload.data?.$values||[];box.replaceChildren(...(comments.length?comments.map(comment=>{const row=document.createElement('article');row.className='work-comment';row.innerHTML='<b></b><p></p><small></small>';row.querySelector('b').textContent=comment.Author?.Nickname||'Resident';row.querySelector('p').textContent=comment.Content||'';row.querySelector('small').textContent=comment.SendDate?new Date(comment.SendDate).toLocaleDateString():'';return row;}):[Object.assign(document.createElement('p'),{className:'work-comments-empty',textContent:'No comments yet.'})]));}catch(error){box.innerHTML=`<p class="work-comments-empty">${esc(error.message)||'Comments unavailable.'}</p>`;}
  }
  async function postWorkComment(event){
    event.preventDefault(); if(!activeWorkId)return; const session=localStorage.getItem('plSession'); const input=document.getElementById('workCommentInput'); const content=input.value.trim();
    if(!session){showUnlockToast('Sign in with Physics Lab to comment.');return;} if(!content)return;
    const submit=event.currentTarget.querySelector('button');submit.disabled=true;
    try{const response=await fetch(`/town-api/pl/work/${activeWorkId}/comments`,{method:'POST',headers:{'content-type':'application/json','x-town-pl-session':session,'x-town-work-category':activeWorkCategory},body:JSON.stringify({content})});const payload=await response.json();if(!response.ok)throw new Error(payload.error);input.value='';await loadWorkComments();showUnlockToast('Comment published.');}catch(error){showUnlockToast(error.message||'Unable to publish comment.');}finally{submit.disabled=false;}
  }
  async function loadWorkDerivatives(){
    const box=document.getElementById('workComments');if(!activeWorkId)return;const session=localStorage.getItem('plSession');if(!session){box.innerHTML='<p class="work-comments-empty">Sign in to view derivatives.</p>';return;}box.innerHTML='<p class="work-comments-empty">Loading derivatives…</p>';
    try{const response=await fetch(`/town-api/pl/work/${activeWorkId}/derivatives`,{headers:{'x-town-pl-session':session,'x-town-work-category':activeWorkCategory}});const payload=await response.json();if(!response.ok)throw new Error(payload.error);const items=payload.data?.$values||payload.data?.Summaries?.$values||[];box.replaceChildren(...(items.length?items.map(item=>{const row=document.createElement('article');row.className='work-comment derivative-row';row.innerHTML='<b></b><p></p><small></small>';row.querySelector('b').textContent=item.Subject||'Untitled derivative';row.querySelector('p').textContent=item.User?.Nickname||'Anonymous';row.querySelector('small').textContent=`${item.Stars||0} stars · ${item.Comments||0} comments`;return row;}):[Object.assign(document.createElement('p'),{className:'work-comments-empty',textContent:'No derivatives yet.'})]));}catch(error){box.innerHTML=`<p class="work-comments-empty">${esc(error.message)||'Derivatives unavailable.'}</p>`;}
  }
  async function loadWorkSupporters(){
    const box=document.getElementById('workComments');if(!activeWorkId)return;const session=localStorage.getItem('plSession');if(!session){box.innerHTML='<p class="work-comments-empty">Sign in to view supporters.</p>';return;}box.innerHTML='<p class="work-comments-empty">Loading supporters…</p>';
    try{const response=await fetch(`/town-api/pl/work/${activeWorkId}/supporters`,{headers:{'x-town-pl-session':session,'x-town-work-category':activeWorkCategory}});const payload=await response.json();if(!response.ok)throw new Error(payload.error);const items=payload.data?.$values||[];box.replaceChildren(...(items.length?items.map(user=>{const row=document.createElement('article');row.className='work-comment';row.innerHTML='<b></b><p></p>';row.querySelector('b').textContent=user.Nickname||'Resident';row.querySelector('p').textContent=`Level ${user.Level||0}`;return row;}):[Object.assign(document.createElement('p'),{className:'work-comments-empty',textContent:'No supporters yet.'})]));}catch(error){box.innerHTML=`<p class="work-comments-empty">${esc(error.message)||'Supporters unavailable.'}</p>`;}
  }
  async function toggleWorkSupport(){
    if(!activeWorkId)return;const session=localStorage.getItem('plSession');if(!session){showUnlockToast('Sign in with Physics Lab to support works.');return;}const button=document.getElementById('workSupport');button.disabled=true;
    try{const response=await fetch(`/town-api/pl/work/${activeWorkId}/support`,{method:'POST',headers:{'content-type':'application/json','x-town-pl-session':session,'x-town-work-category':activeWorkCategory},body:JSON.stringify({action:1})});const payload=await response.json();if(!response.ok)throw new Error(payload.error);button.textContent='已支持';}catch(error){showUnlockToast(error.message||'Unable to support work.');}finally{button.disabled=false;}
  }
  async function toggleWorkStar(){
    if(!activeWorkId)return; const session=localStorage.getItem('plSession'); if(!session){showUnlockToast('Sign in with Physics Lab to star works.');return;}
    const button=document.getElementById('workStar');button.disabled=true;try{const next=!activeWorkStarred;const response=await fetch(`/town-api/pl/work/${activeWorkId}/star`,{method:'POST',headers:{'content-type':'application/json','x-town-pl-session':session,'x-town-work-category':activeWorkCategory},body:JSON.stringify({action:next?1:0})});if(!response.ok)throw new Error('Unable to update star');activeWorkStarred=next;button.textContent=next?'★ 已点赞':'☆ 收藏/点赞';}catch(error){showUnlockToast(error.message||'Unable to update star');}finally{button.disabled=false;}
  }
  
  function openWorksPanel(context,queryOverride=null) {
    worksContext=context;
    worksTitleOverride=queryOverride?.title||'';
    worksQuery=queryOverride;
    worksCategory='All';
    worksObserver?.disconnect();
    document.getElementById('worksPanel')?.classList.add('open');
    loadWorks(context,queryOverride);
  }
  function closeWorksPanel(){ worksObserver?.disconnect(); document.getElementById('worksPanel')?.classList.remove('open'); }
  async function loadWorks(context,queryOverride=null,append=false){
    if(worksLoading)return;
    worksLoading=true; worksError='';
    if(!append){liveWorks=[];worksHasMore=false;}
    renderWorksPanel();
    const scope=['senate','all','discussion','featured'].includes(context)?context:'knowledge';
    try{
      const {title: _title, ...configuredQuery}=queryOverride||{};
      const take=Number(configuredQuery.Take)||24;
      const query={...configuredQuery};
      if(queryOverride){
        query.Skip=(Number(configuredQuery.Skip)||0)+liveWorks.length;
        query.From=append&&liveWorks.length?liveWorks[liveWorks.length-1].id:(configuredQuery.From??null);
      }
      const request=queryOverride?fetch('/town-api/works/query',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query})}):fetch(`/town-api/works?scope=${scope}`);
      const requestKey=`${context}:${JSON.stringify(query)}`;
      if(!worksRequests.has(requestKey)) worksRequests.set(requestKey,request.then(async response=>{
        if(!response.ok) throw new Error('The public archive is temporarily unavailable.');
        return response.json();
      }).finally(()=>worksRequests.delete(requestKey)));
      const payload=await worksRequests.get(requestKey);
      if(context!==worksContext)return;
      const page=(payload.works||[]).map(work=>({
        ...work, role:work.verification||'Resident', year:new Date(work.createdAt).getFullYear().toString(),
        abstract:`${work.visits} views · ${work.stars} stars · ${work.comments} comments · ${work.remixes} remixes`,
        status:work.verification||'Public'
      }));
      const known=new Set(liveWorks.map(work=>work.id));
      liveWorks.push(...page.filter(work=>!known.has(work.id)));
      worksHasMore=Boolean(queryOverride)&&page.length>=take;
    }catch(error){
      if(context!==worksContext)return;
      worksError=error instanceof Error?error.message:'The public archive is temporarily unavailable.';
    }finally{
      if(context===worksContext){worksLoading=false;renderWorksPanel();}
    }
  }
  function renderWorksPanel(){
    const isSenate=worksContext==='senate';
    const fallback=isSenate?PUBLIC_WORKS.filter(w=>w.role==='Volunteer'||w.role==='Steward'):PUBLIC_WORKS;
    const source=liveWorks.length?liveWorks:(worksError?fallback:[]);
    const filtered=source;
    const viewCopy={discussion:['BLACK HOLE · DISCUSSIONS','Community discussions','Questions, stories and debates from the discussion district.'],featured:['REVIEW DESK · SELECTED','Selected works','Featured experiments chosen by the community.']};
    const copy=viewCopy[worksContext];
    document.getElementById('worksKicker').textContent=copy?.[0]||(isSenate?'UPPER HOUSE · CONTRIBUTIONS':worksContext==='all'?'CITY FEED · NEW WORKS':'KNOWLEDGE BASE · CATALOGUE');
    document.getElementById('worksTitle').textContent=worksTitleOverride||copy?.[1]||(isSenate?'Volunteer works':worksContext==='all'?'All public works':'The city knowledge base');
    const list=document.getElementById('worksList');
    if(worksLoading&&!liveWorks.length){ list.innerHTML='<div class="works-loading"><i></i><span>Retrieving public works</span></div>'; return; }
    list.replaceChildren(...filtered.map(work=>{
      const article=document.createElement('article'); article.className='work-record'; article.dataset.workId=work.id||'';
      const content=document.createElement('div'); content.className='work-content';
      const meta=document.createElement('div'); meta.className='work-meta';
      const category=document.createElement('span'); category.textContent=work.category;
      const year=document.createElement('span'); year.textContent=work.year;
      const status=document.createElement('b'); status.textContent=work.status;
      meta.append(category,year,status);
      const title=document.createElement('h3'); title.textContent=work.title;
      const byline=document.createElement('p'); byline.className='work-byline'; byline.textContent=`${work.author} · ${work.role}`;
      const abstract=document.createElement('p'); abstract.className='work-abstract'; abstract.textContent=work.abstract;
      const tags=document.createElement('div'); tags.className='work-tags';
      (work.tags||[]).forEach(tag=>{const span=document.createElement('span'); span.textContent=tag; tags.appendChild(span);});
      content.append(meta,title,byline,abstract,tags);
      article.appendChild(content);
      // Work detail content is temporarily disabled; restore the click handler with the detail drawer.
      return article;
    }));
    if(!filtered.length){ const empty=document.createElement('p'); empty.className='works-empty'; empty.textContent='No matching records.'; list.appendChild(empty); }
    if(worksHasMore||worksLoading){
      const sentinel=document.createElement('div'); sentinel.className='works-sentinel';
      if(worksLoading)sentinel.innerHTML='<div class="works-loading"><i></i><span>Retrieving public works</span></div>';
      list.appendChild(sentinel);
      worksObserver?.disconnect();
      worksObserver=new IntersectionObserver(entries=>{
        if(entries.some(entry=>entry.isIntersecting)&&worksHasMore&&!worksLoading)loadWorks(worksContext,worksQuery,true);
      },{root:list,rootMargin:'30%',threshold:0});
      worksObserver.observe(sentinel);
    }else worksObserver?.disconnect();
  }
  
  // ── Theme ─────────────────────────────────────────────────────────────────────

  return {
    openPhoneApp, updatePhoneBindingState, openPhoneBinding, bindPhysicsLabAccount,
    loadPhoneMessages, loadPhoneSocial, closeWorkDetail, loadWorkComments,
    postWorkComment, loadWorkDerivatives, loadWorkSupporters, toggleWorkSupport,
    toggleWorkStar, openWorksPanel, closeWorksPanel,
  };
}
