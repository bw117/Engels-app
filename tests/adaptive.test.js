const test=require("node:test"),assert=require("node:assert/strict"),a=require("../server/adaptive");
test("mastery rises after correct",()=>assert.equal(a.updateMastery(0,true),.35));
test("mastery falls after wrong",()=>assert.equal(a.updateMastery(1,false),.65));
test("failed item returns after 8 hours",()=>{const s=a.updateItemState({mastery:.5},false,new Date("2026-09-20T10:00:00Z"));assert.equal(s.intervalDays,0);assert.equal(s.nextReviewAt,"2026-09-20T18:00:00.000Z")});
test("correct interval expands",()=>{const s=a.updateItemState({mastery:.5,intervalDays:1},true,new Date("2026-09-20T10:00:00Z"));assert.equal(s.intervalDays,2)});
test("weak item selected first",()=>{const items=[{id:"a",topic:"x",difficulty:1},{id:"b",topic:"x",difficulty:1}],picked=a.selectSession(items,{a:{mastery:.1},b:{mastery:.9}},1,new Date());assert.equal(picked[0].id,"a")});
test("unlock threshold is 70 percent",()=>{const items=[{id:"a"},{id:"b"}];assert.equal(a.isUnlocked(items,{a:{mastery:.7},b:{mastery:.7}}),true);assert.equal(a.isUnlocked(items,{a:{mastery:.7},b:{mastery:.6}}),false)});