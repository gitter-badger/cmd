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

function command () {

  let parts = asArray(arguments);

  return function (options) {

    options = options || {};

    return function (data, flags/*, globalOptions */) {

      let concatType = R.concat(R.of({type: 'command'}));
      let concatOptions = R.concat(R.of({options: options}));

      let composeParts = R.pipe(
        R.reduce((acc, part) => {

          if (part.multiple) {
            acc[part.type] = (acc[part.type] || []).concat(part.value);
          }
          else {
            acc[part.type] = value;
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
        if (results.aliases.indexOf(data[0]) > -1) {
          return results;
        }
      }
      else {
        return results;
      }
    };
  };
}

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
          return ctx(data, flags);
        }
        else {
          return {
            type: 'anonymous',
            runners: R.prop('value')(ctx)
          };
        }
      })
    )

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

    var runFlags = function () {}

    runFlags(parsedCtx);
    runCommands(parsedCtx);

    // TODO: run flags first
  };
}




let someCommand = command(
  name('some', 'command'),
  use(function () {

    console.log('in command');
  })
);

let anotherCommand = command(
  name('another'),
  use(function () {

    console.log('another command');
  })
)

let run = cli(
  someCommand({option: 'here'}),
  anotherCommand(),
  use(function () {

    console.log('always runs');
  })
);

run(process.argv.slice(2));

