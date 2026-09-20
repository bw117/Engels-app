function normalize(text){return String(text||"").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").replace(/[.,!?;:]/g,"").replace(/\s+/g," ")}
function matches(answer,accepted=[]){return accepted.map(normalize).includes(normalize(answer))}
module.exports={normalize,matches};