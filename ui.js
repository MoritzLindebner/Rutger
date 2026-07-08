// ui.js – HUD und Screen-Management

import { fetchLeaderboard, getUsername, getUid } from './firebase.js';

export const UI = {
  els: {},

  init() {
    this.els = {
      menu:           document.getElementById('menu-screen'),
      gameover:       document.getElementById('gameover-screen'),
      leaderboard:    document.getElementById('leaderboard-screen'),
      username:       document.getElementById('username-screen'),
      hud:            document.getElementById('hud'),
      scoreValue:     document.getElementById('score-value'),
      highscoreValue: document.getElementById('highscore-value'),
      finalScore:     document.getElementById('final-score'),
      finalHighscore: document.getElementById('final-highscore'),
      newRecord:      document.getElementById('new-record-badge'),
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
  showUsernamePrompt() {
    this.els.username.classList.remove('hidden');
    this.els.usernameInput.value = '';
    setTimeout(() => this.els.usernameInput.focus(), 100);
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

  _hideAll() {
    ['menu', 'gameover', 'leaderboard', 'username'].forEach(k => this.els[k]?.classList.add('hidden'));
    this.els.hud?.classList.add('hidden');
  },

  // ── HUD Updates ──────────────────────────────────────────────────────────
  updateScore(score, highScore) {
    this.els.scoreValue.textContent     = Math.floor(score).toLocaleString('de-DE');
    this.els.highscoreValue.textContent = Math.floor(highScore).toLocaleString('de-DE');
  },

  updateEffects(effects) {
    const mult = effects.totalMultiplier;
    if (mult > 1) {
      this.els.multiplierBadge.textContent = `×${mult}`;
      this.els.multiplierBadge.classList.remove('hidden');
    } else {
      this.els.multiplierBadge.classList.add('hidden');
    }

    if (effects.isStar) {
      this.els.starBadge.classList.remove('hidden');
    } else {
      this.els.starBadge.classList.add('hidden');
    }

    if (effects.isLipstick) {
      this.els.lipstickBadge.classList.remove('hidden');
    } else {
      this.els.lipstickBadge.classList.add('hidden');
    }

    if (effects.isMicro) {
      this.els.microBadge.classList.remove('hidden');
    } else {
      this.els.microBadge.classList.add('hidden');
    }

    if (effects.isDrunk) {
      this.els.beerBadge.textContent = '🍺 BETRUNKEN';
      this.els.beerBadge.classList.remove('hidden');
    } else if (effects.isSick) {
      this.els.beerBadge.textContent = '🤢 ÜBEL';
      this.els.beerBadge.classList.remove('hidden');
    } else {
      this.els.beerBadge.classList.add('hidden');
    }

    if (effects.isSmoking || effects.isBlurred) {
      this.els.jointBadge.classList.remove('hidden');
    } else {
      this.els.jointBadge.classList.add('hidden');
    }
  },
};
