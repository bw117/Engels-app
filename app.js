const state={content:null,db:null,session:[],index:0,answered:false,placement:[],placementIndex:0,placementScore:0};
async function load(){state.content=await fetch("/data/content.json").then(r=>r.json());state.db=JSON.parse(localStorage.getItem("english-db")||JSON.stringify({version:1,profile:{name:"",placementScore:null},states:{},sessions:[]}));renderHome()}
function save(){localStorage.setItem("english-db",JSON.stringify(state.db))}
function itemState(id){return state.db.states[id]||{}}
function avgTopic(topic){const items=state.content.items.filter(i=>i.topic===topic);return items.length?items.reduce((s,i)=>s+Number(itemState(i.id).mastery||0),0)/items.length:0}
function renderHome(){
 const hasPlacement=state.db.profile.placementScore!==null;
 document.getElementById("app").innerHTML=`<section class="hero"><span class="tag">${hasPlacement?"English practice":"Even kennismaken"}</span><h1>${hasPlacement?"Leer Engels op jouw tempo.":"Eerst even kijken wat je al kunt."}</h1><p>${hasPlacement?"Korte sessies die zich aanpassen aan wat je al kunt — en vooral aan wat nog niet goed genoeg zit.":"Doe eerst een korte niveautest. Daarna passen de oefeningen zich beter aan jouw niveau aan."}</p><button class="btn primary" id="start-session">${hasPlacement?"Start oefening →":"Doe niveautest →"}</button>${hasPlacement?'<button class="btn secondary" id="placement-again" style="margin-left:8px">Niveautest opnieuw</button>':""}</section><div class="grid">${state.content.topics.map(t=>{const p=Math.round(avgTopic(t.id)*100);return `<article class="card topic" data-topic="${t.id}"><div class="row"><h3>${t.name}</h3><span class="small">${p}%</span></div><div class="muted">${t.description}</div><div class="progress"><span style="width:${p}%"></span></div></article>`}).join("")}</div><div class="card" style="margin-top:20px"><div class="row"><div><strong>Je voortgang</strong><div class="muted">Mastery over alle onderdelen.</div></div><div class="big">${Math.round(state.content.items.reduce((s,i)=>s+Number(itemState(i.id).mastery||0),0)/state.content.items.length*100)}%</div></div></div>`;
 document.getElementById("start-session").addEventListener("click",hasPlacement?startSession:startPlacement);
 document.getElementById("placement-again")?.addEventListener("click",startPlacement);
 document.querySelectorAll("[data-topic]").forEach(el=>el.addEventListener("click",()=>startTopic(el.dataset.topic)));
}
function startPlacement(){state.placement=[...state.content.placement];state.placementIndex=0;state.placementScore=0;state.answered=false;renderPlacement()}
function renderPlacement(){
 if(state.placementIndex>=state.placement.length)return finishPlacement();
 const q=state.placement[state.placementIndex],total=state.placement.length;
 document.getElementById("app").innerHTML=`<div class="question-head"><button class="btn secondary" id="home-btn">← Home</button><div class="row"><span class="small">Niveautest ${state.placementIndex+1} van ${total}</span><span class="tag">Geen invloed op je mastery</span></div></div><div class="progress"><span style="width:${state.placementIndex/total*100}%"></span></div><div class="card" style="margin-top:24px"><div class="small">Kies het antwoord dat jij denkt dat goed is</div><div class="question">${q.prompt}</div><div class="answers">${q.options.map((o,i)=>`<button class="answer" type="button" data-placement="${i}">${o}</button>`).join("")}</div><div id="placement-feedback"></div></div>`;
 document.getElementById("home-btn").addEventListener("click",renderHome);
 document.querySelectorAll("[data-placement]").forEach(btn=>btn.addEventListener("click",()=>answerPlacement(q,btn)));
}
function answerPlacement(q,btn){
 if(state.answered)return;
 state.answered=true;
 const correct=String(btn.textContent).trim().toLowerCase()===String(q.answer).trim().toLowerCase();
 if(correct)state.placementScore++;
 btn.classList.add(correct?"correct":"wrong");
 document.querySelectorAll("[data-placement]").forEach(b=>{if(String(b.textContent).trim().toLowerCase()===String(q.answer).trim().toLowerCase())b.classList.add("correct");b.disabled=true});
 document.getElementById("placement-feedback").innerHTML=`<div class="feedback ${correct?"good":"bad"}"><strong>${correct?"Goed!":"Niet erg."}</strong><br><span class="small">${q.explanation}</span></div><button class="btn primary" id="placement-next" style="margin-top:14px">${state.placementIndex+1===state.placement.length?"Bekijk niveau":"Volgende →"}</button>`;
 document.getElementById("placement-next").addEventListener("click",()=>{state.placementIndex++;state.answered=false;renderPlacement()});
}
function finishPlacement(){
 const score=state.placementScore/state.placement.length;
 state.db.profile.placementScore=score;state.db.profile.placementAt=new Date().toISOString();save();
 const label=score<.4?"Starter":score<.7?"Beginner":"Beginner+";
 document.getElementById("app").innerHTML=`<div class="center"><span class="tag">Niveautest klaar</span><h1>Je startniveau: ${label}</h1><div class="card"><div class="big">${Math.round(score*100)}%</div><p class="muted">We gebruiken dit als startpunt. Je score verandert je mastery niet.</p><button class="btn primary" id="start-after-placement">Start je eerste sessie →</button></div></div>`;
 document.getElementById("start-after-placement").addEventListener("click",startSession);
}
function startSession(){state.session=selectItems(state.content.items,10);state.index=0;state.answered=false;renderQuestion()}
function startTopic(topic){state.session=selectItems(state.content.items.filter(i=>i.topic===topic),8);state.index=0;state.answered=false;renderQuestion()}
function selectItems(items,n){return [...items].sort((a,b)=>score(b)-score(a)).slice(0,n)}
function score(item){const s=itemState(item.id),m=Number(s.mastery||0),due=!s.nextReviewAt||new Date(s.nextReviewAt)<=new Date();return(1-m)*1.4+(due?.9:0)+(item.difficulty-1)*.06-Math.min((s.streak||0)*.04,.2)}
function renderQuestion(){if(state.index>=state.session.length)return renderResult();const q=state.session[state.index],total=state.session.length;const content=q.type==="typed"?`<input id="typed" autocomplete="off" placeholder="Typ je antwoord...">`:`<div class="answers">${q.options.map((o,i)=>`<button class="answer" type="button" data-answer-index="${i}">${o}</button>`).join("")}</div>`;document.getElementById("app").innerHTML=`<div class="question-head"><button class="btn secondary" id="home-btn">← Home</button><div class="row"><span class="small">Vraag ${state.index+1} van ${total}</span><span class="tag">${state.content.topics.find(t=>t.id===q.topic)?.name||q.topic}</span></div></div><div class="progress"><span style="width:${state.index/total*100}%"></span></div><div class="card" style="margin-top:24px"><div class="small">${q.type==="typed"?"Typ het juiste antwoord":"Kies het juiste antwoord"}</div><div class="question">${q.prompt}</div>${content}<div id="feedback"></div></div>`;
document.getElementById("home-btn").addEventListener("click",renderHome);if(q.type==="typed"){const input=document.getElementById("typed");input.addEventListener("keydown",e=>{if(e.key==="Enter")checkTyped()});input.focus()}else{document.querySelectorAll("[data-answer-index]").forEach(btn=>btn.addEventListener("click",()=>answer(q.options[Number(btn.dataset.answerIndex)],btn)))} }
function checkTyped(){const input=document.getElementById("typed"); if(!input.value.trim()) return; answer(input.value,input)}
function answer(value,clicked){
 if(state.answered)return;
 const q=state.session[state.index];
 const accepted=q.accepted&&q.accepted.length?q.accepted:[q.answer];
 const norm=s=>String(s||"").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").replace(/[.!?,]+$/g,"");
 const normalized=norm(value);
 if(!normalized)return;
 state.answered=true;
 const correct=accepted.map(norm).includes(normalized);
 const old=itemState(q.id);
 const mastery=Math.max(0,Math.min(1,Number(old.mastery||0)+.35*((correct?1:0)-Number(old.mastery||0))));
 const next=new Date();
 let interval=Number(old.intervalDays||0);
 if(correct){interval=interval?Math.min(45,interval*2):1;next.setDate(next.getDate()+interval)}
 else{interval=0;next.setHours(next.getHours()+8)}
 state.db.states[q.id]={attempts:Number(old.attempts||0)+1,correct:Number(old.correct||0)+(correct?1:0),mastery,streak:correct?Number(old.streak||0)+1:0,intervalDays:interval,nextReviewAt:next.toISOString(),lastSeenAt:new Date().toISOString()};
 save();
 const typed=document.getElementById("typed");
 if(typed)typed.disabled=true;
 document.querySelectorAll(".answer").forEach(b=>{
   if(accepted.map(norm).includes(norm(b.textContent)))b.classList.add("correct");
   if(!correct&&norm(b.textContent)===normalized)b.classList.add("wrong");
 });
 if(clicked&&correct)clicked.classList.add("correct");
 if(clicked&&!correct)clicked.classList.add("wrong");
 const answerText=accepted.join(" / ");
 document.getElementById("feedback").innerHTML=`<div class="feedback ${correct?"good":"bad"}"><strong>${correct?"Goed!":"Nog niet."}</strong><br>${correct?"Precies.":"Het juiste antwoord is: <b>"+answerText+"</b>."}<br><span class="small">${q.explanation}</span></div><button class="btn primary" id="next-btn" style="margin-top:14px">${state.index+1===state.session.length?"Bekijk resultaat":"Volgende →"}</button>`;
 document.getElementById("next-btn").addEventListener("click",nextQuestion)
}
function nextQuestion(){state.index++;state.answered=false;renderQuestion()}
function renderResult(){const vals=state.session.map(i=>Number(itemState(i.id).mastery||0)),avg=Math.round(vals.reduce((a,b)=>a+b,0)/Math.max(1,vals.length)*100);document.getElementById("app").innerHTML=`<div class="center"><span class="tag">Sessie klaar</span><h1>Goed bezig.</h1><div class="card"><div class="big">${avg}%</div><p class="muted">Gemiddelde mastery van de geoefende onderdelen.</p><button class="btn primary" id="again">Nog een korte sessie</button> <button class="btn secondary" id="dashboard">Dashboard</button></div></div>`;document.getElementById("again").addEventListener("click",startSession);document.getElementById("dashboard").addEventListener("click",renderHome)}
load();