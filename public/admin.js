const $=id=>document.getElementById(id);
let items=[];
const fields=["type","title_si","title_en","description_si","description_en","category","link","date"];
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,options={}){const r=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});let data={};try{data=await r.json()}catch{}if(!r.ok)throw new Error(data.error||"Request failed.");return data}
function message(id,text,ok=false){$(id).textContent=text;$(id).className="form-message"+(ok?" ok":"")}
function showDashboard(){ $("loginPanel").classList.add("hidden");$("dashboard").classList.remove("hidden");refreshItems() }
async function checkSession(){try{const s=await api("/api/admin/session");if(s.authenticated)showDashboard()}catch{}}
function clearForm(){ $("contentForm").reset();$("contentId").value="";$("editorTitle").textContent="Add new content";$("saveBtn").textContent="Save content";message("editorMessage","")}
function populateForm(x){$("contentId").value=x.id;fields.forEach(k=>$(k).value=x[k]||"");$("editorTitle").textContent="Edit content";$("saveBtn").textContent="Update content";message("editorMessage","");window.scrollTo({top:$("contentForm").getBoundingClientRect().top+window.scrollY-20,behavior:"smooth"})}
function typeLabel(type){return ({resource:"Study resource",event:"Event",announcement:"Announcement"})[type]||type}
function renderItems(){
  $("itemCount").textContent=`${items.length} item${items.length===1?"":"s"}`;
  $("adminItems").innerHTML=items.length?items.map(x=>`<article class="admin-item"><span class="category">${escapeHtml(typeLabel(x.type))}</span><h4>${escapeHtml(x.title_en)}</h4><p>${escapeHtml(x.title_si)}</p><div class="item-actions"><button class="small-btn" data-edit="${x.id}">Edit</button><button class="small-btn delete" data-delete="${x.id}">Delete</button></div></article>`).join(""):`<p>No content yet. Add your first item using the form.</p>`;
  $("adminItems").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>populateForm(items.find(x=>x.id===Number(b.dataset.edit)))));
  $("adminItems").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{const x=items.find(i=>i.id===Number(b.dataset.delete));if(!x||!confirm(`Delete "${x.title_en}"? This cannot be undone.`))return;try{await api(`/api/content/${x.id}`,{method:"DELETE"});await refreshItems();if($("contentId").value===String(x.id))clearForm()}catch(e){alert(e.message)}}));
}
async function refreshItems(){try{items=await api("/api/content");renderItems()}catch(e){message("editorMessage",e.message)}}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();message("loginMessage","Signing in…");try{await api("/api/admin/login",{method:"POST",body:JSON.stringify({username:$("username").value,password:$("password").value})});$("password").value="";message("loginMessage","",true);showDashboard()}catch(err){message("loginMessage",err.message)}});
$("contentForm").addEventListener("submit",async e=>{e.preventDefault();const id=$("contentId").value;const body={};fields.forEach(k=>body[k]=$(k).value.trim());try{if(id){await api(`/api/content/${id}`,{method:"PUT",body:JSON.stringify(body)});message("editorMessage","Content updated successfully.",true)}else{await api("/api/content",{method:"POST",body:JSON.stringify(body)});message("editorMessage","Content added successfully.",true)}clearForm();await refreshItems()}catch(err){message("editorMessage",err.message)}});
$("clearBtn").addEventListener("click",clearForm);
$("logoutBtn").addEventListener("click",async()=>{try{await api("/api/admin/logout",{method:"POST"});$("dashboard").classList.add("hidden");$("loginPanel").classList.remove("hidden");clearForm()}catch(e){alert(e.message)}});
checkSession();
