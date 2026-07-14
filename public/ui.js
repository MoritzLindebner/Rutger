// ui.js – HUD und Screen-Management

import { fetchLeaderboard, getUsername, getUid } from './firebase.js';
import { spriteDataURL } from './items.js';

export const UI = {
  els: {},

  init() {
    this.els = {
      menu:           document.getElementById('menu-screen'),
      legend:         document.getElementById('legend-screen'),
      gameover:       document.getElementById('gameover-screen'),
      leaderboard:    document.getElementById('leaderboard-screen'),
      username:       document.getElementById('username-screen'),
      pause:          document.getElementById('pause-screen'),
      hud:            document.getElementById('hud'),
      scoreValue:     document.getElementById('score-value'),
      milestoneFlash: document.getElementById('milestone-flash'),
      highscoreValue: document.getElementById('highscore-value'),
      finalScore:     document.getElementById('final-score'),
      finalHighscore: document.getElementById('final-highscore'),
      newRecord:      document.getElementById('new-record-badge'),
      megaBadge:      document.getElementById('mega-badge'),
      multiplierBadge: document.getElementById('multiplier-badge'),
      starBadge:      document.getElementById('star-badge'),
      lipstickBadge:  document.getElementById('lipstick-badge'),
      microBadge:     document.getElementById('micro-badge'),
      beerBadge:      document.getElementById('beer-badge'),
      jointBadge:     document.getElementById('joint-badge'),
      btnStart:       document.getElementById('btn-start'),
      btnRetry:       document.getElementById('btn-retry'),
      btnLeaderboard: document.getElementById('btn-leaderboard'),
      btnLbClose:     document.getElementById('btn-lb-close'),
      lbList:         document.getElementById('lb-list'),
      usernameInput:  document.getElementById('username-input'),
      btnUsernameOk:  document.getElementById('btn-username-ok'),
    };
  },

  // ── Screens ─────────────────────────────────────────────────────────────
  showMenu() {
    this._hideAll();
    this.els.menu.classList.remove('hidden');
  },

  showHUD() {
    this._hideAll();
    this.els.hud.classList.remove('hidden');
  },

  showGameOver(score, highScore, isNewRecord) {
    this._hideAll();
    this.els.gameover.classList.remove('hidden');
    this.els.finalScore.textContent     = Math.floor(score).toLocaleString('de-DE');
    this.els.finalHighscore.textContent = Math.floor(highScore).toLocaleString('de-DE');

    if (isNewRecord) {
      this.els.newRecord.classList.remove('hidden');
    } else {
      this.els.newRecord.classList.add('hidden');
    }
  },

  // ── Username Prompt ────────────────────────────────────────────────────
  showUsernamePrompt(prefill = '') {
    this.els.username.classList.remove('hidden');
    this.els.usernameInput.value = prefill;
    setTimeout(() => { this.els.usernameInput.focus(); this.els.usernameInput.select(); }, 100);
  },

  hideUsernamePrompt() {
    this.els.username.classList.add('hidden');
  },

  // ── Leaderboard ────────────────────────────────────────────────────────
  showLeaderboard() {
    this.els.leaderboard.classList.remove('hidden');
    this._renderLeaderboard();
  },

  hideLeaderboard() {
    this.els.leaderboard.classList.add('hidden');
  },

  async _renderLeaderboard() {
    const list = this.els.lbList;
    list.innerHTML = '<p class="lb-loading">Laden...</p>';

    const entries = await fetchLeaderboard();

    list.innerHTML = '';

    if (entries.length === 0) {
      list.innerHTML = '<p class="lb-empty">Noch keine Einträge.<br>Spiel eine Runde!</p>';
      return;
    }

    entries.forEach((entry, i) => {
      const row = document.createElement('div');
      row.className = 'lb-row' + (entry.isSelf ? ' lb-self' : '');

      row.innerHTML =
        `<span class="lb-rank">#${i + 1}</span>` +
        `<span class="lb-name">${this._escapeHtml(entry.name)}</span>` +
        `<span class="lb-score">${entry.score.toLocaleString('de-DE')}</span>`;

      list.appendChild(row);
    });
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // ── Item-Legende (einmal pro Session) ────────────────────────────────────
  showLegend() {
    this._hideAll();
    this.els.legend.classList.remove('hidden');
    this._fillLegendSprites();
  },

  hideLegend() {
    this.els.legend.classList.add('hidden');
  },

  // Sprite-Bilder befüllen; einzelne noch nicht verarbeitete per rAF nachreichen
  _fillLegendSprites() {
    const imgs = this.els.legend.querySelectorAll('.legend-sprite');
    let pending = false;
    imgs.forEach(img => {
      if (img.dataset.loaded) return;
      const url = spriteDataURL(img.dataset.sprite);
      if (url) { img.src = url; img.dataset.loaded = '1'; }
      else pending = true;
    });
    if (pending) requestAnimationFrame(() => this._fillLegendSprites());
  },

  showPause() {
    this.els.pause?.classList.remove('hidden');
  },

  hidePause() {
    this.els.pause?.classList.add('hidden');
  },

  _hideAll() {
    ['menu', 'legend', 'gameover', 'leaderboard', 'username', 'pause'].forEach(k => this.els[k]?.classList.add('hidden'));
    this.els.hud?.classList.add('hidden');
  },

  // Meilenstein: Zahl einmal kurz groß aufleuchten lassen
  flashMilestone(text) {
    const el = this.els.milestoneFlash;
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden', 'play');
    void el.offsetWidth;          // Reflow → Animation neu starten
    el.classList.add('play');
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => el.classList.add('hidden'), 2400);
  },

  // ── HUD Updates ──────────────────────────────────────────────────────────
  updateScore(score, highScore) {
    this.els.scoreValue.textContent     = Math.floor(score).toLocaleString('de-DE');
    this.els.highscoreValue.textContent = Math.floor(highScore).toLocaleString('de-DE');
  },

  // Badge ein-/ausblenden, Rest-Zeit-Ring (frac 0–1), Sprite-Icon und optional Label
  _setBadge(badge, visible, frac, spriteType, label) {
    if (!badge) return;
    if (!visible) { badge.classList.add('hidden'); return; }
    badge.classList.remove('hidden');
    if (label !== undefined) {
      const lbl = badge.querySelector('.badge-label');
      if (lbl && lbl.textContent !== label) lbl.textContent = label;
    }
    const timer = badge.querySelector('.badge-timer');
    if (timer) timer.style.setProperty('--frac', frac.toFixed(3));
    // Sprite einmalig setzen, sobald es (nach Bild-Load) verarbeitet vorliegt
    const img = badge.querySelector('.badge-sprite');
    if (img && spriteType && !img.dataset.loaded) {
      const url = spriteDataURL(spriteType);
      if (url) { img.src = url; img.dataset.loaded = '1'; }
    }
  },

  updateEffects(effects) {
    this._setBadge(this.els.megaBadge, effects.isMega, effects.megaFrac);

    const mult = effects.totalMultiplier;
    // Kreis folgt dem x2-Item-Timer; kommt die Verdopplung nur vom Joint,
    // hat multFrac keinen Bezug → dann den Joint-Timer als Rest-Anzeige nehmen.
    const multFrac = effects.multFrac > 0 ? effects.multFrac : effects.jointFrac;
    this._setBadge(this.els.multiplierBadge, mult > 1, multFrac, 'x2', `×${mult}`);
    this._setBadge(this.els.starBadge,     effects.isStar,     effects.starFrac,  'star');
    this._setBadge(this.els.lipstickBadge, effects.isLipstick, effects.lipFrac,   'lipstick');
    this._setBadge(this.els.microBadge,    effects.isMicro,    effects.microFrac, 'micro');

    if (effects.isDrunk) {
      this._setBadge(this.els.beerBadge, true, effects.beerFrac, 'beer', 'Bier');
    } else if (effects.isSick) {
      this._setBadge(this.els.beerBadge, true, effects.beerFrac, 'beer', 'Bier');
    } else {
      this._setBadge(this.els.beerBadge, false);
    }

    this._setBadge(this.els.jointBadge, effects.isSmoking || effects.isBlurred, effects.jointFrac, 'joint');
  },
};
