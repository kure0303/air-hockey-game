// エフェクトシステム
class EffectSystem {
    constructor(ctx) {
        this.ctx = ctx;
        this.activeEffects = new Set();
        this.particles = [];
        this.config = {
            maxParticles: 200,
            maxEffects: 50,
            cleanupInterval: 1000, // ミリ秒
            boundaryPadding: 100 // 画面外の判定用パディング
        };
        console.log('EffectSystem initialized');

        // 定期的なクリーンアップを設定
        this.cleanupInterval = setInterval(() => this.cleanup(), this.config.cleanupInterval);
    }

    // 画面内判定
    isInBounds(x, y) {
        const padding = this.config.boundaryPadding;
        return x >= -padding &&
            x <= this.ctx.canvas.width + padding &&
            y >= -padding &&
            y <= this.ctx.canvas.height + padding;
    }

    // クリーンアップ処理
    cleanup() {
        // 画面外のエフェクトを削除
        for (const effect of this.activeEffects) {
            if (!this.isInBounds(effect.x, effect.y)) {
                this.activeEffects.delete(effect);
            }
        }

        // エフェクト数の制限
        if (this.activeEffects.size > this.config.maxEffects) {
            const toRemove = Array.from(this.activeEffects)
                .slice(0, this.activeEffects.size - this.config.maxEffects);
            toRemove.forEach(effect => this.activeEffects.delete(effect));
        }

        // パーティクル数の制限
        if (this.particles.length > this.config.maxParticles) {
            this.particles = this.particles.slice(-this.config.maxParticles);
        }
    }

    // オーラエフェクトの作成
    createAuraEffect(x, y, visualEffect) {
        if (!this.ctx || !visualEffect) {
            console.warn('Invalid context or visual effect');
            return null;
        }

        console.log('Creating aura effect:', x, y, visualEffect);
        const aura = {
            x,
            y,
            color: visualEffect.color || '#ffffff',
            scale: visualEffect.scale || 1,
            opacity: 1,
            type: EFFECT_TYPES.AURA,
            createdAt: Date.now()
        };

        if (this.activeEffects.size < this.config.maxEffects) {
            this.activeEffects.add(aura);
            return aura;
        }
        console.warn('Max effects limit reached');
        return null;
    }

    // 軌跡エフェクトの作成
    createTrailEffect(points, visualEffect) {
        if (!this.ctx || !visualEffect || !points || points.length < 2) {
            console.warn('Invalid trail effect parameters');
            return null;
        }

        console.log('Creating trail effect:', points.length, 'points');
        const trail = {
            points: [...points],
            colors: visualEffect.colors || [visualEffect.color || '#ffffff'],
            opacity: visualEffect.opacity || 1,
            width: visualEffect.trailWidth || 5,
            type: EFFECT_TYPES.TRAIL,
            createdAt: Date.now()
        };

        if (this.activeEffects.size < this.config.maxEffects) {
            this.activeEffects.add(trail);
            return trail;
        }
        return null;
    }

    // パーティクルの作成
    createParticles(x, y, visualEffect) {
        if (!this.ctx || !visualEffect) return;

        const count = Math.min(
            visualEffect.particleCount || 10,
            this.config.maxParticles - this.particles.length
        );

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 2 + Math.random() * 2;
            this.particles.push({
                x,
                y,
                dx: Math.cos(angle) * speed,
                dy: Math.sin(angle) * speed,
                color: visualEffect.color || '#ffffff',
                size: visualEffect.particleSize || 2,
                life: 1.0,
                createdAt: Date.now()
            });
        }
    }

    // フィールドエフェクトの作成（氷結フィールドなど）
    createFieldEffect(x, y, visualEffect) {
        if (!this.ctx || !visualEffect) {
            console.warn('Invalid field effect parameters');
            return null;
        }

        console.log('Creating field effect:', x, y, visualEffect);
        const field = {
            x,
            y,
            radius: 0,
            maxRadius: visualEffect.fieldRadius || 100,
            color: visualEffect.color || '#ffffff',
            crystallize: visualEffect.crystallize || false,
            opacity: 1,
            type: EFFECT_TYPES.FIELD,
            crystals: [],
            createdAt: Date.now()
        };

        if (field.crystallize) {
            // 結晶パターンの生成
            const crystalCount = 8;
            for (let i = 0; i < crystalCount; i++) {
                const angle = (Math.PI * 2 * i) / crystalCount;
                field.crystals.push({
                    angle,
                    length: 0,
                    maxLength: 20 + Math.random() * 20
                });
            }
        }

        if (this.activeEffects.size < this.config.maxEffects) {
            this.activeEffects.add(field);
            return field;
        }
        return null;
    }

    // エフェクトの更新
    update() {
        try {
            // パーティクルの更新
            this.particles = this.particles.filter(particle => {
                particle.x += particle.dx;
                particle.y += particle.dy;
                particle.life -= 0.02;
                particle.size *= 0.98;
                return particle.life > 0;
            });

            // アクティブエフェクトの更新
            for (const effect of this.activeEffects) {
                if (!effect || !effect.type) {
                    console.warn('Invalid effect found:', effect);
                    this.activeEffects.delete(effect);
                    continue;
                }

                switch (effect.type) {
                    case EFFECT_TYPES.FIELD:
                        this.updateFieldEffect(effect);
                        break;
                    case EFFECT_TYPES.AURA:
                        this.updateAuraEffect(effect);
                        break;
                    case EFFECT_TYPES.TRAIL:
                        this.updateTrailEffect(effect);
                        break;
                    default:
                        console.warn('Unknown effect type:', effect.type);
                        this.activeEffects.delete(effect);
                }
            }
        } catch (error) {
            console.error('Error in effect update:', error);
        }
    }

    // フィールドエフェクトの更新
    updateFieldEffect(effect) {
        if (effect.radius < effect.maxRadius) {
            effect.radius += effect.maxRadius * 0.1;
        }
        if (effect.crystallize) {
            effect.crystals.forEach(crystal => {
                if (crystal.length < crystal.maxLength) {
                    crystal.length += crystal.maxLength * 0.1;
                }
            });
        }
        effect.opacity *= 0.99;
        if (effect.opacity < 0.01) {
            this.activeEffects.delete(effect);
        }
    }

    // オーラエフェクトの更新
    updateAuraEffect(effect) {
        effect.opacity *= 0.95;
        if (effect.opacity < 0.01) {
            this.activeEffects.delete(effect);
        }
    }

    // 軌跡エフェクトの更新
    updateTrailEffect(effect) {
        if (!effect.points || effect.points.length < 2) {
            this.activeEffects.delete(effect);
            return;
        }
        effect.points.shift();
        if (effect.points.length < 2) {
            this.activeEffects.delete(effect);
        }
    }

    // エフェクトの描画
    draw() {
        this.ctx.save();

        // パーティクルの描画
        this.particles.forEach(particle => {
            this.ctx.beginPath();
            this.ctx.fillStyle = particle.color;
            this.ctx.globalAlpha = particle.life;
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // アクティブエフェクトの描画
        for (const effect of this.activeEffects) {
            switch (effect.type) {
                case EFFECT_TYPES.AURA:
                    this.drawAura(effect);
                    break;
                case EFFECT_TYPES.TRAIL:
                    this.drawTrail(effect);
                    break;
                case EFFECT_TYPES.FIELD:
                    this.drawField(effect);
                    break;
            }
        }

        this.ctx.restore();
    }

    // オーラの描画
    drawAura(aura) {
        this.ctx.beginPath();
        const gradient = this.ctx.createRadialGradient(
            aura.x, aura.y, 0,
            aura.x, aura.y, 30 * aura.scale
        );
        gradient.addColorStop(0, aura.color + 'ff');
        gradient.addColorStop(1, aura.color + '00');
        this.ctx.fillStyle = gradient;
        this.ctx.globalAlpha = aura.opacity;
        this.ctx.arc(aura.x, aura.y, 30 * aura.scale, 0, Math.PI * 2);
        this.ctx.fill();
    }

    // 軌跡の描画
    drawTrail(trail) {
        if (trail.points.length < 2) return;

        this.ctx.beginPath();
        this.ctx.moveTo(trail.points[0].x, trail.points[0].y);

        for (let i = 1; i < trail.points.length; i++) {
            const point = trail.points[i];
            const prevPoint = trail.points[i - 1];
            const colorIndex = Math.floor((i / trail.points.length) * trail.colors.length);

            this.ctx.strokeStyle = trail.colors[colorIndex];
            this.ctx.lineWidth = trail.width * (i / trail.points.length);
            this.ctx.globalAlpha = trail.opacity * (i / trail.points.length);

            this.ctx.beginPath();
            this.ctx.moveTo(prevPoint.x, prevPoint.y);
            this.ctx.lineTo(point.x, point.y);
            this.ctx.stroke();
        }
    }

    // フィールドエフェクトの描画
    drawField(field) {
        this.ctx.save();
        this.ctx.globalAlpha = field.opacity;

        if (field.crystallize) {
            // 結晶パターンの描画
            field.crystals.forEach(crystal => {
                this.ctx.beginPath();
                this.ctx.strokeStyle = field.color;
                this.ctx.lineWidth = 2;
                const startX = field.x + Math.cos(crystal.angle) * field.radius * 0.2;
                const startY = field.y + Math.sin(crystal.angle) * field.radius * 0.2;
                const endX = field.x + Math.cos(crystal.angle) * crystal.length;
                const endY = field.y + Math.sin(crystal.angle) * crystal.length;

                this.ctx.moveTo(startX, startY);
                this.ctx.lineTo(endX, endY);
                this.ctx.stroke();

                // 副結晶の描画
                const subCrystalAngle = Math.PI / 6;
                this.ctx.beginPath();
                this.ctx.moveTo(endX, endY);
                this.ctx.lineTo(
                    endX + Math.cos(crystal.angle + subCrystalAngle) * crystal.length * 0.5,
                    endY + Math.sin(crystal.angle + subCrystalAngle) * crystal.length * 0.5
                );
                this.ctx.moveTo(endX, endY);
                this.ctx.lineTo(
                    endX + Math.cos(crystal.angle - subCrystalAngle) * crystal.length * 0.5,
                    endY + Math.sin(crystal.angle - subCrystalAngle) * crystal.length * 0.5
                );
                this.ctx.stroke();
            });
        } else {
            // 通常のフィールドエフェクト
            const gradient = this.ctx.createRadialGradient(
                field.x, field.y, 0,
                field.x, field.y, field.radius
            );
            gradient.addColorStop(0, field.color + 'ff');
            gradient.addColorStop(1, field.color + '00');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(field.x, field.y, field.radius, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    // 全てのエフェクトをクリア
    clearEffects() {
        console.log('Clearing all effects');
        this.activeEffects.clear();
        this.particles = [];
    }

    // リソースの解放
    dispose() {
        console.log('Disposing effect system');
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.clearEffects();
    }
}