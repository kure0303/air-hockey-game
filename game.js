const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// デバイスタイプの検出
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// エフェクトシステムとアップグレードマネージャーの宣言
let effectSystem = null;
let upgradeManager = null;

// AIのアップグレードマネージャー
let aiUpgradeManager = null;

// キャンバスのサイズ設定
function resizeCanvas() {
    // ヘッダーの実際の高さを取得
    const header = document.querySelector('.header');
    const headerHeight = header ? header.offsetHeight : 0;

    // 利用可能な画面サイズを計算（余白も考慮）
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const padding = 20; // 上下左右の余白

    // 実際に利用可能なサイズ
    const availableWidth = windowWidth - (padding * 2);
    const availableHeight = windowHeight - headerHeight - (padding * 2);

    // 1:1.6の比率を維持しつつ、利用可能なエリアに収まる最大サイズを計算
    let targetWidth = availableWidth;
    let targetHeight = targetWidth * 1.6;

    if (targetHeight > availableHeight) {
        targetHeight = availableHeight;
        targetWidth = targetHeight / 1.6;
    }

    // さらに安全マージンを追加（5%縮小）
    targetWidth = Math.floor(targetWidth * 0.95);
    targetHeight = Math.floor(targetHeight * 0.95);

    // 最小サイズの保証
    const minWidth = 300;
    const minHeight = minWidth * 1.6;

    targetWidth = Math.max(targetWidth, minWidth);
    targetHeight = Math.max(targetHeight, minHeight);

    // 前のサイズを保存
    const prevW = canvas.width || targetWidth;
    const prevH = canvas.height || targetHeight;

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    canvas.style.width = `${targetWidth}px`;
    canvas.style.height = `${targetHeight}px`;

    // ゲーム要素のサイズを更新
    paddleWidth = canvas.width * 0.15;
    paddleHeight = canvas.height * 0.02;
    puckSize = canvas.width * 0.04;

    // パドル・パックの位置を比率で再配置
    if (typeof aiPaddleX === 'number') {
        aiPaddleX = (aiPaddleX / prevW) * canvas.width;
    } else {
        aiPaddleX = canvas.width / 2 - paddleWidth / 2;
    }
    if (typeof playerPaddleX === 'number') {
        playerPaddleX = (playerPaddleX / prevW) * canvas.width;
    } else {
        playerPaddleX = canvas.width / 2 - paddleWidth / 2;
    }
    if (puck && typeof puck.x === 'number' && typeof puck.y === 'number') {
        puck.x = (puck.x / prevW) * canvas.width;
        puck.y = (puck.y / prevH) * canvas.height;
        puck.radius = puckSize / 2;
    }

    // パドルの初期化のみ（パックの初期化は削除）
    initializePaddles();

    // スタイルの更新
    updateGameStyles();

    console.log(`Canvas resized to: ${targetWidth}x${targetHeight}, Available: ${availableWidth}x${availableHeight}`);
}

// ゲームスタイルの更新
function updateGameStyles() {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.style.width = `${canvas.width * 0.8}px`;
        screen.style.fontSize = `${canvas.width * 0.04}px`;
    });

    // スコアのスタイル更新
    const scoreContainer = document.querySelector('.score-container');
    if (scoreContainer) {
        scoreContainer.style.fontSize = `${canvas.width * 0.05}px`;
        scoreContainer.style.marginBottom = `${canvas.height * 0.02}px`;
    }

    // マッチ情報のスタイル更新
    const matchInfo = document.querySelector('.match-info');
    if (matchInfo) {
        matchInfo.style.fontSize = `${canvas.width * 0.04}px`;
        matchInfo.style.marginBottom = `${canvas.height * 0.02}px`;
    }
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

// パドルの移動速度追跡用
let lastPlayerPaddleX = 0;
let lastAiPaddleX = 0;
let playerPaddleVelocity = 0;
let aiPaddleVelocity = 0;

let puck = {
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    radius: 0,
    activeEffects: new Set(),
    lastHitTime: 0,
    lastHitUpgrade: null,
    // 回転・テクニック要素
    spin: 0, // 回転値 (-1 to 1)
    spinDecay: 0.98, // 回転減衰率
    lastShotType: 'normal' // 'normal', 'critical', 'slide', 'angle'
};

// パックの軌跡を保存
let puckTrail = [];
const TRAIL_LENGTH = 10;

// ゲーム要素の初期設定（サイズはresizeCanvasで更新）
let paddleWidth = 60;
let paddleHeight = 10;
let puckSize = 15;

// AI設定
const AI_BASE_SPEED = 6; // 少し遅く
const AI_PREDICTION_ERROR = 15; // エラーを増加
const MAX_PUCK_SPEED = 12; // 最大速度を少し下げる
const INITIAL_PUCK_SPEED = 6; // 初期速度を少し下げる

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
        // 小さな遅延を加えてヘッダーのレイアウトが確定してから実行
        setTimeout(resizeCanvas, 50);
    }, 100);
});

// 画面回転時の処理を追加
window.addEventListener('orientationchange', () => {
    // 向き変更後のレイアウト確定を待つ
    setTimeout(() => {
        resizeCanvas();
    }, 300);
});

// 初期化時にも確実にリサイズ
window.addEventListener('load', () => {
    setTimeout(resizeCanvas, 100);
});

// ボタンのイベントリスナー
startButton.addEventListener('click', startGame);
resumeButton.addEventListener('click', resumeGame);
restartButton.addEventListener('click', resetGame);
playAgainButton.addEventListener('click', resetGame);

// ゲーム開始
function startGame() {
    console.log('Starting game...');

    // システムの初期化
    if (!effectSystem) {
        effectSystem = new EffectSystem(ctx);
    } else {
        effectSystem.clearEffects();
    }

    if (!upgradeManager) {
        upgradeManager = new UpgradeManager();
    } else {
        upgradeManager.reset();
    }

    // AIのアップグレードマネージャーも初期化
    if (!aiUpgradeManager) {
        aiUpgradeManager = new UpgradeManager();
    } else {
        aiUpgradeManager.reset();
    }

    // アップグレード表示を初期化
    updateUpgradeDisplay();

    currentState = GAME_STATE.PLAYING;
    document.getElementById('startScreen').classList.add('hidden');
    initializePuck();
    initializePaddles();
    resizeCanvas();
    updateScore();
    randomizeAITraits();
    requestAnimationFrame(gameLoop);
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

    // アップグレードマネージャーをリセット
    if (upgradeManager) {
        upgradeManager.reset();
    }

    // AIのアップグレードマネージャーもリセット
    if (aiUpgradeManager) {
        aiUpgradeManager.reset();
    }

    // アップグレード表示をクリア
    updateUpgradeDisplay();

    randomizeAITraits();

    // エフェクトシステムをクリア
    if (effectSystem) {
        effectSystem.clearEffects();
    }

    currentState = GAME_STATE.START;
    updateScore();
    initializePaddles();

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
    document.getElementById('currentMatch').textContent = upgradeManager ? (upgradeManager.matchCount + 1) : 1;
}

// AIの移動制御
function moveAI() {
    if (currentState !== GAME_STATE.PLAYING) return;

    // 前フレームの位置を保存
    lastAiPaddleX = aiPaddleX;

    let targetX = canvas.width / 2;
    const baseSpeed = AI_BASE_SPEED * aiTraits.speed;
    let speedMultiplier = 1.0;

    // AIのスピードアップ効果（重複対応）
    if (aiUpgradeManager) {
        const speedUpgrades = aiUpgradeManager.upgradeInstances.filter(u => u.id === 'speedUpSmall');
        speedUpgrades.forEach(speedUpgrade => {
            speedMultiplier *= speedUpgrade.effect.paddleSpeedMultiplier;
        });

        // 一時的な速度低下効果（相手からの攻撃）
        if (aiUpgradeManager.hasTemporaryEffect('iceField')) {
            const effect = aiUpgradeManager.temporaryEffects.get('iceField');
            speedMultiplier *= effect.effect.slowdownFactor;
        }

        // ノックバック効果（相手からの攻撃）
        if (aiUpgradeManager.hasTemporaryEffect('knockback')) {
            const effect = aiUpgradeManager.temporaryEffects.get('knockback');
            speedMultiplier *= (1 / effect.effect.factor);
        }
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

    // AI速度を計算（テクニック検出用）
    aiPaddleVelocity = aiPaddleX - lastAiPaddleX;
}

// プレイヤーパドルの移動
function movePlayer() {
    if (currentState !== GAME_STATE.PLAYING) return;

    // 前フレームの位置を保存
    lastPlayerPaddleX = playerPaddleX;

    // 速度の計算
    const baseSpeed = canvas.width * 0.02;
    let speedMultiplier = 1.0;

    // 通常のスピードアップ効果（重複対応）
    if (upgradeManager) {
        const speedUpgrades = upgradeManager.upgradeInstances.filter(u => u.id === 'speedUpSmall');
        speedUpgrades.forEach(speedUpgrade => {
            speedMultiplier *= speedUpgrade.effect.paddleSpeedMultiplier;
        });

        // 一時的な速度低下効果（氷結フィールドなど）
        if (upgradeManager.hasTemporaryEffect('iceField')) {
            const effect = upgradeManager.temporaryEffects.get('iceField');
            speedMultiplier *= effect.effect.slowdownFactor;
        }
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

    // パドル速度を計算（テクニック検出用）
    playerPaddleVelocity = playerPaddleX - lastPlayerPaddleX;
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

// パックの速度を制限する（強化版）
function limitPuckSpeed() {
    const currentSpeed = Math.sqrt(puck.dx * puck.dx + puck.dy * puck.dy);
    const maxSpeed = MAX_PUCK_SPEED;

    if (currentSpeed > maxSpeed) {
        const ratio = maxSpeed / currentSpeed;
        puck.dx *= ratio;
        puck.dy *= ratio;
    }

    // 最低速度を少し下げて、よりゆっくりとした動きを許可
    const minSpeed = INITIAL_PUCK_SPEED * 0.3; // 最低速度をさらに下げる
    if (currentSpeed < minSpeed && currentSpeed > 0) {
        const ratio = minSpeed / currentSpeed;
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

// クリティカルショット用エフェクト（キラッ）
function createCriticalEffect(x, y, isTopPaddle) {
    // 強い光のフラッシュ
    createFlash('#ffffff88');

    // 特別な星型パーティクル
    for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * Math.PI * 2;
        const speed = 8 + Math.random() * 4;
        const particle = new Particle(x, y, '#ffff00');
        particle.dx = Math.cos(angle) * speed;
        particle.dy = Math.sin(angle) * speed;
        particle.size = 3 + Math.random() * 2;
        particle.lifetime = 20;
        particles.push(particle);
    }

    // 音効果的な視覚表現（短い光の輪）
    if (effectSystem) {
        try {
            effectSystem.createRingEffect(x, y, {
                color: '#ffff00',
                maxRadius: 30,
                duration: 300,
                thickness: 3
            });
        } catch (e) {
            console.warn('Ring effect not available:', e);
        }
    }
}

// スライドショット用エフェクト（回転の軌跡）
function createSlideEffect(x, y, isTopPaddle) {
    const color = isTopPaddle ? '#ff6b6b' : '#4ecdc4';

    // 回転を表現する螺旋パーティクル
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 15 + i * 2;
        const particle = new Particle(
            x + Math.cos(angle) * radius,
            y + Math.sin(angle) * radius,
            color
        );
        particle.dx = Math.cos(angle + Math.PI / 2) * 3;
        particle.dy = Math.sin(angle + Math.PI / 2) * 3;
        particle.size = 2;
        particle.lifetime = 25;
        particles.push(particle);
    }

    // 弱いフラッシュ
    createFlash(color + '44');
}

// アングルショット用エフェクト（鋭い光線）
function createAngleEffect(x, y, isTopPaddle) {
    const color = isTopPaddle ? '#ff6b6b' : '#4ecdc4';

    // 鋭角な光線エフェクト
    for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 12 + Math.random() * 8;
        const particle = new Particle(x, y, color);
        particle.dx = Math.cos(angle) * speed;
        particle.dy = Math.sin(angle) * speed;
        particle.size = 1.5;
        particle.lifetime = 15;
        particles.push(particle);
    }

    // 強めのフラッシュ
    createFlash(color + '66');

    // 十字形の光線
    const directions = [{
            dx: 1,
            dy: 0
        }, {
            dx: -1,
            dy: 0
        },
        {
            dx: 0,
            dy: 1
        }, {
            dx: 0,
            dy: -1
        }
    ];

    directions.forEach(dir => {
        for (let i = 1; i <= 5; i++) {
            const particle = new Particle(
                x + dir.dx * i * 8,
                y + dir.dy * i * 8,
                '#ffffff'
            );
            particle.dx = dir.dx * 2;
            particle.dy = dir.dy * 2;
            particle.size = 3 - i * 0.4;
            particle.lifetime = 20 - i * 2;
            particles.push(particle);
        }
    });
}

// パドルとの衝突判定と処理
function handlePaddleCollisions() {
    // エラーチェック
    if (!upgradeManager || !aiUpgradeManager) {
        console.warn('Upgrade managers not initialized');
        return;
    }

    // プレイヤーのパドル幅を計算（重複対応）
    let playerPaddleWidthMultiplier = 1.0;
    const playerWidthUpgrades = upgradeManager.upgradeInstances.filter(u => u.id === 'widthUpSmall');
    playerWidthUpgrades.forEach(widthUpgrade => {
        if (widthUpgrade.effect && widthUpgrade.effect.paddleWidthMultiplier) {
            playerPaddleWidthMultiplier *= widthUpgrade.effect.paddleWidthMultiplier;
        }
    });

    // AIのパドル幅を計算（重複対応）
    let aiPaddleWidthMultiplier = 1.0;
    const aiWidthUpgrades = aiUpgradeManager.upgradeInstances.filter(u => u.id === 'widthUpSmall');
    aiWidthUpgrades.forEach(widthUpgrade => {
        if (widthUpgrade.effect && widthUpgrade.effect.paddleWidthMultiplier) {
            aiPaddleWidthMultiplier *= widthUpgrade.effect.paddleWidthMultiplier;
        }
    });

    // AIのパドル（上側）との衝突
    const aiEffectivePaddleWidth = paddleWidth * aiPaddleWidthMultiplier;
    const aiPaddleOffset = (aiEffectivePaddleWidth - paddleWidth) / 2;

    if (puck.y - puck.radius < paddleHeight &&
        puck.x > aiPaddleX - aiPaddleOffset &&
        puck.x < aiPaddleX + aiEffectivePaddleWidth &&
        puck.dy < 0) {
        handlePaddleCollision(aiPaddleX - aiPaddleOffset, 0, true, aiEffectivePaddleWidth);
    }

    // プレイヤーのパドル（下側）との衝突
    const playerEffectivePaddleWidth = paddleWidth * playerPaddleWidthMultiplier;
    const playerPaddleOffset = (playerEffectivePaddleWidth - paddleWidth) / 2;

    if (puck.y + puck.radius > canvas.height - paddleHeight &&
        puck.x > playerPaddleX - playerPaddleOffset &&
        puck.x < playerPaddleX + playerEffectivePaddleWidth &&
        puck.dy > 0) {
        handlePaddleCollision(playerPaddleX - playerPaddleOffset, canvas.height - paddleHeight, false, playerEffectivePaddleWidth);
    }
}

// パックの移動と衝突判定
function movePuck() {
    if (currentState !== GAME_STATE.PLAYING) return;

    // 速度の検証
    if (!validatePuckSpeed()) return;

    // ステルス・スネイクの効果による蛇行
    if (puck.activeEffects.has('stealth') && upgradeManager) {
        const stealthUpgrade = upgradeManager.upgradeInstances.find(u => u.id === 'stealthSnake');
        if (stealthUpgrade) {
            const time = Date.now() / 1000;
            puck.dx += Math.sin(time * stealthUpgrade.effect.sineFrequency) *
                stealthUpgrade.effect.sineMagnitude / 100;
        }
    }

    // 回転による軌道変化（スライドショット効果）
    if (Math.abs(puck.spin) > 0.1) {
        const spinForce = puck.spin * 0.3; // 回転の強さを調整
        puck.dx += spinForce * Math.sign(puck.dy); // 回転方向によって横に曲がる

        // 回転減衰
        puck.spin *= puck.spinDecay;
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
        // 壁との衝突で回転も反転
        puck.spin *= -0.7;
        handleWallCollision(0, puck.y);
    } else if (puck.x + puck.radius > canvas.width) {
        puck.x = canvas.width - puck.radius;
        puck.dx = -Math.abs(puck.dx);
        // 壁との衝突で回転も反転
        puck.spin *= -0.7;
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
        const iceUpgrade = upgradeManager.upgradeInstances.find(u => u.id === 'iceFieldShot');
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
            const doomUpgrade = upgradeManager.upgradeInstances.find(u => u.id === 'doomInducement');
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

// パックのリセット（ゴール後）
function resetPuck(aiServe) {
    puck.x = canvas.width / 2;
    puck.y = canvas.height / 2;
    puck.radius = puckSize / 2;

    // ゴール後はさらに低速でゆっくりと中央に向かう
    const GOAL_RESET_SPEED = 2; // さらに遅い速度
    const angle = Math.PI / 8; // 22.5度（より浅い角度で中央寄り）

    // 水平方向の動きを小さくして、より中央に向かうように
    puck.dx = GOAL_RESET_SPEED * Math.sin(angle) * (Math.random() < 0.5 ? 1 : -1) * 0.7; // 水平速度を30%減
    puck.dy = GOAL_RESET_SPEED * Math.cos(angle) * (aiServe ? 1 : -1); // 垂直方向は維持

    // エフェクトをクリア
    puck.activeEffects.clear();
    puck.lastHitTime = 0;
    puck.lastHitUpgrade = null;
    puck.spin = 0; // 回転を初期化
    puck.lastShotType = 'normal'; // ショットタイプを初期化
    puckTrail = [];
}

// 描画関数
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 背景を描画
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // エフェクトシステムの更新と描画
    if (effectSystem) {
        try {
            effectSystem.update();
            effectSystem.draw();
        } catch (error) {
            console.warn('Error in effect system:', error);
        }
    }

    // フラッシュエフェクトの描画
    if (flashAlpha > 0) {
        ctx.fillStyle = flashColor;
        ctx.globalAlpha = flashAlpha;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        flashAlpha = Math.max(0, flashAlpha - 1 / FLASH_DURATION);
    }

    // パーティクルの更新と描画
    particles = particles.filter(particle => {
        particle.update();
        if (particle.lifetime > 0) {
            particle.draw(ctx);
            return true;
        }
        return false;
    });

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
    if (upgradeManager && upgradeManager.upgradeInstances.some(u => u.id === 'wallGuideWeak')) {
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
    if (puck.lastHitUpgrade && puck.lastHitUpgrade.visualEffect && typeof EFFECT_TYPES !== 'undefined') {
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
    const guide = upgradeManager.upgradeInstances.find(u => u.id === 'wallGuideWeak');
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
    // プレイヤーのパドル幅を計算（重複対応）
    let playerPaddleWidthMultiplier = 1.0;
    if (upgradeManager) {
        const widthUpgrades = upgradeManager.upgradeInstances.filter(u => u.id === 'widthUpSmall');
        widthUpgrades.forEach(widthUpgrade => {
            if (widthUpgrade.effect && widthUpgrade.effect.paddleWidthMultiplier) {
                playerPaddleWidthMultiplier *= widthUpgrade.effect.paddleWidthMultiplier;
            }
        });
    }

    // AIのパドル幅を計算（重複対応）
    let aiPaddleWidthMultiplier = 1.0;
    if (aiUpgradeManager) {
        const aiWidthUpgrades = aiUpgradeManager.upgradeInstances.filter(u => u.id === 'widthUpSmall');
        aiWidthUpgrades.forEach(widthUpgrade => {
            if (widthUpgrade.effect && widthUpgrade.effect.paddleWidthMultiplier) {
                aiPaddleWidthMultiplier *= widthUpgrade.effect.paddleWidthMultiplier;
            }
        });
    }

    const playerEffectivePaddleWidth = paddleWidth * playerPaddleWidthMultiplier;
    const playerPaddleOffset = (playerEffectivePaddleWidth - paddleWidth) / 2;

    const aiEffectivePaddleWidth = paddleWidth * aiPaddleWidthMultiplier;
    const aiPaddleOffset = (aiEffectivePaddleWidth - paddleWidth) / 2;

    // パドルの高さ（3D効果用）
    const paddleDepth = paddleHeight * 1.5;

    // AIのパドル（3D風描画）
    ctx.save();

    // 影（背面）
    ctx.fillStyle = '#cc5555';
    if (aiUpgradeManager && aiUpgradeManager.hasTemporaryEffect('nullification')) {
        ctx.globalAlpha = 0.3;
    }
    ctx.fillRect(aiPaddleX - aiPaddleOffset + 2, 2, aiEffectivePaddleWidth, paddleDepth);

    // 側面
    ctx.fillStyle = '#dd5555';
    ctx.fillRect(aiPaddleX - aiPaddleOffset, paddleHeight, aiEffectivePaddleWidth, paddleDepth - paddleHeight);

    // 上面（メイン）
    ctx.fillStyle = '#ff6b6b';
    if (Math.abs(aiPaddleVelocity) > 3) { // 高速移動時の発光
        ctx.shadowColor = '#ff6b6b';
        ctx.shadowBlur = 10;
    }
    ctx.fillRect(aiPaddleX - aiPaddleOffset, 0, aiEffectivePaddleWidth, paddleHeight);

    // 中央線（クリティカルヒット範囲の視覚化）
    const centerLineWidth = aiEffectivePaddleWidth * 0.4;
    const centerLineOffset = (aiEffectivePaddleWidth - centerLineWidth) / 2;
    ctx.fillStyle = '#ffaaaa';
    ctx.fillRect(aiPaddleX - aiPaddleOffset + centerLineOffset, 1, centerLineWidth, 2);

    ctx.restore();

    // プレイヤーのパドル（3D風描画）
    ctx.save();

    // 影（背面）
    ctx.fillStyle = '#3aa3a3';
    ctx.fillRect(playerPaddleX - playerPaddleOffset + 2, canvas.height - paddleDepth + 2, playerEffectivePaddleWidth, paddleDepth);

    // 側面
    ctx.fillStyle = '#3bb4b4';
    ctx.fillRect(playerPaddleX - playerPaddleOffset, canvas.height - paddleDepth, playerEffectivePaddleWidth, paddleDepth - paddleHeight);

    // 上面（メイン）
    ctx.fillStyle = '#4ecdc4';
    if (Math.abs(playerPaddleVelocity) > 3) { // 高速移動時の発光
        ctx.shadowColor = '#4ecdc4';
        ctx.shadowBlur = 10;
    }
    ctx.fillRect(playerPaddleX - playerPaddleOffset, canvas.height - paddleHeight, playerEffectivePaddleWidth, paddleHeight);

    // 中央線（クリティカルヒット範囲の視覚化）
    const playerCenterLineWidth = playerEffectivePaddleWidth * 0.4;
    const playerCenterLineOffset = (playerEffectivePaddleWidth - playerCenterLineWidth) / 2;
    ctx.fillStyle = '#aaffff';
    ctx.fillRect(playerPaddleX - playerPaddleOffset + playerCenterLineOffset, canvas.height - paddleHeight + 1, playerCenterLineWidth, 2);

    ctx.restore();

    // パドルのエフェクト（重複対応）
    if (upgradeManager && typeof EFFECT_TYPES !== 'undefined') {
        const paddleEffects = upgradeManager.upgradeInstances.filter(upgrade =>
            upgrade.visualEffect && upgrade.visualEffect.type === EFFECT_TYPES.PADDLE
        );
        paddleEffects.forEach(upgrade => {
            if (upgrade.visualEffect && upgrade.visualEffect.afterImage) {
                ctx.save();
                ctx.fillStyle = '#4ecdc4';
                ctx.globalAlpha = 0.3;
                ctx.fillRect(
                    playerPaddleX - playerPaddleOffset - 5,
                    canvas.height - paddleHeight,
                    playerEffectivePaddleWidth + 10,
                    paddleHeight
                );
                ctx.restore();
            }
        });
    }

    // AIのパドルエフェクト（重複対応）
    if (aiUpgradeManager && typeof EFFECT_TYPES !== 'undefined') {
        const aiPaddleEffects = aiUpgradeManager.upgradeInstances.filter(upgrade =>
            upgrade.visualEffect && upgrade.visualEffect.type === EFFECT_TYPES.PADDLE
        );
        aiPaddleEffects.forEach(upgrade => {
            if (upgrade.visualEffect && upgrade.visualEffect.afterImage) {
                ctx.save();
                ctx.fillStyle = '#ff6b6b';
                ctx.globalAlpha = 0.3;
                ctx.fillRect(
                    aiPaddleX - aiPaddleOffset - 5,
                    0,
                    aiEffectivePaddleWidth + 10,
                    paddleHeight
                );
                ctx.restore();
            }
        });
    }

    // テクニック表示
    drawTechniqueIndicators();
}

// ゲームループ
function gameLoop() {
    if (currentState === GAME_STATE.PLAYING) {
        moveAI();
        movePlayer();
        movePuck();
    }

    // 常に描画は行う（エフェクトなどを表示するため）
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

    // エラーチェック
    if (!upgradeManager || !aiUpgradeManager) {
        console.error('Upgrade managers not initialized');
        showErrorMessage('アップグレードシステムにエラーが発生しました。');
        return;
    }

    // 新しい選択肢を生成（3つ）
    try {
        const choices = generateUpgradeChoices(3);
        choices.forEach(upgrade => {
            const choice = document.createElement('div');
            choice.className = `upgrade-choice rarity-${upgrade.type.toLowerCase()}`;

            // アップグレードの詳細情報を表示
            let effectDescription = '';
            if (upgrade.effect) {
                const effects = [];
                if (upgrade.effect.puckSpeedMultiplier) effects.push(`パックの速度 x${upgrade.effect.puckSpeedMultiplier}`);
                if (upgrade.effect.knockbackPower) effects.push(`ノックバック威力 x${upgrade.effect.knockbackPower}`);
                if (upgrade.effect.speedBoostMultiplier) effects.push(`速度ブースト x${upgrade.effect.speedBoostMultiplier}`);
                if (upgrade.effect.slowdownFactor) effects.push(`減速効果 x${upgrade.effect.slowdownFactor}`);
                if (upgrade.effect.paddleSpeedMultiplier) effects.push(`パドル速度 x${upgrade.effect.paddleSpeedMultiplier}`);
                if (upgrade.effect.paddleWidthMultiplier) effects.push(`パドル幅 x${upgrade.effect.paddleWidthMultiplier}`);
                if (upgrade.effect.initialSpeedMultiplier) effects.push(`初速 x${upgrade.effect.initialSpeedMultiplier}`);
                if (effects.length > 0) {
                    effectDescription = `<div class="effect-details">${effects.join('<br>')}</div>`;
                }
            }

            choice.innerHTML = `
                <h3>${upgrade.name}</h3>
                <p>${upgrade.description}</p>
                ${effectDescription}
                <div class="upgrade-type">${upgrade.type}</div>
            `;

            // エフェクトのプレビュー表示
            if (upgrade.visualEffect && upgrade.visualEffect.color) {
                const preview = document.createElement('div');
                preview.className = 'effect-preview';
                preview.style.backgroundColor = upgrade.visualEffect.color;
                preview.style.opacity = '0.7';
                choice.appendChild(preview);
            }

            choice.addEventListener('click', () => {
                console.log('Selected upgrade:', upgrade);
                selectUpgrade(upgrade);
            });
            upgradeChoices.appendChild(choice);
        });

        upgradeScreen.classList.remove('hidden');
    } catch (error) {
        console.error('Error generating upgrade choices:', error);
        showErrorMessage('アップグレードの生成に失敗しました。');
    }
}

// アップグレードの選択
function selectUpgrade(upgrade) {
    console.log('Processing upgrade selection:', upgrade.name);

    if (applyUpgrade(upgrade)) {
        // AIにもランダムアップグレードを付与
        giveAIRandomUpgrade();

        // アップグレード表示を更新
        updateUpgradeDisplay();

        // アップグレード画面を閉じて次の試合を準備
        document.getElementById('upgradeScreen').classList.add('hidden');
        resetForNextMatch();
    }
}

// 次の試合の準備
function resetForNextMatch() {
    playerScore = 0;
    aiScore = 0;
    currentState = GAME_STATE.PLAYING;
    updateScore();
    initializePaddles();
    resetPuck(false);
    randomizeAITraits();

    // エフェクトシステムのクリア
    if (effectSystem) {
        try {
            effectSystem.clearEffects();
        } catch (error) {
            console.warn('Error clearing effects:', error);
        }
    }
}

// パックの初期化
function initializePuck() {
    puck.x = canvas.width / 2;
    puck.y = canvas.height / 2;
    // 初期速度を少し遅めに設定
    const angle = Math.PI / 4; // 45度
    const slowInitialSpeed = INITIAL_PUCK_SPEED * 0.8; // 初期速度を20%減
    puck.dx = slowInitialSpeed * Math.cos(angle) * (Math.random() < 0.5 ? 1 : -1);
    puck.dy = slowInitialSpeed * Math.sin(angle) * (Math.random() < 0.5 ? 1 : -1);
    puck.radius = puckSize / 2;
    puck.activeEffects.clear();
    puck.lastHitTime = 0;
    puck.lastHitUpgrade = null;
    puck.spin = 0; // 回転を初期化
    puck.lastShotType = 'normal'; // ショットタイプを初期化
    puckTrail = [];
}

// パドルの初期位置設定
function initializePaddles() {
    aiPaddleX = canvas.width / 2 - paddleWidth / 2;
    playerPaddleX = canvas.width / 2 - paddleWidth / 2;
}

// ゲームの終了処理
function cleanup() {
    // イベントリスナーの削除
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('orientationchange', handleOrientationChange);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);

    // タッチイベントの削除
    canvas.removeEventListener('touchstart', handleTouchStart);
    canvas.removeEventListener('touchmove', handleTouchMove);
    canvas.removeEventListener('touchend', handleTouchEnd);

    // エフェクトシステムの破棄
    if (effectSystem) {
        effectSystem.dispose();
    }

    // アップグレードマネージャーのリセット
    if (upgradeManager) {
        upgradeManager.reset();
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

// エフェクトシステムとアップグレードマネージャーの初期化
function initializeGameSystems() {
    console.log('Initializing game systems...');
    try {
        // エフェクトシステムの初期化
        if (effectSystem) {
            effectSystem.dispose();
        }
        effectSystem = new EffectSystem(ctx);
        console.log('Effect system initialized');

        // アップグレードマネージャーの初期化
        if (upgradeManager) {
            upgradeManager.reset();
        }
        upgradeManager = new UpgradeManager();
        console.log('Upgrade manager initialized');

        return true;
    } catch (error) {
        console.error('Failed to initialize game systems:', error);
        showErrorMessage('ゲームシステムの初期化に失敗しました。');
        return false;
    }
}

// エラーメッセージの表示
function showErrorMessage(message, duration = 5000) {
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }

    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.textContent = message;
    document.body.appendChild(errorMessage);

    setTimeout(() => {
        errorMessage.classList.add('fade-out');
        setTimeout(() => errorMessage.remove(), 500);
    }, duration);
}

// エフェクトの適用を最適化
function applyEffects(x, y, effects) {
    if (!effectSystem || !effects) return;

    // EFFECT_TYPESが定義されていない場合は早期リターン
    if (typeof EFFECT_TYPES === 'undefined') {
        console.warn('EFFECT_TYPES is not defined');
        return;
    }

    const batchedEffects = effects.reduce((acc, effect) => {
        if (!acc[effect.type]) {
            acc[effect.type] = [];
        }
        acc[effect.type].push(effect);
        return acc;
    }, {});

    Object.entries(batchedEffects).forEach(([type, typeEffects]) => {
        try {
            switch (type) {
                case EFFECT_TYPES.AURA:
                    typeEffects.forEach(effect =>
                        safelyApplyEffect('createAuraEffect', x, y, effect.visualEffect));
                    break;
                case EFFECT_TYPES.TRAIL:
                    typeEffects.forEach(effect =>
                        safelyApplyEffect('createTrailEffect', puckTrail, effect.visualEffect));
                    break;
                case EFFECT_TYPES.IMPACT:
                    typeEffects.forEach(effect =>
                        safelyApplyEffect('createParticles', x, y, effect.visualEffect));
                    break;
                case EFFECT_TYPES.FIELD:
                    typeEffects.forEach(effect =>
                        safelyApplyEffect('createFieldEffect', x, y, effect.visualEffect));
                    break;
            }
        } catch (error) {
            console.warn(`Failed to apply ${type} effects:`, error);
        }
    });
}

// アップグレードの適用を最適化
function applyUpgrade(upgrade) {
    if (!upgrade) return;

    console.log('Applying upgrade:', upgrade.name);
    try {
        // アップグレードの基本効果を適用
        upgradeManager.addUpgrade(upgrade);

        // ビジュアルエフェクトを適用
        if (upgrade.visualEffect) {
            applyEffects(puck.x, puck.y, [upgrade]);
        }

        // 特殊効果の初期化
        if (upgrade.effect) {
            if (upgrade.effect.initialEffect) {
                safelyApplyEffect(upgrade.effect.initialEffect.type,
                    puck.x, puck.y, upgrade.effect.initialEffect);
            }
        }

        return true;
    } catch (error) {
        console.error('Failed to apply upgrade:', error);
        showErrorMessage('アップグレードの適用に失敗しました。');
        return false;
    }
}

// アップグレード表示の更新
function updateUpgradeDisplay() {
    // プレイヤーのアップグレード表示
    updatePlayerUpgradeDisplay();
    // AIのアップグレード表示
    updateAIUpgradeDisplay();
}

function updatePlayerUpgradeDisplay() {
    const playerUpgradeList = document.getElementById('playerUpgradeList');
    if (!playerUpgradeList || !upgradeManager) return;

    playerUpgradeList.innerHTML = '';

    const activeUpgrades = upgradeManager.upgradeInstances;

    if (activeUpgrades.length === 0) {
        const noUpgrades = document.createElement('div');
        noUpgrades.textContent = 'アップグレードなし';
        noUpgrades.style.color = '#7f8c8d';
        noUpgrades.style.fontSize = '12px';
        playerUpgradeList.appendChild(noUpgrades);
        return;
    }

    // 重複したアップグレードをカウント
    const upgradeCount = {};
    activeUpgrades.forEach(upgrade => {
        upgradeCount[upgrade.id] = (upgradeCount[upgrade.id] || 0) + 1;
    });

    Object.entries(upgradeCount).forEach(([id, count]) => {
        const upgrade = activeUpgrades.find(u => u.id === id);
        const upgradeItem = document.createElement('div');
        upgradeItem.className = `upgrade-item ${upgrade.type === UPGRADE_TYPES.RARE ? 'rare' : ''}`;
        upgradeItem.textContent = count > 1 ? `${upgrade.name} x${count}` : upgrade.name;
        upgradeItem.title = upgrade.description;
        playerUpgradeList.appendChild(upgradeItem);
    });
}

function updateAIUpgradeDisplay() {
    const aiUpgradeList = document.getElementById('aiUpgradeList');
    if (!aiUpgradeList || !aiUpgradeManager) return;

    aiUpgradeList.innerHTML = '';

    const activeUpgrades = aiUpgradeManager.upgradeInstances;

    if (activeUpgrades.length === 0) {
        const noUpgrades = document.createElement('div');
        noUpgrades.textContent = 'アップグレードなし';
        noUpgrades.style.color = '#7f8c8d';
        noUpgrades.style.fontSize = '12px';
        aiUpgradeList.appendChild(noUpgrades);
        return;
    }

    // 重複したアップグレードをカウント
    const upgradeCount = {};
    activeUpgrades.forEach(upgrade => {
        upgradeCount[upgrade.id] = (upgradeCount[upgrade.id] || 0) + 1;
    });

    Object.entries(upgradeCount).forEach(([id, count]) => {
        const upgrade = activeUpgrades.find(u => u.id === id);
        const upgradeItem = document.createElement('div');
        upgradeItem.className = `upgrade-item ${upgrade.type === UPGRADE_TYPES.RARE ? 'rare' : ''}`;
        upgradeItem.textContent = count > 1 ? `${upgrade.name} x${count}` : upgrade.name;
        upgradeItem.title = upgrade.description;
        aiUpgradeList.appendChild(upgradeItem);
    });
}

// AIにランダムアップグレードを付与
function giveAIRandomUpgrade() {
    if (!aiUpgradeManager) return;

    try {
        const choices = generateUpgradeChoices(1);
        if (choices.length > 0) {
            const randomUpgrade = choices[0];
            aiUpgradeManager.addUpgrade(randomUpgrade);
            console.log('AI got upgrade:', randomUpgrade.name);
        }
    } catch (error) {
        console.warn('Failed to give AI upgrade:', error);
    }
}

// ゲームの初期化を改善
window.onload = function () {
    try {
        console.log('Window loaded, initializing game...');

        // キャンバスのコンテキストを確認
        if (!ctx) {
            throw new Error('Canvas context not available');
        }

        // システムの初期化
        if (!initializeGameSystems()) {
            throw new Error('Failed to initialize game systems');
        }

        // 初期リサイズ（少し遅延させてDOMが完全に構築されるのを待つ）
        setTimeout(() => {
            resizeCanvas();
            console.log('Initial canvas resize completed');
        }, 200);

        // ゲームの初期状態設定
        resetGame();
        console.log('Game reset');

        // スタート画面の表示
        startScreen.classList.remove('hidden');
        console.log('Start screen displayed');

        // ゲームループの開始（遅延実行で安定性向上）
        setTimeout(() => {
            requestAnimationFrame(gameLoop);
            console.log('Game loop started');
        }, 300);

    } catch (error) {
        console.error('Critical error during game initialization:', error);
        showErrorMessage('致命的なエラーが発生しました。ページを再読み込みしてください。');
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

// パドルとの衝突時の処理
function handlePaddleCollision(paddleX, paddleY, isTopPaddle, effectivePaddleWidth) {
    const paddleCenterX = paddleX + effectivePaddleWidth / 2;
    const hitX = puck.x - paddleCenterX;
    const normalizedHitX = hitX / (effectivePaddleWidth / 2);

    // エラーチェック
    if (!upgradeManager || !aiUpgradeManager) {
        console.warn('Upgrade managers not initialized in paddle collision');
        // 基本的な反射のみ行う
        puck.dy = -puck.dy;
        return;
    }

    // AIまたはプレイヤーのアップグレード効果を取得
    const activeEffects = isTopPaddle ? aiUpgradeManager.upgradeInstances : upgradeManager.upgradeInstances;
    const currentManager = isTopPaddle ? aiUpgradeManager : upgradeManager;
    const paddleVelocity = isTopPaddle ? aiPaddleVelocity : playerPaddleVelocity;

    let baseSpeed = Math.sqrt(puck.dx * puck.dx + puck.dy * puck.dy);
    let speedMultiplier = 1.0;
    let knockbackPower = 1.0;
    let angleAdjustment = 1.0;

    // テクニック判定
    const centerHitThreshold = 0.25; // パドル中心の範囲（少し拡大）
    const slideThreshold = 2.5; // スライドショットの最低速度（少し下げる）
    const angleThreshold = 3.5; // アングルショットの最低速度（少し下げる）

    let shotType = 'normal';
    let isCritical = false;
    let isSlide = false;
    let isAngle = false;

    // 1. クリティカルショット判定（パドル中心ヒット）
    if (Math.abs(normalizedHitX) < centerHitThreshold) {
        isCritical = true;
        shotType = 'critical';
        speedMultiplier *= 1.4; // クリティカル加速

        // キラッとしたエフェクト
        createCriticalEffect(puck.x, puck.y, isTopPaddle);
    }
    // 2. スライドショット判定（高速移動＋端部ヒット）
    else if (Math.abs(paddleVelocity) > slideThreshold && Math.abs(normalizedHitX) > 0.6) {
        isSlide = true;
        shotType = 'slide';
        speedMultiplier *= 0.7; // スロー化

        // 回転を加える
        puck.spin = paddleVelocity * 0.3 * Math.sign(normalizedHitX);

        // スライドエフェクト
        createSlideEffect(puck.x, puck.y, isTopPaddle);
    }
    // 3. アングルショット判定（超高速移動＋端部ヒット）
    else if (Math.abs(paddleVelocity) > angleThreshold && Math.abs(normalizedHitX) > 0.8) {
        isAngle = true;
        shotType = 'angle';
        angleAdjustment *= 1.8; // より鋭角に

        // アングルエフェクト
        createAngleEffect(puck.x, puck.y, isTopPaddle);
    }

    // 基本的な反射設定
    const baseSpeedBoost = isTopPaddle ? 1.05 : 1.1;
    const maxSpeedRatio = isTopPaddle ? 0.8 : 1.0;
    const angleRange = isTopPaddle ? Math.PI / 4 : Math.PI / 3;

    // 百錬自得カウンターの発動チェック
    const perfectCounters = activeEffects.filter(u => u.id === 'hundredReflexCounter');
    perfectCounters.forEach(perfectCounter => {
        const targetY = isTopPaddle ? paddleHeight : (canvas.height - paddleHeight);
        const timingSweetSpot = Math.abs(puck.y - targetY) < perfectCounter.effect.perfectTimingWindow;
        if (timingSweetSpot) {
            speedMultiplier *= perfectCounter.effect.speedBoostMultiplier;
            angleAdjustment *= perfectCounter.effect.angleAdjustment;
            if (effectSystem) {
                effectSystem.createAuraEffect(puck.x, puck.y, perfectCounter.visualEffect);
            }
            puck.lastHitUpgrade = perfectCounter;
        }
    });

    // 重波動ショットの効果（重複可能）
    const heavyWaves = activeEffects.filter(u => u.id === 'heavyWave');
    heavyWaves.forEach(heavyWave => {
        speedMultiplier *= heavyWave.effect.puckSpeedMultiplier;
        knockbackPower *= heavyWave.effect.knockbackPower;
        if (effectSystem) {
            effectSystem.createAuraEffect(puck.x, puck.y, heavyWave.visualEffect);
        }
        puck.lastHitUpgrade = heavyWave;

        // コントロール低下効果を相手に適用
        const targetManager = isTopPaddle ? upgradeManager : aiUpgradeManager;
        targetManager.addTemporaryEffect('controlReduction', {
            factor: heavyWave.effect.controlReduction
        }, heavyWave.effect.controlReductionDuration);
    });

    // 基本的な跳ね返り計算
    const newSpeed = Math.min(baseSpeed * baseSpeedBoost * speedMultiplier, MAX_PUCK_SPEED * maxSpeedRatio);
    const angle = normalizedHitX * angleRange * angleAdjustment;

    puck.dx = Math.sin(angle) * newSpeed;
    puck.dy = (isTopPaddle ? 1 : -1) * Math.cos(angle) * newSpeed;
    puck.y = isTopPaddle ? (paddleY + paddleHeight + puck.radius) : (paddleY - puck.radius);

    // ショットタイプを記録
    puck.lastShotType = shotType;
    puck.lastHitTime = Date.now(); // ヒット時刻を記録

    // ステルス・スネイクの効果（重複可能）
    const stealthSnakes = activeEffects.filter(u => u.id === 'stealthSnake');
    stealthSnakes.forEach(stealthSnake => {
        puck.activeEffects.add('stealth');
        setTimeout(() => {
            puck.activeEffects.delete('stealth');
        }, stealthSnake.effect.fadeOutDuration);
        puck.lastHitUpgrade = stealthSnake;
    });

    // 氷結フィールドショットの効果（重複可能）
    const iceFields = activeEffects.filter(u => u.id === 'iceFieldShot');
    iceFields.forEach(iceField => {
        puck.activeEffects.add('ice');
        puck.lastHitUpgrade = iceField;
    });

    // 破滅への誘引の効果（重複可能）
    const dooms = activeEffects.filter(u => u.id === 'doomInducement');
    dooms.forEach(doom => {
        puck.activeEffects.add('doom');
        puck.lastHitUpgrade = doom;
    });

    // エフェクトの作成（それぞれの色で）
    const paddleColor = isTopPaddle ? '#ff6b6b' : '#4ecdc4';
    const flashColor = isTopPaddle ? '#ff6b6b33' : '#4ecdc433';
    createParticles(puck.x, puck.y, paddleColor);
    createFlash(flashColor);

    // ノックバック効果の適用（相手に）
    if (knockbackPower > 1 && heavyWaves.length > 0) {
        const targetManager = isTopPaddle ? upgradeManager : aiUpgradeManager;
        targetManager.addTemporaryEffect('knockback', {
            factor: knockbackPower
        }, heavyWaves[0].effect.controlReductionDuration);
    }

    // パックの速度を制限
    limitPuckSpeed();

    // アップグレードエフェクトの適用
    if (puck.lastHitUpgrade && effectSystem) {
        // ビジュアルエフェクトの作成
        if (puck.lastHitUpgrade.visualEffect && typeof EFFECT_TYPES !== 'undefined') {
            const effectX = puck.x;
            const effectY = puck.y;

            switch (puck.lastHitUpgrade.visualEffect.type) {
                case EFFECT_TYPES.AURA:
                    effectSystem.createAuraEffect(effectX, effectY, puck.lastHitUpgrade.visualEffect);
                    break;
                case EFFECT_TYPES.TRAIL:
                    if (puckTrail.length > 1) {
                        effectSystem.createTrailEffect(puckTrail, puck.lastHitUpgrade.visualEffect);
                    }
                    break;
                case EFFECT_TYPES.IMPACT:
                    effectSystem.createParticles(effectX, effectY, puck.lastHitUpgrade.visualEffect);
                    break;
            }
        }
    }
}

// テクニック表示機能
function drawTechniqueIndicators() {
    ctx.save();

    // フォントサイズを調整
    const fontSize = Math.max(12, canvas.width * 0.02);
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';

    // 最後のショットタイプを表示（少し透明度を持たせてフェードアウト）
    if (puck.lastShotType && puck.lastShotType !== 'normal') {
        let alpha = 1.0;
        const timeSinceShot = Date.now() - (puck.lastHitTime || 0);
        if (timeSinceShot > 1000) {
            alpha = Math.max(0, 1 - (timeSinceShot - 1000) / 2000);
        }

        if (alpha > 0) {
            ctx.globalAlpha = alpha;
            let displayText = '';
            let displayColor = '';

            switch (puck.lastShotType) {
                case 'critical':
                    displayText = 'CRITICAL HIT!';
                    displayColor = '#ffff00';
                    break;
                case 'slide':
                    displayText = 'SLIDE SHOT';
                    displayColor = '#00ff88';
                    break;
                case 'angle':
                    displayText = 'ANGLE SHOT';
                    displayColor = '#ff8800';
                    break;
            }

            if (displayText) {
                // 影
                ctx.fillStyle = '#000000';
                ctx.fillText(displayText, canvas.width / 2 + 2, canvas.height / 2 + 2);

                // メインテキスト
                ctx.fillStyle = displayColor;
                ctx.fillText(displayText, canvas.width / 2, canvas.height / 2);
            }
        }
    }

    // プレイヤーのパドル速度を視覚化（高速移動時）
    if (Math.abs(playerPaddleVelocity) > 2) {
        const speedText = Math.abs(playerPaddleVelocity) > 4 ? '高速移動中' : '移動中';
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#4ecdc4';
        ctx.font = `${fontSize * 0.8}px Arial`;
        ctx.fillText(speedText, playerPaddleX + paddleWidth / 2, canvas.height - paddleHeight - 10);
    }

    // AIのパドル速度を視覚化（高速移動時）
    if (Math.abs(aiPaddleVelocity) > 2) {
        const speedText = Math.abs(aiPaddleVelocity) > 4 ? '高速移動中' : '移動中';
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#ff6b6b';
        ctx.font = `${fontSize * 0.8}px Arial`;
        ctx.fillText(speedText, aiPaddleX + paddleWidth / 2, paddleHeight + 20);
    }

    ctx.restore();
}