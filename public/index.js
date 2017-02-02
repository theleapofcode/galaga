import './index.css';

import Rx from 'rx';

var canvas = document.getElementById('canvas');
var ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const SPEED = 40;
const STAR_NUMBER = 250;
const HERO_Y = canvas.height - 30;
const ENEMY_FREQ = 1500;
const SHOOTING_SPEED = 15;
const ENEMY_SHOOTING_FREQ = 750;
const SCORE_INCREASE = 10;

function isVisible(obj) {
  return obj.x > -40 && obj.x < canvas.width + 40 &&
    obj.y > -40 && obj.y < canvas.height + 40;
}

function collision(target1, target2) {
  return (target1.x > target2.x - 20 && target1.x < target2.x + 20) &&
    (target1.y > target2.y - 20 && target1.y < target2.y + 20);
}

function gameOver(spaceship, enemies) {
  return enemies.some(enemy => {
    if (collision(spaceship, enemy)) {
      return true;
    }

    return enemy.shots.some(shot => collision(spaceship, shot));
  });
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function paintScore(score) {
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('Score: ' + score, 40, 43);
}

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

function paintTriangle(x, y, width, color, direction) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - width, y);
  ctx.lineTo(x, direction === 'up' ? y - width : y + width);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x - width, y);
  ctx.fill();
}

function paintSpaceShip(x, y) {
  paintTriangle(x, y, 20, '#00ff00', 'up');
}

function paintEnemies(enemies) {
  enemies.forEach(function (enemy) {
    enemy.y += 5;
    enemy.x += getRandomInt(-15, 15);

    if (!enemy.isDead) {
      paintTriangle(enemy.x, enemy.y, 20, '#ff0000', 'down');
    }

    enemy.shots.forEach(function (shot) {
      shot.y += SHOOTING_SPEED;
      paintTriangle(shot.x, shot.y, 5, '#00ffff', 'down');
    });
  });
}

function paintHeroShots(heroShots, enemies) {
  heroShots.forEach(shot => {
    for (let i = 0; i < enemies.length; i++) {
      var enemy = enemies[i];
      if (!enemy.isDead && collision(shot, enemy)) {
        ScoreSubject.onNext(SCORE_INCREASE);
        enemy.isDead = true;
        shot.x = shot.y = -100;
        break;
      }
    }

    shot.y -= SHOOTING_SPEED;
    paintTriangle(shot.x, shot.y, 5, '#ffff00', 'up');
  });
}

function renderScene(actors) {
  paintStars(actors.stars);
  paintSpaceShip(actors.spaceship.x, actors.spaceship.y);
  paintEnemies(actors.enemies);
  paintHeroShots(actors.heroShots, actors.enemies);
  paintScore(actors.score);
}

// Stars
const Stars = Rx.Observable.range(1, STAR_NUMBER)
  .map(() => {
    return {
      x: parseInt(Math.random() * canvas.width),
      y: parseInt(Math.random() * canvas.height),
      size: Math.random() + 1
    };
  })
  .toArray()
  .flatMap(starArray => Rx.Observable.interval(SPEED).map(function () {
    starArray.forEach(function (star) {
      if (star.y >= canvas.height) {
        star.y = 0; // Reset star to top of the screen
      }
      star.y += star.size; // Move star
    });
    return starArray;
  }));

// Shapeship
const SpaceShip = Rx.Observable.fromEvent(canvas, 'mousemove')
  .map(e => {
    return {
      x: e.clientX,
      y: HERO_Y
    };
  })
  .startWith({
    x: canvas.width / 2,
    y: HERO_Y
  });

// Enemies
const Enemies = Rx.Observable.interval(ENEMY_FREQ)
  .scan(enemyArray => {
    const enemy = {
      x: parseInt(Math.random() * canvas.width),
      y: -30,
      shots: []
    };

    Rx.Observable.interval(ENEMY_SHOOTING_FREQ).subscribe(() => {
      if (!enemy.isDead) {
        enemy.shots.push({ x: enemy.x, y: enemy.y });
      }
      enemy.shots = enemy.shots.filter(isVisible);
    });

    enemyArray.push(enemy);
    return enemyArray
      .filter(isVisible)
      .filter(enemy => !(enemy.isDead && enemy.shots.length === 0));
  }, []);

// Hero firing
const HeroFiring = Rx.Observable
  .merge(
  Rx.Observable.fromEvent(canvas, 'click'),
  Rx.Observable.fromEvent(document, 'keydown')
    .filter(evt => evt.keycode === 32)
  )
  .startWith({})
  .sample(200)
  .timestamp();

// Hero Shots
const HeroShots = Rx.Observable
  .combineLatest(
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

// Galaga
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
