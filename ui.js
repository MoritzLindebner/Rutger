// ui.js – HUD und Screen-Management

export const UI = {
  els: {},

  init() {
    this.els = {
      menu:           document.getElementById('menu-screen'),
      gameover:       document.getElementById('gameover-screen'),
      hud:            document.getElementById('hud'),
      scoreValue:     document.getElementById('score-value'),
      highscoreValue: document.getElementById('highscore-value'),
      finalScore:     document.getElementById('final-score'),
      finalHighscore: document.getElementById('final-highscore'),
      newRecord:      document.getElementById('new-record-badge'),
      multiplierBadge: document.getElementById('multiplier-badge'),
      starBadge:      document.getElementById('star-badge'),
      jointBadge:     document.getElementById('joint-badge'),
      btnStart:       document.getElementById('btn-start'),
      btnRetry:       document.getElementById('btn-retry'),
    };
  },

  // ── Screens ─────────────────────────────────────────────────────────────
  showMenu() {
    this._showOnly('menu');
  },

  showHUD() {
    this._hideAll();
    this.els.hud.classList.remove('hidden');
  },

  showGameOver(score, highScore, isNewRecord) {
    this._showOnly('gameover');
    this.els.finalScore.textContent     = Math.floor(score).toLocaleString('de-DE');
    this.els.finalHighscore.textContent = Math.floor(highScore).toLocaleString('de-DE');

    if (isNewRecord) {
      this.els.newRecord.classList.remove('hidden');
    } else {
      this.els.newRecord.classList.add('hidden');
    }
  },

  _showOnly(key) {
    this._hideAll();
    this.els[key]?.classList.remove('hidden');
  },

  _hideAll() {
    ['menu', 'gameover'].forEach(k => this.els[k]?.classList.add('hidden'));
    this.els.hud?.classList.add('hidden');
  },

  // ── HUD Updates ──────────────────────────────────────────────────────────
  updateScore(score, highScore) {
    this.els.scoreValue.textContent     = Math.floor(score).toLocaleString('de-DE');
    this.els.highscoreValue.textContent = Math.floor(highScore).toLocaleString('de-DE');
  },

  updateEffects(effects) {
    // Multiplikator-Badge
    const mult = effects.totalMultiplier;
    if (mult > 1) {
      this.els.multiplierBadge.textContent = `×${mult}`;
      this.els.multiplierBadge.classList.remove('hidden');
    } else {
      this.els.multiplierBadge.classList.add('hidden');
    }

    // Diskokugel
    if (effects.isInvincible) {
      this.els.starBadge.classList.remove('hidden');
    } else {
      this.els.starBadge.classList.add('hidden');
    }

    // Joint
    if (effects.isHigh) {
      this.els.jointBadge.classList.remove('hidden');
    } else {
      this.els.jointBadge.classList.add('hidden');
    }
  },
};
