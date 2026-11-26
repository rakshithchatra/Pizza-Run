import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { CHARACTERS } from './art/character';
import { sfx } from './audio';
import { createGame } from './game';
import { listen } from './input';
import { load, store } from './save';
import './style.css';

const $ = (id: string) => document.getElementById(id)!;
const fmt = (n: number) => n.toLocaleString('en-US');
const buzz = (style: ImpactStyle) => void Haptics.impact({ style }).catch(() => {});

const save = load();
sfx.setMuted(save.muted);
let who = Math.max(0, CHARACTERS.findIndex((c) => c.id === save.char));
let streak = 0, lastPickup = 0;

const game = createGame($('game') as HTMLCanvasElement, {
  pickup(kind) {
    if (kind === 'slice') {
      if (performance.now() - lastPickup > 500) streak = 0;
      lastPickup = performance.now();
      sfx.pickup(streak++);
    } else if (kind === 'pie') sfx.pie();
    else sfx.power();
    if (kind === 'slice' || kind === 'pie') pop($('h-pill'));
  },
  jump: sfx.jump,
  slide: sfx.slide,
  stumble() { sfx.stumble(); buzz(ImpactStyle.Medium); },
  crash() { sfx.crash(); buzz(ImpactStyle.Heavy); setTimeout(endRun, 900); },
});

/** Restart a one-shot CSS animation. */
function pop(el: HTMLElement) {
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

function show(id: 'menu' | 'hud' | 'over' | 'paused') {
  for (const s of ['menu', 'hud', 'over', 'paused']) $(s).hidden = s !== id && !(s === 'hud' && id === 'paused');
}

function drawMenu() {
  const c = CHARACTERS[who];
  game.setRunner(c.id);
  $('cname').textContent = c.name;
  $('cblurb').textContent = c.blurb;
  $('wallet').textContent = fmt(save.wallet);
  $('best').textContent = fmt(save.best);
  drawMute();
}

function drawMute() {
  $('mute').textContent = save.muted ? 'Sound off' : 'Sound on';
  $('h-mute').classList.toggle('off', save.muted);
  $('h-mute').setAttribute('aria-label', save.muted ? 'Turn sound on' : 'Turn sound off');
}

function toggleMute() {
  save.muted = !save.muted;
  sfx.setMuted(save.muted);
  store(save);
  drawMute();
}

function pickRunner(step: number) {
  who = (who + step + CHARACTERS.length) % CHARACTERS.length;
  save.char = CHARACTERS[who].id;
  store(save);
  drawMenu();
}

function play() {
  sfx.unlock();
  game.start();
  show('hud');
}

function toMenu() {
  game.toMenu();
  drawMenu();
  show('menu');
}

/** Bank the run's pizzas into the wallet. Called once per run, on a crash or a quit. */
function bank() {
  const { pizzas, score } = game.stats();
  save.wallet += pizzas;
  const record = score > save.best;
  if (record) save.best = score;
  store(save);
  return record;
}

function endRun() {
  if (game.state !== 'dead') return; // already left the run
  const { pizzas, score, metres } = game.stats();
  const record = bank();
  $('o-pizzas').textContent = `+${fmt(pizzas)}`;
  $('o-metres').textContent = `${fmt(metres)} m`;
  $('o-score').textContent = fmt(score);
  $('o-wallet').textContent = fmt(save.wallet);
  $('o-record').hidden = !record;
  show('over');
}

// Resuming counts down 3-2-1 so you are not dropped straight into an obstacle.
let countdown = 0;
function pause(on: boolean) {
  if (game.state !== 'run') return;
  clearInterval(countdown);
  $('count').hidden = true;
  if (on) {
    game.setPaused(true);
    return show('paused');
  }
  if (!game.paused) return;
  show('hud');
  let n = 3;
  const tick = () => {
    $('count').hidden = n === 0;
    $('count').textContent = String(n);
    pop($('count'));
    if (n-- === 0) {
      clearInterval(countdown);
      game.setPaused(false);
    }
  };
  tick();
  countdown = window.setInterval(tick, 600);
}

// First run only: name the move as each kind of obstacle comes up in your lane.
const COACH = { block: '\u2190 Dodge \u2192', jump: '\u2191 Jump', slide: '\u2193 Slide' };
const coached = new Set<string>();
function coach() {
  const d = game.ahead();
  const o = d.obs.find((o) => o.lane === d.lane && o.s0 > d.dist && o.s0 - d.dist < d.speed * 1.1);
  $('coach').hidden = !o;
  if (!o) return;
  $('coach').textContent = COACH[o.how];
  coached.add(o.how);
  if (coached.size === 3) {
    save.coached = true;
    store(save);
  }
}

$('play').onclick = play;
$('again').onclick = play;
$('home').onclick = toMenu;
$('prev').onclick = () => pickRunner(-1);
$('next').onclick = () => pickRunner(1);
$('pause').onclick = () => pause(true);
$('resume').onclick = () => pause(false);
$('quit').onclick = () => { bank(); toMenu(); };
$('mute').onclick = toggleMute;
$('h-mute').onclick = toggleMute;
document.addEventListener('visibilitychange', () => document.hidden && pause(true));

listen(
  (dir) => {
    if (game.state === 'menu' && (dir === 'left' || dir === 'right')) pickRunner(dir === 'left' ? -1 : 1);
    else game.input(dir);
  },
  (key) => {
    if (key === 'Enter' && game.state !== 'run') play();
    if (key === 'm') toggleMute();
    if (key === 'Escape' || key === 'p') pause($('paused').hidden !== false);
  },
);

const hud = { pizzas: -1, score: -1 };
function loop(ms: number) {
  game.frame(ms);
  if (game.state === 'run') {
    const s = game.stats();
    if (s.pizzas !== hud.pizzas) $('h-pizzas').textContent = fmt((hud.pizzas = s.pizzas));
    if (s.score !== hud.score) $('h-score').textContent = fmt((hud.score = s.score));
    for (const [id, left] of [['p-magnet', s.magnet], ['p-x2', s.x2]] as const) {
      $(id).hidden = left <= 0;
      $(id).style.setProperty('--left', String(left));
    }
    if (!save.coached && !game.paused) coach();
    else $('coach').hidden = true;
  }
  requestAnimationFrame(loop);
}
drawMenu();
show('menu');
requestAnimationFrame(loop);
