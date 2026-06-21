import { STATE, PLAYER, UPGRADE_COSTS } from './constants.js';
import { Item } from './entities.js'; // 一括撃破時の安全なアイテムドロップ生成用にインポート

// キー入力履歴を保持するバッファ（「debug」の検知用）
const DEBUG_SEQUENCE = 'debug';
let inputQueue = [];

/**
 * 安全にグローバル関数を呼び出すためのヘルパー
 * 関数が存在しない場合でも例外を発生させず、安全にスキップ（または代替動作）します
 */
function safeCall(funcName, ...args) {
    if (typeof window[funcName] === 'function') {
        try {
            return window[funcName](...args);
        } catch (err) {
            console.error(`[Debug] window.${funcName} の実行中にエラーが発生しました:`, err);
        }
    } else {
        console.warn(`[Debug] window.${funcName} は現在利用できません（初期化前、または未定義）。`);
    }
    return null;
}

/**
 * 画面へのメッセージ通知を安全に実行するヘルパー
 * showMsg が未定義の場合は、開発用コンソールへの出力にフォールバックします
 */
function safeShowMsg(msg) {
    if (typeof window.showMsg === 'function') {
        try {
            window.showMsg(msg);
        } catch (err) {
            console.error('[Debug] window.showMsg の実行中にエラーが発生しました:', err);
        }
    } else {
        // UI側の通知機能が準備できていない場合の代替ログ出力
        console.log(`%c[Debug Alert]: ${msg}`, 'color: #00ffff; font-weight: bold;');
    }
}

/**
 * UIの更新とプレイヤーデータのセーブを安全にまとめて呼び出す処理
 */
function safeUpdateAndSave() {
    safeCall('updateUI');
    safeCall('savePlayerData');
}

/**
 * キーボードイベントのハンドラ
 */
function handleKeyDown(event) {
    // テキスト入力欄など、文字入力を伴う要素にフォーカスがある場合はデバッグ機能を無効化
    if (
        event.target.tagName === 'INPUT' || 
        event.target.tagName === 'TEXTAREA' || 
        event.target.isContentEditable
    ) {
        return;
    }

    const key = event.key.toLowerCase();

    // --- 隠しコマンド判定（d-e-b-u-g キー入力） ---
    inputQueue.push(key);
    if (inputQueue.length > DEBUG_SEQUENCE.length) {
        inputQueue.shift();
    }

    if (inputQueue.join('') === DEBUG_SEQUENCE) {
        // ステータスを極限化
        PLAYER.hp = 9999;
        PLAYER.power = 100;
        PLAYER.fireRate = 50;
        PLAYER.speed = 1.2;
        STATE.score = 999999; 

        STATE.isDebugMode = true;

        // UI更新、セーブ、メッセージ表示を安全に実行
        safeUpdateAndSave();
        safeShowMsg('デバッグモード：有効化（ステータス最大）');

        inputQueue = []; // 判定バッファをクリア
        return;
    }

    // --- 無敵モード（G キー） ---
    if (event.key === 'g' || event.key === 'G') {
        STATE.isGodMode = !STATE.isGodMode;

        const msg = STATE.isGodMode ? '無敵：有効' : '無敵：無効';
        safeShowMsg(msg);
    }

    // --- 敵一括撃破（K キー） ---
    if (event.key === 'k' || event.key === 'K') {
        if (STATE.enemies && Array.isArray(STATE.enemies) && STATE.enemies.length > 0) {
            // 配列の整合性を保ち、インデックス崩れを防ぐためコピーを作成して処理
            const activeEnemies = [...STATE.enemies];

            activeEnemies.forEach(enemy => {
                if (!enemy) return;

                // 1. 撃破・ダメージ処理の呼び出し
                if (typeof enemy.takeHit === 'function') {
                    try {
                        enemy.takeHit(999999);
                    } catch (err) {
                        console.error('[Debug] enemy.takeHit 実行エラー:', err);
                    }
                }

                // 2. ボス判定
                const isBoss = (enemy.type === '王' || enemy.type === 'キング' || enemy.type === 'K' || enemy.type === 'ヨット' || enemy.type === 'Yacht');
                
                // 3. スコアの加算
                if (typeof STATE.score !== 'number') {
                    STATE.score = 0;
                }
                STATE.score += isBoss ? 10000 : 200;

                // 4. 確率に応じたアイテムドロップ処理
                const dropProb = isBoss ? 1.0 : 0.3;
                if (Math.random() < dropProb && STATE.items) {
                    try {
                        if (enemy.mesh && enemy.mesh.position) {
                            STATE.items.push(new Item(enemy.mesh.position));
                        }
                    } catch (err) {
                        console.error('[Debug] アイテム生成エラー:', err);
                    }
                }

                // 5. 3Dシーンからの安全な削除
                if (STATE.scene && enemy.mesh) {
                    try {
                        STATE.scene.remove(enemy.mesh);
                    } catch (err) {
                        console.error('[Debug] scene.remove 実行エラー:', err);
                    }
                }

                // 6. メモリリーク（ゾンビオブジェクト化）を防ぐための完全解放処理
                if (typeof enemy.destroy === 'function') {
                    try {
                        enemy.destroy();
                    } catch (err) {
                        console.error('[Debug] enemy.destroy 実行エラー:', err);
                    }
                }
            });

            // 参照を破壊せずに敵リストを安全にクリア
            STATE.enemies.length = 0;

            safeUpdateAndSave();
            safeShowMsg('敵を一括撃破しました（リソース解放完了）');
        }
    }

    // --- ステージ即時クリア（L キー） ---
    if (event.key === 'l' || event.key === 'L') {
        safeCall('showStageClear');
    }

    // --- ステータス個別変更機能（P キー） ---
    if (event.key === 'p' || event.key === 'P') {
        const targetStat = prompt('変更したいステータスを入力してください (hp, power, fireRate, speed, score):');
        if (targetStat) {
            const lowerStat = targetStat.trim().toLowerCase();
            const allowedStats = ['hp', 'power', 'fireRate', 'speed', 'score'];
            
            const exactStat = allowedStats.find(s => s.toLowerCase() === lowerStat);

            if (exactStat) {
                const currentValue = exactStat === 'score' ? (STATE.score !== undefined ? STATE.score : 0) : PLAYER[exactStat];
                const valueStr = prompt(`${exactStat} に設定する数値を入力してください:`, currentValue);
                
                if (valueStr !== null) {
                    const value = parseFloat(valueStr);
                    if (!isNaN(value)) {
                        if (exactStat === 'score') {
                            STATE.score = value;
                        } else {
                            PLAYER[exactStat] = value;
                        }

                        safeUpdateAndSave();
                        safeShowMsg(`${exactStat} を ${value} に変更しました`);
                    } else {
                        alert('無効な数値が入力されました。');
                    }
                }
            } else {
                alert('指定されたステータス名は存在しません。');
            }
        }
    }

    // --- 敵の動作停止機能（F キー） ---
    if (event.key === 'f' || event.key === 'F') {
        STATE.isEnemiesFrozen = !STATE.isEnemiesFrozen;

        const msg = STATE.isEnemiesFrozen ? '敵の動作：一時停止' : '敵の動作：通常';
        safeShowMsg(msg);
    }

    // --- クリエイティブモード機能（C キー） ---
    if (event.key === 'c' || event.key === 'C') {
        STATE.isCreativeMode = !STATE.isCreativeMode;

        const msg = STATE.isCreativeMode 
            ? 'クリエイティブモード：有効 (Spaceキーで上昇 / Cキーで下降)' 
            : 'クリエイティブモード：無効';
        safeShowMsg(msg);
    }
}

/**
 * デバッグ機能の初期化
 */
function initDebugTools() {
    // ログ出力（ヘルプメッセージ）
    console.log('%c[開発用プレビュー] デバッグツール起動完了', 'color: #00ff00; font-weight: bold;');
    console.log('--- デバッグショートカット一覧 ---');
    console.log('・d -> e -> b -> u -> g (順番に入力): 隠しデバッグ起動 (ステータス極限化)');
    console.log('・G キー: 無敵モードの切り替え (トグル)');
    console.log('・K キー: 盤上の全敵を撃破 (スコア獲得 ＆ リソースの完全解放)');
    console.log('・L キー: ステージを即時クリア');
    console.log('・P キー: ステータスの個別数値変更');
    console.log('・F キー: 敵の動作一時停止の切り替え (トグル)');
    console.log('・C キー: クリエイティブモード (自由移動) の切り替え (トグル)');
    console.log('          ※有効時：Spaceキーで上昇、Cキーで下降など');
    console.log('----------------------------------');

    // キーボードイベントの登録
    window.addEventListener('keydown', handleKeyDown);
}

/**
 * ページの読み込み完了タイミングに応じた制御
 * すでにロードが完了している場合は即座に初期化し、ロード中の場合は 'load' イベント後に実行します
 */
if (document.readyState === 'complete') {
    initDebugTools();
} else {
    window.addEventListener('load', initDebugTools);
}
