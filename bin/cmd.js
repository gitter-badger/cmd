#!/usr/bin/env node

'use strict';

let asArray = require('as-array');
let R = require('ramda');
let minimist = require('minimist');


function name () {

  return {
    type: 'aliases',
    value: asArray(arguments),
    multiple: true
  };
}

function use () {

  return {
    type: 'runners',
    value: asArray(arguments),
    multiple: true
  };
}

function createTrigger (type, comparator) {

  return function () {

    let parts = asArray(arguments);

    return function (options) {

      options = options || {};

      return function (data, flags, globalOptions) {

        globalOptions = globalOptions || {};

        let concatType = R.concat(R.of({type: type}));
        let concatOptions = R.concat(R.of({options: R.mergeAll([options, globalOptions])}));

        let composeParts = R.pipe(
          R.reduce((acc, part) => {

            if (part.multiple) {
              acc[part.type] = (acc[part.type] || []).concat(part.value);
            }
            else {
              acc[part.type] = part.value;
            }

            return acc;
          }, {}),
          asArray,
          concatOptions,
          concatType,
          R.mergeAll
        );

        let results = composeParts(parts);

        if (results.aliases) {
          if (comparator(results, data, flags)) {
            return results;
          }
        }
        else {
          return results;
        }
      };
    };
  };
}

var command = createTrigger('command', function (results, data) {

  return results.aliases.indexOf(data[0]) > -1;
});

var flag = createTrigger('flag', function (results, data, flags) {

  let matchesFlagAlias = R.pipe(
    R.prop('aliases'),
    R.map(R.replace(/^-+/, '')),
    R.intersection(R.keys(flags)),
    R.length,
    R.flip(R.gt)(0)
  );

  return matchesFlagAlias(results);
});

function cli () {

  let contexts = asArray(arguments);

  return function (input) {

    let parsedInput = minimist(input);
    let data = parsedInput._;
    let flags = R.omit(['_'], parsedInput);

    // Parse all
    let parseCommandCtx = R.compose(
      R.filter(R.identity),
      R.map(ctx => {

        if (typeof ctx === 'function') {
          return ctx(data, flags, {/* these are global options*/});
        }
        else {
          return {
            type: 'anonymous',
            runners: R.prop('value')(ctx)
          };
        }
      })
    );

    let parsedCtx = parseCommandCtx(contexts);

    // Run commands
    let isRunner = R.pipe(
      R.prop('type'),
      R.either(R.equals('command'), R.equals('anonymous'))
    );
    let runCommands = R.pipe(
      R.filter(isRunner),
      R.map(R.pick(['runners', 'options'])),
      R.forEach(r => {

        R.forEach(fn => fn(data, flags, r.options))(r.runners)
      })
    );

    // Run flags
    let isFlag = R.pipe(
      R.prop('type'),
      R.equals('flag')
    );
    let runFlags = R.pipe(
      R.filter(isFlag),
      R.map(R.pick(['runners', 'options'])),
      R.forEach(r => {

        R.forEach(fn => fn(data, flags, r.options))(r.runners)
      })
    );

    runFlags(parsedCtx);
    runCommands(parsedCtx);
  };
}




let anotherCommand = command(
  name('another', 'something'),
  use(function () {

    console.log('another command');
  })
);

let someFlag = flag(
  // default('some value'),
  name('-f', '--something'),
  use(function () {

    console.log('execute flag');
  })
);

let someCommand = command(
  name('some', 'command'),
  use(function () {

    console.log('in command');
    return function (done) {

      done();
    }
  })
);

let run = cli(
  someCommand({option: 'here'}),
  anotherCommand(),
  use(function () {

    console.log('always runs');
  }),
  someFlag()
);

run(process.argv.slice(2));

