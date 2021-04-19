import { Logger } from './shell';
interface BuildOptions {
    readonly directory: string;
    /**
     * Tag the image with a given repoName:tag combination
     */
    readonly tag: string;
    readonly target?: string;
    readonly file?: string;
    readonly buildArgs?: Record<string, string>;
}
export declare class Docker {
    private readonly logger?;
    constructor(logger?: Logger | undefined);
    /**
     * Whether an image with the given tag exists
     */
    exists(tag: string): Promise<boolean>;
    build(options: BuildOptions): Promise<void>;
    /**
     * Get credentials from ECR and run docker login
     */
    login(ecr: AWS.ECR): Promise<void>;
    tag(sourceTag: string, targetTag: string): Promise<void>;
    push(tag: string): Promise<void>;
    private execute;
}
export {};
