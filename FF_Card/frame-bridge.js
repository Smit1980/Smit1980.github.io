(() => {
  'use strict';
  const mainView=document.currentScript.dataset.main==='true';
  const protectedView=document.currentScript.dataset.protected==='true';
  const portal=window.top.FFPortal;
  Object.defineProperty(window,'FFPortal',{value:{...portal,isMainView:mainView},writable:false});
  document.addEventListener('click',event=>{
    const a=event.target.closest('a'); if(!a) return;
    const href=a.getAttribute('href')||'';
    if(/^\/(?:admin\/?|guide\/?|\?(?:admin|expired)=1)?$/.test(href)) {event.preventDefault();void portal.navigate(href);}
    if(a.target==='_blank') a.rel='noopener noreferrer';
  });
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('a[target="_blank"]').forEach(a=>a.rel='noopener noreferrer');
    if(!protectedView) return;
    let active=0;
    const queue=[];
    const drain=()=>{
      while(active<4&&queue.length) {
        const img=queue.shift(); active++;
        portal.image(img.dataset.protectedImage).then(url=>{img.src=url;img.removeAttribute('data-protected-image');}).catch(()=>{
          img.alt+=' — изображение временно недоступно';
          img.style.minHeight='80px';
        }).finally(()=>{active--;drain();});
      }
    };
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries) if(entry.isIntersecting) {observer.unobserve(entry.target);queue.push(entry.target);}
      drain();
    },{rootMargin:'900px'});
    document.querySelectorAll('[data-protected-image]').forEach(img=>{img.style.minHeight='120px';img.addEventListener('load',()=>{img.style.minHeight='';},{once:true});observer.observe(img);});
    document.querySelectorAll('[data-protected-calculator]').forEach(frame=>{
      frame.title='Калькулятор';
      portal.calculator().then(html=>{frame.srcdoc=html;}).catch(()=>{frame.replaceWith(document.createTextNode('Калькулятор временно недоступен. Обновите страницу.'));});
    });
  });
})();
