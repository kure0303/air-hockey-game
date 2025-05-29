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
    radius: 0
};

// ゲーム要素の初期設定（サイズはresizeCanvasで更新）
let paddleWidth = 60;
let paddleHeight = 10;
let puckSize = 15;

// AI設定
const AI_SPEED = 8;
const AI_PREDICTION_ERROR = 10;
const MAX_PUCK_SPEED = 15;
const INITIAL_PUCK_SPEED = 7;

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

function startGame() {
    currentState = GAME_STATE.PLAYING;
    startScreen.classList.add('hidden');
    resetGame();
}

function pauseGame() {
    currentState = GAME_STATE.PAUSED;
    pauseScreen.classList.remove('hidden');
}

function resumeGame() {
    currentState = GAME_STATE.PLAYING;
    pauseScreen.classList.add('hidden');
}

function resetGame() {
    playerScore = 0;
    aiScore = 0;
    totalPlayerScore = 0;
    totalAiScore = 0;
    lastMatchPlayerScore = 0;
    lastMatchAiScore = 0;
    currentState = GAME_STATE.PLAYING;
    updateScore();
    resetPuck(true);
    startScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
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

    if (puck.dy < 0) {
        const timeToIntercept = (puck.y) / -puck.dy;
        const predictedX = puck.x + (puck.dx * timeToIntercept);

        if (predictedX >= 0 && predictedX <= canvas.width) {
            targetX = predictedX + (Math.random() * AI_PREDICTION_ERROR * 2 - AI_PREDICTION_ERROR);
        }

        const distanceMultiplier = Math.min(1.5, 400 / puck.y);
        const moveSpeed = AI_SPEED * distanceMultiplier;

        if (aiPaddleX + (paddleWidth / 2) < targetX) {
            aiPaddleX += moveSpeed;
        } else if (aiPaddleX + (paddleWidth / 2) > targetX) {
            aiPaddleX -= moveSpeed;
        }
    } else {
        const defensiveX = canvas.width / 2 + (puck.x - canvas.width / 2) * 0.3;
        if (aiPaddleX + (paddleWidth / 2) < defensiveX) {
            aiPaddleX += AI_SPEED * 0.5;
        } else if (aiPaddleX + (paddleWidth / 2) > defensiveX) {
            aiPaddleX -= AI_SPEED * 0.5;
        }
    }

    aiPaddleX = Math.max(0, Math.min(canvas.width - paddleWidth, aiPaddleX));
}

// プレイヤーパドルの移動
function movePlayer() {
    if (currentState !== GAME_STATE.PLAYING) return;

    const speedMultiplier = upgradeManager.getUpgradeEffect(UPGRADE_TYPES.PADDLE, 'paddleSpeedMultiplier');
    const PLAYER_SPEED = canvas.width * 0.02 * speedMultiplier;

    if (!isMobile) {
        if (keys.ArrowLeft && playerPaddleX > 0) {
            playerPaddleX -= PLAYER_SPEED;
        }
        if (keys.ArrowRight && playerPaddleX < canvas.width - paddleWidth) {
            playerPaddleX += PLAYER_SPEED;
        }
    }

    // マグネットパドルの効果
    if (upgradeManager.hasUpgrade('magnetPaddle') && keys.Space && !magnetCooldown) {
        const upgrade = upgradeManager.activeUpgrades.get('magnetPaddle');
        applyMagneticEffect(upgrade.effect.magneticForce);
        magnetCooldown = true;
        setTimeout(() => {
            magnetCooldown = false;
        }, upgrade.effect.cooldown);
    }
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

    let baseSpeed = Math.sqrt(puck.dx * puck.dx + puck.dy * puck.dy);
    const reflectSpeedMultiplier = upgradeManager.getUpgradeEffect(UPGRADE_TYPES.PADDLE, 'reflectSpeedMultiplier');
    const newSpeed = baseSpeed * 1.1 * reflectSpeedMultiplier;

    const angle = normalizedHitX * Math.PI / 3;
    puck.dx = Math.sin(angle) * newSpeed;
    puck.dy = (isTopPaddle ? 1 : -1) * Math.cos(angle) * newSpeed;

    puck.y = isTopPaddle ? paddleY + paddleHeight + puck.radius : paddleY - puck.radius;

    // 衝突時のエフェクト
    createParticles(puck.x, puck.y, isTopPaddle ? '#ff6b6b' : '#4ecdc4');
    createFlash(isTopPaddle ? '#ff6b6b33' : '#4ecdc433');
}

// パックの移動と衝突判定
function movePuck() {
    if (currentState !== GAME_STATE.PLAYING) return;

    // カーブショットの効果
    if (upgradeManager.hasUpgrade('curveShot')) {
        const curveFactor = upgradeManager.activeUpgrades.get('curveShot').effect.curveFactor;
        puck.dx += (Math.random() - 0.5) * curveFactor;
    }

    // ヘビーパックの効果
    if (upgradeManager.hasUpgrade('heavyPuck')) {
        const effect = upgradeManager.activeUpgrades.get('heavyPuck').effect;
        puck.dx *= effect.speedMultiplier;
        puck.dy *= effect.speedMultiplier;
    }

    puck.x += puck.dx;
    puck.y += puck.dy;

    // 左右の壁との衝突
    if (puck.x - puck.radius < 0) {
        puck.x = puck.radius;
        puck.dx = Math.abs(puck.dx);
        createParticles(puck.x, puck.y, '#fff');
    } else if (puck.x + puck.radius > canvas.width) {
        puck.x = canvas.width - puck.radius;
        puck.dx = -Math.abs(puck.dx);
        createParticles(puck.x, puck.y, '#fff');
    }

    // パドルとの衝突判定と処理
    handlePaddleCollisions();

    // ゴール判定
    if (puck.y < 0) {
        playerScore++;
        updateScore();
        createParticles(puck.x, 0, '#4ecdc4');
        createFlash('#4ecdc433');
        if (playerScore >= POINTS_TO_WIN) {
            handleMatchEnd();
        } else {
            resetPuck(false);
        }
    } else if (puck.y > canvas.height) {
        aiScore++;
        updateScore();
        createParticles(puck.x, canvas.height, '#ff6b6b');
        createFlash('#ff6b6b33');
        if (aiScore >= POINTS_TO_WIN) {
            handleMatchEnd();
        } else {
            resetPuck(true);
        }
    }
}

// パックのリセット
function resetPuck(aiServe) {
    puck.x = canvas.width / 2;
    puck.y = canvas.height / 2;

    const angle = (Math.random() * 0.5 + 0.25) * Math.PI;
    puck.dx = INITIAL_PUCK_SPEED * Math.cos(angle);
    puck.dy = INITIAL_PUCK_SPEED * Math.sin(angle) * (aiServe ? 1 : -1);
}

// 描画関数
function draw() {
    // キャンバスのクリア
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
    const paddleWidthMultiplier = upgradeManager.getUpgradeEffect(UPGRADE_TYPES.PADDLE, 'paddleWidthMultiplier');
    const effectivePaddleWidth = paddleWidth * paddleWidthMultiplier;
    const paddleOffset = (effectivePaddleWidth - paddleWidth) / 2;

    // AIのパドル
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(aiPaddleX - paddleOffset, 0, effectivePaddleWidth, paddleHeight);

    // プレイヤーのパドル
    ctx.fillStyle = '#4ecdc4';
    ctx.fillRect(playerPaddleX - paddleOffset, canvas.height - paddleHeight, effectivePaddleWidth, paddleHeight);

    // パックの描画
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.closePath();

    // パーティクルの更新と描画
    particles = particles.filter(particle => particle.lifetime > 0);
    particles.forEach(particle => {
        particle.update();
        particle.draw(ctx);
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
    resetPuck(true);
}

// パックの初期化
function initializePuck() {
    puck.x = canvas.width / 2;
    puck.y = canvas.height / 2;
    puck.dx = 0;
    puck.dy = 0;
    puck.radius = puckSize / 2;
}

// パドルの初期位置設定
function initializePaddles() {
    aiPaddleX = canvas.width / 2 - paddleWidth / 2;
    playerPaddleX = canvas.width / 2 - paddleWidth / 2;
}

// 初期化
resizeCanvas();
initializePaddles();
initializePuck();
resetGame();
gameLoop();