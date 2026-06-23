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
            // 引っかかりのない、滑らかで重みのある遷移（超低速から収束するイージング）
            itemEl.style.transition = 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)';

            // IDからインデックスを抽出して選択状態を判定
            const idMatch = itemEl.id.match(/shop-item-(\d+)/);
            if (!idMatch) return;

            const index = parseInt(idMatch[1], 10);
            const isSelected = (index === this.selectedShopIndex);

            // selectedクラスの追加・削除を切り替え
            itemEl.classList.toggle('selected', isSelected);

            if (isSelected) {
                // 朱漆調（#ae1f23）から溶けていくようなグラデーション、金箔調の細い縦枠線
                itemEl.style.background = 'linear-gradient(90deg, rgba(174, 31, 35, 0.9) 0%, rgba(139, 26, 26, 0.35) 60%, rgba(0, 0, 0, 0) 100%)';
                itemEl.style.color = '#d4af37';
                itemEl.style.borderLeft = '3px solid #d4af37';
                itemEl.style.paddingLeft = '22px';
                itemEl.style.boxShadow = '0 4px 16px rgba(174, 31, 35, 0.15)';
                itemEl.style.textShadow = '0 0 6px rgba(212, 175, 55, 0.4)';
                itemEl.style.opacity = '1';
                itemEl.style.transform = 'translateX(4px)'; // 静かな躍動感を出すため僅かに右へ配置
            } else {
                // 非選択時は和モダンの静寂、ミニマリズムを崩さない落ち着いた佇まい
                itemEl.style.background = 'rgba(255, 255, 255, 0.02)';
                itemEl.style.color = 'rgba(255, 255, 255, 0.6)';
                itemEl.style.borderLeft = '3px solid transparent';
                itemEl.style.paddingLeft = '14px';
                itemEl.style.boxShadow = 'none';
                itemEl.style.textShadow = 'none';
                itemEl.style.opacity = '0.75'; // 非選択時の不透明度を抑えて主従関係を明瞭に
                itemEl.style.transform = 'translateX(0)';
            }

            // マーカー（矢印）の表示更新とアニメーション
            const markerEl = itemEl.querySelector('.shop-marker');
            if (markerEl) {
                markerEl.style.transition = 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
                markerEl.innerText = isSelected ? '▶' : '　';
                if (isSelected) {
                    markerEl.style.color = '#d4af37';
                    markerEl.style.transform = 'scale(1.1)';
                    markerEl.style.textShadow = '0 0 6px rgba(212, 175, 55, 0.6)';
                } else {
                    markerEl.style.color = 'transparent';
                    markerEl.style.transform = 'scale(0.85)';
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
            el.style.textShadow = '0 0 10px rgba(174, 31, 35, 0.8), 0 0 25px rgba(174, 31, 35, 0.5)';
            el.style.transition = 'none'; // 開始状態リセット用
            el.style.opacity = '0'; 
            el.style.filter = 'blur(10px)'; // 初期状態で霧（にじみ）を表現
            el.style.transform = "scale(0.95)";
            el.style.letterSpacing = "0.05em";
            el.innerText = txt; 

            // リフローをトリガーしてトランジションを適切に実行
            el.offsetHeight;

            // 霧の向こうから墨文字が静かに浮かび上がるような優雅なフェードイン
            el.style.transition = 'opacity 1.5s cubic-bezier(0.22, 1, 0.36, 1), transform 1.8s cubic-bezier(0.22, 1, 0.36, 1), letter-spacing 2.0s cubic-bezier(0.22, 1, 0.36, 1), filter 1.5s cubic-bezier(0.22, 1, 0.36, 1)';
            el.style.opacity = '0.95'; 
            el.style.filter = 'blur(0px)';
            el.style.transform = "scale(1.02)";
            el.style.letterSpacing = "0.25em";

            if (this._msgTimeout) clearTimeout(this._msgTimeout);
            this._msgTimeout = setTimeout(() => { 
                if (el) {
                    // 再び霞の中へ溶けて消えゆく、余韻のある静かなフェードアウト
                    el.style.transition = 'opacity 2.2s cubic-bezier(0.25, 1, 0.5, 1), transform 2.2s cubic-bezier(0.25, 1, 0.5, 1), letter-spacing 2.2s cubic-bezier(0.25, 1, 0.5, 1), filter 2.2s cubic-bezier(0.25, 1, 0.5, 1)';
                    el.style.opacity = '0'; 
                    el.style.filter = 'blur(12px)';
                    el.style.transform = "scale(1.08)"; 
                    el.style.letterSpacing = "0.35em";
                }
            }, 1800);
        }
    }

    flashCrosshair() {
        const ch = document.getElementById('crosshair');
        if (ch) {
            ch.style.transition = 'none';
            // 瞬間的な鋭い手応え、朱赤の中に金色（#d4af37）の煌めきを僅かに内包
            ch.style.color = '#e03c3f';
            ch.style.textShadow = '0 0 12px #e03c3f, 0 0 24px rgba(212, 175, 55, 0.6)';
            ch.style.transform = 'scale(1.4)';
            ch.classList.add('hit-mark');

            if (this._crosshairTimeout) clearTimeout(this._crosshairTimeout);
            this._crosshairTimeout = setTimeout(() => {
                if (ch) {
                    // 心地よい手応えを残しつつ、すーっと静かに元の状態へ収束する余韻
                    ch.style.transition = 'color 0.45s cubic-bezier(0.25, 1, 0.5, 1), text-shadow 0.6s cubic-bezier(0.25, 1, 0.5, 1), transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)';
                    ch.style.color = '';
                    ch.style.textShadow = '';
                    ch.style.transform = '';
                    ch.classList.remove('hit-mark');
                }
            }, 120);
        }
    }

    flashDamageVignette() {
        const vignette = document.getElementById('damage-vignette');
        if (vignette) {
            vignette.style.transition = 'none';
            // 画面の四隅から「じんわりと朱漆が染み出す」ような、深みと透明感のあるグラデーション
            vignette.style.boxShadow = 'inset 0 0 80px rgba(139, 0, 0, 0.9)';
            vignette.style.background = 'radial-gradient(circle, rgba(174, 31, 35, 0) 35%, rgba(139, 0, 0, 0.22) 100%)';
            vignette.style.opacity = '1';
            vignette.classList.add('hit');

            if (this._vignetteTimeout) clearTimeout(this._vignetteTimeout);
            this._vignetteTimeout = setTimeout(() => {
                if (vignette) {
                    // 余韻を長く持たせ、緊迫感がゆっくりと引いていくように設計
                    vignette.style.transition = 'opacity 1.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 1.6s cubic-bezier(0.16, 1, 0.3, 1), background 1.6s cubic-bezier(0.16, 1, 0.3, 1)';
                    vignette.style.boxShadow = 'inset 0 0 100px rgba(0, 0, 0, 0)';
                    vignette.style.background = 'radial-gradient(circle, rgba(174, 31, 35, 0) 100%, rgba(139, 0, 0, 0) 100%)';
                    vignette.style.opacity = '0';
                    vignette.classList.remove('hit');
                }
            }, 250);
        }
    }
}
