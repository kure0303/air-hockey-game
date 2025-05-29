// アップグレードの種類を定義
const UPGRADE_TYPES = {
    PADDLE: 'paddle',
    PUCK: 'puck',
    FIELD: 'field',
    SPECIAL: 'special'
};

// アップグレードの定義
const UPGRADES = {
    // パドル強化系
    paddleSizeSmall: {
        id: 'paddleSizeSmall',
        name: 'パドルサイズアップ（小）',
        description: 'パドルのサイズが20%大きくなります',
        type: UPGRADE_TYPES.PADDLE,
        rarity: 1,
        effect: {
            paddleWidthMultiplier: 1.2
        }
    },
    paddleSizeMedium: {
        id: 'paddleSizeMedium',
        name: 'パドルサイズアップ（中）',
        description: 'パドルのサイズが40%大きくなります',
        type: UPGRADE_TYPES.PADDLE,
        rarity: 2,
        effect: {
            paddleWidthMultiplier: 1.4
        }
    },
    paddleSpeedSmall: {
        id: 'paddleSpeedSmall',
        name: '俊敏性アップ（小）',
        description: 'パドルの移動速度が20%上がります',
        type: UPGRADE_TYPES.PADDLE,
        rarity: 1,
        effect: {
            paddleSpeedMultiplier: 1.2
        }
    },
    reflectBoost: {
        id: 'reflectBoost',
        name: 'リフレクトブースト',
        description: 'パックを打ち返す際の初速が30%上がります',
        type: UPGRADE_TYPES.PADDLE,
        rarity: 2,
        effect: {
            reflectSpeedMultiplier: 1.3
        }
    },
    magnetPaddle: {
        id: 'magnetPaddle',
        name: 'マグネットパドル',
        description: 'スペースキーで短時間パックを引き寄せます',
        type: UPGRADE_TYPES.SPECIAL,
        rarity: 3,
        effect: {
            magneticForce: 2,
            duration: 3000, // ミリ秒
            cooldown: 10000 // ミリ秒
        }
    },
    curveShot: {
        id: 'curveShot',
        name: 'カーブショット',
        description: 'パックが軽くカーブするようになります',
        type: UPGRADE_TYPES.PUCK,
        rarity: 2,
        effect: {
            curveFactor: 0.2
        }
    },
    heavyPuck: {
        id: 'heavyPuck',
        name: 'ヘビーパック',
        description: 'パックが重くなり、より直線的に動きます',
        type: UPGRADE_TYPES.PUCK,
        rarity: 2,
        effect: {
            puckWeight: 2,
            speedMultiplier: 0.8
        }
    }
};

// アップグレードの選択肢を生成
function generateUpgradeChoices(count = 3) {
    const availableUpgrades = Object.values(UPGRADES);
    const choices = [];
    const usedIndices = new Set();

    while (choices.length < count && usedIndices.size < availableUpgrades.length) {
        const index = Math.floor(Math.random() * availableUpgrades.length);
        if (!usedIndices.has(index)) {
            usedIndices.add(index);
            choices.push(availableUpgrades[index]);
        }
    }

    return choices;
}

// プレイヤーの現在のアップグレードを管理
class UpgradeManager {
    constructor() {
        this.activeUpgrades = new Map();
        this.matchCount = 0;
    }

    addUpgrade(upgrade) {
        this.activeUpgrades.set(upgrade.id, upgrade);
    }

    hasUpgrade(upgradeId) {
        return this.activeUpgrades.has(upgradeId);
    }

    getUpgradeEffect(type, property) {
        let effect = 1;
        this.activeUpgrades.forEach(upgrade => {
            if (upgrade.type === type && upgrade.effect[property]) {
                effect *= upgrade.effect[property];
            }
        });
        return effect;
    }

    incrementMatch() {
        this.matchCount++;
        return this.matchCount;
    }

    reset() {
        this.activeUpgrades.clear();
        this.matchCount = 0;
    }
}

// グローバルなアップグレードマネージャーのインスタンスを作成
const upgradeManager = new UpgradeManager();