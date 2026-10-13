(function () {
  if (typeof CthuluSpace === "undefined") {
    window.CthuluSpace = {};
  }

  var Cthulu = CthuluSpace.Cthulu = function (options) {
    options.radius = 30;
    options.vel = options.vel || [0, 0];
    options.color = options.color || "#ADFF2F"
    this.launchSteps = 0;
    this.moving = false;
    options.image = CthuluSpace.ImageLoader.cthuluNormal;

    CthuluSpace.MovingObject.call(this, options);
  };

  CthuluSpace.Util.inherits(Cthulu, CthuluSpace.MovingObject);

  Cthulu.prototype.launchCthulu = function (pos) {
    this.moving = true;
    this.endPos = pos;
    this.launchSteps = 1;
    this.vel = [
      (this.endPos[0] - this.pos[0]) / 40,
      (this.endPos[1] - this.pos[1]) / 40
    ];

    this.image = CthuluSpace.ImageLoader.cthulu1;
  };

  Cthulu.prototype.checkForStop = function () {
    if (!!this.endPos && this.pos[1] <= this.endPos[1]) {
      this.pos = this.endPos;
      this.moving = false;
      this.radius = 20;
      this.launchSteps = 0;
      this.vel = [0,0];
      this.endPos = undefined;
      this.game.checkForLanded();
    }

    if (this.launchSteps > 0) {
      this.radius = (50 - (0.075*(this.launchSteps - 20)*(this.launchSteps - 20)));
      this.launchSteps = this.launchSteps + 1;
    }

    if (this.launchSteps > 20) {
      this.image = CthuluSpace.ImageLoader.cthulu5;
    } else if (this.launchSteps > 15) {
      this.image = CthuluSpace.ImageLoader.cthulu4;
    } else if (this.launchSteps > 10) {
      this.image = CthuluSpace.ImageLoader.cthulu3;
    } else if (this.launchSteps > 5) {
      this.image = CthuluSpace.ImageLoader.cthulu2;
    }
  };

  Cthulu.prototype.landingAnimation = function () {
    this.image = CthuluSpace.ImageLoader.cthuluLanding1;
    setTimeout(function () {
      this.image = CthuluSpace.ImageLoader.cthuluLanding2;
      setTimeout(function () {
        this.image = CthuluSpace.ImageLoader.cthuluLanding3;
        setTimeout(function () {
          this.image = CthuluSpace.ImageLoader.cthuluLanding4;
          setTimeout(function () {
            this.image = CthuluSpace.ImageLoader.cthuluLanding5;
            setTimeout(function () {
              this.image = CthuluSpace.ImageLoader.cthuluNormal;
            }.bind(this), 100);
          }.bind(this), 100);
        }.bind(this), 100);
      }.bind(this), 50);
    }.bind(this), 50);
  }

  Cthulu.prototype.dyingAnimation = function () {
    this.game.moving = false;
    this.moving = true;
    setTimeout(function () {
      this.radius -= 2;
      setTimeout(function () {
        this.radius -= 2;
        setTimeout(function () {
          this.radius -= 2;
          setTimeout(function () {
            this.radius -= 2;
            setTimeout(function () {
              this.radius -= 2;
              setTimeout(function () {
                this.radius -= 2;
                setTimeout(function () {
                  this.radius = 30;
                  this.image = CthuluSpace.ImageLoader.dying1;
                  setTimeout(function () {
                    this.image = CthuluSpace.ImageLoader.dying2;
                    setTimeout(function () {
                      this.image = CthuluSpace.ImageLoader.dying3;
                      setTimeout(function () {
                        this.radius = 0;
                        this.game.gameOver = true;
                      }.bind(this), 50);
                    }.bind(this), 50);
                  }.bind(this), 50);
                }.bind(this), 50);
              }.bind(this), 50);
            }.bind(this), 50);
          }.bind(this), 50);
        }.bind(this), 50);
      }.bind(this), 50);
    }.bind(this), 50);
  }

})();
