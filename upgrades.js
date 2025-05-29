// アップグレードの種類を定義
const UPGRADE_TYPES = {
    PADDLE: 'paddle',
    PUCK: 'puck',
    SPECIAL: 'special'
};

// アップグレードの定義
const UPGRADES = [{
        id: 'paddleSize1',
        name: 'パドルサイズアップ',
        description: 'パドルのサイズが20%大きくなります',
        type: UPGRADE_TYPES.PADDLE,
        rarity: 'common',
        effect: {
            paddleWidthMultiplier: 1.2
        }
    },
    {
        id: 'speedUp',
        name: 'スピードアップ',
        description: 'パドルの移動速度が20%上がります',
        type: UPGRADE_TYPES.PADDLE,
        rarity: 'common',
        effect: {
            paddleSpeedMultiplier: 1.2
        }
    },
    {
        id: 'reflectBoost',
        name: 'リフレクトブースト',
        description: 'パックが跳ね返るときの速度が20%上がります',
        type: UPGRADE_TYPES.PADDLE,
        rarity: 'common',
        effect: {
            reflectSpeedMultiplier: 1.2
        }
    }
];

// アップグレード選択肢の生成
function generateUpgradeChoices(count) {
    const shuffled = [...UPGRADES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

// アップグレードマネージャー
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