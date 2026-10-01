/* Browser network state is a hint, not proof that an API is reachable.
   No network probe or remote API is called during launch. */
(() => {
  const notice=document.getElementById('connectionNotice');
  const status=document.getElementById('connectionStatus');
  function sync() {
    const online=navigator.onLine!==false;
    document.body.dataset.connection=online?'online':'offline';
    notice.hidden=online;
    status.textContent=online?'Online · browser reports a connection':'Offline · your saved library remains available';
    document.querySelectorAll('[data-requires-online]').forEach(el=>{
      el.classList.toggle('onlineUnavailable',!online);
      el.setAttribute('aria-disabled',String(!online));
      if(el.tagName==='BUTTON')el.disabled=!online;
      el.title=online?'Open online':'Available when connected';
    });
    window.libraryConnection={get online(){return navigator.onLine!==false;}};
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('[data-requires-online]');
    if(link&&navigator.onLine===false){event.preventDefault();sync();notice.classList.remove('flash');void notice.offsetWidth;notice.classList.add('flash');}
  },true);
  window.addEventListener('online',sync);
  window.addEventListener('offline',sync);
  window.addEventListener('pageshow',sync);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
  new MutationObserver(sync).observe(document.getElementById('detailContent'),{childList:true,subtree:true});
  sync();
})();
