/* Demon Gacha desktop: every game action runs on the Supabase server (see supabase/schema.sql).
   This file draws the screens and sends the player's clicks to the server. */
{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RAR=[{k:'Common',c:'#a7b0ba',sh:5,cr:40},{k:'Rare',c:'#3da5ff',sh:10,cr:100},{k:'Epic',c:'#b45cff',sh:25,cr:250},{k:'Legendary',c:'#ffc23d',sh:60,cr:600},{k:'Mythic',c:'#ff3355',sh:150,cr:1500},{k:'HM',c:'#3df2ff',sh:100,cr:1000},{k:'APEX',c:'#ff4fd8',sh:300,cr:5000},{k:'IME',c:'#ffd76a',sh:300,cr:5000}];
const CAP=10,HOLO=.04,RUN_CAP=6,HL_CAP=5,SHOP=100,STREAK=[1,1,2,2,3,3,5],MAXL=10;
const QDEF={open4:{t:'Open 4 packs',goal:4,rw:1},open10:{t:'Open 10 packs',goal:10,rw:2},epic:{t:'Pull an Epic or better',goal:1,rw:1},run:{t:'Survive 20 seconds in Practice Run',goal:1,rw:1},hl:{t:'Get 5 in a row in Harder or Easier',goal:1,rw:1},shard:{t:'Earn 50 shards from packs',goal:50,rw:1},holo:{t:'Pull a holo card',goal:1,rw:2},craft:{t:'Craft a card with shards',goal:1,rw:1}};
const QD=QDEF;
const TINT=['grayscale(1) brightness(1.15)','hue-rotate(220deg) saturate(1.2)','hue-rotate(275deg) saturate(1.1)','hue-rotate(42deg) saturate(1.4) brightness(1.15)','drop-shadow(0 0 8px #ff3355)','hue-rotate(175deg) saturate(1.3) drop-shadow(0 0 8px #3df2ff)','hue-rotate(300deg) saturate(1.6) drop-shadow(0 0 10px #ff4fd8)','sepia(1) saturate(4) hue-rotate(5deg) brightness(1.15) drop-shadow(0 0 10px #ffd76a)'];
const EGG={'Silent clubstep':'(i hate this level)'};
const OTAG='<span class="otag" title="Owner of Demon Gacha">Owner</span>';
const ft=t=>new Date(t).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});

/* table labels on narrow windows */
new MutationObserver(()=>{for(const c of document.querySelectorAll('.stack td:not([data-l])')){let i=0,p=c;while(p=p.previousElementSibling)i+=p.colSpan;c.dataset.l=c.closest('table').rows[0].cells[i]?.textContent||''}}).observe(document,{childList:true,subtree:true});

/* ---------- connection ---------- */
let SB=null,ME=null,S=null,nextAt=null,LIST=[],HMS=[],BY={},TIER=[[],[],[],[],[],[],[],[]],OWNER_ID=null,cur='home',busy=false;
function readCfg(){const c=window.DG_CONFIG||{};let url=c.url||'',key=c.anonKey||'';if(!url||!key){try{const o=JSON.parse(localStorage.getItem('dg-cfg')||'null');if(o){url=o.url;key=o.key}}catch(e){}}return{url,key}}
function gate(id){['boot','setup','login'].forEach(g=>{$('#'+g).hidden=g!==id})}
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;$('#toasts').append(t);setTimeout(()=>t.remove(),3400)}
function errText(e){const m=String(e&&e.message||e||'Something went wrong');if(/Failed to fetch|NetworkError|fetch failed/i.test(m))return 'Can\'t reach the server. Check your internet connection.';return m.replace(/^.*?ERROR:\s*/,'')}
function kicked(){if(!S)return;S=null;['spin','rev','sell','acc','insp'].forEach(id=>{$('#'+id).hidden=true});gate('login');$('#loginMsg').textContent='You were signed out. Log in again.'}
async function rpc(fn,args){const {data,error}=await SB.rpc(fn,args||{});if(error){if(/Not signed in/.test(error.message)&&!/^dg_(login|register|logout)$/.test(fn))kicked();throw new Error(error.message)}return data}
async function act(fn,args,ok){try{const d=await rpc(fn,args);if(ok)ok(d);await refresh();return d}catch(e){toast(errText(e));return undefined}}

/* ---------- cards ---------- */
const SEC=p=>p<=75?['main','Main','Main list: AREDL #1–75']:p<=150?['ext','Extended','Extended list: AREDL #76–150']:['leg','Legacy','Legacy: AREDL #151 and below'];
const BADGE=c=>c.r===7?['top5','Top 5','Unrated extreme · would be top 5 if rated']:c.hm?['sbe','SBE','Should Be Extreme']:SEC(c.p);
function card(c,h,miss){const R=RAR[c.r],sc=BADGE(c);return `<div class="card${c.r===6?' apex':c.r===7?' ime':''}${h?' holo':''}${miss?' miss':''}" style="--rc:${R.c}" data-n="${esc(c.n)}" data-h="${h?1:0}"><span class="pos"${EGG[c.n]?` title="${esc(EGG[c.n])}"`:''}>${c.hm?esc(c.rate||'Unranked'):'#'+c.p}</span><span class="rr">${R.k}</span><img class="df" src="face.png" alt="" style="--tint:${TINT[c.r]}">${sc?`<span class="lt ${sc[0]}" title="${sc[2]}">${sc[1]}</span>`:''}<b class="nm">${esc(c.n)}</b></div>`}
function rollR(){if(Math.random()<.001&&TIER[6].length)return 6;const x=Math.random()*100;let r=x<1?4:x<5?3:x<15?2:x<40?1:0;while(!TIER[r].length)r--;return r}
async function loadDefs(){let all=[];for(let from=0;;from+=1000){const {data,error}=await SB.from('card_defs').select('name,pos,rarity,hm,rate').order('pos',{ascending:true,nullsFirst:true}).range(from,from+999);if(error)throw new Error(error.message);all=all.concat(data);if(data.length<1000)break}
  LIST=[];HMS=[];BY={};TIER=[[],[],[],[],[],[],[],[]];
  for(const d of all){const c={n:d.name,p:d.pos||0,r:d.rarity,hm:d.hm,rate:d.rate};BY[c.n]=c;if(c.hm)HMS.push(c);else{LIST.push(c);TIER[c.r].push(c)}}
  LIST.sort((a,b)=>a.p-b.p);$('#allNames').innerHTML=HMS.concat(LIST).map(c=>`<option value="${esc(c.n)}">`).join('')}
const uniq=()=>LIST.reduce((a,c)=>a+(S.cards[c.n]?1:0),0),holos=()=>LIST.reduce((a,c)=>a+(S.cards[c.n]===2?1:0),0);

/* ---------- state from the server ---------- */
function applyState(st){const paidBefore=S&&S.invites?S.invites.filter(f=>f.paid).length:null,tinBefore=S?S.tin:null;ME=st.me;S={packs:ME.packs,shards:ME.shards,opened:ME.opened,streak:ME.streak,last:ME.last_login,day:st.today,daily:{run:ME.daily_run,hl:ME.daily_hl},quests:ME.quests||[],ms:ME.ms||{},got:ME.got||{},best:{run:ME.best_run||0,hl:ME.best_hl||0},att:ME.attempts||0,name:ME.username,cards:st.cards||{},when:st.when||{},log:st.log||[],pulls:ME.pulls||{},nd:ME.nd_packs||0,auto:!!ME.auto_open,invite:ME.invite_code||'',invites:st.invites||[],invitedBy:st.invited_by||null,tin:+st.trades_in||0,owner:!!ME.is_owner,admin:!!(ME.is_owner||ME.is_admin),needs:!!ME.needs_name};
  nextAt=st.next_pack_ms==null?null:Date.now()+Number(st.next_pack_ms);
  if(tinBefore!=null&&S.tin>tinBefore){toast('New trade offer! Open the Trades tab to answer it.');if(cur==='trades')loadTrades()}
  if(paidBefore!=null){const now=S.invites.filter(f=>f.paid);if(now.length>paidBefore)now.slice(paidBefore).forEach(f=>toast(`+5 packs · ${f.u} opened 10 packs with your invite`))}}
let refreshing=null;
async function refresh(){if(refreshing)return refreshing;refreshing=(async()=>{try{applyState(await rpc('dg_state'));render()}finally{refreshing=null}})();return refreshing}
const dayMinus1=d=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()-1);return x.toISOString().slice(0,10)};

/* ---------- views ---------- */
/* luck: Legendary-or-better cards you've pulled compared with the normal number for that many cards */
/* each card: 1 in 1,000 is the APEX, then 0.5% Honorable Mention, then the normal rarity roll */
/* rank for sorting: APEX (GRIEF) is the top tier, IME just below it */
const RK=c=>c.r===6?8:c.r===7?7:c.r;
/* each card: 1 in 500 is IME, then 1 in 1,000 APEX, then 0.5% Honorable Mention, then the normal rarity roll */
const K=.998*.999*.995,ODDS={c:.6*K,r:.25*K,e:.1*K,l:.04*K,m:.01*K,hm:.998*.999*.005,apex:.998*.001,ime:.002};
function binTail(n,k,p){if(k<=0)return 1;if(k>n)return 0;const lq=Math.log1p(-p),r=p/(1-p);let lc=0;for(let i=1;i<=k;i++)lc+=Math.log(n-k+i)-Math.log(i);
  let pmf=Math.exp(lc+k*Math.log(p)+(n-k)*lq),sum=0;for(let j=k;j<=n;j++){sum+=pmf;pmf*=(n-j)/(j+1)*r;if(pmf<sum*1e-12)break}return Math.min(1,sum)}
function luckOf(p){p=p||{};const n=+p.n||0;if(n<1)return null;const big=(+p.l||0)+(+p.m||0)+(+p.hm||0)+(+p.apex||0)+(+p.ime||0),pb=ODDS.l+ODDS.m+ODDS.hm+ODDS.apex+ODDS.ime;
  return{n,pct:big/(n*pb)*100,big,pb,tail:binTail(n,big,pb)}}
const setH=(el,h)=>{if(el._h!==h){el._h=h;el.innerHTML=h}};
const bigNum=x=>x>=1e6?(x/1e6).toFixed(x>=1e7?0:1)+' million':Math.round(x).toLocaleString();
/* your rarest cards: APEX, IME, then Honorable Mentions, then Mythic down; holos first; then higher on the list */
function renderRare(){const own=HMS.concat(LIST).filter(c=>S.cards[c.n]);own.sort((a,b)=>(RK(b)-RK(a))||((S.cards[b.n]===2)-(S.cards[a.n]===2))||((a.p||0)-(b.p||0)));
  const top=own.slice(0,6);setH($('#rareBox'),`<h2>Your rarest cards</h2>`+(top.length?`<div class="cgrid">${top.map(c=>`<div class="cell">${card(c,S.cards[c.n]===2)}</div>`).join('')}</div><p class="note"><span class="tip-mouse">Double-click</span><span class="tip-touch">Double-tap</span> a card to inspect it.</p>`:'<p class="note">Open a pack and your best cards show up here.</p>'))}
/* Home rows: newest cards, the 7 hardest demons, everyone's rare pulls */
let FEED={feed:[],top:null},feedAt=0;
async function loadFeed(){feedAt=Date.now();try{FEED=await rpc('dg_feed')||FEED}catch(e){}if(cur==='home'&&S){renderTop();renderFeed()}}
const ago=t=>{const s=Math.max(0,(Date.now()-t)/1000);return s<60?'just now':s<3600?Math.floor(s/60)+' min ago':s<86400?Math.floor(s/3600)+' h ago':Math.floor(s/86400)+' d ago'};
function renderRecent(){const own=Object.keys(S.cards).filter(n=>BY[n]).sort((a,b)=>(S.when[b]||0)-(S.when[a]||0)).slice(0,10);
  setH($('#recentBox'),'<h2>Recently collected</h2>'+(own.length?`<div class="hrow">${own.map(n=>`<div class="cell">${card(BY[n],S.cards[n]===2)}${S.when[n]?`<small class="note" style="margin:0">${ago(S.when[n])}</small>`:''}</div>`).join('')}</div>`:'<p class="note">Cards you get show up here, newest first.</p>'))}
function renderTop(){const top=LIST.filter(c=>c.p>=1&&c.p<=7);
  setH($('#topBox'),`<h2>Featured: the hardest demons</h2><div class="hrow">${top.map(c=>{const o=S.cards[c.n]||0,k=FEED.top?FEED.top[c.n]:null;return `<div class="cell">${card(c,o===2,!o)}<small class="note" style="margin:0">${o?'<b style="color:var(--lime)">You have it</b>':'Not yet'}${k!=null?` · ${k} player${k==1?' has':'s have'} it`:''}</small></div>`}).join('')}</div>`)}
function renderFeed(){const f=(FEED.feed||[]).filter(x=>BY[x.n]).slice(0,matchMedia('(max-width:600px)').matches?12:30);
  setH($('#feedList'),f.map(x=>{const c=BY[x.n],R=RAR[c.r];return `<div class="fd"><i class="${c.r===6?'ap':c.r===7?'im':''}" style="--rc:${R.c}"></i><div><b>${esc(x.u)}</b>${x.o?OTAG:''} pulled <button class="fn" data-act="finsp" data-n="${esc(c.n)}" data-h="${x.h?1:0}" style="color:${R.c}">${c.hm?'':'#'+c.p+' '}${esc(c.n)}</button>${x.h?' <span class="hb">Holo</span>':''}<small>${c.r===5?'Honorable Mention':R.k} · ${ago(x.t)}</small></div></div>`}).join('')||'<p class="note">No Legendary-or-better pulls yet. Be the first!</p>')}
/* invites: your code, and how far each friend you invited has got */
const copyText=t=>(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).catch(()=>{const a=document.createElement('textarea');a.value=t;a.setAttribute('readonly','');a.style.cssText='position:fixed;opacity:0';document.body.append(a);a.select();const ok=document.execCommand('copy');a.remove();if(!ok)throw new Error('copy')});
const inviteText=()=>`Play Demon Gacha with me! When you make your account, type my invite code ${S.invite} and you get 5 free packs.`;
function renderInvite(){const L=S.invites;
  setH($('#inviteBox'),`<h2>Invite friends</h2><p class="note" style="margin-top:0">Friends get <b>5 packs</b> when they use your code. You get <b>5 packs</b> for each friend once they've opened 10 packs.</p>
  <div class="inv"><b class="code">${esc(S.invite||'…')}</b><button class="btn lime" data-act="invCopy"${S.invite?'':' disabled'}>Copy invite</button></div>
  <p class="note" style="margin-top:4px">New players type it when they make their account, or in Redeem a code during their first 3 days.</p>`+
  (L.length?`<label>Friends you invited (${L.length})</label>`+L.map(f=>`<div class="q"><div style="flex:1"><b>${esc(f.u)}</b><div class="bar sm"><i style="width:${Math.min(10,f.opened)*10}%"></i></div><small>${f.paid?'Done':`${Math.min(10,f.opened)} / 10 packs opened`}</small></div>${f.paid?'<span class="done">+5 packs</span>':''}</div>`).join(''):'')+
  (S.invitedBy?`<p class="note">You were invited by <b>${esc(S.invitedBy)}</b>.</p>`:''))}
function renderLuck(){const b=$('#luckBox'),L=luckOf(S.pulls);if(!L||L.n<5){setH(b,'<h2>Your luck</h2><p class="note">Open a few packs and your luck shows up here.</p>');return}
  const verdict=L.pct>=200?'absurdly lucky':L.pct>=140?'very lucky':L.pct>=110?'lucky':L.pct>=90?'right on normal':L.pct>=70?'a bit unlucky':'unlucky so far';
  const rows=[['apex','APEX'],['ime','IME'],['m','Mythic'],['l','Legendary'],['hm','Honorable Mention'],['e','Epic'],['r','Rare'],['c','Common'],['holo','Holo']].map(([k,t])=>{const got=+S.pulls[k]||0,e=L.n*(k==='holo'?HOLO:ODDS[k]),d=e?Math.round((got/e-1)*100):0;
    return `<tr><td>${t}</td><td class="n">${got}</td><td class="n">${e<10?e.toFixed(1):Math.round(e)}</td><td class="n" style="color:${got>=e?'var(--lime)':'var(--mute)'}">${d>0?'+':''}${d}%</td></tr>`}).join('');
  const rare=L.tail<.5?`Only about <b>1 in ${bigNum(1/L.tail)}</b> players would pull ${L.big} Legendary-or-better cards in ${L.n} cards.`:`You've pulled ${L.big} Legendary-or-better card${L.big===1?'':'s'} in ${L.n}; about ${(L.n*L.pb).toFixed(1)} is normal.`;
  setH(b,`<h2>Your luck</h2><p style="font:44px/1 'Lilita One',sans-serif;margin:6px 0 10px">${Math.round(L.pct)}% <small style="font:16px Rubik,sans-serif;color:var(--mute)">of normal · ${verdict}</small></p><p>${rare}</p><table class="stack"><thead><tr><th>Rarity</th><th class="n">You got</th><th class="n">Normal</th><th class="n">Difference</th></tr></thead><tbody>${rows}</tbody></table><p class="note">Luck compares your Legendary, Mythic, APEX, IME and Honorable Mention pulls with the normal number for ${L.n} cards. It counts every card you've pulled from packs on this server.</p>`)}
function renderHome(){$('#hp').textContent=S.packs;$('#openBtn').disabled=S.packs<1||busy;$('#ndBtn').textContent=`Open No-Dupe pack (${S.nd})`;$('#ndBtn').disabled=S.nd<1||busy;
  setH($('#autoBox'),autoHTML()+(window.dgDesk?'<button class="btn ghost sm" data-act="openMini" title="A small always-on-top window for the corner of your screen">Mini window</button>':''));
  $('#ndInfo').textContent=S.nd?'Only cards you don\'t have yet.':'Only cards you don\'t have yet. Buy them for 300 shards in the Shard shop on Earn packs.';
  const full=S.packs>=CAP||!nextAt,left=Math.max(0,(nextAt||0)-Date.now());$('#hn').innerHTML=full?'<b>Timer full</b>, open some packs':`Next pack in <b>${Math.floor(left/60000)}:${String(Math.floor(left/1000)%60).padStart(2,'0')}</b>`;$('#hbar').style.width=(full?100:(1-left/600000)*100)+'%';
  const can=S.last!==S.day,next=can?(S.last===dayMinus1(S.day)?S.streak+1:1):S.streak,cy=Math.max(1,next)-1;
  $('#streakBox').innerHTML=`<h2>Login streak</h2><p>${can?`Day ${next} is ready. Miss a day and the streak starts over.`:`Day ${S.streak} claimed. Come back tomorrow for ${STREAK[S.streak%7]} more.`}</p><div class="days">${STREAK.map((r,i)=>`<span class="${i<cy%7||(!can&&i===cy%7)?'past':''}${can&&i===cy%7?' now':''}">Day ${i+1}<b>${r}</b></span>`).join('')}</div>${can?`<button class="btn lime" data-act="login">Claim ${STREAK[(next-1)%7]} pack${STREAK[(next-1)%7]>1?'s':''}</button>`:''}`;
  $('#qList').innerHTML=S.quests.map((q,i)=>{const d=QD[q.id];if(!d)return'';const ok=q.p>=d.goal;return `<div class="q"><div><b>${d.t}</b><div class="bar sm"><i style="width:${q.p/d.goal*100}%"></i></div><small>${Math.floor(q.p)} / ${d.goal} · ${d.rw} pack${d.rw>1?'s':''}</small></div>${q.c?'<span class="done">Claimed</span>':`<button class="btn lime" data-act="quest" data-i="${i}"${ok?'':' disabled'}>Claim</button>`}</div>`}).join('')+'<p class="note">New quests every midnight (Eastern time).</p>';
  const u=uniq();$('#stats').innerHTML=[[(u/LIST.length*100).toFixed(2)+'%',`Complete (${u} / ${LIST.length})`],[holos(),'Holo cards'],[S.opened,'Packs opened'],[S.shards,'Shards'],[Number(S.best.run).toFixed(1)+'s','Best Practice Run'],[S.best.hl,'Best Harder or Easier streak']].map(([b,s])=>`<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');renderRare();renderRecent();renderTop();renderFeed();renderInvite();renderLuck()}
let MS=[];
async function loadMS(){try{MS=await rpc('dg_my_milestones')||[]}catch(e){MS=[]}if(cur==='earn')renderMS()}
function renderMS(){$('#ms').innerHTML=MS.map(m=>`<div class="q"><div><b>${esc(m.t)}</b>${m.g?`<div class="bar sm"><i style="width:${Math.min(1,m.p/m.g)*100}%"></i></div><small>${Math.min(m.p,m.g)} / ${m.g} · ${m.rw} packs</small>`:`<br><small>${m.rw} packs</small>`}</div>${m.claimed?'<span class="done">Claimed</span>':`<button class="btn lime" data-act="ms" data-id="${esc(m.id)}"${m.ok?'':' disabled'}>Claim</button>`}</div>`).join('')}
function renderEarn(){$('#today').textContent=`Today: ${S.daily.run} / ${RUN_CAP} packs from Practice Run · ${S.daily.hl} / ${HL_CAP} from Harder or Easier · ${S.quests.filter(q=>q.c).length} / 3 quests claimed`;
  $('#runInfo').textContent=`Best run ${Number(S.best.run).toFixed(1)}s · ${S.att} attempts total`;renderHL();
  $('#shop').innerHTML=`<p>Duplicates from normal packs turn into shards: Commons give 5, Mythics 150, holos double. <b>No-Dupe packs</b> only give cards you don't have yet, and each new card also gives half those shards.</p><p style="font:40px/1 'Lilita One'">${S.shards} <small style="font:16px Rubik;color:var(--mute)">shards</small></p><div class="row"><button class="btn lime" data-act="buy"${S.shards<SHOP?' disabled':''}>Buy 1 pack · ${SHOP}</button><button class="btn lime nd" data-act="buyNd"${S.shards<300?' disabled':''}>Buy 1 No-Dupe pack · 300</button>${S.auto?'':`<button class="btn lime" data-act="buyAuto"${S.shards<1000?' disabled':''}>Unlock auto-open · 1,000</button>`}<a class="btn ghost" href="#collection" style="text-decoration:none;display:inline-flex;align-items:center">Craft a card</a></div>`;
  renderMS()}
const COL={q:'',r:'all',s:'all',l:'all',lim:120};
function renderCol(){const u=uniq(),N=LIST.length;$('#colHead').textContent=`${u} of ${N} demons · ${HMS.filter(c=>S.cards[c.n]).length} of ${HMS.length} special cards · ${holos()} holo · ${S.shards} shards to craft with`;$('#colBar').style.width=u/N*100+'%';
  const q=COL.q.toLowerCase(),f=HMS.concat(LIST).filter(c=>{const o=S.cards[c.n]||0;return(COL.r==='all'||c.r==+COL.r)&&(COL.l==='all'||(c.hm?COL.l==='sbe':SEC(c.p)[0]===COL.l))&&(!q||c.n.toLowerCase().includes(q))&&(COL.s==='all'||(COL.s==='own'&&o)||(COL.s==='miss'&&!o)||(COL.s==='holo'&&o===2))});
  $('#grid').innerHTML=f.slice(0,COL.lim).map(c=>{const o=S.cards[c.n]||0,cost=RAR[c.r].cr;return `<div class="cell">${card(c,o===2,!o)}${o?(S.when[c.n]?`<small class="note" style="margin:0">Got ${ft(S.when[c.n])}</small>`:'')+`<button class="mini" data-act="sell" data-n="${esc(c.n)}">Sell</button>`:`<button class="mini" data-act="craft" data-n="${esc(c.n)}"${S.shards<cost?' disabled':''}>Craft · ${cost} shards</button>`}</div>`}).join('')||'<p class="note">No demons match.</p>';
  $('#moreBtn').hidden=f.length<=COL.lim;
  $('#hist').innerHTML=S.log.length?S.log.slice(0,30).map(e=>`<div class="q"><div><b>${ft(e.t)} · ${({craft:'Crafted',admin:'Admin',market:'Market',sold:'Sold',nodupe:'No-Dupe pack',trade:'Trade',gift:'Gift'})[e.src]||'Pack'}</b><br><small>${(e.c||[]).map(([n,h,tag])=>esc(n)+(h?' (holo)':'')+' · '+esc(tag)).join('<br>')}</small></div></div>`).join(''):'<p class="note">Packs you open show up here with the time.</p>'}

/* leaderboard */
let LB=null;
async function loadLB(){const {data,error}=await SB.from('profiles').select('id,username,unique_count,holo_count,opened,is_owner,pulls').order('unique_count',{ascending:false}).limit(50);if(error){$('#lbNote').textContent='The leaderboard is unavailable right now.';return}LB=data;renderLB()}
function renderLB(){const tb=$('#lb');if(!LB){tb.innerHTML='';$('#lbNote').textContent='Loading the leaderboard…';return}
  tb.innerHTML=LB.map((r,i)=>`<tr class="${r.id===ME.id?'me':''}"><td class="n">${i+1}</td><td>${esc(r.username)}${r.id===ME.id?' (you)':''}${r.is_owner?OTAG:''}</td><td class="n">${Number(r.unique_count)||0}</td><td class="n">${Number(r.holo_count)||0}</td><td class="n">${Number(r.opened)||0}</td><td class="n">${(L=>L&&L.n>=25?Math.round(L.pct)+'%':'–')(luckOf(r.pulls))}</td></tr>`).join('')||'<tr><td colspan="6">Nobody yet. Open a pack!</td></tr>';$('#lbNote').textContent='Ranked by different demons collected.'}

function render(){if(!S)return;renderMini();$('#tBadge').hidden=!S.tin;$('#tBadge').textContent=S.tin;$('#cp').textContent=S.packs;$('#cs').textContent=S.shards;renderAcct();$('#adminLink').hidden=!S.admin;
  ({home:renderHome,earn:renderEarn,collection:renderCol,market:renderMarket,leaderboard:renderLB,admin:renderAdmin,trades:renderTrades})[cur]()}
function renderAcct(){const b=$('#acct');b.hidden=false;b.textContent=S.name;if(S.owner)b.insertAdjacentHTML('beforeend',OTAG);b.className='mini me'}

/* ---------- packs ---------- */
let lastPulls=[],lastNd=false;
async function openPack(nd){nd=!!nd;if(busy||(nd?S.nd:S.packs)<1)return;lastNd=nd;busy=true;$('#openBtn').disabled=true;$('#ndBtn').disabled=true;$('#againBtn').disabled=true;
  let res;try{res=await rpc('dg_open_pack',{p_nodupe:nd})}catch(e){busy=false;toast(errText(e));render();return}
  const pulls=res.map(p=>({c:BY[p.n]||{n:p.n,p:0,r:0},h:!!p.h,tag:p.tag,nw:!!p.nw,full:!!p.full}));lastPulls=pulls;
  $('#rgrid').innerHTML=pulls.map(p=>`<div class="fc" data-act="flip" style="--rc:${RAR[p.c.r].c}" role="button" tabindex="0" aria-label="Flip card"><div class="fc-in"><div class="back${p.c.r>=2?' glow':''}"><img src="face.png" alt=""></div><div class="front">${card(p.c,p.h)}</div></div><span class="tag${p.nw?' new':''}">${esc(p.tag)}</span></div>`).join('');
  $$('#rgrid .tag').forEach(t=>t.style.visibility='hidden');
  refresh().catch(()=>{}).finally(()=>{busy=false;$('#againBtn').disabled=(lastNd?S.nd:S.packs)<1;if(pulls.some(p=>p.c.r>=3))loadFeed()});
  const best=pulls.slice().sort((a,b)=>(a.full-b.full)||(RK(b.c)-RK(a.c))||(b.h-a.h)||((a.c.p||0)-(b.c.p||0)))[0];
  const reveal=()=>{$('#rev').hidden=false;const i=pulls.indexOf(best),el=$$('#rgrid .fc')[i];if(el)flip(el)};
  if(spinOn()){$('#rev').hidden=true;runSpin(best,()=>showBanner(best,reveal))}else if(best.c.r>=3){$('#rev').hidden=true;showBanner(best,reveal)}else $('#rev').hidden=false}
/* big-pull banner for Legendary, Mythic and Honorable Mention */
const PB={3:['Legendary pull','#ffc23d'],4:['Mythic pull','#ff3355'],5:['Honorable Mention','#3df2ff'],6:['APEX pull','#ff4fd8'],7:['IME pull','#ffd76a']};let pbDone=null;
function showBanner(p,done){const c=p.c,v=PB[c.r];if(!v||p.full){done();return}const b=$('#banner');b.style.setProperty('--pc',v[1]);b.classList.toggle('apx',c.r===6);b.classList.toggle('imb',c.r===7);$('#pbTitle').textContent=(p.h?'Holo ':'')+v[0];$('#pbCard').innerHTML=card(c,p.h);
  $('#pbSub').textContent=(c.r===7?'Unrated extreme · Top 5':c.hm?(c.rate||'Unranked')+' · SBE':`#${c.p} · ${SEC(c.p)[1]} list`)+' · '+p.tag;
  const cols=c.r===6?['#ff3355','#ffc23d','#8cff3a','#3df2ff','#b45cff','#ffffff']:c.r===7?['#ffd76a','#fff3c4','#ffffff','#e0a100']:[v[1],'#ffffff',v[1],'#8cff3a'];$('#confetti').innerHTML=RM.matches?'':Array.from({length:48},()=>`<i style="left:${(Math.random()*100).toFixed(1)}%;--c:${cols[Math.random()*cols.length|0]};animation-duration:${(2.2+Math.random()*2.6).toFixed(2)}s;animation-delay:${(Math.random()*.7).toFixed(2)}s"></i>`).join('');
  pbDone=done;b.hidden=false}
function closeBanner(){if($('#banner').hidden)return false;$('#banner').hidden=true;$('#confetti').innerHTML='';const d=pbDone;pbDone=null;if(d)d();return true}
$('#banner').addEventListener('click',closeBanner);
function flip(el){if(el.classList.contains('on'))return;el.classList.add('on');el.querySelector('.tag').style.visibility='visible'}

/* ---------- Harder or Easier (graded on the server) ---------- */
const HL={a:null,b:null,st:0,lock:true,res:null};
async function hlNew(){try{const r=await rpc('dg_hl_next');HL.a=BY[r.a];HL.b=BY[r.b];HL.st=r.st||0;HL.lock=false;HL.res=null}catch(e){HL.lock=true}if(cur==='earn')renderHL()}
function renderHL(){if(!HL.a){$('#hl').innerHTML='<p class="note">Loading a question…</p>';return}const r=HL.res,btn=(c,w)=>`<button data-act="hl" data-w="${w}" class="${r?(r.w===w?(r.ok?'ok':'bad'):''):''}"${HL.lock?' disabled':''}>${esc(c.n)}${r?`<small>#${w?r.pb:r.pa} on the list</small>`:''}</button>`;
  $('#hl').innerHTML=`<div class="hl">${btn(HL.a,0)}<span class="vs">or</span>${btn(HL.b,1)}</div><p class="note">Streak <b style="color:var(--ink)">${HL.st}</b> · best ${S.best.hl} · ${S.daily.hl} / ${HL_CAP} packs today</p>`}
async function hlPick(w){if(HL.lock)return;HL.lock=true;renderHL();try{const r=await rpc('dg_hl_pick',{p_side:w});HL.res={w,ok:r.ok,pa:r.pa,pb:r.pb};HL.st=r.st;if(r.got)toast(`+1 pack · ${r.st} in a row`);await refresh()}catch(e){toast(errText(e))}renderHL();setTimeout(hlNew,1100)}

/* ---------- Practice Run (the server times each run) ---------- */
const cv=$('#run'),cx=cv.getContext('2d'),GH=240,GR=196,PX=90,SZ=30;
const G={on:false,t:0,y:GR-SZ,vy:0,ang:0,obs:[],gap:0,hold:false,raf:0,last:0,dead:0,msg:(window.matchMedia&&matchMedia('(hover: none)').matches)?'Tap to start':'Click or press Space to start',bg:0,startP:null};
function size(){const r=cv.getBoundingClientRect(),d=devicePixelRatio||1;if(!r.width)return;cv.width=Math.round(r.width*d);cv.height=Math.round(r.height*d);drawG()}
const roRun=new ResizeObserver(size);roRun.observe(cv);
const GW=()=>cv.width/(cv.height/GH);
function start(){if(performance.now()-G.dead<450)return;G.startP=rpc('dg_run_start').catch(()=>{});Object.assign(G,{on:true,t:0,y:GR-SZ,vy:0,ang:0,obs:[],gap:0});G.last=performance.now();cancelAnimationFrame(G.raf);G.raf=requestAnimationFrame(loop)}
function loop(now){const dt=Math.min(.033,(now-G.last)/1000);G.last=now;step(dt);drawG();if(G.on)G.raf=requestAnimationFrame(loop)}
function step(dt){G.t+=dt;const v=Math.min(560,330+G.t*6),w=GW();G.bg=(G.bg+v*dt*.3)%60;
  if(G.y>=GR-SZ-.5&&G.hold)G.vy=-820;G.vy+=2600*dt;G.y+=G.vy*dt;
  if(G.y>=GR-SZ){G.y=GR-SZ;G.vy=0;G.ang=Math.round(G.ang/(Math.PI/2))*Math.PI/2}else G.ang+=5*dt;
  for(const o of G.obs)o.x-=v*dt;G.obs=G.obs.filter(o=>o.x+o.n*30>-40);
  const lastO=G.obs[G.obs.length-1];if(G.t>1.2&&(!lastO||lastO.x<w-G.gap)){const n=G.t<8?1+(Math.random()<.35):1+(Math.random()*3|0);G.obs.push({x:w+10,n});G.gap=v*(.85+Math.random()*.9)+n*30}
  const pl=PX+5,pr=PX+SZ-5,pb=G.y+SZ-3;for(const o of G.obs)for(let i=0;i<o.n;i++){const sx=o.x+i*30;if(pr>sx+9&&pl<sx+21&&pb>GR-20)return die()}}
async function die(){G.on=false;G.hold=false;G.dead=performance.now();const t=G.t;G.msg=`${t.toFixed(1)}s · checking…`;drawG();
  try{await G.startP;const r=await rpc('dg_run_end',{p_secs:t});const tier=r.tier||0,got=r.got||0;
    G.msg=`${Number(r.t).toFixed(1)}s`+(got?` · +${got} pack${got>1?'s':''}`:tier?' · daily run packs maxed':'');if(got)toast(`+${got} pack${got>1?'s':''} · Practice Run`);await refresh()}
  catch(e){G.msg=`${t.toFixed(1)}s`;toast(errText(e))}drawG()}
function fitFont(face,size,txt,max){cx.font=`${size}px ${face}`;const m=cx.measureText(txt).width;if(m>max)cx.font=`${Math.max(10,size*max/m)}px ${face}`}
function drawG(){const k=cv.height/GH,w=GW();if(!k)return;cx.setTransform(k,0,0,k,0,0);const g=cx.createLinearGradient(0,0,0,GH);g.addColorStop(0,'#4a0a2a');g.addColorStop(1,'#14061a');cx.fillStyle=g;cx.fillRect(0,0,w,GH);
  cx.strokeStyle='#ffffff10';cx.lineWidth=1;for(let x=-G.bg;x<w;x+=60)for(let y=10;y<GR;y+=60)cx.strokeRect(x,y,50,50);
  cx.fillStyle='#1a0710';cx.fillRect(0,GR,w,GH-GR);cx.fillStyle='#ff3b3b';cx.fillRect(0,GR,w,3);
  for(const o of G.obs)for(let i=0;i<o.n;i++){const sx=o.x+i*30;cx.beginPath();cx.moveTo(sx,GR);cx.lineTo(sx+15,GR-30);cx.lineTo(sx+30,GR);cx.closePath();cx.fillStyle='#000';cx.fill();cx.strokeStyle='#fff';cx.lineWidth=2;cx.stroke()}
  cx.save();cx.translate(PX+SZ/2,G.y+SZ/2);cx.rotate(G.ang);cx.fillStyle='#8cff3a';cx.fillRect(-15,-15,30,30);cx.strokeStyle='#000';cx.lineWidth=3;cx.strokeRect(-15,-15,30,30);cx.fillStyle='#3df2ff';cx.fillRect(-7,-7,14,14);cx.strokeRect(-7,-7,14,14);cx.restore();
  const fs=Math.max(1,Math.min(1.6,1.25*GH/(cv.clientHeight||GH)));cx.textAlign='left';cx.fillStyle='#fff';cx.font=`${22*fs}px "Lilita One",sans-serif`;
  if(G.on){const nx=G.t<15?15:G.t<30?30:G.t<60?60:0;cx.fillText(G.t.toFixed(1)+'s',14,10+22*fs);if(nx){cx.font=`${14*fs}px Rubik,sans-serif`;cx.fillStyle='#ffc9c9';cx.fillText(`next pack at ${nx}s`,14,18+36*fs)}}
  else{cx.fillStyle='#0009';cx.fillRect(0,0,w,GR);cx.textAlign='center';cx.fillStyle='#fff';fitFont(`"Lilita One",sans-serif`,24*fs,G.msg,w-28);cx.fillText(G.msg,w/2,GR/2-6*fs);cx.font=`${15*fs}px Rubik,sans-serif`;cx.fillStyle='#ffc9c9';const sub=S&&S.att?((window.matchMedia&&matchMedia('(hover: none)').matches)?'Tap to go again':'Tap or press Space to go again'):'Hold to keep jumping';fitFont('Rubik,sans-serif',15*fs,sub,w-28);cx.fillText(sub,w/2,GR/2+22*fs)}}
cv.addEventListener('pointerdown',e=>{e.preventDefault();if(!G.on)start();G.hold=true});
['pointerup','pointerleave','pointercancel'].forEach(t=>cv.addEventListener(t,()=>{G.hold=false}));
document.addEventListener('keydown',e=>{if(!$('#banner').hidden&&(e.key==='Escape'||e.key==='Enter'||e.key===' ')){e.preventDefault();closeBanner();return}if(e.key==='Escape'&&!$('#insp').hidden){closeInsp();return}if(e.key==='Escape'&&!$('#spin').hidden){skipSpin();return}if(e.key==='Escape'&&!$('#sell').hidden){$('#sell').hidden=true;return}if(e.key==='Escape'&&!$('#acc').hidden&&!S.needs){$('#acc').hidden=true;return}if(e.key==='Escape'&&!$('#rev').hidden){$('#rev').hidden=true;return}
  if(cur!=='earn'||!(e.code==='Space'||e.code==='ArrowUp')||e.target.closest('input,textarea,select,button,summary,a'))return;e.preventDefault();if(!G.on&&!e.repeat)start();G.hold=true});
document.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='ArrowUp')G.hold=false});
/* phone Back button (the Android app calls this): close the top pop-up, then go back to Home */
window.dgBack=()=>{if(closeBanner())return true;if(!$('#spin').hidden){skipSpin();return true}if(!$('#insp').hidden){closeInsp();return true}
  for(const id of ['sell','acc','rev'])if(!$('#'+id).hidden){if(id==='acc'&&S&&S.needs)return true;$('#'+id).hidden=true;return true}
  if(S&&cur!=='home'){location.hash='home';return true}return false};

/* case spin: a reel of random cards that lands on the pack's best pull */
const SPIN_KEY='dg-spin',RM=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
const spinOn=()=>{if(RM.matches)return false;try{return localStorage.getItem(SPIN_KEY)!=='0'}catch(e){return true}};
$('#spinToggle').checked=spinOn();$('#spinToggle').addEventListener('change',e=>{try{localStorage.setItem(SPIN_KEY,e.target.checked?'1':'0')}catch(err){}});
const SND_KEY='dg-snd',HIT=7.45;let SND=null;
const sndOn=()=>{try{return localStorage.getItem(SND_KEY)!=='0'}catch(e){return true}};
$('#sndToggle').checked=sndOn();$('#sndToggle').addEventListener('change',e=>{try{localStorage.setItem(SND_KEY,e.target.checked?'1':'0')}catch(err){}if(!e.target.checked&&SND)SND.pause()});
/* iPhone/iPad: Safari only lets sound start inside a tap, but the case sound plays after the server answers.
   Playing it silently once on the first tap unlocks it for later. */
const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
document.addEventListener('touchend',()=>{try{if(!SND){SND=new Audio('case.mp3');SND.volume=.6}SND.muted=true;const p=SND.play();(p&&p.then?p:Promise.resolve()).then(()=>{SND.pause();SND.currentTime=0;SND.muted=false},()=>{SND.muted=false})}catch(e){}},{once:true,passive:true});
/* iOS Safari doesn't reliably send dblclick for a double-tap, so turn two quick taps on the same card into one */
if(IOS){let lt=0,le=null;document.addEventListener('touchend',e=>{const el=e.target.closest('.card,.fc');if(!el||e.target.closest('#insp,.strip')){le=null;return}const now=Date.now();
  if(el===le&&now-lt<350){le=null;e.preventDefault();el.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}))}else{le=el;lt=now}},{passive:false})}
function playCase(){if(!sndOn())return false;try{if(!SND){SND=new Audio('case.mp3');SND.volume=.6}SND.currentTime=0;const p=SND.play();if(p&&p.catch)p.catch(()=>{});return true}catch(e){return false}}
let SP=null;
function runSpin(best,done){const N=60,WIN=50,W=146,filler=()=>{const r=rollR();return{c:TIER[r][Math.random()*TIER[r].length|0],h:Math.random()<HOLO}};
  const items=Array.from({length:N},(_,i)=>i===WIN?best:filler());$('#strip').innerHTML=items.map(p=>card(p.c,p.h)).join('');
  $('#spinTitle').textContent='Opening pack…';$('#spin').hidden=false;const st=$('#strip');st.style.transition='none';st.style.transform='translateX(0)';
  const reelW=$('.reel').clientWidth,target=-(10+WIN*W+68-reelW/2+(Math.random()*90-45));
  const snd=playCase(),dur=snd?HIT-.1:5.2;SP={done,st,target,best,t:0,snd};requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!SP)return;st.style.transition=`transform ${dur}s cubic-bezier(.06,.62,.1,1)`;st.style.transform=`translateX(${target}px)`;SP.t=setTimeout(landSpin,dur*1000+100)}))}
function landSpin(){if(!SP)return;const s=SP;SP=null;s.st.style.transition='transform .35s ease-out';s.st.style.transform=`translateX(${s.target}px)`;
  const w=$$('#strip .card')[50];if(w)w.classList.add('win');$('#spinTitle').textContent=(s.best.h?'Holo ':'')+(s.best.c.r===5?'Honorable Mention':RAR[s.best.c.r].k)+'!';
  setTimeout(()=>{$('#spin').hidden=true;s.done()},1100)}
function skipSpin(){if(!SP)return;clearTimeout(SP.t);if(SP.snd&&SND&&SND.currentTime<HIT-.2){try{SND.currentTime=HIT-.15}catch(e){}}landSpin()}

/* 3D tilt toward the mouse */
let tiltEl=null;
document.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||RM.matches)return;const c=e.target.closest('.card');if(tiltEl&&tiltEl!==c){tiltEl.style.transform='';tiltEl.classList.remove('tilt')}tiltEl=null;
  if(!c||c.closest('.strip,.ifront'))return;tiltEl=c;const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
  c.classList.add('tilt');c.style.setProperty('--gx',(x+.5)*100+'%');c.style.setProperty('--gy',(y+.5)*100+'%');c.style.transform=`perspective(700px) rotateY(${x*26}deg) rotateX(${-y*26}deg) scale(1.05)`});
document.addEventListener('pointerleave',()=>{if(tiltEl){tiltEl.style.transform='';tiltEl.classList.remove('tilt');tiltEl=null}});

/* inspector: double-click a card, drag to rotate */
const IR={rx:-6,ry:-18,vx:0,vy:0,drag:false,lx:0,ly:0,raf:0};
function applyI(){const ic=$('#icard');ic.style.transform=`rotateX(${IR.rx}deg) rotateY(${IR.ry}deg)`;const g=$('#ifront .glare');if(g)g.style.background=`linear-gradient(${110+IR.ry*1.2}deg,transparent 25%,#ffffff70 ${48+IR.rx/3}%,transparent 72%)`}
function inspect(n,h,miss){const c=BY[n];if(!c)return;const R=RAR[c.r],o=S.cards[n]||0,sc=c.r===7?['','Top 5 (unrated extreme)']:c.hm?['','SBE (Should Be Extreme)']:SEC(c.p);
  $('#icard').style.setProperty('--rc',R.c);$('#ifront').innerHTML=card(c,h,miss)+'<div class="glare"></div>';
  $('#iback').style.setProperty('--rc',R.c);$('#iback').innerHTML=`<img src="face.png" alt=""><h3>${esc(n)}</h3><dl><dt>Position</dt><dd>${c.r===7?'Unrated extreme (not on AREDL yet)':c.hm?c.rate+' (in-game rating)':'#'+c.p+' on AREDL'}</dd><dt>Rarity</dt><dd style="color:${R.c}">${h?'Holo ':''}${R.k==='HM'?'Honorable Mention':R.k}</dd><dt>Section</dt><dd>${sc[1]}</dd><dt>${o?'Got':'Status'}</dt><dd>${o?(S.when[n]?ft(S.when[n]):'Before timestamps'):'Not in your collection'}</dd><dt>Crafting</dt><dd>${R.cr} shards</dd></dl>`;
  Object.assign(IR,{rx:-6,ry:-18,vx:0,vy:0});$('#icard').classList.remove('anim');applyI();$('#insp').hidden=false;
  cancelAnimationFrame(IR.raf);let t0=performance.now();const intro=now=>{const k=Math.min(1,(now-t0)/700);IR.ry=-18+18*(1-Math.pow(1-k,3));applyI();if(k<1&&!IR.drag)IR.raf=requestAnimationFrame(intro)};IR.raf=requestAnimationFrame(intro)}
function closeInsp(){$('#insp').hidden=true;cancelAnimationFrame(IR.raf)}
function turnI(dy){const ic=$('#icard');ic.classList.add('anim');IR.ry+=dy;applyI();setTimeout(()=>ic.classList.remove('anim'),620)}
const stage=$('#stage');
stage.addEventListener('pointerdown',e=>{IR.drag=true;IR.lx=e.clientX;IR.ly=e.clientY;IR.vx=IR.vy=0;cancelAnimationFrame(IR.raf);$('#icard').classList.remove('anim');try{stage.setPointerCapture(e.pointerId)}catch(err){}});
stage.addEventListener('pointermove',e=>{if(!IR.drag)return;const dx=e.clientX-IR.lx,dy=e.clientY-IR.ly;IR.lx=e.clientX;IR.ly=e.clientY;IR.vy=dx*.55;IR.vx=-dy*.55;IR.ry+=IR.vy;IR.rx=Math.max(-75,Math.min(75,IR.rx+IR.vx));applyI()});
const endDrag=()=>{if(!IR.drag)return;IR.drag=false;const coast=()=>{IR.vy*=.94;IR.vx*=.9;IR.ry+=IR.vy;IR.rx=Math.max(-75,Math.min(75,IR.rx+IR.vx));applyI();if(Math.abs(IR.vy)>.05||Math.abs(IR.vx)>.05)IR.raf=requestAnimationFrame(coast)};IR.raf=requestAnimationFrame(coast)};
stage.addEventListener('pointerup',endDrag);stage.addEventListener('pointercancel',endDrag);
stage.addEventListener('dblclick',e=>{e.stopPropagation();turnI(180)});
$('#insp').addEventListener('click',e=>{if(e.target.id==='insp')closeInsp()});
document.addEventListener('dblclick',e=>{if(e.target.closest('#insp,.strip'))return;const fc=e.target.closest('.fc'),el=fc?fc.querySelector('.front .card'):e.target.closest('.card');if(!el)return;if(fc)flip(fc);inspect(el.dataset.n,el.dataset.h==='1',el.classList.contains('miss'))});
const FX={skip(){skipSpin()},iflip(){turnI(180)},ireset(){const ic=$('#icard');ic.classList.add('anim');IR.rx=-6;IR.ry=Math.round(IR.ry/360)*360;applyI();setTimeout(()=>ic.classList.remove('anim'),620)},iclose(){closeInsp()}};



/* ---------- market ---------- */
let MK=[],SELLN=null,mkTimer=0;
const MK_Q={q:'',r:'all',o:'new'};
async function loadMarket(){const {data,error}=await SB.from('market').select('id,seller,seller_name,card,holo,price,created_at').eq('status','open').order('created_at',{ascending:false}).limit(500);if(error){$('#mkNote').textContent='The market is unavailable right now.';return}MK=data.map(L=>({id:L.id,seller:L.seller,sellerName:L.seller_name,card:L.card,holo:L.holo,price:L.price,t:Date.parse(L.created_at)}));if(cur==='market')renderMarket()}
const okListing=L=>L&&BY[L.card]&&Number(L.price)>=1;
function mkCard(L,mine){const c=BY[L.card],price=Math.floor(Number(L.price)),o=S.cards[L.card]||0,have=L.holo?o===2:o>=1;
  const btn=mine?`<button class="mini" data-act="mkCancel" data-id="${esc(L.id)}">Cancel listing</button>`
    :`<button class="mini" data-act="mkBuy" data-id="${esc(L.id)}"${have||S.shards<price||busy?' disabled':''}>${have?'You have it':S.shards<price?'Not enough shards':'Buy'}</button>`;
  return `<div class="cell">${card(c,!!L.holo)}<div class="price"><b>${price} shards</b>${mine?'':`<small>${esc(String(L.sellerName||'Someone'))}${L.seller===OWNER_ID?OTAG:''}</small>`}</div>${btn}</div>`}
function renderMarket(){$('#mkNote').textContent=`You have ${S.shards} shards.`;const all=MK.filter(okListing),mine=all.filter(L=>L.seller===ME.id);
  $('#mkMineCount').textContent=`${mine.length} / ${MAXL}`;$('#mkMine').innerHTML=mine.map(L=>mkCard(L,true)).join('')||'<p class="note">Nothing listed. Press Sell on a card in your Collection.</p>';
  const q=MK_Q.q.toLowerCase();let f=all.filter(L=>L.seller!==ME.id&&(MK_Q.r==='all'||BY[L.card].r==+MK_Q.r)&&(!q||L.card.toLowerCase().includes(q)||String(L.sellerName||'').toLowerCase().includes(q)));
  f.sort(MK_Q.o==='cheap'?(a,b)=>a.price-b.price:MK_Q.o==='rare'?(a,b)=>(RK(BY[b.card])-RK(BY[a.card]))||(BY[a.card].p-BY[b.card].p):(a,b)=>b.t-a.t);
  $('#mkCount').textContent=`${f.length} listing${f.length===1?'':'s'}`;$('#mkAll').innerHTML=f.slice(0,200).map(L=>mkCard(L,false)).join('')||'<p class="note">Nothing for sale right now.</p>'}
function sellOpen(n){const c=BY[n],o=S.cards[n]||0;if(!c||!o)return;const h=o===2;SELLN=n;$('#sName').textContent=n+(h?' (holo)':'');$('#sCard').innerHTML=card(c,h);
  $('#sPrice').value=h?RAR[c.r].cr:Math.round(RAR[c.r].cr/2);$('#sHint').textContent=`Crafting this card costs ${RAR[c.r].cr} shards, which is a fair guide for pricing.`;
  $('#sQuick').textContent=`Sell to the game · ${RAR[c.r].sh*(h?2:1)} shards`;$('#sMsg').textContent='';$('#sell').hidden=false;$('#sPrice').focus()}
$('#sForm').addEventListener('submit',async e=>{e.preventDefault();const n=SELLN,price=Math.floor(Number($('#sPrice').value)),m=$('#sMsg');
  if(!(price>=1&&price<=100000)){m.textContent='Pick a price from 1 to 100,000 shards.';return}m.textContent='Listing…';
  try{await rpc('dg_list',{p_name:n,p_price:price});$('#sell').hidden=true;toast(`${n} listed for ${price} shards`);await refresh();loadMarket()}catch(err){m.textContent=errText(err)}});
$('#mq').addEventListener('input',e=>{MK_Q.q=e.target.value;renderMarket()});$('#mr').addEventListener('change',e=>{MK_Q.r=e.target.value;renderMarket()});$('#mo').addEventListener('change',e=>{MK_Q.o=e.target.value;renderMarket()});

/* ---------- account ---------- */
const norm=x=>x.replace(/[01345789@]/g,ch=>({'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b','9':'g','@':'a'}[ch]));
function nameErr(v){if(!/^[A-Za-z0-9_\- ]{3,16}$/.test(v))return 'Use 3 to 16 letters, numbers, spaces, _ or -.';return ''}
function openAcct(note){$('#un').value=S.name;$('#accMsg').textContent='';$('#pwMsg').textContent='';$('#pwOld').value='';$('#pwNew').value='';$('#accNote').textContent=note||'Your cards and packs are saved on the server, so you can log in from any computer.';$('#acc').hidden=false}
$('#accForm').addEventListener('submit',async e=>{e.preventDefault();const v=$('#un').value.trim().replace(/\s+/g,' '),m=$('#accMsg');const er=nameErr(v);if(er){m.textContent=er;return}
  if(v===S.name&&!S.needs){$('#acc').hidden=true;return}m.textContent='Saving…';try{await rpc('dg_set_name',{p_username:v});await refresh();m.textContent='';$('#acc').hidden=true;toast(`Username is now ${v}`)}catch(err){m.textContent=errText(err)}});
$('#pwForm').addEventListener('submit',async e=>{e.preventDefault();const m=$('#pwMsg');try{await rpc('dg_change_password',{p_old:$('#pwOld').value,p_new:$('#pwNew').value});m.textContent='Password changed.';$('#pwOld').value='';$('#pwNew').value=''}catch(err){m.textContent=errText(err)}});

/* ---------- admin (the server refuses all of this for non-admins) ---------- */
let PL=[],SEL=null,armed=null;
function arm(b,key,fn){if(armed===key){armed=null;fn()}else{armed=key;const t=b.textContent;b.textContent='Click again to confirm';setTimeout(()=>{if(armed===key){armed=null;b.textContent=t}},4000)}}
async function loadPlayers(){const {data}=await SB.from('profiles').select('id,username,unique_count,opened,packs,shards,is_owner,is_admin,invited_by,nd_packs').order('username_lower').limit(1000);PL=data||[];renderPlayers();renderAdmins()}
/* owner only: who is an admin */
function renderAdmins(){$('#ownerBox').hidden=!S.owner;if(!S.owner)return;const L=PL.filter(p=>p.is_admin&&!p.is_owner);
  $('#admList').innerHTML=L.map(p=>`<div class="q"><div><b>${esc(p.username)}</b><span class="atag">Admin</span></div><button class="mini" data-act="aRmAdmin" data-u="${esc(p.username)}">Remove admin</button></div>`).join('')||'<p class="note">No admins yet. Only you have the Admin tab.</p>'}
function renderPlayers(){const q=$('#pq').value.trim().toLowerCase();$('#plist').innerHTML=PL.filter(p=>!q||p.username.toLowerCase().includes(q)).map(p=>`<button type="button" data-act="aPick" data-id="${esc(p.id)}" class="${SEL&&SEL.id===p.id?'on':''}"><span>${esc(p.username)}${p.is_owner?OTAG:p.is_admin?'<span class="atag">Admin</span>':''}</span><small>${p.unique_count} demons · ${p.packs} packs · ${p.shards} shards</small></button>`).join('')||'<p class="note" style="padding:10px">No players found.</p>';
  $('#aWho').textContent=SEL?SEL.username:'a player';$('#aInfo').textContent=SEL?`${SEL.unique_count} demons, ${SEL.opened} packs opened, ${SEL.packs} packs, ${SEL.nd_packs||0} No-Dupe packs and ${SEL.shards} shards right now.`+(()=>{const by=SEL.invited_by&&PL.find(p=>p.id===SEL.invited_by),n=PL.filter(p=>p.invited_by===SEL.id).length;return (by?` Invited by ${by.username}.`:'')+(n?` Invited ${n} player${n>1?'s':''}.`:'')})():'Pick a player on the left.'}
async function loadFilter(){try{const f=await rpc('dg_admin_get_filter');$('#fAny').value=(f.any||[]).join('\n');$('#fWord').value=(f.word||[]).join('\n')}catch(e){}}
async function checkNames(){try{const bad=await rpc('dg_admin_bad_names');$('#fBad').innerHTML=(bad||[]).map(r=>`<div class="q"><div><b>${esc(r.username)}</b></div><button class="mini" data-act="aClrId" data-id="${esc(r.id)}">Clear name</button></div>`).join('')||'<p class="note">None. Every current username passes.</p>'}catch(e){$('#fBad').innerHTML='<p class="note">Could not check names right now.</p>'}}
let adminLoaded=false;
function renderAdmin(){if(!adminLoaded){adminLoaded=true;loadPlayers();loadFilter();checkNames();loadCodes()}renderPlayers()}
async function loadCodes(){let L;try{L=await rpc('dg_admin_codes')||[]}catch(e){$('#cList').innerHTML='<p class="note">Could not load codes right now.</p>';return}
  $('#cList').innerHTML=L.map(c=>{const gift=[c.packs?`${c.packs} pack${c.packs>1?'s':''}`:'',c.shards?`${c.shards} shards`:''].filter(Boolean).join(' + '),old=c.exp&&c.exp<Date.now(),full=c.max!=null&&c.uses>=c.max;
    return `<div class="q"><div><b class="code">${esc(c.code)}</b>${old?' <span class="hb off">Expired</span>':full?' <span class="hb off">Used up</span>':''}<br><small>${gift} · used ${c.uses}${c.max!=null?' / '+c.max:''} time${(c.max!=null?c.max:c.uses)===1?'':'s'} · ${c.exp?(old?'expired ':'expires ')+ft(c.exp):'never expires'}</small></div><div class="row" style="flex-wrap:nowrap"><button class="mini" data-act="aCopy" data-c="${esc(c.code)}">Copy</button><button class="mini" data-act="aDelCode" data-c="${esc(c.code)}">Delete</button></div></div>`}).join('')||'<p class="note">No codes yet.</p>'}
$('#pq').addEventListener('input',renderPlayers);
$('#admName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ADMIN.aMkAdmin()}});
const words=t=>[...new Set(t.split(/[\n,]+/).map(x=>x.trim().toLowerCase()).filter(Boolean))];
const amt=()=>Math.max(1,Math.min(9999,parseInt($('#aN').value,10)||1)),amsg=t=>{$('#aMsg').textContent=t};
async function adm(fn,args,okText){if(!SEL&&fn!=='dg_admin_set_filter'){amsg('Pick a player first.');return}try{await rpc(fn,args);amsg(okText);await loadPlayers();SEL=PL.find(p=>p.id===(SEL&&SEL.id))||SEL;renderPlayers();if(SEL&&SEL.id===ME.id)await refresh()}catch(e){amsg(errText(e))}}
const ADMIN={
  aPick(b){SEL=PL.find(p=>p.id===b.dataset.id);amsg('');renderPlayers()},
  aPacks(){adm('dg_admin_give',{p_user:SEL&&SEL.id,p_packs:amt(),p_shards:0},`Gave ${amt()} packs.`)},
  aNd(){adm('dg_admin_give_nd',{p_user:SEL&&SEL.id,p_n:amt()},`Gave ${amt()} No-Dupe packs.`)},
  aShards(){adm('dg_admin_give',{p_user:SEL&&SEL.id,p_packs:0,p_shards:amt()},`Gave ${amt()} shards.`)},
  aGive(){const n=$('#aCard').value.trim(),h=$('#aHolo').checked;adm('dg_admin_card',{p_user:SEL&&SEL.id,p_name:n,p_holo:h,p_remove:false},`Gave ${n}${h?' (holo)':''}.`)},
  aTake(){const n=$('#aCard').value.trim();adm('dg_admin_card',{p_user:SEL&&SEL.id,p_name:n,p_holo:false,p_remove:true},`Removed ${n}.`)},
  aSetPw(){const pw=$('#aPw').value;adm('dg_admin_set_password',{p_user:SEL&&SEL.id,p_new:pw},'Password set. They have been logged out and can log in with the new one.').then(()=>{$('#aPw').value=''})},
  aClr(b){if(!SEL)return amsg('Pick a player first.');arm(b,'clr'+SEL.id,()=>{b.textContent='Clear username';adm('dg_admin_clear_name',{p_user:SEL.id},'Username cleared. They will be asked to pick a new one.').then(checkNames)})},
  aClrId(b){rpc('dg_admin_clear_name',{p_user:b.dataset.id}).then(()=>{$('#fMsg').textContent='Name cleared. They will be asked to pick a new one.';checkNames();loadPlayers()}).catch(e=>{$('#fMsg').textContent=errText(e)})},
  aReset(b){if(!SEL)return amsg('Pick a player first.');arm(b,'reset'+SEL.id,()=>{b.textContent='Reset this account';adm('dg_admin_reset',{p_user:SEL.id},'Account reset.')})},
  aMkCode(){const num=id=>{const v=$(id).value.trim();if(v==='')return null;const n=parseInt(v,10);return isNaN(n)?-1:n};const m=$('#cMsg');
    rpc('dg_admin_make_code',{p_code:$('#cCode').value.trim(),p_packs:num('#cPacks')||0,p_shards:num('#cShards')||0,p_max:num('#cMax'),p_days:num('#cDays')}).then(k=>{m.textContent=`Made code ${k}. Players type it on the Home tab.`;$('#cCode').value='';loadCodes()}).catch(e=>{m.textContent=errText(e)})},
  aDelCode(b){const k=b.dataset.c;arm(b,'del'+k,()=>rpc('dg_admin_delete_code',{p_code:k}).then(()=>{$('#cMsg').textContent=`Deleted ${k}.`;loadCodes()}).catch(e=>{$('#cMsg').textContent=errText(e)}))},
  aCopy(b){const k=b.dataset.c;copyText(k).then(()=>toast(`Copied ${k}`),()=>toast(`Code: ${k}`))},
  aMkAdmin(){const v=$('#admName').value.trim(),m=$('#admMsg');if(!v){m.textContent='Type a username first.';return}
    rpc('dg_owner_set_admin',{p_username:v,p_admin:true}).then(n=>{m.textContent=`${n} is now an admin. They'll see the Admin tab next time their app refreshes.`;$('#admName').value='';loadPlayers()}).catch(e=>{m.textContent=errText(e)})},
  aRmAdmin(b){const u=b.dataset.u;arm(b,'rmadm'+u,()=>rpc('dg_owner_set_admin',{p_username:u,p_admin:false}).then(n=>{$('#admMsg').textContent=`${n} is no longer an admin.`;loadPlayers()}).catch(e=>{$('#admMsg').textContent=errText(e)}))},
  aFilter(){const a=words($('#fAny').value),w=words($('#fWord').value);rpc('dg_admin_set_filter',{p_any:a,p_word:w}).then(()=>{$('#fMsg').textContent=`Saved: ${a.length} anywhere, ${w.length} whole-word.`;checkNames()}).catch(e=>{$('#fMsg').textContent=errText(e)})}};

/* ---------- clicks ---------- */
document.addEventListener('click',async e=>{const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
  if(a==='open')openPack(false);else if(a==='again')openPack(lastNd);else if(a==='openNd')openPack(true);else if(a==='flip')flip(b);else if(a==='revall')$$('#rgrid .fc').forEach(flip);else if(a==='close')$('#rev').hidden=true;
  else if(a==='login')act('dg_claim_login',{},rw=>toast(`+${rw} pack${rw>1?'s':''} · Day ${S.last===dayMinus1(S.day)?S.streak+1:1} streak`));
  else if(a==='quest')act('dg_claim_quest',{i:+b.dataset.i},rw=>toast(`+${rw} pack${rw>1?'s':''} · Quest done`));
  else if(a==='ms')act('dg_claim_ms',{p_id:b.dataset.id},rw=>toast(`+${rw} packs · Milestone`)).then(loadMS);
  else if(a==='buy')act('dg_buy_pack',{},()=>toast('+1 pack · Bought with shards'));
  else if(a==='buyNd')act('dg_buy_nodupe',{},()=>toast('+1 No-Dupe pack · Bought with shards'));
  else if(a==='craft')act('dg_craft',{p_name:b.dataset.n},()=>toast(`Crafted ${b.dataset.n}`));
  else if(a==='hl')hlPick(+b.dataset.w);else if(a==='more'){COL.lim+=120;renderCol()}
  else if(a==='sell')sellOpen(b.dataset.n);else if(a==='sclose')$('#sell').hidden=true;
  else if(a==='quick'){const n=SELLN;$('#sell').hidden=true;act('dg_quick_sell',{p_name:n},v=>toast(`Sold ${n} for ${v} shards`))}
  else if(a==='mkBuy'){if(busy)return;busy=true;renderMarket();await act('dg_buy',{p_id:b.dataset.id},()=>toast('Bought! It is in your collection.'));busy=false;loadMarket()}
  else if(a==='mkCancel'){await act('dg_cancel',{p_id:b.dataset.id},()=>toast('Listing cancelled. The card is back in your collection.'));loadMarket()}
  else if(a==='miniOpen')quickOpen(false);else if(a==='miniNd')quickOpen(true);
  else if(a==='openMini'){if(window.dgDesk)window.dgDesk.pip(true)}else if(a==='miniFull'||a==='miniClose'){if(window.dgDesk)window.dgDesk.pip(false);else window.close()}
  else if(a==='autoT'){AUTO.on=b.checked;ls('dg-auto',AUTO.on?'1':'0');if(AUTO.on)toast('Auto-open is on: packs open by themselves');render()}
  else if(a==='autoNdT'){AUTO.nd=b.checked;ls('dg-auto-nd',AUTO.nd?'1':'0');render()}
  else if(a==='autoBuyT'){AUTO.buy=b.checked;ls('dg-auto-buy',AUTO.buy?'1':'0');if(AUTO.buy)toast('Auto-open will buy No-Dupe packs whenever you have 300 shards');render()}
  else if(a==='buyAuto')act('dg_buy_autoopen',{},()=>{AUTO.on=true;ls('dg-auto','1');toast('Auto-open unlocked and switched on!')});
  else if(a==='noticeOk')closeNotice();
  else if(a==='invCopy')copyText(inviteText()).then(()=>toast('Invite copied. Paste it to a friend!'),()=>toast(`Your invite code: ${S.invite}`));
  else if(a==='finsp')inspect(b.dataset.n,b.dataset.h==='1',!S.cards[b.dataset.n]);
  else if(a==='acct')openAcct();else if(a==='accclose'){if(!S.needs)$('#acc').hidden=true}
  else if(a==='logout'){try{await rpc('dg_logout')}catch(err){}try{await SB.auth.signOut()}catch(err){}location.hash='';location.reload()}
  else if(FX[a])FX[a](b);else if(TRADE[a])TRADE[a](b);else if(ADMIN[a])ADMIN[a](b)});
$('#codeForm').addEventListener('submit',async e=>{e.preventDefault();const k=$('#codeIn').value.trim(),m=$('#codeMsg'),b=$('#codeBtn');if(!k){m.textContent='Type a code first.';return}
  b.disabled=true;try{const d=await rpc('dg_redeem',{p_code:k});if(d&&d.err)m.textContent=d.err;else{const t=[d.packs?`+${d.packs} pack${d.packs>1?'s':''}`:'',d.shards?`+${d.shards} shards`:''].filter(Boolean).join(', ');m.textContent=d.invite?`Invite from ${d.invite} used: ${t}.`:`Code redeemed: ${t}.`;toast(d.invite?`${t} · Invited by ${d.invite}`:`${t} · Code redeemed`);$('#codeIn').value='';await refresh()}}catch(err){m.textContent=errText(err)}b.disabled=false});
$('#rgrid').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const f=e.target.closest('.fc');if(f){e.preventDefault();flip(f)}}});
$('#fq').addEventListener('input',e=>{COL.q=e.target.value;COL.lim=120;renderCol()});
$('#fr').addEventListener('change',e=>{COL.r=e.target.value;COL.lim=120;renderCol()});
$('#fl').addEventListener('change',e=>{COL.l=e.target.value;COL.lim=120;renderCol()});
$('#fs').addEventListener('change',e=>{COL.s=e.target.value;COL.lim=120;renderCol()});

/* ---------- routing ---------- */
const VIEWS=['home','earn','collection','market','trades','leaderboard','admin'];
function route(){if(!S)return;let v=location.hash.slice(1);if(!VIEWS.includes(v)||(v==='admin'&&!S.admin))v='home';cur=v;$$('.view').forEach(s=>s.hidden=s.id!=='v-'+v);$$('nav a').forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+v));
  if(v!=='earn'&&G.on){G.on=false;G.msg='Run stopped'}if(v==='earn'){requestAnimationFrame(size);loadMS();if(!HL.a)hlNew()}
  if(v==='home')loadFeed();if(v==='market')loadMarket();if(v==='trades'){loadTrades();loadTradePlayers()}if(v==='leaderboard')loadLB();if(v==='admin'&&adminLoaded){loadPlayers();checkNames()}render();refresh().catch(()=>{})}
addEventListener('hashchange',route);
setInterval(()=>{if(!S)return;if(nextAt&&Date.now()>=nextAt){nextAt=null;refresh().catch(()=>{})}if(cur==='home'){renderHome();if(Date.now()-feedAt>30000)loadFeed()}},1000);
setInterval(()=>{if(S&&cur==='market')loadMarket();if(S&&cur==='trades')loadTrades()},15000);
setInterval(()=>{if(S)refresh().catch(()=>{})},60000);

/* ---------- trading ---------- */
let TR=[],TB={who:null,their:{},give:[],want:[]};
async function loadTrades(){try{TR=await rpc('dg_my_trades')||[]}catch(e){TR=[]}if(cur==='trades')renderTradeList()}
async function loadTradePlayers(){try{const {data}=await SB.from('profiles').select('username').order('username_lower').limit(1000);$('#tPlayers').innerHTML=(data||[]).filter(p=>p.username!==S.name).map(p=>`<option value="${esc(p.username)}">`).join('')}catch(e){}}
const tName=n=>{const c=BY[n];return c&&!c.hm?'#'+c.p+' '+n:n};
const tChip=(n,h,act,dim)=>{const c=BY[n],R=c?RAR[c.r]:{c:'#8a7f86'};return `<button type="button" class="tchip${h?' holo':''}${dim?' dim':''}" style="--rc:${R.c}"${act?` data-act="${act}" data-n="${esc(n)}"`:' disabled'}${dim?' title="You already have this card"':''}><b>${esc(tName(n))}</b><small>${h?'Holo ':''}${c?esc(rarName(c)):''}${dim?' · you have it':''}</small></button>`};
const tItems=(cards,sh)=>(cards||[]).map(([n,h])=>tChip(n,h)).join('')+(sh?`<span class="tsh">${sh} shards</span>`:'')||'<span class="note">Nothing</span>';
function renderTradeList(){const open=TR.filter(t=>t.status==='open'),done=TR.filter(t=>t.status!=='open');
  const row=t=>{const out=t.dir==='out',youGive=out?[t.give,t.gs]:[t.want,t.ws],youGet=out?[t.want,t.ws]:[t.give,t.gs];
    const st={accepted:'Accepted',declined:'Declined',cancelled:'Cancelled',failed:'Couldn\'t happen'}[t.status];
    return `<div class="trow${t.status==='open'&&!out?' tin':''}"><p class="thead">${out?`Your offer to <b>${esc(t.who)}</b>`:`<b>${esc(t.who)}</b> offers you a trade`} <small>${ago(t.t)}</small>${st?` <span class="tst ${t.status}">${st}</span>`:''}</p>
      <div class="tside"><span class="tlab">You give</span>${tItems(...youGive)}</div><div class="tside"><span class="tlab">You get</span>${tItems(...youGet)}</div>
      ${t.note?`<p class="note">${esc(t.note)}</p>`:''}${t.status!=='open'?'':!out?`<div class="row"><button class="btn lime sm" data-act="tAccept" data-id="${esc(t.id)}">Accept</button><button class="btn ghost sm" data-act="tDecline" data-id="${esc(t.id)}">Decline</button></div>`:`<button class="mini" data-act="tCancel" data-id="${esc(t.id)}">Cancel offer</button>`}</div>`};
  setH($('#tList'),(open.length?open.map(row).join(''):'<p class="note">No offers waiting. Start one on the left.</p>')+(done.length?'<h3 class="th3">History</h3>'+done.map(row).join(''):''))}
function renderBuilder(){const b=TB;$('#tBuilder').hidden=!b.who;if(!b.who)return;$('#tWhoName').textContent=b.who;
  const pick=(list,q,sel,act,owner,mineSide)=>{q=q.trim().toLowerCase();const f=list.filter(n=>BY[n]&&!sel.includes(n)&&(!q||n.toLowerCase().includes(q))).sort((x,y)=>(RK(BY[y])-RK(BY[x]))||((BY[x].p||0)-(BY[y].p||0)));
    return f.slice(0,40).map(n=>{const h=owner[n]===2,dim=!mineSide&&S.cards[n]&&(S.cards[n]===2||!h);return tChip(n,h,dim?null:act,dim)}).join('')+(f.length>40?`<p class="note">${f.length-40} more. Search to narrow it down.</p>`:'')||'<p class="note">No cards match.</p>'};
  $('#tGivePick').innerHTML=pick(Object.keys(S.cards),$('#tGiveQ').value,b.give,'tAddG',S.cards,true);
  $('#tWantPick').innerHTML=pick(Object.keys(b.their),$('#tWantQ').value,b.want,'tAddW',b.their,false);
  $('#tGiveSel').innerHTML=b.give.map(n=>tChip(n,S.cards[n]===2,'tRmG')).join('')||'<span class="note">Tap your cards below to add them.</span>';
  $('#tWantSel').innerHTML=b.want.map(n=>tChip(n,b.their[n]===2,'tRmW')).join('')||'<span class="note">Tap their cards below to add them.</span>';
  $('#tSend').disabled=busy}
function renderTrades(){renderBuilder();renderTradeList()}
const tmsg=t=>{$('#tMsg').textContent=t};
const TRADE={
  async tLoad(){const w=$('#tWho').value.trim();if(!w)return tmsg('Type a username first.');tmsg('Loading…');
    try{const d=await rpc('dg_player_cards',{p_username:w});if(d.u===S.name){tmsg('That\'s you! Pick someone else.');return}TB={who:d.u,their:d.cards||{},give:[],want:[]};$('#tGiveQ').value='';$('#tWantQ').value='';tmsg('');renderBuilder()}catch(e){tmsg(errText(e))}},
  tAddG(b){if(TB.give.length>=10)return tmsg('Up to 10 cards on each side.');TB.give.push(b.dataset.n);renderBuilder()},
  tAddW(b){if(TB.want.length>=10)return tmsg('Up to 10 cards on each side.');TB.want.push(b.dataset.n);renderBuilder()},
  tRmG(b){TB.give=TB.give.filter(n=>n!==b.dataset.n);renderBuilder()},
  tRmW(b){TB.want=TB.want.filter(n=>n!==b.dataset.n);renderBuilder()},
  async tSend(){const num=id=>Math.max(0,parseInt($(id).value,10)||0);
    try{await rpc('dg_trade_propose',{p_to:TB.who,p_give:TB.give,p_want:TB.want,p_give_shards:num('#tGiveSh'),p_want_shards:num('#tWantSh')});
      toast(`Offer sent to ${TB.who}`);tmsg(`Offer sent. ${TB.who} sees it in their Trades tab.`);TB.give=[];TB.want=[];$('#tGiveSh').value=0;$('#tWantSh').value=0;renderBuilder();loadTrades()}catch(e){tmsg(errText(e))}},
  async tAccept(b){b.disabled=true;try{const d=await rpc('dg_trade_respond',{p_id:b.dataset.id,p_accept:true});if(d&&d.err)toast(d.err);else toast('Trade done! The cards are in your collection.');await refresh()}catch(e){toast(errText(e))}loadTrades()},
  async tDecline(b){b.disabled=true;try{await rpc('dg_trade_respond',{p_id:b.dataset.id,p_accept:false});toast('Trade declined')}catch(e){toast(errText(e))}refresh().catch(()=>{});loadTrades()},
  async tCancel(b){b.disabled=true;try{await rpc('dg_trade_cancel',{p_id:b.dataset.id});toast('Offer cancelled')}catch(e){toast(errText(e))}loadTrades()}};
$('#tGiveQ').addEventListener('input',renderBuilder);$('#tWantQ').addEventListener('input',renderBuilder);
$('#tWho').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();TRADE.tLoad()}});

/* ---------- quick opening, auto-open and the mini window ---------- */
const MINI=new URLSearchParams(location.search).has('mini');
if(MINI){document.body.classList.add('mini');$('#mini').hidden=false;document.title='Demon Gacha mini'}
const ls=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}};
const AUTO={on:ls('dg-auto')==='1',nd:ls('dg-auto-nd')==='1',buy:ls('dg-auto-buy')==='1'};
addEventListener('storage',e=>{if(/^dg-auto/.test(e.key||'')){AUTO.on=ls('dg-auto')==='1';AUTO.nd=ls('dg-auto-nd')==='1';AUTO.buy=ls('dg-auto-buy')==='1';render()}});
/* every card on the list and both special cards: buying No-Dupe packs would only give shards back */
const listDone=()=>uniq()>=LIST.length&&HMS.every(c=>S.cards[c.n]);
const rarName=c=>c.r===5?'Honorable Mention':RAR[c.r].k;
function autoHTML(){if(!S.auto)return `<button class="btn lime sm" data-act="buyAuto"${S.shards<1000?' disabled':''} title="Opens your packs by itself while it's switched on">Unlock auto-open · 1,000 shards</button>`;
  return `<label class="chk"><input type="checkbox" data-act="autoT"${AUTO.on?' checked':''}> Auto-open packs</label><label class="chk"><input type="checkbox" data-act="autoNdT"${AUTO.nd?' checked':''}> Include No-Dupe packs</label><label class="chk" title="When you run out of packs, spend 300 shards on a No-Dupe pack and open it. Stops when your collection is complete."><input type="checkbox" data-act="autoBuyT"${AUTO.buy?' checked':''}> Buy No-Dupe packs with shards</label>`}
/* the mini window says it's open, so the big window doesn't auto-open at the same time */
const pipAlive=()=>Date.now()-(+ls('dg-pip-beat')||0)<5000;
if(MINI){setInterval(()=>ls('dg-pip-beat',String(Date.now())),2000);ls('dg-pip-beat',String(Date.now()));addEventListener('beforeunload',()=>ls('dg-pip-beat','0'))}
let lastQuick=null,flashT=0;
/* opens a pack without the case spin or reveal screen: used by the mini window and by auto-open */
async function quickOpen(nd,auto){nd=!!nd;if(busy||(nd?S.nd:S.packs)<1)return false;busy=true;render();
  let res;try{res=await rpc('dg_open_pack',{p_nodupe:nd})}catch(e){busy=false;toast(errText(e));render();return false}
  const pulls=res.map(p=>({c:BY[p.n]||{n:p.n,p:0,r:0},h:!!p.h,tag:p.tag,nw:!!p.nw,full:!!p.full}));
  const best=pulls.slice().sort((a,b)=>(a.full-b.full)||(RK(b.c)-RK(a.c))||(b.h-a.h)||((a.c.p||0)-(b.c.p||0)))[0];
  lastQuick={pulls,best,nd,auto:!!auto};
  const big=best.c.r>=3&&!best.full,label=(best.h?'Holo ':'')+rarName(best.c);
  if(big&&MINI){flashT=Date.now();const f=$('#mFlash');f.style.setProperty('--rc',RAR[best.c.r].c);f.innerHTML=`<b>${esc(label)} pull!</b><span>${best.c.hm?'':'#'+best.c.p+' '}${esc(best.c.n)}</span>`;f.hidden=false}
  else if(big)toast(`${auto?'Auto-open: ':''}${label} · ${best.c.n}`);
  try{await refresh()}catch(e){}busy=false;render();if(pulls.some(p=>p.c.r>=3))loadFeed();return true}
setInterval(()=>{if(!S||!S.auto||!AUTO.on||busy)return;if(!MINI&&pipAlive())return;if(!$('#rev').hidden||!$('#spin').hidden||!$('#banner').hidden||!$('#insp').hidden)return;
  if(S.packs>0)quickOpen(false,true);else if((AUTO.nd||AUTO.buy)&&S.nd>0)quickOpen(true,true);
  else if(AUTO.buy&&S.shards>=300&&!listDone()){busy=true;rpc('dg_buy_nodupe').then(()=>refresh()).catch(e=>{AUTO.buy=false;ls('dg-auto-buy','0');toast('Auto-buy stopped: '+errText(e))}).finally(()=>{busy=false;render()})}},4000);
const mcard=p=>{const c=p.c,R=RAR[c.r];return `<div class="mc${p.h?' holo':''}${p.full?' full':''}${p.nw?' new':''}" style="--rc:${R.c}" title="${esc(c.n)} · ${esc((p.h?'Holo ':'')+rarName(c))}${c.hm?'':' · #'+c.p} · ${esc(p.tag)}"><img src="face.png" alt="" style="filter:${TINT[c.r]}"><b>${esc(c.n)}</b></div>`};
function renderMini(){if(!MINI||!S)return;
  const full=S.packs>=CAP||!nextAt,left=Math.max(0,(nextAt||0)-Date.now());
  $('#mPacks').textContent=S.packs;$('#mNd').textContent=S.nd;$('#mShards').textContent=S.shards+' shards';
  $('#mTime').innerHTML=full?'Timer full':`Next pack in <b>${Math.floor(left/60000)}:${String(Math.floor(left/1000)%60).padStart(2,'0')}</b>`;
  $('#mBar').style.width=(full?100:(1-left/600000)*100)+'%';
  $('#mOpen').disabled=S.packs<1||busy;$('#mNdBtn').disabled=S.nd<1||busy;
  setH($('#mAuto'),autoHTML()+(S.auto&&AUTO.on?`<p class="mnote">${S.packs||((AUTO.nd||AUTO.buy)&&S.nd)?'Opening your packs…':AUTO.buy&&S.shards>=300&&!listDone()?'Buying a No-Dupe pack…':AUTO.buy&&listDone()?'Collection complete! Auto-buy is resting.':'Waiting for the next pack'+(AUTO.buy?' or 300 shards.':'.')}</p>`:''));
  if(flashT&&Date.now()-flashT>5000){flashT=0;$('#mFlash').hidden=true}
  const q=lastQuick;setH($('#mLast'),q?`<p class="mlab">${q.auto?'Auto-opened':'Last'} ${q.nd?'No-Dupe pack':'pack'} · ${q.pulls.filter(p=>p.nw).length} new</p><div class="mgrid">${q.pulls.map(mcard).join('')}</div><p class="mbest" style="color:${RAR[q.best.c.r].c}">${esc((q.best.h?'Holo ':'')+rarName(q.best.c))} · ${esc(q.best.c.n)}</p>`:'<p class="mnote">Open a pack and your cards show up here.</p>');
  const f=(FEED.feed||[]).find(x=>BY[x.n]);setH($('#mFeed'),f?`<span class="mlab">Latest rare pull</span> <b>${esc(f.u)}</b> · <span style="color:${RAR[BY[f.n].r].c}">${BY[f.n].hm?'':'#'+BY[f.n].p+' '}${esc(f.n)}</span> · ${ago(f.t)}`:'')}
setInterval(()=>{if(MINI&&S){renderMini();if(Date.now()-feedAt>30000)loadFeed()}},1000);

/* ---------- notices: shown once per device to the players they apply to ---------- */
/* IME was lowered under APEX on 24 Nov 2026; everyone who had it by then got 1,000 shards */
const IME_CUT=Date.parse('2026-11-25T02:40:00Z');
const NOTICES=[{id:'ime-lowered',show:()=>!!S.cards['IT MEANS EVERYTHING']&&(S.when['IT MEANS EVERYTHING']||0)<IME_CUT,title:'Im Sorry :(',body:'IT MEANS EVERYTHING has been lowered under APEX (GRIEF)',note:'It was an accident for IME to be above GRIEF.',extra:'+1,000 shards as a sorry',card:'IT MEANS EVERYTHING'}];
function showNotices(){if(!S||!$('#notice').hidden)return;const n=NOTICES.find(x=>!ls('dg-notice-'+x.id)&&x.show());if(!n)return;
  $('#nTitle').textContent=n.title;$('#nBody').textContent=n.body;$('#nExtra').textContent=n.extra||'';$('#nExtra').hidden=!n.extra;$('#nNote').textContent=n.note||'';$('#nNote').hidden=!n.note;$('#nCard').innerHTML=n.card&&BY[n.card]?card(BY[n.card],S.cards[n.card]===2):'';$('#notice').dataset.id=n.id;$('#notice').hidden=false}
function closeNotice(){const b=$('#notice');if(b.hidden)return;ls('dg-notice-'+b.dataset.id,'1');b.hidden=true;setTimeout(showNotices,300)}
setInterval(()=>{if(S&&!busy&&['rev','spin','banner','insp'].every(id=>$('#'+id).hidden))showNotices()},2000);

/* ---------- automatic updates ----------
   The game lives online (GAME_URL). The PC and Android apps open that copy, so a new version reaches everyone
   without reinstalling: every few minutes the game checks version.json and reloads itself when you're not busy.
   If the apps can't reach the site they use the copy built into the app, and switch over once it's reachable. */
const GAME_URL='https://hahayesthegoat-cmyk.github.io/demon-gacha/';
const HOSTED=location.protocol==='https:'&&GAME_URL.startsWith(location.origin);
const MYVER=(document.querySelector('meta[name="dg-version"]')||{}).content||'';
let newVer=null;
async function checkUpdate(){if(!HOSTED&&location.protocol!=='file:')return;
  try{const r=await fetch((HOSTED?'':GAME_URL)+'version.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;const j=await r.json();
    if(j&&j.app==='demon-gacha'&&j.v&&(j.v!==MYVER||!HOSTED))newVer=j.v}catch(e){}}
function applyUpdate(){if(!newVer||busy)return;if(['rev','spin','banner','insp','sell','acc'].some(id=>!$('#'+id).hidden))return;
  if(cur==='trades'&&(TB.give.length||TB.want.length))return;if(cur==='earn'&&typeof G!=='undefined'&&G.on)return;
  const v=newVer;newVer=null;toast('Updating to the newest version…');
  setTimeout(()=>location.replace((HOSTED?location.pathname:GAME_URL)+'?v='+encodeURIComponent(v)+(MINI?'&mini=1':'')+location.hash),1200)}
setTimeout(checkUpdate,8000);setInterval(checkUpdate,4*60*1000);setInterval(applyUpdate,5000);

/* ---------- boot: setup, login, game ---------- */
async function ensureGuest(){const {data}=await SB.auth.getSession();if(data.session)return;const {error}=await SB.auth.signInAnonymously();if(error)throw new Error(/anonymous/i.test(error.message)?'Anonymous sign-ins are turned off in Supabase. Turn them on under Authentication, then Sign In / Providers.':error.message)}
async function enterGame(){applyState(await rpc('dg_state'));await loadDefs();
  try{const {data}=await SB.from('profiles').select('id').eq('is_owner',true).limit(1);OWNER_ID=data&&data[0]?data[0].id:null}catch(e){}
  gate(null);route();if(S.needs)openAcct('An admin reset your username. Pick a new one to keep playing.')}
let mode='in';
$$('.tab').forEach(t=>t.addEventListener('click',()=>{mode=t.dataset.mode;$$('.tab').forEach(x=>x.classList.toggle('on',x===t));$('#lp2wrap').hidden=mode!=='up';$('#loginBtn').textContent=mode==='up'?'Create account':'Log in';$('#lp').autocomplete=mode==='up'?'new-password':'current-password';$('#loginMsg').textContent=''}));
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const u=$('#lu').value.trim().replace(/\s+/g,' '),p=$('#lp').value,m=$('#loginMsg'),btn=$('#loginBtn');
  if(!u||!p){m.textContent='Enter a username and password.';return}
  if(mode==='up'){const er=nameErr(u);if(er){m.textContent=er;return}if(p.length<6){m.textContent='Use a password of at least 6 characters.';return}if(p!==$('#lp2').value){m.textContent='The two passwords do not match.';return}}
  btn.disabled=true;m.textContent=mode==='up'?'Creating your account…':'Logging in…';
  try{await ensureGuest();if(mode==='up')await rpc('dg_register',{p_username:u,p_password:p});else{const r=await rpc('dg_login',{p_username:u,p_password:p});if(r){m.textContent=r;btn.disabled=false;return}}
    const inv=mode==='up'?$('#linv').value.trim():'';$('#lp').value='';$('#lp2').value='';$('#linv').value='';m.textContent='';await enterGame();
    if(inv){try{const d=await rpc('dg_redeem',{p_code:inv});if(d&&d.err)toast(`Invite code: ${d.err} You can try again in Redeem a code.`);else{toast(`+5 packs · Invited by ${d.invite||'a friend'}`);await refresh()}}catch(err){toast(errText(err))}}}catch(err){m.textContent=errText(err)}btn.disabled=false});
$('#setupForm').addEventListener('submit',e=>{e.preventDefault();const url=$('#su').value.trim().replace(/\/+$/,''),key=$('#sk').value.trim(),m=$('#setupMsg');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)&&!/^https:\/\//i.test(url)){m.textContent='The Project URL should look like https://xxxx.supabase.co';return}
  if(key.split('.').length!==3&&!/^sb_publishable_/.test(key)){m.textContent='That does not look like the anon public key.';return}
  try{localStorage.setItem('dg-cfg',JSON.stringify({url,key}))}catch(err){}location.reload()});
(async()=>{const {url,key}=readCfg();if(!url||!key){gate('setup');return}
  SB=supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'dg-auth'}});
  try{const {data}=await SB.auth.getSession();if(!data.session){gate('login');return}await enterGame()}
  catch(e){const m=errText(e);gate('login');if(!/Not signed in/i.test(m))$('#loginMsg').textContent=m}})();
}
