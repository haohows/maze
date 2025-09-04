/*
  重構版 main.js（模組化 / 中央判定抽離 / 多地圖關卡 / 移除多餘程式碼）
  ------------------------------------------------------------
  - 將雜湊的全域流程拆分為：初始化、地圖載入、DOM 建立、主迴圈、碰撞與勝負判定
  - 中央判定抽離為 isVictory() 與 evaluateCenterResult()
  - 支援多地圖：以 MAPS 定義牆、洞、球、中心區、勝利條件等
  - 移除未使用的 UI / 註解殘留（如 noteElement 與迷宮旋轉視覺）

  注意：
  - 保留原本 10x9 迷宮尺寸與牆/洞資料為 Level 1 預設
  - 維持球色順序：red, green, blue, yellow
  - 勝利條件：同時有 green + blue + yellow 進入中心圈；若包含 red 或顏色不齊，判定失敗
  - 依舊支援滑鼠拖曳搖桿與體感控制（啟用鍵在 index.html）
*/

/********************* 工具函式（Utilities） *********************/
const clamp = (v, a) => Math.max(-a, Math.min(a, v));
const minmax = (value, limit) => Math.max(Math.min(value, limit), -limit);

const distance2D = (p1, p2) => Math.hypot(p2.x - p1.x, p2.y - p1.y);

// Angle between the two points
const getAngle = (p1, p2) => {
  let angle = Math.atan((p2.y - p1.y) / (p2.x - p1.x));
  if (p2.x - p1.x < 0) angle += Math.PI;
  return angle;
};

// Decreases the absolute value of a number but keeps its sign
const slow = (number, difference) => {
  if (Math.abs(number) <= difference) return 0;
  if (number > difference) return number - difference;
  return number + difference;
};

/********************* 物理與碰撞（Physics / Collision） *********************/
const closestItCanBe = (cap, ball, wallW, ballSize) => {
  const angle = getAngle(cap, ball);
  const dx = Math.cos(angle) * (wallW / 2 + ballSize / 2);
  const dy = Math.sin(angle) * (wallW / 2 + ballSize / 2);
  return { x: cap.x + dx, y: cap.y + dy };
};

const rollAroundCap = (cap, ball, wallW, ballSize) => {
  // impact: direction from ball to cap; heading: from velocity
  const impactAngle = getAngle(ball, cap);
  const heading = getAngle({ x: 0, y: 0 }, { x: ball.velocityX, y: ball.velocityY });
  const impactHeadingAngle = impactAngle - heading;

  const vMag = distance2D({ x: 0, y: 0 }, { x: ball.velocityX, y: ball.velocityY });
  const vDiag = Math.sin(impactHeadingAngle) * vMag;

  const closest = wallW / 2 + ballSize / 2;
  const rotationAngle = Math.atan(vDiag / closest);

  const deltaFromCap = {
    x: Math.cos(impactAngle + Math.PI - rotationAngle) * closest,
    y: Math.sin(impactAngle + Math.PI - rotationAngle) * closest,
  };

  const x = ball.x;
  const y = ball.y;
  const velocityX = ball.x - (cap.x + deltaFromCap.x);
  const velocityY = ball.y - (cap.y + deltaFromCap.y);
  const nextX = x + velocityX;
  const nextY = y + velocityY;

  return { x, y, velocityX, velocityY, nextX, nextY };
};

/********************* 地圖/關卡定義（Maps） *********************/
// 單位：以 pathW, wallW 為基礎的格狀座標（column/row）
const MAPS = {
  level1: {
    meta: { cols: 10, rows: 9 },
    // 初始球（四角）
    balls: [
      { column: 0, row: 0 },
      { column: 9, row: 0 },
      { column: 0, row: 8 },
      { column: 9, row: 8 },
    ],
    // 牆（與原版一致）
    walls: [
      // Border
      { column: 0, row: 0, horizontal: true, length: 10 },
      { column: 0, row: 0, horizontal: false, length: 9 },
      { column: 0, row: 9, horizontal: true, length: 10 },
      { column: 10, row: 0, horizontal: false, length: 9 },

      // Horizontal lines starting in 1st column
      { column: 0, row: 6, horizontal: true, length: 1 },
      { column: 0, row: 8, horizontal: true, length: 1 },

      // Horizontal lines starting in 2nd column
      { column: 1, row: 1, horizontal: true, length: 2 },
      { column: 1, row: 7, horizontal: true, length: 1 },

      // Horizontal lines starting in 3rd column
      { column: 2, row: 2, horizontal: true, length: 2 },
      { column: 2, row: 4, horizontal: true, length: 1 },
      { column: 2, row: 5, horizontal: true, length: 1 },
      { column: 2, row: 6, horizontal: true, length: 1 },

      // Horizontal lines starting in 4th column
      { column: 3, row: 8, horizontal: true, length: 3 },

      // Horizontal lines starting in 5th column
      { column: 4, row: 6, horizontal: true, length: 1 },

      // Horizontal lines starting in 6th column
      { column: 5, row: 2, horizontal: true, length: 2 },
      { column: 5, row: 7, horizontal: true, length: 1 },

      // Horizontal lines starting in 7th column
      { column: 6, row: 1, horizontal: true, length: 1 },
      { column: 6, row: 6, horizontal: true, length: 2 },

      // Horizontal lines starting in 8th column
      { column: 7, row: 3, horizontal: true, length: 2 },
      { column: 7, row: 7, horizontal: true, length: 2 },

      // Horizontal lines starting in 9th column
      { column: 8, row: 1, horizontal: true, length: 1 },
      { column: 8, row: 2, horizontal: true, length: 1 },
      { column: 8, row: 3, horizontal: true, length: 1 },
      { column: 8, row: 4, horizontal: true, length: 2 },
      { column: 8, row: 8, horizontal: true, length: 2 },

      // Vertical lines after the 1st column
      { column: 1, row: 1, horizontal: false, length: 2 },
      { column: 1, row: 4, horizontal: false, length: 2 },

      // Vertical lines after the 2nd column
      { column: 2, row: 2, horizontal: false, length: 2 },
      { column: 2, row: 5, horizontal: false, length: 1 },
      { column: 2, row: 7, horizontal: false, length: 2 },

      // Vertical lines after the 3rd column
      { column: 3, row: 0, horizontal: false, length: 1 },
      { column: 3, row: 3, horizontal: false, length: 1 },
      { column: 3, row: 6, horizontal: false, length: 2 },

      // Vertical lines after the 4th column
      { column: 4, row: 1, horizontal: false, length: 1 },
      { column: 4, row: 6, horizontal: false, length: 1 },

      // Vertical lines after the 5th column
      { column: 5, row: 0, horizontal: false, length: 2 },
      { column: 5, row: 6, horizontal: false, length: 1 },
      { column: 5, row: 8, horizontal: false, length: 1 },

      // Vertical lines after the 6th column
      { column: 6, row: 6, horizontal: false, length: 1 },

      // Vertical lines after the 7th column
      { column: 7, row: 1, horizontal: false, length: 4 },
      { column: 7, row: 7, horizontal: false, length: 2 },

      // Vertical lines after the 8th column
      { column: 8, row: 2, horizontal: false, length: 1 },
      { column: 8, row: 4, horizontal: false, length: 2 },

      // Vertical lines after the 9th column
      { column: 9, row: 1, horizontal: false, length: 1 },
      { column: 9, row: 5, horizontal: false, length: 2 },
    ],
    // 黑洞（只有 Hard 模式會顯示）
    holes: [
      { column: 0, row: 5 },
      { column: 2, row: 0 },
      { column: 2, row: 3 },
      { column: 4, row: 6 },
      { column: 6, row: 2 },
      { column: 6, row: 8 },
      { column: 8, row: 1 },
      { column: 8, row: 2 },
    ],
    center: { x: 350 / 2, y: 315 / 2, radius: 30 / 2 },
    requiredColors: ["green", "blue", "yellow"],
  },
  // 之後可在此新增更多關卡，如 level2, level3 ...
};

/********************* 遊戲設定（Constants） *********************/
const pathW = 25; // Path width
const wallW = 10; // Wall width
const ballSize = 16; // Ball diameter
const holeSize = 18; // Black hole diameter
const maxVelocity = 1.5; // Cap ball velocity

// 重力/摩擦（滑鼠/體感共用）
const GRAVITY = 3.2;
const FRICTION_COEFF = 0.008;

/********************* DOM 取得 *********************/
const mazeElement = document.getElementById("maze");
const joystickHeadElement = document.getElementById("joystick-head");
const motionBtn = document.getElementById("enable-motion");

/********************* 全域狀態（State） *********************/
const Game = {
  hardMode: false,
  inProgress: false,
  previousTimestamp: undefined,
  accelerationX: 0,
  accelerationY: 0,
  frictionX: 0,
  frictionY: 0,
  mouseStartX: 0,
  mouseStartY: 0,
  debug: false,

  // 目前關卡資料與 DOM 物件
  currentMapKey: "level1",
  map: null,
  walls: [], // 轉換後的實際像素牆
  holes: [], // 轉換後的實際像素洞
  balls: [], // {x,y,velocityX,velocityY}
  ballEls: [],
  holeEls: [],
};

/********************* 地圖載入與轉換 *********************/
function gridToPixels(column, row) {
  return {
    x: column * (pathW + wallW) + (wallW / 2 + pathW / 2),
    y: row * (pathW + wallW) + (wallW / 2 + pathW / 2),
  };
}

function wallsToPixels(walls) {
  return walls.map((w) => ({
    x: w.column * (pathW + wallW),
    y: w.row * (pathW + wallW),
    horizontal: w.horizontal,
    length: w.length * (pathW + wallW),
  }));
}

function holesToPixels(holes) {
  return holes.map(({ column, row }) => gridToPixels(column, row));
}

function ballsToPixels(balls) {
  return balls.map(({ column, row }) => {
    const p = gridToPixels(column, row);
    return { x: p.x, y: p.y, velocityX: 0, velocityY: 0 };
  });
}

/********************* DOM 建立與清理 *********************/
function clearMazeDOM() {
  // 清除舊牆、舊黑洞、保留球容器由程式管理
  const oldWalls = mazeElement.querySelectorAll(".wall");
  oldWalls.forEach((el) => el.remove());
  Game.holeEls.forEach((el) => el.remove());
  Game.holeEls = [];
}

function drawWalls(walls) {
  walls.forEach(({ x, y, horizontal, length }) => {
    const el = document.createElement("div");
    el.className = "wall";
    el.style.cssText = `left:${x}px; top:${y}px; width:${wallW}px; height:${length}px; transform: rotate(${horizontal ? -90 : 0}deg);`;
    mazeElement.appendChild(el);
  });
}

function initBalls(balls) {
  // 建立一次球 DOM（若已存在則只更新座標）
  if (Game.ballEls.length === 0) {
    const colors = ["red", "green", "blue", "yellow"]; // 保持順序
    balls.forEach(({ x, y }, i) => {
      const el = document.createElement("div");
      el.className = `ball ${colors[i % colors.length]}`;
      el.style.cssText = `left:${x}px; top:${y}px;`;
      mazeElement.appendChild(el);
      Game.ballEls.push(el);
    });
  } else {
    balls.forEach(({ x, y }, i) => {
      Game.ballEls[i].style.cssText = `left:${x}px; top:${y}px;`;
    });
  }
}

function drawHoles(holes) {
  if (!Game.hardMode) return; // 僅 Hard 模式顯示
  holes.forEach(({ x, y }) => {
    const el = document.createElement("div");
    el.className = "black-hole";
    el.style.cssText = `left:${x}px; top:${y}px;`;
    mazeElement.appendChild(el);
    Game.holeEls.push(el);
  });
}

/********************* 勝利條件（抽離） *********************/
function getBallColor(el) {
  if (el.classList.contains("green")) return "green";
  if (el.classList.contains("blue")) return "blue";
  if (el.classList.contains("yellow")) return "yellow";
  if (el.classList.contains("red")) return "red";
  return "unknown";
}

function isVictory(insideColors, requiredColors) {
  // 需完全符合且僅包含 requiredColors（不包含 red 或其他）
  const s = new Set(insideColors);
  if (s.size !== requiredColors.length) return false;
  return requiredColors.every((c) => s.has(c));
}

function evaluateCenterResult(balls, ballEls, center, requiredColors) {
  // 回傳："none" | "win" | "fail"，並可附帶 reason
  const insideColors = balls
    .map((b, i) => ({ in: distance2D(b, center) < center.radius, color: getBallColor(ballEls[i]) }))
    .filter((x) => x.in)
    .map((x) => x.color);

  if (insideColors.length === 0) return { status: "none" };

  const ok = isVictory(insideColors, requiredColors);
  return ok ? { status: "win" } : { status: "fail" };
}

/********************* 物理更新（抽離） *********************/
function applyFrictionAndAcceleration(ball, ax, ay, fx, fy) {
  // X 軸
  if (ax === 0) {
    ball.velocityX = slow(ball.velocityX, fx);
  } else {
    ball.velocityX = ball.velocityX + ax;
    ball.velocityX = Math.max(Math.min(ball.velocityX, maxVelocity), -maxVelocity);
    ball.velocityX = ball.velocityX - Math.sign(ax) * fx;
    ball.velocityX = minmax(ball.velocityX, maxVelocity);
  }
  // Y 軸
  if (ay === 0) {
    ball.velocityY = slow(ball.velocityY, fy);
  } else {
    ball.velocityY = ball.velocityY + ay;
    ball.velocityY = ball.velocityY - Math.sign(ay) * fy;
    ball.velocityY = minmax(ball.velocityY, maxVelocity);
  }
}

function precomputeNext(ball) {
  ball.nextX = ball.x + ball.velocityX;
  ball.nextY = ball.y + ball.velocityY;
}

function collideWithWalls(ball, walls) {
  walls.forEach((wall) => {
    if (wall.horizontal) {
      // 進入到水平牆所在的帶狀區域
      if (ball.nextY + ballSize / 2 >= wall.y - wallW / 2 && ball.nextY - ballSize / 2 <= wall.y + wallW / 2) {
        const wallStart = { x: wall.x, y: wall.y };
        const wallEnd = { x: wall.x + wall.length, y: wall.y };

        // 左端圓蓋
        if (ball.nextX + ballSize / 2 >= wallStart.x - wallW / 2 && ball.nextX < wallStart.x) {
          const d = distance2D(wallStart, { x: ball.nextX, y: ball.nextY });
          if (d < ballSize / 2 + wallW / 2) {
            const closest = closestItCanBe(wallStart, { x: ball.nextX, y: ball.nextY }, wallW, ballSize);
            const rolled = rollAroundCap(wallStart, { x: closest.x, y: closest.y, velocityX: ball.velocityX, velocityY: ball.velocityY }, wallW, ballSize);
            Object.assign(ball, rolled);
          }
        }
        // 右端圓蓋
        if (ball.nextX - ballSize / 2 <= wallEnd.x + wallW / 2 && ball.nextX > wallEnd.x) {
          const d = distance2D(wallEnd, { x: ball.nextX, y: ball.nextY });
          if (d < ballSize / 2 + wallW / 2) {
            const closest = closestItCanBe(wallEnd, { x: ball.nextX, y: ball.nextY }, wallW, ballSize);
            const rolled = rollAroundCap(wallEnd, { x: closest.x, y: closest.y, velocityX: ball.velocityX, velocityY: ball.velocityY }, wallW, ballSize);
            Object.assign(ball, rolled);
          }
        }
        // 牆身
        if (ball.nextX >= wallStart.x && ball.nextX <= wallEnd.x) {
          if (ball.nextY < wall.y) {
            ball.nextY = wall.y - wallW / 2 - ballSize / 2;
          } else {
            ball.nextY = wall.y + wallW / 2 + ballSize / 2;
          }
          ball.y = ball.nextY;
          ball.velocityY = -ball.velocityY / 3;
        }
      }
    } else {
      // 垂直牆
      if (ball.nextX + ballSize / 2 >= wall.x - wallW / 2 && ball.nextX - ballSize / 2 <= wall.x + wallW / 2) {
        const wallStart = { x: wall.x, y: wall.y };
        const wallEnd = { x: wall.x, y: wall.y + wall.length };

        // 上端圓蓋
        if (ball.nextY + ballSize / 2 >= wallStart.y - wallW / 2 && ball.nextY < wallStart.y) {
          const d = distance2D(wallStart, { x: ball.nextX, y: ball.nextY });
          if (d < ballSize / 2 + wallW / 2) {
            const closest = closestItCanBe(wallStart, { x: ball.nextX, y: ball.nextY }, wallW, ballSize);
            const rolled = rollAroundCap(wallStart, { x: closest.x, y: closest.y, velocityX: ball.velocityX, velocityY: ball.velocityY }, wallW, ballSize);
            Object.assign(ball, rolled);
          }
        }
        // 下端圓蓋
        if (ball.nextY - ballSize / 2 <= wallEnd.y + wallW / 2 && ball.nextY > wallEnd.y) {
          const d = distance2D(wallEnd, { x: ball.nextX, y: ball.nextY });
          if (d < ballSize / 2 + wallW / 2) {
            const closest = closestItCanBe(wallEnd, { x: ball.nextX, y: ball.nextY }, wallW, ballSize);
            const rolled = rollAroundCap(wallEnd, { x: closest.x, y: closest.y, velocityX: ball.velocityX, velocityY: ball.velocityY }, wallW, ballSize);
            Object.assign(ball, rolled);
          }
        }
        // 牆身
        if (ball.nextY >= wallStart.y && ball.nextY <= wallEnd.y) {
          if (ball.nextX < wall.x) {
            ball.nextX = wall.x - wallW / 2 - ballSize / 2;
          } else {
            ball.nextX = wall.x + wallW / 2 + ballSize / 2;
          }
          ball.x = ball.nextX;
          ball.velocityX = -ball.velocityX / 3;
        }
      }
    }
  });
}

function checkBlackHoles(ball, holes) {
  if (!Game.hardMode) return false;
  for (let i = 0; i < holes.length; i++) {
    if (distance2D(holes[i], { x: ball.nextX, y: ball.nextY }) <= holeSize / 2) {
      if (Game.holeEls[i]) Game.holeEls[i].style.backgroundColor = "red";
      return true; // 掉進洞
    }
  }
  return false;
}

function commitBallMovement(ball) {
  ball.x += ball.velocityX;
  ball.y += ball.velocityY;
}


/********************* 遊戲核心流程 *********************/
function resetPhysics() {
  Game.previousTimestamp = undefined;
  Game.inProgress = false;
  Game.accelerationX = Game.accelerationY = 0;
  Game.frictionX = Game.frictionY = 0;
}

function loadMap(key) {
  Game.currentMapKey = key;
  Game.map = MAPS[key];
  if (!Game.map) throw new Error(`Map not found: ${key}`);

  // 轉換資料到像素座標
  Game.walls = wallsToPixels(Game.map.walls);
  Game.holes = holesToPixels(Game.map.holes);
  Game.balls = ballsToPixels(Game.map.balls);

  // DOM
  clearMazeDOM();
  drawWalls(Game.walls);
  initBalls(Game.balls);
  drawHoles(Game.holes);
}

function resetGame() {
  resetPhysics();
  loadMap(Game.currentMapKey);
  // 還原搖桿視覺
  joystickHeadElement.style.cssText = `left:0; top:0; animation:glow .6s infinite alternate ease-in-out 4s; cursor:grab;`;
}

function startLoop() {
  if (!Game.inProgress) {
    Game.inProgress = true;
    window.requestAnimationFrame(mainLoop);
  }
}

function mainLoop(timestamp) {
  if (!Game.inProgress) return;

  if (Game.previousTimestamp === undefined) {
    Game.previousTimestamp = timestamp;
    window.requestAnimationFrame(mainLoop);
    return;
  }

  const dt = (timestamp - Game.previousTimestamp) / 16; // ≈ 1 per frame

  try {
    if (Game.accelerationX !== undefined && Game.accelerationY !== undefined) {
      const ax = Game.accelerationX * dt;
      const ay = Game.accelerationY * dt;
      const fx = Game.frictionX * dt;
      const fy = Game.frictionY * dt;

      for (const ball of Game.balls) {
        applyFrictionAndAcceleration(ball, ax, ay, fx, fy);
        precomputeNext(ball);
        collideWithWalls(ball, Game.walls);

        if (checkBlackHoles(ball, Game.holes)) {
          alert("GG惹");
          resetGame();
          return;
        }

        commitBallMovement(ball);
      }

      // 更新球的位置 UI
      Game.balls.forEach(({ x, y }, i) => {
        Game.ballEls[i].style.cssText = `left:${x}px; top:${y}px;`;
      });
    }

    // 勝負判定（抽離）
    const res = evaluateCenterResult(Game.balls, Game.ballEls, Game.map.center, Game.map.requiredColors);
    if (res.status === "win") {
      alert("成功：green + blue + yellow 同時到達！🎉");
      Game.inProgress = false;
      return;
    } else if (res.status === "fail") {
      alert("失敗：進入中心的組合不符規則。");
      resetGame();
      return;
    }

    Game.previousTimestamp = timestamp;
    window.requestAnimationFrame(mainLoop);
  } catch (err) {
    console.error(err);
    Game.inProgress = false;
  }
}

/********************* 互動（滑鼠 / 觸控搖桿） *********************/
joystickHeadElement.addEventListener("mousedown", (ev) => {
  if (Game.inProgress) return;
  Game.mouseStartX = ev.clientX;
  Game.mouseStartY = ev.clientY;
  startLoop();
  joystickHeadElement.style.cssText = `animation:none; cursor:grabbing;`;
});

joystickHeadElement.addEventListener(
  "touchstart",
  (ev) => {
    const t = ev.touches[0];
    if (Game.inProgress) return;
    Game.mouseStartX = t.clientX;
    Game.mouseStartY = t.clientY;
    startLoop();
    joystickHeadElement.style.cssText = `animation:none; cursor:grabbing;`;
    ev.preventDefault();
  },
  { passive: false }
);

window.addEventListener("mousemove", (ev) => {
  if (!Game.inProgress) return;
  const dx = -minmax(Game.mouseStartX - ev.clientX, 15);
  const dy = -minmax(Game.mouseStartY - ev.clientY, 15);

  joystickHeadElement.style.cssText = `left:${dx}px; top:${dy}px; animation:none; cursor:grabbing;`;

  const rotY = dx * 0.8; // ≈ 12° max
  const rotX = dy * 0.8;

  Game.accelerationX = GRAVITY * Math.sin((rotY / 180) * Math.PI);
  Game.accelerationY = GRAVITY * Math.sin((rotX / 180) * Math.PI);
  Game.frictionX = GRAVITY * Math.cos((rotY / 180) * Math.PI) * FRICTION_COEFF;
  Game.frictionY = GRAVITY * Math.cos((rotX / 180) * Math.PI) * FRICTION_COEFF;
});

window.addEventListener(
  "touchmove",
  (ev) => {
    if (!Game.inProgress) return;
    const t = ev.touches[0];

    const dx = -minmax(Game.mouseStartX - t.clientX, 15);
    const dy = -minmax(Game.mouseStartY - t.clientY, 15);

    joystickHeadElement.style.cssText = `left:${dx}px; top:${dy}px; animation:none; cursor:grabbing;`;

    const rotY = dx * 0.8;
    const rotX = dy * 0.8;

    Game.accelerationX = GRAVITY * Math.sin((rotY / 180) * Math.PI);
    Game.accelerationY = GRAVITY * Math.sin((rotX / 180) * Math.PI);
    Game.frictionX = GRAVITY * Math.cos((rotY / 180) * Math.PI) * FRICTION_COEFF;
    Game.frictionY = GRAVITY * Math.cos((rotX / 180) * Math.PI) * FRICTION_COEFF;

    ev.preventDefault();
  },
  { passive: false }
);

/********************* 快捷鍵（重開 / 難度） *********************/
window.addEventListener("keydown", (ev) => {
  if (![" ", "H", "h", "E", "e"].includes(ev.key)) return;
  ev.preventDefault();
  if (ev.key === " ") {
    resetGame();
  } else if (ev.key === "H" || ev.key === "h") {
    Game.hardMode = true;
    resetGame();
  } else if (ev.key === "E" || ev.key === "e") {
    Game.hardMode = false;
    resetGame();
  }
});

/********************* 體感控制（DeviceOrientation） *********************/
function motionControl() {
  const UI_GAIN = 0.8;
  const MAX_TILT = 15;
  const MAX_TILT_X = 15;
  const MAX_TILT_Y = 15;
  const MAX_ROT_X = 32;
  const MAX_ROT_Y = 24;
  const CURVE_X = 0.48;
  const CURVE_Y = 0.55;
  const INVERT_X = 1;
  const INVERT_Y = 1;

  let betaOffset = 0; // 前後零點
  let gammaOffset = 0; // 左右零點

  function mapTiltAxis(aDeg, maxTilt, maxRot, curve) {
    const a = Math.max(-maxTilt, Math.min(maxTilt, aDeg));
    const s = Math.sign(a);
    const n = Math.abs(a) / maxTilt; // 0..1
    const m = Math.pow(n, curve); // 非線性
    return s * m * maxRot;
  }

  function applyPhysicsFromRotation(rotationXDeg, rotationYDeg) {
    Game.accelerationX = GRAVITY * Math.sin((rotationYDeg / 180) * Math.PI);
    Game.accelerationY = GRAVITY * Math.sin((rotationXDeg / 180) * Math.PI);
    Game.frictionX = GRAVITY * Math.cos((rotationYDeg / 180) * Math.PI) * FRICTION_COEFF;
    Game.frictionY = GRAVITY * Math.cos((rotationXDeg / 180) * Math.PI) * FRICTION_COEFF;

    // 搖桿頭視覺
    const headX = clamp(rotationYDeg / UI_GAIN, MAX_TILT);
    const headY = clamp(rotationXDeg / UI_GAIN, MAX_TILT);
    joystickHeadElement.style.cssText = `left:${headX}px; top:${headY}px; animation:none; cursor:grabbing;`;
  }

  function startMotion() {
    window.addEventListener(
      "deviceorientation",
      (e) => {
        if (!Game.inProgress) startLoop();
        const rawGamma = e.gamma ?? 0; // 左右
        const rawBeta = e.beta ?? 0; // 前後
        const gamma = rawGamma - gammaOffset;
        const beta = rawBeta - betaOffset;
        const rotationY = INVERT_Y * mapTiltAxis(gamma, MAX_TILT_Y, MAX_ROT_Y, CURVE_Y);
        const rotationX = INVERT_X * mapTiltAxis(beta, MAX_TILT_X, MAX_ROT_X, CURVE_X);
        applyPhysicsFromRotation(rotationX, rotationY);
      },
      { passive: true }
    );
    if (motionBtn) motionBtn.style.display = "none";
  }

  async function enableMotion() {
    try {
      if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res === "granted") startMotion();
      }
      // Game.hardMode = true; // 體感預設 Hard 模式（可依需求調整）
      resetGame();
      startMotion();
    } catch (e) {
      console.warn("Motion permission error:", e);
    }
  }

  if (typeof window.DeviceOrientationEvent !== "undefined") {
    if (motionBtn) {
      motionBtn.style.display = "inline-block";
      motionBtn.addEventListener("click", enableMotion, { passive: true });
    }
  }
}
motionControl()

/********************* 啟動 *********************/
resetGame();
// 預先建立球 DOM（resetGame 內已完成 loadMap/initBalls）
// 遊戲將在滑鼠/觸控/體感第一個互動時開始 mainLoop()


// === 等比縮放（自動適配小螢幕，如 iPhone 5, 320x568） ===
(function responsiveScale() {
  const stage = document.getElementById('stage');
  if (!stage) return;

  // 初次以 scale=1 量測原始尺寸（基準寬高）
  document.documentElement.style.setProperty('--scale', 1);
  const measure = () => {
    // 為避免縮放影響量測，先暫時設為 1
    stage.style.setProperty('--scale', 1);
    const rect = stage.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  };

  let base = measure();

  function fit() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 留一點安全邊（避免貼邊看起來擁擠；可調整或設0）
    const PAD = 12;

    // 以原始基準的寬高等比縮放，且不放大（上限=1）
    const scale = Math.min(
      1,
      (vw - PAD) / base.w,
      (vh - PAD) / base.h
    );

    // 套用到 :root 也可以，這裡直接寫在 stage 上（兩種都行）
    stage.style.setProperty('--scale', scale);
  }

  // 當字型或資源載入完成、或方向改變，尺寸可能改變，重量測一次
  function remeasureAndFit() {
    base = measure();
    fit();
  }

  // 初次執行
  fit();

  // 監聽 resize / orientationchange
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => {
    // 等方向切換完成後再量，避免取得中間態尺寸
    setTimeout(remeasureAndFit, 250);
  });

  // 若有動態顯示/隱藏元素導致高度變化（例如顯示體感按鈕），可再呼叫：
  // remeasureAndFit();
})();