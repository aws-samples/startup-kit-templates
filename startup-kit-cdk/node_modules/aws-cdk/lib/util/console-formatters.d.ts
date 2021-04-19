/**
 * Returns a set of strings when printed on the console produces a banner msg. The message is in the following format -
 * ********************
 * *** msg line x   ***
 * *** msg line xyz ***
 * ********************
 *
 * Spec:
 * - The width of every line is equal, dictated by the longest message string
 * - The first and last lines are '*'s for the full length of the line
 * - Each line in between is prepended with '*** ' and appended with ' ***'
 * - The text is indented left, i.e. whitespace is right-padded when the length is shorter than the longest.
 *
 * @param msgs array of strings containing the message lines to be printed in the banner. Returns empty string if array
 * is empty.
 * @returns array of strings containing the message formatted as a banner
 */
export declare function formatAsBanner(msgs: string[]): string[];
