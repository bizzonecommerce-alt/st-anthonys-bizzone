let language = "si";
let allContent = [];
const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function t(si,en){return language==="si" ? si : en}
function applyLanguage(){
  document.documentElement.lang=language;
  document.querySelectorAll("[data-si][data-en]").forEach(el=>{el.innerHTML=language==="si"?el.dataset.si:el.dataset.en});
  $("langToggle").textContent=language==="si"?"EN":"සිං";
  $("searchInput").placeholder=language==="si"?"සම්පත් සොයන්න / Search resources":"Search resources";
  $("subjectFilter").options[0].textContent=language==="si"?"සියලු විෂයයන් / All subjects":"All subjects";
  renderAll();
}
function cardTitle(item){return language==="si"?item.title_si:item.title_en}
function cardDescription(item){return language==="si"?item.description_si:item.description_en}
function renderResources(){
  const term=$("searchInput").value.toLowerCase().trim(), subject=$("subjectFilter").value;
  const items=allContent.filter(x=>x.type==="resource").filter(x=>{
    const hay=[x.title_si,x.title_en,x.description_si,x.description_en,x.category].join(" ").toLowerCase();
    return (!term||hay.includes(term))&&(!subject||x.category.toLowerCase()===subject.toLowerCase());
  });
  $("resources").innerHTML=items.length?items.map((x,i)=>`<article class="resource-card"><div class="card-top"><span class="category">${escapeHtml(x.category||"General")}</span><span class="card-number">${String(i+1).padStart(2,"0")}</span></div><h3>${escapeHtml(cardTitle(x))}</h3><p>${escapeHtml(cardDescription(x))}</p>${x.link?`<a class="card-link" href="${escapeHtml(x.link)}" target="_blank" rel="noopener noreferrer">${t("සම්පත විවෘත කරන්න ↗","Open resource ↗")}</a>`:""}</article>`).join(""):`<div class="empty-state">${t("සම්පත් හමු නොවීය. Admin Panel එකෙන් සම්පත් එක් කළ හැකිය.","No resources found. Add resources from the admin panel.")}</div>`;
}
function renderEvents(){
  const items=allContent.filter(x=>x.type==="event");
  $("eventsGrid").innerHTML=items.length?items.map((x,i)=>`<article class="event-card"><div class="event-date">${escapeHtml(x.date||t("ඉදිරි වැඩසටහන","UPCOMING EVENT"))}</div><div class="card-top"><span class="category">${escapeHtml(x.category||"Commerce")}</span><span class="card-number">0${i+1}</span></div><h3>${escapeHtml(cardTitle(x))}</h3><p>${escapeHtml(cardDescription(x))}</p>${x.link?`<a class="card-link" href="${escapeHtml(x.link)}" target="_blank" rel="noopener noreferrer">${t("වැඩි විස්තර ↗","More details ↗")}</a>`:""}</article>`).join(""):`<div class="empty-state">${t("දැනට වැඩසටහන් නැත.","No events have been added yet.")}</div>`;
}
function renderAnnouncements(){
  const items=allContent.filter(x=>x.type==="announcement");
  $("announcements").innerHTML=items.map(x=>`<article class="announcement"><span class="category">${escapeHtml(x.category||t("නිවේදනය","ANNOUNCEMENT"))}</span><h3>${escapeHtml(cardTitle(x))}</h3><p>${escapeHtml(cardDescription(x))}</p>${x.link?`<a class="card-link" href="${escapeHtml(x.link)}" target="_blank" rel="noopener noreferrer">${t("තව කියවන්න ↗","Read more ↗")}</a>`:""}</article>`).join("");
}
function renderAll(){renderResources();renderEvents();renderAnnouncements()}
async function loadContent(){
  try{const r=await fetch("/api/content");if(!r.ok)throw new Error();allContent=await r.json();renderAll()}
  catch(e){$("resources").innerHTML=`<div class="empty-state">${t("සම්පත් පූරණය කළ නොහැකි විය.","Could not load resources.")}</div>`;$("eventsGrid").innerHTML="";$("announcements").innerHTML=""}
}
$("langToggle").addEventListener("click",()=>{language=language==="si"?"en":"si";applyLanguage()});
$("searchInput").addEventListener("input",renderResources);
$("subjectFilter").addEventListener("change",renderResources);
$("menuToggle").addEventListener("click",()=>$("nav").classList.toggle("open"));
document.querySelectorAll("#nav a").forEach(a=>a.addEventListener("click",()=>$("nav").classList.remove("open")));
$("calculate").addEventListener("click",()=>{
  const cost=Number($("cost").value), revenue=Number($("revenue").value), out=$("calcResult");
  if($("cost").value===""||$("revenue").value===""||cost<0||revenue<0||!Number.isFinite(cost)||!Number.isFinite(revenue)){out.className="calc-result loss";out.textContent=t("කරුණාකර වලංගු අගයන් දෙකක් ඇතුළත් කරන්න.","Please enter two valid non-negative values.");return}
  const difference=revenue-cost, result=Math.abs(difference).toLocaleString("en-LK",{minimumFractionDigits:2,maximumFractionDigits:2});
  out.className="calc-result "+(difference>0?"profit":difference<0?"loss":"");
  const label=difference>0?t("ලාභය","PROFIT"):difference<0?t("අලාභය","LOSS"):t("ලාභයක් හෝ අලාභයක් නැත","BREAK-EVEN");
  out.innerHTML=`${label}<strong>LKR ${result}</strong>`;
});
$("year").textContent=new Date().getFullYear();
loadContent();
