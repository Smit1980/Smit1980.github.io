(() => {
  'use strict';
  const root = new URL('./', document.currentScript.src);
  const apiOrigin = 'https://ff-card-access.smitanin.chatgpt.site';
  const frame = document.querySelector('#application');
  const notice = document.querySelector('#portal-status');
  let accessToken = ''; // Deliberately never stored in shared github.io localStorage.
  let generation = 0;
  const blobs = new Set();
  const entryURL = root.href;
  async function request(path, options = {}) {
    if (!/^\/api\/[a-zA-Z0-9/_.-]+$/.test(path) || path.includes('..')) throw new Error('Недопустимый маршрут.');
    const headers = new Headers(options.headers || {});
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    const result = await fetch(apiOrigin + path, {...options,headers,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
    if (result.headers.get('Content-Type')?.includes('application/json')) {
      const data = await result.json();
      if (data.accessToken) { accessToken=data.accessToken; delete data.accessToken; }
      if (path==='/api/logout' && result.ok) accessToken='';
      return new Response(JSON.stringify(data),{status:result.status,headers:{'Content-Type':'application/json'}});
    }
    return result;
  }
  async function json(path) {
    const response=await request(path); const data=await response.json();
    if(!response.ok) throw new Error(data.error || 'Материал недоступен.');
    return data;
  }
  const nonce = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
  function documentHTML(html, value, mainView, protectedView=false) {
    // Existing scripts are trusted project sources; nonces are assigned before execution.
    const csp=`default-src 'none'; script-src 'self' 'nonce-${value}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ${apiOrigin}; frame-src 'self' about:; base-uri 'self'; form-action 'none'; object-src 'none'`;
    const additions=`<meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"><base href="${root.href}"><script nonce="${value}" src="${new URL('frame-bridge.js',root).href}" data-main="${mainView}" data-protected="${protectedView}"></script>`;
    return html.replace('<head>','<head>'+additions)
      .replaceAll('href="/assets/','href="')
      .replaceAll('src="/assets/','src="')
      .replace('</head>',`${protectedView?'<link rel="stylesheet" href="theme.css"><script src="protection.js" defer></script>':''}</head>`);
  }
  async function calculator() {
    const data=await json('/api/calculator');
    return documentHTML(data.html,data.nonce,false,true);
  }
  async function image(path) {
    if(!/^png\/screens\/(?:0[1-9]|[1-7]\d|80)\.png$/.test(path)) throw new Error('Неверное изображение.');
    const turn=generation;
    const result=await request('/api/media/'+path);
    if(!result.ok) throw new Error('Не удалось открыть изображение.');
    const blob=await result.blob();
    if(turn!==generation) throw new Error('Страница закрыта.');
    const objectURL=URL.createObjectURL(blob); blobs.add(objectURL); return objectURL;
  }
  function clearBlobs() { for(const url of blobs) URL.revokeObjectURL(url); blobs.clear(); }
  async function navigate(path='/') {
    const turn=++generation;
    notice.textContent='Открываем страницу…'; notice.hidden=false;
    frame.hidden=true; frame.srcdoc=''; clearBlobs();
    try {
      let html, value=nonce(), protectedView=false;
      if(path.startsWith('/guide')) { const data=await json('/api/guide'); html=data.html; value=data.nonce; protectedView=true; }
      else {
        if(path.startsWith('/admin')) throw new Error('Панель администратора недоступна.');
        const result=await fetch(new URL('login.html',root),{cache:'no-store'});
        if(!result.ok) throw new Error('Не удалось загрузить страницу.');
        html=await result.text();
      }
      if(turn!==generation) return;
      frame.srcdoc=documentHTML(html,value,true,protectedView);
      frame.hidden=false; notice.hidden=true;
      document.title=protectedView?'Карта банка Казахстана · инструкция':'Карта банка Казахстана · доступ';
    } catch(error) {
      if(turn!==generation) return;
      if(path!=='/') { accessToken=''; await navigate('/'); return; }
      notice.textContent=error.message+' Обновите страницу или запросите доступ в Telegram.';
    }
  }
  const expire=()=>{accessToken='';void navigate('/');};
  Object.defineProperty(window,'FFPortal',{value:Object.freeze({request,navigate,image,calculator,expire,entryURL}),writable:false});
  window.addEventListener('pagehide',()=>{accessToken='';clearBlobs();});
  void navigate('/');
})();
