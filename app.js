const state={content:null,db:null,session:[],index:0,answered:false,placement:[],placementIndex:0,placementScore:0,sessionStartedAt:null,sessionCorrect:0,streak:0};

async function load(){
 try{
  const response=await fetch("/data/content.json");
  if(!response.ok)throw new Error("content");
  state.content=await response.json();
  state.db=JSON.parse(localStorage.getItem("english-db")||'{"version":2,"profile":{"name":"","placementScore":null,"placementAt":null},"states":{},"sessions":[]}');
  state.db.profile=state.db.profile||{name:"",placementScore:null,placementAt:null};
  state.db.states=state.db.states||{};
  state.db.sessions=state.db.sessions||[];
  updateStreak();
  renderHome();
 }catch(error){
  document.getElementById("app").innerHTML='<div class="card center" style="margin-top:40px"><h2>De app kon niet laden.</h2><p class="muted">Ververs de pagina. Als dit blijft gebeuren, is er iets mis met de inhoudsdata.</p><button class="btn primary" onclick="location.reload()">Opnieuw proberen</button></div>';
  console.error(error);
 }
}
function save(){localStorage.setItem("english-db",JSON.stringify(state.db))}
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
 '<h1>'+(first?"Small steps.<br><em>A bigger you.</em>":"Goedemorgen.<br><em>Klaar voor je volgende stap?</em>")+'</h1>'+
 '<p>'+(first?"Een korte starttest brengt je op het juiste beginpunt. Daarna groeit de moeilijkheid mee met wat je laat zien.":"Je hoeft niet te kiezen wat je moet oefenen. ENGELS kijkt naar je fouten, beheersing en herhaling en bouwt van daaruit verder.")+'</p>'+
 '<div class="hero-actions"><button class="btn primary" id="main-action">'+(first?"Start niveautest →":"Start een sessie →")+'</button>'+(first?"":'<button class="btn secondary" id="placement-again">Niveautest opnieuw</button>')+'</div></div>'+
 '<div class="hero-orb"><div class="orb-sun"></div><div class="orb-ring"></div><span>'+level.name.split(" · ")[0]+'</span></div></section>'+
 '<section class="level-card card"><div><div class="small">JOUW LEERREIS</div><h2>'+level.name+'</h2><p class="muted">Je groeit automatisch door naar moeilijkere vragen zodra je de basis voldoende beheerst.</p></div>'+
 '<div class="level-progress"><div class="level-line"><span style="width:'+Math.min(100,pct)+'%"></span></div><div class="level-foot"><span>'+pct+'% beheerst</span><span>Volgende: '+level.next+'</span></div></div></section>'+
 '<section class="stats"><div class="stat card"><span>Vandaag</span><strong>'+stats.questions+'</strong><small>vragen</small></div>'+
 '<div class="stat card"><span>Goed</span><strong>'+(stats.questions?Math.round(stats.correct/stats.questions*100):0)+'%</strong><small>vandaag</small></div>'+
 '<div class="stat card"><span>Streak</span><strong>'+state.streak+'</strong><small>'+(state.streak===1?"dag":"dagen")+'</small></div>'+
 '<div class="stat card"><span>Herhaling</span><strong>'+due+'</strong><small>klaar voor vandaag</small></div></section>'+
 '<div class="section-title"><div><div class="eyebrow">GA VERDER</div><h2>Aanbevolen voor jou</h2><p>'+(weak?"We pakken eerst <b>"+recommended.name+"</b> weer op.":"Begin met een korte sessie en ontdek je niveau.")+'</p></div></div>'+
 '<section class="card recommendation"><div class="rec-icon">↗</div><div class="rec-copy"><span class="tag">Slim gekozen</span><h3>'+recommended.name+'</h3><p class="muted">'+recommended.description+'</p></div><button class="btn primary" id="recommended">Oefen →</button></section>'+
 '<div class="section-title section-spaced"><div><div class="eyebrow">JOUW ONDERDELEN</div><h2>Skills die met je meegroeien</h2><p>'+due+' vragen staan klaar voor herhaling'+(fresh?" · "+fresh+" nieuwe vragen beschikbaar":"")+'.</p></div></div>'+
 '<div class="grid">'+topicsHtml+'</div>'+
 '<section class="card next-card"><div><span class="tag">Adaptive learning</span><h2>De app wordt moeilijker als jij beter wordt.</h2><p class="muted">Eerst de basis. Daarna meer context, langere zinnen en minder hulp. Je antwoorden laten zien wanneer je klaar bent voor de volgende stap.</p></div><div class="next-icon">↗</div></section>';
 document.getElementById("main-action").addEventListener("click",first?startPlacement:startSession);
 document.getElementById("placement-again")?.addEventListener("click",startPlacement);
 document.getElementById("recommended").addEventListener("click",()=>startTopic(recommended.id));
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
 state.db.profile.placementScore=score;state.db.profile.placementAt=new Date().toISOString();save();
 const label=score<.4?"Starter":score<.7?"Beginner":"Beginner+";
 document.getElementById("app").innerHTML='<div class="center result-page"><span class="tag">Niveautest klaar</span><h1>Je startniveau</h1><div class="card result-card"><div class="big">'+Math.round(score*100)+'%</div><h2>'+label+'</h2><p class="muted">Dit is alleen je startpunt. Je echte niveau wordt tijdens het oefenen steeds nauwkeuriger bepaald.</p><button class="btn primary" id="start-after-placement">Start je eerste sessie →</button></div></div>';
 document.getElementById("start-after-placement").addEventListener("click",startSession);
}
function startSession(){state.session=selectItems(state.content.items,10);beginSession()}
function startTopic(id){state.session=selectItems(state.content.items.filter(i=>i.topic===id),8,true);beginSession()}
function beginSession(){state.index=0;state.answered=false;state.sessionStartedAt=Date.now();state.sessionCorrect=0;renderQuestion()}
function selectItems(items,n,topicOnly=false){
 const pool0=items.filter(i=>difficultyUnlocked(i));
 const pool=pool0.length?pool0:items.filter(i=>Number(i.difficulty||1)===1);
 const scored=[...pool].sort((a,b)=>score(b)-score(a));
 const chosen=[],topicCounts={},typeCounts={},difficultyCounts={};
 for(const item of scored){
  if(chosen.length>=n)break;
  const tc=topicCounts[item.topic]||0,ty=item.type,d=Number(item.difficulty||1),dc=difficultyCounts[d]||0;
  if(!topicOnly&&tc>=3)continue;
  if(typeCounts[ty]>=7)continue;
  if(d===3&&dc>=2)continue;
  chosen.push(item);topicCounts[item.topic]=tc+1;typeCounts[ty]=(typeCounts[ty]||0)+1;difficultyCounts[d]=dc+1;
 }
 for(const item of scored){if(chosen.length>=n)break;if(!chosen.some(x=>x.id===item.id))chosen.push(item)}
 return chosen;
}
function score(item){
 const s=itemState(item.id),m=Number(s.mastery||0),due=s.nextReviewAt&&new Date(s.nextReviewAt)<=new Date(),fresh=!s.attempts,recentWrong=s.lastResult===false;
 return (1-m)*1.9+(due?1.7:0)+(recentWrong?1.25:0)+(fresh?.35:0)+Number(item.difficulty||1)*.12-Math.min((s.streak||0)*.06,.3);
}
function normalize(s){return String(s||"").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").replace(/[.!?,]+$/g,"").replace(/\s+/g," ")}
function renderQuestion(){
 if(state.index>=state.session.length)return finishSession();
 const q=state.session[state.index],total=state.session.length,diff=Number(q.difficulty||1),diffLabel=diff===1?"Basis":diff===2?"Op weg":"Uitdaging";
 let input;
 if(q.type==="typed")input='<div class="typed-wrap"><input id="typed" autocomplete="off" placeholder="Typ je antwoord..."><button class="btn primary" id="submit-typed">Controleer →</button></div>';
 else input='<div class="answers">'+q.options.map((o,i)=>'<button class="answer" type="button" data-answer-index="'+i+'">'+o+'</button>').join("")+'</div>';
 document.getElementById("app").innerHTML='<div class="question-head"><button class="btn secondary" id="home-btn">← Home</button><div class="session-meta"><span>'+((state.index+1)+" / "+total)+'</span><span class="tag">'+topic(q.topic).name+'</span></div></div><div class="progress session-progress"><span style="width:'+(state.index/total*100)+'%"></span></div><div class="card question-card"><div class="question-instruction"><span class="small">'+(q.type==="typed"?"Typ het antwoord":"Kies het beste antwoord")+'</span><span class="difficulty difficulty-'+diff+'">'+diffLabel+'</span></div><div class="question">'+q.prompt+'</div>'+input+'<div id="feedback"></div></div>';
 document.getElementById("home-btn").addEventListener("click",renderHome);
 if(q.type==="typed"){const el=document.getElementById("typed");document.getElementById("submit-typed").addEventListener("click",checkTyped);el.addEventListener("keydown",e=>{if(e.key==="Enter")checkTyped()});el.focus()}
 else document.querySelectorAll("[data-answer-index]").forEach(btn=>btn.addEventListener("click",()=>answer(q.options[Number(btn.dataset.answerIndex)],btn)));
}
function checkTyped(){const el=document.getElementById("typed");if(el.value.trim())answer(el.value,el)}
function answer(value,clicked){
 if(state.answered)return;
 const q=state.session[state.index],accepted=q.accepted?.length?q.accepted:[q.answer],correct=accepted.map(normalize).includes(normalize(value));
 state.answered=true;if(correct)state.sessionCorrect++;
 const old=itemState(q.id),oldMastery=Number(old.mastery||0),mastery=Math.max(0,Math.min(1,oldMastery+.35*((correct?1:0)-oldMastery)));
 const now=new Date(),next=new Date(now);let interval=Number(old.intervalDays||0);
 if(correct){interval=interval?Math.min(45,interval*2):1;next.setDate(next.getDate()+interval)}else{interval=0;next.setHours(next.getHours()+8)}
 state.db.states[q.id]={attempts:Number(old.attempts||0)+1,correct:Number(old.correct||0)+(correct?1:0),mastery,streak:correct?Number(old.streak||0)+1:0,intervalDays:interval,nextReviewAt:next.toISOString(),lastSeenAt:now.toISOString(),lastResult:correct};save();
 document.getElementById("typed")?.setAttribute("disabled","true");document.getElementById("submit-typed")?.setAttribute("disabled","true");
 document.querySelectorAll(".answer").forEach(b=>{if(accepted.map(normalize).includes(normalize(b.textContent)))b.classList.add("correct");if(!correct&&normalize(b.textContent)===normalize(value))b.classList.add("wrong")});
 if(clicked&&correct)clicked.classList.add("correct");if(clicked&&!correct)clicked.classList.add("wrong");
 const text=accepted.join(" / ");
 const bilingual=q.type==="typed"?'<div class="solution-lines"><div><span class="solution-label">Nederlands</span><strong>'+escapeHtml(q.translationNl||"—")+'</strong></div><div><span class="solution-label">English</span><strong>'+escapeHtml(q.solutionEnglish||text)+'</strong></div></div>':"";
 const why='<div class="why"><span class="why-label">Waarom?</span><span>'+escapeHtml(q.explanation||"Dit antwoord past bij de grammaticaregel of woordkeuze van deze vraag.")+'</span></div>';
 document.getElementById("feedback").innerHTML='<div class="feedback '+(correct?"good":"bad")+'"><strong>'+(correct?"Goed!":"Nog niet.")+'</strong><p>'+(correct?"Precies.":"Het antwoord dat we zoeken is: <b>"+escapeHtml(text)+"</b>.")+'</p>'+bilingual+why+'</div><button class="btn primary next-btn" id="next-btn">'+(state.index+1===state.session.length?"Bekijk resultaat":"Volgende →")+'</button>';
 document.getElementById("next-btn").addEventListener("click",nextQuestion);
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]))}
function nextQuestion(){state.index++;state.answered=false;renderQuestion()}
function finishSession(){
 const total=state.session.length,correct=state.sessionCorrect,minutes=Math.max(1,Math.round((Date.now()-state.sessionStartedAt)/60000));
 state.db.sessions.push({date:todayKey(),total,correct,minutes,at:new Date().toISOString()});save();updateStreak();
 const accuracy=Math.round(correct/Math.max(1,total)*100),weak=state.session.filter(i=>Number(itemState(i.id).mastery||0)<.5).length;
 document.getElementById("app").innerHTML='<div class="center result-page"><span class="tag">Sessie afgerond</span><h1>Goed bezig.</h1><div class="result-grid"><div class="card"><span>Goed</span><div class="big">'+accuracy+'%</div><small>'+correct+' van '+total+' vragen</small></div><div class="card"><span>Te herhalen</span><div class="big">'+weak+'</div><small>vragen blijven actief</small></div><div class="card"><span>Streak</span><div class="big">'+Math.max(1,state.streak)+'</div><small>dagen achter elkaar</small></div></div><div class="card result-card"><p class="muted">De volgende sessie wordt aangepast aan wat je vandaag goed en fout deed.</p><button class="btn primary" id="again">Nog een sessie</button><button class="btn secondary" id="dashboard">Naar dashboard</button></div></div>';
 document.getElementById("again").addEventListener("click",startSession);document.getElementById("dashboard").addEventListener("click",renderHome);
}
load();