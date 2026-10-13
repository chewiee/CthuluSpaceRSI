(function () {
  if (typeof CthuluSpace === "undefined") {
    window.CthuluSpace = {};
  }

  var ImageLoader = CthuluSpace.ImageLoader = function () {
    this.totalLoad = 25;
    this.loaded = 0;

    this.cthuluNormal = new Image();
    this.cthuluNormal.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.cthuluNormal.src = "lib/images/cthulu.gif";

    this.cthuluLaunching = new Image();
    this.cthuluLaunching.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.cthuluLaunching.src = "lib/images/cthulu-launching.gif";

    this.cthulu1 = new Image();
    this.cthulu1.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.cthulu1.src = "lib/images/cthulu1.gif";

    this.cthulu2 = new Image();
    this.cthulu2.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.cthulu2.src = "lib/images/cthulu2.gif";

    this.cthulu3 = new Image();
    this.cthulu3.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.cthulu3.src = "lib/images/cthulu3.gif";

    this.cthulu4 = new Image();
    this.cthulu4.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.cthulu4.src = "lib/images/cthulu4.gif";

    this.cthulu5 = new Image();
    this.cthulu5.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.cthulu5.src = "lib/images/cthulu5.gif";

    this.cthuluLanding1 = new Image();
    this.cthuluLanding1.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.cthuluLanding1.src = "lib/images/cthulu-landing1.gif";

    this.cthuluLanding2 = new Image();
    this.cthuluLanding2.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.cthuluLanding2.src = "lib/images/cthulu-landing2.gif";

    this.cthuluLanding3 = new Image();
    this.cthuluLanding3.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.cthuluLanding3.src = "lib/images/cthulu-landing3.gif";

    this.cthuluLanding4 = new Image();
    this.cthuluLanding4.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.cthuluLanding4.src = "lib/images/cthulu-landing4.gif";

    this.cthuluLanding5 = new Image();
    this.cthuluLanding5.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.cthuluLanding5.src = "lib/images/cthulu-landing5.gif";

    this.earth1 = new Image();
    this.earth1.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.earth1.src = "lib/images/earth1.gif";

    this.earth2 = new Image();
    this.earth2.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.earth2.src = "lib/images/earth2.gif";

    this.earth3 = new Image();
    this.earth3.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.earth3.src = "lib/images/earth3.gif";

    this.earth4 = new Image();
    this.earth4.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.earth4.src = "lib/images/earth4.gif";

    this.earth5 = new Image();
    this.earth5.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.earth5.src = "lib/images/earth5.gif";

    this.destroyed = new Image();
    this.destroyed.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.destroyed.src = "lib/images/destroyed.gif";

    this.mercury = new Image();
    this.mercury.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.mercury.src = "lib/images/mercury.gif";

    this.clickIndicator = new Image();
    this.clickIndicator.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.clickIndicator.src = "lib/images/click-indicator.gif";

    this.directionIndicator = new Image();
    this.directionIndicator.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.directionIndicator.src = "lib/images/direction-indicator.gif";

    this.dying1 = new Image();
    this.dying1.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.dying1.src = "lib/images/dying1.gif";

    this.dying2 = new Image();
    this.dying2.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.dying2.src = "lib/images/dying2.gif";

    this.dying3 = new Image();
    this.dying3.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.dying3.src = "lib/images/dying3.gif";

    this.saturn = new Image();
    this.saturn.onload = function () {
      this.loadImageComplete();
    }.bind(this);
    this.saturn.src = "lib/images/saturn.gif";
  }

  ImageLoader.prototype.loadImageComplete = function () {
    this.loaded += 1;
  }
})();
