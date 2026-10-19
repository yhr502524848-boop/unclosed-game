function createGame(data,saved){
 const fresh=()=>({version:5,revision:5,begun:false,stage:1,read:[],asked:[],questions:[],unlocked:[],journal:[],checks:[],favorites:[],recent:[],drafts:{search:'',persona:''},notes:'',history:[],view:{kind:'intro'},ending:null});
 let s=fresh(),restoring=false,grandfather=[];
 const stage=()=>data.stages[s.stage-1],complete=n=>s.journal.some(e=>e.stage===n);
 const strip=t=>String(t).replace(/<[^>]+>/g,' ');
 const referenceCache=new Map();
 function references(id){if(referenceCache.has(id))return referenceCache.get(id);const r=data.records[id];if(!r)return [];const refs=[...new Set([...r.links,...Object.keys(data.records).filter(to=>to!==id&&strip(r.body).includes(data.records[to].title))])];referenceCache.set(id,refs);return refs;}
 function accessible(){const out=new Set();const allow=id=>{const r=data.records[id];return r&&r.stage<=s.stage&&(!r.gate||s.unlocked.includes(r.gate));};if(s.begun)for(const id of data.publicRecords||[])if(allow(id))out.add(id);for(let n=0;n<s.stage;n++){const id=data.stages[n].root;if(allow(id))out.add(id);}for(const id of s.read)for(const to of references(id))if(allow(to))out.add(to);for(const key of s.asked)for(const to of data.topics[key]?.links||[])if(allow(to))out.add(to);for(const gate of s.unlocked)if(allow(data.gates[gate]?.root))out.add(data.gates[gate].root);return out;}
 function known(){const out=accessible();for(const id of s.read)for(const to of references(id))out.add(to);return out;}
 function material(id){if(!known().has(id))return {state:'unknown'};if(accessible().has(id))return {state:'readable'};const r=data.records[id];if(r.stage>s.stage)return {state:'pending',reason:data.lockReasons?.[id]||'待完成当前调查并调入续件后查看。'};const gate=r.gate;return {state:'encrypted',reason:'材料已调入，需登录所属归档后查看。',gate,entry:data.gates[gate]?.entry};}
 const personaUnlocked=()=>s.read.includes('conversation');
 function topics(){if(!personaUnlocked())return [];return Object.keys(data.topics).filter(key=>data.topics[key].seen.some(id=>s.read.includes(id))||s.asked.some(q=>data.topics[q].opens.includes(key)));}
 function profiles(){return Object.keys(data.profiles).filter(name=>data.profiles[name].seen.some(id=>s.read.includes(id)));}
 function workbenchRecords(name){return profiles().includes(name)&&data.profiles[name].workbench?['order_aug','order_sep','order_late_sep','roster','departure','signoff','backup','verification','oldcase','oldreply','handoff','access'].filter(id=>known().has(id)):[];}
 function canGate(key){const g=data.gates[key];return !!g&&s.stage>=g.stage&&(g.stage===1||complete(g.stage-1))&&s.read.includes(g.entry);}
 function safe(v){if(!v||typeof v!=='object')return null;if(v.kind==='intro')return {kind:'intro'};if(!s.begun)return null;
 if(['route','read','journal'].includes(v.kind))return {kind:v.kind};
 if(v.kind==='persona'&&personaUnlocked())return {kind:'persona'};
 if(v.kind==='record'&&accessible().has(v.id))return {kind:'record',id:v.id};
 if(v.kind==='locked'&&known().has(v.id))return {kind:accessible().has(v.id)?'record':'locked',id:v.id};
 if(v.kind==='compare')return {kind:'compare',ids:(v.ids||[]).filter(id=>s.read.includes(id)).slice(0,2)};
 if(v.kind==='checkpoint'&&data.checkpoints[s.stage]&&ready())return {kind:'checkpoint'};
 if(v.kind==='profile'&&profiles().includes(v.name))return {kind:'profile',name:v.name};
 if(v.kind==='workbench'&&profiles().includes(v.name)&&data.profiles[v.name].workbench)return {kind:'workbench',name:v.name};
 if(v.kind==='login'&&canGate(v.gate))return {kind:'login',gate:v.gate};
 if(v.kind==='search'){const candidates=[...new Set([...(v.ids||[]),...(v.locked||[])])];return {kind:'search',query:typeof v.query==='string'?v.query:'',ids:candidates.filter(id=>accessible().has(id)),locked:candidates.filter(id=>known().has(id)&&!accessible().has(id)),people:(v.people||[]).filter(name=>profiles().includes(name))};}
 if(v.kind==='report'&&s.journal.length===data.stages.length)return {kind:'report'};
 if(v.kind==='ending'&&s.ending&&s.journal.length===data.stages.length)return {kind:'ending'};return null;}
 function go(v,remember=true){const next=safe(v);if(!next)return false;if(remember&&JSON.stringify(s.view)!==JSON.stringify(next))s.history.push(s.view);s.history=s.history.slice(-30);s.view=next;if(next.kind==='record'){if(!s.read.includes(next.id))s.read.push(next.id);s.recent=[next.id,...s.recent.filter(id=>id!==next.id)].slice(0,12);}autoArchive();s.history=s.history.map(safe).filter(Boolean);return true;}
 function begin(){s.begun=true;return go({kind:'record',id:'signal'});}
 function chineseNumber(text){if(/^\d+$/.test(text))return Number(text);const digit={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};if(!text.includes('十'))return digit[text]||0;const [tens,ones]=text.split('十');return (tens?digit[tens]:1)*10+(ones?digit[ones]:0);}
 function normalize(t){return String(t).normalize('NFKC').trim().toLowerCase();}
 function dates(t){return normalize(t).replace(/(\d{4})\s*年/g,'$1/').replace(/(?:\d{4}[-/.])?([\d一二三四五六七八九十]+)[-/.月]([\d一二三四五六七八九十]+)(?:日|号)?/g,(all,m,d)=>{m=chineseNumber(m);d=chineseNumber(d);return m>=1&&m<=12&&d>=1&&d<=31?' @'+m+'/'+d+'@ ':all;}).replace(/\s+/g,' ').trim();}
 function search(raw){if(!s.begun)return 'blocked';const query=String(raw).trim(),q=dates(query);s.drafts.search=query;if(!q)return 'empty';const terms=q.split(/\s+/),has=hay=>terms.every(t=>dates(hay).includes(t));const ids=[...accessible()].filter(id=>{const r=data.records[id];return has([r.file,r.title,r.date,r.source,strip(r.body),...r.keys].join(' '));});const locked=[...known()].filter(id=>!accessible().has(id)&&has(data.records[id].title));const people=profiles().filter(name=>name.includes(normalize(query)));go({kind:'search',query,ids,locked,people});return ids.length||people.length||locked.length?'ok':'none';}
 function ask(raw){if(!personaUnlocked())return 'blocked';const input=String(raw).trim(),q=normalize(input);s.drafts.persona=input;if(!q)return 'empty';const m=dates(q).match(/@(\d+\/\d+)@/);const topic=m?topics().find(key=>key===m[1]):topics().map(key=>({key,score:Math.max(0,...data.topics[key].keys.filter(word=>q.includes(word)).map(word=>word.length))})).filter(t=>t.score).sort((a,b)=>b.score-a.score)[0]?.key;
 s.questions.push({input,topic:topic||null});s.questions=s.questions.slice(-100);if(topic){const previous=s.asked.indexOf(topic);if(previous>=0)s.asked.splice(previous,1);s.asked.push(topic);}go({kind:'persona'});return topic||'none';}
 function login(key,account,password){if(!canGate(key))return false;const g=data.gates[key];if(String(account).trim()!==g.account||String(password).trim()!==g.password)return false;if(!s.unlocked.includes(key))s.unlocked.push(key);go({kind:'record',id:g.root});return true;}
 function ready(){return stage().required.every(id=>s.read.includes(id)||(restoring&&grandfather.includes(s.stage)&&id==='provenance'))&&(s.stage!==1||s.asked.includes('11/6'));}
 function checkpointPass(n,answers){const cp=data.checkpoints[n];return !!cp&&Array.isArray(answers)&&cp.groups.every((group,i)=>group.type==='pair'?Array.isArray(answers[i])&&answers[i].length===2&&new Set(answers[i]).size===2&&group.answer.every(id=>answers[i].includes(id)):answers[i]===group.answer);}
 function submitCheck(answers){if(!ready()||!checkpointPass(s.stage,answers))return false;s.checks=s.checks.filter(c=>c.stage!==s.stage);s.checks.push({stage:s.stage,answers:JSON.parse(JSON.stringify(answers))});autoArchive();return true;}
 function autoArchive(){if(!s.begun||!ready()||complete(s.stage))return;const check=s.checks.find(c=>c.stage===s.stage);if(data.checkpoints[s.stage]&&!checkpointPass(s.stage,check?.answers)&&!(restoring&&grandfather.includes(s.stage)))return;s.journal.push({stage:s.stage,citations:stage().required.filter(id=>s.read.includes(id)),...(check?{answers:check.answers}:grandfather.includes(s.stage)?{inherited:true}:{})});}
 function advance(){if(!complete(s.stage)||s.stage>=data.stages.length)return false;s.stage++;return go({kind:'record',id:stage().root});}
 function end(choice){if(s.journal.length!==data.stages.length||!['full','personal'].includes(choice))return false;s.ending=choice;return go({kind:'ending'});}
 function back(){const prev=s.history.pop();return prev?go(prev,false):false;}
 function favorite(id){if(!s.read.includes(id))return false;s.favorites=s.favorites.includes(id)?s.favorites.filter(x=>x!==id):[...s.favorites,id];return true;}
 function restore(raw){if(!raw||raw.version!==5||!raw.begun)return;restoring=true;const legacy=![3,4,5].includes(raw.revision),previous=raw.revision===3;grandfather=!legacy?(raw.journal||[]).filter(e=>Number.isInteger(e.stage)&&e.stage<=raw.stage&&(raw.revision!==5||e.inherited)).map(e=>e.stage):[];begin();const reads=Array.isArray(raw.read)?raw.read.filter(id=>!legacy||(data.records[id]?.stage<=2&&!data.records[id]?.gate)):[],asked=Array.isArray(raw.asked)?raw.asked:[],unlocked=!legacy&&Array.isArray(raw.unlocked)?raw.unlocked:[];if(legacy&&reads.some(id=>['index','request','edit'].includes(id)))reads.push('content_catalog');if(previous&&reads.some(id=>['roster','departure','signoff'].includes(id))){reads.push('shift_entry');unlocked.push('shift');}const target=Math.min(legacy?2:6,Math.max(1,Number.isInteger(raw.stage)?raw.stage:1));
 s.checks=(raw.checks||[]).filter(c=>checkpointPass(c.stage,c.answers));
 for(let n=1;n<=target;n++){let changed=true;while(changed){changed=false;for(const key of asked)if(topics().includes(key)&&!s.asked.includes(key)){s.asked.push(key);changed=true;}for(const id of reads)if(accessible().has(id)&&!s.read.includes(id)){s.read.push(id);changed=true;}for(const key of unlocked)if(canGate(key)&&!s.unlocked.includes(key)){s.unlocked.push(key);changed=true;}}autoArchive();if(!complete(n))break;if(n<target)advance();}
 const ordered=[...new Set(reads)].filter(id=>s.read.includes(id));s.read=[...ordered,...s.read.filter(id=>!ordered.includes(id))];s.asked=[...new Set(asked)].filter(id=>s.asked.includes(id));
 s.questions=Array.isArray(raw.questions)?raw.questions.filter(q=>typeof q.input==='string'&&(!q.topic||s.asked.includes(q.topic))).slice(-100):s.asked.map(topic=>({input:data.topics[topic].label,topic}));
 s.favorites=(raw.favorites||[]).filter(id=>s.read.includes(id));s.recent=(raw.recent||[...s.read].reverse()).filter(id=>s.read.includes(id)).slice(0,12);s.drafts={search:typeof raw.drafts?.search==='string'?raw.drafts.search:'',persona:typeof raw.drafts?.persona==='string'?raw.drafts.persona:''};
 s.notes=typeof raw.notes==='string'?raw.notes.slice(0,5000):'';s.ending=s.journal.length===6&&['full','personal'].includes(raw.ending)?raw.ending:null;s.view=legacy&&s.stage===2?{kind:'record',id:'case_entry'}:safe(raw.view)||{kind:'route'};s.history=!legacy&&Array.isArray(raw.history)?raw.history.map(safe).filter(Boolean).slice(-30):[];restoring=false;
 }
 restore(saved);
 return {get state(){return s;},stage,complete,accessible,known,material,references,personaUnlocked,topics,profiles,workbenchRecords,canGate,safe,go,begin,search,ask,login,ready,submitCheck,favorite,advance,end,back,snapshot:()=>JSON.parse(JSON.stringify(s))};
}
