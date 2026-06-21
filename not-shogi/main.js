import * as THREE from 'three';
import { 
    COLORS, STATE, PIECE_NAMES, GRAVITY, JUMP_FORCE, GROUND_Y, EYE_HEIGHT, 
    DASH_MULT, BOARD_SIZE, BOARD_THICKNESS, PLAYER, UPGRADE_COSTS, upgradeKeys, 
    joystickVector, SPREADSHEET_ID, SHEET_GID, FALLBACK_STAGES, PRACTICE_PIECES, isTouchDevice
} from './constants.js';
import { AssetFactory, createBamboo, createRock, createLantern } from './assets.js';
import { Projectile, Item, Enemy } from './entities.js';
import { MapSystem } from './map-system.js';

// 分割マネージャーモジュールのインポート
import { DeviceManager } from './device-manager.js';
import { InputHandler } from './input-handler.js';
import { UIManager } from './ui-manager.js';

let deviceManager;
let inputHandler;
let uiManager;

const ALL_PRACTICE_PIECES = PRACTICE_PIECES;

const EXTENDED_FALLBACK_STAGES = [
    { stage: 1, name: "第1局", 歩: 3 },
    { stage: 2, name: "第2局", 歩: 5, 香: 1 },
    { stage: 3, name: "第3局", 歩: 4, 香: 2, 桂: 1 },
    { stage: 4, name: "第4局", 歩: 6, 香: 2, 桂: 2, 銀: 1 },
    { stage: 5, name: "第5局", 歩: 5, 香: 3, 桂: 2, 銀: 2, 金: 1 },
    { stage: 6, name: "第6局", 歩: 8, 香: 2, 桂: 2, 銀: 2, 金: 2, 角: 1 },
    { stage: 7, name: "第7局", 歩: 6, 香: 4, 桂: 3, 銀: 3, 金: 2, 角: 1, 飛: 1 },
    { stage: 8, name: "第8局", 歩: 10, 香: 3, 桂: 3, 銀: 3, 金: 3, 角: 2, 飛: 1 },
    { stage: 9, name: "第9局", 歩: 8, 香: 4, 桂: 4, 銀: 4, 金: 4, 角: 2, 飛: 2 },
    { stage: 10, name: "第10局", 歩: 12, 香: 5, 桂: 4, 銀: 4, 金: 4, 角: 2, 飛: 2, 王: 1 },
    { stage: 11, name: "異界の尖兵", 歩: 4, 銀: 2, ポーン: 6, ナイト: 2 },
    { stage: 12, name: "黒鉄の城塞", 歩: 2, 銀: 4, 金: 2, ポーン: 4, ルーク: 3 },
    { stage: 13, name: "天空の支配者", 銀: 2, 金: 2, 角: 2, 飛: 2, ポーン: 2, ナイト: 2, ビショップ: 2, クイーン: 2 },
    { stage: 14, name: "漆黒の盤上遊戯", 歩: 5, 香: 2, 桂: 2, 銀: 3, 金: 3, 角: 2, 飛: 2, ポーン: 8, ナイト: 4, ビショップ: 4, ルーク: 2, クイーン: 1 },
    { stage: 15, name: "覇王と皇帝", 歩: 4, 香: 2, 桂: 2, 銀: 4, 金: 4, 角: 3, 飛: 3, 王: 1, ポーン: 10, ナイト: 6, ビショップ: 4, ルーク: 4, クイーン: 2, キング: 1 },
    { stage: 16, name: "盤上の支配者・ヨット", 歩: 2, ポーン: 2, ヨット: 1 },
    { stage: 50, name: "盤上最終決戦", 歩: 15, 香: 8, 桂: 8, 銀: 8, 金: 8, 角: 5, 飛: 5, 王: 1, ポーン: 20, ナイト: 10, ビショップ: 10, ルーク: 8, クイーン: 4, キング: 2, ヨット: 1 }
];

class DummyEnemy {
    constructor(type, scale = 1.0) {
        this.type = type;
        this.hp = Math.max(10, scale * 10);
        this.maxHp = this.hp;
        this.alive = true;

        const geometry = new THREE.BoxGeometry(scale * 1.5, scale * 3.0, scale * 1.5);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xff3333, 
            roughness: 0.5, 
            transparent: true, 
            opacity: 0.85 
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        
        const angle = Math.random() * Math.PI * 2;
        const radius = 15 + Math.random() * 35;
        this.mesh.position.set(
            Math.cos(angle) * radius,
            GROUND_Y,
            Math.sin(angle) * radius
        );
        
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        if (STATE.scene) {
            STATE.scene.add(this.mesh);
        }
    }

    update(playerPosition, otherEnemies) {
        if (!this.mesh || !playerPosition) return;
        const dir = new THREE.Vector3().subVectors(playerPosition, this.mesh.position);
        dir.y = 0;
        const distance = dir.length();
        if (distance > 1.5) {
            dir.normalize();
            this.mesh.position.addScaledVector(dir, 0.05);
            this.mesh.lookAt(playerPosition.x, this.mesh.position.y, playerPosition.z);
        }
    }

    takeHit(power) {
        this.hp -= power;
        if (this.mesh && this.mesh.material) {
            const mat = this.mesh.material;
            const originalColor = mat.color.getHex();
            mat.color.setHex(0xffffff);
            setTimeout(() => {
                if (mat) mat.color.setHex(originalColor);
            }, 100);
        }
        if (this.hp <= 0) {
            this.alive = false;
            return true;
        }
        return false;
    }

    destroy() {
        this.alive = false;
        if (this.mesh) {
            if (STATE.scene) {
                STATE.scene.remove(this.mesh);
            }
            if (this.mesh.geometry) {
                this.mesh.geometry.dispose();
            }
            if (this.mesh.material) {
                if (Array.isArray(this.mesh.material)) {
                    this.mesh.material.forEach(mat => mat.dispose());
                } else {
                    this.mesh.material.dispose();
                }
            }
        }
    }
}

// セーブデータをロードする処理
function loadPlayerData() {
    try {
        const json = localStorage.getItem('non_shogi_player_data');
        if (json) {
            const data = JSON.parse(json);
            if (data.score !== undefined) STATE.score = data.score;
            if (data.player) {
                if (data.player.maxHp !== undefined) PLAYER.maxHp = data.player.maxHp;
                if (data.player.speed !== undefined) PLAYER.speed = data.player.speed;
                if (data.player.power !== undefined) PLAYER.power = data.player.power;
                if (data.player.fireRate !== undefined) PLAYER.fireRate = data.player.fireRate;
            }
            if (data.upgradeCosts) {
                if (data.upgradeCosts.power !== undefined) UPGRADE_COSTS.power = data.upgradeCosts.power;
                if (data.upgradeCosts.rate !== undefined) UPGRADE_COSTS.rate = data.upgradeCosts.rate;
                if (data.upgradeCosts.speed !== undefined) UPGRADE_COSTS.speed = data.upgradeCosts.speed;
                if (data.upgradeCosts.hp !== undefined) UPGRADE_COSTS.hp = data.upgradeCosts.hp;
            }
        }
    } catch (e) {
        console.error("セーブデータの読み込みに失敗しました:", e);
    }
    PLAYER.hp = PLAYER.maxHp;
}

// セーブデータを保存する処理
function savePlayerData() {
    try {
        const data = {
            score: STATE.score,
            player: {
                maxHp: PLAYER.maxHp,
                speed: PLAYER.speed,
                power: PLAYER.power,
                fireRate: PLAYER.fireRate
            },
            upgradeCosts: {
                power: UPGRADE_COSTS.power,
                rate: UPGRADE_COSTS.rate,
                speed: UPGRADE_COSTS.speed,
                hp: UPGRADE_COSTS.hp
            }
        };
        localStorage.setItem('non_shogi_player_data', JSON.stringify(data));
    } catch (e) {
        console.error("セーブデータの保存に失敗しました:", e);
    }
}

function start() {
    initGame();
    setupEvents();
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    start();
} else {
    window.addEventListener('DOMContentLoaded', start);
}

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

    loadPlayerData();

    STATE.takeDamage = takeDamage;
    STATE.playerStunTime = 0;
    STATE.introActive = false; 
    STATE.introUpdate = null;

    STATE.scene = new THREE.Scene();
    STATE.scene.background = new THREE.Color(skyColor);
    STATE.scene.fog = new THREE.FogExp2(fogColor, 0.0035);

    STATE.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    STATE.camera.rotation.order = 'YXZ';
    STATE.camera.position.set(0, GROUND_Y + EYE_HEIGHT, 0);

    STATE.renderer = new THREE.WebGLRenderer({ antialias: true });
    STATE.renderer.domElement.style.touchAction = 'none';
    STATE.renderer.setSize(window.innerWidth, window.innerHeight);
    STATE.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    STATE.renderer.shadowMap.enabled = true;
    STATE.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(STATE.renderer.domElement);

    const ambient = new THREE.AmbientLight(ambientColor, ambientIntensity); 
    STATE.scene.add(ambient);
    
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

    const celestialGeom = new THREE.SphereGeometry(celestialRadius, 32, 32);
    const celestialMat = new THREE.MeshBasicMaterial({ color: celestialColor, fog: false });
    const celestialMesh = new THREE.Mesh(celestialGeom, celestialMat);
    celestialMesh.position.copy(celestialPos);
    STATE.scene.add(celestialMesh);
    STATE.celestialBody = celestialMesh;

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

    AssetFactory.init();

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

    const sandTex = AssetFactory.createKaresansuiTexture();
    const sandFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(160, 160),
        new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.9, metalness: 0.0 })
    );
    sandFloor.rotation.x = -Math.PI / 2;
    sandFloor.position.y = 0.02; 
    sandFloor.receiveShadow = true;
    STATE.scene.add(sandFloor);

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

    const lanternPositions = [
        { x: -55, z: -55 }, { x: 55, z: -55 }, { x: -55, z: 55 }, { x: 55, z: 55 }
    ];
    lanternPositions.forEach(pos => {
        const lantern = createLantern();
        lantern.position.set(pos.x, 0, pos.z);
        lantern.scale.set(1.5, 1.5, 1.5); 
        STATE.scene.add(lantern);
    });

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

    window.addEventListener('resize', () => {
        if (STATE.camera && STATE.renderer) {
            STATE.camera.aspect = window.innerWidth / window.innerHeight;
            STATE.camera.updateProjectionMatrix();
            STATE.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    });

    // UIManagerのインスタンス化
    uiManager = new UIManager({
        onUpgradeByIndex: (index) => {
            upgradeByIndex(index);
        }
    });
    uiManager.init();

    // InputHandlerのインスタンス化
    inputHandler = new InputHandler({
        onToggleShop: () => {
            uiManager.toggleShop();
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
            uiManager.handleShopWheel(deltaY);
        },
        onShopRightClick: () => {
            uiManager.buySelectedShopItem();
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

    // DeviceManagerのインスタンス化
    deviceManager = new DeviceManager((isTouch) => {
        inputHandler.setTouchMode(isTouch);
    });
    deviceManager.init();

    // グローバル showMsg ブリッジの設定
    window.showMsg = (txt) => {
        if (uiManager) uiManager.showMsg(txt);
    };

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

    // 初期状態は constants.js の isTouchDevice に準拠
    inputHandler.setTouchMode(isTouchDevice);

    uiManager.updateUI(); 
    animate();
}

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

function getClearedStages() {
    try {
        const data = localStorage.getItem('non_shogi_progress');
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function saveClearedStage(stageNum) {
    try {
        const cleared = getClearedStages();
        if (!cleared.includes(stageNum)) {
            cleared.push(stageNum);
            localStorage.setItem('non_shogi_progress', JSON.stringify(cleared));
        }
    } catch (e) {
        console.error("セーブデータの保存に失敗しました:", e);
    }
}

function getUnlockedPieces() {
    const unlocked = new Set();
    unlocked.add('歩');

    const stages = (STATE.stages && STATE.stages.length > 0) 
        ? STATE.stages 
        : filterEmptyStages(JSON.parse(JSON.stringify(EXTENDED_FALLBACK_STAGES)));

    if (!stages || stages.length === 0) return unlocked;

    const cleared = getClearedStages();
    
    stages.forEach((stg, index) => {
        let isUnlocked = false;
        if (index === 0) {
            isUnlocked = true;
        } else {
            const prevStage = stages[index - 1];
            if (prevStage && cleared.includes(prevStage.stage)) {
                isUnlocked = true;
            }
        }

        if (isUnlocked) {
            const pieces = ['歩', '香', '桂', '銀', '金', '角', '飛', '王', 'ポーン', 'ナイト', 'ビショップ', 'ルーク', 'クイーン', 'キング', 'ヨット'];
            pieces.forEach(p => {
                if (stg[p] && stg[p] > 0) {
                    unlocked.add(p);
                }
            });
        }
    });

    return unlocked;
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

async function loadStages() {
    let input = SPREADSHEET_ID.trim();
    let cleanedId = input;
    if (cleanedId.includes('/d/')) {
        cleanedId = cleanedId.split('/d/')[1].split('/')[0];
    }

    const url = `https://docs.google.com/spreadsheets/d/${cleanedId}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

    if (document.pointerLockElement) {
        document.exitPointerLock();
    }

    try {
        if (cleanedId === "" || cleanedId.includes("YOUR_SPREADSHEET_ID")) {
            throw new Error("スプレッドシートID、またはURLが設定されていません。予備データを使用します。");
        }
        
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
        const csvText = await res.text();
        const parsed = parseCSV(csvText);
        
        STATE.stages = filterEmptyStages(parsed);
        
        if (STATE.stages.length === 0) throw new Error("Parsed empty stages");

        MapSystem.init(STATE.stages, selectStage);
        
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.style.display = 'none';
        
        const stageSelectMenu = document.getElementById('stage-select-menu');
        if (stageSelectMenu) {
            stageSelectMenu.style.display = 'flex';
            MapSystem.show();
        }
    } catch (e) {
        console.warn("スプレッドシートのロードに失敗しました。ローカル予備ステージデータを使用します。", e);
        
        const errorActions = document.getElementById('loading-error-actions');
        if (errorActions) {
            errorActions.style.display = 'block';
        }

        startWithFallback();
    }
}

function startWithFallback() {
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }
    STATE.stages = filterEmptyStages(JSON.parse(JSON.stringify(EXTENDED_FALLBACK_STAGES)));
    
    MapSystem.init(STATE.stages, selectStage);
    
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = 'none';
    
    const stageSelectMenu = document.getElementById('stage-select-menu');
    if (stageSelectMenu) {
        stageSelectMenu.style.display = 'flex';
        MapSystem.show();
    }
}

function parseCSV(text) {
    const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return [];
    
    let delimiter = ',';
    if (lines[0].includes('\t')) delimiter = '\t';
    else if (lines[0].includes(';')) delimiter = ';';

    function splitCSVLine(line, delim) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const transform_char = line[i];
            if (transform_char === '"' || transform_char === "'") {
                inQuotes = !inQuotes;
            } else if (transform_char === delim && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += transform_char;
            }
        }
        result.push(current.trim());
        return result;
    }

    const headers = splitCSVLine(lines[0], delimiter).map(h => h.replace(/^[\uFEFF"']|["']$/g, ''));
    const parsed = [];
    
    for (let i = 1; i < lines.length; i++) {
        const cols = splitCSVLine(lines[i], delimiter).map(c => c.replace(/^["']|["']$/g, ''));
        if (cols.length < headers.length) continue;
        
        const rowObj = {};
        headers.forEach((header, index) => {
            const val = cols[index];
            if (header === 'stage') {
                rowObj[header] = parseInt(val, 10);
            } else if (header === 'name') {
                rowObj[header] = val;
            } else {
                rowObj[header] = parseInt(val, 10) || 0;
            }
        });
        parsed.push(rowObj);
    }
    return parsed;
}

export function selectStage(index) {
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
    introOverlay.style.color = '#ff3333';
    introOverlay.style.fontSize = '34px';
    introOverlay.style.fontWeight = 'bold';
    introOverlay.style.fontFamily = 'serif';
    introOverlay.style.textShadow = '0 0 10px rgba(255, 0, 0, 0.8), 2px 2px 4px #000';
    introOverlay.style.pointerEvents = 'none';
    introOverlay.style.zIndex = '9999';
    
    const bossName = (boss.type === 'ヨット' || boss.type === 'Yacht') ? 'ヨット' : 'キング';
    introOverlay.innerHTML = `⚠️ 警告 ⚠️<br>盤上 of 支配者『${bossName}』出現`;
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
                if (type === 'ヨット' || type === 'Yacht') {
                    bossEnemy = enemy;
                }
            } catch (error) {
                console.error(`エネミー [${type}] of 生成に失敗しました。ダミーで代用します:`, error);
                try {
                    STATE.enemies.push(new DummyEnemy(type, enemyScale));
                } catch (fallbackError) {
                    console.error("フォールバック用ダミーエネミー of 生成にも失敗しました:", fallbackError);
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

function nextStage() {
    if (STATE.currentStageIndex + 1 < STATE.stages.length) {
        selectStage(STATE.currentStageIndex + 1);
    }
}

function togglePause() {
    if (!STATE.stageActive || STATE.isGameOver || STATE.introActive) return; 
    if (STATE.isPaused) {
        resumeGame();
    } else {
        pauseGame();
    }
}

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

function shoot() {
    if (!STATE.camera) return;
    const dir = new THREE.Vector3(); 
    STATE.camera.getWorldDirection(dir);
    if (STATE.bullets) {
        STATE.bullets.push(new Projectile(STATE.camera.position.clone().add(new THREE.Vector3(0,-0.5,0)), dir, false, 3.0, 0.25));
    }
    PLAYER.lastShot = Date.now();
}

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

function upgrade(type) {
    if (STATE.score < UPGRADE_COSTS[type]) return;
    STATE.score -= UPGRADE_COSTS[type];
    if (type === 'power') PLAYER.power += 1;
    if (type === 'rate') PLAYER.fireRate = Math.max(60, PLAYER.fireRate - 40);
    if (type === 'speed') PLAYER.speed += 0.06;
    if (type === 'hp') { PLAYER.maxHp += 50; PLAYER.hp += 50; }
    UPGRADE_COSTS[type] = Math.floor(UPGRADE_COSTS[type] * 1.5);
    if (uiManager) uiManager.updateUI();

    savePlayerData();
}

function upgradeByIndex(index) {
    const key = upgradeKeys[index];
    if (key) {
        upgrade(key);
    }
}

function activateDebugMode() {
    PLAYER.maxHp = 9999;
    PLAYER.hp = 9999;
    PLAYER.power = 100;
    PLAYER.fireRate = 50;
    PLAYER.speed = 1.2;
    STATE.score = 999999;
    if (uiManager) {
        uiManager.showMsg("神変不可思議（全能力極限解放）");
        uiManager.updateUI();
    }

    savePlayerData();
}

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
        loadStages();
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

    addSafeEvent('btn-fallback-start', 'click', startWithFallback);

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

    document.addEventListener('pointerlockchange', () => {
        if (