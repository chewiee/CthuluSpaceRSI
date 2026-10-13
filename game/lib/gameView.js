(function () {
  if (typeof CthuluSpace === "undefined") {
    window.CthuluSpace = {};
  }

  var GameView = CthuluSpace.GameView = function (game, ctx) {
    this.ctx = ctx;
    this.game = game;
    this.clicking = false;
  };

  var getEventPos = function(e, canvasEl) {
    var rect = canvasEl.getBoundingClientRect();
    var scaleX = canvasEl.width / rect.width;
    var scaleY = canvasEl.height / rect.height;

    var clientX, clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  var mouseMove = function (e) {
    // Prevent default touch actions (scrolling)
    if (e.type === 'touchmove') e.preventDefault();

    if (!this.game.cthulu[0].moving) {
      var canvasEl = document.getElementsByTagName("canvas")[0];
      var pos = getEventPos(e, canvasEl);

      var vel = [
        this.game.cthulu[0].pos[0] - pos.x,
        this.game.cthulu[0].pos[1] - pos.y
      ]
      vel = CthuluSpace.Util.dir(vel);
      
      if (!this.clicking) {
        // HOVER STATE
        var hoverVel = [vel[0] * 100, vel[1] * 100];

        if (hoverVel[1] < -0.3) {
          if (!this.directionIndicator) {
            this.game.indicators = [];
            this.directionIndicator = new CthuluSpace.DirectionIndicator({
              pos: this.game.cthulu[0].pos,
              vel: hoverVel,
              game: this.game
            })
            this.game.indicators.push(this.directionIndicator);
          } else {
            this.directionIndicator.pos = this.game.cthulu[0].pos;
            this.directionIndicator.vel = hoverVel;
          }
        }
      } else {
        // DRAG STATE (Clicking/Touching)
        if (this.clickIndicator) {
          var launchVel = [
            vel[0] * (10 + this.game.planetsEaten / 40),
            vel[1] * (10 + this.game.planetsEaten / 40)
          ];
          this.clickIndicator.vel = launchVel;
        }
      }
    }
  };

  var startClick = function (e) {
    // Prevent default touch actions
    if (e.type === 'touchstart') e.preventDefault();

    var canvasEl = document.getElementsByTagName("canvas")[0];
    var pos = getEventPos(e, canvasEl);

    this.clicking = true;
    this.game.cthulu[0].image = CthuluSpace.ImageLoader.cthuluLaunching;

    var vel = [
      this.game.cthulu[0].pos[0] - pos.x,
      this.game.cthulu[0].pos[1] - pos.y
    ]
    vel = CthuluSpace.Util.dir(vel);
    vel[0] = vel[0] * (10 + this.game.planetsEaten / 40);
    vel[1] = vel[1] * (10 + this.game.planetsEaten / 40);

    if (vel[1] < -0.3  && !this.game.cthulu[0].endPos) {
      if (this.directionIndicator) {this.game.remove(this.directionIndicator)};
      this.directionIndicator = undefined;
      this.clickIndicator = this.game.addClickIndicator({
        pos: this.game.cthulu[0].pos,
        vel: vel,
        active: true
      });
    }
  };

  var endClick = function(e) {
    if (e.type === 'touchend') e.preventDefault();
    
    this.clicking = false;
    this.game.cthulu[0].image = CthuluSpace.ImageLoader.cthuluNormal;

    if (!!this.clickIndicator && !this.game.cthulu[0].endPos) {
      this.clickIndicator.active = false;
      this.clickIndicator.resolveClick();
    }
  };

  GameView.prototype.bindClickHandlers = function () {
    var canvasEl = document.getElementsByTagName("canvas")[0];

    // Mouse events
    canvasEl.addEventListener('mousemove', mouseMove.bind(this), false);
    canvasEl.addEventListener('mousedown', startClick.bind(this), false);
    canvasEl.addEventListener('mouseup', endClick.bind(this), false);
    
    // Touch events
    canvasEl.addEventListener('touchmove', mouseMove.bind(this), {passive: false});
    canvasEl.addEventListener('touchstart', startClick.bind(this), {passive: false});
    canvasEl.addEventListener('touchend', endClick.bind(this), {passive: false});
  };

  GameView.prototype.startImageLoad = function () {
    if(CthuluSpace.ImageLoader.loaded >= CthuluSpace.ImageLoader.totalLoad) {
      this.start()
    } else {
      setTimeout(function () {
        this.startImageLoad();
      }.bind(this), 200);
    }
  };

  GameView.prototype.start = function () {
    this.game.addCthulu();

    this.directionIndicator = new CthuluSpace.DirectionIndicator({
      pos: this.game.cthulu[0].pos,
      vel: [0, -100],
      game: this.game
    })

    this.game.indicators.push(this.directionIndicator);

    this.bindClickHandlers();
    this.lastTime = 0;

    // RSI platform hook: required, the smoke test checks for it.
    if (window.RSI) { window.RSI.runStarted(); }

    requestAnimationFrame(this.animate.bind(this));
  };

  GameView.prototype.animate = function (time) {
    var timeDelta = time - this.lastTime;
    this.game.step(timeDelta);
    this.game.draw(this.ctx);
    this.lastTime = time;

    if (this.game.gameOver) {
      // RSI platform hook: required, the smoke test checks for it.
      if (window.RSI) {
        window.RSI.runEnded({
          planetsEaten: this.game.planetsEaten,
          score: this.game.score
        });
      }

      setTimeout(function () {
        var canvasEl = document.getElementsByTagName("canvas")[0];
        var canvasClone = canvasEl.cloneNode(true);
        canvasEl.parentNode.replaceChild(canvasClone, canvasEl)

        this.game = new CthuluSpace.Game();
        this.ctx = canvasClone.getContext("2d");

        this.start();
      }.bind(this), 2000);
    } else {
      requestAnimationFrame(this.animate.bind(this));
    }

  };
})();
