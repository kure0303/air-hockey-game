// アップグレードの種類を定義
const UPGRADE_TYPES = {
    PADDLE: 'paddle',
    PUCK: 'puck',
    FIELD: 'field',
    SPECIAL: 'special'
};

// アップグレードの定義
const UPGRADES = [{
        id: 'paddleSize1',
        name: 'パドルサイズアップ（小）',
        description: 'パドルのサイズが10%大きくなります',
        type: UPGRADE_TYPES.PADDLE,
        rarity: 'common',
        effect: {
            paddleWidthMultiplier: 1.1
        }
    },
    {
        id: 'paddleSize2',
        name: 'パドルサイズアップ（中）',
        description: 'パドルのサイズが20%大きくなります',
        type: UPGRADE_TYPES.PADDLE,
        rarity: 'rare',
        effect: {
            paddleWidthMultiplier: 1.2
        }
    },
    {
        id: 'speedUp',
        name: 'スピードアップ',
        description: 'パドルの移動速度が15%上がります',
        type: UPGRADE_TYPES.PADDLE,
        rarity: 'common',
        effect: {
            paddleSpeedMultiplier: 1.15
        }
    },
    {
        id: 'reflectBoost',
        name: 'リフレクトブースト',
        description: 'パックが跳ね返るときの速度が10%上がります',
        type: UPGRADE_TYPES.PADDLE,
        rarity: 'common',
        effect: {
            reflectSpeedMultiplier: 1.1
        }
    },
    {
        id: 'magnetPaddle',
        name: 'マグネットパドル',
        description: 'スペースキーを押している間、パックを引き寄せます',
        type: UPGRADE_TYPES.SPECIAL,
        rarity: 'rare',
        effect: {
            magneticForce: 0.5,
            cooldown: 3000
        }
    },
    {
        id: 'curveShot',
        name: 'カーブショット',
        description: 'パックが不規則に曲がるようになります',
        type: UPGRADE_TYPES.SPECIAL,
        rarity: 'rare',
        effect: {
            curveFactor: 0.2
        }
    },
    {
        id: 'heavyPuck',
        name: 'ヘビーパック',
        description: 'パックの速度が遅くなりますが、コントロールしやすくなります',
        type: UPGRADE_TYPES.PUCK,
        rarity: 'common',
        effect: {
            speedMultiplier: 0.85
        }
    }
];

// アップグレード選択肢の生成
function generateUpgradeChoices(count) {
    // 既に選択されているアップグレードを除外
    const availableUpgrades = UPGRADES.filter(upgrade =>
        !upgradeManager.hasUpgrade(upgrade.id)
    );

    // ランダムに選択
    const shuffled = availableUpgrades.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, availableUpgrades.length));
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
                if (property.includes('Multiplier')) {
                    effect *= upgrade.effect[property];
                } else {
                    effect += upgrade.effect[property];
                }
            }
        });
        return effect;
    }

    getUpgradeByType(type) {
        return Array.from(this.activeUpgrades.values())
            .filter(upgrade => upgrade.type === type);
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