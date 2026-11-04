/**
 * 悟空 vs 賽魯 — 簡單 2D 格鬥（p5.js）
 * 左：孫悟空（橙/黃）  右：賽魯（綠/黑）
 */

const W = 800;
const H = 600;
const GROUND_Y = 520;
const GRAVITY = 0.7;
const JUMP_FORCE = -14;
const MOVE_SPEED = 5;

let goku, cell;
let projectiles = [];
let particles = [];
let gameOver = false;
let winner = null;
let keys = {};

function setup() {
  createCanvas(W, H);
  textFont("Segoe UI, Noto Sans TC, sans-serif");
  resetGame();
}

function resetGame() {
  goku = new Fighter({
    name: "孫悟空",
    x: 160,
    facing: 1,
    bodyColor: color(255, 140, 40),
    accentColor: color(255, 220, 80),
    hairColor: color(30, 20, 10),
    isGoku: true,
  });
  cell = new Fighter({
    name: "賽魯",
    x: 640,
    facing: -1,
    bodyColor: color(40, 180, 70),
    accentColor: color(20, 40, 20),
    hairColor: color(10, 80, 30),
    isGoku: false,
  });
  projectiles = [];
  particles = [];
  gameOver = false;
  winner = null;
}

function draw() {
  drawBackground();
  drawGround();

  if (!gameOver) {
    handleInput();
    updateFighters();
    updateProjectiles();
    checkMeleeHits();
  }

  updateParticles();

  goku.display();
  cell.display();
  for (let p of projectiles) p.display();
  for (let pt of particles) pt.display();

  drawHUD();

  if (gameOver) drawVictory();
}

/* ---------- 背景與地面 ---------- */

function drawBackground() {
  // 天空漸層
  for (let y = 0; y < H; y++) {
    let t = y / H;
    stroke(lerp(25, 80, t), lerp(40, 120, t), lerp(90, 180, t));
    line(0, y, W, y);
  }
  // 遠景山
  noStroke();
  fill(30, 55, 90, 180);
  triangle(0, GROUND_Y, 180, 280, 360, GROUND_Y);
  triangle(280, GROUND_Y, 500, 220, 720, GROUND_Y);
  fill(20, 40, 70, 160);
  triangle(100, GROUND_Y, 350, 320, 600, GROUND_Y);
}

function drawGround() {
  noStroke();
  fill(45, 55, 40);
  rect(0, GROUND_Y, W, H - GROUND_Y);
  fill(70, 90, 50);
  rect(0, GROUND_Y, W, 12);
  // 地面紋理
  stroke(55, 70, 40);
  for (let x = 0; x < W; x += 40) {
    line(x, GROUND_Y + 20, x + 20, GROUND_Y + 35);
  }
}

/* ---------- 輸入 ---------- */

function handleInput() {
  // 悟空：A/D 移動、W 跳、S 普攻、Q 技能
  if (keys["a"] || keys["A"]) goku.move(-1);
  if (keys["d"] || keys["D"]) goku.move(1);
  if (keys["w"] || keys["W"]) goku.jump();
  if (keys["s"] || keys["S"]) goku.attack();
  if (keys["q"] || keys["Q"]) goku.special();

  // 賽魯：方向鍵移動/跳/普攻、/ 技能
  if (keys["ArrowLeft"]) cell.move(-1);
  if (keys["ArrowRight"]) cell.move(1);
  if (keys["ArrowUp"]) cell.jump();
  if (keys["ArrowDown"]) cell.attack();
  if (keys["/"] || keys["Slash"]) cell.special();
}

function keyPressed() {
  keys[key] = true;
  keys[keyCode] = true;
  // 方向鍵用 keyCode 更穩
  if (keyCode === LEFT_ARROW) keys["ArrowLeft"] = true;
  if (keyCode === RIGHT_ARROW) keys["ArrowRight"] = true;
  if (keyCode === UP_ARROW) keys["ArrowUp"] = true;
  if (keyCode === DOWN_ARROW) keys["ArrowDown"] = true;

  if (gameOver && (key === "r" || key === "R")) {
    resetGame();
  }
  // 防止方向鍵捲動頁面
  if ([37, 38, 39, 40].includes(keyCode)) return false;
}

function keyReleased() {
  keys[key] = false;
  keys[keyCode] = false;
  if (keyCode === LEFT_ARROW) keys["ArrowLeft"] = false;
  if (keyCode === RIGHT_ARROW) keys["ArrowRight"] = false;
  if (keyCode === UP_ARROW) keys["ArrowUp"] = false;
  if (keyCode === DOWN_ARROW) keys["ArrowDown"] = false;
}

/* ---------- 更新 ---------- */

function updateFighters() {
  goku.update();
  cell.update();
  // 互不穿透（簡單推開）
  let gap = abs(goku.x - cell.x);
  if (gap < 50 && abs(goku.y - cell.y) < 70) {
    let mid = (goku.x + cell.x) / 2;
    if (goku.x < cell.x) {
      goku.x = mid - 25;
      cell.x = mid + 25;
    } else {
      cell.x = mid - 25;
      goku.x = mid + 25;
    }
  }
  // 面向對方
  if (!goku.attacking) goku.facing = goku.x < cell.x ? 1 : -1;
  if (!cell.attacking) cell.facing = cell.x < goku.x ? 1 : -1;
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    let p = projectiles[i];
    p.update();
    // 命中對方
    let target = p.owner === goku ? cell : goku;
    if (p.hits(target)) {
      target.takeDamage(p.damage);
      spawnHitParticles(p.x, p.y, p.col);
      projectiles.splice(i, 1);
      continue;
    }
    if (p.offscreen()) projectiles.splice(i, 1);
  }
}

function checkMeleeHits() {
  for (let attacker of [goku, cell]) {
    if (!attacker.attacking || attacker.hitLanded) continue;
    let target = attacker === goku ? cell : goku;
    if (attacker.meleeHits(target)) {
      target.takeDamage(8);
      attacker.hitLanded = true;
      let hx = attacker.x + attacker.facing * 40;
      spawnHitParticles(hx, attacker.y - 30, attacker.accentColor);
    }
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    if (particles[i].life <= 0) particles.splice(i, 1);
  }
}

function spawnHitParticles(x, y, col) {
  for (let i = 0; i < 10; i++) {
    particles.push(new Particle(x, y, col));
  }
}

/* ---------- HUD ---------- */

function drawHUD() {
  // 悟空血條（左）
  drawHealthBar(30, 24, 300, 22, goku.hp / goku.maxHp, color(255, 160, 40), "孫悟空");
  // 賽魯血條（右）
  drawHealthBar(W - 330, 24, 300, 22, cell.hp / cell.maxHp, color(50, 200, 80), "賽魯");

  // VS
  fill(255, 230);
  textAlign(CENTER, CENTER);
  textSize(22);
  textStyle(BOLD);
  text("VS", W / 2, 36);

  // 操作提示
  fill(255, 160);
  textSize(11);
  textStyle(NORMAL);
  textAlign(LEFT);
  text("悟空: A/D 移動  W 跳  S 普攻  Q 氣功波", 30, H - 18);
  textAlign(RIGHT);
  text("賽魯: ←/→ 移動  ↑ 跳  ↓ 普攻  / 死亡光線", W - 30, H - 18);
}

function drawHealthBar(x, y, w, h, ratio, col, label) {
  ratio = constrain(ratio, 0, 1);
  noStroke();
  fill(30, 30, 40, 200);
  rect(x - 2, y - 2, w + 4, h + 4, 4);
  fill(60, 60, 70);
  rect(x, y, w, h, 3);
  fill(col);
  rect(x, y, w * ratio, h, 3);
  // 高光
  fill(255, 80);
  rect(x, y, w * ratio, h * 0.35, 3);
  fill(255);
  textSize(13);
  textStyle(BOLD);
  textAlign(LEFT, BOTTOM);
  text(label, x, y - 4);
  textAlign(RIGHT, BOTTOM);
  text(ceil(ratio * 100) + "%", x + w, y - 4);
}

function drawVictory() {
  fill(0, 160);
  rect(0, 0, W, H);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(48);
  textStyle(BOLD);
  text(winner + " 勝利！", W / 2, H / 2 - 20);
  textSize(18);
  textStyle(NORMAL);
  fill(255, 200);
  text("按 R 重新開始", W / 2, H / 2 + 40);
}

/* ========== Fighter ========== */

class Fighter {
  constructor(opts) {
    this.name = opts.name;
    this.x = opts.x;
    this.y = GROUND_Y;
    this.vy = 0;
    this.w = 40;
    this.h = 70;
    this.facing = opts.facing;
    this.bodyColor = opts.bodyColor;
    this.accentColor = opts.accentColor;
    this.hairColor = opts.hairColor;
    this.isGoku = opts.isGoku;
    this.maxHp = 100;
    this.hp = 100;
    this.onGround = true;
    this.attacking = false;
    this.attackTimer = 0;
    this.specialCooldown = 0;
    this.hitLanded = false;
    this.hurtFlash = 0;
    this.invuln = 0;
  }

  move(dir) {
    if (this.attacking) return;
    this.x += dir * MOVE_SPEED;
    this.x = constrain(this.x, 30, W - 30);
  }

  jump() {
    if (this.onGround && !this.attacking) {
      this.vy = JUMP_FORCE;
      this.onGround = false;
    }
  }

  attack() {
    if (this.attacking || this.attackTimer > 0) return;
    this.attacking = true;
    this.attackTimer = 18;
    this.hitLanded = false;
  }

  special() {
    if (this.specialCooldown > 0 || this.attacking) return;
    this.specialCooldown = 90;
    this.attacking = true;
    this.attackTimer = 20;
    this.hitLanded = true; // 遠程唔用近戰判定

    let px = this.x + this.facing * 45;
    let py = this.y - 35;
    if (this.isGoku) {
      // 氣功波：黃色能量球
      projectiles.push(
        new Projectile(px, py, this.facing * 9, 0, 18, color(255, 230, 60), 16, this)
      );
      spawnHitParticles(px, py, color(255, 220, 80));
    } else {
      // 死亡光線：細長綠色光束彈
      projectiles.push(
        new Projectile(px, py, this.facing * 14, 0, 12, color(120, 255, 100), 14, this, true)
      );
      spawnHitParticles(px, py, color(100, 255, 120));
    }
  }

  update() {
    // 重力
    this.vy += GRAVITY;
    this.y += this.vy;
    if (this.y >= GROUND_Y) {
      this.y = GROUND_Y;
      this.vy = 0;
      this.onGround = true;
    }

    if (this.attackTimer > 0) {
      this.attackTimer--;
      if (this.attackTimer === 0) this.attacking = false;
    }
    if (this.specialCooldown > 0) this.specialCooldown--;
    if (this.hurtFlash > 0) this.hurtFlash--;
    if (this.invuln > 0) this.invuln--;
  }

  takeDamage(amount) {
    if (this.invuln > 0 || this.hp <= 0) return;
    this.hp = max(0, this.hp - amount);
    this.hurtFlash = 10;
    this.invuln = 12;
    // 擊退：遠離對手
    let other = this === goku ? cell : goku;
    let dir = this.x < other.x ? -1 : 1;
    this.x += dir * 12;
    this.x = constrain(this.x, 30, W - 30);

    if (this.hp <= 0) {
      gameOver = true;
      winner = this === goku ? cell.name : goku.name;
    }
  }

  meleeHits(other) {
    let reachX = this.x + this.facing * 45;
    let reachY = this.y - 35;
    return dist(reachX, reachY, other.x, other.y - 35) < 50;
  }

  display() {
    push();
    translate(this.x, this.y);
    scale(this.facing, 1);

    let flash = this.hurtFlash > 0 && frameCount % 4 < 2;
    let body = flash ? color(255) : this.bodyColor;
    let accent = flash ? color(255) : this.accentColor;

    // 影子
    noStroke();
    fill(0, 60);
    ellipse(0, 4, 50, 10);

    // 腿
    fill(body);
    rect(-14, -28, 12, 28, 3);
    rect(2, -28, 12, 28, 3);

    // 身體
    fill(body);
    rect(-18, -62, 36, 36, 6);
    // 腰帶／細節
    fill(accent);
    rect(-18, -32, 36, 6);

    // 頭
    fill(255, 210, 170);
    ellipse(0, -78, 28, 28);

    // 頭髮／頭部特徵（簡化抽象形狀，避免版權角色肖像）
    fill(this.hairColor);
    if (this.isGoku) {
      // 尖刺髮型（抽象）
      triangle(-14, -82, -6, -105, 2, -82);
      triangle(-4, -85, 6, -110, 12, -82);
      triangle(4, -82, 14, -100, 16, -78);
    } else {
      // 賽魯式頭殼（抽象橢圓＋斑點）
      ellipse(0, -88, 32, 26);
      fill(accent);
      ellipse(-6, -90, 8, 6);
      ellipse(6, -86, 6, 5);
    }

    // 眼睛
    fill(20);
    ellipse(6, -78, 4, 5);

    // 手臂：攻擊時前伸＋光暈
    if (this.attacking && this.attackTimer > 6) {
      fill(accent);
      ellipse(28, -40, 22, 14);
      fill(red(accent), green(accent), blue(accent), 100);
      ellipse(36, -40, 30, 24);
    } else {
      fill(body);
      ellipse(20, -45, 14, 12);
      ellipse(-16, -42, 12, 14);
    }

    pop();
  }
}

/* ========== Projectile ========== */

class Projectile {
  constructor(x, y, vx, vy, r, col, damage, owner, isBeam = false) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.r = r;
    this.col = col;
    this.damage = damage;
    this.owner = owner;
    this.isBeam = isBeam;
    this.life = 90;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    // 拖尾粒子
    if (frameCount % 2 === 0) {
      particles.push(new Particle(this.x, this.y, this.col, 0.4));
    }
  }

  hits(fighter) {
    return dist(this.x, this.y, fighter.x, fighter.y - 35) < this.r + 25;
  }

  offscreen() {
    return this.x < -50 || this.x > W + 50 || this.life <= 0;
  }

  display() {
    noStroke();
    if (this.isBeam) {
      // 死亡光線：細長
      fill(red(this.col), green(this.col), blue(this.col), 80);
      ellipse(this.x, this.y, this.r * 4, this.r);
      fill(this.col);
      ellipse(this.x, this.y, this.r * 2.5, this.r * 0.6);
      fill(255, 255, 200);
      ellipse(this.x, this.y, this.r, this.r * 0.3);
    } else {
      // 氣功波：圓形能量球
      fill(red(this.col), green(this.col), blue(this.col), 60);
      ellipse(this.x, this.y, this.r * 2.8);
      fill(this.col);
      ellipse(this.x, this.y, this.r * 1.8);
      fill(255, 255, 220);
      ellipse(this.x - 2, this.y - 2, this.r * 0.7);
    }
  }
}

/* ========== Particle ========== */

class Particle {
  constructor(x, y, col, scale = 1) {
    this.x = x;
    this.y = y;
    this.vx = random(-3, 3) * scale;
    this.vy = random(-4, 1) * scale;
    this.life = floor(random(15, 30) * scale + 10);
    this.maxLife = this.life;
    this.col = col;
    this.size = random(3, 8) * (scale + 0.5);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.15;
    this.life--;
  }

  display() {
    let a = map(this.life, 0, this.maxLife, 0, 220);
    noStroke();
    fill(red(this.col), green(this.col), blue(this.col), a);
    ellipse(this.x, this.y, this.size);
  }
}
