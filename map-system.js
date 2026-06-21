import { STATE, PIECE_NAMES } from './constants.js';

const nodeCoords = [];
let isEventsBound = false;

// 蛇行してグリッド状にノードを配置するための定数
const COLS = 5;
const SPACING_X = 400;
const SPACING_Y = 320;
const OFFSET_X = 300;
const OFFSET_Y = 350;

/**
 * 代表的な駒の一文字アイコンを判別して取得します。
 */
function getPieceIcon(stageData) {
    const priority = [
        'ヨット', 'Yacht', 'キング', 'K', '王', 'クイーン', 'Q', '飛', '角', 
        'ルーク', 'R', 'ビショップ', 'B', '金', '銀', '桂', 'N', 'ナイト', '香', 'ポーン', 'P', '歩'
    ];
    for (const key of priority) {
        if (stageData[key] && stageData[key] > 0) {
            if (key === 'ヨット' || key === 'Yacht') return 'ヨ';
            if (key === 'キング' || key === 'K') return 'キ';
            if (key === 'クイーン' || key === 'Q') return 'ク';
            if (key === 'ルーク' || key === 'R') return 'ル';
            if (key === 'ビショップ' || key === 'B') return 'ビ';
            if (key === 'ナイト' || key === 'N') return 'ナ';
            if (key === 'ポーン' || key === 'P') return 'ポ';
            return key[0];
        }
    }
    return '歩';
}

/**
 * アクティブなステージにアバターの位置を合わせ、ビューポートの中央にスクロール追従させます。
 */
function updateAvatarAndScroll() {
    const currentIndex = STATE.currentStageIndex;
    const coords = nodeCoords[currentIndex];
    const avatar = document.getElementById('player-avatar');
    if (avatar && coords) {
        avatar.style.left = `${coords.x}px`;
        avatar.style.top = `${coords.y}px`;
    }

    const viewport = document.querySelector('.map-viewport');
    if (viewport && coords) {
        const viewportWidth = viewport.clientWidth;
        const viewportHeight = viewport.clientHeight;
        
        viewport.scrollLeft = coords.x - viewportWidth / 2;
        viewport.scrollTop = coords.y - viewportHeight / 2;
    }
}

/**
 * 選択中ステージの情報パネルの描画内容を更新します。
 */
function updateStageInfoPanel() {
    const currentIndex = STATE.currentStageIndex;
    const stage = MapSystem.stagesData[currentIndex];
    if (!stage) return;

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

    // 進捗（アンロック状態）に応じた開始ボタンの有効化制御
    const clearedIndices = window.getClearedStages ? window.getClearedStages() : [];
    const isUnlocked = (currentIndex === 0) || clearedIndices.includes(currentIndex - 1);
    const startBtn = document.getElementById('stage-start-btn');
    if (startBtn) {
        startBtn.disabled = !isUnlocked;
    }
}

/**
 * 各種UIの状態を一括して最新に更新します。
 */
function updateActiveStageUI() {
    updateUnlockState();
    updateAvatarAndScroll();
    updateStageInfoPanel();
}

/**
 * ステージ選択画面の各種ボタンへのイベントバインドを行います。
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
 * 進捗状況に合わせて各マスのアンロッククラスおよびSVGラインを更新します。
 */
function updateUnlockState() {
    const clearedIndices = window.getClearedStages ? window.getClearedStages() : [];
    const currentIndex = STATE.currentStageIndex;

    const nodes = document.querySelectorAll('.stage-node');
    nodes.forEach((node, idx) => {
        const isCleared = clearedIndices.includes(idx);
        const isUnlocked = (idx === 0) || clearedIndices.includes(idx - 1);
        const isActive = (idx === currentIndex);

        node.classList.remove('locked', 'unlocked', 'cleared', 'active');

        if (isActive) {
            node.classList.add('active');
        } else if (isCleared) {
            node.classList.add('cleared');
        } else if (isUnlocked) {
            node.classList.add('unlocked');
        } else {
            node.classList.add('locked');
        }
    });

    // SVG接続ルート線の更新
    MapSystem.stagesData.forEach((stage, idx) => {
        const line = document.getElementById(`route-line-${idx}`);
        if (line) {
            const isCleared = clearedIndices.includes(idx);
            if (isCleared) {
                line.classList.add('unlocked');
            } else {
                line.classList.remove('unlocked');
            }
        }
    });
}

export const MapSystem = {
    stagesData: [],
    selectStageCallback: null,

    /**
     * ステージデータ配列とコールバック関数を受け取って初期化します。
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

        // 1. 各ステージの位置座標（蛇行配置）の算出
        stages.forEach((stage, index) => {
            const row = Math.floor(index / COLS);
            let col = index % COLS;
            if (row % 2 === 1) {
                col = (COLS - 1) - col; // 奇数行は右から左へ蛇行
            }
            const x = OFFSET_X + col * SPACING_X;
            const y = OFFSET_Y + row * SPACING_Y;
            nodeCoords.push({ x, y });
        });

        // 2. SVGによる接続ルート線の構築
        if (svgContainer) {
            for (let i = 0; i < stages.length - 1; i++) {
                const current = nodeCoords[i];
                const next = nodeCoords[i + 1];
                if (current && next) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', current.x);
                    line.setAttribute('y1', current.y);
                    line.setAttribute('x2', next.x);
                    line.setAttribute('y2', next.y);
                    line.setAttribute('class', 'map-route-line');
                    line.setAttribute('id', `route-line-${i}`);
                    svgContainer.appendChild(line);
                }
            }
        }

        // 3. 各ステージマスの動的生成
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
                    icon.innerText = getPieceIcon(stage);
                }

                // マスクリックでの選択処理
                node.addEventListener('click', () => {
                    const clearedIndices = window.getClearedStages ? window.getClearedStages() : [];
                    const isUnlocked = (index === 0) || clearedIndices.includes(index - 1);
                    if (isUnlocked) {
                        STATE.currentStageIndex = index;
                        updateActiveStageUI();
                    }
                });

                nodesContainer.appendChild(node);
            });
        }

        // アバターの安全な初期位置同期
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
        updateActiveStageUI();
    },

    /**
     * マップ画面を表示し、スクロール位置をアバターに追従させます。
     */
    show() {
        const stageSelectMenu = document.getElementById('stage-select-menu');
        if (stageSelectMenu) {
            stageSelectMenu.style.display = 'flex';
        }
        updateActiveStageUI();
    },

    /**
     * マップ画面を非表示にします。
     */
    hide() {
        const stageSelectMenu = document.getElementById('stage-select-menu');
        if (stageSelectMenu) {
            stageSelectMenu.style.display = 'none';
        }
    },

    /**
     * 進行度（クリア済みステージ）の変化を検知してクラス適用状態を更新します。
     */
    updateMapState() {
        updateActiveStageUI();
    },

    /**
     * updateMapStateと同様にアンロック表示状態を更新します（下位互換性確保）。
     */
    updateUnlockState() {
        updateActiveStageUI();
    },

    /**
     * キーボード（矢印キー、WASD、Enter）でのマップ移動および決定入力を処理します。
     */
    handleKeyDown(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                event.preventDefault();
                this.moveAvatar('up');
                break;
            case 'ArrowDown':
            case 'KeyS':
                event.preventDefault();
                this.moveAvatar('down');
                break;
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
     * 仮想操作パッドの方向指示に基づき、指定方向にある隣接するアンロック済みノードへ移動します。
     */
    moveAvatar(direction) {
        const currentIndex = STATE.currentStageIndex;
        const currentCoords = nodeCoords[currentIndex];
        if (!currentCoords) return;

        // 隣接する前後1ステップのみに移動制限をかけ、ワープを防ぎます
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
            const dy = targetCoords.y - currentCoords.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            let nodeDir = '';
            if (Math.abs(dx) > Math.abs(dy)) {
                nodeDir = dx > 0 ? 'right' : 'left';
            } else {
                nodeDir = dy > 0 ? 'down' : 'up';
            }

            if (nodeDir === direction) {
                if (distance < minDistance) {
                    minDistance = distance;
                    bestTargetIndex = i;
                }
            }
        }

        if (bestTargetIndex !== -1) {
            STATE.currentStageIndex = bestTargetIndex;
            updateActiveStageUI();
        }
    },

    /**
     * 仮想十字キーの入力ハンドラ（moveAvatarへの委譲による互換処理）。
     */
    handleMapMovement(direction) {
        this.moveAvatar(direction);
    },

    /**
     * 現在選択しているアンロック済みステージに対し、対局開始（コールバック関数の実行）を指示します。
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