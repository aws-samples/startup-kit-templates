import * as types from './types';
export declare function diffAttribute(oldValue: any, newValue: any): types.Difference<string>;
export declare function diffCondition(oldValue: types.Condition, newValue: types.Condition): types.ConditionDifference;
export declare function diffMapping(oldValue: types.Mapping, newValue: types.Mapping): types.MappingDifference;
export declare function diffMetadata(oldValue: types.Metadata, newValue: types.Metadata): types.MetadataDifference;
export declare function diffOutput(oldValue: types.Output, newValue: types.Output): types.OutputDifference;
export declare function diffParameter(oldValue: types.Parameter, newValue: types.Parameter): types.ParameterDifference;
export declare function diffResource(oldValue?: types.Resource, newValue?: types.Resource): types.ResourceDifference;
export declare function diffUnknown(oldValue: any, newValue: any): types.Difference<any>;
