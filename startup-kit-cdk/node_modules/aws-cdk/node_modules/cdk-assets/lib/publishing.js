"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetPublishing = void 0;
const handlers_1 = require("./private/handlers");
const progress_1 = require("./progress");
class AssetPublishing {
    constructor(manifest, options) {
        this.manifest = manifest;
        this.options = options;
        /**
         * The message for the IPublishProgress interface
         */
        this.message = 'Starting';
        this.failures = new Array();
        this.completedOperations = 0;
        this.aborted = false;
        this.assets = manifest.entries;
        this.totalOperations = this.assets.length;
    }
    /**
     * Publish all assets from the manifest
     */
    async publish() {
        var _a;
        const self = this;
        for (const asset of this.assets) {
            if (this.aborted) {
                break;
            }
            this.currentAsset = asset;
            try {
                if (this.progressEvent(progress_1.EventType.START, `Publishing ${asset.id}`)) {
                    break;
                }
                const handler = handlers_1.makeAssetHandler(this.manifest, asset, {
                    aws: this.options.aws,
                    get aborted() { return self.aborted; },
                    emitMessage(t, m) { self.progressEvent(t, m); },
                });
                await handler.publish();
                if (this.aborted) {
                    throw new Error('Aborted');
                }
                this.completedOperations++;
                if (this.progressEvent(progress_1.EventType.SUCCESS, `Published ${asset.id}`)) {
                    break;
                }
            }
            catch (e) {
                this.failures.push({ asset, error: e });
                this.completedOperations++;
                if (this.progressEvent(progress_1.EventType.FAIL, e.message)) {
                    break;
                }
            }
        }
        if (((_a = this.options.throwOnError) !== null && _a !== void 0 ? _a : true) && this.failures.length > 0) {
            throw new Error(`Error publishing: ${this.failures.map(e => e.error.message)}`);
        }
    }
    get percentComplete() {
        if (this.totalOperations === 0) {
            return 100;
        }
        return Math.floor((this.completedOperations / this.totalOperations) * 100);
    }
    abort() {
        this.aborted = true;
    }
    get hasFailures() {
        return this.failures.length > 0;
    }
    /**
     * Publish a progress event to the listener, if present.
     *
     * Returns whether an abort is requested. Helper to get rid of repetitive code in publish().
     */
    progressEvent(event, message) {
        this.message = message;
        if (this.options.progressListener) {
            this.options.progressListener.onPublishEvent(event, this);
        }
        return this.aborted;
    }
}
exports.AssetPublishing = AssetPublishing;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHVibGlzaGluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInB1Ymxpc2hpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUEsaURBQXNEO0FBQ3RELHlDQUFtRjtBQXNDbkYsTUFBYSxlQUFlO0lBaUIxQixZQUE2QixRQUF1QixFQUFtQixPQUErQjtRQUF6RSxhQUFRLEdBQVIsUUFBUSxDQUFlO1FBQW1CLFlBQU8sR0FBUCxPQUFPLENBQXdCO1FBaEJ0Rzs7V0FFRztRQUNJLFlBQU8sR0FBVyxVQUFVLENBQUM7UUFNcEIsYUFBUSxHQUFHLElBQUksS0FBSyxFQUFlLENBQUM7UUFJNUMsd0JBQW1CLEdBQVcsQ0FBQyxDQUFDO1FBQ2hDLFlBQU8sR0FBRyxLQUFLLENBQUM7UUFHdEIsSUFBSSxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDO1FBQy9CLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDNUMsQ0FBQztJQUVEOztPQUVHO0lBQ0ksS0FBSyxDQUFDLE9BQU87O1FBQ2xCLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQztRQUVsQixLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDL0IsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO2dCQUFFLE1BQU07YUFBRTtZQUM1QixJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQztZQUUxQixJQUFJO2dCQUNGLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxvQkFBUyxDQUFDLEtBQUssRUFBRSxjQUFjLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFO29CQUFFLE1BQU07aUJBQUU7Z0JBRTdFLE1BQU0sT0FBTyxHQUFHLDJCQUFnQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsS0FBSyxFQUFFO29CQUNyRCxHQUFHLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHO29CQUNyQixJQUFJLE9BQU8sS0FBSyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUN0QyxXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7aUJBQ2hELENBQUMsQ0FBQztnQkFDSCxNQUFNLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFFeEIsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO29CQUNoQixNQUFNLElBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2lCQUM1QjtnQkFFRCxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztnQkFDM0IsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLG9CQUFTLENBQUMsT0FBTyxFQUFFLGFBQWEsS0FBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUU7b0JBQUUsTUFBTTtpQkFBRTthQUMvRTtZQUFDLE9BQU8sQ0FBQyxFQUFFO2dCQUNWLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUN4QyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztnQkFDM0IsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLG9CQUFTLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRTtvQkFBRSxNQUFNO2lCQUFFO2FBQzlEO1NBQ0Y7UUFFRCxJQUFJLE9BQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLG1DQUFJLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUNuRSxNQUFNLElBQUksS0FBSyxDQUFDLHFCQUFxQixJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1NBQ2pGO0lBQ0gsQ0FBQztJQUVELElBQVcsZUFBZTtRQUN4QixJQUFJLElBQUksQ0FBQyxlQUFlLEtBQUssQ0FBQyxFQUFFO1lBQUUsT0FBTyxHQUFHLENBQUM7U0FBRTtRQUMvQyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQzdFLENBQUM7SUFFTSxLQUFLO1FBQ1YsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7SUFDdEIsQ0FBQztJQUVELElBQVcsV0FBVztRQUNwQixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNLLGFBQWEsQ0FBQyxLQUFnQixFQUFFLE9BQWU7UUFDckQsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDdkIsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLGdCQUFnQixFQUFFO1lBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQUU7UUFDakcsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDO0lBQ3RCLENBQUM7Q0FDRjtBQW5GRCwwQ0FtRkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBc3NldE1hbmlmZXN0LCBJTWFuaWZlc3RFbnRyeSB9IGZyb20gJy4vYXNzZXQtbWFuaWZlc3QnO1xuaW1wb3J0IHsgSUF3cyB9IGZyb20gJy4vYXdzJztcbmltcG9ydCB7IG1ha2VBc3NldEhhbmRsZXIgfSBmcm9tICcuL3ByaXZhdGUvaGFuZGxlcnMnO1xuaW1wb3J0IHsgRXZlbnRUeXBlLCBJUHVibGlzaFByb2dyZXNzLCBJUHVibGlzaFByb2dyZXNzTGlzdGVuZXIgfSBmcm9tICcuL3Byb2dyZXNzJztcblxuZXhwb3J0IGludGVyZmFjZSBBc3NldFB1Ymxpc2hpbmdPcHRpb25zIHtcbiAgLyoqXG4gICAqIEVudHJ5IHBvaW50IGZvciBBV1MgY2xpZW50XG4gICAqL1xuICByZWFkb25seSBhd3M6IElBd3M7XG5cbiAgLyoqXG4gICAqIExpc3RlbmVyIGZvciBwcm9ncmVzcyBldmVudHNcbiAgICpcbiAgICogQGRlZmF1bHQgTm8gbGlzdGVuZXJcbiAgICovXG4gIHJlYWRvbmx5IHByb2dyZXNzTGlzdGVuZXI/OiBJUHVibGlzaFByb2dyZXNzTGlzdGVuZXI7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gdGhyb3cgYXQgdGhlIGVuZCBpZiB0aGVyZSB3ZXJlIGVycm9yc1xuICAgKlxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSB0aHJvd09uRXJyb3I/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIEEgZmFpbHVyZSB0byBwdWJsaXNoIGFuIGFzc2V0XG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRmFpbGVkQXNzZXQge1xuICAvKipcbiAgICogVGhlIGFzc2V0IHRoYXQgZmFpbGVkIHRvIHB1Ymxpc2hcbiAgICovXG4gIHJlYWRvbmx5IGFzc2V0OiBJTWFuaWZlc3RFbnRyeTtcblxuICAvKipcbiAgICogVGhlIGZhaWx1cmUgdGhhdCBvY2N1cnJlZFxuICAgKi9cbiAgcmVhZG9ubHkgZXJyb3I6IEVycm9yO1xufVxuXG5leHBvcnQgY2xhc3MgQXNzZXRQdWJsaXNoaW5nIGltcGxlbWVudHMgSVB1Ymxpc2hQcm9ncmVzcyB7XG4gIC8qKlxuICAgKiBUaGUgbWVzc2FnZSBmb3IgdGhlIElQdWJsaXNoUHJvZ3Jlc3MgaW50ZXJmYWNlXG4gICAqL1xuICBwdWJsaWMgbWVzc2FnZTogc3RyaW5nID0gJ1N0YXJ0aW5nJztcblxuICAvKipcbiAgICogVGhlIGN1cnJlbnQgYXNzZXQgZm9yIHRoZSBJUHVibGlzaFByb2dyZXNzIGludGVyZmFjZVxuICAgKi9cbiAgcHVibGljIGN1cnJlbnRBc3NldD86IElNYW5pZmVzdEVudHJ5O1xuICBwdWJsaWMgcmVhZG9ubHkgZmFpbHVyZXMgPSBuZXcgQXJyYXk8RmFpbGVkQXNzZXQ+KCk7XG4gIHByaXZhdGUgcmVhZG9ubHkgYXNzZXRzOiBJTWFuaWZlc3RFbnRyeVtdO1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgdG90YWxPcGVyYXRpb25zOiBudW1iZXI7XG4gIHByaXZhdGUgY29tcGxldGVkT3BlcmF0aW9uczogbnVtYmVyID0gMDtcbiAgcHJpdmF0ZSBhYm9ydGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBtYW5pZmVzdDogQXNzZXRNYW5pZmVzdCwgcHJpdmF0ZSByZWFkb25seSBvcHRpb25zOiBBc3NldFB1Ymxpc2hpbmdPcHRpb25zKSB7XG4gICAgdGhpcy5hc3NldHMgPSBtYW5pZmVzdC5lbnRyaWVzO1xuICAgIHRoaXMudG90YWxPcGVyYXRpb25zID0gdGhpcy5hc3NldHMubGVuZ3RoO1xuICB9XG5cbiAgLyoqXG4gICAqIFB1Ymxpc2ggYWxsIGFzc2V0cyBmcm9tIHRoZSBtYW5pZmVzdFxuICAgKi9cbiAgcHVibGljIGFzeW5jIHB1Ymxpc2goKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBmb3IgKGNvbnN0IGFzc2V0IG9mIHRoaXMuYXNzZXRzKSB7XG4gICAgICBpZiAodGhpcy5hYm9ydGVkKSB7IGJyZWFrOyB9XG4gICAgICB0aGlzLmN1cnJlbnRBc3NldCA9IGFzc2V0O1xuXG4gICAgICB0cnkge1xuICAgICAgICBpZiAodGhpcy5wcm9ncmVzc0V2ZW50KEV2ZW50VHlwZS5TVEFSVCwgYFB1Ymxpc2hpbmcgJHthc3NldC5pZH1gKSkgeyBicmVhazsgfVxuXG4gICAgICAgIGNvbnN0IGhhbmRsZXIgPSBtYWtlQXNzZXRIYW5kbGVyKHRoaXMubWFuaWZlc3QsIGFzc2V0LCB7XG4gICAgICAgICAgYXdzOiB0aGlzLm9wdGlvbnMuYXdzLFxuICAgICAgICAgIGdldCBhYm9ydGVkKCkgeyByZXR1cm4gc2VsZi5hYm9ydGVkOyB9LFxuICAgICAgICAgIGVtaXRNZXNzYWdlKHQsIG0pIHsgc2VsZi5wcm9ncmVzc0V2ZW50KHQsIG0pOyB9LFxuICAgICAgICB9KTtcbiAgICAgICAgYXdhaXQgaGFuZGxlci5wdWJsaXNoKCk7XG5cbiAgICAgICAgaWYgKHRoaXMuYWJvcnRlZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQWJvcnRlZCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb21wbGV0ZWRPcGVyYXRpb25zKys7XG4gICAgICAgIGlmICh0aGlzLnByb2dyZXNzRXZlbnQoRXZlbnRUeXBlLlNVQ0NFU1MsIGBQdWJsaXNoZWQgJHthc3NldC5pZH1gKSkgeyBicmVhazsgfVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB0aGlzLmZhaWx1cmVzLnB1c2goeyBhc3NldCwgZXJyb3I6IGUgfSk7XG4gICAgICAgIHRoaXMuY29tcGxldGVkT3BlcmF0aW9ucysrO1xuICAgICAgICBpZiAodGhpcy5wcm9ncmVzc0V2ZW50KEV2ZW50VHlwZS5GQUlMLCBlLm1lc3NhZ2UpKSB7IGJyZWFrOyB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCh0aGlzLm9wdGlvbnMudGhyb3dPbkVycm9yID8/IHRydWUpICYmIHRoaXMuZmFpbHVyZXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciBwdWJsaXNoaW5nOiAke3RoaXMuZmFpbHVyZXMubWFwKGUgPT4gZS5lcnJvci5tZXNzYWdlKX1gKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgZ2V0IHBlcmNlbnRDb21wbGV0ZSgpIHtcbiAgICBpZiAodGhpcy50b3RhbE9wZXJhdGlvbnMgPT09IDApIHsgcmV0dXJuIDEwMDsgfVxuICAgIHJldHVybiBNYXRoLmZsb29yKCh0aGlzLmNvbXBsZXRlZE9wZXJhdGlvbnMgLyB0aGlzLnRvdGFsT3BlcmF0aW9ucykgKiAxMDApO1xuICB9XG5cbiAgcHVibGljIGFib3J0KCk6IHZvaWQge1xuICAgIHRoaXMuYWJvcnRlZCA9IHRydWU7XG4gIH1cblxuICBwdWJsaWMgZ2V0IGhhc0ZhaWx1cmVzKCkge1xuICAgIHJldHVybiB0aGlzLmZhaWx1cmVzLmxlbmd0aCA+IDA7XG4gIH1cblxuICAvKipcbiAgICogUHVibGlzaCBhIHByb2dyZXNzIGV2ZW50IHRvIHRoZSBsaXN0ZW5lciwgaWYgcHJlc2VudC5cbiAgICpcbiAgICogUmV0dXJucyB3aGV0aGVyIGFuIGFib3J0IGlzIHJlcXVlc3RlZC4gSGVscGVyIHRvIGdldCByaWQgb2YgcmVwZXRpdGl2ZSBjb2RlIGluIHB1Ymxpc2goKS5cbiAgICovXG4gIHByaXZhdGUgcHJvZ3Jlc3NFdmVudChldmVudDogRXZlbnRUeXBlLCBtZXNzYWdlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgIGlmICh0aGlzLm9wdGlvbnMucHJvZ3Jlc3NMaXN0ZW5lcikgeyB0aGlzLm9wdGlvbnMucHJvZ3Jlc3NMaXN0ZW5lci5vblB1Ymxpc2hFdmVudChldmVudCwgdGhpcyk7IH1cbiAgICByZXR1cm4gdGhpcy5hYm9ydGVkO1xuICB9XG59Il19