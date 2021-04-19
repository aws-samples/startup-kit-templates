# promptly

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Coverage Status][codecov-image]][codecov-url] [![Dependency status][david-dm-image]][david-dm-url] [![Dev Dependency status][david-dm-dev-image]][david-dm-dev-url]

[npm-url]:https://npmjs.org/package/promptly
[downloads-image]:https://img.shields.io/npm/dm/promptly.svg
[npm-image]:https://img.shields.io/npm/v/promptly.svg
[travis-url]:https://travis-ci.org/moxystudio/node-promptly
[travis-image]:https://img.shields.io/travis/moxystudio/node-promptly/master.svg
[codecov-url]:https://codecov.io/gh/moxystudio/node-promptly
[codecov-image]:https://img.shields.io/codecov/c/github/moxystudio/node-promptly/master.svg
[david-dm-url]:https://david-dm.org/moxystudio/node-promptly
[david-dm-image]:https://img.shields.io/david/moxystudio/node-promptly.svg
[david-dm-dev-url]:https://david-dm.org/moxystudio/node-promptly?type=dev
[david-dm-dev-image]:https://img.shields.io/david/dev/moxystudio/node-promptly.svg

> Simple command line prompting utility.


## Installation

`$ npm install promptly`


## API

### .prompt(message, [options])

Prompts for a value, printing the `message` and waiting for the input.   
Returns a promise that resolves with the input.

Available options:

| Name   | Description   | Type     | Default |
| ------ | ------------- | -------- | ------- |
| default | The default value to use if the user provided an empty input | string | undefined |
| trim | Trims the user input | boolean | true |
| validator | A validator or an array of validators | function/array | undefined |
| retry | Retry if any of the validators fail | boolean | true |
| silent | Do not print what the user types | boolean | false |
| replace | Replace each character with the specified string when `silent` is true | string | '' |
| input | Input stream to read from | [Stream](https://nodejs.org/api/process.html#process_process_stdin) | process.stdin |
| output | Output stream to write to | [Stream](https://nodejs.org/api/process.html#process_process_stdout) | process.stdout |
| timeout | Timeout in ms | number | 0 |
| useDefaultOnTimeout | Return default value if timed out | boolean | false |

The same **options** are available to **all functions** but with different default values.

#### Examples

- Ask for a name:

    ```js
    const promptly = require('promptly');

    (async () => {
        const name = await promptly.prompt('Name: ');
        console.log(name);
    })();
    ```

- Ask for a name with a constraint (non-empty value and length > 2):

    ```js
    const promptly = require('promptly');

    const validator = function (value) {
        if (value.length < 2) {
            throw new Error('Min length of 2');
        }

        return value;
    };

    (async () => {
        const name = await promptly.prompt('Name: ', { validator });
        // Since retry is true by default, promptly will keep asking for a name until it is valid
        // Between each prompt, the error message from the validator will be printed
        console.log('Name is:', name);
    })();
    
    ```

- Same as above but do not retry automatically:

    ```js
    const promptly = require('promptly');

    const validator = function (value) {
        if (value.length < 2) {
            throw new Error('Min length of 2');
        }

        return value;
    };

    (async () => {
        try {
            const name = await promptly.prompt('Name: ', { validator, retry: false });
            console.log('Name is:', name);
        } catch (err) {
            console.error('Invalid name:')
            console.error(`- ${err.message}`);
        }
    })();
    ```

- Ask for a name with timeout:

    ```js
    const promptly = require('promptly');

    (async () => {
        const name = await promptly.prompt('Name: ', { timeout: 3000 });
        console.log(name);
    })();
    ```

    It throws an `Error("timed out")` if timeout is reached and no default value is provided

#### Validators

The validators have two purposes: to check and transform input. They can be asynchronous or synchronous

```js
const validator = (value) => {
    // Validation example, throwing an error when invalid
    if (value.length !== 2) {
        throw new Error('Length must be 2');
    }

    // Parse the value, modifying it
    return value.replace('aa', 'bb');
}

const asyncValidator = async (value) => {
    await myfunc();
    return value;
}
```

### .confirm(message, [options])

Ask the user for confirmation, printing the `message` and waiting for the input.   
Returns a promise that resolves with the answer.

Truthy values are: `y`, `yes` and `1`. Falsy values are `n`, `no`, and `0`.   
Comparison is made in a case insensitive way.

The options are the same as [prompt](#promptmessage-options), except that `trim` defaults to `false`.

#### Examples

- Ask to confirm something important:

    ```js
    const promptly = require('promptly');

    (async () => {
        const answer = await promptly.confirm('Are you really sure? ');

        console.log('Answer:', answer);
    })();
    ```

### .choose(message, choices, [options])

Ask the user to choose between multiple `choices` (array of choices), printing the `message` and waiting for the input.   
Returns a promise that resolves with the choice.

The options are the same as [prompt](#promptmessage-options), except that `trim` defaults to `false`.

#### Examples

- Ask to choose between:

    ```js
    const promptly = require('promptly');

    (async () => {
        const choice = await promptly.choose('Do you want an apple or an orange? ', ['apple', 'orange']);

        console.log('Choice:', choice);
    })();
    ```

### .password(message, [options])

Prompts for a password, printing the `message` and waiting for the input.   
Returns a promise that resolves with the password.

The options are the same as [prompt](#promptmessage-options), except that `trim` and `silent` default to `false` and `default` is an empty string (to allow empty passwords).

#### Examples

- Ask for a password:

    ```js
    const promptly = require('promptly');

    (async () => {
        const password = await promptly.password('Type a password: ');

        console.log('Password:', password);
    })();
    ```

- Ask for a password but mask the input with `*`:

    ```js
    const promptly = require('promptly');

    (async () => {
        const password = await promptly.password('Type a password: ', { replace: '*' });

        console.log('Password:', password);
    })();
    ```

## Tests

`$ npm test`   
`$ npm test -- --watch` during development


## License

Released under the [MIT License](https://www.opensource.org/licenses/mit-license.php).
