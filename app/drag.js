// Book order is stored in the existing books array; no migration of saved books is needed.
let bookDrag = null;
let pendingBookMove = null;
window.bookDragSuppress = false;

function dragCleanup(keepPreview = false) {
  if (!bookDrag) return;
  clearTimeout(bookDrag.holdTimer);
  clearInterval(bookDrag.scrollTimer);
  bookDrag.ghost?.remove();
  bookDrag.source.classList.remove('dragSource');
  document.body.classList.remove('dragActive');
  document.querySelectorAll('.shelf.dragTarget').forEach(el => el.classList.remove('dragTarget'));
  if (!keepPreview && bookDrag.active) render();
  bookDrag = null;
  setTimeout(() => { if (!bookDrag?.active) window.bookDragSuppress = false; }, 450);
}

function dragAnimate(cards, oldRects) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  cards.forEach(card => {
    if (card === bookDrag?.source || !card.isConnected) return;
    const previous = oldRects.get(card);
    if (!previous) return;
    const now = card.getBoundingClientRect();
    const dx = previous.left - now.left, dy = previous.top - now.top;
    if (Math.abs(dx) + Math.abs(dy) > 2) card.animate([
      { transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }
    ], { duration: 310, easing: 'cubic-bezier(.22,1,.36,1)' });
  });
}

function dragOver(x, y) {
  if (!bookDrag?.active) return;
  const under = document.elementFromPoint(x, y);
  const shelf = under?.closest('.shelf');
  document.querySelectorAll('.shelf.dragTarget').forEach(el => el.classList.remove('dragTarget'));
  bookDrag.outside = !shelf;
  if (!shelf) return;
  shelf.classList.add('dragTarget');
  const grid = shelf.querySelector('.grid');
  const target = under.closest('.book');
  if (target === bookDrag.source) return;
  const before = target && (y < target.getBoundingClientRect().top + target.getBoundingClientRect().height * .4 || x < target.getBoundingClientRect().left + target.getBoundingClientRect().width * .5);
  const cards = [...new Set([...bookDrag.source.parentElement.querySelectorAll('.book'), ...grid.querySelectorAll('.book')])];
  const positions = new Map(cards.map(card => [card, card.getBoundingClientRect()]));
  if (target) {
    if (before) grid.insertBefore(bookDrag.source, target);
    else grid.insertBefore(bookDrag.source, target.nextSibling);
  } else if (under.closest('.sectionHead')) grid.prepend(bookDrag.source);
  else grid.append(bookDrag.source);
  dragAnimate(cards, positions);
}

function dragBegin() {
  if (!bookDrag || bookDrag.active) return;
  const rect = bookDrag.source.getBoundingClientRect();
  bookDrag.active = true;
  bookDrag.outside = false;
  window.bookDragSuppress = true;
  const ghost = bookDrag.source.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.removeAttribute('tabindex');
  ghost.classList.add('dragGhost');
  Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  document.body.append(ghost);
  bookDrag.ghost = ghost;
  bookDrag.source.classList.add('dragSource');
  document.body.classList.add('dragActive');
  bookDrag.scrollTimer = setInterval(() => {
    if (!bookDrag?.active) return;
    const y = bookDrag.y, h = innerHeight;
    const speed = y < 75 ? -Math.min(13, (75 - y) / 5) : y > h - 90 ? Math.min(13, (y - h + 90) / 5) : 0;
    if (speed) { window.scrollBy(0, speed); dragOver(bookDrag.x, bookDrag.y); }
  }, 30);
  dragMove(bookDrag.x, bookDrag.y);
}

function dragMove(x, y) {
  if (!bookDrag) return;
  bookDrag.x = x; bookDrag.y = y;
  if (!bookDrag.active) {
    const distance = Math.hypot(x - bookDrag.startX, y - bookDrag.startY);
    if (bookDrag.type === 'mouse' && distance > 5) dragBegin();
    else if (bookDrag.type !== 'mouse' && distance > 10) { clearTimeout(bookDrag.holdTimer); bookDrag.holdTimer = null; }
    return;
  }
  bookDrag.ghost.style.transform = `translate(${x - bookDrag.startX}px,${y - bookDrag.startY}px) scale(1.055)`;
  dragOver(x, y);
}

function bookMoveResult(id, status, nextId, prevId) {
  const current = books.find(book => book.id === id);
  if (!current) return null;
  const next = books.filter(book => book.id !== id);
  let index = nextId ? next.findIndex(book => book.id === nextId) : -1;
  if (index < 0 && prevId) {
    const previous = next.findIndex(book => book.id === prevId);
    if (previous >= 0) index = previous + 1;
  }
  if (index < 0) {
    index = next.reduce((last, book, i) => book.status === status ? i + 1 : last, 0);
  }
  next.splice(index, 0, { ...current, status });
  return next;
}

function saveBookMove(move) {
  const next = bookMoveResult(move.id, move.status, move.nextId, move.prevId);
  if (!next) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    books = next;
    render();
  } catch (error) {
    render();
    alert('Could not save the new position. Your books are still in their previous places.');
  }
}

function dragFinish() {
  if (!bookDrag) return;
  if (!bookDrag.active || bookDrag.outside) { dragCleanup(); return; }
  const source = bookDrag.source;
  const shelf = source.closest('.shelf');
  const status = STATUSES[Number(shelf?.dataset.shelf)];
  if (!status) { dragCleanup(); return; }
  const id = source.dataset.bookId;
  const move = {
    id, status,
    nextId: source.nextElementSibling?.dataset.bookId || null,
    prevId: source.previousElementSibling?.dataset.bookId || null
  };
  const oldStatus = bookDrag.originalStatus;
  dragCleanup(true);
  if (status === oldStatus) { saveBookMove(move); return; }
  pendingBookMove = move;
  const title = books.find(book => book.id === id)?.title || 'This book';
  $('moveMessage').textContent = `Move “${title}” from ${oldStatus} to ${status}? Its reading status will change too.`;
  $('moveModal').classList.add('open');
  $('moveModal').querySelector('.primary').focus();
}

function cancelBookMove() {
  pendingBookMove = null;
  $('moveModal').classList.remove('open');
  render();
}
function confirmBookMove() {
  if (!pendingBookMove) return;
  const move = pendingBookMove;
  pendingBookMove = null;
  $('moveModal').classList.remove('open');
  saveBookMove(move);
}

$('shelves').addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch') return;
  const source = event.target.closest('.book');
  if (!source || bookDrag || pendingBookMove || event.button !== 0 || !event.isPrimary) return;
  const shelf = source.closest('.shelf');
  bookDrag = {
    source, type: 'mouse', pointerId: event.pointerId,
    startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
    originalStatus: STATUSES[Number(shelf.dataset.shelf)], active: false, outside: false
  };
});
$('shelves').addEventListener('touchstart', event => {
  if (event.touches.length !== 1 || bookDrag || pendingBookMove) return;
  const source = event.target.closest('.book');
  if (!source) return;
  const touch = event.touches[0], shelf = source.closest('.shelf');
  bookDrag = {
    source, type: 'touch', pointerId: 'touch', touchId: touch.identifier,
    startX: touch.clientX, startY: touch.clientY, x: touch.clientX, y: touch.clientY,
    originalStatus: STATUSES[Number(shelf.dataset.shelf)], active: false, outside: false
  };
  bookDrag.holdTimer = setTimeout(dragBegin, 270);
}, { passive: true });
document.addEventListener('pointermove', event => {
  if (bookDrag?.type === 'mouse' && bookDrag.pointerId === event.pointerId) dragMove(event.clientX, event.clientY);
});
document.addEventListener('touchmove', event => {
  if (bookDrag?.type !== 'touch') return;
  const touch = [...event.touches].find(t => t.identifier === bookDrag.touchId) || event.touches[0];
  if (!touch) return;
  if (bookDrag.active) event.preventDefault();
  dragMove(touch.clientX, touch.clientY);
}, { passive: false });
document.addEventListener('pointerup', event => {
  if (bookDrag?.type === 'mouse' && bookDrag.pointerId === event.pointerId) dragFinish();
});
document.addEventListener('pointercancel', event => {
  if (bookDrag?.type === 'mouse' && bookDrag.pointerId === event.pointerId) dragCleanup();
});
document.addEventListener('touchend', event => {
  if (bookDrag?.type === 'touch') dragFinish();
});
document.addEventListener('touchcancel', event => {
  if (bookDrag?.type === 'touch') dragCleanup();
});
$('shelves').addEventListener('dragstart', event => event.preventDefault());
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (pendingBookMove) cancelBookMove();
    else if (bookDrag) dragCleanup();
  }
});
