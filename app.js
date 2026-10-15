import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, collection, doc, getDocs, getDoc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQ7QB54x3bXvifweIbjbdURwsut9ooCwE",
  authDomain: "supermercato-cgm.firebaseapp.com",
  projectId: "supermercato-cgm",
  storageBucket: "supermercato-cgm.firebasestorage.app",
  messagingSenderId: "583035588706",
  appId: "1:583035588706:web:d47ae42fd5655b3708013b"
};
const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
const $=id=>document.getElementById(id);
let user='',cardRef=null,unsub=null,data={count:0,notes:{},rating:0},edit=0,timer=0,long=false,busy=false,ready=false;
const messages={25:"Bravo, se sei un Inside Sales hai raggiunto l'obiettivo!!",40:"Ottimo, se sei un Field Sales hai raggiunto l'obiettivo, ora aiuta il tuo Team Leader a raggiungerlo!",50:"Fantastico, il tuo Team Leader ti ringrazia e ti offrirà una birra! 🍺"};
function status(message,error=false){$('status').textContent=message;$('status').className=error?'error':'ok'}
function cleanName(n){return n.trim().replace(/\s+/g,' ')}
function idFor(n){return encodeURIComponent(cleanName(n).toLocaleLowerCase('it')).replace(/%/g,'_')}
function validName(n){return n.length>2&&n.length<=80&&idFor(n).length<=100}
function empty(n){return {name:n,count:0,notes:{},rating:0}}
function errorMessage(e){console.error(e);status('Errore Firebase: '+(e?.message||String(e)),true)}
async function fillNames(){if(!ready)return;const select=$('existing'),selected=select.value;const result=await getDocs(collection(db,'cards'));let names=result.docs.map(d=>({id:d.id,name:d.data().name})).filter(x=>typeof x.name==='string').sort((a,b)=>a.name.localeCompare(b.name,'it'));select.replaceChildren(new Option('— Seleziona un nominativo —',''));names.forEach(n=>select.add(new Option(n.name,n.id)));if(names.some(n=>n.id===selected))select.value=selected}
async function enter(){if(!ready||busy)return;const typed=cleanName($('newname').value),chosen=$('existing').value;if(!typed&&!chosen){alert('Inserisci o seleziona un nominativo.');return}if(typed&&!validName(typed)){alert('Inserisci nome e cognome (da 3 a 80 caratteri, senza simboli speciali).');return}
const ref=doc(db,'cards',typed?idFor(typed):chosen);busy=true;$('enter').disabled=true;
try{await runTransaction(db,async t=>{const snap=await t.get(ref);if(!snap.exists()){if(!typed)throw Error('Il collega selezionato non esiste più.');t.set(ref,empty(typed))}});
const snap=await getDoc(ref);user=snap.data().name;cardRef=ref;if(unsub)unsub();unsub=onSnapshot(ref,s=>{if(!s.exists()){status('Scheda non trovata.',true);return}data=s.data();data.notes ||= {};$('username').textContent=data.name;render();status('Dati sincronizzati · '+data.name)},errorMessage);
$('login').classList.add('hidden');$('app').classList.remove('hidden');window.scrollTo(0,0);
}catch(e){errorMessage(e);alert('Non riesco ad aprire la tessera. Controlla il messaggio in alto.')}finally{busy=false;$('enter').disabled=false}}
async function mutate(fn){if(!cardRef||busy)return null;busy=true;try{const result=await runTransaction(db,async t=>{const snap=await t.get(cardRef);if(!snap.exists())throw Error('Scheda non trovata');const current=snap.data();const next={name:current.name,count:current.count,notes:{...(current.notes||{})},rating:current.rating};const result=fn(next);if(result===false)return false;t.update(cardRef,next);return result??true});return result}catch(e){errorMessage(e);alert('Modifica non salvata: '+(e.message||e));return null}finally{busy=false}}
function render(){$('total').textContent=data.count;const g=$('slots');g.replaceChildren();for(let r=4;r>=0;r--)for(let c=1;c<=10;c++){const i=r*10+c,d=document.createElement('div');d.className='slot'+(data.notes[i]?' hasnote':'');d.title=data.notes[i]||'Punto '+i;if(i<=data.count){const s=document.createElement('div');s.className='sticker';const im=document.createElement('img');im.src=window.CGM_PRODUCT_IMAGES[(i-1)%15];im.alt='Prodotto';s.append(im);d.append(s)}
d.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;long=false;clearTimeout(timer);timer=setTimeout(()=>{if(i<=data.count){long=true;edit=i;$('noteTitle').textContent='Commento al punto '+i;$('noteText').value=data.notes[i]||'';$('notes').classList.remove('hidden')}},600)});
d.addEventListener('pointerup',async()=>{clearTimeout(timer);if(long||busy)return;const reached=await mutate(next=>{if(i===next.count+1){next.count++;return i}if(i===next.count){delete next.notes[i];next.count--;return 0}return false});if(messages[reached]){$('partyTitle').textContent=messages[reached];$('party').classList.remove('hidden')}});
d.addEventListener('pointerleave',()=>clearTimeout(timer));d.addEventListener('pointercancel',()=>clearTimeout(timer));d.addEventListener('contextmenu',e=>e.preventDefault());g.append(d)}
document.querySelectorAll('[data-rate]').forEach(b=>b.classList.toggle('chosen',Number(b.dataset.rate)===data.rating));$('ratingText').textContent=data.rating?'Hai assegnato '+data.rating+' stell'+(data.rating===1?'a':'e')+'.':''}
$('enter').onclick=enter;$('newname').addEventListener('keydown',e=>{if(e.key==='Enter')enter()});$('existing').onchange=()=>{if($('existing').value)$('newname').value=''};
$('back').onclick=async()=>{if(unsub){unsub();unsub=null}cardRef=null;$('app').classList.add('hidden');$('login').classList.remove('hidden');$('newname').value='';try{await fillNames()}catch(e){errorMessage(e)}};
$('noteSave').onclick=async()=>{const value=$('noteText').value.trim(),point=edit;const result=await mutate(next=>{if(point>next.count)return false;if(value)next.notes[point]=value;else delete next.notes[point];return true});if(result)$('notes').classList.add('hidden')};
$('noteCancel').onclick=()=>$('notes').classList.add('hidden');$('partyClose').onclick=()=>$('party').classList.add('hidden');
document.querySelectorAll('[data-rate]').forEach(b=>b.onclick=async()=>{const rating=Number(b.dataset.rate);await mutate(next=>{next.rating=rating;return true})});
if(location.protocol==='file:'){status('Apri la versione pubblicata su GitHub Pages: il file locale non supporta il collegamento Firebase.',true)}
else{signInAnonymously(auth).catch(errorMessage);onAuthStateChanged(auth,async a=>{if(!a)return;ready=true;try{await fillNames();$('enter').disabled=false;status('Connesso a Firebase · scegli o inserisci un collega')}catch(e){errorMessage(e)}})}
