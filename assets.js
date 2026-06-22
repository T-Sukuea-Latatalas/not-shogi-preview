import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS, PIECE_NAMES } from './constants.js';

/**
 * カラーコードが数値または不正な形式である場合に、
 * Canvasコンテキストが正しく読み込める16進数文字列（例: "#e3c88d"）に変換・補正するヘルパー。
 */
function ensureColorString(color) {
    if (typeof color === 'number') {
        return '#' + color.toString(16).padStart(6, '0');
    }
    return color || '#ffffff';
}

/**
 * ジオメトリの属性を position, normal, uv のみにクリーンアップし、
 * mergeGeometries 時の属性競合やグループのエラーを防ぐヘルパー関数。
 */
function prepareGeometry(geometry) {
    const nonIndexedGeom = geometry.toNonIndexed();
    geometry.dispose();

    const validKeys = ['position', 'normal', 'uv'];
    const attributeKeys = Object.keys(nonIndexedGeom.attributes);
    for (const key of attributeKeys) {
        if (!validKeys.includes(key)) {
            nonIndexedGeom.deleteAttribute(key);
        }
    }
    nonIndexedGeom.clearGroups();
    return nonIndexedGeom;
}

/**
 * 共通のくびれのあるクラシックな台座を LatheGeometry で生成するヘルパー。
 */
function createBaseGeometry(bottomRadius, topRadius, height) {
    const points = [];
    points.push(new THREE.Vector2(0, 0)); 
    points.push(new THREE.Vector2(bottomRadius, 0)); 
    points.push(new THREE.Vector2(bottomRadius, height * 0.15));
    points.push(new THREE.Vector2(bottomRadius * 0.85, height * 0.25)); 
    points.push(new THREE.Vector2(bottomRadius * 0.55, height * 0.5));  
    points.push(new THREE.Vector2(bottomRadius * 0.5, height * 0.75));
    points.push(new THREE.Vector2(topRadius * 1.15, height * 0.88));   
    points.push(new THREE.Vector2(topRadius, height * 0.95));
    points.push(new THREE.Vector2(topRadius, height));
    points.push(new THREE.Vector2(0, height)); 

    const geom = new THREE.LatheGeometry(points, 24);
    return prepareGeometry(geom);
}

/**
 * ジオメトリの寸法とピボットを調整し、接地アライメント（Y=0）および
 * X=0, Z=0 中心アライメントを施してスケールを合わせるヘルパー。
 */
function adjustScaleAndAlignment(geometry, targetHeight) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const currentHeight = box.max.y - box.min.y;
    
    if (currentHeight > 0) {
        const scaleFactor = targetHeight / currentHeight;
        geometry.scale(scaleFactor, scaleFactor, scaleFactor);
    }
    
    geometry.computeBoundingBox();
    const newBox = geometry.boundingBox;
    geometry.translate(0, -newBox.min.y, 0);
    
    const centerX = (newBox.max.x + newBox.min.x) / 2;
    const centerZ = (newBox.max.z + newBox.min.z) / 2;
    geometry.translate(-centerX, 0, -centerZ);
    
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    if (!geometry.groups || geometry.groups.length === 0) {
        geometry.addGroup(0, geometry.getAttribute('position').count, 0);
    }
}

/**
 * 指定したチェス駒の種類に応じた BufferGeometry を動的に生成して返します。
 */
export function getChessGeometry(type) {
    const normalizedType = type.toUpperCase();
    const geometries = [];

    if (normalizedType === 'P' || normalizedType === 'ポーン') {
        const base = createBaseGeometry(0.7, 0.45, 0.9);
        geometries.push(base);

        const collar = prepareGeometry(new THREE.CylinderGeometry(0.48, 0.48, 0.08, 24));
        collar.translate(0, 0.92, 0);
        geometries.push(collar);

        const head = prepareGeometry(new THREE.SphereGeometry(0.38, 24, 24));
        head.translate(0, 1.3, 0);
        geometries.push(head);

        const merged = mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 1.8); 
        return merged;

    } else if (normalizedType === 'R' || normalizedType === 'ルーク') {
        const base = createBaseGeometry(0.75, 0.6, 0.8);
        geometries.push(base);

        const body = prepareGeometry(new THREE.CylinderGeometry(0.5, 0.6, 0.6, 24));
        body.translate(0, 1.1, 0);
        geometries.push(body);

        const head = prepareGeometry(new THREE.CylinderGeometry(0.65, 0.55, 0.4, 24));
        head.translate(0, 1.6, 0);
        geometries.push(head);

        const r = 0.55;
        const h = 1.8 + 0.075;
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2;
            const box = prepareGeometry(new THREE.BoxGeometry(0.18, 0.15, 0.18));
            box.translate(Math.cos(angle) * r, h, Math.sin(angle) * r);
            geometries.push(box);
        }

        const merged = mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 2.1);
        return merged;

    } else if (normalizedType === 'N' || normalizedType === 'ナイト') {
        const base = createBaseGeometry(0.75, 0.55, 0.6);
        geometries.push(base);

        const shape = new THREE.Shape();
        shape.moveTo(0.0, 0.0);
        shape.lineTo(0.45, 0.15);
        shape.quadraticCurveTo(0.7, 0.35, 0.7, 0.65); 
        shape.quadraticCurveTo(0.7, 0.85, 0.5, 0.95); 
        shape.lineTo(0.4, 0.8); 
        shape.lineTo(0.42, 1.05);
        shape.quadraticCurveTo(0.15, 1.25, -0.2, 1.25); 
        shape.lineTo(-0.35, 1.55); 
        shape.lineTo(-0.48, 1.55);
        shape.lineTo(-0.45, 1.25);
        shape.quadraticCurveTo(-0.6, 0.75, -0.35, 0.0); 
        shape.closePath();

        const extrudeSettings = {
            depth: 0.32,
            bevelEnabled: true,
            bevelSegments: 2,
            steps: 1,
            bevelSize: 0.04,
            bevelThickness: 0.04
        };

        const head = prepareGeometry(new THREE.ExtrudeGeometry(shape, extrudeSettings));
        head.center(); 
        head.rotateY(Math.PI / 2); 
        head.translate(0, 0.6 + 0.75, 0); 
        geometries.push(head);

        const merged = mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 2.1);
        return merged;

    } else if (normalizedType === 'B' || normalizedType === 'ビショップ') {
        const base = createBaseGeometry(0.72, 0.48, 0.9);
        geometries.push(base);

        const collar = prepareGeometry(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 24));
        collar.translate(0, 0.92, 0);
        geometries.push(collar);

        const head = prepareGeometry(new THREE.SphereGeometry(0.38, 24, 24));
        head.scale(1, 1.5, 1);
        head.translate(0, 1.45, 0);
        geometries.push(head);

        const lip1 = prepareGeometry(new THREE.BoxGeometry(0.08, 0.35, 0.1));
        lip1.rotateX(0.5); 
        lip1.translate(-0.06, 1.55, 0.25);
        geometries.push(lip1);

        const lip2 = prepareGeometry(new THREE.BoxGeometry(0.08, 0.35, 0.1));
        lip2.rotateX(0.5);
        lip2.translate(0.06, 1.55, 0.25);
        geometries.push(lip2);

        const topSphere = prepareGeometry(new THREE.SphereGeometry(0.08, 12, 12));
        topSphere.translate(0, 2.05, 0);
        geometries.push(topSphere);

        const merged = mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 2.2);
        return merged;

    } else if (normalizedType === 'Q' || normalizedType === 'クイーン') {
        const base = createBaseGeometry(0.72, 0.45, 1.0);
        geometries.push(base);

        const body = prepareGeometry(new THREE.CylinderGeometry(0.32, 0.45, 0.6, 24));
        body.translate(0, 1.3, 0);
        geometries.push(body);

        const crown = prepareGeometry(new THREE.CylinderGeometry(0.58, 0.35, 0.4, 24));
        crown.translate(0, 1.8, 0);
        geometries.push(crown);

        const r = 0.54;
        const h = 2.0;
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const spike = prepareGeometry(new THREE.ConeGeometry(0.06, 0.15, 6));
            spike.rotateX(0.25); 
            spike.rotateY(-angle); 
            spike.translate(Math.cos(angle) * r, h, Math.sin(angle) * r);
            geometries.push(spike);
        }

        const topSphere = prepareGeometry(new THREE.SphereGeometry(0.1, 16, 16));
        topSphere.translate(0, 2.05, 0);
        geometries.push(topSphere);

        const merged = mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 2.4);
        return merged;

    } else if (normalizedType === 'K' || normalizedType === 'キング') {
        const base = createBaseGeometry(0.75, 0.48, 1.1);
        geometries.push(base);

        const body = prepareGeometry(new THREE.CylinderGeometry(0.35, 0.48, 0.7, 24));
        body.translate(0, 1.45, 0);
        geometries.push(body);

        const crown = prepareGeometry(new THREE.CylinderGeometry(0.6, 0.38, 0.4, 24));
        crown.translate(0, 2.0, 0);
        geometries.push(crown);

        const dome = prepareGeometry(new THREE.SphereGeometry(0.48, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2));
        dome.scale(1, 0.6, 1);
        dome.translate(0, 2.1, 0);
        geometries.push(dome);

        const crossY = 2.45;
        const vertical = prepareGeometry(new THREE.BoxGeometry(0.08, 0.38, 0.08));
        vertical.translate(0, crossY, 0);
        geometries.push(vertical);

        const horizontal = prepareGeometry(new THREE.BoxGeometry(0.26, 0.08, 0.08));
        horizontal.translate(0, crossY + 0.1, 0);
        geometries.push(horizontal);

        const merged = mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 2.5); 
        return merged;
    }

    return getChessGeometry('P');
}

export const AssetFactory = {
    pieceGeom: null,
    init() {
        const shape = new THREE.Shape();
        shape.moveTo(-1.0, 0); shape.lineTo(1.0, 0); shape.lineTo(0.85, 1.8); shape.lineTo(0, 2.4); shape.lineTo(-0.85, 1.8); shape.closePath();
        
        const customUVGenerator = {
            generateTopUV: function ( geometry, vertices, indexA, indexB, indexC ) {
                const ax = vertices[ indexA * 3 ];
                const ay = vertices[ indexA * 3 + 1 ];
                const bx = vertices[ indexB * 3 ];
                const by = vertices[ indexB * 3 + 1 ];
                const cx = vertices[ indexC * 3 ];
                const cy = vertices[ indexC * 3 + 1 ];

                return [
                    new THREE.Vector2( ( ax + 1.0 ) / 2.0, ay / 2.4 ),
                    new THREE.Vector2( ( bx + 1.0 ) / 2.0, by / 2.4 ),
                    new THREE.Vector2( ( cx + 1.0 ) / 2.0, cy / 2.4 )
                ];
            },
            generateSideWallUV: function ( geometry, vertices, indexA, indexB, indexC, indexD ) {
                return [
                    new THREE.Vector2( 0, 0 ),
                    new THREE.Vector2( 1, 0 ),
                    new THREE.Vector2( 1, 1 ),
                    new THREE.Vector2( 0, 1 )
                ];
            }
        };

        this.pieceGeom = new THREE.ExtrudeGeometry(shape, { 
            depth: 0.4, 
            bevelEnabled: true, 
            bevelSize: 0.05, 
            bevelThickness: 0.05,
            UVGenerator: customUVGenerator
        });
        this.pieceGeom.center(); this.pieceGeom.translate(0, 1.2, 0);
    },
    
    /**
     * 将棋盤や駒のベースとなる木目のキャンバステクスチャを生成。
     */
    createWoodCanvas(text, textColor = '#1a1a1a', isBoard = false) {
        const canvas = document.createElement('canvas'); 
        canvas.width = 1024; 
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // 榧（かや）特有の温かみと高級感のある地色
        const baseColor = ensureColorString(COLORS.wood || '#e3c88d'); 
        ctx.fillStyle = baseColor; 
        ctx.fillRect(0, 0, 1024, 1024);
        
        // 微細な光沢感とムラを出すグラデーション
        const grad = ctx.createLinearGradient(0, 0, 1024, 0);
        grad.addColorStop(0, 'rgba(0,0,0,0.01)');
        grad.addColorStop(0.3, 'rgba(255,255,255,0.03)');
        grad.addColorStop(0.7, 'rgba(0,0,0,0.02)');
        grad.addColorStop(1, 'rgba(255,255,255,0.01)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 1024);
        
        // 自然な柾目（木目線）の描画。何重にも薄く重ねることでリアルな年輪を表現
        ctx.strokeStyle = '#b59659';
        for(let i = 0; i < 110; i++) { 
            ctx.lineWidth = Math.random() * 1.5 + 0.5; 
            ctx.strokeStyle = `rgba(181, 150, 89, ${Math.random() * 0.22 + 0.08})`; 
            let x = Math.random() * 1024; 
            ctx.beginPath(); 
            ctx.moveTo(x, 0); 
            // わずかなうねりを加えてデジタル感を排除
            const waveFreq = Math.random() * 0.005 + 0.002;
            const waveAmp = Math.random() * 25 + 10;
            for (let y = 0; y <= 1024; y += 20) {
                const ox = x + Math.sin(y * waveFreq) * waveAmp;
                if (y === 0) ctx.moveTo(ox, y);
                else ctx.lineTo(ox, y);
            }
            ctx.stroke(); 
        }

        if (isBoard) {
            // 深みのある漆の黒茶色の格子線
            ctx.strokeStyle = 'rgba(26, 20, 16, 0.95)';
            ctx.lineWidth = 4.5;
            const margin = 80;
            const size = 1024 - margin * 2;
            const step = size / 9;
            
            for (let i = 0; i <= 9; i++) {
                const pos = margin + i * step;
                ctx.beginPath();
                ctx.moveTo(pos, margin);
                ctx.lineTo(pos, 1024 - margin);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(margin, pos);
                ctx.lineTo(1024 - margin, pos);
                ctx.stroke();
            }

            const dotRadius = 9;
            ctx.fillStyle = '#1a100a';
            const stars = [3, 6];
            stars.forEach(r => {
                stars.forEach(c => {
                    const px = margin + r * step;
                    const py = margin + c * step;
                    ctx.beginPath();
                    ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
                    ctx.fill();
                });
            });
        } else if (text) { 
            ctx.fillStyle = ensureColorString(textColor); 
            ctx.textAlign = "center"; 
            ctx.textBaseline = "middle"; 

            // 格調高い毛筆フォント・明朝体ファミリー
            const fontName = "'Yuji Syuku', 'SentySinoType', '游明朝', YuMincho, 'MS Mincho', 'Hiragino Mincho ProN', serif";
            
            // 墨が木にしっかりと馴染んだように見えるよう、わずかなにじみ（影）を表現
            ctx.shadowColor = 'rgba(0,0,0,0.15)';
            ctx.shadowBlur = 4;

            if (text.length === 2) {
                ctx.font = `bold 310px ${fontName}`; 
                ctx.fillText(text[0], 512, 415); 

                ctx.font = `bold 250px ${fontName}`; 
                ctx.fillText(text[1], 512, 715); 
            } else {
                ctx.font = `bold 440px ${fontName}`; 
                ctx.fillText(text, 512, 535); 
            }
            
            ctx.shadowBlur = 0;
        }
        return new THREE.CanvasTexture(canvas);
    },

    /**
     * 駒のマテリアルを取得。
     */
    getMaterials(type) {
        const fullName = PIECE_NAMES[type] || type;
        
        let textColor = '#1e1a15'; // 漆黒に近い墨色 
        if (type === '王' || type === '玉') {
            textColor = ensureColorString(COLORS.gold || '#d4af37'); // 雅な金箔
        } else if (type === '金' || type === '金将') {
            textColor = ensureColorString(COLORS.vermillion || '#ae1f23'); // 伝統的な朱
        } else if (['と', '成香', '成桂', '成銀', '竜', '馬', '竜王', '竜馬'].includes(type) || type.includes('成')) {
            textColor = ensureColorString(COLORS.vermillion || '#ae1f23'); 
        }

        const frontTex = this.createWoodCanvas(fullName, textColor);
        const sideTex = this.createWoodCanvas(null);

        // しっとりとした気品のある高級木肌の風合い（反射やざらざら具合を最適化）
        return [
            new THREE.MeshStandardMaterial({ 
                map: frontTex, 
                roughness: 0.35, 
                metalness: 0.08 
            }),
            new THREE.MeshStandardMaterial({ 
                map: sideTex, 
                roughness: 0.38, 
                metalness: 0.05 
            })
        ];
    },

    /**
     * チェス駒用のキャンバステクスチャ生成。
     */
    createChessCanvas(symbol, baseColor = '#151515', textColor = '#d4af37') {
        const canvas = document.createElement('canvas'); 
        canvas.width = 1024; 
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = ensureColorString(baseColor); 
        ctx.fillRect(0, 0, 1024, 1024);
        
        const isDarkBase = baseColor === '#151515' || baseColor === '#181818' || baseColor === '#0a0a0a';
        
        // 漆器特有の上品な艶や微細な質感を出すため、非常に薄いヘアラインのような質感を重ねる
        ctx.strokeStyle = isDarkBase ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.015)';
        for(let i = 0; i < 55; i++) { 
            ctx.lineWidth = Math.random() * 3 + 0.5; 
            let x = Math.random() * 1024; 
            ctx.beginPath(); 
            ctx.moveTo(x, 0); 
            ctx.lineTo(x + (Math.random() - 0.5) * 60, 1024); 
            ctx.stroke(); 
        }

        if (symbol) { 
            ctx.fillStyle = ensureColorString(textColor); 
            ctx.textAlign = "center"; 
            ctx.textBaseline = "middle"; 
            ctx.font = "bold 530px 'Times New Roman', 'Georgia', 'Segoe UI Symbol', serif"; 
            
            // 箔押しされたようなかすかな立体感
            ctx.shadowColor = isDarkBase ? 'rgba(212, 175, 55, 0.25)' : 'rgba(0, 0, 0, 0.1)';
            ctx.shadowBlur = 6;
            ctx.fillText(symbol, 512, 512); 
            ctx.shadowBlur = 0;
        }
        return new THREE.CanvasTexture(canvas);
    },

    /**
     * チェス駒のマテリアルを取得します。
     */
    getChessMaterials(type, isWhite = false) {
        const symbols = {
            'ポーン': '♟', 'P': '♟',
            'ナイト': '♞', 'N': '♞',
            'ビショップ': '♝', 'B': '♝',
            'ルーク': '♜', 'R': '♜',
            'クイーン': '♛', 'Q': '♛',
            'キング': '♚', 'K': '♚'
        };
        const symbol = symbols[type] || '♟';
        
        // 白：高級な白磁・象牙（アイボリー）、黒：美しい磨き上げられた黒漆
        const baseColor = isWhite ? '#fdfcf7' : '#0a0a0a';  
        const textColor = isWhite ? '#1c1815' : ensureColorString(COLORS.gold || '#d4af37');  
        
        const frontTex = this.createChessCanvas(symbol, baseColor, textColor);
        const sideTex = this.createChessCanvas(null, baseColor, textColor);

        // 白駒：象牙や陶器のようなソフトでなめらかな光沢
        // 黒駒：周囲の光線をしっとりと受け止める、磨き漆のような高級感
        const roughnessValue = isWhite ? 0.22 : 0.12;
        const metalnessValue = isWhite ? 0.08 : 0.15; 

        return [
            new THREE.MeshStandardMaterial({ 
                map: frontTex, 
                roughness: roughnessValue, 
                metalness: metalnessValue, 
                color: 0xffffff,
                emissive: new THREE.Color(0x000000) 
            }),
            new THREE.MeshStandardMaterial({ 
                map: sideTex, 
                roughness: roughnessValue, 
                metalness: metalnessValue,
                color: 0xffffff
            })
        ];
    },

    createMossTexture() {
        const canvas = document.createElement('canvas'); 
        canvas.width = 512; 
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // 深みのある苔色のブレンド
        ctx.fillStyle = '#1b2d17'; 
        ctx.fillRect(0, 0, 512, 512);
        
        // より自然な「ふかふかした立体感と湿度」を表現する点描処理
        for (let i = 0; i < 15000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const r = Math.random() * 5 + 1.5;
            
            const greenVal = Math.floor(Math.random() * 50) + 40; 
            const redVal = Math.floor(greenVal * 0.4);
            const blueVal = Math.floor(greenVal * 0.2);
            
            ctx.fillStyle = `rgba(${redVal}, ${greenVal}, ${blueVal}, ${Math.random() * 0.7 + 0.3})`;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // わずかなソフトフォーカスを入れて苔特有の質感をなじませる
        ctx.filter = 'blur(0.5px)';
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';

        return new THREE.CanvasTexture(canvas);
    },

    createKaresansuiTexture() {
        const canvas = document.createElement('canvas'); 
        canvas.width = 1024; 
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // 温かみのある白砂の色
        ctx.fillStyle = '#e2dfd5'; 
        ctx.fillRect(0, 0, 1024, 1024);
        
        // 砂粒の陰影を表現する超高密度なノイズ
        ctx.fillStyle = 'rgba(0,0,0,0.03)'; 
        for (let i = 0; i < 40000; i++) {
            ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1.5, 1.5);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.05)'; 
        for (let i = 0; i < 40000; i++) {
            ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1.5, 1.5);
        }
        
        // 砂紋の凹凸（立体感）をエンボス風に表現する描画用ヘルパー。
        // 暗い線（影）と明るい線（ハイライト）を交互にわずかにずらして描く。
        const drawRippleShadowAndLight = (drawFn) => {
            ctx.lineWidth = 4;
            
            // 影（凹部）
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
            ctx.save();
            ctx.translate(1, 1);
            drawFn();
            ctx.restore();
            
            // 光（凸部）
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
            ctx.save();
            ctx.translate(-1, -1);
            drawFn();
            ctx.restore();
        };

        // 平行な波紋
        drawRippleShadowAndLight(() => {
            for (let y = -50; y < 1074; y += 24) {
                ctx.beginPath();
                for (let x = 0; x <= 1024; x += 10) {
                    const wave = Math.sin(x * 0.03) * 6;
                    if (x === 0) ctx.moveTo(x, y + wave);
                    else ctx.lineTo(x, y + wave);
                }
                ctx.stroke();
            }
        });

        // 庭石周辺の同心円状の砂紋
        const ripples = [
            {x: 350, y: 350, maxR: 120},
            {x: 700, y: 650, maxR: 150},
            {x: 200, y: 800, maxR: 100},
            {x: 850, y: 250, maxR: 130}
        ];
        
        drawRippleShadowAndLight(() => {
            ripples.forEach(rip => {
                for (let r = 12; r < rip.maxR; r += 24) {
                    ctx.beginPath();
                    ctx.arc(rip.x, rip.y, r, 0, Math.PI * 2);
                    ctx.stroke();
                }
            });
        });

        return new THREE.CanvasTexture(canvas);
    }
};

/**
 * 竹の生成。
 */
export function createBamboo() {
    const bamboo = new THREE.Group();
    const segmentHeight = 4.0;
    const numSegments = 6 + Math.floor(Math.random() * 4); 
    const baseRadius = 0.25 + Math.random() * 0.1;
    
    // 伝統的でみずみずしい竹の色合い（HSL）
    const bambooColor = new THREE.Color().setHSL(0.28 + Math.random() * 0.04, 0.48, 0.22 + Math.random() * 0.06);
    
    // 張りのある瑞々しい竹皮の半光沢
    const material = new THREE.MeshStandardMaterial({
        color: bambooColor, 
        roughness: 0.32, 
        metalness: 0.05
    });
    
    // 乾燥してざらついた、節部分の質感
    const jointMaterial = new THREE.MeshStandardMaterial({
        color: bambooColor.clone().multiplyScalar(0.72).addScalar(0.02), 
        roughness: 0.65
    });

    for (let i = 0; i < numSegments; i++) {
        const rBottom = baseRadius * (1 - (i * 0.03));
        const rTop = baseRadius * (1 - ((i + 1) * 0.03));
        const segGeom = new THREE.CylinderGeometry(rTop, rBottom, segmentHeight - 0.15, 12);
        const segment = new THREE.Mesh(segGeom, material);
        segment.position.y = (i * segmentHeight) + (segmentHeight / 2);
        segment.castShadow = true;
        segment.receiveShadow = true;
        bamboo.add(segment);

        if (i < numSegments - 1) {
            // 節のリングをより有機的に少しだけ肉厚に表現
            const jointGeom = new THREE.CylinderGeometry(rTop * 1.15, rTop * 1.15, 0.14, 12);
            const joint = new THREE.Mesh(jointGeom, jointMaterial);
            joint.position.y = (i + 1) * segmentHeight;
            joint.castShadow = true;
            bamboo.add(joint);
        }
    }
    return bamboo;
}

/**
 * 石の生成。
 */
export function createRock() {
    const size = 1.8 + Math.random() * 2.2;
    // 頂点の分割数を上げて、岩肌のリアリティと複雑さを向上
    const geom = new THREE.DodecahedronGeometry(size, 2);
    
    const posAttr = geom.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
        // 微細なディテールをランダムにノイズ化
        posAttr.setX(i, posAttr.getX(i) + (Math.random() - 0.5) * (size * 0.18));
        posAttr.setY(i, posAttr.getY(i) + (Math.random() - 0.5) * (size * 0.18));
        posAttr.setZ(i, posAttr.getZ(i) + (Math.random() - 0.5) * (size * 0.18));
    }
    geom.computeVertexNormals();

    // 湿り気のある深い庭石を思わせる、深みのある濃灰色〜暗オリーブ色
    const baseColor = new THREE.Color(0x3e3f3a);
    const rockColor = baseColor.clone().lerp(new THREE.Color(0x2d302a), Math.random() * 0.5);
    
    const mat = new THREE.MeshStandardMaterial({
        color: rockColor, 
        roughness: 0.85, 
        metalness: 0.08
    });
    const rock = new THREE.Mesh(geom, mat);
    rock.scale.set(1.2 + Math.random() * 0.5, 0.75 + Math.random() * 0.35, 1.2 + Math.random() * 0.5);
    rock.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
    rock.position.y = -0.4; 
    rock.castShadow = true;
    rock.receiveShadow = true;
    return rock;
}

/**
 * 石灯籠。
 */
export function createLantern() {
    const lantern = new THREE.Group();
    // 味わい深い石造りの渋み
    const stoneMat = new THREE.MeshStandardMaterial({ 
        color: 0x555555, 
        roughness: 0.88,
        metalness: 0.05
    });
    // 和紙の障子を透かして滲む、柔らかく温かい日本の火影
    const lightMat = new THREE.MeshStandardMaterial({ 
        color: 0xffe6a3, 
        emissive: 0xff6a00, 
        emissiveIntensity: 2.2 
    });

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.4), stoneMat);
    base.position.y = 0.15; base.castShadow = true; base.receiveShadow = true;
    lantern.add(base);

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 1.6, 12), stoneMat);
    pillar.position.y = 1.1; pillar.castShadow = true; pillar.receiveShadow = true;
    lantern.add(pillar);

    const platform = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 1.2), stoneMat);
    platform.position.y = 2.025; platform.castShadow = true; platform.receiveShadow = true;
    lantern.add(platform);

    const fireBoxLight = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), lightMat);
    fireBoxLight.position.y = 2.5;
    lantern.add(fireBoxLight);
    
    for (let x of [-0.38, 0.38]) {
        for (let z of [-0.38, 0.38]) {
            const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), stoneMat);
            frame.position.set(x, 2.5, z); frame.castShadow = true;
            lantern.add(frame);
        }
    }
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.9), stoneMat);
    frameTop.position.y = 2.89;
    lantern.add(frameTop);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.5, 4), stoneMat);
    roof.rotation.y = Math.PI / 4; roof.position.y = 3.18; roof.castShadow = true;
    lantern.add(roof);

    const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), stoneMat);
    jewel.scale.set(1, 1.3, 1); jewel.position.y = 3.53; jewel.castShadow = true;
    lantern.add(jewel);

    // 幽玄な和の陰影を引き立てる、灯篭本来の温かみを持たせたポイントライト
    const light = new THREE.PointLight(0xff7700, 1.5, 18);
    light.position.set(0, 2.5, 0); light.castShadow = true; light.shadow.bias = -0.001;
    lantern.add(light);

    return lantern;
}
