(function() {
  var assert, o, parseOptionSpec;

  assert = require('assert');

  parseOptionSpec = require('../lib/dreamopt').parseOptionSpec;

  o = function(spec, result) {
    return describe("when given '" + spec + "'", function() {
      var key, option, value, _results;
      option = null;
      before(function() {
        return option = parseOptionSpec(spec, []);
      });
      _results = [];
      for (key in result) {
        value = result[key];
        _results.push((function(key, value) {
          return it("" + key + " should be " + (JSON.stringify(value)), function() {
            return assert.deepEqual(option[key], value, "" + key + " must be " + (JSON.stringify(value)) + ", got " + (JSON.stringify(option[key])));
          });
        })(key, value));
      }
      return _results;
    });
  };

  describe('dreamopt.parseOptionSpec', function() {
    describe("basic usage", function() {
      o("-c", {
        shortOpt: '-c',
        longOpt: null,
        desc: "",
        tags: {
          flag: true
        },
        metavars: []
      });
      o("--code", {
        shortOpt: null,
        longOpt: '--code',
        desc: "",
        tags: {
          flag: true
        },
        metavars: []
      });
      return o("-c, --code", {
        shortOpt: '-c',
        longOpt: '--code',
        desc: "",
        tags: {
          flag: true
        },
        metavars: []
      });
    });
    describe("metavar", function() {
      o("-c FILE", {
        shortOpt: '-c',
        longOpt: null,
        desc: "",
        tags: {},
        metavars: ['FILE']
      });
      o("--code FILE", {
        shortOpt: null,
        longOpt: '--code',
        desc: "",
        tags: {},
        metavars: ['FILE']
      });
      return o("-c, --code FILE", {
        shortOpt: '-c',
        longOpt: '--code',
        desc: "",
        tags: {},
        metavars: ['FILE']
      });
    });
    describe("two metavars", function() {
      o("-c SRC DST", {
        shortOpt: '-c',
        longOpt: null,
        desc: "",
        tags: {},
        metavars: ['SRC', 'DST']
      });
      o("--code SRC DST", {
        shortOpt: null,
        longOpt: '--code',
        desc: "",
        tags: {},
        metavars: ['SRC', 'DST']
      });
      return o("-c, --code SRC DST", {
        shortOpt: '-c',
        longOpt: '--code',
        desc: "",
        tags: {},
        metavars: ['SRC', 'DST']
      });
    });
    describe("description", function() {
      o("-c  Produce some codez", {
        shortOpt: '-c',
        longOpt: null,
        desc: "Produce some codez",
        tags: {
          flag: true
        },
        metavars: []
      });
      o("--code  Produce some codez", {
        shortOpt: null,
        longOpt: '--code',
        desc: "Produce some codez",
        tags: {
          flag: true
        },
        metavars: []
      });
      return o("-c, --code  Produce some codez", {
        shortOpt: '-c',
        longOpt: '--code',
        desc: "Produce some codez",
        tags: {
          flag: true
        },
        metavars: []
      });
    });
    describe("tag", function() {
      return o("-c, --code  Produce some codez #required", {
        shortOpt: '-c',
        longOpt: '--code',
        desc: "Produce some codez",
        tags: {
          flag: true,
          required: true
        },
        metavars: []
      });
    });
    describe("multiple tags", function() {
      return o("-c, --code  Produce some codez #required #date #foo", {
        shortOpt: '-c',
        longOpt: '--code',
        desc: "Produce some codez",
        tags: {
          required: true,
          date: true,
          foo: true,
          flag: true
        },
        metavars: []
      });
    });
    describe("tag without description", function() {
      o("-c  #required", {
        shortOpt: '-c',
        longOpt: null,
        desc: "",
        tags: {
          flag: true,
          required: true
        },
        metavars: []
      });
      o("--code  #required", {
        shortOpt: null,
        longOpt: '--code',
        desc: "",
        tags: {
          flag: true,
          required: true
        },
        metavars: []
      });
      return o("-c, --code  #required", {
        shortOpt: '-c',
        longOpt: '--code',
        desc: "",
        tags: {
          flag: true,
          required: true
        },
        metavars: []
      });
    });
    describe("tag with value", function() {
      return o("-c, --code  Produce some codez #foo(bar)", {
        desc: "Produce some codez",
        tags: {
          flag: true,
          foo: 'bar'
        },
        metavars: []
      });
    });
    describe("default value inside description", function() {
      return o("--widgets COUNT  Produce some codez (default is 10)", {
        desc: "Produce some codez (default is 10)",
        defaultValue: "10",
        tags: {}
      });
    });
    describe("default value inside description, but too fancy", function() {
      return o("--widgets COUNT  Produce some codez (default is 5 multiplied by 2)", {
        desc: "Produce some codez (default is 5 multiplied by 2)",
        defaultValue: void 0,
        tags: {
          fancydefault: true
        }
      });
    });
    describe("default value as a tag", function() {
      return o("--widgets COUNT  Produce some codez #default(10)", {
        desc: "Produce some codez",
        defaultValue: "10",
        tags: {
          "default": '10'
        }
      });
    });
    describe("positional argument", function() {
      return o("srcfile  Source file", {
        shortOpt: null,
        longOpt: null,
        desc: "Source file",
        tags: {},
        metavars: ['srcfile']
      });
    });
    return describe("flag option", function() {
      o("--[no-]code", {
        shortOpt: null,
        longOpt: '--code',
        desc: "",
        tags: {
          flag: true,
          acceptsno: true
        },
        metavars: []
      });
      return o("-c, --[no-]code", {
        shortOpt: '-c',
        longOpt: '--code',
        desc: "",
        tags: {
          flag: true,
          acceptsno: true
        },
        metavars: []
      });
    });
  });

}).call(this);
