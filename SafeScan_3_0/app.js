'use strict';
const $ = id => document.getElementById(id);
let scanner = null;
const HISTORY_KEY = 'safescan-history-v3';
const brands = ['paypal','google','apple','microsoft','amazon','github','telegram','instagram'];

function normalizeHost(host){return host.toLowerCase().replace(/[0-9]/g,'0');}
function resemblesBrand(label, brand){
  const lookalike = label.toLowerCase().replace(/0/g,'o').replace(/[1!|]/g,'l').replace(/3/g,'e').replace(/5/g,'s').replace(/@/g,'a');
  return lookalike.includes(brand) && label.toLowerCase() !== brand;
}
function assessUrl(raw){
  let score=0; const reasons=[]; let parsed;
  const add=(points,message)=>{score+=points;reasons.push({points,message});};
  try{parsed=new URL(raw.trim());}catch{return {score:100,level:'Не удалось разобрать',reasons:[{points:100,message:'Адрес не похож на корректный URL.'}],url:raw};}
  const host=parsed.hostname.toLowerCase();
  if(parsed.protocol!=='https:') add(20,'Соединение не использует HTTPS.');
  if(/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) add(35,'В адресе используется IP вместо доменного имени.');
  if(host.includes('xn--')) add(20,'Домен содержит Punycode — проверь написание особенно внимательно.');
  if(raw.length>100) add(10,'Адрес очень длинный.');
  if((raw.match(/@/g)||[]).length) add(15,'В адресе есть символ @, который может запутывать при чтении.');
  if((host.match(/-/g)||[]).length>=3) add(10,'В доменном имени много дефисов.');
  if(/\.(zip|mov|click|top|work)$/i.test(host)) add(10,'Используется доменная зона, которую стоит проверить дополнительно.');
  const labels=host.split('.');
  for(const label of labels){for(const brand of brands){if(resemblesBrand(label,brand)){add(45,`В части домена обнаружено сходство с названием известного сервиса (${brand}).`);break;}}}
  score=Math.min(100,score);
  const level=score>=60?'Высокий риск':score>=30?'Есть подозрительные признаки':'Мало найденных признаков риска';
  return {score,level,reasons,url:parsed.href};
}
function renderResult(target,result){
  const color=result.score>=60?'var(--bad)':result.score>=30?'var(--warn)':'var(--good)';
  target.classList.remove('hidden');
  target.innerHTML=`<div class="score" style="color:${color}">${result.score}/100</div><strong>${escapeHtml(result.level)}</strong><div class="meter"><div style="width:${result.score}%;background:${color}"></div></div><div class="small muted">Проверенный адрес: ${escapeHtml(result.url)}</div><h3>Почему получился такой результат</h3>${result.reasons.length?result.reasons.map(r=>`<div class="factor">+${r.points} баллов — ${escapeHtml(r.message)}</div>`).join(''):'<p>Простые подозрительные признаки не обнаружены.</p>'}<p class="muted small">Это эвристическая оценка, а не подтверждение безопасности или мошенничества.</p><button id="reportBtn">Скачать TXT-отчёт</button>`;
  $('reportBtn').addEventListener('click',()=>downloadReport(result));
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function getHistory(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');}catch{return [];}}
function saveHistory(item){const items=getHistory();items.unshift({...item,date:new Date().toLocaleString('ru-RU')});localStorage.setItem(HISTORY_KEY,JSON.stringify(items.slice(0,30)));renderHistory();}
function check(raw,target=$('result')){if(!raw.trim()){target.classList.remove('hidden');target.textContent='Сначала введи адрес сайта.';return null;}const result=assessUrl(raw);renderResult(target,result);saveHistory(result);return result;}
function downloadReport(result){const text=['SafeScan — отчёт проверки','Дата: '+new Date().toLocaleString('ru-RU'),'URL: '+result.url,'Оценка: '+result.score+'/100','Уровень: '+result.level,'','Факторы:',...(result.reasons.length?result.reasons.map(r=>`- ${r.points} баллов: ${r.message}`):['- Подозрительные признаки не обнаружены.']),'','Важно: эвристическая оценка не гарантирует безопасность сайта.'].join('\n');const blob=new Blob([text],{type:'text/plain;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='safescan-report.txt';a.click();URL.revokeObjectURL(a.href);}
function renderHistory(){const items=getHistory();$('historyList').innerHTML=items.length?items.map(x=>`<div class="history-item"><strong>${x.score}/100</strong> — ${escapeHtml(x.url)}<div class="muted small">${escapeHtml(x.date||'')}</div></div>`).join(''):'Пока проверок нет.';}
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab,.view').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$(btn.dataset.view).classList.add('active');}));
$('checkBtn').addEventListener('click',()=>check($('urlInput').value));
$('urlInput').addEventListener('keydown',e=>{if(e.key==='Enter')check($('urlInput').value);});
$('demoBtn').addEventListener('click',()=>{$('urlInput').value='https://paypa1.example/login';check($('urlInput').value);});
$('compareBtn').addEventListener('click',()=>{const a=assessUrl($('urlA').value),b=assessUrl($('urlB').value);$('compareResult').innerHTML=`<div class="columns"><div class="result"><h3>Ссылка A</h3><div class="score">${a.score}/100</div>${escapeHtml(a.level)}</div><div class="result"><h3>Ссылка B</h3><div class="score">${b.score}/100</div>${escapeHtml(b.level)}</div></div><p class="muted small">Сравнение основано на тех же эвристических правилах.</p>`;});
$('clearHistory').addEventListener('click',()=>{localStorage.removeItem(HISTORY_KEY);renderHistory();});
$('startScan').addEventListener('click',async()=>{if(!window.Html5Qrcode){$('scanStatus').textContent='Библиотека сканера не загрузилась. Проверь подключение к интернету.';return;}try{scanner=new Html5Qrcode('reader');await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:240,height:240}},decoded=>{ $('urlInput').value=decoded;document.querySelector('[data-view="check"]').click();check(decoded);scanner.stop().catch(()=>{});$('scanStatus').textContent='QR-код считан. Адрес перенесён в проверку.';},()=>{});$('scanStatus').textContent='Камера включена. Наведи её на QR-код.';}catch(e){$('scanStatus').textContent='Не удалось включить камеру: '+e.message;}});
$('stopScan').addEventListener('click',async()=>{if(scanner){try{await scanner.stop();scanner.clear();}catch{}scanner=null;}$('scanStatus').textContent='Сканер остановлен.';});
renderHistory();
if('serviceWorker' in navigator && location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
