const backgroundImage = new Image();
backgroundImage.src = 'images/bg.png';  // 替换为你的背景图路径



// 游戏状态标志
let isGameOver = false;
let isGameWin = false;

// 每次生成敌人数量基础值
let enemiesPerSpawn = 0.1;

// ------ 冲刺功能相关变量 ------
let isDashing = false;         // 当前是否正在冲刺
let dashEnergy = 100;          // 冲刺能量最大值 100
let dashCooldownTimer = 0;     // 用于隐藏冲刺条
let dashOpacity = 0;           // 当前冲刺条透明度
let dashUsedRecently = false;  // 是否最近使用过冲刺

// 敌人鱼的等级划分及对应大小、图片、成长值
const enemyTiers = [
    { minSize: 30, maxSize: 50, image: 'images/Fish/ps6.png', growthValue: 1 },
    { minSize: 51, maxSize: 100, image: 'images/Fish/ps5.png', growthValue: 4 },
    { minSize: 101, maxSize: 150, image: 'images/Fish/ps1.png', growthValue: 6 },
    { minSize: 151, maxSize: 200, image: 'images/Fish/ps3.png', growthValue: 6 },
    { minSize: 201, maxSize: 250, image: 'images/Fish/ps2.png', growthValue: 8 },
    { minSize: 251, maxSize: 300, image: 'images/Fish/ps2.png', growthValue: 8 },
    { minSize: 301, maxSize: 350, image: 'images/Fish/flagFish.png', growthValue: 8 },
    { minSize: 351, maxSize: 400, image: 'images/Fish/shark.png', growthValue: 10 },
    { minSize: 401, maxSize: 500, image: 'images/Fish/tigerShark.png', growthValue: 20 }
];

//鲨鱼进化贴图
const growthThresholds = [
    { growth: 0, image: 'images/Fish/whiteShark_baby.png' },
    { growth: 100, image: 'images/Fish/whiteShark_slim.png' },
    { growth: 250, image: 'images/Fish/whiteShark.png' },
    { growth: 400, image: 'images/Fish/whiteShark_ultra.png' },
];

// 玩家图片对象
const playerImage = new Image();
//playerImage.src = 'images/Fish/whiteShark_slim.png';  //初始图片
let playerImageWidth = 0;
let playerImageHeight = 0;
let playerVisualBounds = null; // 视觉边界对象



// 画布和上下文
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
// 设置画布大小（固定为 1280x720，或者改成全屏）
canvas.width = 1920;     // 或 window.innerWidth;
canvas.height = 1080;     // 或 window.innerHeight;

// 键盘按键状态，初始化为未按下
const keys = { w: false, a: false, s: false, d: false };

// 每个等级对应需要达到的成长值
const growthNeeded = [0 , 100, 250, 400 , 600 , 1000];

// --------- 计算视觉边界的辅助函数 ---------
function calcVisualBounds(mask, width, height) {
    let left = width, right = 0, top = height, bottom = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (mask[y * width + x]) {
                if (x < left) left = x;
                if (x > right) right = x;
                if (y < top) top = y;
                if (y > bottom) bottom = y;
            }
        }
    }
    return { left, right, top, bottom };
}

// --------- 像素级碰撞检测辅助函数 ---------
// 输入：一张图片，返回该图片透明部分的掩码，方便做像素碰撞
function getAlphaMask(image) {
    // 创建离屏画布，大小与图片相同
    const offCanvas = document.createElement('canvas');
    offCanvas.width = image.width;
    offCanvas.height = image.height;
    const offCtx = offCanvas.getContext('2d');

    // 将图片画到离屏画布
    offCtx.drawImage(image, 0, 0);

    // 获取画布像素数据（RGBA）
    const imageData = offCtx.getImageData(0, 0, image.width, image.height);

    const alphaMask = [];

    // 遍历每个像素的 alpha 通道，alpha>0 代表不透明，存 true，否则 false
    for (let i = 0; i < imageData.data.length; i += 4) {
        const alpha = imageData.data[i + 3]; // 每4字节最后一位是 alpha
        alphaMask.push(alpha > 128);
        //  alphaMask.push(alpha > ALPHA_THRESHOLD);
    }

    // 返回掩码和图片尺寸
    return { mask: alphaMask, width: image.width, height: image.height };
}

// --------- 玩家鱼类 ---------
class PlayerFish {
    constructor() {
        //this.x = 800;
        // this.y = 300;
        this.speed = 3.5;
        // this.level = 1;
        // this.growth = 0;
        // this.health = 100;
        this.direction = 'right';
        this.isDamaged = false;
        this.damageTimer = 0;
        this.lastUpdateTime = performance.now();

        // 初始图片
        this.image = new Image();
        this.image.src = 'images/Fish/whiteShark.png'; // 初始图片
        this.image.onload = this.onImageLoad.bind(this); // 监听图片加载完成事件

        this.isInvincible = false;  // 无敌状态标志

    }

    // 图片加载完成后处理
    onImageLoad() {
        playerImageWidth = this.image.width;
        playerImageHeight = this.image.height;
        const alphaMaskData = getAlphaMask(this.image);
        playerVisualBounds = calcVisualBounds(alphaMaskData.mask, alphaMaskData.width, alphaMaskData.height);
        this.alphaMask = alphaMaskData;
    }

    // 根据成长值更新玩家图片
    updateImage() {
        // 遍历成长阈值数组，查找当前成长值对应的贴图
        for (let i = growthThresholds.length - 1; i >= 0; i--) {
            if (this.growth >= growthThresholds[i].growth) {
                const newImageSrc = growthThresholds[i].image;
                // 如果图片源发生变化，重新加载新的图片
                if (newImageSrc !== this.image.src) {
                    this.image.src = newImageSrc;
                }
                break;  // 找到匹配的进化阶段后退出循环
            }
        }
    }

    getVisualOffsets() {
        const drawSize = this.getDrawSize();
        const scaleX = drawSize / playerImageWidth;
        const scaleY = drawSize * (playerImageHeight / playerImageWidth) / playerImageHeight;

        const centerX = playerImageWidth / 2;
        const centerY = playerImageHeight / 2;

        const leftOffset = (centerX - playerVisualBounds.left) * scaleX;
        const rightOffset = (playerVisualBounds.right - centerX) * scaleX;
        const topOffset = (centerY - playerVisualBounds.top) * scaleY;
        const bottomOffset = (playerVisualBounds.bottom - centerY) * scaleY;

        return { leftOffset, rightOffset, topOffset, bottomOffset };
    }
    //主角受伤判定
    takeDamage(amount) {
        this.health -= amount;
        this.isDamaged = true;
        this.damageTimer = 50;
    }

    get radius() {
        return 15 + this.growth * 0.5;
    }

    getDrawSize() {
        return this.radius * 2;
    }

    update() {
        const now = performance.now();
        const deltaTime = now - this.lastUpdateTime;
        this.lastUpdateTime = now;

        let dx = 0, dy = 0;
        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;

        dx += joystick?.x || 0;
        dy += joystick?.y || 0;

        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
            dx /= length;
            dy /= length;
            this.direction = dx < 0 ? 'left' : (dx > 0 ? 'right' : this.direction);
        }

        // 冲刺时速度加倍并且无敌
        let actualSpeed = this.speed;
        if (isDashing && dashEnergy > 0) {
    actualSpeed *= 2.5; // 冲刺加速倍率
    this.isDamaged = false; // 冲刺期间无敌（视觉效果）
    dashEnergy -= deltaTime * 0.2; // 消耗能量

    // 如果能量耗尽，强制结束冲刺
    if (dashEnergy <= 0) {
      dashEnergy = 0;
      isDashing = false;
      this.isDashing = false;
      this.isInvincible = false;
    }
  } else {
    // 没冲刺时能量恢复
    if (dashEnergy < 100) {
      dashEnergy += deltaTime * 0.1;
      if (dashEnergy > 100) dashEnergy = 100;
    }
    this.isDashing = false;
    this.isInvincible = false;
  }

        // 位移
        this.x += dx * actualSpeed;
        this.y += dy * actualSpeed;

        this.limitPosition();

        if (this.isDamaged) {
            this.damageTimer -= deltaTime;
            if (this.damageTimer <= 0) {
                this.isDamaged = false;
                this.damageTimer = 0;
            }
        }

        // 每当玩家成长时更新图片
        if (this.growth >= 100 && (this.growth % 100 === 0)) {
            this.updateImage();
        }
    }

    limitPosition() {
        const drawWidth = this.getDrawSize();
        const drawHeight = drawWidth * (playerImageHeight / playerImageWidth);

        const scaleX = drawWidth / playerImageWidth;
        const scaleY = drawHeight / playerImageHeight;

        const centerX = playerImageWidth / 2;
        const centerY = playerImageHeight / 2;

        const leftOffsetPx = centerX - playerVisualBounds.left;
        const rightOffsetPx = playerVisualBounds.right - centerX;
        const topOffsetPx = centerY - playerVisualBounds.top;
        const bottomOffsetPx = playerVisualBounds.bottom - centerY;

        const leftOffset = leftOffsetPx * scaleX;
        const rightOffset = rightOffsetPx * scaleX;
        const topOffset = topOffsetPx * scaleY;
        const bottomOffset = bottomOffsetPx * scaleY;

        this.x = Math.min(canvas.width - rightOffset, Math.max(leftOffset, this.x));
        this.y = Math.min(canvas.height - bottomOffset, Math.max(topOffset, this.y));
    }

    draw(ctx) {
        

        const drawWidth = this.getDrawSize();
        const drawHeight = drawWidth * (playerImageHeight / playerImageWidth);

        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.direction === 'left') ctx.scale(-1, 1);

        if (this.isDamaged) {
            ctx.globalAlpha = 1.0;
            ctx.drawImage(this.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
            ctx.filter = 'brightness(1.0) sepia(1) hue-rotate(-50deg) saturate(5)';
            ctx.drawImage(this.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
            ctx.filter = 'none';
        } else {
            ctx.drawImage(this.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        }
        ctx.restore();// 冲刺条绘制
        const barWidth = 80;
        const barHeight = 8;
        const barX = this.x - barWidth / 2;
        const barY = this.y + this.getDrawSize() / 2 + 12;

        if (dashUsedRecently) {
            dashOpacity += 0.05;
            if (dashOpacity > 1) dashOpacity = 1;
            dashCooldownTimer = 0;
        } else {
            dashCooldownTimer += 16.6; // 假设每帧 60FPS
            if (dashCooldownTimer > 1000) {
                dashOpacity -= 0.03;
                if (dashOpacity < 0) dashOpacity = 0;
            }
        }

        ctx.globalAlpha = dashOpacity;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        ctx.fillStyle = '#00ffff';
        ctx.fillRect(barX, barY, barWidth * (dashEnergy / 100), barHeight);
        ctx.globalAlpha = 1.0;
    }
}

// --------------- 优化的敌人类，加载完掩码才允许参与碰撞 ---------------
class Enemy {
    constructor() {
        const tier = enemyTiers[Math.floor(Math.random() * enemyTiers.length)];
        this.tier = tier;
        this.size = Math.random() * (tier.maxSize - tier.minSize) + tier.minSize;
        this.radius = this.size / 2;
        this.speed = Math.random() * 3 + 0.3;
        this.y = Math.random() * canvas.height;
        this.fromLeft = Math.random() < 0.5;
        this.x = this.fromLeft ? -this.size : canvas.width + this.size;

        this.image = new Image();
        this.image.src = tier.image;

        this.alphaMask = null;
        this.image.onload = () => {
            this.alphaMask = getAlphaMask(this.image);
        };
    }

    update() {
        this.x += this.fromLeft ? this.speed : -this.speed;
    }

    draw(ctx) {
        if (!this.image.complete || !this.image.naturalWidth) return;

        ctx.save();

        const scale = this.size / this.image.width;
        const drawWidth = this.image.width * scale;
        const drawHeight = this.image.height * scale;

        if (!this.fromLeft) {
            ctx.translate(this.x + drawWidth / 2, this.y - drawHeight / 2);
            ctx.scale(-1, 1);
        } else {
            ctx.translate(this.x - drawWidth / 2, this.y - drawHeight / 2);
        }

        ctx.drawImage(this.image, 0, 0, drawWidth, drawHeight);
        ctx.restore();
    }

    getGrowthValue() {
        return this.tier.growthValue;
    }
}
const player = new PlayerFish();

playerImage.onload = () => {
    playerImageWidth = playerImage.width;
    playerImageHeight = playerImage.height;

    const alphaMaskData = getAlphaMask(playerImage);
    playerVisualBounds = calcVisualBounds(alphaMaskData.mask, alphaMaskData.width, alphaMaskData.height);
    player.alphaMask = alphaMaskData;
};

let enemies = [];
let enemySpawnTimer = 0;
let animationId = null;

//全屏半屏实现
const enterFullscreenBtn = document.getElementById('enter-fullscreen');
const exitFullscreenBtn = document.getElementById('exit-fullscreen');

enterFullscreenBtn.addEventListener('click', () => {
    const element = document.documentElement;
    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
    }
});

exitFullscreenBtn.addEventListener('click', () => {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
});

// 切换按钮显示状态
document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
        enterFullscreenBtn.style.display = 'none';
        exitFullscreenBtn.style.display = 'inline';
    } else {
        enterFullscreenBtn.style.display = 'inline';
        exitFullscreenBtn.style.display = 'none';
    }
});
// ----------------- 修正后的像素级碰撞检测函数 -----------------
function isPixelColliding(fish1, fish2) {
    if (!fish1.alphaMask || !fish2.alphaMask) return false;

    // 计算两个鱼的绘制宽高
    const f1DrawWidth = fish1.getDrawSize();
    const f1DrawHeight = f1DrawWidth * (playerImageHeight / playerImageWidth); // 按比例
    const f2DrawWidth = fish2.size;  // 敌人类的 size 就是绘制宽度
    const f2DrawHeight = fish2.image.height * (f2DrawWidth / fish2.image.width);

    // 计算碰撞区域（重叠矩形）
    const left = Math.max(fish1.x - f1DrawWidth / 2, fish2.x - f2DrawWidth / 2);
    const right = Math.min(fish1.x + f1DrawWidth / 2, fish2.x + f2DrawWidth / 2);
    const top = Math.max(fish1.y - f1DrawHeight / 2, fish2.y - f2DrawHeight / 2);
    const bottom = Math.min(fish1.y + f1DrawHeight / 2, fish2.y + f2DrawHeight / 2);

    if (right <= left || bottom <= top) return false;

    const f1Mask = fish1.alphaMask.mask;
    const f2Mask = fish2.alphaMask.mask;

    const f1MaskWidth = fish1.alphaMask.width;
    const f1MaskHeight = fish1.alphaMask.height;
    const f2MaskWidth = fish2.alphaMask.width;
    const f2MaskHeight = fish2.alphaMask.height;

    // 缩放比例
    const f1ScaleX = f1DrawWidth / f1MaskWidth;
    const f1ScaleY = f1DrawHeight / f1MaskHeight;
    const f2ScaleX = f2DrawWidth / f2MaskWidth;
    const f2ScaleY = f2DrawHeight / f2MaskHeight;

    const step = 1; // 采样步长

    for (let y = top; y < bottom; y += step) {
        for (let x = left; x < right; x += step) {
            // 转换为掩码坐标
            const f1X = Math.floor((x - (fish1.x - f1DrawWidth / 2)) / f1ScaleX);
            const f1Y = Math.floor((y - (fish1.y - f1DrawHeight / 2)) / f1ScaleY);
            let f2X = Math.floor((x - (fish2.x - f2DrawWidth / 2)) / f2ScaleX);
            let f2Y = Math.floor((y - (fish2.y - f2DrawHeight / 2)) / f2ScaleY);

            // 如果敌人是从右往左移动，需要翻转敌人的掩码坐标
            if (!fish2.fromLeft) {
                f2X = f2MaskWidth - f2X - 1;  // 通过翻转X坐标来修正
            }

            if (f1X < 0 || f1X >= f1MaskWidth || f1Y < 0 || f1Y >= f1MaskHeight) continue;
            if (f2X < 0 || f2X >= f2MaskWidth || f2Y < 0 || f2Y >= f2MaskHeight) continue;

            const f1Index = f1Y * f1MaskWidth + f1X;
            const f2Index = f2Y * f2MaskWidth + f2X;

            if (f1Mask[f1Index] && f2Mask[f2Index]) {
                return true;
            }
        }
    }
    return false;
}

function updateEnemies() {
    if (isGameOver || isGameWin) return;

    enemySpawnTimer++;

    let dynamicInterval = Math.max(50, 100 - player.level * 5);

    if (enemySpawnTimer >= dynamicInterval) {
        const randomOffset = Math.floor(Math.random() * 2);
        const count = enemiesPerSpawn + randomOffset;

        for (let i = 0; i < count; i++) {
            enemies.push(new Enemy());
        }

        enemySpawnTimer = 0;
    }

    enemies.forEach((enemy) => enemy.update());

    enemies = enemies.filter((e) => e.x > -e.size && e.x < canvas.width + e.size);

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        if (!enemy.alphaMask) continue; // 确保掩码已加载

        if (isPixelColliding(player, enemy)) {
    if (player.radius >= enemy.radius) {
        // 吞噬敌人逻辑
        player.growth += enemy.getGrowthValue();
        enemies.splice(i, 1);

        if (player.level < growthNeeded.length - 1 &&
            player.growth >= growthNeeded[player.level]) {
            player.level++;
        }

        if (player.level >= growthNeeded.length - 1) {
            endGame(true);
            return;
        }
    } else {
        // 如果无敌，跳过受伤
        if (!player.isInvincible) {
            player.takeDamage(1);
            if (player.health <= 0) {
                endGame(false);
                return;
            }
        }
    }
}

    }
}

function drawEnemies(ctx) {
    enemies.forEach((enemy) => enemy.draw(ctx));
}

function updateHUD() {
    document.getElementById("health").innerText = `血量: ${player.health}`;
    document.getElementById("level").innerText = `等级: ${player.level}`;
    document.getElementById("growth").innerText = `成长值: ${Math.floor(player.growth)}`;
}

function debugDrawBounds(ctx, fish) {
    ctx.save(); // 保存当前 canvas 状态

    // 玩家为绿色，敌人为红色
    ctx.strokeStyle = fish === player ? 'green' : 'red';
    ctx.lineWidth = 1;

    // 绘制圆形代表判定区域
    ctx.beginPath();
    ctx.arc(fish.x, fish.y, fish.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore(); // 恢复状态
}


function gameLoop() {
    if (isGameOver || isGameWin) return;

    animationId = requestAnimationFrame(gameLoop);

    // ✅ 背景图绘制（替代清空）
    if (backgroundImage.complete) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#87ceeb'; // 默认背景色
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // ✅ 更新逻辑
    player.update();
    dashUsedRecently = isDashing;  // 用于渐变显示
    player.draw(ctx);

    updateEnemies();
    drawEnemies(ctx);
    // 吃掉敌人后更新图片
    player.updateImage();
    // ✅ 加入视觉调试区域（调试用）
    // debugDrawBounds(ctx, player);
    // enemies.forEach(enemy => debugDrawBounds(ctx, enemy));

    updateHUD();
}
function endGame(success) {
    cancelAnimationFrame(animationId);

    isGameOver = !success;
    isGameWin = success;

    const endScreen = document.getElementById('end-screen');
    endScreen.classList.remove('hidden');

    // 初始化透明度为 0
    endScreen.style.opacity = 0;

    // 渐变动画：通过 `requestAnimationFrame` 增加透明度
    let opacity = 0;
    const fadeIn = () => {
        if (opacity < 0.5) {
            opacity += 0.01; // 调整渐变速度
            endScreen.style.opacity = opacity;
            requestAnimationFrame(fadeIn);
        } else {
            endScreen.style.opacity = 0.9; // 确保最终透明度为 50%
        }
    };

    fadeIn();

    // 显示结束信息
     const endMessage = document.getElementById('end-message');
    endMessage.innerHTML = success 
        ? "恭喜你获胜！🥂"  
        : "你被吃了！💀";    
}


document.getElementById('start-button').addEventListener('click', () => {
    resetGame();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    gameLoop();
});

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;

    if (e.code === 'Space' && dashEnergy > 0) {
        isDashing = true;
        dashUsedRecently = true;
        dashCooldownTimer = 0;
        // 冲刺开始
        player.isDashing = true;
        player.isInvincible = true;

       
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;

    if (e.code === 'Space') {
        isDashing = false;
        dashCooldownTimer = 0;

         // 冲刺结束
        player.isDashing = false;
        player.isInvincible = false;
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
});
//初始化
function resetGame() {
    isGameOver = false;
    isGameWin = false;
    //出生坐标
    player.x = 960;
    player.y = 540;
    player.level = 1;
    player.growth = 30;
    player.health = 100;
    enemies = [];
    enemySpawnTimer = 0;
    
}

document.getElementById('restart-button').addEventListener('click', () => {
    resetGame();
    document.getElementById('end-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    gameLoop();
});

document.getElementById('home-button').addEventListener('click', () => {
    resetGame();
    document.getElementById('end-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
});
document.getElementById('home-button').addEventListener('click', () => {
    resetGame();  // 重置游戏状态
    // 隐藏游戏界面
    document.getElementById('game-screen').classList.add('hidden');
    // 显示首页界面
    document.getElementById('start-screen').classList.remove('hidden');
});

console.log('playerVisualBounds:', playerVisualBounds);
console.log('playerImageWidth:', playerImageWidth, 'playerImageHeight:', playerImageHeight);
