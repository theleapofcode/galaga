import './index.css';

import Rx from 'rx';

var canvas = document.getElementById('canvas');
var ctx = canvas.getContext("2d");
canvas.width = window.innerWidth; // Required
canvas.height = window.innerHeight; // Required

const SPEED = 40; // Speed of background stars and max speed of main obsrver yield
const STAR_NUMBER = 250; // Number of stars
const HERO_Y = canvas.height - 30; // Fixed Y of the hero
const ENEMY_FREQ = 1500; // Freqency of the enemies
const SHOOTING_SPEED = 15; // Shooting speed of shots
const ENEMY_SHOOTING_FREQ = 750; // Frequency of enemy shots
const SCORE_INCREASE = 10; // Score increase per enemy hit

// Is object within visible canvas
function isVisible(obj) {
  return obj.x > -40 && obj.x < canvas.width + 40 &&
    obj.y > -40 && obj.y < canvas.height + 40;
}

// Check if two objects has collided
function collision(target1, target2) {
  return (target1.x > target2.x - 20 && target1.x < target2.x + 20) &&
    (target1.y > target2.y - 20 && target1.y < target2.y + 20);
}

// Game over if enemy or enemy shot hits hero
function gameOver(spaceship, enemies) {
  return enemies.some(enemy => {
    if (collision(spaceship, enemy)) {
      return true;
    }

    return enemy.shots.some(shot => collision(spaceship, shot));
  });
}

// Randon int
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Paint score in canvas
function paintScore(score) {
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('Score: ' + score, 40, 43);
}

// Paint background and stars in canvas
function paintStars(stars) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  stars.forEach(function (star) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();
  });
}

// Paint triangle
function paintTriangle(x, y, width, color, direction) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - width, y);
  ctx.lineTo(x, direction === 'up' ? y - width : y + width);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x - width, y);
  ctx.fill();
}

// Paint hero spaceship as green triangle
function paintSpaceShip(x, y) {
  paintTriangle(x, y, 20, '#00ff00', 'up');
}

// Paint enemies as red triangles
function paintEnemies(enemies) {
  enemies.forEach(function (enemy) {
    enemy.y += 5;
    enemy.x += getRandomInt(-15, 15);

    // Paint only if not dead
    if (!enemy.isDead) {
      paintTriangle(enemy.x, enemy.y, 20, '#ff0000', 'down');
    }

    // Paint enemy shots
    enemy.shots.forEach(function (shot) {
      shot.y += SHOOTING_SPEED; // Enemy shots go down
      paintTriangle(shot.x, shot.y, 5, '#00ffff', 'down');
    });
  });
}

// Paint hero shots
function paintHeroShots(heroShots, enemies) {
  heroShots.forEach(shot => {
    for (let i = 0; i < enemies.length; i++) {
      var enemy = enemies[i];
      if (!enemy.isDead && collision(shot, enemy)) {
        ScoreSubject.onNext(SCORE_INCREASE); // Increase score on hit
        enemy.isDead = true; // Mark enemy as dead
        shot.x = shot.y = -100; // Paint shot outside canvas to filter out
        break;
      }
    }

    shot.y -= SHOOTING_SPEED; // Hero shots go up
    paintTriangle(shot.x, shot.y, 5, '#ffff00', 'up');
  });
}

// Render in canvas
function renderScene(actors) {
  paintStars(actors.stars);
  paintSpaceShip(actors.spaceship.x, actors.spaceship.y);
  paintEnemies(actors.enemies);
  paintHeroShots(actors.heroShots, actors.enemies);
  paintScore(actors.score);
}

// Stars observable
const Stars = Rx.Observable.range(1, STAR_NUMBER)
  .map(() => { // Random position and size
    return {
      x: parseInt(Math.random() * canvas.width),
      y: parseInt(Math.random() * canvas.height),
      size: Math.random() + 1
    };
  })
  .toArray()
  .flatMap(starArray => Rx.Observable.interval(SPEED).map(function () {
    starArray.forEach(function (star) { // Move stars down at given speed
      if (star.y >= canvas.height) {
        star.y = 0; // Reset star to top of the screen
      }
      star.y += star.size; // Move star
    });
    return starArray;
  }));

// Shapeship observable
const SpaceShip = Rx.Observable.fromEvent(canvas, 'mousemove')
  .map(e => { // Hero spaceship position
    return {
      x: e.clientX,
      y: HERO_Y
    };
  })
  .startWith({ // Hero spaceship initial position
    x: canvas.width / 2,
    y: HERO_Y
  });

// Enemies observable
const Enemies = Rx.Observable.interval(ENEMY_FREQ)
  .scan(enemyArray => {
    const enemy = { // Enemy at random X position but fixed Y
      x: parseInt(Math.random() * canvas.width),
      y: -30,
      shots: []
    };

    // Enemy shots
    Rx.Observable.interval(ENEMY_SHOOTING_FREQ).subscribe(() => {
      if (!enemy.isDead) {
        enemy.shots.push({ x: enemy.x, y: enemy.y });
      }
      enemy.shots = enemy.shots.filter(isVisible);
    });

    enemyArray.push(enemy);
    return enemyArray
      .filter(isVisible)
      .filter(enemy => !(enemy.isDead && enemy.shots.length === 0)); // Remove enemy only if dead and all shots gone
  }, []);

// Hero firing observable
const HeroFiring = Rx.Observable
  .merge( // Mouse click or spacebar
  Rx.Observable.fromEvent(canvas, 'click'),
  Rx.Observable.fromEvent(document, 'keydown')
    .filter(evt => evt.keycode === 32)
  )
  .startWith({})
  .sample(200)
  .timestamp();

// Hero Shots observable
const HeroShots = Rx.Observable
  .combineLatest( // Combine to share spaceship.x with hero firing
  HeroFiring, SpaceShip,
  (shotEvents, spaceShip) => {
    return {
      timestamp: shotEvents.timestamp,
      x: spaceShip.x
    };
  })
  .distinctUntilChanged(shot => shot.timestamp)
  .scan((shotArray, shot) => {
    shotArray.push({ x: shot.x, y: HERO_Y });
    return shotArray;
  }, []);

// Score subject
const ScoreSubject = new Rx.BehaviorSubject(0);
const Score = ScoreSubject.scan(function (prev, cur) {
  return prev + cur;
}, 0).concat(Rx.Observable.return(0));

// Galaga observable
const Galaga = Rx.Observable
  .combineLatest(Stars, SpaceShip, Enemies, HeroShots, Score,
  (stars, spaceship, enemies, heroShots, score) => {
    return {
      stars: stars,
      spaceship: spaceship,
      enemies: enemies,
      heroShots: heroShots,
      score: score
    };
  }).sample(SPEED)
  .takeWhile(actors => gameOver(actors.spaceship, actors.enemies) === false);

Galaga.subscribe(renderScene);
