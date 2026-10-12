const state={content:null,db:null,session:[],index:0,answered:false,placement:[],placementIndex:0,placementScore:0,sessionStartedAt:null,sessionCorrect:0,streak:0,user:null,clientId:null,storageKey:"english-db",syncStatus:"local",syncPromise:null,offline:false,sessionMode:"mixed",sessionTopic:null,nextDifficultyDirection:0};

async function load(){
 try{
  const response=await fetch("/data/content.json");
  if(!response.ok)throw new Error("content");
  state.content=await response.json();
  state.clientId=localStorage.getItem("polyvo-client-id");
  if(!state.clientId){state.clientId=PolyvoProgress.makeId("device");localStorage.setItem("polyvo-client-id",state.clientId)}
  updateAccountBar();
  let remoteUser=null,sessionReachable=false;
  try{const r=await fetch("/api/auth",{cache:"no-store"});sessionReachable=r.ok;if(r.ok){const data=await r.json();remoteUser=data.user||null}}
  catch(_){}
  if(remoteUser){await activateUser(remoteUser,false);return}
  const remembered=localStorage.getItem("polyvo-last-user");
  if(!sessionReachable&&remembered){
   try{state.user=JSON.parse(remembered);state.offline=true;state.storageKey="english-db:"+state.user.id;state.db=PolyvoProgress.normalizeDb(JSON.parse(localStorage.getItem(state.storageKey)||"null"),state.clientId);state.syncStatus="offline";save()}
   catch(_){state.user=null;loadGuestDb()}
  }else{state.user=null;state.offline=false;loadGuestDb()}
  renderHome();updateAccountBar();
 }catch(error){
  document.getElementById("app").innerHTML='<div class="card center" style="margin-top:40px"><h2>De app kon niet laden.</h2><p class="muted">Ververs de pagina. Als dit blijft gebeuren, is er iets mis met de inhoudsdata.</p><button class="btn primary" onclick="location.reload()">Opnieuw proberen</button></div>';
  console.error(error);
 }
}
function loadGuestDb(){
 state.storageKey="english-db";state.db=PolyvoProgress.normalizeDb(JSON.parse(localStorage.getItem(state.storageKey)||"null"),state.clientId);save()
}
function save(){if(state.db)localStorage.setItem(state.storageKey,JSON.stringify(state.db))}
function updateAccountBar(){
 const el=document.getElementById("account-area");if(!el)return;
 if(state.user){
  const label=state.user.name||state.user.email||"POLYVO-account";
  const status=state.offline?"Offline":state.syncStatus==="syncing"?"Synchroniseren…":state.syncStatus==="error"?"Sync later":"Gesynchroniseerd";
  el.innerHTML='<span class="account-label">'+escapeHtml(label)+' · '+status+'</span><button class="btn secondary account-button" id="account-action">Uitloggen</button>';
  document.getElementById("account-action").addEventListener("click",logout);
 }else{
  el.innerHTML='<span class="account-label">Voortgang op dit apparaat</span><button class="btn secondary account-button" id="account-action">Account</button>';
  document.getElementById("account-action").addEventListener("click",()=>renderAuthScreen());
 }
}
function renderAuthScreen(message=""){
 document.getElementById("app").innerHTML='<div class="card auth-card"><button class="btn secondary" id="auth-back">← Terug naar oefenen</button><div class="eyebrow auth-eyebrow">POLYVO ACCOUNT</div><h1>Bewaar je voortgang</h1><p class="muted">Maak een account om op meerdere apparaten verder te gaan. Je bestaande voortgang op dit apparaat wordt bij het aanmaken van je account meegenomen. Je kunt ook zonder account blijven oefenen.</p><div class="auth-tabs"><button class="btn primary" id="auth-login-tab">Inloggen</button><button class="btn secondary" id="auth-signup-tab">Account maken</button></div><form id="auth-form"><label for="auth-email">E-mailadres</label><input id="auth-email" type="email" autocomplete="email" required><label for="auth-password">Wachtwoord <span class="muted">(minimaal 8 tekens)</span></label><input id="auth-password" type="password" minlength="8" autocomplete="current-password" required><label for="auth-password-confirm" id="auth-password-confirm-label" hidden>Herhaal wachtwoord</label><input id="auth-password-confirm" type="password" minlength="8" autocomplete="new-password" hidden><label for="auth-name" id="auth-name-label" hidden>Naam (optioneel)</label><input id="auth-name" type="text" maxlength="80" autocomplete="name" placeholder="Naam (optioneel)" hidden><div id="auth-message" class="auth-message">'+escapeHtml(message)+'</div><button class="btn primary" id="auth-submit" type="submit">Inloggen</button></form><p class="small">Offline oefenen blijft beschikbaar. Synchronisatie start zodra je account en internetverbinding beschikbaar zijn.</p></div>';
 let mode="login";
 const setMode=next=>{mode=next;const signup=mode==="signup";document.getElementById("auth-submit").textContent=signup?"Account maken":"Inloggen";document.getElementById("auth-password").autocomplete=signup?"new-password":"current-password";document.getElementById("auth-password-confirm-label").hidden=!signup;document.getElementById("auth-password-confirm").hidden=!signup;document.getElementById("auth-password-confirm").required=signup;document.getElementById("auth-name-label").hidden=!signup;document.getElementById("auth-name").hidden=!signup;document.getElementById("auth-login-tab").className="btn "+(signup?"secondary":"primary");document.getElementById("auth-signup-tab").className="btn "+(signup?"primary":"secondary")};
 document.getElementById("auth-back").addEventListener("click",renderHome);
 document.getElementById("auth-login-tab").addEventListener("click",()=>setMode("login"));
 document.getElementById("auth-signup-tab").addEventListener("click",()=>setMode("signup"));
 document.getElementById("auth-form").addEventListener("submit",async e=>{
  e.preventDefault();const submit=document.getElementById("auth-submit"),note=document.getElementById("auth-message");if(mode==="signup"&&document.getElementById("auth-password").value!==document.getElementById("auth-password-confirm").value){note.textContent="De wachtwoorden zijn niet hetzelfde.";return}submit.disabled=true;note.textContent="Even geduld…";
  try{
   const result=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:mode,email:document.getElementById("auth-email").value,password:document.getElementById("auth-password").value,name:document.getElementById("auth-name").value})});
   const data=await result.json();if(!result.ok)throw new Error(data.error||"Accountaanvraag mislukt.");
   if(data.confirmationRequired){localStorage.setItem("polyvo-pending-migration-email",document.getElementById("auth-email").value.trim().toLowerCase());note.textContent="Controleer je e-mail en bevestig je account. Log daarna hier in.";submit.disabled=false;return}
   if(!data.user)throw new Error("De accountdienst heeft geen gebruiker teruggegeven.");
   const email=document.getElementById("auth-email").value.trim().toLowerCase();const claimGuest=mode==="signup"||localStorage.getItem("polyvo-pending-migration-email")===email;if(claimGuest)localStorage.removeItem("polyvo-pending-migration-email");await activateUser(data.user,claimGuest);
  }catch(error){note.textContent=error.message||"Accountdienst niet bereikbaar.";submit.disabled=false}
 });
}
function activateUser(user,importGuest){
 if(importGuest)localStorage.removeItem("polyvo-pending-migration-email");
 state.user=user;state.offline=false;state.storageKey="english-db:"+user.id;localStorage.setItem("polyvo-last-user",JSON.stringify(user));
 if(importGuest){state.db=PolyvoProgress.normalizeDb(state.db,state.clientId)}
 else{state.db=PolyvoProgress.normalizeDb(JSON.parse(localStorage.getItem(state.storageKey)||"null"),state.clientId)}
 if(user.name&&!state.db.profile.name)state.db.profile.name=user.name;
 save();state.syncStatus="syncing";updateAccountBar();
 return syncProgress().then(()=>{renderHome();updateAccountBar()})
}
async function logout(){
 if(state.syncPromise)await state.syncPromise;
 try{await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"logout"})})}catch(_){}
 localStorage.removeItem("polyvo-last-user");state.user=null;state.offline=false;state.syncStatus="local";loadGuestDb();renderHome();updateAccountBar()
}
async function syncProgress(){
 if(!state.user||state.offline||state.syncPromise)return state.syncPromise;
 let synced=false;
 state.syncPromise=(async()=>{
  state.syncStatus="syncing";updateAccountBar();
  try{
   let remote=[],offset=0;
   do{const r=await fetch("/api/progress?offset="+offset,{cache:"no-store"});if(!r.ok)throw new Error("sync");const page=await r.json();remote=remote.concat(page.events||[]);offset=page.nextOffset;if(remote.length>100000)throw new Error("sync-limit")}while(offset!==null);
   let localEvents=state.db.events||[],pending=state.db.pendingEvents||[];
   const remoteIds=new Set(remote.map(e=>e.eventId));pending=pending.filter(e=>!remoteIds.has(e.eventId));
   state.db=PolyvoProgress.rebuild(PolyvoProgress.mergeEvents(remote,localEvents));state.db.pendingEvents=pending;save();
   const queue=[...pending];
   for(let i=0;i<queue.length;i+=50){
    const batch=queue.slice(i,i+50),r=await fetch("/api/progress",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({events:batch})});
    if(!r.ok)throw new Error("sync");const data=await r.json(),accepted=new Set(data.accepted||[]);
    state.db.pendingEvents=state.db.pendingEvents.filter(e=>!accepted.has(e.eventId));save()
   }
   state.offline=false;state.syncStatus="synced";synced=true;
  }catch(_){state.syncStatus="error"}
  finally{state.syncPromise=null;updateAccountBar();if(synced&&state.user&&!state.offline&&state.db.pendingEvents.length)setTimeout(()=>syncProgress(),0)}
 })();
 return state.syncPromise
}
function queueAnswer(itemId,correct,at=new Date()){
 state.db=PolyvoProgress.addEvent(state.db,"answer",{itemId,correct},PolyvoProgress.makeId("answer"),at.toISOString());save();if(state.user&&!state.offline)syncProgress()
}
function itemState(id){return state.db.states[id]||{}}
function topic(id){return state.content.topics.find(t=>t.id===id)||{id,name:id,description:""}}
function avgTopic(id){
 const a=state.content.items.filter(i=>i.topic===id&&Number(itemState(i.id).attempts||0)>0);
 return a.length?a.reduce((s,i)=>s+Number(itemState(i.id).mastery||0),0)/a.length:0;
}
function overall(){
 const a=state.content.items.filter(i=>Number(itemState(i.id).attempts||0)>0);
 return a.length?a.reduce((s,i)=>s+Number(itemState(i.id).mastery||0),0)/a.length:0;
}
function todayKey(d=new Date()){return d.toISOString().slice(0,10)}
function updateStreak(){
 const dates=[...new Set(state.db.sessions.map(s=>s.date).filter(Boolean))].sort().reverse();
 let streak=0,cur=new Date();
 for(const d of dates){
  if(d===todayKey(cur)){streak++;cur.setDate(cur.getDate()-1)}
  else if(streak===0){cur.setDate(cur.getDate()-1);if(d===todayKey(cur)){streak++;cur.setDate(cur.getDate()-1)}else break}
  else break;
 }
 state.streak=streak;
 const el=document.getElementById("streak");if(el)el.textContent="🔥 "+streak+" "+(streak===1?"dag":"dagen");
}
function todayStats(){
 const k=todayKey(),s=state.db.sessions.filter(x=>x.date===k);
 return{questions:s.reduce((n,x)=>n+x.total,0),correct:s.reduce((n,x)=>n+x.correct,0)};
}
function learnerLevel(){
 const m=overall(),covered=state.content.topics.filter(t=>avgTopic(t.id)>=.65).length;
 if(m>=.72&&covered>=8)return{name:"A2 · Zelfverzekerd",next:"B1"};
 if(m>=.50&&covered>=5)return{name:"A1+ · Op weg",next:"A2"};
 if(m>=.22&&covered>=2)return{name:"A1 · Basis",next:"A1+"};
 return{name:"A1 · Beginner",next:"A1+"};
}
function difficultyUnlocked(item){
 const topicItems=state.content.items.filter(i=>i.topic===item.topic);
 const attempted=topicItems.filter(i=>Number(itemState(i.id).attempts||0)>0);
 const attempts=attempted.reduce((n,i)=>n+Number(itemState(i.id).attempts||0),0);
 const m=attempted.length?attempted.reduce((s,i)=>s+Number(itemState(i.id).mastery||0),0)/attempted.length:0;
 const d=Number(item.difficulty||1);
 if(d<=1)return true;
 if(d===2)return m>=.35&&attempts>=4;
 return m>=.62&&attempts>=8;
}
function renderHome(){
 const first=state.db.profile.placementScore===null;
 const stats=todayStats(),pct=Math.round(overall()*100),level=learnerLevel();
 const due=state.content.items.filter(i=>itemState(i.id).nextReviewAt&&new Date(itemState(i.id).nextReviewAt)<=new Date()).length;
 const fresh=state.content.items.filter(i=>!itemState(i.id).attempts).length;
 const weak=[...state.content.items].filter(i=>Number(itemState(i.id).attempts||0)>0).sort((a,b)=>Number(itemState(a.id).mastery||0)-Number(itemState(b.id).mastery||0))[0];
 const recommended=weak?topic(weak.topic):state.content.topics[0];
 const topicsHtml=state.content.topics.map(t=>{
  const p=Math.round(avgTopic(t.id)*100);
  return '<article class="card topic topic-horizon" data-topic="'+t.id+'"><div class="row"><div><span class="topic-level">'+(t.level||"A1")+'</span><h3>'+t.name+'</h3><div class="muted">'+t.description+'</div></div><span class="percent">'+p+'%</span></div><div class="progress"><span style="width:'+p+'%"></span></div></article>';
 }).join("");
 document.getElementById("app").innerHTML=
 '<section class="hero hero-horizon"><div class="hero-copy">'+
 '<div class="eyebrow">'+(first?"EERSTE STAP":"VANDAAG")+'</div>'+
 '<h1>'+(first?"Small steps.<br><em>A bigger you.</em>":"Klaar voor je volgende stap?")+'</h1>'+
 '<p>'+(first?"Een korte starttest brengt je op het juiste beginpunt. Daarna groeit de moeilijkheid mee met wat je laat zien.":"Je hoeft niet te kiezen wat je moet oefenen. POLYVO kijkt naar je fouten, beheersing en herhaling en bouwt van daaruit verder.")+'</p>'+
 '<div class="hero-actions"><button class="btn primary" id="main-action">'+(first?"Start niveautest →":"Start een sessie →")+'</button><button class="btn secondary" id="idioms-action">Oefen gezegden →</button>'+(first?"":'<button class="btn secondary" id="placement-again">Niveautest opnieuw</button>')+'</div></div>'+
 '<div class="hero-orb"><div class="orb-sun"></div><div class="orb-ring"></div><span>'+level.name.split(" · ")[0]+'</span></div></section>'+
 '<section class="level-card card"><div><div class="small">JOUW LEERREIS</div><h2>'+level.name+'</h2><p class="muted">Je groeit automatisch door naar moeilijkere vragen zodra je de basis voldoende beheerst.</p></div>'+
 '<div class="level-progress"><div class="level-line"><span style="width:'+Math.min(100,pct)+'%"></span></div><div class="level-foot"><span>'+pct+'% beheerst</span><span>Volgende: '+level.next+'</span></div></div></section>'+
 '<section class="stats"><div class="stat card"><span>Vandaag</span><strong>'+stats.questions+'</strong><small>vragen</small></div>'+
 '<div class="stat card"><span>Goed</span><strong>'+(stats.questions?Math.round(stats.correct/stats.questions*100):0)+'%</strong><small>vandaag</small></div>'+
 '<div class="stat card"><span>Streak</span><strong>'+state.streak+'</strong><small>'+(state.streak===1?"dag":"dagen")+'</small></div>'+
 '<div class="stat card"><span>Herhaling</span><strong>'+due+'</strong><small>klaar voor vandaag</small></div></section>'+
 '<div class="section-title"><div><div class="eyebrow">GA VERDER</div><h2>Aanbevolen voor jou</h2><p>'+(weak?"We pakken eerst <b>"+recommended.name+"</b> weer op.":"Begin met een korte sessie en ontdek je niveau.")+'</p></div></div>'+
 '<section class="card recommendation"><div class="rec-icon">↗</div><div class="rec-copy"><span class="tag">Slim gekozen</span><h3>'+recommended.name+'</h3><p class="muted">'+recommended.description+'</p></div><button class="btn primary" id="recommended">Oefen →</button></section>'+
 '<section class="card recommendation word-mode-card"><div class="rec-icon">Aa</div><div class="rec-copy"><span class="tag">Woordtrainer</span><h3>Leer losse Engelse woorden</h3><p class="muted">Vertaal één Nederlands woord naar het Engels. Woorden die je lastig vindt komen automatisch vaker terug.</p></div><button class="btn secondary" id="word-mode">Start →</button></section>'+
 '<div class="section-title section-spaced"><div><div class="eyebrow">JOUW ONDERDELEN</div><h2>Skills die met je meegroeien</h2><p>'+due+' vragen staan klaar voor herhaling'+(fresh?" · "+fresh+" nieuwe vragen beschikbaar":"")+'.</p></div></div>'+
 '<div class="grid">'+topicsHtml+'</div>'+
 '<section class="card next-card"><div><span class="tag">Adaptive learning</span><h2>De app wordt moeilijker als jij beter wordt.</h2><p class="muted">Eerst de basis. Daarna meer context, langere zinnen en minder hulp. Je antwoorden laten zien wanneer je klaar bent voor de volgende stap.</p></div><div class="next-icon">↗</div></section>';
 document.getElementById("main-action").addEventListener("click",first?startPlacement:startSession);
 document.getElementById("idioms-action").addEventListener("click",startIdioms);
 document.getElementById("placement-again")?.addEventListener("click",startPlacement);
 document.getElementById("recommended").addEventListener("click",()=>startTopic(recommended.id));
 document.getElementById("word-mode").addEventListener("click",startWordMode);
 document.querySelectorAll("[data-topic]").forEach(el=>el.addEventListener("click",()=>startTopic(el.dataset.topic)));
}
function startPlacement(){state.placement=[...state.content.placement];state.placementIndex=0;state.placementScore=0;state.answered=false;renderPlacement()}
function renderPlacement(){
 if(state.placementIndex>=state.placement.length)return finishPlacement();
 const q=state.placement[state.placementIndex],total=state.placement.length;
 const opts=q.options.map((o,i)=>'<button class="answer" type="button" data-placement="'+i+'">'+o+'</button>').join("");
 document.getElementById("app").innerHTML='<div class="question-head"><button class="btn secondary" id="home-btn">← Home</button><div class="row"><span class="small">Niveautest · '+(state.placementIndex+1)+'/'+total+'</span><span class="tag">Geen invloed op mastery</span></div></div><div class="progress"><span style="width:'+(state.placementIndex/total*100)+'%"></span></div><div class="card question-card"><div class="small">Kies het antwoord dat jij denkt dat goed is</div><div class="question">'+q.prompt+'</div><div class="answers">'+opts+'</div><div id="placement-feedback"></div></div>';
 document.getElementById("home-btn").addEventListener("click",renderHome);
 document.querySelectorAll("[data-placement]").forEach(btn=>btn.addEventListener("click",()=>answerPlacement(q,btn)));
}
function answerPlacement(q,btn){
 if(state.answered)return;
 state.answered=true;
 const correct=normalize(btn.textContent)===normalize(q.answer);if(correct)state.placementScore++;
 btn.classList.add(correct?"correct":"wrong");
 document.querySelectorAll("[data-placement]").forEach(b=>{if(normalize(b.textContent)===normalize(q.answer))b.classList.add("correct");b.disabled=true});
 document.getElementById("placement-feedback").innerHTML='<div class="feedback '+(correct?"good":"bad")+'"><strong>'+(correct?"Goed!":"Nog niet.")+'</strong><p>'+q.explanation+'</p></div><button class="btn primary next-btn" id="placement-next">'+(state.placementIndex+1===state.placement.length?"Bekijk resultaat":"Volgende →")+'</button>';
 document.getElementById("placement-next").addEventListener("click",()=>{state.placementIndex++;state.answered=false;renderPlacement()});
}
function finishPlacement(){
 const score=state.placementScore/state.placement.length;
 state.db=PolyvoProgress.addEvent(state.db,"profile",{profile:{placementScore:score,placementAt:new Date().toISOString()}},PolyvoProgress.makeId("profile"));save();if(state.user&&!state.offline)syncProgress();
 const label=score<.4?"Starter":score<.7?"Beginner":"Beginner+";
 document.getElementById("app").innerHTML='<div class="center result-page"><span class="tag">Niveautest klaar</span><h1>Je startniveau</h1><div class="card result-card"><div class="big">'+Math.round(score*100)+'%</div><h2>'+label+'</h2><p class="muted">Dit is alleen je startpunt. Je echte niveau wordt tijdens het oefenen steeds nauwkeuriger bepaald.</p><button class="btn primary" id="start-after-placement">Start je eerste sessie →</button></div></div>';
 document.getElementById("start-after-placement").addEventListener("click",startSession);
}
function takeDifficultyTarget(){try{const key="polyvo-next-difficulty:"+state.storageKey,raw=localStorage.getItem(key);localStorage.removeItem(key);const value=JSON.parse(raw||"null"),target=Number(value&&typeof value==="object"?value.target:value);state.nextDifficultyDirection=Number(value&&typeof value==="object"?value.direction:0)||0;return [1,2,3].includes(target)?target:null}catch(_){state.nextDifficultyDirection=0;return null}}
function rateNextSession(rating){const average=state.session.reduce((sum,item)=>sum+Number(item.difficulty||1),0)/Math.max(1,state.session.length),base=Math.max(1,Math.min(3,Math.round(average))),offset=rating==="hard"?-1:rating==="easy"?1:0,target=Math.max(1,Math.min(3,base+offset));try{localStorage.setItem("polyvo-next-difficulty:"+state.storageKey,JSON.stringify({target,direction:offset}))}catch(_){}document.querySelectorAll("[data-level-rating]").forEach(button=>{const selected=button.dataset.levelRating===rating;button.className="btn "+(selected?"primary":"secondary");button.setAttribute("aria-pressed",String(selected))});const note=document.getElementById("level-rating-note");if(note)note.textContent="Bedankt. Je volgende sessie richt zich vooral op niveau "+(target===1?"Basis":target===2?"Op weg":"Uitdaging")+"."}
function startSession(){state.sessionMode="mixed";state.sessionTopic=null;const target=takeDifficultyTarget();state.session=selectItems(state.content.items,10,false,target);state.nextDifficultyDirection=0;beginSession()}
function startWordMode(){state.sessionMode="word";state.sessionTopic=null;const target=takeDifficultyTarget();state.session=selectWordItems(10,target);state.nextDifficultyDirection=0;beginSession()}
function questionFingerprint(item){const clean=value=>String(value||"").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").replace(/[’\']/g,"").replace(/\s+/g," ");return JSON.stringify([item.topic,item.type,clean(item.prompt),clean(item.answer),[...(item.accepted||[])].map(clean).sort(),[...(item.options||[])].map(clean).sort()])}
function recentQuestionIds(){try{const history=JSON.parse(localStorage.getItem("polyvo-session-history:"+state.storageKey)||"[]"),byId=new Map(state.content.items.map(item=>[item.id,questionFingerprint(item)]));return new Set((Array.isArray(history)?history.slice(0,2).flat():[]).map(entry=>byId.get(entry)||String(entry)))}catch(_){return new Set()}}
function rememberSessionQuestions(session){try{const key="polyvo-session-history:"+state.storageKey,history=JSON.parse(localStorage.getItem(key)||"[]");history.unshift(session.map(questionFingerprint));localStorage.setItem(key,JSON.stringify(history.slice(0,3)))}catch(_){}}
function selectWordItems(n,targetDifficulty=null){const recent=recentQuestionIds(),words=state.content.items.filter(i=>i.type==="word"&&!recent.has(questionFingerprint(i)));return [...words].sort((a,b)=>{const da=Number(a.difficulty||1),db=Number(b.difficulty||1);if(targetDifficulty){const delta=Math.abs(da-targetDifficulty)-Math.abs(db-targetDifficulty);if(delta)return delta}if(state.nextDifficultyDirection<0&&da===db){const easierA=Number(itemState(a.id).mastery||0)*2+Number(itemState(a.id).attempts||0)*.01,easierB=Number(itemState(b.id).mastery||0)*2+Number(itemState(b.id).attempts||0)*.01;if(easierA!==easierB)return easierB-easierA}return wordScore(b)-wordScore(a)}).slice(0,n)}
function wordScore(item){const s=itemState(item.id),m=Number(s.mastery||0),due=s.nextReviewAt&&new Date(s.nextReviewAt)<=new Date(),fresh=!s.attempts,recentWrong=s.lastResult===false;return (1-m)*2.4+(due?2:0)+(recentWrong?1.5:0)+(fresh?.25:0)}

function startTopic(id){state.sessionMode="topic";state.sessionTopic=id;const target=takeDifficultyTarget();state.session=selectItems(state.content.items.filter(i=>i.topic===id),8,true,target);state.nextDifficultyDirection=0;beginSession()}
function startIdioms(){state.sessionMode="topic";state.sessionTopic="idioms-sayings";const target=takeDifficultyTarget();state.session=selectItems(state.content.items.filter(i=>i.topic==="idioms-sayings"),10,true,target);state.nextDifficultyDirection=0;beginSession()}
function shuffleSession(items){const shuffled=[...items];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}return shuffled}
function beginSession(){state.session=shuffleSession(state.session);rememberSessionQuestions(state.session);state.index=0;state.answered=false;state.sessionStartedAt=Date.now();state.sessionCorrect=0;renderQuestion()}
function selectItems(items,n,topicOnly=false,targetDifficulty=null){
 const recent=recentQuestionIds(),freshItems=items.filter(i=>!recent.has(questionFingerprint(i)));
 const candidates=freshItems.length?freshItems:items;
 const pool0=candidates.filter(i=>difficultyUnlocked(i)||(targetDifficulty&&Number(i.difficulty||1)===targetDifficulty));
 const easyPool=candidates.filter(i=>Number(i.difficulty||1)===1);
 const pool=pool0.length?pool0:(easyPool.length?easyPool:candidates);
 const scored=[...pool].sort((a,b)=>{const da=Number(a.difficulty||1),db=Number(b.difficulty||1);if(targetDifficulty){const delta=Math.abs(da-targetDifficulty)-Math.abs(db-targetDifficulty);if(delta)return delta}if(state.nextDifficultyDirection<0&&da===db){const easeA=Number(itemState(a.id).mastery||0)*2+(a.type==="mcq"?.2:0),easeB=Number(itemState(b.id).mastery||0)*2+(b.type==="mcq"?.2:0);if(easeA!==easeB)return easeB-easeA}return score(b)-score(a)});
 const chosen=[],topicCounts={},typeCounts={},difficultyCounts={};
 for(const item of scored){
  if(chosen.length>=n)break;
  const tc=topicCounts[item.topic]||0,ty=item.type,d=Number(item.difficulty||1),dc=difficultyCounts[d]||0;
  if(!topicOnly&&tc>=3)continue;
  if(typeCounts[ty]>=7)continue;
  if(d===3&&dc>=(targetDifficulty===3?7:2))continue;
  chosen.push(item);topicCounts[item.topic]=tc+1;typeCounts[ty]=(typeCounts[ty]||0)+1;difficultyCounts[d]=dc+1;
 }
 for(const item of scored){if(chosen.length>=n)break;if(!chosen.some(x=>x.id===item.id))chosen.push(item)}
 return chosen;
}
function score(item){
 const s=itemState(item.id),m=Number(s.mastery||0),due=s.nextReviewAt&&new Date(s.nextReviewAt)<=new Date(),fresh=!s.attempts,recentWrong=s.lastResult===false;
 return (1-m)*1.9+(due?1.7:0)+(recentWrong?1.25:0)+(fresh?.35:0)+Number(item.difficulty||1)*.12-Math.min((s.streak||0)*.06,.3);
}
function normalize(s){return String(s||"").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").replace(/[’\']/g,"").replace(/[.!?,;:]/g,"").replace(/\s+/g," ")}
function oneTypoApart(a,b){if(Math.min(a.length,b.length)<6||Math.abs(a.length-b.length)>1)return false;let i=0,j=0,edits=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++edits>1)return false;if(a.length===b.length){if(a[i+1]===b[j]&&a[i]===b[j+1]){i+=2;j+=2;continue}i++;j++}else if(a.length>b.length)i++;else j++}return edits+(i<a.length||j<b.length?1:0)<=1}
function matchesAnswer(value,accepted){const input=normalize(value),compactInput=input.replace(/\s+/g,"");return accepted.some(answer=>{const target=normalize(answer),compactTarget=target.replace(/\s+/g,"");return input===target||compactInput===compactTarget||oneTypoApart(compactInput,compactTarget)})}
function renderQuestion(){
 if(state.index>=state.session.length)return finishSession();
 const q=state.session[state.index],total=state.session.length,diff=Number(q.difficulty||1),diffLabel=diff===1?"Basis":diff===2?"Op weg":"Uitdaging";
 let input;
 if(q.type==="typed"||q.type==="word"){const placeholder=q.topic==="idioms-sayings"?"Typ de Nederlandse betekenis...":"Typ het Engelse woord...";input='<div class="typed-wrap"><input id="typed" autocomplete="off" placeholder="'+placeholder+'"><button class="btn primary" id="submit-typed">Controleer →</button></div>'}
 else input='<div class="answers">'+q.options.map((o,i)=>'<button class="answer" type="button" data-answer-index="'+i+'">'+o+'</button>').join("")+'</div>';
 document.getElementById("app").innerHTML='<div class="question-head"><button class="btn secondary" id="home-btn">← Home</button><div class="session-meta"><span>'+((state.index+1)+" / "+total)+'</span><span class="tag">'+topic(q.topic).name+'</span></div></div><div class="progress session-progress"><span style="width:'+(state.index/total*100)+'%"></span></div><div class="card question-card"><div class="question-instruction"><span class="small">'+(q.type==="word"?"Vertaal het woord":q.type==="typed"?"Typ het antwoord":"Kies het beste antwoord")+'</span><span class="difficulty difficulty-'+diff+'">'+diffLabel+'</span></div><div class="question">'+q.prompt+'</div>'+input+'<div id="feedback"></div></div>';
 document.getElementById("home-btn").addEventListener("click",renderHome);
 if(q.type==="typed"||q.type==="word"){const el=document.getElementById("typed");document.getElementById("submit-typed").addEventListener("click",checkTyped);el.addEventListener("keydown",e=>{if(e.key==="Enter")checkTyped()});el.focus()}
 else document.querySelectorAll("[data-answer-index]").forEach(btn=>btn.addEventListener("click",()=>answer(q.options[Number(btn.dataset.answerIndex)],btn)));
}
function checkTyped(){const el=document.getElementById("typed");if(el.value.trim())answer(el.value,el)}
function answer(value,clicked){
 if(state.answered)return;
 const q=state.session[state.index],accepted=q.accepted?.length?q.accepted:[q.answer],correct=matchesAnswer(value,accepted);
 state.answered=true;if(correct)state.sessionCorrect++;
 const now=new Date();queueAnswer(q.id,correct,now);
 document.getElementById("typed")?.setAttribute("disabled","true");document.getElementById("submit-typed")?.setAttribute("disabled","true");
 document.querySelectorAll(".answer").forEach(b=>{if(accepted.map(normalize).includes(normalize(b.textContent)))b.classList.add("correct");if(!correct&&normalize(b.textContent)===normalize(value))b.classList.add("wrong")});
 if(clicked&&correct)clicked.classList.add("correct");if(clicked&&!correct)clicked.classList.add("wrong");
 const text=accepted.join(" / ");
 const isWord=q.type==="typed"||q.type==="word";
 const alternatives=[...new Map([q.answer,...accepted].map(value=>[normalize(value),value])).values()];
 const bilingual=isWord?'<div class="solution-lines"><div><span class="solution-label">Nederlands</span><strong>'+escapeHtml(q.translationNl||"—")+'</strong></div><div><span class="solution-label">English</span><strong>'+escapeHtml(q.solutionEnglish||text)+'</strong><button class="btn secondary pronunciation-btn" type="button" id="speak-answer">🔊 Luister naar uitspraak</button></div>'+(alternatives.length>1?'<div><span class="solution-label">Andere goede antwoorden</span><strong>'+escapeHtml(alternatives.join(" · "))+'</strong></div>':"")+'</div>':"";

 const why='<div class="why"><span class="why-label">Waarom?</span><span>'+escapeHtml(q.explanation||"Dit antwoord past bij de grammaticaregel of woordkeuze van deze vraag.")+'</span></div>';
 const expected=accepted.length>1?"Een goed antwoord is: ":"Het antwoord dat we zoeken is: ";
 document.getElementById("feedback").innerHTML='<div class="feedback '+(correct?"good":"bad")+'"><strong>'+(correct?"Goed!":"Nog niet.")+'</strong><p>'+(correct?"Precies.":expected+"<b>"+escapeHtml(text)+"</b>.")+'</p>'+bilingual+why+'</div><button class="btn primary next-btn" id="next-btn">'+(state.index+1===state.session.length?"Bekijk resultaat":"Volgende →")+'</button>';
 document.getElementById("speak-answer")?.addEventListener("click",()=>speakEnglish(q.solutionEnglish||text));
 document.getElementById("next-btn").addEventListener("click",nextQuestion);
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]))}
function speakEnglish(text){
 if(!("speechSynthesis" in window)||!("SpeechSynthesisUtterance" in window))return;
 window.speechSynthesis.cancel();
 const utterance=new SpeechSynthesisUtterance(String(text||""));
 utterance.lang="en-GB";utterance.rate=.86;
 const voices=window.speechSynthesis.getVoices(),voice=voices.find(v=>/^en-GB/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang));
 if(voice)utterance.voice=voice;
 window.speechSynthesis.speak(utterance);
}
function nextQuestion(){state.index++;state.answered=false;renderQuestion()}
function finishSession(){
 const total=state.session.length,correct=state.sessionCorrect,minutes=Math.max(1,Math.round((Date.now()-state.sessionStartedAt)/60000));
 const session={date:todayKey(),total,correct,minutes,at:new Date().toISOString()};state.db=PolyvoProgress.addEvent(state.db,"session",{session},PolyvoProgress.makeId("session"),session.at);save();if(state.user&&!state.offline)syncProgress();updateStreak();
 const accuracy=Math.round(correct/Math.max(1,total)*100),weak=state.session.filter(i=>Number(itemState(i.id).mastery||0)<.5).length;
 document.getElementById("app").innerHTML='<div class="center result-page"><span class="tag">Sessie afgerond</span><h1>Goed bezig.</h1><div class="result-grid"><div class="card"><span>Goed</span><div class="big">'+accuracy+'%</div><small>'+correct+' van '+total+' vragen</small></div><div class="card"><span>Te herhalen</span><div class="big">'+weak+'</div><small>vragen blijven actief</small></div><div class="card"><span>Streak</span><div class="big">'+Math.max(1,state.streak)+'</div><small>dagen achter elkaar</small></div></div><div class="card result-card"><p class="muted">Sloot het niveau aan bij wat je verwachtte?</p><div class="level-rating-options" role="group" aria-label="Beoordeel het niveau"><button class="btn secondary" data-level-rating="hard" aria-pressed="false">Te moeilijk</button><button class="btn secondary" data-level-rating="right" aria-pressed="false">Precies goed</button><button class="btn secondary" data-level-rating="easy" aria-pressed="false">Te makkelijk</button></div><p class="small" id="level-rating-note">Je keuze stuurt het niveau van je volgende sessie.</p><div class="result-actions"><button class="btn primary" id="again">Nog een sessie</button><button class="btn secondary" id="dashboard">Naar dashboard</button></div></div></div>';
 document.querySelectorAll("[data-level-rating]").forEach(button=>button.addEventListener("click",()=>rateNextSession(button.dataset.levelRating)));document.getElementById("again").addEventListener("click",()=>{if(state.sessionMode==="word")startWordMode();else if(state.sessionMode==="topic")startTopic(state.sessionTopic);else startSession()});document.getElementById("dashboard").addEventListener("click",renderHome);
}
load();