export declare type InvokeHook = (targetDirectory: string) => Promise<void>;
/**
 * Initialize a CDK package in the current directory
 */
export declare function cliInit(type?: string, language?: string, canUseNetwork?: boolean, generateOnly?: boolean, workDir?: string): Promise<void>;
export declare class InitTemplate {
    private readonly basePath;
    readonly name: string;
    readonly languages: string[];
    static fromName(templatesDir: string, name: string): Promise<InitTemplate>;
    readonly description: string;
    readonly aliases: Set<string>;
    constructor(basePath: string, name: string, languages: string[], info: any);
    /**
     * @param name the name that is being checked
     * @returns ``true`` if ``name`` is the name of this template or an alias of it.
     */
    hasName(name: string): boolean;
    /**
     * Creates a new instance of this ``InitTemplate`` for a given language to a specified folder.
     *
     * @param language    the language to instantiate this template with
     * @param targetDirectory the directory where the template is to be instantiated into
     */
    install(language: string, targetDirectory: string): Promise<void>;
    private installFiles;
    /**
     * @summary   Invoke any javascript hooks that exist in the template.
     * @description Sometimes templates need more complex logic than just replacing tokens. A 'hook' is
     *        any file that ends in .hook.js. It should export a single function called "invoke"
     *        that accepts a single string parameter. When the template is installed, each hook
     *        will be invoked, passing the target directory as the only argument. Hooks are invoked
     *        in lexical order.
     */
    private invokeHooks;
    private installProcessed;
    private expand;
    /**
     * Adds context variables to `cdk.json` in the generated project directory to
     * enable future behavior for new projects.
     */
    private applyFutureFlags;
}
export declare function availableInitTemplates(): Promise<InitTemplate[]>;
export declare function availableInitLanguages(): Promise<string[]>;
export declare function printAvailableTemplates(language?: string): Promise<void>;
