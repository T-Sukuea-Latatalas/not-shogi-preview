import { STATE, PIECE_NAMES } from './constants.js';

const nodeCoords = [];
let isEventsBound = false;
let scrollAnimationId = null; // スムーズな絵巻物風スクロールを制御するアニメーションID

// 蛇行してグリッド状にノードを配置するための定数
const COLS = 5;
const SPACING_X = 400;
const SPACING_Y = 320;
const OFFSET_X = 300;
const OFFSET_Y = 350;

/**
 * 駒の重要度（格）を判別し、和のデザイン表現に同期するための分類を返します。
 * 絵巻物の風格に合わせ、最高格（royal）、強駒（major）、歩卒（minor）に分類します。
 */
function getPieceRankClass(stageData) {
    const priority = [
        'ヨット', 'Yacht', 'キング', 'K', '王', 'クイーン', 'Q', '飛', '角', 
        'ルーク', 'R', 'ビショップ', 'B', '金', '銀', '桂', 'N', 'ナイト', '香', 'ポーン', 'P', '歩'
    ];
    let matchedKey = '歩';
    for (const key of priority) {
        if (stageData[key] && stageData[key] > 0) {
            matchedKey = key;
            break;
        }
    }

    const royal = ['王', 'キング', 'K', 'ヨット', 'Yacht', 'クイーン', 'Q'];
    const major = ['飛', '角', 'ルーク', 'R', 'ビショップ', 'B', '金', '銀', '桂', 'N', 'ナイト'];
    
    if (royal.includes(matchedKey)) {
        return 'piece-royal'; // 金泥・漆黒（最高格の威厳）
    } else if (major.includes(matchedKey)) {
        return 'piece-major'; // 朱砂・深紺（戦局を左右する強駒）
    } else {
        return 'piece-minor'; // 薄墨・木肌（盤面を支える歩卒）
    }
}

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
 * カスタムのイージング関数を用いて、ビューポートを滑らかにスクロールさせます。
 * 古い絵巻物をそっと紐解くような、優美で高級感のある追従動作を実現します。
 */
function smoothScrollTo(viewport, targetLeft, targetTop) {
    if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId);
    }

    // ビューポートの限界スクロール値を考慮
    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
    const maxScrollTop = viewport.scrollHeight - viewport.clientHeight;
    const clampedTargetLeft = Math.max(0, Math.min(targetLeft, maxScrollLeft));
    const clampedTargetTop = Math.max(0, Math.min(targetTop, maxScrollTop));

    // イージング係数（小さいほど滑らかかつ上品に減速します）
    const easeFactor = 0.07;

    function step() {
        const currentLeft = viewport.scrollLeft;
        const currentTop = viewport.scrollTop;

        const diffLeft = clampedTargetLeft - currentLeft;
        const diffTop = clampedTargetTop - currentTop;

        // 十分に目標値へ近づいた場合はアニメーションを終了してピクセルを合わせる
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
        
        const targetLeft = coords.x - viewportWidth / 2;
        const targetTop = coords.y - viewportHeight / 2;

        // 滑らかなスクロールイージングを実行
        smoothScrollTo(viewport, targetLeft, targetTop);
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
 * 駒の風格を活かした色相・明度のコントラスト制御もここで行います。
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

        // 駒の重要度に応じたクラスの付与と、和風デザインの同期
        const stage = MapSystem.stagesData[idx];
        const rankClass = stage ? getPieceRankClass(stage) : 'piece-minor';
        node.classList.remove('piece-royal', 'piece-major', 'piece-minor');
        node.classList.add(rankClass);

        if (isActive) {
            node.classList.add('active');
        } else if (isCleared) {
            node.classList.add('cleared');
        } else if (isUnlocked) {
            node.classList.add('unlocked');
        } else {
            node.classList.add('locked');
        }

        // コントラストと風格を活かした、動的な和紙・金泥・朱砂・薄墨の色彩制御
        const icon = node.querySelector('.node-icon');
        if (icon) {
            icon.style.color = '';
            icon.style.background = '';
            icon.style.border = '';
            icon.style.boxShadow = '';

            if (isActive) {
                // 現在選択中：絵巻物の中で最も際立つ「黄金の光彩」と重厚な縁取り
                icon.style.border = '2.5px solid #d4af37';
                icon.style.boxShadow = '0 0 16px rgba(212, 175, 55, 0.9)';
                if (rankClass === 'piece-royal') {
                    icon.style.color = '#d4af37'; // 燦然と輝く金泥
                    icon.style.background = '#1a1a1a'; // 漆黒の台座
                } else if (rankClass === 'piece-major') {
                    icon.style.color = '#c93a20'; // 鮮烈な朱砂
                    icon.style.background = '#fcfaf2'; // 生成り色の和紙
                } else {
                    icon.style.color = '#2c3e50'; // 深い藍
                    icon.style.background = '#fcfaf2';
                }
            } else if (isCleared) {
                // 攻略済み：古びた風格を漂わせる落ち着いた和の色相
                icon.style.border = '1.5px solid #8b7a66';
                if (rankClass === 'piece-royal') {
                    icon.style.color = '#b08d32'; // 燻んだ金箔色
                    icon.style.background = '#2c2a29'; // 煤黒
                } else if (rankClass === 'piece-major') {
                    icon.style.color = '#9e2a16'; // 渋みのある辰砂（しんしゃ）
                    icon.style.background = '#eadaaf'; // 経年変化した古紙
                } else {
                    icon.style.color = '#555555'; // 炭色
                    icon.style.background = '#eadaaf';
                }
            } else if (isUnlocked) {
                // 未挑戦（解放済み）：これからの行軍を示す淡いインク調
                icon.style.border = '1.5px dashed #a89984';
                icon.style.color = '#7c6f64'; // 渋紙色
                icon.style.background = '#eedcb3'; // 絹本調の背景
            } else {
                // 未解放（ロック）：絵地図の霧に隠されたような極めて低いコントラスト
                icon.style.border = '1.2px solid rgba(139, 122, 102, 0.15)';
                icon.style.color = 'rgba(139, 122, 102, 0.25)'; // 地色に溶け込む薄墨
                icon.style.background = 'rgba(139, 122, 102, 0.06)';
            }
        }
    });

    // SVG接続ルート線の更新（朱の墨汁がじわじわと道を伝い染み込んでいく演出）
    MapSystem.stagesData.forEach((stage, idx) => {
        const line = document.getElementById(`route-line-${idx}`);
        if (line) {
            const isCleared = clearedIndices.includes(idx);
            
            // パスの長さを動的に算出、またはgetTotalLengthから取得
            const current = nodeCoords[idx];
            const next = nodeCoords[idx + 1];
            let estimatedLength = 500;
            if (current && next) {
                const dx = next.x - current.x;
                const dy = next.y - current.y;
                estimatedLength = Math.sqrt(dx * dx + dy * dy) * 1.15; // うねり補正
            }
            const length = line.getTotalLength ? (line.getTotalLength() || estimatedLength) : estimatedLength;

            // 初期化処理
            if (!line.style.strokeDasharray || line.style.strokeDasharray === 'none') {
                line.style.strokeDasharray = `${length}`;
                line.style.strokeDashoffset = `${length}`;
            }

            if (isCleared) {
                // じわじわと染み込んでいくトランジション演出
                line.style.opacity = '0.96';
                line.style.strokeDashoffset = '0';
            } else {
                // まだ朱が通っていない、あるいはリセット状態
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

        // 2. SVGによる接続ルート線の構築（古い街道や水脈のような手描き風の揺らぎ演出）
        if (svgContainer) {
            // 手描きかすれ風の微細な揺らぎを与えるSVGフィルターを定義
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            defs.innerHTML = `
                <filter id="emaki-brush-filter" x="-20%" y="-20%" width="140%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" />
                </filter>
            `;
            svgContainer.appendChild(defs);

            for (let i = 0; i < stages.length - 1; i++) {
                const current = nodeCoords[i];
                const next = nodeCoords[i + 1];
                if (current && next) {
                    // 直線ではなく、古地図の「街道」を思わせる有機的なうねり（2次ベジェ曲線）を計算
                    const dx = next.x - current.x;
                    const dy = next.y - current.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    const nx = -dy / distance;
                    const ny = dx / distance;
                    
                    // インデックスに応じてうねりの方向や振幅を変化させ、画一的でない豊かな表情を持たせます
                    const waveAmplitude = Math.sin(i * 1.7) * 40; 
                    const controlX = (current.x + next.x) / 2 + nx * waveAmplitude;
                    const controlY = (current.y + next.y) / 2 + ny * waveAmplitude;
                    
                    const pathD = `M ${current.x} ${current.y} Q ${controlX} ${controlY} ${next.x} ${next.y}`;

                    // 【背景線】古びた薄墨や渋紙色のかすれた街道表現
                    const bgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    bgPath.setAttribute('d', pathD);
                    bgPath.setAttribute('class', 'map-route-line route-bg');
                    bgPath.setAttribute('filter', 'url(#emaki-brush-filter)');
                    bgPath.style.fill = 'none';
                    bgPath.style.stroke = '#8b7a66'; // 古色を帯びた墨
                    bgPath.style.strokeWidth = '3.5px';
                    bgPath.style.strokeDasharray = '7 4 2 4'; // 手書きならではの不規則なかすれ表現
                    bgPath.style.opacity = '0.45';
                    svgContainer.appendChild(bgPath);

                    // 【進行線】アンロック時に朱の墨汁が静かに伝って染み込んでいくアクティブ表現
                    const activePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    activePath.setAttribute('d', pathD);
                    activePath.setAttribute('class', 'map-route-line route-active');
                    activePath.setAttribute('id', `route-line-${i}`);
                    activePath.setAttribute('filter', 'url(#emaki-brush-filter)');
                    activePath.style.fill = 'none';
                    activePath.style.stroke = '#c93a20'; // 深みのある辰砂（しんしゃ）の朱
                    activePath.style.strokeWidth = '4.5px';
                    activePath.style.strokeLinecap = 'round';
                    activePath.style.opacity = '0';
                    
                    // 朱がじわじわと満ちていく様を、2.5秒かけて優雅に描画トランジションさせます
                    activePath.style.transition = 'stroke-dashoffset 2.5s cubic-bezier(0.42, 0, 0.58, 1), opacity 0.8s ease';
                    svgContainer.appendChild(activePath);
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
        if (scrollAnimationId) {
            cancelAnimationFrame(scrollAnimationId);
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
