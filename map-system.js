import { STATE, PIECE_NAMES } from './constants.js';

const nodeCoords = [];
let isEventsBound = false;
let scrollAnimationId = null; // スムーズな絵巻物風スクロールを制御するアニメーションID

// 横一直線配置のための定数
const SPACING_X = 350;     // ノード間の距離
const OFFSET_X = 250;      // 最初のノードのX開始位置
const CONSTANT_Y = 1250;   // マップの高さ2500pxの中央付近に固定

/**
 * ステージデータから敵の構成を解析して難易度スコアを計算します。
 * @param {Object} stageData ステージ情報
 * @returns {number} 難易度スコアの合計値
 */
function calculateDifficultyScore(stageData) {
    const weights = {
        '歩': 1, 'ポーン': 1, 'P': 1,
        '香': 2, 'ナイト': 2, 'N': 2,
        '桂': 3, 'ビショップ': 3, 'B': 3,
        '銀': 4,
        '金': 5,
        '角': 6,
        '飛': 7, 'ルーク': 7, 'R': 7,
        'クイーン': 15, 'Q': 15,
        '王': 15, 'キング': 15, 'K': 15,
        'ヨット': 30, 'Yacht': 30
    };
    let score = 0;
    for (const key in weights) {
        if (stageData[key]) {
            score += stageData[key] * weights[key];
        }
    }
    return score;
}

/**
 * 計算された難易度スコアから、3段階の難易度クラスを判定します。
 * @param {number} score 難易度スコア
 * @returns {string} 難易度クラス名 (node-easy / node-medium / node-hard)
 */
function getDifficultyClass(score) {
    if (score <= 5) return 'node-easy';
    if (score <= 15) return 'node-medium';
    return 'node-hard';
}

/**
 * カスタムのイージング関数を用いて、ビューポートを滑らかにスクロールさせます。
 * 古い絵巻物をそっと紐解くような、優美で高級感のある追従動作を実現します。
 * @param {HTMLElement} viewport 対象となるスクロールコンテナ
 * @param {number} targetLeft 目標とするスクロール位置X
 * @param {number} targetTop 目標とするスクロール位置Y
 */
function smoothScrollTo(viewport, targetLeft, targetTop) {
    if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId);
    }

    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
    const maxScrollTop = viewport.scrollHeight - viewport.clientHeight;
    const clampedTargetLeft = Math.max(0, Math.min(targetLeft, maxScrollLeft));
    const clampedTargetTop = Math.max(0, Math.min(targetTop, maxScrollTop));

    const easeFactor = 0.07;

    function step() {
        const currentLeft = viewport.scrollLeft;
        const currentTop = viewport.scrollTop;

        const diffLeft = clampedTargetLeft - currentLeft;
        const diffTop = clampedTargetTop - currentTop;

        if (Math.abs(diffLeft) < 0.5 && Math.abs(diffTop) < 0.5) {
            viewport.scrollLeft = clampedTargetLeft;
            viewport.scrollTop = clampedTargetTop;
            return;
        }

        viewport.scrollLeft = currentLeft + diffLeft * easeFactor;
        viewport.scrollTop = currentTop + diffTop * easeFactor;

        scrollAnimationId = requestAnimationFrame(step);
    }

    step();
}

/**
 * アクティブなステージにアバターの位置を合わせ、
 * forceScroll が有効な場合のみビューポートの中央にスクロール追従させます。
 * @param {boolean} forceScroll 強制的に自動スクロール追従を行うか否か
 */
function updateAvatarAndScroll(forceScroll = false) {
    const currentIndex = STATE.currentStageIndex;
    const coords = nodeCoords[currentIndex];
    const avatar = document.getElementById('player-avatar');
    if (avatar && coords) {
        avatar.style.left = `${coords.x}px`;
        avatar.style.top = `${coords.y}px`;
    }

    const viewport = document.querySelector('.map-viewport');
    if (forceScroll && viewport && coords) {
        const viewportWidth = viewport.clientWidth;
        const viewportHeight = viewport.clientHeight;
        
        const targetLeft = coords.x - viewportWidth / 2;
        const targetTop = coords.y - viewportHeight / 2;

        smoothScrollTo(viewport, targetLeft, targetTop);
    }
}

/**
 * 現在選択されているアクティブなステージアイコンの真上に直接吹き出すポップアップ形式で
 * ステージ情報パネルを配置・表示します。
 */
function updateStageInfoPanel() {
    const currentIndex = STATE.currentStageIndex;
    const stage = MapSystem.stagesData[currentIndex];
    const panel = document.getElementById('stage-info-panel');
    
    if (!stage) {
        if (panel) panel.style.display = 'none';
        return;
    }

    if (panel) {
        panel.style.display = 'flex';
        const coords = nodeCoords[currentIndex];
        if (coords) {
            // パネルの位置をアクティブなアイコンの直上に配置（吹き出しポップアップ化）
            panel.style.position = 'absolute';
            panel.style.right = 'auto';
            panel.style.top = 'auto';
            panel.style.bottom = 'auto';
            panel.style.left = `${coords.x}px`;
            panel.style.top = `${coords.y - 45}px`; // アイコンの少し上に配置
            panel.style.transform = 'translate(-50%, -100%)'; // 完全に中央揃えで真上に吹き出し
            panel.style.zIndex = '1000';
            panel.style.pointerEvents = 'auto';
            
            // 吹き出しとしての視覚補正
            panel.style.borderRadius = '4px';
            panel.style.boxShadow = '0 -8px 24px rgba(0,0,0,0.65)';
        }

        const infoStageName = document.getElementById('info-stage-name');
        if (infoStageName) {
            const kanjis = ["零","一","二","三","四","五","六","七","八","九","十","十一","十二","十三","十四","十五","十六","十七","十八","十九","二十"];
            const prefix = stage.stage === 0 ? "修練" : `第${kanjis[stage.stage] || stage.stage}局`;
            infoStageName.innerText = `${prefix}: ${stage.name}`;
        }

        const infoEnemyList = document.getElementById('info-enemy-list');
        if (infoEnemyList) {
            infoEnemyList.innerHTML = '';
            const enemyTypes = ['歩', '香', '桂', '銀', '金', '角', '飛', '王', 'ポーン', 'ナイト', 'ビショップ', 'ルーク', 'クイーン', 'キング', 'ヨット'];
            
            enemyTypes.forEach(type => {
                const count = stage[type] || 0;
                if (count > 0) {
                    const li = document.createElement('li');
                    
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'enemy-name';
                    nameSpan.innerText = PIECE_NAMES[type] || type;

                    const countSpan = document.createElement('span');
                    countSpan.className = 'enemy-count';
                    countSpan.innerText = `× ${count}`;

                    li.appendChild(nameSpan);
                    li.appendChild(countSpan);
                    infoEnemyList.appendChild(li);
                }
            });
        }

        const clearedIndices = window.getClearedStages ? window.getClearedStages() : [];
        const isUnlocked = (currentIndex === 0) || clearedIndices.includes(currentIndex - 1);
        const startBtn = document.getElementById('stage-start-btn');
        if (startBtn) {
            startBtn.disabled = !isUnlocked;
        }
    }
}

/**
 * 各種UIの状態を最新に更新します。
 * @param {boolean} forceScroll 自動スクロール追従を強制するか否か
 */
function updateActiveStageUI(forceScroll = false) {
    updateUnlockState();
    updateAvatarAndScroll(forceScroll);
    updateStageInfoPanel();
}

/**
 * ステージ選択画面の各種パネルボタンへのイベントバインドを行います。
 */
function bindPanelEvents() {
    if (isEventsBound) return;
    
    const startBtn = document.getElementById('stage-start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            MapSystem.startSelectedStage();
        });
    }

    const backBtn = document.getElementById('stage-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            MapSystem.hide();
            const titleScreen = document.getElementById('title-screen');
            if (titleScreen) titleScreen.style.display = 'flex';
        });
    }
    
    isEventsBound = true;
}

/**
 * 進捗状況に合わせて各マスのアンロッククラス、難易度3段階自動着色、およびSVGラインを更新します。
 */
function updateUnlockState() {
    const clearedIndices = window.getClearedStages ? window.getClearedStages() : [];
    const currentIndex = STATE.currentStageIndex;

    const nodes = document.querySelectorAll('.stage-node');
    nodes.forEach((node, idx) => {
        const stage = MapSystem.stagesData[idx];
        if (!stage) return;

        const isCleared = clearedIndices.includes(idx);
        const isUnlocked = (idx === 0) || clearedIndices.includes(idx - 1);
        const isActive = (idx === currentIndex);

        node.classList.remove('locked', 'unlocked', 'cleared', 'active');
        node.classList.remove('node-easy', 'node-medium', 'node-hard');

        // 難易度を自動解析して3段階のクラスを付与
        const difficultyScore = calculateDifficultyScore(stage);
        const diffClass = getDifficultyClass(difficultyScore);
        node.classList.add(diffClass);

        if (isActive) {
            node.classList.add('active');
        } else if (isCleared) {
            node.classList.add('cleared');
        } else if (isUnlocked) {
            node.classList.add('unlocked');
        } else {
            node.classList.add('locked');
        }

        // 難易度に応じた基本パレット色の設定
        let difficultyColor = '#2ecc71'; // Easy: 青緑・若葉
        if (diffClass === 'node-medium') {
            difficultyColor = '#f39c12'; // Medium: 黄金・山吹
        } else if (diffClass === 'node-hard') {
            difficultyColor = '#e74c3c'; // Hard: 朱赤・辰砂
        }

        const icon = node.querySelector('.node-icon');
        if (icon) {
            icon.style.color = '';
            icon.style.background = '';
            icon.style.border = '';
            icon.style.boxShadow = '';

            if (isActive) {
                // 選択中：現在アクティブであることをアピールする強力な難易度カラー発光
                icon.style.border = `2.5px solid ${difficultyColor}`;
                icon.style.boxShadow = `0 0 16px ${difficultyColor}`;
                icon.style.color = difficultyColor;
                icon.style.background = '#1a1a1a'; // 漆黒の台座
            } else if (isCleared) {
                // クリア：渋みを持たせた落ち着いたトーンの難易度カラー
                icon.style.border = `1.5px solid ${difficultyColor}aa`;
                icon.style.color = difficultyColor;
                icon.style.background = '#2c2a29'; // 煤黒
                icon.style.opacity = '0.95';
            } else if (isUnlocked) {
                // 解放済み：挑戦可能をほのめかす点線の細枠
                icon.style.border = `1.5px dashed ${difficultyColor}99`;
                icon.style.color = `${difficultyColor}dd`;
                icon.style.background = '#eedcb3'; // 経年和紙調
            } else {
                // 未解放：濃霧に隠されたような極めて低いコントラスト
                icon.style.border = '1.2px solid rgba(139, 122, 102, 0.15)';
                icon.style.color = 'rgba(139, 122, 102, 0.22)';
                icon.style.background = 'rgba(139, 122, 102, 0.05)';
            }
        }
    });

    // SVG接続ルート線の更新（第一局から第二局、および以降のラインが消える現象を徹底修正）
    MapSystem.stagesData.forEach((stage, idx) => {
        const line = document.getElementById(`route-line-${idx}`);
        if (line) {
            const isCleared = clearedIndices.includes(idx);
            
            const current = nodeCoords[idx];
            const next = nodeCoords[idx + 1];
            let estimatedLength = SPACING_X;
            if (current && next) {
                const dx = next.x - current.x;
                const dy = next.y - current.y;
                estimatedLength = Math.sqrt(dx * dx + dy * dy);
            }
            
            // getTotalLength が未表示や 0 を返すバグへ確実に対処
            let length = estimatedLength;
            try {
                if (line.getTotalLength && line.getTotalLength() > 0) {
                    length = line.getTotalLength();
                }
            } catch (e) {
                length = estimatedLength;
            }

            if (!line.style.strokeDasharray || line.style.strokeDasharray === 'none' || parseFloat(line.style.strokeDasharray) === 0) {
                line.style.strokeDasharray = `${length}`;
                line.style.strokeDashoffset = `${length}`;
            }

            if (isCleared) {
                line.style.opacity = '0.96';
                line.style.strokeDashoffset = '0';
            } else {
                line.style.strokeDashoffset = `${length}`;
                line.style.opacity = '0';
            }
        }
    });
}

export const MapSystem = {
    stagesData: [],
    selectStageCallback: null,

    /**
     * ステージデータ配列とコールバック関数を受け取って一直線マップを初期化します。
     */
    init(stages, selectStageCallbackFn) {
        this.stagesData = stages;
        this.selectStageCallback = selectStageCallbackFn;
        nodeCoords.length = 0;

        const nodesContainer = document.getElementById('map-nodes-container');
        const svgContainer = document.getElementById('map-routes-svg');
        const template = document.getElementById('stage-node-template');

        if (nodesContainer) nodesContainer.innerHTML = '';
        if (svgContainer) svgContainer.innerHTML = '';

        // 1. 横一直線（等間隔）の座標算出
        stages.forEach((stage, index) => {
            const x = OFFSET_X + index * SPACING_X;
            const y = CONSTANT_Y;
            nodeCoords.push({ x, y });
        });

        // マップスクロール可能領域（幅）をステージ数に合わせて動的に拡張
        const mapContainer = document.getElementById('map-container');
        if (mapContainer) {
            const totalWidth = OFFSET_X * 2 + (stages.length - 1) * SPACING_X;
            mapContainer.style.width = `${totalWidth}px`;
            mapContainer.style.height = `2500px`;
        }

        // 2. SVGによる街道風接続ルート線の構築
        if (svgContainer) {
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            defs.innerHTML = `
                <filter id="emaki-brush-filter" x="-20%" y="-20%" width="140%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
                </filter>
            `;
            svgContainer.appendChild(defs);

            for (let i = 0; i < stages.length - 1; i++) {
                const current = nodeCoords[i];
                const next = nodeCoords[i + 1];
                if (current && next) {
                    // 一直線上に整列させつつ、手描き古地図の「街道」風に緩やかにYをうねらせる（2次ベジェ曲線）
                    const waveAmplitude = Math.sin(i * 1.5) * 15; 
                    const controlX = (current.x + next.x) / 2;
                    const controlY = (current.y + next.y) / 2 + waveAmplitude;
                    
                    const pathD = `M ${current.x} ${current.y} Q ${controlX} ${controlY} ${next.x} ${next.y}`;

                    // 【背景線】かすれ墨街道
                    const bgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    bgPath.setAttribute('d', pathD);
                    bgPath.setAttribute('class', 'map-route-line route-bg');
                    bgPath.setAttribute('filter', 'url(#emaki-brush-filter)');
                    bgPath.style.fill = 'none';
                    bgPath.style.stroke = '#8b7a66';
                    bgPath.style.strokeWidth = '3.5px';
                    bgPath.style.strokeDasharray = '7 4 2 4';
                    bgPath.style.opacity = '0.4';
                    svgContainer.appendChild(bgPath);

                    // 【進行線】アンロックに同期して満ちる辰砂朱
                    const activePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    activePath.setAttribute('d', pathD);
                    activePath.setAttribute('class', 'map-route-line route-active');
                    activePath.setAttribute('id', `route-line-${i}`);
                    activePath.setAttribute('filter', 'url(#emaki-brush-filter)');
                    activePath.style.fill = 'none';
                    activePath.style.stroke = '#c93a20'; // 辰砂朱
                    activePath.style.strokeWidth = '4.5px';
                    activePath.style.strokeLinecap = 'round';
                    activePath.style.opacity = '0';
                    activePath.style.transition = 'stroke-dashoffset 2.2s cubic-bezier(0.42, 0, 0.58, 1), opacity 0.6s ease';
                    svgContainer.appendChild(activePath);
                }
            }
        }

        // 3. 各ステージマスの動的生成（一文字アイコンを廃止し、ステージ番号を表示）
        if (nodesContainer && template) {
            stages.forEach((stage, index) => {
                const coords = nodeCoords[index];
                if (!coords) return;

                const clone = template.content.cloneNode(true);
                const node = clone.querySelector('.stage-node');
                
                node.style.left = `${coords.x}px`;
                node.style.top = `${coords.y}px`;
                node.setAttribute('data-stage-index', index);

                const icon = node.querySelector('.node-icon');
                if (icon) {
                    icon.innerText = stage.stage; // 敵の一文字を廃止し、ステージ番号を表示
                }

                node.addEventListener('click', () => {
                    const clearedIndices = window.getClearedStages ? window.getClearedStages() : [];
                    const isUnlocked = (index === 0) || clearedIndices.includes(index - 1);
                    if (isUnlocked) {
                        STATE.currentStageIndex = index;
                        updateActiveStageUI(true); // クリック時（ステージ変更時）のみ強制追従スクロール
                    }
                });

                nodesContainer.appendChild(node);
            });
        }

        // 初期アバターの強制位置・スクロール同期
        const clearedIndices = window.getClearedStages ? window.getClearedStages() : [];
        let defaultIndex = 0;
        if (clearedIndices.length > 0) {
            const maxClearedIndex = Math.max(...clearedIndices);
            if (maxClearedIndex + 1 < stages.length) {
                defaultIndex = maxClearedIndex + 1;
            } else {
                defaultIndex = maxClearedIndex;
            }
        }
        
        const isCurrentUnlocked = (STATE.currentStageIndex === 0) || clearedIndices.includes(STATE.currentStageIndex - 1);
        if (STATE.currentStageIndex === undefined || STATE.currentStageIndex === null || STATE.currentStageIndex < 0 || STATE.currentStageIndex >= stages.length || !isCurrentUnlocked) {
            STATE.currentStageIndex = defaultIndex;
        }

        bindPanelEvents();
        updateActiveStageUI(true); // 初期ロード時は中央に強制追従
    },

    /**
     * マップ画面を表示し、スクロールを対象に強制追従させます。
     */
    show() {
        const stageSelectMenu = document.getElementById('stage-select-menu');
        if (stageSelectMenu) {
            stageSelectMenu.style.display = 'flex';
        }
        updateActiveStageUI(true); // 画面表示時は強制追従
    },

    /**
     * マップ画面を非表示にします。
     */
    hide() {
        const stageSelectMenu = document.getElementById('stage-select-menu');
        if (stageSelectMenu) {
            stageSelectMenu.style.display = 'none';
        }
        if (scrollAnimationId) {
            cancelAnimationFrame(scrollAnimationId);
        }
    },

    /**
     * 進行度の変化を検知してクラス適用状態を更新します（スクロール阻害なし）。
     */
    updateMapState() {
        updateActiveStageUI(false); // 内部更新時は自動追従スクロールをかけない
    },

    /**
     * 進行度の変化を検知してクラス適用状態を更新します（下位互換性確保用）。
     */
    updateUnlockState() {
        updateActiveStageUI(false); // 内部更新時は自動追従スクロールをかけない
    },

    /**
     * キーボード（矢印キー、WASD、Enter）での移動および決定入力を処理します。
     */
    handleKeyDown(event) {
        switch (event.code) {
            case 'ArrowLeft':
            case 'KeyA':
                event.preventDefault();
                this.moveAvatar('left');
                break;
            case 'ArrowRight':
            case 'KeyD':
                event.preventDefault();
                this.moveAvatar('right');
                break;
            case 'Enter':
            case 'NumpadEnter':
                event.preventDefault();
                this.startSelectedStage();
                break;
        }
    },

    /**
     * 操作方向に基づき、隣接するアンロック済みノードへ移動させます。
     * @param {string} direction 移動方向 (left / right)
     */
    moveAvatar(direction) {
        const currentIndex = STATE.currentStageIndex;
        const currentCoords = nodeCoords[currentIndex];
        if (!currentCoords) return;

        const candidates = [];
        if (currentIndex > 0) candidates.push(currentIndex - 1);
        if (currentIndex < this.stagesData.length - 1) candidates.push(currentIndex + 1);

        const clearedIndices = window.getClearedStages ? window.getClearedStages() : [];
        const validCandidates = candidates.filter(idx => {
            return (idx === 0) || clearedIndices.includes(idx - 1);
        });

        let bestTargetIndex = -1;
        let minDistance = Infinity;

        for (const i of validCandidates) {
            const targetCoords = nodeCoords[i];
            if (!targetCoords) continue;

            const dx = targetCoords.x - currentCoords.x;
            const distance = Math.abs(dx);

            let nodeDir = dx > 0 ? 'right' : 'left';

            if (nodeDir === direction) {
                if (distance < minDistance) {
                    minDistance = distance;
                    bestTargetIndex = i;
                }
            }
        }

        if (bestTargetIndex !== -1) {
            STATE.currentStageIndex = bestTargetIndex;
            updateActiveStageUI(true); // 手動での方向指示操作による移動は、アバターを見失わないため強制追従
        }
    },

    /**
     * 仮想操作パッド入力用移動処理（moveAvatarへ委譲）。
     */
    handleMapMovement(direction) {
        this.moveAvatar(direction);
    },

    /**
     * 現在選択中のステージを開始させます。
     */
    startSelectedStage() {
        const currentIndex = STATE.currentStageIndex;
        const clearedIndices = window.getClearedStages ? window.getClearedStages() : [];
        const isUnlocked = (currentIndex === 0) || clearedIndices.includes(currentIndex - 1);

        if (isUnlocked && typeof this.selectStageCallback === 'function') {
            this.selectStageCallback(currentIndex);
        }
    }
};
