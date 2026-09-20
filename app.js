const state={content:null,db:null,session:[],index:0,answered:false,placement:[],placementIndex:0,placementScore:0,sessionStartedAt:null,sessionCorrect:0};
async function load(){
 state.content=await fetch("/data/content.json").then(r=>r.json());
 state.db=JSON.parse(localStorage.getItem("english-db")||JSON.stringify({version:2,profile:{name:"",placementScore:null,placementAt:null},states:{},sessions:[]}));
 state.db.profile=state.db.profile||{name:"",placementScore:null,placementAt:null};
 state.db.states=state.db.states||{};state.db.sessions=state.db.sessions||[];
 updateStreak();
 renderHome();
}
function save(){localStorage.setItem("english-db",JSON.stringify(state.db))}
function itemState(id){return state.db.states[id]||{}}
function topic(id){return state.content.topics.find(t=>t.id===id)||{name:id,description:""}}
function avgTopic(id){const a=state.content.items.filter(i=>i.topic===id);return a.length?a.reduce((s,i)=>s+Number(itemState(i.id).mastery||0),0)/a.length:0}
function overall(){return state.content.items.length?state.content.items.reduce((s,i)=>s+Number(itemState(i.id).mastery||0),0)/state.content.items.length:0}
function todayKey(d=new Date()){return d.toISOString().slice(0,10)}
function updateStreak(){
 const dates=[...new Set(state.db.sessions.map(s=>s.date).filter(Boolean))].sort().reverse();
 let streak=0,cur=new Date();
 for(const d of dates){const k=todayKey(cur);if(d===k){streak++;cur.setDate(cur.getDate()-1)}else if(streak===0){cur.setDate(cur.getDate()-1);if(d===todayKey(cur)){streak++;cur.setDate(cur.getDate()-1)}else break}else break}
 state.streak=streak;
 const el=document.getElementById("streak");if(el)el.textContent="🔥 "+streak+" "+(streak===1?"dag":"dagen");
}
function todayStats(){const k=todayKey();const s=state.db.sessions.filter(x=>x.date===k);return{sessions:s.length,questions:s.reduce((n,x)=>n+x.total,0),correct:s.reduce((n,x)=>n+x.correct,0),minutes:s.reduce((n,x)=>n+x.minutes,0)}}
function renderHome(){
 const first=state.db.profile.placementScore===null,stats=todayStats(),pct=Math.round(overall()*100);
 const due=state.content.items.filter(i=>{const s=itemState(i.id);return !!s.nextReviewAt&&new Date(s.nextReviewAt)<=new Date()}).length; const fresh=state.content.items.filter(i=>!itemState(i.id).attempts).length;
 document.getElementById("app").innerHTML=`<section class="hero"><div class="eyebrow">${first?"EERSTE KEER":"VANDAAG"}</div><h1>${first?"Eerst even kijken wat je al kunt.":"Klaar voor een korte sessie?"}</h1><p>${first?"Een korte niveautest zorgt ervoor dat de app daarna beter aansluit op jouw niveau.":"Je hoeft niet zelf te kiezen wat je moet oefenen. De app kiest vragen op basis van wat je nog moet leren en wat aan herhaling toe is."}</p><div class="hero-actions"><button class="btn primary" id="main-action">${first?"Doe niveautest →":"Start oefening →"}</button>${first?"":'<button class="btn secondary" id="placement-again">Niveautest opnieuw</button>'}</div></section>
 <section class="stats"><div class="stat card"><span>Vandaag</span><strong>${stats.questions}</strong><small>vragen</small></div><div class="stat card"><span>Goed</span><strong>${stats.questions?Math.round(stats.correct/stats.questions*100):0}%</strong><small>vandaag</small></div><div class="stat card"><span>Streak</span><strong>${state.streak||0}</strong><small>${(state.streak||0)===1?"dag":"dagen"}</small></div><div class="stat card"><span>Mastery</span><strong>${pct}%</strong><small>totaal</small></div></section>
 <div class="section-title"><div><h2>Jouw onderdelen</h2><p>${due} vragen zijn klaar voor herhaling${fresh?` · ${fresh} nieuwe vragen beschikbaar`:""}.</p></div></div>
 <div class="grid">${state.content.topics.map(t=>{const p=Math.round(avgTopic(t.id)*100);return `<article class="card topic" data-topic="${t.id}"><div class="row"><div><h3>${t.name}</h3><div class="muted">${t.description}</div></div><span class="percent">${p}%</span></div><div class="progress"><span style="width:${p}%"></span></div></article>`}).join("")}</div>
 <section class="card next-card"><div><span class="tag">Slimme herhaling</span><h2>De app kiest wat je nodig hebt.</h2><p class="muted">Foute antwoorden komen sneller terug. Wat je goed beheerst, schuift automatisch verder vooruit.</p></div><div class="next-icon">↻</div></section>`;
 document.getElementById("main-action").addEventListener("click",first?startPlacement:startSession);
 document.getElementById("placement-again")?.addEventListener("click",startPlacement);
 document.querySelectorAll("[data-topic]").forEach(el=>el.addEventListener("click",()=>startTopic(el.dataset.topic)));
 updateStreak();
}
function startPlacement(){state.placement=[...state.content.placement];state.placementIndex=0;state.placementScore=0;state.answered=false;renderPlacement()}
function renderPlacement(){
 if(state.placementIndex>=state.placement.length)return finishPlacement();
 const q=state.placement[state.placementIndex],total=state.placement.length;
 document.getElementById("app").innerHTML=`<div class="question-head"><button class="btn secondary" id="home-btn">← Home</button><div class="row"><span class="small">Niveautest · ${state.placementIndex+1}/${total}</span><span class="tag">Geen invloed op je mastery</span></div></div><div class="progress"><span style="width:${state.placementIndex/total*100}%"></span></div><div class="card question-card"><div class="small">Kies het antwoord dat jij denkt dat goed is</div><div class="question">${q.prompt}</div><div class="answers">${q.options.map((o,i)=>`<button class="answer" type="button" data-placement="${i}">${o}</button>`).join("")}</div><div id="placement-feedback"></div></div>`;
 document.getElementById("home-btn").addEventListener("click",renderHome);
 document.querySelectorAll("[data-placement]").forEach(btn=>btn.addEventListener("click",()=>answerPlacement(q,btn)));
}
function answerPlacement(q,btn){
 if(state.answered)return;state.answered=true;
 const correct=normalize(btn.textContent)===normalize(q.answer);if(correct)state.placementScore++;
 btn.classList.add(correct?"correct":"wrong");
 document.querySelectorAll("[data-placement]").forEach(b=>{if(normalize(b.textContent)===normalize(q.answer))b.classList.add("correct");b.disabled=true});
 document.getElementById("placement-feedback").innerHTML=`<div class="feedback ${correct?"good":"bad"}"><strong>${correct?"Goed!":"Nog niet."}</strong><p>${q.explanation}</p></div><button class="btn primary" id="placement-next">${state.placementIndex+1===state.placement.length?"Bekijk resultaat":"Volgende →"}</button>`;
 document.getElementById("placement-next").addEventListener("click",()=>{state.placementIndex++;state.answered=false;renderPlacement()});
}
function finishPlacement(){
 const score=state.placementScore/state.placement.length;state.db.profile.placementScore=score;state.db.profile.placementAt=new Date().toISOString();save();
 const label=score<.4?"Starter":score<.7?"Beginner":"Beginner+";
 document.getElementById("app").innerHTML=`<div class="center result-page"><span class="tag">Niveautest klaar</span><h1>Je startniveau</h1><div class="card result-card"><div class="big">${Math.round(score*100)}%</div><h2>${label}</h2><p class="muted">Dit is alleen je startpunt. Je echte niveau wordt tijdens het oefenen steeds nauwkeuriger bepaald.</p><button class="btn primary" id="start-after-placement">Start je eerste sessie →</button></div></div>`;
 document.getElementById("start-after-placement").addEventListener("click",startSession);
}
function startSession(){state.session=selectItems(state.content.items,10);beginSession()}
function startTopic(id){state.session=selectItems(state.content.items.filter(i=>i.topic===id),8);beginSession()}
function beginSession(){state.index=0;state.answered=false;state.sessionStartedAt=Date.now();state.sessionCorrect=0;renderQuestion()}
function selectItems(items,n){
 const scored=[...items].sort((a,b)=>score(b)-score(a));
 const chosen=[],topicCounts={},typeCounts={};
 // Keep sessions varied: max 3 questions per topic and avoid a wall of identical question types.
 for(const item of scored){
   if(chosen.length>=n)break;
   const tc=topicCounts[item.topic]||0,ty=item.type;
   if(tc>=3)continue;
   if(typeCounts[ty]>=7)continue;
   chosen.push(item);topicCounts[item.topic]=tc+1;typeCounts[ty]=(typeCounts[ty]||0)+1;
 }
 // If constraints left a gap, fill it with the next strongest items.
 for(const item of scored){
   if(chosen.length>=n)break;
   if(!chosen.some(x=>x.id===item.id))chosen.push(item);
 }
 return chosen;
}
function score(item){
 const s=itemState(item.id),m=Number(s.mastery||0),attempts=Number(s.attempts||0);
 const due=s.nextReviewAt&&new Date(s.nextReviewAt)<=new Date();
 const fresh=attempts===0,recentWrong=s.lastResult===false;
 return (1-m)*1.7+(due?1.5:0)+(recentWrong?1.2:0)+(fresh?0.4:0)+(Number(item.difficulty||1)-1)*.08-Math.min((s.streak||0)*.05,.25);
}
function normalize(s){return String(s||"").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").replace(/[.!?,]+$/g,"").replace(/\s+/g," ")}
function renderQuestion(){
 if(state.index>=state.session.length)return finishSession();
 const q=state.session[state.index],total=state.session.length;
 const input=q.type==="typed"?`<div class="typed-wrap"><input id="typed" autocomplete="off" placeholder="Typ je antwoord..."><button class="btn primary" id="submit-typed">Controleer →</button></div>`:`<div class="answers">${q.options.map((o,i)=>`<button class="answer" type="button" data-answer-index="${i}">${o}</button>`).join("")}</div>`;
 document.getElementById("app").innerHTML=`<div class="question-head"><button class="btn secondary" id="home-btn">← Home</button><div class="session-meta"><span>${state.index+1} / ${total}</span><span class="tag">${topic(q.topic).name}</span></div></div><div class="progress session-progress"><span style="width:${state.index/total*100}%"></span></div><div class="card question-card"><div class="small">${q.type==="typed"?"Typ het ontbrekende woord":"Kies het ontbrekende woord"}</div><div class="question">${q.prompt}</div>${input}<div id="feedback"></div></div>`;
 document.getElementById("home-btn").addEventListener("click",renderHome);
 if(q.type==="typed"){const inputEl=document.getElementById("typed");document.getElementById("submit-typed").addEventListener("click",checkTyped);inputEl.addEventListener("keydown",e=>{if(e.key==="Enter")checkTyped()});inputEl.focus()}
 else document.querySelectorAll("[data-answer-index]").forEach(btn=>btn.addEventListener("click",()=>answer(q.options[Number(btn.dataset.answerIndex)],btn)));
}
function checkTyped(){const el=document.getElementById("typed");if(!el.value.trim())return;answer(el.value,el)}
function answer(value,clicked){
 if(state.answered)return;
 const q=state.session[state.index],accepted=q.accepted?.length?q.accepted:[q.answer],correct=accepted.map(normalize).includes(normalize(value));
 state.answered=true;if(correct)state.sessionCorrect++;
 const old=itemState(q.id),oldMastery=Number(old.mastery||0),mastery=Math.max(0,Math.min(1,oldMastery+.35*((correct?1:0)-oldMastery)));
 const now=new Date(),next=new Date(now);let interval=Number(old.intervalDays||0);
 if(correct){interval=interval?Math.min(45,interval*2):1;next.setDate(next.getDate()+interval)}else{interval=0;next.setHours(next.getHours()+8)}
 state.db.states[q.id]={attempts:Number(old.attempts||0)+1,correct:Number(old.correct||0)+(correct?1:0),mastery,streak:correct?Number(old.streak||0)+1:0,intervalDays:interval,nextReviewAt:next.toISOString(),lastSeenAt:now.toISOString(),lastResult:correct};
 save();
 document.getElementById("typed")?.setAttribute("disabled","true");document.getElementById("submit-typed")?.setAttribute("disabled","true");
 document.querySelectorAll(".answer").forEach(b=>{if(accepted.map(normalize).includes(normalize(b.textContent)))b.classList.add("correct");if(!correct&&normalize(b.textContent)===normalize(value))b.classList.add("wrong")});
 if(clicked&&correct)clicked.classList.add("correct");if(clicked&&!correct)clicked.classList.add("wrong");
 const text=accepted.join(" / ");
 document.getElementById("feedback").innerHTML=`<div class="feedback ${correct?"good":"bad"}"><strong>${correct?"Goed!":"Nog niet."}</strong><p>${correct?"Precies.":"Het antwoord dat we zoeken is: <b>"+text+"</b>."}</p><span>${q.explanation}</span></div><button class="btn primary next-btn" id="next-btn">${state.index+1===state.session.length?"Bekijk resultaat":"Volgende →"}</button>`;
 document.getElementById("next-btn").addEventListener("click",nextQuestion);
}
function nextQuestion(){state.index++;state.answered=false;renderQuestion()}
function finishSession(){
 const total=state.session.length,correct=state.sessionCorrect,minutes=Math.max(1,Math.round((Date.now()-state.sessionStartedAt)/60000));
 state.db.sessions.push({date:todayKey(),total,correct,minutes,at:new Date().toISOString()});save();updateStreak();
 const accuracy=Math.round(correct/Math.max(1,total)*100);
 const weak=state.session.filter(i=>Number(itemState(i.id).mastery||0)<.5).length;
 document.getElementById("app").innerHTML=`<div class="center result-page"><span class="tag">Sessie afgerond</span><h1>Goed bezig.</h1><div class="result-grid"><div class="card"><span>Goed</span><div class="big">${accuracy}%</div><small>${correct} van ${total} vragen</small></div><div class="card"><span>Te herhalen</span><div class="big">${weak}</div><small>vragen blijven actief</small></div><div class="card"><span>Streak</span><div class="big">${state.streak||1}</div><small>${(state.streak||1)===1?"dag":"dagen"} achter elkaar</small></div></div><div class="card result-card"><p class="muted">De volgende sessie wordt aangepast aan wat je vandaag goed en fout deed.</p><button class="btn primary" id="again">Nog een sessie</button><button class="btn secondary" id="dashboard">Naar dashboard</button></div></div>`;
 document.getElementById("again").addEventListener("click",startSession);document.getElementById("dashboard").addEventListener("click",renderHome);
}
load();