const firebaseConfig = {
  apiKey: "AIzaSyCxYRAwHQG15OID_X4ywydiH5EE4jdUZek",
  authDomain: "love-island-fantasy.firebaseapp.com",
  databaseURL: "https://love-island-fantasy-default-rtdb.firebaseio.com",
  projectId: "love-island-fantasy",
  storageBucket: "love-island-fantasy.firebasestorage.app",
  messagingSenderId: "954154252319",
  appId: "1:954154252319:web:a0504b91d2a9a620d23d2a"
};

firebase.initializeApp(firebaseConfig);
var db = firebase.database();

var USERS = {
  OH: { pin: '1717', color: '#D4537E' },
  CS: { pin: '1234', color: '#1D9E75' },
  RR: { pin: '4321', color: '#185FA5' },
  ADMIN: { pin: '3232', color: '#F5A623', isAdmin: true }
};

var INIT_CONTESTANTS = [
  {name:'Jen'},{name:'Gal'},
  {name:'Caleb'},{name:'Jaiden'},
  {name:'Kenzie'},{name:'Dylan'},
  {name:'Corbin'},{name:'Parmida'},
  {name:'Kayda'},{name:'Zach'},
  {name:'Melanie'},{name:'Sincere'},
  {name:'Trinity'},{name:'Bryce'},
  {name:'KC'},{name:'Tierra'},
  {name:'Aniya'}
];

var state = { currentUser:null, pinEntry:'', selectedUser:null, selectedKnight:null, selectedVillain:null };
var ldb = { contestants:[], episodes:[], picks:{}, votes:{}, scores:{OH:0,CS:0,RR:0} };

function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 2200);
}

function avatarColor(name) {
  var colors = ['#D4537E','#1D9E75','#185FA5','#F5A623','#993C1D','#534AB7','#0F6E56'];
  var h = 0; for (var i=0;i<name.length;i++) h = (h*31+name.charCodeAt(i))%colors.length;
  return colors[h];
}
function initials(name) { return name.slice(0,2).toUpperCase(); }

function loadFromFirebase() {
  return db.ref('/').get().then(function(snap) {
    if (snap.exists()) {
      var data = snap.val();
      ldb.contestants = data.contestants ? Object.values(data.contestants) : [];
      ldb.episodes = data.episodes ? Object.values(data.episodes) : [];
      ldb.picks = data.picks || {};
      ldb.votes = data.votes || {};
      ldb.scores = data.scores || { OH:0, CS:0, RR:0 };
    } else {
      ldb.contestants = INIT_CONTESTANTS.map(function(c,i){ return Object.assign({},c,{id:'c'+i,eliminated:false}); });
      return pushAll();
    }
  });
}

function pushAll() {
  var co = {}, eo = {};
  ldb.contestants.forEach(function(c){ co[c.id]=c; });
  ldb.episodes.forEach(function(e){ eo[e.id]=e; });
  return db.ref('/').set({ contestants:co, episodes:eo, picks:ldb.picks, votes:ldb.votes, scores:ldb.scores });
}

function pushPath(path, val) { return db.ref(path).set(val); }

function buildAuthHTML() {
  return '<div class="auth-wrap"><div class="auth-card"><h2>Welcome to the Villa</h2><p>Who are you?</p><div class="user-grid" id="user-grid"></div><div class="pin-row" id="pin-dots"></div><div class="keypad" id="keypad"></div><div class="error-msg" id="auth-error"></div></div></div>';
}

function renderAuth() {
  document.getElementById('user-grid').innerHTML = ['OH','CS','RR','ADMIN'].map(function(u){
    return '<button class="user-btn'+(state.selectedUser===u?' selected':'')+'" onclick="selectUser(\''+u+'\')">'+u+'</button>';
  }).join('');
  document.getElementById('pin-dots').innerHTML = [0,1,2,3].map(function(i){
    return '<div class="pin-dot'+(state.pinEntry.length>i?' filled':'')+'"></div>';
  }).join('');
  document.getElementById('keypad').innerHTML = ['1','2','3','4','5','6','7','8','9','','0','⌫'].map(function(k){
    return k ? '<button class="key'+(k==='⌫'?' del':'')+'" onclick="keyPress(\''+k+'\')">'+k+'</button>' : '<div></div>';
  }).join('');
}

function selectUser(u) { state.selectedUser=u; state.pinEntry=''; document.getElementById('auth-error').textContent=''; renderAuth(); }

function keyPress(k) {
  if (!state.selectedUser) { document.getElementById('auth-error').textContent='Select a name first.'; return; }
  if (k==='⌫') state.pinEntry=state.pinEntry.slice(0,-1);
  else if (state.pinEntry.length<4) state.pinEntry+=k;
  if (state.pinEntry.length===4) {
    if (USERS[state.selectedUser].pin===state.pinEntry) login(state.selectedUser);
    else { document.getElementById('auth-error').textContent='Wrong PIN. Try again.'; state.pinEntry=''; }
  }
  renderAuth();
}

function login(u) {
  state.currentUser=u;
  document.getElementById('page-auth').classList.remove('active');
  document.getElementById('nav').style.display='flex';
  if (USERS[u].isAdmin) document.getElementById('nav-admin').style.display='';
  showPage('picks');
}

function logout() {
  state.currentUser=null; state.selectedUser=null; state.pinEntry='';
  document.getElementById('nav').style.display='none';
  document.getElementById('nav-admin').style.display='none';
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.getElementById('page-auth').classList.add('active');
  renderAuth();
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.nav button').forEach(function(b){b.classList.remove('active');});
  document.getElementById('page-'+id).classList.add('active');
  var navEl = document.getElementById('nav-'+(id==='leaderboard'?'lb':id));
  if (navEl) navEl.classList.add('active');
  if (id==='picks') renderPicks();
  if (id==='vote') renderVotePage();
  if (id==='feed') renderFeed();
  if (id==='leaderboard') renderLeaderboard();
  if (id==='admin') renderAdmin();
}

function getWeekKey() {
  var now = new Date();
  var day = now.getDay();
  var diff = now.getDate()-day+(day===0?-6:1);
  var mon = new Date(new Date(now).setDate(diff));
  return 'w'+mon.getFullYear()+String(mon.getMonth()+1).padStart(2,'0')+String(mon.getDate()).padStart(2,'0');
}

function isLocked() {
  var et = new Date(new Date().toLocaleString('en-US',{timeZone:'America/New_York'}));
  return et.getDay()===1 && et.getHours()>=21;
}

function renderPicks() {
  var u=state.currentUser, wk=getWeekKey();
  var myPicks=((ldb.picks[u]||{})[wk])||{};
  state.selectedKnight=myPicks.knight||null;
  state.selectedVillain=myPicks.villain||null;
  var locked=isLocked();
  document.getElementById('deadline-note').textContent=locked?'🔒 Picks locked — episode in progress':'Lock-in by Monday 9:00 PM ET';
  var cur=document.getElementById('current-picks-display');
  if (myPicks.knight||myPicks.villain) {
    var kc=ldb.contestants.find(function(c){return c.id===myPicks.knight;});
    var vc=ldb.contestants.find(function(c){return c.id===myPicks.villain;});
    cur.innerHTML='<span class="badge badge-knight">Knight: '+(kc?kc.name:'—')+'</span>&nbsp;&nbsp;<span class="badge badge-villain">Villain: '+(vc?vc.name:'—')+'</span>';
  } else { cur.innerHTML='<span style="color:var(--text-muted)">No picks yet this week</span>'; }
  var active=ldb.contestants.filter(function(c){return !c.eliminated;});
  renderPickGrid('knight-grid',active,'knight',locked);
  renderPickGrid('villain-grid',active,'villain',locked);
  document.getElementById('save-picks-btn').disabled=locked;
}

function renderPickGrid(elId,contestants,role,locked) {
  var other=role==='knight'?'villain':'knight';
  var ok='selected'+other.charAt(0).toUpperCase()+other.slice(1);
  var sk='selected'+role.charAt(0).toUpperCase()+role.slice(1);
  document.getElementById(elId).innerHTML=contestants.map(function(c){
    var dis=c.id===state[ok]||locked;
    var sel=c.id===state[sk];
    return '<div class="c-card'+(sel?' sel-'+role:'')+'" onclick="'+(dis?'':'selectPick(\''+role+'\',\''+c.id+'\')')+'" style="'+(dis?'opacity:0.4;cursor:not-allowed':'')+'"><div class="c-avatar" style="background:'+avatarColor(c.name)+'">'+initials(c.name)+'</div><div class="c-name">'+c.name+'</div></div>';
  }).join('');
}

function selectPick(role,cid) { state['selected'+(role==='knight'?'Knight':'Villain')]=cid; renderPicks(); }

function savePicks() {
  var u=state.currentUser, wk=getWeekKey();
  if (!state.selectedKnight||!state.selectedVillain) { alert('Select both a Knight and a Villain first.'); return; }
  if (!ldb.picks[u]) ldb.picks[u]={};
  ldb.picks[u][wk]={knight:state.selectedKnight,villain:state.selectedVillain,savedAt:Date.now()};
  pushPath('/picks/'+u+'/'+wk,ldb.picks[u][wk]).then(function(){ toast('Picks saved!'); renderPicks(); });
}

function renderVotePage() {
  var sel=document.getElementById('ep-select');
  sel.innerHTML='<option value="">Select episode...</option>'+ldb.episodes.map(function(e){
    return '<option value="'+e.id+'">'+e.name+(e.current?' (current)':'')+'</option>';
  }).join('');
  loadVotePage();
}

function loadVotePage() {
  var epId=document.getElementById('ep-select').value;
  var u=state.currentUser, wk=getWeekKey();
  var myPicks=((ldb.picks[u]||{})[wk])||{};
  if (!epId) { document.getElementById('vote-counter-wrap').innerHTML=''; document.getElementById('vote-list').innerHTML='<div class="empty">Select an episode above.</div>'; return; }
  var epVotes=ldb.votes[epId]||{};
  var myVotes=Object.values(epVotes).filter(function(v){return v.user===u;});
  var vc=myVotes.length, hasIck=myVotes.some(function(v){return v.type==='ick';}), hasAww=myVotes.some(function(v){return v.type==='aww';});
  document.getElementById('vote-counter-wrap').innerHTML='<div class="vote-counter">Votes used: <span>'+vc+'/5</span> — at least 1 Ick &amp; 1 Aww required</div>';
  var active=ldb.contestants.filter(function(c){return !c.eliminated;});
  document.getElementById('vote-list').innerHTML=active.map(function(c){
    var isMyPick=c.id===myPicks.knight||c.id===myPicks.villain;
    var mv=myVotes.find(function(v){return v.cid===c.id;});
    var ta=Object.values(epVotes).filter(function(v){return v.cid===c.id&&v.type==='aww';}).length;
    var ti=Object.values(epVotes).filter(function(v){return v.cid===c.id&&v.type==='ick';}).length;
    var awwDis=isMyPick||(vc>=5&&(!mv||mv.type!=='aww'));
    var ickDis=isMyPick||(vc>=5&&(!mv||mv.type!=='ick'));
    var mvBadge=mv?'<span class="badge '+(mv.type==='aww'?'badge-aww':'badge-ick')+'">'+(mv.type==='aww'?'Aww':'Ick')+'</span>':'';
    var body=isMyPick?'<div class="own-pick-note">Your pick — can\'t vote on your own contestants</div>':
      '<div class="vote-btns"><button class="vote-btn aww'+(mv&&mv.type==='aww'?' active':'')+'" '+(awwDis&&(!mv||mv.type!=='aww')?'disabled':'')+' onclick="castVote(\''+epId+'\',\''+c.id+'\',\'aww\')">Aww</button><button class="vote-btn ick'+(mv&&mv.type==='ick'?' active':'')+'" '+(ickDis&&(!mv||mv.type!=='ick')?'disabled':'')+' onclick="castVote(\''+epId+'\',\''+c.id+'\',\'ick\')">Ick</button></div><textarea class="comment-input" placeholder="Add a comment (optional)..." rows="2" onblur="saveComment(\''+epId+'\',\''+c.id+'\',this.value)">'+(mv&&mv.comment?mv.comment:'')+'</textarea>';
    return '<div class="vote-c-card"><div class="vote-c-top"><div class="c-avatar" style="background:'+avatarColor(c.name)+';width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff">'+initials(c.name)+'</div><div style="flex:1"><div style="font-size:14px;font-weight:600">'+c.name+'</div><div style="font-size:12px;color:var(--text-secondary)">Aww: '+ta+' &nbsp;·&nbsp; Ick: '+ti+'</div></div>'+mvBadge+'</div>'+body+'</div>';
  }).join('');
}

function castVote(epId,cid,type) {
  var u=state.currentUser;
  if (!ldb.votes[epId]) ldb.votes[epId]={};
  var ev=ldb.votes[epId], vk=u+'_'+cid, ex=ev[vk];
  var myVotes=Object.values(ev).filter(function(v){return v.user===u;});
  var hasIck=myVotes.some(function(v){return v.type==='ick';}), hasAww=myVotes.some(function(v){return v.type==='aww';});
  if (ex) {
    if (ex.type===type) { delete ldb.votes[epId][vk]; db.ref('/votes/'+epId+'/'+vk).remove(); }
    else { ev[vk]=Object.assign({},ex,{type:type,ts:Date.now()}); pushPath('/votes/'+epId+'/'+vk,ev[vk]); }
  } else {
    if (myVotes.length>=5) return;
    if (myVotes.length===4&&!hasIck&&type!=='ick') { alert('Save your last vote for an Ick — you need at least 1!'); return; }
    if (myVotes.length===4&&!hasAww&&type!=='aww') { alert('Save your last vote for an Aww — you need at least 1!'); return; }
    var vote={user:u,cid:cid,type:type,ts:Date.now(),comment:''};
    ev[vk]=vote; pushPath('/votes/'+epId+'/'+vk,vote);
  }
  recalcScores(); pushPath('/scores',ldb.scores);
  loadVotePage();
}

function saveComment(epId,cid,val) {
  var vk=state.currentUser+'_'+cid;
  if (ldb.votes[epId]&&ldb.votes[epId][vk]) { ldb.votes[epId][vk].comment=val; pushPath('/votes/'+epId+'/'+vk+'/comment',val); }
}

function recalcScores() {
  var sc={OH:0,CS:0,RR:0};
  var weeks=new Set();
  Object.values(ldb.picks).forEach(function(wp){Object.keys(wp).forEach(function(w){weeks.add(w);});});
  weeks.forEach(function(wk){
    var pw={};
    ['OH','CS','RR'].forEach(function(u){pw[u]=((ldb.picks[u]||{})[wk])||{};});
    ldb.episodes.forEach(function(ep){
      Object.values(ldb.votes[ep.id]||{}).forEach(function(vote){
        ['OH','CS','RR'].forEach(function(u){
          if (vote.cid===pw[u].knight&&vote.type==='aww') sc[u]++;
          if (vote.cid===pw[u].villain&&vote.type==='ick') sc[u]++;
        });
      });
    });
    ldb.contestants.forEach(function(c){
      if (c.eliminated&&c.elimWeek===wk) {
        ['OH','CS','RR'].forEach(function(u){
          if (c.id===pw[u].knight) sc[u]-=5;
          if (c.id===pw[u].villain) sc[u]+=5;
        });
      }
    });
  });
  ldb.scores=sc;
}

function renderFeed() {
  document.getElementById('feed-ep-select').innerHTML='<option value="">All episodes</option>'+ldb.episodes.map(function(e){return '<option value="'+e.id+'">'+e.name+'</option>';}).join('');
  loadFeed();
}

function loadFeed() {
  var epId=document.getElementById('feed-ep-select').value;
  var all=[];
  var eps=epId?ldb.episodes.filter(function(e){return e.id===epId;}):ldb.episodes;
  eps.forEach(function(ep){Object.values(ldb.votes[ep.id]||{}).forEach(function(v){all.push(Object.assign({},v,{epName:ep.name}));});});
  all.sort(function(a,b){return b.ts-a.ts;});
  var list=document.getElementById('feed-list');
  if (!all.length) { list.innerHTML='<div class="empty">No votes yet.</div>'; return; }
  list.innerHTML=all.map(function(v){
    var c=ldb.contestants.find(function(x){return x.id===v.cid;});
    return '<div class="feed-item"><div class="feed-top"><span class="feed-who">'+v.user+' → <span class="badge '+(v.type==='aww'?'badge-aww':'badge-ick')+'">'+(v.type==='aww'?'Aww':'Ick')+'</span> '+(c?c.name:'?')+'</span><span class="feed-time">'+v.epName+' · '+new Date(v.ts).toLocaleDateString()+'</span></div>'+(v.comment?'<div class="feed-comment">"'+v.comment+'"</div>':'')+'</div>';
  }).join('');
}

function renderLeaderboard() {
  recalcScores();
  var users=['OH','CS','RR'].sort(function(a,b){return ldb.scores[b]-ldb.scores[a];});
  var medals=['🥇','🥈','🥉'], wk=getWeekKey();
  document.getElementById('lb-list').innerHTML=users.map(function(u,i){
    var pk=((ldb.picks[u]||{})[wk])||{};
    var kc=ldb.contestants.find(function(c){return c.id===pk.knight;});
    var vc=ldb.contestants.find(function(c){return c.id===pk.villain;});
    return '<div class="lb-row"><div class="lb-rank">'+medals[i]+'</div><div class="lb-avatar" style="background:'+USERS[u].color+'">'+u+'</div><div style="flex:1"><div class="lb-name">'+u+'</div><div class="lb-picks">'+(kc?'Knight: '+kc.name:'No knight')+' · '+(vc?'Villain: '+vc.name:'No villain')+'</div></div><div class="lb-score">'+(ldb.scores[u]||0)+'</div></div>';
  }).join('');
}

function renderAdmin() {
  document.getElementById('ep-list').innerHTML=ldb.episodes.length?ldb.episodes.map(function(e){
    return '<div class="ep-list-item'+(e.current?' current':'')+'"><span>'+e.name+'</span><div style="display:flex;gap:6px"><button class="admin-btn '+(e.current?'warn':'add')+'" onclick="toggleCurrentEp(\''+e.id+'\')">'+(e.current?'Current':'Set current')+'</button><button class="admin-btn danger" onclick="deleteEp(\''+e.id+'\')">Delete</button></div></div>';
  }).join(''):'<div class="empty" style="padding:12px">No episodes yet.</div>';
  document.getElementById('c-list').innerHTML=ldb.contestants.map(function(c){
    return '<div class="contestant-list-item'+(c.eliminated?' elim':'')+'"><span>'+c.name+(c.eliminated?' ✗':'')+'</span><button class="admin-btn danger" onclick="deleteContestant(\''+c.id+'\')">Remove</button></div>';
  }).join('');
  document.getElementById('elim-select').innerHTML=ldb.contestants.filter(function(c){return !c.eliminated;}).map(function(c){
    return '<option value="'+c.id+'">'+c.name+'</option>';
  }).join('');
}

function addEpisode() {
  var nm=document.getElementById('ep-name-input').value.trim();
  if (!nm) return;
  var ep={id:'ep'+Date.now(),name:nm,current:false};
  ldb.episodes.push(ep);
  pushPath('/episodes/'+ep.id,ep).then(function(){ document.getElementById('ep-name-input').value=''; toast('Episode added'); renderAdmin(); });
}

function deleteEp(id) {
  if (!confirm('Delete this episode?')) return;
  ldb.episodes=ldb.episodes.filter(function(e){return e.id!==id;}); delete ldb.votes[id];
  db.ref('/episodes/'+id).remove(); db.ref('/votes/'+id).remove();
  toast('Episode deleted'); renderAdmin();
}

function toggleCurrentEp(id) {
  ldb.episodes.forEach(function(e){e.current=e.id===id?!e.current:false;});
  var eo={}; ldb.episodes.forEach(function(e){eo[e.id]=e;}); pushPath('/episodes',eo);
  renderAdmin();
}

function addContestant() {
  var nm=document.getElementById('c-name-input').value.trim();
  if (!nm) return;
  var c={id:'c'+Date.now(),name:nm,eliminated:false};
  ldb.contestants.push(c);
  pushPath('/contestants/'+c.id,c).then(function(){ document.getElementById('c-name-input').value=''; toast('Contestant added'); renderAdmin(); });
}

function deleteContestant(id) {
  if (!confirm('Remove this contestant?')) return;
  ldb.contestants=ldb.contestants.filter(function(c){return c.id!==id;});
  db.ref('/contestants/'+id).remove();
  toast('Contestant removed'); renderAdmin();
}

function eliminateContestant() {
  var id=document.getElementById('elim-select').value;
  var c=ldb.contestants.find(function(x){return x.id===id;});
  if (!c||!confirm('Eliminate '+c.name+'? This triggers score changes.')) return;
  c.eliminated=true; c.elimWeek=getWeekKey();
  pushPath('/contestants/'+c.id,c);
  recalcScores(); pushPath('/scores',ldb.scores);
  toast(c.name+' eliminated'); renderAdmin();
}

function init() {
  loadFromFirebase().then(function(){
    document.getElementById('page-auth').innerHTML=buildAuthHTML();
    renderAuth();
    db.ref('/').on('value', function(snap){
      if (!snap.exists()) return;
      var data=snap.val();
      ldb.contestants=data.contestants?Object.values(data.contestants):[];
      ldb.episodes=data.episodes?Object.values(data.episodes):[];
      ldb.picks=data.picks||{}; ldb.votes=data.votes||{}; ldb.scores=data.scores||{OH:0,CS:0,RR:0};
      var pg=document.querySelector('.page.active');
      var pgId=pg?pg.id.replace('page-',''):'';
      if (pgId&&pgId!=='auth') {
        if (pgId==='vote') loadVotePage();
        if (pgId==='feed') loadFeed();
        if (pgId==='leaderboard') renderLeaderboard();
      }
    });
  });
}

init();
