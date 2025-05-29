// アップグレードの種類を定義
const UPGRADE_TYPES = {
    COMMON: 'common',
    RARE: 'rare'
};

// エフェクトタイプの定義
const EFFECT_TYPES = {
    AURA: 'aura', // パックを包む光のエフェクト
    TRAIL: 'trail', // パックの軌跡
    IMPACT: 'impact', // ヒット時のエフェクト
    FIELD: 'field', // フィールドに残るエフェクト
    PADDLE: 'paddle' // パドルのエフェクト
};

// アップグレードの定義
const UPGRADES = [
    // レアアップグレード
    {
        id: 'heavyWave',
        name: '重波動ショット',
        description: '重く強力な一撃。相手パドルを大きくノックバック',
        type: UPGRADE_TYPES.RARE,
        effect: {
            puckSpeedMultiplier: 1.5,
            knockbackPower: 2.0,
            controlReduction: 0.8,
            controlReductionDuration: 500, // ミリ秒
        },
        visualEffect: {
            type: EFFECT_TYPES.AURA,
            color: '#4a1d66',
            scale: 2.0,
            trailWidth: 15,
            particleCount: 20
        }
    },
    {
        id: 'hundredReflexCounter',
        name: '百錬自得カウンター',
        description: '完璧なタイミングで返球すると威力激増',
        type: UPGRADE_TYPES.RARE,
        effect: {
            perfectTimingWindow: 100, // ミリ秒
            speedBoostMultiplier: 2.0,
            angleAdjustment: 0.8 // より鋭角に
        },
        visualEffect: {
            type: EFFECT_TYPES.AURA,
            color: '#ffd700',
            scale: 1.8,
            explosionScale: 3.0,
            afterImageCount: 5
        }
    },
    {
        id: 'stealthSnake',
        name: 'ステルス・スネイク',
        description: '蛇行する軌道と半透明化で相手を惑わす',
        type: UPGRADE_TYPES.RARE,
        effect: {
            sineMagnitude: 50,
            sineFrequency: 0.1,
            fadeOutDuration: 300,
            fadeInDuration: 300
        },
        visualEffect: {
            type: EFFECT_TYPES.TRAIL,
            colors: ['#00ff00', '#0066ff'],
            opacity: 0.7,
            scalePattern: [1, 0.8, 1.2]
        }
    },
    {
        id: 'iceFieldShot',
        name: '氷結フィールドショット',
        description: '壁に当たった場所に氷床を生成',
        type: UPGRADE_TYPES.RARE,
        effect: {
            slowdownFactor: 0.7,
            fieldDuration: 2000,
            fieldRadius: 100
        },
        visualEffect: {
            type: EFFECT_TYPES.FIELD,
            color: '#a0e6ff',
            crystallize: true,
            particleSize: 3,
            spreadSpeed: 0.5
        }
    },
    {
        id: 'doomInducement',
        name: '破滅への誘引',
        description: '得点時、次の1ポイントで相手の特殊効果を無効化',
        type: UPGRADE_TYPES.RARE,
        effect: {
            nullificationDuration: 1, // 1ポイント
            weakenFactor: 0.8
        },
        visualEffect: {
            type: EFFECT_TYPES.AURA,
            color: '#660000',
            chainEffect: true,
            darkAura: true
        }
    },
    // コモンアップグレード
    {
        id: 'speedUpSmall',
        name: 'パドル速度アップ・小',
        description: 'パドルの移動速度が少し上昇',
        type: UPGRADE_TYPES.COMMON,
        effect: {
            paddleSpeedMultiplier: 1.2
        },
        visualEffect: {
            type: EFFECT_TYPES.PADDLE,
            afterImage: true,
            afterImageDuration: 100
        }
    },
    {
        id: 'widthUpSmall',
        name: 'パドル幅アップ・小',
        description: 'パドルの幅が少し広がる',
        type: UPGRADE_TYPES.COMMON,
        effect: {
            paddleWidthMultiplier: 1.2
        }
    },
    {
        id: 'shotSpeedUpSmall',
        name: 'ショット加速・小',
        description: 'パックの初速が少し上昇',
        type: UPGRADE_TYPES.COMMON,
        effect: {
            initialSpeedMultiplier: 1.2
        },
        visualEffect: {
            type: EFFECT_TYPES.IMPACT,
            flashDuration: 100,
            color: '#ffffff'
        }
    },
    {
        id: 'reboundStabilizer',
        name: 'リバウンド安定化',
        description: 'パックの跳ね返り角度が安定',
        type: UPGRADE_TYPES.COMMON,
        effect: {
            angleVariationReduction: 0.5
        },
        visualEffect: {
            type: EFFECT_TYPES.IMPACT,
            rippleEffect: true,
            rippleSize: 30
        }
    },
    {
        id: 'wallGuideWeak',
        name: '壁反射ガイド・弱',
        description: '壁際での反射予測線を表示',
        type: UPGRADE_TYPES.COMMON,
        effect: {
            guideLineLength: 200,
            guideLineOpacity: 0.3
        },
        visualEffect: {
            type: EFFECT_TYPES.TRAIL,
            guideLine: true,
            color: '#ffffff'
        }
    }
];

// アップグレード選択肢の生成
function generateUpgradeChoices(count) {
    // 既に選択されているアップグレードを除外
    const availableUpgrades = UPGRADES.filter(upgrade =>
        !upgradeManager.hasUpgrade(upgrade.id)
    );

    // レアとコモンを分離
    const rareUpgrades = availableUpgrades.filter(u => u.type === UPGRADE_TYPES.RARE);
    const commonUpgrades = availableUpgrades.filter(u => u.type === UPGRADE_TYPES.COMMON);

    // 最低1つのレアを含むように調整
    const choices = [];
    if (rareUpgrades.length > 0) {
        const rareChoice = rareUpgrades[Math.floor(Math.random() * rareUpgrades.length)];
        choices.push(rareChoice);
    }

    // 残りをコモンから選択
    const remainingCount = count - choices.length;
    const shuffledCommon = commonUpgrades.sort(() => Math.random() - 0.5);
    choices.push(...shuffledCommon.slice(0, remainingCount));

    return choices.sort(() => Math.random() - 0.5);
}

// アップグレードマネージャー
class UpgradeManager {
    constructor() {
        this.activeUpgrades = new Map();
        this.matchCount = 0;
        this.temporaryEffects = new Map();
    }

    addUpgrade(upgrade) {
        this.activeUpgrades.set(upgrade.id, upgrade);
    }

    hasUpgrade(upgradeId) {
        return this.activeUpgrades.has(upgradeId);
    }

    getActiveEffects(type) {
        return Array.from(this.activeUpgrades.values())
            .filter(upgrade => upgrade.type === type);
    }

    // 特定のエフェクトタイプを持つアップグレードを取得
    getUpgradesWithEffectType(effectType) {
        return Array.from(this.activeUpgrades.values())
            .filter(upgrade => upgrade.visualEffect && upgrade.visualEffect.type === effectType);
    }

    // 一時的な効果の追加（氷結フィールドなど）
    addTemporaryEffect(effectId, effect, duration) {
        this.temporaryEffects.set(effectId, {
            effect,
            expiresAt: Date.now() + duration
        });

        setTimeout(() => {
            this.temporaryEffects.delete(effectId);
        }, duration);
    }

    // 一時的な効果の確認
    hasTemporaryEffect(effectId) {
        const effect = this.temporaryEffects.get(effectId);
        if (!effect) return false;

        if (Date.now() > effect.expiresAt) {
            this.temporaryEffects.delete(effectId);
            return false;
        }
        return true;
    }

    incrementMatch() {
        this.matchCount++;
        return this.matchCount;
    }

    reset() {
        this.activeUpgrades.clear();
        this.temporaryEffects.clear();
        this.matchCount = 0;
    }
}

// グローバルなアップグレードマネージャーのインスタンスを作成
const upgradeManager = new UpgradeManager();