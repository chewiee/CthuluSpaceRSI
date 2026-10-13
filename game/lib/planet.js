(function () {
  if (typeof CthuluSpace === "undefined") {
    window.CthuluSpace = {};
  }

  var PlanetTypes = function (type) {
    var earthImages = [
      CthuluSpace.ImageLoader.earth1,
      CthuluSpace.ImageLoader.earth2,
      CthuluSpace.ImageLoader.earth3,
      CthuluSpace.ImageLoader.earth4,
      CthuluSpace.ImageLoader.earth5,
    ]
    switch (type) {
      case "earth":
        return {
          radius: 60,
          vel: [0, 0],
          color: "#FFFFFF",
          image: earthImages[Math.floor(Math.random()*earthImages.length)],
          scoreValue: 100
        }
        break;
      case "mercury":
        return {
          radius: 40,
          vel: [0, 0],
          color: "#FFFFFF",
          image: CthuluSpace.ImageLoader.mercury,
          scoreValue: 200
        }
        break;
      case "saturn":
        return {
          radius: 60,
          vel: [1, 0],
          color: "#FFFFFF",
          image: CthuluSpace.ImageLoader.saturn,
          scoreValue: 1000
        }
        break;
      case "station":
        break;
      case "asteroid":
        break;
    }
  };

  var Planet = CthuluSpace.Planet = function (options) {
    this.type = options.type;
    options = CthuluSpace.Util.extend(options, PlanetTypes(options.type));

    CthuluSpace.MovingObject.call(this, options);
  };

  CthuluSpace.Util.inherits(Planet, CthuluSpace.MovingObject);

})();
