const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// デバイスタイプの検出
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// キャンバスのサイズ設定
function resizeCanvas() {
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth;
    const aspectRatio = 2; // 高さは幅の2倍

    canvas.width = Math.min(400, containerWidth);
    canvas.height = canvas.width * aspectRatio;

    // パドルとパックのサイズを更新
    paddleWidth = canvas.width * 0.15;
    paddleHeight = canvas.width * 0.025;
    puckSize = canvas.width * 0.0375;

    // パドルの位置を更新
    if (aiPaddleX === undefined) {
        aiPaddleX = canvas.width / 2 - paddleWidth / 2;
    }
    if (playerPaddleX === undefined) {
        playerPaddleX = canvas.width / 2 - paddleWidth / 2;
    }

    // パックの位置を更新
    if (puck.x === undefined) {
        resetPuck(true);
    }
}

// ゲームの状態
const GAME_STATE = {
    START: 'start',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameOver'
};

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

let currentState = GAME_STATE.START;
const WINNING_SCORE = 5;

// ゲーム要素の初期設定（サイズはresizeCanvasで更新）
let paddleWidth = 60;
let paddleHeight = 10;
let puckSize = 15;

// AI設定
const AI_SPEED = 8;
const AI_PREDICTION_ERROR = 10;
const MAX_PUCK_SPEED = 15;
const INITIAL_PUCK_SPEED = 7;

// スコア
let playerScore = 0;
let aiScore = 0;

// パドルの位置
let aiPaddleX;
let playerPaddleX;

// パックの位置と速度
let puck = {
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    radius: puckSize / 2
};

// キー入力の状態
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    Escape: false
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

// ウィンドウリサイズ時の処理
window.addEventListener('resize', () => {
    resizeCanvas();
});

// UI要素
const startScreen = document.getElementById('startScreen');
const pauseScreen = document.getElementById('pauseScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startButton = document.getElementById('startButton');
const resumeButton = document.getElementById('resumeButton');
const restartButton = document.getElementById('restartButton');
const playAgainButton = document.getElementById('playAgainButton');
const winnerMessage = document.getElementById('winnerMessage');

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
    currentState = GAME_STATE.PLAYING;
    updateScore();
    resetPuck(true);
    startScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
}

function checkWinner() {
    if (playerScore >= WINNING_SCORE || aiScore >= WINNING_SCORE) {
        currentState = GAME_STATE.GAME_OVER;
        gameOverScreen.classList.remove('hidden');
        winnerMessage.textContent = playerScore >= WINNING_SCORE ?
            'おめでとうございます！あなたの勝ちです！' :
            'AIの勝ちです。もう一度チャレンジしましょう！';
    }
}

function updateScore() {
    document.getElementById('player1Score').textContent = aiScore;
    document.getElementById('player2Score').textContent = playerScore;
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

    if (!isMobile) {
        // キーボード操作
        const PLAYER_SPEED = canvas.width * 0.02;
        if (keys.ArrowLeft && playerPaddleX > 0) {
            playerPaddleX -= PLAYER_SPEED;
        }
        if (keys.ArrowRight && playerPaddleX < canvas.width - paddleWidth) {
            playerPaddleX += PLAYER_SPEED;
        }
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
function handlePaddleCollision(paddleX, paddleY, isTopPaddle) {
    const paddleCenterX = paddleX + paddleWidth / 2;
    const hitX = puck.x - paddleCenterX;
    const normalizedHitX = hitX / (paddleWidth / 2);

    const baseSpeed = Math.sqrt(puck.dx * puck.dx + puck.dy * puck.dy);
    const angle = normalizedHitX * Math.PI / 3;
    const newSpeed = baseSpeed * 1.1;

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

    // AIのパドル（上側）との衝突
    if (puck.y - puck.radius < paddleHeight &&
        puck.x > aiPaddleX &&
        puck.x < aiPaddleX + paddleWidth &&
        puck.dy < 0) {
        handlePaddleCollision(aiPaddleX, 0, true);
    }

    // プレイヤーのパドル（下側）との衝突
    if (puck.y + puck.radius > canvas.height - paddleHeight &&
        puck.x > playerPaddleX &&
        puck.x < playerPaddleX + paddleWidth &&
        puck.dy > 0) {
        handlePaddleCollision(playerPaddleX, canvas.height - paddleHeight, false);
    }

    limitPuckSpeed();

    // ゴール判定
    if (puck.y < 0) {
        playerScore++;
        updateScore();
        createParticles(puck.x, 0, '#4ecdc4');
        createFlash('#4ecdc433');
        checkWinner();
        if (currentState === GAME_STATE.PLAYING) {
            resetPuck(false);
        }
    } else if (puck.y > canvas.height) {
        aiScore++;
        updateScore();
        createParticles(puck.x, canvas.height, '#ff6b6b');
        createFlash('#ff6b6b33');
        checkWinner();
        if (currentState === GAME_STATE.PLAYING) {
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
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(aiPaddleX, 0, paddleWidth, paddleHeight);

    ctx.fillStyle = '#4ecdc4';
    ctx.fillRect(playerPaddleX, canvas.height - paddleHeight, paddleWidth, paddleHeight);

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

// 初期化
resizeCanvas();
resetPuck(true);
gameLoop();