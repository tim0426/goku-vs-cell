/**
 * 悟空 vs 賽魯 — 像素風 1P vs CPU（p5.js）
 * 操作：WASD 移動／跳、J 輕擊、K 技能、L 迴避
 */

const GW = 320;   // 內部像素解析度
const GH = 180;
const SCALE = 3;  // 顯示放大（960x540）
const GROUND = 150;
const GRAVITY = 0.45;
const JUMP_V = -6.2;
const MOVE_SPD = 1.6;
const DASH_SPD = 4.2;

let goku, cell;
let projectiles = [];
let particles = [];
let hitsparks = [];
let gameOver = false;
let winner = null;
let keys = {};
let shake = 0;
let roundMsg = "";
let roundTimer = 0;

function setup() {
  const c = createCanvas(GW * SCALE, GH * SCALE);
  c.elt.style.imageRendering = "pixelated";
  noSmooth();
  pixelDensity(1);
  textFont("monospace");
  resetGame();
}

function resetGame() {
  goku = new Fighter(70, true);
  cell = new Fighter(250, false);
  projectiles = [];
  particles = [];
  hitsparks = [];
  gameOver = false;
  winner = null;
  roundMsg = "FIGHT!";
  roundTimer = 60;
  shake = 0;
}

function draw() {
  // 畫到低解析度邏輯，再用 nearest-neighbor 放大
  push();
  if (shake > 0) {
    translate(random(-shake, shake) * SCALE, random(-shake, shake) * SCALE);
    shake *= 0.85;
    if (shake < 0.3) shake = 0;
  }
  scale(SCALE);
  noSmooth();

  drawBG();
  drawGround();

  if (!gameOver) {
    if (roundTimer <= 0) {
      handlePlayerInput();
      updateAI(cell, goku);
    }
    updateFighters();
    updateProjectiles();
    updateParticles();
  } else {
    updateParticles();
  }

  // 實體
  for (let p of projectiles) p.draw();
  goku.draw();
  cell.draw();
  for (let h of hitsparks) h.draw();
  for (let p of particles) p.draw();

  drawHUD();

  if (roundTimer > 0) {
    roundTimer--;
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(16);
    text(roundMsg, GW / 2, GH / 2 - 20);
  }

  if (gameOver) drawVictory();
  pop();
}

/* ========== 背景 ========== */

function drawBG() {
  // 像素天空
  noStroke();
  for (let y = 0; y < GROUND; y++) {
    let t = y / GROUND;
    fill(lerp(18, 70, t), lerp(28, 100, t), lerp(70, 160, t));
    rect(0, y, GW, 1);
  }
  // 遠山（方塊）
  fill(25, 45, 80);
  rect(0, 90, 80, GROUND - 90);
  rect(60, 70, 50, GROUND - 70);
  rect(140, 85, 70, GROUND - 85);
  rect(220, 60, 60, GROUND - 60);
  rect(270, 95, 50, GROUND - 95);
  fill(15, 30, 55);
  rect(40, 100, 40, GROUND - 100);
  rect(180, 100, 55, GROUND - 100);
}

function drawGround() {
  noStroke();
  fill(40, 55, 35);
  rect(0, GROUND, GW, GH - GROUND);
  fill(70, 95, 45);
  rect(0, GROUND, GW, 4);
  fill(55, 75, 40);
  for (let x = 0; x < GW; x += 8) {
    rect(x, GROUND + 6, 4, 2);
  }
}

/* ========== 輸入 ========== */

function handlePlayerInput() {
  const p = goku;
  if (p.stun > 0 || p.dead) return;

  if (!p.attacking && p.dodgeTimer <= 0) {
    if (keys["a"] || keys["A"]) p.move(-1);
    if (keys["d"] || keys["D"]) p.move(1);
    if (keys["w"] || keys["W"]) p.jump();
    if (keys["s"] || keys["S"]) p.crouching = true;
    else p.crouching = false;
  }

  if (keys["j"] || keys["J"]) p.lightAttack();
  if (keys["k"] || keys["K"]) p.skill();
  if (keys["l"] || keys["L"]) p.dodge();
}

function keyPressed() {
  keys[key] = true;
  if (keyCode === LEFT_ARROW) keys["ArrowLeft"] = true;
  if (keyCode === RIGHT_ARROW) keys["ArrowRight"] = true;
  if (keyCode === UP_ARROW) keys["ArrowUp"] = true;
  if (keyCode === DOWN_ARROW) keys["ArrowDown"] = true;

  if (gameOver && (key === "r" || key === "R")) resetGame();
  if ([37, 38, 39, 40].includes(keyCode)) return false;
}

function keyReleased() {
  keys[key] = false;
  if (keyCode === LEFT_ARROW) keys["ArrowLeft"] = false;
  if (keyCode === RIGHT_ARROW) keys["ArrowRight"] = false;
  if (keyCode === UP_ARROW) keys["ArrowUp"] = false;
  if (keyCode === DOWN_ARROW) keys["ArrowDown"] = false;
}

/* ========== AI ========== */

function updateAI(bot, target) {
  if (bot.stun > 0 || bot.dead || bot.dodgeTimer > 0) return;

  const dx = target.x - bot.x;
  const dist = abs(dx);
  const dir = dx > 0 ? 1 : -1;

  bot.thinkTimer--;
  if (bot.thinkTimer <= 0) {
    bot.thinkTimer = floor(random(12, 28));
    bot.aiAction = chooseAIAction(bot, target, dist);
  }

  switch (bot.aiAction) {
    case "approach":
      if (!bot.attacking) bot.move(dir);
      if (dist < 28 && random() < 0.4) bot.aiAction = "attack";
      break;
    case "retreat":
      if (!bot.attacking) bot.move(-dir);
      if (random() < 0.08) bot.jump();
      break;
    case "attack":
      if (dist < 32) bot.lightAttack();
      else bot.aiAction = "approach";
      break;
    case "skill":
      bot.skill();
      bot.aiAction = "retreat";
      break;
    case "dodge":
      bot.dodge();
      bot.aiAction = "approach";
      break;
    case "jump":
      bot.jump();
      bot.aiAction = "approach";
      break;
  }

  // 對玩家彈幕反應
  for (let p of projectiles) {
    if (p.owner === bot) continue;
    if (abs(p.x - bot.x) < 40 && abs(p.y - (bot.y - 12)) < 16) {
      if (random() < 0.55) {
        bot.dodge();
        break;
      }
    }
  }
}

function chooseAIAction(bot, target, dist) {
  // 玩家喺攻擊／放技能時偏向迴避
  if (target.attacking && dist < 50 && random() < 0.45) return "dodge";
  if (bot.skillCd <= 0 && dist > 40 && dist < 140 && random() < 0.35) return "skill";
  if (dist > 50) return random() < 0.75 ? "approach" : "jump";
  if (dist < 22) return random() < 0.55 ? "attack" : random() < 0.5 ? "dodge" : "retreat";
  return random(["approach", "attack", "retreat", "jump"]);
}

/* ========== 更新 ========== */

function updateFighters() {
  goku.update();
  cell.update();

  // 分開重疊
  if (abs(goku.x - cell.x) < 14 && abs(goku.y - cell.y) < 20) {
    const mid = (goku.x + cell.x) / 2;
    if (goku.x <= cell.x) {
      goku.x = mid - 7;
      cell.x = mid + 7;
    } else {
      cell.x = mid - 7;
      goku.x = mid + 7;
    }
  }

  if (!goku.attacking && goku.dodgeTimer <= 0)
    goku.facing = goku.x < cell.x ? 1 : -1;
  if (!cell.attacking && cell.dodgeTimer <= 0)
    cell.facing = cell.x < goku.x ? 1 : -1;

  // 近戰判定
  for (let atk of [goku, cell]) {
    if (!atk.attacking || atk.hitLanded || atk.attackKind !== "light") continue;
    if (atk.attackTimer > 8 || atk.attackTimer < 3) continue;
    const tgt = atk === goku ? cell : goku;
    if (atk.meleeHit(tgt)) {
      tgt.hurt(6, atk.facing);
      atk.hitLanded = true;
      spawnSpark(atk.x + atk.facing * 14, atk.y - 12, atk.isPlayer);
      shake = 2;
    }
  }
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.update();
    const tgt = p.owner === goku ? cell : goku;
    if (p.hits(tgt)) {
      tgt.hurt(p.dmg, Math.sign(p.vx) || p.owner.facing);
      spawnSpark(p.x, p.y, p.owner.isPlayer);
      shake = 3;
      projectiles.splice(i, 1);
      continue;
    }
    if (p.dead) projectiles.splice(i, 1);
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    if (particles[i].life <= 0) particles.splice(i, 1);
  }
  for (let i = hitsparks.length - 1; i >= 0; i--) {
    hitsparks[i].update();
    if (hitsparks[i].life <= 0) hitsparks.splice(i, 1);
  }
}

function spawnSpark(x, y, isPlayer) {
  hitsparks.push(new HitSpark(x, y));
  const c = isPlayer ? color(255, 200, 60) : color(100, 255, 120);
  for (let i = 0; i < 6; i++) particles.push(new Particle(x, y, c));
}

/* ========== HUD ========== */

function drawHUD() {
  // 血條底板
  drawBar(8, 6, 120, 8, goku.hp / goku.maxHp, color(255, 150, 40), "GOKU");
  drawBar(GW - 128, 6, 120, 8, cell.hp / cell.maxHp, color(60, 220, 90), "CELL");

  fill(255);
  textAlign(CENTER, TOP);
  textSize(8);
  text("VS", GW / 2, 6);
  textSize(5);
  fill(220);
  textAlign(LEFT, BOTTOM);
  text("WASD MOVE  J HIT  K SKILL  L DODGE", 6, GH - 3);
  textAlign(RIGHT, BOTTOM);
  text("1P vs CPU", GW - 6, GH - 3);
}

function drawBar(x, y, w, h, ratio, col, label) {
  ratio = constrain(ratio, 0, 1);
  noStroke();
  fill(20);
  rect(x - 1, y - 1, w + 2, h + 2);
  fill(50);
  rect(x, y, w, h);
  fill(col);
  rect(x, y, floor(w * ratio), h);
  fill(255);
  textSize(5);
  textAlign(LEFT, BOTTOM);
  text(label, x, y - 1);
}

function drawVictory() {
  fill(0, 160);
  rect(0, 0, GW, GH);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(14);
  text(winner + " WINS!", GW / 2, GH / 2 - 8);
  textSize(7);
  fill(200);
  text("PRESS R TO RESTART", GW / 2, GH / 2 + 10);
}

/* ========== Fighter ========== */

class Fighter {
  constructor(x, isPlayer) {
    this.x = x;
    this.y = GROUND;
    this.vy = 0;
    this.facing = isPlayer ? 1 : -1;
    this.isPlayer = isPlayer;
    this.maxHp = 100;
    this.hp = 100;
    this.onGround = true;
    this.crouching = false;
    this.attacking = false;
    this.attackTimer = 0;
    this.attackKind = null;
    this.hitLanded = false;
    this.skillCd = 0;
    this.dodgeCd = 0;
    this.dodgeTimer = 0;
    this.stun = 0;
    this.flash = 0;
    this.invuln = 0;
    this.dead = false;
    // AI
    this.thinkTimer = 20;
    this.aiAction = "approach";
  }

  move(dir) {
    if (this.attacking || this.dodgeTimer > 0 || this.stun > 0) return;
    this.x += dir * MOVE_SPD;
    this.x = constrain(this.x, 12, GW - 12);
  }

  jump() {
    if (this.onGround && !this.attacking && this.stun <= 0 && this.dodgeTimer <= 0) {
      this.vy = JUMP_V;
      this.onGround = false;
      this.crouching = false;
    }
  }

  lightAttack() {
    if (this.attacking || this.stun > 0 || this.dodgeTimer > 0) return;
    this.attacking = true;
    this.attackTimer = 14;
    this.attackKind = "light";
    this.hitLanded = false;
  }

  skill() {
    if (this.skillCd > 0 || this.attacking || this.stun > 0 || this.dodgeTimer > 0) return;
    this.skillCd = 70;
    this.attacking = true;
    this.attackTimer = 18;
    this.attackKind = "skill";
    this.hitLanded = true;

    const px = this.x + this.facing * 16;
    const py = this.y - 14;
    if (this.isPlayer) {
      // 氣功波
      projectiles.push(new Projectile(px, py, this.facing * 3.2, 0, 5, color(255, 230, 60), 12, this, false));
      for (let i = 0; i < 4; i++) particles.push(new Particle(px, py, color(255, 220, 80)));
    } else {
      // 死亡光線
      projectiles.push(new Projectile(px, py, this.facing * 4.5, 0, 3, color(120, 255, 100), 11, this, true));
      for (let i = 0; i < 4; i++) particles.push(new Particle(px, py, color(100, 255, 120)));
    }
  }

  dodge() {
    if (this.dodgeCd > 0 || this.stun > 0 || this.dodgeTimer > 0) return;
    this.dodgeCd = 40;
    this.dodgeTimer = 12;
    this.invuln = 12;
    this.attacking = false;
    this.attackTimer = 0;
    this.x += this.facing * DASH_SPD * 3;
    this.x = constrain(this.x, 12, GW - 12);
    for (let i = 0; i < 5; i++) {
      particles.push(new Particle(this.x - this.facing * i * 3, this.y - 10, color(200, 220, 255)));
    }
  }

  hurt(dmg, knockDir) {
    if (this.invuln > 0 || this.dead) return;
    this.hp = max(0, this.hp - dmg);
    this.flash = 8;
    this.stun = 10;
    this.invuln = 10;
    this.attacking = false;
    this.attackTimer = 0;
    this.x += knockDir * 5;
    this.x = constrain(this.x, 12, GW - 12);
    this.vy = -1.5;
    this.onGround = false;

    if (this.hp <= 0) {
      this.dead = true;
      this.hp = 0;
      gameOver = true;
      winner = this.isPlayer ? "CELL" : "GOKU";
    }
  }

  meleeHit(other) {
    if (other.invuln > 0 || other.dodgeTimer > 0) return false;
    const hx = this.x + this.facing * 14;
    const hy = this.y - (this.crouching ? 8 : 12);
    return abs(hx - other.x) < 16 && abs(hy - (other.y - 12)) < 16;
  }

  update() {
    if (this.dead) return;

    this.vy += GRAVITY;
    this.y += this.vy;
    if (this.y >= GROUND) {
      this.y = GROUND;
      this.vy = 0;
      this.onGround = true;
    }

    if (this.attackTimer > 0) {
      this.attackTimer--;
      if (this.attackTimer === 0) {
        this.attacking = false;
        this.attackKind = null;
      }
    }
    if (this.skillCd > 0) this.skillCd--;
    if (this.dodgeCd > 0) this.dodgeCd--;
    if (this.dodgeTimer > 0) this.dodgeTimer--;
    if (this.stun > 0) this.stun--;
    if (this.flash > 0) this.flash--;
    if (this.invuln > 0) this.invuln--;
  }

  draw() {
    if (this.dead) return;
    // 迴避時半透明閃爍
    if (this.dodgeTimer > 0 && frameCount % 2 === 0) return;
    if (this.flash > 0 && frameCount % 2 === 0) {
      // 受傷閃白下面會處理
    }

    push();
    translate(floor(this.x), floor(this.y));
    scale(this.facing, 1);

    const flash = this.flash > 0 && frameCount % 2 === 0;
    const body = flash
      ? color(255)
      : this.isPlayer
      ? color(240, 140, 40)
      : color(40, 170, 70);
    const accent = flash
      ? color(255)
      : this.isPlayer
      ? color(255, 220, 70)
      : color(15, 40, 15);
    const skin = flash ? color(255) : color(255, 205, 160);
    const hair = this.isPlayer ? color(20, 15, 10) : color(10, 70, 25);

    const crouch = this.crouching && this.onGround && !this.attacking ? 4 : 0;

    // 影子
    noStroke();
    fill(0, 80);
    rect(-8, 0, 16, 3);

    // 腿
    fill(body);
    if (crouch) {
      rect(-6, -8, 5, 8);
      rect(1, -8, 5, 8);
    } else {
      rect(-6, -14, 5, 14);
      rect(1, -14, 5, 14);
    }

    // 身體
    fill(body);
    rect(-7, -28 + crouch, 14, 16);
    fill(accent);
    rect(-7, -14 + crouch, 14, 3);

    // 頭
    fill(skin);
    rect(-6, -38 + crouch, 12, 11);

    // 頭髮／頭殼（像素塊）
    fill(hair);
    if (this.isPlayer) {
      rect(-7, -42 + crouch, 4, 6);
      rect(-3, -46 + crouch, 4, 8);
      rect(1, -44 + crouch, 4, 7);
      rect(5, -40 + crouch, 3, 5);
    } else {
      rect(-7, -44 + crouch, 14, 8);
      fill(accent);
      rect(-5, -42 + crouch, 3, 3);
      rect(2, -41 + crouch, 3, 2);
    }

    // 眼
    fill(20);
    rect(2, -34 + crouch, 2, 2);

    // 手臂／攻擊
    if (this.attacking && this.attackKind === "light" && this.attackTimer <= 10) {
      fill(accent);
      rect(8, -24 + crouch, 12, 5);
      fill(255, 255, 200, 150);
      rect(18, -25 + crouch, 4, 7);
    } else if (this.attacking && this.attackKind === "skill") {
      fill(accent);
      rect(6, -26 + crouch, 10, 6);
      fill(this.isPlayer ? color(255, 240, 100, 180) : color(150, 255, 150, 180));
      rect(14, -28 + crouch, 8, 10);
    } else {
      fill(body);
      rect(5, -24 + crouch, 5, 5);
      rect(-9, -22 + crouch, 4, 6);
    }

    pop();
  }
}

/* ========== Projectile ========== */

class Projectile {
  constructor(x, y, vx, vy, r, col, dmg, owner, beam) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.r = r;
    this.col = col;
    this.dmg = dmg;
    this.owner = owner;
    this.beam = beam;
    this.life = 70;
    this.dead = false;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    if (this.life <= 0 || this.x < -10 || this.x > GW + 10) this.dead = true;
    if (frameCount % 2 === 0) particles.push(new Particle(this.x, this.y, this.col, 0.5));
  }

  hits(f) {
    if (f.invuln > 0 || f.dodgeTimer > 0 || f.dead) return false;
    return abs(this.x - f.x) < this.r + 8 && abs(this.y - (f.y - 12)) < this.r + 10;
  }

  draw() {
    noStroke();
    if (this.beam) {
      fill(red(this.col), green(this.col), blue(this.col), 100);
      rect(floor(this.x - 8), floor(this.y - 2), 16, 4);
      fill(this.col);
      rect(floor(this.x - 5), floor(this.y - 1), 10, 2);
      fill(255, 255, 200);
      rect(floor(this.x - 2), floor(this.y), 4, 1);
    } else {
      fill(red(this.col), green(this.col), blue(this.col), 80);
      rect(floor(this.x - this.r - 2), floor(this.y - this.r - 2), (this.r + 2) * 2, (this.r + 2) * 2);
      fill(this.col);
      rect(floor(this.x - this.r), floor(this.y - this.r), this.r * 2, this.r * 2);
      fill(255, 255, 220);
      rect(floor(this.x - 2), floor(this.y - 2), 3, 3);
    }
  }
}

/* ========== FX ========== */

class Particle {
  constructor(x, y, col, sc = 1) {
    this.x = x;
    this.y = y;
    this.vx = random(-1.5, 1.5) * sc;
    this.vy = random(-2, 0.5) * sc;
    this.life = floor(random(10, 22));
    this.max = this.life;
    this.col = col;
    this.sz = floor(random(1, 3));
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.08;
    this.life--;
  }
  draw() {
    const a = map(this.life, 0, this.max, 0, 255);
    noStroke();
    fill(red(this.col), green(this.col), blue(this.col), a);
    rect(floor(this.x), floor(this.y), this.sz, this.sz);
  }
}

class HitSpark {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.life = 8;
  }
  update() {
    this.life--;
  }
  draw() {
    noStroke();
    fill(255, 255, 200);
    const s = this.life;
    rect(floor(this.x - s), floor(this.y), s * 2, 1);
    rect(floor(this.x), floor(this.y - s), 1, s * 2);
    fill(255, 180, 60);
    rect(floor(this.x - 2), floor(this.y - 2), 4, 4);
  }
}
