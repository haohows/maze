/*

If you want to know how this game works, you can find a source code walkthrough video here: https://youtu.be/bTk6dcAckuI

Follow me on twitter for more: https://twitter.com/HunorBorbely

*/

Math.minmax = (value, limit) => {
    return Math.max(Math.min(value, limit), -limit);
};

const distance2D = (p1, p2) => {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
};

// Angle between the two points
const getAngle = (p1, p2) => {
    let angle = Math.atan((p2.y - p1.y) / (p2.x - p1.x));
    if (p2.x - p1.x < 0) angle += Math.PI;
    return angle;
};

// The closest a ball and a wall cap can be
const closestItCanBe = (cap, ball) => {
    let angle = getAngle(cap, ball);

    const deltaX = Math.cos(angle) * (wallW / 2 + ballSize / 2);
    const deltaY = Math.sin(angle) * (wallW / 2 + ballSize / 2);

    return { x: cap.x + deltaX, y: cap.y + deltaY };
};

// Roll the ball around the wall cap
const rollAroundCap = (cap, ball) => {
    // The direction the ball can't move any further because the wall holds it back
    let impactAngle = getAngle(ball, cap);

    // The direction the ball wants to move based on it's velocity
    let heading = getAngle(
        { x: 0, y: 0 },
        { x: ball.velocityX, y: ball.velocityY }
    );

    // The angle between the impact direction and the ball's desired direction
    // The smaller this angle is, the bigger the impact
    // The closer it is to 90 degrees the smoother it gets (at 90 there would be no collision)
    let impactHeadingAngle = impactAngle - heading;

    // Velocity distance if not hit would have occurred
    const velocityMagnitude = distance2D(
        { x: 0, y: 0 },
        { x: ball.velocityX, y: ball.velocityY }
    );
    // Velocity component diagonal to the impact
    const velocityMagnitudeDiagonalToTheImpact =
        Math.sin(impactHeadingAngle) * velocityMagnitude;

    // How far should the ball be from the wall cap
    const closestDistance = wallW / 2 + ballSize / 2;

    const rotationAngle = Math.atan(
        velocityMagnitudeDiagonalToTheImpact / closestDistance
    );

    const deltaFromCap = {
        x: Math.cos(impactAngle + Math.PI - rotationAngle) * closestDistance,
        y: Math.sin(impactAngle + Math.PI - rotationAngle) * closestDistance
    };

    const x = ball.x;
    const y = ball.y;
    const velocityX = ball.x - (cap.x + deltaFromCap.x);
    const velocityY = ball.y - (cap.y + deltaFromCap.y);
    const nextX = x + velocityX;
    const nextY = y + velocityY;

    return { x, y, velocityX, velocityY, nextX, nextY };
};

// Decreases the absolute value of a number but keeps it's sign, doesn't go below abs 0
const slow = (number, difference) => {
    if (Math.abs(number) <= difference) return 0;
    if (number > difference) return number - difference;
    return number + difference;
};

const mazeElement = document.getElementById("maze");
const joystickHeadElement = document.getElementById("joystick-head");
// const noteElement = document.getElementById("note"); // Note element for instructions and game won, game failed texts

let hardMode = false;
let previousTimestamp;
let gameInProgress;
let mouseStartX;
let mouseStartY;
let accelerationX;
let accelerationY;
let frictionX;
let frictionY;

const pathW = 25; // Path width
const wallW = 10; // Wall width
const ballSize = 16; // Width and height of the ball
const holeSize = 18;

const debugMode = false;

let balls = [];
let ballElements = [];
let holeElements = [];

resetGame();

// Draw balls for the first time
balls.forEach(({ x, y }, i) => {
    const ballColors = ['red', 'green', 'blue', 'yellow'];
    const ball = document.createElement("div");
    ball.className = `ball ${ballColors[i % ballColors.length]}`;
    ball.style.cssText = `left: ${x}px; top: ${y}px;`;

    mazeElement.appendChild(ball);
    ballElements.push(ball);
});

// Wall metadata
const walls = [
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
    { column: 3, row: 3, horizontal: true, length: 1 },
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
    { column: 3, row: 4, horizontal: false, length: 1 },
    { column: 3, row: 6, horizontal: false, length: 2 },

    // Vertical lines after the 4th column
    { column: 4, row: 1, horizontal: false, length: 2 },
    { column: 4, row: 6, horizontal: false, length: 1 },

    // Vertical lines after the 5th column
    { column: 5, row: 0, horizontal: false, length: 2 },
    { column: 5, row: 6, horizontal: false, length: 1 },
    { column: 5, row: 8, horizontal: false, length: 1 },

    // Vertical lines after the 6th column
    //   { column: 6, row: 4, horizontal: false, length: 1 },
    { column: 6, row: 6, horizontal: false, length: 1 },

    // Vertical lines after the 7th column
    { column: 7, row: 1, horizontal: false, length: 4 },
    { column: 7, row: 7, horizontal: false, length: 2 },

    // Vertical lines after the 8th column
    { column: 8, row: 2, horizontal: false, length: 1 },
    { column: 8, row: 4, horizontal: false, length: 2 },

    // Vertical lines after the 9th column
    { column: 9, row: 1, horizontal: false, length: 1 },
    { column: 9, row: 5, horizontal: false, length: 2 }
].map((wall) => ({
    x: wall.column * (pathW + wallW),
    y: wall.row * (pathW + wallW),
    horizontal: wall.horizontal,
    length: wall.length * (pathW + wallW)
}));

// Draw walls
walls.forEach(({ x, y, horizontal, length }) => {
    const wall = document.createElement("div");
    wall.setAttribute("class", "wall");
    wall.style.cssText = `
      left: ${x}px;
      top: ${y}px;
      width: ${wallW}px;
      height: ${length}px;
      transform: rotate(${horizontal ? -90 : 0}deg);
    `;

    mazeElement.appendChild(wall);
});

const holes = [
    { column: 0, row: 5 },
    { column: 2, row: 0 },
    { column: 2, row: 4 },
    { column: 4, row: 6 },
    { column: 6, row: 2 },
    { column: 6, row: 8 },
    { column: 8, row: 1 },
    { column: 8, row: 2 }
].map((hole) => ({
    x: hole.column * (wallW + pathW) + (wallW / 2 + pathW / 2),
    y: hole.row * (wallW + pathW) + (wallW / 2 + pathW / 2)
}));

joystickHeadElement.addEventListener("mousedown", function (event) {
    if (!gameInProgress) {
        mouseStartX = event.clientX;
        mouseStartY = event.clientY;
        gameInProgress = true;
        window.requestAnimationFrame(main);
        // noteElement.style.opacity = 0;
        joystickHeadElement.style.cssText = `
        animation: none;
        cursor: grabbing;
      `;
    }
});

joystickHeadElement.addEventListener("touchstart", function (event) {
    const t = event.touches[0];
    if (!gameInProgress) {
        mouseStartX = t.clientX;
        mouseStartY = t.clientY;
        gameInProgress = true;
        window.requestAnimationFrame(main);
        // noteElement.style.opacity = 0;
        joystickHeadElement.style.cssText = `
      animation: none;
      cursor: grabbing;
    `;
    }
    // 阻止瀏覽器把這次觸控當成滾動/縮放
    event.preventDefault();
}, { passive: false });

window.addEventListener("mousemove", function (event) {
    if (gameInProgress) {
        const mouseDeltaX = -Math.minmax(mouseStartX - event.clientX, 15);
        const mouseDeltaY = -Math.minmax(mouseStartY - event.clientY, 15);

        joystickHeadElement.style.cssText = `
        left: ${mouseDeltaX}px;
        top: ${mouseDeltaY}px;
        animation: none;
        cursor: grabbing;
      `;

        const rotationY = mouseDeltaX * 0.8; // Max rotation = 12
        const rotationX = mouseDeltaY * 0.8;

        // mazeElement.style.cssText = `
        //     transform: rotateY(${rotationY}deg) rotateX(${-rotationX}deg)
        //   `;

        const gravity = 3.2;
        const friction = 0.008; // Coefficients of friction

        accelerationX = gravity * Math.sin((rotationY / 180) * Math.PI);
        accelerationY = gravity * Math.sin((rotationX / 180) * Math.PI);
        frictionX = gravity * Math.cos((rotationY / 180) * Math.PI) * friction;
        frictionY = gravity * Math.cos((rotationX / 180) * Math.PI) * friction;
    }
});

window.addEventListener("touchmove", function (event) {
    if (!gameInProgress) return;
    const t = event.touches[0];

    const mouseDeltaX = -Math.minmax(mouseStartX - t.clientX, 15);
    const mouseDeltaY = -Math.minmax(mouseStartY - t.clientY, 15);

    joystickHeadElement.style.cssText = `
    left: ${mouseDeltaX}px;
    top: ${mouseDeltaY}px;
    animation: none;
    cursor: grabbing;
  `;

    const rotationY = mouseDeltaX * 0.8; // Max rotation ≈ 12°
    const rotationX = mouseDeltaY * 0.8;

    //     mazeElement.style.cssText = `
    //     transform: rotateY(${rotationY}deg) rotateX(${-rotationX}deg)
    //   `;

    const gravity = 3.2;
    const friction = 0.008;

    accelerationX = gravity * Math.sin((rotationY / 180) * Math.PI);
    accelerationY = gravity * Math.sin((rotationX / 180) * Math.PI);
    frictionX = gravity * Math.cos((rotationY / 180) * Math.PI) * friction;
    frictionY = gravity * Math.cos((rotationX / 180) * Math.PI) * friction;

    event.preventDefault();
}, { passive: false });

window.addEventListener("keydown", function (event) {
    // If not an arrow key or space or H was pressed then return
    if (![" ", "H", "h", "E", "e"].includes(event.key)) return;

    // If an arrow key was pressed then first prevent default
    event.preventDefault();

    // If space was pressed restart the game
    if (event.key == " ") {
        resetGame();
        return;
    }

    // Set Hard mode
    if (event.key == "H" || event.key == "h") {
        hardMode = true;
        resetGame();
        return;
    }

    // Set Easy mode
    if (event.key == "E" || event.key == "e") {
        hardMode = false;
        resetGame();
        return;
    }
});

function resetGame() {
    previousTimestamp = undefined;
    gameInProgress = false;
    mouseStartX = undefined;
    mouseStartY = undefined;
    accelerationX = undefined;
    accelerationY = undefined;
    frictionX = undefined;
    frictionY = undefined;

    //   mazeElement.style.cssText = `
    //       transform: rotateY(0deg) rotateX(0deg)
    //     `;

    joystickHeadElement.style.cssText = `
      left: 0;
      top: 0;
      animation: glow;
      cursor: grab;
    `;

    if (hardMode) {
        // noteElement.innerHTML = `Click the joystick to start!
        //     <p>Hard mode, Avoid black holes. Back to easy mode? Press E</p>`;
    } else {
        // noteElement.innerHTML = `Click the joystick to start!
        //     <p>Move every ball to the center. Ready for hard mode? Press H</p>`;
    }
    //   noteElement.style.opacity = 1;

    balls = [
        { column: 0, row: 0 },
        { column: 9, row: 0 },
        { column: 0, row: 8 },
        { column: 9, row: 8 }
    ].map((ball) => ({
        x: ball.column * (wallW + pathW) + (wallW / 2 + pathW / 2),
        y: ball.row * (wallW + pathW) + (wallW / 2 + pathW / 2),
        velocityX: 0,
        velocityY: 0
    }));

    if (ballElements.length) {
        balls.forEach(({ x, y }, index) => {
            ballElements[index].style.cssText = `left: ${x}px; top: ${y}px; `;
        });
    }

    // Remove previous hole elements
    holeElements.forEach((holeElement) => {
        mazeElement.removeChild(holeElement);
    });
    holeElements = [];

    // Reset hole elements if hard mode
    if (hardMode) {
        holes.forEach(({ x, y }) => {
            const ball = document.createElement("div");
            ball.setAttribute("class", "black-hole");
            ball.style.cssText = `left: ${x}px; top: ${y}px; `;

            mazeElement.appendChild(ball);
            holeElements.push(ball);
        });
    }
}

function main(timestamp) {
    // It is possible to reset the game mid-game. This case the look should stop
    if (!gameInProgress) return;

    if (previousTimestamp === undefined) {
        previousTimestamp = timestamp;
        window.requestAnimationFrame(main);
        return;
    }

    const maxVelocity = 1.5;

    // Time passed since last cycle divided by 16
    // This function gets called every 16 ms on average so dividing by 16 will result in 1
    const timeElapsed = (timestamp - previousTimestamp) / 16;

    try {
        // If mouse didn't move yet don't do anything
        if (accelerationX != undefined && accelerationY != undefined) {
            const velocityChangeX = accelerationX * timeElapsed;
            const velocityChangeY = accelerationY * timeElapsed;
            const frictionDeltaX = frictionX * timeElapsed;
            const frictionDeltaY = frictionY * timeElapsed;

            balls.forEach((ball) => {
                if (velocityChangeX == 0) {
                    // No rotation, the plane is flat
                    // On flat surface friction can only slow down, but not reverse movement
                    ball.velocityX = slow(ball.velocityX, frictionDeltaX);
                } else {
                    ball.velocityX = ball.velocityX + velocityChangeX;
                    ball.velocityX = Math.max(Math.min(ball.velocityX, 1.5), -1.5);
                    ball.velocityX =
                        ball.velocityX - Math.sign(velocityChangeX) * frictionDeltaX;
                    ball.velocityX = Math.minmax(ball.velocityX, maxVelocity);
                }

                if (velocityChangeY == 0) {
                    // No rotation, the plane is flat
                    // On flat surface friction can only slow down, but not reverse movement
                    ball.velocityY = slow(ball.velocityY, frictionDeltaY);
                } else {
                    ball.velocityY = ball.velocityY + velocityChangeY;
                    ball.velocityY =
                        ball.velocityY - Math.sign(velocityChangeY) * frictionDeltaY;
                    ball.velocityY = Math.minmax(ball.velocityY, maxVelocity);
                }

                // Preliminary next ball position, only becomes true if no hit occurs
                // Used only for hit testing, does not mean that the ball will reach this position
                ball.nextX = ball.x + ball.velocityX;
                ball.nextY = ball.y + ball.velocityY;

                if (debugMode) console.log("tick", ball);

                walls.forEach((wall, wi) => {
                    if (wall.horizontal) {
                        // Horizontal wall

                        if (
                            ball.nextY + ballSize / 2 >= wall.y - wallW / 2 &&
                            ball.nextY - ballSize / 2 <= wall.y + wallW / 2
                        ) {
                            // Ball got within the strip of the wall
                            // (not necessarily hit it, could be before or after)

                            const wallStart = {
                                x: wall.x,
                                y: wall.y
                            };
                            const wallEnd = {
                                x: wall.x + wall.length,
                                y: wall.y
                            };

                            if (
                                ball.nextX + ballSize / 2 >= wallStart.x - wallW / 2 &&
                                ball.nextX < wallStart.x
                            ) {
                                // Ball might hit the left cap of a horizontal wall
                                const distance = distance2D(wallStart, {
                                    x: ball.nextX,
                                    y: ball.nextY
                                });
                                if (distance < ballSize / 2 + wallW / 2) {
                                    if (debugMode && wi > 4)
                                        console.warn("too close h head", distance, ball);

                                    // Ball hits the left cap of a horizontal wall
                                    const closest = closestItCanBe(wallStart, {
                                        x: ball.nextX,
                                        y: ball.nextY
                                    });
                                    const rolled = rollAroundCap(wallStart, {
                                        x: closest.x,
                                        y: closest.y,
                                        velocityX: ball.velocityX,
                                        velocityY: ball.velocityY
                                    });

                                    Object.assign(ball, rolled);
                                }
                            }

                            if (
                                ball.nextX - ballSize / 2 <= wallEnd.x + wallW / 2 &&
                                ball.nextX > wallEnd.x
                            ) {
                                // Ball might hit the right cap of a horizontal wall
                                const distance = distance2D(wallEnd, {
                                    x: ball.nextX,
                                    y: ball.nextY
                                });
                                if (distance < ballSize / 2 + wallW / 2) {
                                    if (debugMode && wi > 4)
                                        console.warn("too close h tail", distance, ball);

                                    // Ball hits the right cap of a horizontal wall
                                    const closest = closestItCanBe(wallEnd, {
                                        x: ball.nextX,
                                        y: ball.nextY
                                    });
                                    const rolled = rollAroundCap(wallEnd, {
                                        x: closest.x,
                                        y: closest.y,
                                        velocityX: ball.velocityX,
                                        velocityY: ball.velocityY
                                    });

                                    Object.assign(ball, rolled);
                                }
                            }

                            if (ball.nextX >= wallStart.x && ball.nextX <= wallEnd.x) {
                                // The ball got inside the main body of the wall
                                if (ball.nextY < wall.y) {
                                    // Hit horizontal wall from top
                                    ball.nextY = wall.y - wallW / 2 - ballSize / 2;
                                } else {
                                    // Hit horizontal wall from bottom
                                    ball.nextY = wall.y + wallW / 2 + ballSize / 2;
                                }
                                ball.y = ball.nextY;
                                ball.velocityY = -ball.velocityY / 3;

                                if (debugMode && wi > 4)
                                    console.error("crossing h line, HIT", ball);
                            }
                        }
                    } else {
                        // Vertical wall

                        if (
                            ball.nextX + ballSize / 2 >= wall.x - wallW / 2 &&
                            ball.nextX - ballSize / 2 <= wall.x + wallW / 2
                        ) {
                            // Ball got within the strip of the wall
                            // (not necessarily hit it, could be before or after)

                            const wallStart = {
                                x: wall.x,
                                y: wall.y
                            };
                            const wallEnd = {
                                x: wall.x,
                                y: wall.y + wall.length
                            };

                            if (
                                ball.nextY + ballSize / 2 >= wallStart.y - wallW / 2 &&
                                ball.nextY < wallStart.y
                            ) {
                                // Ball might hit the top cap of a horizontal wall
                                const distance = distance2D(wallStart, {
                                    x: ball.nextX,
                                    y: ball.nextY
                                });
                                if (distance < ballSize / 2 + wallW / 2) {
                                    if (debugMode && wi > 4)
                                        console.warn("too close v head", distance, ball);

                                    // Ball hits the left cap of a horizontal wall
                                    const closest = closestItCanBe(wallStart, {
                                        x: ball.nextX,
                                        y: ball.nextY
                                    });
                                    const rolled = rollAroundCap(wallStart, {
                                        x: closest.x,
                                        y: closest.y,
                                        velocityX: ball.velocityX,
                                        velocityY: ball.velocityY
                                    });

                                    Object.assign(ball, rolled);
                                }
                            }

                            if (
                                ball.nextY - ballSize / 2 <= wallEnd.y + wallW / 2 &&
                                ball.nextY > wallEnd.y
                            ) {
                                // Ball might hit the bottom cap of a horizontal wall
                                const distance = distance2D(wallEnd, {
                                    x: ball.nextX,
                                    y: ball.nextY
                                });
                                if (distance < ballSize / 2 + wallW / 2) {
                                    if (debugMode && wi > 4)
                                        console.warn("too close v tail", distance, ball);

                                    // Ball hits the right cap of a horizontal wall
                                    const closest = closestItCanBe(wallEnd, {
                                        x: ball.nextX,
                                        y: ball.nextY
                                    });
                                    const rolled = rollAroundCap(wallEnd, {
                                        x: closest.x,
                                        y: closest.y,
                                        velocityX: ball.velocityX,
                                        velocityY: ball.velocityY
                                    });

                                    Object.assign(ball, rolled);
                                }
                            }

                            if (ball.nextY >= wallStart.y && ball.nextY <= wallEnd.y) {
                                // The ball got inside the main body of the wall
                                if (ball.nextX < wall.x) {
                                    // Hit vertical wall from left
                                    ball.nextX = wall.x - wallW / 2 - ballSize / 2;
                                } else {
                                    // Hit vertical wall from right
                                    ball.nextX = wall.x + wallW / 2 + ballSize / 2;
                                }
                                ball.x = ball.nextX;
                                ball.velocityX = -ball.velocityX / 3;

                                if (debugMode && wi > 4)
                                    console.error("crossing v line, HIT", ball);
                            }
                        }
                    }
                });

                // Detect is a ball fell into a hole
                if (hardMode) {
                    holes.forEach((hole, hi) => {
                        const distance = distance2D(hole, {
                            x: ball.nextX,
                            y: ball.nextY
                        });

                        if (distance <= holeSize / 2) {
                            // The ball fell into a hole
                            holeElements[hi].style.backgroundColor = "red";
                            throw Error("The ball fell into a hole");
                        }
                    });
                }

                // Adjust ball metadata
                ball.x = ball.x + ball.velocityX;
                ball.y = ball.y + ball.velocityY;
            });

            // Move balls to their new position on the UI
            balls.forEach(({ x, y }, index) => {
                ballElements[index].style.cssText = `left: ${x}px; top: ${y}px; `;
            });
        }

        // Win detection
        if (
            balls.every(
                (ball) => distance2D(ball, { x: 350 / 2, y: 315 / 2 }) < 65 / 2
            )
        ) {
            alert("你贏惹")
            //   noteElement.innerHTML = `Congrats, you did it!
            //     ${!hardMode ? "<p>Press H for hard mode</p>" : ""}
            //     <p>
            //       Follow me
            //       <a href="https://twitter.com/HunorBorbely" , target="_top"
            //         >@HunorBorbely</a
            //       >
            //     </p>`;
            //   noteElement.style.opacity = 1;
            gameInProgress = false;
        } else {
            previousTimestamp = timestamp;
            window.requestAnimationFrame(main);
        }
    } catch (error) {
        if (error.message == "The ball fell into a hole") {
            //   noteElement.innerHTML = `A ball fell into a black hole! Press space to reset the game.
            //     <p>
            //       Back to easy? Press E
            //     </p>`;
            //   noteElement.style.opacity = 1;
            gameInProgress = false;
        } else throw error;
    }
}


// === motion control ===
(() => {
    const btn = document.getElementById('enable-motion');

    const UI_GAIN = 0.8;     // 轉視覺旋轉的倍率（和原本一致）
    const gravity = 3.2;
    const friction = 0.008;

    // 靈敏控制參數（全域變數，可放 main.js 前面）
    const MAX_TILT = 10;   // 手機最大可用傾斜角（度）


    // —— 每軸獨立靈敏度 —— //
    const MAX_TILT_X = 10;   // 前後(beta) 可用角度估計
    const MAX_TILT_Y = 10;   // 左右(gamma) 可用角度估計

    const MAX_ROT_X = 32;   // 映射到遊戲的最大“旋轉角” (前後更大，補償遲緩)
    const MAX_ROT_Y = 24;   // 左右保持原本或略小

    const CURVE_X = 0.48;    // 前後曲線（小角更敏感一些）
    const CURVE_Y = 0.55;    // 左右曲線

    const INVERT_X = 1;      // 需要反向就設 -1
    const INVERT_Y = 1;


    // 動態校正偏移（按鈕或自動設定）
    let betaOffset = 0;     // 前後零點
    let gammaOffset = 0;     // 左右零點

    function mapTiltAxis(aDeg, maxTilt, maxRot, curve) {
        const a = Math.max(-maxTilt, Math.min(maxTilt, aDeg));
        const s = Math.sign(a);
        const n = Math.abs(a) / maxTilt;      // 0..1
        const m = Math.pow(n, curve);         // 非線性放大
        return s * m * maxRot;                // 輸出到遊戲角度
    }



    // 將角度限制在 [-MAX_TILT, MAX_TILT]
    const clamp = (v, a) => Math.max(-a, Math.min(a, v));

    function applyPhysicsFromRotation(rotationXDeg, rotationYDeg) {
        // 視覺（如果你先前已拿掉迷宮旋轉，也沒關係，這行不會壞）
        // mazeElement.style.transform =
        //     `rotateY(${rotationYDeg}deg) rotateX(${-rotationXDeg}deg)`;

        // 物理（與滑鼠版本一致）  :contentReference[oaicite:2]{index=2}
        accelerationX = gravity * Math.sin((rotationYDeg / 180) * Math.PI);
        accelerationY = gravity * Math.sin((rotationXDeg / 180) * Math.PI);
        frictionX = gravity * Math.cos((rotationYDeg / 180) * Math.PI) * friction;
        frictionY = gravity * Math.cos((rotationXDeg / 180) * Math.PI) * friction;

        // 搖桿頭的視覺回饋（非必要，但很直覺）
        const headX = clamp(rotationYDeg / UI_GAIN, MAX_TILT);
        const headY = clamp(rotationXDeg / UI_GAIN, MAX_TILT);
        joystickHeadElement.style.cssText =
            `left:${headX}px; top:${headY}px; animation:none; cursor:grabbing;`;
    }

    // 啟用監聽
    function startMotion() {
        window.addEventListener('deviceorientation', (e) => {
            if (!gameInProgress) {
                gameInProgress = true;
                window.requestAnimationFrame(main);
            }

            // 原始角
            const rawGamma = (e.gamma ?? 0); // 左右
            const rawBeta = (e.beta ?? 0); // 前後

            // 扣掉偏移（校正中立握姿）
            const gamma = rawGamma - gammaOffset;
            const beta = rawBeta - betaOffset;

            // 依各軸參數映射 → 遊戲用角度
            const rotationY = INVERT_Y * mapTiltAxis(gamma, MAX_TILT_Y, MAX_ROT_Y, CURVE_Y); // 左右→Y
            const rotationX = INVERT_X * mapTiltAxis(beta, MAX_TILT_X, MAX_ROT_X, CURVE_X); // 前後→X

            applyPhysicsFromRotation(rotationX, rotationY);
        }, { passive: true });

        // 隱藏啟用按鈕（若存在）
        if (btn) btn.style.display = 'none';
    }

    // 權限流程（iOS 13+ 需要 user gesture）
    async function enableMotion() {
        try {
            if (typeof DeviceOrientationEvent !== 'undefined' &&
                typeof DeviceOrientationEvent.requestPermission === 'function') {
                const res = await DeviceOrientationEvent.requestPermission();
                if (res === 'granted') startMotion();
            } else {
                // Android 或桌面瀏覽器（不需顯式授權）
                startMotion();
            }
        } catch (e) {
            console.warn('Motion permission error:', e);
        }
    }

    // 探測支援度，決定是否顯示按鈕
    if (typeof window.DeviceOrientationEvent !== 'undefined') {
        // iOS 需要點擊；其他環境直接啟用
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            if (btn) {
                btn.style.display = 'inline-block';
                btn.addEventListener('click', enableMotion, { passive: true });
            }
        } else {
            enableMotion();
        }
    }
})();
