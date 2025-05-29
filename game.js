const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// デバイスタイプの検出
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// キャンバスのサイズ設定
function resizeCanvas() {
    const container = canvas.parentElement;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const containerWidth = container.clientWidth;

    // モバイルデバイスの場合
    if (isMobile) {
        // 画面の向きに応じて調整
        const isLandscape = windowWidth > windowHeight;
        let targetWidth, targetHeight;

        if (isLandscape) {
            targetHeight = Math.min(windowHeight * 0.8, 400);
            targetWidth = targetHeight / 2;
        } else {
            targetWidth = Math.min(windowWidth * 0.95, 400);
            targetHeight = targetWidth * 2;
        }

        // 実際のキャンバスサイズを設定
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // 表示サイズを設定
        canvas.style.width = `${targetWidth}px`;
        canvas.style.height = `${targetHeight}px`;
    } else {
        // PCの場合は従来通り
        canvas.width = Math.min(400, containerWidth);
        canvas.height = canvas.width * 2;
        canvas.style.width = `${canvas.width}px`;
        canvas.style.height = `${canvas.height}px`;
    }

    // パドルとパックのサイズを更新
    paddleWidth = canvas.width * 0.15;
    paddleHeight = canvas.width * 0.025;
    puckSize = canvas.width * 0.0375;

    // パドルの位置を更新
    if (aiPaddleX === undefined) {
        aiPaddleX = canvas.width / 2 - paddleWidth / 2;
    } else {
        // 既存のパドルの相対位置を維持
        aiPaddleX = (aiPaddleX / prevWidth) * canvas.width;
    }

    if (playerPaddleX === undefined) {
        playerPaddleX = canvas.width / 2 - paddleWidth / 2;
    } else {
        // 既存のパドルの相対位置を維持
        playerPaddleX = (playerPaddleX / prevWidth) * canvas.width;
    }

    // パックの位置を更新
    if (puck.x !== undefined) {
        puck.x = (puck.x / prevWidth) * canvas.width;
        puck.y = (puck.y / prevHeight) * canvas.height;
    }

    // 現在のサイズを保存
    prevWidth = canvas.width;
    prevHeight = canvas.height;
}

// 前回のキャンバスサイズを保持
let prevWidth = 0;
let prevHeight = 0;

// ゲームの状態
const GAME_STATE = {
    START: 'start',
    PLAYING: 'playing',
    PAUSED: 'paused',
    UPGRADE: 'upgrade',
    GAME_OVER: 'gameOver'
};

// ゲーム定数
const POINTS_TO_WIN = 5; // 1試合の勝利に必要な得点

// エフェクト関連の設定
const PARTICLE_COUNT = 20;
const PARTICLE_LIFETIME = 30;
const FLASH_DURATION = 10;

// パーティクルの配列
let particles = [];
let flashAlpha = 0;
let flashColor = '#fff';

// タッチ操作の状態
let touchX = null;
let lastTouchX = null;
let touchStartTime = 0;

// パーティクルクラス
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.lifetime = PARTICLE_LIFETIME;
        this.dx = (Math.random() - 0.5) * 10;
        this.dy = (Math.random() - 0.5) * 10;
        this.size = Math.random() * 4 + 2;
        this.alpha = 1;
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;
        this.lifetime--;
        this.alpha = this.lifetime / PARTICLE_LIFETIME;
        this.size *= 0.95;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ゲーム変数の初期化
let currentState = GAME_STATE.START;
let magnetCooldown = false;
let playerScore = 0;
let aiScore = 0;
let totalPlayerScore = 0;
let totalAiScore = 0;
let lastMatchPlayerScore = 0;
let lastMatchAiScore = 0;
let aiPaddleX = 0;
let playerPaddleX = 0;
let puck = {
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    radius: 0,
    activeEffects: new Set(),
    lastHitTime: 0,
    lastHitUpgrade: null
};

// パックの軌跡を保存
let puckTrail = [];
const TRAIL_LENGTH = 10;

// ゲーム要素の初期設定（サイズはresizeCanvasで更新）
let paddleWidth = 60;
let paddleHeight = 10;
let puckSize = 15;

// AI設定
const AI_BASE_SPEED = 8;
const AI_PREDICTION_ERROR = 10;
const MAX_PUCK_SPEED = 15;
const INITIAL_PUCK_SPEED = 7;

// AIの特性
let aiTraits = {
    speed: 1.0,
    aggressiveness: 0.5,
    predictability: 0.8
};

// AIの特性をランダムに設定
function randomizeAITraits() {
    aiTraits = {
        speed: 0.8 + Math.random() * 0.4, // 0.8 ~ 1.2
        aggressiveness: 0.3 + Math.random() * 0.7, // 0.3 ~ 1.0
        predictability: 0.6 + Math.random() * 0.4 // 0.6 ~ 1.0
    };
}

// UI要素の取得
const startScreen = document.getElementById('startScreen');
const pauseScreen = document.getElementById('pauseScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const upgradeScreen = document.getElementById('upgradeScreen');
const startButton = document.getElementById('startButton');
const resumeButton = document.getElementById('resumeButton');
const restartButton = document.getElementById('restartButton');
const playAgainButton = document.getElementById('playAgainButton');
const winnerMessage = document.getElementById('winnerMessage');

// キー入力の状態
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    Escape: false,
    Space: false
};

// タッチイベントの処理
function handleTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
        // 2本指タップで一時停止
        if (currentState === GAME_STATE.PLAYING) {
            pauseGame();
        }
        return;
    }

    touchX = e.touches[0].clientX;
    lastTouchX = touchX;
    touchStartTime = Date.now();
}

function handleTouchMove(e) {
    e.preventDefault();
    if (currentState !== GAME_STATE.PLAYING || !touchX) return;

    const currentX = e.touches[0].clientX;
    const deltaX = currentX - lastTouchX;

    // パドルの移動
    playerPaddleX = Math.max(0, Math.min(canvas.width - paddleWidth, playerPaddleX + deltaX));

    lastTouchX = currentX;
}

function handleTouchEnd(e) {
    e.preventDefault();
    touchX = null;
    lastTouchX = null;
}

// タッチイベントリスナーの設定
if (isMobile) {
    canvas.addEventListener('touchstart', handleTouchStart, {
        passive: false
    });
    canvas.addEventListener('touchmove', handleTouchMove, {
        passive: false
    });
    canvas.addEventListener('touchend', handleTouchEnd, {
        passive: false
    });
}

// キーボードイベントリスナー（PCの場合のみ）
if (!isMobile) {
    document.addEventListener('keydown', (e) => {
        if (e.key in keys) {
            keys[e.key] = true;
            if (e.key === 'Escape' && currentState === GAME_STATE.PLAYING) {
                pauseGame();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key in keys) {
            keys[e.key] = false;
        }
    });
}

// リサイズイベントの処理を改善
let resizeTimeout;
window.addEventListener('resize', () => {
    // リサイズ中の連続実行を防ぐ
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        resizeCanvas();
    }, 250);
});

// 画面回転時の処理を追加
window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 100);
});

// ボタンのイベントリスナー
startButton.addEventListener('click', startGame);
resumeButton.addEventListener('click', resumeGame);
restartButton.addEventListener('click', resetGame);
playAgainButton.addEventListener('click', resetGame);

// ゲーム開始
function startGame() {
    currentState = GAME_STATE.PLAYING;
    startScreen.classList.add('hidden');
    resetPuck(false);
    initializePaddles();
    updateScore();
}

// ゲームの一時停止
function pauseGame() {
    currentState = GAME_STATE.PAUSED;
    pauseScreen.classList.remove('hidden');
}

// ゲームの再開
function resumeGame() {
    currentState = GAME_STATE.PLAYING;
    pauseScreen.classList.add('hidden');
}

// ゲームのリセット
function resetGame() {
    playerScore = 0;
    aiScore = 0;
    totalPlayerScore = 0;
    totalAiScore = 0;
    lastMatchPlayerScore = 0;
    lastMatchAiScore = 0;
    upgradeManager.reset();
    randomizeAITraits();
    if (effectSystem) {
        effectSystem.clearEffects();
    }
    currentState = GAME_STATE.START;
    updateScore();
    initializePaddles();
    initializePuck();

    // 全ての画面を非表示
    pauseScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    upgradeScreen.classList.add('hidden');

    // スタート画面を表示
    startScreen.classList.remove('hidden');
}

function updateScore() {
    document.getElementById('player1Score').textContent = aiScore;
    document.getElementById('player2Score').textContent = playerScore;
    document.getElementById('currentMatch').textContent = upgradeManager.matchCount + 1;
}

// AIの移動制御
function moveAI() {
    if (currentState !== GAME_STATE.PLAYING) return;

    let targetX = canvas.width / 2;
    const baseSpeed = AI_BASE_SPEED * aiTraits.speed;
    let speedMultiplier = 1.0;

    // 一時的な速度低下効果
    if (upgradeManager.hasTemporaryEffect('iceField')) {
        const effect = upgradeManager.temporaryEffects.get('iceField');
        speedMultiplier *= effect.effect.slowdownFactor;
    }

    // ノックバック効果
    if (upgradeManager.hasTemporaryEffect('knockback')) {
        const effect = upgradeManager.temporaryEffects.get('knockback');
        speedMultiplier *= (1 / effect.effect.factor);
    }

    const AI_SPEED = baseSpeed * speedMultiplier;

    if (puck.dy < 0) {
        // パックが上に向かっている場合
        const timeToIntercept = (puck.y) / -puck.dy;
        let predictedX = puck.x + (puck.dx * timeToIntercept);

        // 予測位置にランダム性を追加
        const randomError = (Math.random() - 0.5) * AI_PREDICTION_ERROR * (1 - aiTraits.predictability);
        predictedX += randomError;

        // 攻撃性に基づいて前に出るか待つか決定
        const verticalPosition = aiTraits.aggressiveness * paddleHeight * 2;

        if (predictedX >= 0 && predictedX <= canvas.width) {
            targetX = predictedX;
            if (aiPaddleX + (paddleWidth / 2) < targetX) {
                aiPaddleX += AI_SPEED;
            } else if (aiPaddleX + (paddleWidth / 2) > targetX) {
                aiPaddleX -= AI_SPEED;
            }
        }
    } else {
        // パックが下に向かっている場合、中央に戻る
        const centerX = canvas.width / 2;
        if (aiPaddleX + (paddleWidth / 2) < centerX) {
            aiPaddleX += AI_SPEED * 0.5;
        } else if (aiPaddleX + (paddleWidth / 2) > centerX) {
            aiPaddleX -= AI_SPEED * 0.5;
        }
    }

    // パドルの位置を制限
    aiPaddleX = Math.max(0, Math.min(canvas.width - paddleWidth, aiPaddleX));
}

// プレイヤーパドルの移動
function movePlayer() {
    if (currentState !== GAME_STATE.PLAYING) return;

    // 速度の計算
    const baseSpeed = canvas.width * 0.02;
    let speedMultiplier = 1.0;

    // 通常のスピードアップ効果
    const speedUpgrade = upgradeManager.activeUpgrades.get('speedUpSmall');
    if (speedUpgrade) {
        speedMultiplier *= speedUpgrade.effect.paddleSpeedMultiplier;
    }

    // 一時的な速度低下効果（氷結フィールドなど）
    if (upgradeManager.hasTemporaryEffect('iceField')) {
        const effect = upgradeManager.temporaryEffects.get('iceField');
        speedMultiplier *= effect.effect.slowdownFactor;
    }

    const PLAYER_SPEED = baseSpeed * speedMultiplier;

    if (!isMobile) {
        if (keys.ArrowLeft && playerPaddleX > 0) {
            playerPaddleX -= PLAYER_SPEED;
        }
        if (keys.ArrowRight && playerPaddleX < canvas.width - paddleWidth) {
            playerPaddleX += PLAYER_SPEED;
        }
    }

    // パドルの位置を制限
    playerPaddleX = Math.max(0, Math.min(canvas.width - paddleWidth, playerPaddleX));
}

// マグネット効果の適用
function applyMagneticEffect(force) {
    const dx = playerPaddleX + paddleWidth / 2 - puck.x;
    const dy = canvas.height - paddleHeight - puck.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < canvas.height / 2) {
        puck.dx += (dx / distance) * force;
        puck.dy += (dy / distance) * force;
        limitPuckSpeed();
    }
}

// パックの速度を制限する
function limitPuckSpeed() {
    const currentSpeed = Math.sqrt(puck.dx * puck.dx + puck.dy * puck.dy);
    if (currentSpeed > MAX_PUCK_SPEED) {
        const ratio = MAX_PUCK_SPEED / currentSpeed;
        puck.dx *= ratio;
        puck.dy *= ratio;
    }
}

// パーティクルエフェクトの作成
function createParticles(x, y, color) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// フラッシュエフェクトの作成
function createFlash(color) {
    flashAlpha = 1;
    flashColor = color;
}

// パドルとの衝突判定と処理
function handlePaddleCollisions() {
    const paddleWidthMultiplier = upgradeManager.getUpgradeEffect(UPGRADE_TYPES.PADDLE, 'paddleWidthMultiplier');
    const effectivePaddleWidth = paddleWidth * paddleWidthMultiplier;
    const paddleOffset = (effectivePaddleWidth - paddleWidth) / 2;

    // AIのパドル（上側）との衝突
    if (puck.y - puck.radius < paddleHeight &&
        puck.x > aiPaddleX - paddleOffset &&
        puck.x < aiPaddleX + effectivePaddleWidth &&
        puck.dy < 0) {
        handlePaddleCollision(aiPaddleX - paddleOffset, 0, true, effectivePaddleWidth);
    }

    // プレイヤーのパドル（下側）との衝突
    if (puck.y + puck.radius > canvas.height - paddleHeight &&
        puck.x > playerPaddleX - paddleOffset &&
        puck.x < playerPaddleX + effectivePaddleWidth &&
        puck.dy > 0) {
        handlePaddleCollision(playerPaddleX - paddleOffset, canvas.height - paddleHeight, false, effectivePaddleWidth);
    }
}

// パドルとの衝突時の処理
function handlePaddleCollision(paddleX, paddleY, isTopPaddle, effectivePaddleWidth) {
    const paddleCenterX = paddleX + effectivePaddleWidth / 2;
    const hitX = puck.x - paddleCenterX;
    const normalizedHitX = hitX / (effectivePaddleWidth / 2);

    // 現在のアップグレード効果を取得
    const activeEffects = upgradeManager.getActiveEffects(isTopPaddle ? UPGRADE_TYPES.RARE : UPGRADE_TYPES.COMMON);

    let baseSpeed = Math.sqrt(puck.dx * puck.dx + puck.dy * puck.dy);
    let speedMultiplier = 1.0;
    let knockbackPower = 1.0;
    let angleAdjustment = 1.0;

    // 百錬自得カウンターの発動チェック
    const perfectCounter = activeEffects.find(u => u.id === 'hundredReflexCounter');
    if (perfectCounter && !isTopPaddle) {
        const timingSweetSpot = Math.abs(puck.y - (canvas.height - paddleHeight)) < perfectCounter.effect.perfectTimingWindow;
        if (timingSweetSpot) {
            speedMultiplier *= perfectCounter.effect.speedBoostMultiplier;
            angleAdjustment *= perfectCounter.effect.angleAdjustment;
            effectSystem.createAuraEffect(puck.x, puck.y, perfectCounter.visualEffect);
            puck.lastHitUpgrade = perfectCounter;
        }
    }

    // 重波動ショットの効果
    const heavyWave = activeEffects.find(u => u.id === 'heavyWave');
    if (heavyWave && !isTopPaddle) {
        speedMultiplier *= heavyWave.effect.puckSpeedMultiplier;
        knockbackPower *= heavyWave.effect.knockbackPower;
        effectSystem.createAuraEffect(puck.x, puck.y, heavyWave.visualEffect);
        puck.lastHitUpgrade = heavyWave;

        // コントロール低下効果を適用
        upgradeManager.addTemporaryEffect('controlReduction', {
            factor: heavyWave.effect.controlReduction
        }, heavyWave.effect.controlReductionDuration);
    }

    // 基本的な跳ね返り計算
    const newSpeed = baseSpeed * 1.1 * speedMultiplier;
    const angle = normalizedHitX * Math.PI / 3 * angleAdjustment;

    puck.dx = Math.sin(angle) * newSpeed;
    puck.dy = (isTopPaddle ? 1 : -1) * Math.cos(angle) * newSpeed;
    puck.y = isTopPaddle ? paddleY + paddleHeight + puck.radius : paddleY - puck.radius;

    // ステルス・スネイクの効果
    const stealthSnake = activeEffects.find(u => u.id === 'stealthSnake');
    if (stealthSnake && !isTopPaddle) {
        puck.activeEffects.add('stealth');
        setTimeout(() => {
            puck.activeEffects.delete('stealth');
        }, stealthSnake.effect.fadeOutDuration);
        puck.lastHitUpgrade = stealthSnake;
    }

    // 氷結フィールドショットの効果
    const iceField = activeEffects.find(u => u.id === 'iceFieldShot');
    if (iceField && !isTopPaddle) {
        puck.activeEffects.add('ice');
        puck.lastHitUpgrade = iceField;
    }

    // 破滅への誘引の効果
    const doom = activeEffects.find(u => u.id === 'doomInducement');
    if (doom && !isTopPaddle) {
        puck.activeEffects.add('doom');
        puck.lastHitUpgrade = doom;
    }

    // エフェクトの作成
    createParticles(puck.x, puck.y, isTopPaddle ? '#ff6b6b' : '#4ecdc4');
    createFlash(isTopPaddle ? '#ff6b6b33' : '#4ecdc433');

    // ノックバック効果の適用
    if (isTopPaddle && knockbackPower > 1) {
        upgradeManager.addTemporaryEffect('knockback', {
            factor: knockbackPower
        }, heavyWave.effect.controlReductionDuration);
    }

    // パックの速度を制限
    limitPuckSpeed();
}

// パックの移動と衝突判定
function movePuck() {
    if (currentState !== GAME_STATE.PLAYING) return;

    // 速度の検証
    if (!validatePuckSpeed()) return;

    // ステルス・スネイクの効果による蛇行
    if (puck.activeEffects.has('stealth')) {
        const stealthUpgrade = upgradeManager.activeUpgrades.get('stealthSnake');
        if (stealthUpgrade) {
            const time = Date.now() / 1000;
            puck.dx += Math.sin(time * stealthUpgrade.effect.sineFrequency) *
                stealthUpgrade.effect.sineMagnitude / 100;
        }
    }

    // パックの移動
    puck.x += puck.dx;
    puck.y += puck.dy;

    // 軌跡の更新（制限付き）
    puckTrail.push({
        x: puck.x,
        y: puck.y,
        timestamp: Date.now()
    });

    // 古い軌跡を削除
    const MAX_TRAIL_AGE = 1000; // ミリ秒
    const now = Date.now();
    puckTrail = puckTrail.filter(point =>
        now - point.timestamp < MAX_TRAIL_AGE
    ).slice(-TRAIL_LENGTH);

    // 左右の壁との衝突
    if (puck.x - puck.radius < 0) {
        puck.x = puck.radius;
        puck.dx = Math.abs(puck.dx);
        handleWallCollision(0, puck.y);
    } else if (puck.x + puck.radius > canvas.width) {
        puck.x = canvas.width - puck.radius;
        puck.dx = -Math.abs(puck.dx);
        handleWallCollision(canvas.width, puck.y);
    }

    // パドルとの衝突判定と処理
    handlePaddleCollisions();

    // ゴール判定
    if (puck.y < 0) {
        handleGoal(false);
    } else if (puck.y > canvas.height) {
        handleGoal(true);
    }
}

// 壁との衝突処理
function handleWallCollision(x, y) {
    // 氷結フィールドの効果
    if (puck.activeEffects.has('ice')) {
        const iceUpgrade = upgradeManager.activeUpgrades.get('iceFieldShot');
        if (iceUpgrade) {
            effectSystem.createFieldEffect(x, y, iceUpgrade.visualEffect);
            // 一時的な速度低下効果を追加
            upgradeManager.addTemporaryEffect('iceField', {
                slowdownFactor: iceUpgrade.effect.slowdownFactor
            }, iceUpgrade.effect.fieldDuration);
        }
    }
}

// ゴール時の処理
function handleGoal(isAiScore) {
    if (isAiScore) {
        aiScore++;
        createParticles(puck.x, canvas.height, '#ff6b6b');
        createFlash('#ff6b6b33');

        // 破滅への誘引の効果
        if (puck.activeEffects.has('doom')) {
            const doomUpgrade = upgradeManager.activeUpgrades.get('doomInducement');
            if (doomUpgrade) {
                upgradeManager.addTemporaryEffect('nullification', {
                    factor: doomUpgrade.effect.weakenFactor
                }, 1); // 1ポイント間
            }
        }
    } else {
        playerScore++;
        createParticles(puck.x, 0, '#4ecdc4');
        createFlash('#4ecdc433');
    }

    updateScore();

    if (aiScore >= POINTS_TO_WIN || playerScore >= POINTS_TO_WIN) {
        handleMatchEnd();
    } else {
        resetPuck(isAiScore);
    }
}

// パックのリセット
function resetPuck(aiServe) {
    puck.x = canvas.width / 2;
    puck.y = canvas.height / 2;
    puck.radius = puckSize / 2;

    // 初速を設定
    const angle = Math.PI / 4; // 45度
    puck.dx = INITIAL_PUCK_SPEED * Math.cos(angle) * (Math.random() < 0.5 ? 1 : -1);
    puck.dy = INITIAL_PUCK_SPEED * Math.sin(angle) * (aiServe ? 1 : -1);
}

// 描画関数
function draw() {
    // キャンバスのクリア
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // エフェクトシステムの更新と描画
    effectSystem.update();
    effectSystem.draw();

    // フラッシュエフェクトの描画
    if (flashAlpha > 0) {
        ctx.fillStyle = flashColor;
        ctx.globalAlpha = flashAlpha;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        flashAlpha = Math.max(0, flashAlpha - 1 / FLASH_DURATION);
    }

    // センターラインの描画
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([5, 15]);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // パドルの描画
    drawPaddles();

    // パックの描画
    drawPuck();

    // 壁反射ガイドの描画
    if (upgradeManager.hasUpgrade('wallGuideWeak')) {
        drawWallGuide();
    }
}

// パックの描画
function drawPuck() {
    ctx.save();

    // ステルス効果の適用
    if (puck.activeEffects.has('stealth')) {
        ctx.globalAlpha = 0.3;
    }

    // 基本的なパックの描画
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // アクティブなアップグレードに基づくエフェクトの描画
    if (puck.lastHitUpgrade && puck.lastHitUpgrade.visualEffect) {
        const effect = puck.lastHitUpgrade.visualEffect;

        // 軌跡エフェクト
        if (effect.type === EFFECT_TYPES.TRAIL && puckTrail.length >= 2) {
            effectSystem.createTrailEffect(puckTrail, effect);
        }

        // オーラエフェクト
        if (effect.type === EFFECT_TYPES.AURA) {
            effectSystem.createAuraEffect(puck.x, puck.y, effect);
        }
    }

    ctx.restore();
}

// 壁反射ガイドの描画
function drawWallGuide() {
    const guide = upgradeManager.activeUpgrades.get('wallGuideWeak');
    if (!guide || puck.y > canvas.height * 0.7) return;

    const futureX = puck.x + puck.dx * 10;
    const futureY = puck.y + puck.dy * 10;

    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = guide.effect.guideLineOpacity;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(puck.x, puck.y);
    ctx.lineTo(futureX, futureY);
    ctx.stroke();
    ctx.restore();
}

// パドルの描画
function drawPaddles() {
    // パドルの幅を計算
    let paddleWidthMultiplier = 1.0;

    // 通常の幅アップ効果
    const widthUpgrade = upgradeManager.activeUpgrades.get('widthUpSmall');
    if (widthUpgrade) {
        paddleWidthMultiplier *= widthUpgrade.effect.paddleWidthMultiplier;
    }

    const effectivePaddleWidth = paddleWidth * paddleWidthMultiplier;
    const paddleOffset = (effectivePaddleWidth - paddleWidth) / 2;

    // AIのパドル
    ctx.fillStyle = '#ff6b6b';
    if (upgradeManager.hasTemporaryEffect('nullification')) {
        ctx.globalAlpha = 0.5;
    }
    ctx.fillRect(aiPaddleX - paddleOffset, 0, effectivePaddleWidth, paddleHeight);
    ctx.globalAlpha = 1.0;

    // プレイヤーのパドル
    ctx.fillStyle = '#4ecdc4';
    ctx.fillRect(playerPaddleX - paddleOffset, canvas.height - paddleHeight, effectivePaddleWidth, paddleHeight);

    // パドルのエフェクト
    const paddleEffects = upgradeManager.getUpgradesWithEffectType(EFFECT_TYPES.PADDLE);
    paddleEffects.forEach(upgrade => {
        if (upgrade.visualEffect.afterImage) {
            ctx.save();
            ctx.fillStyle = '#4ecdc4';
            ctx.globalAlpha = 0.3;
            ctx.fillRect(
                playerPaddleX - paddleOffset - 5,
                canvas.height - paddleHeight,
                effectivePaddleWidth + 10,
                paddleHeight
            );
            ctx.restore();
        }
    });
}

// ゲームループ
function gameLoop() {
    moveAI();
    movePlayer();
    movePuck();
    draw();
    requestAnimationFrame(gameLoop);
}

// AIの移動速度を画面サイズに応じて調整
function getAISpeed() {
    return canvas.width * 0.02;
}

// 試合終了時の処理
function handleMatchEnd() {
    lastMatchPlayerScore = playerScore;
    lastMatchAiScore = aiScore;
    totalPlayerScore += playerScore;
    totalAiScore += aiScore;

    const matchCount = upgradeManager.incrementMatch();

    if (matchCount >= 3) {
        // 3試合終了時
        currentState = GAME_STATE.GAME_OVER;
        gameOverScreen.classList.remove('hidden');
        document.getElementById('finalScore').textContent = `${totalAiScore} - ${totalPlayerScore}`;
        winnerMessage.textContent = totalPlayerScore > totalAiScore ?
            'おめでとうございます！あなたの勝ちです！' :
            totalPlayerScore < totalAiScore ?
            'AIの勝ちです。もう一度チャレンジしましょう！' :
            '引き分けです！';
    } else {
        // アップグレード選択画面を表示
        showUpgradeScreen();
    }
}

// アップグレード選択画面の表示
function showUpgradeScreen() {
    currentState = GAME_STATE.UPGRADE;
    const upgradeScreen = document.getElementById('upgradeScreen');
    const upgradeChoices = document.querySelector('.upgrade-choices');
    const lastMatchScore = document.getElementById('lastMatchScore');
    const totalScoreElement = document.getElementById('totalScore');

    // スコアの更新
    lastMatchScore.textContent = `${lastMatchAiScore} - ${lastMatchPlayerScore}`;
    totalScoreElement.textContent = `${totalAiScore} - ${totalPlayerScore}`;

    // 選択肢をクリア
    upgradeChoices.innerHTML = '';

    // 新しい選択肢を生成
    const choices = generateUpgradeChoices(3);
    choices.forEach(upgrade => {
        const choice = document.createElement('div');
        choice.className = `upgrade-choice rarity-${upgrade.rarity}`;
        choice.innerHTML = `
            <h3>${upgrade.name}</h3>
            <p>${upgrade.description}</p>
        `;
        choice.addEventListener('click', () => selectUpgrade(upgrade));
        upgradeChoices.appendChild(choice);
    });

    upgradeScreen.classList.remove('hidden');
}

// アップグレードの選択
function selectUpgrade(upgrade) {
    upgradeManager.addUpgrade(upgrade);
    document.getElementById('upgradeScreen').classList.add('hidden');
    resetForNextMatch();
}

// 次の試合の準備
function resetForNextMatch() {
    playerScore = 0;
    aiScore = 0;
    currentState = GAME_STATE.PLAYING;
    updateScore();
    initializePaddles();
    resetPuck(false);
    randomizeAITraits(); // AIの特性をリセット
    if (effectSystem) {
        effectSystem.clearEffects();
    }
}

// パックの初期化
function initializePuck() {
    puck.x = canvas.width / 2;
    puck.y = canvas.height / 2;
    puck.dx = 0;
    puck.dy = 0;
    puck.radius = puckSize / 2;
    puck.activeEffects.clear();
    puck.lastHitTime = 0;
    puck.lastHitUpgrade = null;
    puckTrail = [];
}

// パドルの初期位置設定
function initializePaddles() {
    aiPaddleX = canvas.width / 2 - paddleWidth / 2;
    playerPaddleX = canvas.width / 2 - paddleWidth / 2;
}

// ゲームの終了処理
function cleanup() {
    if (effectSystem) {
        effectSystem.dispose();
    }
    // イベントリスナーの削除
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('orientationchange', handleOrientationChange);
    if (isMobile) {
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
    } else {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
    }
}

// リサイズハンドラー
function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        resizeCanvas();
    }, 250);
}

// 画面回転ハンドラー
function handleOrientationChange() {
    setTimeout(resizeCanvas, 100);
}

// キーボードハンドラー
function handleKeyDown(e) {
    if (e.key in keys) {
        keys[e.key] = true;
        if (e.key === 'Escape' && currentState === GAME_STATE.PLAYING) {
            pauseGame();
        }
    }
}

function handleKeyUp(e) {
    if (e.key in keys) {
        keys[e.key] = false;
    }
}

// パックの速度の安全性チェック
function validatePuckSpeed() {
    if (isNaN(puck.dx) || isNaN(puck.dy)) {
        console.warn('Invalid puck speed detected, resetting...');
        puck.dx = 0;
        puck.dy = INITIAL_PUCK_SPEED;
        return false;
    }
    return true;
}

// エフェクトの安全な適用
function safelyApplyEffect(effectFunction, ...args) {
    try {
        if (effectSystem && typeof effectSystem[effectFunction] === 'function') {
            return effectSystem[effectFunction](...args);
        }
    } catch (error) {
        console.warn(`Error applying effect ${effectFunction}:`, error);
    }
    return null;
}

// ゲームの初期化
window.onload = function () {
    try {
        resizeCanvas();
        effectSystem = new EffectSystem(ctx);
        resetGame();
        gameLoop();
    } catch (error) {
        console.error('Game initialization failed:', error);
        // エラーメッセージを画面に表示
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = 'ゲームの初期化に失敗しました。ページを再読み込みしてください。';
        document.body.appendChild(errorMessage);
    }
};

// イベントリスナーの設定
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleOrientationChange);

if (isMobile) {
    canvas.addEventListener('touchstart', handleTouchStart, {
        passive: false
    });
    canvas.addEventListener('touchmove', handleTouchMove, {
        passive: false
    });
    canvas.addEventListener('touchend', handleTouchEnd, {
        passive: false
    });
} else {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}