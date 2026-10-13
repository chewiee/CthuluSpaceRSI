(function () {
  if (typeof CthuluSpace === "undefined") {
    window.CthuluSpace = {};
  }

  var DirectionIndicator = CthuluSpace.DirectionIndicator = function (options) {
    this.pos = options.pos;
    this.vel = options.vel;
    this.radius = 10;
    this.color = "#FFFF00";
    this.game = options.game;
    this.image = CthuluSpace.ImageLoader.directionIndicator;
  };

  DirectionIndicator.prototype.draw = function (ctx) {
    ctx.save();
    ctx.fillStyle = this.color;
    var rads = -Math.atan(this.vel[0] / this.vel[1])

    ctx.translate(this.game.cthulu[0].pos[0], this.game.cthulu[0].pos[1]);
    ctx.rotate(rads);

    if (this.image) {
      ctx.drawImage(
        this.image,
        0 - this.radius,
        -100 - this.radius,
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

    ctx.rotate(-rads);
    ctx.translate(-this.game.cthulu[0].pos[0], -this.game.cthulu[0].pos[1]);

    ctx.beginPath();
    ctx.setLineDash([5,5]);
    ctx.lineWidth = 5;
    ctx.moveTo(this.game.cthulu[0].pos[0] + 0.85 * this.vel[0],
      this.game.cthulu[0].pos[1] + 0.85 * this.vel[1]);
    ctx.lineTo(this.game.cthulu[0].pos[0], this.game.cthulu[0].pos[1]);
    ctx.strokeStyle=this.color;
    ctx.stroke();
    ctx.restore();
  };

})();
