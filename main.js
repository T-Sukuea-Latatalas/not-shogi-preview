import * as THREE from 'three';
import { 
    COLORS, STATE, PIECE_NAMES, GRAVITY, JUMP_FORCE, GROUND_Y, EYE_HEIGHT, 
    DASH_MULT, BOARD_SIZE, BOARD_THICKNESS, PLAYER, UPGRADE_COSTS, upgradeKeys, 
    joystickVector, SPREADSHEET_ID, SHEET_GID, FALLBACK_STAGES, PRACTICE_PIECES, isTouchDevice
} from './constants.js';
import { AssetFactory, createBamboo, createRock, createLantern } from './assets.js';
import { Projectile, Item, Enemy } from './entities.js';
import { MapSystem } from './map-system.js';
import { DeviceManager } from './device-manager.js';
import { InputHandler } from './input-handler.js';
import { UIManager } from './ui-manager.js';
import { DummyEnemy } from './dummy-enemy.js';
import { 
    loadPlayerData, savePlayerData, getClearedStages, saveClearedStage, 
    getUnlockedPieces, upgradeByIndex, activateDebugMode 
} from './save-manager.js';
import { loadStages, startWithFallback, EXTENDED_FALLBACK_STAGES } from './stage-manager.js';

// ファイルスコープ変数の宣言
let deviceManager;
let inputHandler;
let uiManager;
const ALL_PRACTICE_PIECES = PRACTICE_PIECES;

/**
 * ゲームエンジン全体の初期化とイベント設定を行い起動します。
 */
function start() {
    initGame();
    setupEvents();
}

// DOM構築完了時、またはロード後に安全に開始させます
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    start();
} else {
    window.addEventListener('DOMContentLoaded', start);
}

/**
 * Three.js を用いて3Dシーンや和風環境、将棋盤オブジェクトを作成し
 * 各種マネージャーと連携させます。
 */
function initGame() {
    const skyColor = 0xf0f0f0;
    const fogColor = 0xf0f0f0;
    const sunColor = 0xfffcf3;
    const sunIntensity = 1.3;
    const ambientColor = 0xffffff;
    const ambientIntensity = 0.8;
    const celestialColor = 0xfffbe0;
    const celestialPos = new THREE.Vector3(40, 200, 40);
    const celestialRadius = 15;

    // プレイヤーの保存状態をロード
    loadPlayerData();

    // 状態管理用オブジェクトのプロパティ初期化
    STATE.takeDamage = takeDamage;
    STATE.playerStunTime = 0;
    STATE.introActive = false; 
    STATE.introUpdate = null;

    // シーンとフォグ（和室の空気感を演出する環境霞）の設定
    STATE.scene = new THREE.Scene();
    STATE.scene.background = new THREE.Color(skyColor);
    STATE.scene.fog = new THREE.FogExp2(fogColor, 0.0035);

    // 遠近カメラの設定
    STATE.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    STATE.camera.rotation.order = 'YXZ';
    STATE.camera.position.set(0, GROUND_Y + EYE_HEIGHT, 0);

    // レンダラーの作成と設定（シャドウマップ有効化、画面比調整）
    STATE.renderer = new THREE.WebGLRenderer({ antialias: true });
    STATE.renderer.domElement.style.touchAction = 'none';
    STATE.renderer.setSize(window.innerWidth, window.innerHeight);
    STATE.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    STATE.renderer.shadowMap.enabled = true;
    STATE.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(STATE.renderer.domElement);

    // 環境光の追加
    const ambient = new THREE.AmbientLight(ambientColor, ambientIntensity); 
    STATE.scene.add(ambient);
    
    // ソフトシャドウ投影対応ディレクショナル光源（陽光）
    STATE.sun = new THREE.DirectionalLight(sunColor, sunIntensity); 
    STATE.sun.position.set(60, 80, 40); 
    STATE.sun.castShadow = true; 
    STATE.sun.shadow.mapSize.width = 2048;
    STATE.sun.shadow.mapSize.height = 2048;
    STATE.sun.shadow.camera.near = 0.5;
    STATE.sun.shadow.camera.far = 200;
    const d = 60;
    STATE.sun.shadow.camera.left = -d;
    STATE.sun.shadow.camera.right = d;
    STATE.sun.shadow.camera.top = d;
    STATE.sun.shadow.camera.bottom = -d;
    STATE.sun.shadow.bias = -0.0005;
    STATE.scene.add(STATE.sun);

    // 空に浮かぶ発光天体球の配置
    const celestialGeom = new THREE.SphereGeometry(celestialRadius, 32, 32);
    const celestialMat = new THREE.MeshBasicMaterial({ color: celestialColor, fog: false });
    const celestialMesh = new THREE.Mesh(celestialGeom, celestialMat);
    celestialMesh.position.copy(celestialPos);
    STATE.scene.add(celestialMesh);
    STATE.celestialBody = celestialMesh;

    // 空中の和風流れ雲群の配置
    const cloudCount = 12 + Math.floor(Math.random() * 4);
    for (let i = 0; i < cloudCount; i++) {
        const cloudGroup = new THREE.Group();
        const partCount = 3 + Math.floor(Math.random() * 4);
        const cloudColor = 0xffffff;
        const cloudOpacity = 0.55;

        for (let j = 0; j < partCount; j++) {
            const rx = 5 + Math.random() * 8;
            const ry = 2.5 + Math.random() * 3.5;
            const rz = 5 + Math.random() * 8;
            const geom = new THREE.DodecahedronGeometry(1, 1);
            geom.scale(rx, ry, rz);

            const mat = new THREE.MeshBasicMaterial({
                color: cloudColor, transparent: true, opacity: cloudOpacity, fog: false
            });
            const part = new THREE.Mesh(geom, mat);
            part.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 14);
            cloudGroup.add(part);
        }

        const cx = (Math.random() - 0.5) * 600;
        const cy = 60 + Math.random() * 20;
        const cz = (Math.random() - 0.5) * 500;
        cloudGroup.position.set(cx, cy, cz);
        cloudGroup.userData = { speed: 0.04 + Math.random() * 0.08 };

        STATE.scene.add(cloudGroup);
        STATE.clouds.push(cloudGroup);
    }

    // 駒および木目の事前準備
    AssetFactory.init();

    // 苔庭の3Dベース地盤
    const mossTex = AssetFactory.createMossTexture();
    mossTex.wrapS = THREE.RepeatWrapping;
    mossTex.wrapT = THREE.RepeatWrapping;
    mossTex.repeat.set(12, 12);
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 1000), 
        new THREE.MeshStandardMaterial({ map: mossTex, roughness: 1.0, metalness: 0.0 })
    );
    floor.rotation.x = -Math.PI / 2; 
    floor.receiveShadow = true; 
    STATE.scene.add(floor);

    // 枯山水の白砂床
    const sandTex = AssetFactory.createKaresansuiTexture();
    const sandFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(160, 160),
        new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.9, metalness: 0.0 })
    );
    sandFloor.rotation.x = -Math.PI / 2;
    sandFloor.position.y = 0.02; 
    sandFloor.receiveShadow = true;
    STATE.scene.add(sandFloor);

    // 周囲を囲う竹林オブジェクトの生成
    const bambooGroup = new THREE.Group();
    const bambooCount = 120;
    for (let i = 0; i < bambooCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 85 + Math.random() * 115; 
        const bx = Math.cos(angle) * dist;
        const bz = Math.sin(angle) * dist;
        
        const bamboo = createBamboo();
        bamboo.position.set(bx, 0, bz);
        bamboo.rotation.x = (Math.random() - 0.5) * 0.06;
        bamboo.rotation.z = (Math.random() - 0.5) * 0.06;
        bamboo.rotation.y = Math.random() * Math.PI;
        bambooGroup.add(bamboo);
    }
    STATE.scene.add(bambooGroup);

    // 和庭園の景石（岩）
    const rockGroup = new THREE.Group();
    const rockCount = 20;
    for (let i = 0; i < rockCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 65 + Math.random() * 25;
        const rx = Math.cos(angle) * dist;
        const rz = Math.sin(angle) * dist;
        
        const rock = createRock();
        rock.position.set(rx, 0, rz);
        rockGroup.add(rock);
    }
    STATE.scene.add(rockGroup);

    // 隅を照らす石灯篭
    const lanternPositions = [
        { x: -55, z: -55 }, { x: 55, z: -55 }, { x: -55, z: 55 }, { x: 55, z: 55 }
    ];
    lanternPositions.forEach(pos => {
        const lantern = createLantern();
        lantern.position.set(pos.x, 0, pos.z);
        lantern.scale.set(1.5, 1.5, 1.5); 
        STATE.scene.add(lantern);
    });

    // 盤上対決の舞台となる「木目の将棋盤」の作成
    STATE.boardGroup = new THREE.Group();

    const boardTopTex = AssetFactory.createWoodCanvas(null, COLORS.ink, true);
    const boardSideTex = AssetFactory.createWoodCanvas(null);
    const boardMaterials = [
        new THREE.MeshStandardMaterial({ map: boardSideTex, roughness: 0.8 }), 
        new THREE.MeshStandardMaterial({ map: boardSideTex, roughness: 0.8 }), 
        new THREE.MeshStandardMaterial({ map: boardTopTex, roughness: 0.8 }),  
        new THREE.MeshStandardMaterial({ map: boardSideTex, roughness: 0.8 }), 
        new THREE.MeshStandardMaterial({ map: boardSideTex, roughness: 0.8 }), 
        new THREE.MeshStandardMaterial({ map: boardSideTex, roughness: 0.8 })  
    ];

    const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(BOARD_SIZE, BOARD_THICKNESS, BOARD_SIZE), boardMaterials);
    boardMesh.position.y = GROUND_Y - BOARD_THICKNESS / 2; 
    boardMesh.receiveShadow = true;
    boardMesh.castShadow = true;
    STATE.boardGroup.add(boardMesh);

    // 将棋盤の四脚の伝統工芸彫刻を簡素に構築
    function createLeg(x, z) {
        const leg = new THREE.Group();
        const legMaterial = new THREE.MeshStandardMaterial({ map: boardSideTex, roughness: 0.8 });
        const bottomPart = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.8, 0.4, 16), legMaterial);
        bottomPart.position.y = 0.2; bottomPart.castShadow = true; leg.add(bottomPart);

        const midPart = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), legMaterial);
        midPart.scale.set(1, 0.6, 1); midPart.position.y = 1.1; midPart.castShadow = true; leg.add(midPart);

        const topPart = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 0.4, 16), legMaterial);
        topPart.position.y = 1.8; topPart.castShadow = true; leg.add(topPart);

        leg.position.set(x, 0, z);
        return leg;
    }

    const legOffset = BOARD_SIZE / 2 - 6;
    STATE.boardGroup.add(createLeg(-legOffset, -legOffset));
    STATE.boardGroup.add(createLeg(legOffset, -legOffset));
    STATE.boardGroup.add(createLeg(-legOffset, legOffset));
    STATE.boardGroup.add(createLeg(legOffset, legOffset));

    STATE.scene.add(STATE.boardGroup);

    // リサイズ時の安全なプロジェクション更新
    window.addEventListener('resize', () => {
        if (STATE.camera && STATE.renderer) {
            STATE.camera.aspect = window.innerWidth / window.innerHeight;
            STATE.camera.updateProjectionMatrix();
            STATE.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    });

    // UIManager のインスタンス化と初期化
    uiManager = new UIManager({
        onUpgradeByIndex: (index) => {
            upgradeByIndex(index);
        }
    });
    uiManager.init();

    // InputHandler のインスタンス化と初期化
    inputHandler = new InputHandler({
        onToggleShop: () => {
            if (uiManager) uiManager.toggleShop();
        },
        onTogglePause: () => {
            togglePause();
        },
        onShoot: () => {
            PLAYER.isShooting = true;
        },
        onShootEnd: () => {
            PLAYER.isShooting = false;
        },
        onShopWheel: (deltaY) => {
            if (uiManager) uiManager.handleShopWheel(deltaY);
        },
        onShopRightClick: () => {
            if (uiManager) uiManager.buySelectedShopItem();
        },
        onActivateDebug: () => {
            activateDebugMode();
        },
        onMapMovement: (e) => {
            if (MapSystem && typeof MapSystem.handleKeyDown === 'function') {
                MapSystem.handleKeyDown(e);
            }
        },
        onMapTouchMovement: (direction) => {
            if (MapSystem) {
                if (typeof MapSystem.moveAvatar === 'function') {
                    MapSystem.moveAvatar(direction);
                } else if (typeof MapSystem.handleMapMovement === 'function') {
                    MapSystem.handleMapMovement(direction);
                }
            }
        },
        onMapSelect: () => {
            if (MapSystem && typeof MapSystem.startSelectedStage === 'function') {
                MapSystem.startSelectedStage();
            }
        }
    });
    inputHandler.init();

    // DeviceManager のインスタンス化と初期化
    deviceManager = new DeviceManager((isTouch) => {
        if (inputHandler) {
            inputHandler.setTouchMode(isTouch);
        }
    });
    deviceManager.init();

    // グローバルな通知・テキスト表示ブリッジの登録
    window.showMsg = (txt) => {
        if (uiManager) uiManager.showMsg(txt);
    };

    // 進行度（クリア済みインデックス配列）を外部および MapSystem に返す
    window.getClearedStages = function() {
        const clearedNums = getClearedStages();
        const clearedIndices = [];
        if (STATE.stages) {
            STATE.stages.forEach((stg, idx) => {
                if (clearedNums.includes(stg.stage)) {
                    clearedIndices.push(idx);
                }
            });
        }
        return clearedIndices;
    };

    // 初期の入力デバイスモード設定
    if (inputHandler) {
        inputHandler.setTouchMode(isTouchDevice);
    }

    if (uiManager) {
        uiManager.updateUI(); 
    }
    animate();
}

/**
 * 盤上ステージから不要になった動的3Dオブジェクトを完全にメモリから破棄します。
 */
function cleanUp3DObjects() {
    if (STATE.enemies) {
        STATE.enemies.forEach(en => { 
            if (en) {
                if (typeof en.destroy === 'function') {
                    try {
                        en.destroy();
                    } catch (e) {
                        console.error("エネミーオブジェクトの破棄中にエラーが発生しました:", e);
                    }
                } else if (en.mesh && STATE.scene) {
                    STATE.scene.remove(en.mesh); 
                }
            }
        });
    }
    if (STATE.bullets) {
        STATE.bullets.forEach(b => { if(b && b.mesh && STATE.scene) STATE.scene.remove(b.mesh); });
    }
    if (STATE.enemyBullets) {
        STATE.enemyBullets.forEach(eb => { if(eb && eb.mesh && STATE.scene) STATE.scene.remove(eb.mesh); });
    }
    if (STATE.items) {
        STATE.items.forEach(it => { if(it && it.mesh && STATE.scene) STATE.scene.remove(it.mesh); });
    }

    STATE.enemies = [];
    STATE.bullets = [];
    STATE.enemyBullets = [];
    STATE.items = [];
}

/**
 * 現在展開中のゲームステージを終了させ、ポーズ状態やUI、ポインターロックをリセットします。
 */
function cleanUpStage() {
    STATE.stageActive = false;
    STATE.isPaused = false;
    STATE.isGameOver = false;
    STATE.introActive = false;
    STATE.introUpdate = null;

    if (inputHandler) {
        inputHandler.resetInputs();
    }

    const introOverlay = document.getElementById('boss-intro-overlay');
    if (introOverlay && introOverlay.parentNode) {
        introOverlay.parentNode.removeChild(introOverlay);
    }
    
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'none';
    
    cleanUp3DObjects();

    const stageClearMenu = document.getElementById('stage-clear-menu');
    if (stageClearMenu) stageClearMenu.style.display = 'none';

    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) pauseMenu.style.display = 'none';

    const gameOverMenu = document.getElementById('game-over');
    if (gameOverMenu) gameOverMenu.style.display = 'none';

    if (document.pointerLockElement) {
        document.exitPointerLock();
    }
}

/**
 * マップシステム上の指定されたインデックスに対応する本戦ステージを開始します。
 */
function selectStage(index) {
    const stageSelectMenu = document.getElementById('stage-select-menu');
    if (stageSelectMenu) stageSelectMenu.style.display = 'none';
    const stageClearMenu = document.getElementById('stage-clear-menu');
    if (stageClearMenu) stageClearMenu.style.display = 'none';
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) pauseMenu.style.display = 'none';
    const gameOverMenu = document.getElementById('game-over');
    if (gameOverMenu) gameOverMenu.style.display = 'none';

    if (inputHandler) {
        inputHandler.resetInputs();
    }
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }

    STATE.currentStageIndex = index; 
    STATE.isPaused = false;
    STATE.isGameOver = false;
    startStage(STATE.stages[index]);
}

/**
 * 修練（一対一の練習モード）選択メニューのボタンをクリア状況に応じて動的に構築します。
 */
function buildPracticeMenu() {
    const container = document.getElementById('practice-piece-list');
    if (!container) return;
    container.innerHTML = '';
    const unlockedPieces = getUnlockedPieces();

    ALL_PRACTICE_PIECES.forEach(type => {
        const isUnlocked = unlockedPieces.has(type);
        if (!isUnlocked) return;

        const btn = document.createElement('button');
        btn.className = 'stage-btn';
        const fullName = PIECE_NAMES[type] || type;
        
        btn.onclick = () => startPracticeStage(type);
        btn.innerHTML = `<span>修練：${fullName}</span> <span style="color:#d4af37;">手合わせ</span>`;
        container.appendChild(btn);
    });
}

/**
 * 選択された種類に対応する駒との一対一対決ステージを開始します。
 */
function startPracticeStage(type) {
    const practiceSelectMenu = document.getElementById('practice-select-menu');
    if (practiceSelectMenu) practiceSelectMenu.style.display = 'none';
    STATE.isPractice = true;
    
    const fullName = PIECE_NAMES[type] || type;
    const practiceStage = {
        stage: 0,
        name: `修練・${fullName}`,
        歩: type === '歩' ? 1 : 0,
        香: type === '香' ? 1 : 0,
        桂: type === '桂' ? 1 : 0,
        銀: type === '銀' ? 1 : 0,
        金: type === '金' ? 1 : 0,
        角: type === '角' ? 1 : 0,
        飛: type === '飛' ? 1 : 0,
        王: type === '王' ? 1 : 0,
        ポーン: type === 'ポーン' ? 1 : 0,
        ナイト: type === 'ナイト' ? 1 : 0,
        ビショップ: type === 'ビショップ' ? 1 : 0,
        ルーク: type === 'ルーク' ? 1 : 0,
        クイーン: type === 'クイーン' ? 1 : 0,
        キング: type === 'キング' ? 1 : 0,
        ヨット: type === 'ヨット' ? 1 : 0
    };
    STATE.currentPracticeStage = practiceStage;
    startStage(practiceStage);
}

/**
 * 盤上支配者（王・キング・ヨット等）の出現時にカットシーンを走らせて警告を表示します。
 */
function triggerBossIntro(boss) {
    STATE.introActive = true;
    STATE.stageActive = true; 
    STATE.isPaused = false;
    
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }

    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'none'; 

    const introOverlay = document.createElement('div');
    introOverlay.id = 'boss-intro-overlay';
    introOverlay.style.position = 'absolute';
    introOverlay.style.top = '50%';
    introOverlay.style.left = '50%';
    introOverlay.style.transform = 'translate(-50%, -50%)';
    introOverlay.style.color = '#ae1f23';
    introOverlay.style.fontSize = '34px';
    introOverlay.style.fontWeight = 'bold';
    introOverlay.style.fontFamily = 'serif';
    introOverlay.style.textShadow = '0 0 10px rgba(174, 31, 35, 0.8), 2px 2px 4px #000';
    introOverlay.style.pointerEvents = 'none';
    introOverlay.style.zIndex = '9999';
    
    const bossName = (boss.type === 'ヨット' || boss.type === 'Yacht') ? 'ヨット' : 'キング';
    introOverlay.innerHTML = `⚠️ 警告 ⚠️<br>盤上の支配者『${bossName}』出現`;
    document.body.appendChild(introOverlay);

    const originalPos = new THREE.Vector3(0, GROUND_Y + EYE_HEIGHT, 0);
    const originalRotation = new THREE.Euler().copy(STATE.camera.rotation);
    
    const startTime = Date.now();
    const duration = 3000; 
    
    STATE.introUpdate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1.0, elapsed / duration);
        
        if (boss && boss.mesh) {
            const bossPos = boss.mesh.position.clone();
            const targetCamPos = new THREE.Vector3().lerpVectors(
                originalPos, 
                bossPos.clone().add(new THREE.Vector3(0, -2.0, 0)), 
                progress * 0.45 
            );
            STATE.camera.position.copy(targetCamPos);
            STATE.camera.lookAt(bossPos.x, bossPos.y + 1.5, bossPos.z);
        }
        
        if (progress >= 1.0) {
            STATE.introActive = false;
            STATE.introUpdate = null;
            if (introOverlay.parentNode) {
                introOverlay.parentNode.removeChild(introOverlay);
            }
            
            STATE.camera.position.copy(originalPos);
            STATE.camera.rotation.copy(originalRotation);
            
            if (uiLayer) uiLayer.style.display = 'block';
            if (uiManager) uiManager.updateUI();
            
            if (inputHandler && !inputHandler.currentTouchMode) {
                document.body.requestPointerLock();
            }
        }
    };
}

/**
 * 盤面をクリアした上で、指定の対戦ステージに必要なエネミー群を構築し開始します。
 */
function startStage(stageData) {
    cleanUp3DObjects();
    if (inputHandler) {
        inputHandler.resetInputs();
    }

    PLAYER.hp = PLAYER.maxHp;
    PLAYER.vy = 0;
    PLAYER.isGrounded = true;
    PLAYER.isShooting = false;
    if (STATE.camera) {
        STATE.camera.position.set(0, GROUND_Y + EYE_HEIGHT, 0);
        STATE.camera.rotation.set(0, 0, 0);
    }
    
    STATE.playerStunTime = 0;

    const kanjis = ["零","一","二","三","四","五","六","七","八","九","十","十一","十二","十三","十四","十五","十六","十七","十八","十九","二十"];
    const waveValEl = document.getElementById('wave-val');
    if (stageData.stage === 0) {
        if (waveValEl) waveValEl.innerText = "修";
        if (uiManager) uiManager.showMsg(stageData.name);
    } else {
        const waveName = kanjis[stageData.stage] || stageData.stage;
        if (waveValEl) waveValEl.innerText = waveName;
        if (uiManager) uiManager.showMsg("第" + waveName + "局：" + stageData.name);
    }

    const enemyTypes = ['歩', '香', '桂', '銀', '金', '角', '飛', '王', 'ポーン', 'ナイト', 'ビショップ', 'ルーク', 'クイーン', 'キング', 'ヨット'];
    const scale = 1 + (stageData.stage * 0.1);

    let bossEnemy = null;

    enemyTypes.forEach(type => {
        const count = stageData[type] || 0;
        for (let i = 0; i < count; i++) {
            const enemyScale = (type === 'ヨット' || type === 'Yacht') ? scale * 2.5 : scale;
            try {
                const enemy = new Enemy(type, enemyScale);
                STATE.enemies.push(enemy);
                if (type === 'ヨット' || type === 'Yacht' || type === '王' || type === 'キング' || type === 'K') {
                    bossEnemy = enemy;
                }
            } catch (error) {
                console.error(`エネミー [${type}] の生成に失敗しました。ダミーで代用します:`, error);
                try {
                    STATE.enemies.push(new DummyEnemy(type, enemyScale));
                } catch (fallbackError) {
                    console.error("フォールバック用ダミーエネミーの生成にも失敗しました:", fallbackError);
                }
            }
        }
    });

    STATE.isGameOver = false;

    if (bossEnemy) {
        triggerBossIntro(bossEnemy);
    } else {
        STATE.stageActive = true;
        STATE.isPaused = false;
        STATE.introActive = false;
        const uiLayer = document.getElementById('ui-layer');
        if (uiLayer) uiLayer.style.display = 'block';
        if (uiManager) uiManager.updateUI();

        if (inputHandler && !inputHandler.currentTouchMode) {
            document.body.requestPointerLock();
        }
    }
}

/**
 * プレイ中のステージ（通常/修練）を盤面そのまま最初からやり直します。
 */
function restartStage() {
    const gameOverMenu = document.getElementById('game-over');
    if (gameOverMenu) gameOverMenu.style.display = 'none';
    STATE.isGameOver = false;
    STATE.isPaused = false;
    if (STATE.isPractice) {
        startStage(STATE.currentPracticeStage);
    } else {
        startStage(STATE.stages[STATE.currentStageIndex]);
    }
}

/**
 * 盤上の敵をすべて一掃した際のクリア勝利UI（および桜吹雪演出）を起動します。
 */
function showStageClear() {
    STATE.stageActive = false;
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'none';
    
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }
    
    if (!STATE.isPractice) {
        const currentStage = STATE.stages[STATE.currentStageIndex];
        if (currentStage && typeof currentStage.stage !== 'undefined') {
            saveClearedStage(currentStage.stage);
            
            if (MapSystem && typeof MapSystem.updateMapState === 'function') {
                MapSystem.updateMapState();
            } else if (MapSystem && typeof MapSystem.updateUnlockState === 'function') {
                MapSystem.updateUnlockState();
            }
        }
    }

    const stageClearMenu = document.getElementById('stage-clear-menu');
    if (stageClearMenu) stageClearMenu.style.display = 'flex';
    
    const nextBtn = document.getElementById('btn-next-stage');
    const clearPracticeBtn = document.getElementById('btn-clear-practice');
    const clearBackBtn = document.getElementById('btn-clear-back');

    if (STATE.isPractice) {
        if (nextBtn) nextBtn.style.display = 'none';
        if (clearBackBtn) clearBackBtn.style.display = 'none';
        if (clearPracticeBtn) clearPracticeBtn.style.display = 'inline-block';
    } else {
        if (clearPracticeBtn) clearPracticeBtn.style.display = 'none';
        if (clearBackBtn) clearBackBtn.style.display = 'inline-block';
        if (STATE.currentStageIndex + 1 < STATE.stages.length) {
            if (nextBtn) nextBtn.style.display = 'inline-block';
        } else {
            if (nextBtn) nextBtn.style.display = 'none'; 
        }
    }

    savePlayerData();
}

/**
 * 接続路に沿って次の局の盤面に進行します。
 */
function nextStage() {
    if (STATE.currentStageIndex + 1 < STATE.stages.length) {
        selectStage(STATE.currentStageIndex + 1);
    }
}

/**
 * ゲームの進行状態とポーズメニューをトグルで切り替えます。
 */
function togglePause() {
    if (!STATE.stageActive || STATE.isGameOver || STATE.introActive) return; 
    if (STATE.isPaused) {
        resumeGame();
    } else {
        pauseGame();
    }
}

/**
 * ゲームを一時的に停止して、ポーズ画面を開きます。
 */
function pauseGame() {
    if (!STATE.stageActive || STATE.isGameOver || STATE.isPaused) return;
    if (STATE.shopOpen) {
        STATE.shopOpen = false;
        const shopMenu = document.getElementById('shop-menu');
        if (shopMenu) shopMenu.style.display = 'none';
    }
    STATE.isPaused = true;
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) pauseMenu.style.display = 'flex';
    
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }
    PLAYER.isShooting = false;

    const pauseBack = document.getElementById('btn-pause-back');
    const pausePractice = document.getElementById('btn-pause-practice');
    if (STATE.isPractice) {
        if (pauseBack) pauseBack.style.display = 'none';
        if (pausePractice) pausePractice.style.display = 'inline-block';
    } else {
        if (pauseBack) pauseBack.style.display = 'inline-block';
        if (pausePractice) pausePractice.style.display = 'none';
    }
    if (uiManager) uiManager.updateUI();
}

/**
 * ゲームを再開し、フォーカスを3Dビューに復帰させます。
 */
function resumeGame() {
    if (!STATE.stageActive || STATE.isGameOver || !STATE.isPaused) return;
    STATE.isPaused = false;
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) pauseMenu.style.display = 'none';
    if (inputHandler && !inputHandler.currentTouchMode) {
        document.body.requestPointerLock();
    }
    if (uiManager) uiManager.updateUI();
}

/**
 * プレイを中断し、すごろくマップ / 練習駒選択メニューに戻ります。
 */
function quitStageToSelect() {
    cleanUpStage();
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }
    if (STATE.isPractice) {
        const practiceSelectMenu = document.getElementById('practice-select-menu');
        if (practiceSelectMenu) practiceSelectMenu.style.display = 'flex';
        buildPracticeMenu();
    } else {
        const stageSelectMenu = document.getElementById('stage-select-menu');
        if (stageSelectMenu) {
            stageSelectMenu.style.display = 'flex';
            MapSystem.show();
        }
    }
}

/**
 * プレイヤーのカメラ視線に向けて上品な朱色（和テイスト）の光弾を放ちます。
 */
function shoot() {
    if (!STATE.camera) return;
    const dir = new THREE.Vector3(); 
    STATE.camera.getWorldDirection(dir);
    if (STATE.bullets) {
        STATE.bullets.push(new Projectile(STATE.camera.position.clone().add(new THREE.Vector3(0,-0.5,0)), dir, false, 3.0, 0.25));
    }
    PLAYER.lastShot = Date.now();
}

/**
 * 生命力（HP）にダメージを受け、朱色のビネット演出と共にゲームオーバーを判定します。
 */
export function takeDamage(amt) {
    if (STATE.isGameOver) return;
    if (STATE.isGodMode) return; 
    
    PLAYER.hp -= amt;
    if (uiManager) {
        uiManager.flashDamageVignette();
        uiManager.updateUI();
    }
    if (PLAYER.hp <= 0) {
        STATE.isGameOver = true;
        STATE.stageActive = false;
        const uiLayer = document.getElementById('ui-layer');
        if (uiLayer) uiLayer.style.display = 'none';
        const gameOverMenu = document.getElementById('game-over');
        if (gameOverMenu) gameOverMenu.style.display = 'flex';
        
        const goBack = document.getElementById('btn-go-back');
        const goPractice = document.getElementById('btn-go-practice');
        if (STATE.isPractice) {
            if (goBack) goBack.style.display = 'none';
            if (goPractice) goPractice.style.display = 'inline-block';
        } else {
            if (goBack) goBack.style.display = 'inline-block';
            if (goPractice) goPractice.style.display = 'none';
        }

        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }
}

/**
 * WebGL 毎フレーム描画、雲の動き、プレイヤーの動作制御と攻撃、敵のAIループ。
 */
function animate() {
    requestAnimationFrame(animate);

    if (STATE.isPaused || STATE.isGameOver) {
        if (STATE.renderer && STATE.scene && STATE.camera) {
            STATE.renderer.render(STATE.scene, STATE.camera);
        }
        return;
    }

    if (STATE.introActive) {
        if (typeof STATE.introUpdate === 'function') {
            STATE.introUpdate();
        }
        if (STATE.renderer && STATE.scene && STATE.camera) {
            STATE.renderer.render(STATE.scene, STATE.camera);
        }
        return;
    }

    if (!STATE.stageActive) {
        if (STATE.renderer && STATE.scene && STATE.camera) {
            STATE.renderer.render(STATE.scene, STATE.camera);
        }
        return;
    }

    // 1. プレイヤーの移動とクリエイティブ/物理演算補正
    const keys = (inputHandler && inputHandler.keys) ? inputHandler.keys : {};
    const moveDir = new THREE.Vector3();

    if (keys['KeyW'] || keys['ArrowUp']) moveDir.z -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) moveDir.z += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) moveDir.x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) moveDir.x += 1;
    moveDir.normalize();

    // タッチデバイス仮想パッド補正
    if (joystickVector && (joystickVector.x !== 0 || joystickVector.y !== 0)) {
        moveDir.set(joystickVector.x, 0, -joystickVector.y);
    }

    const camEuler = new THREE.Euler(0, STATE.camera.rotation.y, 0, 'YXZ');
    moveDir.applyEuler(camEuler);

    let currentSpeed = PLAYER.speed;
    if (keys['ShiftLeft'] || keys['ShiftRight'] || STATE.dashActive) {
        currentSpeed *= DASH_MULT;
    }

    if (STATE.isCreativeMode) {
        if (keys['Space']) {
            STATE.camera.position.y += 0.3;
        }
        if (keys['KeyC']) {
            STATE.camera.position.y -= 0.3;
        }
        STATE.camera.position.x += moveDir.x * currentSpeed;
        STATE.camera.position.z += moveDir.z * currentSpeed;
    } else {
        STATE.camera.position.x += moveDir.x * currentSpeed;
        STATE.camera.position.z += moveDir.z * currentSpeed;

        // 将棋盤の境界外への侵入を制限
        const limit = BOARD_SIZE / 2;
        if (STATE.camera.position.x < -limit) STATE.camera.position.x = -limit;
        if (STATE.camera.position.x > limit) STATE.camera.position.x = limit;
        if (STATE.camera.position.z < -limit) STATE.camera.position.z = -limit;
        if (STATE.camera.position.z > limit) STATE.camera.position.z = limit;

        // 跳躍の挙動
        if ((keys['Space'] || keys['KeySpace']) && PLAYER.isGrounded) {
            if (STATE.playerStunTime <= 0) {
                PLAYER.vy = JUMP_FORCE;
                PLAYER.isGrounded = false;
            }
        }

        if (!PLAYER.isGrounded) {
            PLAYER.vy += GRAVITY;
            STATE.camera.position.y += PLAYER.vy;
            
            const floorY = GROUND_Y + EYE_HEIGHT;
            if (STATE.camera.position.y <= floorY) {
                STATE.camera.position.y = floorY;
                PLAYER.vy = 0;
                PLAYER.isGrounded = true;
            }
        }
    }

    if (STATE.playerStunTime > 0) {
        STATE.playerStunTime -= 16; 
    }

    // 2. 自動射撃
    if (PLAYER.isShooting && STATE.playerStunTime <= 0) {
        const now = Date.now();
        if (now - PLAYER.lastShot >= PLAYER.fireRate) {
            shoot();
        }
    }

    // 3. 流れ雲の動き
    if (STATE.clouds) {
        STATE.clouds.forEach(cloud => {
            cloud.position.x += cloud.userData.speed;
            if (cloud.position.x > 350) {
                cloud.position.x = -350;
            }
        });
    }

    // 4. エネミー AI 更新ループ
    if (STATE.enemies) {
        for (let i = STATE.enemies.length - 1; i >= 0; i--) {
            const enemy = STATE.enemies[i];
            if (!enemy) continue;

            enemy.update(STATE.camera.position, STATE.enemies);

            // 撃破
            if (!enemy.alive) {
                const points = (enemy.type === '王' || enemy.type === 'キング' || enemy.type === 'ヨット' || enemy.type === 'Yacht') ? 1000 : 200;
                STATE.score += points;

                // 回復 / 銭回収アイテムのドロップ
                if (Math.random() < 0.4) {
                    const itemTypes = ['score', 'heal'];
                    const randType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
                    const droppedItem = new Item(enemy.mesh.position.clone());
                    droppedItem.type = randType; 
                    STATE.items.push(droppedItem);
                }

                enemy.destroy();
                STATE.enemies.splice(i, 1);
                if (uiManager) uiManager.updateUI();
            }
        }
    }

    // 5. プレイヤー弾の更新と衝突
    if (STATE.bullets) {
        for (let i = STATE.bullets.length - 1; i >= 0; i--) {
            const bullet = STATE.bullets[i];
            if (!bullet) continue;

            bullet.update();

            let hit = false;
            if (STATE.enemies) {
                for (let j = STATE.enemies.length - 1; j >= 0; j--) {
                    const enemy = STATE.enemies[j];
                    if (!enemy || !enemy.mesh || !enemy.alive) continue;

                    const isBoss = (enemy.type === 'ヨット' || enemy.type === 'Yacht');
                    const threshold = isBoss ? 5.0 : 2.2;
                    const enemyCorePos = enemy.mesh.position.clone();
                    
                    if (!isBoss) {
                        enemyCorePos.y += 1.0;
                    }

                    const dist = bullet.mesh.position.distanceTo(enemyCorePos);
                    if (dist < threshold) {
                        hit = true;
                        
                        const isDead = enemy.takeHit(PLAYER.power);
                        
                        if (uiManager) {
                            uiManager.flashCrosshair();
                        }
                        
                        if (isDead) {
                            enemy.alive = false;
                        }
                        break;
                    }
                }
            }

            const isOutOfRange = bullet.mesh.position.length() > 200;
            if (hit || !bullet.alive || isOutOfRange) {
                bullet.destroy();
                STATE.bullets.splice(i, 1);
            }
        }
    }

    // 6. 敵弾の更新と飛翔限界
    if (STATE.enemyBullets) {
        for (let i = STATE.enemyBullets.length - 1; i >= 0; i--) {
            const eb = STATE.enemyBullets[i];
            if (!eb) continue;

            eb.update();

            const isOutOfRange = eb.mesh.position.length() > 200;
            if (!eb.alive || isOutOfRange) {
                eb.destroy();
                STATE.enemyBullets.splice(i, 1);
            }
        }
    }

    // 7. アイテムドロップ回収処理
    if (STATE.items) {
        for (let i = STATE.items.length - 1; i >= 0; i--) {
            const item = STATE.items[i];
            if (!item) continue;

            item.update();

            const dist = item.mesh.position.distanceTo(STATE.camera.position);
            if (dist < 3.5) {
                if (item.type === 'heal') {
                    PLAYER.hp = Math.min(PLAYER.maxHp, PLAYER.hp + 30);
                    if (uiManager) uiManager.showMsg("生命回復 +30");
                } else {
                    STATE.score += 200;
                    if (uiManager) uiManager.showMsg("銭獲得 +200");
                }
                
                if (uiManager) uiManager.updateUI();
                savePlayerData();

                item.destroy();
                STATE.items.splice(i, 1);
            } else if (!item.alive) {
                item.destroy();
                STATE.items.splice(i, 1);
            }
        }
    }

    // 8. 盤上クリア判定
    if (STATE.stageActive && !STATE.isGameOver && STATE.enemies && STATE.enemies.length === 0) {
        showStageClear();
    }

    // 9. レンダリング
    if (STATE.renderer && STATE.scene && STATE.camera) {
        STATE.renderer.render(STATE.scene, STATE.camera);
    }
}

/**
 * DOM要素へのアクションハンドラ登録。
 */
function setupEvents() {
    const addSafeEvent = (id, eventName, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(eventName, handler);
    };

    addSafeEvent('btn-campaign-start', 'click', () => {
        const titleScreen = document.getElementById('title-screen');
        if (titleScreen) titleScreen.style.display = 'none';
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.style.display = 'flex';
        STATE.isPractice = false;
        loadStages(selectStage);
    });

    addSafeEvent('btn-practice-start', 'click', () => {
        const titleScreen = document.getElementById('title-screen');
        if (titleScreen) titleScreen.style.display = 'none';
        const practiceSelectMenu = document.getElementById('practice-select-menu');
        if (practiceSelectMenu) practiceSelectMenu.style.display = 'flex';
        STATE.isPractice = true;
        if (!STATE.stages || STATE.stages.length === 0) {
            STATE.stages = filterEmptyStages(JSON.parse(JSON.stringify(EXTENDED_FALLBACK_STAGES)));
        }
        buildPracticeMenu();
    });

    addSafeEvent('btn-fallback-start', 'click', () => {
        startWithFallback(selectStage);
    });

    addSafeEvent('btn-back-to-title-practice', 'click', () => {
        const practiceSelectMenu = document.getElementById('practice-select-menu');
        if (practiceSelectMenu) practiceSelectMenu.style.display = 'none';
        const titleScreen = document.getElementById('title-screen');
        if (titleScreen) titleScreen.style.display = 'flex';
    });

    addSafeEvent('btn-next-stage', 'click', nextStage);

    addSafeEvent('btn-clear-practice', 'click', () => {
        cleanUpStage();
        const practiceSelectMenu = document.getElementById('practice-select-menu');
        if (practiceSelectMenu) practiceSelectMenu.style.display = 'flex';
        buildPracticeMenu();
    });

    addSafeEvent('btn-clear-back', 'click', quitStageToSelect);

    addSafeEvent('btn-clear-title', 'click', () => {
        cleanUpStage();
        if (MapSystem && typeof MapSystem.hide === 'function') {
            MapSystem.hide();
        }
        const titleScreen = document.getElementById('title-screen');
        if (titleScreen) titleScreen.style.display = 'flex';
    });

    addSafeEvent('btn-resume-game', 'click', resumeGame);

    addSafeEvent('btn-pause-practice', 'click', () => {
        cleanUpStage();
        const practiceSelectMenu = document.getElementById('practice-select-menu');
        if (practiceSelectMenu) practiceSelectMenu.style.display = 'flex';
        buildPracticeMenu();
    });

    addSafeEvent('btn-pause-back', 'click', quitStageToSelect);

    addSafeEvent('btn-pause-title', 'click', () => {
        cleanUpStage();
        if (MapSystem && typeof MapSystem.hide === 'function') {
            MapSystem.hide();
        }
        const titleScreen = document.getElementById('title-screen');
        if (titleScreen) titleScreen.style.display = 'flex';
    });

    addSafeEvent('btn-restart-stage', 'click', restartStage);

    addSafeEvent('btn-go-practice', 'click', () => {
        cleanUpStage();
        const practiceSelectMenu = document.getElementById('practice-select-menu');
        if (practiceSelectMenu) practiceSelectMenu.style.display = 'flex';
        buildPracticeMenu();
    });

    addSafeEvent('btn-go-back', 'click', quitStageToSelect);

    addSafeEvent('btn-go-title', 'click', () => {
        cleanUpStage();
        if (MapSystem && typeof MapSystem.hide === 'function') {
            MapSystem.hide();
        }
        const titleScreen = document.getElementById('title-screen');
        if (titleScreen) titleScreen.style.display = 'flex';
    });

    // デバッグのフックとなる銭カウンターダブルクリックの代替処理
    let clickCount = 0;
    let lastClickTime = 0;
    const scoreContainer = document.getElementById('score-container');
    if (scoreContainer) {
        scoreContainer.addEventListener('click', e => {
            e.stopPropagation();
            const now = Date.now();
            if (now - lastClickTime > 2000) clickCount = 0;
            clickCount++;
            lastClickTime = now;
            if (clickCount >= 5) {
                activateDebugMode();
                clickCount = 0;
            }
        });
    }

    window.addEventListener('contextmenu', e => e.preventDefault());

    // 意図しないポインターロック切断時にポーズメニューを適用
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement !== document.body) {
            if (STATE.stageActive && !STATE.isPaused && !STATE.isGameOver && !STATE.introActive) {
                if (!inputHandler || !inputHandler.currentTouchMode) {
                    pauseGame();
                }
            }
        }
    });
}

function filterEmptyStages(stageList) {
    if (!stageList) return [];
    const enemyTypes = ['歩', '香', '桂', '銀', '金', '角', '飛', '王', 'ポーン', 'ナイト', 'ビショップ', 'ルーク', 'クイーン', 'キング', 'ヨット'];
    return stageList.filter(stg => {
        let totalEnemies = 0;
        enemyTypes.forEach(type => {
            totalEnemies += (stg[type] || 0);
        });
        return totalEnemies > 0;
    });
}

// 外部/デバッグスクリプト、および拡張機能のブリッジ登録
window.updateUI = () => { if (uiManager) uiManager.updateUI(); };
window.savePlayerData = savePlayerData;
window.showStageClear = showStageClear;
window.takeDamage = takeDamage;
window.startStage = startStage;
window.selectStage = selectStage;
window.STATE = STATE;
window.PLAYER = PLAYER;
window.UPGRADE_COSTS = UPGRADE_COSTS;
