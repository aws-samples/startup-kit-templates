import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as StartupCheck from '../lib/startup-check-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new StartupCheck.StartupCheckStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
