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
        const shopItems = document.querySelectorAll('.shop-item');
        shopItems.forEach((itemEl) => {
            // IDからインデックス数値を安全に抽出（例: "shop-item-2" -> 2）
            const idMatch = itemEl.id.match(/shop-item-(\d+)/);
            if (!idMatch) return;

            const index = parseInt(idMatch[1], 10);
            itemEl.addEventListener('click', () => {
                this.selectedShopIndex = index;
                this.updateShopHighlight();
                if (this.callbacks.onUpgradeByIndex) {
                    this.callbacks.onUpgradeByIndex(index);
                }
            });
        });
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
        
        // HTML上の実際の要素数に基づいて上限を決定（要素がなければデフォルトで4）
        const shopItems = document.querySelectorAll('.shop-item');
        const itemCount = shopItems.length || 4;

        if (deltaY > 0) {
            this.selectedShopIndex = (this.selectedShopIndex + 1) % itemCount;
        } else if (deltaY < 0) {
            this.selectedShopIndex = (this.selectedShopIndex - 1 + itemCount) % itemCount;
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
        const shopItems = document.querySelectorAll('.shop-item');
        
        shopItems.forEach((itemEl) => {
            // IDからインデックスを抽出して選択状態を判定
            const idMatch = itemEl.id.match(/shop-item-(\d+)/);
            if (!idMatch) return;

            const index = parseInt(idMatch[1], 10);
            const isSelected = (index === this.selectedShopIndex);

            // selectedクラスの追加・削除を確実に切り替え
            itemEl.classList.toggle('selected', isSelected);

            // マーカー（矢印）の表示更新
            const markerEl = itemEl.querySelector('.shop-marker');
            if (markerEl) {
                markerEl.innerText = isSelected ? '▶' : '　';
            }
        });
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
