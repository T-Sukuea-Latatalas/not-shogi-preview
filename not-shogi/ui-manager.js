import { STATE, PLAYER, UPGRADE_COSTS } from './constants.js';

export class UIManager {
    constructor(callbacks) {
        this.callbacks = callbacks || {};
        this.selectedShopIndex = 0;
    }

    init() {
        try {
            this.setupShopEvents();
        } catch (error) {
            console.error("UIManager initialization failed:", error);
        }
    }

    setupShopEvents() {
        for (let i = 0; i < 4; i++) {
            const itemEl = document.getElementById(`shop-item-${i}`);
            if (itemEl) {
                itemEl.addEventListener('click', () => {
                    this.selectedShopIndex = i;
                    this.updateShopHighlight();
                    if (this.callbacks.onUpgradeByIndex) {
                        this.callbacks.onUpgradeByIndex(i);
                    }
                });
            }
        }
    }

    toggleShop() {
        if (!STATE.stageActive || STATE.isPaused || STATE.introActive) return;
        STATE.shopOpen = !STATE.shopOpen;
        const shopMenu = document.getElementById('shop-menu');
        if (shopMenu) {
            shopMenu.style.display = STATE.shopOpen ? 'block' : 'none';
        }
        if (STATE.shopOpen) {
            PLAYER.isShooting = false;
            this.updateShopHighlight();
        }
    }

    handleShopWheel(deltaY) {
        if (!STATE.shopOpen) return;
        if (deltaY > 0) {
            this.selectedShopIndex = (this.selectedShopIndex + 1) % 4;
        } else if (deltaY < 0) {
            this.selectedShopIndex = (this.selectedShopIndex - 1 + 4) % 4;
        }
        this.updateShopHighlight();
    }

    buySelectedShopItem() {
        if (!STATE.shopOpen) return;
        if (this.callbacks.onUpgradeByIndex) {
            this.callbacks.onUpgradeByIndex(this.selectedShopIndex);
        }
    }

    updateShopHighlight() {
        for (let i = 0; i < 4; i++) {
            const itemEl = document.getElementById(`shop-item-${i}`);
            if (!itemEl) continue;
            const markerEl = itemEl.querySelector('.shop-marker');
            if (i === this.selectedShopIndex) {
                itemEl.classList.add('selected');
                if (markerEl) markerEl.innerText = '▶';
            } else {
                itemEl.classList.remove('selected');
                if (markerEl) markerEl.innerText = '　';
            }
        }
    }

    updateUI() {
        try {
            const hpBar = document.getElementById('hp-bar');
            if (hpBar) {
                hpBar.style.width = Math.max(0, (PLAYER.hp / PLAYER.maxHp * 100)) + "%";
            }
            const scoreVal = document.getElementById('score-val');
            if (scoreVal) {
                scoreVal.innerText = STATE.score;
            }
            const enemyCount = document.getElementById('enemy-count');
            if (enemyCount) {
                enemyCount.innerText = STATE.enemies ? STATE.enemies.length : 0;
            }
            for (let k in UPGRADE_COSTS) {
                const costEl = document.getElementById('cost-' + k);
                if (costEl) costEl.innerText = UPGRADE_COSTS[k];
            }
            this.updateShopHighlight();
        } catch (error) {
            console.error("Failed to update UI:", error);
        }
    }

    showMsg(txt) {
        const el = document.getElementById('msg-overlay');
        if (el) {
            el.innerText = txt; 
            el.style.opacity = 1; 
            el.style.transform = "scale(1)";
            setTimeout(() => { 
                if (el) {
                    el.style.opacity = 0; 
                    el.style.transform = "scale(1.5)"; 
                }
            }, 2000);
        }
    }

    flashCrosshair() {
        const ch = document.getElementById('crosshair');
        if (ch) {
            ch.classList.add('hit-mark');
            setTimeout(() => {
                if (ch) ch.classList.remove('hit-mark');
            }, 100);
        }
    }

    flashDamageVignette() {
        const vignette = document.getElementById('damage-vignette');
        if (vignette) {
            vignette.classList.add('hit');
            setTimeout(() => {
                if (vignette) vignette.classList.remove('hit');
            }, 200);
        }
    }
}