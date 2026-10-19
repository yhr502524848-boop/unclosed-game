function createGame(data,saved){
 const fresh=()=>({version:5,revision:4,begun:false,stage:1,read:[],asked:[],unlocked:[],journal:[],notes:'',history:[],view:{kind:'intro'},ending:null});
 let s=fresh();
 const stage=()=>data.stages[s.stage-1];
 const complete=n=>s.journal.some(e=>e.stage===n);
 function accessible(){const out=new Set();const allow=id=>{const r=data.records[id];return r&&r.stage<=s.stage&&(!r.gate||s.unlocked.includes(r.gate));};if(s.begun)for(const id of data.publicRecords||[])if(allow(id))out.add(id);for(let n=0;n<s.stage;n++){const id=data.stages[n].root;if(allow(id))out.add(id);}for(const id of s.read)for(const to of data.records[id]?.links||[])if(allow(to))out.add(to);for(const key of s.asked)for(const to of data.topics[key]?.links||[])if(allow(to))out.add(to);for(const gate of s.unlocked)if(allow(data.gates[gate]?.root))out.add(data.gates[gate].root);return out;}
 const personaUnlocked=()=>s.read.includes('conversation');
 function topics(){if(!personaUnlocked())return [];return Object.keys(data.topics).filter(key=>data.topics[key].seen.some(id=>s.read.includes(id))||s.asked.some(q=>data.topics[q].opens.includes(key)));}
 function profiles(){return Object.keys(data.profiles).filter(name=>data.profiles[name].seen.some(id=>s.read.includes(id)));}
 function workbenchRecords(name){return profiles().includes(name)&&data.profiles[name].workbench?['order_aug','order_sep','order_late_sep','roster','departure','signoff','backup','verification','oldcase','oldreply','handoff','access'].filter(id=>accessible().has(id)):[];}
 function canGate(key){const g=data.gates[key];return !!g&&s.stage>=g.stage&&(g.stage===1||complete(g.stage-1))&&s.read.includes(g.entry);}
 function safe(v){if(!v||typeof v!=='object')return null;if(v.kind==='intro')return {kind:'intro'};if(!s.begun)return null;
 if(['route','read','journal'].includes(v.kind))return {kind:v.kind};
 if(v.kind==='persona'&&personaUnlocked())return {kind:'persona'};
 if(v.kind==='record'&&accessible().has(v.id))return {kind:'record',id:v.id};
 if(v.kind==='profile'&&profiles().includes(v.name))return {kind:'profile',name:v.name};
 if(v.kind==='workbench'&&profiles().includes(v.name)&&data.profiles[v.name].workbench)return {kind:'workbench',name:v.name};
 if(v.kind==='login'&&canGate(v.gate))return {kind:'login',gate:v.gate};
 if(v.kind==='search'){const ids=Array.isArray(v.ids)?v.ids.filter(id=>accessible().has(id)):[];const people=Array.isArray(v.people)?v.people.filter(name=>profiles().includes(name)):[];return ids.length||people.length?{kind:'search',ids,people}:null;}
 if(v.kind==='report'&&s.journal.length===data.stages.length)return {kind:'report'};
 if(v.kind==='ending'&&s.ending&&s.journal.length===data.stages.length)return {kind:'ending'};return null;}
 function go(v,remember=true){const next=safe(v);if(!next)return false;if(remember&&JSON.stringify(s.view)!==JSON.stringify(next))s.history.push(s.view);s.history=s.history.slice(-16);s.view=next;if(next.kind==='record'&&!s.read.includes(next.id))s.read.push(next.id);autoArchive();return true;}
 function begin(){s.begun=true;return go({kind:'record',id:'signal'});}
 function normalize(t){return String(t).normalize('NFKC').trim().toLowerCase();}
 function search(raw){if(!s.begun)return 'blocked';const q=normalize(raw);if(!q)return 'empty';const ids=[...accessible()].filter(id=>{const r=data.records[id];const hay=normalize([r.file,r.title,r.date,r.source,r.body.replace(/<[^>]+>/g,' '),...r.keys].join(' '));return q.split(/\s+/).every(t=>hay.includes(t));});const people=profiles().filter(name=>name.includes(q));if(!ids.length&&!people.length)return 'none';go({kind:'search',ids,people});return 'ok';}
 function chineseNumber(text){const digit={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};if(!text.includes('十'))return digit[text]||0;const [tens,ones]=text.split('十');return (tens?digit[tens]:1)*10+(ones?digit[ones]:0);}
 function ask(raw){if(!personaUnlocked())return 'blocked';const q=normalize(raw);if(!q)return 'empty';const m=q.match(/(?:\d{4}[-/.年])?(\d{1,2})[-/.月](\d{1,2})(?:日|号)?/),cm=q.match(/([一二三四五六七八九十]+)月([一二三四五六七八九十]+)(?:日|号)?/);const numeric=m?Number(m[1])+'/'+Number(m[2]):cm?chineseNumber(cm[1])+'/'+chineseNumber(cm[2]):null;const topic=numeric?topics().find(key=>key===numeric):topics().map(key=>({key,score:Math.max(0,...data.topics[key].keys.filter(word=>q.includes(word)).map(word=>word.length))})).filter(t=>t.score).sort((a,b)=>b.score-a.score)[0]?.key;if(!topic)return 'none';const previous=s.asked.indexOf(topic);if(previous>=0)s.asked.splice(previous,1);s.asked.push(topic);go({kind:'persona'});return topic;}
 function login(key,account,password){if(!canGate(key))return false;const g=data.gates[key];if(String(account).trim()!==g.account||String(password).trim()!==g.password)return false;if(!s.unlocked.includes(key))s.unlocked.push(key);go({kind:'record',id:g.root});return true;}
 function ready(){return stage().required.every(id=>s.read.includes(id))&&(s.stage!==1||s.asked.includes('11/6'));}
 function autoArchive(){if(s.begun&&ready()&&!complete(s.stage))s.journal.push({stage:s.stage,citations:stage().required.slice()});}
 function advance(){if(!complete(s.stage)||s.stage>=data.stages.length)return false;s.stage++;return go({kind:'record',id:stage().root});}
 function end(choice){if(s.journal.length!==data.stages.length||!['full','personal'].includes(choice))return false;s.ending=choice;return go({kind:'ending'});}
 function back(){const prev=s.history.pop();return prev?go(prev,false):false;}
 function restore(raw){if(!raw||raw.version!==5||!raw.begun)return;const legacy=raw.revision!==3&&raw.revision!==4,previous=raw.revision===3;begin();const reads=Array.isArray(raw.read)?raw.read.filter(id=>!legacy||(data.records[id]?.stage<=2&&!data.records[id]?.gate)):[],asked=Array.isArray(raw.asked)?raw.asked:[],unlocked=!legacy&&Array.isArray(raw.unlocked)?raw.unlocked:[];if(legacy&&reads.some(id=>['index','request','edit'].includes(id)))reads.push('content_catalog');if(previous&&reads.some(id=>['roster','departure','signoff'].includes(id))){reads.push('shift_entry');unlocked.push('shift');}const target=Math.min(legacy?2:6,Math.max(1,Number.isInteger(raw.stage)?raw.stage:1));
 for(let n=1;n<=target;n++){
  let changed=true;while(changed){changed=false;for(const key of asked)if(topics().includes(key)&&!s.asked.includes(key)){s.asked.push(key);changed=true;}for(const id of reads)if(accessible().has(id)&&!s.read.includes(id)){s.read.push(id);changed=true;}for(const key of unlocked)if(canGate(key)&&!s.unlocked.includes(key)){s.unlocked.push(key);changed=true;}}
  autoArchive();if(!complete(n))break;
  if(n<target)advance();
 }
 const ordered=[...new Set(reads)].filter(id=>s.read.includes(id));s.read=[...ordered,...s.read.filter(id=>!ordered.includes(id))];
 s.notes=typeof raw.notes==='string'?raw.notes.slice(0,5000):'';s.ending=s.journal.length===6&&['full','personal'].includes(raw.ending)?raw.ending:null;s.view=legacy&&s.stage===2?{kind:'record',id:'case_entry'}:safe(raw.view)||{kind:'route'};s.history=!legacy&&Array.isArray(raw.history)?raw.history.map(safe).filter(Boolean).slice(-16):[];
 }
 restore(saved);
 return {get state(){return s;},stage,complete,accessible,personaUnlocked,topics,profiles,workbenchRecords,canGate,safe,go,begin,search,ask,login,ready,advance,end,back,snapshot:()=>JSON.parse(JSON.stringify(s))};
}
