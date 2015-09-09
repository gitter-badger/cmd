#!/usr/bin/env node

'use strict';

let asArray = require('as-array');
let R = require('ramda');
let minimist = require('minimist');

function name() {

  return {
    type: 'alias',
    value: asArray(arguments),
    multiple: true
  };
}

function use () {

  return {
    type: 'executer',
    value: asArray(arguments),
    multiple: true
  };
}

function options (input) {

  return {
    type: 'options',
    value: input
  };
}

function command () {

  let inputs = asArray(arguments);

  return options => {

    return (data, flags) => {

      let c = R.reduce((cmd, def) => {

        if (def.multiple) {
          cmd[def.type] = (cmd[def.type] || []).concat(def.value);
        }
        else {
          cmd[def.type] = def.value
        }

        return cmd;
      }, {}, inputs);

      c.runnable = c.alias.indexOf(data[0]) > -1;
      c.options = options;

      return c;
    }
  };
}

function cli () {

  let plugins = asArray(arguments);

  return argv => {

    let input = minimist(argv);
    let data = input._;
    let flags = R.omit(['_'])(input);

    let parseRunnables = R.pipe(
      R.map(cmd => cmd(data, flags)),
      R.filter(R.prop('runnable')),
      R.map(cmd => {

        return R.map(execute => {execute(data, flags, cmd.options)}, cmd.executer);
      })
    );

    parseRunnables(plugins);
  };
}




let someCommand = command(
  name('somecommand', 'anothername'),
  use((data, flags, options) => {

    console.log('ran callback', options);
  }),
  use(() => {

    console.log('second callback');
  })
);

let another = command(
  name('another'),
  use(() => {

    console.log('another!!');
  })
)

let run = cli(
  // options({ // these are global options
  //   global: 'options'
  // }),
  another(),
  someCommand({
    key: 'value'
  })
);

run(process.argv.slice(2));
