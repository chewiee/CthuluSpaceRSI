(function () {
  if (typeof CthuluSpace === "undefined") {
    window.CthuluSpace = {};
  }

  var ClickIndicator = CthuluSpace.ClickIndicator = function (options) {
    this.pos = options.pos;
    this.vel = options.vel;
    this.radius = 20;
    this.active = options.active;
    this.color = "#FF4500";
    this.game = options.game;
    this.image = CthuluSpace.ImageLoader.clickIndicator;

  };

  ClickIndicator.prototype.draw = function (ctx) {
    ctx.save();
    ctx.fillStyle = this.color;

    if (this.image) {
      ctx.drawImage(
        this.image,
        this.pos[0] - this.radius,
        this.pos[1] - this.radius,
        this.radius * 2,
        this.radius * 2
      )
    } else {
      ctx.fillStyle = this.color;

      ctx.beginPath();
      ctx.arc(
        this.pos[0], this.pos[1], this.radius, 0, 2 * Math.PI, true
      );
      ctx.fill();
    }

    ctx.beginPath();
    ctx.setLineDash([5,5]);
    ctx.lineWidth = 5;
    ctx.moveTo(this.pos[0], this.pos[1]);
    ctx.lineTo(this.game.cthulu[0].pos[0], this.game.cthulu[0].pos[1]);
    ctx.strokeStyle=this.color;
    ctx.stroke();
    ctx.restore();
  };

  var NORMAL_FRAME_TIME_DELTA = 1000/60;

  ClickIndicator.prototype.setLength = function (timeDelta) {
    if (!this.active) {
      this.game.remove(this);
    } else {
      var velocityScale = timeDelta / NORMAL_FRAME_TIME_DELTA,
      offsetX = this.vel[0] * velocityScale,
      offsetY = this.vel[1] * velocityScale;

      this.pos = [this.pos[0] + offsetX, this.pos[1] + offsetY];

      if (this.game.isOutOfBounds(this.pos)) {
        this.game.remove(this);
      }
    }
  };

  ClickIndicator.prototype.resolveClick = function () {
    if (!this.game.isOutOfBounds(this.pos) && this.pos[1] > -20) {
      if (CthuluSpace.Util.dist(this.pos, this.game.cthulu[0].pos) > 120) {
        this.game.cthulu[0].launchCthulu(this.pos);
      }
    }
  };
})();
