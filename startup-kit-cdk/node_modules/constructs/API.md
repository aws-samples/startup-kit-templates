# API Reference

**Classes**

Name|Description
----|-----------
[Construct](#constructs-construct)|Represents the building block of the construct graph.
[ConstructMetadata](#constructs-constructmetadata)|Metadata keys used by constructs.
[Node](#constructs-node)|Represents the construct node in the scope tree.


**Structs**

Name|Description
----|-----------
[ConstructOptions](#constructs-constructoptions)|Options for creating constructs.
[Dependency](#constructs-dependency)|A single dependency.
[MetadataEntry](#constructs-metadataentry)|An entry in the construct metadata table.
[SynthesisOptions](#constructs-synthesisoptions)|Options for synthesis.
[ValidationError](#constructs-validationerror)|An error returned during the validation phase.


**Interfaces**

Name|Description
----|-----------
[IAspect](#constructs-iaspect)|Represents an Aspect.
[IConstruct](#constructs-iconstruct)|Represents a construct.
[INodeFactory](#constructs-inodefactory)|A factory for attaching `Node`s to the construct.
[ISynthesisSession](#constructs-isynthesissession)|Represents a single session of synthesis.
[IValidation](#constructs-ivalidation)|Implement this interface in order for the construct to be able to validate itself.


**Enums**

Name|Description
----|-----------
[ConstructOrder](#constructs-constructorder)|In what order to return constructs.



## class Construct  <a id="constructs-construct"></a>

Represents the building block of the construct graph.

All constructs besides the root construct must be created within the scope of
another construct.

__Implements__: [IConstruct](#constructs-iconstruct)

### Initializer


Creates a new construct node.

```ts
new Construct(scope: Construct, id: string, options?: ConstructOptions)
```

* **scope** (<code>[Construct](#constructs-construct)</code>)  The scope in which to define this construct.
* **id** (<code>string</code>)  The scoped construct ID.
* **options** (<code>[ConstructOptions](#constructs-constructoptions)</code>)  Options.
  * **nodeFactory** (<code>[INodeFactory](#constructs-inodefactory)</code>)  A factory for attaching `Node`s to the construct. __*Default*__: the default `Node` is associated


### Methods


#### toString() <a id="constructs-construct-tostring"></a>

Returns a string representation of this construct.

```ts
toString(): string
```


__Returns__:
* <code>string</code>

#### protected onPrepare() <a id="constructs-construct-onprepare"></a>

Perform final modifications before synthesis.

This method can be implemented by derived constructs in order to perform
final changes before synthesis. prepare() will be called after child
constructs have been prepared.

This is an advanced framework feature. Only use this if you
understand the implications.

```ts
protected onPrepare(): void
```





#### protected onSynthesize(session) <a id="constructs-construct-onsynthesize"></a>

Allows this construct to emit artifacts into the cloud assembly during synthesis.

This method is usually implemented by framework-level constructs such as `Stack` and `Asset`
as they participate in synthesizing the cloud assembly.

```ts
protected onSynthesize(session: ISynthesisSession): void
```

* **session** (<code>[ISynthesisSession](#constructs-isynthesissession)</code>)  The synthesis session.




#### protected onValidate()⚠️ <a id="constructs-construct-onvalidate"></a>

Validate the current construct.

This method can be implemented by derived constructs in order to perform
validation logic. It is called on all constructs before synthesis.

```ts
protected onValidate(): Array<string>
```


__Returns__:
* <code>Array<string></code>



## class ConstructMetadata  <a id="constructs-constructmetadata"></a>

Metadata keys used by constructs.



### Properties


Name | Type | Description 
-----|------|-------------
*static* **DISABLE_STACK_TRACE_IN_METADATA** | <code>string</code> | If set in the construct's context, omits stack traces from metadata entries.
*static* **ERROR_METADATA_KEY** | <code>string</code> | Context type for error level messages.
*static* **INFO_METADATA_KEY** | <code>string</code> | Context type for info level messages.
*static* **WARNING_METADATA_KEY** | <code>string</code> | Context type for warning level messages.



## class Node  <a id="constructs-node"></a>

Represents the construct node in the scope tree.


### Initializer




```ts
new Node(host: Construct, scope: IConstruct, id: string)
```

* **host** (<code>[Construct](#constructs-construct)</code>)  *No description*
* **scope** (<code>[IConstruct](#constructs-iconstruct)</code>)  *No description*
* **id** (<code>string</code>)  *No description*



### Properties


Name | Type | Description 
-----|------|-------------
**addr** | <code>string</code> | Returns an opaque tree-unique address for this construct.
**children** | <code>Array<[IConstruct](#constructs-iconstruct)></code> | All direct children of this construct.
**dependencies** | <code>Array<[Dependency](#constructs-dependency)></code> | Return all dependencies registered on this node or any of its children.
**id** | <code>string</code> | The id of this construct within the current scope.
**locked** | <code>boolean</code> | Returns true if this construct or the scopes in which it is defined are locked.
**metadata** | <code>Array<[MetadataEntry](#constructs-metadataentry)></code> | An immutable array of metadata objects associated with this construct.
**path** | <code>string</code> | The full, absolute path of this construct in the tree.
**root** | <code>[IConstruct](#constructs-iconstruct)</code> | Returns the root of the construct tree.
**scopes** | <code>Array<[IConstruct](#constructs-iconstruct)></code> | All parent scopes of this construct.
**uniqueId**⚠️ | <code>string</code> | A tree-global unique alphanumeric identifier for this construct.
**defaultChild**? | <code>[IConstruct](#constructs-iconstruct)</code> | Returns the child construct that has the id `Default` or `Resource"`.<br/>__*Optional*__
**scope**? | <code>[IConstruct](#constructs-iconstruct)</code> | Returns the scope in which this construct is defined.<br/>__*Optional*__
*static* **PATH_SEP** | <code>string</code> | Separator used to delimit construct path components.

### Methods


#### addDependency(...dependencies) <a id="constructs-node-adddependency"></a>

Add an ordering dependency on another Construct.

All constructs in the dependency's scope will be deployed before any
construct in this construct's scope.

```ts
addDependency(...dependencies: IConstruct[]): void
```

* **dependencies** (<code>[IConstruct](#constructs-iconstruct)</code>)  *No description*




#### addError(message) <a id="constructs-node-adderror"></a>

Adds an { "error": <message> } metadata entry to this construct.

The toolkit will fail synthesis when errors are reported.

```ts
addError(message: string): void
```

* **message** (<code>string</code>)  The error message.




#### addInfo(message) <a id="constructs-node-addinfo"></a>

Adds a { "info": <message> } metadata entry to this construct.

The toolkit will display the info message when apps are synthesized.

```ts
addInfo(message: string): void
```

* **message** (<code>string</code>)  The info message.




#### addMetadata(type, data, fromFunction?) <a id="constructs-node-addmetadata"></a>

Adds a metadata entry to this construct.

Entries are arbitrary values and will also include a stack trace to allow tracing back to
the code location for when the entry was added. It can be used, for example, to include source
mapping in CloudFormation templates to improve diagnostics.

```ts
addMetadata(type: string, data: any, fromFunction?: any): void
```

* **type** (<code>string</code>)  a string denoting the type of metadata.
* **data** (<code>any</code>)  the value of the metadata (can be a Token).
* **fromFunction** (<code>any</code>)  a function under which to restrict the metadata entry's stack trace (defaults to this.addMetadata).




#### addValidation(validation) <a id="constructs-node-addvalidation"></a>

Adds a validation to this construct.

When `node.validate()` is called, the `validate()` method will be called on
all validations and all errors will be returned.

```ts
addValidation(validation: IValidation): void
```

* **validation** (<code>[IValidation](#constructs-ivalidation)</code>)  *No description*




#### addWarning(message) <a id="constructs-node-addwarning"></a>

Adds a { "warning": <message> } metadata entry to this construct.

The toolkit will display the warning when an app is synthesized, or fail
if run in --strict mode.

```ts
addWarning(message: string): void
```

* **message** (<code>string</code>)  The warning message.




#### applyAspect(aspect) <a id="constructs-node-applyaspect"></a>

Applies the aspect to this Constructs node.

```ts
applyAspect(aspect: IAspect): void
```

* **aspect** (<code>[IAspect](#constructs-iaspect)</code>)  *No description*




#### findAll(order?) <a id="constructs-node-findall"></a>

Return this construct and all of its children in the given order.

```ts
findAll(order?: ConstructOrder): Array<IConstruct>
```

* **order** (<code>[ConstructOrder](#constructs-constructorder)</code>)  *No description*

__Returns__:
* <code>Array<[IConstruct](#constructs-iconstruct)></code>

#### findChild(id) <a id="constructs-node-findchild"></a>

Return a direct child by id.

Throws an error if the child is not found.

```ts
findChild(id: string): IConstruct
```

* **id** (<code>string</code>)  Identifier of direct child.

__Returns__:
* <code>[IConstruct](#constructs-iconstruct)</code>

#### prepare() <a id="constructs-node-prepare"></a>

Invokes "prepare" on all constructs (depth-first, post-order) in the tree under `node`.

```ts
prepare(): void
```





#### setContext(key, value) <a id="constructs-node-setcontext"></a>

This can be used to set contextual values.

Context must be set before any children are added, since children may consult context info during construction.
If the key already exists, it will be overridden.

```ts
setContext(key: string, value: any): void
```

* **key** (<code>string</code>)  The context key.
* **value** (<code>any</code>)  The context value.




#### synthesize(options) <a id="constructs-node-synthesize"></a>

Synthesizes a CloudAssembly from a construct tree.

```ts
synthesize(options: SynthesisOptions): void
```

* **options** (<code>[SynthesisOptions](#constructs-synthesisoptions)</code>)  Synthesis options.
  * **outdir** (<code>string</code>)  The output directory into which to synthesize the cloud assembly. 
  * **sessionContext** (<code>Map<string, any></code>)  Additional context passed into the synthesis session object when `construct.synth` is called. __*Default*__: no additional context is passed to `onSynthesize`
  * **skipValidation** (<code>boolean</code>)  Whether synthesis should skip the validation phase. __*Default*__: false




#### tryFindChild(id) <a id="constructs-node-tryfindchild"></a>

Return a direct child by id, or undefined.

```ts
tryFindChild(id: string): IConstruct
```

* **id** (<code>string</code>)  Identifier of direct child.

__Returns__:
* <code>[IConstruct](#constructs-iconstruct)</code>

#### tryGetContext(key) <a id="constructs-node-trygetcontext"></a>

Retrieves a value from tree context.

Context is usually initialized at the root, but can be overridden at any point in the tree.

```ts
tryGetContext(key: string): any
```

* **key** (<code>string</code>)  The context key.

__Returns__:
* <code>any</code>

#### tryRemoveChild(childName)🔹 <a id="constructs-node-tryremovechild"></a>

Remove the child with the given name, if present.

```ts
tryRemoveChild(childName: string): boolean
```

* **childName** (<code>string</code>)  *No description*

__Returns__:
* <code>boolean</code>

#### validate() <a id="constructs-node-validate"></a>

Validates tree (depth-first, pre-order) and returns the list of all errors.

An empty list indicates that there are no errors.

```ts
validate(): Array<ValidationError>
```


__Returns__:
* <code>Array<[ValidationError](#constructs-validationerror)></code>

#### *static* of(construct) <a id="constructs-node-of"></a>

Returns the node associated with a construct.

```ts
static of(construct: IConstruct): Node
```

* **construct** (<code>[IConstruct](#constructs-iconstruct)</code>)  the construct.

__Returns__:
* <code>[Node](#constructs-node)</code>



## struct ConstructOptions  <a id="constructs-constructoptions"></a>


Options for creating constructs.



Name | Type | Description 
-----|------|-------------
**nodeFactory**? | <code>[INodeFactory](#constructs-inodefactory)</code> | A factory for attaching `Node`s to the construct.<br/>__*Default*__: the default `Node` is associated



## struct Dependency  <a id="constructs-dependency"></a>


A single dependency.



Name | Type | Description 
-----|------|-------------
**source** | <code>[IConstruct](#constructs-iconstruct)</code> | Source the dependency.
**target** | <code>[IConstruct](#constructs-iconstruct)</code> | Target of the dependency.



## interface IAspect  <a id="constructs-iaspect"></a>


Represents an Aspect.
### Methods


#### visit(node) <a id="constructs-iaspect-visit"></a>

All aspects can visit an IConstruct.

```ts
visit(node: IConstruct): void
```

* **node** (<code>[IConstruct](#constructs-iconstruct)</code>)  *No description*






## interface IConstruct  <a id="constructs-iconstruct"></a>

__Implemented by__: [Construct](#constructs-construct)
__Obtainable from__: [Node](#constructs-node).[findChild](#constructs-node#constructs-node-findchild)(), [Node](#constructs-node).[tryFindChild](#constructs-node#constructs-node-tryfindchild)()

Represents a construct.


## interface INodeFactory  <a id="constructs-inodefactory"></a>


A factory for attaching `Node`s to the construct.
### Methods


#### createNode(host, scope, id) <a id="constructs-inodefactory-createnode"></a>

Returns a new `Node` associated with `host`.

```ts
createNode(host: Construct, scope: IConstruct, id: string): Node
```

* **host** (<code>[Construct](#constructs-construct)</code>)  the associated construct.
* **scope** (<code>[IConstruct](#constructs-iconstruct)</code>)  the construct's scope (parent).
* **id** (<code>string</code>)  the construct id.

__Returns__:
* <code>[Node](#constructs-node)</code>



## interface ISynthesisSession  <a id="constructs-isynthesissession"></a>


Represents a single session of synthesis.

Passed into `construct.onSynthesize()` methods.

### Properties


Name | Type | Description 
-----|------|-------------
**outdir** | <code>string</code> | The output directory for this synthesis session.



## interface IValidation  <a id="constructs-ivalidation"></a>


Implement this interface in order for the construct to be able to validate itself.
### Methods


#### validate() <a id="constructs-ivalidation-validate"></a>

Validate the current construct.

This method can be implemented by derived constructs in order to perform
validation logic. It is called on all constructs before synthesis.

```ts
validate(): Array<string>
```


__Returns__:
* <code>Array<string></code>



## struct MetadataEntry  <a id="constructs-metadataentry"></a>


An entry in the construct metadata table.



Name | Type | Description 
-----|------|-------------
**data** | <code>any</code> | The data.
**type** | <code>string</code> | The metadata entry type.
**trace**? | <code>Array<string></code> | Stack trace.<br/>__*Default*__: no trace information



## struct SynthesisOptions  <a id="constructs-synthesisoptions"></a>


Options for synthesis.



Name | Type | Description 
-----|------|-------------
**outdir** | <code>string</code> | The output directory into which to synthesize the cloud assembly.
**sessionContext**? | <code>Map<string, any></code> | Additional context passed into the synthesis session object when `construct.synth` is called.<br/>__*Default*__: no additional context is passed to `onSynthesize`
**skipValidation**? | <code>boolean</code> | Whether synthesis should skip the validation phase.<br/>__*Default*__: false



## struct ValidationError  <a id="constructs-validationerror"></a>


An error returned during the validation phase.



Name | Type | Description 
-----|------|-------------
**message** | <code>string</code> | The error message.
**source** | <code>[Construct](#constructs-construct)</code> | The construct which emitted the error.



## enum ConstructOrder  <a id="constructs-constructorder"></a>

In what order to return constructs.

Name | Description
-----|-----
**PREORDER** |Depth-first, pre-order.
**POSTORDER** |Depth-first, post-order (leaf nodes first).


