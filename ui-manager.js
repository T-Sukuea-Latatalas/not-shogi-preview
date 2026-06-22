import { STATE, PLAYER, UPGRADE_COSTS } from './constants.js';

export class UIManager {
    constructor(callbacks) {
        this.callbacks = callbacks || {};
        this.selectedShopIndex = 0;
        this._msgTimeout = null;
        this._crosshairTimeout = null;
        this._vignetteTimeout = null;
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
            // 滑らかな遷移を保証するトランジションを適用
            itemEl.style.transition = 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)';

            // IDからインデックスを抽出して選択状態を判定
            const idMatch = itemEl.id.match(/shop-item-(\d+)/);
            if (!idMatch) return;

            const index = parseInt(idMatch[1], 10);
            const isSelected = (index === this.selectedShopIndex);

            // selectedクラスの追加・削除を確実に切り替え
            itemEl.classList.toggle('selected', isSelected);

            if (isSelected) {
                // 漆塗り調の朱色（#ae1f23）の帯と金色（#d4af37）の文字を動的に表現
                itemEl.style.background = 'linear-gradient(90deg, rgba(174, 31, 35, 0.95) 0%, rgba(174, 31, 35, 0.4) 60%, rgba(174, 31, 35, 0) 100%)';
                itemEl.style.color = '#d4af37';
                itemEl.style.borderLeft = '6px solid #d4af37';
                itemEl.style.paddingLeft = '18px';
                itemEl.style.boxShadow = '0 4px 12px rgba(174, 31, 35, 0.3)';
                itemEl.style.textShadow = '0 0 4px rgba(212, 175, 55, 0.5)';
            } else {
                // 非選択時は和モダンの落ち着いた色調にリセット
                itemEl.style.background = 'rgba(0, 0, 0, 0.2)';
                itemEl.style.color = '#ffffff';
                itemEl.style.borderLeft = '6px solid transparent';
                itemEl.style.paddingLeft = '10px';
                itemEl.style.boxShadow = 'none';
                itemEl.style.textShadow = 'none';
            }

            // マーカー（矢印）の表示更新とアニメーション
            const markerEl = itemEl.querySelector('.shop-marker');
            if (markerEl) {
                markerEl.style.transition = 'color 0.35s, transform 0.35s';
                markerEl.innerText = isSelected ? '▶' : '　';
                if (isSelected) {
                    markerEl.style.color = '#d4af37';
                    markerEl.style.transform = 'scale(1.15)';
                    markerEl.style.textShadow = '0 0 5px #d4af37';
                } else {
                    markerEl.style.color = 'transparent';
                    markerEl.style.transform = 'scale(1)';
                    markerEl.style.textShadow = 'none';
                }
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
            // 雅な和風の演出スタイル（幽玄な明朝体、金色、朱色のぼかし影）
            el.style.fontFamily = "'Sawarabi Mincho', 'Yu Mincho', 'YuMincho', 'Hiragino Mincho ProN', serif";
            el.style.color = '#d4af37'; 
            el.style.textShadow = '0 0 8px rgba(174, 31, 35, 0.9), 0 0 20px rgba(174, 31, 35, 0.6)';
            el.style.transition = 'none'; // 開始状態リセット用
            el.style.opacity = '0'; 
            el.style.transform = "scale(0.92)";
            el.style.letterSpacing = "0.1em";
            el.innerText = txt; 

            // リフローをトリガーしてトランジションを適切に実行
            el.offsetHeight;

            // 文字間隔を広げながら滑らかに浮かび上がらせる
            el.style.transition = 'opacity 0.8s cubic-bezier(0.25, 1, 0.5, 1), transform 1.0s cubic-bezier(0.25, 1, 0.5, 1), letter-spacing 1.2s cubic-bezier(0.25, 1, 0.5, 1)';
            el.style.opacity = '1'; 
            el.style.transform = "scale(1.02)";
            el.style.letterSpacing = "0.3em";

            if (this._msgTimeout) clearTimeout(this._msgTimeout);
            this._msgTimeout = setTimeout(() => { 
                if (el) {
                    // ゆったりと霧のように消えていく演出
                    el.style.transition = 'opacity 1.2s cubic-bezier(0.25, 1, 0.5, 1), transform 1.2s cubic-bezier(0.25, 1, 0.5, 1), letter-spacing 1.2s cubic-bezier(0.25, 1, 0.5, 1)';
                    el.style.opacity = '0'; 
                    el.style.transform = "scale(1.1)"; 
                    el.style.letterSpacing = "0.4em";
                }
            }, 1800);
        }
    }

    flashCrosshair() {
        const ch = document.getElementById('crosshair');
        if (ch) {
            ch.style.transition = 'none';
            // 伝統的な朱色のきらめきを表現
            ch.style.color = '#ae1f23';
            ch.style.textShadow = '0 0 8px #ae1f23, 0 0 15px #ae1f23';
            ch.style.transform = 'scale(1.3)';
            ch.classList.add('hit-mark');

            if (this._crosshairTimeout) clearTimeout(this._crosshairTimeout);
            this._crosshairTimeout = setTimeout(() => {
                if (ch) {
                    ch.style.transition = 'color 0.3s ease, text-shadow 0.3s ease, transform 0.3s ease';
                    ch.style.color = '';
                    ch.style.textShadow = '';
                    ch.style.transform = '';
                    ch.classList.remove('hit-mark');
                }
            }, 150);
        }
    }

    flashDamageVignette() {
        const vignette = document.getElementById('damage-vignette');
        if (vignette) {
            vignette.style.transition = 'none';
            // 深みのある漆塗り調の朱色グラデーションによるビネット
            vignette.style.boxShadow = 'inset 0 0 50px rgba(174, 31, 35, 0.85)';
            vignette.style.background = 'rgba(174, 31, 35, 0.12)';
            vignette.style.opacity = '1';
            vignette.classList.add('hit');

            if (this._vignetteTimeout) clearTimeout(this._vignetteTimeout);
            this._vignetteTimeout = setTimeout(() => {
                if (vignette) {
                    vignette.style.transition = 'opacity 0.6s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.6s cubic-bezier(0.25, 1, 0.5, 1), background 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
                    vignette.style.boxShadow = '';
                    vignette.style.background = '';
                    vignette.style.opacity = '0';
                    vignette.classList.remove('hit');
                }
            }, 250);
        }
    }
}
