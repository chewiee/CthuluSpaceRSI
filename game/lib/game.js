(function () {
  if (typeof CthuluSpace === "undefined") {
    window.CthuluSpace = {};
  }

  var Game = CthuluSpace.Game = function () {
    this.cthulu = [];
    this.indicators = [];
    this.planets = [];
    this.score = 0;
    this.planetsEaten = 0;
    this.moving = false;
    this.gameOver = false;
    this.bg = new Image ();
    this.bg.onload = function () {
      this.bgLoaded = true;
    }.bind(this);
    this.bg.src = 'lib/images/bg.gif';
    this.bgOffset = 640;
  };

  Game.BG_COLOR = "#000000";
  Game.DIM_X = 600;
  Game.DIM_Y = 800;
  Game.FPS = 60;

  Game.prototype.addClickIndicator = function (options) {
    options.game = this;
    var clickIndicator = new CthuluSpace.ClickIndicator(options);

    this.indicators.push(clickIndicator);

    return clickIndicator;
  }

  Game.prototype.addCthulu = function () {
    this.cthulu = [new CthuluSpace.Cthulu({pos: [300, 600], game: this})]

    return this.cthulu[0];
  };

  Game.prototype.addPlanet = function (planetOptions) {
    this.planets.push(new CthuluSpace.Planet(planetOptions));
  }

  Game.prototype.allObjects = function () {
    return [].concat(this.planets, this.indicators, this.cthulu);
  };

  Game.prototype.randomXPos = function () {
    return (Math.floor(Math.random() * (Game.DIM_X - 300)) + 150);
  };

  Game.prototype.createPlanets = function () {
    if (this.planets.length === 0) {
      this.addPlanet({pos: [this.randomXPos(), 351], type: "earth", game: this})
      this.addPlanet({pos: [this.randomXPos(), 151], type: "earth", game: this})
    }

    if (this.planets[this.planets.length - 1].pos[1] > 150) {
      var planetSeed = Math.floor(Math.random() * 100);
      if (this.score <= 1000) {
        planetSeed -= 50;
      }

      if (planetSeed <= 30) {
        this.addPlanet({pos: [this.randomXPos(), -50], type: "earth", game: this});
      } else if (planetSeed <= 60) {
        this.addPlanet({pos: [this.randomXPos(), -50], type: "mercury", game: this});
      } else if (planetSeed <= 100) {
        this.addPlanet({pos: [0, -50], type: "saturn", game: this});
      } else {
        //new planet type here
      }
    }
  };

  Game.prototype.draw = function (ctx) {
    ctx.save();
    ctx.clearRect(0,0, Game.DIM_X, Game.DIM_Y);
    if (this.bgLoaded) {
      ctx.drawImage(this.bg, 40, this.bgOffset, 240, 320, 0,0, Game.DIM_X, Game.DIM_Y);
    }

    ctx.textAlign="center";
    ctx.font = "120px Anton";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    if (this.score >= 1000000) {
      ctx.fillText(Math.floor(this.score / 100000) / 10, 300, 375);
      ctx.font = "30px Anton";
      ctx.fillText("trillion", 300, 420);
    } else if (this.score >= 1000) {
      ctx.fillText(Math.floor(this.score / 100) / 10, 300, 375);
      ctx.font = "30px Anton";
      ctx.fillText("billion", 300, 420);
    } else {
      ctx.fillText(Math.floor(this.score), 300, 375);
      ctx.font = "30px Anton";
      ctx.fillText("million", 300, 420);
    }
    ctx.fillText("souls consumed", 300, 460);

    this.allObjects().forEach(function (object) {
      object.draw(ctx);
    });

    ctx.restore();
  };

  Game.prototype.isOutOfBounds = function (pos) {
    return (pos[0] < 0) || (pos[1] < -100) ||
      (pos[0] > Game.DIM_X + 50) || (pos[1] > (Game.DIM_Y + 100));
  };

  Game.prototype.moveObjects = function (delta) {
    this.allObjects().forEach(function (object) {
      if (object instanceof CthuluSpace.MovingObject) {
        object.move(delta);
      }
    });
  };

  Game.prototype.remove = function (object) {
    if (object instanceof CthuluSpace.Cthulu) {
      this.cthulu.splice(this.cthulu.indexOf(object), 1);
    } else if (object instanceof CthuluSpace.MovingObject) {
      this.planets.splice(this.planets.indexOf(object), 1);
    } else if (object instanceof CthuluSpace.ClickIndicator ||
      object instanceof CthuluSpace.DirectionIndicator) {
      this.indicators.splice(this.indicators.indexOf(object), 1);
    } else {
      throw "i cant believe you've done this";
    }
  };

  Game.prototype.setIndicators = function (delta) {
    this.indicators.forEach(function (indicator) {
      if (indicator instanceof CthuluSpace.ClickIndicator) {
        indicator.setLength(delta);
      }
    })
  };

  var NORMAL_FRAME_TIME_DELTA = 1000/60;

  Game.prototype.advanceBackground = function (delta) {
    var velocityScale = delta / NORMAL_FRAME_TIME_DELTA;
    var offsetY = -(0.5 + (this.planetsEaten / 40)) * velocityScale;

    offsetY = offsetY * (2 - (this.cthulu[0].pos[1] / Game.DIM_Y)) ;

    if (!!this.cthulu[0].endPos) {
      this.cthulu[0].endPos[1] = this.cthulu[0].endPos[1] - offsetY;
    }

    this.allObjects().forEach(function (object) {
      object.pos[1] = object.pos[1] - offsetY;
    })

    this.bgOffset += (offsetY / 10);
    if (this.bgOffset <= 160) {
    this.bgOffset = 640;
    }

    if (this.cthulu[0].pos[0] >= Game.DIM_X || this.cthulu[0].pos[1] >= Game.DIM_Y) {
      this.cthulu[0].dyingAnimation();
    }
  };

  Game.prototype.checkForLanded = function () {
    var landed = false;
    this.planets.forEach(function (object) {
      if (CthuluSpace.Util.dist(this.cthulu[0].pos, object.pos) < (object.radius + 10)) {
        landed = true;
        this.score += (object.scoreValue * (this.score + 2000) / 2000);
        this.planetsEaten += 1;
        object.image = CthuluSpace.ImageLoader.destroyed;
        this.moving = true;
        if(object.type == "saturn") {
          this.cthulu[0].vel[0] = 1;
        }

        this.cthulu[0].landingAnimation();
      }
    }.bind(this));

    if (landed && this.indicators.length == 0) {
      this.indicators.push(new CthuluSpace.DirectionIndicator({
        pos: this.cthulu[0].pos,
        vel: [0, -100],
        game: this
      }));
    } else {
      this.cthulu[0].dyingAnimation();
    }
  }

  Game.prototype.step = function (delta) {
    if (delta <= 50) {

      this.moveObjects(delta);
      this.setIndicators(delta);
      if (!!this.cthulu[0]) {
        this.cthulu[0].checkForStop();
      }
      if (this.moving) {
        this.advanceBackground(delta);
      }
      this.createPlanets();
    }
  }


})();
