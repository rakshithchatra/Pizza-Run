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
  crash() { sfx.crash(); buzz(ImpactStyle.Heavy); endRun(); },
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

/** The first run is a guided lesson; after that it only runs from "How to play". */
function play(withLesson = !save.coached) {
  sfx.unlock();
  game.start(withLesson);
  show('hud');
  inLesson = false;
  if (withLesson) toast('Quick lesson: 4 moves', 2600);
}

function toMenu() {
  game.toMenu();
  drawLesson();
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
  const { pizzas, score, metres } = game.stats();
  const record = bank();
  $('o-pizzas').textContent = `+${fmt(pizzas)}`;
  $('o-metres').textContent = `${fmt(metres)} m`;
  $('o-score').textContent = fmt(score);
  $('o-wallet').textContent = fmt(save.wallet);
  $('o-record').hidden = !record;
  show('over');
  // Replay the pizza-splat animation, and only take taps once the buttons have appeared.
  const over = $('over');
  over.classList.remove('go', 'ready');
  void over.offsetWidth;
  over.classList.add('go');
  clearTimeout(readyTimer);
  readyTimer = window.setTimeout(() => over.classList.add('ready'), matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 1900);
}
let readyTimer = 0;

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

let toastTimer = 0;
function toast(text: string, ms: number) {
  clearTimeout(toastTimer);
  $('toast').textContent = text;
  $('toast').hidden = false;
  pop($('toast'));
  toastTimer = window.setTimeout(() => ($('toast').hidden = true), ms);
}

// First-play lesson: the run freezes at each obstacle and this shows which move to make.
const verb = matchMedia('(pointer: coarse)').matches ? 'Swipe' : 'Swipe or press';
const PROMPT = {
  up: `${verb} \u2191 to jump`,
  down: `${verb} \u2193 to slide`,
  left: `${verb} \u2190 to dodge`,
  right: `${verb} \u2192 to dodge`,
};
let inLesson = false;
function drawLesson() {
  const l = game.state === 'run' ? game.lesson() : null;
  if (inLesson && !l && game.state === 'run') {
    save.coached = true; // made it through (or skipped): never show it uninvited again
    store(save);
    toast("You're ready. Go!", 1800);
  }
  inLesson = !!l;
  const need = l?.waiting && !game.paused ? l.need : null;
  $('tutor').hidden = !need;
  $('hud').classList.toggle('frozen', !!need);
  $('skip').hidden = !l;
  if (need && $('tutor').dataset.dir !== need) {
    $('tutor').dataset.dir = need;
    $('tutor-text').textContent = PROMPT[need];
  }
}

$('play').onclick = () => play();
$('howto').onclick = () => play(true);
$('skip').onclick = () => game.skipLesson();
$('again').onclick = () => play();
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
    if (key === 'Enter' && (game.state === 'menu' || $('over').classList.contains('ready'))) play();
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
  }
  drawLesson();
  requestAnimationFrame(loop);
}
drawMenu();
show('menu');
requestAnimationFrame(loop);
