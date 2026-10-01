(() => {
  const status=()=>document.getElementById('offlineStatus');
  const text=value=>{if(status())status().textContent=value;};
  if(!('serviceWorker' in navigator)||!(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){text('Offline installation needs HTTPS.');return;}
  let registration;
  function offerUpdate(){if(!registration.waiting)return;const button=document.getElementById('appUpdate');button.hidden=false;button.onclick=()=>{if(document.body.classList.contains('saving')||document.querySelector('.modal.open')){alert('Finish editing and close the book editor before updating.');return;}registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});};}
  let switching=false;let hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(switching)return;if(hadController){switching=true;location.reload();}else{hadController=true;text('Offline ready.');}});
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(async reg=>{
    registration=reg;offerUpdate();
    reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){if(reg.waiting)offerUpdate();else text('Offline ready.');}if(worker.state==='redundant')text('Offline setup failed. Retry while online.');});});
    if(navigator.serviceWorker.controller){const channel=new MessageChannel();channel.port1.onmessage=event=>{if(event.data?.ready){text('Offline ready.');const version=document.getElementById('appVersion');if(version)version.textContent='App version: '+event.data.release;}channel.port1.close();};navigator.serviceWorker.controller.postMessage({type:'OFFLINE_STATUS'},[channel.port2]);}
    else text('Preparing offline files…');
    reg.update().catch(()=>{});
  }).catch(()=>text('Offline setup failed. Core data is still kept on this device.'));
})();
