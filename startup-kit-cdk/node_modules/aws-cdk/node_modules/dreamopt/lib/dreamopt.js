(function() {
  var ARGUMENT, COMMAND, Command, DUMMY, DefaultHandlers, HEADER, OPTION, OPTION_BOOL, OPTION_DESC, OPTION_DESC_DEFAULT, OPTION_DESC_TAG, OPTION_LONG, OPTION_METAVARS, OPTION_SHORT, Option, Syntax, TEXT, USAGE, alignment, formatUsageString, handleUsage, indent, parse, printUsage, separator, width, wordwrap, wrapText,
    __slice = Array.prototype.slice;

  wordwrap = require('wordwrap');

  USAGE = /^Usage:/;

  HEADER = /^[^-].*:$/;

  OPTION = /^\s+-/;

  COMMAND = /^\s+(\w+)(?:\s{2,}(\S.*))$/;

  ARGUMENT = /^\s+.*\s\s|^\s+\S+$/;

  TEXT = /^\S/;

  OPTION_DESC = /^(.*?)\s{2,}(.*)$/;

  OPTION_METAVARS = /^([^\s,]+(?:,\s*\S+)?)\s+([^,].*)$/;

  OPTION_SHORT = /^(-\S)(?:,\s*(.*))?$/;

  OPTION_LONG = /^(--\S+)$/;

  OPTION_BOOL = /^--\[no-\](.*)$/;

  OPTION_DESC_TAG = /^(.*)\#(\w+)(?:\(([^()]*)\))?\s*$/;

  DUMMY = /\#/;

  OPTION_DESC_DEFAULT = /\((?:default:|default\s+is|defaults\s+to)\s+([^()]+)\)/i;

  DefaultHandlers = {
    auto: function(value) {
      if (typeof value !== 'string') return value;
      if (!isNaN(Number(value))) return Number(value);
      return value;
    },
    string: function(value) {
      return value;
    },
    int: function(value) {
      if (typeof value !== 'string') return value;
      if (isNaN(parseInt(value, 10))) {
        throw new Error("Integer value required: " + value);
      }
      return parseInt(value, 10);
    },
    flag: function(value, options, optionName, tagValue) {
      var _ref, _ref2;
      if (!(value != null)) return true;
      if (typeof value !== 'string') return value;
      if ((_ref = value.toLowerCase()) === '0' || _ref === 'false' || _ref === 'no' || _ref === 'off') {
        return false;
      }
      if ((_ref2 = value.toLowerCase()) === '' || _ref2 === '1' || _ref2 === 'true' || _ref2 === 'yes' || _ref2 === 'on') {
        return true;
      }
      throw new Error("Invalid flag value " + (JSON.stringify(value)) + " for option " + optionName);
    }
  };

  alignment = 24;

  indent = "  ";

  separator = "  ";

  width = 100;

  wrapText = require('wordwrap')(width);

  formatUsageString = function(left, right) {
    var actualAlignment, descriptionWidth, firstLine, otherLines, overhead, padding, wrappedLineIndent, _ref;
    overhead = indent.length + separator.length;
    if (left.length < alignment - overhead) {
      padding = new Array(alignment - overhead - left.length + 1).join(' ');
    } else {
      padding = '';
    }
    actualAlignment = overhead + left.length + padding.length;
    descriptionWidth = width - actualAlignment;
    wrappedLineIndent = new Array(actualAlignment + 1).join(' ');
    _ref = wordwrap(descriptionWidth)(right).trim().split('\n'), firstLine = _ref[0], otherLines = 2 <= _ref.length ? __slice.call(_ref, 1) : [];
    right = [firstLine].concat(otherLines.map(function(line) {
      return wrappedLineIndent + line;
    })).join("\n");
    if (otherLines.length) right += "\n";
    return "  " + left + padding + "  " + right;
  };

  Option = (function() {

    function Option(shortOpt, longOpt, desc, tagPairs, metavars, defaultValue) {
      var $, tag, value, _i, _len, _ref;
      this.shortOpt = shortOpt;
      this.longOpt = longOpt;
      this.desc = desc;
      this.metavars = metavars;
      this.defaultValue = defaultValue;
      if (this.longOpt || this.shortOpt) {
        this.name = this.longOpt && this.longOpt.slice(2) || this.shortOpt.slice(1);
      } else if (this.metavars.length) {
        this.name = this.metavars[0];
        if ($ = this.name.match(/^\[(.*)\]$/)) this.name = $[1];
      }
      this["var"] = this.name;
      this.tags = {};
      this.tagsOrder = [];
      for (_i = 0, _len = tagPairs.length; _i < _len; _i++) {
        _ref = tagPairs[_i], tag = _ref[0], value = _ref[1];
        this.tags[tag] = value;
        this.tagsOrder.push(tag);
        switch (tag) {
          case 'default':
            this.defaultValue = value;
            break;
          case 'var':
            this["var"] = value;
        }
      }
      this.func = null;
    }

    Option.prototype.leftUsageComponent = function() {
      var longOpt, string;
      longOpt = this.longOpt;
      if (longOpt && this.tags.acceptsno) longOpt = "--[no-]" + longOpt.slice(2);
      string = (function() {
        switch (false) {
          case !(this.shortOpt && longOpt):
            return "" + this.shortOpt + ", " + longOpt;
          case !this.shortOpt:
            return this.shortOpt;
          case !this.longOpt:
            return "    " + longOpt;
          default:
            return '';
        }
      }).call(this);
      if (this.metavars) {
        string = string + (string && ' ' || '') + this.metavars.join(' ');
      }
      return string;
    };

    Option.prototype.toUsageString = function() {
      return formatUsageString(this.leftUsageComponent(), this.desc);
    };

    Option.prototype.coerce = function(value, options, syntax) {
      var any, handler, newValue, tag, _i, _len, _ref;
      any = false;
      _ref = this.tagsOrder;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        tag = _ref[_i];
        if (handler = syntax.handlers[tag] || DefaultHandlers[tag]) {
          newValue = handler(value, options, this.leftUsageComponent(), this.tags[tag]);
          if (typeof newValue !== void 0) value = newValue;
          any = true;
        }
      }
      if (!any) {
        value = DefaultHandlers.auto(value, options, syntax, this.leftUsageComponent());
      }
      return value;
    };

    return Option;

  })();

  Command = (function() {

    function Command(name, desc, syntax) {
      this.name = name;
      this.desc = desc;
      this.syntax = syntax;
      this.func = null;
    }

    Command.prototype.leftUsageComponent = function() {
      return this.name;
    };

    Command.prototype.toUsageString = function() {
      return formatUsageString(this.leftUsageComponent(), this.desc);
    };

    return Command;

  })();

  Syntax = (function() {

    function Syntax(handlers, specs) {
      this.handlers = handlers;
      if (specs == null) specs = [];
      this.usage = [];
      this.options = [];
      this.arguments = [];
      this.commands = {};
      this.commandsOrder = [];
      this.shortOptions = {};
      this.longOptions = {};
      this.usageFound = false;
      this.headerAdded = false;
      this.implicitHeaders = {
        options: "Options:",
        arguments: "Arguments:",
        commands: "Commands:"
      };
      this.lastSectionType = 'none';
      this.customHeaderAdded = false;
      if (specs) this.add(specs);
    }

    Syntax.prototype.addHeader = function(header) {
      this.usage.push("\n" + header);
      return this.lastSectionType = 'any';
    };

    Syntax.prototype.ensureHeaderExists = function(sectionType) {
      if (this.lastSectionType === 'any') {
        return this.lastSectionType = sectionType;
      } else if (this.lastSectionType !== sectionType) {
        this.addHeader(this.implicitHeaders[sectionType]);
        return this.lastSectionType = sectionType;
      }
    };

    Syntax.prototype.add = function(specs) {
      var $, command, desc, gotArray, gotFunction, name, option, spec, subsyntax;
      if (typeof specs !== 'object') specs = [specs];
      specs = specs.slice(0);
      gotArray = function() {
        return (typeof specs[0] === 'object') && (specs[0] instanceof Array);
      };
      gotFunction = function() {
        return typeof specs[0] === 'function';
      };
      while (spec = specs.shift()) {
        if (typeof spec !== 'string') {
          throw new Error("Expected string spec, found " + (typeof spec));
        }
        if (spec.match(HEADER)) {
          this.addHeader(spec);
        } else if (spec.match(USAGE)) {
          this.usage.unshift("" + spec);
          this.usageFound = true;
        } else if (spec.match(OPTION)) {
          this.options.push((option = Option.parse(spec.trim())));
          if (option.shortOpt) {
            this.shortOptions[option.shortOpt.slice(1)] = option;
          }
          if (option.longOpt) this.longOptions[option.longOpt.slice(2)] = option;
          if (gotFunction()) option.func = specs.shift();
          this.ensureHeaderExists('options');
          this.usage.push(option.toUsageString());
        } else if (!gotArray() && spec.match(ARGUMENT)) {
          this.arguments.push((option = Option.parse(spec.trim())));
          if (gotFunction()) option.func = specs.shift();
          this.ensureHeaderExists('arguments');
          this.usage.push(option.toUsageString());
        } else if ($ = spec.match(COMMAND)) {
          name = $[0], desc = $[1];
          if (!gotArray()) {
            throw new Error("Array must follow a command spec: " + (JSON.stringify(spec)));
          }
          subsyntax = new Syntax(this.handlers, specs.shift());
          this.commands[name] = command = new Command(name, desc, subsyntax);
          this.commandsOrder.push(name);
          this.ensureHeaderExists('commands');
          this.usage.push(command.toUsageString());
        } else if (spec.match(TEXT)) {
          this.usage.push("\n" + wrapText(spec.trim()));
        } else {
          throw new Error("String spec invalid: " + (JSON.stringify(spec)));
        }
      }
      return this;
    };

    Syntax.prototype.toUsageString = function() {
      var line;
      return ((function() {
        var _i, _len, _ref, _results;
        _ref = this.usage;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          line = _ref[_i];
          _results.push(line + "\n");
        }
        return _results;
      }).call(this)).join('');
    };

    Syntax.prototype.parse = function(argv) {
      var $, arg, assignValue, executeHook, func, funcs, index, name, option, positional, processOption, remainder, result, subarg, value, _, _i, _j, _len, _len2, _len3, _len4, _ref, _ref2, _ref3,
        _this = this;
      argv = argv.slice(0);
      result = {};
      positional = [];
      funcs = [];
      executeHook = function(option, value) {
        var newValue;
        if (option.func) {
          if (option.tags.delayfunc) {
            funcs.push([option.func, option, value]);
          } else {
            newValue = option.func(value, result, _this, option);
            if (newValue != null) value = newValue;
          }
        }
        return value;
      };
      processOption = function(result, arg, option, value) {
        var index, metavar, subvalue, _len, _ref;
        switch (option.metavars.length) {
          case 0:
            value = true;
            break;
          case 1:
            if (value == null) value = argv.shift();
            if (typeof value === 'undefined') {
              throw new Error("Option " + arg + " requires an argument: " + (option.leftUsageComponent()));
            }
            break;
          default:
            value = [];
            _ref = option.metavars;
            for (index = 0, _len = _ref.length; index < _len; index++) {
              metavar = _ref[index];
              value.push((subvalue = argv.shift()));
              if (typeof subvalue === 'undefined') {
                throw new Error("Option " + arg + " requires " + option.metavars.length + " arguments: " + (option.leftUsageComponent()));
              }
            }
        }
        return option.coerce(value, result, _this);
      };
      assignValue = function(result, option, value) {
        if (option.tags.list) {
          if (!result.hasOwnProperty(option["var"])) result[option["var"]] = [];
          if (value != null) return result[option["var"]].push(value);
        } else {
          return result[option["var"]] = value;
        }
      };
      while (arg = argv.shift()) {
        if (arg === '--') {
          while (arg = argv.shift()) {
            positional.push(arg);
          }
        } else if (arg === '-') {
          positional.push(arg);
        } else if (arg.match(/^--no-/) && (option = this.longOptions[arg.slice(5)]) && option.tags.flag) {
          assignValue(result, option, false);
        } else if ($ = arg.match(/^--([^=]+)(?:=(.*))?$/)) {
          _ = $[0], name = $[1], value = $[2];
          if (option = this.longOptions[name]) {
            value = processOption(result, arg, option, value);
            value = executeHook(option, value);
            assignValue(result, option, value);
          } else {
            throw new Error("Unknown long option: " + arg);
          }
        } else if (arg.match(/^-/)) {
          remainder = arg.slice(1);
          while (remainder) {
            subarg = remainder[0];
            remainder = remainder.slice(1);
            if (option = this.shortOptions[subarg]) {
              if (remainder && option.metavars.length > 0) {
                value = remainder;
                remainder = '';
              } else {
                value = void 0;
              }
              value = processOption(result, arg, option, value);
              value = executeHook(option, value);
              assignValue(result, option, value);
            } else {
              if (arg === ("-" + subarg)) {
                throw new Error("Unknown short option " + arg);
              } else {
                throw new Error("Unknown short option -" + subarg + " in " + arg);
              }
            }
          }
        } else {
          positional.push(arg);
        }
      }
      _ref = this.options;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        option = _ref[_i];
        if (!result.hasOwnProperty(option["var"])) {
          if (option.tags.required) {
            throw new Error("Missing required option: " + (option.leftUsageComponent()));
          }
          if ((option.defaultValue != null) || option.tags.fancydefault || option.tags.list) {
            if (option.defaultValue != null) {
              value = option.coerce(option.defaultValue, result, this);
            } else {
              value = null;
            }
            value = executeHook(option, value);
            assignValue(result, option, value);
          }
        }
      }
      for (index = 0, _len2 = positional.length; index < _len2; index++) {
        arg = positional[index];
        if (option = this.arguments[index]) {
          value = option.coerce(arg, result, this);
          value = executeHook(option, value);
          positional[index] = value;
          if (option["var"]) assignValue(result, option, value);
        }
      }
      _ref2 = this.arguments;
      for (index = 0, _len3 = _ref2.length; index < _len3; index++) {
        option = _ref2[index];
        if (index >= positional.length) {
          if (option.tags.required) {
            throw new Error("Missing required argument \#" + (index + 1) + ": " + (option.leftUsageComponent()));
          }
          if ((option.defaultValue != null) || option.tags.fancydefault) {
            if (option.defaultValue != null) {
              value = option.coerce(option.defaultValue, result, this);
            } else {
              value = null;
            }
            value = executeHook(option, value);
            if (option["var"]) assignValue(result, option, value);
            if (index === positional.length) {
              positional.push(value);
            } else if (!option["var"] && !option.func) {
              throw new Error("Cannot apply default value to argument \#" + (index + 1) + " (" + (option.leftUsageComponent()) + ") because no #var is specified, no func is provided and previous arguments don't have default values");
            }
          }
        }
      }
      result.argv = positional;
      for (_j = 0, _len4 = funcs.length; _j < _len4; _j++) {
        _ref3 = funcs[_j], func = _ref3[0], option = _ref3[1], value = _ref3[2];
        func(value, result, this, option);
      }
      return result;
    };

    return Syntax;

  })();

  Option.parse = function(spec) {
    var $, defaultValue, desc, isOption, longOpt, metavars, options, shortOpt, tag, tags, value, _, _ref, _ref2, _ref3, _ref4, _ref5;
    isOption = (' ' + spec).match(OPTION);
    _ref = spec.match(OPTION_DESC) || [void 0, spec, ""], _ = _ref[0], options = _ref[1], desc = _ref[2];
    if (isOption) {
      _ref2 = options.match(OPTION_METAVARS) || [void 0, options, ""], _ = _ref2[0], options = _ref2[1], metavars = _ref2[2];
      _ref3 = options.match(OPTION_SHORT) || [void 0, "", options], _ = _ref3[0], shortOpt = _ref3[1], options = _ref3[2];
      _ref4 = (options || '').match(OPTION_LONG) || [void 0, "", options], _ = _ref4[0], longOpt = _ref4[1], options = _ref4[2];
    } else {
      _ref5 = [options, ""], metavars = _ref5[0], options = _ref5[1];
    }
    metavars = metavars && metavars.split(/\s+/) || [];
    tags = ((function() {
      var _results;
      _results = [];
      while ($ = desc.match(OPTION_DESC_TAG)) {
        _results.push(((_ = $[0], desc = $[1], tag = $[2], value = $[3], $), [tag, value != null ? value : true]));
      }
      return _results;
    })());
    tags.reverse();
    if (longOpt && longOpt.match(OPTION_BOOL)) {
      tags.push(['acceptsno', true]);
      longOpt = longOpt.replace('--[no-]', '--');
    }
    if (isOption && metavars.length === 0) tags.push(['flag', true]);
    if ($ = desc.match(OPTION_DESC_DEFAULT)) {
      defaultValue = $[1];
      if (defaultValue.match(/\s/)) {
        defaultValue = void 0;
        tags.push(['fancydefault', true]);
      }
    }
    if (options) {
      throw new Error("Invalid option spec format (cannot parse " + (JSON.stringify(options)) + "): " + (JSON.stringify(spec)));
    }
    if (isOption && !(shortOpt || longOpt)) {
      throw new Error("Invalid option spec format !(shortOpt || longOpt): " + (JSON.stringify(spec)));
    }
    return new Option(shortOpt || null, longOpt || null, desc.trim(), tags, metavars, defaultValue);
  };

  printUsage = function(usage) {
    console.error(usage);
    return process.exit(1);
  };

  handleUsage = function(printUsage, value, options, syntax) {
    return printUsage(syntax.toUsageString());
  };

  parse = function(specs, handlers, argv) {
    var syntax;
    if (!(argv != null) && (handlers instanceof Array)) {
      argv = handlers;
      handlers = {};
    }
    if (handlers == null) handlers = {};
    if (argv == null) argv = process.argv.slice(2);
    syntax = new Syntax(handlers, specs);
    if (!syntax.longOptions.help) {
      syntax.add([
        "  -h, --help  Display this usage information", function(v, o, s) {
          var _ref;
          return handleUsage((_ref = handlers.printUsage) != null ? _ref : printUsage, v, o, s);
        }
      ]);
    }
    return syntax.parse(argv);
  };

  module.exports = parse;

  module.exports.parseOptionSpec = Option.parse;

  module.exports.Syntax = Syntax;

}).call(this);
