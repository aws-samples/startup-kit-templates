'use strict';

const { EOL } = require('os');
const { promisify } = require('util');
const read = promisify(require('read'));

async function prompt(message, options) {
    let value;

    // Read input
    // Manage timeout
    try {
        value = await read({
            prompt: message,
            silent: options.silent,
            replace: options.replace,
            input: options.input,
            output: options.output,
            timeout: options.timeout,
        });
    } catch (err) {
        if (err.message !== 'timed out' || options.default === undefined || !options.useDefaultOnTimeout) {
            throw Object.assign(new Error(err.message), { code: 'TIMEDOUT' });
        }
        value = options.default;
    }

    // Trim?
    if (options.trim) {
        value = value.trim();
    }

    // Prompt again if there's no data or use the default value
    if (!value) {
        if (options.default === undefined) {
            return prompt(message, options);
        }

        value = options.default;
    }

    // Validator verification
    try {
        for (const i in options.validator) {
            value = await options.validator[i](value);
        }
    } catch (err) {
        // Retry automatically if the retry option is enabled
        if (options.retry) {
            err.message && options.output.write(err.message + EOL);

            return prompt(message, options);
        }

        throw err;
    }

    return value;
}

module.exports = prompt;
