(function() {
  var assert, dreamopt, o, oo, ooo,
    __hasProp = Object.prototype.hasOwnProperty;

  assert = require('assert');

  dreamopt = require('../lib/dreamopt');

  o = function(syntax, argv, expected) {
    expected.argv || (expected.argv = []);
    return describe("when given " + (JSON.stringify(argv)), function() {
      var k, v, _actual, _fn;
      _actual = null;
      before(function() {
        return _actual = dreamopt(syntax, argv);
      });
      _fn = function(k, v) {
        return it("value of " + k + " should be " + (JSON.stringify(v)), function() {
          return assert.deepEqual(_actual[k], v, "" + k + " is " + (JSON.stringify(_actual[k])) + ", expected " + (JSON.stringify(v)) + ", actual = " + (JSON.stringify(_actual)));
        });
      };
      for (k in expected) {
        if (!__hasProp.call(expected, k)) continue;
        v = expected[k];
        _fn(k, v);
      }
      return it("should not return any other option keys", function() {
        var k, keys, v;
        keys = {};
        for (k in _actual) {
          if (!__hasProp.call(_actual, k)) continue;
          v = _actual[k];
          keys[k] = true;
        }
        for (k in expected) {
          if (!__hasProp.call(expected, k)) continue;
          v = expected[k];
          delete keys[k];
        }
        return assert.deepEqual(keys, [], "Extra keys found in expected: " + (Object.keys(keys).join(', ')) + ", actual = " + (JSON.stringify(_actual)) + ", expected = " + (JSON.stringify(expected)));
      });
    });
  };

  oo = function(syntax, argv, errorRegexp) {
    return describe("when given " + (JSON.stringify(argv)), function() {
      var _actual, _err;
      _actual = null;
      _err = null;
      before(function() {
        try {
          return _actual = dreamopt(syntax, argv);
        } catch (e) {
          return _err = e;
        }
      });
      return it("should throw an error matching " + errorRegexp, function() {
        assert.ok(!!_err, "Expected error matching " + errorRegexp + ", no error thrown, actual = " + (JSON.stringify(_actual)));
        return assert.ok(_err.message.match(errorRegexp), "Expected error matching " + errorRegexp + ", got error " + _err.message);
      });
    });
  };

  ooo = function(syntax, expectedUsage) {
    return it("should display correct usage info", function() {
      var captureUsage, _usage;
      _usage = null;
      captureUsage = function(usage) {
        return _usage = usage;
      };
      dreamopt(syntax, {
        printUsage: captureUsage
      }, ['--help']);
      return assert.equal(_usage.trim(), expectedUsage.trim(), "Usage mismatch, actual:\n" + (_usage.trim()) + "\n\nExpected:\n" + (expectedUsage.trim()) + "\n");
    });
  };

  describe('dreamopt', function() {
    describe("with a syntax as simple as -a/--AAA, -b/--BBB COUNT, -c/--ccc", function() {
      var syntax;
      syntax = ["  -a, --AAA  Simple option", "  -b, --BBB COUNT  Option with value", "  -c, --[no-]ccc  Flag option"];
      o(syntax, [''], {});
      o(syntax, ['-a'], {
        AAA: true
      });
      o(syntax, ['-b', '10'], {
        BBB: 10
      });
      o(syntax, ['-b10'], {
        BBB: 10
      });
      o(syntax, ['-ac'], {
        AAA: true,
        ccc: true
      });
      o(syntax, ['-ab', '10'], {
        AAA: true,
        BBB: 10
      });
      o(syntax, ['-ab10'], {
        AAA: true,
        BBB: 10
      });
      oo(syntax, ['-z'], /Unknown short option/);
      oo(syntax, ['-azc'], /Unknown short option/);
      oo(syntax, ['-b'], /requires an argument/);
      oo(syntax, ['-ab'], /requires an argument/);
      oo(syntax, ['-a', '-b'], /requires an argument/);
      o(syntax, ['--AAA'], {
        AAA: true
      });
      o(syntax, ['--no-AAA'], {
        AAA: false
      });
      o(syntax, ['--ccc'], {
        ccc: true
      });
      o(syntax, ['--no-ccc'], {
        ccc: false
      });
      o(syntax, ['--BBB', '10'], {
        BBB: 10
      });
      o(syntax, ['--BBB=10'], {
        BBB: 10
      });
      oo(syntax, ['--zzz'], /Unknown long option/);
      oo(syntax, ['--BBB'], /requires an argument/);
      return ooo(syntax, "Options:\n  -a, --AAA             Simple option\n  -b, --BBB COUNT       Option with value\n  -c, --[no-]ccc        Flag option\n  -h, --help            Display this usage information");
    });
    describe("with a syntax that has two positional arguments and one option (-v/--verbose)", function() {
      var syntax;
      syntax = ["  -v, --verbose  Be verbose", "  first  First positional arg", "  second  Second positional arg"];
      o(syntax, [], {});
      o(syntax, ['-v'], {
        verbose: true
      });
      o(syntax, ['foo'], {
        argv: ['foo'],
        first: 'foo'
      });
      o(syntax, ['foo', 'bar'], {
        argv: ['foo', 'bar'],
        first: 'foo',
        second: 'bar'
      });
      o(syntax, ['-v', 'foo'], {
        argv: ['foo'],
        first: 'foo',
        verbose: true
      });
      o(syntax, ['foo', '-v'], {
        argv: ['foo'],
        first: 'foo',
        verbose: true
      });
      return o(syntax, ['-v', 'foo', 'bar'], {
        argv: ['foo', 'bar'],
        first: 'foo',
        second: 'bar',
        verbose: true
      });
    });
    describe("with a syntax that has two positional arguments, both of which have default values", function() {
      var syntax;
      syntax = ["  first  First positional arg (default: 10)", "  second  Second positional arg (default: 20)"];
      o(syntax, [], {
        argv: [10, 20],
        first: 10,
        second: 20
      });
      o(syntax, ['foo'], {
        argv: ['foo', 20],
        first: 'foo',
        second: 20
      });
      return o(syntax, ['foo', 'bar'], {
        argv: ['foo', 'bar'],
        first: 'foo',
        second: 'bar'
      });
    });
    describe("with a syntax that has two positional arguments, one of which is required", function() {
      var syntax;
      syntax = ["  first  First positional arg  #required", "  second  Second positional arg (default: 20)"];
      oo(syntax, [], /required/);
      o(syntax, ['foo'], {
        argv: ['foo', 20],
        first: 'foo',
        second: 20
      });
      return o(syntax, ['foo', 'bar'], {
        argv: ['foo', 'bar'],
        first: 'foo',
        second: 'bar'
      });
    });
    describe("with a syntax that has a required option", function() {
      var syntax;
      syntax = ["  --src FILE  Source file  #required", "  first  First positional arg"];
      oo(syntax, [], /required/);
      oo(syntax, ['foo'], /required/);
      oo(syntax, ['--src'], /requires an argument/);
      o(syntax, ['--src', 'xxx'], {
        src: 'xxx'
      });
      o(syntax, ['--src', 'xxx', 'zzz'], {
        src: 'xxx',
        first: 'zzz',
        argv: ['zzz']
      });
      return o(syntax, ['zzz', '--src', 'xxx'], {
        src: 'xxx',
        first: 'zzz',
        argv: ['zzz']
      });
    });
    return describe("with a syntax that has a list option", function() {
      var syntax;
      syntax = ["  --src FILE  Source file  #list"];
      o(syntax, [], {
        src: [],
        argv: []
      });
      o(syntax, ['--src', 'xxx'], {
        src: ['xxx'],
        argv: []
      });
      return o(syntax, ['--src', 'xxx', '--src', 'yyy'], {
        src: ['xxx', 'yyy'],
        argv: []
      });
    });
  });

  setTimeout((function() {}), 2000);

}).call(this);
