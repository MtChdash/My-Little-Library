/* View-only: flipping never changes library data. */
window.setupCassetteFlip = function(root) {
  if(!root)return;
  const faces=root.querySelector('.cassetteFaces'),a=root.querySelector('.cassetteSideA'),b=root.querySelector('.cassetteSideB');
  let turn=0,start=null,suppressUntil=0;
  function flip(direction) {
    turn+=direction;const sideB=Math.abs(turn)%2===1;
    faces.style.transform=`rotateY(${turn*180}deg)`;
    a.inert=sideB;b.inert=!sideB;
    a.setAttribute('aria-hidden',String(sideB));b.setAttribute('aria-hidden',String(!sideB));
    root.dataset.side=sideB?'b':'a';
    root.setAttribute('aria-label',`Book cassette, Side ${sideB?'B':'A'}. Swipe or use arrow keys to flip.`);
    root.focus({preventScroll:true});
  }
  a.inert=false;b.inert=true;b.setAttribute('aria-hidden','true');root.dataset.side='a';
  root.addEventListener('pointerdown',e=>{if(e.isPrimary===false||e.button!==0)return;start={id:e.pointerId,x:e.clientX,y:e.clientY};});
  root.addEventListener('pointermove',e=>{if(!start||start.id!==e.pointerId)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>18){start=null;return;}if(Math.abs(dx)>18&&Math.abs(dx)>Math.abs(dy)*1.3)root.setPointerCapture?.(e.pointerId);});
  root.addEventListener('pointerup',e=>{if(!start||start.id!==e.pointerId)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)>=42&&Math.abs(dx)>Math.abs(dy)*1.3){suppressUntil=performance.now()+400;e.preventDefault();flip(dx<0?1:-1);}});
  root.addEventListener('pointercancel',()=>{start=null;});
  root.addEventListener('lostpointercapture',e=>{if(e.target===root)start=null;});
  root.addEventListener('click',e=>{if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();return;}if(e.target.closest('[data-flip-cassette]')){e.preventDefault();flip(1);}},true);
  root.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();flip(e.key==='ArrowLeft'?1:-1);}});
};
